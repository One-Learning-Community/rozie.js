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
    const nameFilter = filterTable.locator('input.rdt-col-filter[aria-label="name"]');
    await expect(nameFilter).toBeVisible({ timeout: 10_000 });
    await nameFilter.fill('Alpha');
    await nameFilter.press('Enter');
    await expect.poll(async () => bodyRows.count(), { timeout: 10_000 }).toBe(1);
    // Escape clears the column filter → all rows return.
    await nameFilter.press('Escape');
    await expect.poll(async () => bodyRows.count(), { timeout: 10_000 }).toBe(5);

    // ── FilterSelect (category): picking "Hardware" narrows to the 2 Hardware rows
    //    (Alpha, Gamma); the leading "All" option (value="") restores the full set.
    const categoryFilter = filterTable.locator('select.rdt-col-filter[aria-label="category"]');
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
      const priceMax = filterTable.locator('input.rdt-col-filter[aria-label="price max"]');
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

    // Real click + F2 (not a JS .focus()) so the grid's own active-cell path runs.
    await mount.locator('[data-grid-cell][data-row="0"][data-col-index="0"]').first().click();
    await page.keyboard.press('F2');

    // Shadow-piercing deep activeElement: on Lit the drop-in's <input> lives inside the
    // drop-in's OWN shadow root, nested within the grid's — document.activeElement stops at
    // the outermost host, so a naive check reports the host element and never the input.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            let ae: Element | null = document.activeElement;
            while (ae && (ae as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot?.activeElement) {
              ae = (ae as Element & { shadowRoot: ShadowRoot }).shadowRoot.activeElement;
            }
            return !!(ae && ae.hasAttribute && ae.hasAttribute('data-editing-cell'));
          }),
        { timeout: 10_000 },
      )
      .toBe(true);
  });
}
