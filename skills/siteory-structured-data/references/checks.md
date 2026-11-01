# Structured data checks (lens schema)

Each entry: the id, when it fires and at what severity, the one-line fix, and what to change. Penalties: high 20, medium 10, low 5, info 0; `scores.schema` is 100 minus the penalties of the findings. Each id is reported once per run and lists every affected URL; the evidence names the page, type, property and path.

How the lens reads markup:

- Every `<script type="application/ld+json">` that is valid JSON is parsed. Invalid JSON is the SEO lens's observation `seo_jsonld_malformed`.
- Top-level arrays and `@graph` are flattened, and nested typed nodes are checked too (an `Offer` inside a `Product`, an `AggregateRating` inside a `SoftwareApplication`).
- Types are matched by their `@type` value; Microdata and RDFa are not read.

## schema_missing_context (medium)
A top-level JSON-LD object without an `@context` that names schema.org.
Fix: add `"@context": "https://schema.org"` to every top-level object.
Change: put it on each top-level object, or once on the object that holds `@graph`. `http://schema.org` and `https://schema.org/` both name schema.org; a missing or misspelled context means consumers cannot tell what vocabulary the types belong to.

## schema_required_missing (medium)
A node of a supported type misses a property that Google requires for its rich result. Evidence: page, type, missing property and path.
Fix: add the missing required properties, using values that are visible on the page.

| Type | Required |
|---|---|
| `Product` | `name`, plus at least one of `offers`, `review` or `aggregateRating` |
| `Offer` | `price` (or `priceSpecification`) and `priceCurrency` |
| `AggregateRating` | `ratingValue`, plus `ratingCount` or `reviewCount` |
| `Review` | `reviewRating` and `author` |
| `BreadcrumbList` | `itemListElement`; each `ListItem` needs `position` and `name`, and `item` on every entry except the last |
| `FAQPage` | `mainEntity` with `Question` nodes that have a `name` and an `acceptedAnswer` with `text` |
| `Event` | `name`, `startDate` and `location` |
| `JobPosting` | `title`, `description`, `datePosted`, `hiringOrganization`, and `jobLocation` or `applicantLocationRequirements` |
| `Recipe` | `name` and `image` |
| `VideoObject` | `name`, `thumbnailUrl` and `uploadDate` |
| `SoftwareApplication` | `name`, `offers.price`, and `aggregateRating` or `review` |
| `LocalBusiness` (and subtypes) | `name` and `address` |
| `Organization` | `name` and `url` |

Change:
- Fill each property from the record that renders the page: the product's price and currency, the post's author, the event's venue. Examples for each type are in examples.md.
- Google's product snippets need only a `price` on the Offer; Siteory also asks for `priceCurrency`, which merchant listings require and every shop has.
- A free app or product still needs `offers` with `"price": "0"`.
- Remote jobs: `"jobLocationType": "TELECOMMUTE"` with `applicantLocationRequirements` naming the countries or regions.
- Breadcrumbs: generate the list from the route, so `position` counts from 1 and the last entry (the current page) may omit `item`.
- No honest value exists (no real reviews behind `aggregateRating`): leave the finding open and tell the user. Invented ratings break Google's policies and can get the site a manual action.
- FAQ rich results stopped appearing in Google Search on 7 May 2026. Keep existing FAQPage markup valid if the page has a visible FAQ, but do not add it for a rich result.

## schema_recommended_missing (low)
Recommended properties are missing:

| Type | Recommended |
|---|---|
| `Article`, `NewsArticle`, `BlogPosting` | `headline`, `image`, `datePublished`, `author` |
| `Organization` | `logo` |
| `LocalBusiness` | `telephone`, `openingHoursSpecification` |
| `Product` | `image`, `offers.availability` |

Fix: add the recommended properties the page has data for.
Change: `author` is a `Person` or `Organization` with a `name` (and a `url` to the author page). `image` is one or more absolute URLs of images at least 1200 px wide for articles. `availability` uses a schema.org URL such as `https://schema.org/InStock`. Give `logo` an absolute URL to a square or wide logo file (PNG, JPEG, WebP or SVG).

## schema_bad_url (medium for localhost, private or staging hosts; low for relative URLs)
A `url`, `logo`, `image`, `item` or `sameAs` value that is relative, is not http(s), or points to localhost, a private address or a preview host (`*.vercel.app`, `*.netlify.app`, `*.pages.dev`, ngrok) that differs from the checked site and the `--prod` host. Evidence: page, path and value.
Fix: use absolute https URLs on the production host.
Change: build URLs from one production origin setting (`new URL(path, siteUrl).href`) rather than from the request host or a preview deployment variable. On Vercel, `VERCEL_URL` is the deployment's own `*.vercel.app` host: use `VERCEL_PROJECT_PRODUCTION_URL` or your own `SITE_URL` variable instead. In WordPress, a database copied from staging keeps staging URLs in plugin settings; replace them with WP-CLI: `wp search-replace 'https://staging.example.com' 'https://www.example.com' --dry-run`, then without `--dry-run`.

## schema_bad_date (low)
`datePublished`, `dateModified`, `startDate`, `endDate`, `uploadDate` or `datePosted` is not ISO 8601. Common culprits: "March 14, 2026", "14/03/2026", a JavaScript `Date.toString()` value, a Unix timestamp. Evidence: page, path and value.
Fix: write dates in ISO 8601.
Change: `2026-03-14` for a date, `2026-03-14T09:30:00+01:00` for a date and time. In JavaScript, `new Date(value).toISOString()` gives a UTC timestamp (`...Z`); in PHP, `get_the_date( 'c' )` or `gmdate( 'c', $timestamp )`. Give event times the venue's time-zone offset.

## schema_home_identity (low)
The start page has no `Organization` (or a subtype such as `LocalBusiness`, `Corporation` or `NGO`) and no `WebSite` node.
Fix: describe the site on the homepage with an Organization and a WebSite node.
Change: add both to the homepage (or the root layout), linked by `@id` (examples.md). Use the visible brand name as `name`, the homepage as `url`, an absolute `logo`, and the official profiles in `sameAs`. A personal site can use a `Person` together with `WebSite`; the check looks for Organization or WebSite, so the WebSite node is what clears it there.

## schema_deprecated_type (info, observation)
A `HowTo` node, or a `WebSite` with a `SearchAction` in `potentialAction`. Google removed the HowTo rich result in 2023 and the sitelinks search box in November 2024. Never scored and never fails `--fail-on`; it appears with `--full` or `--only`.
Fix: no change is required; remove the markup if you no longer want to maintain it.
Change: delete the HowTo block or the `potentialAction` entry. `HowToStep` inside a `Recipe`'s `recipeInstructions` is a different type and stays.
