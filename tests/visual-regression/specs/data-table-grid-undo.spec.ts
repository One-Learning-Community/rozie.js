import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260709-8ct — grid-wide Undo/Redo behavioral battery, RED-first. Drives
 * `examples/demos/DataTableGridUndoDemo.rozie` (?example=DataTableGridUndo) across all six
 * targets, per the approved design
 * (docs/superpowers/specs/2026-07-09-data-table-undo-history-design.md) Testing list:
 *
 *   (a) edit a cell → Ctrl+Z reverts the old value.
 *   (b) Delete/clear a range → Ctrl+Z restores every cleared cell.
 *   (c) paste a block → Ctrl+Z restores the whole block in ONE step.
 *   (d) Ctrl+Y and Ctrl+Shift+Z both redo.
 *   (e) a new edit after an undo clears redo (canRedo() → false).
 *   (f) undoLimit caps depth — the oldest step past the cap is unrecoverable.
 *   (g) an external data swap clears history (post-swap Ctrl+Z is a no-op).
 *   (h) undoable=false → Ctrl+Z is a no-op and no history is held.
 *   (i) verbs undo/redo/canUndo/canRedo/clearHistory behave; history-change is
 *       edge-triggered ({canUndo,canRedo} payload only fires when availability flips).
 *
 * Helpers follow data-table-grid-edit.spec.ts / data-table-grid-clipboard.spec.ts, scoped to
 * a specific grid-table container (`grid-table` / `grid-table-off`) since the fixture mounts
 * TWO DataTable instances on one page.
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

/** Read a readout testid's trimmed text (shadow-pierced, document-wide — every readout id on
 *  this fixture is unique across the page), '' when absent. */
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

interface ModelRow { id: number; label: string; qty: unknown; city: string }

/** The committed model of a scoped instance (JSON.parsed from its model-readout dump). */
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

/** Build a range from the active cell by pressing Shift+<dir> `steps` times. */
async function extendRangeBy(page: Page, dir: 'Right' | 'Left' | 'Down' | 'Up', steps: number): Promise<void> {
  for (let i = 0; i < steps; i++) await page.keyboard.press(`Shift+Arrow${dir}`);
}

