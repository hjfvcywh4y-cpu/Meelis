import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeTrackIds,
  removeTrackId,
  reorderTrackIds,
  normalizeTrackId,
  userKeyFromIdentity,
  identityFromBindBody,
  signSession,
  verifySession,
  sanitizeAnalytics,
  allowedOrigin,
} from '../../account-proxy/account-core.js';

describe('account-core: маршрут', () => {
  it('не создаёт дубль и отбрасывает неизвестный id', () => {
    const first = mergeTrackIds([], ['A1-010', 'A1-010', 'ZZ-999']);
    assert.deepEqual(first.trackIds, ['A1-010']);
    assert.equal(first.added, 1);
    const second = mergeTrackIds(first.trackIds, ['A1-010']);
    assert.equal(second.added, 0);
    assert.deepEqual(second.trackIds, ['A1-010']);
  });

  it('удаляет и меняет порядок только среди своих id', () => {
    const ids = ['A1-010', 'A3-002', 'A2-001'];
    assert.equal(removeTrackId(ids, 'A3-002').removed, true);
    assert.deepEqual(reorderTrackIds(ids, ['A2-001', 'A1-010', 'A9-999']), ['A2-001', 'A1-010', 'A3-002']);
  });

  it('нормализует track id по каталогу', () => {
    assert.equal(normalizeTrackId('a1-010'), 'A1-010');
    assert.equal(normalizeTrackId('nope'), '');
  });
});

describe('account-core: идентичность', () => {
  it('не принимает произвольный userId без email/maId', () => {
    assert.equal(identityFromBindBody({ userId: 'hack' }), null);
    assert.ok(identityFromBindBody({ email: 'a@b.c', maId: '61058717' }));
    assert.equal(userKeyFromIdentity({ maId: '61058717', email: 'a@b.c' }), 'ma:61058717');
  });

  it('подписывает cookie и отвергает подделку', async () => {
    const token = await signSession('secret', 'ma:1', Math.floor(Date.now() / 1000) + 60);
    const ok = await verifySession('secret', token);
    assert.equal(ok.userKey, 'ma:1');
    const bad = await verifySession('secret', token.replace(/.$/, '0'));
    assert.equal(bad, null);
    const other = await verifySession('other', token);
    assert.equal(other, null);
  });

  it('не пускает чужой origin и режет секреты аналитики', () => {
    assert.equal(allowedOrigin('https://evil.example'), '');
    assert.equal(allowedOrigin('https://mlmacademy.ru'), 'https://mlmacademy.ru');
    const event = sanitizeAnalytics('track_saved', { password: 'x', token: 'y', itemId: 'A1-010' });
    assert.equal(event.data.password, undefined);
    assert.equal(event.data.token, undefined);
    assert.equal(event.data.itemId, 'A1-010');
  });
});
