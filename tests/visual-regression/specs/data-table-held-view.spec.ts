import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/** data-table held-view / per-column filterFn+sortingFn behavioural battery (Task 2). */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

/** Find the `table[role="grid"]` INSIDE a scoped container (data-testid), shadow-pierced with
 *  TWO hops: (1) the OUTER demo itself compiles to a Lit custom element, so
 *  `[data-testid="grid-table"]` lives INSIDE the demo's OWN shadow root on Lit — a plain
 *  `document.querySelector` can never reach it, so the scope lookup itself must shadow-pierce
 *  (the clipboard/edit specs never needed this — they have exactly one grid instance at the
 *  demo's own top level); (2) the `table[role="grid"]` (or `[data-editing-cell]`) lives inside
 *  the INNER DataTable custom element's shadow root, resolved the same way, rooted at the
 *  scope found in hop 1. */
async function findGridTableWithin(page: Page, scopeTestId: string): Promise<boolean> {
  return page.evaluate((scopeId) => {
    const findFirst = (root: ParentNode, selector: string): Element | null => {
      const direct = root.querySelector(selector);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findFirst(sr, selector);
          if (inner) return inner;
        }
      }
      return null;
    };
    const scope = findFirst(document, `[data-testid="${scopeId}"]`);
    if (!scope) return false;
    return !!findFirst(scope, 'table[role="grid"]');
  }, scopeTestId);
}

/** The active cell's [data-row]/[data-col-index]/role read off the focused element within a
 *  scoped grid container, UNIFORM across all six (incl. Lit shadow) via
 *  `getRootNode().activeElement`. */
async function activeCellCoords(
  page: Page,
  scopeTestId: string,
): Promise<{ row: string | null; col: string | null; role: string | null; tag: string } | null> {
  return page.evaluate((scopeId) => {
    const findFirst = (root: ParentNode, selector: string): Element | null => {
      const direct = root.querySelector(selector);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findFirst(sr, selector);
          if (inner) return inner;
        }
      }
      return null;
    };
    const scope = findFirst(document, `[data-testid="${scopeId}"]`);
    if (!scope) return null;
    const grid = findFirst(scope, 'table[role="grid"]');
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
      tag: active.tagName.toLowerCase(),
    };
  }, scopeTestId);
}

/** Read a readout testid's trimmed text (shadow-pierced, document-wide — every readout id on this fixture is unique), '' when absent. */
async function readoutText(page: Page, testid: string): Promise<string> {
  return page.evaluate((id) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(`[data-testid="${id}"]`);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = find(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const el = find(document);
    return el ? (el.textContent || '').trim() : '';
  }, testid);
}

interface ModelRow { id: number; title: string; grades: number[]; labels: string[]; owner: string; minQty: number }

async function modelRows(page: Page, readoutId: string): Promise<ModelRow[]> {
  const raw = await readoutText(page, readoutId);
  try {
    return JSON.parse(raw) as ModelRow[];
  } catch {
    return [];
  }
}

/** The open editor's <input> value + owning cell col (shadow-pierced), scoped to a grid
 *  container. Mirrors data-table-grid-edit.spec.ts `openEditor`, scoped (two shadow-piercing
 *  hops — see findGridTableWithin) for the two-instance fixture. */
async function openEditor(
  page: Page,
  scopeTestId: string,
): Promise<{ value: string; col: string | null } | null> {
  return page.evaluate((scopeId) => {
    const findFirst = (root: ParentNode, selector: string): Element | null => {
      const direct = root.querySelector(selector);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findFirst(sr, selector);
          if (inner) return inner;
        }
      }
      return null;
    };
    const scope = findFirst(document, `[data-testid="${scopeId}"]`);
    if (!scope) return null;
    const el = findFirst(scope, '[data-editing-cell]') as (HTMLInputElement & HTMLSelectElement) | null;
    if (!el) return null;
    const cell = el.closest('[data-grid-cell]');
    return {
      value: el.value != null ? String(el.value) : '',
      col: cell ? cell.getAttribute('data-col-index') : null,
    };
  }, scopeTestId);
}

/** Focus a body cell directly by (row, col) within a scoped grid container — drives
 *  @focusin → activeRow/activeColIndex sync. */
