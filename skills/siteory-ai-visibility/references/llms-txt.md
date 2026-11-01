# llms.txt and llms-full.txt

`/llms.txt` is a Markdown file at the site root that tells AI agents what the site is and which pages matter (format from llmstxt.org). `/llms-full.txt` is an optional longer version with more pages or full text. Siteory checks both as agent-readability signals; neither is a search ranking factor, and the checker never says otherwise.

Only add these files when the user wants agents to use them. A missing file is a low finding.

## Format

```markdown
# Acme

> Acme is invoicing software for small agencies: invoices, payment reminders and bank reconciliation.

Acme is a web app at https://www.acme.example. Plans start at $12 per month.

## Product

- [Features](https://www.acme.example/features): What Acme does, with screenshots.
- [Pricing](https://www.acme.example/pricing): Plans and limits.
- [Security](https://www.acme.example/security): How customer data is stored.

## Docs

- [Getting started](https://www.acme.example/docs/start): Set up an account and send the first invoice.
- [API reference](https://www.acme.example/docs/api): REST endpoints and authentication.

## Optional

- [Blog](https://www.acme.example/blog): Product news and guides.
```

- Line 1: `# ` plus the site or product name (required by the `_structure` check).
- A `> ` line with a one-sentence summary. The heading or this line must contain the hostname, the brand (the first label of the host, such as "acme" for www.acme.example) or the homepage title, or `_identity` fires.
- Then optional paragraphs, and `## Section` lists of `- [Title](URL): note` links.
- `## Optional` holds links an agent can skip when its context is short.
- Every link must be an absolute URL on the same origin as the site (`_off_host_links`) and must return 200 (`_stale_links`). Off-site profiles belong in the page's JSON-LD `sameAs`, not here.
- Keep it curated. `_sitemap_gaps` is only an observation; listing every sitemap URL is not required.

A fill-in version is in templates/llms.txt of this skill.

## Serve it as plain text

The file must come back as text, not as the app's HTML. An SPA fallback that answers `/llms.txt` with `index.html` and status 200 counts as missing.

| Stack | Where |
|---|---|
| Next.js | `public/llms.txt`, or a route handler `app/llms.txt/route.ts` that returns `new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } })`. Without Cache Components, add `export const dynamic = "force-static"` so it is built once. |
| Astro | `public/llms.txt`, or `src/pages/llms.txt.ts` exporting `GET` |
| Vite SPA, Gatsby | `public/llms.txt` or `static/llms.txt` (copied as-is) |
| Nuxt | `public/llms.txt` |
| SvelteKit | `static/llms.txt`, or `src/routes/llms.txt/+server.ts` with `export const prerender = true` |
| React Router or Remix | `public/llms.txt`, or a resource route for `/llms.txt` |
| WordPress | a file in the web root next to `wp-config.php`, or a plugin that serves it |

## Generate it from the same data as the site

A hand-written file goes stale when pages move. When the site already has a route list, a CMS or a sitemap generator, build llms.txt from the same source at build time so `_stale_links` cannot drift. Next.js example:

```ts
// app/llms.txt/route.ts
import { getDocs } from "@/lib/docs";

export const dynamic = "force-static";

export async function GET() {
  const origin = "https://www.acme.example";
  const docs = await getDocs();
  const body = [
    "# Acme",
    "",
    "> Acme is invoicing software for small agencies.",
    "",
    "## Docs",
    "",
    ...docs.map((doc) => `- [${doc.title}](${origin}/docs/${doc.slug}): ${doc.summary}`),
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
```

## Local checks

On localhost, links to the production host look off-host, so `_identity` and `_off_host_links` are skipped. Pass `--prod https://www.acme.example` to check them: the checker rewrites production URLs to the local server, then checks that each link is live there.

```bash
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens aeo --prod https://www.acme.example --only aeo_llms_txt_missing,aeo_llms_txt_structure,aeo_llms_txt_identity,aeo_llms_txt_off_host_links,aeo_llms_txt_stale_links --fail-on info
```

## llms-full.txt

Same format, same checks (`aeo_llms_full_*`). Use it for a longer page map or for the full text of documentation. If the site has no use for it, its `_missing` finding is low severity and can be left with a note to the user.
