import type {
  ArchiveEdgeRecord,
  ConnectionIndexEntry,
  ContentVersionRecord,
  EntitlementRecord,
  EntryRuleRecord,
  ImportRunRecord,
  ProductRecord,
  RouteDecisionRecord,
  RouteRuleRecord,
  TrackConnectionRecord,
  TrackDefinition,
  TrackInstanceRecord,
  TrackOutcomeRecord,
} from './types';
import {
  MemoryArchitectureStore,
  emptySnapshot,
  type ArchitectureStore,
  type StoreSnapshot,
} from './store';

export class ProductionRepositoryNotConfiguredError extends Error {
  readonly code = 'STORAGE_UNCONFIGURED';
  constructor(message = 'Production repository is not configured') {
    super(message);
    this.name = 'ProductionRepositoryNotConfiguredError';
  }
}

/**
 * Production storage is PostgreSQL. In-memory / .local is for tests and CLI only.
 * NODE_ENV=production never silently falls back to memory.
 */
export function isProductionRepositoryConfigured(env: NodeJS.Dict<string> = process.env): boolean {
  const kind = String(env.MLMA_ARCHITECTURE_STORE || '').toLowerCase();
  if (kind === 'memory' || kind === 'in-memory' || kind === 'local') return false;
  const url = String(env.DATABASE_URL || env.MLMA_DATABASE_URL || '').trim();
  return Boolean(url) && (kind === 'postgres' || kind === 'postgresql' || kind === '');
}

export interface PostgresClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface PayloadRow<T> {
  payload: T;
}

const TABLES = {
  tracks: 'track_definitions',
  rules: 'route_rules',
  entryRules: 'entry_rules',
  archive: 'archive_edges',
  connections: 'track_connections',
  connectionIndex: 'connection_index_entries',
  content: 'track_content_versions',
  products: 'products',
  entitlements: 'entitlements',
  instances: 'track_instances',
  outcomes: 'track_outcomes',
  decisions: 'route_decisions',
  importRuns: 'import_runs',
} as const;

function upsertSql(table: string): string {
  return `INSERT INTO ${table} (id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`;
}

function selectOneSql(table: string, column = 'id'): string {
  return `SELECT payload FROM ${table} WHERE ${column} = $1`;
}

function selectAllSql(table: string): string {
  return `SELECT payload FROM ${table}`;
}

function deleteAllSql(table: string): string {
  return `DELETE FROM ${table}`;
}

/**
 * PostgreSQL-compatible adapter. Does not open a production connection by itself.
 * Tests inject FakePostgresClient. Live pg wiring is a later, explicit step.
 */
export class PostgresArchitectureStore implements ArchitectureStore {
  private readonly cache = new MemoryArchitectureStore();

  constructor(private readonly client: PostgresClient) {
    if (!client) throw new ProductionRepositoryNotConfiguredError('Postgres client is required');
    this.hydrate();
  }

  private hydrate() {
    const snapshot: StoreSnapshot = {
      tracks: this.readAll<TrackDefinition>(TABLES.tracks),
      rules: this.readAll<RouteRuleRecord>(TABLES.rules),
      entryRules: this.readAll<EntryRuleRecord>(TABLES.entryRules),
      archiveEdges: this.readAll<ArchiveEdgeRecord>(TABLES.archive),
      connections: this.readAll<TrackConnectionRecord>(TABLES.connections),
      connectionIndex: this.readAll<ConnectionIndexEntry>(TABLES.connectionIndex),
      content: this.readAll<ContentVersionRecord>(TABLES.content),
      products: this.readAll<ProductRecord>(TABLES.products),
      entitlements: this.readAll<EntitlementRecord>(TABLES.entitlements),
      instances: this.readAll<TrackInstanceRecord>(TABLES.instances),
      outcomes: this.readAll<TrackOutcomeRecord>(TABLES.outcomes),
      decisions: this.readAll<RouteDecisionRecord>(TABLES.decisions),
      importRuns: this.readAll<ImportRunRecord>(TABLES.importRuns),
    };
    this.cache.replaceAll(snapshot);
  }

  private readAll<T>(table: string): T[] {
    return this.client.query<PayloadRow<T>>(selectAllSql(table)).map((row) => row.payload);
  }

  private persist(table: string, id: string, payload: unknown) {
    this.client.query(upsertSql(table), [id, JSON.stringify(payload)]);
  }

  private replaceTable(table: string, rows: { id: string; payload: unknown }[]) {
    this.client.query(deleteAllSql(table));
    for (const row of rows) this.persist(table, row.id, row.payload);
  }

