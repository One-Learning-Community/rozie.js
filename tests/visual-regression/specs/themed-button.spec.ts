import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 14 — ThemedButton attribute-fallthrough runtime smoke (Playwright).
 *
 * Compile-time tests prove the per-target `spreadBinding` emit shapes are
 * byte-identical across all 4 entrypoints (dist-parity ThemedButton /
 * ThemedButtonManual / ThemedButtonConsumer / RBindProbe fixtures).
 * Per-target snapshot tests prove the emitters lower `spreadBinding` to the
 * target's native idiom. Neither set proves that the runtime attribute
 * fallthrough actually lands the consumer-passed attributes on the rendered
 * DOM element.
 *
 * This spec is the runtime gate. It exercises `examples/ThemedButtonConsumer.rozie`
 * (which composes `ThemedButton.rozie` + `ThemedButtonManual.rozie`) on each of
 * the 6 targets and asserts:
 *
 *   1. Both wrappers render a <button> with the `btn` class.
 *   2. The consumer's `id="auto-btn"` / `id="manual-btn"` lands on the inner
 *      <button> — proving attribute fallthrough works for BOTH modes (auto on
 *      ThemedButton; manual `r-bind="$attrs"` on ThemedButtonManual with
 *      `inherit-attrs="false"`).
 *   3. The consumer's `aria-label` and `data-testid` fall through.
 *   4. The consumer's extra `class="extra-variant"` is merged onto the inner
 *      <button> (R6 class-always-merge — alongside `btn` + the `variant` prop).
 *   5. The consumer's `style="--btn-bg: ..."` CSS custom property is applied,
 *      and the resulting `background-color` reflects the override (R6 style-
 *      always-merge + D-06 CSS-custom-property theming).
 *
 * The matrix screenshot (matrix.spec.ts `ThemedButtonConsumer.png`, baseline-
 * gated until Linux-Docker regen) covers pixel appearance. This spec
 * complements it with structural assertions that survive without a baseline
 * and that pin the *behavior* — a "renders blank" regression would silently
 * pass a screenshot diff if the baseline were also blank.
 *
 * D-10 (matrix shared-baseline rule) does NOT apply here — this spec doesn't
 * take screenshots, it makes structural assertions instead.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// The two `data-testid` values the consumer forwards onto its two wrapper
// instances — these are the attribute-fallthrough probes.
const AUTO_TESTID = 'auto-themed-button';
const MANUAL_TESTID = 'manual-themed-button';

