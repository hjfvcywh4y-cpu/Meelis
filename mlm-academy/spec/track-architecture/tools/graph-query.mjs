import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const graphPath = path.resolve(here, '../full-graph-112-v3.json');
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const [command = 'summary', rawId] = process.argv.slice(2);

if (command === 'summary') {
  console.log(JSON.stringify({ version: graph.version, counts: graph.counts }, null, 2));
  process.exit(0);
}

if (command === 'track') {
  const id = String(rawId || '').toUpperCase();
  const node = graph.nodes.find((item) => item.id === id);
  const connections = graph.connectionIndex[id];
  if (!node || !connections) {
    console.error(`Unknown Track ID: ${id || '(missing)'}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ node, connections }, null, 2));
  process.exit(0);
}

if (command === 'rules') {
  const id = String(rawId || '').toUpperCase();
  const rules = graph.structuredRouteRules.filter((rule) =>
    JSON.stringify(rule).toUpperCase().includes(id)
  );
  console.log(JSON.stringify(rules, null, 2));
  process.exit(0);
}

console.error('Usage: graph-query.mjs summary | track TRACK_ID | rules TRACK_ID');
process.exit(1);

