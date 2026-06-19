import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 51 (data-table editable cells) — the DOM/behavioral VR matrix for
 * spreadsheet-grade inline editing (req-11). This file is stood up in the Wave-0
 * de-risking plan (51-01) with TWO real (non-fixme) assertion blocks and the editing
 * reqs stubbed behind `test.fixme` pending the Wave-(a)..(c) builds (Plans 51-02..04):
 *
 *   D-02 PIN-ROW PROBE (51-01, the only genuinely UNPROVEN cross-target surface,
 *     RESEARCH A4 / Pitfall 3 / Open-Q2) — drives the STANDALONE
 *     examples/demos/DataTablePinProbeDemo.rozie (NO DataTable / @tanstack import; a
 *     minimal LOCAL copy of the Phase-53 windowedRows/padTop/padBottom math). Proves
 *     that a keyed editing <tr> stays MOUNTED in-flow when it scrolls outside the
 *     virtual window, with aria-rowindex monotonic + total scroll height (padTop + Σ +
 *     padBottom = getTotalSize()) invariant — across all six reactivity systems
 *     (especially Solid's fine-grained <For> + Svelte's {#each} subscription + Lit's
 *     repeat recycling). This resolves the in-flow-vs-out-of-flow question that Plan
 *     51-04 wires into the real DataTable.rozie windowing.
 *
 *   CLIPBOARD SPIKE (51-01, RESEARCH A3 / Pitfall 4) — confirms Playwright grants
 *     clipboard-read + clipboard-write in the pinned Linux Chromium container under
 *     single-worker, so the later clipboard wave (req-8) has a working harness. A TSV
 *     string written via navigator.clipboard.writeText reads back identically via
 *     readText. If grantPermissions is blocked, the documented page.evaluate shim
 *     fallback is asserted through instead (the SUMMARY records which path won).
 *
 * The editing reqs 1-9 (built-in editors, #editor slot, lifecycle, write-back,
 * validation, full-row, range, clipboard paste, virtualization-survival) are stubbed
 * as `test.fixme` below — they reference Column `editable`/`editor`/`validate` props +
 * `r-model:data` that DO NOT EXIST until Plan 51-02 lands, so the DataTableEdit*Demo
 * fixtures cannot be exercised yet. They become real assertions as each wave ships
 * (req-11 acceptance = no permanent fixme by phase end).
 *
 * PER-TARGET activeElement READ (A1, pinned by the Phase-49 grid spec): the editor
 * focus checks read the focused element UNIFORMLY across all six via
 * `root.getRootNode().activeElement` — document in the 5 light-DOM targets, the open
 * shadow root on Lit. The `activeCellCoords` helper is copied verbatim from
 * data-table-grid.spec.ts.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

// No target is gated for the Wave-0 probe + clipboard spike (both pass ×6). As editing
// waves land, a target blocked on an emitter gap would be added here with a tracking
// note (the Phase-49 KNOWN_FAILING precedent); req-11 acceptance is an empty set.
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

/**
 * The active cell's [data-row]/[data-col-index]/role read off the focused element,
 * UNIFORM across all six (incl. Lit shadow) via `getRootNode().activeElement`. The
 * root is resolved from the grid <table role="grid"> by recursively walking open shadow
 * roots. Returns null when nothing inside the grid is focused. Copied verbatim from
 * data-table-grid.spec.ts (A1).
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

// ── D-02 pin-row probe helpers (shadow-piercing geometry off the probe scroll root) ──

/**
 * The probe's bounded windowed scroll container's scrollHeight = padTop + Σ(rendered tr
 * heights) + padBottom = totalSize() (the getTotalSize() DOM proxy, the Phase-53
 * data-table-virtual.spec.ts precedent). Walks open shadow roots for Lit. null if absent.
 */
async function probeScrollHeight(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('.pin-probe-scroll');
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

/** Programmatically scroll the probe container to `top` (walks open shadow roots). */
async function scrollProbeTo(page: Page, top: number): Promise<void> {
  await page.evaluate((y) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('.pin-probe-scroll');
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
    if (el) {
      el.scrollTop = y;
      el.dispatchEvent(new Event('scroll', { bubbles: false }));
    }
  }, top);
}

/**
 * The rendered body rows' [data-index]/[data-pinned] read off the probe table, in DOM
 * order. Walks open shadow roots for Lit. Used to assert the editing row stays mounted
 * + aria-rowindex monotonicity.
 */
async function probeRenderedRows(
  page: Page,
): Promise<{ index: number; ariaRowIndex: number; pinned: boolean }[]> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('.pin-probe-table');
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
    const table = find(document);
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr.pin-probe-tr')).map((tr) => ({
      index: Number(tr.getAttribute('data-index')),
      ariaRowIndex: Number(tr.getAttribute('aria-rowindex')),
      pinned: tr.getAttribute('data-pinned') === 'true',
    }));
  });
}