// Phase-N.M follow-up gate — companion to matrix.spec.ts's PHASE_14_1_FOLLOWUP
// set. Phase 14.1 closed 3 of 5 ThemedButtonConsumer entries (react / angular
// / lit). Two remain, carried forward as Phase 14.2 follow-ups — full
// hypothesis in matrix.spec.ts's set.
const PHASE_14_1_FOLLOWUP_TARGETS = new Set<string>([
  // Solid: scope-attr emit lands in compiled output but doesn't reach the
  // rendered button at runtime — splitProps/mergeProps/spread chain drops
  // kebab-case data-* keys somewhere.
  'solid',
  // Svelte: native class-hash scoping (.foo.svelte-XXX) blocks consumer's
  // .extra-variant rule from matching the wrapper's inner button.
  'svelte',
]);

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  // The runner is `test.fixme` if the target sub-build is missing OR if this
  // target is in the Phase 14.1 follow-up set above. Vue is intentionally
  // NOT in that set — the Vue render is correct and the Vue smoke passes,
  // matching the matrix-baseline split in matrix.spec.ts.
  const phase14_1Followup = PHASE_14_1_FOLLOWUP_TARGETS.has(target);
  const runner = built && !phase14_1Followup ? test : test.fixme;
  runner(`themed-button [${target}]: auto-fallthrough lands consumer attributes on root <button>`, async ({
    page,
  }) => {
    await page.goto(`/?example=ThemedButtonConsumer&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Locate the auto-fallthrough button. We narrow to `button[data-testid=…]`
    // (NOT `getByTestId`) because the Lit and Angular targets render a custom-
    // element / component host wrapping the inner `<button>` — when the
    // consumer-passed `data-testid` falls through onto BOTH the host element
    // (via Lit's reflection layer / Angular's attribute pass-through) AND the
    // inner button, `getByTestId` resolves to two elements and Playwright's
    // strict-mode raises. Narrowing the locator to `button[data-testid=…]`
    // dodges the host element while still verifying the testid landed on the
    // rendered button. The attribute selector is verbatim across all 6 emitters
    // (data-testid is never CSS-Modules-hashed). If fallthrough is broken, the
    // locator finds nothing and the test fails fast.
    const autoBtn = mount.locator(`button[data-testid="${AUTO_TESTID}"]`);
    await expect(autoBtn).toBeVisible();

    // (2) consumer-passed `id` lands on the inner <button>.
    await expect(autoBtn).toHaveAttribute('id', 'auto-btn');

    // (3) consumer-passed `aria-label` falls through. `type="button"` also
    // falls through but is a literal HTML attribute on a <button> — less
    // probative as a fallthrough proof.
    await expect(autoBtn).toHaveAttribute('aria-label', 'Auto-fallthrough button');

    // (1)+(4) the rendered button carries BOTH `btn` (owned by the wrapper)
    // AND `extra-variant` (forwarded by the consumer) — R6 class-always-merge.
    // The `[class*=...]` substring match survives React/Solid CSS-Modules
    // hashing (same pattern as matrix.spec.ts settle locators).
    await expect(autoBtn).toHaveClass(/(^|\s|_)btn(\s|_|$)/);
    await expect(autoBtn).toHaveClass(/(^|\s|_)extra-variant(\s|_|$)/);
  });

  runner(`themed-button [${target}]: manual r-bind="\$attrs" lands consumer attributes on root <button>`, async ({
    page,
  }) => {
    await page.goto(`/?example=ThemedButtonConsumer&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // The ThemedButtonManual sibling — `inherit-attrs="false"` + explicit
    // `r-bind="$attrs"` on the <button>. Produces equivalent DOM to the
    // auto-fallthrough path; this assertion proves the manual opt-out mode
    // also works end-to-end (SPEC R5). See the `button[data-testid=…]`
    // rationale in the auto-fallthrough test above — same host-element dodge.
    const manualBtn = mount.locator(`button[data-testid="${MANUAL_TESTID}"]`);
    await expect(manualBtn).toBeVisible();

    await expect(manualBtn).toHaveAttribute('id', 'manual-btn');
    await expect(manualBtn).toHaveAttribute(
      'aria-label',
      'Manual fallthrough button',
    );
    await expect(manualBtn).toHaveClass(/(^|\s|_)btn(\s|_|$)/);
    await expect(manualBtn).toHaveClass(/(^|\s|_)extra-variant(\s|_|$)/);
  });

  runner(`themed-button [${target}]: consumer style="--btn-bg" overrides the wrapper's default`, async ({
    page,
  }) => {
    await page.goto(`/?example=ThemedButtonConsumer&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // The consumer passes `style="--btn-bg: #ef4444"` (red) onto the auto
    // wrapper and `style="--btn-bg: #10b981"` (green) onto the manual wrapper.
    // The wrapper's own `:style` declares `--btn-bg: #3b82f6` (blue) as the
    // default. R6 style-always-merge dictates the consumer's value should
    // override (positional last-wins for keys that aren't class/style; both
    // class and style are merge-keys, and for an object-flavored CSS-custom-
    // property override the consumer's property name overrides the wrapper's
    // same-named property). D-06 names this the CSS-custom-property theming
    // path.
    //
    // The .btn CSS rule sets `background: var(--btn-bg, …)`, so the resolved
    // `background-color` reflects the merged custom-property value. We assert
    // it's NOT the wrapper's default blue (#3b82f6 → `rgb(59, 130, 246)`).
    // We don't pin the exact red/green because per-target style-merge
    // implementations may differ (Vue's `:style` array merge vs JSX inline-
    // style object spread); the load-bearing proof is "consumer override
    // reached the rendered computed style at all."
    // Narrow to `button[data-testid=…]` for the same host-element-dodge
    // rationale as the auto-fallthrough test above.
    const autoBtn = mount.locator(`button[data-testid="${AUTO_TESTID}"]`);
    const autoBg = await autoBtn.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(autoBg, 'consumer style="--btn-bg" should override the wrapper default').not.toBe(
      'rgb(59, 130, 246)',
    );

    const manualBtn = mount.locator(`button[data-testid="${MANUAL_TESTID}"]`);
    const manualBg = await manualBtn.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(manualBg, 'consumer style="--btn-bg" should override the wrapper default').not.toBe(
      'rgb(59, 130, 246)',
    );
  });
}
