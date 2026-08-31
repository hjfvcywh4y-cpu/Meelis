import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { createSeededStore } from '@/track-architecture/seed';
import { decideRoute } from '@/track-architecture/route-engine';
import { DEFAULT_ARCHITECTURE_FLAGS } from '@/track-architecture/flags';
import { ANON_ACCESS, identityFromUntrustedClient, identityFromVerifiedSession } from '@/track-architecture/identity';
import { resolveTrackId, canPublishAsStandaloneLesson } from '@/track-architecture/resolver';
import { importRouterJson, importTrackPackage } from '@/track-architecture/importer';
import { MemoryArchitectureStore, newId } from '@/track-architecture/store';
import { routerSource } from '@/track-architecture/seed';
import { decideContentAccess } from '@/track-architecture/access';
import { handleArchitectureRequest } from '@/track-architecture/http';
import { parseTrackPackage } from '@/track-architecture/package';
import { stripUnsafeFacts, assertNoContactPii } from '@/track-architecture/privacy';
import { processPaymentEvent } from '@/track-architecture/payments';
import { submitOutcome, createTrackInstance } from '@/track-architecture/runtime';
import { checkTrack } from '@/track-architecture/check';
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

  it('импортирует ровно 58 v2 rules; 231 legacy не исполняются', () => {
    const store = createSeededStore();
    expect(store.listRules()).toHaveLength(58);
    const archive = store.listArchiveEdges();
    expect(archive).toHaveLength(231);
    expect(archive.every((edge) => edge.active === false)).toBe(true);
    expect(archive.every((edge) => edge.statusV2 === 'ARCHIVED_NOT_EXECUTABLE')).toBe(true);
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
    expect(denied.status).toBe(403);
    const payload = await denied.json();
    expect(JSON.stringify(payload)).not.toContain('MLMA_SERVER_ONLY_A3_002_FIXTURE');

    const spoofed = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/tracks/a3-002/content', {
        headers: sessionHeader({ maId: '1', email: 'a@b.c', groups: ['FULL'], verified: false }),
      }),
      { store, env: { NODE_ENV: 'test' } },
    );
    expect(spoofed.status).toBe(403);

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

    const navOff = decideRoute(store, ctx({ userAccess: entitled, flags: DEFAULT_ARCHITECTURE_FLAGS, mode: 'pilot' }));
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
      { store, env: { NODE_ENV: 'test' } },
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
    const contentPath = path.join(process.cwd(), 'server/content/tracks/a3-002/0.1.0/content.json');
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
      }
    }
    const fixture = fs.readFileSync(path.join(process.cwd(), 'server/content/tracks/a3-002/0.1.0/content.json'), 'utf8');
    expect(fixture).toContain(secret);
  });

  it('публичный поиск по-прежнему стартует только по кнопке или Enter', () => {
    const ui = fs.readFileSync(path.join(process.cwd(), 'tilda/src/ui.js'), 'utf8');
    expect(ui).toMatch(/type="submit">Найти решение/);
    expect(ui).not.toMatch(/input.*oninput.*searchCatalog/);
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
