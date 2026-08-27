import type { PublicTrackMetadata, SectionId } from './types';

/**
 * Поиск v0: нормализованный подстрочный поиск по title + situation + outcome + module.
 * Слой намеренно изолирован, чтобы позже заменить его полнотекстовым
 * или смысловым поиском без переписывания экранов.
 */

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function buildSearchIndexEntry(track: PublicTrackMetadata): string {
  return normalizeSearchText(
    [track.trackId, track.title, track.situation, track.outcome, track.module, track.format].join(
      ' ',
    ),
  );
}

export interface CatalogQuery {
  query?: string;
  sectionId?: SectionId | null;
  format?: string | null;
  /** `available` — только опубликованные, `preparing` — только готовящиеся. */
  availability?: 'all' | 'available' | 'preparing';
}

export function matchesQuery(track: PublicTrackMetadata, query: CatalogQuery): boolean {
  if (query.sectionId && track.sectionId !== query.sectionId) return false;
  if (query.format && track.format !== query.format) return false;

  if (query.availability === 'available' && track.publicationStatus !== 'published') return false;
  if (query.availability === 'preparing' && track.publicationStatus === 'published') return false;

  const needle = normalizeSearchText(query.query ?? '');
  if (!needle) return true;

  const haystack = buildSearchIndexEntry(track);
  return needle.split(' ').every((word) => haystack.includes(word));
}

export function filterTracks(
  tracks: PublicTrackMetadata[],
  query: CatalogQuery,
): PublicTrackMetadata[] {
  return tracks.filter((track) => matchesQuery(track, query));
}

export function groupBySection(
  tracks: PublicTrackMetadata[],
): Map<SectionId, PublicTrackMetadata[]> {
  const grouped = new Map<SectionId, PublicTrackMetadata[]>();
  for (const track of tracks) {
    const bucket = grouped.get(track.sectionId);
    if (bucket) bucket.push(track);
    else grouped.set(track.sectionId, [track]);
  }
  return grouped;
}
