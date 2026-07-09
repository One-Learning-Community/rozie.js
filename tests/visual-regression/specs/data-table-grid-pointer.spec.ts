import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260708-ni6 — the grid-mode POINTER interaction battery (§1–§5), RED-first.
 *
 * Drives `examples/demos/DataTableGridEditDemo.rozie` (?example=DataTableGridEdit — now
 * carrying the `singleClickEdit` toggle + a read-only `id` column at col 6) and
 * `examples/demos/DataTableGroupTreegridDemo.rozie` (?example=DataTableGroupTreegrid — the
 * grid+grouping fixture) across all six targets. Each assertion FAILS on the pre-fix leaves
 * (no `.rdt-cell-active` class exists anywhere; no @dblclick/@click delegation; no
 * `singleClickEdit` prop) and PASSES after the shared-source re-emit.
 *
 *   §1 Ring         — click body cell (0,0) → its <td> carries `.rdt-cell-active` (the ring
 *                     bug: browsers suppress the UA :focus outline on a mouse-focused <td>).
 *   §3 Dblclick     — double-click editable cell (0,0) → its editor opens (col '0').
 *   §3 Non-editable — double-click the read-only `id` cell (0,6) → no editor opens; the cell
 *                     keeps `.rdt-cell-active` (stays active).
 *   §4 Single off   — default: a plain single click on editable (0,0) → no editor opens.
 *   §4 Single on    — flip singleClickEdit → a plain click on editable (0,0) opens its editor;
 *                     a shift+click does NOT open (range path unaffected).
 *   §5 Group toggle — grid+grouping: double-click a group-header grouped cell → the group
 *                     collapses (its leaf rows disappear → the body row count drops).
 *
 * PER-TARGET activeElement / shadow reads (A1): every DOM read walks open shadow roots so the
 * Lit target is covered uniformly. Helpers copied verbatim from data-table-grid-edit.spec.ts.
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
 * across all six (incl. Lit shadow) via `getRootNode().activeElement`. Null when nothing
 * inside the grid is focused. Copied from data-table-grid-edit.spec.ts (A1).
 */
async function activeCellCoords(
  page: Page,
): Promise<{ row: string | null; col: string | null; role: string | null; tag: string } | null> {
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
      tag: active.tagName.toLowerCase(),
    };
  });
}

/**
 * The open editor element ([data-editing-cell]) descriptor — tag + the owning cell's
 * [data-col-index]. Null when no editor is open. Walks open shadow roots (Lit). Copied from
 * data-table-grid-edit.spec.ts.
 */
async function openEditor(
  page: Page,
): Promise<{ tag: string; col: string | null } | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('[data-editing-cell]');
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
    if (!el) return null;
    const cell = el.closest('[data-grid-cell]');
    return {
      tag: el.tagName.toLowerCase(),
      col: cell ? cell.getAttribute('data-col-index') : null,
    };
  });
}

/** Whether the body cell (row, col) inside a grid carries a given class (shadow-pierced). */
async function cellHasClass(
  page: Page,
  testid: string,
  row: number,
  col: number,
  cls: string,
): Promise<boolean> {
  return page.evaluate(
    ({ id, r, c, k }) => {
      const findScope = (root: Document | ShadowRoot): Element | null => {
        const direct = root.querySelector(`[data-testid="${id}"]`);
        if (direct) return direct;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) {
            const inner = findScope(sr);
            if (inner) return inner;
          }
        }
        return null;
      };
      // The scope may itself be inside a shadow root; then descend into shadow roots for the cell.
      const findCell = (root: Document | ShadowRoot | Element): Element | null => {
        const sel = `[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`;
        const direct = (root as Element).querySelector
          ? (root as Element).querySelector(sel)
          : (root as Document).querySelector(sel);
        if (direct) return direct;
        const all = (root as Element).querySelectorAll
          ? (root as Element).querySelectorAll('*')
          : (root as Document).querySelectorAll('*');
        for (const el of Array.from(all)) {
          const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (shadow) {
            const inner = findCell(shadow);
            if (inner) return inner;
          }
        }
        return null;
      };
      const scope = findScope(document);
      if (!scope) return false;
      const cell = findCell(scope);
      return cell ? cell.classList.contains(k) : false;
    },
    { id: testid, r: row, c: col, k: cls },
  );
}

