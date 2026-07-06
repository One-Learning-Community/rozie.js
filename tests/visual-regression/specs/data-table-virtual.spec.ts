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

// ── req-2 / req-9 / req-10 helpers ──────────────────────────────────────────────────

/** The trailing spacer <tr.rdt-spacer> td height (padBottom). 0 at scroll-end (no drift). */
async function trailingSpacerHeight(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('.rdt-scroll tbody.rdt-tbody');
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
    const tbody = find(document);
    if (!tbody) return null;
    const spacers = tbody.querySelectorAll('tr.rdt-spacer > td');
    if (!spacers.length) return null;
    // The LAST spacer td is the trailing one; its height is padBottom.
    const last = spacers[spacers.length - 1] as HTMLElement;
    return Math.round(last.getBoundingClientRect().height);
  });
}

/**
 * Drive the windowed container from top to bottom in small steps so EVERY full-model row
 * recycles into the rendered window at least once. With the CR-01 per-commit remeasure each
 * recycled row's true (variable) height is measured as it passes through the window, so
 * virtual-core's getTotalSize() converges from the estimate-seeded total to the real
 * measured total. `step` is kept below the bounded viewport (~400px) so no band is skipped.
 */
async function scrollThroughAll(page: Page, totalHeight: number, step = 200): Promise<void> {
  for (let y = 0; y <= totalHeight; y += step) {
    await scrollWindowTo(page, y);
    await page.waitForTimeout(40);
  }
}

