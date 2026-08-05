import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * `r-keynav` GRID focus-model + multi-group six-target DOM-driven behavior
 * spec (Phase 77 Plan 06, SPEC §4, §4.1, §4.2, §4.3, §5, §6, §9.2, §9.3,
 * §10). Modeled EXACTLY on `keynav-behavior.spec.ts` (Phase 71): a per-target
 * build-availability gate (`test.fixme` when the target sub-build is
 * absent), DOM-driven assertions only (NO `toHaveScreenshot` — pixel
 * coverage for these same two demos lives separately in `matrix.spec.ts`),
 * Angular included in TARGETS as a first-class real-DOM gate. This file does
 * NOT modify `keynav-behavior.spec.ts` — a separate spec for a separate
 * primitive surface (the Phase-71 1D file stays untouched and green).
 *
 * Two fresh demos exercise the grid key map, the paging/focus-after-render
 * seam, reactive columns and multi-group containment — no existing
 * `@rozie-ui/*` family is touched (the scope fence):
 *
 *   - 'KeynavGrid' (examples/demos/KeynavGridDemo.rozie) — a calendar-shaped
 *     7-column grid. Page 0/2 are FULL (35 cells), page 1 is deliberately
 *     RAGGED (24 cells). Every column-0/column-6 cell is `disabled`
 *     (inert-by-default, SPEC §5) — the DEFAULT mount lands active on a
 *     disabled cell, itself a live proof that arrows/focus land on disabled
 *     cells without landmine.
 *
 *   - 'KeynavMultiGroup' (examples/demos/KeynavMultiGroupDemo.rozie) — ONE
 *     component, TWO SIBLING `r-keynav` roots (a 1D list + a `.grid(3)`),
 *     proving containment scoping and fully independent per-root state.
 *
 * Assertions read the compiler's own canonical hooks —
 * `[data-rozie-keynav-item]` (the index marker) and
 * `[data-rozie-keynav-active]` (the always-present active hook) — plus the
 * demos' stable `data-testid` readouts, never a per-target class name or DOM
 * structure, mirroring `keynav-behavior.spec.ts`'s discipline.
 *
 * PER-TARGET focused-item READ (paging/seam tests only): mirrors
 * `date-picker-keyboard.spec.ts`'s `activeElementInfo` — recurses through
 * any nested shadow root (Lit's `document.activeElement` returns the HOST
 * element, not the focused cell inside its shadow root) since the landing
 * cell renders AFTER a same-tick dataset-swap-plus-active-set, so a
 * one-shot read can race the re-render; `expect.poll` retries until the
 * post-render focus settles.
 *
 * If this spec is red, the regression is in the runtime controller (the
 * grid branch of `createKeynavStateMachine`, 77-01) or a per-target
 * emitter/controller (77-03..77-05) — the exact real-DOM gap that let a
 * prior Solid class bug hide behind IR-snapshot-only tests
 * (feedback_orchestrator_validates_tests).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

/**
 * Reads the currently-focused item's `data-rozie-keynav-item` index,
 * recursing into nested shadow roots (Lit hosts the grid in its own shadow
 * root; `document.activeElement` there is the HOST element, not the cell).
 */
async function focusedItemIndex(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const descend = (root: Document | ShadowRoot): Element | null => {
      const active = root.activeElement;
      if (!active) return null;
      const sr = (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (sr) {
        const inner = descend(sr);
        if (inner) return inner;
      }
      return active;
    };
    const active = descend(document);
    return active ? active.getAttribute('data-rozie-keynav-item') : null;
  });
}

