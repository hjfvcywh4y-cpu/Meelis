import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shapeRerankResponse, compactCandidates } from '../../search-proxy/rerank-core.js';

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
});
