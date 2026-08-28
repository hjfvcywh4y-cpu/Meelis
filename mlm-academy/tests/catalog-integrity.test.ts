import { describe, expect, it } from 'vitest';

import { TRACK_ID_PATTERN } from '@/domain/track-id';
import { SECTION_IDS } from '@/domain/types';
import {
  getCatalogHealthReport,
  getInternalTracks,
  getPilotGraph,
  getRegistrySummary,
  getSections,
} from '@/server/catalog';

const tracks = getInternalTracks();
const registry = getRegistrySummary();

describe('целостность каталога', () => {
  it('загружает ровно 112 треков', () => {
    expect(tracks).toHaveLength(112);
    expect(tracks).toHaveLength(registry.totalTracks);
  });

  it('все Track ID уникальны', () => {
    const ids = tracks.map((track) => track.trackId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('каждый Track ID соответствует формату A1-001', () => {
    for (const track of tracks) {
      expect(TRACK_ID_PATTERN.test(track.trackId)).toBe(true);
      expect(track.trackId.startsWith(`${track.sectionId}-`)).toBe(true);
    }
  });

  it('распределение по разделам совпадает с реестром', () => {
    for (const sectionId of SECTION_IDS) {
      const actual = tracks.filter((track) => track.sectionId === sectionId).length;
      expect(actual).toBe(registry.bySection[sectionId]);
    }
  });

  it('внутренние приоритеты совпадают с реестром', () => {
    const byPriority = tracks.reduce<Record<string, number>>((acc, track) => {
      acc[track.priority] = (acc[track.priority] ?? 0) + 1;
      return acc;
    }, {});
    expect(byPriority).toMatchObject(registry.byPriority);
  });

  it('все nextTrackIds существуют в каталоге', () => {
    const ids = new Set(tracks.map((track) => track.trackId));
    const missing = tracks.flatMap((track) =>
      track.nextTrackIds.filter((next) => !ids.has(next)).map((next) => `${track.trackId}→${next}`),
    );
    expect(missing).toEqual([]);
  });

  it('в пилотном графе 16 уникальных узлов, и все есть в каталоге', () => {
    const pilot = getPilotGraph();
    const ids = pilot.nodes.map((node) => node.trackId);
    expect(ids).toHaveLength(16);
    expect(new Set(ids).size).toBe(16);

    const catalogIds = new Set(tracks.map((track) => track.trackId));
    for (const id of ids) expect(catalogIds.has(id)).toBe(true);
  });

  it('шесть разделов загружены и упорядочены', () => {
    const sections = getSections();
    expect(sections.map((section) => section.sectionId)).toEqual([...SECTION_IDS]);
  });

  it('валидатор каталога не находит ошибок', () => {
    const report = getCatalogHealthReport();
    const errors = report.issues.filter((issue) => issue.level === 'error');
    expect(errors).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
