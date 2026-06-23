#!/usr/bin/env node
import { runCli } from './run.js';

runCli(process.argv.slice(2)).catch((e) => {
  console.error(`Error: ${(e as Error).message}`);
  process.exit(1);
});
