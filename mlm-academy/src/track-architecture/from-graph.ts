import type {
  ActivationMode,
  ArchiveEdgeRecord,
  ConnectionIndexEntry,
  EntryRuleRecord,
  TrackConnectionRecord,
  TrackDefinition,
} from './types';
import { ENTITY_TYPES, type EntityType } from './types';
import { publicationFromImplementation } from './store';
import { rulesFromRouter, entryRulesFromRouter } from './from-router';
import { resolveTrackId } from './resolver';

export const GRAPH_V3_EXPECTED = {
  nodes: 112,
  designConnections: 231,
  ruleDerivedConnections: 22,
  effectiveTrackConnections: 253,
  structuredRouteRules: 58,
  connectionIndex: 112,
  nodesWithoutEffectiveIncoming: 36,
  brokenConnections: 0,
} as const;

export const BROKEN_ALIAS_ID = 'A6-017';

export interface GraphFileV3 {
  version?: string;
  nodes?: GraphNode[];
  designConnections?: GraphConnection[];
  ruleDerivedConnections?: GraphConnection[];
  effectiveTrackConnections?: GraphConnection[];
  structuredRouteRules?: unknown[];
  entryRules?: { id: string; source: string; signal: string; destination: string; guard?: unknown }[];
  connectionIndex?: Record<string, ConnectionIndexEntry>;
  nodesWithoutEffectiveIncoming?: string[];
  counts?: Record<string, number>;
}

interface GraphNode {
  id: string;
  canonicalId?: string;
  entityType?: string;
  publishSurface?: string;
  section?: string;
  domain?: string;
  title?: string;
  situation?: string;
  result?: string;
  audience?: string;
  implementationStatus?: string;
  canonicalUrl?: string;
  sourceCode?: string;
  sourcePages?: string;
  legacyNextIds?: string;
}

interface GraphConnection {
  connectionId: string;
  fromId: string;
  toId: string;
  fromCanonicalId?: string;
  toCanonicalId?: string;
  rank?: number;
  relationType?: string;
  relationLabel?: string;
  conditionHint?: string;
  reason?: string;
  userLabel?: string;
  activationMode?: string;
  matchedRouteRuleIds?: string[];
  sourceLayer?: string;
  runtimeStatus?: string;
}

function asEntityType(value: string | undefined): EntityType {
  if (value && (ENTITY_TYPES as readonly string[]).includes(value)) return value as EntityType;
  throw new Error(`Unknown entityType: ${value}`);
}

export function mapConnection(row: GraphConnection): TrackConnectionRecord {
  const activationMode = (row.activationMode === 'ROUTE_RULE' ? 'ROUTE_RULE' : 'LOCKED_NEXT_ACTION_SLOT') as ActivationMode;
  const locked = activationMode === 'LOCKED_NEXT_ACTION_SLOT';
  return {
    connectionId: row.connectionId,
    fromId: String(row.fromId).toUpperCase(),
    toId: String(row.toId).toUpperCase(),
    fromCanonicalId: String(row.fromCanonicalId || row.fromId).toUpperCase(),
    toCanonicalId: String(row.toCanonicalId || row.toId).toUpperCase(),
    rank: Number(row.rank || 0),
    relationType: String(row.relationType || ''),
    relationLabel: String(row.relationLabel || ''),
    conditionHint: String(row.conditionHint || ''),
    reason: String(row.reason || ''),
    userLabel: String(row.userLabel || ''),
    activationMode,
    executable: !locked,
    userVisible: false,
    matchedRouteRuleIds: Array.isArray(row.matchedRouteRuleIds) ? row.matchedRouteRuleIds.slice() : [],
    sourceLayer: String(row.sourceLayer || ''),
    runtimeStatus: String(row.runtimeStatus || ''),
  };
}

