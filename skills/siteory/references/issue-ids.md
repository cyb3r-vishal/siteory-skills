# Siteory issue ids

Every id the checker and the hosted audit report, with its severity rule and the fix Siteory gives. "obs" means an observation: context that is never scored and never fails `--fail-on`. The lens skills (siteory-seo, siteory-ai-visibility, siteory-security, and for the local-only lenses siteory-performance, siteory-accessibility, siteory-structured-data, siteory-links, siteory-social and siteory-launch) explain each fix per framework.

"Widespread" means at least 2 crawled pages and at least half of them.

## Foundations

| id | Severity | Title | Fix |
|---|---|---|---|
| `seo_start_server_error` | critical | Start URL returned a server error | Make the start URL return a successful HTML response. |
| `seo_start_robots` | high | Start URL blocked by robots.txt | Review the robots.txt rule that disallows the start URL. Allow it if the page is meant to be crawled. |
| `seo_start_blocked` | high | Homepage blocks automated visitors / Homepage refused the request (HTTP n) | Let verified search and AI crawlers through bot protection, or let crawlers fetch the homepage without signing in or hitting a rate limit. |
| `seo_start_unreachable` | high | Homepage returned HTTP n, did not respond in time, HTTPS connection failed, host name did not resolve, redirect loop, redirects to another site, did not return HTML, too large, redirects do not reach a page, could not be reached | Depends on the cause, for example "Make the homepage respond quickly and reliably." |
| `seo_homepage_http` | medium | Homepage is not HTTPS | Serve the start URL over HTTPS and redirect HTTP requests to it. |
| `seo_slow_start` | low | Homepage responds slowly (first byte over 1800 ms) | Cache the homepage HTML at a CDN or the server, and remove slow work from the request path. |
| `seo_start_redirect` | info, obs | Start URL redirects to the site's preferred address | None. |
| `seo_depth_limited` | info, obs | Crawl stopped at the depth limit | None. |

When a start check fails, the SEO and AEO scores are null and other checks do not run. Fix these first.

## SEO

| id | Severity | Title | Fix |
|---|---|---|---|
| `seo_noindex` | high if widespread, else low | Widespread noindex directives / Page set to noindex | Remove noindex from pages that should remain crawlable. |
| `seo_canonical_other_host` | high | Canonical points at another host | Point each canonical at the preferred URL on this host unless the cross-host canonical is intentional. |
| `seo_canonical_error_target` | high | Canonical points at an error response | Point each canonical at a URL that returns a successful response, or fix the target. |
| `seo_canonical_conflict` | medium | Canonical chain or mutual conflict | Pick one preferred URL, point every variant at it, make it self-canonical. |
| `seo_missing_title` | medium | Missing title | Add a unique title element that describes each page. |
| `seo_duplicate_title` | medium | Duplicate title | Give each listed page its own title. |
| `seo_title_quality` | medium if a template default, else low | Titles need rewriting | Write a specific title of 15 to 60 characters for each listed page. |
| `seo_missing_description` | medium | Missing meta description | Add a unique meta description for each listed page. |
| `seo_duplicate_description` | medium | Duplicate meta description | Give each listed page its own meta description. |
| `seo_description_quality` | medium if a template default, else low | Meta descriptions need rewriting | Write a specific meta description of 50 to 160 characters for each listed page. |
| `seo_missing_h1` | medium | Missing H1 | Add one H1 that states the page topic. |
| `seo_multiple_h1` | medium if widespread, else low | Widespread multiple H1 elements / Page has multiple H1 elements | Keep one H1 on each listed page unless the extra H1 is deliberate. |
| `seo_broken_internal_links` | medium | Internal links to crawled error pages | Update each source link or make the target return a successful response. |
| `seo_missing_viewport` | low | Missing viewport | Add a viewport meta element. |
| `seo_missing_lang` | low | Missing language | Set the HTML lang attribute to the language of the page. |
| `seo_missing_social` | low | Homepage is missing social metadata | Add the missing og:title, og:description, og:image or twitter:card. |
| `seo_skipped_headings` | low | Heading levels are skipped | Use the next heading level instead of skipping one. |
| `seo_missing_alt` | low | Images missing alt text | Add an alt attribute; use an empty alt only for decorative images. |
| `seo_orphaned_pages` | low, or info obs on a sampled crawl | Crawled pages have no inbound internal links | Link to each page from a related page if it should be discoverable. |
| `seo_sitemap_unlinked` | low, or info obs on a sampled crawl | Sitemap URLs have no internal links in the crawl | Link to the URLs, or remove them from the sitemap if they should not be indexed. |
| `seo_jsonld_malformed` | info, obs | Malformed JSON-LD | Replace the invalid JSON-LD block with valid JSON. |
| `seo_jsonld_types` | info, obs | JSON-LD types observed | None. |
| `seo_robots` | info, obs | Robots.txt observation | None. |
| `seo_sitemap` | info, obs | Sitemap observation | None. |

