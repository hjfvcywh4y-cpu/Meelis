import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  shapeRerankResponse,
  compactCandidates,
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

  it('при низкой уверенности не оставляет случайные треки', () => {
    const shaped = shapeRerankResponse(
      {
        confidence: 0.2,
        topMatches: [{ trackId: 'A1-001', confidence: 0.2, reason: 'нет' }],
        relatedMatches: [],
        clarification: 'Уточните ситуацию',
      },
      new Set(['A1-001']),
    );
    assert.equal(shaped.topMatches.length, 0);
    assert.equal(shaped.relatedMatches.length, 0);
    assert.match(shaped.clarification, /Уточните/);
  });

  it('режет кандидатов до 15 и только с валидным ID', () => {
    const rows = [];
    for (let i = 1; i <= 20; i += 1) {
      rows.push({ trackId: 'A1-' + String(i).padStart(3, '0'), title: 't' });
    }
    rows.push({ trackId: 'ZZ-001', title: 'bad' });
    const compact = compactCandidates(rows);
    assert.equal(compact.length, 15);
    assert.equal(compact.some((row) => row.trackId === 'ZZ-001'), false);
  });

  it('без ключа не выбирает площадку', () => {
    const cfg = resolveModelConfig({});
    assert.equal(cfg.key, '');
    assert.equal(cfg.provider, null);
  });

  it('Groq-ключ сам ставит Groq endpoint и быструю модель', () => {
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
});