async function gotoDemo(page: Page, target: Target): Promise<void> {
  await page.goto(`/?example=DataTableGridUndo&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  await expect
    .poll(async () => findGridTableWithin(page, 'grid-table'), { timeout: 15_000 })
    .toBe(true);
  await expect
    .poll(async () => findGridTableWithin(page, 'grid-table-off'), { timeout: 15_000 })
    .toBe(true);
}

for (const target of TARGETS) {
  // ════════════════════════════════════════════════════════════════════════════════
  // (a) — edit a cell → Ctrl+Z reverts the old value in the model-readout.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-undo [${target}]: (a) edit a cell then Ctrl+Z reverts the old value`, async ({ page }) => {
    await gotoDemo(page, target);
    expect((await modelRows(page, 'model-readout'))[0]?.label).toBe('Alpha');

    await enterEditAt(page, 'grid-table', 0, 0);
    await commitEditorValue(page, 'Zeta');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('Zeta');

    await focusBodyCellStable(page, 'grid-table', 0, 0);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('Alpha');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // (b) — Delete a range → Ctrl+Z restores EVERY cleared cell.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-undo [${target}]: (b) Delete a range then Ctrl+Z restores every cleared cell`, async ({ page }) => {
    await gotoDemo(page, target);
    await focusBodyCellStable(page, 'grid-table', 0, 1); // qty col, row 0
    await extendRangeBy(page, 'Down', 1); // range rows 0..1, qty col

    await page.keyboard.press('Delete');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.qty, { timeout: 10_000 }).toBeNull();
    expect((await modelRows(page, 'model-readout'))[1]?.qty).toBeNull();

    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.qty, { timeout: 10_000 }).toBe(10);
    expect((await modelRows(page, 'model-readout'))[1]?.qty).toBe(20);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // (c) — paste a block → Ctrl+Z restores the WHOLE block in ONE step (one writeData
  //   per paste → one undo step for the whole rectangle).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-undo [${target}]: (c) paste a block then Ctrl+Z restores the whole block in one step`, async ({ page }) => {
    await gotoDemo(page, target);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.evaluate(() => navigator.clipboard.writeText('77\n88'));
    await focusBodyCellStable(page, 'grid-table', 0, 1); // qty col, rows 0..1
    await extendRangeBy(page, 'Down', 1);
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+v');

    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.qty, { timeout: 10_000 }).toBe(77);
    expect((await modelRows(page, 'model-readout'))[1]?.qty).toBe(88);

    // ONE Ctrl+Z restores BOTH cells (a single undo step for the whole pasted block).
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.qty, { timeout: 10_000 }).toBe(10);
    expect((await modelRows(page, 'model-readout'))[1]?.qty).toBe(20);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // (d) — Ctrl+Y AND Ctrl+Shift+Z both redo.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-undo [${target}]: (d) Ctrl+Y and Ctrl+Shift+Z both redo`, async ({ page }) => {
    await gotoDemo(page, target);

    // Ctrl+Y redo.
    await enterEditAt(page, 'grid-table', 0, 0);
    await commitEditorValue(page, 'Eta');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('Eta');
    await focusBodyCellStable(page, 'grid-table', 0, 0);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('Alpha');
    await page.keyboard.press('Control+y');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('Eta');

    // Ctrl+Shift+Z redo, on a fresh edit.
    await enterEditAt(page, 'grid-table', 1, 0);
    await commitEditorValue(page, 'Theta');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[1]?.label, { timeout: 10_000 }).toBe('Theta');
    await focusBodyCellStable(page, 'grid-table', 1, 0);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[1]?.label, { timeout: 10_000 }).toBe('Beta');
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[1]?.label, { timeout: 10_000 }).toBe('Theta');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // (e) — a NEW edit after an undo clears redo (canRedo() → false).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-undo [${target}]: (e) a new edit after an undo clears redo`, async ({ page }) => {
    await gotoDemo(page, target);

    await enterEditAt(page, 'grid-table', 0, 0);
    await commitEditorValue(page, 'Iota');
    await focusBodyCellStable(page, 'grid-table', 0, 0);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('Alpha');

    await page.getByTestId('canredo-btn').click();
    await expect.poll(async () => readoutText(page, 'canredo-readout'), { timeout: 10_000 }).toBe('true');

    // A fresh edit clears the redo stack.
    await enterEditAt(page, 'grid-table', 2, 0);
    await commitEditorValue(page, 'Kappa');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[2]?.label, { timeout: 10_000 }).toBe('Kappa');

    await page.getByTestId('canredo-btn').click();
    await expect.poll(async () => readoutText(page, 'canredo-readout'), { timeout: 10_000 }).toBe('false');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // (f) — undoLimit (=2 on this fixture) caps depth: the OLDEST step past the cap is
  //   unrecoverable. Three sequential edits on the SAME cell (E1, E2, E3) evict the
  //   original 'Alpha' snapshot once the stack exceeds 2; three Ctrl+Z presses land on
  //   'E1' (the oldest RETAINED snapshot), never back on 'Alpha'.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-undo [${target}]: (f) undoLimit caps depth — the oldest step is unrecoverable`, async ({ page }) => {
    await gotoDemo(page, target);

    for (const v of ['E1', 'E2', 'E3']) {
      await enterEditAt(page, 'grid-table', 0, 0);
      await commitEditorValue(page, v);
      await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe(v);
    }

    await focusBodyCellStable(page, 'grid-table', 0, 0);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('E2');
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('E1');
    // The third Ctrl+Z is a no-op — 'Alpha' (the evicted snapshot) is unrecoverable.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    expect((await modelRows(page, 'model-readout'))[0]?.label).toBe('E1');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // (g) — an external data swap clears history (post-swap Ctrl+Z is a no-op).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-undo [${target}]: (g) external data swap clears history`, async ({ page }) => {
    await gotoDemo(page, target);

    await enterEditAt(page, 'grid-table', 0, 0);
    await commitEditorValue(page, 'Lambda');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('Lambda');

    await page.getByTestId('swap-data-btn').click();
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('New1');

    const before = await readoutText(page, 'model-readout');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    expect(await readoutText(page, 'model-readout')).toBe(before);
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // (h) — undoable=false → Ctrl+Z is a no-op and no history is held (the second, default
  //   grid instance, data-testid="grid-table-off").
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-undo [${target}]: (h) undoable=false: Ctrl+Z is a no-op`, async ({ page }) => {
    await gotoDemo(page, target);

    await enterEditAt(page, 'grid-table-off', 0, 0);
    await commitEditorValue(page, 'Mu');
    await expect.poll(async () => (await modelRows(page, 'model-readout-off'))[0]?.label, { timeout: 10_000 }).toBe('Mu');

    await focusBodyCellStable(page, 'grid-table-off', 0, 0);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    // No revert — the edited value stands; undoable=false records no history.
    expect((await modelRows(page, 'model-readout-off'))[0]?.label).toBe('Mu');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // (i) — undo/redo/canUndo/canRedo/clearHistory verbs behave; history-change fires
  //   EDGE-triggered: a SECOND edit that does not flip canUndo/canRedo availability must
  //   NOT bump hist-count (only the first edit's false→true flip does).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-undo [${target}]: (i) verbs behave; history-change is edge-triggered`, async ({ page }) => {
    await gotoDemo(page, target);

    await page.getByTestId('canundo-btn').click();
    await expect.poll(async () => readoutText(page, 'canundo-readout'), { timeout: 10_000 }).toBe('false');
    expect(await readoutText(page, 'hist-count')).toBe('0');

    // First edit: canUndo flips false→true → ONE history-change.
    await enterEditAt(page, 'grid-table', 0, 0);
    await commitEditorValue(page, 'Nu');
    await expect.poll(async () => readoutText(page, 'hist-count'), { timeout: 10_000 }).toBe('1');
    expect(await readoutText(page, 'hist-canundo')).toBe('true');
    expect(await readoutText(page, 'hist-canredo')).toBe('false');

    // Second edit on a DIFFERENT cell: canUndo already true, redo already empty — NEITHER
    // flips, so hist-count must stay at 1 (the edge-triggered contract).
    await enterEditAt(page, 'grid-table', 1, 0);
    await commitEditorValue(page, 'Xi');
    await page.waitForTimeout(300);
    expect(await readoutText(page, 'hist-count')).toBe('1');

    await page.getByTestId('canundo-btn').click();
    await expect.poll(async () => readoutText(page, 'canundo-readout'), { timeout: 10_000 }).toBe('true');

    // clearHistory() empties both stacks — canUndo() flips back to false.
    await page.getByTestId('clear-history-btn').click();
    await page.getByTestId('canundo-btn').click();
    await expect.poll(async () => readoutText(page, 'canundo-readout'), { timeout: 10_000 }).toBe('false');

    // undo()/redo() verbs (not just keyboard) work via $refs.dt.
    await enterEditAt(page, 'grid-table', 2, 0);
    await commitEditorValue(page, 'Omicron');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[2]?.label, { timeout: 10_000 }).toBe('Omicron');
    await page.getByTestId('undo-btn').click();
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[2]?.label, { timeout: 10_000 }).toBe('Gamma');
    await page.getByTestId('redo-btn').click();
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[2]?.label, { timeout: 10_000 }).toBe('Omicron');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // (j) — a NON-data controlled state change (sorting) AFTER an edit must NOT wipe undo
  //   history. This is the DETERMINISTIC face of the #8 root cause: reFeed cleared history
  //   whenever the re-feed $watch fired with the data-write settle window CLOSED — regardless
  //   of whether the DATA actually swapped. A controlled sort/filter tick (or, on a large
  //   table, a slow internal writeback whose own reFeed lands after the 96ms window) was thus
  //   misread as an external dataset swap → clearHistory() → Ctrl+Z no-op. The fix keys the
  //   clear on data ORIGIN (a durable per-write token stamped on the array), so any non-data
  //   watch tick leaves history intact.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-undo [${target}]: (j) a controlled sort after an edit does NOT wipe undo history`, async ({ page }) => {
    await gotoDemo(page, target);
    expect((await modelRows(page, 'model-readout'))[0]?.label).toBe('Alpha');

    // Edit a cell → history recorded.
    await enterEditAt(page, 'grid-table', 0, 0);
    await commitEditorValue(page, 'Kappa');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('Kappa');

    // Let the (old) 96ms data-write settle window close, THEN change a NON-data watched
    // state (the controlled sorting model). Pre-fix, this reFeed read dataWriteSettling===false
    // and wrongly cleared history; post-fix the visible data still carries its origin token.
    await page.waitForTimeout(250);
    await page.getByTestId('toggle-sort-btn').click();
    await page.waitForTimeout(150);

    // History must SURVIVE: Ctrl+Z reverts the edit. model-readout is the DATA array (sort is
    // display-only), so row 0 stays the edited logical row regardless of visual order.
    await focusBodyCellStable(page, 'grid-table', 0, 0);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await modelRows(page, 'model-readout'))[0]?.label, { timeout: 10_000 }).toBe('Alpha');
  });
}
