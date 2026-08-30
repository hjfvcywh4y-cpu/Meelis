import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');

require('../src/domain.js');
require('../src/access.js');
require('../src/storage.js');
require('../src/payments.js');
require('../src/commerce.js');
require('../src/legal.js');
const MLMA = require('../src/ontology.js');

function flagValue(source) {
  const match = source.match(/var SIGNUP_ENABLED = (true|false);/);
  return match ? match[1] : '';
}

describe('пауза регистрации', () => {
  it('флаг выключен в одном значении на клиенте и в Members bridge', () => {
    const commerce = fs.readFileSync(path.join(SRC, 'commerce.js'), 'utf8');
    const bridge = fs.readFileSync(path.join(SRC, 'members-bridge.js'), 'utf8');
    const catalog = JSON.parse(fs.readFileSync(path.join(SRC, 'data/products.catalog.json'), 'utf8'));
    assert.equal(flagValue(commerce), 'false');
    assert.equal(flagValue(bridge), 'false');
    assert.equal(flagValue(commerce), flagValue(bridge));
    assert.equal(catalog.flags.SIGNUP_ENABLED, false);
    assert.equal(MLMA.SIGNUP_ENABLED, false);
    assert.equal(MLMA.isSignupEnabled(), false);
  });

  it('гость не направляется на создание кабинета', () => {
    const rec = MLMA.recommendedAction({
      account: { loggedIn: false, entitlements: [] },
      profile: {},
      tracks: [],
    });
    assert.equal(rec.kind, 'signup_paused');
    assert.match(rec.title, /временно закрыта/i);
    assert.match(rec.href, /\/members\/login/);
    assert.doesNotMatch(rec.href, /signup/);
    assert.equal(rec.cta, 'Войти');
    assert.equal(MLMA.membersSignupUrl('/my'), MLMA.membersLoginUrl('/my'));
    assert.equal(MLMA.routes().signup('/my'), MLMA.membersLoginUrl('/my'));
  });

  it('вход, выход и платежи не меняются', () => {
    assert.equal(MLMA.membersLogoutUrl(), '/members/login?exit=y');
    assert.equal(MLMA.membersLoginUrl('/my'), '/members/login?redirecturl=my');
    assert.equal(MLMA.PAYMENTS_ENABLED, false);
    assert.equal(MLMA.COMMERCE_PREVIEW_ENABLED, false);
  });

  it('форма Tilda signup блокируется, галочки согласия остаются в коде для включения', () => {
    const bridge = fs.readFileSync(path.join(SRC, 'members-bridge.js'), 'utf8');
    const ui = fs.readFileSync(path.join(SRC, 'ui.js'), 'utf8');
    assert.match(bridge, /data-mlma-signup-blocked/);
    assert.match(bridge, /mlma-signup-paused/);
    assert.match(bridge, /pdn_consent/);
    assert.match(bridge, /SIGNUP_ENABLED !== true/);
    assert.match(ui, /Регистрация новых кабинетов временно закрыта/);
    assert.match(ui, /isSignupEnabled\(\)/);
  });
});
