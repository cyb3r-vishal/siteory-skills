# SEO and foundations checks

Each entry: the id, when it fires and at what severity, the exact title and fix Siteory prints, and what to change. Severities and penalties: critical 30, high 20, medium 10, low 5, info 0; the score is 100 minus the penalties of scored findings. Observations (obs) are context only.

Pages analyzed are crawled HTML pages that returned a 2xx status. "Widespread" means at least 2 pages and at least half of them. Evidence lists stop at 20 rows plus "...and N more".

## Foundations (lens foundations)

When the start URL cannot be read, only the start check below is reported, the SEO and AEO scores are null, and the CLI exits 3.

### seo_start_server_error (critical)
Start URL returned HTTP 500 or above (not a bot challenge).
Title: "Start URL returned a server error". Fix: "Make the start URL return a successful HTML response."
Change: read the server log for that request; the app is crashing on the homepage, often a missing environment variable or a failing data fetch in the root layout.

### seo_start_robots (high)
robots.txt disallows the start path for `User-agent: *`.
Title: "Start URL blocked by robots.txt". Fix: "Review the robots.txt rule that disallows the start URL. Allow it if the page is meant to be crawled."
Change: remove or narrow the `Disallow: /` rule. A staging robots.txt shipped to production is the usual cause.

### seo_start_blocked (high)
Bot protection answered (401/403/429/503 with a `cf-mitigated` or `x-vercel-mitigated` header, or a "Just a moment", "Attention required" or "Vercel Security Checkpoint" page), or plain HTTP 401/403/429.
Titles: "Homepage blocks automated visitors" (fix: "Let verified search and AI crawlers through your bot protection, then run the audit again.") or "Homepage refused the request (HTTP n)" (fix: "Let crawlers fetch the homepage without signing in or hitting a rate limit, then run the audit again.").
Change: in Cloudflare or Vercel firewall settings, allow verified bots; do not put the public homepage behind auth or an aggressive rate limit.

### seo_start_unreachable (high)
Any other start failure. The title names the cause: "Homepage returned HTTP n", "did not respond in time", "HTTPS connection failed", "host name did not resolve", "Homepage redirect loop", "redirects to another site", "did not return HTML", "is too large to analyze", "redirects do not reach a page", "could not be reached".
Change: fix the named cause. Locally, the usual cause is that the server is not running or listens on another port.

### seo_homepage_http (medium)
The start URL is served over `http:`. Skipped for local targets.
Title: "Homepage is not HTTPS". Fix: "Serve the start URL over HTTPS and redirect HTTP requests to it."
Change: enable HTTPS at the host or CDN and add a permanent redirect from http to https.

### seo_slow_start (low)
Start-page time to first byte above 1800 ms (one sample; 800 ms is the warning line in the checklist). Skipped for local targets.
Title: "Homepage responds slowly". Fix: "Cache the homepage HTML at a CDN or the server, and remove slow work (database queries, API calls) from the request path."
Change: make the homepage static or cached (Next.js static rendering or revalidate, Astro static output, a page cache plugin on WordPress); move slow fetches out of the root layout.

### seo_start_redirect (info, obs)
The start URL settled on its https or www twin. "Start URL redirects to the site's preferred address". No change needed; link to the final address directly.

### seo_depth_limited (info, obs)
Pages at the depth limit still had unfollowed same-host links. "Crawl stopped at the depth limit". Raise `--depth` if those pages matter.

## Indexing and canonicals

### seo_noindex (high if widespread, else low)
A robots meta tag or `X-Robots-Tag` header contains `noindex` or `none`.
Titles: "Widespread noindex directives" / "Page set to noindex". Fix: "Remove noindex from pages that should remain crawlable. Keep it only where the page is deliberately excluded."
Change: search for `noindex` in metadata, layouts, host config and headers. Common causes: an environment check that is wrong in production, a CMS "discourage search engines" setting, a preview-deployment header. Preview deployments on Vercel send `X-Robots-Tag: noindex` on purpose; judge noindex on the production URL.