/** Count the distinct BODY rows (data-row != '__header') rendered in a grid scope. */
async function bodyRowCount(page: Page, testid: string): Promise<number> {
  return page.evaluate((id) => {
    const findScope = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(`[data-testid="${id}"]`);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = findScope(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const collect = (root: Element | ShadowRoot, into: Set<string>): void => {
      const cells = (root as Element).querySelectorAll
        ? (root as Element).querySelectorAll('[data-grid-cell][data-row]')
        : (root as ShadowRoot).querySelectorAll('[data-grid-cell][data-row]');
      for (const cell of Array.from(cells)) {
        const rowAttr = cell.getAttribute('data-row');
        if (rowAttr != null && rowAttr !== '__header') into.add(rowAttr);
      }
      const all = (root as Element).querySelectorAll('*');
      for (const el of Array.from(all)) {
        const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (shadow) collect(shadow, into);
      }
    };
    const scope = findScope(document);
    if (!scope) return -1;
    const rows = new Set<string>();
    collect(scope, rows);
    return rows.size;
  }, testid);
}

/** Focus a body cell directly by (row, col) — drives @focusin → activeRow/activeColIndex sync.
 *  Walks open shadow roots (Lit). Copied from data-table-grid-edit.spec.ts. */
async function focusBodyCell(page: Page, row: number, col: number): Promise<void> {
  await page.evaluate(({ r, c }) => {
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
    if (!grid) return;
    const cell = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`) as HTMLElement | null;
    if (cell) cell.focus();
  }, { r: row, c: col });
}

/** Focus (row, col) and KEEP it focused until the active cell settles there AND HOLDS across a
 *  stability window. Copied from data-table-grid-edit.spec.ts. */
async function focusBodyCellStable(page: Page, row: number, col: number): Promise<void> {
  await focusBodyCell(page, row, col);
  let stableHits = 0;
  await expect
    .poll(
      async () => {
        const a = await activeCellCoords(page);
        if (a?.row === String(row) && a?.col === String(col)) {
          stableHits += 1;
        } else {
          stableHits = 0;
          await focusBodyCell(page, row, col);
        }
        return stableHits;
      },
      { timeout: 5_000, intervals: [40, 40, 40, 60, 100] },
    )
    .toBeGreaterThanOrEqual(2);
}

/** A genuine mouse click on a body cell box by (row, col) — mousedown+focus+mouseup+click
 *  (walks open shadow roots). Optionally holds Shift. Modeled on data-table-grid-edit.spec.ts's
 *  clickBodyCell. */
async function clickBodyCell(page: Page, row: number, col: number, shift = false): Promise<void> {
  await page.evaluate(({ r, c, s }) => {
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
    if (!grid) return;
    const cell = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`) as HTMLElement | null;
    if (cell) {
      const opts = { bubbles: true, shiftKey: s };
      cell.dispatchEvent(new MouseEvent('mousedown', opts));
      cell.focus();
      cell.dispatchEvent(new MouseEvent('mouseup', opts));
      cell.dispatchEvent(new MouseEvent('click', opts));
    }
  }, { r: row, c: col, s: shift });
}

/** A genuine double-click on a body cell box by (row, col): the realistic pointer sequence
 *  (mousedown/focus/mouseup/click ×2 then dblclick), all bubbling to the delegated table root. */
