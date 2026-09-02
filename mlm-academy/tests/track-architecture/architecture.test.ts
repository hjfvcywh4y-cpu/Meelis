import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { createSeededStore } from '@/track-architecture/seed';
import { decideRoute } from '@/track-architecture/route-engine';
import { DEFAULT_ARCHITECTURE_FLAGS } from '@/track-architecture/flags';
import { ANON_ACCESS, identityFromUntrustedClient, identityFromVerifiedSession } from '@/track-architecture/identity';
import { resolveTrackId, canPublishAsStandaloneLesson } from '@/track-architecture/resolver';
import { importArchitectureSource, importFullGraphJson, importRouterJson, importTrackPackage } from '@/track-architecture/importer';
import { MemoryArchitectureStore, newId } from '@/track-architecture/store';
import { graphSource, routerSource } from '@/track-architecture/seed';
import { decideContentAccess, decideInstanceCreation } from '@/track-architecture/access';
import { handleArchitectureRequest } from '@/track-architecture/http';
import { parseTrackPackage } from '@/track-architecture/package';
import { stripUnsafeFacts, assertNoContactPii } from '@/track-architecture/privacy';
import { processPaymentEvent } from '@/track-architecture/payments';
import { submitOutcome, createTrackInstance, RuntimeRejectedError } from '@/track-architecture/runtime';
import { checkTrack } from '@/track-architecture/check';
import { GRAPH_V3_EXPECTED } from '@/track-architecture/from-graph';
import {
  FakePostgresClient,
  PostgresArchitectureStore,
  ProductionRepositoryNotConfiguredError,
  isProductionRepositoryConfigured,
} from '@/track-architecture/postgres';
import { getArchitectureStore } from '@/track-architecture/seed';
import { parseTrackIdFromLocation, trackUrl, normalizeTrackId, routes } from '@/domain/routes';
import type { ArchitectureFlags, RouteContext } from '@/track-architecture/types';

const PILOT_FLAGS: ArchitectureFlags = {
  ...DEFAULT_ARCHITECTURE_FLAGS,
  PAID_TRACK_NAVIGATION_ENABLED: false,
};

function ctx(partial: Partial<RouteContext> = {}): RouteContext {
  return {
    fromId: 'A2-008',
    outcomeCode: 'NEXT_MESSAGE',
    facts: { 'contact.next_action': 'MESSAGE' },
    userAccess: ANON_ACCESS,
    now: '2026-08-31T00:00:00Z',
    mode: 'pilot',
    flags: PILOT_FLAGS,
    ...partial,
  };
}

function sessionHeader(value: unknown) {
  return { 'x-mlma-test-session': JSON.stringify(value) };
}

