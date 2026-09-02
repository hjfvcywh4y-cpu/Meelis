import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const fail = m => { throw new Error(m); };
const eq = (a,e,l) => { if (a !== e) fail(l + ': expected ' + e + ', got ' + a); };
const same = (a,e,l) => { const x=[...a].sort(), y=[...e].sort(); if(JSON.stringify(x)!==JSON.stringify(y)) fail(l+': expected '+JSON.stringify(y)+', got '+JSON.stringify(x)); };
const noExtras=(o,a,l)=>{const x=Object.keys(o).filter(k=>!a.includes(k));if(x.length)fail(l+' forbidden fields: '+x.join(', '));};
const unique=(a,l)=>{if(new Set(a).size!==a.length)fail(l+' must be unique');};

const pkg=read('package.json');
const snap=read('graph/a3-016-connection-index-v3.json');
const content=read('content/content.json');
const experience=read('content/experience-design.json');
const reasonSchema=read('contracts/reason-card.schema.json');
const outcomeSchema=read('contracts/outcome-payload.schema.json');
const ai=read('ai/reason-critic-contract.json');
const entries=read('ai/entry-dataset.json');
const privacy=read('privacy/privacy-contract.json');
const analytics=read('analytics/analytics-contract.json');
const meta=read('public/public-meta.json');
const demo=read('demo/demo-sandbox.json');
const tests=read('tests/acceptance-cases.json');
const fixtures=read('tests/route-fixtures.json');

// track-package.schema.json v1 compatibility
noExtras(pkg,['packageVersion','track','graphBinding','content','access','outcomes','routeRules','privacy','source'],'package');
noExtras(pkg.track,['id','canonicalId','entityType','section','domain','title','situation','result','audience'],'track');
noExtras(pkg.graphBinding,['mode','graphVersion','editNeighborPages','unboundConnectionPolicy'],'graphBinding');
noExtras(pkg.content,['version','status','format','serverOnly','sourcePath','checksum','releaseNotes'],'content');
noExtras(pkg.access,['policy','productCodes'],'access');
noExtras(pkg.privacy,['serverAllowedFields','clientOnlyFields','analyticsAllowedFields'],'privacy');
noExtras(pkg.source,['files','owner','approvedAt'],'source');
for(const o of pkg.outcomes){noExtras(o,['code','label','observableFact','requiredFacts'],'outcome '+o.code);if(!/^[A-Z][A-Z0-9_]*$/.test(o.code))fail('bad outcome '+o.code);unique(o.requiredFacts||[],'facts '+o.code);}
for(const r of pkg.routeRules){noExtras(r,['ruleId','fromId','outcomeCode','field','operator','value','destinationType','destinationId','reason','stopRule','recoveryRule','priority','owner','version','status'],'rule '+r.ruleId);if(!/^RR[0-9A-Z-]+$/.test(r.ruleId))fail('bad rule '+r.ruleId);}
unique(pkg.access.productCodes,'product codes');
for(const k of ['serverAllowedFields','clientOnlyFields','analyticsAllowedFields'])unique(pkg.privacy[k],k);

eq(pkg.track.id,'A3-016','track id');
eq(pkg.track.entityType,'REMEDIATION','entity type');
eq(pkg.content.version,'0.1.0','content version');
eq(pkg.content.status,'REVIEW','content status');
eq(pkg.content.serverOnly,true,'serverOnly');
eq(pkg.graphBinding.graphVersion,'3.0','graph version');
eq(pkg.graphBinding.editNeighborPages,false,'neighbor editing');
eq(pkg.outcomes.length,3,'outcomes');
eq(pkg.routeRules.length,3,'package rules');
same(pkg.routeRules.map(r=>r.ruleId),['RR2-012','RR2-013','RR3-A3-016-STOP'],'package rule ids');
if(pkg.routeRules.some(r=>r.status!=='PILOT_DRAFT_TO_TEST'))fail('rules must remain PILOT_DRAFT_TO_TEST');

eq(snap.connectionIndex.incomingDesignConnections.length,4,'incoming design');
eq(snap.connectionIndex.incomingEffectiveConnections.length,5,'incoming effective');
eq(snap.connectionIndex.outgoingDesignConnections.length,2,'outgoing design');
eq(snap.connectionIndex.outgoingEffectiveConnections.length,3,'outgoing effective');
same(snap.inboundRouteRules.map(r=>r.ruleId),['RR2-009','RR2-015'],'incoming rules');
same(snap.outboundBaseRouteRules.map(r=>r.ruleId),['RR2-012','RR2-013'],'base outgoing rules');
eq(snap.connectionIndex.externalEntryRuleIds.length,0,'external entry');
eq(snap.embeddedCanonicalComponent.id,'A6-027','embedded id');
eq(snap.embeddedCanonicalComponent.canonicalId,'A3-016','embedded canonical');

eq(content.steps.length,9,'content steps');
eq(content.finalArtifact.storage,'CLIENT_LOCAL','local artifact');
if(!experience.topology.includes('REMEDIATION_BYPASS'))fail('missing remediation topology');
eq(reasonSchema.additionalProperties,false,'reason card unknown fields');
eq(outcomeSchema.additionalProperties,false,'outcome unknown fields');

eq(ai.optional,true,'AI optional');
eq(ai.defaultEnabled,false,'AI default');
eq(ai.output.advisoryOnly,true,'AI advisory');
eq(ai.output.deterministicGateStillRequired,true,'deterministic gate');
eq(ai.modes.STRUCTURED_REVIEW.freeText,false,'structured mode text');
eq(ai.modes.SANITIZED_TEXT_REVIEW.requiresExplicitConsent,true,'AI consent');
eq(ai.modes.SANITIZED_TEXT_REVIEW.persistence,false,'AI persistence');
eq(entries.liveEntryAllowedByThisDataset,false,'dataset live entry');

const clientOnly=new Set(privacy.clientOnlyFields);
for(const f of privacy.serverAllowedFields)if(clientOnly.has(f))fail('privacy overlap '+f);
for(const f of privacy.analyticsAllowedFields)if(clientOnly.has(f))fail('analytics privacy overlap '+f);
if(!analytics.forbiddenFields.includes('sanitized_reason_draft'))fail('sanitized AI input must be analytics-forbidden');
eq(meta.bodyAvailable,false,'public body');
eq(demo.liveInstance,false,'sandbox instance');
eq(demo.writesAllowed,false,'sandbox writes');
eq(demo.routeEngineExecutionAllowed,false,'sandbox routes');
eq(demo.aiMode,'PRECOMPUTED_ONLY','sandbox AI');
eq(tests.cases.length,48,'acceptance cases');
eq(fixtures.cases.length,12,'route fixtures');
if(tests.cases.some(t=>t.status!=='MUST_PASS'))fail('all acceptance tests must pass');

console.log('A3-016 PACKAGE VALID');
console.log('entity=REMEDIATION version=0.1.0 status=REVIEW steps=9 outcomes=3');
console.log('graph incoming=4/5 outgoing=2/3 incomingRules=2 baseOutgoingRules=2 terminalOverlay=1');
console.log('AI optional=true default=false advisoryOnly=true freeTextDefault=false');
console.log('acceptance=48 fixtures=12 sandboxLive=false datasetLiveEntry=false');
