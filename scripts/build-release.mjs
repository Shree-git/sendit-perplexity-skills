#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  packageRoot,
  releaseArtifacts,
  skillFile,
  validateRelease,
} from './release-lib.mjs';

const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== '--output')) {
  throw new Error('Usage: node scripts/build-release.mjs [--output /absolute/output/path]');
}
const outputDirectory = args.length ? resolve(args[1]) : join(packageRoot, 'dist');
const packageInfo = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const skillBytes = readFileSync(skillFile);
const artifacts = releaseArtifacts(skillBytes, packageInfo.version);
const destinations = [outputDirectory];
const monorepoRoot = resolve(packageRoot, '..', '..');
if (!args.length && existsSync(join(monorepoRoot, 'src', 'api', 'mcp', 'tools.ts'))) {
  destinations.push(join(monorepoRoot, 'src', 'integrations', 'perplexity'));
}
for (const destination of destinations) {
  mkdirSync(destination, { recursive: true });
  for (const [name, bytes] of artifacts) writeFileSync(join(destination, name), bytes);
  const checked = validateRelease(destination, skillBytes, packageInfo.version);
  console.log(`Built ${destination}: ${checked.map(({ name, bytes }) => `${name} (${bytes} bytes)`).join(', ')}`);
}