  getTrack(id: string) {
    const rows = this.client.query<PayloadRow<TrackDefinition>>(selectOneSql(TABLES.tracks), [id]);
    return rows[0]?.payload ?? this.cache.getTrack(id);
  }
  listTracks() {
    return this.readAll<TrackDefinition>(TABLES.tracks).sort((a, b) => a.id.localeCompare(b.id));
  }
  upsertTrack(track: TrackDefinition) {
    this.persist(TABLES.tracks, track.id, track);
    this.cache.upsertTrack(track);
  }
  getRule(ruleId: string) {
    const rows = this.client.query<PayloadRow<RouteRuleRecord>>(selectOneSql(TABLES.rules, 'id'), [ruleId]);
    return rows[0]?.payload ?? this.cache.getRule(ruleId);
  }
  listRules() {
    return this.readAll<RouteRuleRecord>(TABLES.rules).sort(
      (a, b) => a.priority - b.priority || a.ruleId.localeCompare(b.ruleId),
    );
  }
  upsertRule(rule: RouteRuleRecord) {
    this.persist(TABLES.rules, rule.ruleId, rule);
    this.cache.upsertRule(rule);
  }
  replaceRules(rules: RouteRuleRecord[]) {
    this.replaceTable(
      TABLES.rules,
      rules.map((rule) => ({ id: rule.ruleId, payload: rule })),
    );
    this.cache.replaceRules(rules);
  }
  listEntryRules() {
    return this.readAll<EntryRuleRecord>(TABLES.entryRules);
  }
  replaceEntryRules(rules: EntryRuleRecord[]) {
    this.replaceTable(
      TABLES.entryRules,
      rules.map((rule) => ({ id: rule.entryRuleId, payload: rule })),
    );
    this.cache.replaceEntryRules(rules);
  }
  listArchiveEdges() {
    return this.readAll<ArchiveEdgeRecord>(TABLES.archive);
  }
  replaceArchiveEdges(edges: ArchiveEdgeRecord[]) {
    this.replaceTable(
      TABLES.archive,
      edges.map((edge) => ({ id: edge.edgeId, payload: edge })),
    );
    this.cache.replaceArchiveEdges(edges);
  }
  getConnection(id: string) {
    const rows = this.client.query<PayloadRow<TrackConnectionRecord>>(selectOneSql(TABLES.connections), [id]);
    return rows[0]?.payload ?? this.cache.getConnection(id);
  }
  listConnections() {
    return this.readAll<TrackConnectionRecord>(TABLES.connections).sort((a, b) =>
      a.connectionId.localeCompare(b.connectionId),
    );
  }
  replaceConnections(rows: TrackConnectionRecord[]) {
    this.replaceTable(
      TABLES.connections,
      rows.map((row) => ({ id: row.connectionId, payload: row })),
    );
    this.cache.replaceConnections(rows);
  }
  getConnectionIndex(id: string) {
    const rows = this.client.query<PayloadRow<ConnectionIndexEntry>>(selectOneSql(TABLES.connectionIndex), [id]);
    return rows[0]?.payload ?? this.cache.getConnectionIndex(id);
  }
  listConnectionIndex() {
    return this.readAll<ConnectionIndexEntry>(TABLES.connectionIndex).sort((a, b) => a.id.localeCompare(b.id));
  }
  replaceConnectionIndex(index: Record<string, ConnectionIndexEntry>) {
    this.replaceTable(
      TABLES.connectionIndex,
      Object.values(index).map((entry) => ({ id: entry.id, payload: entry })),
    );
    this.cache.replaceConnectionIndex(index);
  }
  getContent(trackId: string, version?: string) {
    if (version) {
      const rows = this.client.query<PayloadRow<ContentVersionRecord>>(
        `SELECT payload FROM ${TABLES.content} WHERE id = $1`,
        [`${trackId}:${version}`],
      );
      return rows[0]?.payload ?? this.cache.getContent(trackId, version);
    }
    return this.cache.getContent(trackId, version);
  }
  listContent() {
    return this.readAll<ContentVersionRecord>(TABLES.content);
  }
  upsertContent(record: ContentVersionRecord) {
    this.persist(TABLES.content, `${record.trackId}:${record.contentVersion}`, record);
    this.cache.upsertContent(record);
  }
  getProduct(code: string) {
    const rows = this.client.query<PayloadRow<ProductRecord>>(selectOneSql(TABLES.products), [code]);
    return rows[0]?.payload ?? this.cache.getProduct(code);
  }
  listProducts() {
    return this.readAll<ProductRecord>(TABLES.products);
  }
  upsertProduct(product: ProductRecord) {
    this.persist(TABLES.products, product.productCode, product);
    this.cache.upsertProduct(product);
  }
  listEntitlements(userId: string) {
    return this.readAll<EntitlementRecord>(TABLES.entitlements).filter((row) => row.userId === userId);
  }
  upsertEntitlement(row: EntitlementRecord) {
    this.persist(TABLES.entitlements, row.entitlementId, row);
    this.cache.upsertEntitlement(row);
  }
  getInstance(id: string) {
    const rows = this.client.query<PayloadRow<TrackInstanceRecord>>(selectOneSql(TABLES.instances), [id]);
    return rows[0]?.payload ?? this.cache.getInstance(id);
  }
  listInstances(userId: string) {
    return this.readAll<TrackInstanceRecord>(TABLES.instances).filter((row) => row.userId === userId);
  }
  upsertInstance(row: TrackInstanceRecord) {
    this.persist(TABLES.instances, row.instanceId, row);
    this.cache.upsertInstance(row);
  }
  findOutcomeByClientEvent(userId: string, clientEventId: string) {
    return this.cache.findOutcomeByClientEvent(userId, clientEventId);
  }
  insertOutcome(row: TrackOutcomeRecord) {
    this.persist(TABLES.outcomes, row.outcomeEventId, row);
    this.cache.insertOutcome(row);
  }
  insertDecision(row: RouteDecisionRecord) {
    this.persist(TABLES.decisions, row.decisionId, row);
    this.cache.insertDecision(row);
  }
  listDecisions(userId: string) {
    return this.readAll<RouteDecisionRecord>(TABLES.decisions).filter((row) => row.userId === userId);
  }
  insertImportRun(row: ImportRunRecord) {
    this.persist(TABLES.importRuns, row.importRunId, row);
    this.cache.insertImportRun(row);
  }
  listImportRuns() {
    return this.readAll<ImportRunRecord>(TABLES.importRuns);
  }
  snapshot(): StoreSnapshot {
    this.hydrate();
    return this.cache.snapshot();
  }
  replaceAll(snapshot: StoreSnapshot) {
    this.cache.replaceAll(emptySnapshot());
    this.replaceTable(
      TABLES.tracks,
      snapshot.tracks.map((row) => ({ id: row.id, payload: row })),
    );
    this.replaceTable(
      TABLES.rules,
      snapshot.rules.map((row) => ({ id: row.ruleId, payload: row })),
    );
    this.replaceTable(
      TABLES.entryRules,
      snapshot.entryRules.map((row) => ({ id: row.entryRuleId, payload: row })),
    );
    this.replaceTable(
      TABLES.archive,
      snapshot.archiveEdges.map((row) => ({ id: row.edgeId, payload: row })),
    );
    this.replaceTable(
      TABLES.connections,
      snapshot.connections.map((row) => ({ id: row.connectionId, payload: row })),
    );
    this.replaceTable(
      TABLES.connectionIndex,
      snapshot.connectionIndex.map((row) => ({ id: row.id, payload: row })),
    );
    this.replaceTable(
      TABLES.content,
      snapshot.content.map((row) => ({ id: `${row.trackId}:${row.contentVersion}`, payload: row })),
    );
    this.replaceTable(
      TABLES.products,
      snapshot.products.map((row) => ({ id: row.productCode, payload: row })),
    );
    this.replaceTable(
      TABLES.entitlements,
      snapshot.entitlements.map((row) => ({ id: row.entitlementId, payload: row })),
    );
    this.replaceTable(
      TABLES.instances,
      snapshot.instances.map((row) => ({ id: row.instanceId, payload: row })),
    );
    this.replaceTable(
      TABLES.outcomes,
      snapshot.outcomes.map((row) => ({ id: row.outcomeEventId, payload: row })),
    );
    this.replaceTable(
      TABLES.decisions,
      snapshot.decisions.map((row) => ({ id: row.decisionId, payload: row })),
    );
    this.replaceTable(
      TABLES.importRuns,
      snapshot.importRuns.map((row) => ({ id: row.importRunId, payload: row })),
    );
    this.cache.replaceAll(snapshot);
  }
}

/** In-memory SQL stand-in for tests. Not used when NODE_ENV=production. */
export class FakePostgresClient implements PostgresClient {
  readonly statements: { sql: string; params: unknown[] }[] = [];
  private readonly tables = new Map<string, Map<string, unknown>>();

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    this.statements.push({ sql, params });
    const table = sql.match(/(?:INTO|FROM|UPDATE)\s+(\w+)/i)?.[1];
    if (!table) return [];
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    const rows = this.tables.get(table)!;
    if (/^\s*DELETE FROM/i.test(sql)) {
      rows.clear();
      return [];
    }
    if (/^\s*INSERT INTO/i.test(sql)) {
      const id = String(params[0]);
      const payload = typeof params[1] === 'string' ? JSON.parse(String(params[1])) : params[1];
      rows.set(id, payload);
      return [];
    }
    if (/WHERE/i.test(sql)) {
      const payload = rows.get(String(params[0]));
      return payload !== undefined ? ([{ payload }] as T[]) : [];
    }
    return [...rows.values()].map((payload) => ({ payload })) as T[];
  }
}

export function createPostgresArchitectureStore(client: PostgresClient): ArchitectureStore {
  return new PostgresArchitectureStore(client);
}
