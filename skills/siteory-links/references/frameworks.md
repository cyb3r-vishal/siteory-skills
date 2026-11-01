# Base URLs, redirects and trailing slashes by framework and host

Most link findings come from three settings: where the production origin is configured, how trailing slashes are handled, and where redirects live. Set each once.

## Next.js

- Internal links: `<Link href="/pricing">`, root-relative. Never prefix internal links with the site URL.
- Production origin: one module that every absolute URL uses (also feed it to `metadataBase`):
  ```ts
  // lib/site.ts
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (!fromEnv && process.env.NODE_ENV === "production") {
    throw new Error("Set NEXT_PUBLIC_SITE_URL to the production origin, for example https://www.example.com");
  }
  export const SITE_URL = fromEnv ?? "http://localhost:3000";
  ```
  `NEXT_PUBLIC_*` values are inlined at build time; set them in the host's build environment and rebuild.
- On Vercel, `VERCEL_URL` is the deployment's own `*.vercel.app` host (the cause of `links_preview_urls`). `VERCEL_PROJECT_PRODUCTION_URL` holds the production domain without `https://`.
- Trailing slashes: `trailingSlash: true` in `next.config.ts` makes routes end in `/`; write links the same way, or leave the default (no slash) and never add one.
- Redirects: `async redirects()` in `next.config.ts` with `permanent: true` for moved pages; update the links that still point at the old path.
- Remote images and scripts: `images.remotePatterns` entries with `protocol: "https"`.
- Anchors: MDX headings get ids from `rehype-slug` when it is configured; link to those generated ids.

## Astro

- Production origin: `site` in `astro.config.mjs`; read it as `Astro.site` or `import.meta.env.SITE`.
- Trailing slashes: `trailingSlash: "always" | "never" | "ignore"` together with `build.format` (`"directory"` writes `/about/index.html`, served as `/about/`; `"file"` writes `/about.html`). Write links in the form the deployed host serves without a redirect.
- Redirects: `redirects: { "/old": "/new" }` in the config.
- Markdown heading ids come from the heading text (lowercase, hyphenated); link to the id the built HTML shows.
- Public variables (`PUBLIC_*`) are inlined at build time.

## Vite with React, Vue or Svelte

- `VITE_*` variables are inlined at build time; a missing `VITE_API_URL` with a localhost fallback is a common `links_dev_urls` source.
- Apps deployed under a sub-path need `base` in `vite.config.ts`, and links built with `import.meta.env.BASE_URL` or the router's basename.
- A single-page app answers every path with the same HTML, so the checker sees only links in `index.html` unless routes are prerendered. Anchor targets rendered by React are not in the server HTML either.

## WordPress

- Settings > General: "WordPress Address (URL)" and "Site Address (URL)" must be the production `https://` address with the right host.
- Content and settings copied from staging or from `http://`: `wp search-replace 'https://staging.example.com' 'https://www.example.com' --dry-run`, then run it without `--dry-run`. WP-CLI handles serialized data; a raw SQL replace corrupts it.
- Menus: custom links in Appearance > Menus or the Navigation block often hold absolute staging or `http://` URLs.
- Permalinks: after changing the permalink structure, add 301 redirects for old URLs (Redirection plugin or server rules) and update internal links.

## Static hosts

- **Trailing slashes.** Hosts redirect between `/page` and `/page/` depending on how the file is named: `page/index.html` is usually served at `/page/`, and `page.html` at `/page`. Vercel has `trailingSlash` and `cleanUrls` in `vercel.json`; Cloudflare Pages redirects `/page.html` to `/page` and `/page/index.html` to `/page/`; GitHub Pages redirects a folder path without a slash to the slash form. Make links match the URL the host settles on.
- **Redirect rules.** Netlify and Cloudflare Pages `_redirects` (`/old /new 301`), Vercel `vercel.json` `redirects`, nginx `return 301`.
- **www and https.** Redirect the other host and `http://` at the host or CDN, then use the final form in links.
- **Deployment URLs.** Netlify `URL` is the production URL; `DEPLOY_URL` and `DEPLOY_PRIME_URL` name the deploy. Cloudflare Pages `CF_PAGES_URL` names the deployment.
