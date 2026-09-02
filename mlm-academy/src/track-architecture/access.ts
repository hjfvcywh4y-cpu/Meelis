import { installedPackageOpenForBeta, isRegisteredBeta } from './beta';
import type {
  AccessContext,
  AccessTier,
  ArchitectureFlags,
  ContentStatus,
  ContentVersionRecord,
  ExecutionMode,
  PublicationStatus,
  TrackDefinition,
} from './types';
import { canPublishAsStandaloneLesson } from './resolver';

function entitlementCoversTrack(access: AccessContext, trackId: string, now: string): boolean {
  const ts = Date.parse(now) || Date.now();
  for (const grant of access.entitlements || []) {
    if (grant.status !== 'active') continue;
    if (grant.endsAt && Date.parse(grant.endsAt) <= ts) continue;
    if (grant.startsAt && Date.parse(grant.startsAt) > ts) continue;
    if (grant.grantsAll) return true;
    if ((grant.grantsTrackIds || []).includes(trackId)) return true;
  }
  return false;
}

export type ContentAccessKind = 'METADATA' | 'DEMO' | 'PAID';

export type ContentAccessDecision =
  | { allowed: true; kind: 'PAID' | 'DEMO' }
  | {
      allowed: false;
      lockReason:
        | 'AUTH_REQUIRED'
        | 'ENTITLEMENT_REQUIRED'
        | 'FEATURE_DISABLED'
        | 'CONTENT_UNAVAILABLE'
        | 'ENTITY_NOT_LESSON'
        | 'DATA_BLOCKED'
        | 'SANDBOX_NO_LIVE_INSTANCE';
      kind?: ContentAccessKind;
    };

const UNPUBLISHED = new Set<string>(['EMPTY', 'DRAFT', 'REVIEW', 'READY', 'PLANNED', 'PAUSED', 'ARCHIVED']);

export function isPublishedContentStatus(status: ContentStatus | PublicationStatus | string | undefined): boolean {
  return status === 'PUBLISHED';
}

export function accessTierFromPolicy(policy: string): AccessTier {
  if (policy === 'FREE_CONTENT') return 'PUBLIC_DEMO';
  if (policy === 'ENTITLED') return 'PAID';
  if (policy === 'ADMIN_PREVIEW' || policy === 'UNAVAILABLE') return 'ADMIN_ONLY';
  return 'PUBLIC_METADATA';
}

export function executionModeForContent(tier: AccessTier, status: string): ExecutionMode {
  if (!isPublishedContentStatus(status)) return 'PREVIEW';
  if (tier === 'PUBLIC_DEMO') return 'SANDBOX';
  if (tier === 'PAID') return 'LIVE';
  return 'PREVIEW';
}

export function effectiveAccessTier(track: TrackDefinition, content: ContentVersionRecord | null): AccessTier {
  return content?.accessTier || track.accessTier || 'PUBLIC_METADATA';
}

export function effectiveExecutionMode(track: TrackDefinition, content: ContentVersionRecord | null): ExecutionMode {
  return content?.executionMode || track.executionMode || 'PREVIEW';
}

/**
 * Право = AND всех условий. Query/localStorage/success page / AI recommendation сюда не входят.
 * Оплата не открывает DRAFT/REVIEW/READY.
 */
