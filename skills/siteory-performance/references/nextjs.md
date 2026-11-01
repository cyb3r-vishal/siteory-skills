# Fixing performance findings in Next.js

Covers the App Router in Next.js 16; most of it applies from 13.4. Check the version in package.json: Next.js 16 replaced the `priority` prop of next/image with `preload`, builds with Turbopack by default (`next build --webpack` opts out), and renamed `middleware.ts` to `proxy.ts`.

Verify with a production build: `npx next build && npx next start` (http://localhost:3000). `next dev` ships unminified code and a dev overlay, so its sizes mean nothing.

## Images with next/image

`perf_image_weight`, `perf_image_format`, `perf_image_dimensions`, `perf_lazy_images`.

Replace plain `<img>` tags with `next/image`. It resizes on request, serves WebP (or AVIF when configured) to browsers that accept it, writes `srcset`, sets `width` and `height`, and lazy-loads by default.

```tsx
import Image from "next/image";
import hero from "./hero.jpg"; // a static import gives width, height and a blur placeholder

export function Hero() {
  return (
    <Image
      src={hero}
      alt="Invoices dashboard with this month's totals"
      sizes="100vw"
      loading="eager"
      fetchPriority="high" // the likely LCP image: load it first, never lazily
      placeholder="blur"
    />
  );
}
```

- Every other image keeps the default `loading="lazy"`.
- `preload` (Next.js 16) also adds a `<link rel="preload">` in the head; use it for a single, obvious LCP image. It replaces the deprecated `priority` prop and cannot be combined with `loading="lazy"`.
- Remote images need `images.remotePatterns` in `next.config.ts`, plus `width` and `height` (or `fill`).
- With `fill`, give the parent `position: relative` and a size or `aspect-ratio`, and always pass `sizes`; without it the browser assumes 100vw and downloads a larger file.
- The optimizer chooses WebP or AVIF from the request's `Accept` header and keeps the original format for animated images and SVG.

Formats and widths in `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"], // AVIF first, WebP as fallback; WebP alone is the default
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048], // the default list ends at 3840
  },
};

export default nextConfig;
```

With `sizes` or `fill`, next/image lists candidates up to the largest `deviceSizes` entry, and `perf_image_weight` weighs the largest candidate. Drop 3840 when no image is shown that wide, or lower `quality` for photos. Images in `public/` served through a plain `<img>` are not optimized at all.

`output: "export"` has no image optimizer: use `unoptimized` images that were resized at build time, or a custom `loader` for an image CDN.

## Fonts with next/font

`perf_font_display`: next/font self-hosts the files, preloads them and sets `font-display: swap` by default, so moving `@font-face` rules and Google Fonts `<link>` tags to next/font clears the finding.

```tsx
// app/layout.tsx
import { Inter } from "next/font/google";
import localFont from "next/font/local";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const brand = localFont({ src: "./fonts/brand.woff2", variable: "--font-brand" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${brand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

Remaining `@font-face` rules in `globals.css` (or a CSS file a package ships) need `font-display: swap` added by hand.

## Scripts with next/script

`perf_render_blocking_scripts`, `perf_third_party_scripts`.

```tsx
import Script from "next/script";

<Script src="https://example-analytics.com/script.js" strategy="afterInteractive" />  // default
<Script src="https://widget.example-chat.com/loader.js" strategy="lazyOnload" />       // idle time
```

- A raw `<script src>` inside `<head>` in the root layout blocks rendering; move it to `next/script`.
- `beforeInteractive` is always placed in the head and runs before hydration; keep it for the rare script that must run first, such as a consent manager.
- Google Tag Manager, Google Analytics, YouTube and Google Maps embeds have components in `@next/third-parties/google` (experimental) that load after hydration.

## JavaScript weight

`perf_js_weight`:

1. Find the large modules: `npx next experimental-analyze` (Turbopack, Next.js 16.1 and later; `--output` writes the analysis to `.next/diagnostics/analyze`), or `@next/bundle-analyzer` with `next build --webpack`.
2. Move `"use client"` down to the smallest interactive leaf. A layout or page marked `"use client"` sends everything it imports to the browser.
3. Run data-to-UI libraries (markdown, syntax highlighting, chart rendering to static SVG) in Server Components so only their HTML is sent.
4. Load heavy interactive pieces on demand, from a Client Component (lazy loading applies to Client Components; a Server Component that dynamically imports one gets no code splitting):
   ```tsx
   "use client";
   import dynamic from "next/dynamic";
   const Chart = dynamic(() => import("./chart"), { loading: () => <p>Loading chart...</p> });
   ```
   `ssr: false` is only allowed in Client Components, and content rendered that way is missing from the HTML that crawlers read.
5. Packages with many exports: list them in `experimental.optimizePackageImports`. Next.js already does this for many popular icon and utility libraries.

## HTML weight

`perf_html_weight`: the App Router embeds the RSC payload in `self.__next_f.push(...)` scripts at the end of the HTML. Every prop a Server Component passes to a Client Component is serialized there, on top of the rendered HTML. Pass ids and the few fields the client needs instead of whole records, paginate long lists, and avoid passing large Markdown or JSON strings to client components. In the Pages Router, trim the props returned by `getStaticProps` or `getServerSideProps`; they end up in `__NEXT_DATA__`.

## Compression and caching

- `next start` compresses responses with gzip by default. `perf_no_compression` on a self-hosted app means `compress: false` is set or a proxy in front strips the encoding. Behind nginx, set `compress: false` and let nginx do gzip or Brotli (hosting.md).
- `/_next/static/` files get `Cache-Control: public, max-age=31536000, immutable`, which cannot be overridden in `next.config`. If `perf_static_cache` lists them, a CDN or proxy in front rewrites the header: fix its cache rules.
- Vercel compresses and caches `/_next/static/` correctly; files in `public/` are served with a short cache, which is right for unhashed names.
- `output: "export"` on a static host: add a cache rule for `/_next/static/*` in the host's config (hosting.md).
