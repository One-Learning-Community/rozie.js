import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * quick 260927-a2r — scrollToRow(index, options?) / getScrollElement() imperative-handle
 * verbs (oinbox dogfooding: `.planning/todos/pending/2026-09-27-datatable-missing-scrolltorow-getscrollelement-on-imperative.md`).
 *
 * DOM-assertion-only (no PNG baseline) — modeled on data-table-grid-absindex.spec.ts's
 * TARGETS/runnerFor/KNOWN_FAILING scaffolding.
 *
 * Two fixtures pin the contract:
 *   - DataTableVirtualGrid (5,000 rows, virtual + grid): a far off-window row (4000) scrolls
 *     into view via scrollToRow WITHOUT moving DOM focus (the independence-from-focus
 *     contract — scrollToRow never touches focusCell's grid-mode focus). getScrollElement()
 *     resolves the real `.rdt-scroll` node.
 *   - DataTableGridAbsIndex (paginated, non-virtual): the negative case — both verbs are
 *     safe no-ops/`null` when rows are not windowed, and neither throws.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

/**
 * The active cell's [data-row]/[data-col-index]/role read off the focused element, UNIFORM
 * across all six (incl. Lit shadow) via `getRootNode().activeElement`. Reused verbatim from
 * data-table-grid-absindex.spec.ts. Returns null when nothing inside the grid is focused.
 */
async function activeCellCoords(
  page: Page,
): Promise<{ row: string | null; col: string | null; role: string | null } | null> {
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
    if (!grid) return null;
    const active = grid.getRootNode
      ? (grid.getRootNode() as Document | ShadowRoot).activeElement
      : document.activeElement;
    if (!active) return null;
    const cell = active.closest('[data-grid-cell]');
    return {
      row: cell ? cell.getAttribute('data-row') : null,
      col: cell ? cell.getAttribute('data-col-index') : null,
      role: cell ? cell.getAttribute('role') : null,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// VIRTUAL — DataTableVirtualGrid (5,000 rows, windowing ON). scrollToRow(4000) must bring
// row 4000 into the rendered window WITHOUT moving DOM focus; getScrollElement() must
// resolve the real `.rdt-scroll` node.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-scroll-to-row [${target}]: virtual scrollToRow scrolls without focusing; getScrollElement resolves .rdt-scroll`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableVirtualGrid&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const gridContainer = mount.getByTestId('grid-table');
    const gridTable = gridContainer.locator('table[role="grid"]');
    await expect(gridTable).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => page.getByTestId('row-count').textContent(), { timeout: 15_000 })
      .toBe('5000');

    // Row 4000 is far outside the initial ~400px window — confirm it is not rendered yet.
    await expect(gridContainer.locator('[data-grid-cell][data-row="4000"]')).toHaveCount(0);

    // No grid cell is focused before the click (WR-04: no on-mount auto-focus of the entry
    // cell). `activeCellCoords` returns a row/col/role triple resolved off `.closest('[data-
    // grid-cell]')` from whatever the document's active element is — on a fresh mount that is
    // `<body>` (truthy, but not inside a grid cell), so the row/col/role fields read null
    // without the helper itself returning null.
    const before = await activeCellCoords(page);
    expect(before?.row ?? null).toBeNull();

    // scrollToRow(4000, { align: 'start' }) — a PLAIN scroll, deliberately never calling
    // focusCell (the demo's callScrollToRowFar handler).
    await page.getByTestId('call-scrolltorow-far').click();

    // Row 4000 scrolled into the rendered window.
    await expect
      .poll(async () => gridContainer.locator('[data-grid-cell][data-row="4000"]').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);

    // Independence-from-focus contract: DOM focus never moved onto a grid cell.
    const after = await activeCellCoords(page);
    expect(after?.row ?? null).toBeNull();

    // getScrollElement() resolves the real .rdt-scroll node.
    await page.getByTestId('call-getscrollelement').click();
    await expect
      .poll(async () => page.getByTestId('scrollelement-readout').textContent(), { timeout: 15_000 })
      .toContain('rdt-scroll');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// NON-VIRTUAL — DataTableGridAbsIndex (paginated). Negative case: both verbs are safe
// no-ops/null when rows are not windowed, and neither throws.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-scroll-to-row [${target}]: non-virtual scrollToRow/getScrollElement are safe no-ops/null`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(String(err)); });

    await page.goto(`/?example=DataTableGridAbsIndex&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const gridContainer = mount.getByTestId('grid-table');
    const gridTable = gridContainer.locator('table[role="grid"]');
    await expect(gridTable).toBeVisible({ timeout: 15_000 });

    // scrollToRow on a non-windowed table must not throw.
    await page.getByTestId('call-scrolltorow-far').click();

    // getScrollElement() returns null (readout string 'null') — nothing is windowed.
    await page.getByTestId('call-getscrollelement').click();
    await expect
      .poll(async () => page.getByTestId('scrollelement-readout').textContent(), { timeout: 15_000 })
      .toBe('null');

    expect(errors).toEqual([]);
  });
}