/** Σ of the rendered windowed tr heights (req-2 height-alignment numerator). */
async function sumRenderedRowHeights(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('.rdt-scroll tbody.rdt-tbody');
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
    const tbody = find(document);
    if (!tbody) return null;
    const rows = tbody.querySelectorAll('tr[data-index]');
    let sum = 0;
    for (const r of Array.from(rows)) sum += (r as HTMLElement).getBoundingClientRect().height;
    return Math.round(sum);
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// req-2 — variable-height alignment: Σ rendered tr heights + spacers track the windowing
//         total (getTotalSize, == the rdt-scroll scrollHeight), and the trailing spacer
//         (padBottom) reaches 0 at scroll-end → NO cumulative offset drift. DOM, not pixels.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual [${target}]: variable-height rows abut getTotalSize with no drift; padBottom reaches 0 at end`, async ({
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
    await scrollWindowTo(page, 0);
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);

    // The windowing total = virtual-core's getTotalSize() (== the rdt-scroll scrollHeight).
    // For 500 non-uniform rows this is well above the ~400px viewport (windowing engaged).
    const total = await getTotalSize(page);
    expect(total).not.toBeNull();
    expect(total as number).toBeGreaterThan(400);

    // req-2 — the rendered slice is self-consistent with getTotalSize: padTop + Σ(rendered
    // tr heights) + padBottom == getTotalSize. We read Σ rendered heights + the trailing
    // spacer (padBottom); since padTop = getTotalSize - Σheights - padBottom by construction,
    // Σheights + padBottom must be ≤ getTotalSize (no overlap). Read all THREE on a CONSISTENT
    // snapshot inside one poll: the CR-01 per-commit remeasure can grow the measured rendered
    // heights and getTotalSize together a frame apart, so reading `total` once up-front and
    // `sumH`/`padBottom` later races (Σ catches up before the stale total) — re-read getTotalSize
    // alongside them and poll until the no-overlap invariant holds on a single committed frame.
    await expect
      .poll(
        async () => {
          const t = await getTotalSize(page);
          const s = await sumRenderedRowHeights(page);
          const pb = await trailingSpacerHeight(page);
          if (t == null || s == null || pb == null) return null;
          // Positive == overlap (rows + trailing spacer exceed the total). ≤ 2 px slack for
          // sub-pixel rounding across the 6 targets; on a consistent frame this is ~0.
          return s + pb - t;
        },
        { timeout: 15_000 },
      )
      .toBeLessThanOrEqual(2);

    // req-2 — scroll to the END: the trailing spacer (padBottom) converges to ~0 (the last
    // row's end == getTotalSize). A non-zero residual at the bottom would be cumulative drift.
    await scrollWindowToBottom(page);
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await expect
      .poll(async () => trailingSpacerHeight(page), { timeout: 15_000 })
      .toBeLessThanOrEqual(1);
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// req-2 / CR-01 — RECYCLED variable-height rows are actually MEASURED, not just the initial
//   window. This is the gap that slipped past the original req-2 case: virtual-core only
//   observe()s a node handed to measureElement (its SOLE observer.observe call site,
//   virtual-core@3.17.1 dist/esm/index.js:794-817), and the engine called that once (at
//   mount) for the FIRST window only. Rows that recycle into view on scroll get NEW DOM
//   nodes that were never measured → they keep the 40px estimateRowHeight seed in
//   virtual-core's size cache forever, so getTotalSize() (the windowing scroll range, ==
//   the .rdt-scroll scrollHeight) stays pinned near the estimate-derived total
//   (500 rows × 40px = 20000) instead of converging to the real MEASURED total.
//
//   The fixture's 500 rows cycle 1/2/3 detail lines (20px line-height) → real heights of
//   ~20/40/60px+chrome, so the TRUE measured total (~26.3k) is ~30% ABOVE the 20k estimate.
//   We drive the window top→bottom in small steps so EVERY row recycles into view at least
//   once; with the CR-01 per-commit remeasure each recycled row gets measured as it passes,
//   and getTotalSize() converges up to the real ~26.3k. On the PRE-FIX engine the recycled
//   rows are never measured, so getTotalSize() stays stuck at ~20.3k. Asserting the post-
//   scroll-through total is well ABOVE the estimate cleanly separates the two engines:
//   fixed → ~26.3k (>> 20k), pre-fix → ~20.3k. (Verified: this case PASSES on the fixed
//   engine and FAILS on the pre-CR-01-fix engine — falsified in both directions.)
//
//   Plus the standing invariants: at the very bottom the trailing spacer (padBottom)
//   converges to ~0 (the last row's measured end == getTotalSize, no cumulative drift).
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual [${target}]: RECYCLED variable-height rows are measured — getTotalSize converges to the MEASURED total after full scroll-through (CR-01)`, async ({
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

    await scrollWindowTo(page, 0);
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(200);

    // Before recycling, only the initial window is measured → getTotalSize is dominated by
    // the 40px estimate (≈ 500 × 40 = 20000, ±a window of measured initial rows; the exact
    // pre-recycle value varies a little per target by how many rows the first window measures).
    const totalBefore = await getTotalSize(page);
    expect(totalBefore).not.toBeNull();
    // Sanity: windowing is engaged — the bounded ~400px viewport holds far less than the
    // total content, and the pre-recycle total is in the estimate-dominated band (well below
    // the real measured total of ~26.3k, since the unseen rows are still at the 40px seed).
    expect(totalBefore as number).toBeGreaterThan(10_000);
    expect(totalBefore as number).toBeLessThan(22_000);

    // Drive the window top→bottom in small steps so EVERY row recycles into view and (with
    // the fix) gets measured. getTotalSize then converges UP to the real measured total.
    // Scroll past the (growing) total so the final rows are reached even as it expands.
    await scrollThroughAll(page, (totalBefore as number) + 8_000, 200);
    await scrollWindowTo(page, 0);
    await page.waitForTimeout(300);

    // CR-01 — after full recycling, getTotalSize must have converged WELL ABOVE the estimate
    // (the real measured total is ~26.3k for this fixture). A 24000 floor sits comfortably
    // between the pre-fix stuck value (~17–20.3k, recycled rows never measured) and the
    // measured total (~26.3k):
    //   fixed engine   → ~26305  (PASS)
    //   pre-fix engine → ~17–20.3k  (FAIL)
    // AND it must have grown substantially vs the pre-recycle baseline (convergence, not a
    // target that happened to start high).
    const totalAfter = await getTotalSize(page);
    expect(totalAfter as number).toBeGreaterThan(24_000);
    expect(totalAfter as number).toBeGreaterThan((totalBefore as number) + 3_000);

    // Standing invariant — scroll to the very END: the trailing spacer (padBottom) converges
    // to ~0 (the last measured row's end == getTotalSize → no cumulative offset drift).
    await scrollWindowToBottom(page);
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await expect
      .poll(async () => trailingSpacerHeight(page), { timeout: 15_000 })
      .toBeLessThanOrEqual(1);
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// req-10 — #cell slot correctness under recycling: as rows recycle on scroll, each visible
//          cell's TEXT matches the row at its data-index (no stale/duplicated content). The
//          Lit repeat() / Solid For recycling footgun makes this Lit-critical. Assert TEXT.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual [${target}]: #cell slot content tracks data-index as rows recycle (no stale/dup cells, incl Lit)`, async ({
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

    // Helper: every visible windowed row's "name" cell text must equal `Row <dataIndex+1>`
    // (the demo seeds name = 'Row ' + (i+1), data-index = i). A stale/recycled cell would
    // show a DIFFERENT row's text than its data-index claims.
    const assertCellsMatchIndex = async () => {
      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const find = (root: Document | ShadowRoot): Element | null => {
                const direct = root.querySelector('.rdt-scroll tbody.rdt-tbody');
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
              const tbody = find(document);
              if (!tbody) return 'no-tbody';
              const rows = tbody.querySelectorAll('tr[data-index]');
              if (!rows.length) return 'no-rows';
              for (const r of Array.from(rows)) {
                const idx = Number(r.getAttribute('data-index'));
                // The "name" column cell (data-col="name"); its text is the plain accessor.
                const nameCell = r.querySelector('td[data-col="name"]');
                const txt = (nameCell?.textContent || '').trim();
                if (txt !== 'Row ' + (idx + 1)) return `MISMATCH@${idx}:"${txt}"`;
              }
              return 'OK';
            }),
          { timeout: 15_000 },
        )
        .toBe('OK');
    };

    await scrollWindowTo(page, 0);
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await assertCellsMatchIndex();

    // Recycle the window: scroll down, mid, and to the end — at every settled position the
    // visible cells must still match their data-index (no node carried stale content over).
    await scrollWindowTo(page, 1200);
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await assertCellsMatchIndex();

    await scrollWindowTo(page, 600);
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await assertCellsMatchIndex();

    await scrollWindowToBottom(page);
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await assertCellsMatchIndex();
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// req-9 — pagination⇄virtual: chrome ABSENT under virtual; all rows reachable (last
//         aria-rowindex == full count at scroll-end); manual+virtual still emits a change
//         event. Plus the D-07 dev-warn 3-case console capture (a/b/c).
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual [${target}]: pagination absent + last row reachable; manual+virtual emits change; D-07 warn a/b/c`, async ({
    page,
  }) => {
    // ── req-9 reachability on the 100k fixture: scroll to the end, the LAST rendered
    //    aria-rowindex equals the full model count (every row reachable by scrolling).
    await page.goto(`/?example=DataTableVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect
      .poll(async () => page.getByTestId('row-count').textContent(), { timeout: 20_000 })
      .toBe('100000');
    await expect(mount.locator('.rdt-scroll')).toBeVisible({ timeout: 15_000 });

    // req-9 — pagination chrome ABSENT under virtual.
    await expect(mount.locator('.rdt-pagination')).toHaveCount(0);

    // req-9 — scroll to the END; the largest rendered aria-rowindex == 100000 (1-based map
    // over the full model → the final row is reachable).
    await scrollWindowToBottom(page);
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const find = (root: Document | ShadowRoot): Element | null => {
              const direct = root.querySelector('.rdt-scroll tbody.rdt-tbody');
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
            const tbody = find(document);
            if (!tbody) return -1;
            const rows = tbody.querySelectorAll('tr[data-index]');
            let max = -1;
            for (const r of Array.from(rows)) {
              const ri = Number(r.getAttribute('aria-rowindex'));
              if (ri > max) max = ri;
            }
            return max;
          }),
        { timeout: 20_000 },
      )
      .toBe(100000);

    // ── req-9 manual+virtual emits a change event (selection-change → bound round-trip).
    await page.goto(`/?example=DataTableVirtualWarn&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const warnMount = page.getByTestId('rozie-mount');
    await expect.poll(async () => warnMount.getByTestId('manual-table').locator('.rdt-scroll tbody.rdt-tbody > tr[data-index]').count(), {
      timeout: 20_000,
    }).toBeGreaterThan(0);
    // Check a row in the manual+virtual table → selection-change fires → the bound count
    // readout rises (proves change events still emit with manual+virtual on).
    const manualFirstCheckbox = warnMount
      .getByTestId('manual-table')
      .locator('.rdt-scroll tbody.rdt-tbody > tr[data-index] input.rdt-select-row')
      .first();
    await manualFirstCheckbox.check();
    await expect
      .poll(async () => warnMount.getByTestId('manual-sel-count').textContent(), { timeout: 15_000 })
      .toBe('1');

    // ── req-9 / D-07 dev-warn 3-case console capture. Capture console.warn during a fresh
    //    mount for each case and count the `virtual+pagination` warns.
    const countVirtualPaginationWarns = async (url: string): Promise<number> => {
      const warns: string[] = [];
      const onConsole = (msg: import('@playwright/test').ConsoleMessage) => {
        if (msg.type() === 'warning' || msg.type() === 'error' || msg.type() === 'log') {
          warns.push(msg.text());
        }
      };
      page.on('console', onConsole);
      await page.goto(url);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();
      // Let the post-mount double-rAF warn path run (the warn fires inside the virtual guard
      // after the virtualizer is constructed). Wait for the windowed slice to settle.
      await expect
        .poll(async () => page.getByTestId('rozie-mount').locator('.rdt-scroll tbody.rdt-tbody > tr[data-index], table.rozie-data-table tbody tr').count(), { timeout: 20_000 })
        .toBeGreaterThan(0);
      // Give the deferred warn a beat to flush.
      await page.waitForTimeout(500);
      page.off('console', onConsole);
      return warns.filter((w) => w.includes('virtual+pagination')).length;
    };

    // (a) virtual=true + configured pagination → EXACTLY ONE virtual+pagination warn.
    expect(await countVirtualPaginationWarns(`/?example=DataTableVirtualWarn&target=${target}`)).toBe(1);
    // (b) virtual=true + NO pagination → ZERO warns (the warn-free virtual path).
    expect(await countVirtualPaginationWarns(`/?example=DataTableVirtual&target=${target}`)).toBe(0);
    // (c) virtual=false + pagination → ZERO warns (the warn lives inside the $props.virtual
    //     guard → byte-identical-off is preserved; the non-virtual path never warns).
    expect(await countVirtualPaginationWarns(`/?example=DataTableFilterPaginate&target=${target}`)).toBe(0);
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// SELECT-LEFTMOST-WHEN-PINNED (grouping/layout fix 260706-h2d) — the auto-injected select
//   checkbox column stays the LEFTMOST body cell even when a consumer left-pins a DATA column.
//   The DataTableVirtualStickySelect fixture binds r-model:columnPinning = { left: ['name'] }
//   with selectionMode="multiple". Pre-fix the select column was a CENTER column (pinned:''),
//   so the left-pinned `name` cell rendered to the LEFT of the checkbox (visible order:
//   name, select, city, value → first [data-grid-cell] = name). effectiveColumnPinning() now
//   prepends __rdt_select to columnPinning.left so table-core treats it as left-pinned and
//   getVisibleCells() leads with it (select, name, city, value → first cell = select).
//
//   RED pre-fix: the first body [data-grid-cell] has data-col="name".
//   GREEN post-fix: the first body [data-grid-cell] is the select cell (.rdt-select-td /
//   data-col="__rdt_select").
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual [${target}]: select checkbox column is leftmost body cell even when a data column is pinned left`, async ({
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
    await scrollWindowTo(page, 0);
    await expect.poll(async () => windowedRows(mount).count(), { timeout: 15_000 }).toBeGreaterThan(0);

    // The FIRST grid cell of the first windowed body row is the select checkbox column — it
    // precedes the left-pinned `name` column. RED pre-fix: data-col="name".
    const firstRow = windowedRows(mount).first();
    const firstCell = firstRow.locator('[data-grid-cell]').first();
    await expect(firstCell).toHaveAttribute('data-col', '__rdt_select', { timeout: 15_000 });
    await expect(firstCell).toHaveClass(/rdt-select-td/, { timeout: 15_000 });
    // The checkbox lives inside that leftmost cell.
    await expect(firstCell.locator('input.rdt-select-row')).toHaveCount(1, { timeout: 15_000 });
  });
}
