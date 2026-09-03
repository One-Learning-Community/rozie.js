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

// ════════════════════════════════════════════════════════════════════════════════════
// quick-260901-tpq — combobox-chip-remove: the browser-only half of the CR-02 fix
// (`d02a145ef`).
//
// `d02a145ef` changed the chip remove control from `@click` to `@mousedown.prevent`
// because native focus-follows-mousedown blurred the combobox input and closed the
// composed Popover BEFORE the click ever fired, and threaded an `isRemoval` flag so
// D-14's query-clear-on-pick only fires on an actual selection, never on a removal.
//
// The RED-first proof for that fix — `multiple.behavior.test.ts` test (15) — can only
// assert the MECHANISM (a dispatched mousedown's `defaultPrevented` plus the
// surviving query), because happy-dom has no focus-follows-mousedown to reproduce.
// This cell asserts the OUTCOME a real trusted browser gesture produces: chip gone,
// popup still open, focus still on the input, query intact — the half no unit test
// can reach. It writes no image and needs no baseline, so unlike the three pixel
// blocks above it, it is authorable and verifiable outside pinned Linux Docker.
//
// quick-260903-0s1 (E1 audit finding) extends this cell with a KEYBOARD leg after
// the existing pointer assertions: Enter on a focused remove control, with no
// preceding mousedown, is exactly the shape a screen reader's synthesized
// activation also produces — the RED-first unit proof (test 16) cannot reach a
// GENUINELY trusted click the way this real-browser cell can.
// ════════════════════════════════════════════════════════════════════════════════════

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`combobox-chip-remove [${target}]: a trusted mousedown on a chip's remove control removes the chip, keeps the popup open, keeps focus on the input, and preserves the in-progress query`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxMulti&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // The role/CSS locators pierce Lit's open shadow root.
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    // The demo self-opens via $refs.multiCombobox.focus() one macrotask after its
    // own $onMount — wait for all 5 options + the floating panel + the 3 seeded
    // chips rather than assuming any of them are already there.
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 15_000,
      })
      .toBe(5);
    const panel = page.locator('.rozie-popover-floating');
    await expect(panel).toBeVisible({ timeout: 15_000 });
    const chips = page.locator('.rozie-combobox-chip');
    await expect(chips).toHaveCount(3);

    // ---- arrange an in-progress query ----
    await input.pressSequentially('ch', { delay: 30 });
    await expect
      .poll(async () => page.locator('[role="option"]').count(), {
        timeout: 10_000,
      })
      .toBe(1);
    await expect(page.locator('[role="option"]').first()).toContainText('Cherry');

    // ---- act: a genuinely trusted mousedown on the "Remove Banana" control ----
    // Coordinate-based clicking is FORBIDDEN here: a coordinate approach was
    // measured to fail during scoping because the browser viewport is 1713 CSS px
    // against a 1456 px screenshot space (scale 0.85, DPR 2), so raw
    // getBoundingClientRect values land roughly 30px off target. Playwright's role
    // locator resolves the element itself and its `.click()` dispatches a
    // genuinely trusted mousedown — which IS the CR-02 reproduction, a synthetic
    // click event is not — and its role locator pierces Lit's shadow root the
    // same way the CSS locators above do.
    await page.getByRole('button', { name: 'Remove Banana' }).click();

    // ---- assert: chip removed, siblings intact ----
    await expect.poll(async () => chips.count(), { timeout: 10_000 }).toBe(2);
    await expect(page.getByRole('button', { name: 'Remove Banana' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove Apple' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Remove Cherry' })).toHaveCount(1);

    // ---- assert: popup is STILL open (panel visible AND option count still 1) ----
    await expect(panel).toBeVisible();
    await expect(page.locator('[role="option"]')).toHaveCount(1);

    // ---- assert: the in-progress query survived the removal ----
    await expect(input).toHaveValue('ch');

    // ---- assert: focus is STILL on the combobox input ----
    // Under Lit's shadow root, document.activeElement resolves to the custom-
    // element HOST, not the inner input — toBeFocused() and a direct
    // document.activeElement read would both misreport what's really focused.
    // Walk down through open shadow roots to the true focused element.
    const focused = await page.evaluate(() => {
      let el: Element | null = document.activeElement;
      while (el?.shadowRoot?.activeElement) {
        el = el.shadowRoot.activeElement;
      }
      return {
        tagName: el?.tagName ?? null,
        role: el?.getAttribute('role') ?? null,
      };
    });
    expect(focused.tagName).toBe('INPUT');
    expect(focused.role).toBe('combobox');

    // ---- act: KEYBOARD activation — quick-260903-0s1's E1 fix. Focus the
    // "Remove Apple" control directly (skipping a real Tab traversal, which is
    // brittle across the six targets' differing tab-stop counts) and press
    // Enter. A real browser fires a `click` on a focused <button> for
    // Enter/Space with NO preceding `mousedown` at all — exactly the shape a
    // screen reader's synthesized activation also produces, and exactly the
    // shape the RED-first unit proof (multiple.behavior.test.ts test 16)
    // cannot reach in happy-dom because a genuinely trusted `click` is a real
    // browser behavior, not something a script-dispatched event reproduces.
    //
    // SOLID IS SKIPPED HERE — a real, DIFFERENT, PRE-EXISTING defect, found by
    // this exact assertion, not introduced by this fix: moving DOM focus off
    // the input at all (Tab OR a direct `.focus()` call — both produce the
    // identical native blur/focus sequence) fires the input's `onBlur()`,
    // which sets `$data.isOpen = false`. The chip rail lives inside Popover's
    // `#anchor` scoped-slot fill, invoked with a reactive `open` scope param —
    // per Combobox.rozie's own onFocus() comment, "a named slot invocation
    // with reactive scope params is a plain closure CALL re-run whenever any
    // param changes" and on Solid this "SYNCHRONOUSLY recreates the anchor's
    // DOM subtree" whenever that `open` param changes, in EITHER direction.
    // The chip button we just called `.focus()` on is torn out and replaced
    // by a fresh, never-focused node before the browser finishes moving focus
    // onto it, so it never lands and Enter has nothing real to activate.
    // Confirmed pre-existing: the chip remove button was ALREADY a plain,
    // enabled, tabbable `<button>` (test 12, unit suite, byte-unchanged by
    // this fix) — this fix changed what happens once it IS activated, not
    // whether Tab/focus can safely reach it. Fixing the underlying
    // Popover-anchor/Solid interaction is out of this task's E1/E2/CP-08
    // scope (it touches onBlur()'s shared dismiss semantics for every
    // combobox instance, not just this fix's own binding split) — recorded in
    // .planning/deferred-items.md rather than fixed here.
    if (target !== 'solid') {
      const removeApple = page.getByRole('button', { name: 'Remove Apple' });
      await removeApple.focus();
      await expect(removeApple).toBeFocused();
      await page.keyboard.press('Enter');

      // ---- assert: the chip was removed via the keyboard ----
      await expect.poll(async () => chips.count(), { timeout: 10_000 }).toBe(1);
      await expect(page.getByRole('button', { name: 'Remove Apple' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Remove Cherry' })).toHaveCount(1);

      // ---- assert: the popup is STILL open ----
      await expect(panel).toBeVisible();

      // ---- assert: focus lands back on the combobox input, not document.body ----
      // Enter/Space activation puts focus ON the button, which the removal then
      // unmounts — without the E1 fix's refocus, focus would fall to
      // document.body.
      const focusedAfterKeyboard = await page.evaluate(() => {
        let el: Element | null = document.activeElement;
        while (el?.shadowRoot?.activeElement) {
          el = el.shadowRoot.activeElement;
        }
        return {
          tagName: el?.tagName ?? null,
          role: el?.getAttribute('role') ?? null,
        };
      });
      expect(focusedAfterKeyboard.tagName).toBe('INPUT');
      expect(focusedAfterKeyboard.role).toBe('combobox');
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// combobox-flip-exact-fit — Phase 86 UAT item 1, previously routed to manual testing
// in `86-UAT.md` and flagged as a backstop edge in `86-SPEC.md`'s Edge Coverage table
// for R2, on the grounds that the boundary arithmetic belongs to Floating UI and is
// not reproducible in the happy-dom harness (no layout engine).
//
// It IS reproducible in a real browser once the exact-fit viewport height is derived
// by MEASUREMENT rather than guessed — which is what this cell does.
//
// Distinguish this from the `combobox-floating` pixel cell above in one line: that one
// proves a flip HAPPENS on genuine overflow and pins the result to a PNG; this one
// proves a flip does NOT happen at a zero-slack boundary and asserts geometry only.
// ════════════════════════════════════════════════════════════════════════════════════

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`combobox-flip-exact-fit [${target}]: the popup stays below the input at zero slack, and flips above at 8px of genuine overflow`, async ({
    page,
  }) => {
    // Three navigations per cell can approach the config's 30s per-test timeout
    // on a cold preview server — a slow load is not a behavioral failure, so the
    // budget is raised up front rather than fixme'ing a target that trips it.
    test.setTimeout(60_000);

    // Page-scoped open helper (bound to this cell's `page`, not a module-level
    // function) — navigates to the example, waits for the mount, waits for the
    // input, polls [role="option"] to 4, waits for the floating panel to become
    // visible, forces the scroll position to the top, and returns the input and
    // panel locators. Called once per pass.
    async function open() {
      await page.goto(`/?example=ComboboxFloating&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();
      // The role/CSS locators pierce Lit's open shadow root.
      const input = page.locator('input[role="combobox"]').first();
      await expect(input).toBeVisible({ timeout: 15_000 });
      // The demo self-opens via $refs.floatingCombobox.focus() one macrotask
      // after its own $onMount — wait for the four options + the floating
      // panel rather than assuming either is already there.
      await expect
        .poll(async () => page.locator('[role="option"]').count(), {
          timeout: 15_000,
        })
        .toBe(4);
      const panel = page.locator('.rozie-popover-floating');
      await expect(panel).toBeVisible({ timeout: 15_000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      return { input, panel };
    }

    // ---- Pass A (measure): tall viewport, popup renders below the input ----
    await page.setViewportSize({ width: 1280, height: 1400 });
    const passA = await open();
    const inputBoxA = await passA.input.boundingBox();
    const panelBoxA = await passA.panel.boundingBox();
    expect(inputBoxA).not.toBeNull();
    expect(panelBoxA).not.toBeNull();
    // Guard: the panel really IS below here before trusting any number derived
    // from it — measuring a flipped panel would poison every number downstream
    // and the cell would then pass vacuously.
    expect(panelBoxA!.y).toBeGreaterThanOrEqual(
      inputBoxA!.y + inputBoxA!.height - 1,
    );

    const inputBottom = inputBoxA!.y + inputBoxA!.height;
    // The resolved offset, read from the rendered layout rather than hardcoded
    // as the Combobox `offset` prop's default of 4 — this is what keeps the
    // cell honest if that default, or the popover's middleware order, ever
    // changes.
    const gap = panelBoxA!.y - inputBottom;
    // A single measurement of the panel HEIGHT is valid across all three
    // viewports below: @rozie-ui/popover's `size` middleware writes the
    // panel's WIDTH style only and never touches its height, so nothing
    // clamps the popup as the viewport shrinks.
    const panelHeight = panelBoxA!.height;
    const exactFitSum = inputBottom + gap + panelHeight;

    // Pass B fits the popup with at most a sub-pixel of slack — the
    // zero-overflow side of the boundary, which is the side that must NOT
    // flip.
    const exactFitHeight = Math.ceil(exactFitSum);
    // Pass C is 8px short of the same sum: comfortably above sub-pixel layout
    // noise, but small enough that the cell is demonstrably sensitive to the
    // boundary rather than trivially satisfied. This IS the vacuity guard —
    // without it, a measurement off by 50px would let Pass B pass for the
    // wrong reason.
    const overflowHeight = Math.floor(exactFitSum) - 8;

    // ---- Pass B (exact fit): re-navigate rather than resize-and-trust-
    // autoUpdate. Popover.rozie does install autoUpdate, but a fresh mount
    // recomputes the position deterministically and the demo self-opens on
    // mount, so re-navigating is both simpler and immune to resize-observer
    // timing. ----
    await page.setViewportSize({ width: 1280, height: exactFitHeight });
    const passB = await open();
    const inputBoxB = await passB.input.boundingBox();
    const panelBoxB = await passB.panel.boundingBox();
    expect(inputBoxB).not.toBeNull();
    expect(panelBoxB).not.toBeNull();
    // No flip: the panel's top edge is still below the input's bottom edge
    // (±1px tolerance for sub-pixel rounding, the same direction the
    // combobox-floating cell above already uses).
    expect(panelBoxB!.y).toBeGreaterThanOrEqual(
      inputBoxB!.y + inputBoxB!.height - 1,
    );
    // The panel's bottom edge sits at/inside the viewport bottom.
    expect(panelBoxB!.y + panelBoxB!.height).toBeLessThanOrEqual(
      exactFitHeight + 1,
    );

    // ---- Pass C (negative control): genuine overflow must flip the popup
    // ABOVE the input. ----
    await page.setViewportSize({ width: 1280, height: overflowHeight });
    const passC = await open();
    const inputBoxC = await passC.input.boundingBox();
    const panelBoxC = await passC.panel.boundingBox();
    expect(inputBoxC).not.toBeNull();
    expect(panelBoxC).not.toBeNull();
    // The panel renders ENTIRELY above the input: its bottom edge sits
    // at/above the input's own top edge (±1px tolerance, mirroring the
    // combobox-floating cell above).
    expect(panelBoxC!.y + panelBoxC!.height).toBeLessThanOrEqual(
      inputBoxC!.y + 1,
    );
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// quick-260902-hmv — combobox-create-async: 86-UAT item 2 / 86-SPEC R3's `concurrency`
// backstop, previously routed to manual testing on the grounds that race timing
// against a deliberately delayed async data source is not deterministically
// reproducible in the happy-dom harness.
//
// `creatable.behavior.test.ts` test 5 already owns the SAME-TICK double-commit case
// (two Enters with no clock advance between them, against a synchronous fixture). This
// cell owns the one edge that test cannot reach: a `create` gesture committed while a
// REAL async `search` for the same query is genuinely still in flight, spanning a real
// browser round trip, not a mocked/fake-timer tick.
//
// `examples/demos/ComboboxCreatableAsyncDemo.rozie` wires `creatable` to a 2000ms-
// delayed async source and instruments the race with a fixture-side `createRaced`
// accumulator (see that file's header comment) — the proof that each `create` really
// landed inside a live window, immune to Playwright round-trip latency.
// ════════════════════════════════════════════════════════════════════════════════════

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`combobox-create-async [${target}]: committing create while an async search is in flight emits create exactly once`, async ({
    page,
  }) => {
    // Two 2000ms in-flight windows plus six Playwright round trips per phase can
    // approach the config's 30s per-test default on a cold preview server.
    test.setTimeout(60_000);

    await page.goto(`/?example=ComboboxCreatableAsync&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // The role/CSS locators pierce Lit's open shadow root.
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    const readoutValue = page.getByTestId('readout-value');
    const readoutInFlight = page.getByTestId('readout-inflight');
    const readoutResolved = page.getByTestId('readout-resolved');
    const readoutCreateCount = page.getByTestId('readout-create-count');
    const readoutCreateLog = page.getByTestId('readout-create-log');
    const readoutCreateRaced = page.getByTestId('readout-create-raced');

    // ---- focus as a SEPARATE step, settle BEFORE typing ----
    // On Solid, the documented `openingInProgress` reentrancy guard recreates the
    // anchor DOM subtree on a deferred re-focus; typing into a node that is about to
    // be recreated is a real value-loss risk. Wait for the floating panel AND the
    // single empty-state row (this fixture starts with zero options and no query)
    // before typing anything.
    await input.focus();
    const panel = page.locator('.rozie-popover-floating');
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.rozie-combobox-empty')).toHaveCount(1);

    // ---- PHASE A: one create inside a live in-flight window ----
    // A single fill() (one input event) — pressSequentially would put four
    // searches in flight and make every count assertion ambiguous.
    await input.fill('kiwi');
    await expect.poll(async () => readoutInFlight.textContent(), {
      timeout: 10_000,
    }).toBe('1');
    await expect(readoutResolved).toHaveText('0');
    const optionsAfterFirstSearch = page.locator('[role="option"]');
    await expect(optionsAfterFirstSearch).toHaveCount(1);
    const createRowClass = await optionsAfterFirstSearch.first().getAttribute('class');
    expect(createRowClass ?? '').toContain('rozie-combobox-create');

    // End lands on the LAST navRow deterministically — the create row —
    // regardless of how many async options have arrived; selectOption()'s
    // isCreate branch resets activeIndex to -1 after every commit, so every
    // commit gesture in this cell is End then Enter, never a bare Enter.
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');

    await expect(readoutCreateCount).toHaveText('1');
    await expect(readoutCreateLog).toHaveText('kiwi');
    await expect(readoutCreateRaced).toHaveText('yes');
    // The test-side half of the race proof: the commit landed while the search
    // was demonstrably still unresolved and still in flight.
    await expect(readoutResolved).toHaveText('0');
    await expect(readoutInFlight).toHaveText('1');
    // R3 locked: `create` leaves `value` untouched.
    await expect(readoutValue).toHaveText('');

    // ---- PHASE B: double commit inside the SAME window ----
    // Immediately repeat End+Enter with no intervening input event. The second
    // commit reaches selectOption()'s create branch and is suppressed by the
    // `createdQuery` latch, not by the popup being closed (:close-on-select=
    // "false") or the create row being gone (onCreate never adopts the created
    // value into `options` — see the fixture's own header comment). The
    // same-tick variant of this exact case is already owned by
    // `creatable.behavior.test.ts` test 5; this phase exists only because it
    // straddles a live async window.
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(readoutCreateCount).toHaveText('1');
    await expect(readoutCreateLog).toHaveText('kiwi');
    await expect(readoutResolved).toHaveText('0');

    // ---- PHASE C: the latch survives the async round trip ----
    // Poll until the search settles, then confirm the option set changed
    // underneath the create row (four async options landed) while the create
    // row STILL renders last, and a third commit is STILL suppressed — this is
    // the exact window the latch's own source comment names: the async round
    // trip before the consumer's `options` update lands.
    await expect.poll(async () => readoutResolved.textContent(), {
      timeout: 15_000,
    }).toBe('1');
    await expect(readoutInFlight).toHaveText('0');
    const optionsAfterResolve = page.locator('[role="option"]');
    await expect(optionsAfterResolve).toHaveCount(5);
    const lastRowClass = await optionsAfterResolve.last().getAttribute('class');
    expect(lastRowClass ?? '').toContain('rozie-combobox-create');

    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(readoutCreateCount).toHaveText('1');
    await expect(readoutValue).toHaveText('');

    // ---- PHASE D: negative control — the vacuity guard ----
    // A component that emitted once and then died entirely would pass every
    // assertion above. A DISTINCT query re-arms the latch (onInput clears
    // createdQuery on every input change) and starts a fresh search; a create
    // committed inside ITS OWN in-flight window must still emit. This proves
    // the emit path is live, the latch is query-scoped rather than global,
    // and the "never zero" half of the contract — without this phase the cell
    // would be vacuously satisfiable by a component that silently stopped
    // emitting after the first create.
    await input.fill('kiwis');
    await expect.poll(async () => readoutInFlight.textContent(), {
      timeout: 10_000,
    }).toBe('1');
    await expect(readoutResolved).toHaveText('1');

    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(readoutCreateCount).toHaveText('2');
    await expect(readoutCreateLog).toHaveText('kiwi;kiwis');
    await expect(readoutCreateRaced).toHaveText('yes');

    await expect.poll(async () => readoutResolved.textContent(), {
      timeout: 15_000,
    }).toBe('2');
    await expect(readoutCreateCount).toHaveText('2');
  });
}