for (const target of TARGETS) {
  // Build-availability gate — copied from keynav-behavior.spec.ts /
  // context-behavior.spec.ts. Angular is a first-class gate here too: when
  // its analogjs sub-build is present, it runs as a real `test`.
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = built ? test : test.fixme;

  // ---------------------------------------------------------------------
  // Grid key map: horizontal continuity across a row end, vertical stride
  // by the column count, row-wise Home/End, whole-grid Ctrl+Home/End,
  // inert-by-default disabled cells (SPEC §4, §5).
  // ---------------------------------------------------------------------
  runner(`keynav-grid-behavior [${target}]: grid key map (continuity, stride, row Home/End, Ctrl+Home/End, inert disabled)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=KeynavGrid&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const items = mount.locator('[data-rozie-keynav-item]');
    await expect(items).toHaveCount(35, { timeout: 10_000 });
    const activeItem = () => mount.locator('[data-rozie-keynav-active]');
    const readoutCommitted = mount.getByTestId('readout-committed');

    // Item 0 (row 0, col 0) is active AND disabled on mount (the calendar
    // "weekend" column pattern) — focusable-but-inert (SPEC §5).
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '0', {
      timeout: 10_000,
    });
    await activeItem().focus();
    await expect(activeItem()).toBeFocused();
    await expect(activeItem()).toHaveAttribute('aria-disabled', 'true');

    // Enter on the disabled active cell never commits.
    await expect(readoutCommitted).toHaveText('');
    await page.keyboard.press('Enter');
    await expect(readoutCommitted).toHaveText('');

    // ---- row-wise End lands on the last cell of row 0 (disabled) ----
    await page.keyboard.press('End');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '6');
    await expect(activeItem()).toHaveAttribute('aria-disabled', 'true');

    // ---- horizontal continuity: ArrowRight FLOWS ACROSS the row end ----
    await page.keyboard.press('ArrowRight');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '7');

    // ---- vertical stride by the column count (7) ----
    await page.keyboard.press('ArrowDown');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '14');

    // ---- row-wise Home/End from mid-row ----
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '16');
    await page.keyboard.press('Home');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '14');
    await page.keyboard.press('End');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '20');

    // ---- whole-grid Ctrl+Home / Ctrl+End ----
    await page.keyboard.press('Control+Home');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '0');
    await page.keyboard.press('Control+End');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '34');
    await expect(activeItem()).toHaveAttribute('aria-disabled', 'true');

    // ---- inert disabled: a subsequent Enter on an ENABLED cell commits ----
    await page.keyboard.press('ArrowLeft');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '33');
    await expect(activeItem()).toHaveAttribute('aria-disabled', 'false');
    await page.keyboard.press('Enter');
    await expect(readoutCommitted).toHaveText('34');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // Ragged last row (SPEC §4.3): End on the last (partial) row resolves to
  // the last EXISTING cell; an arrow past a ragged row's missing trailing
  // cell pages instead of moving.
  // ---------------------------------------------------------------------
  runner(`keynav-grid-behavior [${target}]: ragged last row (End resolves to the last existing cell, arrow past it pages)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=KeynavGrid&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const items = mount.locator('[data-rozie-keynav-item]');
    await expect(items).toHaveCount(35, { timeout: 10_000 });
    const activeItem = () => mount.locator('[data-rozie-keynav-active]');
    const readoutPage = mount.getByTestId('readout-page');
    const readoutReason = mount.getByTestId('readout-reason');

    await activeItem().focus();

    // PageDown pages the dataset unconditionally (SPEC §4) — no need to be
    // at an edge. Page 1 is the deliberately RAGGED page (24 cells).
    await page.keyboard.press('PageDown');
    await expect(readoutPage).toHaveText('1');
    await expect(readoutReason).toHaveText('pagedown');
    await expect(items).toHaveCount(24, { timeout: 10_000 });

    // Ctrl+End always resolves to count - 1, ragged or not.
    await page.keyboard.press('Control+End');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '23');
    await expect(activeItem()).toHaveAttribute('aria-disabled', 'false');

    // Row-wise Home lands on the ragged last row's first (disabled) cell.
    await page.keyboard.press('Home');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '21');
    await expect(activeItem()).toHaveAttribute('aria-disabled', 'true');

    // Row-wise End resolves to the last EXISTING cell (23), never the
    // theoretical row-end (27) that doesn't exist on the ragged row.
    await page.keyboard.press('End');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '23');

    // Move into the second-to-last (FULL) row at a column whose vertical
    // stride overflows the ragged trailing row (col 3 -> would-be index 24,
    // past the 24-cell total) — this must PAGE, not move.
    await page.keyboard.press('ArrowUp');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '16');
    await page.keyboard.press('ArrowRight');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '17');
    await page.keyboard.press('ArrowDown');
    await expect(readoutPage).toHaveText('2');
    await expect(readoutReason).toHaveText('boundary');
    await expect(items).toHaveCount(35, { timeout: 10_000 });
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '0');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // Paging / focus-after-render seam (SPEC §4.1) — the highest-risk case:
  // the demo's own page handler advances the dataset AND sets the active
  // index in the SAME tick; DOM focus must land on the POST-render cell.
  // ---------------------------------------------------------------------
  runner(`keynav-grid-behavior [${target}]: paging / focus-after-render seam (boundary forward/backward, PageUp/PageDown)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=KeynavGrid&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(mount.locator('[data-rozie-keynav-item]')).toHaveCount(35, {
      timeout: 10_000,
    });

    const activeItem = () => mount.locator('[data-rozie-keynav-active]');
    const readoutPage = mount.getByTestId('readout-page');
    const readoutReason = mount.getByTestId('readout-reason');

    await activeItem().focus();
    await page.keyboard.press('Control+End');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '34');

    // ---- forward boundary: last cell -> next page, lands at index 0 ----
    await page.keyboard.press('ArrowRight');
    await expect(readoutPage).toHaveText('1');
    await expect(readoutReason).toHaveText('boundary');
    // The landing cell renders AFTER the page-1 (ragged) dataset swap —
    // poll for real DOM focus rather than a one-shot read.
    await expect
      .poll(() => focusedItemIndex(page), { timeout: 10_000 })
      .toBe('0');

    // ---- backward boundary (the mirror case): index 0 -> previous page,
    //      lands at the new page's LAST cell ----
    await page.keyboard.press('ArrowLeft');
    await expect(readoutPage).toHaveText('0');
    await expect(readoutReason).toHaveText('boundary');
    await expect
      .poll(() => focusedItemIndex(page), { timeout: 10_000 })
      .toBe('34');

    // ---- PageUp/PageDown: page the dataset and set the page-reason
    //      readout WITHOUT the machine having moved active on its own
    //      (the machine only ever calls host.page(), never host.setActive(),
    //      on any page/boundary key — SPEC §4.1) ----
    await page.keyboard.press('PageDown');
    await expect(readoutPage).toHaveText('1');
    await expect(readoutReason).toHaveText('pagedown');

    await page.keyboard.press('PageUp');
    await expect(readoutPage).toHaveText('0');
    await expect(readoutReason).toHaveText('pageup');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // Terminal-page boundary clamp (SPEC §4.1 clamp-equivalent default; Dan's
  // explicit decision 2026-08-05: "Clamp — no move"). A boundary event that
  // fires at a TERMINAL page (the last page going forward, the first page
  // going backward) must NOT wrap active to the opposite edge of the SAME
  // page — there is no next/previous page to land on, so the correct
  // behavior is a full no-op, matching the ARIA grid pattern (arrow at a
  // bounded grid's edge does nothing). RED before the 77-09 fix: a terminal
  // boundary event silently looped active back to the opposite edge of the
  // page it was already on.
  // ---------------------------------------------------------------------
  runner(`keynav-grid-behavior [${target}]: terminal-page boundary clamp (no in-page wrap when a page/boundary event changes nothing)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=KeynavGrid&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(mount.locator('[data-rozie-keynav-item]')).toHaveCount(35, {
      timeout: 10_000,
    });

    const activeItem = () => mount.locator('[data-rozie-keynav-active]');
    const readoutPage = mount.getByTestId('readout-page');
    const readoutReason = mount.getByTestId('readout-reason');

    await activeItem().focus();

    // ---- FIRST page (0), backward boundary: ArrowLeft at index 0 must
    //      CLAMP (stay at index 0), not wrap to the opposite (last) edge ----
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '0');
    await page.keyboard.press('ArrowLeft');
    await expect(readoutPage).toHaveText('0');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '0');
    // A genuine full no-op — the reason readout (never yet written) proves
    // onPage's early return never even reached `$data.pageReason`.
    await expect(readoutReason).toHaveText('');

    // ---- same page, backward COLUMN-axis boundary: ArrowUp at row 0 must
    //      also clamp, not wrap to the last row ----
    await page.keyboard.press('ArrowUp');
    await expect(readoutPage).toHaveText('0');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '0');
    await expect(readoutReason).toHaveText('');

    // ---- navigate all the way to the LAST page (2) ----
    await page.keyboard.press('Control+End');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '34');
    await page.keyboard.press('ArrowRight'); // page 0 -> 1 (ragged, 24 cells)
    await expect(readoutPage).toHaveText('1');
    await expect
      .poll(() => focusedItemIndex(page), { timeout: 10_000 })
      .toBe('0');
    await page.keyboard.press('Control+End');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '23');
    await page.keyboard.press('ArrowRight'); // page 1 -> 2 (full, 35 cells)
    await expect(readoutPage).toHaveText('2');
    await expect
      .poll(() => focusedItemIndex(page), { timeout: 10_000 })
      .toBe('0');
    await page.keyboard.press('Control+End');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '34');

    // ---- LAST page (2), forward boundary: ArrowRight at the last cell must
    //      CLAMP (stay at index 34), not wrap to the opposite (first) edge ----
    await page.keyboard.press('ArrowRight');
    await expect(readoutPage).toHaveText('2');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '34');

    // ---- same page, forward COLUMN-axis boundary: ArrowDown at the last
    //      row must also clamp, not wrap to the first row ----
    await page.keyboard.press('ArrowDown');
    await expect(readoutPage).toHaveText('2');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '34');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // Reactive columns (SPEC §10): toggling the column count changes the
  // vertical arrow stride at runtime — no re-instantiation required.
  // ---------------------------------------------------------------------
  runner(`keynav-grid-behavior [${target}]: reactive columns (toggling the column count changes the vertical stride)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=KeynavGrid&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    await expect(mount.locator('[data-rozie-keynav-item]')).toHaveCount(35, {
      timeout: 10_000,
    });

    const activeItem = () => mount.locator('[data-rozie-keynav-active]');
    const readoutCols = mount.getByTestId('readout-cols');

    await expect(readoutCols).toHaveText('7');
    await activeItem().focus();
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '0');

    await mount.getByTestId('control-toggle-cols').click();
    await expect(readoutCols).toHaveText('5');

    // Re-focus (the toggle button click may have moved DOM focus off the
    // grid) then verify the stride is now 5, not 7.
    await activeItem().focus();
    await page.keyboard.press('ArrowDown');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '5');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // Multi-group (SPEC §6, §9.3): two sibling roots keep fully independent
  // active-index/commit state.
  // ---------------------------------------------------------------------
  runner(`keynav-grid-behavior [${target}]: multi-group (independent per-root active index and commit)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=KeynavMultiGroup&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const rootA = mount.getByTestId('root-a-container');
    const rootB = mount.getByTestId('root-b-container');
    const itemsA = rootA.locator('[data-rozie-keynav-item]');
    const itemsB = rootB.locator('[data-rozie-keynav-item]');
    await expect(itemsA).toHaveCount(4, { timeout: 10_000 });
    await expect(itemsB).toHaveCount(6, { timeout: 10_000 });

    const activeA = () => rootA.locator('[data-rozie-keynav-active]');
    const activeB = () => rootB.locator('[data-rozie-keynav-active]');
    const readoutA = mount.getByTestId('readout-committed-a');
    const readoutB = mount.getByTestId('readout-committed-b');

    await expect(activeA()).toHaveAttribute('data-rozie-keynav-item', '0', {
      timeout: 10_000,
    });
    await expect(activeB()).toHaveAttribute('data-rozie-keynav-item', '0', {
      timeout: 10_000,
    });

    // Moving in root A does not move root B's active marker.
    await activeA().focus();
    await page.keyboard.press('ArrowDown');
    await expect(activeA()).toHaveAttribute('data-rozie-keynav-item', '1');
    await expect(activeB()).toHaveAttribute('data-rozie-keynav-item', '0');

    // Moving in root B does not move root A's active marker.
    await activeB().focus();
    await page.keyboard.press('ArrowRight');
    await expect(activeB()).toHaveAttribute('data-rozie-keynav-item', '1');
    await expect(activeA()).toHaveAttribute('data-rozie-keynav-item', '1');

    // Both roots' active markers are non-zero simultaneously.
    await expect(activeA()).not.toHaveAttribute('data-rozie-keynav-item', '0');
    await expect(activeB()).not.toHaveAttribute('data-rozie-keynav-item', '0');

    // Committing in root A writes ONLY root A's readout.
    await expect(readoutA).toHaveText('');
    await expect(readoutB).toHaveText('');
    await activeA().focus();
    await page.keyboard.press('Enter');
    await expect(readoutA).toHaveText('Green');
    await expect(readoutB).toHaveText('');

    // Committing in root B writes ONLY root B's readout.
    await activeB().focus();
    await page.keyboard.press('Enter');
    await expect(readoutB).toHaveText('2');
    await expect(readoutA).toHaveText('Green');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });
}
