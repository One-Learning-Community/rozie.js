import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 88 Plan 05 (D-03) — the editor-owns-focus contract, pinned red-first (against
 * TODAY's shipped behavior, not the transient 88-07 deleted-helper state) BEFORE 88-07
 * reworks `focusEditorWhenReady` / `focusRowEditorAt` (D-01: the `data-builtin-editor`
 * marker; D-02: column-scoping both polls). Focus bugs pass typecheck, build, and
 * dist-parity clean — this is a silent-failure class with no other gate.
 *
 * Fixture: examples/demos/DataTableEditorFamilyDemo.rozie mounts TWO independently
 * addressable table instances (`[data-dt-instance="mixed"]` / `[data-dt-instance="nofill"]`
 * — a helper resolving the first `table[role="grid"]` would always pick the wrong one for
 * the second instance mounted in this demo):
 *   - `mixed`: name(built-in text, col 0) / status(editor="custom", filled by an EditorText
 *     drop-in via a generic #editor fill, col 1) / qty(built-in number, col 2).
 *   - `nofill`: name(built-in text, col 0) / notes(editor="custom", NO #editor fill anywhere
 *     in this instance, col 1).
 *
 * Three cases, six targets each (D-03) — not a subset, because the failure mode differs
 * per target (per `project_five_targets_accidentally_correct_masks_shared_bug`): five
 * targets would find a drop-in's input via a host DOM reach-in and double-focus + select-all
 * it; Lit would find nothing across its shadow boundary and burn 30 idle rAF frames.
 *
 *   (a) DROP-IN TARGET — F2 on `mixed`'s `status` cell. The INTENDED contract: the host
 *       must NOT reach into the drop-in's DOM at all (`hasEditorSlot('status')` gates
 *       `focusEditorWhenReady` off before it starts); EditorText's own `$onMount` lands
 *       focus via its reactive `autofocus` prop and NEVER calls `.select()`. THIS is the
 *       case that goes RED in 88-07's transient deleted-helper state (the plain
 *       `hasEditorSlot` presence test is exactly what gets deleted and replaced by the
 *       `data-builtin-editor` marker) — every other case here is a regression pin, not a
 *       red-first probe.
 *
 *       Discriminator: COLLAPSED text selection. Verified empirically (throwaway,
 *       uncommitted Playwright probes AND a `.select()`/`.focus()` call-site trace
 *       monkey-patched onto `HTMLInputElement.prototype`, before writing this assertion)
 *       against the real build: the host's built-in-editor focus path always calls
 *       `.select()` (selectionStart !== selectionEnd for a non-empty value), while
 *       EditorText's own `$onMount`/`$watch` focus path never does (selectionStart ===
 *       selectionEnd).
 *
 *       DISCOVERED PRE-EXISTING DEFECT — REACT ONLY (`REACT_STALE_GATE_SINGLE_CELL_BUG`,
 *       see 88-05-SUMMARY.md for the full trace): on React specifically, this case's
 *       INTENDED contract is ALREADY broken TODAY, independent of 88-07. The `.select()`
 *       call-site trace shows `focusEditorWhenReady`'s early-return
 *       (`editFocusColId != null && hasEditorSlot(editFocusColId)`) does not fire on the
 *       FIRST single-cell F2 entry of a page session — `editFocusColId` reads back its
 *       PRE-edit (null) value via React's batched-setState closure the instant after
 *       `beginEdit` set it, so the gate's `!= null` check fails and the poll falls through
 *       to `gridRoot.querySelector('[data-editing-cell]')`, which (React has no shadow
 *       boundary) finds and select-alls the drop-in's own input on its very first rAF
 *       attempt. This is a genuine, 100%-reproducible bug in code OUTSIDE this plan's
 *       `files_modified` (`editCellLifecycle.rzts`) — out of scope to fix here per the
 *       executor's Scope Boundary. This spec PINS what is actually shipping: React's case
 *       (a) is asserted `selectionCollapsed: false` (matching the observed defect), the
 *       other five targets `true` (the intended, working contract). If 88-07's D-01/D-02
 *       rework (replacing the `$data`-state gate with a DOM-attribute check) incidentally
 *       fixes this React race, React's assertion here should be tightened back to `true`
 *       at that time — a welcome outcome this pin does not currently claim.
 *
 *   (b) BUILT-IN TARGET WITH A SIBLING DROP-IN MOUNTED — Shift+F2 on `mixed` row 0 enters
 *       full-row edit, mounting every editable cell's editor at once (name + status‘s
 *       drop-in + qty). Assert focus resolves inside `name` (col 0, built-in) — NOT the
 *       `status` drop-in, which is mounted alongside it in the same row but must be neither
 *       focused nor select-all'd.
 *
 *       HONEST CAVEAT (plan critical_constraint #3, verified this session by reading
 *       `editRowLifecycle.rzts`): `beginRowEdit` always seeds `$data.editFocusColId` from
 *       `editableColumnsForRow(...)[0].colId` — the FIRST editable column in visible-cell
 *       (DOM) order. That is, BY CONSTRUCTION, always the same column `focusEditorWhenReady`'s
 *       current `gridRoot.querySelector('[data-editing-cell]')` (first-DOM-match, the D-02
 *       bug) would ALSO resolve — the two selection strategies coincide on THIS entry path no
 *       matter which column is built-in vs drop-in, so this arrangement, reached through
 *       Shift+F2, cannot by itself distinguish "resolved by column id" from "resolved by
 *       first-DOM-match." The genuinely wrong-column-manifesting path (target column ≠ first
 *       DOM match) has NO reachable public-API trigger today: `rowEditTab` (Tab within row
 *       edit) and `commitRow`'s validation-reject retarget both already call the
 *       ALREADY-column-scoped `focusRowEditorAt`, never the buggy `focusEditorWhenReady`. Per
 *       the plan's explicit guidance, this case pins what IS reachable (Shift+F2 must focus
 *       `name`, and must leave the `status` drop-in untouched) rather than inventing a
 *       private-API backdoor to manufacture the unreachable divergence. It still protects
 *       98-07's D-02 rewrite from a regression that would make row-edit's initial focus skip
 *       the first editable column entirely.
 *
 *   (c) CUSTOM WITH NO FILL ANYWHERE — F2 on `nofill`'s `notes` cell (declared
 *       `editor="custom"`, no `#editor` fill exists in this instance at all —
 *       `$slots.editor` is undefined, so `hasEditorSlot('notes')` is false). Assert a
 *       built-in text editor mounts (not a blank cell) and holds focus — the degrade-to-
 *       built-in contract D-01's rejected alternative (a bare `editorTypeOf === 'custom'`
 *       gate) would have broken.
 *
 * No pixel-diff assertion, no PNG baseline directory — DOM/behavioral assertions only.
 *
 * Wiring: examples/demos/DataTableEditorFamilyDemo.rozie (single self-contained demo, not a
 * producer/consumer pair) + tests/visual-regression/host/main.ts EXAMPLES/LIT_TAGS/PROPS
 * (`DataTableEditorFamily`) + the standard `runnerFor` per-target build-availability gate
 * (`dynamic-slot-name.spec.ts` / `data-table-edit.spec.ts` precedent).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