async function focusBodyCell(page: Page, scopeTestId: string, row: number, col: number): Promise<void> {
  await page.evaluate(({ scopeId, r, c }) => {
    const findFirst = (root: ParentNode, selector: string): Element | null => {
      const direct = root.querySelector(selector);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findFirst(sr, selector);
          if (inner) return inner;
        }
      }
      return null;
    };
    const scope = findFirst(document, `[data-testid="${scopeId}"]`);
    if (!scope) return;
    const grid = findFirst(scope, 'table[role="grid"]');
    if (!grid) return;
    const cell = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`) as HTMLElement | null;
    if (cell) cell.focus();
  }, { scopeId: scopeTestId, r: row, c: col });
}

/** Focus (row, col) and KEEP it until the active cell settles there AND holds. */
async function focusBodyCellStable(page: Page, scopeTestId: string, row: number, col: number): Promise<void> {
  await focusBodyCell(page, scopeTestId, row, col);
  let stableHits = 0;
  await expect
    .poll(
      async () => {
        const a = await activeCellCoords(page, scopeTestId);
        if (a?.row === String(row) && a?.col === String(col)) stableHits += 1;
        else { stableHits = 0; await focusBodyCell(page, scopeTestId, row, col); }
        return stableHits;
      },
      { timeout: 5_000, intervals: [40, 40, 40, 60, 100] },
    )
    .toBeGreaterThanOrEqual(2);
}

/** Settle the grid, focus (row, col), press F2 to open its editor. */
async function enterEditAt(page: Page, scopeTestId: string, row: number, col: number): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const cur = await openEditor(page, scopeTestId);
    if (cur?.col === String(col)) return;
    if (cur) {
      await page.keyboard.press('Escape');
      await expect.poll(async () => openEditor(page, scopeTestId), { timeout: 5_000 }).toBeNull().catch(() => {});
    }
    await focusBodyCellStable(page, scopeTestId, row, col);
    const coords = await activeCellCoords(page, scopeTestId);
    if (coords?.row !== String(row) || coords?.col !== String(col)) continue;
    if (await openEditor(page, scopeTestId)) continue;
    await page.keyboard.press('F2');
    try {
      await expect.poll(async () => (await openEditor(page, scopeTestId))?.col, { timeout: 3_000 }).toBe(String(col));
      return;
    } catch {
      // opened at the wrong col / not at all — re-settle and retry.
    }
  }
  await expect.poll(async () => (await openEditor(page, scopeTestId))?.col, { timeout: 3_000 }).toBe(String(col));
}

/** Commit a fresh value into the currently-open editor via fill + Enter. */
async function commitEditorValue(page: Page, value: string): Promise<void> {
  const ed = page.locator('[data-editing-cell]').first();
  await ed.fill(value);
  await ed.press('Enter');
}

/** Visible row ids: the first cell's text of each body row, shadow-pierced. */
async function visibleIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const findFirst = (root: ParentNode, selector: string): Element | null => {
      const direct = root.querySelector(selector);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findFirst(sr, selector);
          if (inner) return inner;
        }
      }
      return null;
    };
    const scope = findFirst(document, '[data-testid="grid-table"]');
    if (!scope) return [];
    const grid = findFirst(scope, 'table[role="grid"]');
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('tbody tr')).map((tr) => {
      const c = tr.querySelector('td,[role="gridcell"]');
      return ((c && c.textContent) || '').trim();
    });
  });
}

async function clickTestId(page: Page, id: string): Promise<void> {
  await page.getByTestId(id).click();
}

async function gotoDemo(page: Page, target: Target): Promise<void> {
  await page.goto(`/?example=DataTableHeldView&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  await expect
    .poll(async () => findGridTableWithin(page, 'grid-table'), { timeout: 15_000 })
    .toBe(true);
  await expect.poll(async () => (await visibleIds(page)).length, { timeout: 15_000 }).toBe(6);
}

for (const target of TARGETS) {
  runnerFor(target)(`data-table-held-view [${target}]: (p1-a) arrIncludesSome filters a list column`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'filter-labels-x');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['2', '5']);
  });

  runnerFor(target)(`data-table-held-view [${target}]: (p1-b) custom is-empty rule`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'filter-empty');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['3', '6']);
  });

  runnerFor(target)(`data-table-held-view [${target}]: (p1-c) undo survives a filter change`, async ({ page }) => {
    await gotoDemo(page, target);
    expect((await modelRows(page, 'model-readout'))[0]?.title).toBe('Alpha');

    await enterEditAt(page, 'grid-table', 0, 1);
    await commitEditorValue(page, 'Zeta');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.title, { timeout: 10_000 }).toBe('Zeta');

    await clickTestId(page, 'filter-owner-dana');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '4']);
    expect(await readoutText(page, 'canundo-readout')).toBe('true');

    await clickTestId(page, 'clear-filters');
    await expect.poll(async () => (await visibleIds(page)).length, { timeout: 10_000 }).toBe(6);

    await clickTestId(page, 'undo-btn');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.title, { timeout: 10_000 }).toBe('Alpha');
  });

  // Turned on by Task 4 (refreshView): closure filterFn sees the latest value after a refresh.
  test.fixme(`data-table-held-view [${target}]: (p1-d) closure filterFn uses latest value after refreshView`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'filter-threshold');
    await expect.poll(async () => (await visibleIds(page)).length, { timeout: 10_000 }).toBe(6);
    await clickTestId(page, 'bump-closure');
    await clickTestId(page, 'refresh-view');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['3', '4', '6']);
  });
}
