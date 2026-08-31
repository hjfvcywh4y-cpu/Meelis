#!/usr/bin/env node
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./ts-loader.mjs', import.meta.url));

const { runTracksCli } = await import('../src/track-architecture/cli.ts');
runTracksCli(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
