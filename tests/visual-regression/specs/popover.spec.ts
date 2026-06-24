import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Popover behavioral smoke — headless floating primitive (`Popover`) wrapping
 * `@floating-ui/dom`.
 *
 * Floating UI is the de-facto vanilla-JS positioning engine; Popover owns the
 * author-side API: positioning, the open/close gesture (`trigger="click"`),
 * dismissal (Escape + click-outside), the ARIA wiring, and the two-way `open`
 * model. This spec proves the controlled floating primitive opens/closes
 * identically across all 6 targets.
 *
 * `examples/demos/PopoverBehaviorDemo.rozie` drives a click-trigger popover seeded
 * CLOSED with a two-way `r-model:open` (live `readout-value` + `@change`-fed
 * `readout-change`), an anchor button, an `r-if="open"` floating panel (so
 * presence == open), and a `set-open` direct-model-write button.
 *
 * The `@change` readout exercises the Lit-consumer CustomEvent unwrap for a BARE
 * boolean payload (project_vr_direct_model_write_null_react_solid_lit): the
 * child's `$emit('change', <boolean>)` reaches the Lit consumer as a CustomEvent
 * (boolean in `e.detail`) vs the boolean as arg0 on the other 5 targets.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot` (the pixel cell is PopoverScreenshot in
 * overlay-screenshot.spec.ts — the floating panel escapes the mount clip).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`popover [${target}]: anchor-click opens, Escape + outside-click dismiss, set-open writes`, async ({
    page,
  }) => {
    await page.goto(`/?example=PopoverBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const value = page.getByTestId('readout-value');
    const change = page.getByTestId('readout-change');
    const anchor = page.getByTestId('popover-anchor');
    // The open/closed SIGNAL is the floating panel itself (role="dialog"), which
    // is r-if="open"-gated inside the popover's shadow/template. NOT the
    // `popover-content` testid: on Lit that slotted text is a LIGHT-DOM child of
    // <rozie-popover> and so stays in the DOM tree even when closed (it is merely
    // unslotted/not rendered), unlike the r-if-gated panel — a shadow-DOM
    // slotting subtlety, not a state bug. role= pierces Lit's shadow.
    const panel = page.locator('[role="dialog"]');
    const content = page.getByTestId('popover-content');
    // An always-present element OUTSIDE the anchor + floating panel for the
    // click-outside dismissal (the demo heading).
    const outside = page.getByRole('heading', { name: 'Popover — behavioral' });

    // ---- 1. seeded closed: floating panel ABSENT ----
    await expect(anchor).toBeVisible({ timeout: 15_000 });
    await expect(value).toHaveText('closed');
    await expect(panel).toHaveCount(0);

    // ---- 2. anchor click opens: panel renders + slotted content shows, @change true ----
    await anchor.click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(content).toBeVisible();
    await expect(value).toHaveText('open');
    await expect(change).toHaveText('true');

    // ---- 3. Escape dismisses: panel gone, @change fires false ----
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(value).toHaveText('closed');
    await expect(change).toHaveText('false');

    // ---- 4. anchor click re-opens ----
    await anchor.click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(value).toHaveText('open');

    // ---- 5. outside click dismisses ----
    await outside.click();
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(value).toHaveText('closed');

    // ---- 6. re-open (gesture), then set-closed direct-model write (→ closed) reflects.
    //         The direct-model write is a CLOSE, not an open: a programmatic OPEN from
    //         an external button races the click-outside dismissal on Svelte (the
    //         opening click reaches `document` where the just-attached, same-tick
    //         outside listener dismisses it). Closing has no such race → robust ×6.
    //         See project_vr_direct_model_write_null_react_solid_lit. ----
    await anchor.click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('set-closed').click();
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(value).toHaveText('closed');
  });
}
