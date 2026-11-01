---
name: siteory-security
description: Check and harden a site's browser security headers and client bundles with the Siteory checker, then verify each fix. Covers Content-Security-Policy (with a report-only rollout and nonces), Strict-Transport-Security (HSTS), X-Content-Type-Options, X-Frame-Options and frame-ancestors, Referrer-Policy, Permissions-Policy, wildcard CORS, and API keys or tokens leaked into client JavaScript (AWS, Stripe, GitHub, Slack, private keys, Supabase service_role). Use when the user asks about security headers, CSP, HSTS, clickjacking, CORS, exposed secrets in the frontend bundle, or a pre-deploy security check, on Next.js, Vercel, Netlify, Cloudflare, nginx, Apache, WordPress, Astro, Vite, Nuxt or SvelteKit.
license: Proprietary. See LICENSE.
compatibility: Requires Node.js 20 or later for the bundled checker (scripts/siteory.mjs). The optional full security audit uses the Siteory MCP server.
metadata:
  author: siteory
  version: "0.1.0"
---

# Siteory security headers and client secrets

This skill runs Siteory's passive security checks, fixes what they find, and verifies the result. Passive means the checker only reads what any visitor gets: the response headers of the start page and the JavaScript the site sends to browsers. It never probes paths, logs in or sends payloads. Siteory's hosted audit adds active checks; see the last section.

Only check sites the user owns or is allowed to test.

## Before you start

