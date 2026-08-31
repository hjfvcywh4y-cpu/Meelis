import { normalizeTrackId, parseTrackIdFromLocation, trackUrl } from '../domain/routes';
import { resolveTrackId, canPublishAsStandaloneLesson } from './resolver';
import { toPublicTrackMeta } from './public-meta';
import type { ArchitectureStore } from './store';

export function checkTrack(store: ArchitectureStore, rawId: string) {
  const id = normalizeTrackId(rawId);
  if (!id) {
    return { ok: false, error: 'invalid_id', input: rawId };
  }
  const resolved = resolveTrackId(id, (key) => store.getTrack(key));
  const definition = resolved.definition;
  const content = resolved.canonicalId ? store.getContent(resolved.canonicalId) : undefined;
  const rules = store.listRules().filter((rule) => rule.fromTrackId === (resolved.canonicalId || id));
  const archive = store.listArchiveEdges().filter((edge) => edge.fromId === id);
  return {
    ok: Boolean(definition && !resolved.error),
    id,
    canonicalId: resolved.canonicalId,
    entityType: definition?.entityType || null,
    publishSurface: definition?.publishSurface || null,
    domain: definition?.domain || null,
    implementationStatus: definition?.implementationStatus || null,
    publicationStatus: definition?.publicationStatus || null,
    canBeLesson: definition ? canPublishAsStandaloneLesson(definition.entityType) : false,
    resolveError: resolved.error || null,
    chain: resolved.chain,
    urls: {
      spec: trackUrl(resolved.canonicalId || id),
      pretty: `/track/${(resolved.canonicalId || id).toLowerCase()}`,
      parsedBack: parseTrackIdFromLocation('/track', `id=${(resolved.canonicalId || id).toLowerCase()}`),
    },
    publicMeta: definition ? toPublicTrackMeta(definition, content?.contentStatus === 'PUBLISHED') : null,
    v2RuleCount: rules.length,
    v2RuleIds: rules.map((rule) => rule.ruleId),
    archivedLegacyEdges: archive.length,
    archivedEdgesExecutable: archive.filter((edge) => edge.active).length,
    content: content
      ? { version: content.contentVersion, status: content.contentStatus, serverOnly: Boolean(content.privateContentRef) }
      : null,
  };
}