describe('registry v2', () => {
  it('регистрирует ровно 112 уникальных ID и ожидаемые типы', () => {
    const store = createSeededStore();
    const tracks = store.listTracks();
    expect(tracks).toHaveLength(112);
    expect(new Set(tracks.map((row) => row.id)).size).toBe(112);
    const counts = tracks.reduce<Record<string, number>>((acc, row) => {
      acc[row.entityType] = (acc[row.entityType] || 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({
      TRACK: 49,
      CONDITIONAL_TRACK: 2,
      REMEDIATION: 17,
      GATE: 9,
      EMBEDDED_TOOL: 19,
      SYSTEM_ACTION: 8,
      ALIAS: 8,
    });
  });

  it('импортирует 253 рабочие связи; 231 базовых слотов не исполняются', () => {
    const store = createSeededStore();
    expect(store.listRules()).toHaveLength(58);
    expect(store.listConnections()).toHaveLength(253);
    expect(store.listConnectionIndex()).toHaveLength(112);
    expect(store.listConnections().filter((row) => row.activationMode === 'LOCKED_NEXT_ACTION_SLOT')).toHaveLength(216);
    expect(store.listConnections().filter((row) => row.activationMode === 'ROUTE_RULE')).toHaveLength(37);
    const archive = store.listArchiveEdges();
    expect(archive).toHaveLength(231);
    expect(archive.every((edge) => edge.active === false)).toBe(true);
    expect(archive.every((edge) => edge.statusV2 === 'AUDIT_ONLY_NOT_EXECUTABLE')).toBe(true);
    const locked = store.listConnections().find((row) => row.fromId === 'A1-001' && row.toId === 'A1-004');
    expect(locked?.activationMode).toBe('LOCKED_NEXT_ACTION_SLOT');
    expect(locked?.executable).toBe(false);
    expect(locked?.userVisible).toBe(false);
    const fromA1001 = decideRoute(
      store,
      ctx({ fromId: 'A1-001', outcomeCode: 'DONE', facts: {}, mode: 'pilot' }),
    );
    expect(fromA1001.reasonCode).toBe('NO_MATCHING_RULE');
    expect(fromA1001.destinationId).toBeNull();
    const a1001 = store.getTrack('A1-001');
    expect(String(a1001?.source.legacyNextIds || '')).toMatch(/A1-004/);
  });
});

describe('Route Engine', () => {
  it('draft rule не исполняется в production и исполняется в pilot', () => {
    const store = createSeededStore();
    const production = decideRoute(store, ctx({ mode: 'production' }));
    expect(production.reasonCode).toBe('NO_MATCHING_RULE');
    const pilot = decideRoute(store, ctx({ mode: 'pilot' }));
    expect(pilot.reasonCode).toBe('MATCHED');
    expect(pilot.matchedRuleId).toBe('RR2-005');
    expect(pilot.destinationId).toBe('A3-002');
    expect(pilot.locked).toBe(true);
    expect(pilot.lockReason).toBe('FEATURE_DISABLED');
    expect(pilot.destinationUrl).toBeNull();
  });

  it('A2-008 даёт разные решения для разных outcomes', () => {
    const store = createSeededStore();
    const message = decideRoute(store, ctx());
    const referral = decideRoute(
      store,
      ctx({ outcomeCode: 'NEXT_REFERRAL_REQUEST', facts: { 'contact.next_action': 'ASK_REFERRAL' } }),
    );
    const call = decideRoute(
      store,
      ctx({ outcomeCode: 'NEXT_REFERRAL_CALL', facts: { 'contact.referral_permission': true } }),
    );
    const schedule = decideRoute(
      store,
      ctx({ outcomeCode: 'NEXT_SCHEDULE', facts: { 'contact.next_action': 'SCHEDULE_TALK' } }),
    );
    const reason = decideRoute(
      store,
      ctx({ outcomeCode: 'NEXT_NEEDS_REASON', facts: { 'contact.real_reason': false } }),
    );
    const wait = decideRoute(
      store,
      ctx({ outcomeCode: 'NEXT_WAIT', facts: { 'contact.appropriate_now': false } }),
    );
    const small = decideRoute(
      store,
      ctx({ outcomeCode: 'PLAN_TOO_SMALL', facts: { selected_contact_count: 3 } }),
    );
    expect(message.destinationId).toBe('A3-002');
    expect(referral.destinationId).toBe('A2-013');
    expect(call.destinationId).toBe('A3-003');
    expect(schedule.destinationId).toBe('A3-005');
    expect(reason.destinationId).toBe('A3-016');
    expect(wait.destinationType).toBe('WAIT_UNTIL');
    expect(small.destinationId).toBe('A2-010');
    expect(new Set([message, referral, call, schedule, reason, wait, small].map((row) => row.matchedRuleId)).size).toBe(7);
  });

  it('прямой отказ завершается DONE; пауза с разрешением — WAIT_UNTIL', () => {
    const store = createSeededStore();
    const refusal = decideRoute(
      store,
      ctx({
        fromId: 'A5-014',
        outcomeCode: 'REFUSAL_CLOSED',
        facts: { 'refusal.status': 'CLOSED' },
        mode: 'production',
      }),
    );
    expect(refusal.matchedRuleId).toBe('RR2-034');
    expect(refusal.destinationType).toBe('DONE');
    const wait = decideRoute(
      store,
      ctx({
        fromId: 'A5-010',
        outcomeCode: 'FOLLOW_UP_SET',
        facts: { 'follow_up.permission': true },
        mode: 'pilot',
      }),
    );
    expect(wait.destinationType).toBe('WAIT_UNTIL');
  });

  it('конфликт равноприоритетных правил контролируемый', () => {
    const store = createSeededStore();
    store.upsertRule({
      ruleId: 'RR-TEST-A',
      fromTrackId: 'A1-001',
      outcomeCode: 'TEST_CONFLICT',
      fieldPath: 'flag',
      operatorCode: '=',
      expectedValue: true,
      destinationType: 'TRACK',
      destinationId: 'A1-002',
      reasonText: 'a',
      stopRule: '',
      recovery: null,
      priority: 5,
      ownerLabel: 'test',
      ruleVersion: 'test',
      ruleStatus: 'VALIDATED_RULE',
      sourceChecksum: 'test',
    });
    store.upsertRule({
      ruleId: 'RR-TEST-B',
      fromTrackId: 'A1-001',
      outcomeCode: 'TEST_CONFLICT',
      fieldPath: 'flag',
      operatorCode: '=',
      expectedValue: true,
      destinationType: 'TRACK',
      destinationId: 'A1-003',
      reasonText: 'b',
      stopRule: '',
      recovery: null,
      priority: 5,
      ownerLabel: 'test',
      ruleVersion: 'test',
      ruleStatus: 'VALIDATED_RULE',
      sourceChecksum: 'test',
    });
    const decision = decideRoute(
      store,
      ctx({ fromId: 'A1-001', outcomeCode: 'TEST_CONFLICT', facts: { flag: true }, mode: 'production' }),
    );
    expect(decision.reasonCode).toBe('CONFLICT');
    expect(decision.destinationId).toBeNull();
  });

  it('не использует eval', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/track-architecture/evaluator.ts'), 'utf8');
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/new Function/);
  });

  it('A2-008 не корень графа: правила есть и у других узлов', () => {
    const store = createSeededStore();
    const fromIds = new Set(store.listRules().map((rule) => rule.fromTrackId));
    expect(fromIds.has('A2-008')).toBe(true);
    expect(fromIds.size).toBeGreaterThan(1);
    expect(store.listEntryRules().some((rule) => rule.destinationId === 'A2-008')).toBe(true);
    expect(store.listEntryRules().some((rule) => rule.destinationId !== 'A2-008')).toBe(true);
  });
});

describe('resolver и URL', () => {
  it('ALIAS резолвится без копии контента; петля и self-alias ловятся', () => {
    const store = createSeededStore();
    const alias = resolveTrackId('A1-016', (id) => store.getTrack(id));
    expect(alias.canonicalId).toBe('A3-013');
    expect(alias.redirect).toBe(true);
    expect(store.getContent('A1-016')).toBeUndefined();
    const loop = resolveTrackId('A6-017', (id) => store.getTrack(id));
    expect(loop.error).toBe('CANONICAL_MISSING');
    expect(loop.canonicalId).toBeNull();
    expect(store.getTrack('A6-017')?.dataQuality).toBe('DATA_BLOCKED');
  });

  it('GATE / EMBEDDED_TOOL / SYSTEM_ACTION / ALIAS не публикуются как урок', () => {
    const store = createSeededStore();
    for (const track of store.listTracks()) {
      if (['GATE', 'EMBEDDED_TOOL', 'SYSTEM_ACTION', 'ALIAS'].includes(track.entityType)) {
        expect(canPublishAsStandaloneLesson(track.entityType)).toBe(false);
      }
    }
  });

  it('trackUrl канонический query-формы, pretty URL остаётся alias, оба парсятся', () => {
    expect(trackUrl('A2-008')).toBe('/track?id=a2-008');
    expect(trackUrl('a2-008')).toBe('/track?id=a2-008');
    expect(routes.track('A2-008')).toBe('/track/a2-008');
    expect(parseTrackIdFromLocation('/track', 'id=a2-008')).toBe('A2-008');
    expect(parseTrackIdFromLocation('/track/a2-008', '')).toBe('A2-008');
    expect(normalizeTrackId('a2-008')).toBe('A2-008');
  });
});

describe('access boundary', () => {
  it('без entitlement paid content закрыт даже по прямому API', async () => {
    const store = createSeededStore();
    store.upsertContent({
      id: newId('cv'),
      trackId: 'A3-002',
      contentVersion: '9.9.9',
      contentStatus: 'PUBLISHED',
      contentFormat: 'json',
      privateContentRef: 'server/content/tracks/a3-002/0.1.0',
      checksum: 'x',
      productPolicy: { policy: 'ENTITLED' },
      createdAt: '2026-08-31T00:00:00Z',
      publishedAt: '2026-08-31T00:00:00Z',
      body: { secret: 'MLMA_SERVER_ONLY_A3_002_FIXTURE' },
    });
    const denied = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/a3-002/content'), {
      store,
      env: { NODE_ENV: 'test' },
    });
    expect([401, 403]).toContain(denied.status);
    const payload = await denied.json();
    expect(JSON.stringify(payload)).not.toContain('MLMA_SERVER_ONLY_A3_002_FIXTURE');

    const spoofed = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/tracks/a3-002/content', {
        headers: sessionHeader({ maId: '1', email: 'a@b.c', groups: ['FULL'], verified: false }),
      }),
      { store, env: { NODE_ENV: 'test' } },
    );
    expect([401, 403]).toContain(spoofed.status);

    const entitled = identityFromVerifiedSession({
      userId: 'user-1',
      verified: true,
      role: 'FULL',
      entitlements: [{ productCode: 'TEST', status: 'active', startsAt: '2026-01-01T00:00:00Z', endsAt: null, grantsAll: true }],
    });
    const allowed = decideContentAccess({
      track: store.getTrack('A3-002')!,
      content: store.getContent('A3-002', '9.9.9')!,
      access: entitled,
      flags: { ...DEFAULT_ARCHITECTURE_FLAGS, PAID_TRACK_NAVIGATION_ENABLED: true },
    });
    expect(allowed.allowed).toBe(true);

    const navOff = decideRoute(store, ctx({ userAccess: entitled, flags: { ...DEFAULT_ARCHITECTURE_FLAGS, REGISTERED_BETA_ACCESS_ENABLED: false }, mode: 'pilot' }));
    expect(navOff.locked).toBe(true);
    expect(navOff.lockReason).toBe('FEATURE_DISABLED');
  });

  it('query/localStorage/success page не дают entitlement', () => {
    expect(identityFromUntrustedClient({ maId: 'x', email: 'a@b.c', groups: ['FULL'], query: { paid: '1' } })).toEqual(ANON_ACCESS);
  });

  it('admin preview отделён от пользовательской покупки', async () => {
    const store = createSeededStore();
    store.upsertContent({
      id: newId('cv'),
      trackId: 'A3-002',
      contentVersion: 'admin',
      contentStatus: 'PUBLISHED',
      contentFormat: 'json',
      privateContentRef: 'server-only',
      checksum: 'x',
      productPolicy: {},
      createdAt: '2026-08-31T00:00:00Z',
      publishedAt: '2026-08-31T00:00:00Z',
      body: { secret: 'ADMIN_ONLY_BODY' },
    });
    const user = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/tracks/A3-002/content', {
        headers: sessionHeader({ userId: 'u1', role: 'FULL', verified: true, entitlements: [] }),
      }),
      { store, env: { NODE_ENV: 'test' }, flags: { ...DEFAULT_ARCHITECTURE_FLAGS, REGISTERED_BETA_ACCESS_ENABLED: false } },
    );
    expect(user.status).toBe(403);
    const admin = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/tracks/A3-002/content', {
        headers: sessionHeader({ userId: 'admin', role: 'ADMIN', verified: true, entitlements: [] }),
      }),
      { store, env: { NODE_ENV: 'test' } },
    );
    expect(admin.status).toBe(200);
    const body = await admin.json();
    expect(body.body.secret).toBe('ADMIN_ONLY_BODY');
  });

  it('GATE не отдаётся как урок', async () => {
    const store = createSeededStore();
    const res = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/A1-003/content'), {
      store,
      env: { NODE_ENV: 'test' },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).lockReason).toBe('ENTITY_NOT_LESSON');
  });

  it('платежный webhook при выключенных платежах ничего не выдаёт', () => {
    const store = createSeededStore();
    const result = processPaymentEvent(
      store,
      DEFAULT_ARCHITECTURE_FLAGS,
      {
        providerCode: 'test',
        providerEventId: '1',
        idempotencyKey: '1',
        signature: 'x',
        rawBody: '{}',
        eventType: 'payment.succeeded',
        userId: 'u',
        productCode: 'FULL',
      },
      { webhookSecret: 'secret' },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('payments_disabled');
    expect(store.listEntitlements('u')).toHaveLength(0);
  });
});

