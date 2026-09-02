import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function memoryStore() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

const local = memoryStore();
global.window = { localStorage: local, MLMA_TRACK_MODULES: {} };
global.localStorage = local;
require('../src/tracks/a3-002.module.js');
const mod = global.window.MLMA_TRACK_MODULES['A3-002'];

describe('A3-002 client-only storage', () => {
  it('хранит черновик локально и не кладёт его в server payload', () => {
    mod.saveClientOnly({
      contact_name: 'Анна',
      real_reason_text: 'спросила про проект',
      message_draft: 'Привет! Ты спрашивала…',
    });
    const loaded = mod.loadClientOnly();
    assert.equal(loaded.contact_name, 'Анна');
    assert.equal(loaded.message_draft.includes('Привет'), true);
    const payload = mod.serverPayload('MESSAGE_SENT', { status: 'SENT', channel_code: 'telegram' });
    assert.equal(payload.contact_name, undefined);
    assert.equal(payload.message_draft, undefined);
    assert.equal(payload.real_reason_text, undefined);
    assert.equal(payload.outcome_code, 'MESSAGE_SENT');
    assert.equal(mod.autoSend, false);
  });

  it('paid content и примеры не лежат в публичном модуле', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/tracks/a3-002.module.js'), 'utf8');
    assert.equal(src.includes('гарантированного дохода'), false);
    assert.equal(src.includes('Первое сообщение без рекламной простыни'), false);
    assert.equal(mod.executable, false);
  });
});
