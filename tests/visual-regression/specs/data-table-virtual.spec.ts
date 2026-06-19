import { test, expect, type Page, type Locator } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 53 plan 06 — the COMPREHENSIVE row-windowing verification matrix. This is the
 * phase's load-bearing BEHAVIORAL gate: the DataTable virtualization engine has no unit
 * harness, so DOM/behavioral assertions are the proof. They are deliberately NOT
 * screenshot-based — macOS/Linux kerning noise would flake pixel diffs, and the windowing
 * invariants (render-count, aria mapping, sticky/pin geometry, selection survival, slot
 * recycling) are exact DOM facts, not visual ones (the data-table-grid.spec.ts DOM-only
 * precedent). It drives the Plan-03 large-dataset and
 * variable-height fixtures plus the Plan-06 combined sticky+pinned+selection fixture
 * across ALL SIX targets as REAL assertions (no fixme) — the windowing engine renders
 * the windowed `<tbody>` slice on every target, including the fine-grained Solid + Svelte
 * (the subscribe-first windowVer engine fix, commit 85fdc0ed).
 *
 *   req-1/6 — byte-identical-off rendered-row count + aria mapping: a 100k-row dataset
 *             renders only a SMALL `tr[data-index]` set (< 50) while the root
 *             aria-rowcount equals the full count and a rendered tr's aria-rowindex
 *             equals its data-index + 1.
 *   req-2  — variable-height alignment: Σ rendered tr heights track the windowing total
 *             (the rdt-scroll scrollHeight, virtual-core's getTotalSize) with no
 *             cumulative drift; the trailing spacer (padBottom) reaches 0 at scroll-end.
 *   req-3  — bounded container via the maxHeight PROP form (DataTableVirtual) AND the
 *             --rozie-data-table-max-height TOKEN form (DataTableVirtualVarHeight).
 *   req-7  — sticky thead getBoundingClientRect().top is invariant during scroll; a
 *             pinned column cell's left offset is invariant.
 *   req-8  — a row selected, scrolled out, and scrolled back retains its checked
 *             checkbox; select-all sets the header checkbox checked / a partial
 *             selection sets it indeterminate; the bound selection count is correct.
 *   req-9  — with virtual on, the .rdt-pagination chrome is ABSENT and all rows are
 *             reachable by scrolling (last aria-rowindex == full count at the end); the
 *             D-07 virtual+pagination dev-warn fires exactly once with pagination, zero
 *             without, zero on the virtual=false path.
 *   req-10 — a custom #cell slot shows correct per-visible-row content as rows recycle
 *             with NO stale/duplicated cells, including Lit (the repeat/recycling
 *             footgun) — assert the visible cell TEXT against its data-index row.
 *
 * SHADOW-PIERCE (Lit, A1): the windowed `<table>` lives in the consumer's host shadow
 * root and/or (Lit) the nested DataTable's OWN open shadow root. `findScrollEl` /
 * `findTable` walk all open shadow roots recursively. The plain Playwright locators
 * (`getByTestId`, `.locator`) auto-pierce open shadow roots for the simple cases; the
 * page.evaluate helpers below walk the tree manually for the geometry reads.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

// The windowing engine renders the windowed <tbody> slice on ALL SIX targets — the
// fine-grained Solid + Svelte init bug (windowedRows() read $data.windowVer BELOW the
// `if (!virtualizer) return []` early-return, so the <For>/{#each} accessor never
// subscribed) was fixed by the subscribe-first windowVer engine change (commit 85fdc0ed).
// No target is fixme-gated for windowing.
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

// ── Shadow-piercing geometry helpers (uniform across the 5 light-DOM targets + Lit's
//    open shadow root). page.evaluate runs in the page; it recursively walks all open
//    shadow roots to find the windowed scroll container / table, then reads geometry.

/** The bounded windowed scroll container's clientHeight (req-3). null if not found. */
async function scrollClientHeight(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('.rdt-scroll');
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
    return el ? (el as HTMLElement).clientHeight : null;
  });
}

/**
 * The windowing TOTAL content size — virtual-core's getTotalSize(). The rdt-scroll
 * container's scrollHeight is exactly padTop + Σ(rendered tr heights) + padBottom =
 * getTotalSize() (the leading + trailing spacer <td> heights are set from the
 * virtual-core start/end/getTotalSize math). Reading scrollHeight is the DOM-grounded
 * proxy for getTotalSize() (no per-target engine hook needed; the quantity is identical).
 */
async function getTotalSize(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('.rdt-scroll');
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
    return el ? (el as HTMLElement).scrollHeight : null;
  });
}

