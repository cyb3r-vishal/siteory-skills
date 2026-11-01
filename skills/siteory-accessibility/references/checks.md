# Accessibility checks (lens accessibility)

Static checks of the HTML each crawled page returns; no browser runs, no styles are applied and no scripts execute. Each entry: the id, when it fires and at what severity, the one-line fix, and what to change. Penalties: high 20, medium 10, low 5, info 0; `scores.accessibility` is 100 minus the penalties of the findings. Each id is reported once per run and lists every affected URL; the evidence names the elements per page.

Not repeated here because the SEO lens reports them: missing `alt` (`seo_missing_alt`), missing `lang` (`seo_missing_lang`), skipped heading levels (`seo_skipped_headings`) and a missing H1 (`seo_missing_h1`).

## What counts as an accessible name

A link or button has a name when any of these is non-empty: its text content, `aria-label`, `aria-labelledby` pointing at elements with text, `title`, an `<img>` inside it with non-empty `alt`, or an `<svg>` inside it with a `<title>`. `<input type="submit|button|reset">` uses its `value`.

`title` counts, but it is a weak name (touch and many screen reader setups never expose it); prefer visible text, visually hidden text or `aria-label`.

## Names and labels

### a11y_link_name (medium)
An `<a href>` with no accessible name. Typical causes: icon-only social links, a logo link whose image or SVG has no text alternative, a card wrapped in a link that contains only an image without `alt`.
Fix: give every link a name that says where it goes.
Change: add visually hidden text or `aria-label` to the link and hide the icon: `<a href="https://github.com/acme" aria-label="Acme on GitHub"><svg aria-hidden="true" focusable="false">...</svg></a>`. For a logo link, give the image `alt` naming the destination, such as `alt="Acme home"`. For an image card, put the card title inside the link or give the image a real `alt`.

### a11y_button_name (medium)
A `<button>` or `[role="button"]` with no accessible name, or an `<input type="button|submit|reset">` without a `value`. Typical causes: icon buttons for menu, close, search, carousel arrows, theme or language toggles.
Fix: name every button by what it does.
Change: `<button type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav"><svg aria-hidden="true" focusable="false">...</svg></button>`. Give input buttons a `value` that names the action. Replace `<div role="button">` with `<button>`; if the div must stay, it also needs `tabindex="0"` and Enter and Space handlers, which this check cannot see.

### a11y_form_label (medium)
An `<input>` (other than hidden, submit, button, reset and image), `<select>` or `<textarea>` with no label: no `<label for="id">`, no wrapping `<label>`, no `aria-label`, no `aria-labelledby`, no `title`. A `placeholder` alone does not count; it disappears while typing and is often low contrast. Typical causes: newsletter fields in footers, search boxes, filters, quantity selectors.
Fix: label every form control.
Change: `<label for="email">Email</label> <input id="email" name="email" type="email" autocomplete="email">`. When the design has no visible label, use a visually hidden label (`class="sr-only"`) or `aria-label="Search"`. In React use `htmlFor` and an id from `useId()`. Group radio buttons and checkboxes in `<fieldset>` with a `<legend>`.

## Structure and ARIA

### a11y_duplicate_ids (low; medium when a duplicated id is referenced by `for`, `aria-labelledby` or `aria-describedby`)
The same `id` value appears more than once on a page. When a label or description points at a duplicated id, browsers attach it to the first element only, so another control gets the wrong name or none. Evidence: page, id and count.
Fix: make every id unique on the page.
Change: look for components rendered twice with hard-coded ids: a form in both the header and the footer, separate desktop and mobile navigation, a modal rendered on every card, inline SVG icons that repeat `<linearGradient id="gradient">` or `<clipPath id="a">`. Generate ids per instance (`useId()` in React; `useId()` in Vue 3.5 and later; an id prop or a counter elsewhere), and give SVG definitions unique ids or move the icons to a sprite file.

### a11y_aria_hidden_focusable (medium)
`aria-hidden="true"` on a focusable element (`a[href]`, `button`, `input`, `select`, `textarea`, or `tabindex` 0 or more), or on an ancestor of one. Keyboard users can tab to something screen readers say does not exist. Typical causes: an off-canvas menu or modal that is closed in the HTML but still in the tab order, inactive carousel slides, icons wrapped together with a link.
Fix: never hide focusable content from assistive technology; hide it from everyone or not at all.
Change: for content that is closed or off screen, use the `inert` attribute on the container (it removes focus and hides it from screen readers, in all current browsers), or `hidden` or `display: none` until it opens. For icons, put `aria-hidden="true"` on the `<svg>`, not on the link or button. For carousels, mark inactive slides `inert`.

### a11y_positive_tabindex (low)
An element with `tabindex` greater than 0. It jumps ahead of everything else in the tab order, which confuses keyboard users.
Fix: use `tabindex="0"` or remove the attribute, and order focus by the DOM order.
Change: move the element in the markup to where it should be reached, and position it visually with CSS if needed. Use `tabindex="-1"` only for elements that receive focus from script.

### a11y_iframe_title (low)
An `<iframe>` without a non-empty `title` or `aria-label`. Screen readers announce it as an unnamed frame.
Fix: give each iframe a title that says what it contains.
Change: `<iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" title="Product tour video, 2 minutes" loading="lazy"></iframe>`. Maps, forms and calendars embedded by a third-party script often accept a title option. The Google Tag Manager `<noscript><iframe ...>` snippet is a common hit: add `title="Google Tag Manager"` to it.

## Content

### a11y_generic_link_text (low)
A link whose whole text (trimmed, case-insensitive) is "click here", "here", "read more", "learn more", "more" or "link", without `aria-label` or `aria-labelledby`. Screen reader users who list the links on a page hear the same words many times.
Fix: make link text say where it goes.
Change: rewrite the text ("Read the pricing guide"), or keep the short visible text and add the topic in visually hidden text: `<a href="/pricing">Read more<span class="sr-only"> about pricing</span></a>`. If you use `aria-label`, start it with the visible words ("Read more about pricing") so voice-control users can still say what they see.

### a11y_zoom_disabled (medium)
A viewport meta with `user-scalable=no` (or `0`), or `maximum-scale` below 2. Many users need to zoom to read.
Fix: allow zoom by removing `user-scalable` and `maximum-scale` from the viewport meta.
Change: use `<meta name="viewport" content="width=device-width, initial-scale=1">`. In Next.js, delete `maximumScale` and `userScalable` from the `viewport` export (the default needs no export at all). If zoom was disabled to stop iOS Safari zooming into form fields on focus, set the inputs' font size to at least 16px instead.

### a11y_autoplay_media (low)
A `<video autoplay>` without `muted`, or any `<audio autoplay>`. Sound that starts by itself drowns out screen readers.
Fix: do not autoplay sound; mute autoplaying video and never autoplay audio.
Change: `<video autoplay muted loop playsinline poster="/hero.jpg">`. Give looping video a visible pause button (moving content longer than 5 seconds needs one, WCAG 2.2.2), and pause it when `prefers-reduced-motion: reduce` is set. Start audio only from a user action.
