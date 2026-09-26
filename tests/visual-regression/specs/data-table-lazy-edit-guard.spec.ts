import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Debug 260926-dtl-edit-guard — clipboard write funnels (paste/cut/clear/fill-drag) and
 * full-row edit (Shift+F2 / the `editRow()` verb) must exclude LAZY PLACEHOLDER rows (rows
 * `virtual`+`manual`+`rowCount` has not loaded yet) from the write, from the `cell-edit-commit`
 * event and from the N-of-M aria-live announce — the SAME exclusion the group-row skip in
 * `applyGridToRange` (clipboardFill.rzts) already gives grouped rows.
 *
 * Pre-fix (RED): `applyGridToRange` resolves a placeholder cell's write index via
 * `sourceIndexOfRow`, whose `currentData().indexOf(placeholderSentinel)` is always -1 (the
 * sentinel is never in the consumer's own array), so it falls back to the VISIBLE index —
 * either a no-op write with a FABRICATED `cell-edit-commit` + inflated announce count, or,
 * inside a sparse hole, the hole gets clobbered with a partial `{ name: <value> }` row via
 * `replaceRowValue`. `beginRowEdit` (editRowLifecycle.rzts) has no placeholder guard at all, so
 * `editRow(idx)` on a placeholder row seeds a row editor from `undefined`s.
 *
 * examples/demos/DataTableLazyEditDemo.rozie (a DEDICATED sibling of DataTableLazyDemo.rozie —
 * see that file's header comment for why it is not the same fixture data-table-lazy.spec.ts
 * drives): `virtual`+`manual`+`rowCount=10000` over 50 loaded rows (0-49); `name` is editable
 * (interactionMode='grid'). `model-readout` JSON-dumps rows 40-69 (the loaded/placeholder
 * boundary) so a fabricated partial row in a hole is directly observable (a hole reads back as
 * `undefined` past the model array's actual length; a fabricated write would show
 * `{ name: ... }`).
 */
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return built ? test : test.fixme;
}

const table = (page: Page) => page.getByTestId('rozie-mount').getByTestId('lazy-table');
const scroller = (page: Page) => table(page).locator('.rdt-scroll');

async function readoutText(page: Page, testid: string): Promise<string> {
  return page.evaluate((id) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(`[data-testid="${id}"]`);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const inner = find(sr); if (inner) return inner; }
      }
      return null;
    };
    const el = find(document);
    return el ? (el.textContent || '').trim() : '';
  }, testid);
}

/** rows.slice(40, 70) — index i in the returned array is model row (40 + i). */
async function modelSlice(page: Page): Promise<Array<{ id: string; name: string } | null>> {
  const raw = await readoutText(page, 'model-readout');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** The `name` column's data-col-index, resolved dynamically off the header (never hardcoded —
 *  the select column injected by selectionMode='multiple' shifts it). */
async function nameColIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const findGridTable = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('table[role="grid"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const inner = findGridTable(sr); if (inner) return inner; }
      }
      return null;
    };
    const grid = findGridTable(document);
    const th = grid ? grid.querySelector('[data-grid-cell][data-col="name"][data-row="__header"]') : null;
    return th ? Number(th.getAttribute('data-col-index')) : -1;
  });
}

