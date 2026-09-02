import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { createSeededStore } from '@/track-architecture/seed';
import { decideRoute } from '@/track-architecture/route-engine';
import { DEFAULT_ARCHITECTURE_FLAGS } from '@/track-architecture/flags';
import { identityFromRegisteredSession } from '@/track-architecture/identity';
import { importTrackPackage } from '@/track-architecture/importer';
import { parseTrackPackage } from '@/track-architecture/package';
import { handleArchitectureRequest } from '@/track-architecture/http';
import { submitSystemActionOutcome } from '@/track-architecture/runtime';
import { newId } from '@/track-architecture/store';
import { validateA3008RecorderRequest } from '@/track-architecture/tracks/a3-008';
import type { ArchitectureFlags, RouteContext } from '@/track-architecture/types';

const ROOT = process.cwd();
const PKG = path.join(ROOT, 'packages/a3-008/package.json');
const CONTENT = path.join(ROOT, 'server/system-actions/a3-008/0.1.0/content.json');
const UI = path.join(ROOT, 'server/system-actions/a3-008/0.1.0/ui-definition.json');
const SNAPSHOT = path.join(ROOT, 'packages/a3-008/graph/a3-008-connection-index-v3.json');
const FIXTURES = path.join(ROOT, 'packages/a3-008/tests/route-fixtures.json');
const PRODUCTS = path.join(ROOT, 'tilda/src/data/products.catalog.json');

const BETA: ArchitectureFlags = {
  ...DEFAULT_ARCHITECTURE_FLAGS,
  REGISTERED_BETA_ACCESS_ENABLED: true,
  PAYMENTS_ENABLED: false,
  PAID_TRACK_NAVIGATION_ENABLED: false,
};

function loadReadyPackage() {
  const json = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  const body = {
    ...JSON.parse(fs.readFileSync(CONTENT, 'utf8')),
    uiDefinition: JSON.parse(fs.readFileSync(UI, 'utf8')),
  };
  return { json, body, source: { filename: 'package.json', text: JSON.stringify(json), json, contentBody: body } };
}

function loadA3002() {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/a3-002/package.json'), 'utf8'));
  const body = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/content/tracks/a3-002/0.1.0/content.json'), 'utf8'));
  return { json, body, source: { filename: 'package.json', text: JSON.stringify(json), json, contentBody: body } };
}

function sessionHeader(value: unknown) {
  return { 'x-mlma-test-session': JSON.stringify(value) };
}

function ctx808(outcomeCode: string, outcome: string, extra: Record<string, unknown> = {}): RouteContext {
  return {
    fromId: 'A3-008',
    outcomeCode,
    facts: { 'contact.outcome': outcome, ...extra },
    userAccess: identityFromRegisteredSession({ userId: 'ma:1' }),
    now: '2026-09-02T00:00:00Z',
    mode: 'beta',
    flags: BETA,
  };
}

describe('A3-008 ready package install', () => {
  it('schema validation проходит, content остаётся REVIEW/system-ui', () => {
    const { json, body } = loadReadyPackage();
    const parsed = parseTrackPackage(json);
    expect(parsed.ok).toBe(true);
    expect(json.track.entityType).toBe('SYSTEM_ACTION');
    expect(json.content.format).toBe('system-ui');
    expect(json.content.status).toBe('REVIEW');
    expect(body.format).toBe('system-ui');
  });

  it('connectionIndex A3-008 совпадает со снимком v3', () => {
    const store = createSeededStore();
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    const live = store.getConnectionIndex('A3-008');
    expect(live?.incomingEffectiveConnections).toHaveLength(snap.expectedCounts.incomingEffectiveConnections);
    expect(live?.outgoingEffectiveConnections).toHaveLength(snap.expectedCounts.outgoingEffectiveConnections);
    expect(live?.outgoingRouteRuleIds).toEqual(snap.connectionIndex.outgoingRouteRuleIds);
  });

  it('product code MLMA_FULL не найден в каталоге и не подменяется', () => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS, 'utf8'));
    const codes = (products.products || []).map((row: { product_code: string }) => row.product_code);
    expect(codes).not.toContain('MLMA_FULL');
    expect(loadReadyPackage().json.access.productCodes).toEqual(['MLMA_FULL']);
  });

  it('dry-run и apply не переписывают track_connections', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadA3002().source, { dryRun: false });
    const connections = JSON.stringify(store.listConnections());
    const ruleCount = store.listRules().length;
    const dry = importTrackPackage(store, loadReadyPackage().source, { dryRun: true });
    expect(dry.ok).toBe(true);
    const apply = importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    expect(apply.ok).toBe(true);
    expect(JSON.stringify(store.listConnections())).toBe(connections);
    expect(store.getContent('A3-008')?.contentStatus).toBe('REVIEW');
    expect(store.listRules().length).toBe(ruleCount);
  });
});

