# Accessibility fix patterns

Patterns for the findings in checks.md, in HTML and JSX, then notes per framework. Fix the shared component once; every page that uses it is fixed with it.

## Visually hidden text

Text that screen readers announce but the layout does not show. Tailwind has the `sr-only` class, Bootstrap `visually-hidden`, WordPress themes `screen-reader-text`. Without a framework:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

Do not use `display: none` or `visibility: hidden` for this; they hide the text from screen readers too.

## Icon links and icon buttons

`a11y_link_name`, `a11y_button_name`:

```tsx
import { Menu, Search } from "lucide-react";

<button type="button" aria-label="Menu" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>
  <Menu aria-hidden="true" />
</button>

<button type="submit" aria-label="Search">
  <Search aria-hidden="true" />
</button>

<a href="https://github.com/acme">
  <GitHubLogo aria-hidden="true" /> {/* your SVG component */}
  <span className="sr-only">Acme on GitHub</span>
</a>
```

- The name says what happens or where the link goes. State belongs in `aria-expanded` or `aria-pressed`, not in the name.
- Inline `<svg>` icons get `aria-hidden="true"` and `focusable="false"`. A meaningful standalone SVG gets `role="img"` and a `<title>` instead.
- A logo link: `<a href="/"><img src="/logo.svg" alt="Acme home" width="120" height="32"></a>`.

## Form fields

`a11y_form_label`:

```tsx
import { useId } from "react";

export function EmailField({ error }: { error?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>Email</label>
      <input
        id={id}
        name="email"
        type="email"
        autoComplete="email"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <p id={`${id}-error`}>{error}</p>}
    </div>
  );
}
```

A search box or a newsletter field without a visible label:

```html
<form role="search" action="/search">
  <label for="site-search" class="sr-only">Search the site</label>
  <input id="site-search" name="q" type="search">
  <button type="submit">Search</button>
</form>
```

Component libraries usually render the label when you pass one (a `label` prop, or a `<Label htmlFor>` paired with the input's `id`); check that the generated `for` matches the input's `id`.

## Unique ids

`a11y_duplicate_ids`: generate ids per instance instead of hard-coding them. React and Vue (3.5 and later) have `useId()`; elsewhere, pass an id prop or add a prefix per instance. Common sources:

- the same form or search box rendered in the header and again in the footer or mobile menu;
- separate desktop and mobile navigation that both stay in the HTML;
- inline SVG icons that each define `<linearGradient id="a">` or `<clipPath id="clip">`: give each instance its own id, or move the icons to a sprite file referenced with `<use href="/icons.svg#name">`.

## Closed menus, dialogs and carousels

`a11y_aria_hidden_focusable`: content that is off screen must not be reachable with Tab.

```tsx
<nav id="site-nav" className={open ? "drawer drawer-open" : "drawer"} inert={!open}>
  ...
</nav>
```

- `inert` removes the subtree from the tab order and from screen readers, in all current browsers. React 19 accepts it as a boolean; React 18 needs `inert={open ? undefined : ""}`.
- Render the closed state on the server too, so the HTML already carries `inert` or `hidden`.
- For modals, a native `<dialog>` opened with `showModal()` makes the rest of the page inert and returns focus on close.
- Carousels: mark inactive slides `inert` rather than `aria-hidden="true"`.

## Viewport

`a11y_zoom_disabled`: the only viewport most sites need is `<meta name="viewport" content="width=device-width, initial-scale=1">`. In Next.js, delete `maximumScale` and `userScalable` from `export const viewport` (the example in the Next.js docs includes both; copying it disables zoom). To stop iOS Safari from zooming into inputs on focus, give inputs `font-size: 16px` or larger.

## Iframes and media

```html
<iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" title="Product tour video, 2 minutes" loading="lazy" allowfullscreen></iframe>

<video autoplay muted loop playsinline poster="/hero-poster.jpg">
  <source src="/hero.webm" type="video/webm">
  <source src="/hero.mp4" type="video/mp4">
</video>
```

Pair a looping background video with a pause button, and do not autoplay it when `window.matchMedia("(prefers-reduced-motion: reduce)").matches`.

## Framework notes

### Next.js

- `next/link` renders an `<a>`: pass `aria-label` and other attributes straight to `<Link>`.
- `next/image` requires `alt`; use `alt=""` for decorative images. `<html lang="en">` belongs in `app/layout.tsx`.
- Client Components still render on the server, so attributes written in JSX reach the HTML the checker reads. Attributes added in `useEffect`, or components loaded with `next/dynamic` and `ssr: false`, do not.
- Viewport: see above. Set `themeColor` and `colorScheme` freely; only `maximumScale` and `userScalable` affect zoom.

### Astro

- The layout owns `<html lang>` and the viewport meta. Components without a `client:*` directive render to plain HTML, so the checker sees all of them.
- `client:only` islands render nothing on the server; the checker cannot see their markup, so check them in a browser tool.

### Vite with React, Vue or Svelte

- The server sends `index.html` with an empty mount point, so only `index.html` is judged. Prerender the routes (React Router framework mode with `prerender`, `vite-react-ssg`) to let the checker see components, or scan them with `@axe-core/playwright` (browser-checks.md).

### WordPress

- Core and directory themes use the `screen-reader-text` class for hidden text; classic themes must define it in their CSS.
- Block editor: the Image block has an Alternative text field, each link in the Social Icons block has a link label, the Search block has a label setting, and the Navigation block names its menu toggle. Fill these in rather than editing markup.
- Form plugins: give every field a label in the form builder; a placeholder is not one.
- Classic themes: menu toggle buttons in `header.php` and `<html <?php language_attributes(); ?>>` are the usual places to fix.
