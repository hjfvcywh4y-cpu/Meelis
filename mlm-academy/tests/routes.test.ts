import { describe, expect, it } from 'vitest';

import {
  isCanonicalParam,
  normalizeSectionId,
  normalizeTrackId,
  routeForSection,
  routeForTrack,
  routes,
} from '@/domain/routes';
import { getInternalTracks } from '@/server/catalog';

describe('маршруты', () => {
  it('канонический URL трека — lowercase, ID внутри системы — uppercase', () => {
    expect(routeForTrack('A1-004')).toBe('/track/a1-004');
    expect(normalizeTrackId('a1-004')).toBe('A1-004');
    expect(normalizeTrackId('A1-004')).toBe('A1-004');
  });

  it('отбрасывает неверные Track ID', () => {
    for (const value of ['a9-999x', 'A7-001', 'a1-04', '', '../../etc/passwd', 'A1_004']) {
      expect(normalizeTrackId(value)).toBeNull();
    }
  });

  it('нормализует раздел', () => {
    expect(normalizeSectionId('a3')).toBe('A3');
    expect(normalizeSectionId('A3')).toBe('A3');
    expect(normalizeSectionId('a7')).toBeNull();
    expect(routeForSection('A3')).toBe('/library/a3');
  });

  it('определяет неканонический параметр для редиректа', () => {
    expect(isCanonicalParam('a1-004')).toBe(true);
    expect(isCanonicalParam('A1-004')).toBe(false);
  });

  it('все ссылки строятся относительными путями без домена', () => {
    const values = [
      routes.home(),
      routes.start(),
      routes.library(),
      routes.section('A2'),
      routes.track('A2-001'),
      routes.my(),
      routes.myRoute(),
      routes.myResults(),
      routes.profile(),
      routes.access(),
      routes.adminCatalog(),
    ];
    for (const value of values) {
      expect(value.startsWith('/')).toBe(true);
      expect(value).not.toContain('http');
      expect(value).not.toContain('mlmacademy.ru');
    }
  });

  it('каждый Track ID каталога даёт валидный маршрут', () => {
    for (const track of getInternalTracks()) {
      const href = routeForTrack(track.trackId);
      expect(href).toBe(`/track/${track.trackId.toLowerCase()}`);
      expect(normalizeTrackId(href.replace('/track/', ''))).toBe(track.trackId);
    }
  });
});
