import { normalizeTrackId } from '../domain/routes';
import { resolveTrackId, canPublishAsStandaloneLesson } from './resolver';
import { parseTrackPackage, type TrackPackage } from './package';
import { tracksFromRouter, rulesFromRouter, entryRulesFromRouter, archiveFromRouter } from './from-router';
import { MemoryArchitectureStore, sha256, nowIso, newId, type ArchitectureStore, type StoreSnapshot } from './store';
import type { ContentVersionRecord, RouteRuleRecord, TrackDefinition } from './types';
import { parseRecovery, normalizeDestinationId } from './recovery';
import { isAllowedFieldPath, isAllowedOperator } from './evaluator';

export interface ImportIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

export interface ImportDiff {
  tracksAdded: string[];
  tracksUpdated: string[];
  rulesAdded: string[];
  rulesUpdated: string[];
  contentAdded: string[];
  warnings: ImportIssue[];
}

export interface ImportResult {
  ok: boolean;
  dryRun: boolean;
  checksum: string;
  issues: ImportIssue[];
  diff: ImportDiff;
  counts?: {
    tracks: number;
    rules: number;
    archiveEdges: number;
  };
}

function needsDestinationId(type: string): boolean {
  return type === 'TRACK' || type === 'SYSTEM_ACTION';
}

function validateGraph(tracks: TrackDefinition[], rules: RouteRuleRecord[]): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const ids = new Set(byId.keys());

  if (new Set(tracks.map((track) => track.id)).size !== tracks.length) {
    issues.push({ level: 'error', code: 'duplicate_track_id', message: 'Track ID must be unique' });
  }

  for (const track of tracks) {
    if (track.entityType === 'ALIAS') {
      const resolved = resolveTrackId(track.id, (id) => byId.get(id));
      if (resolved.error === 'ALIAS_LOOP') {
        issues.push({
          level: track.canonicalId === track.id ? 'warning' : 'error',
          code: 'alias_loop',
          message: `Alias loop at ${track.id}: ${resolved.chain.join(' → ')}`,
        });
      } else if (resolved.error === 'CANONICAL_MISSING') {
        issues.push({
          level: 'warning',
          code: 'canonical_missing',
          message: `Alias ${track.id} has no non-alias canonical target`,
        });
      }
    }
  }

  for (const rule of rules) {
    if (!ids.has(rule.fromTrackId)) {
      issues.push({ level: 'error', code: 'unknown_from', message: `${rule.ruleId} from unknown ${rule.fromTrackId}` });
    }
    if (needsDestinationId(rule.destinationType)) {
      if (!rule.destinationId || !ids.has(rule.destinationId)) {
        issues.push({
          level: 'error',
          code: 'unknown_destination',
          message: `${rule.ruleId} destination ${rule.destinationId || '(empty)'} is not in registry`,
        });
      }
    } else if (rule.destinationId && !ids.has(rule.destinationId) && needsDestinationId('TRACK')) {
      if (!ids.has(rule.destinationId)) {
        issues.push({
          level: 'error',
          code: 'unknown_destination',
          message: `${rule.ruleId} destination ${rule.destinationId} is not in registry`,
        });
      }
    }
    if (rule.recovery?.id && !ids.has(rule.recovery.id)) {
      issues.push({
        level: 'error',
        code: 'unknown_destination',
        message: `${rule.ruleId} recovery ${rule.recovery.id} is not in registry`,
      });
    }
    if (!isAllowedFieldPath(rule.fieldPath) || !isAllowedOperator(rule.operatorCode)) {
      issues.push({ level: 'error', code: 'unsafe_evaluator', message: `${rule.ruleId} uses a forbidden field/operator` });
    }
  }

  return issues;
}

function diffSnapshots(before: StoreSnapshot, after: StoreSnapshot): ImportDiff {
  const beforeTracks = new Set(before.tracks.map((row) => row.id));
  const beforeRules = new Set(before.rules.map((row) => row.ruleId));
  const beforeContent = new Set(before.content.map((row) => `${row.trackId}:${row.contentVersion}`));
  const tracksAdded: string[] = [];
  const tracksUpdated: string[] = [];
  const rulesAdded: string[] = [];
  const rulesUpdated: string[] = [];
  const contentAdded: string[] = [];

  for (const track of after.tracks) {
    if (!beforeTracks.has(track.id)) tracksAdded.push(track.id);
    else tracksUpdated.push(track.id);
  }
  for (const rule of after.rules) {
    if (!beforeRules.has(rule.ruleId)) rulesAdded.push(rule.ruleId);
    else rulesUpdated.push(rule.ruleId);
  }
  for (const row of after.content) {
    const key = `${row.trackId}:${row.contentVersion}`;
    if (!beforeContent.has(key)) contentAdded.push(key);
  }

  return { tracksAdded, tracksUpdated, rulesAdded, rulesUpdated, contentAdded, warnings: [] };
}

