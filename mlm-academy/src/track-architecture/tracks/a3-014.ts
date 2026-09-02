import { stripUnsafeFacts } from '../privacy';

export const A3_014_CLIENT_STORAGE_KEY = 'mlma.a3-014.client.v1';

export function buildA3014ServerFacts(input: {
  outcomeCode: string;
  originTrackId?: string;
  readinessGateCode?: string;
  targetActionCode?: string;
  fearEventCode?: string;
  evidenceCode?: string;
  supportCode?: string;
  microStepCode?: string;
  nextNeedCode?: string;
  dueCode?: string;
  reviewTriggerCode?: string;
  supportHandoffCode?: string;
  riskFlagCodes?: string[];
  aiUsed?: boolean;
}): Record<string, unknown> {
  const outcome = String(input.outcomeCode || '').toUpperCase();
  const base: Record<string, unknown> = {
    track_id: 'A3-014',
    outcome_code: outcome,
    origin_track_id: input.originTrackId || 'A3-002',
    readiness_gate_code: input.readinessGateCode || 'CONTINUE',
    fear_event_code: input.fearEventCode || 'UNKNOWN',
    evidence_code: input.evidenceCode || 'UNKNOWN',
    next_need_code: input.nextNeedCode || 'RETURN_TO_ORIGIN',
    risk_flag_codes: input.riskFlagCodes || [],
    ai_used: input.aiUsed === true,
    mentor_event: 'result_recorded',
    step_id: 'decision_gate',
  };

  if (outcome === 'ACTION_READY') {
    return stripUnsafeFacts({
      ...base,
      readiness_gate_code: 'CONTINUE',
      target_action_code: input.targetActionCode,
      support_code: input.supportCode,
      micro_step_code: input.microStepCode,
      next_need_code: 'RETURN_TO_ORIGIN',
      due_code: input.dueCode,
    });
  }
  if (outcome === 'SUPPORT_REQUIRED') {
    return stripUnsafeFacts({
      ...base,
      readiness_gate_code: 'CONTINUE',
      next_need_code: input.nextNeedCode,
    });
  }
  if (outcome === 'WAIT_FOR_RESOURCE') {
    return stripUnsafeFacts({
      ...base,
      readiness_gate_code: 'PAUSE',
      next_need_code: 'WAIT',
      review_trigger_code: input.reviewTriggerCode,
      due_code: input.dueCode,
    });
  }
  return stripUnsafeFacts({
    ...base,
    readiness_gate_code: 'OUT_OF_SCOPE',
    next_need_code: 'HUMAN_SUPPORT',
    support_handoff_code: input.supportHandoffCode || 'HUMAN_SUPPORT',
  });
}

export function validateA3014ActionReady(facts: Record<string, unknown>): boolean {
  if (facts.readiness_gate_code !== 'CONTINUE') return false;
  if (facts.next_need_code !== 'RETURN_TO_ORIGIN') return false;
  if (!facts.target_action_code || !facts.support_code || !facts.micro_step_code) return false;
  if (!facts.fear_event_code || facts.fear_event_code === 'UNKNOWN') return false;
  if (!facts.evidence_code || facts.evidence_code === 'UNKNOWN') return false;
  return true;
}

export function demoSandboxIsolatedA3014(demo: {
  createsLiveInstance?: boolean;
  writesOutcome?: boolean;
  executesRoute?: boolean;
}): boolean {
  return demo.createsLiveInstance === false && demo.writesOutcome === false && demo.executesRoute === false;
}
