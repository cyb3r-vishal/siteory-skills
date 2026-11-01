# Performance checks (lens performance)

Each entry: the id, when it fires and at what severity, what the evidence shows, the one-line fix, and what to change. Penalties: high 20, medium 10, low 5, info 0; `scores.performance` is 100 minus the penalties of the findings. Each id is reported once per run and lists every affected URL.

How the lens reads a site:

- Sizes are decoded sizes (after gzip or Brotli is undone), so they compare across hosts.
- Only same-origin files are fetched. With `--prod`, URLs that name the production host are mapped to the local server first and count as same-origin.
- At most 60 files per run, 4 at a time. Scripts are read up to 5 MB each and images up to 2 MB.
- The JavaScript and CSS totals are measured on the start page; the markup and image checks cover every crawled page.
- `perf_no_compression` and `perf_static_cache` depend on the host. On a local target they are listed under `skipped` with "depends on your host; check the deployed URL".

## Markup and scripts

### perf_html_weight (low; medium over 500 KB)
An HTML document over 150 KB, decoded. Evidence: URL and size per page.
Fix: cut what is inlined into the HTML, such as serialized data, inline SVG, base64 images and repeated markup.
Change:
- Serialized framework data is the usual cause. In the Next.js App Router it is the RSC payload (`self.__next_f.push(...)` scripts), which repeats every prop passed from a Server Component to a Client Component: pass only the fields the client component renders, not whole records, and keep long lists on the server. In the Pages Router it is `__NEXT_DATA__`: trim what `getStaticProps` or `getServerSideProps` return. Nuxt (`__NUXT_DATA__`), SvelteKit and Remix serialize loader data the same way.
- base64 `data:` images and fonts: move them to files, which the browser caches and can load lazily.
- The same inline SVG repeated in every card or list item: use `<img src="/icons/check.svg" alt="">` or an SVG sprite with `<use href="#check">`.
- Long lists and tables: paginate, or render the rest on demand.

### perf_render_blocking_scripts (low; medium with 3 or more on one page)
A `<script src>` inside `<head>` without `async`, `defer` or `type="module"`. The browser stops building the page until each one downloads and runs. Evidence: page and script URLs.
Fix: add `defer` to scripts in the head, or `async` for independent scripts such as analytics.
Change:
- `defer` keeps the order of scripts and runs them after the HTML is parsed; use it for anything that touches the page. `async` runs a script as soon as it arrives; use it only for scripts nothing else depends on.
- Inline scripts that call a deferred library must wait for it: move them into the deferred file or run them on `DOMContentLoaded`.
- Next.js: load third-party scripts with `next/script` (`strategy="afterInteractive"`, the default, or `"lazyOnload"`) instead of a raw `<script>` in the root layout. `beforeInteractive` always lands in the head; keep it for scripts that must run before hydration.
- Astro: scripts in components are bundled as modules automatically; add `defer` to `is:inline` scripts that have a `src`.
- WordPress: `wp_enqueue_script( 'handle', $src, array(), $ver, array( 'strategy' => 'defer', 'in_footer' => true ) );` (WordPress 6.3 and later).
- A/B testing and anti-flicker snippets block on purpose. Tell the user what they cost instead of deferring them silently.

### perf_js_weight (low; medium over 1 MB)
The same-origin JavaScript the start page references adds up to more than 400 KB, decoded. Evidence: the total and the five largest scripts with their sizes.
Fix: ship less JavaScript to the start page by splitting code per route, loading heavy components when needed, and removing or replacing large dependencies.
Change:
1. Find what is inside the largest chunks: `npx next experimental-analyze` (Next.js 16.1 and later), `@next/bundle-analyzer` with `next build --webpack`, `npx vite-bundle-visualizer` for Vite, or `npx source-map-explorer` on a build with source maps.
2. Load below-the-fold and interaction-only components on demand: `next/dynamic`, `React.lazy` with `Suspense`, `defineAsyncComponent` in Vue, or a plain `import()`. Charts, rich-text editors, maps, video players and syntax highlighters are the usual candidates.
3. Keep work on the server. In the Next.js App Router, put `"use client"` on the smallest interactive component, never on a page or layout, and render static transforms (markdown, syntax highlighting) in Server Components. In Astro, prefer `client:visible` or `client:idle` over `client:load`, and leave static components without a directive.
4. Replace or trim large dependencies: `Intl` or date-fns instead of moment, per-function imports or native methods instead of all of lodash, per-icon imports instead of whole icon packs (Next.js `experimental.optimizePackageImports` handles packages with many exports).
5. Drop legacy polyfills by targeting current browsers (browserslist), and look for two versions of the same library in the bundle.

### perf_css_weight (low)
The same-origin CSS the start page references adds up to more than 250 KB, decoded. Evidence: the total and the stylesheets with their sizes.
Fix: remove unused CSS and load page-specific CSS only on the pages that use it.
Change:
- Tailwind CSS v4 detects class names automatically; look for `@source` lines that pull in whole folders. Tailwind v3: narrow the `content` globs and remove broad `safelist` patterns.
- Import component-library CSS per component instead of the full bundle, and remove unused global imports (animation libraries, icon fonts, old theme files).
- CSS-in-JS: make sure styles are extracted at build time and not repeated per page.
- WordPress: dequeue plugin stylesheets on pages that do not use the plugin, with `wp_dequeue_style()` in a late `wp_enqueue_scripts` callback.

## Images