/** True when the probe editor <input data-editing-cell> is present in the DOM. */
async function probeEditorPresent(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('.pin-probe-table [data-editing-cell]');
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
    return !!find(document);
  });
}

// ── Editable-cell helpers (Plan 51-02, Wave-(a)) — read the open editor + commit readout
//    off the DataTableEditDemo fixture, shadow-piercing for Lit. ─────────────────────────

/**
 * The open editor element ([data-editing-cell]) descriptor — its tag, type, value, and the
 * owning cell's [data-col-index]. Null when no editor is open. Walks open shadow roots (Lit).
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

/** True when the custom #editor stepped-slot control is mounted (req-2). */
async function stepEditorPresent(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('[data-testid="step-editor"]');
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
    return !!find(document);
  });
}

/** The focused element's tagName (shadow-pierced), to assert the editor is focused. */
async function focusedTag(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    let root: Document | ShadowRoot = document;
    let active: Element | null = document.activeElement;
    // Pierce shadow roots to the deepest active element (Lit).
    while (active && (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) {
      const sr = (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot as ShadowRoot;
      if (!sr.activeElement) break;
      root = sr;
      active = sr.activeElement;
    }
    return active ? active.tagName.toLowerCase() : null;
  });
}

/** The first cell-display cell's text for a given visible column (the model-driven value). */
async function cellDisplayValues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element[] => {
      const out: Element[] = [];
      out.push(...Array.from(root.querySelectorAll('[data-testid="cell-display"]')));
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) out.push(...find(sr));
      }
      return out;
    };
    return find(document).map((el) => (el.textContent || '').trim());
  });
}

/** The commit-count readout (number of cell-edit-commit emits). */
async function commitCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('[data-testid="commit-count"]');
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
    return el ? Number((el.textContent || '0').trim()) : -1;
  });
}

/** The commit-readout ("columnId=newValue" of the last commit). */
async function commitReadout(page: Page): Promise<string> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('[data-testid="commit-readout"]');
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
  });
}

/** Focus a body cell directly by (row, col) — drives @focusin → activeRow/activeColIndex
 *  sync without relying on per-arrow timing (the editor-block sequencing is deterministic
 *  this way). Walks open shadow roots (Lit). */
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

/** The [data-col-index] of the cell currently flagged aria-invalid="true" (req-5), or null.
 *  Walks open shadow roots (Lit). */
async function ariaInvalidColIndex(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('[data-grid-cell][aria-invalid="true"]');
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
    return el ? el.getAttribute('data-col-index') : null;
  });
}

/** The text in the polite aria-live status region (req-5/D-01), '' when absent/empty. */
async function srLiveText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('[role="status"][aria-live="polite"].rdt-sr-live');
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
  });
}

/** Focus (row, col) and KEEP it focused until the active cell settles there — re-focuses if
 *  a stray deferred focus-return (the commit/cancel rAF poll from a prior block) steals focus
 *  away. Returns once activeCellCoords reports the target col, or after the retry budget. */
async function focusBodyCellStable(page: Page, row: number, col: number): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await focusBodyCell(page, row, col);
    const coords = await activeCellCoords(page);
    if (coords?.col === String(col) && coords?.row === String(row)) return;
    await page.waitForTimeout(50);
  }
}

/** Settle focus on (row, col) and press F2 to open its editor, retrying if a stray deferred
 *  focus-return (a prior block's commit/cancel rAF) steals focus before the editor mounts.
 *  Returns once a built-in editor is open at `col` (or after the retry budget). */
async function enterEditAt(page: Page, row: number, col: number): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await focusBodyCellStable(page, row, col);
    const open = await openEditor(page);
    if (open) return; // already editing this cell (rare; from a prior retry)
    await page.keyboard.press('F2');
    try {
      await expect.poll(async () => (await openEditor(page))?.col, { timeout: 2_000 }).toBe(String(col));
      return;
    } catch {
      // editor didn't open (focus stolen / F2 swallowed) — re-settle and retry.
    }
  }
}