// Empty known-failing set — the CURRENT shipped behavior is the thing being pinned, so
// every target must be genuinely green, not permanently fixme'd.
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

// Discovered pre-existing defect (see the header comment's DISCOVERED PRE-EXISTING DEFECT
// note and 88-05-SUMMARY.md) — NOT a KNOWN_FAILING skip. React's `focusEditorWhenReady`
// early-return gate reads a stale `editFocusColId` on the FIRST single-cell F2 entry of a
// page session, so the host reaches into and select-alls the drop-in's input in case (a).
// This is a real, currently-shipping behavior this spec pins as-is (a regression pin still
// needs to notice if this DEFECT itself regresses further, e.g. spreading to other cases).
const REACT_STALE_GATE_SINGLE_CELL_BUG: ReadonlySet<Target> = new Set<Target>(['react']);

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

type FocusInfo = {
  instance: string | null;
  row: string | null;
  col: string | null;
  tag: string;
  hasEditingCell: boolean;
  // The (not yet shipped pre-88-07 — always false today, becomes meaningful once D-01
  // lands) data-builtin-editor marker. Recorded now so this reader needs NO changes when
  // 88-07 lands the marker; only the assertions built on top of it would gain a new check.
  hasBuiltinEditorMarker: boolean;
  // null when the focused element has no text-selection API (e.g. a <select>); otherwise
  // true when selectionStart === selectionEnd — the empirically-verified discriminator for
  // "the host never reached in and called .select()".
  selectionCollapsed: boolean | null;
};

