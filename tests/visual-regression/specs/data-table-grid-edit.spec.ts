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
): Promise<Array<{ id: number; name: string; qty: unknown; note: string; status: string; active: boolean; verified: boolean }>> {
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

// Columns (reordered 2026-07-05 — see the demo's header comment): name(0,text) qty(1,number)
// note(2,#editor drop-in) active(3,checkbox) verified(4,checkbox — always-rejecting
// validator, D-01 vehicle) status(5,select — kept LAST: a checkbox no longer opens an
// editor at all, so B5's Tab-off-the-last-editable-cell vehicle needs an editor-opening
// column here).

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
    const mount = await gotoGrid(page, target);
    await enterEditAt(page, 0, 0); // open the name editor
    // Confirm the editor <input> actually holds focus before the click-away, else the blur
    // (and the commit that rides it) never fires under container/worker load.
    await expect.poll(async () => focusedTag(page), { timeout: 10_000 }).toBe('input');
    // Change the value so the click-away is a REAL commit (a no-op commit emits nothing — #5).
    await mount.locator('[data-editing-cell]').fill('B1Edit');
    const before = await commitCount(page);
    await clickBodyCell(page, 1, 1); // click a DIFFERENT grid cell
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull(); // editor closed
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(before + 1);
    // The real edit was written to the model row 0.
    await expect.poll(async () => (await modelRows(page))[0]?.name, { timeout: 10_000 }).toBe('B1Edit');
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
  //   but no focus is re-seated → focus drops to <body>. Vehicle updated 2026-07-05:
  //   `status` (select, col 5) is now the LAST editable column — a checkbox column no
  //   longer opens ANY editor (the boolean in-place toggle), so it can no longer serve as
  //   this test's "Tab off an OPEN editor at grid end" vehicle.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-edit [${target}]: B5 Tab on the last editable cell keeps focus inside the grid`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    await enterEditAt(page, 3, 5); // last row, last editable col (select)
    await mount.locator('[data-editing-cell]').press('Tab');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    // Focus stayed inside the grid (the active element resolves to a gridcell, not <body>).
    await expect.poll(async () => (await activeCellCoords(page))?.role, { timeout: 10_000 }).toBe('gridcell');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // B24 — type-to-edit / printable key on a select cell does NOT seed a garbage draft.
  //   Pre-fix: beginEdit seeded the printable char into draftValue → select value = 'z'
  //   (garbage). The CHECKBOX half of this historical assertion (a printable key must not
  //   force-check it) is SUPERSEDED 2026-07-05 by the boolean in-place toggle's "printable
  //   key on a checkbox cell opens no editor (type-to-edit disabled)" test below — a
  //   checkbox cell no longer opens ANY editor via a printable key, so there is no draft to
  //   inspect here anymore.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-edit [${target}]: B24 printable key on select does not seed a garbage draft`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    // Select (col 5) — row 0 status='active'. A printable key must NOT seed a garbage option.
    await focusBodyCellStable(page, 0, 5);
    await page.keyboard.press('z');
    await expect.poll(async () => (await openEditor(page))?.tag, { timeout: 10_000 }).toBe('select');
    expect((await openEditor(page))?.value).toBe('active'); // the real option, not 'z'.
    await mount.locator('[data-editing-cell]').press('Escape');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
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
    const mount = await gotoGrid(page, target);
    await enterEditAt(page, 0, 0); // built-in text editor
    // Confirm the editor <input> holds focus before the click-away (else no blur → no commit).
    await expect.poll(async () => focusedTag(page), { timeout: 10_000 }).toBe('input');
    // Change the value so the click-away is a REAL commit (a no-op commit emits nothing — #5).
    await mount.locator('[data-editing-cell]').fill('B26aEdit');
    const before = await commitCount(page);
    await clickBodyCell(page, 2, 0);
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(before + 1);
    // The real edit was written to the model row 0.
    await expect.poll(async () => (await modelRows(page))[0]?.name, { timeout: 10_000 }).toBe('B26aEdit');
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
    // Mutate the drop-in draft so the click-away is a REAL commit (a no-op commit emits nothing — #5).
    // The drop-in renders its <input> in a nested shadow root on Lit, so drive it via the focused
    // input (keyboard) and assert the model changed by inequality (target/shadow agnostic).
    const beforeNote = (await modelRows(page))[0]?.note;
    await page.keyboard.type('X');
    const before = await commitCount(page);
    await clickBodyCell(page, 2, 0);
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(before + 1);
    // The real edit was written to the model row 0 note.
    await expect.poll(async () => (await modelRows(page))[0]?.note, { timeout: 10_000 }).not.toBe(beforeNote);
  });

  // B26c — a #editor drop-in cell (EditorText, own nested shadow root) auto-focuses its
  // inner <input> on open WITHOUT a manual focusEditorInput call. Pre-fix: on Lit,
  // focusEditorWhenReady's gridRoot.querySelector('[data-editing-cell]') cannot pierce the
  // drop-in's OWN nested shadow root, so the input never receives focus (the deepest active
  // element stays the grid cell/body) — the light-DOM targets (react/vue/svelte/solid/
  // angular) and Lit's built-in editors already auto-focus fine (no nested shadow to cross).
  runnerFor(target)(`data-table-grid-edit [${target}]: B26c #editor drop-in auto-focuses its nested-shadow input on open`, async ({ page }) => {
    const mount = await gotoGrid(page, target);
    // Open the note (col 2) #editor drop-in via the component's own auto-focus path — do NOT
    // call focusEditorInput (that would defeat the assertion by manually focusing it).
    await mount.getByTestId('edit-note').click();
    await expect.poll(async () => (await openEditor(page))?.tag, { timeout: 10_000 }).toBe('input');
    // The COMPONENT must have auto-focused the drop-in's nested-shadow <input> — the deepest
    // shadow-pierced active element is 'input', with no manual focus call in between.
    await expect.poll(async () => focusedTag(page), { timeout: 10_000 }).toBe('input');
  });

  // B26d (quick 260711-i5m, editor-owns-focus contract) — a BUILT-IN editor still
  // auto-focuses its input on open, host-direct-focused, guarding against a regression from
  // the g52 shadow-pierce revert + the new !hasEditorSlot host-focus gate (Task 3): a
  // built-in column is never gated (hasEditorSlot is false for it), so it must keep
  // auto-focusing exactly as before. A standalone guard, isolated from B1/B2/B4/B26's other
  // click-away/typing assertions.
  runnerFor(target)(`data-table-grid-edit [${target}]: B26d built-in text editor auto-focuses its input on open (host direct-focus)`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 0); // name (built-in text editor, col 0)
    await page.keyboard.press('F2');
    await expect.poll(async () => (await openEditor(page))?.col, { timeout: 10_000 }).toBe('0');
    // The COMPONENT must have auto-focused the built-in editor's input — no manual focus call.
    await expect.poll(async () => focusedTag(page), { timeout: 10_000 }).toBe('input');
  });

  // ════════════════════════════════════════════════════════════════════════════════
  // Boolean in-place toggle (design doc 2026-07-05, Change 1) — a built-in
  // editor:'checkbox' cell flips + commits INSTANTLY on Space/Enter/F2: no editor opens,
  // EXACTLY ONE cell-edit-commit per keystroke, and the active cell keeps focus (col 3,
  // `active`, row 0 starts false). A printable key on a checkbox cell is a no-op
  // (type-to-edit disabled). A rejecting column validator (col 4, `verified` —
  // `rejectToggle` always returns a string) blocks the toggle entirely (D-01): no model
  // write, no commit-count bump — proven by the model + commit-count staying UNCHANGED.
  // ════════════════════════════════════════════════════════════════════════════════
  runnerFor(target)(`data-table-grid-edit [${target}]: boolean toggle — Space flips+commits instantly, no editor, focus held`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 3); // active column, row 0 (active=false)
    const before = await commitCount(page);
    const beforeValue = (await modelRows(page))[0]?.active;
    await page.keyboard.press(' ');
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(before + 1);
    await expect.poll(async () => (await modelRows(page))[0]?.active, { timeout: 10_000 }).toBe(!beforeValue);
    expect(await openEditor(page)).toBeNull(); // no editor opened
    const coords = await activeCellCoords(page);
    expect(coords?.row).toBe('0');
    expect(coords?.col).toBe('3');
    expect(coords?.tag).not.toBe('input'); // deepest active tag is the CELL, not an editor
  });

  runnerFor(target)(`data-table-grid-edit [${target}]: boolean toggle — Enter flips+commits instantly, no editor, focus held`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 3);
    const before = await commitCount(page);
    const beforeValue = (await modelRows(page))[0]?.active;
    await page.keyboard.press('Enter');
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(before + 1);
    await expect.poll(async () => (await modelRows(page))[0]?.active, { timeout: 10_000 }).toBe(!beforeValue);
    expect(await openEditor(page)).toBeNull();
    const coords = await activeCellCoords(page);
    expect(coords?.row).toBe('0');
    expect(coords?.col).toBe('3');
    expect(coords?.tag).not.toBe('input');
  });

  runnerFor(target)(`data-table-grid-edit [${target}]: boolean toggle — F2 flips+commits instantly, no editor, focus held`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 3);
    const before = await commitCount(page);
    const beforeValue = (await modelRows(page))[0]?.active;
    await page.keyboard.press('F2');
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(before + 1);
    await expect.poll(async () => (await modelRows(page))[0]?.active, { timeout: 10_000 }).toBe(!beforeValue);
    expect(await openEditor(page)).toBeNull();
    const coords = await activeCellCoords(page);
    expect(coords?.row).toBe('0');
    expect(coords?.col).toBe('3');
    expect(coords?.tag).not.toBe('input');
  });

  runnerFor(target)(`data-table-grid-edit [${target}]: boolean toggle — a printable key on a checkbox cell opens no editor (type-to-edit disabled)`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 3);
    const before = await commitCount(page);
    await page.keyboard.press('x');
    // Give any (incorrect) editor-open / commit a moment, then assert neither happened.
    await page.waitForTimeout(300);
    expect(await openEditor(page)).toBeNull();
    expect(await commitCount(page)).toBe(before);
  });

  runnerFor(target)(`data-table-grid-edit [${target}]: boolean toggle — a rejecting validator blocks the toggle (no write, no commit)`, async ({ page }) => {
    await gotoGrid(page, target);
    await focusBodyCellStable(page, 0, 4); // verified column — rejectToggle always rejects
    const before = await commitCount(page);
    const beforeValue = (await modelRows(page))[0]?.verified;
    await page.keyboard.press(' ');
    // Give the (would-be) write a moment, then assert NOTHING changed — the unchanged
    // model + unchanged commit-count IS the proof of "no write" (D-01: there is no editor
    // to keep open on a reject, so the toggle simply does not apply).
    await page.waitForTimeout(300);
    expect(await commitCount(page)).toBe(before);
    expect((await modelRows(page))[0]?.verified).toBe(beforeValue);
    expect(await openEditor(page)).toBeNull();
  });
}
