import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { createSeededStore } from '@/track-architecture/seed';
import { decideRoute } from '@/track-architecture/route-engine';
import { DEFAULT_ARCHITECTURE_FLAGS } from '@/track-architecture/flags';
import { ANON_ACCESS, identityFromRegisteredSession, identityFromUntrustedClient, identityFromVerifiedSession } from '@/track-architecture/identity';
import { importTrackPackage } from '@/track-architecture/importer';
import { decideContentAccess, decideInstanceCreation } from '@/track-architecture/access';
import { handleArchitectureRequest, readSession } from '@/track-architecture/http';
import { stripUnsafeFacts } from '@/track-architecture/privacy';
import { validateAnalyticsProperties } from '@/track-architecture/events';
import { signSession } from '../../account-proxy/account-core.js';
import { newId } from '@/track-architecture/store';
import { buildCabinet } from '@/track-architecture/cabinet';
import type { ArchitectureFlags, RouteContext } from '@/track-architecture/types';

const ROOT = process.cwd();
const PKG = path.join(ROOT, 'packages/a3-002/package.json');
const CONTENT = path.join(ROOT, 'server/content/tracks/a3-002/0.1.0/content.json');

const BETA: ArchitectureFlags = { ...DEFAULT_ARCHITECTURE_FLAGS, REGISTERED_BETA_ACCESS_ENABLED: true, PAYMENTS_ENABLED: false };

function loadReadyPackage() {
  const json = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  const body = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  return { json, body, source: { filename: 'package.json', text: JSON.stringify(json), json, contentBody: body } };
}

function sessionHeader(value: unknown) {
  return { 'x-mlma-test-session': JSON.stringify(value) };
}

function ctx(partial: Partial<RouteContext> = {}): RouteContext {
  return {
    fromId: 'A3-002',
    outcomeCode: 'MESSAGE_SENT',
    facts: { 'message.status': 'SENT' },
    userAccess: identityFromRegisteredSession({ userId: 'ma:1' }),
    now: '2026-09-02T00:00:00Z',
    mode: 'beta',
    flags: BETA,
    ...partial,
  };
}

