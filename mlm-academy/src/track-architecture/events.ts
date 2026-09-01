import { isForbiddenFactKey, stripUnsafeFacts } from './privacy';

export const A3_002_ANALYTICS_FORBIDDEN = [
  'contact_name',
  'phone',
  'email',
  'messenger_handle',
  'profile_url',
  'real_reason_text',
  'message_draft',
  'message_text',
  'response_text',
  'free_text_note',
] as const;

export type ArchitectureEventName =
  | 'track_meta_viewed'
  | 'track_access_denied'
  | 'track_started'
  | 'outcome_submitted'
  | 'route_decided'
  | 'route_conflict_detected'
  | 'wait_scheduled'
  | 'route_done'
  | 'track_imported';

export interface ArchitectureEvent {
  name: ArchitectureEventName;
  at: string;
  data: Record<string, unknown>;
}

export function validateAnalyticsProperties(properties: Record<string, unknown> | null | undefined): 'OK' | 'FAIL' {
  if (!properties || typeof properties !== 'object') return 'OK';
  for (const key of Object.keys(properties)) {
    if (isForbiddenFactKey(key) || (A3_002_ANALYTICS_FORBIDDEN as readonly string[]).includes(key)) {
      return 'FAIL';
    }
  }
  return 'OK';
}

export function sanitizeArchitectureEvent(
  name: ArchitectureEventName,
  data: Record<string, unknown> = {},
  now = new Date().toISOString(),
): ArchitectureEvent {
  if (validateAnalyticsProperties(data) === 'FAIL') {
    return {
      name,
      at: now,
      data: stripUnsafeFacts(data),
    };
  }
  return {
    name,
    at: now,
    data: stripUnsafeFacts(data),
  };
}
