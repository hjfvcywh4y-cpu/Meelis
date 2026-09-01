import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { createSeededStore } from '@/track-architecture/seed';
import { decideRoute } from '@/track-architecture/route-engine';
import { DEFAULT_ARCHITECTURE_FLAGS } from '@/track-architecture/flags';
import { ANON_ACCESS, identityFromVerifiedSession } from '@/track-architecture/identity';
import { importTrackPackage } from '@/track-architecture/importer';
import { parseTrackPackage } from '@/track-architecture/package';
import { decideContentAccess, decideInstanceCreation } from '@/track-architecture/access';
import { handleArchitectureRequest } from '@/track-architecture/http';
import { stripUnsafeFacts, assertNoContactPii } from '@/track-architecture/privacy';
import { validateAnalyticsProperties } from '@/track-architecture/events';
import { publicMetaResponse, toPublicTrackMeta } from '@/track-architecture/public-meta';
import { MemoryArchitectureStore, newId } from '@/track-architecture/store';
import {
  decideA3002ReasonGate,
  demoSandboxIsolated,
  evaluateA3002QualityGate,
  fieldActionAvailable,
} from '@/track-architecture/tracks/a3-002';
import type { ArchitectureFlags, RouteContext } from '@/track-architecture/types';

const ROOT = process.cwd();
const PKG = path.join(ROOT, 'packages/a3-002/package.json');
const CONTENT = path.join(ROOT, 'server/content/tracks/a3-002/0.1.0/content.json');
const SNAPSHOT = path.join(ROOT, 'packages/a3-002/graph/a3-002-connection-index-v3.json');
const DEMO = path.join(ROOT, 'server/content/tracks/a3-002/demo/demo-sandbox.json');
const CASES = path.join(ROOT, 'packages/a3-002/tests/acceptance-cases.json');
const PRODUCTS = path.join(ROOT, 'tilda/src/data/products.catalog.json');

const PILOT_FLAGS: ArchitectureFlags = {
  ...DEFAULT_ARCHITECTURE_FLAGS,
  PAID_TRACK_NAVIGATION_ENABLED: false,
};

function ctx(partial: Partial<RouteContext> = {}): RouteContext {
  return {
    fromId: 'A3-002',
    outcomeCode: 'MESSAGE_SENT',
    facts: { 'message.status': 'SENT' },
    userAccess: ANON_ACCESS,
    now: '2026-09-01T00:00:00Z',
    mode: 'pilot',
    flags: PILOT_FLAGS,
    ...partial,
  };
}

function loadReadyPackage() {
  const json = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  const body = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  return { json, body, source: { filename: 'package.json', text: JSON.stringify(json), json, contentBody: body } };
}

function sessionHeader(value: unknown) {
  return { 'x-mlma-test-session': JSON.stringify(value) };
}

