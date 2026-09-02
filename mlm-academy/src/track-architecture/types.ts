/**
 * Маршрутная архитектура v2. Слои не смешиваются: registry / content / routing / runtime / access.
 */

export const ENTITY_TYPES = [
  'TRACK',
  'CONDITIONAL_TRACK',
  'REMEDIATION',
  'GATE',
  'EMBEDDED_TOOL',
  'SYSTEM_ACTION',
  'ALIAS',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const LESSON_ENTITY_TYPES: readonly EntityType[] = ['TRACK', 'CONDITIONAL_TRACK', 'REMEDIATION'];

export const DESTINATION_TYPES = [
  'TRACK',
  'SYSTEM_ACTION',
  'FIELD_ACTION',
  'WAIT_UNTIL',
  'DONE',
  'EXPERT',
  'PROCESS_OWNER',
  'RETURN_TO_ROUTE',
] as const;
export type DestinationType = (typeof DESTINATION_TYPES)[number];

export const RULE_STATUSES = ['PILOT_DRAFT_TO_TEST', 'VALIDATED_RULE', 'DISABLED', 'ARCHIVED'] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const PUBLICATION_STATUSES = ['PLANNED', 'DRAFT', 'REVIEW', 'PUBLISHED', 'PAUSED', 'ARCHIVED'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const CONTENT_STATUSES = ['EMPTY', 'DRAFT', 'REVIEW', 'READY', 'PUBLISHED', 'ARCHIVED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const ACCESS_TIERS = ['PUBLIC_METADATA', 'PUBLIC_DEMO', 'PAID', 'ADMIN_ONLY'] as const;
export type AccessTier = (typeof ACCESS_TIERS)[number];

export const ROUTE_STATUSES = ['LOCKED', 'TEST', 'ACTIVE', 'RETIRED'] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export const EXECUTION_MODES = ['PREVIEW', 'SANDBOX', 'LIVE'] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const USER_RIGHTS = ['NONE', 'TRIAL', 'FULL', 'ADMIN'] as const;
export type UserRight = (typeof USER_RIGHTS)[number];

export const ACTIVATION_MODES = ['LOCKED_NEXT_ACTION_SLOT', 'ROUTE_RULE'] as const;
export type ActivationMode = (typeof ACTIVATION_MODES)[number];

export const OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'IN', 'NOT_IN', 'EXISTS'] as const;
export type OperatorCode = (typeof OPERATORS)[number];

export type RouteMode = 'production' | 'pilot' | 'admin-preview' | 'beta';

export type AccessRole = 'ANON' | 'FREE' | 'START' | 'FULL' | 'PILOT' | 'ADMIN';

export type LockReason =
  | 'AUTH_REQUIRED'
  | 'ENTITLEMENT_REQUIRED'
  | 'FEATURE_DISABLED'
  | 'CONTENT_UNAVAILABLE'
  | 'ENTITY_NOT_LESSON'
  | 'ALIAS_LOOP'
  | 'CANONICAL_MISSING'
  | 'DATA_BLOCKED'
  | 'SANDBOX_NO_LIVE_INSTANCE';

export type ReasonCode =
  | 'MATCHED'
  | 'NO_MATCHING_RULE'
  | 'NO_SUCH_TRACK'
  | 'CONFLICT'
  | 'RULE_NOT_RUNNABLE'
  | 'ENGINE_DISABLED'
  | 'REGISTRY_DISABLED'
  | 'NEEDS_REVIEW'
  | 'ACCESS_LOCKED';

export interface ArchitectureFlags {
  TRACK_REGISTRY_ENABLED: boolean;
  ROUTE_ENGINE_ENABLED: boolean;
  PAID_TRACK_NAVIGATION_ENABLED: boolean;
  PAYMENTS_ENABLED: boolean;
  ALLOW_DRAFT_RULES: boolean;
  ADMIN_PREVIEW_ENABLED: boolean;
  ENTITLEMENT_BYPASS: boolean;
  REGISTERED_BETA_ACCESS_ENABLED: boolean;
  BETA_COHORT_CUTOFF_ISO?: string;
}

export interface TrackDefinition {
  id: string;
  canonicalId: string;
  entityType: EntityType;
  publishSurface: string;
  section: string;
  domain: string;
  title: string;
  situation: string;
  result: string;
  audience: string;
  implementationStatus: string;
  publicationStatus: PublicationStatus;
  catalogVisible: boolean;
  source: Record<string, unknown>;
  registryVersion: string;
  contentStatus: ContentStatus;
  accessTier: AccessTier;
  routeStatus: RouteStatus;
  executionMode: ExecutionMode;
  dataQuality: 'OK' | 'CANONICAL_MISSING' | 'DATA_BLOCKED';
}

export interface PublicTrackMeta {
  id: string;
  title: string;
  situation: string;
  result: string;
  section: string;
  domain: string;
  catalogVisibility: boolean;
  availabilityLabel: string;
  entityType: EntityType;
}

export interface RouteRuleRecord {
  ruleId: string;
  fromTrackId: string;
  outcomeCode: string;
  fieldPath: string;
  operatorCode: OperatorCode;
  expectedValue: unknown;
  destinationType: DestinationType;
  destinationId: string | null;
  reasonText: string;
  stopRule: string;
  recovery: { type: DestinationType; id?: string } | null;
  priority: number;
  ownerLabel: string;
  ruleVersion: string;
  ruleStatus: RuleStatus;
  sourceChecksum: string;
}

export interface EntryRuleRecord {
  entryRuleId: string;
  sourceType: string;
  signalCode: string;
  guard: unknown;
  destinationId: string;
  ruleStatus: string;
  version: string;
}

export interface ContentVersionRecord {
  id: string;
  trackId: string;
  contentVersion: string;
  contentStatus: ContentStatus | PublicationStatus;
  contentFormat: string;
  privateContentRef: string | null;
  checksum: string;
  accessTier?: AccessTier;
  executionMode?: ExecutionMode;
  productPolicy: Record<string, unknown>;
  createdAt: string;
  publishedAt: string | null;
  body?: unknown;
}

export interface ProductRecord {
  productCode: string;
  title: string;
  productStatus: string;
  grants: {
    trackIds?: string[];
    allPublishedTracks?: boolean;
  };
}

export interface EntitlementRecord {
  entitlementId: string;
  userId: string;
  productCode: string;
  entitlementStatus: 'active' | 'revoked' | 'expired';
  startsAt: string;
  endsAt: string | null;
  sourcePaymentEventId: string | null;
  version: number;
}

export interface TrackInstanceRecord {
  instanceId: string;
  userId: string;
  trackId: string;
  contentVersion: string | null;
  instanceStatus: 'active' | 'waiting' | 'completed' | 'abandoned';
  parentRouteId: string | null;
  startedAt: string;
  completedAt: string | null;
  waitUntil: string | null;
  lastStepId?: string | null;
  lastStepLabel?: string | null;
  lastMentorEvent?: string | null;
  pendingSystemActionId?: string | null;
  lastDecisionTrackId?: string | null;
}

export interface TrackOutcomeRecord {
  outcomeEventId: string;
  clientEventId: string;
  instanceId: string;
  userId: string;
  trackId: string;
  outcomeCode: string;
  safeFacts: Record<string, unknown>;
  occurredAt: string;
}

export interface RouteDecisionRecord {
  decisionId: string;
  outcomeEventId: string;
  userId: string;
  fromTrackId: string;
  matchedRuleId: string | null;
  ruleSnapshot: RouteRuleRecord | null;
  destinationType: DestinationType;
  destinationId: string | null;
  reasonCode: ReasonCode;
  reasonText?: string;
  locked: boolean;
  lockReason?: LockReason;
  createdAt: string;
}

export interface ImportRunRecord {
  importRunId: string;
  importType: string;
  sourceFilename: string;
  sourceChecksum: string;
  dryRun: boolean;
  importStatus: 'ok' | 'rejected' | 'conflict';
  diff: Record<string, unknown>;
  initiatedByUserId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ArchiveEdgeRecord {
  edgeId: string;
  fromId: string;
  toId: string;
  active: boolean;
  statusV2: string;
  source: string;
}

export interface EntitlementGrant {
  productCode: string;
  status: 'active' | 'revoked' | 'expired';
  startsAt: string;
  endsAt: string | null;
  grantsTrackIds?: string[];
  grantsAll?: boolean;
}

export interface AccessContext {
  userId: string | null;
  role: AccessRole;
  userRight: UserRight;
  /** Payment / entitlement identity. Never granted by Tilda bind. */
  verified: boolean;
  /** HMAC server session for a registered Members account. */
  registered: boolean;
  /** KV account.createdAt for beta cohort gating. */
  accountCreatedAt?: string | null;
  entitlements: EntitlementGrant[];
}

export interface TrackConnectionRecord {
  connectionId: string;
  fromId: string;
  toId: string;
  fromCanonicalId: string;
  toCanonicalId: string;
  rank: number;
  relationType: string;
  relationLabel: string;
  conditionHint: string;
  reason: string;
  userLabel: string;
  activationMode: ActivationMode;
  executable: boolean;
  userVisible: boolean;
  matchedRouteRuleIds: string[];
  sourceLayer: string;
  runtimeStatus: string;
}

export interface ConnectionIndexEntry {
  id: string;
  canonicalId: string;
  entityType: EntityType;
  publishSurface: string;
  domain: string;
  implementationStatus: string;
  incomingDesignConnections: unknown[];
  outgoingDesignConnections: unknown[];
  incomingEffectiveConnections: unknown[];
  outgoingEffectiveConnections: unknown[];
  outgoingRouteRuleIds: string[];
  incomingRouteRuleIds: string[];
  externalEntryRuleIds: string[];
  placementStatus: string;
  installBehavior: Record<string, unknown>;
}

export interface RouteContext {
  fromId: string;
  outcomeCode: string;
  facts: Record<string, unknown>;
  userAccess: AccessContext;
  now: string;
  mode: RouteMode;
  flags: ArchitectureFlags;
}

export interface RouteDecision {
  matchedRuleId: string | null;
  destinationType: DestinationType;
  destinationId: string | null;
  destinationUrl: string | null;
  reasonCode: ReasonCode;
  reasonText?: string;
  recovery?: { type: DestinationType; id?: string } | null;
  locked: boolean;
  lockReason?: LockReason;
  preparingDestination?: boolean;
  betaPilot?: boolean;
  ruleSnapshot?: RouteRuleRecord | null;
}

export interface ResolveResult {
  inputId: string;
  canonicalId: string | null;
  definition: TrackDefinition | null;
  redirect: boolean;
  error?: LockReason;
  chain: string[];
}
