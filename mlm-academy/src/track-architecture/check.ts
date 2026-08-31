import { normalizeTrackId, parseTrackIdFromLocation, trackUrl } from '../domain/routes';
import { resolveTrackId, canPublishAsStandaloneLesson } from './resolver';
import { toPublicTrackMeta } from './public-meta';
import { connectionsForTrack, type ArchitectureStore } from './store';
import { GRAPH_V3_EXPECTED } from './from-graph';

export function checkTrack(store: ArchitectureStore, rawId: string) {
  const id = normalizeTrackId(rawId);
  if (!id) {
    return { ok: false, error: 'invalid_id', input: rawId };
  }
  const resolved = resolveTrackId(id, (key) => store.getTrack(key));
  const definition = store.getTrack(id) || resolved.definition;
  const content = resolved.canonicalId ? store.getContent(resolved.canonicalId) : undefined;
  const rules = store.listRules().filter((rule) => rule.fromTrackId === (resolved.canonicalId || id));
  const archive = store.listArchiveEdges().filter((edge) => edge.fromId === id);
  const { incoming, outgoing } = connectionsForTrack(store, id);
  const index = store.getConnectionIndex(id);
  return {
    ok: Boolean(definition) && !resolved.error && definition?.dataQuality === 'OK',
    id,
    canonicalId: resolved.canonicalId,
    entityType: definition?.entityType || null,
    publishSurface: definition?.publishSurface || null,
    domain: definition?.domain || null,
    implementationStatus: definition?.implementationStatus || null,
    publicationStatus: definition?.publicationStatus || null,
    dataQuality: definition?.dataQuality || null,
    accessTier: definition?.accessTier || null,
    routeStatus: definition?.routeStatus || null,
    executionMode: definition?.executionMode || null,
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
    connections: {
      incoming: incoming.length,
      outgoing: outgoing.length,
      lockedSlots: outgoing.filter((row) => row.activationMode === 'LOCKED_NEXT_ACTION_SLOT').length,
      routeRuleConnections: outgoing.filter((row) => row.activationMode === 'ROUTE_RULE').length,
    },
    connectionIndex: index
      ? {
          incomingDesign: index.incomingDesignConnections.length,
          outgoingDesign: index.outgoingDesignConnections.length,
          incomingEffective: index.incomingEffectiveConnections.length,
          outgoingEffective: index.outgoingEffectiveConnections.length,
          outgoingRouteRuleIds: index.outgoingRouteRuleIds,
          incomingRouteRuleIds: index.incomingRouteRuleIds,
          externalEntryRuleIds: index.externalEntryRuleIds,
        }
      : null,
    graphExpected: GRAPH_V3_EXPECTED,
    content: content
      ? { version: content.contentVersion, status: content.contentStatus, serverOnly: Boolean(content.privateContentRef) }
      : null,
  };
}
