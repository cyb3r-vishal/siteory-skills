# Fixing SEO findings in Astro

Verify with a production build: `npx astro build && npx astro preview` (http://localhost:4321). With an SSR adapter, `astro preview` runs the adapter's server when the adapter supports it; otherwise start the built server the adapter documents.

## One layout owns the head

Most findings are fixed in the shared layout. Give it props for the per-page values and make every page pass them:

```astro
---
// src/layouts/Base.astro
interface Props { title: string; description: string; image?: string; noindex?: boolean }
const { title, description, image = "/og.png", noindex = false } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);
const ogImage = new URL(image, Astro.site);
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{`${title} | Acme`}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    {noindex && <meta name="robots" content="noindex" />}
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={ogImage} />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body><slot /></body>
</html>
```

Set `site` in `astro.config.mjs` to the production origin (`site: "https://www.example.com"`). Without it `Astro.site` is undefined, canonicals and og:image URLs break, and `@astrojs/sitemap` cannot build absolute URLs.

| Finding | Fix |
|---|---|
| `seo_missing_title`, `seo_duplicate_title`, `seo_title_quality` | Pass a specific `title` from every page. "Astro" is flagged as a template default. |
| `seo_missing_description`, `seo_duplicate_description`, `seo_description_quality` | Pass `description` from every page. For content collections, make it required in the schema so a missing one fails the build: `description: z.string().min(50).max(160)`. |
| `seo_canonical_*` | Build the canonical from `Astro.url.pathname` and `Astro.site`, as above. Keep `trailingSlash` in the config consistent with the links you write. |
| `seo_noindex` | Only set the robots meta where a page passes `noindex`. |
| `seo_missing_viewport`, `seo_missing_lang` | Both belong in the layout, as above. |
| `seo_missing_social` | og:title, og:description, og:image (absolute) and twitter:card in the layout. |
| `seo_missing_h1`, `seo_multiple_h1`, `seo_skipped_headings` | Headings are in pages and components; keep the logo out of `<h1>`. In Markdown content, the post title is often rendered as H1 by the layout, so start the Markdown at `##`. |
| `seo_missing_alt` | `<Image>` from `astro:assets` requires `alt`; use `alt=""` for decorative images. In Markdown, write `![description](src)`. |
| `seo_broken_internal_links` | Fix the href; for moved pages add `redirects: { "/old": "/new" }` in `astro.config.mjs`. |

## robots.txt and sitemap

`@astrojs/sitemap` writes `/sitemap-index.xml` and `/sitemap-0.xml`. Siteory looks for `/sitemap.xml` and for `Sitemap:` lines in robots.txt, so declare the index in robots.txt:

```txt
# public/robots.txt
User-agent: *
Allow: /

Sitemap: https://www.example.com/sitemap-index.xml
```

Or generate robots.txt from config:

```ts
// src/pages/robots.txt.ts
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap-index.xml", site)}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
```

## Slow homepage and HTTPS

Static output (the default) is the fastest. With `output: "server"`, keep the homepage prerendered with `export const prerender = true` in its page. HTTPS is a host setting.
