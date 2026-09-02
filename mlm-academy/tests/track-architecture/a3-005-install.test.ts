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
  buildA3005ServerFacts,
  canSubmitA3005Outcome,
  demoSandboxIsolatedA3005,
  validateA3005Later,
  validateA3005MeetingScheduled,
} from '@/track-architecture/tracks/a3-005';
import type { ArchitectureFlags, RouteContext } from '@/track-architecture/types';

const ROOT = process.cwd();
const PKG = path.join(ROOT, 'packages/a3-005/package.json');
const CONTENT = path.join(ROOT, 'server/content/tracks/a3-005/0.1.0/content.json');
const SNAPSHOT = path.join(ROOT, 'packages/a3-005/graph/a3-005-connection-index-v3.json');
const FIXTURES = path.join(ROOT, 'packages/a3-005/tests/route-fixtures.json');
const DEMO = path.join(ROOT, 'server/content/tracks/a3-005/demo/demo-sandbox.json');
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

function loadA3014() {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/a3-014/package.json'), 'utf8'));
  const body = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/content/tracks/a3-014/0.1.0/content.json'), 'utf8'));
  return { json, body, source: { filename: 'package.json', text: JSON.stringify(json), json, contentBody: body } };
}

function ctx005(outcomeCode: string, facts: Record<string, unknown>, fromId = 'A3-005'): RouteContext {
  return {
    fromId,
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

describe('A3-005 ready package install', () => {
  it('schema validation проходит, entityType TRACK', () => {
    const { json, body } = loadReadyPackage();
    const parsed = parseTrackPackage(json);
    expect(parsed.ok).toBe(true);
    expect(json.track.entityType).toBe('TRACK');
    expect(json.content.status).toBe('REVIEW');
    expect(body.contentStatus).toBe('REVIEW');
    expect(body.aiSchedulingEditorEnabled).toBe(false);
  });

  it('connectionIndex A3-005 совпадает со снимком v3 (2/3 in, 2/4 out)', () => {
    const store = createSeededStore();
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    const live = store.getConnectionIndex('A3-005');
    expect(live?.incomingDesignConnections).toHaveLength(snap.expectedCounts.incomingDesignConnections);
    expect(live?.incomingEffectiveConnections).toHaveLength(snap.expectedCounts.incomingEffectiveConnections);
    expect(live?.outgoingDesignConnections).toHaveLength(snap.expectedCounts.outgoingDesignConnections);
    expect(live?.outgoingEffectiveConnections).toHaveLength(snap.expectedCounts.outgoingEffectiveConnections);
    expect(live?.incomingRouteRuleIds).toEqual(snap.connectionIndex.incomingRouteRuleIds);
    expect(live?.outgoingRouteRuleIds).toEqual(snap.connectionIndex.outgoingRouteRuleIds);
  });

  it('dry-run и apply не переписывают track_connections и full graph', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadA3002().source, { dryRun: false });
    importTrackPackage(store, loadA3008().source, { dryRun: false });
    importTrackPackage(store, loadA3016().source, { dryRun: false });
    importTrackPackage(store, loadA3014().source, { dryRun: false });
    const connections = JSON.stringify(store.listConnections());
    const rulesBefore = store.listRules().map((r) => r.ruleId).sort();
    const graphBefore = fs.readFileSync(GRAPH, 'utf8');
    const apply = importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    expect(apply.ok).toBe(true);
    expect(JSON.stringify(store.listConnections())).toBe(connections);
    expect(fs.readFileSync(GRAPH, 'utf8')).toBe(graphBefore);
    const rulesAfter = store.listRules().map((r) => r.ruleId).sort();
    expect(rulesAfter.length).toBe(rulesBefore.length + 1);
    expect(rulesAfter).toContain('RR2-023');
    expect(rulesAfter).toContain('RR2-024');
    expect(rulesAfter).toContain('RR2-025');
    expect(rulesAfter).toContain('RR3-A3-005-NO-FOLLOW-UP');
    expect(rulesBefore).toContain('RR2-008');
  });

  it('product code MLMA_FULL не подменяется', () => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS, 'utf8'));
    const codes = (products.products || []).map((row: { product_code: string }) => row.product_code);
    expect(codes).not.toContain('MLMA_FULL');
  });

  it('consent gate — первый шаг до слотов', () => {
    const body = loadReadyPackage().body;
    expect(body.steps[0].id).toBe('permission_gate');
    expect(body.steps[0].kind).toBe('scheduling_consent_gate');
    const slotIdx = body.steps.findIndex((step: { id: string }) => step.id === 'offer_real_slots');
    expect(slotIdx).toBeGreaterThan(0);
  });
});