### seo_canonical_other_host (high)
A page's canonical hostname differs from the start URL's hostname, or from the `--prod` host when it is given. Skipped locally unless `--prod` is given.
Title: "Canonical points at another host". Fix: "Confirm each cross-host canonical is intentional. Point it at the preferred URL on this host when it is not."
Change: build canonicals from one configured site URL (`metadataBase`, Astro `site`, WordPress Site Address). www versus apex mismatches count as another host.

### seo_canonical_error_target (high)
A canonical target was crawled and returned 400 or above. Targets that were not crawled are not judged.
Title: "Canonical points at an error response". Fix: "Point each canonical at a URL that returns a successful response, or fix the target."
Change: usually a trailing-slash or locale mismatch between the canonical builder and the real routes.

### seo_canonical_conflict (medium)
Page A's canonical points to crawled page B, and B's canonical is neither B nor A (a chain), or A and B point at each other (mutual).
Title: "Canonical chain or mutual conflict". Fix: "Pick one preferred URL. Point every variant at that URL, and make the preferred page self-canonical."
Change: generate each page's canonical from its own route; never inherit one canonical from a shared layout.

## Titles and descriptions

### seo_missing_title (medium)
The first `<title>` is empty or absent. Title: "Missing title". Fix: "Add a unique title element that describes each page."

### seo_duplicate_title (medium)
The same trimmed title on more than one page. Title: "Duplicate title". Fix: "Give each listed page its own title."
Change: build titles from page data (product name, post title) plus a brand suffix, instead of one site-wide title.

### seo_title_quality (medium if any title is a template default, else low)
Title shorter than 15 or longer than 60 characters (Unicode code points, whitespace collapsed), or a starter default: "Create Next App", "React App", "Vite + React", "Vite + React + TS", "Vite + Vue", "Vite + Vue + TS", "Vite App", "Vue App", "Angular App", "Svelte App", "SvelteKit App", "Astro", "Untitled", "Untitled Document", "Home", "Homepage", "Document", "Index", "My App", "My Website", "Welcome", "New Page" (case-insensitive).
Title: "Titles need rewriting". Fix: "Write a specific title of 15 to 60 characters for each listed page, naming what the page offers."
Change: lead with the page topic and end with the brand, for example "Pricing for small teams | Acme". Watch title templates: a 50-character page title plus " | Acme Corporation" goes over 60.

### seo_missing_description (medium)
Meta description empty or absent. Title: "Missing meta description". Fix: "Add a unique meta description for each listed page."

### seo_duplicate_description (medium)
The same description on more than one page. Title: "Duplicate meta description". Fix: "Give each listed page its own meta description."

### seo_description_quality (medium if a template default, else low)
Shorter than 50 or longer than 160 characters, or a default: "Generated by create next app", "Web site created using create-react-app", "A Vite/React/Vue/Svelte/Astro/Next.js app (or project)", "Description", "Just another WordPress site", anything starting "Lorem ipsum".
Title: "Meta descriptions need rewriting". Fix: "Write a specific meta description of 50 to 160 characters for each listed page, naming what the page offers."

## Headings, images, language

### seo_missing_h1 (medium)
No H1 on the page. An image inside the H1 counts through its alt text. Title: "Missing H1". Fix: "Add one H1 that states the page topic."

### seo_multiple_h1 (medium if widespread, else low)
More than one H1. Titles: "Widespread multiple H1 elements" / "Page has multiple H1 elements". Fix: "Keep one H1 on each listed page unless the extra H1 is deliberate."
Change: a logo or site name wrapped in H1 inside a shared header is the usual cause; make it a `<p>` or `<a>` and keep the H1 for the page topic.

