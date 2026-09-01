import fs from 'node:fs';
import path from 'node:path';

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

const PUBLIC_CARD_OVERLAY_KEYS = [
  'publicPromise',
  'publicIncludes',
  'estimatedMinutes',
  'cta',
  'contentAvailable',
  'routeAvailable',
] as const;

export function publicMetaResponse(meta: PublicTrackMeta): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of PUBLIC_META_FIELDS) {
    out[field] = meta[field];
  }
  return out;
}

/** Safe extra fields from server-only sibling card; never copies connections or lesson body. */
export function overlayPublicCard(trackId: string, meta: Record<string, unknown>): Record<string, unknown> {
  const file = path.join(process.cwd(), 'server/content/tracks', trackId.toLowerCase(), 'public-meta.json');
  if (!fs.existsSync(file)) return meta;
  const card = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  const extra: Record<string, unknown> = {};
  for (const key of PUBLIC_CARD_OVERLAY_KEYS) {
    if (key in card) extra[key] = card[key];
  }
  return { ...meta, ...extra };
}
