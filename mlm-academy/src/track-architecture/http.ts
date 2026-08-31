import { DEFAULT_ARCHITECTURE_FLAGS, resolveArchitectureFlags } from './flags';
import { identityFromUntrustedClient, identityFromVerifiedSession, ANON_ACCESS } from './identity';
import { decideContentAccess, decideInstanceCreation } from './access';
import { publicMetaResponse, toPublicTrackMeta } from './public-meta';
import { resolveTrackId, canPublishAsStandaloneLesson } from './resolver';
import { createTrackInstance, submitOutcome, RuntimeRejectedError } from './runtime';
import { importArchitectureSource } from './importer';
import { getArchitectureStore } from './seed';
import { stripUnsafeFacts } from './privacy';
import { sanitizeArchitectureEvent } from './events';
import { processPaymentEvent } from './payments';
import { normalizeTrackId } from '../domain/routes';
import { connectionsForTrack } from './store';
import { ProductionRepositoryNotConfiguredError } from './postgres';
import type { AccessContext, ArchitectureFlags, RouteDecision, RouteMode } from './types';
import type { ArchitectureStore } from './store';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function pathnameOf(request: Request): string {
  try {
    return new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '/';
  }
}

export function readSession(request: Request, env: NodeJS.Dict<string> = process.env): AccessContext {
  if (env.NODE_ENV === 'production') {
    return ANON_ACCESS;
  }
  const raw = request.headers.get('x-mlma-test-session');
  if (!raw) return ANON_ACCESS;
  try {
    const parsed = JSON.parse(raw) as {
      userId?: string;
      role?: AccessContext['role'];
      verified?: boolean;
      entitlements?: AccessContext['entitlements'];
      maId?: string;
      email?: string;
      groups?: string[];
    };
    if (parsed.maId || parsed.email || parsed.groups) {
      const untrusted = identityFromUntrustedClient({
        maId: parsed.maId,
        email: parsed.email,
        groups: parsed.groups,
      });
      if (!parsed.userId || parsed.verified !== true) return untrusted;
    }
    if (!parsed.userId) return ANON_ACCESS;
    return identityFromVerifiedSession({
      userId: parsed.userId,
      role: parsed.role,
      verified: parsed.verified === true,
      entitlements: parsed.entitlements,
    });
  } catch {
    return ANON_ACCESS;
  }
}

export function userDecisionView(decision: RouteDecision, access: AccessContext): Record<string, unknown> {
  const locked = decision.locked;
  const admin = access.role === 'ADMIN' && access.verified;
  return {
    matchedRuleId: admin ? decision.matchedRuleId : locked ? null : decision.matchedRuleId,
    destinationType: admin || !locked ? decision.destinationType : null,
    destinationId: admin || !locked ? decision.destinationId : null,
    destinationUrl: locked ? null : decision.destinationUrl,
    reasonCode: decision.reasonCode,
    locked: decision.locked,
    lockReason: decision.lockReason,
    recovery: admin ? decision.recovery : null,
  };
}

function modeFromAccess(access: AccessContext, flags: ArchitectureFlags): RouteMode {
  if (access.role === 'ADMIN' && flags.ADMIN_PREVIEW_ENABLED) return 'admin-preview';
  if (access.role === 'PILOT') return 'pilot';
  return 'production';
}

