import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertNoCredentials,
  connectorMetadata,
  crc32,
  createSkillZip,
  maximumUploadBytes,
  packageRoot,
  readSkillZip,
  releaseArtifacts,
  skillFile,
  skillName,
  validateRelease,
  validateSkill,
} from '../scripts/release-lib.mjs';

const skillBytes = readFileSync(skillFile);
const version = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version;

test('the upload has valid frontmatter and the ZIP root contains the complete standalone skill', () => {
  assert.equal(validateSkill(skillBytes).name, skillName);
  const zip = createSkillZip(skillBytes);
  assert.deepEqual(readSkillZip(zip), skillBytes);
  assert(zip.length < maximumUploadBytes);
  assert.deepEqual(createSkillZip(Buffer.from(skillBytes)), zip);
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('archive validation rejects corrupt payloads, root-name changes, extra entries, and truncation', () => {
  const zip = createSkillZip(skillBytes);
  const corruptPayload = Buffer.from(zip);
  corruptPayload[45] ^= 1;
  assert.throws(() => readSkillZip(corruptPayload), /checksum mismatch/);
  const renamed = Buffer.from(zip);
  renamed[30] = 'X'.charCodeAt(0);
  assert.throws(() => readSkillZip(renamed), /Invalid ZIP root filename/);
  const extraEntry = Buffer.from(zip);
  extraEntry.writeUInt16LE(2, extraEntry.length - 22 + 10);
  assert.throws(() => readSkillZip(extraEntry), /only SKILL.md/);
  assert.throws(() => readSkillZip(zip.subarray(0, zip.length - 1)), /end record/);
  assert.throws(() => createSkillZip(Buffer.alloc(maximumUploadBytes)), /10 MB/);
});

test('source validation rejects unsupported standalone references and credential-shaped data', () => {
  assert.throws(() => validateSkill(Buffer.from(skillBytes.toString().replace('name: sendit-social-publishing', 'name: bad_name'))), /skill name/);
  assert.throws(() => validateSkill(Buffer.from(`${skillBytes}\nRead [instructions](references/private.md).\n`)), /relative reference/);
  const syntheticKey = ['sk', 'live', '0123456789abcdef0123456789abcdef'].join('_');
  assert.throws(() => assertNoCredentials(Buffer.from(syntheticKey), 'fixture'), /credential-shaped/);
  assert.throws(() => assertNoCredentials(Buffer.from('-----BEGIN PRIVATE KEY-----'), 'fixture'), /credential-shaped/);
  assert.doesNotThrow(() => assertNoCredentials(Buffer.from('Never request OAuth tokens or API keys.'), 'fixture'));
});

test('the full CLI build is reproducible and release validation detects tampering', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'sendit-perplexity-release-'));
  try {
    const first = join(tempRoot, 'first');
    const second = join(tempRoot, 'second');
    const builder = join(packageRoot, 'scripts', 'build-release.mjs');
    for (const output of [first, second]) {
      execFileSync(process.execPath, [builder, '--output', output], { encoding: 'utf8' });
      assert.equal(validateRelease(output, skillBytes, version).length, 4);
    }
    for (const [name, bytes] of releaseArtifacts(skillBytes, version)) {
      assert.deepEqual(readFileSync(join(first, name)), bytes);
      assert.deepEqual(readFileSync(join(second, name)), bytes);
    }
    writeFileSync(join(first, `${skillName}.md`), 'changed');
    assert.throws(() => validateRelease(first, skillBytes, version), /differs from the source release/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('connection metadata labels its format and contains a hosted OAuth connector without credentials', () => {
  const metadata = connectorMetadata(version);
  assert.equal(metadata.format, 'sendit-connector-metadata');
  assert.equal(metadata.mcp.authentication, 'oauth2');
  assert.equal(metadata.mcp.transport, 'streamable-http');
  assert.equal(metadata.mcp.url, 'https://sendit.infiniteappsai.com/api/mcp');
  assert.equal(new URL(metadata.skill.zip).protocol, 'https:');
  assert.equal(new URL(metadata.skill.markdown).protocol, 'https:');
  assert(!Object.hasOwn(metadata.mcp, 'authorization'));
  assertNoCredentials(Buffer.from(JSON.stringify(metadata)), 'metadata');
});