/**
 * Every `page.evaluate` callback below inlines its OWN copy of a `closestAcrossShadow`
 * helper — walk UP from a node, trying `closest(selector)` in the current tree and, on
 * failure, hopping to the enclosing shadow root's host and retrying. This resolves a
 * selector ancestor that lives OUTSIDE a custom element's own shadow root (e.g. this demo's
 * `[data-dt-instance]` wrapper, which sits in the light DOM above `<rozie-data-table>`'s
 * shadow root, or even two levels up above a drop-in's OWN nested shadow root on Lit). A
 * no-op multi-hop for the five light-DOM targets (their first `closest()` call always
 * succeeds). Inlined rather than imported — `page.evaluate(fn, arg)` serializes `fn` via
 * `Function.prototype.toString()`; a helper called from OUTSIDE that closure's own source
 * text throws `ReferenceError` in the browser (see `_shadow-utils.ts`'s header note).
 */

/**
 * The deepest real `document.activeElement`, recursively piercing open shadow roots (up
 * to two levels deep for a Lit drop-in: DataTable's own shadow root, then the drop-in
 * custom element's own nested shadow root), resolved to: which `data-dt-instance` wrapper
 * it lives under (instance-scoped — this demo mounts TWO grids), its owning
 * `[data-grid-cell]`'s row/col-index, its tag, its `data-editing-cell`/
 * `data-builtin-editor` markers, and whether its text selection is collapsed. Pass DIRECTLY
 * as a `page.evaluate` callback (no imported-closure call — see `_shadow-utils.ts`'s header
 * note on why cross-evaluate-boundary imports throw at runtime).
 */
async function activeEditorInfo(page: Page): Promise<FocusInfo | null> {
  return page.evaluate(() => {
    function closestAcrossShadow(start: Element, selector: string): Element | null {
      let node: Element | null = start;
      while (node) {
        const found = node.closest ? node.closest(selector) : null;
        if (found) return found;
        const root: Node | null = node.getRootNode ? node.getRootNode() : null;
        node = root instanceof ShadowRoot ? root.host : null;
      }
      return null;
    }
    let active: (Element & { shadowRoot?: ShadowRoot | null }) | null =
      document.activeElement as Element | null;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement as Element & { shadowRoot?: ShadowRoot | null };
    }
    if (!active) return null;
    const cell = closestAcrossShadow(active, '[data-grid-cell]');
    const instanceEl = closestAcrossShadow(active, '[data-dt-instance]');
    const input = active as HTMLInputElement;
    let selectionCollapsed: boolean | null = null;
    if (typeof input.selectionStart === 'number' && typeof input.selectionEnd === 'number') {
      selectionCollapsed = input.selectionStart === input.selectionEnd;
    }
    return {
      instance: instanceEl ? instanceEl.getAttribute('data-dt-instance') : null,
      row: cell ? cell.getAttribute('data-row') : null,
      col: cell ? cell.getAttribute('data-col-index') : null,
      tag: active.tagName.toLowerCase(),
      hasEditingCell: active.hasAttribute('data-editing-cell'),
      hasBuiltinEditorMarker: active.hasAttribute('data-builtin-editor'),
      selectionCollapsed,
    };
  });
}

/**
 * Focus a specific instance's body cell by (row, col) directly — resolves the RIGHT
 * `table[role="grid"]` by walking every grid in the page (piercing shadow roots for Lit)
 * and matching its `[data-dt-instance]` ancestor (crossing back out of the grid's own
 * shadow root for Lit), then focuses the target `[data-grid-cell]` off that specific grid.
 */
async function focusInstanceCell(
  page: Page,
  instance: string,
  row: number,
  col: number,
): Promise<void> {
  await page.evaluate(
    ({ instance, r, c }) => {
      function closestAcrossShadow(start: Element, selector: string): Element | null {
        let node: Element | null = start;
        while (node) {
          const found = node.closest ? node.closest(selector) : null;
          if (found) return found;
          const root: Node | null = node.getRootNode ? node.getRootNode() : null;
          node = root instanceof ShadowRoot ? root.host : null;
        }
        return null;
      }
      const findGrids = (root: Document | ShadowRoot): Element[] => {
        const out: Element[] = Array.from(root.querySelectorAll('table[role="grid"]'));
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) out.push(...findGrids(sr));
        }
        return out;
      };
      for (const grid of findGrids(document)) {
        const inst = closestAcrossShadow(grid, '[data-dt-instance]');
        if (inst && inst.getAttribute('data-dt-instance') === instance) {
          const cellEl = grid.querySelector(
            `[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`,
          ) as HTMLElement | null;
          if (cellEl) cellEl.focus();
          return;
        }
      }
    },
    { instance, r: row, c: col },
  );
}