describe('A3-005 route fixtures', () => {
  const fixtures = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));

  it('14 route fixtures', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
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
          mode: fromId === 'A2-008' ? 'pilot' : 'beta',
          flags: BETA,
        },
      );
      if (row.expected.decision === 'NO_MATCHING_RULE') {
        expect(routed.reasonCode, row.id).toBe('NO_MATCHING_RULE');
        continue;
      }
      if (row.expected.ruleId) expect(routed.matchedRuleId, row.id).toBe(row.expected.ruleId);
      if (row.expected.destinationId !== undefined) {
        const expectedDest = row.expected.destinationId === '' ? null : row.expected.destinationId;
        expect(routed.destinationId, row.id).toBe(expectedDest);
      }
      if (row.expected.destinationType) expect(routed.destinationType, row.id).toBe(row.expected.destinationType);
    }
  });

  it('четыре исхода: A3-010, WAIT_UNTIL, A5-014, DONE', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });

    const confirmed = decideRoute(
      store,
      ctx005(
        'MEETING_SCHEDULED',
        buildA3005ServerFacts({
          outcomeCode: 'MEETING_SCHEDULED',
          explicitConfirmation: true,
          startsAt: '2026-09-10T18:00:00+07:00',
          timezone: 'Asia/Novosibirsk',
          durationMinutes: 30,
          formatCode: 'VIDEO_CALL',
          topicCode: 'PRODUCT_QUESTION',
          calendarActionCode: 'DOWNLOAD_ICS',
        }),
      ),
    );
    expect(confirmed.matchedRuleId).toBe('RR2-023');
    expect(confirmed.destinationId).toBe('A3-010');
    expect(confirmed.preparingDestination).toBe(true);

    const later = decideRoute(
      store,
      ctx005(
        'LATER',
        buildA3005ServerFacts({
          outcomeCode: 'LATER',
          followupAllowed: true,
          reviewAnchorCode: 'NAMED_DATE',
          reviewAt: '2026-09-15',
        }),
      ),
    );
    expect(later.matchedRuleId).toBe('RR2-024');
    expect(later.destinationType).toBe('WAIT_UNTIL');

    const declined = decideRoute(
      store,
      ctx005('DECLINED', buildA3005ServerFacts({ outcomeCode: 'DECLINED' })),
    );
    expect(declined.matchedRuleId).toBe('RR2-025');
    expect(declined.destinationId).toBe('A5-014');
    expect(declined.preparingDestination).toBe(true);

    const closed = decideRoute(
      store,
      ctx005('NO_FOLLOW_UP', buildA3005ServerFacts({ outcomeCode: 'NO_FOLLOW_UP' })),
    );
    expect(closed.matchedRuleId).toBe('RR3-A3-005-NO-FOLLOW-UP');
    expect(closed.destinationType).toBe('DONE');
  });

  it('A2-008 NEXT_SCHEDULE → A3-005 через RR2-008', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const entry = decideRoute(
      store,
      {
        fromId: 'A2-008',
        outcomeCode: 'NEXT_SCHEDULE',
        facts: { 'contact.next_action': 'SCHEDULE_TALK' },
        userAccess: identityFromRegisteredSession({ userId: 'ma:1' }),
        now: '2026-09-02T00:00:00Z',
        mode: 'pilot',
        flags: BETA,
      },
    );
    expect(entry.matchedRuleId).toBe('RR2-008');
    expect(entry.destinationId).toBe('A3-005');
    expect(entry.preparingDestination).toBe(false);
  });

  it('TR-077/TR-078 и legacy nextTrackIds не исполняются', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const unknown = decideRoute(store, ctx005('UNKNOWN', { legacyNextIds: 'A3-008,A3-013' }));
    expect(unknown.reasonCode).toBe('NO_MATCHING_RULE');
    expect(unknown.destinationId).not.toBe('A3-008');
    expect(unknown.destinationId).not.toBe('A3-013');
  });

  it('sandbox demo изолирован', () => {
    expect(demoSandboxIsolatedA3005(JSON.parse(fs.readFileSync(DEMO, 'utf8')))).toBe(true);
  });
});

