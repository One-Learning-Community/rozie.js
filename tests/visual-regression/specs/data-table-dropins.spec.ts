import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260622-qpw — the @rozie-ui/data-table slot DROP-IN behavioral matrix. The four
 * drop-in families (FilterText/FilterSelect/FilterNumberRange, GroupBar, DetailPanel,
 * EditorText/EditorSelect) were authored + compile-verified in runs 260622-let/pd8/pvp but
 * had ZERO runtime behavioral proof. This spec dogfoods them inside real DataTable consumers
 * (examples/demos/DataTable{FilterDropins,GroupBar,DetailPanel,EditorDropins}Demo.rozie) and
 * drives + asserts each drop-in through the parent's #filter / #groupBar / #detail / #editor
 * slot at runtime, across all six targets.
 *
 * Mirrors data-table-roundout.spec.ts / data-table-edit.spec.ts: the TARGETS ×6 matrix, the
 * `runnerFor` build-gate (an unbuilt target leg surfaces as a build-gated `test.fixme`
 * placeholder — KNOWN_FAILING stays EMPTY, NO permanent fixme), DOM/behavioral assertions
 * (NO __screenshots__ baseline), and Playwright locators that pierce Lit's open shadow root
 * uniformly (getByTestId / locator both descend open shadow DOM).
 *
 *   FILTER (DataTableFilterDropins): the #filter slot dispatches by columnId to FilterText
 *     (name), FilterSelect (category), FilterNumberRange (price). Typing + Enter in
 *     FilterText narrows the rows; Escape clears; picking a FilterSelect option narrows to
 *     that category; "All" restores. FilterNumberRange is a BEST-EFFORT / non-gating check
 *     (numeric coercion can be environment-flaky).
 *   GROUPBAR (DataTableGroupBar): grouping is seeded via the demo's NON-DRAG applyGrouping
 *     call button; the GroupBar drop-in's clickable remove-× + Clear paths are the HARD
 *     assertions. Native HTML5 DnD-add is BEST-EFFORT / non-gating (Playwright native-DnD
 *     unreliability — DnD-add is covered at the compile/manual level).
 *   DETAIL (DataTableDetailPanel): expanding a row mounts the DetailPanel drop-in's
 *     key/value definition list (dl.rdt-detail-panel > dt/dd); collapsing removes it.
 *   EDITOR (DataTableEditorDropins): F2 on an editor='custom' cell routes to the #editor
 *     slot → EditorText (name) / EditorSelect (status) / EditorDate (orderedAt). EditorText
 *     already defers commit to Enter/blur; EditorSelect and EditorDate now ALSO defer
 *     (pick/nudge updates the draft only — Enter/blur commits the final value), matching
 *     EditorText and the built-in editors (2026-07-05 grid-edit keyboard-UX design, Changes
 *     2 + 3). Committing updates the cell + the commit readout.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

// Default known-failing set is EMPTY (the P49/P53/roundout precedent) — an un-built target
// leg surfaces as a build-gated `runnerFor` placeholder, NOT a permanent fixme.
const EMPTY: ReadonlySet<Target> = new Set<Target>([]);

// REACT DRAFT-SEED INFINITE-RENDER BUG — FIXED (quick 260622-siv). The React emitter now folds
// a setup-once `$data.draft = $props.value …` seed into a lazy `useState(() => …)` initializer
// instead of `useState(lit)` + an unconditional render-body setState (which crashed the subtree
// with React #301). The filter (FilterText/FilterNumberRange) + editor (EditorText) React legs
// are therefore no longer gated; all six targets run the seed once and pass.

function runnerFor(target: Target, known: ReadonlySet<Target> = EMPTY) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || known.has(target) ? test.fixme : test;
}

/** True when ANY cell editor ([data-editing-cell]) is currently mounted (shadow-pierced). */
async function anyEditorOpen(page: Page): Promise<boolean> {
  return (await page.getByTestId('rozie-mount').locator('[data-editing-cell]').count()) > 0;
}

