import { stripUnsafeFacts } from '../privacy';

export const A3_008_SYSTEM_ACTION_ID = 'A3-008';
export const A3_008_ACTION_VERSION = '0.1.0';

export const A3_008_OUTCOME_BY_CONTACT: Record<string, string> = {
  MEETING_CONFIRMED: 'RESULT_MEETING',
  LATER: 'RESULT_LATER',
  REFUSAL: 'RESULT_REFUSAL',
  NO_REPLY: 'RESULT_NO_REPLY',
  REFERRAL_WITH_PERMISSION: 'RESULT_REFERRAL',
  NO_NEXT_ACTION: 'RESULT_DONE',
};

export const A3_008_INBOUND_ADAPTERS = [
  { ruleId: 'RR2-014', sourceTrackId: 'A3-002', sourceOutcomeCode: 'MESSAGE_SENT' },
  { ruleId: 'RR2-017', sourceTrackId: 'A2-013', sourceOutcomeCode: 'REFERRAL_REQUEST_SENT' },
  { ruleId: 'RR2-020', sourceTrackId: 'A3-003', sourceOutcomeCode: 'CALL_COMPLETED' },
] as const;

const ALLOWED_TOP_LEVEL = new Set([
  'systemActionId',
  'actionVersion',
  'sourceTrackId',
  'sourceInstanceId',
  'sourceOutcomeCode',
  'contactCardRef',
  'contact',
  'occurredAt',
  'meetingAt',
  'meetingFormatCode',
  'followUpPermission',
  'nextActionAt',
  'referralPermissionConfirmed',
  'waitUntil',
  'retryCount',
  'stopCode',
  'idempotencyKey',
  'supersedesOutcomeId',
  'clientEventId',
  'outcomeCode',
  'facts',
]);

const MEETING_FORMATS = new Set(['ONLINE', 'PHONE', 'IN_PERSON', 'OTHER']);
const STOP_CODES = new Set(['NO_NEXT_ACTION', 'USER_STOPPED', 'CONTACT_BOUNDARY', 'NOT_RELEVANT', 'OTHER_STRUCTURED']);

export type A3008ValidationResult =
  | { ok: true; outcomeCode: string; facts: Record<string, unknown> }
  | { ok: false; error: string; status: 400 };

export function isA3008SystemActionRequest(body: Record<string, unknown>): boolean {
  return String(body.systemActionId || '').toUpperCase() === A3_008_SYSTEM_ACTION_ID;
}

export function validateA3008RecorderRequest(body: Record<string, unknown>): A3008ValidationResult {
  const extras = Object.keys(body).filter((key) => !ALLOWED_TOP_LEVEL.has(key));
  if (extras.length) return { ok: false, error: 'additional_properties_forbidden', status: 400 };
  if (String(body.systemActionId || '').toUpperCase() !== A3_008_SYSTEM_ACTION_ID) {
    return { ok: false, error: 'system_action_mismatch', status: 400 };
  }
  if (String(body.actionVersion || '') !== A3_008_ACTION_VERSION) {
    return { ok: false, error: 'action_version_mismatch', status: 400 };
  }
  const contact = body.contact;
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
    return { ok: false, error: 'contact_required', status: 400 };
  }
  const contactObj = contact as Record<string, unknown>;
  if (Object.keys(contactObj).some((key) => key !== 'outcome')) {
    return { ok: false, error: 'additional_properties_forbidden', status: 400 };
  }
  const outcome = String(contactObj.outcome || '');
  const outcomeCode = A3_008_OUTCOME_BY_CONTACT[outcome];
  if (!outcomeCode) return { ok: false, error: 'contact_outcome_invalid', status: 400 };

  if (!body.sourceTrackId || !body.sourceInstanceId || !body.sourceOutcomeCode || !body.contactCardRef) {
    return { ok: false, error: 'source_context_required', status: 400 };
  }
  if (!body.occurredAt || !body.idempotencyKey) {
    return { ok: false, error: 'occurred_at_and_idempotency_required', status: 400 };
  }
  const idem = String(body.idempotencyKey || '');
  if (idem.length < 16 || idem.length > 128) {
    return { ok: false, error: 'idempotency_key_invalid', status: 400 };
  }

  if (outcome === 'MEETING_CONFIRMED') {
    if (!body.meetingAt) return { ok: false, error: 'meetingAt_required', status: 400 };
    if (!MEETING_FORMATS.has(String(body.meetingFormatCode || ''))) {
      return { ok: false, error: 'meetingFormatCode_required', status: 400 };
    }
  }
  if (outcome === 'LATER') {
    if (body.followUpPermission !== true) return { ok: false, error: 'explicit_permission_required', status: 400 };
    if (!body.nextActionAt) return { ok: false, error: 'nextActionAt_required', status: 400 };
  }
  if (outcome === 'NO_REPLY') {
    if (!body.waitUntil) return { ok: false, error: 'waitUntil_required', status: 400 };
    const retry = body.retryCount;
    if (retry !== 0 && retry !== 1) return { ok: false, error: 'retry_count_max_1', status: 400 };
  }
  if (outcome === 'REFERRAL_WITH_PERMISSION') {
    if (body.referralPermissionConfirmed !== true) {
      return { ok: false, error: 'referral_permission_required', status: 400 };
    }
  }
  if (outcome === 'NO_NEXT_ACTION') {
    if (!STOP_CODES.has(String(body.stopCode || ''))) {
      return { ok: false, error: 'stopCode_required', status: 400 };
    }
  }

  const facts: Record<string, unknown> = stripUnsafeFacts({
    system_action_id: A3_008_SYSTEM_ACTION_ID,
    action_version: A3_008_ACTION_VERSION,
    source_track_id: body.sourceTrackId,
    source_instance_id: body.sourceInstanceId,
    source_outcome_code: body.sourceOutcomeCode,
    contact_card_ref: body.contactCardRef,
    'contact.outcome': outcome,
    occurred_at: body.occurredAt,
    meeting_at: body.meetingAt,
    meeting_format_code: body.meetingFormatCode,
    follow_up_permission: body.followUpPermission,
    next_action_at: body.nextActionAt,
    referral_permission_confirmed: body.referralPermissionConfirmed,
    wait_until: body.waitUntil,
    retry_count: body.retryCount,
    stop_code: body.stopCode,
    idempotency_key: body.idempotencyKey,
    supersedes_outcome_id: body.supersedesOutcomeId,
    mentor_event: 'result_recorded',
  });

  return { ok: true, outcomeCode, facts };
}

export function a3008SystemActionInstalled(contentStatus: string | undefined): boolean {
  return ['REVIEW', 'READY', 'PUBLISHED'].includes(String(contentStatus || ''));
}
