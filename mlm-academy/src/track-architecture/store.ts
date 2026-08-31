import { createHash, randomUUID } from 'node:crypto';

import type {
  ArchiveEdgeRecord,
  ContentVersionRecord,
  EntitlementRecord,
  EntryRuleRecord,
  ImportRunRecord,
  ProductRecord,
  PublicationStatus,
  RouteDecisionRecord,
  RouteRuleRecord,
  TrackConnectionRecord,
  TrackDefinition,
  TrackInstanceRecord,
  TrackOutcomeRecord,
  ConnectionIndexEntry,
} from './types';

export interface ArchitectureStore {
  getTrack(id: string): TrackDefinition | undefined;
  listTracks(): TrackDefinition[];
  upsertTrack(track: TrackDefinition): void;
  getRule(ruleId: string): RouteRuleRecord | undefined;
  listRules(): RouteRuleRecord[];
  upsertRule(rule: RouteRuleRecord): void;
  replaceRules(rules: RouteRuleRecord[]): void;
  listEntryRules(): EntryRuleRecord[];
  replaceEntryRules(rules: EntryRuleRecord[]): void;
  listArchiveEdges(): ArchiveEdgeRecord[];
  replaceArchiveEdges(edges: ArchiveEdgeRecord[]): void;
  getConnection(id: string): TrackConnectionRecord | undefined;
  listConnections(): TrackConnectionRecord[];
  replaceConnections(rows: TrackConnectionRecord[]): void;
  getConnectionIndex(id: string): ConnectionIndexEntry | undefined;
  listConnectionIndex(): ConnectionIndexEntry[];
  replaceConnectionIndex(index: Record<string, ConnectionIndexEntry>): void;
  getContent(trackId: string, version?: string): ContentVersionRecord | undefined;
  listContent(): ContentVersionRecord[];
  upsertContent(record: ContentVersionRecord): void;
  getProduct(code: string): ProductRecord | undefined;
  listProducts(): ProductRecord[];
  upsertProduct(product: ProductRecord): void;
  listEntitlements(userId: string): EntitlementRecord[];
  upsertEntitlement(row: EntitlementRecord): void;
  getInstance(id: string): TrackInstanceRecord | undefined;
  listInstances(userId: string): TrackInstanceRecord[];
  upsertInstance(row: TrackInstanceRecord): void;
  findOutcomeByClientEvent(userId: string, clientEventId: string): TrackOutcomeRecord | undefined;
  insertOutcome(row: TrackOutcomeRecord): void;
  insertDecision(row: RouteDecisionRecord): void;
  listDecisions(userId: string): RouteDecisionRecord[];
  insertImportRun(row: ImportRunRecord): void;
  listImportRuns(): ImportRunRecord[];
  snapshot(): StoreSnapshot;
  replaceAll(snapshot: StoreSnapshot): void;
}

export function connectionsForTrack(store: ArchitectureStore, trackId: string) {
  const id = trackId.toUpperCase();
  const all = store.listConnections();
  return {
    incoming: all.filter((row) => row.toId === id),
    outgoing: all.filter((row) => row.fromId === id),
  };
}

