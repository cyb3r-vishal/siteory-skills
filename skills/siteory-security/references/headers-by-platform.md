# Security headers by platform

Set headers where the HTML response is produced: the framework for server-rendered apps, the host or CDN for static sites. Set them once, for every path, and verify on the deployed URL as well as locally: host files such as `_headers` and `vercel.json` do nothing on localhost.

## Baseline

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy-Report-Only: <policy, see references/csp-rollout.md>
```

- **HSTS**: send it only over HTTPS. `includeSubDomains` covers every subdomain, so confirm they all serve HTTPS first. Add `preload` only when the owner wants to submit the domain to the browser preload list; it is hard to undo. Many hosts (Vercel, for example) already send HSTS; check the live response before adding a second one.
- **X-Frame-Options**: `DENY` unless the site frames its own pages (WordPress admin and the Customizer do), then `SAMEORIGIN`. CSP `frame-ancestors 'none'` is the modern equivalent; sending both is fine.
- **Permissions-Policy**: turn off only features the site does not use. If it uses geolocation or the camera, use `geolocation=(self)` or `camera=(self)` instead of `()`.
- **CSP**: never ship an enforced CSP without a Report-Only phase; it can break scripts, styles, fonts and embeds.

## Next.js

`next.config.ts` applies headers on `next start` and on Vercel (not with `output: "export"`; use the host config then):

```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
```

A CSP with nonces is set per request in `proxy.ts` (Next.js 16; earlier versions use `middleware.ts` with an exported `middleware` function). Next.js reads the nonce from the request's CSP header and applies it to its own scripts. Pages must render dynamically for nonces to work.

```ts
// proxy.ts
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp); // use Content-Security-Policy-Report-Only while rolling out
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
```

Read the nonce in a Server Component with `(await headers()).get("x-nonce")` and pass it to `<Script nonce={nonce}>` for third-party scripts. For static pages without nonces, set the CSP in `next.config` headers instead (it then needs `'unsafe-inline'` for scripts), or use the experimental hash-based option `experimental.sri`.

## Vercel (any framework)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

Save as `vercel.json` in the project root.

## Netlify and Cloudflare Pages: _headers

Put a `_headers` file in the published output directory. For Vite and Astro that means `public/_headers`, which the build copies to `dist/`. Cloudflare Workers static assets read the same file.

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Netlify also accepts `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

## Cloudflare (proxied sites and Workers)

- HSTS: SSL/TLS > Edge Certificates > HTTP Strict Transport Security.
- Other headers: Rules > Transform Rules > modify response headers, for all requests to the hostname.
- In a Worker, copy the response and set headers:

```ts
export default {
  async fetch(request, env) {
    const upstream = await fetch(request);
    const response = new Response(upstream.body, upstream);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return response;
  },
};
```

## nginx

```nginx
server {
    listen 443 ssl;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
}
```

- `always` adds the header on error responses too.
- A `location` block that has any `add_header` of its own drops every `add_header` from the `server` level. Repeat the set there, or keep it in a snippet and `include` it in each block.
- Test and reload: `nginx -t && nginx -s reload`.

## Apache

In the HTTPS virtual host or `.htaccess` (needs `mod_headers`, enabled with `a2enmod headers`):

```apache
<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
</IfModule>
```

## WordPress

Prefer the web server config above: page-cache plugins and CDNs often serve cached HTML without running PHP, so headers set in PHP go missing on cached pages. When only PHP is available, use a must-use plugin:

```php
<?php
// wp-content/mu-plugins/security-headers.php
add_action( 'send_headers', function () {
	header( 'X-Content-Type-Options: nosniff' );
	header( 'X-Frame-Options: SAMEORIGIN' );
	header( 'Referrer-Policy: strict-origin-when-cross-origin' );
	header( 'Permissions-Policy: camera=(), microphone=(), geolocation=()' );
	if ( is_ssl() ) {
		header( 'Strict-Transport-Security: max-age=31536000; includeSubDomains' );
	}
} );
```

Use `SAMEORIGIN`, not `DENY`: the Customizer and some admin screens frame the site.

## Other frameworks

| Stack | Where |
|---|---|
| Astro (server output) | `src/middleware.ts`: `export const onRequest = defineMiddleware(async (_ctx, next) => { const res = await next(); res.headers.set("X-Content-Type-Options", "nosniff"); return res; })`. Prerendered pages need the host config. |
| Vite SPA | Host config (`vercel.json`, `public/_headers`, nginx). Mirror the same headers in `vite.config.ts` `preview.headers` so `vite preview` matches production locally. |
| Nuxt | `routeRules: { "/**": { headers: { "X-Content-Type-Options": "nosniff", ... } } }` in `nuxt.config.ts` |
| SvelteKit | `handle` in `src/hooks.server.ts` sets `response.headers`; CSP with nonces or hashes is built in through `kit.csp` in `svelte.config.js`. |
| React Router or Remix | Set headers in `entry.server.tsx` on the document response, or with a route `headers` export. |
| Express | `app.use(helmet())` from the `helmet` package sets a strong default set; review its default CSP before enabling it. |
| Fastify | `@fastify/helmet` |

## Verify

```bash
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens security --json --full
```

Read `securityHeaders.headers` (each `present: true`) and confirm the matching observations are gone from `findings`. HSTS can only pass on an HTTPS URL, so check it on the deployed site: `npx -y siteory check https://www.example.com --lens security --json --full`.
