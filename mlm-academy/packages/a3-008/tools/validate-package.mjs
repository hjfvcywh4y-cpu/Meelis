import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const fail = (message) => { throw new Error(message); };
const eq = (actual, expected, label) => { if (actual !== expected) fail(label + ': expected ' + expected + ', got ' + actual); };
const same = (actual, expected, label) => {
  const a = [...actual].sort(); const e = [...expected].sort();
  if (JSON.stringify(a) !== JSON.stringify(e)) fail(label + ': expected ' + JSON.stringify(e) + ', got ' + JSON.stringify(a));
};

const pkg = read('package.json');
const graph = read('graph/a3-008-connection-index-v3.json');
const ui = read('system-ui/ui-definition.json');
const privacy = read('privacy/privacy-contract.json');
const api = read('api/api-contract.json');
const storage = read('storage/storage-contract.json');
const adapters = read('adapters/source-outcome-mappings.json');
const sandbox = read('sandbox/sandbox-contract.json');
const tests = read('tests/acceptance-cases.json');
const fixtures = read('tests/route-fixtures.json');
const requestSchema = read('contracts/outcome-recorder.schema.json');

const noExtras = (object, allowed, label) => {
  const extras = Object.keys(object).filter(key => !allowed.includes(key));
  if (extras.length) fail(label + ' has fields forbidden by track-package.schema.json: ' + extras.join(', '));
};
const unique = (values, label) => {
  if (new Set(values).size !== values.length) fail(label + ' must contain unique items');
};

// Exact compatibility with spec/track-architecture/track-package.schema.json v1.
noExtras(pkg, ['packageVersion','track','graphBinding','content','access','outcomes','routeRules','privacy','source'], 'package');
noExtras(pkg.track, ['id','canonicalId','entityType','section','domain','title','situation','result','audience'], 'track');
noExtras(pkg.graphBinding, ['mode','graphVersion','editNeighborPages','unboundConnectionPolicy'], 'graphBinding');
noExtras(pkg.content, ['version','status','format','serverOnly','sourcePath','checksum','releaseNotes'], 'content');
noExtras(pkg.access, ['policy','productCodes'], 'access');
noExtras(pkg.privacy, ['serverAllowedFields','clientOnlyFields','analyticsAllowedFields'], 'privacy');
noExtras(pkg.source, ['files','owner','approvedAt'], 'source');
for (const outcome of pkg.outcomes) {
  noExtras(outcome, ['code','label','observableFact','requiredFacts'], 'outcome ' + outcome.code);
  if (!/^[A-Z][A-Z0-9_]*$/.test(outcome.code)) fail('Invalid outcome code: ' + outcome.code);
  unique(outcome.requiredFacts ?? [], 'requiredFacts ' + outcome.code);
}
for (const rule of pkg.routeRules) {
  noExtras(rule, ['ruleId','fromId','outcomeCode','field','operator','value','destinationType','destinationId','reason','stopRule','recoveryRule','priority','owner','version','status'], 'routeRule ' + rule.ruleId);
  if (!/^RR[0-9A-Z-]+$/.test(rule.ruleId)) fail('Invalid rule id: ' + rule.ruleId);
  if (!/^A[1-6]-[0-9]{3}$/.test(rule.fromId)) fail('Invalid fromId: ' + rule.fromId);
}
unique(pkg.access.productCodes, 'productCodes');
unique(pkg.privacy.serverAllowedFields, 'serverAllowedFields');
unique(pkg.privacy.clientOnlyFields, 'clientOnlyFields');
unique(pkg.privacy.analyticsAllowedFields, 'analyticsAllowedFields');

eq(pkg.track.id, 'A3-008', 'track id');
eq(pkg.track.entityType, 'SYSTEM_ACTION', 'entity type');
eq(pkg.content.status, 'REVIEW', 'content status');
eq(pkg.content.format, 'system-ui', 'content format');
eq(pkg.graphBinding.graphVersion, '3.0', 'graph version');
eq(pkg.graphBinding.editNeighborPages, false, 'editNeighborPages');
eq(pkg.routeRules.length, 6, 'route rules');
eq(pkg.outcomes.length, 6, 'outcomes');
same(pkg.routeRules.map(r => r.ruleId), ['RR2-026','RR2-027','RR2-028','RR2-029','RR2-030','RR2-031'], 'outgoing rule ids');
if (pkg.routeRules.some(r => r.status !== 'PILOT_DRAFT_TO_TEST')) fail('All A3-008 rules must remain PILOT_DRAFT_TO_TEST');

eq(graph.expectedCounts.incomingDesignConnections, 6, 'incoming design count');
eq(graph.expectedCounts.incomingEffectiveConnections, 6, 'incoming effective count');
eq(graph.expectedCounts.outgoingDesignConnections, 2, 'outgoing design count');
eq(graph.expectedCounts.outgoingEffectiveConnections, 6, 'outgoing effective count');
eq(graph.expectedCounts.outgoingRouteRules, 6, 'outgoing RouteRule count');
eq(graph.expectedCounts.inboundSystemActionInvocationRules, 3, 'inbound invocation count');
eq(graph.connectionIndex.incomingEffectiveConnections.length, 6, 'snapshot incoming effective');
eq(graph.connectionIndex.outgoingEffectiveConnections.length, 6, 'snapshot outgoing effective');
same(graph.inboundSystemActionInvocationRules.map(r => r.ruleId), ['RR2-014','RR2-017','RR2-020'], 'inbound invocation ids');

eq(ui.createsStandaloneTrackPage, false, 'standalone page');
eq(ui.createsTrackInstance, false, 'track instance');
eq(ui.requiresSourceTrackInstance, true, 'source instance');
eq(ui.choices.length, 6, 'UI choices');
eq(adapters.activeInvocations.length, 3, 'active adapters');
eq(sandbox.liveInstance, false, 'sandbox live instance');
eq(sandbox.writesAllowed, false, 'sandbox writes');
eq(sandbox.routeEngineExecutionAllowed, false, 'sandbox route engine');
eq(api.endpoint.path, '/api/v1/track-instances/:sourceInstanceId/outcomes', 'API path');
eq(storage.logicalRecords.outcomeEvent.immutable, true, 'outcome immutability');
eq(storage.noParallelDatabase, true, 'parallel database prohibition');
eq(tests.cases.length, 40, 'acceptance cases');
eq(fixtures.cases.length, 12, 'route fixtures');
if (tests.cases.some(t => t.status !== 'MUST_PASS')) fail('All acceptance cases must be MUST_PASS');

const clientOnly = new Set(privacy.clientOnlyFields);
for (const field of privacy.serverAllowedFields) if (clientOnly.has(field)) fail('Privacy overlap: ' + field);
for (const field of privacy.analyticsAllowedFields) if (clientOnly.has(field)) fail('Analytics privacy overlap: ' + field);
if (privacy.aiPolicy.aiRequired !== false || privacy.aiPolicy.sendToAi.length !== 0) fail('A3-008 must not call AI');
if (requestSchema.additionalProperties !== false) fail('Request schema must reject unknown fields');

console.log('A3-008 PACKAGE VALID');
console.log('id=A3-008 entity=SYSTEM_ACTION version=0.1.0 status=REVIEW');
console.log('rules=6 inboundInvocations=3 incomingEffective=6 outgoingEffective=6 acceptance=40');
console.log('standalonePage=false createsTrackInstance=false sandboxWrites=false aiRequired=false');