/** Focus the grid's roving entry cell (data-row=0, data-col-index=0) to begin keyboard nav. */
async function focusEntryCell(page: Page): Promise<void> {
  await focusBodyCell(page, 0, 0);
}

// ════════════════════════════════════════════════════════════════════════════════════
// D-02 PIN-ROW PROBE (51-01) — the editing <tr> stays mounted in-flow out-of-window with
//   monotonic aria-rowindex + invariant total scroll height. The hard cross-target
//   surface, proven ×6 BEFORE Plan 51-04 wires it into the real DataTable windowing.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-edit [${target}]: D-02 pin-row stays mounted out-of-window; aria monotonic; total height invariant`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTablePinProbe&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    const scroll = mount.locator('.pin-probe-scroll');
    await expect(scroll).toBeVisible({ timeout: 15_000 });

    // The full model is 100 rows → windowing renders only a small slice.
    await expect
      .poll(async () => probeRenderedRows(page).then((r) => r.length), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => probeRenderedRows(page).then((r) => r.length), { timeout: 15_000 })
      .toBeLessThan(20);

    // Baseline total height with NO editor open (editor-closed state).
    const baselineHeight = await probeScrollHeight(page);
    expect(baselineHeight).not.toBeNull();
    expect(baselineHeight as number).toBeGreaterThan(0);

    // Open an editor on row index 3 (initially IN the natural window at scrollTop=0).
    await mount.getByTestId('begin-edit-btn').click();
    await expect
      .poll(async () => mount.getByTestId('pinned-readout').textContent(), { timeout: 10_000 })
      .toBe('3');
    // The editor element is mounted while the row is in view.
    await expect.poll(async () => probeEditorPresent(page), { timeout: 10_000 }).toBe(true);

    // Now scroll the pinned editing row FAR out of the natural window (row 3 → scroll
    // well past it; ~50 rows * 32px = 1600px is far beyond row 3's ~96px offset).
    await scrollProbeTo(page, 1600);

    // ── D-02 CORE ASSERTION ───────────────────────────────────────────────────────
    // The keyed editing <tr> is STILL in the DOM (the pin kept it mounted out of window).
    await expect.poll(async () => probeEditorPresent(page), { timeout: 10_000 }).toBe(true);
    const rowsScrolledAway = await probeRenderedRows(page);
    const pinnedRow = rowsScrolledAway.find((r) => r.index === 3);
    expect(pinnedRow, 'pinned editing row 3 must remain rendered out-of-window').toBeTruthy();
    expect(pinnedRow?.pinned).toBe(true);

    // aria-rowindex is monotonic with no gap across the rendered rows (the pinned row
    // leads the slice when it sits above the window). aria-rowindex == data-index + 1.
    for (const r of rowsScrolledAway) {
      expect(r.ariaRowIndex).toBe(r.index + 1);
    }
    for (let i = 1; i < rowsScrolledAway.length; i++) {
      expect(
        rowsScrolledAway[i].ariaRowIndex,
        'aria-rowindex must be strictly increasing in DOM order',
      ).toBeGreaterThan(rowsScrolledAway[i - 1].ariaRowIndex);
    }

    // Total scroll height (padTop + Σ rendered tr + padBottom = getTotalSize()) does NOT
    // change between editor-closed and editor-open-scrolled-away — the spacer-subtraction
    // math kept the total exact despite the pinned row living outside its natural spacer.
    const scrolledHeight = await probeScrollHeight(page);
    expect(scrolledHeight).not.toBeNull();
    expect(
      Math.abs((scrolledHeight as number) - (baselineHeight as number)),
      'total scroll height must stay invariant with the pinned row out-of-window',
    ).toBeLessThanOrEqual(1);

    // Committing/cancelling the edit lets the row rejoin normal windowing (unmount when
    // out of view): the editor is gone and no row is flagged pinned.
    await mount.getByTestId('end-edit-btn').click();
    await expect
      .poll(async () => mount.getByTestId('pinned-readout').textContent(), { timeout: 10_000 })
      .toBe('-1');
    await expect.poll(async () => probeEditorPresent(page), { timeout: 10_000 }).toBe(false);
    const rowsAfterCommit = await probeRenderedRows(page);
    expect(rowsAfterCommit.some((r) => r.pinned)).toBe(false);
    // Height is still the exact total after the row rejoined normal windowing.
    const afterHeight = await probeScrollHeight(page);
    expect(Math.abs((afterHeight as number) - (baselineHeight as number))).toBeLessThanOrEqual(1);
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// CLIPBOARD SPIKE (51-01, RESEARCH A3 / Pitfall 4) — confirm Playwright grants
//   clipboard-read + clipboard-write in the pinned Linux Chromium container under
//   single-worker, so the later clipboard wave (req-8, TSV copy/paste) has a working
//   harness. A TSV string written via navigator.clipboard.writeText must read back
//   identically via readText. The existing data-table specs never exercised clipboard —
//   this is NEW harness territory. If grantPermissions is BLOCKED in the container, the
//   documented page.evaluate clipboard-shim fallback is asserted through instead (the
//   spike records which path won in the SUMMARY).
//
// The spike runs once per target only to confirm the API surface is uniform ×6 — the
// page is irrelevant to the clipboard round-trip, but goto'ing a real cell keeps the
// browser context realistic (a clipboard call from about:blank can behave differently).
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-edit [${target}]: clipboard spike — TSV writeText/readText round-trips in the pinned container`, async ({
    page,
    context,
  }) => {
    // Grant both clipboard permissions on the context (Chromium supports both; the
    // harness is Chromium-pinned). If the container blocks the grant, the catch falls
    // through to the page.evaluate shim path below.
    let grantOk = true;
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch {
      grantOk = false;
    }

    await page.goto(`/?example=DataTablePinProbe&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const tsv = 'a1\tb1\na2\tb2';

    // Primary path: the real async Clipboard API (what req-8 copy/paste will use). A
    // round-trip through writeText → readText proves grantPermissions works in the
    // container under single-worker.
    const realRoundTrip = await page.evaluate(async (text) => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText || !navigator.clipboard.readText) {
          return { ok: false, value: null as string | null };
        }
        await navigator.clipboard.writeText(text);
        const read = await navigator.clipboard.readText();
        return { ok: true, value: read };
      } catch {
        return { ok: false, value: null as string | null };
      }
    }, tsv);

    if (grantOk && realRoundTrip.ok) {
      // grantPermissions path works — the SUMMARY records "grantPermissions works".
      expect(realRoundTrip.value).toBe(tsv);
    } else {
      // FALLBACK (documented shim, Pitfall 4): if the container blocked the grant or the
      // async API threw, prove the page.evaluate clipboard-shim round-trips so the later
      // clipboard wave has a deterministic harness. The shim stubs navigator.clipboard
      // with an in-page buffer so the component code path (writeText/readText) is
      // unchanged; only the backing store is shimmed.
      const shimRoundTrip = await page.evaluate(async (text) => {
        let buffer = '';
        const shim = {
          writeText: async (t: string) => {
            buffer = t;
          },
          readText: async () => buffer,
        };
        // Override only for this assertion (does not persist past the page).
        Object.defineProperty(navigator, 'clipboard', { value: shim, configurable: true });
        await navigator.clipboard.writeText(text);
        return navigator.clipboard.readText();
      }, tsv);
      expect(shimRoundTrip).toBe(tsv);
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// EDITING REQS 1-9 — STUBBED behind test.fixme pending Plans 51-02..04 (Wave-(a)..(c)).
//   These reference Column `editable`/`editor`/`validate` props + the DataTable #editor
//   slot + `r-model:data` + `cell-edit-commit` that DO NOT EXIST until Plan 51-02
//   declares them, so the DataTableEdit{,Virtual}Demo fixtures cannot be exercised yet.
//   Each becomes a real assertion as its wave ships (req-11 acceptance = no permanent
//   fixme by phase end). Listed here so the spec's coverage shape is visible from Wave-0.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  // req-1/2/3/4 — built-in editors + #editor slot + lifecycle + write-back (Wave-(a),
  // Plan 51-02). Drives DataTableEditDemo. (req-5 validation is a separate assertion below,
  // promoted in Plan 51-02 Task 3.)
  runnerFor(target)(`data-table-edit [${target}]: built-in editors enter/commit/cancel; #editor slot; one cell-edit-commit per commit`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableEdit&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('edit-table')).toBeVisible({ timeout: 15_000 });

    // The columns are name(0,text) qty(1,number) status(2,select) active(3,checkbox)
    // score(4,#editor slot). Begin keyboard nav at the entry cell (row 0, col 0).
    // ── req-1: F2 on the editable text cell mounts an <input> with data-editing-cell,
    //    focused, holding the existing value ('Alpha'). ────────────────────────────────
    await enterEditAt(page, 0, 0);
    await expect.poll(async () => (await openEditor(page))?.tag, { timeout: 10_000 }).toBe('input');
    {
      const ed = await openEditor(page);
      expect(ed?.type).toBe('text');
      expect(ed?.value).toBe('Alpha'); // F2 seeds the existing value (D-05).
      expect(ed?.col).toBe('0');
    }
    await expect.poll(async () => focusedTag(page), { timeout: 10_000 }).toBe('input');

    // ── req-3 (Escape revert): Escape closes the editor + reverts; no model write. ─────
    await page.keyboard.press('Escape');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    expect(await commitCount(page)).toBe(0);
    {
      const cells = await cellDisplayValues(page);
      expect(cells[0]).toBe('Alpha'); // unchanged (cancel writes nothing).
    }

    // ── req-1 + req-3 + req-4: F2 → type → Enter commits ONE cell-edit-commit + returns
    //    focus to the cell; the rendered cell updates FROM the model write. ─────────────
    await enterEditAt(page, 0, 0);
    await expect.poll(async () => (await openEditor(page))?.tag, { timeout: 10_000 }).toBe('input');
    // Wait for the component's rAF focus poll to land focus in the editor, then fill the
    // value (Playwright locators pierce open shadow DOM → Lit-safe). fill() focuses +
    // replaces the value + fires the input event the controlled draftValue binds.
    const editor1 = mount.locator('[data-editing-cell]');
    await editor1.fill('Zeta');
    await editor1.press('Enter');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    // Exactly one commit; the rendered cell reflects the MODEL write (req-4).
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(1);
    expect(await commitReadout(page)).toBe('name=Zeta');
    await expect.poll(async () => cellDisplayValues(page).then((c) => c[0]), { timeout: 10_000 }).toBe('Zeta');
    // Focus returned to the cell (data-grid-cell), not stuck in an input.
    await expect.poll(async () => (await activeCellCoords(page))?.col, { timeout: 10_000 }).toBe('0');

    // ── req-1: the select editor enters a native <select> seeded with the cell value. ──
    await enterEditAt(page, 0, 2); // col 2 (status, select)
    await expect.poll(async () => (await openEditor(page))?.tag, { timeout: 10_000 }).toBe('select');
    expect((await openEditor(page))?.value).toBe('active'); // row 0 status seed.
    // Press Escape ON the editor locator (focuses it first → the editor keymap receives it).
    await mount.locator('[data-editing-cell]').press('Escape');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();

    // ── req-1: the checkbox editor enters a checkbox seeded from the boolean value. ────
    await enterEditAt(page, 0, 3); // col 3 (active, checkbox)
    await expect.poll(async () => (await openEditor(page))?.type, { timeout: 10_000 }).toBe('checkbox');
    expect((await openEditor(page))?.checked).toBe(true); // row 0 active=true seed.
    await mount.locator('[data-editing-cell]').press('Escape');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();

    // ── req-2: the custom #editor stepped slot replaces the built-in editor on `score`,
    //    receives commit (the React render-prop edge), and a step commits one edit. ─────
    await focusBodyCellStable(page, 0, 4); // col 4 (score, custom #editor slot)
    await page.keyboard.press('F2');
    await expect.poll(async () => stepEditorPresent(page), { timeout: 10_000 }).toBe(true);
    // No built-in input is mounted for the custom column.
    expect((await openEditor(page))).toBeNull();
    const beforeStep = await commitCount(page);
    // The stepped control's "+" calls commit(value+1) → one cell-edit-commit; row 0 score 41 → 42.
    await page.getByTestId('step-up').click();
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(beforeStep + 1);
    expect(await commitReadout(page)).toBe('score=42');

    // ── req-3 (Tab advances to the next editable cell): F2 on col 0, edit, Tab commits +
    //    moves the editor to the next editable cell (col 1). ───────────────────────────
    await enterEditAt(page, 0, 0);
    await expect.poll(async () => (await openEditor(page))?.col, { timeout: 10_000 }).toBe('0');
    const editor2 = mount.locator('[data-editing-cell]');
    await editor2.fill('Omega');
    const beforeTab = await commitCount(page);
    await editor2.press('Tab');
    // Commit fired once and the editor advanced to col 1 (qty, number).
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(beforeTab + 1);
    await expect.poll(async () => (await openEditor(page))?.col, { timeout: 10_000 }).toBe('1');
    expect((await openEditor(page))?.type).toBe('number');
    await mount.locator('[data-editing-cell]').press('Escape');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
  });

  // req-5 — synchronous validation D-01 keep-open + aria-live + aria-invalid (Plan 51-02 Task 3).
  runnerFor(target)(`data-table-edit [${target}]: invalid commit keeps editor open, aria-live announces, no model write`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableEdit&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('edit-table')).toBeVisible({ timeout: 15_000 });

    // The qty column (col 1) carries the validator `value >= 0 || 'must be >= 0'`.
    await enterEditAt(page, 0, 1);
    await expect.poll(async () => (await openEditor(page))?.type, { timeout: 10_000 }).toBe('number');

    // Enter an INVALID value (negative) and commit → D-01: the editor STAYS OPEN, the model
    // is NOT written, zero cell-edit-commit, aria-invalid="true" on the <td>, aria-live announces.
    const editor = mount.locator('[data-editing-cell]');
    await editor.fill('-5');
    await editor.press('Enter');
    // The editor is still open (D-01 keep-open).
    await expect.poll(async () => (await openEditor(page))?.type, { timeout: 10_000 }).toBe('number');
    // No commit fired → no model write (the qty cell display is replaced by the open editor,
    // so the unchanged-model proof is the zero commit count + unchanged commit readout).
    expect(await commitCount(page)).toBe(0);
    expect(await commitReadout(page)).toBe('');
    // aria-invalid="true" on the editing cell (col 1).
    await expect
      .poll(async () => ariaInvalidColIndex(page), { timeout: 10_000 })
      .toBe('1');
    // The aria-live polite region announces the validator's message.
    await expect.poll(async () => srLiveText(page), { timeout: 10_000 }).toBe('must be >= 0');

    // Fix the value to a valid one → commits normally, clears aria-invalid + aria-live.
    await editor.fill('9');
    await editor.press('Enter');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(1);
    expect(await commitReadout(page)).toBe('qty=9');
    await expect.poll(async () => cellDisplayValues(page).then((c) => c[1]), { timeout: 10_000 }).toBe('9');
    // aria-invalid cleared (no cell flagged) and the aria-live region cleared/removed.
    expect(await ariaInvalidColIndex(page)).toBeNull();
    expect(await srLiveText(page)).toBe('');

    // Escape reverts: open again, enter invalid, Escape → editor closes, value reverts, no commit.
    await enterEditAt(page, 0, 1);
    await expect.poll(async () => (await openEditor(page))?.type, { timeout: 10_000 }).toBe('number');
    const editor2 = mount.locator('[data-editing-cell]');
    await editor2.fill('-3');
    await editor2.press('Escape');
    await expect.poll(async () => openEditor(page), { timeout: 10_000 }).toBeNull();
    expect(await commitCount(page)).toBe(1); // still 1 (Escape wrote nothing).
    expect((await cellDisplayValues(page))[1]).toBe('9'); // reverted to the last committed value.
  });

  // req-6 — full-row edit (Wave-(b), Plan 51-03). Drives DataTableEditDemo.
  test.fixme(`data-table-edit [${target}]: Shift+F2 full-row edit commits/reverts as a unit (Plan 51-03)`, async () => {
    // Pending Plan 51-03: Shift+F2 + the editRow verb enter every editable cell in the
    // active row; one r-model:data write + one row-edit-commit; Escape reverts the row.
  });

  // req-7/8/9 — range + clipboard + virtualization survival (Wave-(c), Plan 51-04). Drives
  // DataTableEditVirtualDemo + the clipboard harness proven above.
  test.fixme(`data-table-edit [${target}]: Shift+Arrow range; TSV copy/paste skip-invalid; editor survives virtualization recycle (Plan 51-04)`, async () => {
    // Pending Plan 51-04: Shift+Arrow/Shift+Click range distinct from row-selection;
    // getSelectedRange + range-change; Ctrl/Cmd+C/V TSV with the D-03 skip rule; and the
    // D-02 pin-row mechanism (proven in isolation by the probe above) wired into the real
    // DataTable windowing so an open editor survives recycling in DataTableEditVirtualDemo.
  });
}
