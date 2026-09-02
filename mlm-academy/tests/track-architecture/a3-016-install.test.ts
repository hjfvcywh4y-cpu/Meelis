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
import { buildA3016ServerFacts, demoSandboxIsolatedA3016, validateA3016ReasonFound } from '@/track-architecture/tracks/a3-016';
import type { ArchitectureFlags, RouteContext } from '@/track-architecture/types';

const ROOT = process.cwd();
const PKG = path.join(ROOT, 'packages/a3-016/package.json');
const CONTENT = path.join(ROOT, 'server/content/tracks/a3-016/0.1.0/content.json');
const SNAPSHOT = path.join(ROOT, 'packages/a3-016/graph/a3-016-connection-index-v3.json');
const FIXTURES = path.join(ROOT, 'packages/a3-016/tests/route-fixtures.json');
const DEMO = path.join(ROOT, 'server/content/tracks/a3-016/demo/demo-sandbox.json');
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

function ctx016(outcomeCode: string, facts: Record<string, unknown>): RouteContext {
  return {
    fromId: 'A3-016',
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

describe('A3-016 ready package install', () => {
  it('schema validation проходит, entityType REMEDIATION', () => {
    const { json, body } = loadReadyPackage();
    const parsed = parseTrackPackage(json);
    expect(parsed.ok).toBe(true);
    expect(json.track.entityType).toBe('REMEDIATION');
    expect(json.content.status).toBe('REVIEW');
    expect(body.contentStatus).toBe('REVIEW');
  });

  it('connectionIndex A3-016 совпадает со снимком v3', () => {
    const store = createSeededStore();
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    const live = store.getConnectionIndex('A3-016');
    expect(live?.incomingEffectiveConnections).toHaveLength(snap.expectedCounts.incomingEffectiveConnections);
    expect(live?.outgoingEffectiveConnections).toHaveLength(snap.expectedCounts.outgoingEffectiveConnections);
    expect(live?.incomingRouteRuleIds).toEqual(snap.connectionIndex.incomingRouteRuleIds);
    expect(live?.outgoingRouteRuleIds).toEqual(snap.connectionIndex.outgoingRouteRuleIds);
  });

  it('product code MLMA_FULL не подменяется', () => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS, 'utf8'));
    const codes = (products.products || []).map((row: { product_code: string }) => row.product_code);
    expect(codes).not.toContain('MLMA_FULL');
  });

  it('dry-run и apply не переписывают track_connections', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadA3002().source, { dryRun: false });
    importTrackPackage(store, loadA3008().source, { dryRun: false });
    const connections = JSON.stringify(store.listConnections());
    const rulesBefore = store.listRules().length;
    const apply = importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    expect(apply.ok).toBe(true);
    expect(JSON.stringify(store.listConnections())).toBe(connections);
    expect(store.getContent('A3-016')?.contentStatus).toBe('REVIEW');
    expect(store.listRules().length).toBe(rulesBefore + 1);
    expect(store.listRules().some((rule) => rule.ruleId === 'RR3-A3-016-STOP')).toBe(true);
  });
});

