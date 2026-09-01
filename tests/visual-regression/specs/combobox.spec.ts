import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Combobox behavioral smoke — pure-Rozie WAI-ARIA combobox / autocomplete
 * (`Combobox`).
 *
 * `Combobox` is a pure-Rozie family (NO third-party engine) — the hardest of the
 * no-engine primitives to get right cross-framework. The WAI-ARIA combobox pattern
 * (a text input + a popup listbox, aria-activedescendant keyboard navigation) is
 * authored entirely in Rozie. This spec proves the NATIVE author-side primitives
 * ($computed-style `filteredOptions()` filter, the internal query/open/active
 * state, the keyboard model, two-way `r-model:value`) produce identical behaviour
 * across all 6 targets.
 *
 * `examples/demos/ComboboxBehaviorDemo.rozie` drives a 4-option list, a two-way
 * `r-model:value` (live `readout-value`), and a `set-value` direct-model-write
 * button (→ 'cherry').
 *
 * The behavioral smoke above is structural/behavioral only — no `toHaveScreenshot`
 * (per `feedback_vr_linux_baselines`, like listbox.spec.ts, runs locally on macOS
 * without a Docker baseline).
 *
 * The SECOND block below (Phase 86 R2, plan 86-03) IS a pixel cell: the
 * viewport-edge popup flip is the one R2 criterion `floating-popover.behavior.
 * test.ts` cannot prove (happy-dom has no layout engine). Its baseline PNGs
 * (`__screenshots__/ComboboxFloating.png`) ARE Linux-Docker-generated, mirroring
 * overlay-screenshot.spec.ts's `baselineExists()` gate — the cell auto-fixmes
 * until the baseline lands.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>();

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`combobox [${target}]: focus opens 4 options, typing filters to 1, Enter commits two-way value, set-value reflects`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // The role/CSS locators pierce Lit's open shadow root.
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    const value = page.getByTestId('readout-value');
    await expect(value).toHaveText('');

    // ---- 1. focus opens the popup → all 4 options render ----
    await input.focus();
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 15_000,
      })
      .toBe(4);

    // ---- 2. typing 'ch' filters to the single matching option (Cherry) ----
    await input.pressSequentially('ch', { delay: 30 });
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(1);
    await expect(page.locator('[role="option"]').first()).toContainText('Cherry');

    // ---- 3. Enter commits the filtered match (activeIndex auto-set to 0 on input) ----
    //         → two-way value round-trip OUT; closeOnSelect unmounts the popup.
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await value.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('cherry');
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(0);

    // ---- 4. set-value direct-model write reflects into the component ----
    await page.getByTestId('set-value').click();
    await expect
      .poll(async () => (await value.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('cherry');
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// Phase 86 R2 (plan 86-03) — the flipped-popup PIXEL cell.
//
// examples/demos/ComboboxFloatingDemo.rozie opens itself at mount (deferred one
// macrotask past $onMount, mirroring ToasterScreenshotDemo.rozie's own
// child-ref-readiness workaround) with the control pushed near the pinned
// 1280×720 viewport's bottom edge (playwright.config.ts), forcing the composed
// @rozie-ui/popover leaf's `flip` middleware to relocate the popup ABOVE the
// input rather than overflow below.
//
// Baseline PNGs are Linux-Docker-generated (feedback_vr_linux_baselines) —
// mirroring overlay-screenshot.spec.ts's `baselineExists()` + bootstrap-flag
// gate, since combobox.spec.ts (unlike matrix.spec.ts) has no built-in
// per-example baseline gate of its own.
// ════════════════════════════════════════════════════════════════════════════════════

// Bootstrap escape hatch (overlay-screenshot.spec.ts parity): a brand-new example
// has a chicken-and-egg problem — its cell is test.fixme until its .png exists,
// but the .png can only be generated by running the cell with Playwright's `-u`
// (which does NOT override test.fixme). Set
// ROZIE_VR_BOOTSTRAP_BASELINE=ComboboxFloating to force-ungate for ONE `-u` pass.
// Used only by the Docker baseline-regen recipe; never set in CI.
const FLOATING_BOOTSTRAP_BASELINES = new Set(
  (process.env.ROZIE_VR_BOOTSTRAP_BASELINE ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
function floatingBaselineExists(name: string): boolean {
  if (FLOATING_BOOTSTRAP_BASELINES.has(name)) return true;
  return existsSync(resolve(__dirname, `../__screenshots__/${name}.png`));
}
const comboboxFloatingHasBaseline = floatingBaselineExists('ComboboxFloating');

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner =
    !built || !comboboxFloatingHasBaseline || KNOWN_FAILING.has(target)
      ? test.fixme
      : test;
  runner(`combobox-floating [${target}]: popup flips above the input at a viewport edge`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxFloating&target=${target}`);
    const component = page.getByTestId('rozie-mount');
    await expect(component).toBeVisible();

    // The role/CSS locators pierce Lit's open shadow root.
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    // The demo self-opens via $refs.floatingCombobox.focus() one macrotask after
    // its own $onMount — wait for the four options + the floating panel rather
    // than assuming they are already there.
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 15_000,
      })
      .toBe(4);
    const panel = page.locator('.rozie-popover-floating');
    await expect(panel).toBeVisible({ timeout: 15_000 });

    // DOM EVIDENCE OF THE FLIP (not just the screenshot — a wrong state must fail
    // loudly, never silently rebless). The demo's fixture deliberately leaves too
    // little room below the input for the popup to fit, so a genuinely flipped
    // popup renders ENTIRELY above the input: its bottom edge sits at/above the
    // input's own top edge, never overlapping or trailing below it (the
    // un-flipped, pre-Phase-86-R2 failure shape).
    const inputBox = await input.boundingBox();
    const panelBox = await panel.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(inputBox!.y + 1);

    await expect(component).toHaveScreenshot('ComboboxFloating.png', {
      maxDiffPixels: 2,
      animations: 'disabled',
      caret: 'hide',
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// Phase 86 R1 (plan 86-05) — the chip-rail PIXEL cell.
//
// examples/demos/ComboboxMultiDemo.rozie opens itself at mount (deferred one
// macrotask past $onMount, mirroring ComboboxFloatingDemo.rozie's identical
// child-ref-readiness workaround) with a `multiple` combobox seeded with three
// selected chips against a five-option list — so the chip rail's steady state
// (chips inside the control, before the input) AND the open popup's
// width-matches-the-whole-control positioning (D-13) are both visible in one
// deterministic frame.
//
// Baseline PNGs are Linux-Docker-generated (feedback_vr_linux_baselines) —
// mirroring the combobox-floating cell above, since combobox.spec.ts has no
// built-in per-example baseline gate of its own.
// ════════════════════════════════════════════════════════════════════════════════════

function multiBaselineExists(name: string): boolean {
  if (FLOATING_BOOTSTRAP_BASELINES.has(name)) return true;
  return existsSync(resolve(__dirname, `../__screenshots__/${name}.png`));
}
const comboboxMultiHasBaseline = multiBaselineExists('ComboboxMulti');

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner =
    !built || !comboboxMultiHasBaseline || KNOWN_FAILING.has(target)
      ? test.fixme
      : test;
  runner(`combobox-multi [${target}]: chip rail renders inside the control, popup width matches the whole control`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxMulti&target=${target}`);
    const component = page.getByTestId('rozie-mount');
    await expect(component).toBeVisible();

    // The role/CSS locators pierce Lit's open shadow root.
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    // The demo self-opens via $refs.multiCombobox.focus() one macrotask after
    // its own $onMount — wait for all 5 options + the floating panel rather
    // than assuming they are already there.
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 15_000,
      })
      .toBe(5);
    const panel = page.locator('.rozie-popover-floating');
    await expect(panel).toBeVisible({ timeout: 15_000 });

    // DOM EVIDENCE (not just the screenshot — a wrong state must fail loudly,
    // never silently rebless): exactly three chips render, and the popup's
    // measured width equals the control's — the whole control box (chips +
    // input) is the popover anchor, so `matchWidth` spans it, not the input
    // alone (D-04/D-13's stated purpose).
    const chips = page.locator('.rozie-combobox-chip');
    await expect(chips).toHaveCount(3);
    const control = page.locator('.rozie-combobox').first();
    const controlBox = await control.boundingBox();
    const panelBox = await panel.boundingBox();
    expect(controlBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(Math.abs(panelBox!.width - controlBox!.width)).toBeLessThanOrEqual(1);

    await expect(component).toHaveScreenshot('ComboboxMulti.png', {
      maxDiffPixels: 2,
      animations: 'disabled',
      caret: 'hide',
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// Phase 86 R3 (plan 86-06) — the create-row PIXEL cell.
//
// examples/demos/ComboboxCreatableDemo.rozie opens itself at mount (deferred
// one macrotask past $onMount, mirroring ComboboxMultiDemo.rozie's identical
// child-ref-readiness workaround) with a `creatable` combobox seeded (via
// `seedQuery`) with a fixed query matching no option, against a four-option
// list — so all four options AND the create row (positioned last) are both
// visible in one deterministic frame.
//
// Baseline PNGs are Linux-Docker-generated (feedback_vr_linux_baselines) —
// mirroring the combobox-multi cell above, since combobox.spec.ts has no
// built-in per-example baseline gate of its own.
// ════════════════════════════════════════════════════════════════════════════════════

function creatableBaselineExists(name: string): boolean {
  if (FLOATING_BOOTSTRAP_BASELINES.has(name)) return true;
  return existsSync(resolve(__dirname, `../__screenshots__/${name}.png`));
}
const comboboxCreatableHasBaseline = creatableBaselineExists('ComboboxCreatable');

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner =
    !built || !comboboxCreatableHasBaseline || KNOWN_FAILING.has(target)
      ? test.fixme
      : test;
  runner(`combobox-creatable [${target}]: the create row renders last, after every real option`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxCreatable&target=${target}`);
    const component = page.getByTestId('rozie-mount');
    await expect(component).toBeVisible();

    // The role/CSS locators pierce Lit's open shadow root.
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    // The demo self-opens + self-seeds via $refs.creatableCombobox.focus() /
    // .seedQuery('kiwi') one macrotask after its own $onMount — wait for the
    // create row (not just any option, since "kiwi" matches nothing) before
    // asserting or screenshotting.
    const createRow = page.locator('.rozie-combobox-create');
    await expect(createRow).toBeVisible({ timeout: 15_000 });

    // DOM EVIDENCE (not just the screenshot — a wrong state must fail loudly,
    // never silently rebless): the create row is the LAST option row, and no
    // empty-state row is present in the same frame (D-19 — a creatable query
    // with zero substring matches still shows the create row, not #empty).
    const options = page.locator('[role="option"]');
    await expect(options).toHaveCount(1);
    const lastOptionClass = await options.last().getAttribute('class');
    expect(lastOptionClass ?? '').toContain('rozie-combobox-create');
    await expect(page.locator('.rozie-combobox-empty')).toHaveCount(0);

    await expect(component).toHaveScreenshot('ComboboxCreatable.png', {
      maxDiffPixels: 2,
      animations: 'disabled',
      caret: 'hide',
    });
  });
}
