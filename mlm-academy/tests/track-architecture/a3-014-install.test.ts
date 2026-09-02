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
import { assertNoContactPii } from '@/track-architecture/privacy';
import {
  buildA3014ServerFacts,
  demoSandboxIsolatedA3014,
  validateA3014ActionReady,
} from '@/track-architecture/tracks/a3-014';
import type { ArchitectureFlags, RouteContext } from '@/track-architecture/types';

const ROOT = process.cwd();
const PKG = path.join(ROOT, 'packages/a3-014/package.json');
const CONTENT = path.join(ROOT, 'server/content/tracks/a3-014/0.1.0/content.json');
const SNAPSHOT = path.join(ROOT, 'packages/a3-014/graph/a3-014-connection-index-v3.json');
const FIXTURES = path.join(ROOT, 'packages/a3-014/tests/route-fixtures.json');
const DEMO = path.join(ROOT, 'server/content/tracks/a3-014/demo/demo-sandbox.json');
const GRAPH = path.join(ROOT, 'spec/track-architecture/full-graph-112-v3.json');
const PRODUCTS = path.join(ROOT, 'tilda/src/data/products.catalog.json');

const BETA: ArchitectureFlags = {
  ...DEFAULT_ARCHITECTURE_FLAGS,
  REGISTERED_BETA_ACCESS_ENABLED: true,
  PAYMENTS_ENABLED: false,
  PAID_TRACK_NAVIGATION_ENABLED: false,
};

function loadReadyPackage() {
  const json = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  const body = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  return { json, body, source: { filename: 'package.json', text: JSON.stringify(json), json, contentBody: body } };
}

function loadA3002() {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/a3-002/package.json'), 'utf8'));
  const body = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/content/tracks/a3-002/0.1.0/content.json'), 'utf8'));
  return { json, body, source: { filename: 'package.json', text: JSON.stringify(json), json, contentBody: body } };
}

function loadA3008() {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/a3-008/package.json'), 'utf8'));
  const body = {
    ...JSON.parse(fs.readFileSync(path.join(ROOT, 'server/system-actions/a3-008/0.1.0/content.json'), 'utf8')),
    uiDefinition: JSON.parse(fs.readFileSync(path.join(ROOT, 'server/system-actions/a3-008/0.1.0/ui-definition.json'), 'utf8')),
  };
  return { json, body, source: { filename: 'package.json', text: JSON.stringify(json), json, contentBody: body } };
}

function loadA3016() {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/a3-016/package.json'), 'utf8'));
  const body = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/content/tracks/a3-016/0.1.0/content.json'), 'utf8'));
  return { json, body, source: { filename: 'package.json', text: JSON.stringify(json), json, contentBody: body } };
}

function ctx014(outcomeCode: string, facts: Record<string, unknown>): RouteContext {
  return {
    fromId: 'A3-014',
    outcomeCode,
    facts,
    userAccess: identityFromRegisteredSession({ userId: 'ma:1' }),
    now: '2026-09-02T00:00:00Z',
    mode: 'beta',
    flags: BETA,
  };
}

function sessionHeader(value: unknown) {
  return { 'x-mlma-test-session': JSON.stringify(value) };
}

describe('A3-014 ready package install', () => {
  it('schema validation проходит, entityType REMEDIATION', () => {
    const { json, body } = loadReadyPackage();
    const parsed = parseTrackPackage(json);
    expect(parsed.ok).toBe(true);
    expect(json.track.entityType).toBe('REMEDIATION');
    expect(json.content.status).toBe('REVIEW');
    expect(body.contentStatus).toBe('REVIEW');
  });

  it('connectionIndex A3-014 совпадает со снимком v3 (0/1 in, 2/2 out)', () => {
    const store = createSeededStore();
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    const live = store.getConnectionIndex('A3-014');
    expect(live?.incomingEffectiveConnections).toHaveLength(snap.expectedCounts.incomingEffectiveConnections);
    expect(live?.outgoingEffectiveConnections).toHaveLength(snap.expectedCounts.outgoingEffectiveConnections);
    expect(live?.incomingRouteRuleIds).toEqual(snap.connectionIndex.incomingRouteRuleIds);
    expect(live?.outgoingRouteRuleIds).toEqual(snap.connectionIndex.outgoingRouteRuleIds);
  });

  it('dry-run и apply не переписывают track_connections и full graph', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadA3002().source, { dryRun: false });
    importTrackPackage(store, loadA3008().source, { dryRun: false });
    importTrackPackage(store, loadA3016().source, { dryRun: false });
    const connections = JSON.stringify(store.listConnections());
    const rulesBefore = store.listRules().map((r) => r.ruleId).sort();
    const graphBefore = fs.readFileSync(GRAPH, 'utf8');
    const apply = importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    expect(apply.ok).toBe(true);
    expect(JSON.stringify(store.listConnections())).toBe(connections);
    expect(fs.readFileSync(GRAPH, 'utf8')).toBe(graphBefore);
    const rulesAfter = store.listRules().map((r) => r.ruleId).sort();
    expect(rulesAfter.length).toBe(rulesBefore.length + 5);
    expect(rulesAfter).toContain('RR3-A3-014-RETURN');
    expect(rulesBefore).toContain('RR2-016');
    expect(rulesBefore).toContain('RR2-014');
    expect(rulesBefore).toContain('RR2-015');
    expect(rulesBefore).toContain('RR3-A3-016-STOP');
  });

  it('product code MLMA_FULL не подменяется', () => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS, 'utf8'));
    const codes = (products.products || []).map((row: { product_code: string }) => row.product_code);
    expect(codes).not.toContain('MLMA_FULL');
  });
});

