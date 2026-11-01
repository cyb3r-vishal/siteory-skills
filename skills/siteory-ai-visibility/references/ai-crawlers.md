# AI crawlers and robots.txt

## The 13 crawlers Siteory tracks

Answer crawlers fetch pages so an AI product can cite or summarise them in an answer. Training crawlers collect pages for model training. Blocking a training crawler does not remove the site from AI answers; blocking an answer crawler does.

| User agent token | Operator | Purpose | Counts for `aeo_ai_crawlers_blocked` |
|---|---|---|---|
| OAI-SearchBot | OpenAI | search (ChatGPT search results) | yes |
| ChatGPT-User | OpenAI | assistant (fetches a page a user asked about) | yes |
| Claude-SearchBot | Anthropic | search | yes |
| Claude-User | Anthropic | assistant | yes |
| PerplexityBot | Perplexity | search | yes |
| Perplexity-User | Perplexity | assistant | yes |
| GPTBot | OpenAI | training | no, training |
| ClaudeBot | Anthropic | training | no, training |
| Google-Extended | Google | training (Gemini); does not affect Google Search | no, training |
| Applebot-Extended | Apple | training; does not affect Apple search features | no, training |
| CCBot | Common Crawl | training datasets | no, training |
| meta-externalagent | Meta | training | no, training |
| Bytespider | ByteDance | training | no, training |

Whether to block training crawlers is the site owner's business decision. Never add or remove training-crawler rules without asking the user. Answer crawlers should be allowed on every public page the user wants cited.

Google AI Overviews and AI Mode use the normal Googlebot crawl, so they follow `User-agent: Googlebot` and `*` rules, not Google-Extended.

## How the ruling works

Siteory follows RFC 9309, as the crawlers do:

1. A crawler uses the group whose `User-agent` names it (matching is case-insensitive; several groups naming it are merged). Only when no group names it does it use the `User-agent: *` group.
2. Inside that group, the longest matching `Allow` or `Disallow` path wins; on a tie, `Allow` wins.
3. The ruling is made for `/`: `blocked` when `/` is disallowed, `partial` when the crawler's own group disallows some paths, otherwise `allowed`.
4. A missing robots.txt (404) allows everyone. An unreadable one (5xx, network error) gives no ruling.

The most common mistake follows from rule 1: adding a group for a bot means that bot ignores the `*` group. Repeat the `Disallow` lines you still need inside the bot's group.

```txt
User-agent: *
Disallow: /admin/

# Mistake: OAI-SearchBot now ignores the "*" group, so /admin/ is open to it.
User-agent: OAI-SearchBot
Allow: /
```

## Recommended robots.txt

Allow answer crawlers everywhere public, keep private paths closed for everyone, and state the training choice explicitly. The template is in templates/robots-ai.txt of this skill:

```txt
User-agent: *
Disallow: /admin/
Disallow: /api/

User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
Allow: /
Disallow: /admin/
Disallow: /api/

# Training crawlers: keep this group only if the owner opts out of AI training.
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
User-agent: meta-externalagent
User-agent: Bytespider
Disallow: /

Sitemap: https://www.example.com/sitemap.xml
```

Several `User-agent` lines in a row share one group.

## Where robots.txt comes from

| Stack | File |
|---|---|
| Next.js App Router | `app/robots.ts` (or a static `app/robots.txt`). `rules` takes an array; `userAgent` can be an array of tokens. |
| Astro | `public/robots.txt` or `src/pages/robots.txt.ts` |
| Vite SPA | `public/robots.txt`. It must exist, or the SPA fallback serves HTML at `/robots.txt`. |
| Nuxt | `public/robots.txt` or the `@nuxtjs/robots` module |
| SvelteKit | `static/robots.txt` |
| Gatsby | `static/robots.txt` or `gatsby-plugin-robots-txt` |
| WordPress | the virtual robots.txt (filter `robots_txt`) or a physical file in the web root, which wins |

Next.js example:

```ts
// app/robots.ts
import type { MetadataRoute } from "next";

const PRIVATE = ["/admin/", "/api/"];
const ANSWER_BOTS = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", disallow: PRIVATE },
      { userAgent: ANSWER_BOTS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: "https://www.example.com/sitemap.xml",
  };
}
```

## Blocks that robots.txt does not show

- **CDN and firewall rules.** Cloudflare's AI crawler blocking settings, bot-fight modes and WAF rules, and similar features at Vercel, Fastly or Akamai, can block AI crawlers no matter what robots.txt says. Cloudflare can also prepend its own rules to robots.txt (managed robots.txt). The local checker cannot see these. A hosted Siteory audit reports a bot challenge on the homepage as `seo_start_blocked`; otherwise ask the user to review the CDN's bot settings.
- **Meta and header directives.** `noindex` or `X-Robots-Tag: noindex` keeps pages out of search indexes, including the ones AI search builds on (`seo_noindex` in the siteory-seo skill).

## Verify

```bash
node "<skill base dir>/scripts/siteory.mjs" check <url> --lens aeo --prod https://www.example.com --only aeo_ai_crawlers_blocked --fail-on info
node "<skill base dir>/scripts/siteory.mjs" check <url> --lens aeo --prod https://www.example.com --json --full    # aiCrawlers[] shows every crawler's status
```

`--ignore-robots` skips these checks entirely, so do not use it when verifying crawler access.
