import { describe, expect, it } from 'vitest';

import { RECOMMENDATION_LIMITS, recommendNextTracks } from '@/domain/recommendations';
import type { PublicTrackMetadata, SectionId } from '@/domain/types';
import { getPublicTrack, getVisibleTrackIndex } from '@/server/catalog';

function makeTrack(
  trackId: string,
  sectionId: SectionId,
  overrides: Partial<PublicTrackMetadata> = {},
): PublicTrackMetadata {
  return {
    trackId,
    sectionId,
    module: 'Тестовый модуль',
    title: `Трек ${trackId}`,
    situation: 'Ситуация',
    outcome: 'Результат',
    format: 'Практика',
    nextTrackIds: [],
    publicationStatus: 'planned',
    contentStatus: 'metadata_only',
    visibility: 'catalog',
    access: 'undecided',
    ...overrides,
  };
}

function indexOf(tracks: PublicTrackMetadata[]): Map<string, PublicTrackMetadata> {
  return new Map(tracks.map((track) => [track.trackId, track]));
}

describe('детерминированные рекомендации', () => {
  it('берёт кандидатов только из nextTrackIds и отбрасывает несуществующие', () => {
    const current = makeTrack('A1-001', 'A1', { nextTrackIds: ['A1-002', 'A9-999'] });
    const result = recommendNextTracks({
      current,
      visibleTracks: indexOf([current, makeTrack('A1-002', 'A1')]),
    });

    expect(result.primary?.track.trackId).toBe('A1-002');
    expect(result.alternatives).toHaveLength(0);
  });

  it('показывает один главный шаг и не больше трёх альтернатив', () => {
    const nextIds = ['A1-002', 'A1-003', 'A1-004', 'A1-005', 'A1-006'];
    const current = makeTrack('A1-001', 'A1', { nextTrackIds: nextIds });
    const result = recommendNextTracks({
      current,
      visibleTracks: indexOf([current, ...nextIds.map((id) => makeTrack(id, 'A1'))]),
    });

    expect(result.primary).not.toBeNull();
    expect(result.alternatives.length).toBeLessThanOrEqual(
      RECOMMENDATION_LIMITS.alternatives,
    );
    expect(result.alternatives).toHaveLength(3);
  });

  it('поднимает опубликованные и доступные треки выше готовящихся', () => {
    const current = makeTrack('A1-001', 'A1', { nextTrackIds: ['A1-002', 'A1-003'] });
    const result = recommendNextTracks({
      current,
      visibleTracks: indexOf([
        current,
        makeTrack('A1-002', 'A1'),
        makeTrack('A1-003', 'A1', {
          publicationStatus: 'published',
          contentStatus: 'published',
        }),
      ]),
    });

    expect(result.primary?.track.trackId).toBe('A1-003');
    expect(result.needsFallback).toBe(false);
  });

  it('учитывает исход действия: после отказа первым идёт A5', () => {
    const current = makeTrack('A4-016', 'A4', { nextTrackIds: ['A3-008', 'A5-001'] });
    const visible = indexOf([current, makeTrack('A3-008', 'A3'), makeTrack('A5-001', 'A5')]);

    expect(recommendNextTracks({ current, visibleTracks: visible }).primary?.track.trackId).toBe(
      'A3-008',
    );
    expect(
      recommendNextTracks({ current, visibleTracks: visible, outcome: 'refusal' }).primary?.track
        .trackId,
    ).toBe('A5-001');
  });

  it('при not_done остаётся на текущем треке меньшим шагом', () => {
    const current = makeTrack('A3-002', 'A3', { nextTrackIds: ['A3-016'] });
    const result = recommendNextTracks({
      current,
      visibleTracks: indexOf([current, makeTrack('A3-016', 'A3')]),
      outcome: 'not_done',
    });

    expect(result.primary?.track.trackId).toBe('A3-002');
    expect(result.primary?.reason).toBe('smaller_step_of_current');
    expect(result.alternatives).toEqual([]);
  });

  it('требует fallback, когда доступного продолжения нет', () => {
    const current = makeTrack('A1-001', 'A1', { nextTrackIds: ['A1-002'] });
    const result = recommendNextTracks({
      current,
      visibleTracks: indexOf([current, makeTrack('A1-002', 'A1')]),
    });
    expect(result.needsFallback).toBe(true);
  });

  it('на реальном каталоге не выдумывает Track ID', () => {
    const track = getPublicTrack('A3-002', { preview: true });
    expect(track).not.toBeNull();

    const visibleTracks = getVisibleTrackIndex({ preview: true });
    const result = recommendNextTracks({ current: track!, visibleTracks });

    const suggested = [result.primary, ...result.alternatives]
      .filter((item) => item != null)
      .map((item) => item.track.trackId);

    expect(suggested.length).toBeGreaterThan(0);
    for (const id of suggested) {
      expect(track!.nextTrackIds).toContain(id);
    }
  });
});
