import { SECTION_IDS, type SectionId } from './types';
import { TRACK_ID_PATTERN } from './schemas';

/**
 * Все внутренние переходы строятся здесь.
 * Домен нигде не хардкодится, `legacyPublicUrl` в навигации не используется.
 *
 * Канонический URL — lowercase (`/track/a1-004`),
 * канонический ID внутри системы — uppercase (`A1-004`).
 */

export const routes = {
  home: () => '/',
  start: () => '/start',
  library: () => '/library',
  section: (sectionId: string) => `/library/${sectionId.toLowerCase()}`,
  track: (trackId: string) => `/track/${trackId.toLowerCase()}`,
  my: () => '/my',
  myRoute: () => '/my/route',
  myResults: () => '/my/results',
  profile: () => '/profile',
  access: () => '/access',
  adminCatalog: () => '/admin/catalog',
  librarySearch: (query: string) => `/library?q=${encodeURIComponent(query)}`,
  librarySection: (sectionId: string) => `/library?section=${sectionId.toUpperCase()}`,
} as const;

export function routeForTrack(trackId: string): string {
  return routes.track(trackId);
}

export function routeForSection(sectionId: string): string {
  return routes.section(sectionId);
}

/** `a1-004` | `A1-004` → `A1-004`; всё остальное → null. */
export function normalizeTrackId(raw: string): string | null {
  const candidate = decodeURIComponent(raw).trim().toUpperCase();
  return TRACK_ID_PATTERN.test(candidate) ? candidate : null;
}

/** `a3` | `A3` → `A3`; всё остальное → null. */
export function normalizeSectionId(raw: string): SectionId | null {
  const candidate = decodeURIComponent(raw).trim().toUpperCase();
  return (SECTION_IDS as readonly string[]).includes(candidate) ? (candidate as SectionId) : null;
}

/** URL уже канонический (lowercase)? Иначе нужен редирект. */
export function isCanonicalParam(raw: string): boolean {
  return raw === raw.toLowerCase();
}