async function dblClickBodyCell(page: Page, row: number, col: number): Promise<void> {
  await page.evaluate(({ r, c }) => {
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
    if (!grid) return;
    const cell = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`) as HTMLElement | null;
    if (!cell) return;
    const opts = { bubbles: true };
    cell.dispatchEvent(new MouseEvent('mousedown', opts));
    cell.focus();
    cell.dispatchEvent(new MouseEvent('mouseup', opts));
    cell.dispatchEvent(new MouseEvent('click', opts));
    cell.dispatchEvent(new MouseEvent('mousedown', opts));
    cell.dispatchEvent(new MouseEvent('mouseup', opts));
    cell.dispatchEvent(new MouseEvent('click', opts));
    cell.dispatchEvent(new MouseEvent('dblclick', opts));
  }, { r: row, c: col });
}

async function gotoGrid(page: Page, target: Target) {
  await page.goto(`/?example=DataTableGridEdit&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  const mount = page.getByTestId('rozie-mount');
  const gridTable = mount.getByTestId('grid-table').locator('table[role="grid"]');
  await expect(gridTable).toBeVisible({ timeout: 15_000 });
  return mount;
}

async function gotoTreegrid(page: Page, target: Target) {
  await page.goto(`/?example=DataTableGroupTreegrid&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  const mount = page.getByTestId('rozie-mount');
  const gridTable = mount.getByTestId('treegrid-table').locator('table[role="grid"]');
  await expect(gridTable).toBeVisible({ timeout: 15_000 });
  // Grouping is applied one frame after mount (the VirtualGroup rAF pattern) — wait for it.
  await expect.poll(async () => (await bodyRowCount(page, 'treegrid-table')), { timeout: 10_000 }).toBe(6);
  return mount;
}

for (const target of TARGETS) {
  // ════════════════════════════════════════════════════════════════════════════════
  // §1 — RING: clicking a body cell shows the state-driven active-cell ring. Pre-fix:
  //   no `.rdt-cell-active` class exists anywhere → RED on all six.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-pointer [${target}]: §1 clicked cell carries .rdt-cell-active`, async ({ page }) => {
    await gotoGrid(page, target);
    await clickBodyCell(page, 0, 0);
    await expect
      .poll(async () => cellHasClass(page, 'grid-table', 0, 0, 'rdt-cell-active'), { timeout: 10_000 })
      .toBe(true);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // §3 — DBLCLICK EDITABLE: double-clicking an editable cell opens its editor.
  //   Pre-fix: no @dblclick delegation → RED.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-pointer [${target}]: §3 double-click editable cell opens the editor`, async ({ page }) => {
    await gotoGrid(page, target);
    await dblClickBodyCell(page, 0, 0);
    await expect.poll(async () => (await openEditor(page))?.col, { timeout: 10_000 }).toBe('0');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // §3 — DBLCLICK NON-EDITABLE: double-clicking the read-only `id` cell (col 6) opens no
  //   editor; the cell stays active (keeps `.rdt-cell-active`).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-pointer [${target}]: §3 double-click non-editable cell is a no-op; cell stays active`, async ({ page }) => {
    await gotoGrid(page, target);
    await dblClickBodyCell(page, 0, 6);
    // No editor opened.
    await page.waitForTimeout(300);
    expect(await openEditor(page)).toBeNull();
    // The cell stays active (the ring persists).
    await expect
      .poll(async () => cellHasClass(page, 'grid-table', 0, 6, 'rdt-cell-active'), { timeout: 10_000 })
      .toBe(true);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // §4 — SINGLE-CLICK-EDIT OFF (default): a plain click on an editable cell does NOT open
  //   the editor (click-to-activate). Pre-fix: no @click delegation → also RED (but so is
  //   the "on" case, so this asserts the DEFAULT is preserved after the fix).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-pointer [${target}]: §4 singleClickEdit off — plain click does not open the editor`, async ({ page }) => {
    await gotoGrid(page, target);
    await clickBodyCell(page, 0, 0);
    await page.waitForTimeout(300);
    expect(await openEditor(page)).toBeNull();
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // §4 — SINGLE-CLICK-EDIT ON: flip the prop → a plain click on an editable cell opens its
  //   editor; a shift+click does NOT (the range path is unaffected). Pre-fix: no @click
  //   delegation + no singleClickEdit prop → RED.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-pointer [${target}]: §4 singleClickEdit on — plain click opens editor; shift+click does not`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    await mount.getByTestId('toggle-single-click-edit').click();
    await expect
      .poll(async () => mount.getByTestId('single-click-edit-state').textContent(), { timeout: 10_000 })
      .toBe('on');
    // A shift+click on an editable cell must NOT open the editor (range extend path).
    await clickBodyCell(page, 0, 0, true);
    await page.waitForTimeout(300);
    expect(await openEditor(page)).toBeNull();
    // A plain click on an editable cell DOES open its editor.
    await clickBodyCell(page, 0, 0);
    await expect.poll(async () => (await openEditor(page))?.col, { timeout: 10_000 }).toBe('0');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // §5 — GROUP-HEADER DBLCLICK toggles the group: double-clicking a group-header grouped
  //   cell collapses the group → its leaf rows disappear (body row count drops from 6→4).
  //   Pre-fix: no @dblclick delegation → RED.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-pointer [${target}]: §5 double-click a group-header cell toggles the group`, async ({ page }) => {
    await gotoTreegrid(page, target);
    // 6 flattened rows: group Fruit(0), Apple(1), Banana(2), group Veg(3), Carrot(4), Pea(5).
    expect(await bodyRowCount(page, 'treegrid-table')).toBe(6);
    // Double-click the Fruit group-header grouped cell (row 0, col 0) → collapse it.
    await dblClickBodyCell(page, 0, 0);
    // Fruit's two leaves disappear → 4 rows remain (group Fruit, group Veg, Carrot, Pea).
    await expect.poll(async () => (await bodyRowCount(page, 'treegrid-table')), { timeout: 10_000 }).toBe(4);
  });
}
