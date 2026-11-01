# Compression and cache headers by host

`perf_no_compression` and `perf_static_cache` are judged only on a deployed URL, because the host decides both. Set them once at the layer that serves the files, then re-check the deployed site:

```bash
node "<skill base dir>/scripts/siteory.mjs" check https://www.example.com --lens performance --only perf_no_compression,perf_static_cache --fail-on info
```

Goals:

- Compress HTML, CSS, JavaScript, JSON, SVG and XML with Brotli (best) or gzip. Do not compress images, fonts in WOFF2, or video; they are already compressed.
- Fingerprinted files (a content hash in the name) get `Cache-Control: public, max-age=31536000, immutable`.
- HTML and unhashed files keep a short cache or revalidation (`max-age=0, must-revalidate`, or a CDN `s-maxage`), so a deploy shows up at once.

Hashed paths by framework: Next.js `/_next/static/`, Astro `/_astro/`, Vite `/assets/`, Nuxt `/_nuxt/`, SvelteKit `/_app/immutable/`, Gatsby `/static/` and hashed `.js` files in the root.

## Vercel

Compression is automatic. Next.js `/_next/static/` is cached for a year automatically. For other frameworks, add a rule for the hashed folder in `vercel.json`:

```json
{
  "headers": [
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```

## Netlify

Compression is automatic. Netlify serves every file with `max-age=0, must-revalidate` unless told otherwise. Add `_headers` to the published folder (`public/_headers` for Vite and Astro):

```text
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

Or in `netlify.toml`:

```toml
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

## Cloudflare (Pages, Workers static assets, or the proxy in front of any origin)

Cloudflare compresses responses to browsers with Brotli or gzip. Static assets on Pages and Workers need a `_headers` file in the output folder, same format as Netlify's:

```text
/_astro/*
  Cache-Control: public, max-age=31536000, immutable
```

With Cloudflare proxying your own origin, set the header at the origin, or add a Cache Rule or a Response Header Transform Rule for the hashed path.

## GitHub Pages

Compression is automatic, but the cache lifetime is fixed at 10 minutes and cannot be changed. `perf_static_cache` cannot be fixed there; tell the user, and suggest a host with header control (or a CDN in front) if caching matters.

## nginx

```nginx
gzip on;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_types text/css application/javascript application/json image/svg+xml application/xml text/plain;
# text/html is always compressed when gzip is on.
# Brotli needs the ngx_brotli module: brotli on; brotli_types <same list>;

location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable" always;
  try_files $uri =404;
}
```

When nginx proxies a Next.js or Node server, either let the app compress or turn the app's compression off (`compress: false` in `next.config.ts`) and let nginx do it; do not strip `Content-Encoding` in between.

## Apache

```apache
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml application/xml text/plain
</IfModule>
<IfModule mod_brotli.c>
  AddOutputFilterByType BROTLI_COMPRESS text/html text/css application/javascript application/json image/svg+xml
</IfModule>
```

For the cache header, put an `.htaccess` file inside the hashed-assets folder (needs mod_headers):

```apache
Header set Cache-Control "public, max-age=31536000, immutable"
```

## Caddy

```caddyfile
example.com {
  encode zstd gzip
  header /assets/* Cache-Control "public, max-age=31536000, immutable"
  root * /srv/dist
  file_server
}
```

## Node servers (Express and similar)

```js
import compression from "compression";
import express from "express";

const app = express();
app.use(compression());
app.use("/assets", express.static("dist/assets", { immutable: true, maxAge: "1y" }));
app.use(express.static("dist", { maxAge: 0 }));
```

## Object storage and CDNs (S3 with CloudFront, and similar)

Set `Cache-Control` as object metadata when uploading hashed files (`aws s3 sync dist/assets s3://bucket/assets --cache-control "public, max-age=31536000, immutable"`), and enable automatic compression in the CDN distribution.

## WordPress hosts

Managed WordPress hosts usually compress and set browser caching. On a plain server, use the nginx or Apache rules above, or a caching plugin (WP Rocket, W3 Total Cache, LiteSpeed Cache) that writes them for you.