describe('A3-014 route fixtures', () => {
  const fixtures = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));

  it('14 route fixtures', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    importTrackPackage(store, loadA3002().source, { dryRun: false });
    for (const row of fixtures.cases) {
      const fromId = row.fromId;
      const outcomeCode = row.outcomeCode;
      const facts = row.facts || {};
      const routed = decideRoute(
        store,
        {
          fromId,
          outcomeCode,
          facts,
          userAccess: identityFromRegisteredSession({ userId: 'ma:1' }),
          now: '2026-09-02T00:00:00Z',
          mode: 'beta',
          flags: BETA,
        },
      );
      if (row.expected.decision === 'NO_MATCHING_RULE') {
        expect(routed.reasonCode, row.id).toBe('NO_MATCHING_RULE');
        continue;
      }
      if (row.expected.ruleId) expect(routed.matchedRuleId, row.id).toBe(row.expected.ruleId);
      if (row.expected.destinationId !== undefined) expect(routed.destinationId, row.id).toBe(row.expected.destinationId);
      if (row.expected.destinationType) expect(routed.destinationType, row.id).toBe(row.expected.destinationType);
    }
  });

  it('пять исходов: RETURN_TO_ROUTE, A3-013, A6-020, WAIT_UNTIL, EXPERT', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });

    const ready = decideRoute(
      store,
      ctx014(
        'ACTION_READY',
        buildA3014ServerFacts({
          outcomeCode: 'ACTION_READY',
          targetActionCode: 'WRITE_MESSAGE',
          fearEventCode: 'REFUSAL',
          evidenceCode: 'ONE_CASE_ONLY',
          supportCode: 'OPENING_LINE',
          microStepCode: 'SAY_ALOUD',
        }),
      ),
    );
    expect(ready.matchedRuleId).toBe('RR3-A3-014-RETURN');
    expect(ready.destinationType).toBe('RETURN_TO_ROUTE');

    const meeting = decideRoute(
      store,
      ctx014(
        'SUPPORT_REQUIRED',
        buildA3014ServerFacts({ outcomeCode: 'SUPPORT_REQUIRED', nextNeedCode: 'MEETING_MAP' }),
      ),
    );
    expect(meeting.matchedRuleId).toBe('RR3-A3-014-MEETING-MAP');
    expect(meeting.destinationId).toBe('A3-013');
    expect(meeting.preparingDestination).toBe(true);

    const fear = decideRoute(
      store,
      ctx014(
        'SUPPORT_REQUIRED',
        buildA3014ServerFacts({ outcomeCode: 'SUPPORT_REQUIRED', nextNeedCode: 'SPECIFIC_FEAR' }),
      ),
    );
    expect(fear.matchedRuleId).toBe('RR3-A3-014-SPECIFIC-FEAR');
    expect(fear.destinationId).toBe('A6-020');

    const wait = decideRoute(
      store,
      ctx014(
        'WAIT_FOR_RESOURCE',
        buildA3014ServerFacts({ outcomeCode: 'WAIT_FOR_RESOURCE', reviewTriggerCode: 'AGREED_DATE', dueCode: 'DATE_SET' }),
      ),
    );
    expect(wait.matchedRuleId).toBe('RR3-A3-014-WAIT');
    expect(wait.destinationType).toBe('WAIT_UNTIL');

    const expert = decideRoute(
      store,
      ctx014('OUT_OF_SCOPE_SUPPORT', buildA3014ServerFacts({ outcomeCode: 'OUT_OF_SCOPE_SUPPORT' })),
    );
    expect(expert.matchedRuleId).toBe('RR3-A3-014-OUT-OF-SCOPE');
    expect(expert.destinationType).toBe('EXPERT');
  });

  it('sandbox demo изолирован', () => {
    expect(demoSandboxIsolatedA3014(JSON.parse(fs.readFileSync(DEMO, 'utf8')))).toBe(true);
  });
});