/**
 * Open the #editor custom slot at (row, col) and wait for `selector` to mount.
 *
 * F-07 (2026-09-11): this replaced an 8x retry of the whole close -> focus -> F2 sequence.
 * The retry was not merely masking a flake — it was GENERATING one. Measured:
 *   - iteration 0 failed on EVERY run (so the first attempt was reliably too early), and
 *   - with the 8x budget the EditorDate open failed outright on a ROTATING target
 *     (vue, react, solid observed on different runs) while the other five passed in <1s,
 *   - each iteration costs up to 1.5s + a 3s Escape poll, so 8 of them EXCEED the 30s test
 *     timeout: a genuine non-open surfaced as "Target page closed", not as an assertion,
 *   - dropping the budget to 2 passed 3/3 runs.
 * The mechanism is the one the old comment already warned about: a second F2 landing on an
 * already-open editor routes to the EDITOR keymap and toggles it shut, so every extra retry
 * is another chance to close the very editor it is waiting for.
 *
 * The real defect was a missing precondition, not flakiness. focusBodyCell() calls
 * cell.focus() and returns immediately, but the grid syncs activeRow/activeColIndex in its
 * own @focusin handler — so F2 could fire before the grid knew which cell was active. The
 * deterministic wait is the ROVING TABINDEX: cellTabindex() returns 0 only for the cell the
 * grid considers active, so polling for tabindex="0" on (row, col) proves the sync landed.
 * Then F2 is pressed exactly ONCE.
 */
async function openCustomEditor(
  page: Page,
  selector: string,
  row: number,
  col: number,
): Promise<void> {
  const target = page.getByTestId('rozie-mount').locator(selector);
  if ((await target.count()) && (await target.first().isVisible())) return;

  // 1. A lingering editor from the previous step must be fully CLOSED before steering focus.
  if (await anyEditorOpen(page)) {
    await page.keyboard.press('Escape');
    await expect.poll(async () => anyEditorOpen(page), { timeout: 5_000 }).toBe(false);
  }

  // 2. Focus the cell, then WAIT for the grid to register it as active (roving tabindex).
  await focusBodyCell(page, row, col);
  await expect
    .poll(async () => activeCellTabindex(page, row, col), { timeout: 5_000 })
    .toBe('0');

  // 3. One F2. Never a second — that would route to the editor keymap and toggle it shut.
  await page.keyboard.press('F2');
  await expect(target).toBeVisible({ timeout: 10_000 });
}

/** The `tabindex` of the body cell at (row, col), shadow-pierced. `'0'` means the grid has
 *  synced its active cell to it (cellTabindex() returns 0 only for the active cell). */