export interface StoreSnapshot {
  tracks: TrackDefinition[];
  rules: RouteRuleRecord[];
  entryRules: EntryRuleRecord[];
  archiveEdges: ArchiveEdgeRecord[];
  connections: TrackConnectionRecord[];
  connectionIndex: ConnectionIndexEntry[];
  content: ContentVersionRecord[];
  products: ProductRecord[];
  entitlements: EntitlementRecord[];
  instances: TrackInstanceRecord[];
  outcomes: TrackOutcomeRecord[];
  decisions: RouteDecisionRecord[];
  importRuns: ImportRunRecord[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryArchitectureStore implements ArchitectureStore {
  private tracks = new Map<string, TrackDefinition>();
  private rules = new Map<string, RouteRuleRecord>();
  private entryRules = new Map<string, EntryRuleRecord>();
  private archiveEdges: ArchiveEdgeRecord[] = [];
  private connections = new Map<string, TrackConnectionRecord>();
  private connectionIndex = new Map<string, ConnectionIndexEntry>();
  private content = new Map<string, ContentVersionRecord>();
  private products = new Map<string, ProductRecord>();
  private entitlements = new Map<string, EntitlementRecord>();
  private instances = new Map<string, TrackInstanceRecord>();
  private outcomes = new Map<string, TrackOutcomeRecord>();
  private outcomesByClient = new Map<string, string>();
  private decisions = new Map<string, RouteDecisionRecord>();
  private importRuns: ImportRunRecord[] = [];

  getTrack(id: string) {
    return this.tracks.get(id);
  }
  listTracks() {
    return [...this.tracks.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
  upsertTrack(track: TrackDefinition) {
    this.tracks.set(track.id, clone(track));
  }
  getRule(ruleId: string) {
    return this.rules.get(ruleId);
  }
  listRules() {
    return [...this.rules.values()].sort((a, b) => a.priority - b.priority || a.ruleId.localeCompare(b.ruleId));
  }
  upsertRule(rule: RouteRuleRecord) {
    this.rules.set(rule.ruleId, clone(rule));
  }
  replaceRules(rules: RouteRuleRecord[]) {
    this.rules.clear();
    for (const rule of rules) this.upsertRule(rule);
  }
  listEntryRules() {
    return [...this.entryRules.values()];
  }
  replaceEntryRules(rules: EntryRuleRecord[]) {
    this.entryRules.clear();
    for (const rule of rules) this.entryRules.set(rule.entryRuleId, clone(rule));
  }
  listArchiveEdges() {
    return this.archiveEdges.slice();
  }
  replaceArchiveEdges(edges: ArchiveEdgeRecord[]) {
    this.archiveEdges = clone(edges);
  }
  getConnection(id: string) {
    return this.connections.get(id);
  }
  listConnections() {
    return [...this.connections.values()].sort((a, b) => a.connectionId.localeCompare(b.connectionId));
  }
  replaceConnections(rows: TrackConnectionRecord[]) {
    this.connections.clear();
    for (const row of rows) this.connections.set(row.connectionId, clone(row));
  }
  getConnectionIndex(id: string) {
    return this.connectionIndex.get(id);
  }
  listConnectionIndex() {
    return [...this.connectionIndex.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
  replaceConnectionIndex(index: Record<string, ConnectionIndexEntry>) {
    this.connectionIndex.clear();
    for (const [id, entry] of Object.entries(index)) this.connectionIndex.set(id, clone(entry));
  }
  getContent(trackId: string, version?: string) {
    if (version) return this.content.get(`${trackId}:${version}`);
    const rows = [...this.content.values()]
      .filter((row) => row.trackId === trackId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return rows[0];
  }
  listContent() {
    return [...this.content.values()];
  }
  upsertContent(record: ContentVersionRecord) {
    this.content.set(`${record.trackId}:${record.contentVersion}`, clone({
      accessTier: 'PAID',
      executionMode: 'LIVE',
      ...record,
    }));
  }
  getProduct(code: string) {
    return this.products.get(code);
  }
  listProducts() {
    return [...this.products.values()];
  }
  upsertProduct(product: ProductRecord) {
    this.products.set(product.productCode, clone(product));
  }
  listEntitlements(userId: string) {
    return [...this.entitlements.values()].filter((row) => row.userId === userId);
  }
  upsertEntitlement(row: EntitlementRecord) {
    this.entitlements.set(row.entitlementId, clone(row));
  }
  getInstance(id: string) {
    return this.instances.get(id);
  }
  listInstances(userId: string) {
    return [...this.instances.values()].filter((row) => row.userId === userId);
  }
  upsertInstance(row: TrackInstanceRecord) {
    this.instances.set(row.instanceId, clone(row));
  }
  findOutcomeByClientEvent(userId: string, clientEventId: string) {
    const id = this.outcomesByClient.get(`${userId}:${clientEventId}`);
    return id ? this.outcomes.get(id) : undefined;
  }
  insertOutcome(row: TrackOutcomeRecord) {
    this.outcomes.set(row.outcomeEventId, clone(row));
    this.outcomesByClient.set(`${row.userId}:${row.clientEventId}`, row.outcomeEventId);
  }
  insertDecision(row: RouteDecisionRecord) {
    this.decisions.set(row.decisionId, clone(row));
  }
  listDecisions(userId: string) {
    return [...this.decisions.values()].filter((row) => row.userId === userId);
  }
  insertImportRun(row: ImportRunRecord) {
    this.importRuns.push(clone(row));
  }
  listImportRuns() {
    return this.importRuns.slice();
  }
  snapshot(): StoreSnapshot {
    return {
      tracks: this.listTracks(),
      rules: this.listRules(),
      entryRules: this.listEntryRules(),
      archiveEdges: this.listArchiveEdges(),
      connections: this.listConnections(),
      connectionIndex: this.listConnectionIndex(),
      content: this.listContent(),
      products: this.listProducts(),
      entitlements: [...this.entitlements.values()],
      instances: [...this.instances.values()],
      outcomes: [...this.outcomes.values()],
      decisions: [...this.decisions.values()],
      importRuns: this.listImportRuns(),
    };
  }
  replaceAll(snapshot: StoreSnapshot) {
    this.tracks.clear();
    this.rules.clear();
    this.entryRules.clear();
    this.content.clear();
    this.products.clear();
    this.entitlements.clear();
    this.instances.clear();
    this.outcomes.clear();
    this.outcomesByClient.clear();
    this.decisions.clear();
    for (const track of snapshot.tracks) this.upsertTrack(track);
    this.replaceRules(snapshot.rules);
    this.replaceEntryRules(snapshot.entryRules);
    this.replaceArchiveEdges(snapshot.archiveEdges);
    this.replaceConnections(snapshot.connections || []);
    const index: Record<string, ConnectionIndexEntry> = {};
    for (const entry of snapshot.connectionIndex || []) index[entry.id] = entry;
    this.replaceConnectionIndex(index);
    for (const row of snapshot.content) this.upsertContent(row);
    for (const row of snapshot.products) this.upsertProduct(row);
    for (const row of snapshot.entitlements) this.upsertEntitlement(row);
    for (const row of snapshot.instances) this.upsertInstance(row);
    for (const row of snapshot.outcomes) this.insertOutcome(row);
    for (const row of snapshot.decisions) this.insertDecision(row);
    this.importRuns = clone(snapshot.importRuns);
  }
}

export function emptySnapshot(): StoreSnapshot {
  return {
    tracks: [],
    rules: [],
    entryRules: [],
    archiveEdges: [],
    connections: [],
    connectionIndex: [],
    content: [],
    products: [],
    entitlements: [],
    instances: [],
    outcomes: [],
    decisions: [],
    importRuns: [],
  };
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function newId(prefix = 'id'): string {
  return `${prefix}_${randomUUID()}`;
}

export function nowIso(now?: string): string {
  return now || new Date().toISOString();
}

export function publicationFromImplementation(status: string): PublicationStatus {
  if (status === 'PILOT_LIVE_NEEDS_V2') return 'PUBLISHED';
  return 'PLANNED';
}