describe('A3-014 chain preservation', () => {
  it('A3-002 MESSAGE_NOT_SENT_ANXIETY → A3-014; A3-002→A3-008 и A3-002→A3-016 сохранены', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadA3002().source, { dryRun: false });
    importTrackPackage(store, loadA3008().source, { dryRun: false });
    importTrackPackage(store, loadA3016().source, { dryRun: false });
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });

    const anxiety = decideRoute(store, {
      fromId: 'A3-002',
      outcomeCode: 'MESSAGE_NOT_SENT_ANXIETY',
      facts: { 'message.status': 'BLOCKED_ANXIETY' },
      userAccess: identityFromRegisteredSession({ userId: 'ma:1' }),
      now: '2026-09-02T00:00:00Z',
      mode: 'beta',
      flags: BETA,
    });
    expect(anxiety.matchedRuleId).toBe('RR2-016');
    expect(anxiety.destinationId).toBe('A3-014');
    expect(anxiety.preparingDestination).toBe(false);

    const sent = decideRoute(store, {
      fromId: 'A3-002',
      outcomeCode: 'MESSAGE_SENT',
      facts: { 'message.status': 'SENT' },
      userAccess: identityFromRegisteredSession({ userId: 'ma:1' }),
      now: '2026-09-02T00:00:00Z',
      mode: 'beta',
      flags: BETA,
    });
    expect(sent.matchedRuleId).toBe('RR2-014');
    expect(sent.destinationId).toBe('A3-008');

    const noReason = decideRoute(store, {
      fromId: 'A3-002',
      outcomeCode: 'MESSAGE_NOT_SENT_NO_REASON',
      facts: { 'message.status': 'BLOCKED_REASON' },
      userAccess: identityFromRegisteredSession({ userId: 'ma:1' }),
      now: '2026-09-02T00:00:00Z',
      mode: 'beta',
      flags: BETA,
    });
    expect(noReason.matchedRuleId).toBe('RR2-015');
    expect(noReason.destinationId).toBe('A3-016');
  });

  it('TR-095/TR-096 не исполняются без RouteRule', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const unknown = decideRoute(store, ctx014('UNKNOWN', {}));
    expect(unknown.reasonCode).toBe('NO_MATCHING_RULE');
    expect(unknown.destinationId).not.toBe('A3-013');
    expect(unknown.destinationId).not.toBe('A6-020');
  });

  it('свободный текст не утекает в server payload', () => {
    const facts = buildA3014ServerFacts({
      outcomeCode: 'ACTION_READY',
      targetActionCode: 'WRITE_MESSAGE',
      fearEventCode: 'REFUSAL',
      evidenceCode: 'ONE_CASE_ONLY',
      supportCode: 'OPENING_LINE',
      microStepCode: 'SAY_ALOUD',
    });
    const payload = { ...facts, fear_text: 'страшно', support_note: 'заметка', phone: '+7999' };
    expect(assertNoContactPii(payload).length).toBeGreaterThan(0);
    expect(validateA3014ActionReady(facts)).toBe(true);
    expect(JSON.stringify(facts)).not.toMatch(/страшно|заметка|\+7999/);
  });

  it('registered beta получает content A3-014; guest — нет', async () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const guest = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/A3-014/content'), {
      store,
      env: { NODE_ENV: 'test' },
      flags: BETA,
    });
    expect(guest.status).toBe(403);
    const reg = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/tracks/A3-014/content', {
        headers: sessionHeader({ userId: 'ma:1', registered: true }),
      }),
      { store, env: { NODE_ENV: 'test' }, flags: BETA },
    );
    expect(reg.status).toBe(200);
    const body = await reg.json();
    expect(body.body.title).toMatch(/тревогу/);
    expect(body.body.steps[0].id).toBe('readiness_gate');
  });
});
