import type { EntityType, ResolveResult, TrackDefinition } from './types';
import { normalizeTrackId } from '../domain/routes';

export function isLessonEntity(entityType: EntityType): boolean {
  return entityType === 'TRACK' || entityType === 'CONDITIONAL_TRACK' || entityType === 'REMEDIATION';
}

export function canPublishAsStandaloneLesson(entityType: EntityType): boolean {
  return isLessonEntity(entityType);
}

export function resolveTrackId(
  rawId: string,
  getById: (id: string) => TrackDefinition | undefined,
): ResolveResult {
  const inputId = normalizeTrackId(rawId);
  if (!inputId) {
    return { inputId: String(rawId || '').toUpperCase(), canonicalId: null, definition: null, redirect: false, error: 'CONTENT_UNAVAILABLE', chain: [] };
  }

  const chain: string[] = [];
  let current = inputId;
  while (current) {
    if (chain.includes(current)) {
      return {
        inputId,
        canonicalId: null,
        definition: null,
        redirect: chain[0] !== current,
        error: 'ALIAS_LOOP',
        chain,
      };
    }
    chain.push(current);
    const definition = getById(current);
    if (!definition) {
      return {
        inputId,
        canonicalId: null,
        definition: null,
        redirect: chain.length > 1,
        error: 'CANONICAL_MISSING',
        chain,
      };
    }
    if (definition.entityType !== 'ALIAS') {
      return {
        inputId,
        canonicalId: definition.id,
        definition,
        redirect: chain.length > 1,
        chain,
      };
    }
    const next = normalizeTrackId(definition.canonicalId);
    if (!next || next === current) {
      return {
        inputId,
        canonicalId: null,
        definition,
        redirect: true,
        error: 'CANONICAL_MISSING',
        chain,
      };
    }
    current = next;
  }

  return { inputId, canonicalId: null, definition: null, redirect: false, error: 'CANONICAL_MISSING', chain };
}
