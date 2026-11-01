# Fixing SEO findings in Nuxt, SvelteKit, React Router, Remix, Gatsby and on static hosts

Short notes per stack. The check-by-check meaning is in references/checks.md of this skill; the same principles apply everywhere: one layout owns the defaults, every page sets its own title, description and canonical from its own data, and the production origin comes from one setting.

## Nuxt 3 and 4

- Production check: `npx nuxi build && npx nuxi preview` (http://localhost:3000).
- Defaults in `nuxt.config.ts`: `app: { head: { htmlAttrs: { lang: "en" }, titleTemplate: "%s | Acme" } }`. Nuxt adds the viewport meta by default.
- Per page: `useSeoMeta({ title, description, ogTitle, ogDescription, ogImage, twitterCard: "summary_large_image" })` and `useHead({ link: [{ rel: "canonical", href: "https://www.example.com" + route.path }] })`.
- robots.txt and sitemap: put robots.txt in `public/`, or use the `@nuxtjs/robots` and `@nuxtjs/sitemap` modules (set `site.url` to the production origin).
- `ssr: false` turns the app into an SPA with an empty HTML shell; keep SSR on or prerender public routes (`nuxi generate`, or `routeRules: { "/": { prerender: true } }`).
- Images: `<NuxtImg>` takes `alt` like `<img>`.

## SvelteKit

- Production check: `npx vite build && npx vite preview` (http://localhost:4173), or `node build` with adapter-node (port 3000).
- `src/app.html` holds `<html lang="en">` and the viewport meta (both present in the default template).
- Per page, in `+page.svelte`: `<svelte:head><title>{data.title} | Acme</title><meta name="description" content={data.description} /><link rel="canonical" href={`https://www.example.com${page.url.pathname}`} /></svelte:head>` (`page` from `$app/state`, or `$page` from `$app/stores` in older versions).
- Do not set `export const ssr = false` on public pages: they become empty shells. Use `export const prerender = true` for static pages.
- robots.txt goes in `static/`. Serve a sitemap from `src/routes/sitemap.xml/+server.ts` with `export const prerender = true` and a `Content-Type: application/xml` header.

## React Router 7 (framework mode) and Remix

- Production check: `npm run build && npm run start` (react-router-serve or remix-serve, http://localhost:3000).
- `app/root.tsx` renders `<html lang="en">`, `<meta name="viewport" ...>`, `<Meta />` and `<Links />`.
- Per route, export `meta` returning `[{ title }, { name: "description", content }, { tagName: "link", rel: "canonical", href }]`. Build it from loader data so every URL differs.
- robots.txt in `public/`; a sitemap from a resource route such as `app/routes/sitemap[.]xml.ts` whose loader returns XML with `Content-Type: application/xml`.
- With `ssr: false` (SPA mode), list public routes in `prerender` in `react-router.config.ts`; otherwise the HTML is empty.

## Gatsby

- Production check: `npx gatsby build && npx gatsby serve` (http://localhost:9000).
- Use the Head API in each page: `export const Head = ({ data }) => (<><title>{data.post.title} | Acme</title><meta name="description" content={data.post.excerpt} /><link rel="canonical" href={...} /></>)`.
- Set `lang` with `setHtmlAttributes({ lang: "en" })` in `onRenderBody` in `gatsby-ssr.js`.
- Plugins: `gatsby-plugin-sitemap` (writes `/sitemap-index.xml`; declare it in robots.txt) and `gatsby-plugin-robots-txt` or a `static/robots.txt`.
- `GatsbyImage` and `StaticImage` require `alt`.

## Static hosts (Vercel, Netlify, Cloudflare Pages, GitHub Pages)

- **Preview deployments.** Vercel sends `X-Robots-Tag: noindex` on preview deployment URLs on purpose, so `seo_noindex` on a preview URL is expected. Judge noindex on the production domain.
- **www versus apex.** Pick one host, redirect the other to it, and use the same host in canonicals, sitemaps and `metadataBase`/`site`. A mismatch gives `seo_canonical_other_host` and `seo_start_redirect`.
- **HTTPS.** Enable "Enforce HTTPS" (GitHub Pages) or the equivalent; Vercel, Netlify and Cloudflare Pages redirect by default.
- **SPA rewrites.** A catch-all rewrite to `/index.html` (Netlify `/* /index.html 200`, Vercel `rewrites`, Cloudflare Pages SPA mode) answers every unknown path with 200. Real files such as `robots.txt` and `sitemap.xml` are served before the rewrite, so ship them; broken links stay invisible until unknown paths return 404.
- **Redirects** for moved pages: Netlify and Cloudflare Pages `_redirects` (`/old /new 301`), Vercel `vercel.json` `redirects`.
- **Plain HTML sites** (Hugo, Eleventy, Jekyll, hand-written): fix titles, descriptions, canonicals, `lang` and the viewport in the base template or partial that every page includes; set the base URL (`baseURL` in Hugo, `url` in Jekyll) to production so absolute URLs are right.