describe('A3-002 ready package install', () => {
  it('schema validation проходит, content остаётся REVIEW/server-only', () => {
    const { json, body } = loadReadyPackage();
    const parsed = parseTrackPackage(json);
    expect(parsed.ok).toBe(true);
    expect(json.content.status).toBe('REVIEW');
    expect(json.content.serverOnly).toBe(true);
    expect(json.graphBinding.editNeighborPages).toBe(false);
    expect(body.serverOnly).toBe(true);
    expect(body.contentStatus).toBe('REVIEW');
  });

  it('connectionIndex A3-002 совпадает со снимком v3', () => {
    const store = createSeededStore();
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    const live = store.getConnectionIndex('A3-002');
    expect(live?.incomingEffectiveConnections).toHaveLength(snap.expected.effectiveIncomingCount);
    expect(live?.outgoingEffectiveConnections).toHaveLength(snap.expected.effectiveOutgoingCount);
    expect(live?.outgoingRouteRuleIds).toEqual(snap.connectionIndex.outgoingRouteRuleIds);
    expect(live?.incomingRouteRuleIds).toEqual(snap.connectionIndex.incomingRouteRuleIds);
    expect(live?.externalEntryRuleIds).toEqual(snap.connectionIndex.externalEntryRuleIds);
    expect(JSON.stringify(live?.incomingEffectiveConnections)).toBe(
      JSON.stringify(snap.connectionIndex.incomingEffectiveConnections),
    );
    expect(JSON.stringify(live?.outgoingEffectiveConnections)).toBe(
      JSON.stringify(snap.connectionIndex.outgoingEffectiveConnections),
    );
  });

  it('product code MLMA_FULL не найден в каталоге и не подменяется', () => {
    const products = JSON.parse(fs.readFileSync(PRODUCTS, 'utf8'));
    const codes = (products.products || []).map((row: { product_code: string }) => row.product_code);
    expect(codes).not.toContain('MLMA_FULL');
    const { json } = loadReadyPackage();
    expect(json.access.productCodes).toEqual(['MLMA_FULL']);
  });

  it('dry-run и apply не переписывают track_connections и соседей', () => {
    const store = createSeededStore();
    const { source } = loadReadyPackage();
    const neighbor = store.getTrack('A2-008')!.title;
    const connections = JSON.stringify(store.listConnections());
    const ruleCount = store.listRules().length;
    const dry = importTrackPackage(store, source, { dryRun: true });
    expect(dry.ok).toBe(true);
    expect(store.getContent('A3-002')).toBeUndefined();
    const apply = importTrackPackage(store, source, { dryRun: false });
    expect(apply.ok).toBe(true);
    expect(store.getTrack('A2-008')?.title).toBe(neighbor);
    expect(JSON.stringify(store.listConnections())).toBe(connections);
    expect(store.getContent('A3-002')?.contentStatus).toBe('REVIEW');
    expect(store.getContent('A3-002')?.productPolicy?.productCodes).toEqual(['MLMA_FULL']);
    expect(store.listRules().some((rule) => rule.ruleId === 'RR3-A3-002-STOP')).toBe(true);
    expect(store.listRules().find((rule) => rule.ruleId === 'RR3-A3-002-STOP')?.ruleStatus).toBe('PILOT_DRAFT_TO_TEST');
    expect(store.listRules().find((rule) => rule.ruleId === 'RR2-014')?.ruleStatus).toBe('PILOT_DRAFT_TO_TEST');
    expect(store.listRules().length).toBe(ruleCount + 1);
  });
});