The Siteory checker needs a paid Siteory plan (from $9, see https://siteory.co/pricing) and a sign-in on this machine. `<skill base dir>` below is the folder that holds this SKILL.md.

- `node "<skill base dir>/scripts/siteory.mjs" whoami` shows whether this machine is signed in (exit 0) or not (exit 5).
- To sign in once, run `node "<skill base dir>/scripts/siteory.mjs" login`. It opens the user's browser and waits up to 5 minutes for them to finish.
- Exit code 5 from any command means the user is not signed in or has no paid plan. Tell the user what the message says and stop. Never try to get around it.

## 1. Serve the production build

Headers often come from the host, not the app, and dev servers send different headers. Check a production build locally, then the deployed site.

| Stack | Build and serve | URL |
|---|---|---|
| Next.js | `npx next build && npx next start` (applies `next.config` headers and `proxy.ts`) | http://localhost:3000 |
| Astro | `npx astro build && npx astro preview` | http://localhost:4321 |
| Vite, SvelteKit | `npx vite build && npx vite preview` (applies `preview.headers`) | http://localhost:4173 |
| Nuxt | `npx nuxi build && npx nuxi preview` | http://localhost:3000 |
| React Router or Remix | `npm run build && npm run start` | http://localhost:3000 |
| WordPress | `npx @wordpress/env start` (needs Docker) | http://localhost:8888 |

Host files (`vercel.json`, `_headers`, `netlify.toml`, CDN rules) only take effect on the host. For those, check a preview or production URL.

## 2. Run the check

Run the bundled script by its absolute path from the project directory, without `cd`. `<skill base dir>` is the folder that holds this SKILL.md; your agent shows it when it loads the skill:

```bash
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens security --json --full
```

`--full` matters here: missing headers are reported as observations, which only appear with `--full`, together with the `securityHeaders` block. If the script prints "The Siteory check engine is not bundled" (exit 4), use `npx -y siteory check <url> --lens security --json --full` (`npx.cmd` in Windows PowerShell).

Exit codes: 0 done, 1 `--fail-on` threshold met, 2 usage error or a skipped `--only` id, 3 start page unreadable, 4 engine error, 5 not signed in or no paid plan.

## 3. Read the result

- `securityHeaders`: `{https, checked, missing, headers: [{id, label, present}], cookies: {total, missingFlags}}` for the start document. Header ids: `hsts`, `csp`, `nosniff`, `frame`, `referrer`, `permissions`.
- `findings[]`: security entries have ids like `se_3f9c0a1b2c4d`, derived from the check, the host and the route; for a leaked secret, from the secret value in place of the script path. Findings (verdict likely) are leaked secrets and wildcard CORS with credentials; observations are header gaps, `unsafe-inline` in the CSP, wildcard CORS without credentials and public Supabase keys.
- There is no local security score.

| Problem | Severity | Kind |
|---|---|---|
| Supabase service_role key in client JavaScript | critical | finding |
| Private key, AWS, GitHub, Slack, Stripe live or Bearer token in client JavaScript | high | finding |
| Wildcard CORS with credentials | medium | finding |
| HSTS missing on HTTPS | low | observation |
| CSP missing or allowing `unsafe-inline`; X-Content-Type-Options, frame protection, Referrer-Policy or Permissions-Policy missing; wildcard CORS | info | observation |

Pass rules, titles and the fix text Siteory prints for each one are in references/checks.md. Evidence for secrets shows only the type, the file and a fingerprint; the checker never prints the secret.

## 4. Decide the order

1. **Secrets** (critical, high): stop and tell the user right away. The credential must be rotated at the provider; removing it from the code is not enough. Follow references/secrets.md.
2. **Wildcard CORS with credentials**: reflect specific trusted origins instead of `*`.
3. **HSTS**, then the cheap headers: X-Content-Type-Options, frame protection, Referrer-Policy, Permissions-Policy. These rarely break anything.
4. **CSP** last, through a report-only phase. An enforced CSP added in one step can break scripts, styles, fonts, embeds and payments.

## 5. Fix

Decide where headers are produced, then follow references/headers-by-platform.md:

| Where the HTML comes from | Set headers in |
|---|---|
| Next.js on `next start` or Vercel | `next.config.ts` `headers()`; a nonce CSP in `proxy.ts` (Next.js 16; `middleware.ts` before) |
| Static build on Vercel, Netlify or Cloudflare | `vercel.json`, or `_headers` in the published folder (`public/_headers` for Vite and Astro) |
| Your own server | nginx `add_header ... always`, Apache `Header always set`, or the app framework (helmet, hooks, middleware) |
| WordPress | web server config first; an mu-plugin on `send_headers` when only PHP is available |
| Cloudflare in front | Transform Rules or a Worker; HSTS under SSL/TLS > Edge Certificates |

Baseline values:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Adjust before applying: use `X-Frame-Options: SAMEORIGIN` when the site frames itself (WordPress admin does); allow the browser features the site uses (`geolocation=(self)`); only add `includeSubDomains` when every subdomain serves HTTPS, and never add `preload` without the owner's decision.

For the CSP, follow references/csp-rollout.md: inventory what pages load, ship `Content-Security-Policy-Report-Only`, fix the reported violations, then enforce, then tighten with nonces or hashes. Siteory counts only an enforced `Content-Security-Policy` header, so the CSP observation stays during the report-only phase.

For full detail on one finding (implementation steps and a fix prompt):

```bash
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens security --only se_3f9c0a1b2c4d --json
```

## 6. Verify

Keep `--prod`, `--max-pages` and `--depth` as in the run that reported the finding.

Leaked secrets: rebuild, then run the whole security lens and search the build output (references/secrets.md):

```bash
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens security --fail-on high
```

It exits 1 while any secret finding remains (secrets are high or critical). A secret keeps its id across rebuilds only while its value stays the same; a rotated or different secret gets a new id, so `--only <old id>` can exit 0 while a new key still ships.

Wildcard CORS with credentials works with `--only` and the exit code:

```bash
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens security --only se_3f9c0a1b2c4d --fail-on info
```

Exit 0 counts as fixed only if a run with the same flags reported that id and this run does not list it under Skipped (a skipped `--only` id exits 2). Observations never fail `--fail-on`, so verify header fixes by reading the output:

```bash
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens security --json --full
```

Each fixed header shows `present: true` in `securityHeaders.headers`, and its observation is gone from `findings`. HSTS can only pass on HTTPS, so verify it on the deployed URL with `npx -y siteory check https://www.example.com --lens security --json --full`. For a CSP, also click through the production build with the browser console open and confirm there are no violations.

Report to the user: what changed and where, what was verified locally, what must be verified after deploy (host headers, HSTS), and any credential that still needs rotating.

## 7. When to use the hosted audit

The local checker runs only passive checks. A full Siteory audit through the MCP tools (umbrella skill `siteory`) adds active discovery of common paths, injection and access-control verifiers, Supabase row-level security probes and public exposure data, and it judges headers from outside on the real HTTPS host. Use it for a deployed site the user owns: `start_audit {url, lenses: ["security"]}`, `get_audit` with `wait_seconds: 25` until `status` is completed, failed or cancelled, `list_issues {lens: "security"}`, `get_issue`, fix, `rescan`, `compare_audits`. Findings from the active checks cannot be verified locally (their `verify.local` is null): verify them after the deploy with `rescan` and `compare_audits`. Security results carry `validationStatus`: `confirmed` was proven, `likely` has strong evidence, `observed` is a configuration signal. If the tools are missing, the user can connect them with `npx siteory setup`.

Never point the checker or the hosted audit at sites the user does not control, and never print, log or commit a secret you find.