describe('A3-016 route fixtures', () => {
  const fixtures = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));

  it('12 route fixtures', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    for (const row of fixtures.cases) {
      if (row.valid === false) continue;
      if (!row.outcomeCode) continue;
      const facts = buildA3016ServerFacts({
        outcomeCode: row.outcomeCode,
        factSourceCode: row.facts?.fact_source_code as string,
        intentCode: row.facts?.intent_code as string,
        disclosureStatus: row.facts?.disclosure_status as string,
        timingCode: row.facts?.timing_code as string,
        permissionStatus: row.facts?.permission_status as string,
        noReasonCode: row.facts?.no_reason_code as string,
        reviewTriggerCode: row.facts?.review_trigger_code as string,
        stopCode: row.facts?.stop_code as string,
      });
      const routed = decideRoute(store, ctx016(row.outcomeCode, facts));
      if (row.expectedRuleId) expect(routed.matchedRuleId, row.id).toBe(row.expectedRuleId);
      if (row.expectedDestinationId) expect(routed.destinationId, row.id).toBe(row.expectedDestinationId);
      if (row.expectedDestinationType) expect(routed.destinationType, row.id).toBe(row.expectedDestinationType);
    }
  });

  it('три исхода: A3-002, WAIT_UNTIL, DONE', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    importTrackPackage(store, loadA3002().source, { dryRun: false });

    const found = decideRoute(
      store,
      ctx016(
        'REASON_FOUND',
        buildA3016ServerFacts({
          outcomeCode: 'REASON_FOUND',
          factSourceCode: 'PERSON_ASKED',
          intentCode: 'ANSWER_REQUEST',
          disclosureStatus: 'FULLY_NAMED',
          timingCode: 'APPROPRIATE',
          permissionStatus: 'ALLOWED',
        }),
      ),
    );
    expect(found.matchedRuleId).toBe('RR2-012');
    expect(found.destinationId).toBe('A3-002');
    expect(found.preparingDestination).toBe(false);

    const wait = decideRoute(
      store,
      ctx016(
        'NO_REASON',
        buildA3016ServerFacts({
          outcomeCode: 'NO_REASON',
          factSourceCode: 'NONE',
          intentCode: 'HIDDEN_OR_UNCLEAR',
          disclosureStatus: 'HIDDEN',
          timingCode: 'WAIT_BETTER_CONTEXT',
          permissionStatus: 'NEEDS_PERMISSION',
          noReasonCode: 'ONLY_MY_SALES_PLAN',
          reviewTriggerCode: 'NEW_REQUEST_FROM_PERSON',
        }),
      ),
    );
    expect(wait.matchedRuleId).toBe('RR2-013');
    expect(wait.destinationType).toBe('WAIT_UNTIL');

    const stopped = decideRoute(
      store,
      ctx016('CONTACT_STOPPED', buildA3016ServerFacts({ outcomeCode: 'CONTACT_STOPPED', stopCode: 'EXPLICIT_REFUSAL' })),
    );
    expect(stopped.matchedRuleId).toBe('RR3-A3-016-STOP');
    expect(stopped.destinationType).toBe('DONE');
  });

  it('sandbox demo изолирован', () => {
    expect(demoSandboxIsolatedA3016(JSON.parse(fs.readFileSync(DEMO, 'utf8')))).toBe(true);
  });
});

describe('A3-016 chain preservation', () => {
  it('A3-002 MESSAGE_NOT_SENT_NO_REASON → A3-016; A3-002→A3-008 chain сохранена', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadA3002().source, { dryRun: false });
    importTrackPackage(store, loadA3008().source, { dryRun: false });
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });

    const noReason = decideRoute(
      store,
      {
        fromId: 'A3-002',
        outcomeCode: 'MESSAGE_NOT_SENT_NO_REASON',
        facts: { 'message.status': 'BLOCKED_REASON' },
        userAccess: identityFromRegisteredSession({ userId: 'ma:1' }),
        now: '2026-09-02T00:00:00Z',
        mode: 'beta',
        flags: BETA,
      },
    );
    expect(noReason.matchedRuleId).toBe('RR2-015');
    expect(noReason.destinationId).toBe('A3-016');
    expect(noReason.preparingDestination).toBe(false);

    const sent = decideRoute(
      store,
      {
        fromId: 'A3-002',
        outcomeCode: 'MESSAGE_SENT',
        facts: { 'message.status': 'SENT' },
        userAccess: identityFromRegisteredSession({ userId: 'ma:1' }),
        now: '2026-09-02T00:00:00Z',
        mode: 'beta',
        flags: BETA,
      },
    );
    expect(sent.matchedRuleId).toBe('RR2-014');
    expect(sent.destinationId).toBe('A3-008');
    expect(sent.preparingDestination).toBe(false);
  });

  it('registered beta получает content A3-016; guest — нет', async () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const guest = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/A3-016/content'), {
      store,
      env: { NODE_ENV: 'test' },
      flags: BETA,
    });
    expect(guest.status).toBe(403);
    const reg = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/tracks/A3-016/content', {
        headers: sessionHeader({ userId: 'ma:1', registered: true }),
      }),
      { store, env: { NODE_ENV: 'test' }, flags: BETA },
    );
    expect(reg.status).toBe(200);
    const body = await reg.json();
    expect(body.body.title).toMatch(/настоящий повод/);
    expect(validateA3016ReasonFound(buildA3016ServerFacts({
      outcomeCode: 'REASON_FOUND',
      factSourceCode: 'PERSON_ASKED',
      intentCode: 'ANSWER_REQUEST',
      disclosureStatus: 'FULLY_NAMED',
      timingCode: 'APPROPRIATE',
      permissionStatus: 'ALLOWED',
    }))).toBe(true);
  });
});