export function tracksFromGraph(file: GraphFileV3, registryVersion = '3.0'): TrackDefinition[] {
  const tracks = (file.nodes || []).map((track) => {
    const canonicalId = String(track.canonicalId || track.id).toUpperCase();
    const id = String(track.id).toUpperCase();
    const entityType = asEntityType(track.entityType);
    const selfAlias = entityType === 'ALIAS' && canonicalId === id;
    return {
      id,
      canonicalId,
      entityType,
      publishSurface: String(track.publishSurface || ''),
      section: String(track.section || ''),
      domain: String(track.domain || ''),
      title: String(track.title || ''),
      situation: String(track.situation || ''),
      result: String(track.result || ''),
      audience: String(track.audience || ''),
      implementationStatus: String(track.implementationStatus || ''),
      publicationStatus: publicationFromImplementation(String(track.implementationStatus || '')),
      catalogVisible: entityType === 'TRACK' || entityType === 'CONDITIONAL_TRACK' || entityType === 'REMEDIATION',
      source: {
        sourceCode: track.sourceCode || null,
        sourcePages: track.sourcePages || null,
        canonicalUrl: track.canonicalUrl || null,
        legacyNextIds: track.legacyNextIds || '',
      },
      registryVersion,
      contentStatus: 'EMPTY' as const,
      accessTier: 'PUBLIC_METADATA' as const,
      routeStatus: 'LOCKED' as const,
      executionMode: 'PREVIEW' as const,
      dataQuality: selfAlias || id === BROKEN_ALIAS_ID ? ('DATA_BLOCKED' as const) : ('OK' as const),
    };
  });
  const byId = new Map(tracks.map((track) => [track.id, track]));
  for (const track of tracks) {
    if (track.id === BROKEN_ALIAS_ID) {
      track.dataQuality = 'DATA_BLOCKED';
      continue;
    }
    if (track.entityType !== 'ALIAS') continue;
    const resolved = resolveTrackId(track.id, (id) => byId.get(id));
    if (resolved.error === 'ALIAS_LOOP' || resolved.error === 'CANONICAL_MISSING') {
      track.dataQuality = 'DATA_BLOCKED';
    }
  }
  return tracks;
}

export function connectionsFromGraph(file: GraphFileV3): TrackConnectionRecord[] {
  return (file.effectiveTrackConnections || []).map(mapConnection);
}

export function designConnectionsFromGraph(file: GraphFileV3): TrackConnectionRecord[] {
  return (file.designConnections || []).map(mapConnection);
}

export function ruleDerivedConnectionsFromGraph(file: GraphFileV3): TrackConnectionRecord[] {
  return (file.ruleDerivedConnections || []).map(mapConnection);
}

export function archiveAuditFromDesign(file: GraphFileV3): ArchiveEdgeRecord[] {
  return (file.designConnections || []).map((edge) => ({
    edgeId: edge.connectionId,
    fromId: String(edge.fromId).toUpperCase(),
    toId: String(edge.toId).toUpperCase(),
    active: false,
    statusV2: 'AUDIT_ONLY_NOT_EXECUTABLE',
    source: 'full-graph-112-v3 designConnections',
  }));
}

export function rulesFromGraph(file: GraphFileV3, checksum: string) {
  return rulesFromRouter({ routeRules: file.structuredRouteRules as never }, checksum);
}

export function entryRulesFromGraph(file: GraphFileV3): EntryRuleRecord[] {
  return entryRulesFromRouter({ entryRules: file.entryRules });
}

export function connectionIndexFromGraph(file: GraphFileV3): Record<string, ConnectionIndexEntry> {
  const source = file.connectionIndex || {};
  const out: Record<string, ConnectionIndexEntry> = {};
  for (const [id, entry] of Object.entries(source)) {
    const key = id.toUpperCase();
    out[key] = { ...entry, id: String(entry.id || key).toUpperCase() };
  }
  return out;
}

export function graphCounts(file: GraphFileV3) {
  const ids = new Set((file.nodes || []).map((node) => String(node.id).toUpperCase()));
  const broken = (file.effectiveTrackConnections || []).filter(
    (edge) => !ids.has(String(edge.fromId).toUpperCase()) || !ids.has(String(edge.toId).toUpperCase()),
  );
  return {
    nodes: (file.nodes || []).length,
    designConnections: (file.designConnections || []).length,
    ruleDerivedConnections: (file.ruleDerivedConnections || []).length,
    effectiveTrackConnections: (file.effectiveTrackConnections || []).length,
    structuredRouteRules: (file.structuredRouteRules || []).length,
    connectionIndex: Object.keys(file.connectionIndex || {}).length,
    nodesWithoutEffectiveIncoming: (file.nodesWithoutEffectiveIncoming || []).length,
    brokenConnections: broken.length,
  };
}

export function graphWarnings(file: GraphFileV3): string[] {
  const warnings: string[] = [];
  const a6017 = (file.nodes || []).find((node) => String(node.id).toUpperCase() === BROKEN_ALIAS_ID);
  if (a6017) {
    warnings.push(
      'A6-017 is a self-alias (CANONICAL_MISSING/DATA_BLOCKED); kept in registry, excluded from executable routing, not renumbered',
    );
  }
  return warnings;
}

export function countsMatchExpected(actual: ReturnType<typeof graphCounts>): string[] {
  const errors: string[] = [];
  for (const [key, expected] of Object.entries(GRAPH_V3_EXPECTED)) {
    const value = actual[key as keyof typeof actual];
    if (value !== expected) {
      errors.push(`${key}: expected ${expected}, got ${value}`);
    }
  }
  return errors;
}
