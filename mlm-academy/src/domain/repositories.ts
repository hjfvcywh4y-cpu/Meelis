import type { CatalogQuery } from './search';
import type {
  AccessDecision,
  Entitlement,
  PublicTrackMetadata,
  ResultArtifact,
  Section,
  SectionId,
  TrackProgress,
  UserProfile,
} from './types';

/**
 * Контракты хранилищ. UI и доменная логика работают только через них.
 *
 * Сегодня: JSON server-only + Local Storage + mock entitlement.
 * Завтра: Supabase/PostgreSQL, Storage и RLS — без переписывания экранов.
 */

export interface CatalogRepository {
  listSections(): Promise<Section[]>;
  listTracks(query?: CatalogQuery): Promise<PublicTrackMetadata[]>;
  getTrack(trackId: string): Promise<PublicTrackMetadata | null>;
  listSectionTracks(sectionId: SectionId): Promise<PublicTrackMetadata[]>;
}

export interface ProfileRepository {
  get(): Promise<UserProfile>;
  update(patch: Partial<UserProfile>): Promise<UserProfile>;
  toggleSavedTrack(trackId: string): Promise<UserProfile>;
  reset(): Promise<UserProfile>;
}

export interface ProgressRepository {
  list(): Promise<TrackProgress[]>;
  get(trackId: string): Promise<TrackProgress | null>;
  /**
   * В текущей итерации прохождение нельзя «завершить просмотром»:
   * запись создаётся только вместе с реальными шагами трека.
   */
  markSeen(trackId: string): Promise<TrackProgress>;
  clear(): Promise<void>;
}

export interface ArtifactRepository {
  list(filter?: { trackId?: string; type?: ResultArtifact['type'] }): Promise<ResultArtifact[]>;
  get(artifactId: string): Promise<ResultArtifact | null>;
}

export interface EntitlementRepository {
  get(): Promise<Entitlement>;
  decide(track: Pick<PublicTrackMetadata, 'access'>): Promise<AccessDecision>;
}

export interface RepositoryBundle {
  profile: ProfileRepository;
  progress: ProgressRepository;
  artifacts: ArtifactRepository;
  entitlements: EntitlementRepository;
}
