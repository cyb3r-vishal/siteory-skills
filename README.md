# Siteory skills, plugin and CLI

Siteory checks websites for SEO, AI visibility (AEO/GEO) and security problems and explains how to fix each one. On your own machine it also checks performance, accessibility, structured data, links, social previews and launch readiness. This repository gives coding agents three things:

- **Agent skills** that run the Siteory checker against a local build or a deployed URL, fix the findings in your code by framework, and verify each fix.
- **The Siteory MCP server** (`https://api.siteory.co/mcp`) for full hosted audits, Markdown reports, rescans and before/after comparisons.
- **The `siteory` npm package**: a zero-dependency CLI that runs the checker (`npx siteory check`) and installs the skills and MCP config into your agents (`npx siteory setup`).

| Skill | What it covers |
|---|---|
| `siteory` | The whole loop: local checks, the hosted MCP tools, prioritising, fixing and re-verifying. |
| `siteory-seo` | Titles, descriptions, headings, canonicals, noindex, robots.txt, sitemaps, broken links, alt text, social tags, HTTPS. Fix guides for Next.js, Astro, Vite/React, WordPress, Nuxt, SvelteKit, React Router, Remix and Gatsby. |
| `siteory-ai-visibility` | AI crawler access in robots.txt, llms.txt, content that needs JavaScript to appear, thin pages, JSON-LD identity. |
| `siteory-security` | Security headers (CSP, HSTS, framing, Referrer-Policy, Permissions-Policy), CORS, and secrets leaked into client JavaScript. |
| `siteory-performance` | Page weight: HTML, JavaScript and CSS size, render-blocking scripts, oversized or old-format images, missing image dimensions and lazy loading, font-display, third-party scripts, and on deployed sites compression and caching. Guides for next/image, next/font and next/script, Astro, Vite, WordPress and common hosts. |
| `siteory-accessibility` | Links and buttons without names, unlabeled form fields, duplicate ids, aria-hidden on focusable elements, positive tabindex, disabled zoom, untitled iframes, vague link text, autoplaying sound; when to use axe or Lighthouse for contrast and keyboard checks. |
| `siteory-structured-data` | JSON-LD validation for rich results: required and recommended properties per type, @context, URLs, ISO dates, homepage identity and retired types, with a valid example per type. |
| `siteory-links` | Internal redirects, mixed content, localhost and dev-server URLs, preview and staging hosts, broken anchors, internal nofollow, and with `--external` broken outbound links. |
| `siteory-social` | Open Graph and Twitter card tags on every page, and the share image itself: absolute URL, loads, 1200x630, no dev or preview hosts; plus the platform debuggers. |
| `siteory-launch` | The pre-deploy gate: every lens with `--fail-on high` plus dev-build, soft 404, template text, favicon, manifest, broken assets, sitemap, https and www redirect and source map checks. |

The last six run lenses that only the local checker has (`--lens performance,accessibility,schema,links,social,launch`, or `--lens all`); the hosted audit does not report them.

## Plans and access

