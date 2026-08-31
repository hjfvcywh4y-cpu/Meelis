import { trackUrl } from '../domain/routes';
import { canUsePaidNavigation } from './access';
import { evaluateCondition } from './evaluator';
import { resolveTrackId } from './resolver';
import type {
  DestinationType,
  RouteContext,
  RouteDecision,
  RouteRuleRecord,
  TrackDefinition,
} from './types';

export interface RouteEngineStore {
  getTrack(id: string): TrackDefinition | undefined;
  listRules(): RouteRuleRecord[];
}

function runnableStatus(rule: RouteRuleRecord, mode: RouteContext['mode']): boolean {
  if (rule.ruleStatus === 'DISABLED' || rule.ruleStatus === 'ARCHIVED') return false;
  if (rule.ruleStatus === 'VALIDATED_RULE') return true;
  if (rule.ruleStatus === 'PILOT_DRAFT_TO_TEST') {
    if (mode === 'production') return false;
    if (mode === 'pilot' || mode === 'admin-preview') return true;
  }
  return false;
}

function destinationNeedsNavigation(type: DestinationType): boolean {
  return type === 'TRACK' || type === 'SYSTEM_ACTION' || type === 'RETURN_TO_ROUTE' || type === 'FIELD_ACTION';
}

/**
 * Чистый детерминированный Route Engine. Не читает HTML, legacyNextIds и 231 archive edge.
 */
export function decideRoute(store: RouteEngineStore, context: RouteContext): RouteDecision {
  if (!context.flags.ROUTE_ENGINE_ENABLED || !context.flags.TRACK_REGISTRY_ENABLED) {
    return {
      matchedRuleId: null,
      destinationType: 'DONE',
      destinationId: null,
      destinationUrl: null,
      reasonCode: context.flags.TRACK_REGISTRY_ENABLED ? 'ENGINE_DISABLED' : 'REGISTRY_DISABLED',
      locked: true,
      lockReason: 'FEATURE_DISABLED',
    };
  }

  const resolved = resolveTrackId(context.fromId, (id) => store.getTrack(id));
  if (!resolved.canonicalId || !resolved.definition) {
    return {
      matchedRuleId: null,
      destinationType: 'DONE',
      destinationId: null,
      destinationUrl: null,
      reasonCode: 'NO_SUCH_TRACK',
      locked: true,
      lockReason: resolved.error === 'ALIAS_LOOP' ? 'ALIAS_LOOP' : 'CONTENT_UNAVAILABLE',
    };
  }

  const fromId = resolved.canonicalId;
  const outcomeCode = String(context.outcomeCode || '')
    .trim()
    .toUpperCase();

  const candidates = store
    .listRules()
    .filter((rule) => rule.fromTrackId === fromId && rule.outcomeCode === outcomeCode)
    .filter((rule) => runnableStatus(rule, context.mode))
    .filter((rule) => evaluateCondition(context.facts || {}, rule.fieldPath, rule.operatorCode, rule.expectedValue))
    .slice()
    .sort((a, b) => a.priority - b.priority || a.ruleId.localeCompare(b.ruleId));

  if (candidates.length === 0) {
    return {
      matchedRuleId: null,
      destinationType: 'DONE',
      destinationId: null,
      destinationUrl: null,
      reasonCode: 'NO_MATCHING_RULE',
      reasonText: 'Нет исполняемого правила v2. Legacy-связи не используются.',
      locked: true,
      lockReason: 'FEATURE_DISABLED',
    };
  }

  const topPriority = candidates[0].priority;
  const tied = candidates.filter((rule) => rule.priority === topPriority);
  const destinations = new Set(
    tied.map((rule) => `${rule.destinationType}:${rule.destinationId || ''}`),
  );
  if (destinations.size > 1) {
    return {
      matchedRuleId: null,
      destinationType: 'DONE',
      destinationId: null,
      destinationUrl: null,
      reasonCode: 'CONFLICT',
      reasonText: `Конфликт правил: ${tied.map((rule) => rule.ruleId).join(', ')}`,
      locked: true,
      lockReason: 'FEATURE_DISABLED',
      ruleSnapshot: tied[0],
    };
  }

  const matched = tied[0];
  const destinationType = matched.destinationType;
  const destinationId = matched.destinationId;
  const paidNav = canUsePaidNavigation(context.userAccess, context.flags);
  const locked = !paidNav;
  const lockReason = locked
    ? !context.flags.PAID_TRACK_NAVIGATION_ENABLED
      ? 'FEATURE_DISABLED'
      : !context.userAccess.verified
        ? context.userAccess.userId
          ? 'ENTITLEMENT_REQUIRED'
          : 'AUTH_REQUIRED'
        : 'ENTITLEMENT_REQUIRED'
    : undefined;

  let destinationUrl: string | null = null;
  if (!locked && destinationId && destinationNeedsNavigation(destinationType)) {
    destinationUrl = trackUrl(destinationId);
  }

  return {
    matchedRuleId: matched.ruleId,
    destinationType,
    destinationId,
    destinationUrl,
    reasonCode: 'MATCHED',
    reasonText: matched.reasonText,
    recovery: matched.recovery,
    locked,
    lockReason,
    ruleSnapshot: matched,
  };
}
