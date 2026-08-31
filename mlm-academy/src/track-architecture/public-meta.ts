import type { PublicTrackMeta, TrackDefinition } from './types';
import { canPublishAsStandaloneLesson } from './resolver';

export const PUBLIC_META_FIELDS = [
  'id',
  'title',
  'situation',
  'result',
  'section',
  'domain',
  'catalogVisibility',
  'availabilityLabel',
] as const;

export function availabilityLabel(track: TrackDefinition, hasPublishedContent: boolean): string {
  if (!canPublishAsStandaloneLesson(track.entityType)) return 'Не отдельный урок';
  if (track.publicationStatus === 'PUBLISHED' && hasPublishedContent) return 'Доступен';
  if (track.publicationStatus === 'PAUSED' || track.publicationStatus === 'ARCHIVED') return 'Недоступен';
  return 'Готовится';
}

export function toPublicTrackMeta(track: TrackDefinition, hasPublishedContent = false): PublicTrackMeta {
  return {
    id: track.id,
    title: track.title,
    situation: track.situation,
    result: track.result,
    section: track.section,
    domain: track.domain,
    catalogVisibility: track.catalogVisible && canPublishAsStandaloneLesson(track.entityType),
    availabilityLabel: availabilityLabel(track, hasPublishedContent),
    entityType: track.entityType,
  };
}

export function publicMetaResponse(meta: PublicTrackMeta): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of PUBLIC_META_FIELDS) {
    out[field] = meta[field];
  }
  return out;
}
