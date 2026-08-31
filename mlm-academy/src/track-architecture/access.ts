import type { AccessContext, ArchitectureFlags, ContentVersionRecord, TrackDefinition } from './types';
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

export type ContentAccessDecision =
  | { allowed: true }
  | { allowed: false; lockReason: 'AUTH_REQUIRED' | 'ENTITLEMENT_REQUIRED' | 'FEATURE_DISABLED' | 'CONTENT_UNAVAILABLE' | 'ENTITY_NOT_LESSON' };

/**
 * Право = AND всех условий. Query/localStorage/success page сюда не входят.
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
  if (!content || content.contentStatus !== 'PUBLISHED' || !content.privateContentRef) {
    return { allowed: false, lockReason: 'CONTENT_UNAVAILABLE' };
  }
  if (access.role === 'ADMIN' && flags.ADMIN_PREVIEW_ENABLED && access.verified) {
    return { allowed: true };
  }
  if (flags.ENTITLEMENT_BYPASS) {
    return { allowed: false, lockReason: 'FEATURE_DISABLED' };
  }
  if (!access.userId || !access.verified) {
    return { allowed: false, lockReason: access.userId ? 'ENTITLEMENT_REQUIRED' : 'AUTH_REQUIRED' };
  }
  const covers =
    input.productGrantsTrack === true || entitlementCoversTrack(access, track.id, input.now || new Date().toISOString());
  if (!covers) {
    return { allowed: false, lockReason: 'ENTITLEMENT_REQUIRED' };
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
