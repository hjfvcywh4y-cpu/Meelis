import { stripUnsafeFacts } from '../privacy';

export const A3_016_CLIENT_STORAGE_KEY = 'mlma.a3-016.client.v1';
export const A3_002_HANDOFF_KEY = 'mlma.a3-002.client.v1';

const MANUAL_CHECK_KEYS = [
  'factIsTrue',
  'relevantToPerson',
  'purposeCanBeNamed',
  'timingIsRespectful',
  'noVulnerabilityExploitation',
  'noProhibition',
  'canSaySameMeaningAloud',
  'keepsRightToDecline',
] as const;

export function evaluateA3016ManualGate(manualChecks: Record<string, unknown> | undefined): boolean {
  if (!manualChecks || typeof manualChecks !== 'object') return false;
  return MANUAL_CHECK_KEYS.every((key) => manualChecks[key] === true);
}

export function buildA3016ServerFacts(input: {
  outcomeCode: string;
  factSourceCode?: string;
  intentCode?: string;
  disclosureStatus?: string;
  timingCode?: string;
  permissionStatus?: string;
  noReasonCode?: string;
  reviewTriggerCode?: string;
  stopCode?: string;
}): Record<string, unknown> {
  const outcome = String(input.outcomeCode || '').toUpperCase();
  const base: Record<string, unknown> = {
    track_id: 'A3-016',
    outcome_code: outcome,
    ai_used: false,
    risk_flag_codes: [],
    mentor_event: 'result_recorded',
    step_id: 'decision_gate',
  };

  if (outcome === 'REASON_FOUND') {
    return stripUnsafeFacts({
      ...base,
      real_reason: true,
      fact_source_code: input.factSourceCode,
      intent_code: input.intentCode,
      disclosure_status: input.disclosureStatus,
      timing_code: input.timingCode,
      permission_status: input.permissionStatus,
      contact_allowed: true,
    });
  }
  if (outcome === 'NO_REASON') {
    return stripUnsafeFacts({
      ...base,
      real_reason: false,
      fact_source_code: input.factSourceCode || 'NONE',
      intent_code: input.intentCode || 'HIDDEN_OR_UNCLEAR',
      disclosure_status: input.disclosureStatus || 'HIDDEN',
      timing_code: input.timingCode || 'WAIT_BETTER_CONTEXT',
      permission_status: input.permissionStatus || 'NEEDS_PERMISSION',
      contact_allowed: true,
      no_reason_code: input.noReasonCode,
      review_trigger_code: input.reviewTriggerCode,
    });
  }
  return stripUnsafeFacts({
    ...base,
    real_reason: false,
    contact_allowed: false,
    stop_code: input.stopCode,
  });
}

export function validateA3016ReasonFound(facts: Record<string, unknown>): boolean {
  if (facts.real_reason !== true) return false;
  if (facts.disclosure_status !== 'FULLY_NAMED') return false;
  if (facts.contact_allowed !== true) return false;
  if (!facts.fact_source_code || facts.fact_source_code === 'NONE') return false;
  if (!facts.intent_code || facts.intent_code === 'HIDDEN_OR_UNCLEAR') return false;
  if (!facts.timing_code || facts.timing_code === 'VULNERABLE_CONTEXT' || facts.timing_code === 'EXPLICIT_BOUNDARY') {
    return false;
  }
  if (facts.permission_status === 'PROHIBITED') return false;
  return true;
}

export function demoSandboxIsolatedA3016(demo: {
  createsLiveInstance?: boolean;
  writesOutcome?: boolean;
  executesRoute?: boolean;
}): boolean {
  return demo.createsLiveInstance === false && demo.writesOutcome === false && demo.executesRoute === false;
}
