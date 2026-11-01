# Fixing SEO findings in a Vite + React single-page app

Verify with a production build: `npx vite build && npx vite preview` (http://localhost:4173).

## Why SPAs need extra work

A Vite SPA serves the same `index.html` for every route and builds the page in the browser. Siteory reads the HTML the server sends, like most crawlers and AI fetchers do, so:

- Tags in `index.html` apply to every URL. A title or description set at runtime (React 19 `<title>` in components, react-helmet-async, `document.title`) is invisible to the checker and to crawlers that do not run JavaScript. That shows up as `seo_duplicate_title`, `seo_duplicate_description` and, on the AI side, `aeo_js_only_start`.
- An empty `<div id="root"></div>` means no H1, no text and no links in the HTML.
- Hosts that rewrite every path to `index.html` answer unknown URLs, `/robots.txt` and `/sitemap.xml` with the app shell and status 200, unless real files exist.

Pick one of these, from least to most work:

1. **Static head in `index.html`** for a one-page site: a real title, description, canonical for `/`, OG tags, and visible fallback text inside `#root` that React replaces.
2. **Prerender each route at build time.** Options: React Router framework mode with `prerender` in `react-router.config.ts`, `vite-react-ssg`, or Vike with prerendering. Each route then ships its own HTML with its own head and content.
3. **Move to a server-rendering framework** (React Router framework mode with `ssr: true`, Next.js, Astro with React islands) when content is dynamic.

## Fixes in index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Acme: invoicing for small agencies</title>
    <meta name="description" content="Acme sends invoices, chases late payments and reconciles bank feeds for agencies with 2 to 50 people." />
    <link rel="canonical" href="https://www.example.com/" />
    <meta property="og:title" content="Acme: invoicing for small agencies" />
    <meta property="og:description" content="Invoices, reminders and bank reconciliation for small agencies." />
    <meta property="og:image" content="https://www.example.com/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body>
    <div id="root"><main><h1>Invoicing for small agencies</h1><p>Acme sends invoices and chases late payments for you.</p></main></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

"Vite + React", "Vite + React + TS" and "Vite App" are flagged as template defaults. A canonical in `index.html` is only correct for `/`; with client-side routes, leave it out or prerender.

## Per-route head with prerendering

With React Router framework mode, each route module exports `meta`:

```tsx
// app/routes/pricing.tsx
export function meta() {
  return [
    { title: "Pricing for small agencies | Acme" },
    { name: "description", content: "Three plans from $12 per month, all with unlimited clients and recurring invoices." },
    { tagName: "link", rel: "canonical", href: "https://www.example.com/pricing" },
  ];
}
```

```ts
// react-router.config.ts
import type { Config } from "@react-router/dev/config";
export default { ssr: false, prerender: ["/", "/pricing", "/about"] } satisfies Config;
```

## robots.txt, sitemap, 404s

- Put `robots.txt` and `sitemap.xml` in `public/`. Vite copies them to the build output, and hosts serve real files before applying SPA rewrites.
- Generate `sitemap.xml` at build time from the route list (a small Node script run after `vite build` is enough).
- Configure the host so unknown paths return 404 where possible (Netlify serves `404.html` with status 404 when there is no catch-all rewrite). With a catch-all rewrite to `index.html`, broken links return 200 and `seo_broken_internal_links` cannot see them.

## Other findings

| Finding | Fix |
|---|---|
| `seo_missing_lang`, `seo_missing_viewport` | In `index.html`, as above. |
| `seo_missing_h1`, `seo_multiple_h1`, `seo_skipped_headings` | In components; only visible to the checker for prerendered routes or the fallback markup. |
| `seo_missing_alt` | Add `alt` to every `<img>` in JSX; `alt=""` for decorative images. |
| `seo_noindex` | Look for a robots meta in `index.html` and an `X-Robots-Tag` header in the host config (`vercel.json`, `netlify.toml`, `public/_headers`). |
| `seo_slow_start`, `seo_homepage_http` | Static hosting is fast by default; enable HTTPS and the http-to-https redirect at the host. |