## AI visibility (lens aeo)

| id | Severity | Title | Fix |
|---|---|---|---|
| `aeo_ai_crawlers_blocked` | high if all 6 answer crawlers are blocked, else medium | robots.txt blocks AI search and assistant crawlers / blocks some AI search crawlers | Allow the AI search and assistant crawlers. Training crawlers can stay blocked. |
| `aeo_js_only_start` | high | Homepage content needs JavaScript to appear | Render the homepage's main content into the HTML on the server. |
| `aeo_thin_start` | medium | Start page has very little visible text | Add a concise visible explanation of what the site is. |
| `aeo_thin_pages` | low | Crawled pages have very little visible text | Add a short visible explanation on each page, unless it is deliberately brief. |
| `aeo_schema_name_mismatch` | low | Structured name was not found in visible text | Use the same name in the visible text and the JSON-LD name. |
| `aeo_no_semantic_landmarks` | low | Start page has no semantic landmarks | Wrap the primary content in a semantic element such as main. |
| `aeo_question_without_context` | low | Question heading has little supporting text | Add a direct answer near the question heading. |
| `aeo_llms_txt_missing`, `aeo_llms_full_missing` | low | /llms.txt (or /llms-full.txt) was not reachable | Publish the file at the site origin if you want agents to use it. |
| `aeo_llms_txt_structure`, `aeo_llms_full_structure` | low | ... is missing a markdown title | Add a top-level "# Site name" heading. |
| `aeo_llms_txt_identity`, `aeo_llms_full_identity` | low | ... does not identify this site | Name the site in the heading or in a "> " description under it. |
| `aeo_llms_txt_off_host_links`, `aeo_llms_full_off_host_links` | low | ... lists URLs that do not stay on this host | Replace off-host links with same-origin pages. |
| `aeo_llms_txt_stale_links`, `aeo_llms_full_stale_links` | low | ... lists same-origin URLs that are not live | Update or remove each stale link. |
| `aeo_llms_txt_sitemap_gaps`, `aeo_llms_full_sitemap_gaps` | info, obs | ... omits URLs that appear in the sitemap | Add the important sitemap URLs, or keep the file a curated list. |
| `aeo_ai_training_opt_out` | info, obs | robots.txt opts out of AI training crawlers | None; a legitimate choice. |
| `aeo_identity`, `aeo_jsonld_types`, `aeo_discoverability`, `aeo_llms_txt` | info, obs | Identity, structured data, discoverability and llms.txt signals | None. |

## Security (lens security)

Security ids are `se_` plus 12 hex characters, derived from the check, the host and the route. For a leaked secret the secret value takes the place of the script path, so the id survives a rebuild that renames a content-hashed chunk, while a rotated or different secret gets a new id. Header and CORS ids stay the same between runs, so `--only se_xxxxxxxxxxxx` works for them; verify a secret fix with a full `--lens security --fail-on high` run plus a search of the build output (siteory-security skill). Local ids match the hosted audit only when the host matches (use `--prod`).

