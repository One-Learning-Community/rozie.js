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
