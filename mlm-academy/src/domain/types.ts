/**
 * Доменные типы MLM Academy.
 *
 * Разделение InternalTrackMetadata / PublicTrackMetadata — жёсткая граница:
 * внутренние редакционные поля не должны покидать сервер.
 */

export const SECTION_IDS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type PublicationStatus =
  | 'planned'
  | 'draft'
  | 'review'
  | 'published'
  | 'archived'
  | 'unknown';

export type ContentStatus = 'metadata_only' | 'draft' | 'review' | 'published' | 'archived';

export type Visibility = 'hidden' | 'catalog' | 'direct_only';

export type AccessLevel = 'undecided' | 'free' | 'paid' | 'organization' | 'invite';

/** Внутреннее редакционное поле. Никогда не показывается пользователю. */
export type Priority = 'P0' | 'P1' | 'P2' | 'Review';

export type ProgressStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_external'
  | 'evidence_required'
  | 'completed'
  | 'abandoned';

export type ArtifactType =
  | 'text'
  | 'list'
  | 'message'
  | 'audio'
  | 'image'
  | 'link'
  | 'fact'
  | 'appointment'
  | 'reflection';

export type CompletionOutcomeCode = 'done' | 'question' | 'pause' | 'refusal' | 'not_done';

export type UserRole = 'guest' | 'member' | 'mentor' | 'editor' | 'admin';

export interface Section {
  order: number;
  sectionId: SectionId;
  shortTitle: string;
  title: string;
  entryQuestion: string;
  promise: string;
  routeLogic: string[];
  accentToken: string;
  iconName: string;
}

/** Внутренний источник материала. Server-only. */
export interface TrackSource {
  sourceCode: string | null;
  originalTitle: string | null;
  pages: string | number | null;
  adaptationDecision: string | null;
}

/** Полная запись реестра. Импортируется только на сервере. */
export interface InternalTrackMetadata {
  order: number;
  sectionId: SectionId;
  module: string;
  trackId: string;
  title: string;
  situation: string;
  outcome: string;
  priority: Priority;
  format: string;
  nextTrackIds: string[];
  legacyPublicUrl: string | null;
  pageStatusRaw: string | null;
  publicationStatus: PublicationStatus;
  visibility: Visibility;
  access: AccessLevel;
  contentStatus: ContentStatus;
  adaptationLevel: string | null;
  transformationType: string | null;
  internalNote: string | null;
  source: TrackSource;
}

/**
 * Единственная форма трека, которую разрешено отдавать в UI,
 * публичный API и клиентский bundle.
 */
export interface PublicTrackMetadata {
  trackId: string;
  sectionId: SectionId;
  module: string;
  title: string;
  situation: string;
  outcome: string;
  format: string;
  nextTrackIds: string[];
  publicationStatus: PublicationStatus;
  contentStatus: ContentStatus;
  visibility: Visibility;
  access: AccessLevel;
}

export interface PilotGraphNode {
  step: number;
  trackId: string;
  sectionId: SectionId;
  title: string;
  outcome: string;
  nextTrackIds: string[];
}

export interface PilotGraph {
  version: string;
  nodes: PilotGraphNode[];
}

export interface RecommendationRules {
  version: string;
  engine: string;
  principles: string[];
  entryRules: { answer: string; sectionId: SectionId }[];
  completionOutcomes: { code: CompletionOutcomeCode; label: string; behavior: string }[];
  ranking: string[];
  limits: {
    primaryNextActions: number;
    alternativeNextActions: number;
    recentlyCompletedCooldownDays: number;
  };
}

export interface RegistrySummary {
  totalTracks: number;
  bySection: Record<string, number>;
  byPriority: Record<string, number>;
  byModule: Record<string, number>;
  byTransformationType: Record<string, number>;
  pilotRows: number;
  uniquePilotTracks: number;
}

/** Рабочий профиль пользователя. Demo/local provider в текущей итерации. */
export interface UserProfile {
  selectedSectionId: SectionId | null;
  currentGoal: string;
  savedTrackIds: string[];
  role: UserRole;
  updatedAt: string;
}

export interface TrackProgress {
  trackId: string;
  status: ProgressStatus;
  contentVersion: string | null;
  startedAt: string | null;
  updatedAt: string;
  /** Заполнится, когда у трека появятся реальные шаги. */
  completedStepIds: string[];
  /** null означает «количество шагов неизвестно», а не «ноль шагов». */
  totalSteps: number | null;
}

export interface ResultArtifact {
  artifactId: string;
  trackId: string;
  type: ArtifactType;
  title: string;
  createdAt: string;
  summary: string | null;
}

export interface Entitlement {
  plan: 'none' | 'free' | 'paid' | 'organization' | 'invite';
  organizationId: string | null;
  validUntil: string | null;
}

export interface AccessDecision {
  allowed: boolean;
  reason: 'granted' | 'requires_purchase' | 'requires_invite' | 'requires_organization' | 'undecided';
}

/** Режим приложения. Управляется только серверными переменными окружения. */
export interface AppMode {
  preview: boolean;
  adminCatalog: boolean;
}