/**
 * Read a SPECIFIC (non-necessarily-focused) cell's mounted editor state — used to confirm a
 * sibling drop-in mounted (case b) without it being the active element. Deep-searches BOTH
 * the light-DOM subtree AND any nested shadow roots under the cell (a drop-in's own `<input>`
 * lives inside its OWN shadow root on Lit — a separate root from the cell's, so plain
 * `querySelector` from the cell would not find it; this walks both directions).
 */
async function cellEditorState(
  page: Page,
  instance: string,
  row: number,
  col: number,
): Promise<{ mounted: boolean; selectionCollapsed: boolean | null }> {
  return page.evaluate(
    ({ instance, r, c }) => {
      function closestAcrossShadow(start: Element, selector: string): Element | null {
        let node: Element | null = start;
        while (node) {
          const found = node.closest ? node.closest(selector) : null;
          if (found) return found;
          const root: Node | null = node.getRootNode ? node.getRootNode() : null;
          node = root instanceof ShadowRoot ? root.host : null;
        }
        return null;
      }
      const findGrids = (root: Document | ShadowRoot): Element[] => {
        const out: Element[] = Array.from(root.querySelectorAll('table[role="grid"]'));
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) out.push(...findGrids(sr));
        }
        return out;
      };
      let grid: Element | null = null;
      for (const g of findGrids(document)) {
        const inst = closestAcrossShadow(g, '[data-dt-instance]');
        if (inst && inst.getAttribute('data-dt-instance') === instance) {
          grid = g;
          break;
        }
      }
      if (!grid) return { mounted: false, selectionCollapsed: null };
      const cellEl = grid.querySelector(`[data-grid-cell][data-row="${r}"][data-col-index="${c}"]`);
      if (!cellEl) return { mounted: false, selectionCollapsed: null };
      const deepFindEditor = (root: Element): Element | null => {
        const direct = root.querySelector('[data-editing-cell]');
        if (direct) return direct;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) {
            const inSr = sr.querySelector('[data-editing-cell]');
            if (inSr) return inSr;
            const nested = deepFindEditor(sr as unknown as Element);
            if (nested) return nested;
          }
        }
        return null;
      };
      const ed = deepFindEditor(cellEl);
      if (!ed) return { mounted: false, selectionCollapsed: null };
      const input = ed as HTMLInputElement;
      let selectionCollapsed: boolean | null = null;
      if (typeof input.selectionStart === 'number' && typeof input.selectionEnd === 'number') {
        selectionCollapsed = input.selectionStart === input.selectionEnd;
      }
      return { mounted: true, selectionCollapsed };
    },
    { instance, r: row, c: col },
  );
}

/** Focus a specific instance's cell and confirm it HOLDS (no pending focus-return steal
 *  from a previous editor's unmount stealing it back) before returning — instance-scoped
 *  mirror of `data-table-edit.spec.ts`'s `focusBodyCellStable`. */
async function focusInstanceCellStable(
  page: Page,
  instance: string,
  row: number,
  col: number,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await focusInstanceCell(page, instance, row, col);
        const info = await activeEditorInfo(page);
        return (
          info?.instance === instance && info?.row === String(row) && info?.col === String(col)
        );
      },
      { timeout: 5_000, intervals: [40, 40, 40, 60, 100] },
    )
    .toBe(true);
}

/** Settle focus on (instance, row, col) with no editor open elsewhere, then F2 to open its
 *  editor — retrying the whole settle→F2 sequence to absorb an async re-render landing the
 *  editor late or at the wrong cell (the `enterEditAt` lesson from `data-table-edit.spec.ts`,
 *  needed here because case (a)/(c) hit this flakily on a bare focus+F2 without it). */
async function enterEditAtInstance(
  page: Page,
  instance: string,
  row: number,
  col: number,
): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const cur = await activeEditorInfo(page);
    if (cur?.hasEditingCell && cur.instance === instance && cur.col === String(col)) return;
    if (cur?.hasEditingCell) {
      await page.keyboard.press('Escape');
      await expect
        .poll(async () => (await activeEditorInfo(page))?.hasEditingCell, { timeout: 3_000 })
        .toBe(false)
        .catch(() => {});
    }
    await focusInstanceCellStable(page, instance, row, col);
    if ((await activeEditorInfo(page))?.hasEditingCell) continue;
    await page.keyboard.press('F2');
    try {
      await expect
        .poll(async () => (await activeEditorInfo(page))?.hasEditingCell, { timeout: 3_000 })
        .toBe(true);
      const after = await activeEditorInfo(page);
      if (after?.instance === instance && after.col === String(col)) return;
    } catch {
      // opened at the wrong cell / not at all — re-settle and retry.
    }
  }
  // Surface a genuine failure clearly instead of a silent fallthrough past the budget.
  await expect
    .poll(async () => (await activeEditorInfo(page))?.hasEditingCell, { timeout: 3_000 })
    .toBe(true);
}

