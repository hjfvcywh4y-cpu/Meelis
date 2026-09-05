import type { EntryRuleRecord, RouteRuleRecord, TrackDefinition } from './types';
import { ENTITY_TYPES, type EntityType } from './types';
import { publicationFromImplementation } from './store';
import { parseRecovery, normalizeDestinationId } from './recovery';
import { isAllowedFieldPath, isAllowedOperator } from './evaluator';

interface RouterFile {
  version?: string;
  tracks?: RouterTrack[];
  routeRules?: RouterRule[];
  entryRules?: RouterEntry[];
  legacyArchive?: RouterLegacy[];
}

interface RouterTrack {
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

interface RouterRule {
  ruleId: string;
  fromId: string;
  outcomeCode: string;
  field: string;
  operator: string;
  value: unknown;
  destinationType: string;
  destinationId?: string | null;
  reason?: string;
  stopRule?: string;
  recoveryRule?: string | null;
  priority: number;
  owner?: string;
  version?: string;
  status: string;
}

interface RouterEntry {
  id: string;
  source: string;
  signal: string;
  destination: string;
  guard?: unknown;
}

interface RouterLegacy {
  edgeId: string;
  fromId: string;
  toId: string;
  active?: boolean;
  statusV2?: string;
  source?: string;
}

function asEntityType(value: string | undefined): EntityType {
  if (value && (ENTITY_TYPES as readonly string[]).includes(value)) return value as EntityType;
  throw new Error(`Unknown entityType: ${value}`);
}

export function tracksFromRouter(file: RouterFile, registryVersion = '2.0'): TrackDefinition[] {
  return (file.tracks || []).map((track) => ({
    id: String(track.id).toUpperCase(),
    canonicalId: String(track.canonicalId || track.id).toUpperCase(),
    entityType: asEntityType(track.entityType),
    publishSurface: String(track.publishSurface || ''),
    section: String(track.section || ''),
    domain: String(track.domain || ''),
    title: String(track.title || ''),
    situation: String(track.situation || ''),
    result: String(track.result || ''),
    audience: String(track.audience || ''),
    implementationStatus: String(track.implementationStatus || ''),
    publicationStatus: publicationFromImplementation(String(track.implementationStatus || '')),
    catalogVisible: track.entityType === 'TRACK' || track.entityType === 'CONDITIONAL_TRACK' || track.entityType === 'REMEDIATION',
    source: {
      sourceCode: track.sourceCode || null,
      sourcePages: track.sourcePages || null,
      canonicalUrl: track.canonicalUrl || null,
      legacyNextIds: track.legacyNextIds || '',
    },
    registryVersion,
    contentStatus: 'EMPTY',
    accessTier: 'PUBLIC_METADATA',
    routeStatus: 'LOCKED',
    executionMode: 'PREVIEW',
    dataQuality:
      track.entityType === 'ALIAS' && String(track.canonicalId || track.id).toUpperCase() === String(track.id).toUpperCase()
        ? 'DATA_BLOCKED'
        : 'OK',
  }));
}

export function rulesFromRouter(file: RouterFile, checksum: string): RouteRuleRecord[] {
  return (file.routeRules || []).map((rule) => {
    if (!isAllowedFieldPath(rule.field) || !isAllowedOperator(rule.operator)) {
      throw new Error(`Unsafe rule evaluator in ${rule.ruleId}`);
    }
    return {
      ruleId: rule.ruleId,
      fromTrackId: String(rule.fromId).toUpperCase(),
      outcomeCode: String(rule.outcomeCode).toUpperCase(),
      fieldPath: rule.field,
      operatorCode: rule.operator,
      expectedValue: rule.value,
      destinationType: rule.destinationType as RouteRuleRecord['destinationType'],
      destinationId: normalizeDestinationId(rule.destinationId),
      reasonText: String(rule.reason || ''),
      stopRule: String(rule.stopRule || ''),
      recovery: parseRecovery(rule.recoveryRule),
      priority: Number(rule.priority),
      ownerLabel: String(rule.owner || ''),
      ruleVersion: String(rule.version || '2.0'),
      ruleStatus: rule.status as RouteRuleRecord['ruleStatus'],
      sourceChecksum: checksum,
    };
  });
}

export function entryRulesFromRouter(file: RouterFile): EntryRuleRecord[] {
  return (file.entryRules || []).map((rule) => ({
    entryRuleId: rule.id,
    sourceType: rule.source,
    signalCode: rule.signal,
    guard: rule.guard ?? {},
    destinationId: String(rule.destination).toUpperCase(),
    ruleStatus: 'PILOT_DRAFT_TO_TEST',
    version: '2.0',
  }));
}

export function archiveFromRouter(file: RouterFile) {
  return (file.legacyArchive || []).map((edge) => ({
    edgeId: edge.edgeId,
    fromId: String(edge.fromId).toUpperCase(),
    toId: String(edge.toId).toUpperCase(),
    active: edge.active === true,
    statusV2: String(edge.statusV2 || 'ARCHIVED_NOT_EXECUTABLE'),
    source: String(edge.source || ''),
  }));
}