export function importRouterJson(
  store: ArchitectureStore,
  source: { filename: string; text: string; json: unknown },
  options: { dryRun: boolean; userId?: string | null },
): ImportResult {
  const checksum = sha256(source.text);
  const issues: ImportIssue[] = [];
  const file = source.json as Parameters<typeof tracksFromRouter>[0];
  let tracks: TrackDefinition[] = [];
  let rules: RouteRuleRecord[] = [];
  try {
    tracks = tracksFromRouter(file);
    rules = rulesFromRouter(file, checksum);
  } catch (error) {
    return fail('parse_failed', String(error), checksum, options.dryRun);
  }

  if (tracks.length !== 112) {
    issues.push({ level: 'error', code: 'track_count', message: `Expected 112 tracks, got ${tracks.length}` });
  }
  if (rules.length !== 58) {
    issues.push({ level: 'error', code: 'rule_count', message: `Expected 58 v2 rules, got ${rules.length}` });
  }

  const archive = archiveFromRouter(file);
  if (archive.length !== 231) {
    issues.push({ level: 'warning', code: 'archive_count', message: `Expected 231 archived edges, got ${archive.length}` });
  }
  if (archive.some((edge) => edge.active)) {
    issues.push({ level: 'error', code: 'legacy_active', message: 'Legacy archive edges must not be active' });
  }

  issues.push(...validateGraph(tracks, rules));
  const errors = issues.filter((issue) => issue.level === 'error');
  const before = store.snapshot();
  const draft = new MemoryArchitectureStore();
  draft.replaceAll(before);
  for (const track of tracks) draft.upsertTrack(track);
  draft.replaceRules(rules);
  draft.replaceEntryRules(entryRulesFromRouter(file));
  draft.replaceArchiveEdges(archive);
  const after = draft.snapshot();
  const diff = diffSnapshots(before, after);
  diff.warnings = issues.filter((issue) => issue.level === 'warning');

  const result: ImportResult = {
    ok: errors.length === 0,
    dryRun: options.dryRun,
    checksum,
    issues,
    diff,
    counts: { tracks: tracks.length, rules: rules.length, archiveEdges: archive.length },
  };

  store.insertImportRun({
    importRunId: newId('imp'),
    importType: 'router_v2',
    sourceFilename: source.filename,
    sourceChecksum: checksum,
    dryRun: options.dryRun,
    importStatus: result.ok ? 'ok' : 'rejected',
    diff: diff as unknown as Record<string, unknown>,
    initiatedByUserId: options.userId || null,
    createdAt: nowIso(),
    completedAt: nowIso(),
  });

  if (result.ok && !options.dryRun) {
    store.replaceAll(after);
  }
  return result;
}