describe('importer', () => {
  it('идемпотентно сеет 112/58 и отклоняет неизвестный destination и alias loop в пакете', () => {
    const store = new MemoryArchitectureStore();
    const source = routerSource();
    const first = importRouterJson(store, source, { dryRun: false });
    const second = importRouterJson(store, source, { dryRun: false });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(store.listTracks()).toHaveLength(112);
    expect(store.listRules()).toHaveLength(58);

    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/track-packages/a3-002-test/package.json'), 'utf8'),
    );
    pkg.routeRules = [
      {
        ruleId: 'RR-BAD-DEST',
        fromId: 'A3-002',
        outcomeCode: 'MESSAGE_SENT',
        field: 'message.status',
        operator: '=',
        value: 'SENT',
        destinationType: 'TRACK',
        destinationId: 'A9-999',
        priority: 1,
        version: '0.1.0',
        status: 'PILOT_DRAFT_TO_TEST',
      },
    ];
    const parsed = parseTrackPackage(pkg);
    expect(parsed.ok).toBe(false);

    const loopPkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/track-packages/a3-002-test/package.json'), 'utf8'),
    );
    loopPkg.track.id = 'A1-005';
    loopPkg.track.canonicalId = 'A1-005';
    loopPkg.track.entityType = 'ALIAS';
    const loop = importTrackPackage(store, { filename: 'loop.json', text: JSON.stringify(loopPkg), json: loopPkg }, { dryRun: true });
    expect(loop.ok).toBe(false);
    expect(loop.issues.some((issue) => issue.code === 'alias_content' || issue.code === 'entity_mismatch')).toBe(true);
  });

  it('dry-run и apply тестового пакета A3-002 не публикуют соседние страницы', () => {
    const store = createSeededStore();
    const pkgPath = path.join(process.cwd(), 'tests/fixtures/track-packages/a3-002-test/package.json');
    const contentPath = path.join(process.cwd(), 'tests/fixtures/track-packages/a3-002-test/content.json');
    const json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const body = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    const source = { filename: 'package.json', text: JSON.stringify(json), json, contentBody: body };
    const dry = importTrackPackage(store, source, { dryRun: true });
    expect(dry.ok).toBe(true);
    expect(store.getContent('A3-002')).toBeUndefined();
    const apply = importTrackPackage(store, source, { dryRun: false });
    expect(apply.ok).toBe(true);
    expect(store.getContent('A3-002')?.contentStatus).toBe('DRAFT');
    expect(store.getContent('A3-002')?.body).toMatchObject({ secret: 'MLMA_SERVER_ONLY_A3_002_FIXTURE' });
    expect(store.listTracks()).toHaveLength(112);
  });

  it('unknown destination JSON id отклоняется на уровне валидации графа', () => {
    const store = createSeededStore();
    store.upsertRule({
      ruleId: 'RR-UNKNOWN',
      fromTrackId: 'A3-002',
      outcomeCode: 'X',
      fieldPath: 'flag',
      operatorCode: '=',
      expectedValue: true,
      destinationType: 'TRACK',
      destinationId: 'A9-001',
      reasonText: '',
      stopRule: '',
      recovery: null,
      priority: 1,
      ownerLabel: 't',
      ruleVersion: 't',
      ruleStatus: 'PILOT_DRAFT_TO_TEST',
      sourceChecksum: 't',
    });
    // Engine still will not guess; destination exists only if registry has it.
    expect(store.getTrack('A9-001')).toBeUndefined();
    const rejected = importRouterJson(new MemoryArchitectureStore(), routerSource(), { dryRun: true });
    expect(rejected.ok).toBe(true);
    const fake = JSON.parse(JSON.stringify((routerSource() as { json: { routeRules: unknown[] } }).json));
    fake.routeRules = [
      {
        ruleId: 'RR2-999',
        fromId: 'A2-008',
        outcomeCode: 'NEXT_MESSAGE',
        field: 'contact.next_action',
        operator: '=',
        value: 'MESSAGE',
        destinationType: 'TRACK',
        destinationId: 'A9-999',
        reason: 'bad',
        stopRule: '',
        recoveryRule: '',
        priority: 10,
        owner: 't',
        version: '2.0',
        status: 'PILOT_DRAFT_TO_TEST',
      },
    ];
    const bad = importRouterJson(new MemoryArchitectureStore(), { filename: 'bad.json', text: JSON.stringify(fake), json: fake }, { dryRun: true });
    expect(bad.ok).toBe(false);
    expect(bad.issues.some((issue) => issue.code === 'unknown_destination' || issue.code === 'rule_count')).toBe(true);
  });
});