export function decideContentAccess(input: {
  track: TrackDefinition;
  content: ContentVersionRecord | null;
  access: AccessContext;
  flags: ArchitectureFlags;
  now?: string;
  productGrantsTrack?: boolean;
}): ContentAccessDecision {
  const { track, content, access, flags } = input;
  if (!canPublishAsStandaloneLesson(track.entityType)) {
    return { allowed: false, lockReason: 'ENTITY_NOT_LESSON' };
  }
  if (track.dataQuality === 'DATA_BLOCKED' || track.dataQuality === 'CANONICAL_MISSING') {
    return { allowed: false, lockReason: 'DATA_BLOCKED', kind: 'METADATA' };
  }

  const tier = effectiveAccessTier(track, content);
  const executionMode = effectiveExecutionMode(track, content);

  if (tier === 'PUBLIC_METADATA' || !content) {
    return { allowed: false, lockReason: 'CONTENT_UNAVAILABLE', kind: 'METADATA' };
  }

  if (tier === 'PUBLIC_DEMO') {
    if (!isPublishedContentStatus(content.contentStatus) || !content.privateContentRef) {
      return { allowed: false, lockReason: 'CONTENT_UNAVAILABLE', kind: 'METADATA' };
    }
    if (executionMode !== 'SANDBOX') {
      return { allowed: false, lockReason: 'CONTENT_UNAVAILABLE', kind: 'METADATA' };
    }
    return { allowed: true, kind: 'DEMO' };
  }

  if (isRegisteredBeta(access, flags) && installedPackageOpenForBeta(content) && executionMode !== 'SANDBOX') {
    return { allowed: true, kind: 'PAID' };
  }

  if (!isPublishedContentStatus(content.contentStatus) || !content.privateContentRef) {
    return { allowed: false, lockReason: 'CONTENT_UNAVAILABLE', kind: 'PAID' };
  }
  if (UNPUBLISHED.has(String(content.contentStatus))) {
    return { allowed: false, lockReason: 'CONTENT_UNAVAILABLE', kind: 'PAID' };
  }
  if (access.role === 'ADMIN' && flags.ADMIN_PREVIEW_ENABLED && access.verified) {
    return { allowed: true, kind: 'PAID' };
  }
  if (flags.ENTITLEMENT_BYPASS) {
    return { allowed: false, lockReason: 'FEATURE_DISABLED', kind: 'PAID' };
  }
  if (!access.userId || !access.verified) {
    return { allowed: false, lockReason: access.userId ? 'ENTITLEMENT_REQUIRED' : 'AUTH_REQUIRED', kind: 'PAID' };
  }
  const covers =
    input.productGrantsTrack === true || entitlementCoversTrack(access, track.id, input.now || new Date().toISOString());
  if (!covers) {
    return { allowed: false, lockReason: 'ENTITLEMENT_REQUIRED', kind: 'PAID' };
  }
  return { allowed: true, kind: 'PAID' };
}

export function decideInstanceCreation(input: {
  track: TrackDefinition;
  content: ContentVersionRecord | null;
  access: AccessContext;
  flags?: ArchitectureFlags;
}): { allowed: true } | { allowed: false; lockReason: 'AUTH_REQUIRED' | 'ENTITLEMENT_REQUIRED' | 'DATA_BLOCKED' | 'SANDBOX_NO_LIVE_INSTANCE' } {
  const { track, content, access } = input;
  const flags = input.flags;
  if (flags && isRegisteredBeta(access, flags) && installedPackageOpenForBeta(content)) {
    const tier = effectiveAccessTier(track, content);
    const executionMode = effectiveExecutionMode(track, content);
    if (tier === 'PUBLIC_DEMO' || executionMode === 'SANDBOX') {
      return { allowed: false, lockReason: 'SANDBOX_NO_LIVE_INSTANCE' };
    }
    return { allowed: true };
  }
  if (!access.userId || !access.verified) {
    return { allowed: false, lockReason: access.userId ? 'ENTITLEMENT_REQUIRED' : 'AUTH_REQUIRED' };
  }
  if (track.dataQuality === 'DATA_BLOCKED' || track.dataQuality === 'CANONICAL_MISSING') {
    return { allowed: false, lockReason: 'DATA_BLOCKED' };
  }
  const tier = effectiveAccessTier(track, content);
  const executionMode = effectiveExecutionMode(track, content);
  if (tier === 'PUBLIC_DEMO' || executionMode === 'SANDBOX') {
    return { allowed: false, lockReason: 'SANDBOX_NO_LIVE_INSTANCE' };
  }
  return { allowed: true };
}

export function canUsePaidNavigation(access: AccessContext, flags: ArchitectureFlags): boolean {
  if (!flags.PAID_TRACK_NAVIGATION_ENABLED) return false;
  if (!flags.ROUTE_ENGINE_ENABLED) return false;
  if (access.role === 'ADMIN' && flags.ADMIN_PREVIEW_ENABLED && access.verified) return true;
  if (!access.verified || !access.userId) return false;
  return (access.entitlements || []).some((item) => item.status === 'active');
}

export function canUseBetaNavigation(access: AccessContext, flags: ArchitectureFlags): boolean {
  return isRegisteredBeta(access, flags) && flags.ROUTE_ENGINE_ENABLED === true;
}
