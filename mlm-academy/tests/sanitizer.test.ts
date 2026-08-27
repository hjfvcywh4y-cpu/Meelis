import { describe, expect, it } from 'vitest';

import { INTERNAL_ONLY_TRACK_FIELDS } from '@/domain/internal-fields';
import { toPublicTrackMetadata } from '@/domain/sanitize';
import { getInternalTracks, getVisibleTrackIndex, listPublicTracks } from '@/server/catalog';

const PUBLIC_FIELDS = [
  'trackId',
  'sectionId',
  'module',
  'title',
  'situation',
  'outcome',
  'format',
  'nextTrackIds',
  'publicationStatus',
  'contentStatus',
  'visibility',
  'access',
].sort();

/** Строки, которые в публичном слое не должны встречаться ни при каких условиях. */
const FORBIDDEN_SUBSTRINGS = [
  'adaptationDecision',
  'originalTitle',
  'sourceCode',
  'pageStatusRaw',
  'internalNote',
  'transformationType',
  'adaptationLevel',
  'legacyPublicUrl',
  'Не создана',
  'Осовременивание',
  'mlmacademy.ru/track',
];

describe('санитайзер публичных метаданных', () => {
  it('оставляет только разрешённый белый список полей', () => {
    for (const track of getInternalTracks()) {
      const publicTrack = toPublicTrackMetadata(track);
      expect(Object.keys(publicTrack).sort()).toEqual(PUBLIC_FIELDS);
    }
  });

  it('не пропускает ни одно внутреннее поле', () => {
    for (const track of getInternalTracks()) {
      const publicTrack = toPublicTrackMetadata(track) as unknown as Record<string, unknown>;
      for (const field of INTERNAL_ONLY_TRACK_FIELDS) {
        expect(field in publicTrack).toBe(false);
      }
    }
  });

  it('не мутирует исходную запись реестра', () => {
    const [track] = getInternalTracks();
    const publicTrack = toPublicTrackMetadata(track);
    publicTrack.nextTrackIds.push('A1-999');
    expect(track.nextTrackIds).not.toContain('A1-999');
  });

  it('сериализованный публичный каталог не содержит внутренних строк', () => {
    const payload = JSON.stringify([
      ...listPublicTracks({ preview: true }),
      ...getVisibleTrackIndex({ preview: true }).values(),
    ]);

    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      expect(payload).not.toContain(forbidden);
    }
    expect(payload).not.toMatch(/"P[012]"/);
  });
});