| Check | Severity and kind | Title |
|---|---|---|
| Secret in client JavaScript (private key, AWS, GitHub, Slack, Stripe live, Bearer token, service_role) | high, finding | "{type} pattern observed in client JavaScript" |
| Supabase service_role key in client JavaScript | critical, finding | Supabase service_role-like credential observed in client JavaScript |
| Wildcard CORS with credentials | medium, finding | Wildcard CORS with credentials was observed |
| HSTS missing on HTTPS | low, obs | HSTS header was not observed on HTTPS responses |
| CSP missing | info, obs | Content-Security-Policy was not observed |
| CSP allows unsafe-inline | info, obs | Content-Security-Policy allows unsafe-inline |
| X-Content-Type-Options missing | info, obs | X-Content-Type-Options was not observed |
| Frame protection missing | info, obs | Frame-busting header was not observed |
| Referrer-Policy missing | info, obs | Referrer-Policy was not observed |
| Permissions-Policy missing | info, obs | Permissions-Policy was not observed |
| Wildcard CORS | info, obs | Wildcard CORS origin was observed |
| Supabase anon key or project URL in client code | info, obs | Supabase public anon key pattern / project URL observed |

The hosted audit adds active checks (common paths, verifiers, Supabase row-level security, exposed services) that the local checker never runs.

## Local-only lenses

These lenses run only in the local checker, when named in `--lens` (or with `--lens all`, or when an `--only` id carries their prefix). The hosted audit does not report them. Each lens has its own score, from its own findings.

### Performance (lens performance)

| id | Severity | Flags | Fix |
|---|---|---|---|
| `perf_html_weight` | low; medium over 500 KB | HTML document over 150 KB | Cut inlined data, inline SVG and base64 images, repeated markup. |
| `perf_render_blocking_scripts` | low; medium with 3 or more on a page | `<script src>` in the head without async, defer or type=module | Add defer, or async for independent scripts. |
| `perf_js_weight` | low; medium over 1 MB | same-origin JavaScript on the start page over 400 KB | Split by route, load heavy components on demand, trim dependencies. |
| `perf_css_weight` | low | same-origin CSS on the start page over 250 KB | Remove unused CSS; load page CSS where it is used. |
| `perf_image_weight` | low; medium if one is over 1 MB | same-origin image over 200 KB | Resize, compress, serve srcset and sizes. |
| `perf_image_format` | low | PNG, JPEG or GIF over 100 KB not served as WebP or AVIF | Serve WebP or AVIF. |
| `perf_image_dimensions` | low | `<img>` without width and height | Add the intrinsic width and height. |
| `perf_lazy_images` | low | images after the first 3 on a page without loading=lazy | Lazy-load below-the-fold images. |
| `perf_font_display` | low | `@font-face` without font-display | Add font-display: swap. |
| `perf_third_party_scripts` | low | more than 5 third-party script origins on a page | Remove unused tags; load the rest late or on interaction. |
| `perf_no_compression` | medium; deployed only | HTML, CSS or JS over 1 KB without gzip, br or zstd | Turn on Brotli or gzip at the host. |
| `perf_static_cache` | low; deployed only | fingerprinted files cached for less than a year | Send Cache-Control: public, max-age=31536000, immutable. |

### Accessibility (lens accessibility)

| id | Severity | Flags | Fix |
|---|---|---|---|
| `a11y_link_name` | medium | link with no accessible name | Name every link by its destination. |
| `a11y_button_name` | medium | button with no accessible name | Name every button by its action. |
| `a11y_form_label` | medium | input, select or textarea without a label | Label every form control; a placeholder is not a label. |
| `a11y_aria_hidden_focusable` | medium | aria-hidden on or around a focusable element | Use inert, or hide it from everyone. |
| `a11y_zoom_disabled` | medium | viewport with user-scalable=no or maximum-scale below 2 | Allow zoom. |
| `a11y_duplicate_ids` | low; medium when a label or description points at it | duplicate id on a page | Make ids unique per page. |
| `a11y_positive_tabindex` | low | tabindex above 0 | Use tabindex 0 or none; order focus by DOM order. |
| `a11y_iframe_title` | low | iframe without a title | Title every iframe. |
| `a11y_generic_link_text` | low | link text such as "click here" or "read more" | Say where the link goes. |
| `a11y_autoplay_media` | low | autoplaying video with sound, or autoplaying audio | Mute autoplaying video; never autoplay audio. |

