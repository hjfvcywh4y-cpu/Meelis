import { describe, expect, it } from 'vitest';

import {
  MAX_ALTERNATIVES,
  resolveAlternatives,
  resolveNextAction,
} from '@/domain/next-action';
import type { PublicTrackMetadata, SectionId, UserProfile } from '@/domain/types';

function track(
  trackId: string,
  sectionId: SectionId,
  published = false,
): PublicTrackMetadata {
  return {
    trackId,
    sectionId,
    module: 'Модуль',
    title: `Трек ${trackId}`,
    situation: 'Ситуация',
    outcome: 'Результат',
    format: 'Практика',
    nextTrackIds: [],
    publicationStatus: published ? 'published' : 'planned',
    contentStatus: published ? 'published' : 'metadata_only',
    visibility: 'catalog',
    access: 'undecided',
  };
}

function profile(patch: Partial<UserProfile> = {}): UserProfile {
  return {
    selectedSectionId: null,
    currentGoal: '',
    savedTrackIds: [],
    role: 'member',
    updatedAt: '',
    ...patch,
  };
}

describe('один следующий шаг', () => {
  it('без истории предлагает выбрать ситуацию', () => {
    expect(resolveNextAction({ profile: profile(), tracks: [] })).toEqual({
      kind: 'choose_situation',
    });
  });

  it('берёт первый опубликованный трек выбранного раздела', () => {
    const tracks = [track('A3-001', 'A3'), track('A3-002', 'A3', true), track('A3-003', 'A3', true)];
    const decision = resolveNextAction({
      profile: profile({ selectedSectionId: 'A3' }),
      tracks,
    });
    expect(decision).toEqual({ kind: 'open_track', track: tracks[1], reason: 'section' });
  });

  it('честно сообщает, что выбранный раздел готовится', () => {
    const decision = resolveNextAction({
      profile: profile({ selectedSectionId: 'A5' }),
      tracks: [track('A5-001', 'A5')],
    });
    expect(decision).toEqual({ kind: 'section_preparing', sectionId: 'A5' });
  });

  it('использует сохранённый опубликованный трек, если раздел не выбран', () => {
    const tracks = [track('A6-010', 'A6', true)];
    const decision = resolveNextAction({
      profile: profile({ savedTrackIds: ['A6-010'] }),
      tracks,
    });
    expect(decision).toEqual({ kind: 'open_track', track: tracks[0], reason: 'saved' });
  });

  it('не показывает больше трёх альтернатив', () => {
    const tracks = ['A1-001', 'A1-002', 'A1-003', 'A1-004', 'A1-005'].map((id) =>
      track(id, 'A1'),
    );
    const input = {
      profile: profile({ selectedSectionId: 'A1', savedTrackIds: tracks.map((t) => t.trackId) }),
      tracks,
    };
    const decision = resolveNextAction(input);
    const alternatives = resolveAlternatives(decision, input);

    expect(alternatives.length).toBeLessThanOrEqual(MAX_ALTERNATIVES);
    if (decision.kind === 'open_track' || decision.kind === 'saved_preparing') {
      expect(alternatives.map((item) => item.trackId)).not.toContain(decision.track.trackId);
    }
  });

  it('игнорирует сохранённые ID, которых нет в видимом каталоге', () => {
    const decision = resolveNextAction({
      profile: profile({ savedTrackIds: ['A9-999'] }),
      tracks: [],
    });
    expect(decision).toEqual({ kind: 'choose_situation' });
  });
});
