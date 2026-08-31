import { stripUnsafeFacts } from './privacy';

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

export function sanitizeArchitectureEvent(
  name: ArchitectureEventName,
  data: Record<string, unknown> = {},
  now = new Date().toISOString(),
): ArchitectureEvent {
  return {
    name,
    at: now,
    data: stripUnsafeFacts(data),
  };
}
