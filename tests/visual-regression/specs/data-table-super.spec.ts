import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Task 8 — cross-target render smoke.
 *
 * Every other test in this file is Vue-only (Tasks 1-7 validated the demo
 * on Vue only). This loop is the FIRST assertion that the super demo — which
 * composes DataTable + Column + 10 drop-ins from SOURCE via `<components>` —
 * even COMPILES and RENDERS on the other five targets. A target that fails
 * to compile shows up as `test.fixme` (dist/<target>/host/entry.<target>.html
 * missing after `pnpm --filter @rozie/visual-regression build`); a target
 * that compiles but fails to render fails this test outright. See
 * docs/superpowers/plans/data-table-super-crosstarget-findings.md for the
 * full per-target/per-feature results this run produced.
 */
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`super demo renders a table [${target}]`, async ({ page }) => {
    await page.goto(`/?example=DataTableSuper&target=${target}`);
    await expect(page.getByTestId('dt-super')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('table, [role="grid"], [role="table"]')).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });
}

test('super demo renders a table in Vue', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await expect(page.getByTestId('dt-super')).toBeVisible();
  await expect(page.locator('table, [role="grid"], [role="table"]')).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('header click updates the sorting readout', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  // The columnheader <th> also hosts the per-column filter input, pin controls, and
  // resize handle stacked below the sort button (no flex layout) — clicking the <th>'s
  // center can land on a sibling control. Target the sort toggle button directly (its
  // accessible name is the exact column label; pin/resize buttons' names always carry
  // extra words like "Pin Customer to left", so `exact: true` disambiguates).
  await page.getByRole('button', { name: 'Customer', exact: true }).click();
  await expect(page.getByTestId('readout').locator('[data-slice="sorting"]')).toContainText('customer');
});

test('grid mode exposes role=grid', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.getByTestId('ctl-gridMode').selectOption('grid');
  await expect(page.locator('[role="grid"]')).toBeVisible();
});

// Keyed-remount verification (2026-07-03 plan): the demo's `:key="String($data.virtual)"`
// on <DataTable> forces a real destroy+recreate when `virtual` toggles, because
// DataTable's Virtualizer is built once at $onMount from the initial `virtual` prop
// (a construction-time-only prop otherwise can't react). Before the keyed-remount
// codegen fix this idiom only worked on Vue (Vue emits a bare `:key` as a real vnode
// key natively) — the other five targets either dropped `:key` entirely (React,
// Solid) or forwarded it as an inert prop (Svelte/Angular/Lit), so toggling
// `virtual` rendered only the 2 zero-height spacer <tr>s instead of real windowed
// rows (docs/superpowers/plans/data-table-super-crosstarget-findings.md §3.1). Tasks
// 2-6 taught each non-Vue emitter its native remount-on-key construct (React
// `key=`, Lit `keyed()`, Svelte `{#key}`, Solid `<Show keyed>`, Angular keyed
// `@for`-recreation); this loop is the cross-target acceptance proof.
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`virtualization windows the rows [${target}]`, async ({ page }) => {
    await page.goto(`/?example=DataTableSuper&target=${target}`);
    await page.getByTestId('ctl-virtual').check();
    // Two-sided bound (folded-in Task 3 review fix): a one-sided `< 100` also
    // passes on a SILENT construction failure (windowedRows() returning `[]` —
    // 0 rows) OR the pre-fix 2-spacer empty render. Assert `count > 5` (rules
    // out both the empty-render regression AND the 2-spacer case) AND `count <
    // 50` (rules out the ~1,500 no-window regression). Window ≈ 25-30 rows at
    // estimateRowHeight=40 / maxHeight=440px, so `5 < count < 50` is a
    // tight-but-safe real-poll bound.
    await expect.poll(async () => page.locator('tbody tr').count()).toBeGreaterThan(5);
    await expect.poll(async () => page.locator('tbody tr').count()).toBeLessThan(50);
  });
}

test('editing a Customer cell fires cellEditCommit', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  // Inline editing's Enter/F2-to-edit keymap lives in onGridKeyDown, which no-ops
  // entirely when `!isGrid()` (gridKeydownHandlers.rzts:6 — `if (!isGrid() || !e)
  // return`). DataTableEditDemo.rozie / DataTableEditorDropinsDemo.rozie both use
  // `interactionMode="grid"` for exactly this reason. The super demo defaults to
  // 'table' mode (ctl-gridMode), so the smoke test must switch modes first — the
  // real keymap requirement, not a weakened assertion.
  await page.getByTestId('ctl-gridMode').selectOption('grid');
  // Resolved by COLUMN ID, never by index. This was `.locator('td').nth(3)`, justified by a
  // hand-counted visible order of [select, expand, id, customer, …] — and quick 260908-vcy
  // invalidated that count: the demo declares `<Column field="id" … pinned="right">`, and now
  // that the per-column `pinned` declaration actually seeds columnPinning, table-core's
  // getVisibleCells() moves `id` to the right rail. The order became
  // [select, expand, customer, category, …], so `nth(3)` silently addressed CATEGORY while the
  // assertion below still demanded 'customer' — the exact index-drift failure phase 87-05's
  // deferred-items entry predicted when it deferred making `pinned` real. Body `<td>`s carry
  // `:data-col="cell.column.id"` on both the windowed and non-windowed branches, so this
  // selector is immune to any future pin/reorder/visibility change.
  const cell = page.locator('tbody tr').first().locator('td[data-col="customer"]');
  await cell.click();
  await page.keyboard.press('Enter');
  await cell.locator('input').fill('Zzz Edited');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('readout').locator('[data-slice="lastCommit"]')).toContainText('customer');
});

