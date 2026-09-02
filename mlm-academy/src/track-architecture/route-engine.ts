import { trackUrl } from '../domain/routes';
import { canUseBetaNavigation, canUsePaidNavigation } from './access';
import { isBetaContentStatus, isRegisteredBeta } from './beta';
import { evaluateCondition } from './evaluator';
import { resolveTrackId } from './resolver';
import type {
  ContentVersionRecord,
  DestinationType,
  RouteContext,
  RouteDecision,
  RouteRuleRecord,
  TrackDefinition,
} from './types';

export interface RouteEngineStore {
  getTrack(id: string): TrackDefinition | undefined;
  listRules(): RouteRuleRecord[];
  getContent?(trackId: string, version?: string): ContentVersionRecord | undefined;
}

function runnableStatus(
  rule: RouteRuleRecord,
  mode: RouteContext['mode'],
  context: RouteContext,
  store: RouteEngineStore,
): boolean {
  if (rule.ruleStatus === 'DISABLED' || rule.ruleStatus === 'ARCHIVED') return false;
  if (rule.ruleStatus === 'VALIDATED_RULE') return true;
  if (rule.ruleStatus === 'PILOT_DRAFT_TO_TEST') {
    if (mode === 'pilot' || mode === 'admin-preview') return true;
    if (mode === 'beta' && isRegisteredBeta(context.userAccess, context.flags) && !context.flags.ALLOW_DRAFT_RULES) {
      const content = store.getContent?.(rule.fromTrackId);
      return isBetaContentStatus(content?.contentStatus);
    }
    return false;
  }
  return false;
}

function destinationNeedsNavigation(type: DestinationType): boolean {
  return type === 'TRACK' || type === 'SYSTEM_ACTION' || type === 'RETURN_TO_ROUTE' || type === 'FIELD_ACTION';
}

/**
 * Чистый детерминированный Route Engine.
 * Исполняет только RouteRule. Не читает HTML, legacyNextIds, archive и LOCKED_NEXT_ACTION_SLOT.
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
  const blocked =
    resolved.error === 'ALIAS_LOOP' ||
    resolved.error === 'CANONICAL_MISSING' ||
    resolved.definition?.dataQuality === 'DATA_BLOCKED' ||
    resolved.definition?.dataQuality === 'CANONICAL_MISSING';
  if (blocked || !resolved.canonicalId || !resolved.definition) {
    return {
      matchedRuleId: null,
      destinationType: 'DONE',
      destinationId: null,
      destinationUrl: null,
      reasonCode: 'NO_SUCH_TRACK',
      locked: true,
      lockReason: resolved.error === 'ALIAS_LOOP' ? 'ALIAS_LOOP' : 'DATA_BLOCKED',
    };
  }

  const fromId = resolved.canonicalId;
  const outcomeCode = String(context.outcomeCode || '')
    .trim()
    .toUpperCase();

  const candidates = store
    .listRules()
    .filter((rule) => rule.fromTrackId === fromId && rule.outcomeCode === outcomeCode)
    .filter((rule) => runnableStatus(rule, context.mode, context, store))
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
      reasonText: 'Нет исполняемого RouteRule. LOCKED_NEXT_ACTION_SLOT и archive не исполняются.',
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
  const betaNav = canUseBetaNavigation(context.userAccess, context.flags);
  const destContent = destinationId && store.getContent ? store.getContent(destinationId) : undefined;
  const destInstalled = destinationType === 'DONE' || destinationType === 'WAIT_UNTIL' || destinationType === 'EXPERT' || destinationType === 'PROCESS_OWNER' || isBetaContentStatus(destContent?.contentStatus);
  const preparingDestination = Boolean(betaNav && destinationNeedsNavigation(destinationType) && destinationId && !destInstalled);
  const locked = preparingDestination ? true : !(paidNav || (betaNav && destInstalled));
  const lockReason = locked
    ? preparingDestination
      ? 'CONTENT_UNAVAILABLE'
      : !context.flags.PAID_TRACK_NAVIGATION_ENABLED && !betaNav
        ? 'FEATURE_DISABLED'
        : !context.userAccess.verified && !context.userAccess.registered
          ? context.userAccess.userId
            ? 'ENTITLEMENT_REQUIRED'
            : 'AUTH_REQUIRED'
          : 'ENTITLEMENT_REQUIRED'
    : undefined;

  let destinationUrl: string | null = null;
  if (
    destinationId &&
    destinationType !== 'SYSTEM_ACTION' &&
    destinationNeedsNavigation(destinationType) &&
    paidNav
  ) {
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
    preparingDestination,
    betaPilot: betaNav || context.mode === 'beta',
    ruleSnapshot: matched,
  };
}
