# Security checks (lens security)

The local checker runs Siteory's passive security checks: it judges the response headers of the start document and reads same-origin JavaScript (script files referenced by crawled pages, plus each page's HTML for inline scripts and framework data). It sends no extra requests beyond the crawl and never probes paths, logs in or submits anything.

## Ids, kinds and severities

Security ids are `se_` plus 12 hex characters, derived from the check, the host and the route; for a leaked secret, the secret value takes the place of the script path. Header and CORS ids stay the same between runs, so `--only se_...` works for them. A secret keeps its id when a rebuild renames its script, but a rotated or different secret gets a new id, so verify secret fixes with a full `--lens security --fail-on high` run (references/secrets.md). A local id differs from the hosted audit's id for the same problem unless `--prod` maps the host.

Each result has a verdict that sets its kind:

| Verdict | findingKind | Scored | Counts for `--fail-on` |
|---|---|---|---|
| confirmed | finding | yes (hosted audit only) | yes |
| likely | finding | no | yes |
| observed | observation | no | no |

Locally there is no security score: every passive result is likely or observed. Observations appear only with `--json --full`.

## Header preview (securityHeaders in --full output)

Judged on the start document. A header seen without a captured value counts as present.

| id | Label | Passes when |
|---|---|---|
| `hsts` | Strict-Transport-Security | the site is HTTPS and `max-age` is above 0 (`max-age=0` switches HSTS off). Never passes over `http://`, so it cannot pass on localhost. |
| `csp` | Content-Security-Policy | an enforced `Content-Security-Policy` header is present. `Content-Security-Policy-Report-Only` does not count, and a CSP in a `<meta>` tag is not read. |
| `nosniff` | X-Content-Type-Options | the value contains `nosniff` |
| `frame` | Clickjacking protection | `X-Frame-Options` is `DENY` or `SAMEORIGIN`, or the CSP has `frame-ancestors` |
| `referrer` | Referrer-Policy | the header is present |
| `permissions` | Permissions-Policy | the header is present |

`cookies` counts Set-Cookie headers on the start document and how many lack `Secure` or `HttpOnly`. No issue is raised for cookies; mention the count when it is not zero.

## Header observations

| Title | Severity | Fix Siteory gives |
|---|---|---|
| HSTS header was not observed on HTTPS responses | low, obs (HTTPS only) | "Add a Strict-Transport-Security header with a long max-age on HTTPS responses." Implementation: `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| Content-Security-Policy was not observed | info, obs, CWE-693 | "Send a Content-Security-Policy that limits where scripts, styles and frames may load from." Start with `default-src 'self'`, list third-party origins, use nonces or hashes for inline scripts, add `frame-ancestors 'none'`, roll out with Report-Only first. |
| Content-Security-Policy allows unsafe-inline | info, obs, CWE-79 | "Replace inline scripts with nonces or hashes and tighten the CSP." Also fires on a Report-Only policy. |
| X-Content-Type-Options was not observed | info, obs | "Send X-Content-Type-Options: nosniff on all responses." |
| Frame-busting header was not observed | info, obs | "Send Content-Security-Policy frame-ancestors or X-Frame-Options: DENY." |
| Referrer-Policy was not observed | info, obs | "Send Referrer-Policy: strict-origin-when-cross-origin." |
| Permissions-Policy was not observed | info, obs | "Send a Permissions-Policy that turns off browser features the site does not use." Example: `camera=(), microphone=(), geolocation=()` |

## CORS

| Title | Severity | Fix |
|---|---|---|
| Wildcard CORS with credentials was observed | medium, finding (likely), CWE-942 | "Do not combine wildcard origins with Access-Control-Allow-Credentials." Reflect a specific allowed origin instead of `*` when credentials are needed. |
| Wildcard CORS origin was observed | info, obs | "Restrict Access-Control-Allow-Origin to specific trusted origins if browsers should not read cross-origin responses." Fine for public, unauthenticated content. |

## Secrets in client JavaScript

Patterns matched in same-origin script files and page HTML. Evidence never contains the secret: it shows the type, the asset URL and a SHA-256 fingerprint, with the context "[redacted]".

| Pattern | Title | Severity |
|---|---|---|
| `-----BEGIN (RSA \|EC \|OPENSSH )?PRIVATE KEY-----` | Private key material observed in client JavaScript | high, finding |
| `AKIA` plus 16 characters | AWS access key pattern observed in client JavaScript | high, finding |
| `ghp_` plus 20 or more characters | GitHub token pattern observed in client JavaScript | high, finding |
| `xoxb-`, `xoxa-`, `xoxp-`, `xoxr-`, `xoxs-` tokens | Slack token pattern observed in client JavaScript | high, finding |
| `sk_live_` plus 10 or more characters | Stripe live secret key pattern observed in client JavaScript | high, finding |
| `Bearer` followed by a token | Bearer token pattern observed in client JavaScript | high, finding |
| `service_role` or `SUPABASE_SERVICE_ROLE_KEY` assigned a key value (`eyJ...` or `sb_secret_...`); the name alone does not count | service_role-like value observed in client JavaScript | high, finding |
| A JWT whose role claim is `service_role`, or a `service_role` name assigned a key value | Supabase service_role-like credential observed in client JavaScript | critical, finding |
| Supabase anon key | Supabase public anon key pattern observed in client JavaScript | info, obs ("Rely on RLS. Do not treat the anon key as a secret.") |
| Supabase project URL | Supabase project URL observed in client JavaScript | info, obs |

Fix for every secret finding: "Rotate the credential and remove it from client-side assets." Rotation comes first; removing the string from the bundle does not revoke a key that was already published. Runbook: references/secrets.md.

The scanner matches patterns, so a match can be a false positive, for example a sample key in a code example, or `Bearer` in documentation text. Check the context in the source before telling the user it is safe; when unsure, treat it as a real key.

## What only the hosted audit checks

Active discovery of common paths (login, admin, GraphQL, WordPress), verifiers (injection, access control, WordPress), Supabase row-level security probes, exposed services and known CVEs from public internet data. These need explicit authorisation and run only from Siteory's servers in a full audit.
