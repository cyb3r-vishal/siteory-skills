# Launch checks (lens launch)

Each entry: the id, when it fires and at what severity, the one-line fix, and what to change. Penalties: high 20, medium 10, low 5, info 0; `scores.launch` is 100 minus the penalties of these findings. Each id is reported once per run and lists every affected URL. Host settings for the fixes are in hosts.md.

What the lens requests beyond the crawl: one random unknown path for `launch_soft_404`, `/favicon.ico` when no icon is linked, linked manifests, scripts, stylesheets, images and source maps referenced by the site, and on deployed targets one request each to the `http://` and the www or apex twin of the start URL. Nothing else: no admin paths, no `/.env`, no `/.git`.

## launch_dev_build (high)
The HTML or its scripts come from a development build or a dev server: `/_next/static/development/`, `react-dom.development`, `/@vite/client`, `__vite__`, webpack-dev-server or HMR clients (`webpack-hmr`, `__webpack_hmr`), or Next.js `"buildId":"development"`. Dev builds are slow, large, leak source and error details, and break when the dev server restarts. Evidence: page and the marker found.
Fix: serve a production build.
Change:
- Locally: you checked the dev server. Build and start the production server (SKILL.md section 1) and run the gate again.
- Deployed: find the start command that runs `next dev`, `vite`, `npm run dev` or `astro dev`: the Dockerfile `CMD`, a Procfile, a PM2 or systemd config, or the host's start command setting. Replace it with the build plus the production start (`next start`, `node .output/server/index.mjs`, `node build`) or serve the static output folder.
- Remove `NODE_ENV=development` from the production environment.

## launch_broken_assets (high for scripts and stylesheets; medium for images)
A same-origin script, stylesheet or image referenced by a crawled page returns 400 or above. A missing script or stylesheet breaks the page for every visitor. Evidence: page, asset URL and status.
Fix: make every referenced asset load, or remove the reference.
Change:
- HTML cached longer than assets after a deploy (it references hashed files that no longer exist): purge the CDN, cache HTML briefly, and keep the previous deploy's hashed files available for a while.
- A site deployed under a sub-path without the matching setting: Vite `base`, Next.js `basePath` (and `assetPrefix` for a CDN), Astro `base`.
- File name case: `Logo.png` in code and `logo.png` on disk works on macOS and Windows but fails on Linux hosts. Match the case exactly.
- Next.js `output: "standalone"`: the standalone server does not serve `public/` or `.next/static/` unless they are copied next to it (`cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/`), or served by a CDN.
- Files referenced from outside the folder the host publishes (`public/` for most frameworks).

## launch_soft_404 (medium)
The lens requests one random path on the site, such as `/siteory-404-check-1a2b3c4d`, and it answers with a 2xx status. Unknown URLs that return 200 look like duplicate pages to search engines, hide broken links from every checker (including `seo_broken_internal_links`), and confuse monitoring. Evidence: the probe URL and status.
Fix: return status 404 for URLs that do not exist.
Change:
- Single-page apps behind a catch-all rewrite to `index.html` (Netlify `/* /index.html 200`, Vercel `rewrites`, Cloudflare Pages without a top-level `404.html`): prerender the real routes, ship a `404.html`, and drop the catch-all, or narrow it to the app's own paths (hosts.md).
- Next.js returns 404 for unmatched paths by itself. A soft 404 comes from a catch-all or root dynamic route (`app/[...slug]/page.tsx`, `app/[slug]/page.tsx`) that renders a fallback instead of calling `notFound()`, or from `notFound()` running after streaming has started (a `loading.tsx` above it): the response is then 200 with a noindex meta. Check that the record exists before anything streams, use `generateStaticParams` with `export const dynamicParams = false` for a fixed set, or return a 404 from `proxy.ts`.
- Astro: add `src/pages/404.astro`; in a server-rendered catch-all route, `return new Response(null, { status: 404 })` when nothing matches.
- WordPress: plugins that redirect every 404 to the homepage turn unknown URLs into 200s; remove them and keep the theme's `404.php`.
- Express and other Node servers: end with a handler that sends `res.status(404)`.

