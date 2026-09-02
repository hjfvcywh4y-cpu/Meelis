import { decideRoute } from './route-engine';
import { stripUnsafeFacts } from './privacy';
import { sanitizeArchitectureEvent, type ArchitectureEvent } from './events';
import { newId, nowIso, type ArchitectureStore } from './store';
import { decideInstanceCreation } from './access';
import { isMentorEvent } from './cabinet';
import { validateA3008RecorderRequest } from './tracks/a3-008';
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
    flags?: ArchitectureFlags;
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
    registered: true,
    entitlements: [],
  };
  const allowed = decideInstanceCreation({ track, content: content || null, access, flags: input.flags });
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
    const live = decideInstanceCreation({
      track,
      content: content || null,
      access: input.access,
      flags: input.flags,
    });
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
    store.upsertInstance({
      ...instance,
      instanceStatus: 'waiting',
      waitUntil: nowIso(input.now),
      lastMentorEvent: 'wait_until',
    });
  }
  if (decision.destinationType === 'DONE') {
    store.upsertInstance({
      ...instance,
      instanceStatus: 'completed',
      completedAt: nowIso(input.now),
      lastMentorEvent: 'done',
    });
  } else if (decision.destinationType === 'SYSTEM_ACTION' && decision.destinationId) {
    store.upsertInstance({
      ...instance,
      lastMentorEvent: 'result_recorded',
      lastStepId: typeof safeFacts.step_id === 'string' ? safeFacts.step_id : instance.lastStepId,
      pendingSystemActionId: decision.destinationId,
    });
  } else if (decision.destinationType !== 'WAIT_UNTIL') {
    const mentor = isMentorEvent(safeFacts.mentor_event) ? String(safeFacts.mentor_event) : 'result_recorded';
    store.upsertInstance({
      ...instance,
      lastMentorEvent: mentor,
      lastStepId: typeof safeFacts.step_id === 'string' ? safeFacts.step_id : instance.lastStepId,
    });
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

export function submitSystemActionOutcome(
  store: ArchitectureStore,
  input: {
    userId: string;
    sourceInstanceId: string;
    body: Record<string, unknown>;
    access: AccessContext;
    flags: ArchitectureFlags;
    mode: RouteMode;
    now?: string;
  },
): { duplicate: boolean; outcomeId: string; decision: RouteDecision; events: ArchitectureEvent[]; error?: string; status?: number } {
  const validated = validateA3008RecorderRequest(input.body);
  if (!validated.ok) {
    return {
      duplicate: false,
      outcomeId: '',
      decision: {
        matchedRuleId: null,
        destinationType: 'DONE',
        destinationId: null,
        destinationUrl: null,
        reasonCode: 'ACCESS_LOCKED',
        locked: true,
        lockReason: 'FEATURE_DISABLED',
      },
      events: [],
      error: validated.error,
      status: validated.status,
    };
  }

  const idempotencyKey = String(input.body.idempotencyKey || '');
  const scopedClientEventId = `sa:${input.sourceInstanceId}:${idempotencyKey}`;
  const existing = store.findOutcomeByClientEvent(input.userId, scopedClientEventId);
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
          preparingDestination: previous.locked,
          betaPilot: true,
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

  const instance = store.getInstance(input.sourceInstanceId);
  if (!instance || instance.userId !== input.userId) {
    throw new Error('instance_not_found');
  }
  if (String(input.body.sourceInstanceId || '') !== instance.instanceId) {
    return {
      duplicate: false,
      outcomeId: '',
      decision: {
        matchedRuleId: null,
        destinationType: 'DONE',
        destinationId: null,
        destinationUrl: null,
        reasonCode: 'NEEDS_REVIEW',
        locked: true,
      },
      events: [],
      error: 'source_instance_mismatch',
      status: 400,
    };
  }

  const outcome = {
    outcomeEventId: newId('out'),
    clientEventId: scopedClientEventId,
    instanceId: instance.instanceId,
    userId: input.userId,
    trackId: 'A3-008',
    outcomeCode: validated.outcomeCode,
    safeFacts: validated.facts,
    occurredAt: String(input.body.occurredAt || nowIso(input.now)),
  };
  store.insertOutcome(outcome);

  const context: RouteContext = {
    fromId: 'A3-008',
    outcomeCode: validated.outcomeCode,
    facts: validated.facts,
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
    fromTrackId: 'A3-008',
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
    store.upsertInstance({
      ...instance,
      instanceStatus: 'waiting',
      waitUntil: String(validated.facts.wait_until || nowIso(input.now)),
      lastMentorEvent: 'wait_until',
      pendingSystemActionId: null,
    });
  } else if (decision.destinationType === 'DONE') {
    store.upsertInstance({
      ...instance,
      instanceStatus: 'completed',
      completedAt: nowIso(input.now),
      lastMentorEvent: 'done',
      pendingSystemActionId: null,
    });
  } else {
    store.upsertInstance({
      ...instance,
      instanceStatus: 'active',
      lastMentorEvent: 'result_recorded',
      pendingSystemActionId: null,
      lastDecisionTrackId: decision.destinationId,
    });
  }

  const events: ArchitectureEvent[] = [
    sanitizeArchitectureEvent('outcome_submitted', {
      system_action_id: 'A3-008',
      outcome_code: validated.outcomeCode,
    }),
    sanitizeArchitectureEvent('route_decided', {
      track_id: 'A3-008',
      matched_rule_id: decision.matchedRuleId,
      destination_type: decision.destinationType,
      locked: decision.locked,
      reason_code: decision.reasonCode,
    }),
  ];

  return { duplicate: false, outcomeId: outcome.outcomeEventId, decision, events };
}