describe('runtime privacy and API', () => {
  it('не принимает контактные ПДн в facts и аналитику', () => {
    const facts = stripUnsafeFacts({
      'contact.next_action': 'MESSAGE',
      phone: '+7999',
      email: 'human@example.com',
      message_text: 'привет',
      contact_name: 'Иван',
    });
    expect(facts.phone).toBeUndefined();
    expect(facts.email).toBeUndefined();
    expect(facts.message_text).toBeUndefined();
    expect(facts['contact.next_action']).toBe('MESSAGE');
    expect(assertNoContactPii({ phone: '1' }).length).toBeGreaterThan(0);
  });

  it('outcome идемпотентен по client event id; навигация locked', () => {
    const store = createSeededStore();
    const instance = createTrackInstance(store, { userId: 'u1', trackId: 'A2-008' });
    const access = identityFromVerifiedSession({ userId: 'u1', verified: true, role: 'FULL' });
    const first = submitOutcome(store, {
      userId: 'u1',
      instanceId: instance.instanceId,
      clientEventId: 'evt-1',
      outcomeCode: 'NEXT_MESSAGE',
      facts: { 'contact.next_action': 'MESSAGE', message_text: 'secret hello' },
      access,
      flags: DEFAULT_ARCHITECTURE_FLAGS,
      mode: 'pilot',
    });
    const second = submitOutcome(store, {
      userId: 'u1',
      instanceId: instance.instanceId,
      clientEventId: 'evt-1',
      outcomeCode: 'NEXT_MESSAGE',
      facts: { 'contact.next_action': 'MESSAGE' },
      access,
      flags: DEFAULT_ARCHITECTURE_FLAGS,
      mode: 'pilot',
    });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(first.decision.destinationId).toBe('A3-002');
    expect(first.decision.locked).toBe(true);
    const stored = store.findOutcomeByClientEvent('u1', 'evt-1');
    expect(stored?.safeFacts.message_text).toBeUndefined();
  });

  it('meta публична, import без admin закрыт, production test-header игнорируется', async () => {
    const store = createSeededStore();
    const meta = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/a2-008/meta'), {
      store,
      env: { NODE_ENV: 'test' },
    });
    expect(meta.status).toBe(200);
    const body = await meta.json();
    expect(body.meta.id).toBe('A2-008');
    expect(body.meta.title).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain('legacyNextIds');
    expect(JSON.stringify(body)).not.toContain('RR2-005');
    expect(JSON.stringify(body)).not.toContain('effectiveTrackConnections');
    expect(JSON.stringify(body)).not.toContain('LOCKED_NEXT_ACTION_SLOT');

    const importDenied = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/admin/tracks/import/apply', { method: 'POST', body: '{}' }),
      { store, env: { NODE_ENV: 'test' } },
    );
    expect(importDenied.status).toBe(403);

    const prod = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/tracks/A3-002/content', {
        headers: sessionHeader({ userId: 'admin', role: 'ADMIN', verified: true }),
      }),
      { store, env: { NODE_ENV: 'production' } },
    );
    expect(prod.status).toBe(403);
  });

  it('checkTrack описывает сущность и не предлагает legacy next', () => {
    const report = checkTrack(createSeededStore(), 'a2-008');
    expect(report.ok).toBe(true);
    expect(report.entityType).toBe('TRACK');
    expect(report.v2RuleCount).toBe(7);
    expect(report.archivedLegacyEdges).toBeGreaterThan(0);
    expect(report.archivedEdgesExecutable).toBe(0);
  });
});