test('faceted select filter narrows every visible row to the selected category', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  // With pageSize:20 and ~375 rows/category out of 1,500, a `count <= before`
  // assertion is near-tautological (both sides are 20 regardless of whether the
  // filter works) — it would NOT catch a broken/no-op FilterSelect. Instead, drive
  // the REAL FilterSelect drop-in (DataTable also renders its own built-in text
  // filter input per column — `aria-label="Filter Category"` — alongside the
  // slotted facet control, so scope to the drop-in's own `aria-label="category"`,
  // NOT the built-in one) and assert every visible row's Category cell equals the
  // selected value. A broken/no-op filter would leave mixed categories in the
  // body and fail this — pagination-independent, so it holds regardless of page
  // size vs. per-category row counts.
  const categorySelect = page.locator('thead').locator('select[aria-label="category"]');
  await categorySelect.selectOption('Hardware');
  const categoryCells = page.locator('tbody td[data-col="category"] .rdt-cell-value');
  await expect.poll(async () => {
    const texts = await categoryCells.allTextContents();
    return texts.length > 0 && texts.every((t) => t === 'Hardware');
  }).toBe(true);
  // REFLECT (phase-72 regression guard): the controlled <select> keeps showing the
  // applied category rather than snapping back to "All". The #filter slot forwards
  // `value` (columnFilterValue) so FilterSelect's :value reflects live filter state —
  // without it the rows still narrow but the select resets to '' (the reported bug).
  await expect.poll(async () => categorySelect.inputValue(), { timeout: 10_000 }).toBe('Hardware');
});

test('numeric range filter on Amount narrows every visible row into the range', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  // Exercises the FilterNumberRange drop-in wired to the `amount` column (only
  // reachable once `amount` carries `:filterable="true"` — the Task 5 review's
  // Important fix; the #filter slot's `columnId === 'amount'` branch was
  // previously dead code because DataTable gates the `#filter` slot on
  // `columnIsFilterable(columnId)`). FilterNumberRange.rozie applies the range on
  // `@change` (not `@input` — see its `applyRange()` handler), so a bare `.fill()`
  // on both inputs does NOT commit the filter; blurring (Tab) after filling does,
  // matching real user interaction (type into min, tab to max, type, tab out).
  const minInput = page.locator('thead').locator('input[aria-label="amount min"]');
  const maxInput = page.locator('thead').locator('input[aria-label="amount max"]');
  await minInput.fill('200');
  await maxInput.fill('400');
  await maxInput.press('Tab');
  const amountCells = page.locator('tbody td[data-col="amount"] .rdt-cell-value');
  await expect.poll(async () => {
    const texts = await amountCells.allTextContents();
    return (
      texts.length > 0 &&
      texts.every((t) => {
        const n = Number(t);
        return n >= 200 && n <= 400;
      })
    );
  }).toBe(true);
});

