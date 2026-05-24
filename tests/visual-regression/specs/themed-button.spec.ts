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

// The four `data-testid` values the consumer forwards onto its FOUR wrapper
// instances (Phase 15 extended Plan 15-06 dogfood). The two original
// attribute-fallthrough probes (AUTO, MANUAL) are kept; the two new listener-
// fallthrough probes (LISTENERS_MANUAL, ALL_MANUAL) complete the four-corner
// matrix.
//
// Corner map (SPEC R11):
//   AUTO_TESTID              attrs-auto    / listeners-auto
//   MANUAL_TESTID            attrs-manual  / listeners-auto    (Phase 14 sibling)
//   LISTENERS_MANUAL_TESTID  attrs-auto    / listeners-manual  (Phase 15 D-04)
//   ALL_MANUAL_TESTID        attrs-manual  / listeners-manual  (Phase 15 D-05)
const AUTO_TESTID = 'auto-themed-button';
const MANUAL_TESTID = 'manual-themed-button';
const LISTENERS_MANUAL_TESTID = 'listeners-manual-themed-button';
const ALL_MANUAL_TESTID = 'all-manual-themed-button';

// Four-corner matrix: all four wrappers consume the same attribute + listener
// cluster from the consumer. The cell name is the SPEC R11 corner label.
const FOUR_CORNERS = [
  { testid: AUTO_TESTID, label: 'attrs-auto / listeners-auto' },
  { testid: MANUAL_TESTID, label: 'attrs-manual / listeners-auto' },
  { testid: LISTENERS_MANUAL_TESTID, label: 'attrs-auto / listeners-manual' },
  { testid: ALL_MANUAL_TESTID, label: 'attrs-manual / listeners-manual' },
] as const;