describe('public bundle boundary', () => {
  it('секрет фикстуры и полный router v2 не лежат в клиентских исходниках Tilda/Next UI', () => {
    const secret = 'MLMA_SERVER_ONLY_A3_002_FIXTURE';
    const roots = [
      path.join(process.cwd(), 'tilda/src'),
      path.join(process.cwd(), 'src/app'),
      path.join(process.cwd(), 'src/components'),
    ];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const files = walk(root).filter((file) => /\.(js|ts|tsx|json|css|html)$/.test(file));
      for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        expect(text.includes(secret), file).toBe(false);
        expect(text.includes('"routeRules"') && text.includes('RR2-005'), file).toBe(false);
        expect(text.includes('effectiveTrackConnections'), file).toBe(false);
        expect(text.includes('LOCKED_NEXT_ACTION_SLOT'), file).toBe(false);
      }
    }
    const fixture = fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/track-packages/a3-002-test/content.json'), 'utf8');
    expect(fixture).toContain(secret);
    const paid = fs.readFileSync(path.join(process.cwd(), 'server/content/tracks/a3-002/0.1.0/content.json'), 'utf8');
    expect(paid).toContain('Первое сообщение без рекламной простыни');
    expect(paid).not.toContain(secret);
  });

  it('публичный поиск по-прежнему стартует только по кнопке или Enter', () => {
    const ui = fs.readFileSync(path.join(process.cwd(), 'tilda/src/ui.js'), 'utf8');
    expect(ui).toMatch(/type="submit">Найти решение/);
    expect(ui).not.toMatch(/input.*oninput.*searchCatalog/);
  });
});

