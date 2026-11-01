# Fixing performance findings in Astro, Vite, WordPress, Nuxt, SvelteKit and Gatsby

The check-by-check meaning is in checks.md of this skill. The same principles apply on every stack: let the framework's image pipeline produce sized, modern, responsive images; ship JavaScript only for interactive parts; and leave compression and long-lived caching of hashed files to the host (hosting.md).

## Astro

Production check: `npx astro build && npx astro preview` (http://localhost:4321).

- **Images** (`perf_image_weight`, `perf_image_format`, `perf_image_dimensions`, `perf_lazy_images`): use `<Image />` or `<Picture />` from `astro:assets` with files in `src/` (imported, or relative paths in Markdown). They output WebP by default, infer `width` and `height`, and add `loading="lazy"` and `decoding="async"`. Files in `public/` are copied untouched, so move large images to `src/assets/`.
  ```astro
  ---
  import { Image, Picture } from "astro:assets";
  import hero from "../assets/hero.jpg";
  ---
  <Image src={hero} alt="Invoices dashboard" widths={[640, 1280, 1920]} sizes="100vw" loading="eager" fetchpriority="high" />
  <Picture src={hero} formats={["avif", "webp"]} alt="Invoices dashboard" />
  ```
  Remote images need `image.domains` or `image.remotePatterns` in `astro.config.mjs` and explicit `width` and `height`.
- **Scripts** (`perf_render_blocking_scripts`, `perf_js_weight`): `<script>` tags in components are bundled and served as modules, so they never block. `<script is:inline src="...">` is left as written; add `defer`. Hydrate islands as late as possible: `client:visible` or `client:idle` instead of `client:load`, and no directive for components that need no JavaScript. For third-party tags, the `@astrojs/partytown` integration can move them to a web worker.
- **Fonts** (`perf_font_display`): self-host with a Fontsource package (`import "@fontsource-variable/inter";` in the layout), whose CSS sets `font-display: swap`, or add `font-display` to your own `@font-face` rules.
- **Bundles**: add `rollup-plugin-visualizer` to `vite.plugins` in `astro.config.mjs` to see what a large chunk contains.
- **Caching**: built assets land in `/_astro/` with hashed names; give that path a one-year immutable cache at the host.

## Vite with React, Vue or Svelte (single-page apps)

Production check: `npx vite build && npx vite preview` (http://localhost:4173).

- **Images**: Vite copies images but does not resize them. Use `vite-imagetools` to resize and convert at build time (`import heroUrl from "./hero.jpg?w=1600&format=webp";`), or convert files once and serve `<picture>` with WebP or AVIF sources. Write `width` and `height` on every `<img>` in JSX and `loading="lazy"` on images below the fold.
- **JavaScript** (`perf_js_weight`): split by route. With React Router, use the route `lazy` property or `React.lazy` with `Suspense`; in Vue Router, `component: () => import("./views/Settings.vue")`. Inspect the bundle with `npx vite-bundle-visualizer`. Avoid broad `manualChunks` rules that pull everything into one vendor file.
- **Scripts in index.html** (`perf_render_blocking_scripts`, `perf_third_party_scripts`): Vite's own entry is `type="module"` and never blocks; third-party `<script src>` tags added to the head of `index.html` need `defer` or `async`.
- **Fonts**: Fontsource packages, or your own `@font-face` with `font-display: swap` in a CSS file.
- **Caching**: built files land in `dist/assets/` with hashed names; give `/assets/*` a one-year immutable cache at the host.

## WordPress

Local check: `npx @wordpress/env start` (http://localhost:8888). Many fixes are settings or plugins; tell the user which screen to change when the agent cannot reach wp-admin.

- **Images**: media-library images printed by the block editor or by `wp_get_attachment_image( $id, 'large' )` get `srcset`, `sizes`, `width`, `height` and lazy loading from core, and core marks the likely LCP image with `fetchpriority="high"` (WordPress 6.3 and later). Hard-coded `<img>` tags in theme templates get none of that: replace them with `wp_get_attachment_image()`. For WebP or AVIF, install the Modern Image Formats plugin (WordPress Performance Team) or use an image CDN.
- **Scripts**: enqueue with a loading strategy instead of printing tags in `header.php`:
  ```php
  wp_enqueue_script( 'acme-slider', get_theme_file_uri( 'js/slider.js' ), array(), '1.2.0', array( 'strategy' => 'defer', 'in_footer' => true ) );
  ```
  Plugins that print blocking scripts in the head are the usual source of `perf_render_blocking_scripts` and `perf_third_party_scripts`; list them for the user.
- **CSS**: classic themes can load core block styles only for blocks on the page with `add_filter( 'should_load_separate_core_block_assets', '__return_true' );`. Dequeue plugin styles on pages that do not use the plugin.
- **Fonts**: set `"fontDisplay": "swap"` in each `fontFace` entry in `theme.json`, and add `font-display` to `@font-face` rules in theme CSS.
- **HTML weight**: page builders produce deep markup and large inline CSS; simplify the heaviest templates, and paginate long archive pages.
- **Compression and caching**: done by the server or a caching plugin (WP Rocket, W3 Total Cache, LiteSpeed Cache); see hosting.md. Core assets use `?ver=` query strings rather than hashed file names, so `perf_static_cache` does not judge them.

## Nuxt

- Production check: `npx nuxi build && npx nuxi preview` (http://localhost:3000).
- Images: `@nuxt/image` components, `<NuxtImg format="webp">` or `<NuxtPicture format="avif,webp">`, with `width`, `height`, `sizes`, and `loading="lazy"` below the fold.
- Components: prefix with `Lazy` (`<LazyCommentsPanel />`) to load them on demand. Third-party scripts: the `@nuxt/scripts` module loads them on idle or on interaction.
- Hashed files are served from `/_nuxt/`. Set `nitro: { compressPublicAssets: true }` to ship gzip and Brotli copies of static files.

## SvelteKit

- Production check: `npx vite build && npx vite preview` (http://localhost:4173), or `node build` with adapter-node.
- Images: `@sveltejs/enhanced-img` (`<enhanced:img src="./hero.jpg" alt="..." />`) generates AVIF and WebP, `srcset`, `width` and `height` at build time.
- Hashed files live under `/_app/immutable/`; adapter-node serves them with a long immutable cache, and its `precompress` option writes gzip and Brotli copies.

## Gatsby

- Production check: `npx gatsby build && npx gatsby serve` (http://localhost:9000).
- Images: `gatsby-plugin-image` (`<StaticImage>`, `<GatsbyImage>`) handles formats, `srcset`, dimensions and lazy loading; set `loading="eager"` on the hero.
- Scripts: the `<Script>` component from `gatsby` with `strategy="idle"` or `"post-hydrate"` keeps third-party tags from blocking.