export async function handleArchitectureRequest(
  request: Request,
  options?: { store?: ArchitectureStore; env?: NodeJS.Dict<string>; flags?: ArchitectureFlags },
): Promise<Response> {
  const env = options?.env || process.env;
  const flags = options?.flags || resolveArchitectureFlags(env);
  let store: ArchitectureStore;
  try {
    store = options?.store || getArchitectureStore(env);
  } catch (error) {
    if (error instanceof ProductionRepositoryNotConfiguredError) {
      return json({ ok: false, code: 'STORAGE_UNCONFIGURED', message: error.message }, 503);
    }
    throw error;
  }
  const method = request.method.toUpperCase();
  const path = pathnameOf(request);
  const access = readSession(request, env);

  if (path.startsWith('/api/v1/tracks/') && path.endsWith('/meta') && method === 'GET') {
    const id = normalizeTrackId(path.split('/')[4] || '');
    if (!id) return json({ ok: false, code: 'unknown_track' }, 404);
    const resolved = resolveTrackId(id, (key) => store.getTrack(key));
    if (!resolved.definition || !resolved.canonicalId) {
      return json({ ok: false, code: resolved.error || 'unknown_track' }, 404);
    }
    const content = store.getContent(resolved.canonicalId);
    const meta = toPublicTrackMeta(resolved.definition, content?.contentStatus === 'PUBLISHED');
    sanitizeArchitectureEvent('track_meta_viewed', { track_id: resolved.canonicalId });
    return json({ ok: true, meta: publicMetaResponse(meta), redirectTo: resolved.redirect ? resolved.canonicalId : null });
  }

  if (path.startsWith('/api/v1/tracks/') && path.endsWith('/content') && method === 'GET') {
    const id = normalizeTrackId(path.split('/')[4] || '');
    if (!id) return json({ ok: false, code: 'unknown_track' }, 404);
    const resolved = resolveTrackId(id, (key) => store.getTrack(key));
    if (!resolved.definition || !resolved.canonicalId) {
      return json({ ok: false, code: 'unknown_track' }, 404);
    }
    if (!canPublishAsStandaloneLesson(resolved.definition.entityType)) {
      sanitizeArchitectureEvent('track_access_denied', { track_id: resolved.canonicalId, reason: 'ENTITY_NOT_LESSON' });
      return json({ ok: false, code: 'not_a_lesson', lockReason: 'ENTITY_NOT_LESSON' }, 403);
    }
    const content = store.getContent(resolved.canonicalId);
    const decision = decideContentAccess({
      track: resolved.definition,
      content: content || null,
      access,
      flags,
    });
    if (!decision.allowed) {
      sanitizeArchitectureEvent('track_access_denied', { track_id: resolved.canonicalId, reason: decision.lockReason });
      return json({ ok: false, code: 'denied', lockReason: decision.lockReason, kind: decision.kind || null }, 403);
    }
    return json({
      ok: true,
      trackId: resolved.canonicalId,
      contentVersion: content?.contentVersion,
      body: content?.body ?? null,
      kind: decision.kind,
      sandbox: decision.kind === 'DEMO',
      liveInstance: decision.kind === 'DEMO' ? false : true,
    });
  }

  if (path === '/api/v1/track-instances' && method === 'POST') {
    if (!access.userId || !access.verified) return json({ ok: false, code: 'AUTH_REQUIRED' }, 401);
    const body = await safeJson(request);
    const trackId = normalizeTrackId(String(body.trackId || ''));
    const track = trackId ? store.getTrack(trackId) : undefined;
    if (!trackId || !track) return json({ ok: false, code: 'unknown_track' }, 400);
    const allowed = decideInstanceCreation({
      track,
      content: store.getContent(trackId) || null,
      access,
    });
    if (!allowed.allowed) {
      return json({ ok: false, code: allowed.lockReason, lockReason: allowed.lockReason }, allowed.lockReason === 'AUTH_REQUIRED' ? 401 : 403);
    }
    try {
      const instance = createTrackInstance(store, { userId: access.userId, trackId, access });
      sanitizeArchitectureEvent('track_started', { track_id: trackId });
      return json({ ok: true, instance }, 201);
    } catch (error) {
      if (error instanceof RuntimeRejectedError) {
        return json({ ok: false, code: error.lockReason, lockReason: error.lockReason }, 403);
      }
      throw error;
    }
  }

  if (path.startsWith('/api/v1/track-instances/') && method === 'GET' && !path.endsWith('/outcomes')) {
    if (!access.userId) return json({ ok: false, code: 'AUTH_REQUIRED' }, 401);
    const instanceId = path.split('/')[4];
    const instance = store.getInstance(instanceId);
    if (!instance || instance.userId !== access.userId) return json({ ok: false, code: 'not_found' }, 404);
    return json({ ok: true, instance });
  }

  if (path.startsWith('/api/v1/track-instances/') && path.endsWith('/outcomes') && method === 'POST') {
    if (!access.userId || !access.verified) return json({ ok: false, code: 'AUTH_REQUIRED' }, 401);
    const instanceId = path.split('/')[4];
    const body = await safeJson(request);
    if (!body.clientEventId) return json({ ok: false, code: 'client_event_required' }, 400);
    try {
      const result = submitOutcome(store, {
        userId: access.userId,
        instanceId,
        clientEventId: String(body.clientEventId || ''),
        outcomeCode: String(body.outcomeCode || ''),
        facts: stripUnsafeFacts((body.facts || {}) as Record<string, unknown>),
        access,
        flags,
        mode: modeFromAccess(access, flags),
      });
      return json({
        ok: true,
        duplicate: result.duplicate,
        outcomeId: result.outcomeId,
        decision: userDecisionView(result.decision, access),
      });
    } catch {
      return json({ ok: false, code: 'instance_not_found' }, 404);
    }
  }

  if (path === '/api/v1/me/route' && method === 'GET') {
    if (!access.userId) return json({ ok: false, code: 'AUTH_REQUIRED' }, 401);
    return json({
      ok: true,
      instances: store.listInstances(access.userId),
      decisions: store.listDecisions(access.userId).map((row) => ({
        decisionId: row.decisionId,
        fromTrackId: row.fromTrackId,
        destinationType: row.locked && access.role !== 'ADMIN' ? null : row.destinationType,
        destinationId: row.locked && access.role !== 'ADMIN' ? null : row.destinationId,
        locked: row.locked,
        lockReason: row.lockReason,
        reasonCode: row.reasonCode,
      })),
    });
  }

  if (path === '/api/v1/me/entitlements' && method === 'GET') {
    if (!access.userId || !access.verified) {
      return json({ ok: true, entitlements: [] });
    }
    return json({
      ok: true,
      entitlements: store.listEntitlements(access.userId).map((row) => ({
        productCode: row.productCode,
        status: row.entitlementStatus,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      })),
    });
  }

  if (path === '/api/v1/admin/tracks/import/dry-run' || path === '/api/v1/admin/tracks/import/apply') {
    if (access.role !== 'ADMIN' || !access.verified) return json({ ok: false, code: 'admin_required' }, 403);
    const dryRun = path.endsWith('dry-run');
    const body = await safeJson(request);
    const filename = String(body.filename || 'package.json');
    const payload = (body.package || body.router || body) as unknown;
    const text = JSON.stringify(payload);
    const asRecord = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const result =
      asRecord.packageVersion || asRecord.version === '3.0' || Array.isArray(asRecord.effectiveTrackConnections)
        ? importArchitectureSource(store, { filename, text, json: payload, contentBody: body.contentBody }, { dryRun, userId: access.userId })
        : importArchitectureSource(store, { filename, text, json: payload }, { dryRun, userId: access.userId });
    return json({ ok: result.ok, result }, result.ok ? 200 : 400);
  }

  if (path.startsWith('/api/v1/admin/tracks/') && path.endsWith('/connections') && method === 'GET') {
    if (access.role !== 'ADMIN' || !access.verified) return json({ ok: false, code: 'admin_required' }, 403);
    const id = normalizeTrackId(path.split('/')[5] || '');
    if (!id || !store.getTrack(id)) return json({ ok: false, code: 'unknown_track' }, 404);
    const { incoming, outgoing } = connectionsForTrack(store, id);
    return json({
      ok: true,
      trackId: id,
      connections: { incoming, outgoing },
      connectionIndex: store.getConnectionIndex(id) || null,
      lockedSlots: [...incoming, ...outgoing].filter((row) => row.activationMode === 'LOCKED_NEXT_ACTION_SLOT'),
    });
  }

  if (path === '/api/v1/payments/webhook' && method === 'POST') {
    const raw = await request.text();
    const processed = processPaymentEvent(
      store,
      flags,
      {
        providerCode: 'test',
        providerEventId: request.headers.get('x-event-id') || 'evt',
        idempotencyKey: request.headers.get('idempotency-key') || 'idem',
        signature: request.headers.get('x-signature') || '',
        rawBody: raw,
        eventType: 'payment.succeeded',
      },
      { webhookSecret: env.MLMA_WEBHOOK_SECRET },
    );
    return json({ ok: processed.ok, reason: processed.reason }, processed.ok ? 200 : 403);
  }

  void DEFAULT_ARCHITECTURE_FLAGS;
  return json({ ok: false, code: 'not_found' }, 404);
}

async function safeJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (!text) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
