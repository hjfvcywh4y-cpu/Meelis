import { DESTINATION_TYPES, type DestinationType } from './types';
import { normalizeTrackId } from '../domain/routes';

const TYPE_SET = new Set<string>(DESTINATION_TYPES);

export function parseRecovery(raw: unknown): { type: DestinationType; id?: string } | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const [typePart, idPart] = text.split(':');
  const typeCandidate = typePart.trim().toUpperCase();
  if (TYPE_SET.has(typeCandidate)) {
    const parsed: { type: DestinationType; id?: string } = { type: typeCandidate as DestinationType };
    const id = idPart ? normalizeTrackId(idPart) : null;
    if (id) parsed.id = id;
    return parsed;
  }
  const id = normalizeTrackId(text);
  if (id) return { type: 'TRACK', id };
  return null;
}

export function normalizeDestinationId(raw: unknown): string | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  return normalizeTrackId(text);
}