Missing alt text, page language, H1 and heading order are SEO-lens ids (`seo_missing_alt`, `seo_missing_lang`, `seo_missing_h1`, `seo_skipped_headings`).

### Structured data (lens schema)

| id | Severity | Flags | Fix |
|---|---|---|---|
| `schema_missing_context` | medium | top-level JSON-LD without a schema.org @context | Add "@context": "https://schema.org". |
| `schema_required_missing` | medium | a property Google requires for the type's rich result is missing | Add it from data the page shows. |
| `schema_bad_url` | medium for localhost or staging hosts; low for relative URLs | url, logo, image, item or sameAs not absolute, or on a dev or preview host | Use absolute https URLs on the production host. |
| `schema_recommended_missing` | low | recommended Article, Organization, LocalBusiness or Product properties missing | Add those the page has data for. |
| `schema_bad_date` | low | a date that is not ISO 8601 | Write ISO 8601 dates. |
| `schema_home_identity` | low | start page without an Organization or WebSite node | Describe the site on the homepage. |
| `schema_deprecated_type` | info, obs | HowTo, or a WebSite SearchAction | None required; remove it if unwanted. |

### Links (lens links)

| id | Severity | Flags | Fix |
|---|---|---|---|
| `links_dev_urls` | high | URLs on localhost, private addresses or another dev server | Use relative paths or the production origin. |
| `links_mixed_content` | high for scripts, stylesheets and iframes; medium for media | http subresources on https pages | Load every subresource over https. |
| `links_preview_urls` | medium | links to preview or staging hosts | Link to the production host. |
| `links_external_broken` | medium; needs --external | outbound link returns 404, 410 or 5xx, or fails | Update or remove the link. |
| `links_internal_redirect` | low | internal link whose target redirects | Link to the final URL. |
| `links_broken_anchor` | low | #fragment with no matching id | Point at an existing id, or add it. |
| `links_nofollow_internal` | low | rel=nofollow on an internal link | Remove nofollow from internal links. |
| `links_external_unverified` | info, obs; needs --external | outbound link answered 401, 403, 429, 999 or a bot challenge | Open it in a browser; no change if it works. |

### Social previews (lens social)

| id | Severity | Flags | Fix |
|---|---|---|---|
| `social_image_dev_url` | high | og:image or og:url on localhost, private or preview hosts | Build share URLs from the production origin. |
| `social_image_relative` | medium | og:image or twitter:image not absolute | Use an absolute https URL. |
| `social_image_broken` | medium | share image fails, returns 400 or above, or is not an image | Point at an image that loads. |
| `social_image_size` | low below 1200x630 or over 5 MB; medium below 200x200 | share image size | Use a 1200x630 PNG or JPEG under 5 MB. |
| `social_tags_missing` | low | page without og:title, og:description or og:image | Add them to every page. |
| `social_twitter_card` | low | twitter:card missing or invalid | Use summary_large_image. |
| `social_og_url_mismatch` | low | og:url differs from the canonical URL | Make og:url the canonical URL. |

### Launch readiness (lens launch)

| id | Severity | Flags | Fix |
|---|---|---|---|
| `launch_dev_build` | high | development build or dev server markers | Serve a production build. |
| `launch_broken_assets` | high for scripts and stylesheets; medium for images | same-origin assets that return 400 or above | Make every referenced asset load. |
| `launch_soft_404` | medium | a random unknown path answers 2xx | Return 404 for unknown URLs. |
| `launch_template_leftovers` | medium | starter-template or placeholder text | Replace it with real content. |
| `launch_https_redirect` | medium; deployed https only | http does not redirect to https | Redirect http to https permanently. |
| `launch_favicon` | low | no icon link, and /favicon.ico fails | Add a favicon. |
| `launch_manifest` | low | linked web manifest fails or is not valid JSON | Serve a valid manifest, or remove the link. |
| `launch_sitemap_missing` | low | no sitemap found | Publish a sitemap and name it in robots.txt. |
| `launch_www_consistency` | low; deployed only | www and apex both answer 200 | Redirect one host to the other. |
| `launch_source_maps` | low | public source maps for same-origin scripts | Stop serving them unless intended. |