describe('full graph v3 acceptance numbers', () => {
  it('импорт даёт 112/231/22/253/58/112/36 и zero broken', () => {
    const store = new MemoryArchitectureStore();
    const result = importFullGraphJson(store, graphSource(), { dryRun: false });
    expect(result.ok).toBe(true);
    expect(result.counts).toMatchObject({
      tracks: GRAPH_V3_EXPECTED.nodes,
      rules: GRAPH_V3_EXPECTED.structuredRouteRules,
      archiveEdges: GRAPH_V3_EXPECTED.designConnections,
      designConnections: GRAPH_V3_EXPECTED.designConnections,
      ruleDerivedConnections: GRAPH_V3_EXPECTED.ruleDerivedConnections,
      effectiveTrackConnections: GRAPH_V3_EXPECTED.effectiveTrackConnections,
      connectionIndex: GRAPH_V3_EXPECTED.connectionIndex,
      nodesWithoutEffectiveIncoming: GRAPH_V3_EXPECTED.nodesWithoutEffectiveIncoming,
      lockedSlots: 216,
      routeRuleConnections: 37,
    });
    expect(store.listTracks()).toHaveLength(112);
    expect(store.listConnections()).toHaveLength(253);
    expect(store.listConnectionIndex()).toHaveLength(112);
    expect(result.issues.some((issue) => issue.message.includes('A6-017'))).toBe(true);
  });

  it('закрытая связь A1-001 → A1-004 существует, видна admin API и не исполняется', async () => {
    const store = createSeededStore();
    const slot = store.listConnections().find((row) => row.fromId === 'A1-001' && row.toId === 'A1-004');
    expect(slot).toBeDefined();
    expect(slot?.activationMode).toBe('LOCKED_NEXT_ACTION_SLOT');
    expect(slot?.executable).toBe(false);
    const decision = decideRoute(store, ctx({ fromId: 'A1-001', outcomeCode: 'NEXT', facts: {}, mode: 'pilot' }));
    expect(decision.reasonCode).toBe('NO_MATCHING_RULE');
    expect(decision.destinationId).toBeNull();
    const admin = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/admin/tracks/A1-001/connections', {
        headers: sessionHeader({ userId: 'admin', role: 'ADMIN', verified: true }),
      }),
      { store, env: { NODE_ENV: 'test' } },
    );
    expect(admin.status).toBe(200);
    const body = await admin.json();
    expect(JSON.stringify(body)).toContain('A1-004');
    expect(body.lockedSlots.some((row: { toId: string }) => row.toId === 'A1-004')).toBe(true);
    const anon = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/admin/tracks/A1-001/connections'),
      { store, env: { NODE_ENV: 'test' } },
    );
    expect(anon.status).toBe(403);
  });

  it('RouteRule исполняет только разрешённый outcome', () => {
    const store = createSeededStore();
    const matched = decideRoute(store, ctx({ mode: 'pilot' }));
    expect(matched.reasonCode).toBe('MATCHED');
    expect(matched.matchedRuleId).toBe('RR2-005');
    expect(matched.destinationId).toBe('A3-002');
    const other = decideRoute(
      store,
      ctx({ outcomeCode: 'NEXT_MESSAGE', facts: { 'contact.next_action': 'ASK_REFERRAL' }, mode: 'pilot' }),
    );
    expect(other.matchedRuleId).not.toBe('RR2-005');
    expect(other.destinationId).not.toBe('A3-002');
  });

  it('A2-008 и A3-002 получают входы/выходы из полного connectionIndex', () => {
    const store = createSeededStore();
    const a2 = store.getConnectionIndex('A2-008');
    const a3 = store.getConnectionIndex('A3-002');
    expect(a2?.incomingDesignConnections).toHaveLength(6);
    expect(a2?.outgoingDesignConnections).toHaveLength(2);
    expect(a2?.incomingEffectiveConnections).toHaveLength(6);
    expect(a2?.outgoingEffectiveConnections).toHaveLength(6);
    expect(a2?.outgoingRouteRuleIds).toEqual(['RR2-005', 'RR2-006', 'RR2-007', 'RR2-008', 'RR2-009', 'RR2-010', 'RR2-011']);
    expect(a2?.incomingRouteRuleIds).toEqual(['RR2-001', 'RR2-003']);
    expect(a2?.externalEntryRuleIds).toEqual(['ER-001']);
    expect(a3?.incomingDesignConnections).toHaveLength(5);
    expect(a3?.outgoingDesignConnections).toHaveLength(2);
    expect(a3?.incomingEffectiveConnections).toHaveLength(6);
    expect(a3?.outgoingEffectiveConnections).toHaveLength(3);
    expect(a3?.outgoingRouteRuleIds).toEqual(['RR2-014', 'RR2-015', 'RR2-016']);
    expect(a3?.incomingRouteRuleIds).toEqual(['RR2-005', 'RR2-012']);
    expect(a3?.externalEntryRuleIds).toEqual(['ER-003']);
  });
});

