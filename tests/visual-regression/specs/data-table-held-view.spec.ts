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
async function visibleIds(page: Page, scopeTestId = 'grid-table'): Promise<string[]> {
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
    if (!scope) return [];
    const grid = findFirst(scope, 'table[role="grid"]');
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('tbody tr')).map((tr) => {
      const c = tr.querySelector('td,[role="gridcell"]');
      return ((c && c.textContent) || '').trim();
    });
  }, scopeTestId);
}

/** The roving tab stop (the ONE `[data-grid-cell][tabindex="0"]`) in a scoped grid, plus the
 *  title text of its body row — the active cell whether or not DOM focus is in the grid. */
async function tabStop(
  page: Page,
  scopeTestId: string,
): Promise<{ row: string | null; col: string | null; role: string | null; title: string | null } | null> {
  return page.evaluate(({ scopeId, titleCol }) => {
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
    const cell = grid.querySelector('[data-grid-cell][tabindex="0"]');
    if (!cell) return null;
    const row = cell.getAttribute('data-row');
    const tc = row != null && row !== '__header'
      ? grid.querySelector(`[data-grid-cell][data-row="${row}"][data-col-index="${titleCol}"]`)
      : null;
    return {
      row,
      col: cell.getAttribute('data-col-index'),
      role: cell.getAttribute('role'),
      title: tc ? (tc.textContent || '').trim() : null,
    };
  }, { scopeId: scopeTestId, titleCol: 1 });
}

