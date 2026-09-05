import { describe, expect, it } from 'vitest';

import { getPublicTrack, getInternalTracks, listPublicTracks } from '@/server/catalog';

const anyTrackId = getInternalTracks()[0]!.trackId;

describe('режимы production и preview', () => {
  it('preview показывает все 112 карточек', () => {
    expect(listPublicTracks({ preview: true })).toHaveLength(112);
  });

  it('production показывает только опубликованные треки', () => {
    const production = listPublicTracks({ preview: false });
    expect(production.every((track) => track.publicationStatus === 'published')).toBe(true);
  });

  it('production не отдаёт planned-трек по прямой ссылке', () => {
    const track = getInternalTracks().find((item) => item.publicationStatus !== 'published');
    expect(track).toBeDefined();
    expect(getPublicTrack(track!.trackId, { preview: false })).toBeNull();
    expect(getPublicTrack(track!.trackId, { preview: true })).not.toBeNull();
  });

  it('неизвестный Track ID не возвращает данные ни в одном режиме', () => {
    expect(getPublicTrack('A9-999', { preview: true })).toBeNull();
    expect(getPublicTrack('A9-999', { preview: false })).toBeNull();
  });

  it('в preview прямой доступ по ID работает', () => {
    expect(getPublicTrack(anyTrackId, { preview: true })?.trackId).toBe(anyTrackId);
  });
});