describe('A3-005 chain preservation and privacy', () => {
  it('A3-002→A3-008, A3-002→A3-016, A3-002→A3-014 сохранены после установки A3-005', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadA3002().source, { dryRun: false });
    importTrackPackage(store, loadA3008().source, { dryRun: false });
    importTrackPackage(store, loadA3016().source, { dryRun: false });
    importTrackPackage(store, loadA3014().source, { dryRun: false });
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });

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
  });

  it('MEETING_SCHEDULED недоступен без explicitConfirmation и полного набора', () => {
    const incomplete = buildA3005ServerFacts({
      outcomeCode: 'MEETING_SCHEDULED',
      explicitConfirmation: false,
      startsAt: '2026-09-10T18:00:00+07:00',
      timezone: 'Asia/Novosibirsk',
      durationMinutes: 30,
      formatCode: 'VIDEO_CALL',
      topicCode: 'PRODUCT_QUESTION',
    });
    expect(validateA3005MeetingScheduled(incomplete)).toBe(false);
    expect(
      canSubmitA3005Outcome('MEETING_SCHEDULED', {
        appointmentStatus: 'CONFIRMED',
        explicitConfirmation: false,
        startsAt: '2026-09-10T18:00:00',
        timezone: 'Asia/Novosibirsk',
        durationMinutes: '30',
        formatCode: 'VIDEO_CALL',
        topicCode: 'PRODUCT_QUESTION',
      }),
    ).toBe(false);
  });

  it('LATER требует permission и review anchor', () => {
    const later = buildA3005ServerFacts({
      outcomeCode: 'LATER',
      followupAllowed: true,
      reviewAnchorCode: 'NAMED_DATE',
    });
    expect(validateA3005Later(later)).toBe(true);
    expect(
      canSubmitA3005Outcome('NO_FOLLOW_UP', {
        appointmentStatus: 'LATER',
        followupAllowed: 'false',
      }),
    ).toBe(true);
  });

  it('свободный текст и PII не утекают в server payload', () => {
    const facts = buildA3005ServerFacts({
      outcomeCode: 'MEETING_SCHEDULED',
      explicitConfirmation: true,
      startsAt: '2026-09-10T18:00:00+07:00',
      timezone: 'Asia/Novosibirsk',
      durationMinutes: 30,
      formatCode: 'VIDEO_CALL',
      topicCode: 'PRODUCT_QUESTION',
      calendarActionCode: 'SKIP',
    });
    const payload = {
      ...facts,
      contact_name: 'Анна',
      meeting_link: 'https://zoom.us/j/123',
      topic_text: 'секретная тема',
      phone: '+7999',
    };
    expect(assertNoContactPii(payload).length).toBeGreaterThan(0);
    expect(validateA3005MeetingScheduled(facts)).toBe(true);
    expect(JSON.stringify(facts)).not.toMatch(/Анна|zoom\.us|секретная|\+7999/);
  });

  it('registered beta получает content A3-005; guest — нет', async () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const guest = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/A3-005/content'), {
      store,
      env: { NODE_ENV: 'test' },
      flags: BETA,
    });
    expect(guest.status).toBe(403);
    const reg = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/tracks/A3-005/content', {
        headers: sessionHeader({ userId: 'ma:1', registered: true }),
      }),
      { store, env: { NODE_ENV: 'test' }, flags: BETA },
    );
    expect(reg.status).toBe(200);
    const body = await reg.json();
    expect(body.body.title).toMatch(/Назначить время/);
    expect(body.body.steps[0].id).toBe('permission_gate');
  });
});
