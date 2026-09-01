import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const pkg = read('package.json');
const content = read('content/content.json');
const entries = read('ai/entry-dataset.json');
const tests = read('tests/acceptance-cases.json');
const analytics = read('analytics/analytics-contract.json');
const demo = read('demo/demo-sandbox.json');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const trackId = /^A[1-6]-[0-9]{3}$/;
const outcomeCode = /^[A-Z][A-Z0-9_]*$/;
const ruleId = /^RR[0-9A-Z-]+$/;

check(pkg.packageVersion === '1.0', 'packageVersion must be 1.0');
check(pkg.track?.id === 'A3-002' && trackId.test(pkg.track.id), 'invalid Track ID');
check(pkg.track?.canonicalId === 'A3-002', 'invalid canonical ID');
check(pkg.track?.entityType === 'TRACK', 'entityType must be TRACK');
check(pkg.graphBinding?.mode === 'AUTO_BY_TRACK_ID', 'invalid graph binding mode');
check(pkg.graphBinding?.graphVersion === '3.0', 'graph version must be 3.0');
check(pkg.graphBinding?.editNeighborPages === false, 'neighbor pages must not be edited');
check(pkg.graphBinding?.unboundConnectionPolicy === 'KEEP_AS_LOCKED_NEXT_ACTION_SLOT', 'invalid unbound policy');
check(pkg.content?.status === 'REVIEW', 'content must remain REVIEW');
check(pkg.content?.serverOnly === true, 'content must be server-only');
check(pkg.access?.policy === 'ENTITLED', 'paid package must be ENTITLED');
check(Array.isArray(pkg.access?.productCodes) && pkg.access.productCodes.length > 0, 'product code required');
check(Array.isArray(pkg.outcomes) && pkg.outcomes.length === 4, 'four outcomes required');
for (const outcome of pkg.outcomes || []) {
  check(outcomeCode.test(outcome.code || ''), `invalid outcome code ${outcome.code}`);
  check(Boolean(outcome.label && outcome.observableFact), `incomplete outcome ${outcome.code}`);
}
check(Array.isArray(pkg.routeRules) && pkg.routeRules.length === 4, 'four route rules required');
for (const rule of pkg.routeRules || []) {
  check(ruleId.test(rule.ruleId || ''), `invalid rule ID ${rule.ruleId}`);
  check(rule.fromId === 'A3-002', `wrong fromId in ${rule.ruleId}`);
  check(outcomeCode.test(rule.outcomeCode || ''), `invalid outcome in ${rule.ruleId}`);
  check(rule.status === 'PILOT_DRAFT_TO_TEST', `${rule.ruleId} must remain pilot draft`);
  check(Number.isInteger(rule.priority) && rule.priority >= 0, `invalid priority in ${rule.ruleId}`);
}
const packageCodes = new Set(pkg.outcomes.map((item) => item.code));
const completionCodes = new Set(content.completion?.successCodes || []);
check(packageCodes.size === completionCodes.size && [...packageCodes].every((code) => completionCodes.has(code)), 'content/package outcome mismatch');
check(entries.cases?.length === 30, 'entry dataset must contain 30 cases');
check(tests.cases?.length >= 20, 'at least 20 acceptance cases required');
check(demo.createsLiveInstance === false && demo.writesOutcome === false && demo.executesRoute === false, 'sandbox isolation invalid');
const forbidden = new Set(analytics.globallyForbiddenProperties || []);
for (const field of ['contact_name', 'phone', 'email', 'real_reason_text', 'message_text']) {
  check(forbidden.has(field), `analytics must forbid ${field}`);
}
for (const file of [
  'public/public-meta.json',
  'demo/demo-sandbox.json',
  'ai/message-assistant-contract.json',
  'analytics/analytics-contract.json',
  'tests/acceptance-cases.json'
]) read(file);

if (errors.length) {
  console.error(JSON.stringify({ status: 'FAIL', errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  status: 'PASS',
  trackId: pkg.track.id,
  contentVersion: pkg.content.version,
  outcomes: pkg.outcomes.length,
  routeRules: pkg.routeRules.length,
  entryCases: entries.cases.length,
  acceptanceCases: tests.cases.length,
  serverOnly: pkg.content.serverOnly,
  demoIsolated: true
}, null, 2));
