import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 49 LOCKED GATE — the grid interaction mode (WAI-ARIA role=grid) behavioral
 * matrix. Drives `examples/demos/DataTableGridNavDemo.rozie` (navigated
 * `?example=DataTableGridNav`, the host appends the 'Demo' suffix) across all six
 * targets and proves REQ-1..REQ-7 INSIDE the real 1498-line `DataTable.rozie` (the
 * plan-01 probe proved the focus MECHANISM in isolation; this proves it with full
 * table-core chrome, the #cell scoped slot, the $expose handle, and the
 * activecell-change event), plus table-mode NON-REGRESSION (the sibling
 * getTestId=default-table renders role=table/role=cell exactly as phase 48).
 *
 *   REQ-1 — role flip: grid-table root [role=grid], a body cell [role=gridcell],
 *           headers [role=columnheader]; default-table root [role=table], cells
 *           [role=cell], headers [role=columnheader].
 *   REQ-2 — roving single tab-stop: within grid-table exactly one [tabindex=0] at
 *           all times; Tab from outside lands on it; a second Tab leaves the grid.
 *   REQ-3 — full APG nav over header+body: ArrowRight/Left/Down/Up, Home, End,
 *           Ctrl+Home, Ctrl+End move the active cell's data-row/data-col-index.
 *   REQ-4 — Enter focuses the inner control; Escape returns to the cell; in
 *           interaction mode Tab stays inside the cell; ArrowRight then moves cells.
 *   REQ-5 — focusCell(1,1)/getActiveCell() via the $refs.dt handle move/read the
 *           active cell; activecell-change readout matches the focused cell.
 *   REQ-6 — index-addressed nav survives a re-sort (clamp): after a sort the active
 *           cell is still a valid index-addressed cell (not lost).
 *   REQ-7 — edge/visible-model: ArrowLeft at col 0 is a no-op; hide a column then
 *           horizontal nav skips it; ArrowDown at the page-last row does NOT cross
 *           the page (the controlled pageSize=3 pagination readout stays Page 1).
 *
 * PER-TARGET activeElement READ (A1, pinned by plan 01): the in-cell trap + focus
 * checks read the focused element through Lit's shadow root uniformly via
 * `gridRoot.getRootNode().activeElement` — in the 5 light-DOM targets getRootNode()
 * is `document`; inside Lit's open shadow root it is the shadow root whose
 * activeElement is the focused inner cell (NOT the host document.activeElement would
 * return). Reused verbatim from data-table-grid-probe.spec.ts.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

// React was BLOCKED on a pre-existing EMITTER gap (the ROZ138 stale-read class
// applied to $expose verbs): the React emitter compiled every $expose block to
// `useImperativeHandle(ref, () => ({…}), [])` with an EMPTY dep array, so the
// exposed-verb closures were captured at RENDER 0 — before $onMount creates the
// table-core instance, when `rows` is still []. `focusCell`/`getActiveCell` then
// clamped/read against the render-0 empty model and returned (0,0).
//
// FIXED by quick task 260618-ao9 — the React emitter now builds the handle once
// (stable `ref.current`) but routes each verb through a live `_rozieExposeRef`
// useRef mirror that is re-synced every render, so exposed verbs read LIVE
// reactive state. React grid REQ-5 (focusCell/getActiveCell) now passes; the
// KNOWN_FAILING set is empty and React runs as a real (non-fixme) test.
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

// The grid mode mounts a <table> inside the getTestId=grid-table container; the
// default mode mounts another <table> inside getTestId=default-table. A plain
// locator auto-pierces Lit's OPEN shadow root (the data-table.spec.ts precedent).

/**
 * The active cell's [data-row]/[data-col-index]/role read off the focused element,
 * UNIFORM across all six (incl. Lit shadow) via `getRootNode().activeElement`. The
 * root is resolved from the grid <table> inside the getTestId=grid-table container
 * (the default-table sibling is ignored). Returns null when nothing inside the grid
 * is focused.
 */