async function focusBodyCellByField(page: Page, row: number, field: string): Promise<void> {
  await page.evaluate(({ r, f }) => {
    const findGridTable = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('table[role="grid"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const inner = findGridTable(sr); if (inner) return inner; }
      }
      return null;
    };
    const grid = findGridTable(document);
    if (!grid) return;
    const cell = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col="${f}"]`) as HTMLElement | null;
    if (cell) cell.focus();
  }, { r: row, f: field });
}

async function activeCellRow(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const findGridTable = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('table[role="grid"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const inner = findGridTable(sr); if (inner) return inner; }
      }
      return null;
    };
    const grid = findGridTable(document);
    const active = grid && grid.getRootNode ? (grid.getRootNode() as Document | ShadowRoot).activeElement : document.activeElement;
    const cell = active ? active.closest('[data-grid-cell]') : null;
    return cell ? cell.getAttribute('data-row') : null;
  });
}

async function focusBodyCellStableByField(page: Page, row: number, field: string): Promise<void> {
  await focusBodyCellByField(page, row, field);
  let stableHits = 0;
  await expect
    .poll(
      async () => {
        const r = await activeCellRow(page);
        if (r === String(row)) stableHits += 1;
        else { stableHits = 0; await focusBodyCellByField(page, row, field); }
        return stableHits;
      },
      { timeout: 5_000, intervals: [40, 40, 40, 60, 100] },
    )
    .toBeGreaterThanOrEqual(2);
}

async function gotoLazy(page: Page, target: Target) {
  await page.goto(`/?example=DataTableLazyEdit&target=${target}`);
  await expect(table(page).locator('tbody tr[data-row]').first()).toBeVisible({ timeout: 15_000 });
}

/** Scroll so row 40-69 sits in the rendered window (rows 0-39 loaded except we only load 0-49;
 *  40-49 loaded, 50-69 placeholders), then wait for a placeholder row to actually render. */
async function scrollToBoundary(page: Page) {
  await scroller(page).evaluate((el) => { el.scrollTop = 42 * 40; });
  await expect(table(page).locator('tbody tr[aria-busy="true"]').first()).toBeVisible({ timeout: 5_000 });
}

for (const target of TARGETS) {
  runnerFor(target)(`data-table lazy-edit-guard [${target}]: Ctrl+A + Delete never writes/commits a placeholder row`, async ({ page }) => {
    await gotoLazy(page, target);
    await scrollToBoundary(page);
    await focusBodyCellStableByField(page, 45, 'name');

    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');

    // Exactly the 50 loaded rows committed (never a placeholder among the 9,950 others).
    await expect.poll(async () => Number(await readoutText(page, 'commit-count')), { timeout: 10_000 }).toBe(50);
    // The N-of-M aria-live announce reports the real applied count against the FULL row-space
    // total — never inflated by a fabricated placeholder "success".
    // Ctrl+A spans BOTH visible columns (the auto-injected select column + `name`), so the
    // total is 2 * rowCount; the select column is never editable so it never contributes to
    // `applied` regardless of placeholder status.
    await expect.poll(async () => readoutText(page, 'paste-announce'), { timeout: 5_000 }).toBe('50 of 20000 cells cleared');
    const slice = await modelSlice(page);
    // Loaded rows (40-49 => slice[0..9]) are cleared to ''.
    for (let i = 0; i <= 9; i++) {
      expect(slice[i]?.name).toBe('');
    }
    // Placeholder holes (50-69 => slice[10..29]) are UNTOUCHED — still a hole (past the model array's length, so it reads as `undefined`), never a
    // fabricated partial `{ name: '' }` row.
    for (let i = 10; i < 30; i++) {
      expect(slice[i]).toBeUndefined();
    }
  });

  runnerFor(target)(`data-table lazy-edit-guard [${target}]: paste over a range spanning placeholders skips them`, async ({ page }) => {
    await gotoLazy(page, target);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await scrollToBoundary(page);
    await focusBodyCellStableByField(page, 45, 'name');

    // 11-row TSV block anchored at row 45 (col name) — spans rows 45..55 (loaded 45-49,
    // placeholder 50-55).
    const col = await nameColIndex(page);
    expect(col).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 10; i++) await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe(`55,${col}`);

    const tsv = Array.from({ length: 11 }, (_, i) => 'X' + i).join('\n');
    await page.evaluate((t) => navigator.clipboard.writeText(t), tsv);
    await page.keyboard.press('Control+v');

    // Only the 5 loaded target rows (45-49) commit.
    await expect.poll(async () => Number(await readoutText(page, 'commit-count')), { timeout: 10_000 }).toBe(5);
    const slice = await modelSlice(page);
    expect(slice[5]?.name).toBe('X0'); // row 45
    expect(slice[9]?.name).toBe('X4'); // row 49
    // Rows 50-55 (slice[10..15]) remain untouched holes, never fabricated with X5.."X10".
    for (let i = 10; i <= 15; i++) {
      expect(slice[i]).toBeUndefined();
    }
  });

  runnerFor(target)(`data-table lazy-edit-guard [${target}]: Ctrl+X (cut) clears loaded cells only, never a placeholder`, async ({ page }) => {
    await gotoLazy(page, target);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await scrollToBoundary(page);
    await focusBodyCellStableByField(page, 45, 'name');

    const col = await nameColIndex(page);
    for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe(`53,${col}`);

    await page.keyboard.press('Control+x');

    // Rows 45-49 loaded (5 cells) commit; 50-53 are placeholders (4 more targets, skipped).
    await expect.poll(async () => Number(await readoutText(page, 'commit-count')), { timeout: 10_000 }).toBe(5);
    const slice = await modelSlice(page);
    for (let i = 5; i <= 9; i++) expect(slice[i]?.name).toBe(''); // rows 45-49
    for (let i = 10; i <= 13; i++) expect(slice[i]).toBeUndefined(); // rows 50-53
  });

  runnerFor(target)(`data-table lazy-edit-guard [${target}]: fill-drag over placeholders skips them`, async ({ page }) => {
    await gotoLazy(page, target);
    // Unlike the keyboard-driven tests above, a pointer fill-drag hit-tests REAL screen
    // coordinates (document.elementFromPoint) — it needs the source AND the target cell
    // both within the ACTUALLY VISIBLE 8-row viewport (maxHeight 320px / 40px rows), not
    // merely present somewhere in the virtualizer's overscan-rendered DOM. Scroll so row 45
    // sits at the very top of the viewport: rows 45-52 are then the visible window.
    await scroller(page).evaluate((el) => { el.scrollTop = 45 * 40; });
    await expect(table(page).locator('tbody tr[data-row="45"]')).toBeVisible({ timeout: 5_000 });
    await focusBodyCellStableByField(page, 45, 'name');

    // The fill handle only renders for an EXISTING range (isFillHandleCell requires
    // rangeAnchor+rangeFocus) — seed a degenerate 1x1 range at the active cell first
    // (Shift+Down anchors it at row 45; Shift+Up returns the focus corner to row 45 too).
    const col = await nameColIndex(page);
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowUp');
    await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 }).toBe(`45,${col}`);

    // Source = the single active cell (row 45, "Row 45"). Drag the fill handle down to row 50
    // (still comfortably inside the same visible window) — loaded rows 46-49 + placeholder
    // row 50. Real trusted `page.mouse` input (CDP), not a script-dispatched synthetic
    // PointerEvent — more robust across targets than `element.dispatchEvent(new PointerEvent(...))`,
    // which some pointer-capture-sensitive listeners treat differently from trusted input.
    await page.waitForTimeout(300);
    const handleBox = await table(page).locator('[data-fill-handle]').boundingBox();
    if (!handleBox) throw new Error('fill handle not found');
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    // Re-resolve row 50's box FRESH on every attempt: the virtualizer's own remeasure can
    // nudge row positions by a few px between reads (the same "anchor lurch" class of drift
    // data-table-lazy.spec.ts's anchorOf() convergence-poll works around) — landing exactly on
    // the 49/50 boundary from a stale box reads the wrong row. Retry with a fresh box rather
    // than trusting one snapshot.
    for (let attempt = 0; attempt < 8; attempt++) {
      const targetBox = await table(page).locator(`[data-grid-cell][data-row="50"][data-col-index="${col}"]`).boundingBox();
      if (!targetBox) throw new Error('fill target cell not found');
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 3 });
      if ((await readoutText(page, 'range-readout')) === `50,${col}`) break;
      await page.waitForTimeout(150);
    }
    await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 5_000 }).toBe(`50,${col}`);
    await page.mouse.up();

    // Only rows 46-49 (4 loaded targets) commit — row 45 re-fills itself (no-op, B-08 dedup)
    // and row 50 (placeholder) is skipped.
    await expect.poll(async () => Number(await readoutText(page, 'commit-count')), { timeout: 10_000 }).toBe(4);
    const slice = await modelSlice(page);
    for (let i = 6; i <= 9; i++) expect(slice[i]?.name).toBe('Row 45'); // rows 46-49
    expect(slice[10]).toBeUndefined(); // row 50 — untouched placeholder hole
  });

  runnerFor(target)(`data-table lazy-edit-guard [${target}]: editRow() on a placeholder row never opens a row editor`, async ({ page }) => {
    await gotoLazy(page, target);
    // Scroll row 55 (a placeholder — only 0-49 are loaded) actually INTO the rendered window:
    // the editor branch only ever materializes for a row currently in the DOM, so the bug is
    // only observable with the target row rendered when we check.
    await scroller(page).evaluate((el) => { el.scrollTop = 51 * 40; });
    await expect(table(page).locator('tbody tr[data-row="55"]')).toBeVisible({ timeout: 5_000 });
    await expect(table(page).locator('tbody tr[data-row="55"][aria-busy="true"]')).toBeVisible();

    const before = Number(await readoutText(page, 'commit-count'));
    await page.getByTestId('edit-row-idx').fill('55');
    await page.getByTestId('edit-row-btn').click();

    // No row editor ever mounts on the placeholder row, and nothing commits.
    await page.waitForTimeout(300);
    await expect(table(page).locator('tbody tr[data-row="55"] [data-editing-cell]')).toHaveCount(0);
    await expect(table(page).locator('tbody tr[data-row="55"][aria-busy="true"]')).toBeVisible();
    expect(Number(await readoutText(page, 'commit-count'))).toBe(before);
  });

  runnerFor(target)(`data-table lazy-edit-guard [${target}]: Shift+F2 on a placeholder row never opens a row editor (guard non-regression)`, async ({ page }) => {
    await gotoLazy(page, target);
    await scrollToBoundary(page);
    await focusBodyCellStableByField(page, 55, 'name');

    await page.keyboard.press('Shift+F2');
    await page.waitForTimeout(300);
    await expect(table(page).locator('[data-editing-cell]')).toHaveCount(0);
  });
}
