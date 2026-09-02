import { stripUnsafeFacts } from '../privacy';

export const A3_005_CLIENT_STORAGE_KEY = 'mlma.a3-005.client.v1';

const MEETING_REQUIRED = [
  'appointment.status',
  'appointment.explicit_confirmation',
  'appointment.starts_at',
  'appointment.timezone',
  'appointment.duration_minutes',
  'appointment.format_code',
  'appointment.topic_code',
  'appointment.calendar_action_code',
] as const;

export function buildA3005ServerFacts(input: {
  outcomeCode: string;
  appointmentStatus?: string;
  explicitConfirmation?: boolean;
  startsAt?: string;
  timezone?: string;
  durationMinutes?: number | string;
  formatCode?: string;
  topicCode?: string;
  calendarActionCode?: string;
  followupAllowed?: boolean;
  reviewAnchorCode?: string;
  reviewAt?: string;
  decisionSourceCode?: string;
  noFollowupReasonCode?: string;
  aiUsed?: boolean;
}): Record<string, unknown> {
  const outcome = String(input.outcomeCode || '').toUpperCase();
  const base: Record<string, unknown> = {
    track_id: 'A3-005',
    outcome_code: outcome,
    ai_used: input.aiUsed === true,
    risk_flag_codes: [],
    mentor_event: 'result_recorded',
    step_id: 'decision_gate',
  };

  if (outcome === 'MEETING_SCHEDULED') {
    return stripUnsafeFacts({
      ...base,
      'appointment.status': 'CONFIRMED',
      'appointment.explicit_confirmation': input.explicitConfirmation === true,
      'appointment.starts_at': input.startsAt,
      'appointment.timezone': input.timezone,
      'appointment.duration_minutes': Number(input.durationMinutes || 0) || undefined,
      'appointment.format_code': input.formatCode,
      'appointment.topic_code': input.topicCode,
      'appointment.calendar_action_code': input.calendarActionCode || 'SKIP',
      'appointment.decision_source_code': input.decisionSourceCode,
    });
  }
  if (outcome === 'LATER') {
    return stripUnsafeFacts({
      ...base,
      'appointment.status': 'LATER',
      'appointment.followup_allowed': input.followupAllowed === true,
      'appointment.review_anchor_code': input.reviewAnchorCode,
      'appointment.review_at': input.reviewAt,
      'appointment.decision_source_code': input.decisionSourceCode,
    });
  }
  if (outcome === 'DECLINED') {
    return stripUnsafeFacts({
      ...base,
      'appointment.status': 'DECLINED',
      'appointment.decision_source_code': input.decisionSourceCode || 'EXPLICIT_DECLINE',
    });
  }
  return stripUnsafeFacts({
    ...base,
    'appointment.status': 'CLOSED_NO_FOLLOWUP',
    'appointment.no_followup_reason_code': input.noFollowupReasonCode || 'NO_EXPLICIT_CONSENT',
    'appointment.decision_source_code': input.decisionSourceCode,
  });
}

export function validateA3005MeetingScheduled(facts: Record<string, unknown>): boolean {
  for (const key of MEETING_REQUIRED) {
    if (facts[key] == null || facts[key] === '') return false;
  }
  if (facts['appointment.explicit_confirmation'] !== true) return false;
  if (facts['appointment.status'] !== 'CONFIRMED') return false;
  return true;
}

export function validateA3005Later(facts: Record<string, unknown>): boolean {
  if (facts['appointment.status'] !== 'LATER') return false;
  if (facts['appointment.followup_allowed'] !== true) return false;
  if (!facts['appointment.review_anchor_code']) return false;
  return true;
}

export function canSubmitA3005Outcome(outcomeCode: string, client: Record<string, unknown>): boolean {
  const outcome = String(outcomeCode || '').toUpperCase();
  if (outcome === 'MEETING_SCHEDULED') {
    return (
      client.appointmentStatus === 'CONFIRMED' &&
      client.explicitConfirmation === true &&
      Boolean(client.startsAt) &&
      Boolean(client.timezone) &&
      Boolean(client.durationMinutes) &&
      Boolean(client.formatCode) &&
      Boolean(client.topicCode)
    );
  }
  if (outcome === 'LATER') {
    return client.appointmentStatus === 'LATER' && client.followupAllowed === 'true' && Boolean(client.reviewAnchorCode);
  }
  if (outcome === 'DECLINED') {
    return client.appointmentStatus === 'DECLINED';
  }
  if (outcome === 'NO_FOLLOW_UP') {
    return (
      client.appointmentStatus === 'UNCONFIRMED' ||
      client.appointmentStatus === 'CLOSED_NO_FOLLOWUP' ||
      (client.appointmentStatus === 'LATER' && client.followupAllowed !== 'true')
    );
  }
  return false;
}

export function demoSandboxIsolatedA3005(demo: {
  createsLiveInstance?: boolean;
  writesOutcome?: boolean;
  executesRoute?: boolean;
}): boolean {
  return demo.createsLiveInstance === false && demo.writesOutcome === false && demo.executesRoute === false;
}