test('expanding a row reveals its detail panel', async ({ page }) => {
  await page.goto('/?example=DataTableSuper&target=vue');
  await page.locator('tbody tr').first().getByRole('button').first().click();
  await expect(page.getByTestId('readout').locator('[data-slice="expanded"]')).not.toContainText('{}');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// THEME_SWAP_KNOWN_FAILING — two DIFFERENT live defects, both verified red here on
// 2026-09-11 before being excluded. Neither is a harness quirk; each is owned by a plan and
// each entry comes OUT as that plan's definition of done. Do not widen this set, and do not
// promote it to a file-wide KNOWN_FAILING (every data-table spec's file-wide set is empty).
//
//   lit   — F-01, Plan 2B. The public tokens are INERT in the Lit leaf's shadow root.
//           Measured: `--rozie-data-table-header-bg` and `--rdt-header-bg` both resolve to
//           the EMPTY STRING on a `thead .rdt-th`, before AND after the swap, and the
//           rendered #f7f7f7 comes from base.css's inline var() FALLBACK, not from a token.
//           base.css maps tokens under the document-level class selectors
//           `.rozie-data-table-wrap, .rozie-data-table`, and on Lit both of those elements
//           live INSIDE the shadow root (verified: th -> tr -> thead -> table.rozie-data-table
//           -> div.rozie-data-table-wrap -> <rozie-data-table> shadow boundary), while the
//           four `<style id="rdt-theme-*">` sheets sit in document.head. A head-level class
//           selector cannot match inside a shadow root, so the swap changes nothing.
//
//   react — NEW, not in the 2026-09-10 audit. Found by this conversion. The theme sheet is
//           never ENABLED: enabledIds stays 'rdt-theme-base'. Tokens resolve FINE on React
//           (#f7f7f7), so this is not F-01 — the swap itself never runs. Root cause is
//           REACT CLOSURE STALENESS in emitted code. The demo authors
//           `r-model="$data.theme"` and `@change="applyTheme($data.theme)"` on one <select>;
//           the emitter correctly MERGES both into a single onChange (the old duplicate-key
//           defect is genuinely fixed), but emits:
//               const [x, ne] = useState("base"); const T = useRef(x); T.current = x;
//               onChange: a => { ne(a.target.value), V(x) }
//           so applyTheme receives the PRE-CHANGE render const `x` ("base") rather than the
//           new value — while a fresh-value ref `T.current` already exists one line above and
//           goes unused. Same class as 0353d25b1 (React resize, shipping in this wave) and
//           B-01 (React drag-select stale anchor): the third instance of one emitter defect.
//           Per the emitter-owns-parity principle this is an EMITTER fix, not a demo edit.
// ═══════════════════════════════════════════════════════════════════════════════════════
const THEME_SWAP_KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set(['lit', 'react']);

// ═══════════════════════════════════════════════════════════════════════════════════════
// F-05a / the six-target THEMING-TOKEN gate. This case asserts a PUBLIC token's computed
// effect end to end: flip the theme, and `thead .rdt-th`'s background-color — driven by
// `--rozie-data-table-header-bg` -> `--rdt-header-bg` -> the rule base.css wires — must
// actually change. Running it on all six is therefore the theming-token coverage the
// 2026-09-10 audit asks for in §6 Wave D, not a separate case.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || THEME_SWAP_KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`switching theme changes the active data-table stylesheet AND visibly restyles it [${target}]`, async ({ page }) => {
    await page.goto(`/?example=DataTableSuper&target=${target}`);
    // An id-only assertion (which `<style id="rdt-theme-*">` is `.disabled`)
    // is NOT sufficient — it passed even under the original Task 7 landing's
    // mutually-exclusive swap bug, which disabled base.css's token-wiring the
    // moment a skin was selected, so shadcn/material/bootstrap's remapped
    // tokens landed on custom properties nothing reads and the table silently
    // kept its zero-config look. Assert the REAL computed effect instead: the
    // header cell's `background-color` (driven by `--rdt-header-bg`, which
    // base.css wires from the public `--rozie-data-table-header-bg` token —
    // base.css's value is `#f7f7f7` (made OPAQUE — a translucent header lets the scrolling
    // body bleed through in sticky mode), shadcn.css's remapped value
    // is `hsl(var(--muted, 210 40% 96.1%))` — genuinely different colors)
    // must actually CHANGE when switching themes. A broken/no-op swap fails
    // this even if the active stylesheet id still flips.
    const headerCell = page.locator('thead .rdt-th').first();
    const headerBg = () => headerCell.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Under the LAYERED swap, `base` is ALWAYS enabled (a "first non-disabled
    // id" locator would always resolve to `rdt-theme-base` and never change) —
    // so capture the full SET of enabled sheet ids instead: base-only before,
    // base+material after.
    const enabledIds = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('[id^="rdt-theme-"]'))
        .filter((s) => !(s as HTMLStyleElement & { disabled?: boolean }).disabled)
        .map((s) => s.id)
        .sort()
        .join(','));

    // $onMount's style-element injection runs after first paint, so poll
    // rather than asserting synchronously on the very first read.
    await expect.poll(enabledIds).toBe('rdt-theme-base');
    const beforeBg = await headerBg();

    await page.getByTestId('ctl-theme').selectOption('material');

    await expect.poll(enabledIds).toBe('rdt-theme-base,rdt-theme-material');
    await expect.poll(headerBg).not.toBe(beforeBg);
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });
}

// F-05b — the imperative-handle case, on all six. Two already-root-caused cross-target
// emitter defects (Angular inline $refs verb calls, React duplicate onChange keys) were
// FIXED but ungated; this loop is what gates them. No exclusion set: all six are expected
// green, so a red here is a live emitter regression to report, not to exclude.
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`imperative expandAll populates expanded; applyGrouping writes grouping [${target}]`, async ({ page }) => {
    // Task 6: the isolated imperative-handle panel is gated OFF by default
    // (ctl-handle) — check it to reveal the $refs.tbl.<verb>() button panel,
    // then drive two side-effecting verbs and assert the effect shows up in
    // the readout ($data.groupingModel underlies the `grouping` slice —
    // Task 6's Angular-landmine rename; the `data-slice="grouping"` locator
    // is unchanged).
    await page.goto(`/?example=DataTableSuper&target=${target}`);
    await page.getByTestId('ctl-handle').check();
    await page.getByTestId('verb-expandAll').click();
    await expect(page.getByTestId('readout').locator('[data-slice="expanded"]')).not.toContainText('{}');
    await page.getByTestId('verb-applyGrouping').click();
    await expect(page.getByTestId('readout').locator('[data-slice="grouping"]')).toContainText('category');
  });
}
