import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { handleWebhook, verifySignature } from '../../server/payment-webhook.js';

const require = createRequire(import.meta.url);
require('../src/domain.js');
const MLMA = require('../src/domain.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '../dist');

describe('SEO сборки', () => {
  it('публичные HEAD — index,follow, кабинет — noindex', () => {
    const home = fs.readFileSync(path.join(DIST, 't123/heads/home.html'), 'utf8');
    const library = fs.readFileSync(path.join(DIST, 't123/heads/library.html'), 'utf8');
    const my = fs.readFileSync(path.join(DIST, 't123/heads/my.html'), 'utf8');
    const track = fs.readFileSync(path.join(DIST, 't123/heads/track.html'), 'utf8');
    const profile = fs.readFileSync(path.join(DIST, 't123/heads/profile.html'), 'utf8');
    assert.match(home, /name="robots" content="index, follow"/);
    assert.match(library, /name="robots" content="index, follow"/);
    assert.match(my, /name="robots" content="noindex, nofollow"/);
    assert.match(profile, /name="robots" content="noindex, nofollow"/);
    assert.match(track, /name="robots" content="noindex, nofollow"/);
    assert.match(home, /rel="canonical" href="https:\/\/mlmacademy.ru\/academy"/);
    assert.doesNotMatch(home, /http:\/\/mlmacademy.ru\/academy/);
    assert.match(home, /application\/ld\+json/);
    assert.doesNotMatch(home, /"@type":"Course"/);
  });

  it('robots.txt не блокирует академию и указывает HTTPS sitemap', () => {
    const robots = fs.readFileSync(path.join(DIST, 'seo/robots.txt'), 'utf8');
    const sitemap = fs.readFileSync(path.join(DIST, 'seo/sitemap-academy.xml'), 'utf8');
    assert.match(robots, /Allow: \/pricing/);
    assert.match(robots, /Allow: \/payment-and-access/);
    assert.match(robots, /Allow: \/privacy/);
    assert.match(robots, /Allow: \/consent/);
    assert.match(robots, /Allow: \/offer/);
    assert.match(robots, /Allow: \/requisites/);
    assert.match(robots, /Allow: \/documents/);
    assert.match(robots, /Allow: \/cookies/);
    assert.match(robots, /Allow: \/marketing-consent/);
    assert.match(sitemap, /https:\/\/mlmacademy.ru\/pricing/);
    assert.match(sitemap, /https:\/\/mlmacademy.ru\/privacy/);
    assert.match(sitemap, /https:\/\/mlmacademy.ru\/consent/);
    assert.match(sitemap, /https:\/\/mlmacademy.ru\/offer/);
    assert.match(sitemap, /https:\/\/mlmacademy.ru\/requisites/);
    assert.match(sitemap, /https:\/\/mlmacademy.ru\/documents/);
    assert.match(sitemap, /https:\/\/mlmacademy.ru\/cookies/);
    assert.match(sitemap, /https:\/\/mlmacademy.ru\/marketing-consent/);
    const privacy = fs.readFileSync(path.join(DIST, 't123/heads/privacy.html'), 'utf8');
    const offer = fs.readFileSync(path.join(DIST, 't123/heads/offer.html'), 'utf8');
    const consent = fs.readFileSync(path.join(DIST, 't123/heads/consent.html'), 'utf8');
    const pricing = fs.readFileSync(path.join(DIST, 't123/heads/pricing.html'), 'utf8');
    const documents = fs.readFileSync(path.join(DIST, 't123/heads/documents.html'), 'utf8');
    const cookies = fs.readFileSync(path.join(DIST, 't123/heads/cookies.html'), 'utf8');
    const marketing = fs.readFileSync(path.join(DIST, 't123/heads/marketing-consent.html'), 'utf8');
    assert.match(privacy, /name="robots" content="index, follow"/);
    assert.match(offer, /name="robots" content="index, follow"/);
    assert.match(consent, /name="robots" content="index, follow"/);
    assert.match(pricing, /name="robots" content="index, follow"/);
    assert.match(documents, /name="robots" content="index, follow"/);
    assert.match(cookies, /name="robots" content="index, follow"/);
    assert.match(marketing, /name="robots" content="index, follow"/);
    assert.match(robots, /Sitemap: https:\/\/mlmacademy.ru\/sitemap.xml/);
    assert.match(sitemap, /https:\/\/mlmacademy.ru\/library/);
    assert.doesNotMatch(sitemap, /\/my</);
    assert.doesNotMatch(sitemap, /http:\/\/mlmacademy.ru/);
  });

  it('planned трек даёт noindex', () => {
    const publicTrack = MLMA.toPublicTrack({
      trackId: 'A3-002',
      sectionId: 'A3',
      module: 'x',
      title: 'Написать',
      situation: 'Ситуация',
      outcome: 'Результат',
      format: 'Практика',
      nextTrackIds: [],
      publicationStatus: 'planned',
      visibility: 'catalog',
      access: 'undecided',
      contentStatus: 'metadata_only',
    });
    assert.equal(publicTrack.seoStatus, 'noindex');
  });
});

describe('webhook worker', () => {
  it('идемпотентен и отклоняет плохую подпись', async () => {
    assert.equal(verifySignature('body', 'secret', 'secret'), true);
    assert.equal(verifySignature('body', 'nope', 'secret'), false);
    const first = await handleWebhook({ paymentId: 'p1', orderId: 'o1', status: 'paid', idempotencyKey: 'p1' }, { signatureValid: true });
    const second = await handleWebhook({ paymentId: 'p1', orderId: 'o1', status: 'paid', idempotencyKey: 'p1' }, { signatureValid: true });
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    const bad = await handleWebhook({ paymentId: 'p2', status: 'paid', idempotencyKey: 'p2' }, { signatureValid: false });
    assert.equal(bad.ok, false);
  });
});
