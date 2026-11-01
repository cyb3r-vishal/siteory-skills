# Link checks (lens links)

Each entry: the id, when it fires and at what severity, the one-line fix, and what to change. Penalties: high 20, medium 10, low 5, info 0; `scores.links` is 100 minus the penalties of the findings. Each id is reported once per run and lists every affected URL; the evidence names the page and the link.

How the lens reads links:

- Internal links are links on the checked origin, plus links to the `--prod` host, which are mapped to the local server for a local target.
- Redirects come from the crawl's redirect chains and from GET requests the lens makes for linked targets. Only GET requests are sent.
- Outbound links are requested only with `--external`: at most 100 unique URLs, 10 per host, 4 at a time, reading at most 64 KB each. Private, loopback and link-local addresses are never requested.

## links_dev_urls (high)
A URL in `href`, `src`, `srcset`, `action` or a `<link>` element points to `localhost`, `127.0.0.1`, `0.0.0.0`, a `*.local` host or a private IP address, on a different origin than the checked one. On a deployed target, any such URL counts. Visitors' browsers cannot reach these addresses, so the link or asset is broken for everyone. Evidence: page, attribute and URL.
Fix: replace development URLs with relative paths or the production origin.
Change:
- The usual cause is a site or API URL read from an environment variable that falls back to `http://localhost:3000` when it is not set at build time. Set the variable in the host's build settings, and make the build fail instead of falling back:
  ```ts
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl && process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  ```
- Content written on a local CMS install keeps local URLs: WordPress `wp search-replace 'http://localhost:8888' 'https://www.example.com' --dry-run`, then without `--dry-run`.
- Use root-relative paths for internal links and assets; they work on every host.

## links_mixed_content (high for scripts, stylesheets, preloads and iframes; medium for images, video, audio and source)
An https page loads a subresource over `http://`. Browsers block scripts, stylesheets and iframes loaded this way, so the page breaks; images and media are upgraded to https or blocked, and fail when the host has no https. Only https pages are judged. Evidence: page, element and URL.
Fix: load every subresource over https.
Change: change the URL to `https://` when the host supports it (open it in a browser to check), or self-host the file. Replace protocol-relative `//cdn.example.com/x.js` with `https://`. After a move to https, old `http://` URLs in content need a search and replace (WordPress: `wp search-replace 'http://www.example.com' 'https://www.example.com'`). Sending `Content-Security-Policy: upgrade-insecure-requests` makes browsers try https first; use it as a safety net, not as the fix.

## links_preview_urls (medium)
A link to a preview or staging host that is neither the checked host nor the `--prod` host: `*.vercel.app`, `*.netlify.app`, `*.pages.dev`, `*.herokuapp.com`, `*.onrender.com`, `*.fly.dev`, `*.ngrok-free.app`, `*.ngrok.io`, `*.loca.lt`, or a host starting with `staging.` or `dev.`. Visitors land on an old or private build, and search engines may index it. Evidence: page and URL.
Fix: link to the production host instead of the preview or staging host.
Change:
- Deployment variables name the deployment, not production: Vercel `VERCEL_URL` and `VERCEL_BRANCH_URL`, Netlify `DEPLOY_URL` and `DEPLOY_PRIME_URL`, Cloudflare Pages `CF_PAGES_URL`. Use the production value instead: your own `SITE_URL`, Vercel `VERCEL_PROJECT_PRODUCTION_URL` (a host without `https://`), Netlify `URL`.
- Links pasted into content while testing on staging: search the content and replace them.
- If production really runs on a `*.vercel.app` (or similar) host, pass it as `--prod` so it is not reported.

## links_external_broken (medium; needs --external)
An outbound link (from `a[href]`) answers 404, 410 or a 5xx status, or the connection or DNS lookup fails. A redirect to another site counts as alive, and a response too large to read counts as alive. Without `--external` it is skipped with "external link checks are off (pass --external)". Evidence: page, URL and status or error.
Fix: update or remove each broken outbound link.
Change: find where the content moved (the destination site's search, its sitemap, or a search engine), and link there. If it is gone, link to an archived copy (`https://web.archive.org/web/2026/<original URL>` redirects to the nearest snapshot) or remove the link and keep the text. A 5xx can be temporary: re-run before editing.

## links_internal_redirect (low)
An internal link whose target redirects before it reaches a page. Each hop costs a round trip for visitors and crawl budget for search engines. Evidence: `source → target → final` per link.
Fix: point each link at the final URL.
Change: the usual causes are a trailing-slash mismatch between links and routes, `http` or apex links that the host upgrades to `https` or `www`, and old paths kept alive by redirect rules. Update links in navigation, footer, content and CMS menus to the final form, and keep the redirect rule for old links elsewhere. Trailing-slash settings per framework and host are in frameworks.md.

## links_broken_anchor (low)
An internal link to `#fragment` where the target page (the same page, or another crawled page) has no element with that `id` and no `<a name>` with it. The click lands at the top of the page instead of the section. Evidence: page, link and missing fragment.
Fix: point the fragment at an existing id, or add the id to the target element.
Change: heading ids generated from heading text change when the text changes, and slug libraries differ (case, punctuation, accents); link to the id the HTML actually has, and match case exactly. Ids added by client-side scripts are missing from the server HTML, so render them on the server. Table-of-contents components often build ids one way and links another; generate both from the same function.

## links_nofollow_internal (low)
`rel="nofollow"` on a link to the site's own pages. Crawlers may not follow it, and it does not keep a page out of search.
Fix: remove `nofollow` from links to your own pages.
Change: to keep a page out of search, set `noindex` on that page instead. Look for a Markdown or CMS setting that adds `rel="nofollow"` to every link (for example a rehype or remark plugin configured for all links instead of external ones), and for components that add it to buttons such as "Sign in".

## links_external_unverified (info, observation; needs --external)
An outbound link answered 401, 403, 429 or 999, or showed a bot challenge, so it could not be verified. LinkedIn answers 999 to automated requests, and many sites behind Cloudflare or similar services challenge them. Never scored and never fails `--fail-on`.
Fix: open each URL in a browser; change nothing if it works there.
