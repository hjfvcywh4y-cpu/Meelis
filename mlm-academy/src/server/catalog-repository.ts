import 'server-only';

import type { CatalogRepository } from '@/domain/repositories';
import type { CatalogQuery } from '@/domain/search';
import type { PublicTrackMetadata, Section, SectionId } from '@/domain/types';

import {
  getPublicTrack,
  getSections,
  listPublicTracks,
  searchPublicTracks,
  type CatalogReadOptions,
} from './catalog';

/** Реализация CatalogRepository поверх server-only JSON-загрузчика. */
export function createServerCatalogRepository(options: CatalogReadOptions): CatalogRepository {
  return {
    async listSections(): Promise<Section[]> {
      return getSections();
    },
    async listTracks(query?: CatalogQuery): Promise<PublicTrackMetadata[]> {
      return query ? searchPublicTracks(options, query) : listPublicTracks(options);
    },
    async getTrack(trackId: string): Promise<PublicTrackMetadata | null> {
      return getPublicTrack(trackId, options);
    },
    async listSectionTracks(sectionId: SectionId): Promise<PublicTrackMetadata[]> {
      return searchPublicTracks(options, { sectionId });
    },
  };
}
