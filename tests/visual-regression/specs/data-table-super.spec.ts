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
// THEME_SWAP_KNOWN_FAILING — now EMPTY. It held two DIFFERENT live defects, both verified
// red here on 2026-09-11 and both since fixed at the layer that owned them. Kept as a set
// rather than deleted because it is what made each fix's definition of done mechanically
// checkable: a target comes OUT only when its owning plan lands. Do not widen it, and do
// not promote it to a file-wide KNOWN_FAILING (every data-table spec's file-wide set is empty).
//
//   lit   — F-01, CLOSED 2026-09-12. The public tokens were inert inside the Lit leaf's
//           shadow root: base.css mapped public -> `--rdt-*` under the document-level
//           selectors `.rozie-data-table-wrap, .rozie-data-table`, and on Lit BOTH of those
//           elements live inside the shadow root while the `<style id="rdt-theme-*">` sheets
//           sit in document.head. NOT encapsulation — tokens DO inherit across the boundary;
//           only the wiring was mis-placed. Fixed by repeating the wiring under `:host` in
//           DataTable.rozie, guarded so codegen fails the build if the two blocks drift.
//
//   react — N-01, CLOSED 2026-09-15 at the EMITTER. The theme sheet never got enabled
//           because the swap never ran with the new value. Tokens resolve FINE on React
//           (#f7f7f7), so this was never F-01. The demo authors `r-model="$data.theme"` +
//           `@change="applyTheme($data.theme)"` on one <select>; the emitter correctly
//           MERGES them into a single onChange, but emitted
//               const [x, ne] = useState("base");
//               onChange: a => { ne(a.target.value), V(x) }   // V got the PRE-change const
//           `$data.x` is an async `useState` write on React, so the folded-in handler read
//           the value from before the write while a fresh-value ref sat unused one line
//           above; the other five targets read a signal/ref and saw the new one.
//           Emitter-owned, not author-owned: ROZ138 steers authors off a write-then-read
//           THEY wrote, but here the MERGE synthesised the dominated read — the author's
//           source contains no such sequence, so ROZ138 cannot fire and there was nothing
//           for them to fix. The merge now hoists the committed value into a local named for
//           the model cell, shadowing the stale render const for the rest of the merged arrow.
// ═══════════════════════════════════════════════════════════════════════════════════════
const THEME_SWAP_KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set([]);

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

// ═══════════════════════════════════════════════════════════════════════════════════════
// F-05c — a public token set on an ANCESTOR reaches the table while base.css is imported.
// base.css documents "override any token at any ancestor scope (`:root`, `.dark`, a
// wrapper…)", but it declared all 18 defaults on the table's OWN elements, and a value an
// element declares always beats one it would inherit — so an ancestor override was dead on the
// five light-DOM targets whenever base.css (or a bridge, which did the same) was loaded.
// Asserted as computed values: the header background (a plain token), the derived
// `--rdt-select-accent` (which must follow an ancestor's accent), both with base.css alone and
// with the material bridge layered on top; and that the defaults still apply when nothing is set.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`a public token set on an ancestor overrides base.css's default [${target}]`, async ({ page }) => {
    await page.goto(`/?example=DataTableSuper&target=${target}`);
    const enabledIds = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('[id^="rdt-theme-"]'))
        .filter((s) => !(s as HTMLStyleElement & { disabled?: boolean }).disabled)
        .map((s) => s.id)
        .sort()
        .join(','));
    await expect.poll(enabledIds).toBe('rdt-theme-base');
    const headerBg = () => page.locator('thead .rdt-th').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    const selectAccent = () => page.locator('table.rozie-data-table').first()
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--rdt-select-accent').trim());
    // The demo's own <main> (an ancestor of the table; inside the demo's shadow root on Lit,
    // which the locator pierces).
    const setOnAncestor = (name: string, value: string | null) => page.getByTestId('dt-super').evaluate((main, [n, v]) => {
      if (v === null) (main as HTMLElement).style.removeProperty(n as string);
      else (main as HTMLElement).style.setProperty(n as string, v as string);
    }, [name, value] as const);

    // Defaults apply with nothing set (base.css's #f7f7f7 header).
    await expect.poll(headerBg).toBe('rgb(247, 247, 247)');

    await setOnAncestor('--rozie-data-table-header-bg', 'rgb(255, 0, 0)');
    await setOnAncestor('--rozie-data-table-accent', 'rgb(0, 128, 0)');
    await expect.poll(headerBg).toBe('rgb(255, 0, 0)');
    await expect.poll(selectAccent).toBe('rgb(0, 128, 0)');

    // A bridge layered on top must not shadow the ancestor's value either.
    await page.getByTestId('ctl-theme').selectOption('material');
    await expect.poll(enabledIds).toBe('rdt-theme-base,rdt-theme-material');
    await expect.poll(headerBg).toBe('rgb(255, 0, 0)');

    // And removing the ancestor value falls back to the bridge's own mapping, not base's.
    await setOnAncestor('--rozie-data-table-header-bg', null);
    await expect.poll(headerBg).not.toBe('rgb(255, 0, 0)');
    await expect.poll(headerBg).not.toBe('rgb(247, 247, 247)');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// F-05d — a design-system bridge follows a theme scope set on a WRAPPER, and still loses to a