describe('content package isolation, demo sandbox, postgres fail-closed', () => {
  it('установка content package не меняет соседние страницы и связи', () => {
    const store = createSeededStore();
    const neighborTitle = store.getTrack('A2-008')!.title;
    const neighborConnections = JSON.stringify(store.listConnections());
    const pkgPath = path.join(process.cwd(), 'tests/fixtures/track-packages/a3-002-test/package.json');
    const contentPath = path.join(process.cwd(), 'tests/fixtures/track-packages/a3-002-test/content.json');
    const json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const body = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    const apply = importTrackPackage(
      store,
      { filename: 'package.json', text: JSON.stringify(json), json, contentBody: body },
      { dryRun: false },
    );
    expect(apply.ok).toBe(true);
    expect(store.getTrack('A2-008')?.title).toBe(neighborTitle);
    expect(JSON.stringify(store.listConnections())).toBe(neighborConnections);
    expect(store.getContent('A3-002')?.contentStatus).toBe('DRAFT');
    expect(store.getContent('A2-008')).toBeUndefined();
  });

  it('PUBLIC_DEMO/SANDBOX не создаёт live instance и не исполняет переход', async () => {
    const store = createSeededStore();
    store.upsertTrack({
      ...store.getTrack('A3-002')!,
      accessTier: 'PUBLIC_DEMO',
      executionMode: 'SANDBOX',
    });
    store.upsertContent({
      id: newId('cv'),
      trackId: 'A3-002',
      contentVersion: 'demo',
      contentStatus: 'PUBLISHED',
      contentFormat: 'json',
      privateContentRef: 'server/demo/a3-002',
      checksum: 'demo',
      accessTier: 'PUBLIC_DEMO',
      executionMode: 'SANDBOX',
      productPolicy: { policy: 'FREE_CONTENT' },
      createdAt: '2026-08-31T00:00:00Z',
      publishedAt: '2026-08-31T00:00:00Z',
      body: { example: 'anonymized-demo', secret: 'NOT_LIVE' },
    });
    const demo = decideContentAccess({
      track: store.getTrack('A3-002')!,
      content: store.getContent('A3-002', 'demo')!,
      access: ANON_ACCESS,
      flags: DEFAULT_ARCHITECTURE_FLAGS,
    });
    expect(demo).toEqual({ allowed: true, kind: 'DEMO' });
    const live = decideInstanceCreation({
      track: store.getTrack('A3-002')!,
      content: store.getContent('A3-002', 'demo')!,
      access: identityFromVerifiedSession({ userId: 'u1', verified: true, role: 'FULL' }),
    });
    expect(live.allowed).toBe(false);
    if (!live.allowed) expect(live.lockReason).toBe('SANDBOX_NO_LIVE_INSTANCE');
    expect(() =>
      createTrackInstance(store, {
        userId: 'u1',
        trackId: 'A3-002',
        access: identityFromVerifiedSession({ userId: 'u1', verified: true, role: 'FULL' }),
      }),
    ).toThrow(RuntimeRejectedError);

    const httpDemo = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/A3-002/content'), {
      store,
      env: { NODE_ENV: 'test' },
    });
    expect(httpDemo.status).toBe(200);
    const demoBody = await httpDemo.json();
    expect(demoBody.sandbox).toBe(true);
    expect(demoBody.liveInstance).toBe(false);
    expect(demoBody.body.example).toBe('anonymized-demo');

    const start = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/track-instances', {
        method: 'POST',
        headers: { ...sessionHeader({ userId: 'u1', role: 'FULL', verified: true }), 'content-type': 'application/json' },
        body: JSON.stringify({ trackId: 'A3-002' }),
      }),
      { store, env: { NODE_ENV: 'test' } },
    );
    expect(start.status).toBe(403);
    expect((await start.json()).lockReason).toBe('SANDBOX_NO_LIVE_INSTANCE');
    expect(store.listInstances('u1')).toHaveLength(0);
  });

  it('оплата не открывает DRAFT/REVIEW/READY; paid content без entitlement закрыт', () => {
    const store = createSeededStore();
    const entitled = identityFromVerifiedSession({
      userId: 'user-1',
      verified: true,
      role: 'FULL',
      entitlements: [{ productCode: 'TEST', status: 'active', startsAt: '2026-01-01T00:00:00Z', endsAt: null, grantsAll: true }],
    });
    for (const status of ['DRAFT', 'REVIEW', 'READY'] as const) {
      store.upsertContent({
        id: newId('cv'),
        trackId: 'A3-002',
        contentVersion: status,
        contentStatus: status,
        contentFormat: 'json',
        privateContentRef: 'server-only',
        checksum: 'x',
        accessTier: 'PAID',
        executionMode: 'LIVE',
        productPolicy: { policy: 'ENTITLED' },
        createdAt: '2026-08-31T00:00:00Z',
        publishedAt: null,
        body: { secret: 'UNPUBLISHED' },
      });
      const decision = decideContentAccess({
        track: store.getTrack('A3-002')!,
        content: store.getContent('A3-002', status)!,
        access: entitled,
        flags: {
          ...DEFAULT_ARCHITECTURE_FLAGS,
          PAID_TRACK_NAVIGATION_ENABLED: true,
          REGISTERED_BETA_ACCESS_ENABLED: false,
        },
      });
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.lockReason).toBe('CONTENT_UNAVAILABLE');
    }
  });

  it('production без production repository fail closed, не падает в memory', async () => {
    expect(isProductionRepositoryConfigured({ NODE_ENV: 'production' })).toBe(false);
    expect(isProductionRepositoryConfigured({ NODE_ENV: 'production', MLMA_ARCHITECTURE_STORE: 'memory', DATABASE_URL: 'postgres://x' })).toBe(
      false,
    );
    expect(() => getArchitectureStore({ NODE_ENV: 'production' })).toThrow(ProductionRepositoryNotConfiguredError);
    const res = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/A2-008/meta'), {
      env: { NODE_ENV: 'production' },
    });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('STORAGE_UNCONFIGURED');

    const client = new FakePostgresClient();
    const pg = new PostgresArchitectureStore(client);
    const memory = createSeededStore();
    pg.replaceAll(memory.snapshot());
    expect(pg.listTracks()).toHaveLength(112);
    expect(pg.listConnections()).toHaveLength(253);
    expect(pg.listRules()).toHaveLength(58);
    expect(pg.listEntitlements('nobody')).toEqual([]);
    expect(client.statements.some((row) => row.sql.includes('track_connections'))).toBe(true);
  });

  it('A6-017 остаётся в registry как DATA_BLOCKED и не исполняется', () => {
    const store = createSeededStore();
    const track = store.getTrack('A6-017');
    expect(track).toBeDefined();
    expect(track?.entityType).toBe('ALIAS');
    expect(track?.canonicalId).toBe('A6-017');
    expect(track?.dataQuality).toBe('DATA_BLOCKED');
    const resolved = resolveTrackId('A6-017', (id) => store.getTrack(id));
    expect(resolved.error).toBe('CANONICAL_MISSING');
    expect(resolved.canonicalId).toBeNull();
    const decision = decideRoute(store, ctx({ fromId: 'A6-017', outcomeCode: 'DONE', facts: {}, mode: 'pilot' }));
    expect(decision.reasonCode).toBe('NO_SUCH_TRACK');
    expect(decision.lockReason).toBe('DATA_BLOCKED');
    expect(checkTrack(store, 'A6-017').ok).toBe(false);
  });

  it('importArchitectureSource понимает v3 graph', () => {
    const store = new MemoryArchitectureStore();
    const result = importArchitectureSource(store, graphSource(), { dryRun: false });
    expect(result.ok).toBe(true);
    expect(result.counts?.effectiveTrackConnections).toBe(253);
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