async function activeCellCoords(
  page: Page,
): Promise<{ row: string | null; col: string | null; role: string | null; tag: string } | null> {
  return page.evaluate(() => {
    // The grid <table role="grid"> can live in the consumer's shadow root AND/OR
    // (Lit) the nested DataTable's OWN shadow root. Walk all open shadow roots
    // recursively for the grid-mode table (role="grid" is unique to the grid
    // instance — the sibling default-mode table is role="table").
    const findGridTable = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('table[role="grid"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findGridTable(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const grid = findGridTable(document);
    if (!grid) return null;
    const active = grid.getRootNode
      ? (grid.getRootNode() as Document | ShadowRoot).activeElement
      : document.activeElement;
    if (!active) return null;
    // The focused element is the cell itself or an inner control; climb to the
    // owning [data-grid-cell] for the cell coordinates.
    const cell = active.closest('[data-grid-cell]');
    return {
      row: cell ? cell.getAttribute('data-row') : null,
      col: cell ? cell.getAttribute('data-col-index') : null,
      role: cell ? cell.getAttribute('role') : null,
      tag: active.tagName.toLowerCase(),
    };
  });
}

/** True when the focused element is an interactive control INSIDE the active cell. */
async function innerControlFocused(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const findGridTable = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('table[role="grid"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findGridTable(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const grid = findGridTable(document);
    if (!grid) return false;
    const active = (grid.getRootNode() as Document | ShadowRoot).activeElement;
    if (!active) return false;
    // Inner control = a focusable that is NOT the gridcell itself but lives inside one.
    const isCell = active.hasAttribute('data-grid-cell');
    const inCell = !!active.closest('[data-grid-cell]');
    const focusable = /^(button|a|input|select|textarea)$/.test(active.tagName.toLowerCase());
    return inCell && !isCell && focusable;
  });
}

