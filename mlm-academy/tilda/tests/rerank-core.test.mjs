import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  shapeRerankResponse,
  compactCandidates,
  compactCatalogIndex,
  resolveModelConfig,
  ENDPOINT_DEFAULT,
  GROQ_ENDPOINT,
  GROQ_MODEL_DEFAULT,
  MODEL_DEFAULT,
} from '../../search-proxy/rerank-core.js';

describe('rerank-core', () => {
  it('отбрасывает неизвестные ID и слабую уверенность', () => {
    const shaped = shapeRerankResponse(
      {
        confidence: 0.9,
        topMatches: [
          { trackId: 'A9-999', confidence: 0.99, reason: 'fake' },
          { trackId: 'A3-002', confidence: 0.91, reason: 'Первое сообщение' },
        ],
        relatedMatches: [{ trackId: 'A3-016', confidence: 0.5, reason: 'Повод' }],
      },
      new Set(['A3-002', 'A3-016']),
    );
    assert.deepEqual(
      shaped.topMatches.map((row) => row.trackId),
      ['A3-002'],
    );
    assert.deepEqual(
      shaped.relatedMatches.map((row) => row.trackId),
      ['A3-016'],
    );
  });

  it('при низкой уверенности оставляет ближайшие треки, пусто только вне области', () => {
    const kept = shapeRerankResponse(
      {
        confidence: 0.32,
        matchType: 'adjacent',
        topMatches: [{ trackId: 'A1-010', confidence: 0.32, reason: 'Ближайший план действий' }],
        relatedMatches: [],
        clarification: 'Уточните, нужен личный план или план на месяц',
      },
      new Set(['A1-010']),
    );
    assert.equal(kept.topMatches.length, 1);
    assert.equal(kept.topMatches[0].trackId, 'A1-010');
    assert.equal(kept.matchType, 'adjacent');
    const shaped = shapeRerankResponse(
      {
        confidence: 0.12,
        matchType: 'out_of_scope',
        topMatches: [],
        relatedMatches: [],
        clarification: 'Этот запрос не относится к библиотеке',
      },
      new Set(['A1-001']),
    );
    assert.equal(shaped.topMatches.length, 0);
    assert.equal(shaped.relatedMatches.length, 0);
    assert.equal(shaped.matchType, 'out_of_scope');
    assert.match(shaped.clarification, /не относится/);
  });

  it('режет кандидатов до 20 и только с валидным ID', () => {
    const rows = [];
    for (let i = 1; i <= 25; i += 1) {
      rows.push({ trackId: 'A1-' + String(i).padStart(3, '0'), title: 't' });
    }
    rows.push({ trackId: 'ZZ-001', title: 'bad' });
    const compact = compactCandidates(rows);
    assert.equal(compact.length, 20);
    assert.equal(compact.some((row) => row.trackId === 'ZZ-001'), false);
  });

  it('без ключа не выбирает площадку', () => {
    const cfg = resolveModelConfig({});
    assert.equal(cfg.key, '');
    assert.equal(cfg.provider, null);
  });

  it('Groq-ключ сам ставит Groq endpoint и gpt-oss-20b', () => {
    const cfg = resolveModelConfig({ GROQ_API_KEY: 'gsk_test' });
    assert.equal(cfg.provider, 'groq');
    assert.equal(cfg.endpoint, GROQ_ENDPOINT);
    assert.equal(cfg.model, GROQ_MODEL_DEFAULT);
    assert.equal(cfg.key, 'gsk_test');
  });

  it('OpenAI важнее Groq, дефолт gpt-4o-mini', () => {
    const cfg = resolveModelConfig({
      OPENAI_API_KEY: 'sk_test',
      GROQ_API_KEY: 'gsk_test',
    });
    assert.equal(cfg.provider, 'openai');
    assert.equal(cfg.endpoint, ENDPOINT_DEFAULT);
    assert.equal(cfg.model, MODEL_DEFAULT);
  });

  it('сжимает расширенный индекс каталога до 112 валидных ID', () => {
    const rows = [];
    for (let s = 1; s <= 6; s += 1) {
      for (let i = 1; i <= 20; i += 1) {
        rows.push({ trackId: 'A' + s + '-' + String(i).padStart(3, '0'), title: 't', situation: 'sit', result: 'out', aliases: ['план'] });
      }
    }
    rows.push({ trackId: 'ZZ-001', title: 'bad' });
    const compact = compactCatalogIndex(rows);
    assert.equal(compact.length, 112);
    assert.equal(compact.some((row) => row.trackId === 'ZZ-001'), false);
    assert.equal(GROQ_MODEL_DEFAULT, 'openai/gpt-oss-20b');
  });
});