/** The focused cell's body-row title text within a scoped grid (null when focus is not on a body cell). */
async function focusedRowTitle(page: Page, scopeTestId: string): Promise<string | null> {
  const a = await activeCellCoords(page, scopeTestId);
  if (!a || a.row == null || a.row === '__header') return null;
  return page.evaluate(({ scopeId, r }) => {
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
    const grid = scope ? findFirst(scope, 'table[role="grid"]') : null;
    const tc = grid ? grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="1"]`) : null;
    return tc ? (tc.textContent || '').trim() : null;
  }, { scopeId: scopeTestId, r: a.row });
}


/** The open editor's body row (scoped): its id cell (col 0) and title cell (col 1) text. */
async function openEditorRow(page: Page, scopeTestId: string): Promise<{ id: string; title: string; col: string | null } | null> {
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
    const ed = findFirst(scope, '[data-editing-cell]');
    if (!ed) return null;
    const cell = ed.closest('[data-grid-cell]');
    const row = cell ? cell.getAttribute('data-row') : null;
    const grid = findFirst(scope, 'table[role="grid"]');
    if (!grid || row == null) return null;
    const txt = (c: number) => {
      const el = grid.querySelector(`[data-grid-cell][data-row="${row}"][data-col-index="${c}"]`);
      return el ? (el.textContent || '').trim() : '';
    };
    return { id: txt(0), title: txt(1), col: cell ? cell.getAttribute('data-col-index') : null };
  }, scopeTestId);
}

/** Focus the scoped grid's roving tab stop (the `[tabindex="0"]` cell). */
async function focusTabStop(page: Page, scopeTestId: string): Promise<void> {
  await page.evaluate((scopeId) => {
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
    const grid = scope ? findFirst(scope, 'table[role="grid"]') : null;
    const el = grid ? (grid.querySelector('[data-grid-cell][tabindex="0"]') as HTMLElement | null) : null;
    if (el) el.focus();
  }, scopeTestId);
}

interface ViewState { held: boolean; filterMismatches: number; sortMismatches: number }

/** The last `view-state-change` payload (null before the first one). */
async function viewState(page: Page): Promise<ViewState | null> {
  const raw = await readoutText(page, 'view-state');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ViewState;
  } catch {
    return null;
  }
}

/** True once a selector exists inside the scoped grid (shadow-pierced). */
async function gridHas(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
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
    if (!scope) return false;
    const grid = findFirst(scope, 'table[role="grid"]');
    return !!(grid && grid.querySelector(sel));
  }, selector);
}

/** Body row count (tbody tr), shadow-pierced. */
async function bodyRowCount(page: Page): Promise<number> {
  return (await visibleIds(page)).length;
}

/** Let the page render `n` animation frames (a deterministic settle — no wall-clock wait). */
async function settleFrames(page: Page, n = 3): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let left = count;
        const step = () => (--left <= 0 ? done() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    n,
  );
}

const OWNER_COL = 4;
const TITLE_COL = 1;

/** filter owner=Dana → [1,4]; edit row 0's owner to Sam → the row is held on screen. */
async function holdEditedOwner(page: Page): Promise<void> {
  await clickTestId(page, 'filter-owner-dana');
  await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '4']);
  await enterEditAt(page, 'grid-table', 0, OWNER_COL);
  await commitEditorValue(page, 'Sam');
  await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.owner, { timeout: 10_000 }).toBe('Sam');
}

/** A plain-table (interactionMode 'table') instance's state, shadow-pierced: the visible row
 *  ids (first cell of each body row) and the open editor's value + its row's id. */
async function tableModeState(
  page: Page,
  scopeTestId: string,
): Promise<{ ids: string[]; editor: { value: string; rowId: string } | null }> {
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
    const tbl = scope ? findFirst(scope, 'table') : null;
    if (!tbl) return { ids: [], editor: null };
    const ids = Array.from(tbl.querySelectorAll('tbody tr')).map((tr) => {
      const c = tr.querySelector('td');
      return ((c && c.textContent) || '').trim();
    });
    const ed = tbl.querySelector('[data-editing-cell]') as HTMLInputElement | null;
    if (!ed) return { ids, editor: null };
    const tr = ed.closest('tr');
    const first = tr ? tr.querySelector('td') : null;
    return { ids, editor: { value: String(ed.value ?? ''), rowId: ((first && first.textContent) || '').trim() } };
  }, scopeTestId);
}

/** The grid-table's pagination model readout ({ pageIndex, pageSize }). */
async function pageModel(page: Page): Promise<{ pageIndex: number; pageSize: number } | null> {
  try {
    return JSON.parse(await readoutText(page, 'page-readout'));
  } catch {
    return null;
  }
}

/** grid-table to page 2 at pageSize 3 (rows [4, 5, 6]), optionally with holdView off. */
async function toPageTwo(page: Page, hold: boolean): Promise<void> {
  if (!hold) {
    await clickTestId(page, 'hold-off');
    await expect.poll(async () => (await viewState(page))?.held, { timeout: 10_000 }).toBe(false);
  }
  await clickTestId(page, 'next-page');
  await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['4', '5', '6']);
  expect(await pageModel(page)).toEqual({ pageIndex: 1, pageSize: 3 });
}

/** Still on page 2 (rows [4, 5, 6]) across several frames, with the tab stop on the record
 *  whose title is `title` at row `row`. */
async function expectStillOnPageTwo(page: Page, row: string, title: string): Promise<void> {
  await expect.poll(async () => (await tabStop(page, 'grid-table'))?.title, { timeout: 10_000 }).toBe(title);
  for (let i = 0; i < 3; i++) {
    await settleFrames(page, 3);
    expect(await pageModel(page)).toEqual({ pageIndex: 1, pageSize: 3 });
    expect(await visibleIds(page)).toEqual(['4', '5', '6']);
    expect(await tabStop(page, 'grid-table')).toMatchObject({ row, role: 'gridcell', title });
  }
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

  // table-core reads resolveFilterValue (and autoRemove) off the filter function itself; the
  // <Column> trampoline must forward them from the CURRENT consumer fn. Without forwarding,
  // 'two' reaches the rule unresolved and matches nothing. (autoRemove has no observable
  // effect here: the component writes columnFilters state directly, never via
  // column.setFilterValue, so only resolveFilterValue is provable end to end.)
  runnerFor(target)(`data-table-held-view [${target}]: (p1-e) filterFn.resolveFilterValue on a <Column> filter is forwarded`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'filter-resolve');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '4']);
  });

  runnerFor(target)(`data-table-held-view [${target}]: (p1-f) custom sortingFn on a <Column> orders rows`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'sort-labels-len');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '3', '5', '4', '6', '2']);
  });

  // Turned on by Task 4 (refreshView): closure filterFn sees the latest value after a refresh.
  runnerFor(target)(`data-table-held-view [${target}]: (p1-d) closure filterFn uses latest value after refreshView`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'filter-threshold');
    await expect.poll(async () => (await visibleIds(page)).length, { timeout: 10_000 }).toBe(6);
    await clickTestId(page, 'bump-closure');
    await clickTestId(page, 'refresh-view');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['3', '4', '6']);
  });

  // ── Part 2: holding the view (Task 4) ───────────────────────────────────────────────
  runnerFor(target)(`data-table-held-view [${target}]: (p2-a) edited row stays, counted, refresh removes`, async ({ page }) => {
    await gotoDemo(page, target);
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 0, sortMismatches: 0 });
    await holdEditedOwner(page);
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 1, sortMismatches: 0 });
    expect(await visibleIds(page)).toEqual(['1', '4']);

    await clickTestId(page, 'refresh-view');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['4']);
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 0, sortMismatches: 0 });
  });

  runnerFor(target)(`data-table-held-view [${target}]: (p2-b) sort hold then flip`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'sort-title');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '2', '4', '5', '3', '6']);
    await enterEditAt(page, 'grid-table', 0, TITLE_COL);
    await commitEditorValue(page, 'Zzz');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.title, { timeout: 10_000 }).toBe('Zzz');
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 0, sortMismatches: 1 });
    expect(await visibleIds(page)).toEqual(['1', '2', '4', '5', '3', '6']);

    await clickTestId(page, 'flip-sort');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '6', '3', '5', '4', '2']);
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 0, sortMismatches: 0 });
  });

  runnerFor(target)(`data-table-held-view [${target}]: (p2-c) undo after refresh is counted, not shown`, async ({ page }) => {
    await gotoDemo(page, target);
    await holdEditedOwner(page);
    await clickTestId(page, 'refresh-view');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['4']);

    await clickTestId(page, 'undo-btn');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.owner, { timeout: 10_000 }).toBe('Dana');
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 1, sortMismatches: 0 });
    expect(await visibleIds(page)).toEqual(['4']);

    await clickTestId(page, 'refresh-view');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '4']);
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 0, sortMismatches: 0 });
  });

  runnerFor(target)(`data-table-held-view [${target}]: (p2-d) select-all includes held mismatches`, async ({ page }) => {
    await gotoDemo(page, target);
    await holdEditedOwner(page);
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 1, sortMismatches: 0 });
    await clickTestId(page, 'selection-on');
    await expect.poll(async () => gridHas(page, 'input[type="checkbox"]'), { timeout: 10_000 }).toBe(true);
    await clickTestId(page, 'select-all');
    await expect.poll(async () => readoutText(page, 'selected-count'), { timeout: 10_000 }).toBe('2');
    expect(await bodyRowCount(page)).toBe(2);
    expect((await viewState(page))?.held).toBe(true);
  });

  runnerFor(target)(`data-table-held-view [${target}]: (p2-e) paging walks held rows`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'sort-title');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '2', '4', '5', '3', '6']);
    await enterEditAt(page, 'grid-table', 0, TITLE_COL);
    await commitEditorValue(page, 'Zzz');
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 0, sortMismatches: 1 });
    // Page 2 of the HELD order (live would be [3, 6, 1]).
    await clickTestId(page, 'next-page');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['5', '3', '6']);
    expect(await viewState(page)).toEqual({ held: true, filterMismatches: 0, sortMismatches: 1 });
  });

  runnerFor(target)(`data-table-held-view [${target}]: hold survives r-model echo`, async ({ page }) => {
    await gotoDemo(page, target);
    // holdEditedOwner waits for the model readout to show the edit — the parent has received
    // the two-way write, so the stamped array is on its way back into $props.data.
    await holdEditedOwner(page);
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 1, sortMismatches: 0 });
    // Stability: across several rendered frames after the echo, the row stays and the view stays held.
    for (let i = 0; i < 5; i++) {
      await settleFrames(page, 2);
      expect(await visibleIds(page)).toEqual(['1', '4']);
      expect(await viewState(page)).toEqual({ held: true, filterMismatches: 1, sortMismatches: 0 });
    }
  });

  runnerFor(target)(`data-table-held-view [${target}]: external swap releases the hold`, async ({ page }) => {
    await gotoDemo(page, target);
    await holdEditedOwner(page);
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 1, sortMismatches: 0 });
    await settleFrames(page, 4);
    const countBefore = Number(await readoutText(page, 'view-state-count'));
    // The swapped dataset also gives rows 2 and 3 owner 'Dana': a released view shows
    // [1, 2, 3, 4]; a view still held would keep [1, 4] with filterMismatches 2.
    await clickTestId(page, 'swap-data');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[1]?.owner, { timeout: 10_000 }).toBe('Dana');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '2', '3', '4']);
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 0, sortMismatches: 0 });
    // Exactly ONE view-state-change for the swap (no stale intermediate held-count emit).
    await settleFrames(page, 4);
    expect(Number(await readoutText(page, 'view-state-count'))).toBe(countBefore + 1);
    await clickTestId(page, 'canundo-btn');
    await expect.poll(async () => readoutText(page, 'canundo-readout'), { timeout: 10_000 }).toBe('false');
  });

  // refreshView with holdView OFF still re-runs a closure filterFn (the shallow-copy path).
  runnerFor(target)(`data-table-held-view [${target}]: (p1-d-off) refreshView re-runs a closure filterFn with holdView off`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'hold-off');
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: false, filterMismatches: 0, sortMismatches: 0 });
    await clickTestId(page, 'filter-threshold');
    await expect.poll(async () => (await visibleIds(page)).length, { timeout: 10_000 }).toBe(6);
    await clickTestId(page, 'bump-closure');
    await clickTestId(page, 'refresh-view');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['3', '4', '6']);
    expect((await viewState(page))?.held).toBe(false);
  });

  runnerFor(target)(`data-table-held-view [${target}]: (p2-f) grouping falls back`, async ({ page }) => {
    await gotoDemo(page, target);
    await expect.poll(async () => (await viewState(page))?.held, { timeout: 10_000 }).toBe(true);
    await clickTestId(page, 'group-owner');
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: false, filterMismatches: 0, sortMismatches: 0 });
  });
  // ── Part 3: the active cell follows its record (Task 5; holdView OFF — the live grid) ──
  runnerFor(target)(`data-table-held-view [${target}]: (p3-a) follows after a paste moves the row`, async ({ page }) => {
    await gotoDemo(page, target);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await clickTestId(page, 'sort-title-live');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual(['1', '2', '4', '5', '3', '6']);
    await page.evaluate(() => navigator.clipboard.writeText('Zzz'));
    await focusBodyCellStable(page, 'grid-live', 0, TITLE_COL);
    await page.keyboard.press('Control+v');
    await expect.poll(async () => (await modelRows(page, 'model-readout-live'))[0]?.title, { timeout: 10_000 }).toBe('Zzz');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual(['2', '4', '5', '3', '6', '1']);
    // The pasted row sorted to the end; the active cell (and DOM focus) followed it there.
    await expect.poll(async () => (await activeCellCoords(page, 'grid-live'))?.row, { timeout: 10_000 }).toBe('5');
    expect(await focusedRowTitle(page, 'grid-live')).toBe('Zzz');
    expect((await tabStop(page, 'grid-live'))?.title).toBe('Zzz');
  });

  runnerFor(target)(`data-table-held-view [${target}]: (p3-b) parks when the edited row is filtered out`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'filter-owner-dana-live');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual(['1', '4']);
    await enterEditAt(page, 'grid-live', 0, OWNER_COL);
    await commitEditorValue(page, 'Sam');
    await expect.poll(async () => (await modelRows(page, 'model-readout-live'))[0]?.owner, { timeout: 10_000 }).toBe('Sam');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual(['4']);
    // The row vanished from the view: the active cell parks on the column header, with focus.
    await expect.poll(async () => (await activeCellCoords(page, 'grid-live'))?.role, { timeout: 10_000 }).toBe('columnheader');
    expect((await activeCellCoords(page, 'grid-live'))?.col).toBe(String(OWNER_COL));
    const before = await readoutText(page, 'model-readout-live');
    await page.keyboard.press('a');
    await page.keyboard.press('Enter');
    await settleFrames(page, 4);
    expect(await readoutText(page, 'model-readout-live')).toBe(before);
  });

  // Gamma, not Beta: Beta keeps index 1 under the title sort, so it cannot tell following
  // from the old same-index clamp. Gamma moves 2 → 4.
  runnerFor(target)(`data-table-held-view [${target}]: (p3-c) follows a consumer sort change`, async ({ page }) => {
    await gotoDemo(page, target);
    await expect.poll(async () => (await visibleIds(page, 'grid-live')).length, { timeout: 15_000 }).toBe(6);
    await focusBodyCellStable(page, 'grid-live', 2, TITLE_COL);
    expect(await focusedRowTitle(page, 'grid-live')).toBe('Gamma');
    await clickTestId(page, 'sort-title-live');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual(['1', '2', '4', '5', '3', '6']);
    await expect.poll(async () => (await tabStop(page, 'grid-live'))?.title, { timeout: 10_000 }).toBe('Gamma');
    expect((await tabStop(page, 'grid-live'))?.row).toBe('4');
  });
  // Fix round 1 (#1): an open editor stays on the record it was opened for. Tab-commit under a
  // sort on the edited column relocates the row; the editor Tab opens (owner, same record) must
  // follow it, and committing it writes to that record only.
  runnerFor(target)(`data-table-held-view [${target}]: (p3-d) Tab-advance editor follows its record across the re-sort`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'sort-title-live');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual(['1', '2', '4', '5', '3', '6']);
    await enterEditAt(page, 'grid-live', 0, TITLE_COL);
    const ed = page.locator('[data-editing-cell]').first();
    await ed.fill('Zzz');
    await ed.press('Tab');
    await expect.poll(async () => (await modelRows(page, 'model-readout-live'))[0]?.title, { timeout: 10_000 }).toBe('Zzz');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual(['2', '4', '5', '3', '6', '1']);
    // The editor that opened is the owner cell of the SAME record (id 1, title Zzz).
    await expect.poll(async () => openEditorRow(page, 'grid-live'), { timeout: 10_000 }).toEqual({ id: '1', title: 'Zzz', col: String(OWNER_COL) });
    await settleFrames(page, 4);
    expect(await openEditorRow(page, 'grid-live')).toEqual({ id: '1', title: 'Zzz', col: String(OWNER_COL) });
    expect(await openEditor(page, 'grid-live')).toEqual({ value: 'Dana', col: String(OWNER_COL) });
    await commitEditorValue(page, 'Ann');
    await expect.poll(async () => (await modelRows(page, 'model-readout-live')).map((r) => r.owner), { timeout: 10_000 })
      .toEqual(['Ann', 'Eli', 'Fay', 'Dana', 'Gus', 'Hal']);
    expect((await modelRows(page, 'model-readout-live')).map((r) => r.title)).toEqual(['Zzz', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zed']);
  });

  // Fix round 1 (#3a): a pure view change (no write) that excludes the active record parks.
  runnerFor(target)(`data-table-held-view [${target}]: (p3-e) a filter change excluding the active record parks`, async ({ page }) => {
    await gotoDemo(page, target);
    await focusBodyCellStable(page, 'grid-live', 1, OWNER_COL); // id 2, owner Eli
    await clickTestId(page, 'filter-owner-dana-live');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual(['1', '4']);
    await expect.poll(async () => (await tabStop(page, 'grid-live'))?.role, { timeout: 10_000 }).toBe('columnheader');
    expect((await tabStop(page, 'grid-live'))?.col).toBe(String(OWNER_COL));
    await focusTabStop(page, 'grid-live');
    await expect.poll(async () => (await activeCellCoords(page, 'grid-live'))?.role, { timeout: 10_000 }).toBe('columnheader');
    const before = await readoutText(page, 'model-readout-live');
    await page.keyboard.press('a');
    await page.keyboard.press('Enter');
    await settleFrames(page, 4);
    expect(await readoutText(page, 'model-readout-live')).toBe(before);
  });

  // Fix round 1 (#3b): releasing a hold (holdView on → off) is a view change — a held,
  // no-longer-matching active record parks on its header.
  runnerFor(target)(`data-table-held-view [${target}]: (p3-f) a holdView release parks a held mismatch`, async ({ page }) => {
    await gotoDemo(page, target);
    await holdEditedOwner(page);
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: true, filterMismatches: 1, sortMismatches: 0 });
    await focusBodyCellStable(page, 'grid-table', 0, OWNER_COL); // id 1, now owner Sam (held)
    await clickTestId(page, 'hold-off');
    await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['4']);
    await expect.poll(async () => (await tabStop(page, 'grid-table'))?.role, { timeout: 10_000 }).toBe('columnheader');
    expect((await tabStop(page, 'grid-table'))?.col).toBe(String(OWNER_COL));
  });

  // Fix round 1 (#2): a write on a ONE-WAY `:data` grid is never echoed, so its write flag must
  // not survive an external swap — the swap removing the active record CLAMPS (D-05) rather
  // than parking, on all six targets.
  runnerFor(target)(`data-table-held-view [${target}]: (p3-g) external swap after an un-echoed write clamps`, async ({ page }) => {
    await gotoDemo(page, target);
    await expect.poll(async () => findGridTableWithin(page, 'grid-oneway'), { timeout: 15_000 }).toBe(true);
    await enterEditAt(page, 'grid-oneway', 0, TITLE_COL);
    await commitEditorValue(page, 'Q');
    await expect.poll(async () => openEditor(page, 'grid-oneway'), { timeout: 10_000 }).toBeNull();
    await settleFrames(page, 4);
    await clickTestId(page, 'swap-oneway');
    await expect.poll(async () => visibleIds(page, 'grid-oneway'), { timeout: 10_000 }).toEqual(['2', '3', '4']);
    await settleFrames(page, 4);
    expect(await tabStop(page, 'grid-oneway')).toMatchObject({ row: '0', role: 'gridcell' });
  });
  // ── Final-review wave ───────────────────────────────────────────────────────────────
  // #1: table writes and refreshView() never turn the page (holdView on AND off); a sort or
  // filter change goes to page 1, and the active cell follows its record there (or parks on
  // its header when page 1 does not hold it — "not on the current page" is "left the view").
  for (const hold of [true, false]) {
    const mode = hold ? 'hold' : 'live';
    runnerFor(target)(`data-table-held-view [${target}]: (pg-a/${mode}) an edit and its undo keep page 2`, async ({ page }) => {
      await gotoDemo(page, target);
      await toPageTwo(page, hold);
      await enterEditAt(page, 'grid-table', 1, TITLE_COL); // id 5, Epsilon
      await commitEditorValue(page, 'Edited');
      await expect.poll(async () => (await modelRows(page, 'model-readout'))[4]?.title, { timeout: 10_000 }).toBe('Edited');
      await expectStillOnPageTwo(page, '1', 'Edited');
      await clickTestId(page, 'undo-btn');
      await expect.poll(async () => (await modelRows(page, 'model-readout'))[4]?.title, { timeout: 10_000 }).toBe('Epsilon');
      await expectStillOnPageTwo(page, '1', 'Epsilon');
    });

    runnerFor(target)(`data-table-held-view [${target}]: (pg-b/${mode}) a paste and refreshView() keep page 2`, async ({ page }) => {
      await gotoDemo(page, target);
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await toPageTwo(page, hold);
      await page.evaluate(() => navigator.clipboard.writeText('Pasted'));
      await focusBodyCellStable(page, 'grid-table', 1, TITLE_COL);
      await page.keyboard.press('Control+v');
      await expect.poll(async () => (await modelRows(page, 'model-readout'))[4]?.title, { timeout: 10_000 }).toBe('Pasted');
      await expectStillOnPageTwo(page, '1', 'Pasted');
      await clickTestId(page, 'refresh-view');
      await expectStillOnPageTwo(page, '1', 'Pasted');
    });

    runnerFor(target)(`data-table-held-view [${target}]: (pg-c/${mode}) a filter change goes to page 1 and the cursor follows`, async ({ page }) => {
      await gotoDemo(page, target);
      await toPageTwo(page, hold);
      await focusBodyCellStable(page, 'grid-table', 0, TITLE_COL); // id 4, Delta
      await clickTestId(page, 'filter-owner-dana');
      await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '4']);
      await expect.poll(async () => (await pageModel(page))?.pageIndex, { timeout: 10_000 }).toBe(0);
      await expect.poll(async () => tabStop(page, 'grid-table'), { timeout: 10_000 }).toMatchObject({ row: '1', role: 'gridcell', title: 'Delta' });
      await settleFrames(page, 4);
      expect(await pageModel(page)).toEqual({ pageIndex: 0, pageSize: 3 });
      expect(await tabStop(page, 'grid-table')).toMatchObject({ row: '1', role: 'gridcell', title: 'Delta' });
    });

    runnerFor(target)(`data-table-held-view [${target}]: (pg-d/${mode}) a filter change to page 1 parks a record page 1 lacks`, async ({ page }) => {
      await gotoDemo(page, target);
      await toPageTwo(page, hold);
      await focusBodyCellStable(page, 'grid-table', 1, TITLE_COL); // id 5, Epsilon (owner Gus)
      await clickTestId(page, 'filter-owner-dana');
      await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '4']);
      await expect.poll(async () => (await pageModel(page))?.pageIndex, { timeout: 10_000 }).toBe(0);
      await expect.poll(async () => (await tabStop(page, 'grid-table'))?.role, { timeout: 10_000 }).toBe('columnheader');
      expect((await tabStop(page, 'grid-table'))?.col).toBe(String(TITLE_COL));
    });

    runnerFor(target)(`data-table-held-view [${target}]: (pg-e/${mode}) a sort change goes to page 1 and the cursor follows`, async ({ page }) => {
      await gotoDemo(page, target);
      await toPageTwo(page, hold);
      await focusBodyCellStable(page, 'grid-table', 0, TITLE_COL); // id 4, Delta
      await clickTestId(page, 'sort-title');
      // Title asc: Alpha, Beta, Delta | Epsilon, Gamma, Zed — page 1 holds Delta at row 2.
      await expect.poll(async () => visibleIds(page), { timeout: 10_000 }).toEqual(['1', '2', '4']);
      await expect.poll(async () => (await pageModel(page))?.pageIndex, { timeout: 10_000 }).toBe(0);
      await expect.poll(async () => tabStop(page, 'grid-table'), { timeout: 10_000 }).toMatchObject({ row: '2', role: 'gridcell', title: 'Delta' });
      await settleFrames(page, 4);
      expect(await tabStop(page, 'grid-table')).toMatchObject({ row: '2', role: 'gridcell', title: 'Delta' });
    });
  }

  // #2: an editor opened through the editCell verb in 'table' interaction mode follows its
  // record across a re-sort, and its commit writes to that record. The sort button is
  // dispatched (no focus move), so the editor is not blurred-and-committed by the click.
  runnerFor(target)(`data-table-held-view [${target}]: (tm-a) table-mode editCell editor follows its record across a re-sort`, async ({ page }) => {
    await gotoDemo(page, target);
    await expect.poll(async () => (await tableModeState(page, 'grid-tmode')).ids, { timeout: 15_000 }).toEqual(['1', '2', '3']);
    await clickTestId(page, 'edit-owner-tmode');
    await expect.poll(async () => (await tableModeState(page, 'grid-tmode')).editor, { timeout: 10_000 }).toEqual({ value: 'Dana', rowId: '1' });
    await page.getByTestId('sort-title-desc-tmode').dispatchEvent('click');
    await expect.poll(async () => (await tableModeState(page, 'grid-tmode')).ids, { timeout: 10_000 }).toEqual(['3', '2', '1']);
    await expect.poll(async () => (await tableModeState(page, 'grid-tmode')).editor?.rowId, { timeout: 10_000 }).toBe('1');
    await settleFrames(page, 4);
    expect((await tableModeState(page, 'grid-tmode')).editor).toEqual({ value: 'Dana', rowId: '1' });
    await commitEditorValue(page, 'Ann');
    await expect.poll(async () => (await modelRows(page, 'model-readout-tmode')).map((r) => r.owner), { timeout: 10_000 })
      .toEqual(['Ann', 'Eli', 'Fay']);
  });

  // #3: a write that empties the grid moves focus to a column header, never to <body>.
  runnerFor(target)(`data-table-held-view [${target}]: (em-a) a write that empties the grid keeps focus on a header`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'filter-owner-fay-live');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual(['3']);
    await enterEditAt(page, 'grid-live', 0, OWNER_COL);
    await commitEditorValue(page, 'Sam');
    await expect.poll(async () => (await modelRows(page, 'model-readout-live'))[2]?.owner, { timeout: 10_000 }).toBe('Sam');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual([]);
    await expect.poll(async () => (await activeCellCoords(page, 'grid-live'))?.role, { timeout: 10_000 }).toBe('columnheader');
    await settleFrames(page, 4);
    expect((await activeCellCoords(page, 'grid-live'))?.role).toBe('columnheader');
  });

  // #5a: filterFn / sortingFn on a `:columns` CONFIG entry (the buildConfigDef path):
  // a custom sort, a custom filter (+ its resolveFilterValue) and a built-in filter name.
  runnerFor(target)(`data-table-held-view [${target}]: (cf-a) columns-config filterFn / sortingFn`, async ({ page }) => {
    await gotoDemo(page, target);
    await expect.poll(async () => visibleIds(page, 'grid-cfg'), { timeout: 15_000 }).toEqual(['1', '2', '3', '4', '5', '6']);
    await clickTestId(page, 'sort-labels-len-cfg');
    await expect.poll(async () => visibleIds(page, 'grid-cfg'), { timeout: 10_000 }).toEqual(['1', '3', '5', '4', '6', '2']);
    await clickTestId(page, 'filter-empty-cfg');
    await expect.poll(async () => visibleIds(page, 'grid-cfg'), { timeout: 10_000 }).toEqual(['3', '6']);
    await clickTestId(page, 'filter-resolve-cfg');
    await expect.poll(async () => visibleIds(page, 'grid-cfg'), { timeout: 10_000 }).toEqual(['1', '4']);
    await clickTestId(page, 'filter-labels-x-cfg');
    await expect.poll(async () => visibleIds(page, 'grid-cfg'), { timeout: 10_000 }).toEqual(['5', '2']);
  });

  // #5b: the holdView fallback warning fires exactly once per table, however many re-feeds.
  runnerFor(target)(`data-table-held-view [${target}]: (wn-a) the fallback warning fires once`, async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('holdView falls back')) warnings.push(msg.text());
    });
    await gotoDemo(page, target);
    expect(warnings).toEqual([]);
    await clickTestId(page, 'group-owner');
    await expect.poll(async () => viewState(page), { timeout: 10_000 }).toEqual({ held: false, filterMismatches: 0, sortMismatches: 0 });
    for (const id of ['filter-labels-x', 'clear-filters', 'sort-title', 'flip-sort', 'filter-owner-dana', 'clear-filters']) {
      await clickTestId(page, id);
      await settleFrames(page, 2);
    }
    await settleFrames(page, 4);
    expect(warnings.length).toBe(1);
  });

  // #5c: Tab-advance where the commit filters the record out (holdView off): the editor Tab
  // opened on that record closes WITHOUT writing — nothing is written to the record that now
  // sits at its old index.
  runnerFor(target)(`data-table-held-view [${target}]: (p3-h) Tab-advance editor closes without writing when its record leaves`, async ({ page }) => {
    await gotoDemo(page, target);
    await clickTestId(page, 'filter-title-a-live');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual(['1', '2', '3', '4']);
    await enterEditAt(page, 'grid-live', 0, TITLE_COL);
    const ed = page.locator('[data-editing-cell]').first();
    await ed.fill('Zzz');
    await ed.press('Tab');
    await expect.poll(async () => (await modelRows(page, 'model-readout-live'))[0]?.title, { timeout: 10_000 }).toBe('Zzz');
    await expect.poll(async () => visibleIds(page, 'grid-live'), { timeout: 10_000 }).toEqual(['2', '3', '4']);
    await expect.poll(async () => openEditor(page, 'grid-live'), { timeout: 10_000 }).toBeNull();
    await settleFrames(page, 4);
    expect(await openEditor(page, 'grid-live')).toBeNull();
    const rows = await modelRows(page, 'model-readout-live');
    expect(rows.map((r) => r.title)).toEqual(['Zzz', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zed']);
    expect(rows.map((r) => r.owner)).toEqual(['Dana', 'Eli', 'Fay', 'Dana', 'Gus', 'Hal']);
  });

  // #8: an external swap WITHOUT getRowId (ids are source indices) clamps — it never follows an
  // index-id to an unrelated record. Old view (title desc) [3, 2, 1], cursor on Beta (row 1);
  // new view [3, 4, 2]: the clamp keeps row 1; following index-id "1" would jump to row 0.
  runnerFor(target)(`data-table-held-view [${target}]: (p3-i) external swap without getRowId clamps`, async ({ page }) => {
    await gotoDemo(page, target);
    await expect.poll(async () => visibleIds(page, 'grid-oneway-noid'), { timeout: 15_000 }).toEqual(['3', '2', '1']);
    await focusBodyCellStable(page, 'grid-oneway-noid', 1, TITLE_COL);
    await clickTestId(page, 'swap-noid');
    await expect.poll(async () => visibleIds(page, 'grid-oneway-noid'), { timeout: 10_000 }).toEqual(['3', '4', '2']);
    await settleFrames(page, 4);
    expect(await tabStop(page, 'grid-oneway-noid')).toMatchObject({ row: '1', role: 'gridcell', title: 'Delta' });
  });
}