for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid [${target}]: role flip; roving tab-stop; APG nav; Enter/Escape; $expose; clamp; edge/visible-model`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridNav&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const gridContainer = mount.getByTestId('grid-table');
    const defaultContainer = mount.getByTestId('default-table');
    const gridTable = gridContainer.locator('table');
    const defaultTable = defaultContainer.locator('table');
    await expect(gridTable).toBeVisible({ timeout: 15_000 });
    await expect(defaultTable).toBeVisible({ timeout: 15_000 });

    // ===================================================================
    // WR-04 — no focus-steal on mount: nothing inside the grid is focused until the
    //         user Tabs/clicks in (the roving tabindex="0" is the entry target, NOT an
    //         on-mount auto-focus). The active element is the document body, whose
    //         closest [data-grid-cell] is null → cell role null.
    // ===================================================================
    {
      const onMount = await activeCellCoords(page);
      expect(onMount?.role ?? null).toBeNull();
    }

    // ===================================================================
    // REQ-1 — role flip (grid/gridcell vs table/cell); headers stay columnheader
    // ===================================================================
    await expect
      .poll(async () => gridTable.getAttribute('role'), { timeout: 10_000 })
      .toBe('grid');
    await expect
      .poll(async () => gridContainer.locator('[role="gridcell"]').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => gridContainer.locator('[role="columnheader"]').count(), {
        timeout: 10_000,
      })
      .toBe(3);
    // Table-mode NON-REGRESSION: the sibling default instance is role=table/cell.
    await expect
      .poll(async () => defaultTable.getAttribute('role'), { timeout: 10_000 })
      .toBe('table');
    await expect
      .poll(async () => defaultContainer.locator('[role="cell"]').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => defaultContainer.locator('[role="gridcell"]').count(), {
        timeout: 10_000,
      })
      .toBe(0);
    await expect
      .poll(async () => defaultContainer.locator('[role="columnheader"]').count(), {
        timeout: 10_000,
      })
      .toBe(3);

    // ===================================================================
    // REQ-2 — roving single tab-stop; Tab in lands on it; second Tab leaves grid
    // ===================================================================
    const tabStops = gridContainer.locator('[tabindex="0"]');
    await expect.poll(async () => tabStops.count(), { timeout: 15_000 }).toBe(1);
    const entry = tabStops.first();
    // D-04 entry cell = first body data cell (row 0, col 0).
    await expect(entry).toHaveAttribute('data-row', '0');
    await expect(entry).toHaveAttribute('data-col-index', '0');
    await expect(entry).toHaveAttribute('role', 'gridcell');

    // Focus the entry cell to begin keyboard nav.
    await entry.focus();
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('0');
    // Exactly one tab-stop still.
    await expect.poll(async () => tabStops.count(), { timeout: 10_000 }).toBe(1);

    // ===================================================================
    // REQ-3 — full APG nav over header + body
    // ===================================================================
    // ArrowRight → col 1 (assert BOTH the DOM focus AND the roving tabindex state move)
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');
    await expect.poll(async () => tabStops.count(), { timeout: 10_000 }).toBe(1);
    // The single roving tab-stop (React state-driven) moved to col 1.
    await expect
      .poll(async () => tabStops.first().getAttribute('data-col-index'), { timeout: 10_000 })
      .toBe('1');
    // ArrowLeft → back to col 0
    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('0');
    // End → last column (col 2)
    await page.keyboard.press('End');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('2');
    // Home → first column (col 0)
    await page.keyboard.press('Home');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('0');
    // ArrowDown → body row 1
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('1');
    // ArrowUp → body row 0
    await page.keyboard.press('ArrowUp');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('0');
    // ArrowUp again → header crossing (columnheader, data-row=__header)
    await page.keyboard.press('ArrowUp');
    await expect
      .poll(async () => (await activeCellCoords(page))?.role, { timeout: 10_000 })
      .toBe('columnheader');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('__header');
    await expect
      .poll(async () => gridContainer.locator('thead [tabindex="0"]').count(), {
        timeout: 10_000,
      })
      .toBe(1);
    // ArrowDown → back to body row 0
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('0');
    // Ctrl+End → last visible cell (page-last row 2, last col 2)
    await page.keyboard.press('Control+End');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('2');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('2');
    // Ctrl+Home → first body cell (row 0, col 0)
    await page.keyboard.press('Control+Home');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('0');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('0');

    // ===================================================================
    // REQ-4 — Enter focuses inner control; Tab stays in cell; Escape returns;
    //         ArrowRight then moves cells again (nav mode restored)
    // ===================================================================
    // Navigate to the control-bearing body cell (Score column, col 2, row 0 — its
    // #cell slot renders a <button data-testid=cell-action>).
    await page.keyboard.press('ArrowRight'); // col 1
    await page.keyboard.press('ArrowRight'); // col 2 (Score, control-bearing)
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('2');
    // Enter → focus the inner control.
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => innerControlFocused(page), { timeout: 10_000 })
      .toBe(true);
    // Tab in interaction mode stays inside the cell (focus containment) — still on
    // an inner control (single control here → cycles back to itself).
    await page.keyboard.press('Tab');
    await expect
      .poll(async () => innerControlFocused(page), { timeout: 10_000 })
      .toBe(true);
    // Escape → return focus to the owning gridcell (nav mode).
    await page.keyboard.press('Escape');
    await expect
      .poll(async () => innerControlFocused(page), { timeout: 10_000 })
      .toBe(false);
    await expect
      .poll(async () => (await activeCellCoords(page))?.role, { timeout: 10_000 })
      .toBe('gridcell');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('2');
    // ArrowLeft now moves cells again (nav restored).
    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');

    // ===================================================================
    // REQ-5 — $expose verbs (focusCell/getActiveCell) + activecell-change readout
    // ===================================================================
    const activeReadout = page.getByTestId('activecell-readout');
    const getActiveReadout = page.getByTestId('getactivecell-readout');
    // focusCell(1,1) via the handle → focus + tab-stop land on row 1, col 1.
    await page.getByTestId('call-focuscell').click();
    await expect
      .poll(async () => tabStops.first().getAttribute('data-row'), { timeout: 10_000 })
      .toBe('1');
    await expect
      .poll(async () => tabStops.first().getAttribute('data-col-index'), {
        timeout: 10_000,
      })
      .toBe('1');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('1');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');
    // activecell-change fired with the fresh post-write indices (1,1).
    await expect.poll(async () => activeReadout.textContent(), { timeout: 10_000 }).toBe('1,1');
    // getActiveCell() handle returns the integer pair.
    await page.getByTestId('call-getactivecell').click();
    await expect
      .poll(async () => getActiveReadout.textContent(), { timeout: 10_000 })
      .toBe('1,1');
    // An arrow move updates the activecell-change readout too (every move emits).
    // Re-seat DOM focus on the active grid cell first — clicking the getActiveCell
    // button above moved page focus OFF the grid, so a keypress would otherwise go to
    // the button. focusCell(1,1) re-focuses the (1,1) gridcell.
    await page.getByTestId('call-focuscell').click();
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => activeReadout.textContent(), { timeout: 10_000 }).toBe('1,2');

    // ===================================================================
    // REQ-6 — index-addressed nav survives a re-sort (clamp): the active cell is
    //         still a valid index-addressed cell after the data changes.
    // ===================================================================
    // Sort the Name column via its header sort button (re-pulls the row model →
    // clampActiveCell runs). The active cell keeps its index (clamped to bounds).
    const nameSortBtn = gridContainer
      .locator('[role="columnheader"]')
      .nth(0)
      .locator('button.rdt-sort-btn')
      .first();
    await nameSortBtn.click();
    // After the re-sort the roving tab-stop is still exactly one, addressing a valid
    // cell (data-row/data-col-index resolve to a real gridcell).
    await expect.poll(async () => tabStops.count(), { timeout: 10_000 }).toBe(1);
    await expect
      .poll(async () => {
        const r = await tabStops.first().getAttribute('data-row');
        const c = await tabStops.first().getAttribute('data-col-index');
        // valid = a present cell at those coords inside the grid
        return gridContainer
          .locator(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`)
          .count();
      }, { timeout: 10_000 })
      .toBe(1);

    // ===================================================================
    // REQ-7 — edge clamp + hidden-col skip + no page-cross
    // ===================================================================
    // (a) ArrowLeft at col 0 is a no-op. Reset to the entry cell first.
    await page.getByTestId('call-focuscell').click(); // → (1,1)
    await page.keyboard.press('ArrowLeft'); // → (1,0)
    await page.keyboard.press('ArrowUp'); // → (0,0)
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('0');
    await page.keyboard.press('ArrowLeft'); // no-op at left edge
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('0');

    // (b) Hide the "city" column → 3 cols become 2; horizontal nav now spans only
    //     the two remaining columns (ArrowRight from col 0 reaches a last col index
    //     of 1, and a further ArrowRight clamps — the hidden col is skipped, the
    //     visible model is 2 wide).
    await page.getByTestId('hide-city').click();
    await expect
      .poll(async () => gridContainer.locator('[role="columnheader"]').count(), {
        timeout: 10_000,
      })
      .toBe(2);
    // Re-seat the active cell on the reduced model and walk to the right edge.
    await page.getByTestId('call-focuscell').click(); // clamps into the 2-wide model
    await page.keyboard.press('ArrowUp'); // → row 0
    await page.keyboard.press('Home'); // → col 0
    await page.keyboard.press('End'); // → last visible col (index 1 now, city gone)
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');
    // A further ArrowRight clamps (no 3rd column in the visible model).
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');
    // Restore the column for the no-page-cross check.
    await page.getByTestId('hide-city').click();
    await expect
      .poll(async () => gridContainer.locator('[role="columnheader"]').count(), {
        timeout: 10_000,
      })
      .toBe(3);

    // (c) No page-cross: uncontrolled pageSize=3 → page 1 shows rows 0..2 (the dataset
    //     has 6 rows = 2 pages). Navigate to the page-last row (row 2) and ArrowDown —
    //     the active cell CLAMPS at the page-last row and the DataTable's own page
    //     status stays "Page 1 of 2" (no page advance, REQ-7 stop-at-edges).
    const pageStatus = gridContainer.locator('.rdt-page-status');
    await expect
      .poll(async () => (await pageStatus.textContent())?.trim() ?? '', { timeout: 10_000 })
      .toBe('Page 1 of 2');
    // grid page 1 has exactly 3 body rows.
    await expect
      .poll(async () => gridContainer.locator('tbody [role="row"]').count(), { timeout: 10_000 })
      .toBe(3);
    await page.getByTestId('call-focuscell').click(); // → (1,1)
    await page.keyboard.press('ArrowDown'); // → row 2 (page-last)
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('2');
    await page.keyboard.press('ArrowDown'); // clamp; must NOT cross the page
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('2');
    // The page never advanced.
    await expect
      .poll(async () => (await pageStatus.textContent())?.trim() ?? '', { timeout: 10_000 })
      .toBe('Page 1 of 2');

    // ===================================================================
    // WR-03 — click-to-activate: clicking a tabindex="-1" cell moves the SINGLE roving
    //         tab-stop AND the active-cell state to the clicked cell (mouse integrates
    //         with the roving model); the next arrow continues from the clicked cell.
    // ===================================================================
    const cell20 = gridContainer.locator(
      '[data-grid-cell][data-row="2"][data-col-index="0"]',
    );
    await cell20.click();
    await expect.poll(async () => tabStops.count(), { timeout: 10_000 }).toBe(1);
    await expect
      .poll(async () => tabStops.first().getAttribute('data-row'), { timeout: 10_000 })
      .toBe('2');
    await expect
      .poll(async () => tabStops.first().getAttribute('data-col-index'), { timeout: 10_000 })
      .toBe('0');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('2');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('0');
    // A subsequent ArrowRight continues from the CLICKED cell (col 0 → col 1), proving
    // the roving model picked up the mouse focus (not a stale keyboard-nav index). Settle
    // the emit so the following async-target (React/Angular) assertions start from rest.
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');
    await expect
      .poll(async () => activeReadout.textContent(), { timeout: 10_000 })
      .toBe('2,1');

    // ===================================================================
    // WR-05 — keys are NOT hijacked when focus is on an inner control reached WITHOUT
    //         Enter. Click the score body cell's <button> directly (focus lands on the
    //         button, not the cell box); an ArrowDown must NOT move the active cell — the
    //         button keeps native behavior. Distinct from the in-cell-trap (Enter) path.
    //         (The row + inner-control checks alone prove it: a hijacked ArrowDown would
    //         nav to row 1 and move DOM focus onto the (1,2) cell, flipping both.)
    // ===================================================================
    const scoreBtn00 = gridContainer.locator(
      '[data-grid-cell][data-row="0"][data-col-index="2"] [data-testid="cell-action"]',
    );
    await scoreBtn00.click();
    await expect
      .poll(async () => innerControlFocused(page), { timeout: 10_000 })
      .toBe(true);
    // The active cell synced to the clicked control's owning cell (row 0, col 2)…
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('0');
    // …but ArrowDown while the button holds focus is a no-op (WR-05 early-return): focus
    // stays on the inner control and the active cell does NOT advance to row 1.
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => innerControlFocused(page), { timeout: 10_000 })
      .toBe(true);
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('0');

    // ===================================================================
    // WR-06 — a clamped no-op edge move does NOT emit activecell-change; a real move
    //         does. Net-count proof (race-free on async targets): from a settled base,
    //         two REAL moves ((1,0) then (1,1)) bracket one no-op ArrowLeft at col 0;
    //         the settled emit counter must rise by EXACTLY two (the no-op adds zero —
    //         a spurious emit would make it three).
    // ===================================================================
    const countReadout = page.getByTestId('activecell-count');
    await page.getByTestId('call-focuscell').click(); // → cell (1,1), emits '1,1'
    await expect
      .poll(async () => activeReadout.textContent(), { timeout: 10_000 })
      .toBe('1,1'); // emit settled
    const countBase = Number(await countReadout.textContent());
    await page.keyboard.press('ArrowLeft'); // → (1,0) REAL move (emits)
    await expect
      .poll(async () => activeReadout.textContent(), { timeout: 10_000 })
      .toBe('1,0'); // settled
    await page.keyboard.press('ArrowLeft'); // no-op at col 0 — WR-06: NO emit
    await page.keyboard.press('ArrowRight'); // → (1,1) REAL move (emits)
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');
    await expect
      .poll(async () => activeReadout.textContent(), { timeout: 10_000 })
      .toBe('1,1'); // settled
    // Exactly TWO emits since the settled base — the clamped no-op contributed zero.
    await expect
      .poll(async () => Number(await countReadout.textContent()), { timeout: 10_000 })
      .toBe(countBase + 2);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// Phase 53 plan 04 — GRID + VIRTUAL scroll-then-focus across the window boundary (req-5,
