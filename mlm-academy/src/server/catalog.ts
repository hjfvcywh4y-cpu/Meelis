import 'server-only';

import catalogJson from '@/data/tracks.catalog.json';
import pilotGraphJson from '@/data/pilot.graph.json';
import recommendationRulesJson from '@/data/recommendation.rules.json';
import registrySummaryJson from '@/data/registry.summary.json';
import sectionsJson from '@/data/sections.json';

import {
  catalogFileSchema,
  pilotGraphSchema,
  recommendationRulesSchema,
  registrySummarySchema,
  sectionsFileSchema,
} from '@/domain/schemas';
import { toPublicTrackMetadata } from '@/domain/sanitize';
import { filterTracks, type CatalogQuery } from '@/domain/search';
import { buildCatalogHealthReport, type CatalogHealthReport } from '@/domain/validation';
import type {
  InternalTrackMetadata,
  PilotGraph,
  PublicTrackMetadata,
  RecommendationRules,
  RegistrySummary,
  Section,
  SectionId,
} from '@/domain/types';

/**
 * Единственная точка чтения полного реестра.
 *
 * Модуль помечен `server-only`: попытка импортировать его из клиентского
 * компонента ломает сборку, поэтому внутренние поля физически не могут
 * попасть в клиентский bundle.
 *
 * Каталог неизменяем в рантайме. Любое обновление — новая версия JSON.
 */

function parseOrThrow<T>(
  label: string,
  parse: () => { success: true; data: T } | { success: false; error: { message: string } },
): T {
  const result = parse();
  if (!result.success) {
    throw new Error(`Валидация ${label} не прошла:\n${result.error.message}`);
  }
  return result.data;
}

const catalogFile = parseOrThrow('data/tracks.catalog.json', () =>
  catalogFileSchema.safeParse(catalogJson),
);
const sectionsFile = parseOrThrow('data/sections.json', () =>
  sectionsFileSchema.safeParse(sectionsJson),
);
const pilotGraph = parseOrThrow('data/pilot.graph.json', () =>
  pilotGraphSchema.safeParse(pilotGraphJson),
) as PilotGraph;
const recommendationRules = parseOrThrow('data/recommendation.rules.json', () =>
  recommendationRulesSchema.safeParse(recommendationRulesJson),
) as RecommendationRules;
const registrySummary = parseOrThrow('data/registry.summary.json', () =>
  registrySummarySchema.safeParse(registrySummaryJson),
) as RegistrySummary;

const internalTracks: InternalTrackMetadata[] = [...catalogFile.tracks].sort(
  (a, b) => a.order - b.order,
);
const sections: Section[] = [...sectionsFile.sections].sort((a, b) => a.order - b.order);

const internalById = new Map(internalTracks.map((track) => [track.trackId, track]));

const healthReport = buildCatalogHealthReport({
  tracks: internalTracks,
  registry: registrySummary,
  pilotGraph,
});

if (!healthReport.ok) {
  const errors = healthReport.issues.filter((issue) => issue.level === 'error');
  throw new Error(
    `Каталог не прошёл проверку целостности (${errors.length}):\n${errors
      .map((issue) => `- [${issue.code}] ${issue.message}`)
      .join('\n')}`,
  );
}

export interface CatalogReadOptions {
  /** Preview показывает все 112 карточек, production — только опубликованные. */
  preview: boolean;
}

function isListedInCatalog(track: InternalTrackMetadata, options: CatalogReadOptions): boolean {
  if (track.visibility !== 'catalog') return false;
  if (options.preview) return track.publicationStatus !== 'archived';
  return track.publicationStatus === 'published';
}

function isReachableByDirectLink(
  track: InternalTrackMetadata,
  options: CatalogReadOptions,
): boolean {
  if (track.visibility === 'hidden') return false;
  if (options.preview) return true;
  return track.publicationStatus === 'published';
}

export function getSections(): Section[] {
  return sections;
}

export function getSection(sectionId: SectionId): Section | null {
  return sections.find((section) => section.sectionId === sectionId) ?? null;
}

export function getRegistrySummary(): RegistrySummary {
  return registrySummary;
}

export function getRecommendationRules(): RecommendationRules {
  return recommendationRules;
}

export function getPilotGraph(): PilotGraph {
  return pilotGraph;
}

export function getCatalogHealthReport(): CatalogHealthReport {
  return healthReport;
}

/** Полный реестр. Только для валидатора и admin-экрана. Никогда не в UI напрямую. */
export function getInternalTracks(): InternalTrackMetadata[] {
  return internalTracks;
}

export function listPublicTracks(options: CatalogReadOptions): PublicTrackMetadata[] {
  return internalTracks
    .filter((track) => isListedInCatalog(track, options))
    .map(toPublicTrackMetadata);
}

export function searchPublicTracks(
  options: CatalogReadOptions,
  query: CatalogQuery,
): PublicTrackMetadata[] {
  return filterTracks(listPublicTracks(options), query);
}

export function getPublicTrack(
  trackId: string,
  options: CatalogReadOptions,
): PublicTrackMetadata | null {
  const track = internalById.get(trackId);
  if (!track) return null;
  if (!isReachableByDirectLink(track, options)) return null;
  return toPublicTrackMetadata(track);
}

/** Индекс видимых треков для движка рекомендаций. */
export function getVisibleTrackIndex(
  options: CatalogReadOptions,
): Map<string, PublicTrackMetadata> {
  const index = new Map<string, PublicTrackMetadata>();
  for (const track of internalTracks) {
    if (!isReachableByDirectLink(track, options)) continue;
    index.set(track.trackId, toPublicTrackMetadata(track));
  }
  return index;
}

export interface SectionStats {
  sectionId: SectionId;
  total: number;
  published: number;
  preparing: number;
  modules: string[];
}

export function getSectionStats(sectionId: SectionId): SectionStats {
  const tracks = internalTracks.filter((track) => track.sectionId === sectionId);
  return {
    sectionId,
    total: tracks.length,
    published: tracks.filter((track) => track.publicationStatus === 'published').length,
    preparing: tracks.filter((track) => track.publicationStatus !== 'published').length,
    modules: [...new Set(tracks.map((track) => track.module))],
  };
}

export function getAllSectionStats(): SectionStats[] {
  return sections.map((section) => getSectionStats(section.sectionId));
}

export function listPublicFormats(options: CatalogReadOptions): string[] {
  return [...new Set(listPublicTracks(options).map((track) => track.format))].sort((a, b) =>
    a.localeCompare(b, 'ru'),
  );
}

export function getModulesOfSection(
  sectionId: SectionId,
  options: CatalogReadOptions,
): { module: string; tracks: PublicTrackMetadata[] }[] {
  const tracks = listPublicTracks(options).filter((track) => track.sectionId === sectionId);
  const grouped = new Map<string, PublicTrackMetadata[]>();
  for (const track of tracks) {
    const bucket = grouped.get(track.module);
    if (bucket) bucket.push(track);
    else grouped.set(track.module, [track]);
  }
  return [...grouped.entries()].map(([module, moduleTracks]) => ({
    module,
    tracks: moduleTracks,
  }));
}
