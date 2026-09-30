/** Read-only SendIt acceptance request through a saved Perplexity Project connector. */
const apiKey = process.env.PERPLEXITY_API_KEY;
const connectorId = process.env.SENDIT_PERPLEXITY_CONNECTOR_ID;
if (!apiKey || !connectorId) {
  console.error('Set PERPLEXITY_API_KEY and SENDIT_PERPLEXITY_CONNECTOR_ID from the same Project.');
  process.exitCode = 1;
} else {
  const response = await fetch('https://api.perplexity.ai/v1/agent', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-5.6-terra',
      input: 'Use SendIt to list my connected social accounts. Do not publish or schedule anything.',
      max_steps: 6,
      tools: [{
        type: 'connector',
        id: connectorId,
        server_label: 'sendit',
        allowed_tools: ['list_connected_accounts', 'get_platform_requirements', 'get_scheduled_posts'],
      }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    console.error(`Perplexity request failed (HTTP ${response.status}). Check your Project key and connector.`);
    process.exitCode = 1;
  } else {
    const result = await response.json();
    const call = result.output?.find((item) =>
      item.type === 'mcp_call' && item.server_label === 'sendit' && item.name === 'list_connected_accounts'
    );
    let toolResult = call?.output;
    if (typeof toolResult === 'string') {
      try { toolResult = JSON.parse(toolResult); } catch { /* Plain text is a valid MCP result. */ }
    }
    // A connector failure or empty catalog can still arrive in an HTTP 200 response.
    if (!call || call.error || call.status === 'failed' || !toolResult ||
        toolResult.isError || toolResult.success === false || toolResult.error) {
      console.error('Acceptance failed: Perplexity did not complete a successful SendIt account-list call.');
      process.exitCode = 2;
    } else {
      console.log('Acceptance passed: Perplexity completed SendIt list_connected_accounts.');
    }
  }
}