### seo_skipped_headings (low)
A heading is more than one level deeper than the previous one, for example H1 then H3. Evidence shows `url: 1 -> 3`. Title: "Heading levels are skipped". Fix: "Use the next heading level instead of skipping one."
Change: choose heading levels by document structure and style them with CSS classes.

### seo_missing_alt (low)
An `<img>` without an `alt` attribute. `alt=""` passes (decorative). Title: "Images missing alt text". Fix: "Add an alt attribute. Use an empty alt only when the image is decorative."

### seo_missing_viewport (low)
No viewport meta. Title: "Missing viewport". Fix: "Add a viewport meta element so small screens get a usable layout." Use `<meta name="viewport" content="width=device-width, initial-scale=1">`.

### seo_missing_lang (low)
`<html>` has no `lang`. The value itself is not validated. Title: "Missing language". Fix: "Set the HTML lang attribute to the language of the page."

### seo_missing_social (low)
The start page lacks one of `og:title`, `og:description`, `og:image`, `twitter:card`. Evidence lists the missing ones. Title: "Homepage is missing social metadata". Fix: "Add the missing homepage social fields."
Change: `og:image` must be an absolute URL; `twitter:card` is usually `summary_large_image`.

## Links, sitemaps, robots

### seo_broken_internal_links (medium)
A same-origin link whose target was crawled and returned 400 or above, or failed. Targets that were not crawled are never called broken. Evidence: `source -> target (HTTP n)`. Title: "Internal links to crawled error pages". Fix: "Update each source link or make the target return a successful response."
Change: fix hard-coded hrefs, add redirects for moved pages, or restore the page. Single-page apps that answer every path with 200 hide broken links from this check.

### seo_orphaned_pages (low; info obs when the crawl hit its page or depth limit)
A crawled page other than the start page that no crawled page links to (it was found through the sitemap). Title: "Crawled pages have no inbound internal links". Fix: "Add at least one internal link from a related crawled page if these URLs should be discoverable from the site."

### seo_sitemap_unlinked (low; info obs when the crawl was sampled)
Same-origin sitemap URLs that no crawled page links to (lists up to 100). Title: "Sitemap URLs have no internal links in the crawl". Fix: "Add internal links from relevant crawled pages, or remove the URLs from the sitemap if they should not be indexed."

### seo_jsonld_malformed (info, obs)
An `application/ld+json` block that is not valid JSON (blocks over 65,536 characters are not judged). Title: "Malformed JSON-LD". Fix: "Replace the invalid JSON-LD block with valid JSON." Build JSON-LD with `JSON.stringify`, never by string concatenation.

### Observations with no change required
`seo_jsonld_types` (JSON-LD types found), `seo_robots` (robots.txt state, rules, sitemaps, blocked URLs), `seo_sitemap` (each sitemap's status, kind, URL count and invalid entries).

## Checklist (--full)

`checklist[]` gives pass, warn or fail per item for the start page. It never carries fix text.

| id | Rule |
|---|---|
| `https` | pass on https, fail on http |
| `title` | fail if missing; warn on a template default or outside 15-60 characters |
| `description` | fail if missing; warn on a template default or outside 50-160 characters |
| `h1` | fail with none, warn with more than one |
| `canonical` | warn if not set or pointing at another page; fail if pointing at another host; pass if self-referencing |
| `indexable` | fail on noindex or none |
| `viewport` | fail if missing |
| `lang` | warn if missing |
| `open_graph` | pass only with og:title, og:description and og:image |
| `twitter_card` | warn if missing |
| `robots_txt` | pass when read; warn on 404 or 410; fail on 5xx or network error |
| `sitemap` | pass with at least one URL; fail if malformed; warn if not found |
| `response_time` | pass up to 800 ms, warn up to 1800 ms, fail above |

The checker finds sitemaps at `/sitemap.xml` and at every `Sitemap:` line in robots.txt (two levels of sitemap indexes, up to 10 children and 500 URLs each). A sitemap anywhere else is invisible unless robots.txt names it.
