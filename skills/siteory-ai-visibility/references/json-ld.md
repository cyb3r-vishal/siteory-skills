# JSON-LD identity

Structured data tells search engines and AI systems which organisation or person a site belongs to. Siteory checks two things: that JSON-LD parses (`seo_jsonld_malformed`, an observation in the SEO lens) and that an `Organization`, `Person` or `LocalBusiness` `name` is visible on the page (`aeo_schema_name_mismatch`, low). It also lists the types it found (`aeo_jsonld_types`, `seo_jsonld_types`) and identity signals such as About and contact links (`aeo_identity`).

## The name rule

`aeo_schema_name_mismatch` fires when the JSON-LD `name` is not found, ignoring case, in the page title or the first 8,000 characters of visible text. Fix it by using the name people see:

- The page says "Acme" but the JSON-LD says "Acme Holdings Ltd": set `name` to "Acme" and put the legal name in `legalName`.
- A template placeholder ("Your Company", "My Store") left in JSON-LD: replace it or remove the block.
- A JSON-LD block copied onto pages that are not about that entity: keep it on the homepage and About page only.

## Templates

Organization and WebSite on the homepage:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.example.com/#organization",
      "name": "Acme",
      "legalName": "Acme Holdings Ltd",
      "url": "https://www.example.com/",
      "logo": "https://www.example.com/logo.png",
      "sameAs": ["https://www.linkedin.com/company/acme", "https://github.com/acme"],
      "contactPoint": { "@type": "ContactPoint", "contactType": "customer support", "email": "help@example.com" }
    },
    {
      "@type": "WebSite",
      "@id": "https://www.example.com/#website",
      "name": "Acme",
      "url": "https://www.example.com/",
      "publisher": { "@id": "https://www.example.com/#organization" }
    }
  ]
}
```

A personal site uses `Person` with `name`, `url`, `jobTitle` and `sameAs`. A shop or office with an address uses `LocalBusiness` (or a subtype) with `address`, `telephone` and `openingHours`. Use only properties that are true and visible somewhere on the site.

## Placement

| Stack | How |
|---|---|
| Next.js | Render `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />` in the page or layout (a plain `<script>`, not `next/script`). The `<` escape stops a value from closing the tag. |
| Astro | `<script type="application/ld+json" set:html={JSON.stringify(data).replace(/</g, "\\u003c")} />` in the layout `<head>` |
| Vite SPA | A static `<script type="application/ld+json">` in `index.html`; JSON-LD added at runtime is invisible to non-JS readers |
| Nuxt | `useHead({ script: [{ type: "application/ld+json", innerHTML: JSON.stringify(data) }] })` |
| SvelteKit | In the component script, build `const jsonLd = '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, "\\u003c") + '</' + 'script>';` (split the closing tag so it does not end the component script), then render `{@html jsonLd}` inside `<svelte:head>` |
| WordPress | The SEO plugin's schema settings (Organization name and logo under its site representation or knowledge graph settings); avoid a second hand-written Organization block |

## Avoid malformed JSON-LD

- Build the object in code and serialise it with `JSON.stringify`. String templates break on quotes, trailing commas and unescaped newlines.
- Keep one `@context` per block, or one block with `@graph`.
- Blocks over 65,536 characters are not judged; keep JSON-LD small and page-specific.

Check the result with the Schema Markup Validator (https://validator.schema.org/) or Google's Rich Results Test when the user wants rich results, and with the checker:

```bash
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens aeo --prod https://www.example.com --only aeo_schema_name_mismatch --fail-on info
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens seo,aeo --json --full    # seo_jsonld_malformed is an observation
```
