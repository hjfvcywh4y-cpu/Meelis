import { decideRoute } from './route-engine';
import { stripUnsafeFacts } from './privacy';
import { sanitizeArchitectureEvent, type ArchitectureEvent } from './events';
import { newId, nowIso, type ArchitectureStore } from './store';
import { decideInstanceCreation } from './access';
import type { AccessContext, ArchitectureFlags, RouteContext, RouteDecision, RouteMode } from './types';

export class RuntimeRejectedError extends Error {
  constructor(
    message: string,
    readonly lockReason: 'SANDBOX_NO_LIVE_INSTANCE' | 'DATA_BLOCKED' | 'AUTH_REQUIRED' | 'ENTITLEMENT_REQUIRED',
  ) {
    super(message);
    this.name = 'RuntimeRejectedError';
  }
}

export function createTrackInstance(
  store: ArchitectureStore,
  input: {
    userId: string;
    trackId: string;
    contentVersion?: string | null;
    parentRouteId?: string | null;
    now?: string;
    access?: AccessContext;
  },
) {
  const track = store.getTrack(input.trackId);
  if (!track) throw new Error('unknown_track');
  const content = store.getContent(input.trackId);
  const access = input.access || {
    userId: input.userId,
    role: 'FULL' as const,
    userRight: 'FULL' as const,
    verified: true,
    entitlements: [],
  };
  const allowed = decideInstanceCreation({ track, content: content || null, access });
  if (!allowed.allowed) {
    throw new RuntimeRejectedError(allowed.lockReason, allowed.lockReason);
  }
  const instance = {
    instanceId: newId('ti'),
    userId: input.userId,
    trackId: input.trackId,
    contentVersion: input.contentVersion || null,
    instanceStatus: 'active' as const,
    parentRouteId: input.parentRouteId || null,
    startedAt: nowIso(input.now),
    completedAt: null,
    waitUntil: null,
  };
  store.upsertInstance(instance);
  return instance;
}

export function submitOutcome(
  store: ArchitectureStore,
  input: {
    userId: string;
    instanceId: string;
    clientEventId: string;
    outcomeCode: string;
    facts?: Record<string, unknown>;
    occurredAt?: string;
    access: AccessContext;
    flags: ArchitectureFlags;
    mode: RouteMode;
    now?: string;
  },
): { duplicate: boolean; outcomeId: string; decision: RouteDecision; events: ArchitectureEvent[] } {
  const existing = store.findOutcomeByClientEvent(input.userId, input.clientEventId);
  if (existing) {
    const previous = store.listDecisions(input.userId).find((row) => row.outcomeEventId === existing.outcomeEventId);
    const decision: RouteDecision = previous
      ? {
          matchedRuleId: previous.matchedRuleId,
          destinationType: previous.destinationType,
          destinationId: previous.destinationId,
          destinationUrl: null,
          reasonCode: previous.reasonCode,
          reasonText: previous.reasonText,
          locked: previous.locked,
          lockReason: previous.lockReason,
          ruleSnapshot: previous.ruleSnapshot,
        }
      : {
          matchedRuleId: null,
          destinationType: 'DONE',
          destinationId: null,
          destinationUrl: null,
          reasonCode: 'NEEDS_REVIEW',
          locked: true,
          lockReason: 'FEATURE_DISABLED',
        };
    return { duplicate: true, outcomeId: existing.outcomeEventId, decision, events: [] };
  }

  const instance = store.getInstance(input.instanceId);
  if (!instance || instance.userId !== input.userId) {
    throw new Error('instance_not_found');
  }

  const track = store.getTrack(instance.trackId);
  const content = store.getContent(instance.trackId);
  if (track) {
    const live = decideInstanceCreation({ track, content: content || null, access: input.access });
    if (!live.allowed) {
      const decision: RouteDecision = {
        matchedRuleId: null,
        destinationType: 'DONE',
        destinationId: null,
        destinationUrl: null,
        reasonCode: 'ACCESS_LOCKED',
        locked: true,
        lockReason: live.lockReason,
      };
      return { duplicate: false, outcomeId: '', decision, events: [] };
    }
  }

  const safeFacts = stripUnsafeFacts(input.facts || {});
  const outcome = {
    outcomeEventId: newId('out'),
    clientEventId: input.clientEventId,
    instanceId: input.instanceId,
    userId: input.userId,
    trackId: instance.trackId,
    outcomeCode: String(input.outcomeCode).toUpperCase(),
    safeFacts,
    occurredAt: input.occurredAt || nowIso(input.now),
  };
  store.insertOutcome(outcome);

  const context: RouteContext = {
    fromId: instance.trackId,
    outcomeCode: outcome.outcomeCode,
    facts: safeFacts,
    userAccess: input.access,
    now: nowIso(input.now),
    mode: input.mode,
    flags: input.flags,
  };
  const decision = decideRoute(store, context);
  store.insertDecision({
    decisionId: newId('rd'),
    outcomeEventId: outcome.outcomeEventId,
    userId: input.userId,
    fromTrackId: instance.trackId,
    matchedRuleId: decision.matchedRuleId,
    ruleSnapshot: decision.ruleSnapshot || null,
    destinationType: decision.destinationType,
    destinationId: decision.destinationId,
    reasonCode: decision.reasonCode,
    reasonText: decision.reasonText,
    locked: decision.locked,
    lockReason: decision.lockReason,
    createdAt: nowIso(input.now),
  });

  if (decision.destinationType === 'WAIT_UNTIL') {
    store.upsertInstance({ ...instance, instanceStatus: 'waiting', waitUntil: nowIso(input.now) });
  }
  if (decision.destinationType === 'DONE') {
    store.upsertInstance({ ...instance, instanceStatus: 'completed', completedAt: nowIso(input.now) });
  }

  const events: ArchitectureEvent[] = [
    sanitizeArchitectureEvent('outcome_submitted', {
      track_id: instance.trackId,
      outcome_code: outcome.outcomeCode,
    }),
    sanitizeArchitectureEvent(decision.reasonCode === 'CONFLICT' ? 'route_conflict_detected' : 'route_decided', {
      track_id: instance.trackId,
      matched_rule_id: decision.matchedRuleId,
      destination_type: decision.destinationType,
      locked: decision.locked,
      reason_code: decision.reasonCode,
    }),
  ];
  if (decision.destinationType === 'WAIT_UNTIL') {
    events.push(sanitizeArchitectureEvent('wait_scheduled', { track_id: instance.trackId }));
  }
  if (decision.destinationType === 'DONE') {
    events.push(sanitizeArchitectureEvent('route_done', { track_id: instance.trackId }));
  }

  return { duplicate: false, outcomeId: outcome.outcomeEventId, decision, events };
}