// decision D-12). Drives `examples/demos/DataTableVirtualGridDemo.rozie`
// (?example=DataTableVirtualGrid): a 5,000-row grid with row windowing ON. A
// focusCell(4000, 1) handle call targets a row FAR outside the rendered window —
// focusActiveCell must scrollToIndex(4000) FIRST, then land DOM focus on the (4000,1) cell
// on the next frame (the double-rAF flush). This is a DOM assertion (the focused cell's
// data-row + activecell-change index pair), NOT a screenshot — the proof is that the
// off-window row scrolled in AND focus landed on the correct cell (Lit pierced via
// getRootNode().activeElement in the activeCellCoords helper above).
//
// WINDOW_INIT_UNSUPPORTED (Solid, Svelte): the row-windowing engine's windowed <tbody>
// slice does NOT render on the two fine-grained targets — the windowed `<For>` / `{#each}`
// over windowedRows() never paints a row even after the virtualizer is re-fed and an
// explicit scroll forces virtual-core's onChange (the window stays empty, no roving
// tab-stop). This is a PRE-EXISTING row-windowing-engine bug from Plan 02 (the windowing
// engine was never per-target VR-exercised there; this Plan-04 grid+virtual case is the
// first per-target run of the windowed slice). It is OUT OF SCOPE for Plan 04's
// scroll-then-focus deliverable — the D-12 mechanism is PROVEN on the four targets whose
// window renders (React/Vue/Angular/Lit). Tracked for the dedicated windowing VR plan
// (Plan 06) — see phase deferred-items.md. Gated test.fixme (not deleted) so it
// auto-revives when the fine-grained windowed slice is fixed.
const WINDOW_INIT_UNSUPPORTED: ReadonlySet<Target> = new Set<Target>(['solid', 'svelte']);

