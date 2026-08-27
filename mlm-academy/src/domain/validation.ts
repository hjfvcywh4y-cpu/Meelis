import type { InternalTrackMetadata, PilotGraph, RegistrySummary, SectionId } from './types';
import { SECTION_IDS } from './types';
import { TRACK_ID_PATTERN } from './schemas';

/**
 * Здоровье реестра. Ошибки не проглатываются:
 * они попадают в /admin/catalog, в тесты и в лог сборки.
 */

export type CatalogIssueLevel = 'error' | 'warning' | 'info';

export interface CatalogIssue {
  level: CatalogIssueLevel;
  code: string;
  message: string;
  trackId?: string;
}

export interface CatalogHealthReport {
  checkedAt: string;
  totalTracks: number;
  bySection: Record<SectionId, number>;
  byPublicationStatus: Record<string, number>;
  byContentStatus: Record<string, number>;
  publishedCount: number;
  edgeCount: number;
  pilotNodeCount: number;
  issues: CatalogIssue[];
  ok: boolean;
}

export function buildCatalogHealthReport(input: {
  tracks: InternalTrackMetadata[];
  registry: RegistrySummary;
  pilotGraph: PilotGraph;
}): CatalogHealthReport {
  const { tracks, registry, pilotGraph } = input;
  const issues: CatalogIssue[] = [];

  const ids = tracks.map((track) => track.trackId);
  const idSet = new Set(ids);

  if (tracks.length !== registry.totalTracks) {
    issues.push({
      level: 'error',
      code: 'total_mismatch',
      message: `В каталоге ${tracks.length} треков, реестр ожидает ${registry.totalTracks}.`,
    });
  }

  if (idSet.size !== ids.length) {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        issues.push({
          level: 'error',
          code: 'duplicate_track_id',
          message: `Track ID ${id} встречается больше одного раза.`,
          trackId: id,
        });
      }
      seen.add(id);
    }
  }

  for (const track of tracks) {
    if (!TRACK_ID_PATTERN.test(track.trackId)) {
      issues.push({
        level: 'error',
        code: 'invalid_track_id',
        message: `Track ID ${track.trackId} не соответствует формату A1-001.`,
        trackId: track.trackId,
      });
    }
    if (!track.trackId.startsWith(`${track.sectionId}-`)) {
      issues.push({
        level: 'error',
        code: 'section_prefix_mismatch',
        message: `Track ID ${track.trackId} не совпадает с разделом ${track.sectionId}.`,
        trackId: track.trackId,
      });
    }
    for (const nextId of track.nextTrackIds) {
      if (!idSet.has(nextId)) {
        issues.push({
          level: 'error',
          code: 'missing_next_track',
          message: `${track.trackId} ссылается на несуществующий ${nextId}.`,
          trackId: track.trackId,
        });
      }
    }
    if (track.nextTrackIds.includes(track.trackId)) {
      issues.push({
        level: 'warning',
        code: 'self_reference',
        message: `${track.trackId} ссылается сам на себя.`,
        trackId: track.trackId,
      });
    }
    if (new Set(track.nextTrackIds).size !== track.nextTrackIds.length) {
      issues.push({
        level: 'warning',
        code: 'duplicate_next_track',
        message: `${track.trackId} содержит повторяющиеся продолжения.`,
        trackId: track.trackId,
      });
    }
    if (track.nextTrackIds.length === 0) {
      issues.push({
        level: 'warning',
        code: 'dead_end',
        message: `${track.trackId} не имеет продолжений.`,
        trackId: track.trackId,
      });
    }
  }

  const bySection = countBy(tracks, (track) => track.sectionId) as Record<SectionId, number>;
  for (const sectionId of SECTION_IDS) {
    const actual = bySection[sectionId] ?? 0;
    const expected = registry.bySection[sectionId] ?? 0;
    if (actual !== expected) {
      issues.push({
        level: 'error',
        code: 'section_distribution_mismatch',
        message: `Раздел ${sectionId}: в каталоге ${actual}, в реестре ${expected}.`,
      });
    }
  }

  const byPriority = countBy(tracks, (track) => track.priority);
  for (const [priority, expected] of Object.entries(registry.byPriority)) {
    const actual = byPriority[priority] ?? 0;
    if (actual !== expected) {
      issues.push({
        level: 'error',
        code: 'priority_distribution_mismatch',
        message: `Внутренний приоритет ${priority}: в каталоге ${actual}, в реестре ${expected}.`,
      });
    }
  }

  const pilotIds = pilotGraph.nodes.map((node) => node.trackId);
  if (new Set(pilotIds).size !== pilotIds.length) {
    issues.push({
      level: 'error',
      code: 'pilot_duplicate_node',
      message: 'В пилотном графе есть повторяющиеся узлы.',
    });
  }
  if (pilotIds.length !== registry.uniquePilotTracks) {
    issues.push({
      level: 'error',
      code: 'pilot_node_count_mismatch',
      message: `В пилотном графе ${pilotIds.length} узлов, ожидается ${registry.uniquePilotTracks}.`,
    });
  }
  for (const node of pilotGraph.nodes) {
    if (!idSet.has(node.trackId)) {
      issues.push({
        level: 'error',
        code: 'pilot_node_not_in_catalog',
        message: `Узел пилотного графа ${node.trackId} отсутствует в каталоге.`,
        trackId: node.trackId,
      });
    }
  }

  const publishedCount = tracks.filter(
    (track) => track.publicationStatus === 'published',
  ).length;

  if (publishedCount === 0) {
    issues.push({
      level: 'info',
      code: 'no_published_tracks',
      message:
        'Опубликованных треков пока нет: в production каталог честно показывает состояние подготовки.',
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    totalTracks: tracks.length,
    bySection,
    byPublicationStatus: countBy(tracks, (track) => track.publicationStatus),
    byContentStatus: countBy(tracks, (track) => track.contentStatus),
    publishedCount,
    edgeCount: tracks.reduce((sum, track) => sum + track.nextTrackIds.length, 0),
    pilotNodeCount: pilotIds.length,
    issues,
    ok: issues.every((issue) => issue.level !== 'error'),
  };
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const bucket = key(item);
    result[bucket] = (result[bucket] ?? 0) + 1;
  }
  return result;
}
