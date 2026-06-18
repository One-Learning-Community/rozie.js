import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 49 WAVE-0 FOCUS PROBE — the cross-target focus() resolution mechanism
 * de-risk spec (rete-FlowCanvas Wave-0 precedent). It drives the standalone,
 * chrome-free `examples/demos/DataTableGridProbeDemo.rozie` cell (navigated
 * `?example=DataTableGridProbe`, the host appends the 'Demo' suffix) across all
 * six targets and proves the RESEARCH Pattern-1 strategy — a data-row/
 * data-col-index `querySelector` off a stable post-mount root + `.focus()` —
 * resolves and MOVES real DOM focus on React/Vue/Svelte/Angular/Solid/Lit,
 * especially Solid's fine-grained renderer and Lit's shadow-DOM activeElement.
 *
 * The 5 numbered probe assertions (RESEARCH "Wave-0 focus probe design"):
 *   1. exactly one [tabindex="0"] at mount = the D-04 entry cell (row 0, col 0)
 *   2. ArrowRight → [tabindex="0"] moves to data-col-index="1" AND real DOM focus follows
 *   3. ArrowUp from body row 0 → active cell is a [role="columnheader"] (header crossing)
 *   4. Enter focuses the inner button; Escape returns focus to the owning gridcell
 *   5. focusCell(1,1) (via the internal button calling the exposed verb) → focus on (1,1)
 *
 * PER-TARGET activeElement READ (A1, RESEARCH Pattern 2 / Pitfall 4): the in-cell
 * trap and focus-follow checks must read the focused element correctly through
 * Lit's shadow root. `gridRoot.getRootNode().activeElement` is the UNIFORM read on
 * all six — in the light DOM (the 5 non-Lit targets) `getRootNode()` is `document`
 * whose `activeElement` is the focused element; inside Lit's open shadow root it is
 * the shadow root whose `activeElement` is the focused inner cell (NOT the host,
 * which is what `document.activeElement` would return on Lit). This spec PINS that
 * read for plan 03's in-cell trap.
 *
 * If a target DIVERGES on any assertion, that is a STOP-AND-RETHINK signal — it is
 * NOT worked around here; it is recorded in 49-01-SUMMARY.md as a finding.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

// The grid root inside the mounted probe — `.rozie-grid-probe` is the same class
// the component captures in $onMount. A plain locator auto-pierces Lit's OPEN
// shadow root (the data-table.spec.ts precedent).
const GRID = '.rozie-grid-probe';

/**
 * The active cell's [data-row]/[data-col-index] read off the focused element,
 * UNIFORM across all six (incl. Lit shadow) via `getRootNode().activeElement`.
 * Returns null when nothing inside the grid (or a cell descendant) is focused.
 */
async function activeCellCoords(
  page: Page,
): Promise<{ row: string | null; col: string | null; role: string | null; tag: string } | null> {
  return page.evaluate((sel) => {
    const grid = document.querySelector(sel)
      // light DOM: direct hit. Lit: the host's shadow root holds it.
      ?? (() => {
        // walk any open shadow roots one level (the probe is a single component)
        for (const el of Array.from(document.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) {
            const inner = sr.querySelector(sel);
            if (inner) return inner;
          }
        }
        return null;
      })();
    if (!grid) return null;
    const active = grid.getRootNode
      ? (grid.getRootNode() as Document | ShadowRoot).activeElement
      : document.activeElement;
    if (!active) return null;
    // The focused element is either the cell itself or an inner control; climb to
    // the owning [data-grid-cell] for the cell coordinates.
    const cell = active.closest('[data-grid-cell]');
    return {
      row: cell ? cell.getAttribute('data-row') : null,
      col: cell ? cell.getAttribute('data-col-index') : null,
      role: cell ? cell.getAttribute('role') : null,
      tag: active.tagName.toLowerCase(),
    };
  }, GRID);
}

/** True when the focused element is the inner control (the <button> in cell 1,1). */
async function innerControlFocused(page: Page): Promise<boolean> {
  return page.evaluate((sel) => {
    const grid =
      document.querySelector(sel) ??
      (() => {
        for (const el of Array.from(document.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) {
            const inner = sr.querySelector(sel);
            if (inner) return inner;
          }
        }
        return null;
      })();
    if (!grid) return false;
    const active = (grid.getRootNode() as Document | ShadowRoot).activeElement;
    return !!active && active.getAttribute('data-testid') === 'inner-control';
  }, GRID);
}

for (const target of TARGETS) {
  runnerFor(target)(`data-table-grid-probe [${target}]: focus resolves + moves; header crossing; Enter/Escape; focusCell`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGridProbe&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const grid = mount.locator(GRID);
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // role flips to 'grid' in interactionMode='grid'.
    await expect
      .poll(async () => grid.getAttribute('role'), { timeout: 10_000 })
      .toBe('grid');

    // ---- 1. exactly one [tabindex="0"] at mount = the D-04 entry cell --------
    const tabStops = grid.locator('[tabindex="0"]');
    await expect.poll(async () => tabStops.count(), { timeout: 15_000 }).toBe(1);
    const entry = tabStops.first();
    await expect(entry).toHaveAttribute('data-row', '0');
    await expect(entry).toHaveAttribute('data-col-index', '0');
    await expect(entry).toHaveAttribute('role', 'gridcell');

    // Move DOM focus onto the entry cell to begin keyboard nav (the component
    // does not auto-focus on mount so assertion 1 reads a clean single tab-stop).
    await entry.focus();
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('0');

    // ---- 2. ArrowRight → tabindex AND real DOM focus move one cell right -----
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => grid.locator('[tabindex="0"]').count(), { timeout: 10_000 })
      .toBe(1);
    await expect
      .poll(async () => grid.locator('[tabindex="0"]').first().getAttribute('data-col-index'), {
        timeout: 10_000,
      })
      .toBe('1');
    // Real DOM focus follows (read uniformly via getRootNode().activeElement — A1).
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('0');

    // ---- 3. ArrowUp from body row 0 → header crossing (columnheader) ---------
    await page.keyboard.press('ArrowUp');
    await expect
      .poll(async () => (await activeCellCoords(page))?.role, { timeout: 10_000 })
      .toBe('columnheader');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('__header');
    // The single tab-stop is now in the header.
    await expect
      .poll(async () => grid.locator('thead [tabindex="0"]').count(), { timeout: 10_000 })
      .toBe(1);

    // Back down into the body, then over to the control-bearing cell (row 1, col 1).
    await page.keyboard.press('ArrowDown'); // header → body row 0, col 1
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('0');
    await page.keyboard.press('ArrowDown'); // → body row 1, col 1 (the control cell)
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('1');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');

    // ---- 4. Enter focuses the inner button; Escape returns to the cell ------
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => innerControlFocused(page), { timeout: 10_000 })
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect
      .poll(async () => innerControlFocused(page), { timeout: 10_000 })
      .toBe(false);
    // Focus is back on the owning gridcell (row 1, col 1)...
    await expect
      .poll(async () => (await activeCellCoords(page))?.role, { timeout: 10_000 })
      .toBe('gridcell');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('1');
    // ...and a subsequent ArrowRight moves cells again (nav mode restored).
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('2');

    // ---- 5. focusCell(1,1) via the exposed verb (internal button) -----------
    await mount.locator('[data-testid="focus-cell-btn"]').first().click();
    await expect
      .poll(async () => grid.locator('[tabindex="0"]').first().getAttribute('data-row'), {
        timeout: 10_000,
      })
      .toBe('1');
    await expect
      .poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 })
      .toBe('1');
    await expect
      .poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 })
      .toBe('1');
  });
}
