#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { packageRoot, skillFile, validateRelease, validateSkill } from './release-lib.mjs';

const args = process.argv.slice(2);
if (args.length > 1) throw new Error('Usage: node scripts/validate-release.mjs [output-directory]');
const skillBytes = readFileSync(skillFile);
const fields = validateSkill(skillBytes);
const version = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version;
const outputDirectory = args.length ? resolve(args[0]) : join(packageRoot, 'dist');
const hashes = validateRelease(outputDirectory, skillBytes, version);
console.log(`Validated ${fields.name}: YAML frontmatter, root SKILL.md, ZIP CRC, deterministic archive, standalone Markdown parity, SHA256SUMS, canonical OAuth endpoint, and credential-shaped-data scan.`);
for (const { name, bytes, sha256 } of hashes) console.log(`${sha256}  ${name} (${bytes} bytes)`);
