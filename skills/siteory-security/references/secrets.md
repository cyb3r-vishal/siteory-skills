# Secrets in client bundles

Anything in JavaScript sent to the browser is public: anyone can open the file and read it. A secret found there must be treated as leaked, even if the site has few visitors.

## Secret or public by design

| Public by design (fine in client code) | Secret (never in client code) |
|---|---|
| Supabase anon or publishable key (data protection comes from row-level security) | Supabase `service_role` or secret key |
| Stripe publishable key `pk_live_...` | Stripe secret key `sk_live_...`, restricted key `rk_live_...`, webhook secret `whsec_...` |
| Firebase web config `apiKey` (protect data with security rules) | Firebase service account JSON, Admin SDK private key |
| Google Maps browser key restricted by HTTP referrer | Unrestricted Google API keys, OAuth client secrets |
| Algolia search-only key, Sentry DSN, analytics write keys | Algolia admin key, AWS access keys, GitHub and Slack tokens |
| reCAPTCHA or Turnstile site key | reCAPTCHA or Turnstile secret key, OpenAI or Anthropic API keys, database URLs with passwords, JWT signing secrets, private keys |

Siteory matches seven patterns (private keys, AWS `AKIA`, GitHub `ghp_`, Slack `xox*-`, Stripe `sk_live_`, `Bearer` tokens, a `service_role` name assigned a key value) plus Supabase service_role JWTs. It does not catch everything: after a fix, also search the build output for other secret shapes, for example `grep -rE "sk-(proj-|ant-)|rk_live_|whsec_|postgres(ql)?://[^ ]*:[^ ]*@" .next/static dist build`.

## How secrets reach the browser

| Stack | Exposed to the browser | Server only |
|---|---|---|
| Next.js | `NEXT_PUBLIC_*`, and any value passed from a Server Component to a Client Component as a prop (it is serialised into the page) | other `process.env.*`; mark server modules with `import "server-only"` |
| Vite | `VITE_*` through `import.meta.env`, and anything in `define` | other variables (not loaded into client code) |
| Astro | `PUBLIC_*`; `astro:env` fields with `access: "public"` | `astro:env` fields with `access: "secret"` |
| Nuxt | `runtimeConfig.public` | top-level `runtimeConfig` |
| SvelteKit | `$env/static/public`, `$env/dynamic/public` (`PUBLIC_` prefix) | `$env/static/private`, `$env/dynamic/private` (importing them in client code fails the build) |
| Create React App, Gatsby, Expo | `REACT_APP_*`, `GATSBY_*`, `EXPO_PUBLIC_*` | everything else |

Other routes in: a key hard-coded in source, a config JSON imported by a client component, source maps published with the site (`.map` files contain the original source; Next.js does not publish them unless `productionBrowserSourceMaps` is on), and inline `<script>` data such as `__NEXT_DATA__` or a serialised store.

## Runbook

Do not print the secret in chat, logs or commit messages. Refer to it by type, file and line.

1. **Rotate first.** Removing the string from the bundle does not undo the leak: old deployments, CDN caches and anyone who downloaded the file still have it. Ask the user to rotate the credential at the provider (the agent usually cannot):
   - AWS: IAM > the user > Security credentials: create a new access key, deploy it, deactivate then delete the old one. Review CloudTrail for use of the old key.
   - GitHub: revoke the token under Settings > Developer settings, create a new fine-grained token with the least scope.
   - Slack: regenerate or revoke the token in the app's OAuth settings.
   - Stripe: Developers > API keys > Roll key; check the request logs for unexpected use.
   - Supabase: create a new secret key and delete the leaked one (or rotate the JWT secret for legacy keys, which also changes the anon key). Then audit row-level security.
   - Private keys: issue a new key pair or certificate and revoke the old one.
2. **Move the call to the server.** Create a route handler, server action, API route or edge function that holds the key and does the privileged work; the browser calls that endpoint. Check the user's session and permissions in it.
3. **Remove the value from client code.** Drop the public prefix (`NEXT_PUBLIC_`, `VITE_`, ...) from secret variables, delete hard-coded values, stop passing secrets as props, and store the new key only in the server environment (host dashboard or secret manager), never in the repo.
4. **Rebuild and verify** (below).
5. **Clean up copies.** Delete old deployments that still serve the leaked bundle where the host keeps them reachable, purge CDN caches, and remove the value from `.env` files that are committed. Rewriting git history is only worth it for public repositories and only when the user asks; rotation is what actually protects the account.

## Verify

```bash
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens security --fail-on high
```

Run the whole security lens with the same `--prod`, `--max-pages` and `--depth` flags as the run that found the secret. It exits 1 while any secret finding remains (secrets are high or critical), so exit 0 means no secret pattern appears in the scripts or HTML it read. Skip `--only` here: ids follow the secret value, so the same secret keeps its id when a rebuild renames the chunk that holds it, but a rotated or different secret gets a new id, and `--only <old id>` would exit 0 while the new key still ships. Then search the build output for the old value's prefix and the shapes above, and remind the user that rotation at the provider is still required if it has not been confirmed.
