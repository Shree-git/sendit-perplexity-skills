#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { packageRoot, skillFile } from './release-lib.mjs';

const monorepoRoot = resolve(packageRoot, '..', '..');
const tsx = join(monorepoRoot, 'src', 'node_modules', '.bin', 'tsx');
assert(existsSync(tsx), 'Run contract validation in the SendIt monorepo with src dependencies installed.');
const output = execFileSync(tsx, ['-e', "import { allTools } from './src/api/mcp/tools/index.ts'; console.log(JSON.stringify(allTools));"], {
  cwd: monorepoRoot,
  encoding: 'utf8',
  maxBuffer: 2 * 1024 * 1024,
});
const tools = new Map(JSON.parse(output).map((tool) => [tool.name, tool]));
const contracts = {
  list_connected_accounts: { required: [], properties: ['team_id'] },
  list_teams: { required: [], properties: [] },
  connect_platform: { required: ['platform'], properties: ['platform'] },
  get_platform_requirements: { required: ['platform'], properties: ['platform'] },
  get_platform_settings_schema: { required: ['platform'], properties: ['platform'] },
  create_upload_session: { required: [], properties: ['mediaType'] },
  get_upload_session: { required: ['sessionId'], properties: ['sessionId'] },
  validate_content: { required: ['platforms', 'content'], properties: ['platforms', 'content'] },
  preview_content: { required: ['platforms', 'content'], properties: ['platforms', 'content'] },
  publish_content: { required: ['platforms', 'content'], properties: ['platforms', 'content', 'team_id'] },
  schedule_content: { required: ['platforms', 'content', 'scheduledTime'], properties: ['platforms', 'content', 'scheduledTime', 'team_id'] },
  get_scheduled_posts: { required: [], properties: ['platform', 'team_id'] },
  get_analytics: { required: ['platform'], properties: ['platform', 'startDate', 'endDate', 'team_id'] },
};
const skillText = readFileSync(skillFile, 'utf8');
for (const [name, contract] of Object.entries(contracts)) {
  assert(skillText.includes(`\`${name}\``), `Skill no longer documents ${name}.`);
  const tool = tools.get(name);
  assert(tool, `${name} is absent from the current SendIt registry.`);
  assert.deepEqual([...(tool.inputSchema.required || [])].sort(), [...contract.required].sort(), `${name} required arguments changed.`);
  for (const property of contract.properties) {
    assert(property in tool.inputSchema.properties, `${name}.${property} is absent from the current schema.`);
  }
}
for (const name of ['publish_content', 'schedule_content', 'validate_content']) {
  const schema = tools.get(name).inputSchema;
  assert.deepEqual(schema.properties.content.required, ['text'], `${name}.content requirements changed.`);
  assert.equal(schema.properties.content.properties.mediaUrl.type, 'string');
  assert.equal(schema.properties.content.properties.mediaUrls.type, 'array');
  assert.equal(schema.properties.platforms.type, 'array');
  assert.equal(schema.properties.content.properties.platformSettings.type, 'object');
}
for (const name of ['publish_content', 'schedule_content']) {
  assert(!('idempotencyKey' in tools.get(name).inputSchema.properties), `${name} now supports idempotency; update the skill's retry guidance.`);
  assert(!('idempotency_key' in tools.get(name).inputSchema.properties), `${name} now supports idempotency; update the skill's retry guidance.`);
}
assert.equal(tools.get('schedule_content').inputSchema.properties.scheduledTime.format, 'date-time');
assert.deepEqual(tools.get('create_upload_session').inputSchema.properties.mediaType.enum, ['image', 'video']);
console.log(`Verified ${Object.keys(contracts).length} documented tool contracts against ${tools.size} SendIt MCP tools.`);