Siteory MCP, the agent skills and the local checker are part of paid Siteory plans: a single audit ($9) or Pro. The free audit on siteory.co does not include them. See [pricing](https://siteory.co/pricing).

- Anyone can install the skills, the plugin and the CLI. Running the checker needs a paid plan and a sign-in on each machine that runs it: `npx siteory login` opens your browser once. `npx siteory whoami` shows the signed-in account and plan, and `npx siteory logout` signs out.
- The MCP server signs you in through your agent (OAuth in the browser). A free account is asked to upgrade instead of connecting.
- Exit code 5 from the CLI means this machine is not signed in or the account has no paid plan.
- The sign-in only confirms your plan. Checks still run on your machine and send nothing about the sites you check to Siteory.

## Install

### Any agent: `npx siteory setup`

```bash
npx siteory setup             # detect agents in your home directory and set them up
npx siteory setup --dry-run   # show what would change first
npx siteory setup --agent claude-code --agent cursor
npx siteory setup --project   # skills into this project instead of your home directory
```

It supports Claude Code, Codex, Cursor, VS Code, Gemini CLI, OpenCode and Windsurf. For each agent it copies the Siteory skills into the agent's skills folder and adds the MCP server: through `claude mcp add`, `code --add-mcp` and `gemini mcp add` where those CLIs exist, and by merging the agent's JSON or TOML config otherwise. It never prompts and never stores secrets. Before changing a config file it saves a timestamped backup next to it, and it leaves a file it cannot parse (for example JSON with comments) untouched and prints the snippet to add yourself. `--skills-only` and `--mcp-only` limit what it does.

In Windows PowerShell, use `npx.cmd` if script execution is disabled.

### Skills only: `npx skills add`

```bash
npx skills add cyb3r-vishal/siteory-skills
```

The open `skills` CLI installs into every agent it detects. It needs Node.js 22.20 or later. Add the MCP server separately (see below) if you want hosted audits.

### Claude Code plugin

```text
/plugin marketplace add cyb3r-vishal/siteory-skills
/plugin install siteory@siteory
```

Or from a shell: `claude plugin install siteory --marketplace cyb3r-vishal/siteory-skills`. The plugin includes the skills and the MCP server. Run `/mcp`, select `plugin:siteory:siteory` and choose Authenticate. Use either the plugin or a manual `claude mcp add`, not both, or the Siteory tools appear twice.

### Codex

```bash
codex plugin marketplace add cyb3r-vishal/siteory-skills
codex plugin add siteory@siteory
codex mcp login siteory
```

### Cursor

Teams can import this repository as a plugin marketplace under Dashboard > Plugins & MCPs > Add Marketplace. On a single machine, `npx siteory setup --agent cursor` installs the skills and the MCP config.

### Gemini CLI

```bash
gemini extensions install https://github.com/cyb3r-vishal/siteory-skills
```

Then run `/mcp auth siteory` in Gemini CLI.

## Connect the MCP server by hand

Sign-in is OAuth in your browser; there is no API key. You can see and revoke connected apps in Siteory under Settings > Connected apps. `npx siteory mcp` prints all of these, and `npx siteory mcp --client <id>` prints one.

**Claude Code**

```bash
claude mcp add --transport http --scope user siteory https://api.siteory.co/mcp
```

Then run `/mcp`, select siteory and choose Authenticate.

**claude.ai, Claude Desktop and Cowork**: Customize > Connectors > Add custom connector, URL `https://api.siteory.co/mcp`. On Team and Enterprise plans an owner adds it under Organization settings > Connectors.

**Cursor** (`~/.cursor/mcp.json`, or `.cursor/mcp.json` in a project)

```json
{ "mcpServers": { "siteory": { "url": "https://api.siteory.co/mcp" } } }
```

**VS Code** (run "MCP: Open User Configuration", or `.vscode/mcp.json` in a project)

```json
{ "servers": { "siteory": { "type": "http", "url": "https://api.siteory.co/mcp" } } }
```

**Codex** (`~/.codex/config.toml`), then `codex mcp login siteory`

```toml
[mcp_servers.siteory]
url = "https://api.siteory.co/mcp"
```

**ChatGPT**: Plugins > + > Add custom MCP server, URL `https://api.siteory.co/mcp`, authentication OAuth. Custom MCP servers need developer mode on a plan that offers it.

**Gemini CLI** (`~/.gemini/settings.json`), then `/mcp auth siteory`

```json
{ "mcpServers": { "siteory": { "httpUrl": "https://api.siteory.co/mcp" } } }
```

**Antigravity** (`~/.gemini/config/mcp_config.json`)

```json
{ "mcpServers": { "siteory": { "serverUrl": "https://api.siteory.co/mcp" } } }
```

**OpenCode** (`~/.config/opencode/opencode.json`), then `opencode mcp auth siteory`

```json
{ "$schema": "https://opencode.ai/config.json", "mcp": { "siteory": { "type": "remote", "url": "https://api.siteory.co/mcp", "enabled": true } } }
```

**Windsurf** (`~/.codeium/windsurf/mcp_config.json`)

```json
{ "mcpServers": { "siteory": { "serverUrl": "https://api.siteory.co/mcp" } } }
```

**Clients without remote servers**: bridge through `mcp-remote`:

```json
{ "mcpServers": { "siteory": { "command": "npx", "args": ["-y", "mcp-remote", "https://api.siteory.co/mcp"] } } }
```

The MCP tools are `quick_audit`, `start_audit`, `get_audit`, `list_audits`, `list_issues`, `get_issue`, `get_report`, `rescan`, `compare_audits` and `get_account`. Details: [skills/siteory/references/mcp-tools.md](skills/siteory/references/mcp-tools.md).

## Use the CLI

```bash
npx siteory login                                                # sign in once (paid plan required)
npx -y siteory check http://localhost:3000                       # human-readable summary
npx -y siteory check https://example.com --lens seo,aeo --json   # JSON (schema siteory.local/1)
npx -y siteory check http://localhost:3000 --only seo_missing_h1 --fail-on info   # re-verify one fix
npx -y siteory check http://localhost:3000 --lens performance,accessibility --json   # local-only lenses
npx -y siteory check http://localhost:3000 --lens all --prod https://www.example.com --fail-on high   # pre-deploy gate
npx -y siteory check https://www.example.com --lens links,social --external   # also request outbound links and share images
```

Check a production build (`next build && next start`, `astro build && astro preview`, `vite build && vite preview`), not the dev server. `--prod https://www.example.com` judges host-dependent checks such as canonical hosts against your production hostname; for a local target it also maps production URLs to the local server. `npx siteory check --help` lists every option.

Lenses: without `--lens`, the checker runs the hosted audit's lenses, `seo`, `aeo` (alias `ai`), `security` and `foundations`. Six more run only locally and only when named: `performance` (alias `perf`), `accessibility` (`a11y`), `schema` (`structured-data`, `jsonld`), `links`, `social` (`og`) and `launch`. `--lens all` runs all ten, and each local-only lens adds its own score to `scores`. `--external` lets the links and social lenses request third-party URLs (at most 100, 10 per host, never private addresses); without it those checks are skipped.

To re-verify a fix, repeat the first run's `--prod`, `--external`, `--max-pages`, `--depth` and `--lens` flags with `--only <id> --fail-on info`, or use the `Verify locally:` line at the end of the finding's fix prompt. An `--only` id of a local-only lens (`perf_`, `a11y_`, `schema_`, `links_`, `social_`, `launch_`) turns its lens on by itself. Exit 0 counts only if the earlier run reported that id and this run does not list it under Skipped; an `--only` id that the run skips exits 2. For a leaked secret, run the whole `--lens security --fail-on high` check instead, because a rotated or different secret gets a new id.

| Exit code | Meaning |
|---|---|
| 0 | Ran; nothing at or above the `--fail-on` threshold |
| 1 | A finding at or above the threshold remains |
| 2 | Usage error, or an `--only` id that this run skips |
| 3 | The start page could not be read |
| 4 | Internal error |
| 5 | Not signed in, or the account has no paid plan |

### In CI

Not yet: the checker signs in through a browser on your own machine, so a CI runner cannot sign in. Run the gate locally before you deploy; CI sign-in tokens are planned.

## What runs where

| | Local checker (`siteory check`, the skills) | Hosted audit (MCP tools, siteory.co) |
|---|---|---|
| Runs on | Your machine | Siteory's servers |
| Targets | localhost, private networks, deployed sites | Public sites only |
| SEO and AI visibility checks | Same engine, ids and thresholds as the hosted audit | Yes |
| Security | Passive: response headers, CORS, secrets in client JavaScript | Passive plus active checks, verifiers, Supabase row-level security and exposure data |
| Performance, accessibility, structured data, links, social previews, launch checks | Yes, as opt-in lenses | No |
| History, reports, comparisons | No | Yes |
| Account or credits | A paid Siteory plan and `siteory login`; no credits used | The MCP tools need a paid Siteory plan. Previews are free; full audits use your free audit or credits |

## Privacy and safety

- The local checker sends nothing about the sites you check to Siteory; it contacts Siteory only to sign you in and confirm your plan. It sends only GET requests to the site you name: pages on the same origin, robots.txt, sitemaps, llms.txt, and the scripts, stylesheets, images, manifests and source maps those pages reference. The launch lens adds one request to a random unknown path (to see whether it returns 404), `/favicon.ico` when no icon is linked, and on deployed sites the `http://` and www or apex versions of the start URL. Only with `--external` does it request third-party URLs that your pages link to, and never private network addresses. It never signs in to that site, submits forms, fuzzes parameters or probes admin paths.
- It refuses URLs with credentials, link-local addresses and cloud metadata hosts, even when an agent asks.
- Secrets found in client JavaScript are reported as type and fingerprint; the checker never prints them.
- `siteory setup` writes only skill folders named `siteory*` and the `siteory` entry in each agent's MCP config, after backing up the file. It stores no tokens: each agent keeps its own OAuth tokens.
- `siteory login` saves the checker's sign-in in `~/.siteory/credentials.json`, readable only by you where the system supports it. `siteory logout` revokes it and deletes the file.
- Hosted audits run on Siteory's servers and are stored in your Siteory account. See the [privacy policy](https://siteory.co/privacy) and [terms](https://siteory.co/terms).
- Only audit sites you own or are allowed to test.

## Development

```bash
npm test                   # node --test
npm run validate           # skill frontmatter and file checks
npm run vendor             # copy the engine bundle from ../siteory-api/dist-cli/siteory.mjs
npm run vendor -- --from <path/to/siteory.mjs>
claude plugin validate . --strict
npm pack --dry-run
```

The check engine is built in the Siteory API repository (`npm run build:cli`) and vendored into `cli/engine.mjs` and every `skills/*/scripts/siteory.mjs`, so the npm package and each skill run the same version offline.

## License

Proprietary. Anyone may install the skills and the CLI; running the Siteory checker requires an active paid Siteory plan. You may not redistribute or modify the bundled checker. See [LICENSE](LICENSE) and the [terms](https://siteory.co/terms).
