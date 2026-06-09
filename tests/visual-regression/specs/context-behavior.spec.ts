import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Cross-component context primitive ($provide / $inject) behavioral cell
 * (Phase 36, R11 / R13).
 *
 * Two demos exercise the primitive end-to-end across all 6 separately-compiled
 * targets:
 *
 *   - 'ThemeContext' (examples/demos/ThemeContextDemo.rozie) — the MINIMAL TRIO.
 *     Three SEPARATELY-COMPILED modules nested:
 *
 *         ThemeProvider   $provide('theme', { get color, cycle })
 *           ThemePassthrough   renders <slot/>, KNOWS NOTHING about theme
 *             ThemeButton   $inject('theme'), shows color, click → cycle()
 *
 *     This is the no-prop-drill proof: the button shows the injected color even
 *     though ThemePassthrough never forwards it (inject reached depth through
 *     the unaware middle — R11, cross-file token identity). Clicking cycles the
 *     color red→green→blue at depth (the reactive round-trip — R13).
 *
 *   - 'Tabs' (examples/demos/TabsDemo.rozie) — the compound-component SHOWCASE.
 *     Tabs $provide('tabs', { get active, setActive, register }); three Tab
 *     children inject it, claim an index at setup, and render active-aware.
 *     Clicking a tab calls setActive(index) on the injected API, which
 *     round-trips through context to re-style every sibling — no prop passed.
 *
 * WHY THIS SPEC IS BEHAVIORAL-ONLY (no toHaveScreenshot):
 *
 * Per `feedback_vr_linux_baselines`, a structural-only spec runs locally on
 * macOS without any Docker baseline regen. The assertions are on the live DOM
 * (button text, data-active state) — no pixel baseline. These demos are
 * deliberately NOT in matrix.spec.ts EXAMPLES.
 *
 * LIT ASYNC EDGE (REQ-30): @lit/context's ContextConsumer resolves via an async
 * `context-request` round-trip, so the injected value can be `undefined` on the
 * very first paint until the provider responds (across THREE shadow boundaries
 * for the trio). Every assertion on the injected text therefore waits for
 * EVENTUAL fill (`toBeVisible` / `toHaveText` with a timeout), never synchronous
 * presence.
 *
 * ANGULAR (REQ-31, first-class — non-negotiable): the Angular cell renders +
 * round-trips in the real analogjs VR build. Content-projection injector
 * resolution rides Angular's `providers` (NOT `viewProviders`) — projected
 * ng-content descendants resolve `providers`. The build-availability gate below
 * registers the Angular cell with `test` (not `test.fixme`) once the analogjs
 * sub-build produced its host entry, so the Angular leg is a true gate here.
 *
 * If this spec is red, the regression is in the context emit (the provide-side
 * Provider wrap / providers entry / ContextProvider, or the inject-binding
 * rewrite), or the cross-file token-identity registry (rozieContext /
 * rozieToken globalThis singleton).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// The provider seeds 'red'; cycle() advances red → green → blue → red.
const COLORS = ['red', 'green', 'blue'] as const;

for (const target of TARGETS) {
  // Build-availability gate — copied from flatpickr-behavior.spec.ts. When the
  // per-target VR sub-build did not produce `dist/<target>/`, the cell is
  // registered with `test.fixme` (known-pending) rather than erroring. Angular
  // is a FIRST-CLASS gate here (REQ-31): when its analogjs sub-build is present,
  // it runs as a real `test`, not `test.fixme`.
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = built ? test : test.fixme;

  runner(`context-behavior [${target}]: inject-at-depth + reactive round-trip (trio)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`/?example=ThemeContext&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // STRUCTURE — the unaware passthrough sits between provider and consumer.
    // Playwright css locators pierce shadow boundaries by default, so the
    // provider/passthrough/button all RESOLVE on Lit's 3-shadow-root nesting.
    await expect(mount.locator('[data-theme-provider]')).toBeVisible();
    await expect(mount.locator('[data-theme-passthrough]')).toBeVisible();

    // The deep ThemeButton renders. Note the locator does NOT use a
    // `[data-theme-passthrough] [data-theme-button]` DESCENDANT combinator: on
    // Lit each component owns a separate shadow root, so the button is slotted
    // into the passthrough's light DOM and is NOT a DOM descendant of the
    // passthrough's shadow `<div data-theme-passthrough>` — a descendant
    // combinator returns 0 there. The no-prop-drill proof on every target is
    // that the INJECTED value crossed the unaware passthrough to reach the
    // button (asserted by the button's text below), not the DOM ancestry.
    const button = mount.locator('[data-theme-button]');
    await expect(button).toBeVisible({ timeout: 10_000 });

    // R11 — INJECT REACHED DEPTH THROUGH THE UNAWARE PASSTHROUGH. The button's
    // label is the injected `theme.color`, seeded 'red'. On Lit this fills
    // asynchronously (context-request across 3 shadow boundaries) — wait for
    // eventual fill via toHaveText's timeout, NOT synchronous presence. If
    // inject did NOT reach depth, the guarded read renders empty and this fails.
    await expect(button).toHaveText(COLORS[0], { timeout: 10_000 });

    // R13 — REACTIVE ROUND-TRIP. Each click calls theme.cycle() (provider-side
    // mutation), which round-trips back through context to re-render the deep
    // consumer's label: red → green → blue → red.
    await button.click();
    await expect(button).toHaveText(COLORS[1], { timeout: 10_000 });
    await button.click();
    await expect(button).toHaveText(COLORS[2], { timeout: 10_000 });
    await button.click();
    await expect(button).toHaveText(COLORS[0], { timeout: 10_000 });

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual(
      [],
    );
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual(
      [],
    );
  });

  runner(`context-behavior [${target}]: compound-component active round-trip (tabs)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`/?example=Tabs&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // STRUCTURE — three Tab children injected the shared Tabs API. As with the
    // trio, the locator avoids a `[data-tabs] [data-tab]` descendant combinator:
    // on Lit each Tab is a separate custom element slotted into the Tabs light
    // DOM, not a DOM descendant of the Tabs shadow `<div data-tabs>`. The Tabs
    // container is asserted present separately; the three tabs are matched
    // directly (the locator pierces shadow boundaries).
    await expect(mount.locator('[data-tabs]')).toBeVisible();
    const tabs = mount.locator('[data-tab]');
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
    await expect(tabs).toHaveCount(3);

    // R11 — the children read the INJECTED active index (no prop passed). The
    // first tab (index 0) is active on seed. On Lit the injected value fills
    // asynchronously, so wait for eventual `data-active="true"` via the
    // attribute assertion's timeout.
    await expect(tabs.nth(0)).toHaveAttribute('data-active', 'true', {
      timeout: 10_000,
    });
    await expect(tabs.nth(1)).toHaveAttribute('data-active', 'false', {
      timeout: 10_000,
    });

    // R13 — REACTIVE ROUND-TRIP. Clicking the third tab calls
    // setActive(2) on the injected API; the active state round-trips through
    // context and re-styles every sibling (tab 0 deactivates, tab 2 activates).
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveAttribute('data-active', 'true', {
      timeout: 10_000,
    });
    await expect(tabs.nth(0)).toHaveAttribute('data-active', 'false', {
      timeout: 10_000,
    });

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual(
      [],
    );
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual(
      [],
    );
  });
}
