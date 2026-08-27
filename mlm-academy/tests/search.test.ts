import { describe, expect, it } from 'vitest';

import { filterTracks, groupBySection, normalizeSearchText } from '@/domain/search';
import { listPublicTracks } from '@/server/catalog';

const tracks = listPublicTracks({ preview: true });

describe('поиск по каталогу', () => {
  it('нормализует регистр, ё и пунктуацию', () => {
    expect(normalizeSearchText('Тёплому Контакту!')).toBe('теплому контакту');
    expect(normalizeSearchText('  A3-002  ')).toBe('a3 002');
  });

  it('находит трек по словам из названия', () => {
    const found = filterTracks(tracks, { query: 'первое сообщение' });
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((track) => track.trackId === 'A3-002')).toBe(true);
  });

  it('находит трек по ситуации, а не только по названию', () => {
    const found = filterTracks(tracks, { query: 'навязываюсь' });
    expect(found.map((track) => track.trackId)).toContain('A1-001');
  });

  it('учитывает все слова запроса', () => {
    const found = filterTracks(tracks, { query: 'сообщение несуществующееслово' });
    expect(found).toEqual([]);
  });

  it('фильтрует по разделу', () => {
    const found = filterTracks(tracks, { sectionId: 'A5' });
    expect(found).toHaveLength(14);
    expect(found.every((track) => track.sectionId === 'A5')).toBe(true);
  });

  it('фильтрует по доступности', () => {
    expect(filterTracks(tracks, { availability: 'available' })).toEqual([]);
    expect(filterTracks(tracks, { availability: 'preparing' })).toHaveLength(112);
  });

  it('группирует по разделам без потери треков', () => {
    const grouped = groupBySection(tracks);
    const total = [...grouped.values()].reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(tracks.length);
    expect(grouped.size).toBe(6);
  });
});