### perf_image_weight (low; medium if any image is over 1 MB)
A same-origin `<img>` whose `src` or largest `srcset` candidate is over 200 KB. Images are read up to 2 MB; larger ones are reported as over 2 MB. Evidence: image URL, size and page.
Fix: resize each image to the largest size it is shown at, compress it, and serve smaller versions to small screens with `srcset` and `sizes`.
Change:
- Use the framework's image component; it resizes, compresses and writes `srcset` (nextjs.md, other-frameworks.md).
- For a plain `<img>`: export at most twice the displayed CSS width (a 600 px card needs at most a 1200 px file) at quality 75 to 80, and list the widths in `srcset` with an accurate `sizes`. A full-width hero photo rarely needs more than 2000 px.
- Next.js: with `fill` or `sizes`, next/image lists candidates up to 3840 px wide and Siteory weighs the largest. If the image is never shown that wide, cap `images.deviceSizes` (nextjs.md).

### perf_image_format (low)
A same-origin PNG, JPEG or GIF (by Content-Type) over 100 KB that is not served as WebP or AVIF. Evidence: image URL, type and size.
Fix: serve large raster images as WebP or AVIF.
Change:
- Image components do it for you: next/image and Astro `<Image>` output WebP by default, AVIF when configured. On WordPress, the Modern Image Formats plugin from the WordPress Performance Team creates WebP or AVIF versions of uploads.
- Static files: convert once (`cwebp -q 80 photo.png -o photo.webp`, or `sharp` in a build script) and serve `<picture>` with `<source type="image/avif">` or `<source type="image/webp">` and the original `<img>` as the fallback.
- Animated GIFs: replace them with a muted, looping `<video>` (MP4 or WebM), which is many times smaller.
- Logos, icons and diagrams: SVG instead of large PNGs.

### perf_image_dimensions (low)
An `<img>` without both `width` and `height` attributes. Not counted: next/image `fill` images (`data-nimg="fill"`), SVG images, and images in a `<picture>` whose `<img>` has both attributes. Without dimensions the browser cannot reserve space, so the page jumps when the image arrives (Cumulative Layout Shift). Evidence: page and image URLs.
Fix: add `width` and `height` with the image's intrinsic size, and keep sizing it with CSS.
Change: `<img src="/team.jpg" width="1200" height="800" alt="..." style="width:100%;height:auto">`. The attributes give the aspect ratio; CSS still decides the rendered size, and `height: auto` keeps the ratio. For images of unknown size, give the container an `aspect-ratio` and use next/image `fill` or `object-fit`. Markdown and CMS content: let the renderer add dimensions (Astro and WordPress do it for local and media-library images).

### perf_lazy_images (low)
A page with more than 4 `<img>` elements where images after the first 3 lack `loading="lazy"`. Evidence: page and the eager images.
Fix: add `loading="lazy"` to images below the fold, and keep the first, above-the-fold images eager.
Change: plain HTML gets `loading="lazy" decoding="async"` on below-the-fold images. next/image and Astro `<Image>` are lazy by default, so the hits are usually hand-written `<img>` tags, avatars, logos in a client grid, or markdown images. WordPress core lazy-loads content images; theme templates that print `<img>` by hand need the attribute. Never lazy-load the hero image.

### perf_font_display (low)
An `@font-face` rule in an inline `<style>` or in same-origin CSS without `font-display`. Without it, text can stay invisible while the font downloads. Evidence: the stylesheet or page and the font family.
Fix: add `font-display: swap` (or `optional`) to every `@font-face` rule.
Change:
```css
@font-face {
  font-family: "Brand Sans";
  src: url("/fonts/brand-sans.woff2") format("woff2");
  font-display: swap;
}
```
next/font sets `swap` by default, and Fontsource packages set it too. `optional` avoids layout shift but sometimes keeps the fallback font; icon fonts often use `block` on purpose, which also counts as set. Google Fonts CSS needs `&display=swap` in its URL; it is a third-party file, so this lens does not read it.

### perf_third_party_scripts (low)
More than 5 distinct third-party origins serve `<script src>` on one page. Evidence: the origins per page.
Fix: remove tags nobody uses, and load the rest after the page is interactive or on user interaction.
Change:
- List each origin with the user and remove unused ones: old analytics, ended experiments, abandoned pixels.
- Load chat widgets, video embeds and maps on interaction: render a lightweight placeholder and inject the real embed on click.
- Next.js: `@next/third-parties/google` (experimental) has `GoogleTagManager`, `GoogleAnalytics`, `YouTubeEmbed` and `GoogleMapsEmbed`, which load after hydration; other scripts go through `next/script` with `strategy="lazyOnload"`.
- Self-host small scripts when the license allows, so they share the site's connection and caching.

## Host checks (deployed targets only)

### perf_no_compression (medium)
HTML, CSS or JavaScript responses over 1 KB sent without a `Content-Encoding` of gzip, br or zstd. Skipped on local targets. Evidence: URL, type and size.
Fix: turn on Brotli or gzip compression for HTML, CSS, JavaScript, JSON and SVG at the host or server.
Change: managed hosts (Vercel, Netlify, Cloudflare) compress automatically, so this usually points at a self-managed server, a proxy that strips the encoding, or `compress: false` in a Next.js app with nothing in front. Settings per host are in hosting.md. Text compresses to roughly a quarter of its size.

### perf_static_cache (low)
A fingerprinted file (a name segment of 8 or more hex or base36 characters, or a hashed file under `/_next/static/` or `/assets/`) served without `Cache-Control` `max-age` of at least 31536000 or `immutable`. Skipped on local targets. Evidence: URL and the Cache-Control value.
Fix: serve fingerprinted files with `Cache-Control: public, max-age=31536000, immutable`.
Change: these files get a new name whenever their content changes, so a year is safe. Never send this header for HTML or for files without a hash in the name. Next.js sets it for `/_next/static/` itself (a CDN or proxy in front can override it); static hosts usually need a rule (hosting.md).
