import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../examples/agent-api.mjs', import.meta.url));

function runWithMock(result, status = 200) {
  const bootstrap = `
    import assert from 'node:assert/strict';
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.perplexity.ai/v1/agent');
      const request = JSON.parse(options.body);
      assert.deepEqual(request.tools[0].allowed_tools, ['list_connected_accounts', 'get_platform_requirements', 'get_scheduled_posts']);
      assert.equal(request.tools[0].id, 'test-connector');
      return new Response(JSON.stringify(${JSON.stringify(result)}), { status: ${status} });
    };
  `;
  return spawnSync(process.execPath, [
    '--import', `data:text/javascript;base64,${Buffer.from(bootstrap).toString('base64')}`, script,
  ], {
    encoding: 'utf8',
    env: { ...process.env, PERPLEXITY_API_KEY: 'test-only', SENDIT_PERPLEXITY_CONNECTOR_ID: 'test-connector' },
  });
}

const accountCall = {
  type: 'mcp_call', server_label: 'sendit', name: 'list_connected_accounts',
  output: JSON.stringify({ content: [{ type: 'text', text: 'Connected Accounts' }] }), error: null,
};

test('API acceptance requires a successful SendIt call and keeps a read-only tool allowlist', () => {
  const success = runWithMock({ output: [accountCall] });
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /Acceptance passed/);
  for (const result of [
    { output: [] },
    { output: [{ type: 'mcp_list_tools', tools: [] }] },
    { output: [{ ...accountCall, error: { type: 'AUTH_REQUIRED' } }] },
    { output: [{ ...accountCall, output: JSON.stringify({ isError: true, content: [] }) }] },
    { output: [{ ...accountCall, output: null }] },
  ]) {
    const failure = runWithMock(result);
    assert.equal(failure.status, 2, failure.stderr);
    assert.match(failure.stderr, /Acceptance failed/);
  }
});

test('API acceptance reports HTTP failures without printing response bodies or credentials', () => {
  const failure = runWithMock({ privateDetails: 'must-not-be-printed' }, 401);
  assert.equal(failure.status, 1);
  assert.match(failure.stderr, /HTTP 401/);
  assert(!failure.stderr.includes('must-not-be-printed'));
  assert(!failure.stderr.includes('test-only'));
});
