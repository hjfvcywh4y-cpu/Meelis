import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const graph = JSON.parse(fs.readFileSync(path.resolve(here, '../full-graph-112-v3.json'), 'utf8'));
const expected = {
  nodes: 112,
  designConnections: 231,
  ruleDerivedConnections: 22,
  effectiveTrackConnections: 253,
  structuredRouteRules: 58,
  connectionIndex: 112,
  nodesWithoutEffectiveIncoming: 36,
};
const actual = {
  nodes: graph.nodes.length,
  designConnections: graph.designConnections.length,
  ruleDerivedConnections: graph.ruleDerivedConnections.length,
  effectiveTrackConnections: graph.effectiveTrackConnections.length,
  structuredRouteRules: graph.structuredRouteRules.length,
  connectionIndex: Object.keys(graph.connectionIndex).length,
  nodesWithoutEffectiveIncoming: graph.nodesWithoutEffectiveIncoming.length,
};
const ids = new Set(graph.nodes.map((node) => node.id));
const broken = graph.effectiveTrackConnections.filter((edge) => !ids.has(edge.fromId) || !ids.has(edge.toId));
const errors = Object.entries(expected).filter(([key, value]) => actual[key] !== value);
if (new Set(graph.nodes.map((node) => node.id)).size !== graph.nodes.length) errors.push(['uniqueTrackIds', 'duplicate']);
if (broken.length) errors.push(['brokenConnections', broken.length]);
console.log(JSON.stringify({ expected, actual, brokenConnections: broken.length }, null, 2));
if (errors.length) {
  console.error('GRAPH VALIDATION FAILED', errors);
  process.exit(1);
}
console.log('GRAPH VALIDATION PASSED');
