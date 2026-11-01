# Emitting JSON-LD by framework

Render JSON-LD into the HTML on the server or at build time, from the data that renders the page. The examples in examples.md show the objects; this file shows where they go. In every stack, serialize with a JSON function and escape `<` so a value containing `</script>` cannot end the block early.

## Next.js (App Router)

The Next.js docs recommend a `<script>` element in the page or layout component; `generateMetadata` has no JSON-LD field.

```tsx
// app/products/[slug]/page.tsx
import type { Product, WithContext } from "schema-dts"; // optional types: npm install --save-dev schema-dts

const SITE_URL = "https://www.example.com"; // or one shared constant also used for metadataBase

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  const jsonLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: [new URL(product.imagePath, SITE_URL).href],
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/products/${slug}`,
      price: product.price.toFixed(2),
      priceCurrency: product.currency,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {/* page content */}
    </>
  );
}
```

- Put the Organization and WebSite graph in `app/layout.tsx` (every page) or `app/page.tsx` (homepage only).
- Dates from a database: `post.publishedAt.toISOString()`.
- Do not build URLs from `headers()` or the request host: a preview deployment would write its own host into the markup (`schema_bad_url`). On Vercel, `VERCEL_URL` is the deployment host; use your own `SITE_URL` or `VERCEL_PROJECT_PRODUCTION_URL`.
- Server Components render this on the server. A Client Component that adds JSON-LD inside `useEffect` does not reach the HTML.

## Astro

```astro
---
// src/components/JsonLd.astro
interface Props { data: Record<string, unknown> }
const { data } = Astro.props;
const json = JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");
---
<script type="application/ld+json" set:html={json} />
```

```astro
---
// src/pages/blog/[slug].astro (excerpt)
import JsonLd from "../../components/JsonLd.astro";
const { post } = Astro.props;
---
<JsonLd data={{
  "@type": "BlogPosting",
  headline: post.data.title,
  image: [new URL(post.data.cover.src, Astro.site).href],
  datePublished: post.data.date.toISOString(),
  author: [{ "@type": "Person", name: post.data.author }],
}} />
```

`Astro.site` comes from `site` in `astro.config.mjs`; without it, absolute URLs cannot be built. Astro does not process scripts that have attributes other than `src`, so the JSON-LD script is emitted as written.

## Vite with React, Vue or Svelte (single-page apps)

JSON-LD added at runtime (react-helmet-async, React 19 components rendered in the browser, `document.head.append`) is missing from the HTML the server sends. Google renders JavaScript, but this checker and many other consumers read only the HTML.

- Put the site-wide Organization and WebSite block directly in `index.html`.
- For per-page markup (products, posts), prerender the routes (React Router framework mode with `prerender`, `vite-react-ssg`) so each route's HTML carries its own block, or move to a server-rendering framework.

## WordPress

SEO plugins (Yoast SEO, Rank Math, SEOPress, All in One SEO) print one JSON-LD `@graph` with Organization, WebSite, WebPage, Article and BreadcrumbList nodes, and WooCommerce adds Product markup. Configure them rather than adding a second, hand-written Organization:

- Organization name, logo and social profiles: the plugin's site representation or knowledge graph settings.
- Extra nodes or properties: the plugin's filter (`wpseo_schema_graph` in Yoast, `rank_math/json_ld` in Rank Math).
- Staging URLs left in settings after a database copy: `wp search-replace 'https://staging.example.com' 'https://www.example.com' --dry-run`, then run it without `--dry-run`.

Without an SEO plugin, print the block from the theme or an mu-plugin:

```php
// wp-content/mu-plugins/organization-schema.php
add_action( 'wp_head', function () {
	if ( ! is_front_page() ) {
		return;
	}
	$data = array(
		'@context' => 'https://schema.org',
		'@type'    => 'Organization',
		'name'     => get_bloginfo( 'name' ),
		'url'      => home_url( '/' ),
		'logo'     => get_theme_file_uri( 'assets/logo.png' ),
	);
	echo '<script type="application/ld+json">' . wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG ) . "</script>\n";
} );
```

Dates: `get_the_date( 'c' )` and `get_the_modified_date( 'c' )` return ISO 8601.

## Nuxt, SvelteKit and Remix

- Nuxt: `useHead({ script: [{ type: "application/ld+json", innerHTML: JSON.stringify(data) }] })` in the page; it renders on the server.
- SvelteKit: in `<svelte:head>`, `{@html '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, "\\u003c") + '<' + '/script>'}` (the split closing tag keeps the Svelte compiler from reading it as the end of the component's script).
- React Router 7 and Remix: return `{ "script:ld+json": data }` from the route's `meta` export, which serializes the object for you.

## Static site generators

Build the object from the page's data and serialize it with the template engine's JSON filter: Hugo `{{ $data | jsonify | safeJS }}` inside the script tag, Eleventy with Nunjucks `{{ data | dump | safe }}`, Jekyll `{{ data | jsonify }}` (or the jekyll-seo-tag plugin, which prints a basic block). Set the base URL (`baseURL` in Hugo, `url` in Jekyll) to production so absolute URLs are right.
