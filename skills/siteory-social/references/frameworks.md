# Share tags by framework

The goal on every stack: defaults in one layout, per-page title, description, URL and image from the page's own data, and every URL absolute on the production host.

## Next.js (App Router, metadata API)

Read the production origin from one place, and fail the build when it is missing instead of falling back to localhost:

```ts
// lib/site.ts
const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
if (!fromEnv && process.env.NODE_ENV === "production") throw new Error("Set NEXT_PUBLIC_SITE_URL to the production origin");
export const SITE_URL = fromEnv ?? "http://localhost:3000";
```

Set the origin and the defaults in the root layout:

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { siteName: "Acme", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};
```

Nested metadata objects such as `openGraph` and `twitter` are replaced, not merged, by the last segment that defines them. A page that sets `openGraph: { title }` loses the layout's `siteName`, `type` and images. Build page metadata with one helper so nothing is dropped:

```ts
// lib/share.ts
import type { Metadata } from "next";

export function pageMetadata({ title, description, path, image = "/og.png" }: { title: string; description: string; path: string; image?: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title, description, url: path, siteName: "Acme", type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
```

```tsx
// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  return pageMetadata({ title: post.title, description: post.excerpt, path: `/blog/${slug}`, image: post.coverImage });
}
```

Because `url` and `alternates.canonical` come from the same `path`, `social_og_url_mismatch` cannot happen.

**Image files instead of config.** Put `opengraph-image.png` (1200x630) and an `opengraph-image.alt.txt` in `app/` for the site default, and in any route segment to override it there. Next.js emits `og:image` with its width, height and type. A `twitter-image` file is optional, since X falls back to `og:image`. The build fails when an `opengraph-image` is over 8 MB or a `twitter-image` over 5 MB.

**Generated images.** `opengraph-image.tsx` renders a PNG with `ImageResponse` from `next/og`:

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Acme blog post";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  return new ImageResponse(<div style={{ fontSize: 64, display: "flex", padding: 80 }}>{post.title}</div>, size);
}
```

**Where relative share URLs resolve.** Without `metadataBase`, Next.js resolves relative Open Graph and Twitter image URLs on Vercel against the production domain (`VERCEL_PROJECT_PRODUCTION_URL`) in production and the deployment URL in previews, and against `http://localhost:3000` everywhere else. A self-hosted build without `metadataBase` therefore ships `og:image` URLs on localhost (`social_image_dev_url` on the deployed site). Always set `metadataBase` to the production origin, and never to `VERCEL_URL`.

## Astro

```astro
---
// src/layouts/Base.astro (head excerpt)
interface Props { title: string; description: string; image?: string }
const { title, description, image = "/og.png" } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);
const ogImage = new URL(image, Astro.site);
---
<link rel="canonical" href={canonical} />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Acme" />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonical} />
<meta property="og:image" content={ogImage} />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content={title} />
<meta name="twitter:card" content="summary_large_image" />
```

`site` in `astro.config.mjs` must be the production origin; without it `Astro.site` is undefined. For per-post images generated at build time, add an endpoint such as `src/pages/og/[slug].png.ts` that renders a 1200x630 PNG (satori with @resvg/resvg-js is a common pair) and pass its path as `image`.

## Vite with React, Vue or Svelte

Platforms never run JavaScript, so tags set at runtime (react-helmet-async, React 19 `<meta>` in components, `document.head` changes) are invisible to them. Put site-wide tags in `index.html` with absolute URLs; they apply to every route. For per-route cards, prerender the routes (React Router framework mode with `prerender`, `vite-react-ssg`) or render the head on the server.

## WordPress

- One plugin should print Open Graph tags. SEO plugins (Yoast SEO, Rank Math, SEOPress, All in One SEO) do; turn off duplicates from Jetpack or the theme.
- Set the default share image in the plugin's social settings, and per post in the editor's social tab. Without a per-post image, the featured image is used, so upload featured images at least 1200 px wide.
- A database copied from staging keeps staging image URLs: `wp search-replace 'https://staging.example.com' 'https://www.example.com' --dry-run`, then without `--dry-run`.

## Nuxt, SvelteKit and Remix

- Nuxt: `useSeoMeta({ ogTitle, ogDescription, ogImage, ogUrl, twitterCard: "summary_large_image" })` with absolute URLs; the `nuxt-og-image` module generates images.
- SvelteKit: `<svelte:head>` in the layout and pages, with `og:image` built from a production origin constant, not `page.url.origin` (which is the preview or local origin).
- React Router 7 and Remix: return `{ property: "og:image", content: absoluteUrl }` entries from each route's `meta` export, built from loader data.

## Preview deployments and static hosts

- Deployment variables name the deployment, not production: Vercel `VERCEL_URL`, Netlify `DEPLOY_URL` and `DEPLOY_PRIME_URL`, Cloudflare Pages `CF_PAGES_URL`. Build share URLs from your own production `SITE_URL` (Netlify's `URL` and Vercel's `VERCEL_PROJECT_PRODUCTION_URL` also name production).
- Previews protected by a login (Vercel Deployment Protection, Netlify password protection) answer platform fetchers with 401, so test cards on production or an unprotected preview.
