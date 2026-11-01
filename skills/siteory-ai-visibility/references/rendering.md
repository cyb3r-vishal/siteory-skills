# Server rendering for AI readers

AI search and assistant fetchers (OAI-SearchBot, ChatGPT-User, Claude-User, PerplexityBot and others) mostly read the HTML the server returns and do not run JavaScript. A page that builds its content in the browser looks empty to them. Siteory reads the same raw HTML, so its content checks show what those fetchers see.

## What the checks look at

- Visible words in the HTML body (scripts, styles and hidden template text excluded).
- `aeo_js_only_start` (high): the start page has fewer than 40 words and an empty mount point (`#root`, `#app`, `#__next`, `#__nuxt`, `#___gatsby`, `#svelte`), five or more external scripts, or a `<noscript>` asking for JavaScript.
- `aeo_thin_start` (medium) and `aeo_thin_pages` (low): fewer than 40 visible words.
- `aeo_no_semantic_landmarks` (low): no `main`, `article`, `section`, `nav`, `header`, `footer` or `aside` on the start page.
- `aeo_question_without_context` (low): a heading with "?" but fewer than 15 words of other text.

See the raw HTML yourself: `curl -s http://localhost:3000/ | head -c 3000`, or open the page with JavaScript disabled.

## Fixes per framework

The goal is the same everywhere: the main content of public pages is in the HTML response, rendered on the server or at build time. Interactive parts can still hydrate afterwards.

### Next.js (App Router)

- Pages and layouts are Server Components by default and render to HTML. Content disappears when it moves into a `"use client"` component that fetches in `useEffect`, or into `dynamic(() => import(...), { ssr: false })`.
- Fetch the data in the Server Component (`const data = await getData()`) and pass it to client components as props.
- Wrapping content in `<Suspense>` streams it into the same response, which fetchers receive. A client component that renders `null` until mounted does not.
- A root layout that renders only `{mounted && children}` hides the whole site; remove that guard.
- Pages Router: use `getStaticProps` or `getServerSideProps` instead of client-side fetching for page content.

### Astro

- Astro renders HTML by default. Content inside `client:only` components is rendered only in the browser; use `client:load` or `client:visible` (rendered on the server, then hydrated) or plain Astro components for the main content.

### Vite + React (or Vue) SPA

- Prerender public routes at build time (React Router framework mode `prerender`, `vite-react-ssg`, Vike), or move public pages to a server-rendering framework.
- As a minimum for the homepage, put the hero heading and a two-sentence summary as static HTML inside `<div id="root">` in `index.html`; React replaces it on load.

### Nuxt

- SSR is on by default. `ssr: false` in `nuxt.config.ts`, or `<ClientOnly>` around main content, empties the HTML. Use `routeRules` with `prerender: true` or `swr` for static or cached pages. Fetch with `useFetch` or `useAsyncData` so data is in the server render.

### SvelteKit

- SSR is on by default. `export const ssr = false` in a `+page.ts` or `+layout.ts` turns the route into an empty shell. Load data in `+page.server.ts` or `+page.ts` `load`, not in `onMount`.

### React Router 7 and Remix

- Framework mode renders on the server by default. With `ssr: false`, list public routes under `prerender` in `react-router.config.ts`. Put page data in `loader`, not in `useEffect`.

### Gatsby

- Pages are prerendered at build time. Data fetched in `useEffect` at runtime is not; use page queries or `getServerData` instead.

### Angular

- Add server-side rendering or prerendering with `ng add @angular/ssr`.

### WordPress

- Classic and block themes render HTML on the server. Headless setups need the front end above to render on the server. Page builders that load content by JavaScript need a server-rendered layout for the main text.

## Landmarks and question headings

```html
<body>
  <header><nav>...</nav></header>
  <main>
    <h1>Invoicing for small agencies</h1>
    <p>Acme sends invoices, chases late payments and reconciles bank feeds.</p>
    <section>
      <h2>Can I import invoices from another tool?</h2>
      <p>Yes. Acme imports CSV exports from QuickBooks, Xero and FreshBooks in one step.</p>
    </section>
  </main>
  <footer>...</footer>
</body>
```

- Put `<main>` in the shared layout so every page gets it.
- Answer a question heading in the first sentence under it, in plain text in the HTML. `<details>` and `<summary>` accordions are fine because their text is in the HTML; answers fetched when the user clicks are not.

## Verify

```bash
node "<skill base dir>/scripts/siteory.mjs" check http://localhost:3000 --lens aeo --prod https://www.example.com --only aeo_js_only_start,aeo_thin_start --fail-on info
```

Always verify against a production build; dev servers render differently.
