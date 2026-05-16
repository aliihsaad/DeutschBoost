#!/usr/bin/env node
export * from './native-readiness-core.mjs';

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runNativeReadinessCli } from './native-readiness-core.mjs';

if (isCliEntryPoint()) {
  process.exitCode = runNativeReadinessCli();
}

function isCliEntryPoint() {
  if (typeof process === 'undefined' || !Array.isArray(process.argv) || !process.argv[1]) {
    return false;
  }

  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}
