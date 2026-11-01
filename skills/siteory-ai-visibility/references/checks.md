# AI visibility checks (lens aeo)

Each entry: the id, when it fires and at what severity, the exact title and fix Siteory prints, and what to change. No AEO check runs when the start page could not be read. Observations (obs) are context only and never fail `--fail-on`.

## Crawler access

### aeo_ai_crawlers_blocked (high if all six answer crawlers are blocked, else medium)
robots.txt blocks "/" for one or more of the six AI search and assistant crawlers: OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User. When robots.txt cannot be read, no ruling is made.
Titles: "robots.txt blocks AI search and assistant crawlers" (all six) / "robots.txt blocks some AI search crawlers". Fix: "Allow the AI search and assistant crawlers in robots.txt. Training crawlers can stay blocked: that is a separate choice."
Evidence lists all 13 tracked crawlers with the group and rule that decided each one. How rulings work and what to write: references/ai-crawlers.md.

### aeo_ai_training_opt_out (info, obs)
Only training crawlers are blocked (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot, meta-externalagent, Bytespider). Title: "robots.txt opts out of AI training crawlers". Fix: "No change is required. Blocking training crawlers is a legitimate choice."

## Content in the HTML

### aeo_js_only_start (high)
The start page has fewer than 40 visible words in its HTML and at least one of: an empty app mount point (`#root`, `#app`, `#__next`, `#__nuxt`, `#___gatsby`, `#svelte`), five or more external scripts, or a `<noscript>` asking to enable JavaScript.
Title: "Homepage content needs JavaScript to appear". Fix: "Render the homepage's main content into the HTML on the server (server-side rendering or static prerendering), so it is present before any script runs."
Most AI fetchers do not run JavaScript, so they see an empty page. Fixes per framework: references/rendering.md.

### aeo_thin_start (medium)
The start page has fewer than 40 visible words (not reported when `aeo_js_only_start` fires). Evidence: "Visible words: n. Threshold: 40."
Title: "Start page has very little visible text". Fix: "Add a concise explanation of what the site or page is, in the visible body of the start page."
Write one or two plain sentences near the top: who it is for, what it does, and what makes it different. Text inside images, canvas or SVG does not count.

### aeo_thin_pages (low)
Other crawled pages with fewer than 40 visible words.
Title: "Crawled pages have very little visible text". Fix: "Add a short visible explanation on each listed page, or leave it unchanged if the page is deliberately brief."
Contact and login pages are often brief on purpose; say so instead of padding them.

### aeo_no_semantic_landmarks (low)
The start page uses none of `main`, `article`, `section`, `nav`, `header`, `footer`, `aside`.
Title: "Start page has no semantic landmarks". Fix: "Wrap the primary content in a semantic element such as main."
Put `<main>` around the page content in the shared layout, with `<header>`, `<nav>` and `<footer>` around the chrome.

### aeo_question_without_context (low)
A heading containing "?" with fewer than 15 words of supporting text on the page beyond the headings.
Title: "Question heading has little supporting text". Fix: "Add a direct answer in the visible body near the question heading."
Answer in the first sentence under the heading, in plain text that is in the HTML. Accordions built with `<details>` are fine; answers loaded on click are not.

## Identity

### aeo_schema_name_mismatch (low)
A JSON-LD `Organization`, `Person` or `LocalBusiness` `name` does not appear (case-insensitive) in the page title or the first 8,000 characters of visible text.
Title: "Structured name was not found in visible text". Fix: "Use the same name in the visible page text and in the JSON-LD name field, or remove the JSON-LD name if it does not belong to this page."
Usually a legal name ("Acme Holdings Ltd") in JSON-LD while the page says "Acme", or a template's placeholder name. See references/json-ld.md.

## llms.txt and llms-full.txt

Siteory fetches `/llms.txt` and `/llms-full.txt` (GET, up to 3 redirects, 200 KB). Ids start with `aeo_llms_txt` or `aeo_llms_full`. All are low severity unless noted. These are agent-readability checks; Siteory does not claim they affect search ranking. Format and template: references/llms-txt.md.

| id suffix | Fires when | Title | Fix |
|---|---|---|---|
| `_missing` | status outside 200-399, a fetch error, or an HTML page (the SPA fallback) instead of a text file | "/llms.txt was not reachable" | "Publish /llms.txt at the site origin if you want agents to use it." |
| `_structure` | no line matches `# Title` | "/llms.txt is missing a markdown title" | "Add a top-level heading that names the site, for example "# example.com"." |
| `_identity` | neither the heading nor the first `> ` line contains the hostname, the brand (first host label, 3+ characters) or the homepage title. Skipped locally without `--prod`. | "/llms.txt does not identify this site" | "Name the site in the heading or in a blockquote description under it." |
| `_off_host_links` | any `http(s)://` URL in the file whose origin is not the site origin. Skipped locally without `--prod`. | "/llms.txt lists URLs that do not stay on this host" | "Replace off-host or malformed links with current same-origin pages." |
| `_stale_links` | a same-origin link returned 400 or above or failed (crawl status, or up to 20 extra checks) | "/llms.txt lists same-origin URLs that are not live" | "Update or remove each stale link so the file only lists current pages." |
| `_sitemap_gaps` (info, obs) | the file has links and some sitemap URLs are not among them | "/llms.txt omits URLs that appear in the sitemap" | "Add the important sitemap URLs you want agents to read, or leave them out if the file is meant to be a short curated list." |

`/llms-full.txt` gets the same checks with its own path in the title.

## Observations with no change required

`aeo_identity` (structured names, About and contact links), `aeo_jsonld_types` (structured data types found), `aeo_discoverability` (robots state, sitemaps, deepest crawl depth, start-page noindex and internal links), `aeo_llms_txt` (the crawl found a link to /llms.txt).

## Checklist items (--full)

| id | Rule |
|---|---|
| `structured_data` | pass when JSON-LD types are found; fail on invalid JSON-LD; warn when there is none |
| `llms_txt` | warn when absent; warn "Found, no # title"; pass when present with a title |
| `ai_crawlers` | fail when all six answer crawlers are blocked; warn when some are; omitted when robots.txt is unreadable |
| `content` | fail on JavaScript-only signs; warn under 40 words; pass otherwise |

`aiCrawlers[]` in `--full` output lists all 13 crawlers with `status` `allowed`, `blocked` or `partial` (rules aimed at that crawler close part of the site).