export function importTrackPackage(
  store: ArchitectureStore,
  source: { filename: string; text: string; json: unknown; contentBody?: unknown },
  options: { dryRun: boolean; userId?: string | null; allowProductionActivation?: boolean },
): ImportResult {
  const checksum = sha256(source.text);
  const parsed = parseTrackPackage(source.json);
  if (!parsed.ok) {
    return fail('schema', parsed.error, checksum, options.dryRun);
  }
  const pkg = parsed.data;
  const issues: ImportIssue[] = [];

  if (pkg.content.serverOnly !== true) {
    issues.push({ level: 'error', code: 'content_not_server_only', message: 'Track package content must be serverOnly' });
  }

  const existing = store.getTrack(pkg.track.id);
  if (!existing) {
    issues.push({ level: 'error', code: 'unknown_track', message: `${pkg.track.id} is not in the registry` });
  } else {
    if (existing.entityType !== pkg.track.entityType) {
      issues.push({
        level: 'error',
        code: 'entity_mismatch',
        message: `Package entityType ${pkg.track.entityType} != registry ${existing.entityType}`,
      });
    }
    if (!canPublishAsStandaloneLesson(existing.entityType) && pkg.content.status === 'PUBLISHED' && pkg.content.format !== 'none' && pkg.content.format !== 'system-ui') {
      issues.push({
        level: 'error',
        code: 'not_a_lesson',
        message: `${existing.entityType} cannot be published as a standalone lesson`,
      });
    }
  }

  if (pkg.track.entityType === 'ALIAS') {
    issues.push({ level: 'error', code: 'alias_content', message: 'ALIAS cannot receive a content copy' });
  }

  const rules: RouteRuleRecord[] = pkg.routeRules.map((rule) => ({
    ruleId: rule.ruleId,
    fromTrackId: rule.fromId,
    outcomeCode: rule.outcomeCode,
    fieldPath: rule.field,
    operatorCode: rule.operator,
    expectedValue: rule.value,
    destinationType: rule.destinationType,
    destinationId: normalizeDestinationId(rule.destinationId),
    reasonText: rule.reason || '',
    stopRule: rule.stopRule || '',
    recovery: parseRecovery(rule.recoveryRule),
    priority: rule.priority,
    ownerLabel: rule.owner || '',
    ruleVersion: rule.version,
    ruleStatus: rule.status,
    sourceChecksum: checksum,
  }));

  if (rules.some((rule) => rule.ruleStatus === 'VALIDATED_RULE') && options.allowProductionActivation !== true) {
    issues.push({
      level: 'error',
      code: 'draft_activation',
      message: 'Cannot activate PILOT_DRAFT_TO_TEST/new rules as VALIDATED_RULE in this environment',
    });
  }

  const tracks = store.listTracks();
  issues.push(...validateGraph(tracks, [...store.listRules().filter((rule) => !rules.some((next) => next.ruleId === rule.ruleId)), ...rules]));

  const history = store.listInstances('').length;
  void history;

  const errors = issues.filter((issue) => issue.level === 'error');
  const before = store.snapshot();
  const draft = new MemoryArchitectureStore();
  draft.replaceAll(before);

  if (existing) {
    draft.upsertTrack({
      ...existing,
      title: pkg.track.title || existing.title,
      situation: pkg.track.situation || existing.situation,
      result: pkg.track.result || existing.result,
      audience: pkg.track.audience || existing.audience,
    });
  }

  for (const rule of rules) draft.upsertRule(rule);

  const content: ContentVersionRecord = {
    id: newId('cv'),
    trackId: pkg.track.id,
    contentVersion: pkg.content.version,
    contentStatus: pkg.content.status,
    contentFormat: pkg.content.format,
    privateContentRef: pkg.content.sourcePath,
    checksum: pkg.content.checksum && pkg.content.checksum !== 'GENERATE_DURING_IMPORT' ? pkg.content.checksum : checksum,
    productPolicy: { policy: pkg.access.policy, productCodes: pkg.access.productCodes },
    createdAt: nowIso(),
    publishedAt: pkg.content.status === 'PUBLISHED' ? nowIso() : null,
    body: source.contentBody ?? { serverOnly: true, placeholder: true },
  };
  draft.upsertContent(content);

  const after = draft.snapshot();
  const diff = diffSnapshots(before, after);
  diff.warnings = issues.filter((issue) => issue.level === 'warning');

  const result: ImportResult = {
    ok: errors.length === 0,
    dryRun: options.dryRun,
    checksum,
    issues,
    diff,
    counts: { tracks: after.tracks.length, rules: after.rules.length, archiveEdges: after.archiveEdges.length },
  };

  store.insertImportRun({
    importRunId: newId('imp'),
    importType: 'track_package',
    sourceFilename: source.filename,
    sourceChecksum: checksum,
    dryRun: options.dryRun,
    importStatus: result.ok ? 'ok' : 'rejected',
    diff: diff as unknown as Record<string, unknown>,
    initiatedByUserId: options.userId || null,
    createdAt: nowIso(),
    completedAt: nowIso(),
  });

  if (result.ok && !options.dryRun) {
    store.replaceAll(after);
  }
  return result;
}

function fail(code: string, message: string, checksum: string, dryRun: boolean): ImportResult {
  return {
    ok: false,
    dryRun,
    checksum,
    issues: [{ level: 'error', code, message }],
    diff: { tracksAdded: [], tracksUpdated: [], rulesAdded: [], rulesUpdated: [], contentAdded: [], warnings: [] },
  };
}

export function rejectUnknownDestinationPackage(store: ArchitectureStore, pkg: TrackPackage): ImportIssue[] {
  return pkg.routeRules.flatMap((rule) => {
    const id = normalizeTrackId(String(rule.destinationId || ''));
    if (rule.destinationType === 'TRACK' && id && !store.getTrack(id)) {
      return [{ level: 'error' as const, code: 'unknown_destination', message: id }];
    }
    return [];
  });
}
