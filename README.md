# SendIt for Perplexity

Use SendIt from Perplexity Computer to turn research into social posts and publish or schedule them to connected accounts.
The remote MCP connector handles SendIt authentication and tools.
The `sendit-social-publishing` skill adds account selection, source attribution, media upload, validation, and publishing instructions.

## Install the connector

1. Open Account settings > Connectors, click `+ Custom connector`, and choose `Remote`.
2. Use `SendIt` as the name and `https://sendit.infiniteappsai.com/api/mcp` as the server URL.
3. Choose OAuth 2.0 authentication and Streamable HTTP transport, add the connector, then click its card to finish SendIt's browser sign-in flow.
4. Ask Perplexity: `Use SendIt to list my connected social accounts.`

Custom connector availability depends on the account's Perplexity plan and workspace settings.
Use Perplexity's current [remote MCP connector guide](https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors) for the supported account types and setup controls.
Installing a skill does not add or authorize the connector.

## Install the Computer skill

Open the [public SendIt skill on Perplexity](https://www.perplexity.ai/computer/skills/bofRmXg.RKKWcVKR2Ozrhw).
Its sharing setting allows anyone with the link to view it.
For a file import, use the downloads below.

In [Perplexity Computer's Skills interface](https://www.perplexity.ai/computer/skills), choose `Create skill` > `Upload skill` and upload either file:

- [sendit-social-publishing.zip](https://github.com/Shree-git/sendit-perplexity-skills/releases/download/v0.1.0/sendit-social-publishing.zip)
- [sendit-social-publishing.md](https://github.com/Shree-git/sendit-perplexity-skills/releases/download/v0.1.0/sendit-social-publishing.md)

These versioned files are also mirrored on the [SendIt setup page](https://sendit.infiniteappsai.com/start/perplexity).
The ZIP has `SKILL.md` at its root.
The standalone Markdown file contains the same complete instructions and has the required YAML `name` and `description`.
Both files are below Perplexity's 10 MB upload limit.
Use Perplexity's current [Computer skills guide](https://www.perplexity.ai/help-center/en/articles/13914413-how-to-use-computer-skills) if the upload controls change.

After installation, try:

```text
Use the SendIt skill to list my connected social accounts.
```

```text
Research this week's changes in our market and draft a sourced LinkedIn post.
Show me the draft before publishing.
```

```text
Publish this approved caption and image to my connected Instagram account.
```

```text
Schedule the approved LinkedIn post for October 6, 2026 at 9 AM America/Los_Angeles.
```

For an image or video in chat, SendIt creates a browser upload link.
Upload the file there, then Perplexity reads its public HTTPS URL from the completed session.
A chat attachment or Computer sandbox path is not a public publishing URL.

## Public distribution

The source package is maintained at [Shree-git/sendit-perplexity-skills](https://github.com/Shree-git/sendit-perplexity-skills).
Anyone with compatible Perplexity connector and skill access can download the package and install it in their own account.
Their own OAuth authorization selects their SendIt account; these downloads contain no account credentials.

Public hosting of these files does not mean SendIt has been approved or listed in Perplexity's built-in connector catalog or public Skills Marketplace.
Perplexity controls those catalogs and any partner review.
Perplexity's [September 21 announcement](https://www.perplexity.ai/changelog/effort-mode-gpt-6-astra-and-skills-marketplace) confirms that the public Skills Marketplace is available.
The live skill interface also supports public link sharing, which is enabled for the SendIt skill.
Public link sharing and a curated marketplace listing are separate.
The official import guide does not provide a public catalog submission flow.
The included `connector.json` is SendIt connection metadata for documentation and distribution, not a Perplexity import manifest.

## Agent API example

Perplexity's Agent API has a separate [Project connector setup](https://docs.perplexity.ai/docs/agent-api/tools/connectors).
A Project administrator registers SendIt with API Key authentication and Streamable HTTP, then uses the returned connector ID.
The API does not run the Computer connector's interactive OAuth flow.
Its MCP tool calls run automatically, so an application must collect user authorization before exposing publishing tools.

The [read-only example](examples/agent-api.mjs) allows only account listing, platform requirements, and scheduled-post listing.
Run it from a private terminal with `PERPLEXITY_API_KEY` and `SENDIT_PERPLEXITY_CONNECTOR_ID` set for the same Project:

```bash
node examples/agent-api.mjs
```

The response can contain private account information.
These environment variables belong in the application environment, not in the uploaded skill.
See the [Agent API MCP guide](https://docs.perplexity.ai/docs/agent-api/tools/mcp) for tool allowlists and approval limitations.

## Build and validate

From this directory, using Node.js 20 or later:

```bash
npm run build
npm test
```

The build writes a deterministic ZIP, standalone Markdown, `connector.json`, and `SHA256SUMS` to `dist/`.
In the SendIt monorepo, it also copies those files to `src/integrations/perplexity/` for public downloads.
Use `node scripts/build-release.mjs --output /absolute/output/path` to build into another directory without copying into the website.
The ZIP contains only the upload instructions, with no build scripts, source code, dependencies, or credentials.

`npm run validate` checks the source frontmatter and runs the artifact integrity checks after a build.
`npm run check:contract` compares documented tool contracts against SendIt's TypeScript registry when run from the SendIt monorepo.
Contract validation is optional in the public standalone repository because the server source is maintained separately.

To verify a downloaded release:

```bash
shasum -a 256 -c SHA256SUMS
```

## Acceptance coverage

Local validation covers upload format, repeatable archive bytes, checksum integrity, credential-free contents, and documented tool schemas.
A successful build does not prove a Perplexity account has OAuth access or that a social platform accepted a post.
For account acceptance, install the connector and skill, list connected accounts, validate a draft, and test publishing or scheduling only with content authorized for that account.