describe('A3-002 acceptance cases', () => {
  const cases = JSON.parse(fs.readFileSync(CASES, 'utf8')).cases as Array<{
    id: string;
    kind: string;
    given: Record<string, unknown>;
    expect: Record<string, unknown>;
  }>;

  it('ROUTE-01…06', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const byId = Object.fromEntries(cases.filter((row) => row.kind === 'ROUTE').map((row) => [row.id, row]));

    const sent = decideRoute(
      store,
      ctx({
        outcomeCode: String(byId['ROUTE-01'].given.outcomeCode),
        facts: { 'message.status': byId['ROUTE-01'].given['message.status'] },
      }),
    );
    expect(sent.matchedRuleId).toBe('RR2-014');
    expect(sent.destinationType).toBe('SYSTEM_ACTION');
    expect(sent.destinationId).toBe('A3-008');

    const noReason = decideRoute(
      store,
      ctx({
        outcomeCode: 'MESSAGE_NOT_SENT_NO_REASON',
        facts: { 'message.status': 'BLOCKED_REASON' },
      }),
    );
    expect(noReason.matchedRuleId).toBe('RR2-015');
    expect(noReason.destinationId).toBe('A3-016');

    const anxiety = decideRoute(
      store,
      ctx({
        outcomeCode: 'MESSAGE_NOT_SENT_ANXIETY',
        facts: { 'message.status': 'BLOCKED_ANXIETY' },
      }),
    );
    expect(anxiety.matchedRuleId).toBe('RR2-016');
    expect(anxiety.destinationId).toBe('A3-014');

    const stopped = decideRoute(
      store,
      ctx({
        outcomeCode: 'MESSAGE_STOPPED',
        facts: { 'message.status': 'STOPPED' },
      }),
    );
    expect(stopped.matchedRuleId).toBe('RR3-A3-002-STOP');
    expect(stopped.destinationType).toBe('DONE');
    expect(stopped.destinationId).toBeNull();

    const draft = decideRoute(store, ctx({ outcomeCode: 'DRAFT_SAVED', facts: {} }));
    expect(draft.reasonCode).toBe('NO_MATCHING_RULE');

    const mismatch = decideRoute(
      store,
      ctx({
        outcomeCode: 'MESSAGE_SENT',
        facts: { 'message.status': 'BLOCKED_REASON' },
      }),
    );
    expect(mismatch.reasonCode).toBe('NO_MATCHING_RULE');
  });

  it('GRAPH-01/02: слоты закрыты, соседи не правятся', () => {
    const store = createSeededStore();
    const a3 = store.getConnectionIndex('A3-002');
    expect(a3?.incomingEffectiveConnections).toHaveLength(6);
    expect(a3?.outgoingEffectiveConnections).toHaveLength(3);
    const locked = store.listConnections().find((row) => row.connectionId === 'TR-072');
    expect(locked?.activationMode).toBe('LOCKED_NEXT_ACTION_SLOT');
    expect(locked?.userVisible).toBe(false);
    expect(locked?.executable).toBe(false);
  });

  it('ACCESS-01…05', async () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const track = store.getTrack('A3-002')!;
    const content = store.getContent('A3-002')!;

    const anon = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/A3-002/content'), {
      store,
      env: { NODE_ENV: 'test' },
    });
    expect(anon.status).toBe(403);
    const anonBody = await anon.json();
    expect(JSON.stringify(anonBody)).not.toMatch(/Первое сообщение без рекламной простыни/);

    const verifiedNoGrant = identityFromVerifiedSession({ userId: 'u1', verified: true, role: 'FULL' });
    const noEnt = decideContentAccess({
      track,
      content,
      access: verifiedNoGrant,
      flags: DEFAULT_ARCHITECTURE_FLAGS,
    });
    expect(noEnt.allowed).toBe(false);

    const entitledReview = decideContentAccess({
      track,
      content,
      access: identityFromVerifiedSession({
        userId: 'u2',
        verified: true,
        role: 'FULL',
        entitlements: [
          {
            productCode: 'MLMA_FULL',
            status: 'active',
            startsAt: '2026-01-01T00:00:00Z',
            endsAt: null,
            grantsAll: true,
          },
        ],
      }),
      flags: DEFAULT_ARCHITECTURE_FLAGS,
    });
    expect(entitledReview.allowed).toBe(false);

    store.upsertContent({ ...content, contentStatus: 'PUBLISHED', publishedAt: '2026-09-01T00:00:00Z' });
    const published = decideContentAccess({
      track,
      content: store.getContent('A3-002')!,
      access: identityFromVerifiedSession({
        userId: 'u3',
        verified: true,
        role: 'FULL',
        entitlements: [
          {
            productCode: 'MLMA_FULL',
            status: 'active',
            startsAt: '2026-01-01T00:00:00Z',
            endsAt: null,
            grantsTrackIds: ['A3-002'],
          },
        ],
      }),
      flags: { ...DEFAULT_ARCHITECTURE_FLAGS, PAID_TRACK_NAVIGATION_ENABLED: false },
      productGrantsTrack: true,
    });
    expect(published.allowed).toBe(true);
    const routed = decideRoute(
      store,
      ctx({
        userAccess: identityFromVerifiedSession({
          userId: 'u3',
          verified: true,
          role: 'FULL',
          entitlements: [
            {
              productCode: 'MLMA_FULL',
              status: 'active',
              startsAt: '2026-01-01T00:00:00Z',
              endsAt: null,
              grantsTrackIds: ['A3-002'],
            },
          ],
        }),
        flags: { ...PILOT_FLAGS, PAID_TRACK_NAVIGATION_ENABLED: false },
        mode: 'production',
      }),
    );
    expect(routed.locked).toBe(true);
    expect(routed.destinationUrl).toBeNull();

    const meta = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/A3-002/meta'), {
      store,
      env: { NODE_ENV: 'test' },
    });
    expect(meta.status).toBe(200);
    const metaBody = await meta.json();
    expect(metaBody.meta.id).toBe('A3-002');
    expect(metaBody.meta.connections).toBeUndefined();
    expect(metaBody.meta.contentAvailable).toBe(false);
    expect(metaBody.meta.routeAvailable).toBe(false);
    expect(metaBody.meta.publicPromise).toMatch(/без давления/);
    expect(JSON.stringify(metaBody)).not.toMatch(/MESSAGE_SENT/);
    expect(JSON.stringify(metaBody)).not.toMatch(/Первое сообщение без рекламной простыни/);
    expect(publicMetaResponse(toPublicTrackMeta(track, false)).id).toBe('A3-002');
  });

  it('DEMO-01 sandbox isolation', () => {
    const demo = JSON.parse(fs.readFileSync(DEMO, 'utf8'));
    expect(demoSandboxIsolated(demo)).toBe(true);
    const store = createSeededStore();
    store.upsertTrack({ ...store.getTrack('A3-002')!, accessTier: 'PUBLIC_DEMO', executionMode: 'SANDBOX' });
    store.upsertContent({
      id: newId('cv'),
      trackId: 'A3-002',
      contentVersion: 'demo',
      contentStatus: 'PUBLISHED',
      contentFormat: 'json',
      privateContentRef: 'server/content/tracks/a3-002/demo',
      checksum: 'demo',
      accessTier: 'PUBLIC_DEMO',
      executionMode: 'SANDBOX',
      productPolicy: { policy: 'FREE_CONTENT' },
      createdAt: '2026-09-01T00:00:00Z',
      publishedAt: '2026-09-01T00:00:00Z',
      body: demo,
    });
    const live = decideInstanceCreation({
      track: store.getTrack('A3-002')!,
      content: store.getContent('A3-002', 'demo')!,
      access: identityFromVerifiedSession({ userId: 'u1', verified: true, role: 'FULL' }),
    });
    expect(live.allowed).toBe(false);
    if (!live.allowed) expect(live.lockReason).toBe('SANDBOX_NO_LIVE_INSTANCE');
  });

  it('PRIVACY-01…03: client-only поля не живут на сервере и в аналитике', () => {
    const stored = stripUnsafeFacts({
      contact_name: 'Тест',
      message_text: 'секрет',
      outcome_code: 'MESSAGE_SENT',
    });
    expect(stored).toEqual({ outcome_code: 'MESSAGE_SENT' });
    expect(assertNoContactPii({ contact_name: 'Тест', message_text: 'секрет' }).length).toBeGreaterThan(0);
    expect(validateAnalyticsProperties({ message_draft: 'текст' })).toBe('FAIL');
    expect(assertNoContactPii({ real_reason_text: 'личная история' }).length).toBeGreaterThan(0);
  });

  it('CONTENT-01…05 quality/reason gates', () => {
    const c1 = evaluateA3002QualityGate('Привет, как дела? У меня к тебе предложение');
    expect(c1.passed).toBe(false);
    expect(c1.failedChecks).toContain('TRANSPARENT');
    const c2 = evaluateA3002QualityGate('Есть уникальная возможность гарантированного дохода');
    expect(c2.passed).toBe(false);
    expect(c2.failedChecks).toEqual(expect.arrayContaining(['TRUE', 'NO_UNSOLICITED_PITCH']));
    const c3 = decideA3002ReasonGate({ reasonConfirmed: false });
    expect(c3).toMatchObject({ messageGenerated: false, outcomeCode: 'MESSAGE_NOT_SENT_NO_REASON', autoSend: false });
    const c4 = decideA3002ReasonGate({ explicitDoNotContact: true });
    expect(c4).toMatchObject({ messageGenerated: false, outcomeCode: 'MESSAGE_STOPPED' });
    const c5 = fieldActionAvailable({ TRUE: true, TRANSPARENT: true, EASY_NO: true, NO_UNSOLICITED_PITCH: true });
    expect(c5).toEqual({ fieldActionAvailable: true, autoSend: false });
  });

  it('paid content JSON не попадает в public tilda generate forbidden set via fixture secret replaced', () => {
    const publicCatalog = fs.readFileSync(path.join(ROOT, 'tilda/src/ui.js'), 'utf8');
    expect(publicCatalog.includes('Первое сообщение без рекламной простыни')).toBe(false);
    expect(publicCatalog.includes('real_reason_text')).toBe(false);
  });
});