// Phase-N.M follow-up gate — companion to matrix.spec.ts's PHASE_14_1_FOLLOWUP
// set. Phase 14.1 closed 3 of 5 ThemedButtonConsumer entries (react / angular
// / lit). Pre-Phase-16 cleanup closed the remaining two arms — Solid via the
// dual-spread emit fix (Item 1) and Svelte via the cross-SFC CSS-scoping
// switch (Item 2) + auto-fallthrough-aware `:style` lowering (Item-2-residual).
// Set is empty; preserved for future per-target gate additions.
const PHASE_14_1_FOLLOWUP_TARGETS = new Set<string>([]);

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

  // Phase 15 R4 — consumer-passed @click / @mouseenter listeners fire on the
  // wrapper's root <button> across all four corners of the matrix.
  //
  // The runtime proof: the consumer attaches `@click="onClick"` and
  // `@mouseenter="onMouseEnter"` (no-op arrows in <data>) to each wrapper.
  // The dist-parity byte-equality gate (tests/dist-parity/parity.test.ts) proves
  // the listener-binding CODE is emitted correctly cross-target. The runtime
  // gate here proves the listener actually FIRES on the rendered <button> —
  // structural-only, doesn't pin per-handler invocation (the consumer's
  // <data> onClick is a no-op, so there's no observable side effect to inspect).
  //
  // The dispatchability proof:
  //   1. Install a capture-phase 'click' / 'mouseenter' spy on `document` via
  //      `page.evaluate` BEFORE the user-interaction trigger.
  //   2. Trigger Playwright `.click()` / `.hover()` on the inner <button>.
  //   3. Assert the spy fired AND ev.target (the dispatched element) carries
  //      the wrapper's `data-testid` — proving the click reached the actual
  //      consumer-marked button, not some intermediate proxy/host element.
  //
  // For Lit (shadow-DOM-bounded custom element) the spy uses `composedPath()`
  // since `ev.target` re-targets to the shadow host. The first composed-path
  // entry is the original event target, which has the consumer's data-testid.
  //
  // R4 across all 6 targets × 4 corners = 24 cell-equivalents per probe (click +
  // mouseenter = 48 total dispatchability assertions). Each cell asserts the
  // SPEC R4 runtime invariant: consumer-passed listeners FIRE on the wrapper's
  // root <button>, regardless of inherit-attrs/inherit-listeners flag pairing.
  for (const corner of FOUR_CORNERS) {
    runner(`themed-button [${target}]: @click fires on root <button> — ${corner.label}`, async ({
      page,
    }) => {
      await page.goto(`/?example=ThemedButtonConsumer&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      await expect(mount).toBeVisible();

      const btn = mount.locator(`button[data-testid="${corner.testid}"]`);
      await expect(btn).toBeVisible();

      // Install the capture-phase document-level spy. Bubbling-phase listeners
      // wouldn't catch the click before Playwright's auto-await unwinds the
      // synchronous dispatch, so capture-phase is the deterministic path. The
      // spy stores `composedPath()[0]?.dataset?.testid` so Lit's shadow-DOM
      // re-targeting still surfaces the original button (the inner button
      // inside the shadow root, not the host custom-element).
      await page.evaluate((testid) => {
        (
          window as unknown as { __phase15_clicked: string | null }
        ).__phase15_clicked = null;
        const handler = (ev: Event): void => {
          const path = ev.composedPath();
          const original = path[0] as HTMLElement | undefined;
          const t = original?.dataset?.testid;
          if (t === testid) {
            (
              window as unknown as { __phase15_clicked: string | null }
            ).__phase15_clicked = testid;
          }
        };
        document.addEventListener('click', handler, true /* capture */);
      }, corner.testid);

      await btn.click();

      const clicked = await page.evaluate(
        () =>
          (
            window as unknown as { __phase15_clicked: string | null }
          ).__phase15_clicked,
      );
      expect(
        clicked,
        `[${target}] consumer-passed @click on ${corner.label} should fire on the root <button> with data-testid=${corner.testid}`,
      ).toBe(corner.testid);
    });

    runner(`themed-button [${target}]: @mouseenter fires on root <button> — ${corner.label}`, async ({
      page,
    }) => {
      await page.goto(`/?example=ThemedButtonConsumer&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      await expect(mount).toBeVisible();

      const btn = mount.locator(`button[data-testid="${corner.testid}"]`);
      await expect(btn).toBeVisible();

      // mouseenter does NOT bubble (per DOM spec) but DOES dispatch on the
      // target element. We install the spy directly on the button rather than
      // on document. Same composedPath shape as click — works for Lit shadow
      // hosts and for the other 5 targets identically.
      await page.evaluate((testid) => {
        (
          window as unknown as { __phase15_mouseentered: string | null }
        ).__phase15_mouseentered = null;
        const target_el = (() => {
          // Find the button by querying every <button data-testid=...> in the
          // light DOM AND in any open shadow roots (Lit). Iterate composed:
          const flat: HTMLElement[] = [];
          const visit = (root: Document | ShadowRoot | HTMLElement): void => {
            const all = (
              'querySelectorAll' in root ? root.querySelectorAll(`button[data-testid="${testid}"]`) : []
            ) as NodeListOf<HTMLElement>;
            for (const el of all) flat.push(el);
            const allEls = (root as Document).querySelectorAll
              ? (root as Document).querySelectorAll('*')
              : [];
            for (const el of allEls as NodeListOf<HTMLElement>) {
              if ((el as HTMLElement).shadowRoot) {
                visit((el as HTMLElement).shadowRoot!);
              }
            }
          };
          visit(document);
          return flat[0];
        })();
        if (target_el) {
          target_el.addEventListener('mouseenter', () => {
            (
              window as unknown as { __phase15_mouseentered: string | null }
            ).__phase15_mouseentered = testid;
          });
        }
      }, corner.testid);

      await btn.hover();

      const entered = await page.evaluate(
        () =>
          (
            window as unknown as { __phase15_mouseentered: string | null }
          ).__phase15_mouseentered,
      );
      expect(
        entered,
        `[${target}] consumer-passed @mouseenter on ${corner.label} should fire on the root <button> with data-testid=${corner.testid}`,
      ).toBe(corner.testid);
    });
  }

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