## launch_template_leftovers (medium)
Visible text on a crawled page contains starter-template or placeholder text: "lorem ipsum", "Get started by editing", "Edit src/App", "and save to reload", "Vite + React", "Welcome to Next.js", "Create Next App", "Your Name", "example@example.com" or "123 Main St". Evidence: page and the matched text.
Fix: replace placeholder text with the real content.
Change: search the source for the phrase in the evidence. Starter pages (`app/page.tsx` from create-next-app, `src/App.tsx` from Vite) and their logos (`next.svg`, `vite.svg`) usually need to go entirely. Footers, contact sections and forms collect the rest. Ask the user for the real name, address, email and copy; never invent them.

## launch_https_redirect (medium; deployed https targets only)
The lens requests the `http://` version of the start URL once, without following redirects past the first hop, and it does not redirect to `https://`. Visitors who type the address, and old links, land on an insecure page. Skipped on local targets. Evidence: the http URL, status and Location.
Fix: redirect every http request to https with a permanent (301 or 308) redirect.
Change: Vercel, Netlify and Cloudflare Pages do it automatically for their domains. Cloudflare in front of an origin: SSL/TLS > Edge Certificates > Always Use HTTPS. GitHub Pages: Enforce HTTPS. nginx and Apache: hosts.md. Then add HSTS (skill siteory-security).

## launch_favicon (low)
No `<link rel="icon">` (or `shortcut icon` or `apple-touch-icon`) in the HTML, and `/favicon.ico` returns 400 or above. Browsers show a blank tab icon, and search results may show a generic globe. Evidence: start page and the `/favicon.ico` status.
Fix: add a favicon.
Change: Next.js App Router: `app/favicon.ico`, `app/icon.png` or `app/icon.svg`, and `app/apple-icon.png`; Next.js writes the link tags. Astro and Vite: put `favicon.svg` (and `favicon.ico` for old browsers) in `public/` and add `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` to the layout or `index.html`. WordPress: Settings > General > Site Icon (or Site Identity in the Customizer). Replace framework default icons too.

## launch_manifest (low)
A `<link rel="manifest">` points at a file that returns 400 or above or is not valid JSON. Evidence: manifest URL and the status or parse error.
Fix: serve a valid web manifest, or remove the link.
Change: Next.js: `app/manifest.ts` returning a `MetadataRoute.Manifest` (or `app/manifest.json`). Static sites: `public/site.webmanifest` with `name`, `short_name`, `icons` (192 and 512 px), `start_url`, `display` and `theme_color`. Favicon generators often add the link without the file being copied. Plain JSON only: no comments, no trailing commas.

## launch_sitemap_missing (low)
No sitemap was found: nothing at `/sitemap.xml` and no working `Sitemap:` line in robots.txt.
Fix: publish an XML sitemap and name it in robots.txt.
Change: Next.js `app/sitemap.ts`; Astro `@astrojs/sitemap` (writes `/sitemap-index.xml`, so add a `Sitemap:` line to robots.txt); WordPress core `/wp-sitemap.xml` or the SEO plugin's sitemap; Vite apps generate one at build time into `public/`. List only URLs that return 200. Framework details are in the siteory-seo skill.

## launch_www_consistency (low; deployed only)
The www twin of an apex host (or the apex twin of a www host) answers 200 instead of redirecting to the host that was checked. Two hosts serve the same site, which splits links and search signals. Skipped on local targets and when the twin host does not resolve. Evidence: the twin URL and status.
Fix: redirect the other host name to the canonical one with a permanent redirect.
Change: choose www or apex once. Vercel: add both domains and set one to redirect to the other. Netlify: set the primary domain; aliases redirect to it. Cloudflare: a Redirect Rule from one host to the other. nginx: a separate `server` block that returns 301 (hosts.md). Use the same host in canonicals, sitemaps and links (skill siteory-seo).

## launch_source_maps (low)
A same-origin script ends with `//# sourceMappingURL=` and the `.map` file it names is served with status 200. Anyone can read the original source, including comments and internal paths. Fine if intentional (open-source projects often publish them). Evidence: script and map URLs.
Fix: stop serving source maps publicly, unless that is intended.
Change: Next.js produces browser source maps only with `productionBrowserSourceMaps: true`; remove it. Vite: `build.sourcemap: false`, or `"hidden"` to build maps without the comment so an error tracker can use them. Error trackers (for example the Sentry bundler plugins) can upload maps during the build and delete them from the output; with `"hidden"`, still delete the `.map` files before deploying so they are not downloadable.
