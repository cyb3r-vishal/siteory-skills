# Fixing SEO findings in WordPress

Local check: `npx @wordpress/env start` (needs Docker) serves the site at http://localhost:8888. Many fixes below are settings rather than code; tell the user which screen to change when the agent cannot reach wp-admin.

First find out what generates the head: the theme (classic `header.php` or a block theme) and an SEO plugin (Yoast SEO, Rank Math, SEOPress, All in One SEO). With an SEO plugin active, change titles, descriptions, canonicals, robots and social tags in the plugin, not in theme code, or the two will print duplicates.

| Finding | Fix |
|---|---|
| `seo_noindex` (widespread) | Settings > Reading > "Discourage search engines from indexing this site" adds noindex to every page. It is often left on after a launch from staging. Also check the SEO plugin's per-post-type "Show in search results" setting. |
| `seo_missing_title`, `seo_duplicate_title`, `seo_title_quality` | Classic themes need `add_theme_support( 'title-tag' );` in `functions.php` and no hard-coded `<title>` in `header.php`. Set title templates in the SEO plugin, for example `%%title%% %%sep%% %%sitename%%` in Yoast. |
| `seo_missing_description`, `seo_description_quality` | WordPress core prints no meta description; use the SEO plugin's per-post field and a default template. "Just another WordPress site" is the default tagline (Settings > General > Tagline) and is flagged as a template default wherever a theme or plugin prints it. |
| `seo_canonical_other_host` | Settings > General: "WordPress Address (URL)" and "Site Address (URL)" must both be the production https address with the right www or apex host. A database copied from staging keeps the staging host. |
| `seo_canonical_*` other | Core prints `rel=canonical` on single posts and pages; SEO plugins take over everywhere. Remove any theme code that prints a second canonical. |
| `seo_homepage_http` | Set both URLs in Settings > General to `https://`, and redirect http to https in the server config or at the CDN. |
| `seo_missing_lang` | Classic themes: `<html <?php language_attributes(); ?>>` in `header.php`. The value comes from Settings > General > Site Language. |
| `seo_missing_viewport` | Classic themes add `<meta name="viewport" content="width=device-width, initial-scale=1">` in `header.php`. Block themes get it from core. |
| `seo_multiple_h1` | Many classic themes wrap the site title in `<h1>` on every page and the post title in another `<h1>`. Change the site title to `<p>` on everything except the front page. In block themes set the Site Title block's level to paragraph and keep the Post Title block at H1. |
| `seo_missing_h1` | The front page template or a page builder layout without a heading; add an H1 block or set the page title block to H1. |
| `seo_missing_alt` | Fill in "Alternative Text" in the Media Library. Images already placed in posts keep the alt they were inserted with, so update those blocks too. Images printed with `wp_get_attachment_image()` use the attachment's alt. |
| `seo_missing_social` | Set the default social image and per-post social fields in the SEO plugin. |
| `seo_broken_internal_links` | Fix links in content, or add 301 redirects (Redirection plugin, Rank Math redirections, or server rules). |
| `seo_slow_start` | Add page caching (the host's cache, LiteSpeed Cache, WP Super Cache or W3 Total Cache) and a persistent object cache; find slow plugins with Query Monitor. |

## robots.txt and sitemaps

- WordPress serves a virtual `robots.txt`; a physical file in the web root replaces it. Plugins change the virtual one through the `robots_txt` filter.
- Core publishes `/wp-sitemap.xml` and lists it in the virtual robots.txt. Yoast replaces it with `/sitemap_index.xml`, and Rank Math and SEOPress also use `sitemap_index.xml`. Siteory finds sitemaps at `/sitemap.xml` or through `Sitemap:` lines in robots.txt, so make sure robots.txt names the active sitemap: add the line to a physical robots.txt, or use the filter below with the virtual one.

```php
// wp-content/mu-plugins/robots.php
add_filter( 'robots_txt', function ( $output, $public ) {
	return $output . "\nSitemap: " . home_url( '/sitemap_index.xml' ) . "\n";
}, 10, 2 );
```

Security plugins sometimes block unknown user agents or rate-limit crawlers; that shows up as `seo_start_blocked` in a hosted audit.
