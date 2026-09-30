import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const skillFile = join(packageRoot, 'skills', 'sendit-social-publishing', 'SKILL.md');
export const skillName = 'sendit-social-publishing';
export const mcpUrl = 'https://sendit.infiniteappsai.com/api/mcp';
export const maximumUploadBytes = 10 * 1024 * 1024;
export const artifactNames = Object.freeze([
  'connector.json',
  `${skillName}.md`,
  `${skillName}.zip`,
]);

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const crcTable = Uint32Array.from({ length: 256 }, (_, initial) => {
  let value = initial;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

export function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/** Build a portable stored ZIP with fixed timestamps and an explicit file allowlist. */
export function createSkillZip(skillBytes) {
  assert(skillBytes.length < maximumUploadBytes, 'Skill exceeds the 10 MB upload limit.');
  const filename = Buffer.from('SKILL.md', 'utf8');
  const checksum = crc32(skillBytes);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(0x0021, 12); // January 1, 1980; no host timestamp.
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(skillBytes.length, 18);
  local.writeUInt32LE(skillBytes.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(0x0021, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(skillBytes.length, 20);
  central.writeUInt32LE(skillBytes.length, 24);
  central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + skillBytes.length, 16);
  const result = Buffer.concat([local, filename, skillBytes, central, filename, end]);
  assert(result.length < maximumUploadBytes, 'ZIP exceeds the 10 MB upload limit.');
  return result;
}

/** Verify our single-entry ZIP contract and reject tampering or unexpected packaged files. */
export function readSkillZip(zipBytes) {
  assert(zipBytes.length >= 22, 'Truncated ZIP.');
  assert(zipBytes.length < maximumUploadBytes, 'ZIP exceeds the 10 MB upload limit.');
  const endOffset = zipBytes.length - 22;
  assert.equal(zipBytes.readUInt32LE(endOffset), 0x06054b50, 'Invalid ZIP end record.');
  assert.equal(zipBytes.readUInt16LE(endOffset + 4), 0, 'Multi-disk ZIP is unsupported.');
  assert.equal(zipBytes.readUInt16LE(endOffset + 6), 0, 'Multi-disk ZIP is unsupported.');
  assert.equal(zipBytes.readUInt16LE(endOffset + 8), 1, 'ZIP must contain only SKILL.md.');
  assert.equal(zipBytes.readUInt16LE(endOffset + 10), 1, 'ZIP must contain only SKILL.md.');
  assert.equal(zipBytes.readUInt16LE(endOffset + 20), 0, 'Unexpected ZIP comment.');
  const centralSize = zipBytes.readUInt32LE(endOffset + 12);
  const centralOffset = zipBytes.readUInt32LE(endOffset + 16);
  assert(centralOffset >= 30 && centralOffset + 46 <= endOffset, 'Invalid central directory offset.');
  assert.equal(centralOffset + centralSize, endOffset, 'Invalid central directory size.');
  assert.equal(zipBytes.readUInt32LE(centralOffset), 0x02014b50, 'Invalid central directory record.');
  assert.equal(zipBytes.readUInt16LE(centralOffset + 8), 0x0800, 'Unexpected ZIP flags.');
  assert.equal(zipBytes.readUInt16LE(centralOffset + 10), 0, 'Expected stored ZIP entry.');
  assert.equal(zipBytes.readUInt16LE(centralOffset + 30), 0, 'Unexpected ZIP extra field.');
  assert.equal(zipBytes.readUInt16LE(centralOffset + 32), 0, 'Unexpected ZIP entry comment.');
  assert.equal(zipBytes.readUInt32LE(centralOffset + 42), 0, 'Expected root ZIP entry.');
  const filenameLength = zipBytes.readUInt16LE(centralOffset + 28);
  assert.equal(centralSize, 46 + filenameLength, 'Unexpected central directory data.');
  assert.equal(zipBytes.subarray(centralOffset + 46, centralOffset + 46 + filenameLength).toString('utf8'), 'SKILL.md', 'ZIP must have SKILL.md at its root.');
  assert.equal(zipBytes.readUInt32LE(0), 0x04034b50, 'Invalid ZIP local record.');
  assert.equal(zipBytes.readUInt16LE(6), 0x0800, 'Unexpected local ZIP flags.');
  assert.equal(zipBytes.readUInt16LE(8), 0, 'Expected stored local ZIP entry.');
  assert.equal(zipBytes.readUInt16LE(26), filenameLength, 'ZIP filename length mismatch.');
  assert.equal(zipBytes.readUInt16LE(28), 0, 'Unexpected local ZIP extra field.');
  assert.equal(zipBytes.subarray(30, 30 + filenameLength).toString('utf8'), 'SKILL.md', 'Invalid ZIP root filename.');
  const dataOffset = 30 + filenameLength;
  const dataSize = zipBytes.readUInt32LE(18);
  assert.equal(dataOffset + dataSize, centralOffset, 'Unexpected ZIP payload data.');
  assert.equal(zipBytes.readUInt32LE(22), dataSize, 'Uncompressed size mismatch.');
  assert.equal(zipBytes.readUInt32LE(centralOffset + 20), dataSize, 'Central compressed size mismatch.');
  assert.equal(zipBytes.readUInt32LE(centralOffset + 24), dataSize, 'Central uncompressed size mismatch.');
  const skillBytes = zipBytes.subarray(dataOffset, centralOffset);
  const checksum = crc32(skillBytes);
  assert.equal(zipBytes.readUInt32LE(14), checksum, 'ZIP payload checksum mismatch.');
  assert.equal(zipBytes.readUInt32LE(centralOffset + 16), checksum, 'Central ZIP checksum mismatch.');
  assert.deepEqual(zipBytes, createSkillZip(skillBytes), 'ZIP is not in the deterministic release format.');
  return skillBytes;
}

export function validateSkill(skillBytes) {
  assert(skillBytes.length > 0 && skillBytes.length < maximumUploadBytes, 'Invalid skill upload size.');
  const markdown = skillBytes.toString('utf8');
  assert(!markdown.includes('\r'), 'Skill must use LF newlines.');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(markdown);
  assert(match, 'Skill must start with YAML frontmatter.');
  const fields = Object.fromEntries(match[1].split('\n').map((line) => {
    const field = /^([a-z]+): (.+)$/.exec(line);
    assert(field, 'Frontmatter requires simple name and description fields.');
    return [field[1], field[2]];
  }));
  assert.deepEqual(Object.keys(fields).sort(), ['description', 'name'], 'Unexpected skill frontmatter fields.');
  assert.equal(fields.name, skillName, 'Unexpected skill name.');
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.name) && fields.name.length <= 64, 'Invalid skill name.');
  assert(fields.description.length >= 20 && fields.description.length <= 1024, 'Invalid skill description.');
  assert(!fields.description.includes(': '), 'Description must be a valid plain YAML scalar.');
  assert(!/\[(?:[^\]]+)\]\((?!https:\/\/)[^)]+\)/.test(markdown), 'Standalone skill cannot require relative reference files.');
  assert(markdown.includes(mcpUrl), 'Skill must use the canonical OAuth resource URL.');
  assert(!markdown.includes('\u2014'), 'Skill contains an em dash.');
  assert(!/TODO|PLACEHOLDER|\[insert\b/i.test(markdown), 'Skill has unfinished scaffold text.');
  assertNoCredentials(skillBytes, 'Skill');
  return fields;
}

