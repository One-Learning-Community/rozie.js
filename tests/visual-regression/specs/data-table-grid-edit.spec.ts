import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 63 Wave-1 — the cell-edit-under-grid-nav behavioral battery (B1, B2, B3, B4,
 * B5, B24, B26), RED-first. Drives `examples/demos/DataTableGridEditDemo.rozie`
 * (?example=DataTableGridEdit) across all six targets. Each assertion FAILS on the
 * pre-fix build for the affected targets and PASSES after the shared-source fix is
 * re-emitted (SC-1).
 *
 *   B1 — click-away to another grid cell COMMITS + closes the open built-in editor and
 *        the grid stays navigable (ArrowDown still moves the active cell).
 *   B2 — type-to-edit on a text cell keeps the FIRST typed char (Zeta stays Zeta).
 *   B3 — the built-in number editor commits a Number; an emptied number cell commits
 *        null (not '' / not a string).
 *   B4 — Shift+Tab inside an editor moves the active cell BACKWARD.
 *   B5 — Tab on the LAST editable cell keeps focus INSIDE the grid (no drop to <body>).
 *   B24 — type-to-edit on a checkbox/select cell does NOT seed a forced-checked /
 *        garbage draft.
 *   B26 — a #editor drop-in cell and a built-in cell commit click-away IDENTICALLY.
 *
 * PER-TARGET activeElement READ (A1): the focus checks read the focused element through
 * Lit's shadow root uniformly via `getRootNode().activeElement`. Helpers copied verbatim
 * from data-table-edit.spec.ts / data-table-grid.spec.ts.
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
 * The active cell's [data-row]/[data-col-index]/role read off the focused element,
 * UNIFORM across all six (incl. Lit shadow) via `getRootNode().activeElement`. Returns
 * null when nothing inside the grid is focused. Copied from data-table-grid.spec.ts (A1).
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
 * The open editor element ([data-editing-cell]) descriptor — its tag, type, value, checked,
 * and the owning cell's [data-col-index]. Null when no editor is open. Walks open shadow
 * roots (Lit). Copied from data-table-edit.spec.ts.
 */
async function openEditor(
  page: Page,
): Promise<{ tag: string; type: string | null; value: string; checked: boolean; col: string | null } | null> {
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
    const el = find(document) as (HTMLInputElement & HTMLSelectElement) | null;
    if (!el) return null;
    const cell = el.closest('[data-grid-cell]');
    return {
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      value: el.value != null ? String(el.value) : '',
      checked: !!el.checked,
      col: cell ? cell.getAttribute('data-col-index') : null,
    };
  });
}

/** The deepest shadow-pierced active element's tagName (Lit nests the drop-in editor in its
 *  OWN shadow root, so the editor <input> is below the grid's root activeElement). Copied
 *  from data-table-edit.spec.ts. */
async function focusedTag(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    let active: Element | null = document.activeElement;
    while (active && (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) {
      const sr = (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot as ShadowRoot;
      if (!sr.activeElement) break;
      active = sr.activeElement;
    }
    return active ? active.tagName.toLowerCase() : null;
  });
}

/** Focus the open editor's [data-editing-cell] control directly (deep shadow-pierced). On
 *  Lit a #editor drop-in renders its <input> in its OWN nested shadow root which the
 *  component's gridRoot.querySelector auto-focus can't reach, so the spec focuses it the way
 *  a user clicking into the editor would, isolating the blur→commit parity check (B26). */
async function focusEditorInput(page: Page): Promise<void> {
  await page.evaluate(() => {
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
    const el = find(document) as HTMLElement | null;
    if (el) el.focus();
  });
}

/** Read a readout testid's trimmed text (shadow-pierced), '' when absent. */
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

/** The committed model (JSON.parsed from the model-readout dump). */
async function modelRows(
  page: Page,
): Promise<Array<{ id: number; name: string; qty: unknown; note: string; status: string; active: boolean }>> {
  const raw = await readoutText(page, 'model-readout');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** The commit-count readout (number of cell-edit-commit emits). */
async function commitCount(page: Page): Promise<number> {
  const t = await readoutText(page, 'commit-count');
  return t === '' ? -1 : Number(t);
}

/** Focus a body cell directly by (row, col) — drives @focusin → activeRow/activeColIndex
 *  sync. Walks open shadow roots (Lit). Copied from data-table-edit.spec.ts. */
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

/** Click a body cell box by (row, col) — a genuine mouse click-away (walks open shadow roots). */
async function clickBodyCell(page: Page, row: number, col: number): Promise<void> {
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
    if (cell) {
      cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      cell.focus();
      cell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  }, { r: row, c: col });
}

/** Focus (row, col) and KEEP it focused until the active cell settles there AND HOLDS across a
 *  stability window. Copied from data-table-edit.spec.ts. */
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

