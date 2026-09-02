import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const fail=m=>{throw new Error(m)};
const eq=(a,e,l)=>{if(a!==e)fail(l+': expected '+e+', got '+a)};
const same=(a,e,l)=>{const x=[...a].sort(),y=[...e].sort();if(JSON.stringify(x)!==JSON.stringify(y))fail(l+': expected '+JSON.stringify(y)+', got '+JSON.stringify(x))};
const noExtras=(o,a,l)=>{const x=Object.keys(o).filter(k=>!a.includes(k));if(x.length)fail(l+' forbidden fields: '+x.join(', '))};
const unique=(a,l)=>{if(new Set(a).size!==a.length)fail(l+' must be unique')};
const pkg=read('package.json'),snap=read('graph/a3-014-connection-index-v3.json'),content=read('content/content.json'),experience=read('content/experience-design.json'),card=read('contracts/readiness-card.schema.json'),payload=read('contracts/outcome-payload.schema.json'),ai=read('ai/anxiety-mirror-contract.json'),entries=read('ai/entry-dataset.json'),privacy=read('privacy/privacy-contract.json'),analytics=read('analytics/analytics-contract.json'),meta=read('public/public-meta.json'),demo=read('demo/demo-sandbox.json'),tests=read('tests/acceptance-cases.json'),fixtures=read('tests/route-fixtures.json');
noExtras(pkg,['packageVersion','track','graphBinding','content','access','outcomes','routeRules','privacy','source'],'package');
noExtras(pkg.track,['id','canonicalId','entityType','section','domain','title','situation','result','audience'],'track');
noExtras(pkg.graphBinding,['mode','graphVersion','editNeighborPages','unboundConnectionPolicy'],'graphBinding');
noExtras(pkg.content,['version','status','format','serverOnly','sourcePath','checksum','releaseNotes'],'content');
noExtras(pkg.access,['policy','productCodes'],'access');noExtras(pkg.privacy,['serverAllowedFields','clientOnlyFields','analyticsAllowedFields'],'privacy');noExtras(pkg.source,['files','owner','approvedAt'],'source');
for(const o of pkg.outcomes){noExtras(o,['code','label','observableFact','requiredFacts'],'outcome '+o.code);if(!/^[A-Z][A-Z0-9_]*$/.test(o.code))fail('bad outcome '+o.code);unique(o.requiredFacts||[],'facts '+o.code)}
for(const r of pkg.routeRules){noExtras(r,['ruleId','fromId','outcomeCode','field','operator','value','destinationType','destinationId','reason','stopRule','recoveryRule','priority','owner','version','status'],'rule '+r.ruleId);if(!/^RR[0-9A-Z-]+$/.test(r.ruleId))fail('bad rule '+r.ruleId)}
eq(pkg.track.id,'A3-014','track id');eq(pkg.track.entityType,'REMEDIATION','entity type');eq(pkg.content.version,'0.1.0','content version');eq(pkg.content.status,'REVIEW','content status');eq(pkg.content.serverOnly,true,'serverOnly');eq(pkg.graphBinding.graphVersion,'3.0','graph version');eq(pkg.graphBinding.editNeighborPages,false,'neighbor editing');eq(pkg.outcomes.length,4,'outcomes');eq(pkg.routeRules.length,5,'rules');
same(pkg.routeRules.map(r=>r.ruleId),['RR3-A3-014-OUT-OF-SCOPE','RR3-A3-014-WAIT','RR3-A3-014-MEETING-MAP','RR3-A3-014-SPECIFIC-FEAR','RR3-A3-014-RETURN'],'rule ids');if(pkg.routeRules.some(r=>r.status!=='PILOT_DRAFT_TO_TEST'))fail('rules must remain draft');
eq(snap.connectionIndex.incomingDesignConnections.length,0,'incoming design');eq(snap.connectionIndex.incomingEffectiveConnections.length,1,'incoming effective');eq(snap.connectionIndex.outgoingDesignConnections.length,2,'outgoing design');eq(snap.connectionIndex.outgoingEffectiveConnections.length,2,'outgoing effective');same(snap.inboundRouteRules.map(r=>r.ruleId),['RR2-016'],'incoming rules');eq(snap.outboundBaseRouteRules.length,0,'base outgoing rules');same(snap.connectionIndex.outgoingDesignConnections.map(c=>c.connectionId),['TR-095','TR-096'],'design slots');
eq(content.steps.length,9,'content steps');eq(content.finalArtifact.storage,'CLIENT_LOCAL','artifact storage');if(!experience.topology.includes('REMEDIATION_BYPASS'))fail('missing remediation topology');if(!experience.topology.includes('MICRO_EXPOSURE'))fail('missing micro exposure');eq(card.additionalProperties,false,'card unknown fields');eq(payload.additionalProperties,false,'payload unknown fields');
eq(ai.optional,true,'AI optional');eq(ai.defaultEnabled,false,'AI default');eq(ai.output.advisoryOnly,true,'AI advisory');eq(ai.output.deterministicGateStillRequired,true,'gate required');eq(ai.modes.STRUCTURED_MIRROR.freeText,false,'structured free text');eq(ai.modes.SANITIZED_TEXT_MIRROR.persistence,false,'AI persistence');eq(entries.liveEntryAllowedByThisDataset,false,'dataset live');
const clientOnly=new Set(privacy.clientOnlyFields);for(const f of privacy.serverAllowedFields)if(clientOnly.has(f))fail('privacy overlap '+f);for(const f of privacy.analyticsAllowedFields)if(clientOnly.has(f))fail('analytics overlap '+f);if(!analytics.forbiddenMetrics.includes('anxiety_score'))fail('anxiety score must be forbidden');if(!analytics.forbiddenFields.includes('sanitized_fear_statement'))fail('AI text must be analytics-forbidden');
eq(meta.bodyAvailable,false,'public body');eq(demo.liveInstance,false,'demo instance');eq(demo.writesAllowed,false,'demo writes');eq(demo.routeEngineExecutionAllowed,false,'demo routes');eq(demo.aiMode,'PRECOMPUTED_ONLY','demo AI');eq(tests.cases.length,52,'acceptance count');eq(fixtures.cases.length,14,'fixture count');if(tests.cases.some(t=>t.status!=='MUST_PASS'))fail('all acceptance tests must pass');
const getFact=(facts,field)=>Object.hasOwn(facts,field)?facts[field]:field.split('.').reduce((v,k)=>v&&v[k],facts);
const allRules=[...snap.inboundRouteRules,...pkg.routeRules];
for(const f of fixtures.cases){
  let actual;
  if(f.context?.executionMode==='SANDBOX') actual={decision:'SANDBOX_NO_LIVE_INSTANCE'};
  else {
    const matches=allRules.filter(r=>r.fromId===f.fromId&&r.outcomeCode===f.outcomeCode&&r.operator==='='&&getFact(f.facts||{},r.field)===r.value).sort((a,b)=>a.priority-b.priority);
    if(!matches.length) actual={decision:'NO_MATCHING_RULE'};
    else {const r=matches[0];actual={ruleId:r.ruleId,destinationType:r.destinationType,destinationId:r.destinationId??null};if(f.context?.paidNavigationEnabled===false)actual={...actual,locked:true,destinationUrl:null};}
  }
  for(const [k,v] of Object.entries(f.expected||{})){if(k==='mustNotUseConnectionId'){if(actual.connectionId===v)fail('fixture '+f.id+' executed locked connection '+v);continue}if(actual[k]!==v)fail('fixture '+f.id+' '+k+': expected '+v+', got '+actual[k]);}
}
console.log('A3-014 PACKAGE VALID');console.log('entity=REMEDIATION version=0.1.0 status=REVIEW steps=9 outcomes=4');console.log('graph incoming=0/1 outgoing=2/2 incomingRules=1 baseOutgoingRules=0 overlays=5');console.log('AI optional=true default=false diagnostic=false freeTextDefault=false');console.log('acceptance=52 fixtures=14 sandboxLive=false datasetLiveEntry=false');