export function assertNoCredentials(bytes, label) {
  const text = bytes.toString('utf8');
  assert(!/\bsk_(?:live|test)_[A-Za-z0-9]{12,}|\bBearer\s+[A-Za-z0-9._-]{16,}|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), `${label} contains credential-shaped data.`);
}

export function connectorMetadata(version) {
  return {
    format: 'sendit-connector-metadata',
    version,
    name: 'SendIt',
    description: 'Research-backed social drafting, validation, publishing, scheduling, and analytics with connected SendIt accounts.',
    homepage: 'https://sendit.infiniteappsai.com',
    documentation: 'https://sendit.infiniteappsai.com/start/perplexity',
    source: 'https://github.com/Shree-git/sendit-perplexity-skills',
    license: 'MIT',
    mcp: {
      url: mcpUrl,
      transport: 'streamable-http',
      authentication: 'oauth2',
    },
    skill: {
      name: skillName,
      perplexity: 'https://www.perplexity.ai/computer/skills/bofRmXg.RKKWcVKR2Ozrhw',
      zip: `https://sendit.infiniteappsai.com/integrations/perplexity/${skillName}.zip`,
      markdown: `https://sendit.infiniteappsai.com/integrations/perplexity/${skillName}.md`,
    },
    note: 'SendIt distribution metadata. This file is not a Perplexity import manifest or proof of catalog approval.',
  };
}

export function releaseArtifacts(skillBytes, version) {
  validateSkill(skillBytes);
  const metadataBytes = Buffer.from(`${JSON.stringify(connectorMetadata(version), null, 2)}\n`);
  const artifacts = new Map([
    ['connector.json', metadataBytes],
    [`${skillName}.md`, skillBytes],
    [`${skillName}.zip`, createSkillZip(skillBytes)],
  ]);
  for (const [name, bytes] of artifacts) assertNoCredentials(bytes, name);
  const checksumText = artifactNames.map((name) => `${sha256(artifacts.get(name))}  ${name}`).join('\n');
  artifacts.set('SHA256SUMS', Buffer.from(`${checksumText}\n`));
  return artifacts;
}

export function validateRelease(outputDirectory, expectedSkillBytes, version) {
  validateSkill(expectedSkillBytes);
  const expected = releaseArtifacts(expectedSkillBytes, version);
  const hashes = [];
  for (const [name, bytes] of expected) {
    const actual = readFileSync(join(outputDirectory, name));
    assert.deepEqual(actual, bytes, `${name} differs from the source release or checksum manifest.`);
    assertNoCredentials(actual, name);
    hashes.push({ name, bytes: actual.length, sha256: sha256(actual) });
  }
  const skillZip = readFileSync(join(outputDirectory, `${skillName}.zip`));
  assert.deepEqual(readSkillZip(skillZip), expectedSkillBytes, 'ZIP skill differs from standalone Markdown.');
  return hashes;
}