describe('registered beta access', () => {
  it('ANON видит metadata и возможные направления, не content', async () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const meta = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/A3-002/meta'), {
      store,
      env: { NODE_ENV: 'test' },
      flags: BETA,
    });
    expect(meta.status).toBe(200);
    const body = await meta.json();
    expect(body.meta.loginCta).toBe('Войти и пройти трек');
    expect(body.meta.continuationNote).toMatch(/Продолжение зависит от результата/);
    expect(body.meta.possibleContinuations.length).toBeGreaterThan(0);
    const content = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/tracks/A3-002/content'), {
      store,
      env: { NODE_ENV: 'test' },
      flags: BETA,
    });
    expect([401, 403]).toContain(content.status);
    expect(JSON.stringify(await content.json())).not.toMatch(/Первое сообщение без рекламной простыни/);
  });

  it('query/localStorage/email/Member ID не дают доступ', async () => {
    expect(identityFromUntrustedClient({ maId: '1', email: 'a@b.c', groups: ['FULL'] })).toEqual(ANON_ACCESS);
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const spoofed = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/tracks/A3-002/content', {
        headers: sessionHeader({ maId: '1', email: 'roma@test', groups: ['ADMIN'] }),
      }),
      { store, env: { NODE_ENV: 'test' }, flags: BETA },
    );
    expect(spoofed.status).toBe(403);
  });

  it('оба зарегистрированных аккаунта идут по одной политике без owner role', async () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const a = identityFromRegisteredSession({ userId: 'ma:roman' });
    const b = identityFromRegisteredSession({ userId: 'ma:mom' });
    expect(a.role).toBe(b.role);
    expect(a.verified).toBe(false);
    expect(JSON.stringify(a)).not.toMatch(/OWNER/);
    for (const access of [a, b]) {
      const allowed = decideContentAccess({
        track: store.getTrack('A3-002')!,
        content: store.getContent('A3-002')!,
        access,
        flags: BETA,
      });
      expect(allowed.allowed).toBe(true);
    }
  });

  it('подтверждённая сессия получает REVIEW content при выключенной оплате', async () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const res = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/tracks/A3-002/content', {
        headers: sessionHeader({ userId: 'ma:1', registered: true }),
      }),
      { store, env: { NODE_ENV: 'test' }, flags: BETA },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.body.title).toBe('Первое сообщение без рекламной простыни');
  });

  it('HMAC cookie в production даёт registered session, test header — нет', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await signSession('unit-secret', 'ma:9', exp, { sid: 'sid-1' });
    const fromCookie = readSession(
      new Request('https://mlma.test/api/v1/me/cabinet', { headers: { cookie: `mlma_sid=${token}` } }),
      { NODE_ENV: 'production', MLMA_SESSION_SECRET: 'unit-secret' },
    );
    expect(fromCookie.registered).toBe(true);
    expect(fromCookie.userId).toBe('ma:9');
    expect(fromCookie.verified).toBe(false);
    const headerIgnored = readSession(
      new Request('https://mlma.test/x', { headers: sessionHeader({ userId: 'u1', verified: true, role: 'ADMIN' }) }),
      { NODE_ENV: 'production' },
    );
    expect(headerIgnored).toEqual(ANON_ACCESS);
  });

  it('четыре outcome дают beta RouteDecision; неустановленный следующий — Готовится', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const sent = decideRoute(store, ctx());
    expect(sent.matchedRuleId).toBe('RR2-014');
    expect(sent.destinationId).toBe('A3-008');
    expect(sent.preparingDestination).toBe(true);
    expect(sent.betaPilot).toBe(true);
    const stopped = decideRoute(store, ctx({ outcomeCode: 'MESSAGE_STOPPED', facts: { 'message.status': 'STOPPED' } }));
    expect(stopped.matchedRuleId).toBe('RR3-A3-002-STOP');
    expect(stopped.destinationType).toBe('DONE');
    expect(stopped.locked).toBe(false);
  });

  it('/my cabinet: один главный шаг и незавершённый трек', async () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const access = identityFromRegisteredSession({ userId: 'ma:1' });
    store.upsertInstance({
      instanceId: newId('ti'),
      userId: 'ma:1',
      trackId: 'A3-002',
      contentVersion: '0.1.0',
      instanceStatus: 'active',
      parentRouteId: null,
      startedAt: '2026-09-02T00:00:00Z',
      completedAt: null,
      waitUntil: null,
      lastStepLabel: 'Проверьте перед отправкой',
    });
    const cabinet = buildCabinet(store, access, BETA);
    expect(cabinet.nextStep.kind).toBe('continue');
    expect(cabinet.inProgress?.trackId).toBe('A3-002');
    expect(cabinet.availableTracks.some((row) => row.trackId === 'A3-002')).toBe(true);
    const http = await handleArchitectureRequest(new Request('https://mlma.test/api/v1/me/cabinet', { headers: sessionHeader({ userId: 'ma:1', registered: true }) }), {
      store,
      env: { NODE_ENV: 'test' },
      flags: BETA,
    });
    expect(http.status).toBe(200);
    const body = await http.json();
    expect(body.ownerReview).toBe(false);
    expect(body.reviewUrl).toBeNull();
    expect(body.cabinet.nextStep.question).toBe('Что мне делать сейчас?');
  });

  it('установка второго package делает его доступным в кабинете', () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    store.upsertContent({
      id: newId('cv'),
      trackId: 'A3-016',
      contentVersion: '0.1.0',
      contentStatus: 'REVIEW',
      contentFormat: 'json',
      privateContentRef: 'server/content/tracks/a3-016/0.1.0',
      checksum: 'x',
      productPolicy: {},
      createdAt: '2026-09-02T00:00:00Z',
      publishedAt: null,
      body: { serverOnly: true },
    });
    const cabinet = buildCabinet(store, identityFromRegisteredSession({ userId: 'ma:1' }), BETA);
    expect(cabinet.availableTracks.map((row) => row.trackId).sort()).toEqual(['A3-002', 'A3-016']);
  });

  it('ANON не создаёт instance; registered создаёт; PII не в payload', async () => {
    const store = createSeededStore();
    importTrackPackage(store, loadReadyPackage().source, { dryRun: false });
    const anon = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/track-instances', { method: 'POST', body: JSON.stringify({ trackId: 'A3-002' }) }),
      { store, env: { NODE_ENV: 'test' }, flags: BETA },
    );
    expect(anon.status).toBe(401);
    const start = await handleArchitectureRequest(
      new Request('https://mlma.test/api/v1/track-instances', {
        method: 'POST',
        headers: { ...sessionHeader({ userId: 'ma:1', registered: true }), 'content-type': 'application/json' },
        body: JSON.stringify({ trackId: 'A3-002' }),
      }),
      { store, env: { NODE_ENV: 'test' }, flags: BETA },
    );
    expect(start.status).toBe(201);
    const created = await start.json();
    const outcome = await handleArchitectureRequest(
      new Request(`https://mlma.test/api/v1/track-instances/${created.instance.instanceId}/outcomes`, {
        method: 'POST',
        headers: { ...sessionHeader({ userId: 'ma:1', registered: true }), 'content-type': 'application/json' },
        body: JSON.stringify({
          clientEventId: 'c1',
          outcomeCode: 'MESSAGE_SENT',
          facts: { 'message.status': 'SENT', contact_name: 'Анна', message_draft: 'секрет', mentor_event: 'result_recorded' },
        }),
      }),
      { store, env: { NODE_ENV: 'test' }, flags: BETA },
    );
    expect(outcome.status).toBe(200);
    const payload = await outcome.json();
    expect(JSON.stringify(payload)).not.toContain('Анна');
    expect(JSON.stringify(payload)).not.toContain('секрет');
    expect(payload.decision.matchedRuleId).toBe('RR2-014');
    expect(payload.decision.betaPilot).toBe(true);
    expect(stripUnsafeFacts({ message_draft: 'x', outcome_code: 'MESSAGE_SENT' })).toEqual({ outcome_code: 'MESSAGE_SENT' });
    expect(validateAnalyticsProperties({ real_reason_text: 'y' })).toBe('FAIL');
  });

  it('флаги: signup/оплата/paid nav/bypass выключены; owner review отсутствует', () => {
    expect(BETA.PAYMENTS_ENABLED).toBe(false);
    expect(BETA.PAID_TRACK_NAVIGATION_ENABLED).toBe(false);
    expect(BETA.ALLOW_DRAFT_RULES).toBe(false);
    expect(BETA.ENTITLEMENT_BYPASS).toBe(false);
    const src = [
      fs.readFileSync(path.join(ROOT, 'tilda/src/ui.js'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'src/track-architecture/http.ts'), 'utf8'),
    ].join('\n');
    expect(src).not.toMatch('/my/review/tracks');
    expect(src).not.toMatch('OWNER_REVIEWER');
    expect(fs.readFileSync(path.join(ROOT, 'tilda/src/commerce.js'), 'utf8')).toMatch(/var SIGNUP_ENABLED = false/);
  });

  it('sandbox demo по-прежнему не создаёт live instance', () => {
    const store = createSeededStore();
    store.upsertContent({
      id: newId('cv'),
      trackId: 'A3-002',
      contentVersion: 'demo',
      contentStatus: 'PUBLISHED',
      contentFormat: 'json',
      privateContentRef: 'demo',
      checksum: 'd',
      accessTier: 'PUBLIC_DEMO',
      executionMode: 'SANDBOX',
      productPolicy: { policy: 'FREE_CONTENT' },
      createdAt: '2026-09-02T00:00:00Z',
      publishedAt: '2026-09-02T00:00:00Z',
      body: { demo: true },
    });
    const live = decideInstanceCreation({
      track: store.getTrack('A3-002')!,
      content: store.getContent('A3-002', 'demo')!,
      access: identityFromRegisteredSession({ userId: 'ma:1' }),
      flags: BETA,
    });
    expect(live.allowed).toBe(false);
  });
});
