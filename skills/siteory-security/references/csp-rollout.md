# Rolling out a Content-Security-Policy

A CSP tells the browser which scripts, styles, images, frames and connections a page may use. It is the main defence that limits the damage of an XSS bug. A wrong enforced policy also breaks the site, so roll it out in report-only mode first.

Siteory's `csp` check passes only for an enforced `Content-Security-Policy` response header. During the report-only phase the observation "Content-Security-Policy was not observed" stays; that is expected.

## 1. Inventory what the pages load

- Third-party scripts: analytics, tag managers, chat widgets, payments, maps, A/B testing, error tracking.
- Inline `<script>` blocks and inline event handlers (`onclick="..."`).
- Styles from CSS-in-JS libraries or inline `style` attributes, web fonts, images from CDNs.
- API calls (`fetch`, WebSocket) and iframes (video embeds, payment fields).

Search the code for `<script`, `src="https://`, `dangerouslySetInnerHTML`, `eval(` and `new Function(`, and open the production build with the browser's network panel.

## 2. Start report-only

```
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com; frame-src https://js.stripe.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; report-uri https://example.com/csp-reports; report-to csp
Reporting-Endpoints: csp="https://example.com/csp-reports"
```

- `report-uri` is older but widely supported; `report-to` with the `Reporting-Endpoints` header is the newer form. Sending both is fine. Reports are POSTed as JSON to that URL; a hosted collector or a small endpoint that logs them works.
- Without an endpoint, the browser console still prints every violation; use that locally against a production build.
- A report-only policy never blocks framing, and `frame-ancestors` does not work at all in a `<meta>` policy; keep sending `X-Frame-Options` meanwhile.

Leave it running against real traffic for days, not minutes, so rare pages and flows report too.

## 3. Fix the violations

| Violation | Fix |
|---|---|
| An inline script you own | Move it to a file served from `'self'`, or give it a nonce (server-rendered pages) or a hash (static pages). |
| A third-party script | Add its exact origin to `script-src`, or load it with a nonce and use `'strict-dynamic'`. |
| An inline event handler | Replace with `addEventListener` in a script file. |
| `eval` or `new Function` in a library | Update or replace the library; avoid `'unsafe-eval'` in production. Next.js and React need `'unsafe-eval'` only in development. |
| Styles | Frameworks often inject inline styles; `style-src 'unsafe-inline'` is a smaller risk than in `script-src`. Use a nonce when the framework supports it. |
| Images, fonts, connections, frames | Add the origins to `img-src`, `font-src`, `connect-src` or `frame-src`. |

Common origins: Google Fonts (`https://fonts.googleapis.com` in `style-src`, `https://fonts.gstatic.com` in `font-src`), Stripe (`https://js.stripe.com` in `script-src` and `frame-src`), YouTube embeds (`https://www.youtube-nocookie.com` in `frame-src`). Tag managers that inject custom HTML need nonce support or `'unsafe-inline'`; prefer moving those tags into code.

## 4. Enforce

Rename the header to `Content-Security-Policy`. Keep the report endpoint. Optionally keep a stricter `Content-Security-Policy-Report-Only` alongside to trial the next tightening.

## 5. Tighten

The strongest practical policy uses nonces with `'strict-dynamic'`:

```
script-src 'nonce-{random per response}' 'strict-dynamic'; object-src 'none'; base-uri 'none'
```

- **Nonce**: a fresh random value per response, added to every allowed `<script>`. Needs server rendering on each request. Next.js applies it automatically when `proxy.ts` sets it (see references/headers-by-platform.md); SvelteKit through `kit.csp`; Express with helmet and a per-request nonce.
- **Hash**: `'sha256-...'` of an inline script's exact text. Works for static sites; every change to the script changes the hash. Next.js has an experimental hash-based mode (`experimental.sri`).
- **Origin allowlist** (`script-src 'self' https://cdn.example.com`): easiest to start with, weakest, because any script on an allowed origin can run.
- With `'strict-dynamic'`, scripts loaded by an already-trusted script are trusted too, and supporting browsers ignore the origin allowlist.

Siteory reports "Content-Security-Policy allows unsafe-inline" (info) when `'unsafe-inline'` appears anywhere in the policy, including `style-src`. Removing it from `script-src` matters most.

## Next.js notes

- Nonces require dynamic rendering: static optimisation, ISR and Partial Prerendering do not get nonces, and pages cannot be cached at the CDN without extra work. Weigh this before choosing nonces for a mostly static site.
- In development, `script-src` needs `'unsafe-eval'`; add it only when `NODE_ENV` is `development`.
- Without nonces, put the CSP in `next.config` `headers()`; scripts then need `'unsafe-inline'`.

## Verify

```bash
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens security --json --full
```

After enforcement, `securityHeaders.headers` shows `csp` and, with `frame-ancestors` in the policy, `frame` as present. Then click through the production build with the console open: no CSP violations, and every page, form, embed and payment flow still works.