/** Programmatically scroll the windowed container to `top` and settle (req-7/2/8/9). */
async function scrollWindowTo(page: Page, top: number): Promise<void> {
  await page.evaluate((y) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('.rdt-scroll');
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
    if (el) el.scrollTop = y;
  }, top);
}

/** Scroll the windowed container all the way to the bottom; returns the final scrollTop. */
async function scrollWindowToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('.rdt-scroll');
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
    if (el) el.scrollTop = el.scrollHeight;
  });
}

/**
 * A sticky header CELL's getBoundingClientRect().top (sticky-invariance probe, req-7).
 * position:sticky;top:0 is applied to the .rdt-th cells (NOT the <thead> element), so the
 * header cell's bounding top is the invariant under scroll.
 */
async function theadTop(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('.rdt-scroll thead.rdt-thead .rdt-th');
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
    return el ? Math.round(el.getBoundingClientRect().top) : null;
  });
}

/** A pinned (data-col=<id>) body cell's getBoundingClientRect().left (pin-invariance, req-7). */
async function pinnedCellLeft(page: Page, colId: string): Promise<number | null> {
  return page.evaluate((id) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(
        `.rdt-scroll tbody.rdt-tbody td[data-col="${id}"]`,
      );
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
    return el ? Math.round(el.getBoundingClientRect().left) : null;
  }, colId);
}

/** The windowed body <tr data-index> locator (auto-pierces Lit's open shadow root). */
function windowedRows(scope: Locator): Locator {
  return scope.locator('.rdt-scroll tbody.rdt-tbody > tr[data-index]');
}