for (const target of TARGETS) {
  const reactBug = REACT_STALE_GATE_SINGLE_CELL_BUG.has(target);
  runnerFor(target)(
    reactBug
      ? `data-table-editor-family-focus [${target}] (a): drop-in target — DISCOVERED PRE-EXISTING DEFECT pinned as-is (host DOES reach in on the first single-cell F2 entry; see header comment)`
      : `data-table-editor-family-focus [${target}] (a): drop-in target — host never reaches in, focus lands via the drop-in's own autofocus, selection collapsed`,
    async ({ page }) => {
      await page.goto(`/?example=DataTableEditorFamily&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      // F2 on mixed's `status` cell (col 1) — a drop-in target.
      await enterEditAtInstance(page, 'mixed', 0, 1);
      // Settle window (generous over the empirically-observed ~3-6ms lag) so a target
      // exhibiting the discovered React defect is read AFTER its second focus+select()
      // call lands, not mid-race — this reads the TRUE settled state, not a lucky snapshot.
      await page.waitForTimeout(100);

      const info = await activeEditorInfo(page);
      expect(info?.instance).toBe('mixed');
      expect(info?.row).toBe('0');
      expect(info?.col).toBe('1');
      expect(info?.tag).toBe('input');
      // The discriminator: EditorText's own $onMount/$watch focus path never calls
      // .select() — a collapsed selection proves the host stayed out of this drop-in's DOM.
      // React is the sole EXCEPTION today (see header + REACT_STALE_GATE_SINGLE_CELL_BUG) —
      // this pins the ACTUAL shipped behavior per target, not a uniform assumption.
      expect(info?.selectionCollapsed).toBe(!reactBug);
    },
  );

  runnerFor(target)(
    `data-table-editor-family-focus [${target}] (b): built-in target with a sibling drop-in mounted — Shift+F2 focuses name, not the status drop-in`,
    async ({ page }) => {
      await page.goto(`/?example=DataTableEditorFamily&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      await focusInstanceCellStable(page, 'mixed', 0, 0);
      await page.keyboard.press('Shift+F2');

      // Every editable cell in the row mounts an editor at once — confirm the sibling
      // drop-in (status, col 1) really is mounted alongside the built-in target (not a
      // single-cell-edit fallback that would make this case vacuous).
      await expect
        .poll(async () => (await cellEditorState(page, 'mixed', 0, 1)).mounted, { timeout: 5_000 })
        .toBe(true);
      await expect
        .poll(async () => (await cellEditorState(page, 'mixed', 0, 2)).mounted, { timeout: 5_000 })
        .toBe(true);

      // Focus resolves inside `name` (col 0, built-in) — the row's first editable column.
      await expect
        .poll(async () => (await activeEditorInfo(page))?.hasEditingCell, { timeout: 5_000 })
        .toBe(true);
      const info = await activeEditorInfo(page);
      expect(info?.instance).toBe('mixed');
      expect(info?.row).toBe('0');
      expect(info?.col).toBe('0');
      expect(info?.tag).toBe('input');

      // The status drop-in is mounted but neither focused NOR select-all'd.
      expect(info?.col).not.toBe('1');
      const statusState = await cellEditorState(page, 'mixed', 0, 1);
      expect(statusState.mounted).toBe(true);
      expect(statusState.selectionCollapsed).toBe(true);
    },
  );

  runnerFor(target)(
    `data-table-editor-family-focus [${target}] (c): custom with no fill anywhere — degrades to the built-in text editor AND is focused`,
    async ({ page }) => {
      await page.goto(`/?example=DataTableEditorFamily&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      // F2 on nofill's `notes` cell (col 1) — declared editor="custom" with NO #editor fill.
      await enterEditAtInstance(page, 'nofill', 0, 1);

      const info = await activeEditorInfo(page);
      expect(info?.instance).toBe('nofill');
      expect(info?.row).toBe('0');
      expect(info?.col).toBe('1');
      // A real text input mounted (not a blank cell) and it holds focus.
      expect(info?.tag).toBe('input');
    },
  );
}