for (const target of TARGETS) {
  const offWindowRunner = WINDOW_INIT_UNSUPPORTED.has(target)
    ? test.fixme
    : runnerFor(target);
  offWindowRunner(`data-table-grid+virtual [${target}]: off-window focusCell scrolls-then-focuses across the window boundary`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableVirtualGrid&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const gridContainer = mount.getByTestId('grid-table');
    const gridTable = gridContainer.locator('table[role="grid"]');
    await expect(gridTable).toBeVisible({ timeout: 15_000 });

    // The full model is 5,000 rows (windowing renders only a small slice of it).
    await expect
      .poll(async () => page.getByTestId('row-count').textContent(), { timeout: 15_000 })
      .toBe('5000');
    // Sanity: row 4000 is NOT initially rendered — it is far below the ~400px window, so
    // the windowing engine has not painted it yet (the scroll-then-focus precondition).
    await expect(
      gridContainer.locator('[data-grid-cell][data-row="4000"]'),
    ).toHaveCount(0);
    // The grid mounts with exactly one roving tab-stop and no auto-focus (WR-04 parity).
    await expect
      .poll(async () => gridContainer.locator('[tabindex="0"]').count(), { timeout: 15_000 })
      .toBe(1);

    // ── focusCell(4000, 1): row 4000 is outside the window → focusActiveCell runs the
    //    D-12 scroll-then-focus path (scrollToIndex(4000) → double-rAF → resolveCellEl().focus()).
    const activeReadout = page.getByTestId('activecell-readout');
    const getActiveReadout = page.getByTestId('getactivecell-readout');
    await page.getByTestId('call-focuscell-far').click();

    // The target row scrolled into the window AND the single roving tab-stop moved to it.
    await expect
      .poll(async () => gridContainer.locator('[data-grid-cell][data-row="4000"]').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => gridContainer.locator('[tabindex="0"]').first().getAttribute('data-row'), {
        timeout: 15_000,
      })
      .toBe('4000');
    await expect
      .poll(async () => gridContainer.locator('[tabindex="0"]').first().getAttribute('data-col-index'), {
        timeout: 15_000,
      })
      .toBe('1');

    // DOM focus LANDED on the (4000,1) cell — the double-rAF deferred focus resolved after
    // the new window committed (this is the assertion the single-rAF path would flake on).
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 15_000 })
      .toBe('4000');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 15_000 })
      .toBe('1');
    await expect
      .poll(async () => (await activeCellCoords(page))?.role, { timeout: 15_000 })
      .toBe('gridcell');

    // activecell-change fired with the fresh off-window index pair.
    await expect
      .poll(async () => activeReadout.textContent(), { timeout: 15_000 })
      .toBe('4000,1');

    // getActiveCell() reads the same index pair back through the handle (full-model index).
    await page.getByTestId('call-getactivecell').click();
    await expect
      .poll(async () => getActiveReadout.textContent(), { timeout: 15_000 })
      .toBe('4000,1');
  });
}