// public token set on an ancestor. A bridge maps the public tokens onto a design system's own
// variables (shadcn `--muted`, Material `--md-sys-color-*`, Bootstrap `--bs-*`). Those
// variables are very often scoped to a subtree — `<div class="dark">`, `data-bs-theme` on a
// wrapper — rather than set on <html>, so the bridge must read them AT the table, not once at
// the document root. Asserted as the header cell's computed background with the design
// system's variable set on the demo's own <main> (a wrapper, not <html>; inside the demo's
// shadow root on Lit): the bridge follows it; a public token on the same wrapper beats it;
// and with the wrapper's variable removed the bridge's own default comes back.
// Lit, stated rather than skipped: in this demo the <rozie-data-table> host sits inside the
// DEMO's shadow root, where no document selector can reach it, so the only thing that gets in
// is an inherited value — the bridge's private `--rdt-ds-*` layer on :root, with the design
// system's variables read at the DOCUMENT ROOT. There the variable is set on <html> instead
// (a wrapper-scoped theme cannot reach a table nested in a shadow root); the public token
// still goes on the wrapper and must still win.
// ═══════════════════════════════════════════════════════════════════════════════════════
const DS_SCOPES = [
  // [bridge, the design-system variable its header-bg reads, a value for it, the resulting rgb]
  ['shadcn', '--muted', '0 100% 50%', 'rgb(255, 0, 0)'],
  ['material', '--md-sys-color-surface-container-highest', 'rgb(0, 0, 255)', 'rgb(0, 0, 255)'],
  ['bootstrap', '--bs-tertiary-bg', 'rgb(0, 128, 0)', 'rgb(0, 128, 0)'],
] as const;
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`a bridge follows a design-system scope set on a wrapper, under an ancestor's public token [${target}]`, async ({ page }) => {
    await page.goto(`/?example=DataTableSuper&target=${target}`);
    const headerBg = () => page.locator('thead .rdt-th').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    const setOnWrapper = (name: string, value: string | null) => page.getByTestId('dt-super').evaluate((main, [n, v]) => {
      if (v === null) (main as HTMLElement).style.removeProperty(n as string);
      else (main as HTMLElement).style.setProperty(n as string, v as string);
    }, [name, value] as const);
    await expect.poll(headerBg).toBe('rgb(247, 247, 247)');

    for (const [bridge, dsVar, dsValue, rgb] of DS_SCOPES) {
      await page.getByTestId('ctl-theme').selectOption(bridge);
      const bridgeDefault = await (async () => {
        await expect.poll(headerBg).not.toBe('rgb(247, 247, 247)');
        return headerBg();
      })();
      const setDs = (v: string | null) => target === 'lit'
        ? page.evaluate(([n, val]) => {
          if (val === null) document.documentElement.style.removeProperty(n as string);
          else document.documentElement.style.setProperty(n as string, val as string);
        }, [dsVar, v] as const)
        : setOnWrapper(dsVar, v);
      await setDs(dsValue);
      await expect.poll(headerBg, `${bridge}: ${dsVar} on the ${target === 'lit' ? 'root' : 'wrapper'}`).toBe(rgb);
      await setOnWrapper('--rozie-data-table-header-bg', 'rgb(255, 0, 255)');
      await expect.poll(headerBg, `${bridge}: public token beats the scope`).toBe('rgb(255, 0, 255)');
      await setOnWrapper('--rozie-data-table-header-bg', null);
      await setDs(null);
      await expect.poll(headerBg, `${bridge}: default back`).toBe(bridgeDefault);
    }
  });
}

// F-05d, Lit with the host REACHABLE: a <rozie-data-table> placed in the document's light DOM
// (not inside another shadow root) under a wrapper that scopes the design system. The bridge's
// rule names the host element, and a document rule for a host beats the component's `:host`
// block, so the design system's variable is read AT the table — the wrapper's value applies.
test(`a bridge follows a design-system scope on a wrapper of a light-DOM Lit host [lit]`, async ({ page }) => {
  test.skip(!existsSync(resolve(__dirname, '../dist/lit/host/entry.lit.html')), 'lit not built');
  await page.goto('/?example=DataTableSuper&target=lit');
  await page.getByTestId('ctl-theme').selectOption('shadcn');
  await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.id = 'ds-wrap';
    const el = document.createElement('rozie-data-table') as HTMLElement & { columns: unknown; data: unknown };
    el.columns = [{ field: 'a', header: 'A' }];
    el.data = [{ a: 1 }];
    wrap.appendChild(el);
    document.body.appendChild(wrap);
  });
  const th = page.locator('#ds-wrap thead .rdt-th').first();
  const bg = () => th.evaluate((e) => getComputedStyle(e).backgroundColor);
  await expect.poll(bg).toBe('rgb(241, 245, 249)'); // shadcn's own --muted default
  await page.evaluate(() => document.getElementById('ds-wrap')!.style.setProperty('--muted', '0 100% 50%'));
  await expect.poll(bg).toBe('rgb(255, 0, 0)');
  await page.evaluate(() => document.getElementById('ds-wrap')!.style.setProperty('--rozie-data-table-header-bg', 'rgb(255, 0, 255)'));
  await expect.poll(bg).toBe('rgb(255, 0, 255)');
});
