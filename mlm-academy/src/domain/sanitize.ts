import type { InternalTrackMetadata, PublicTrackMetadata } from './types';

/**
 * Единственный разрешённый переход из внутреннего реестра в публичный слой.
 *
 * Объект собирается заново по белому списку полей, а не копированием с удалением:
 * новое внутреннее поле в реестре не может «просочиться» само собой.
 */
export function toPublicTrackMetadata(track: InternalTrackMetadata): PublicTrackMetadata {
  return {
    trackId: track.trackId,
    sectionId: track.sectionId,
    module: track.module,
    title: track.title,
    situation: track.situation,
    outcome: track.outcome,
    format: track.format,
    nextTrackIds: [...track.nextTrackIds],
    publicationStatus: track.publicationStatus,
    contentStatus: track.contentStatus,
    visibility: track.visibility,
    access: track.access,
  };
}

export function toPublicTrackList(tracks: InternalTrackMetadata[]): PublicTrackMetadata[] {
  return tracks.map(toPublicTrackMetadata);
}