describe('A3-008 route fixtures', () => {
  const fixtures = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));

  it('валидирует 12 route fixtures', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    for (const row of fixtures.cases) {
      const body = { ...fixtures.base, ...row.patch };
      const validated = validateA3008RecorderRequest(body as Record<string, unknown>);
      if (row.valid) {
        expect(validated.ok, row.id).toBe(true);
        if (!validated.ok) continue;
        if (row.expectedRuleId) {
          const routed = decideRoute(
            store,
            ctx808(validated.outcomeCode, String((row.patch as { contact?: { outcome?: string } }).contact?.outcome || '')),
          );
          expect(routed.matchedRuleId, row.id).toBe(row.expectedRuleId);
          expect(routed.destinationType, row.id).toBe(row.expectedDestinationType);
          if (row.expectedDestinationId) expect(routed.destinationId, row.id).toBe(row.expectedDestinationId);
        }
      } else {
        expect(validated.ok, row.id).toBe(false);
      }
    }
  });

  it('шесть исходов beta RouteDecision', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const cases = [
      ['RESULT_MEETING', 'MEETING_CONFIRMED', 'RR2-026', 'A3-010'],
      ['RESULT_LATER', 'LATER', 'RR2-027', 'A5-010'],
      ['RESULT_REFUSAL', 'REFUSAL', 'RR2-028', 'A5-014'],
      ['RESULT_NO_REPLY', 'NO_REPLY', 'RR2-029', null],
      ['RESULT_REFERRAL', 'REFERRAL_WITH_PERMISSION', 'RR2-030', 'A3-003'],
      ['RESULT_DONE', 'NO_NEXT_ACTION', 'RR2-031', null],
    ] as const;
    for (const [code, outcome, ruleId, dest] of cases) {
      const routed = decideRoute(store, ctx808(code, outcome));
      expect(routed.matchedRuleId).toBe(ruleId);
      if (dest) expect(routed.destinationId).toBe(dest);
      if (ruleId === 'RR2-029') expect(routed.destinationType).toBe('WAIT_UNTIL');
      if (ruleId === 'RR2-031') expect(routed.destinationType).toBe('DONE');
      expect(routed.destinationUrl).toBeNull();
    }
  });
});

describe('A3-008 beta chain A3-002 → A3-008', () => {
  it('MESSAGE_SENT открывает SYSTEM_ACTION; форма даёт продолжение', async () => {
    const store = createSeededStore();
    importTrackPackage(store, loadA3002().source, { dryRun: false });
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const access = identityFromRegisteredSession({ userId: 'ma:1' });
    const instance = {
      instanceId: newId('ti'),
      userId: 'ma:1',
      trackId: 'A3-002',
      contentVersion: '0.1.0',
      instanceStatus: 'active' as const,
      parentRouteId: null,
      startedAt: '2026-09-02T00:00:00Z',
      completedAt: null,
      waitUntil: null,
    };
    store.upsertInstance(instance);
    const sent = await handleArchitectureRequest(
      new Request(`https://mlma.test/api/v1/track-instances/${instance.instanceId}/outcomes`, {
        method: 'POST',
        headers: { ...sessionHeader({ userId: 'ma:1', registered: true }), 'content-type': 'application/json' },
        body: JSON.stringify({
          clientEventId: 'ce-sent-1',
          outcomeCode: 'MESSAGE_SENT',
          facts: { 'message.status': 'SENT' },
        }),
      }),
      { store, env: { NODE_ENV: 'test' }, flags: BETA },
    );
    expect(sent.status).toBe(200);
    const sentBody = await sent.json();
    expect(sentBody.decision.destinationType).toBe('SYSTEM_ACTION');
    expect(sentBody.decision.destinationId).toBe('A3-008');
    expect(sentBody.decision.next.status).toBe('system_action');
    const updated = store.getInstance(instance.instanceId);
    expect(updated?.pendingSystemActionId).toBe('A3-008');

    const refusal = submitSystemActionOutcome(store, {
      userId: 'ma:1',
      sourceInstanceId: instance.instanceId,
      body: {
        systemActionId: 'A3-008',
        actionVersion: '0.1.0',
        sourceTrackId: 'A3-002',
        sourceInstanceId: instance.instanceId,
        sourceOutcomeCode: 'MESSAGE_SENT',
        contactCardRef: 'contact-ref-opaque-0001',
        contact: { outcome: 'REFUSAL' },
        occurredAt: '2026-09-02T12:00:00Z',
        idempotencyKey: 'idem-a3-008-test-refusal',
      },
      access,
      flags: BETA,
      mode: 'beta',
    });
    expect(refusal.decision.matchedRuleId).toBe('RR2-028');
    expect(refusal.decision.destinationId).toBe('A5-014');
    expect(refusal.decision.preparingDestination).toBe(true);
    expect(refusal.decision.destinationUrl).toBeNull();
  });

  it('guest не получает system action content', async () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const res = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/system-actions/A3-008/content'), {
      store,
      env: { NODE_ENV: 'test' },
      flags: BETA,
    });
    expect(res.status).toBe(401);
  });
});