/** Settle the grid, focus (row, col), press F2 to open its editor. Copied from
 *  data-table-edit.spec.ts (the editor-open-after-Escape race fix). */
async function enterEditAt(page: Page, row: number, col: number): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const cur = await openEditor(page);
    if (cur?.col === String(col)) return;
    if (cur) {
      await page.keyboard.press('Escape');
      await expect.poll(async () => openEditor(page), { timeout: 5_000 }).toBeNull().catch(() => {});
    }
    await focusBodyCellStable(page, row, col);
    const coords = await activeCellCoords(page);
    if (coords?.row !== String(row) || coords?.col !== String(col)) continue;
    if (await openEditor(page)) continue;
    await page.keyboard.press('F2');
    try {
      await expect.poll(async () => (await openEditor(page))?.col, { timeout: 3_000 }).toBe(String(col));
      return;
    } catch {
      // opened at the wrong col / not at all — re-settle and retry.
    }
  }
  await expect.poll(async () => (await openEditor(page))?.col, { timeout: 3_000 }).toBe(String(col));
}

// Columns: name(0,text) qty(1,number) note(2,#editor drop-in) status(3,select) active(4,checkbox).

async function gotoGrid(page: Page, target: Target) {
  await page.goto(`/?example=DataTableGridEdit&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  const mount = page.getByTestId('rozie-mount');
  const gridTable = mount.getByTestId('grid-table').locator('table[role="grid"]');
  await expect(gridTable).toBeVisible({ timeout: 15_000 });
  return mount;
}

for (const target of TARGETS) {
  // ════════════════════════════════════════════════════════════════════════════════
  // B1 — click-away to another grid cell COMMITS + closes the built-in editor; the grid
  //   stays navigable. Pre-fix: onEditorBlur skips commit when relatedTarget is inside
  //   gridRoot → the editor stays open + onGridKeyDown early-returns while editing.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-edit [${target}]: B1 click-away to another grid cell commits+closes; grid stays navigable`, async ({ page }) => {
    await gotoGrid(page, target);
    await enterEditAt(page, 0, 0); // open the name editor
    // Confirm the editor <input> actually holds focus before the click-away, else the blur
    // (and the commit that rides it) never fires under container/worker load.
    await expect.poll(async () => focusedTag(page), { timeout: 10_000 }).toBe('input');
    const before = await commitCount(page);
    await clickBodyCell(page, 1, 1); // click a DIFFERENT grid cell
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull(); // editor closed
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(before + 1);
    // The grid is navigable again: ArrowDown moves the active cell off row 1.
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('1');
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await activeCellCoords(page))?.row, { timeout: 10_000 }).toBe('2');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B2 — type-to-edit on the text cell (0,0) keeps the FIRST typed char. Pre-fix:
  //   focusEditorWhenReady's unconditional el.select() selects the seeded char so the
  //   next keystroke replaces it (Zeta → eta).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-edit [${target}]: B2 type-to-edit preserves the leading char (Zeta stays Zeta)`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('Z'); // type-to-edit: seeds the editor draft with 'Z'
    await expect.poll(async () => (await openEditor(page))?.col, { timeout: 10_000 }).toBe('0');
    // Confirm the seeded editor <input> holds focus (caret AFTER the seeded char) before
    // typing the rest, else the appended chars go nowhere under container/worker load.
    await expect.poll(async () => focusedTag(page), { timeout: 10_000 }).toBe('input');
    await page.keyboard.type('eta'); // append into the now-open editor
    await expect.poll(async () => (await openEditor(page))?.value, { timeout: 10_000 }).toBe('Zeta');
    await mount.locator('[data-editing-cell]').press('Enter');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    await expect.poll(async () => (await modelRows(page))[0]?.name, { timeout: 10_000 }).toBe('Zeta');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B3 — the built-in number editor commits a Number; an emptied cell commits null.
  //   Pre-fix: commitEdit writes the raw draft STRING ('42'); an empty draft writes ''.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-edit [${target}]: B3 number editor commits a Number; emptied cell commits null`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    await enterEditAt(page, 0, 1); // qty (number)
    {
      const ed = mount.locator('[data-editing-cell]');
      await ed.fill('42');
      await ed.press('Enter');
    }
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    await expect.poll(async () => typeof (await modelRows(page))[0]?.qty, { timeout: 10_000 }).toBe('number');
    expect((await modelRows(page))[0]?.qty).toBe(42);
    // Clear the number cell → commit null (not '' / not a string).
    await enterEditAt(page, 0, 1);
    {
      const ed = mount.locator('[data-editing-cell]');
      await ed.fill('');
      await ed.press('Enter');
    }
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    await expect.poll(async () => (await modelRows(page))[0]?.qty, { timeout: 10_000 }).toBeNull();
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B4 — Shift+Tab inside an editor moves the active cell BACKWARD. Pre-fix: the Tab
  //   handler always advances FORWARD (nextEditableCell), ignoring shiftKey.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-edit [${target}]: B4 Shift+Tab moves the active cell backward`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    await enterEditAt(page, 0, 1); // qty (col 1)
    await mount.locator('[data-editing-cell]').press('Shift+Tab');
    // The editor re-opens on the PREVIOUS editable cell (col 0, name — a built-in editor).
    await expect.poll(async () => (await openEditor(page))?.col, { timeout: 10_000 }).toBe('0');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B5 — Tab on the LAST editable cell of the LAST row keeps focus INSIDE the grid.
  //   Pre-fix: nextEditableCell returns null at grid end → the editor commits + closes
  //   but no focus is re-seated → focus drops to <body>.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-edit [${target}]: B5 Tab on the last editable cell keeps focus inside the grid`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    await enterEditAt(page, 3, 4); // last row, last editable col (checkbox)
    await mount.locator('[data-editing-cell]').press('Tab');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    // Focus stayed inside the grid (the active element resolves to a gridcell, not <body>).
    await expect.poll(async () => (await activeCellCoords(page))?.role, { timeout: 10_000 }).toBe('gridcell');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B24 — type-to-edit / printable key on a checkbox/select cell does NOT seed a
  //   forced-checked / garbage draft. Pre-fix: beginEdit seeds the printable char into
  //   draftValue → checkbox checked = !!'x' = true (forced); select value = 'x' (garbage).
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-edit [${target}]: B24 printable key on checkbox/select does not seed a forced/garbage draft`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    // Checkbox (col 4) — row 0 active=false. A printable key must NOT force-check it.
    await focusBodyCellStable(page, 0, 4);
    await page.keyboard.press('x');
    await expect.poll(async () => (await openEditor(page))?.type, { timeout: 10_000 }).toBe('checkbox');
    expect((await openEditor(page))?.checked).toBe(false); // reflects the real value, not a seeded true.
    await mount.locator('[data-editing-cell]').press('Escape');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    // Select (col 3) — row 0 status='active'. A printable key must NOT seed a garbage option.
    await focusBodyCellStable(page, 0, 3);
    await page.keyboard.press('z');
    await expect.poll(async () => (await openEditor(page))?.tag, { timeout: 10_000 }).toBe('select');
    expect((await openEditor(page))?.value).toBe('active'); // the real option, not 'z'.
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B26 — a #editor drop-in cell and a built-in cell commit click-away IDENTICALLY.
  //   Pre-fix: the drop-in (EditorText) commits on ANY blur, but the built-in only
  //   commits on blur-leaving-grid → click-away to another cell is inconsistent.
  // ════════════════════════════════════════════════════════════════════════════════
  // B26a — a BUILT-IN editor commits + closes on click-away to another grid cell (the
  // parity baseline). Single navigation per test so the click-away focus teardown is not
  // coupled across the two editor kinds.
  runnerFor(target)(`data-table-grid-edit [${target}]: B26 built-in editor commits on click-away`, async ({ page }) => {
    await gotoGrid(page, target);
    await enterEditAt(page, 0, 0); // built-in text editor
    // Confirm the editor <input> holds focus before the click-away (else no blur → no commit).
    await expect.poll(async () => focusedTag(page), { timeout: 10_000 }).toBe('input');
    const before = await commitCount(page);
    await clickBodyCell(page, 2, 0);
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(before + 1);
  });

  // B26b — a #editor DROP-IN editor (EditorText) commits + closes on click-away IDENTICALLY
  // to the built-in (same one-commit-then-closed semantics).
  runnerFor(target)(`data-table-grid-edit [${target}]: B26 #editor drop-in commits on click-away identically`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    // Open the note (col 2) #editor drop-in via the editCell handle (deterministic open).
    // Assert by TAG, not the owning-cell col: on Lit the EditorText drop-in renders its
    // <input> in its OWN nested shadow root, so input.closest('[data-grid-cell]') can't cross
    // that boundary to read data-col-index (the col is read fine on the 5 light-DOM targets).
    await mount.getByTestId('edit-note').click();
    await expect.poll(async () => (await openEditor(page))?.tag, { timeout: 10_000 }).toBe('input');
    // The drop-in commits on BLUR — focus its <input> (as a user editing it would) and confirm
    // focus landed, else the click-away produces no blur (and no commit).
    await focusEditorInput(page);
    await expect.poll(async () => focusedTag(page), { timeout: 10_000 }).toBe('input');
    const before = await commitCount(page);
    await clickBodyCell(page, 2, 0);
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(before + 1);
  });
}
