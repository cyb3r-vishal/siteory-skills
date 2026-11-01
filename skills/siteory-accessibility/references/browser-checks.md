# Checking what the static scan cannot see

The Siteory accessibility lens reads server HTML. Contrast, focus, keyboard behavior and anything that appears after interaction need a browser. Run these against the same production build.

## Lighthouse: contrast and a broad automated pass

```bash
npx lighthouse http://localhost:3000 --only-categories=accessibility --output=json --output-path=./lighthouse-a11y.json --chrome-flags="--headless=new"
```

Needs Chrome installed. Read `categories.accessibility.score` (0 to 1) and every audit in `audits` whose `score` is 0; `audits["color-contrast"].details.items` lists each element with too little contrast. Lighthouse runs axe-core on one page in its initial state, so open menus, dialogs and form errors are not covered. The axe DevTools browser extension runs the same rules on whatever state the page is in.

## axe in Playwright: states after interaction

```bash
npm install --save-dev @playwright/test @axe-core/playwright
npx playwright install chromium
```

```ts
// tests/accessibility.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("home page has no detectable violations", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});

test("open navigation has no detectable violations", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.getByRole("button", { name: "Menu" }).click(); // also proves the button has a name
  const results = await new AxeBuilder({ page }).include("#site-nav").withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});
```

Add one test per important state: menu open, dialog open, form submitted with errors, checkout step. `getByRole` locators fail when an element has no accessible name, so the tests also guard the fixes from this skill.

## Manual keyboard pass (about ten minutes per template)

1. Load the page and press Tab. Every stop shows a visible focus indicator. A "Skip to content" link as the first stop helps keyboard users past the navigation.
2. Tab through the whole page: the order follows the visual order, and nothing invisible receives focus (a closed menu, an off-screen slide).
3. Open menus, dialogs, dropdowns and accordions with Enter or Space. Escape closes them and focus returns to the control that opened them. Tab stays inside an open modal.
4. Use every control without a mouse: carousels, tabs, sliders, date pickers, form submission and error messages.
5. Zoom to 200 percent and narrow the window to 320 px: text is not cut off and does not need horizontal scrolling (WCAG 1.4.4, 1.4.10).
6. Turn on reduced motion in the operating system: autoplaying animation stops or calms down.

## Screen reader smoke test

- macOS and iOS: VoiceOver (Command+F5 on a Mac). The rotor (Control+Option+U) lists headings, links and form controls; each name should make sense on its own.
- Windows: NVDA (free). H jumps between headings, K between links, F between form fields, and Insert+F7 lists them.
- Listen for: the page title on load, images described or skipped, every button and link named, form labels and errors announced, and status messages (added to cart, saved) announced through a live region.

## Contrast thresholds (WCAG 1.4.3 and 1.4.11)

- Text: at least 4.5:1 against its background; large text (24 px, or about 19 px bold) at least 3:1.
- Icons that carry meaning, input borders and focus indicators: at least 3:1 against what surrounds them.
- Placeholder text that is the only hint for a field counts as text. Disabled controls are exempt.

Report the results of these checks separately from the Siteory findings, and say which ones a person still has to do.