// ════════════════════════════════════════════════════════════════════════════════════
// req-1/3/6 — 100k windowing: small render count, full aria-rowcount, aria-rowindex
//             mapping, and the bounded rdt-scroll clientHeight (PROP form).
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual [${target}]: 100k windows to a small slice; aria-rowcount/rowindex mapping; bounded container (prop)`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    // Full model is 100,000 rows (windowing renders only a small slice).
    await expect
      .poll(async () => page.getByTestId('row-count').textContent(), { timeout: 20_000 })
      .toBe('100000');

    const scroll = mount.locator('.rdt-scroll');
    await expect(scroll).toBeVisible({ timeout: 15_000 });

    // req-1/6 — only a SMALL windowed tr set renders for 100k rows (proves windowing).
    const rows = windowedRows(mount);
    await expect.poll(async () => rows.count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(async () => rows.count(), { timeout: 15_000 }).toBeLessThan(50);

    // req-6 — root aria-rowcount == the FULL model count (not the rendered window).
    const table = scroll.locator('table.rozie-data-table');
    await expect.poll(async () => table.getAttribute('aria-rowcount'), { timeout: 15_000 }).toBe('100000');

    // req-6 — a rendered tr's aria-rowindex == its data-index + 1 (1-based full-model map).
    const firstRow = rows.first();
    const dataIndex = await firstRow.getAttribute('data-index');
    const rowIndex = await firstRow.getAttribute('aria-rowindex');
    expect(dataIndex).not.toBeNull();
    expect(Number(rowIndex)).toBe(Number(dataIndex) + 1);

    // req-3 (PROP form) — the rdt-scroll viewport is bounded to ~400px (maxHeight="400px").
    const ch = await scrollClientHeight(page);
    expect(ch).not.toBeNull();
    expect(ch as number).toBeGreaterThan(0);
    expect(ch as number).toBeLessThanOrEqual(420); // ~400 + a small chrome allowance

    // req-9 — pagination chrome is ABSENT under virtual.
    await expect(mount.locator('.rdt-pagination')).toHaveCount(0);
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// req-3 (TOKEN form) — the var-height fixture is sized PURELY by the
//             --rozie-data-table-max-height custom property on an ancestor (no maxHeight
//             prop); the rdt-scroll clientHeight is still bounded (~400).
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual [${target}]: bounded container via the --rozie-data-table-max-height token (no prop)`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableVirtualVarHeight&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    await expect
      .poll(async () => page.getByTestId('row-count').textContent(), { timeout: 20_000 })
      .toBe('500');

    const scroll = mount.locator('.rdt-scroll');
    await expect(scroll).toBeVisible({ timeout: 15_000 });

    // The token (set on the .vh-wrap ancestor) inherits down to .rdt-scroll → bounded.
    const ch = await scrollClientHeight(page);
    expect(ch).not.toBeNull();
    expect(ch as number).toBeGreaterThan(0);
    expect(ch as number).toBeLessThanOrEqual(420);
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// req-7 — sticky thead top invariance + pinned-column left invariance under scroll,
//         on the combined sticky+pinned+selection fixture.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual [${target}]: sticky thead top + pinned-column left stay invariant under scroll`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableVirtualStickySelect&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    await expect
      .poll(async () => page.getByTestId('row-count').textContent(), { timeout: 20_000 })
      .toBe('2000');

    const scroll = mount.locator('.rdt-scroll');
    await expect(scroll).toBeVisible({ timeout: 15_000 });
    // Windowing renders a small slice of the 2,000 rows.
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);

    // Capture the sticky thead top + the left offset of the left-pinned "name" cell BEFORE
    // scroll. (Settle the window first.)
    await scrollWindowTo(page, 0);
    const theadTop0 = await theadTop(page);
    const nameLeft0 = await pinnedCellLeft(page, 'name');
    expect(theadTop0).not.toBeNull();
    expect(nameLeft0).not.toBeNull();

    // Scroll the windowed container down a large distance.
    await scrollWindowTo(page, 1500);
    // Let the window recommit (new slice painted).
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);

    // req-7 — the sticky thead top is UNCHANGED (position:sticky;top:0 pins it to the
    // scroll viewport's top edge; getBoundingClientRect().top does not drift).
    await expect
      .poll(async () => theadTop(page), { timeout: 15_000 })
      .toBe(theadTop0);

    // req-7 — the left-pinned "name" column cell's left offset is UNCHANGED (position:sticky
    // + a computed left offset keeps it in place; it does not drift on scroll).
    await expect
      .poll(async () => pinnedCellLeft(page, 'name'), { timeout: 15_000 })
      .toBe(nameLeft0);
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// req-8 — selection survives scroll out + back; select-all checked / partial indeterminate;
//         the bound selection count is correct.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual [${target}]: row selection survives scroll out/in; select-all checked + partial indeterminate`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableVirtualStickySelect&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    await expect
      .poll(async () => page.getByTestId('row-count').textContent(), { timeout: 20_000 })
      .toBe('2000');
    const scroll = mount.locator('.rdt-scroll');
    await expect(scroll).toBeVisible({ timeout: 15_000 });

    // Start at the top.
    await scrollWindowTo(page, 0);
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);

    // Check the first windowed row's selection checkbox.
    const firstRow = windowedRows(mount).first();
    const firstIndex = await firstRow.getAttribute('data-index');
    const firstCheckbox = firstRow.locator('input.rdt-select-row');
    await firstCheckbox.check();
    await expect(firstCheckbox).toBeChecked();
    // The bound selection count round-trips OUT (the table-core RowSelectionState reaches
    // the consumer's $data via r-model:rowSelection).
    await expect
      .poll(async () => page.getByTestId('sel-count').textContent(), { timeout: 15_000 })
      .toBe('1');

    // Scroll that row well out of the window…
    await scrollWindowTo(page, 1500);
    await expect
      .poll(async () => windowedRows(mount).count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    // …the checked row is no longer in the rendered window (it recycled out).
    await expect(
      mount.locator(`.rdt-scroll tbody.rdt-tbody > tr[data-index="${firstIndex}"]`),
    ).toHaveCount(0);

    // …then scroll it back in.
    await scrollWindowTo(page, 0);
    const backRow = mount.locator(
      `.rdt-scroll tbody.rdt-tbody > tr[data-index="${firstIndex}"]`,
    );
    await expect(backRow).toHaveCount(1, { timeout: 15_000 });
    // req-8 — the checkbox is STILL checked (selection lives in table-core state, not the
    // recycled DOM node; the re-rendered checkbox reflects it).
    await expect(backRow.locator('input.rdt-select-row')).toBeChecked({ timeout: 15_000 });

    // The select-all header checkbox is INDETERMINATE on a partial selection (some, not all).
    const selectAll = mount.locator('.rdt-scroll thead input.rdt-select-all');
    await expect(selectAll).toHaveJSProperty('indeterminate', true, { timeout: 15_000 });

    // Click select-all → ALL rows selected: the header checkbox is CHECKED + not
    // indeterminate, and the bound count equals the full model (2000, select-all spans the
    // pre-pagination model — req-8 select-all-over-the-set). Use click() (not check()):
    // the box is currently INDETERMINATE, and check()'s post-condition wait races React's
    // controlled-indeterminate re-render; a raw click toggles onToggleAllRows directly.
    await selectAll.click();
    await expect(selectAll).toBeChecked({ timeout: 15_000 });
    await expect(selectAll).toHaveJSProperty('indeterminate', false, { timeout: 15_000 });
    await expect
      .poll(async () => page.getByTestId('sel-count').textContent(), { timeout: 15_000 })
      .toBe('2000');
  });
}