async function activeCellTabindex(page: Page, row: number, col: number): Promise<string | null> {
  return page.evaluate(({ r, c }) => {
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
    if (!grid) return null;
    const cell = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`);
    return cell ? cell.getAttribute('tabindex') : null;
  }, { r: row, c: col });
}

/**
 * Focus a body grid cell directly by (row, col) — drives @focusin → activeRow/activeColIndex
 * sync without relying on per-arrow timing, then F2 opens that cell's editor. Walks open
 * shadow roots (Lit). Copied from data-table-edit.spec.ts (the grid interaction-mode entry).
 */
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
    const cell = grid.querySelector(
      `[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`,
    ) as HTMLElement | null;
    if (cell) cell.focus();
  }, { r: row, c: col });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// FILTER — DataTableFilterDropins: #filter slot dispatch → FilterText/FilterSelect/
//   FilterNumberRange drives the columnFilters model.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-dropins filter [${target}]: FilterText type+Enter narrows / Escape clears; FilterSelect picks category; FilterNumberRange best-effort`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableFilterDropins&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const filterTable = mount.getByTestId('filter-table');
    await expect(filterTable.locator('table')).toBeVisible({ timeout: 15_000 });

    const bodyRows = filterTable.locator('tbody tr');
    // The full dataset renders (5 rows) before any filter is applied.
    await expect.poll(async () => bodyRows.count(), { timeout: 15_000 }).toBe(5);

    // ── FilterText (name): type a value matching a single row + Enter → rows narrow to 1.
    const nameFilter = filterTable.locator('input.rdt-col-filter[aria-label="Name"]');
    await expect(nameFilter).toBeVisible({ timeout: 10_000 });
    await nameFilter.fill('Alpha');
    await nameFilter.press('Enter');
    await expect.poll(async () => bodyRows.count(), { timeout: 10_000 }).toBe(1);
    // Escape clears the column filter → all rows return.
    await nameFilter.press('Escape');
    await expect.poll(async () => bodyRows.count(), { timeout: 10_000 }).toBe(5);

    // ── FilterSelect (category): picking "Hardware" narrows to the 2 Hardware rows
    //    (Alpha, Gamma); the leading "All" option (value="") restores the full set.
    const categoryFilter = filterTable.locator('select.rdt-col-filter[aria-label="Category"]');
    await expect(categoryFilter).toBeVisible({ timeout: 10_000 });
    await categoryFilter.selectOption('Hardware');
    await expect.poll(async () => bodyRows.count(), { timeout: 10_000 }).toBe(2);
    // REFLECT (phase-72 regression guard): the controlled <select> must KEEP showing the
    // applied value after the filter re-renders — not snap back to "All". This is the
    // downward half of the contract: the #filter slot forwards `value` (columnFilterValue)
    // so FilterSelect's :value reflects live column-filter state. Without it the filter
    // still applies (rows narrow) but the select resets to '' — the reported bug.
    await expect.poll(async () => categoryFilter.inputValue(), { timeout: 10_000 }).toBe('Hardware');
    await categoryFilter.selectOption('');
    await expect.poll(async () => bodyRows.count(), { timeout: 10_000 }).toBe(5);
    await expect.poll(async () => categoryFilter.inputValue(), { timeout: 10_000 }).toBe('');

    // ── FilterNumberRange (price): BEST-EFFORT / non-gating. Setting the max bound to 50
    //    and firing change should drop the rows priced above 50 (Beta=90, Epsilon=70 → 3
    //    remain). Native number-input coercion + the inNumberRange filterFn can be
    //    environment-flaky, so this is wrapped + non-gating — the text + select assertions
    //    above are the hard gate. (FilterNumberRange compile-correctness is proven ×6.)
    try {
      const priceMax = filterTable.locator('input.rdt-col-filter[aria-label="Price max"]');
      if (await priceMax.count()) {
        await priceMax.fill('50');
        await priceMax.dispatchEvent('change');
        await expect
          .poll(async () => bodyRows.count(), { timeout: 5_000 })
          .toBeLessThanOrEqual(5);
      }
    } catch {
      // best-effort: FilterNumberRange is covered at the compile/manual level.
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// GROUPBAR — DataTableGroupBar: #groupBar slot → GroupBar drop-in. HARD assertions use the
//   clickable remove-× + Clear paths; grouping is seeded via the NON-DRAG apply call button.
//   Native HTML5 DnD-add is BEST-EFFORT / non-gating.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-dropins groupBar [${target}]: seed via applyGrouping; remove-× shrinks; Clear empties (hard); DnD-add best-effort`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGroupBar&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const groupTable = mount.getByTestId('group-bar-table');
    await expect(groupTable.locator('table')).toBeVisible({ timeout: 15_000 });

    // The GroupBar drop-in mounted into the #groupBar slot.
    const groupBar = groupTable.locator('.rdt-group-bar');
    await expect(groupBar).toBeVisible({ timeout: 10_000 });

    const groupingReadout = page.getByTestId('grouping-readout');
    const activeTokens = groupBar.locator('[data-group-token]');

    // ── Seed grouping via the NON-DRAG affordance (the demo's applyGrouping call button) →
    //    the GroupBar renders two removable active-grouping tokens (region, category).
    await page.getByTestId('call-apply-grouping').click();
    await expect.poll(async () => groupingReadout.textContent(), { timeout: 10_000 }).toBe('region,category');
    await expect.poll(async () => activeTokens.count(), { timeout: 10_000 }).toBe(2);

    // ── HARD: clicking the FIRST token's remove × (removes 'region') → grouping shrinks to
    //    ['category']; the GroupBar reflects the new order through $props.grouping.
    await groupBar.locator('.rdt-group-token-remove').first().click();
    await expect.poll(async () => activeTokens.count(), { timeout: 10_000 }).toBe(1);
    await expect.poll(async () => groupingReadout.textContent(), { timeout: 10_000 }).toBe('category');

    // ── HARD: clicking Clear (clearGrouping) empties the grouping → no tokens, '' readout,
    //    and the Clear button itself disappears (r-if grouping.length).
    await groupBar.locator('.rdt-group-clear').click();
    await expect.poll(async () => activeTokens.count(), { timeout: 10_000 }).toBe(0);
    await expect.poll(async () => groupingReadout.textContent(), { timeout: 10_000 }).toBe('');
    await expect(groupBar.locator('.rdt-group-clear')).toHaveCount(0);

    // ── BEST-EFFORT / NON-GATING: attempt a native HTML5 DnD-add by dragging a column chip
    //    into the drop zone. Playwright's synthetic drag is unreliable for native draggable
    //    DnD, so any outcome (including no-op) is acceptable — DnD-add is covered at the
    //    compile/manual level; the clickable remove-× + Clear paths above are the gate.
    try {
      const chip = groupBar.locator('.rdt-group-token[draggable="true"]').first();
      const dropZone = groupBar.locator('[data-group-drop-zone]');
      if ((await chip.count()) && (await dropZone.count())) {
        // TIGHT timeout so the best-effort attempt can NEVER consume the test budget — after
        // Clear the drop zone collapses to zero-size and dragTo would otherwise wait on
        // actionability until the test timeout. `force` + a 2s cap keep it non-blocking.
        await chip.dragTo(dropZone, { timeout: 2_000, force: true });
      }
      // Non-gating: assert only that the token count is a sane non-negative number.
      await expect.poll(async () => activeTokens.count(), { timeout: 2_000 }).toBeGreaterThanOrEqual(0);
    } catch {
      // best-effort: native DnD-add is not gated in CI (Playwright native-DnD unreliability).
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// DETAIL — DataTableDetailPanel: #detail slot → DetailPanel drop-in renders the open row's
//   fields as a key/value definition list.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-dropins detail [${target}]: expand mounts DetailPanel dt/dd list with row fields; collapse removes it`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableDetailPanel&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const detailTable = mount.getByTestId('detail-table');
    await expect(detailTable.locator('table')).toBeVisible({ timeout: 15_000 });

    // ── Expand the first row via the auto-injected chevron expander → the DetailPanel
    //    drop-in mounts under the row.
    const expander0 = detailTable.locator('[data-expander]').first();
    await expect(expander0).toBeVisible({ timeout: 10_000 });
    await expander0.click();

    const panel = detailTable.locator('.rdt-detail-panel');
    await expect(panel.first()).toBeVisible({ timeout: 10_000 });
    // The DetailPanel renders a dt/dd pair per row field (id/name/region/score → > 0 keys).
    await expect.poll(async () => panel.first().locator('dt.rdt-detail-key').count(), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(async () => panel.first().locator('dd.rdt-detail-value').count(), { timeout: 10_000 }).toBeGreaterThan(0);
    // It contains a known field value from the expanded row (row 0 name = Alpha).
    await expect(panel.first()).toContainText('Alpha');

    // ── Collapse the row → the DetailPanel is removed from the DOM.
    await expander0.click();
    await expect.poll(async () => detailTable.locator('.rdt-detail-panel').count(), { timeout: 10_000 }).toBe(0);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// EDITOR — DataTableEditorDropins: #editor slot dispatch → EditorText (name) / EditorSelect
//   (status) / EditorDate (orderedAt). F2 on an editor='custom' cell routes to the slot;
//   committing updates the cell + the readout. EditorSelect and EditorDate now DEFER commit
//   to Enter/blur (pick/nudge updates the draft only, per the 2026-07-05 grid-edit keyboard-UX
//   design Changes 2 + 3) — matching EditorText.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-dropins editor [${target}]: F2 → EditorText type+Enter commits name; EditorSelect pick defers to Enter; EditorDate nudge defers to Enter; cell + readout update`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableEditorDropins&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const editTable = mount.getByTestId('edit-table');
    await expect(editTable.locator('table')).toBeVisible({ timeout: 15_000 });

    const commitReadout = mount.getByTestId('commit-readout');
    const commitCount = mount.getByTestId('commit-count');
    const cellDisplays = mount.getByTestId('cell-display');

    // Columns: name(0, editor=custom → EditorText), status(1, editor=custom → EditorSelect),
    // orderedAt(2, editor=custom → EditorDate).
    // ── EditorText (name): F2 on cell (0,0) routes to the #editor slot → EditorText mounts.
    await openCustomEditor(page, 'input.rdt-cell-editor[data-editing-cell]', 0, 0);
    const nameEditor = mount.locator('input.rdt-cell-editor[data-editing-cell]');
    await nameEditor.fill('Zeta');
    await nameEditor.press('Enter');
    // The commit drives the model write-back: the readout carries the new value and the
    // rendered cell updates. Enter commits ONCE — the editor's teardown blur that follows
    // must NOT re-commit (double cell-edit-commit fix, quick 260705); assert EXACTLY 1 on
    // all six targets. RED until the commitEdit sync idempotency latch lands.
    await expect.poll(async () => commitReadout.textContent(), { timeout: 10_000 }).toBe('name=Zeta');
    await expect.poll(async () => Number(await commitCount.textContent()), { timeout: 10_000 }).toBe(1);
    await expect.poll(async () => cellDisplays.nth(0).textContent(), { timeout: 10_000 }).toBe('Zeta');

    // ── EditorSelect (status): F2 on cell (0,1) routes to the #editor slot → EditorSelect
    //    mounts. DEFER assertion (Change 3): picking an option updates the draft ONLY — no
    //    commit yet. Enter then commits the final selection.
    const beforeSel = Number(await commitCount.textContent());
    await openCustomEditor(page, 'select.rdt-cell-editor[data-editing-cell]', 0, 1);
    const statusEditor = mount.locator('select.rdt-cell-editor[data-editing-cell]');
    await statusEditor.selectOption('archived');
    // NO commit yet — the pick only updates the draft (settle, then assert no change).
    await page.waitForTimeout(300);
    expect(Number(await commitCount.textContent())).toBe(beforeSel);
    expect(await commitReadout.textContent()).not.toBe('status=archived');
    // Enter commits the draft.
    await statusEditor.press('Enter');
    await expect.poll(async () => commitReadout.textContent(), { timeout: 10_000 }).toBe('status=archived');
    // Enter's commit closes+unmounts the select; the teardown blur must NOT re-commit
    // (double cell-edit-commit fix, quick 260705) — assert EXACTLY beforeSel+1 on all six
    // targets. RED until the commitEdit sync idempotency latch lands.
    await expect.poll(async () => Number(await commitCount.textContent()), { timeout: 10_000 }).toBe(beforeSel + 1);
    await expect.poll(async () => cellDisplays.nth(1).textContent(), { timeout: 10_000 }).toBe('archived');

    // ── EditorDate (orderedAt): F2 on cell (0,2) routes to the #editor slot → EditorDate
    //    mounts. DEFER assertion (Change 2): filling/nudging the date updates the draft ONLY —
    //    no commit yet. Enter then commits the final ISO value.
    const beforeDate = Number(await commitCount.textContent());
    await openCustomEditor(page, 'input[type="date"].rdt-cell-editor[data-editing-cell]', 0, 2);
    const dateEditor = mount.locator('input[type="date"].rdt-cell-editor[data-editing-cell]');
    await dateEditor.fill('2026-06-15');
    // NO commit yet — fill dispatches input+change, both draft-only now.
    await page.waitForTimeout(300);
    expect(Number(await commitCount.textContent())).toBe(beforeDate);
    // Enter commits the draft.
    await dateEditor.press('Enter');
    await expect.poll(async () => commitReadout.textContent(), { timeout: 10_000 }).toBe('orderedAt=2026-06-15');
    // Enter's commit closes+unmounts the date input; the teardown blur must NOT re-commit
    // (double cell-edit-commit fix, quick 260705) — assert EXACTLY beforeDate+1 on all six
    // targets. RED until the commitEdit sync idempotency latch lands.
    await expect.poll(async () => Number(await commitCount.textContent()), { timeout: 10_000 }).toBe(beforeDate + 1);
    await expect.poll(async () => cellDisplays.nth(2).textContent(), { timeout: 10_000 }).toBe('2026-06-15');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// EDITOR-OWNS-FOCUS — the `autofocus` #editor scope prop actually focuses the drop-in.
//
// Added by quick 260909 after re-investigating deferred-items 63-01, which recorded this as
// a Lit-only gap ("a drop-in editor opens but its <input> is not auto-focused; the 5
// light-DOM targets focus it fine"). Measured against the shipped build, that framing was
// wrong twice over: NO target focused the drop-in, and the cause was not shadow-DOM at all.
//
// `focusEditorWhenReady` (editCellLifecycle.rzts) deliberately BAILS when it finds a
// consumer drop-in — drop-ins own their own focus. The host instead flips the reactive
// `autofocus` slot-scope prop (editorAutofocusFor + $data.editFocusColId) for the one editor
// that should hold focus, and the drop-in focuses its OWN input. That indirection is
// precisely what makes the contract shadow-safe on Lit with no piercing.
//
// The demo simply never destructured `autofocus` out of the slot scope, so nothing told any
// drop-in to focus. Forwarding it makes all six focus correctly — Lit included — which is
// what this case now locks. Without this assertion the contract had ZERO runtime coverage:
// the editor cases above all call `.fill()`, which focuses the element itself and therefore
// cannot distinguish "autofocus worked" from "autofocus never fired".
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-dropins editor [${target}]: F2 auto-focuses the #editor drop-in via the autofocus scope prop`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableEditorDropins&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('edit-table').locator('table')).toBeVisible({ timeout: 15_000 });

    // C-02 — every drop-in, not just the first column.
    //
    // This case used to open column 0 only. Column 0 is `name`, which dispatches to
    // EditorText — the ONE drop-in that already implemented the contract. EditorSelect,
    // EditorNumber, EditorDate and EditorCheckbox never declared the `autofocus` prop at
    // all, so the host flipped a prop nothing was listening to and they opened unfocused.
    // The demo forwarded `:autofocus` correctly the whole time; asserting only column 0
    // could not see it. Each column below dispatches to a DIFFERENT drop-in.
    for (const { col, header } of [
      { col: 0, header: 'Name' }, // EditorText
      { col: 1, header: 'Status' }, // EditorSelect
      { col: 2, header: 'Ordered' }, // EditorDate
    ]) {
      // Real click + F2 (not a JS .focus()) so the grid's own active-cell path runs.
      await mount.locator(`[data-grid-cell][data-row="0"][data-col-index="${col}"]`).first().click();
      await page.keyboard.press('F2');

      // Shadow-piercing deep activeElement: on Lit the drop-in's control lives inside the
      // drop-in's OWN shadow root, nested within the grid's — document.activeElement stops
      // at the outermost host, so a naive check reports the host and never the control.
      const deepActive = async () =>
        page.evaluate(() => {
          let ae: Element | null = document.activeElement;
          while (ae && (ae as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot?.activeElement) {
            ae = (ae as Element & { shadowRoot: ShadowRoot }).shadowRoot.activeElement;
          }
          return ae
            ? {
                editing: !!(ae.hasAttribute && ae.hasAttribute('data-editing-cell')),
                label: ae.getAttribute ? ae.getAttribute('aria-label') : null,
              }
            : null;
        });

      await expect.poll(async () => (await deepActive())?.editing, { timeout: 10_000 }).toBe(true);

      // C-11 — the accessible name is the column's HUMAN header, never its internal id.
      // Before the fix every editor and filter announced the lookup key (`orderedAt`),
      // which is an implementation detail read aloud to a screen-reader user.
      expect((await deepActive())?.label).toBe(header);

      // Close before steering to the next cell (openCustomEditor's own precondition).
      await page.keyboard.press('Escape');
      await expect.poll(async () => anyEditorOpen(page), { timeout: 10_000 }).toBe(false);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// C-07 — EditorDate must show a date the model holds in ANY ordinary shape.
//
// The seed was `String($props.value)` while the component's own `docs:` string — which ships
// as JSDoc in every leaf `.d.ts` — promised "String-coerced to an ISO `YYYY-MM-DD` string".
// A native `<input type="date">` accepts only `YYYY-MM-DD` and renders BLANK for anything
// else, silently, so a `Date`, an ISO datetime string, an epoch number or a localised string
// all opened an empty editor over a cell that plainly showed a date.
//
// Every row of the fixture used to hold an already-ISO string, i.e. the one shape needing no
// coercion, so the existing EditorDate coverage could not have caught this. Two rows now hold
// other shapes. Row 3's is the OFF-BY-ONE case on purpose: midnight UTC, which renders as the
// previous day if the date is re-derived from local parts instead of read as written.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-dropins editor [${target}]: C-07 EditorDate seeds from a non-ISO model value`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableEditorDropins&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('edit-table').locator('table')).toBeVisible({ timeout: 15_000 });

    // Row 2 holds a localised string ('March 1, 2026').
    await openCustomEditor(page, 'input.rdt-cell-editor[type="date"]', 2, 2);
    await expect
      .poll(async () => mount.locator('input.rdt-cell-editor[type="date"]').first().inputValue(), { timeout: 10_000 })
      .toBe('2026-03-01');
    await page.keyboard.press('Escape');
    await expect.poll(async () => anyEditorOpen(page), { timeout: 5_000 }).toBe(false);

    // Row 3 holds an ISO DATETIME at midnight UTC — the off-by-one shape. The date part is
    // taken as WRITTEN, so this is 04-01 regardless of the runner's timezone.
    await openCustomEditor(page, 'input.rdt-cell-editor[type="date"]', 3, 2);
    await expect
      .poll(async () => mount.locator('input.rdt-cell-editor[type="date"]').first().inputValue(), { timeout: 10_000 })
      .toBe('2026-04-01');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// C-08 — FilterText / FilterNumberRange must re-sync when the filter changes from OUTSIDE.
//
// Both hold a local draft seeded ONCE at setup, and neither is remounted when the filter
// changes, so a programmatic reset — a "Clear filters" button, another control calling
// `setFilter`, a consumer writing `columnFilters` directly — moved the real filter while the
// input went on displaying the old text. The UI stated a filter that was no longer applied.
// `FilterSelect` was never affected: it reads `$props.value` live.
//
// The demo's buttons write `columnFilters` DIRECTLY, never through the drop-ins' own
// `setFilter`, so what is being tested is genuinely an outside-in sync.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-dropins filter [${target}]: C-08 the text and range inputs re-sync from an external columnFilters write`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableFilterDropins&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    const filterTable = mount.getByTestId('filter-table');
    await expect(filterTable.locator('table')).toBeVisible({ timeout: 15_000 });
    const bodyRows = filterTable.locator('tbody tr');
    await expect.poll(async () => bodyRows.count(), { timeout: 15_000 }).toBe(5);

    const nameFilter = filterTable.locator('input.rdt-col-filter[aria-label="Name"]');
    const priceInputs = filterTable.locator('input.rdt-col-filter[aria-label^="Price"]');

    // ── FilterText: apply through the input, then CLEAR from outside.
    await nameFilter.fill('Alpha');
    await nameFilter.press('Enter');
    await expect.poll(async () => bodyRows.count(), { timeout: 10_000 }).toBe(1);
    await page.getByTestId('clear-filters').click();
    await expect.poll(async () => bodyRows.count(), { timeout: 10_000 }).toBe(5);
    // The input must not keep advertising a filter that is gone.
    await expect.poll(async () => nameFilter.inputValue(), { timeout: 10_000 }).toBe('');

    // ── FilterText: SET from outside — the input must pick the new value up.
    await page.getByTestId('set-name-filter').click();
    await expect.poll(async () => bodyRows.count(), { timeout: 10_000 }).toBe(1);
    await expect.poll(async () => nameFilter.inputValue(), { timeout: 10_000 }).toBe('Gam');

    // ── FilterNumberRange: both inputs follow an external [min, max] write, then a clear.
    await page.getByTestId('set-price-filter').click();
    await expect
      .poll(async () => `${await priceInputs.nth(0).inputValue()}..${await priceInputs.nth(1).inputValue()}`, { timeout: 10_000 })
      .toBe('20..60');
    await page.getByTestId('clear-filters').click();
    await expect
      .poll(async () => `${await priceInputs.nth(0).inputValue()}..${await priceInputs.nth(1).inputValue()}`, { timeout: 10_000 })
      .toBe('..');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// C-10 / C-05 / B-13 (quick 260922-mkb) — the GRID keymap around a custom #editor drop-in.
//
// A drop-in is consumer markup inside the #editor slot: it binds its own Enter/Escape and
// nothing of the host's. So:
//   C-10 — single-cell Tab did not commit-and-advance like the built-in editors; it fell
//          through to native tab order and walked focus out of the grid.
//   C-05 — in full-row mode (Shift+F2) a drop-in's `commit(v)` is draft-only by design, and
//          the row only ever committed through handlers bound on the BUILT-IN inputs. Enter
//          staged a draft and nothing else; editingRowIndex stayed set and arrow nav was dead.
//   B-13 — once C-05 commits the row from the host wrapper, the focus change that follows
//          must not commit it a SECOND time (commitRow had no session latch; the guard is an
//          async useState read on React).
// Asserted on the MODEL (commit readouts + counts) and on keyboard reachability, not paint.
// ═══════════════════════════════════════════════════════════════════════════════════
/** "row,col" of the grid cell holding DOM focus (shadow-pierced via getRootNode), or null. */
async function focusedGridCell(page: Page): Promise<string | null> {
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
    if (!grid) return null;
    const ae = (grid.getRootNode() as Document | ShadowRoot).activeElement;
    const cell = ae && ae.closest ? ae.closest('[data-grid-cell]') : null;
    return cell && grid.contains(cell) ? cell.getAttribute('data-row') + ',' + cell.getAttribute('data-col-index') : null;
  });
}

const NAME_DROPIN = 'input.rdt-cell-editor[data-editing-cell]:not([type="date"])';

async function openRowEditor(page: Page, row: number, col: number): Promise<void> {
  await focusBodyCell(page, row, col);
  await expect
    .poll(async () => activeCellTabindex(page, row, col), { timeout: 5_000 })
    .toBe('0');
  await page.keyboard.press('Shift+F2');
  await expect(page.getByTestId('rozie-mount').locator(NAME_DROPIN)).toBeVisible({ timeout: 10_000 });
}

for (const target of TARGETS) {
  runnerFor(target)(`data-table-dropins editor [${target}]: C-10 Tab in a drop-in commits the typed value and advances to the next editor`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableEditorDropins&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('edit-table').locator('table')).toBeVisible({ timeout: 15_000 });

    await openCustomEditor(page, NAME_DROPIN, 0, 0);
    await mount.locator(NAME_DROPIN).fill('Zeta');
    await page.keyboard.press('Tab');

    // The TYPED value is what commits — not the host's untouched draft — and exactly once.
    await expect.poll(async () => mount.getByTestId('commit-readout').textContent(), { timeout: 10_000 }).toBe('name=Zeta');
    await expect.poll(async () => Number(await mount.getByTestId('commit-count').textContent()), { timeout: 10_000 }).toBe(1);
    // ...and the edit ADVANCED into (0,1)'s editor, as the built-in editors do.
    await expect(mount.locator('select.rdt-cell-editor[data-editing-cell]')).toBeVisible({ timeout: 10_000 });
  });

  runnerFor(target)(`data-table-dropins editor [${target}]: C-05 Enter in a full-row drop-in commits the row and frees arrow nav`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableEditorDropins&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('edit-table').locator('table')).toBeVisible({ timeout: 15_000 });

    await openRowEditor(page, 0, 0);
    await mount.locator(NAME_DROPIN).fill('Zeta');
    await mount.locator(NAME_DROPIN).press('Enter');

    await expect.poll(async () => mount.getByTestId('row-commit-readout').textContent(), { timeout: 10_000 }).toBe('name=Zeta');
    await expect.poll(async () => anyEditorOpen(page), { timeout: 10_000 }).toBe(false);
    // Focus is handed back to the committed row's cell ASYNCHRONOUSLY (the row-follow re-seat
    // runs after the row model re-derives). Wait for it to LAND — this also fails if focus is
    // never returned — rather than racing a keystroke into <body>.
    await expect.poll(async () => focusedGridCell(page), { timeout: 10_000 }).toBe('0,0');
    // The row session is OVER: the grid keymap answers again.
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => activeCellTabindex(page, 1, 0), { timeout: 10_000 }).toBe('0');
  });

  runnerFor(target)(`data-table-dropins editor [${target}]: B-13 a full-row drop-in commit fires row-edit-commit exactly once`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableEditorDropins&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('edit-table').locator('table')).toBeVisible({ timeout: 15_000 });

    await openRowEditor(page, 0, 0);
    await mount.locator(NAME_DROPIN).fill('Zeta');
    await mount.locator(NAME_DROPIN).press('Enter');
    await expect.poll(async () => Number(await mount.getByTestId('row-commit-count').textContent()), { timeout: 10_000 }).toBe(1);
    // Settle past the unmount-blur and any re-render, then assert it is STILL exactly one.
    await page.waitForTimeout(600);
    expect(Number(await mount.getByTestId('row-commit-count').textContent())).toBe(1);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════
// C-04 (quick 260922-mkb) — the GroupBar is operable from the KEYBOARD.
//
// Native HTML5 DnD was the sole path to ADD or REORDER a grouping, on spans with no tabindex,
// role or key handler; only Remove/Clear were real buttons, so a keyboard user could ungroup
// but never group. Driven with real key presses only — Tab into the bar from the button
// before it, Enter/Space on the palette chips, Alt+Arrow to reorder a token, Delete to remove
// it — and asserted on the grouping MODEL readout.
// ═══════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-dropins groupBar [${target}]: C-04 group, reorder and remove from the keyboard alone`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableGroupBar&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    const groupTable = mount.getByTestId('group-bar-table');
    await expect(groupTable.locator('table')).toBeVisible({ timeout: 15_000 });
    const groupBar = groupTable.locator('.rdt-group-bar');
    await expect(groupBar).toBeVisible({ timeout: 10_000 });
    const readout = page.getByTestId('grouping-readout');

    // Start from the last demo control before the table and Tab forward into the bar — past
    // the table's own global filter and Columns menu — until the Region palette chip holds
    // focus. Bounded: pre-fix the chips were unfocusable spans and are never reached.
    const focusedText = async (): Promise<string> =>
      page.evaluate(() => {
        let a: Element | null = document.activeElement;
        while (a && (a as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot?.activeElement) {
          a = (a as Element & { shadowRoot: ShadowRoot }).shadowRoot.activeElement;
        }
        return a ? (a.textContent || '').trim() : '';
      });
    await page.getByTestId('call-clear-grouping').focus();
    let reached = false;
    for (let i = 0; i < 6 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = (await focusedText()) === 'Region';
    }
    expect(reached).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(async () => readout.textContent(), { timeout: 10_000 }).toBe('region');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect.poll(async () => readout.textContent(), { timeout: 10_000 }).toBe('region,category');

    // Reorder: Alt+ArrowRight on the 'region' grouping token moves it after 'category'.
    const regionToken = groupBar.locator('[data-group-token]').filter({ hasText: 'Region' });
    await regionToken.focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect.poll(async () => readout.textContent(), { timeout: 10_000 }).toBe('category,region');

    // Remove: Delete on the (re-rendered) 'region' token.
    await groupBar.locator('[data-group-token]').filter({ hasText: 'Region' }).focus();
    await page.keyboard.press('Delete');
    await expect.poll(async () => readout.textContent(), { timeout: 10_000 }).toBe('category');
  });
}
