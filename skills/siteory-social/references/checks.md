# Social preview checks (lens social)

Each entry: the id, when it fires and at what severity, the one-line fix, and what to change. Penalties: high 20, medium 10, low 5, info 0; `scores.social` is 100 minus the penalties of the findings. Each id is reported once per run and lists every affected URL.

How the lens reads a page:

- It covers `og:*` and `twitter:*` meta tags on every crawled page. Links in `href` and `src` belong to the links lens.
- Share images are fetched with GET (up to 8 MB) and their pixel size is read from the PNG, JPEG, GIF or WebP header.
- Images on the checked origin are always fetched; with `--prod`, images on the production host are mapped to the local server first. Images on any other host are fetched only with `--external`, and are listed under `skipped` without it.

## social_image_dev_url (high)
`og:image` or `og:url` points to localhost, a private address, or a preview host (`*.vercel.app`, `*.netlify.app`, `*.pages.dev` and similar) other than the checked host and the `--prod` host. Every share shows a broken image or links to the wrong build. Evidence: page, tag and URL.
Fix: build share URLs from the production origin.
Change: find where the absolute URL is built. The common causes: a site URL variable that falls back to `http://localhost:3000` at build time; a deployment variable such as Vercel `VERCEL_URL` (the deployment's own host) used as the site URL; Next.js without `metadataBase` on a host other than Vercel, where relative share images resolve to `http://localhost:3000` (frameworks.md). Set the production origin once, rebuild, and check again.

## social_image_relative (medium)
`og:image` or `twitter:image` is not an absolute `http(s)` URL, for example `/og.png`. Platforms do not resolve relative URLs, so no image is shown. Evidence: page, tag and value.
Fix: use an absolute https URL for every share image.
Change: build it from the production origin: Next.js resolves relative metadata URLs against `metadataBase`; Astro `new URL(image, Astro.site)`; elsewhere `new URL(path, SITE_URL).href`.

## social_image_broken (medium)
The share image returns 400 or above, the request fails, or the response is not an image (an HTML error page with status 200 counts). Images on another host are checked only with `--external`. Evidence: image URL, status or error, and Content-Type.
Fix: point each share image at a file that loads and is served as an image.
Change: fix the path or file name (case matters on most hosts), make sure the file is in the deployed output (`public/` for most frameworks), and fix generated images that throw at request time (missing fonts or data in an `opengraph-image` route). Images behind a login, basic auth or hotlink protection cannot be fetched by platforms either.

## social_image_size (low below 1200x630 or over 5 MB; medium below 200x200)
The share image is smaller than 1200x630 pixels (low), smaller than 200x200 (medium: many platforms show no image or a tiny thumbnail), or larger than 5 MB (low: X rejects images over 5 MB, Facebook over 8 MB). Evidence: image URL, width x height and file size.
Fix: use a 1200x630 PNG or JPEG under 5 MB.
Change: export the share image at 1200x630 (a 1.91:1 ratio). Keep important text away from the edges, because some platforms crop to a square. Compress photos as JPEG at quality 80 to 85. For generated images, set the size explicitly (Next.js `export const size = { width: 1200, height: 630 }`).

## social_tags_missing (low)
A page without `og:title`, `og:description` or `og:image`. Evidence lists the missing tags per page.
Fix: give every page an og:title, og:description and og:image.
Change: set defaults in the shared layout (site name, default image) and override title, description and image per page from its own data. Pages that are never shared (checkout steps, account pages) can inherit the defaults.

## social_twitter_card (low)
No `twitter:card` while Open Graph tags exist, or a value other than `summary`, `summary_large_image`, `app` or `player`. Evidence: page and value.
Fix: add `<meta name="twitter:card" content="summary_large_image">`.
Change: set it once in the shared layout. Use `summary` only for a small square image. X reads `og:title`, `og:description` and `og:image` when the `twitter:` versions are missing, so those need not be duplicated. In Next.js, a page that sets its own `twitter` object must repeat `card`, because nested metadata objects replace the parent's.

## social_og_url_mismatch (low)
`og:url` differs from the page's canonical URL (after normalizing a trailing slash). Shares then count against a different URL than search, and some platforms show the `og:url` page. Evidence: page, og:url and canonical.
Fix: make og:url equal the page's canonical URL.
Change: generate both from the same route path. The usual bug is an `og:url` (or canonical) set once in a shared layout to the homepage, which every page inherits; set it per page instead.
