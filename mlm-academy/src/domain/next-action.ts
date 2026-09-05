import type { PublicTrackMetadata, SectionId, UserProfile } from './types';

/**
 * Один главный следующий шаг для личной главной.
 *
 * Решение детерминировано и не зависит от UI, поэтому его можно проверить тестом
 * и позже заменить реализацию репозиториев, не трогая экран.
 */

export type NextActionDecision =
  | { kind: 'choose_situation' }
  | { kind: 'open_track'; track: PublicTrackMetadata; reason: 'section' | 'saved' }
  | { kind: 'section_preparing'; sectionId: SectionId }
  | { kind: 'saved_preparing'; track: PublicTrackMetadata };

export interface NextActionInput {
  profile: UserProfile;
  /** Треки, видимые в текущем режиме приложения, в порядке каталога. */
  tracks: PublicTrackMetadata[];
}

export function resolveNextAction({ profile, tracks }: NextActionInput): NextActionDecision {
  const byId = new Map(tracks.map((track) => [track.trackId, track]));
  const saved = profile.savedTrackIds
    .map((id) => byId.get(id))
    .filter((track): track is PublicTrackMetadata => track != null);

  const sectionTracks = profile.selectedSectionId
    ? tracks.filter((track) => track.sectionId === profile.selectedSectionId)
    : [];

  const publishedInSection = sectionTracks.find((track) => track.publicationStatus === 'published');
  if (publishedInSection) {
    return { kind: 'open_track', track: publishedInSection, reason: 'section' };
  }

  const publishedSaved = saved.find((track) => track.publicationStatus === 'published');
  if (publishedSaved) {
    return { kind: 'open_track', track: publishedSaved, reason: 'saved' };
  }

  if (profile.selectedSectionId) {
    return { kind: 'section_preparing', sectionId: profile.selectedSectionId };
  }

  const firstSaved = saved[0];
  if (firstSaved) {
    return { kind: 'saved_preparing', track: firstSaved };
  }

  return { kind: 'choose_situation' };
}

export const MAX_ALTERNATIVES = 3;

/** Альтернатив всегда не больше трёх, и главный шаг в них не повторяется. */
export function resolveAlternatives(
  decision: NextActionDecision,
  { profile, tracks }: NextActionInput,
): PublicTrackMetadata[] {
  const primaryId = decision.kind === 'open_track' || decision.kind === 'saved_preparing'
    ? decision.track.trackId
    : null;

  const byId = new Map(tracks.map((track) => [track.trackId, track]));
  const saved = profile.savedTrackIds
    .map((id) => byId.get(id))
    .filter((track): track is PublicTrackMetadata => track != null)
    .filter((track) => track.trackId !== primaryId);

  if (saved.length >= MAX_ALTERNATIVES) return saved.slice(0, MAX_ALTERNATIVES);

  const sectionRest = profile.selectedSectionId
    ? tracks
        .filter((track) => track.sectionId === profile.selectedSectionId)
        .filter((track) => track.trackId !== primaryId)
        .filter((track) => !saved.some((item) => item.trackId === track.trackId))
    : [];

  return [...saved, ...sectionRest].slice(0, MAX_ALTERNATIVES);
}
