import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 51 (data-table editable cells) — the DOM/behavioral VR matrix for
 * spreadsheet-grade inline editing (req-11). FINAL state (phase gate, Plan 51-05): reqs
 * 1-9 are ALL real assertions ×6 — there is NO permanent fixme stub anywhere in this
 * file (`KNOWN_FAILING` is the empty set; the only `.fixme` runner is the `runnerFor`
 * build-gate below, the Phase-49/53 precedent that skips a target whose host bundle has
 * not been built). The file was stood up in the Wave-0 de-risking plan (51-01)
 * with two probe blocks and the editing reqs stubbed; each stub was promoted to a real
 * assertion as its wave shipped (Plans 51-02..04), and this plan (51-05) consolidates +
 * stabilizes the matrix for the pinned-container single-worker gate.
 *
 *   D-02 PIN-ROW PROBE (51-01, RESEARCH A4 / Pitfall 3 / Open-Q2) — drives the STANDALONE
 *     examples/demos/DataTablePinProbeDemo.rozie (NO DataTable / @tanstack import; a
 *     minimal LOCAL copy of the Phase-53 windowedRows/padTop/padBottom math). Proves a
 *     keyed editing <tr> stays MOUNTED in-flow when it scrolls outside the virtual window,
 *     with aria-rowindex monotonic + total scroll height (padTop + Σ + padBottom =
 *     getTotalSize()) invariant — across all six reactivity systems. Resolves the
 *     in-flow-vs-out-of-flow question Plan 51-04 wired into the real DataTable.rozie.
 *
 *   CLIPBOARD SPIKE (51-01, RESEARCH A3 / Pitfall 4) — confirms Playwright grants
 *     clipboard-read + clipboard-write in the pinned Linux Chromium container under
 *     single-worker, so the clipboard wave (req-8) has a working harness. A TSV string
 *     written via navigator.clipboard.writeText reads back identically via readText; the
 *     documented page.evaluate shim fallback is asserted if grantPermissions is blocked.
 *
 *   EDITING REQS 1-9 (built-in editors, #editor slot, lifecycle, write-back, validation,
 *     full-row, range, clipboard paste, virtualization-survival) — real assertions ×6,
 *     driving DataTableEdit{,Virtual}Demo against the Plan-02..04 editing surface.
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

/** The number of open built-in editors ([data-editing-cell]) in the grid (shadow-pierced). In
 *  full-row mode every BUILT-IN editable cell of the active row is open at once; the custom
 *  #editor `score` column renders the stepped slot instead (counted separately). */
async function editingCellCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const out: Element[] = [];
    const walk = (root: Document | ShadowRoot): void => {
      out.push(...Array.from(root.querySelectorAll('[data-editing-cell]')));
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) walk(sr);
      }
    };
    walk(document);
    return out.length;
  });
}

/** The [data-col-index] of every open built-in editor's owning cell, in DOM order
 *  (shadow-pierced) — to assert editors land on the editable columns and not elsewhere. */
async function editingColIndices(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: Element[] = [];
    const walk = (root: Document | ShadowRoot): void => {
      out.push(...Array.from(root.querySelectorAll('[data-editing-cell]')));
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) walk(sr);
      }
    };
    walk(document);
    return out
      .map((el) => {
        const cell = el.closest('[data-grid-cell]');
        return cell ? cell.getAttribute('data-col-index') : null;
      })
      .filter((c): c is string => c != null);
  });
}

/** The row-commit-count readout (number of row-edit-commit emits, req-6). */
async function rowCommitCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('[data-testid="row-commit-count"]');
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

/** The row-commit readout ("col=v;col=v" of the changed columns, sorted) for the last
 *  row-edit-commit (req-6). */
async function rowCommitReadout(page: Page): Promise<string> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('[data-testid="row-commit-readout"]');
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

/** Focus (row, col) and KEEP it focused until the active cell settles there AND HOLDS across a
 *  stability window. A pending deferred focus-return (the commit/cancel rAF poll from a prior
 *  block — `focusCellWhenReady`) can fire AFTER focus first lands on the target and steal it
 *  back; checking once (the old behavior) could return during that window, so a subsequent F2
 *  lands on the wrong cell. We wait a settle tick AFTER focusing (so a pending steal manifests
 *  and is detected), then require the target to still hold after a second tick before returning
 *  — the deterministic root-cause fix for the editor-open-after-Escape race (51-02/04
 *  focus-settle / `rangeTransition` precedent), NOT a retry-budget bump. */
async function focusBodyCellStable(page: Page, row: number, col: number): Promise<void> {
  // WR-06: drive stabilization off the ACTUAL active-cell coords, not fixed 40ms sleeps. We
  // re-assert focus on the target each poll iteration (so a pending deferred focus-return that
  // steals focus is re-corrected, not just slept-through) and require the target to HOLD across
  // two consecutive reads before resolving. expect.poll's escalating intervals give a
  // deterministic condition (active cell == target, twice running) with a real timeout budget —
  // equivalent-or-stronger than the old retry-and-sleep loop, no flake-masking fixed sleep.
  await focusBodyCell(page, row, col);
  let stableHits = 0;
  await expect
    .poll(
      async () => {
        const a = await activeCellCoords(page);
        if (a?.row === String(row) && a?.col === String(col)) {
          stableHits += 1;
        } else {
          stableHits = 0;
          // A pending deferred focus-return stole focus (or it never landed) — re-assert it.
          await focusBodyCell(page, row, col);
        }
        return stableHits;
      },
      { timeout: 5_000, intervals: [40, 40, 40, 60, 100] },
    )
    .toBeGreaterThanOrEqual(2);
}

/** Settle the grid to an idle state, focus (row, col), and press F2 to open its editor. The
 *  editor-open-after-Escape race (the rotating-target flake at the built-in-editors block,
 *  51-04 deferred-items) had THREE deterministic causes, each fixed here so the gate is green
 *  by construction rather than retry-masked:
 *    (1) a prior step's editor must be FULLY unmounted before we steer focus — its async
 *        focus-return rAF (`focusCellWhenReady`) fires on unmount and yanks focus mid-enter;
 *    (2) focus must be STABLE on the target cell before F2 (a pending deferred focus-return
 *        can steal it after it first lands) — `focusBodyCellStable` now holds across a window;
 *    (3) no editor may be open at the instant of F2, else `onGridKeyDown`'s editing-mode
 *        early-return swallows the keypress (the F2 routes to the editor keymap, not the
 *        grid edit-entry seam).
 *  The loop remains as a belt-and-suspenders bound; the deterministic settles mean it
 *  normally enters on the first pass. */
async function enterEditAt(page: Page, row: number, col: number): Promise<void> {
  for (let i = 0; i < 8; i++) {
    // Fast path: already editing this EXACT cell (a prior retry's F2 may have landed late).
    const cur = await openEditor(page);
    if (cur?.col === String(col)) return;
    // (1) Close any editor open at a different cell and wait for it to FULLY unmount, so its
    //     focus-return rAF has fired + stopped before we steer focus.
    if (cur) {
      await page.keyboard.press('Escape');
      await expect.poll(async () => openEditor(page), { timeout: 5_000 }).toBeNull().catch(() => {});
    }
    // (2) Steer focus to the target cell and confirm it HOLDS (no pending focus-return steal).
    await focusBodyCellStable(page, row, col);
    const coords = await activeCellCoords(page);
    if (coords?.row !== String(row) || coords?.col !== String(col)) continue;
    // (3) No editor may be open at the instant of F2 (else onGridKeyDown swallows it).
    if (await openEditor(page)) continue;
    await page.keyboard.press('F2');
    try {
      await expect.poll(async () => (await openEditor(page))?.col, { timeout: 3_000 }).toBe(String(col));
      return;
    } catch {
      // opened at the wrong col / not at all — re-settle and retry.
    }
  }
  // Surface a genuine failure clearly instead of a silent fallthrough past the budget.
  await expect.poll(async () => (await openEditor(page))?.col, { timeout: 3_000 }).toBe(String(col));
}

/** Focus the grid's roving entry cell (data-row=0, data-col-index=0) to begin keyboard nav. */
async function focusEntryCell(page: Page): Promise<void> {
  await focusBodyCell(page, 0, 0);
}

/** The set of `[data-row]:[data-col-index]` for every cell carrying data-in-range="true",
 *  sorted (shadow-pierced) — to assert the selected rectangle's exact boundaries (req-7). */
async function inRangeCells(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: Element[] = [];
    const walk = (root: Document | ShadowRoot): void => {
      out.push(...Array.from(root.querySelectorAll('[data-grid-cell][data-in-range="true"]')));
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) walk(sr);
      }
    };
    walk(document);
    return out
      .map((el) => `${el.getAttribute('data-row')}:${el.getAttribute('data-col-index')}`)
      .sort();
  });
}

/** Scroll the real DataTable's `.rdt-scroll` viewport to `top` (walks open shadow roots). */
async function scrollGridTo(page: Page, top: number): Promise<void> {
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
    if (el) {
      el.scrollTop = y;
      el.dispatchEvent(new Event('scroll', { bubbles: false }));
    }
  }, top);
}

/** The rendered body rows' [data-index]/[aria-rowindex]/[data-pinned] off the real virtual
 *  table, in DOM order (shadow-pierced) — for the req-9 pin-row survival assertions. */
async function virtualRenderedRows(
  page: Page,
): Promise<{ index: number; ariaRowIndex: number; pinned: boolean }[]> {
  return page.evaluate(() => {
    const out: Element[] = [];
    const walk = (root: Document | ShadowRoot): void => {
      out.push(...Array.from(root.querySelectorAll('tbody.rdt-tbody > tr.rdt-tr[data-index]')));
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) walk(sr);
      }
    };
    walk(document);
    return out.map((tr) => ({
      index: Number(tr.getAttribute('data-index')),
      ariaRowIndex: Number(tr.getAttribute('aria-rowindex')),
      pinned: tr.getAttribute('data-pinned') === 'true',
    }));
  });
}

/** Read the readout testid's trimmed text (shadow-pierced), '' when absent. */
async function readoutText(page: Page, testid: string): Promise<string> {
  return page.evaluate((id) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(`[data-testid="${id}"]`);
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
  }, testid);
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
// EDITING REQS 1-9 — REAL assertions ×6 (phase gate, Plan 51-05). These drive the
//   DataTableEdit{,Virtual}Demo fixtures against the Plan-02..04 editing surface (Column
//   `editable`/`editor`/`editorOptions`/`validate`, the DataTable `#editor` slot,
//   `r-model:data` write-back, `cell-edit-commit`/`row-edit-commit`/`range-change`). No
//   fixme stub remains (req-11 acceptance: no permanent fixme by phase end).
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

    // ── Boolean in-place toggle (design doc 2026-07-05, Change 1): col 3 (active, checkbox)
    //    FLIPS + commits INSTANTLY on Space — NO editor opens, exactly one cell-edit-commit,
    //    and focus stays on the cell. Row 0 active=true → false. This SUPERSEDES the pre-toggle
    //    "checkbox editor opens" vehicle: a built-in editor:'checkbox' cell no longer opens an
    //    editor (matches the canonical data-table-grid-edit boolean-toggle tests). ───────────
    await focusBodyCellStable(page, 0, 3); // col 3 (active, checkbox)
    const beforeToggle = await commitCount(page);
    await page.keyboard.press(' ');
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(beforeToggle + 1);
    expect(await commitReadout(page)).toBe('active=false'); // true → false, exactly one commit
    expect(await openEditor(page)).toBeNull(); // no editor opened
    {
      const coords = await activeCellCoords(page); // focus held on the cell, not an input
      expect(coords?.col).toBe('3');
      expect(coords?.tag).not.toBe('input');
    }

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
  // Shift+F2 + the editRow verb enter every editable cell in the active row; one r-model:data
  // write + one row-edit-commit; Escape reverts the row as a unit.
  runnerFor(target)(`data-table-edit [${target}]: Shift+F2 + editRow verb full-row edit; one row-edit-commit; Escape reverts the row`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableEdit&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('edit-table')).toBeVisible({ timeout: 15_000 });

    // Columns: name(0,text) qty(1,number) status(2,select) active(3,checkbox) score(4,#editor
    // custom slot). ALL FIVE are editable → full-row edit opens 4 built-in editors + the
    // stepped #editor slot on `score`.

    // ── Shift+F2 puts EVERY editable cell in the active row into edit at once. ────────────
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('Shift+F2');
    // Four built-in editors mount (name/qty/status/active); the score column shows its
    // stepped #editor slot instead (counted separately).
    await expect.poll(async () => editingCellCount(page), { timeout: 10_000 }).toBe(4);
    expect(await stepEditorPresent(page)).toBe(true);
    // The built-in editors land on the editable data columns (cols 0-3), not on any other.
    {
      const cols = (await editingColIndices(page)).sort();
      expect(cols).toEqual(['0', '1', '2', '3']);
    }

    // Edit TWO cells in the row — name (col 0, text) and qty (col 1, number). Each editor
    // writes its OWN rowDraft key (the shared single-cell draftValue is never used in row mode).
    const nameEditor = mount.locator('[data-grid-cell][data-col-index="0"] [data-editing-cell]');
    const qtyEditor = mount.locator('[data-grid-cell][data-col-index="1"] [data-editing-cell]');
    await nameEditor.fill('AlphaEdited');
    await qtyEditor.fill('42');

    // Save the WHOLE row with one Enter (from the qty editor) → EXACTLY ONE row-edit-commit
    // carrying BOTH changed cells; the rendered row updates from the SINGLE model write.
    const beforeRowCommit = await rowCommitCount(page);
    expect(beforeRowCommit).toBe(0);
    await qtyEditor.press('Enter');
    // The row editors are gone (the whole row committed + closed as a unit).
    await expect.poll(async () => editingCellCount(page), { timeout: 10_000 }).toBe(0);
    await expect.poll(async () => stepEditorPresent(page), { timeout: 10_000 }).toBe(false);
    // EXACTLY ONE row-edit-commit (NOT one-per-cell) carrying both changed columns (sorted).
    await expect.poll(async () => rowCommitCount(page), { timeout: 10_000 }).toBe(1);
    expect(await rowCommitReadout(page)).toBe('name=AlphaEdited;qty=42');
    // No per-cell cell-edit-commit fired (the row path is its own single event).
    expect(await commitCount(page)).toBe(0);
    // The rendered row reflects the single model write (req-6): both cells updated.
    await expect
      .poll(async () => cellDisplayValues(page).then((c) => c[0]), { timeout: 10_000 })
      .toBe('AlphaEdited');
    await expect
      .poll(async () => cellDisplayValues(page).then((c) => c[1]), { timeout: 10_000 })
      .toBe('42');

    // ── Escape reverts the WHOLE row as a unit (no model write, no row-edit-commit). ──────
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('Shift+F2');
    await expect.poll(async () => editingCellCount(page), { timeout: 10_000 }).toBe(4);
    // Edit both cells again, then Escape — the drafts are dropped, the row is unchanged.
    await mount.locator('[data-grid-cell][data-col-index="0"] [data-editing-cell]').fill('SHOULD_REVERT');
    await mount.locator('[data-grid-cell][data-col-index="1"] [data-editing-cell]').fill('999');
    await mount.locator('[data-grid-cell][data-col-index="1"] [data-editing-cell]').press('Escape');
    await expect.poll(async () => editingCellCount(page), { timeout: 10_000 }).toBe(0);
    // No NEW row-edit-commit (still 1 from the prior save); the row reverted to its last values.
    expect(await rowCommitCount(page)).toBe(1);
    {
      const cells = await cellDisplayValues(page);
      expect(cells[0]).toBe('AlphaEdited'); // unchanged by the Escape'd row edit.
      expect(cells[1]).toBe('42');
    }

    // ── The editRow $expose verb enters the SAME full-row edit state (row index 1, Beta). ─
    await mount.getByTestId('call-editrow').click();
    // Row 1's four built-in editors + the score step slot open.
    await expect.poll(async () => editingCellCount(page), { timeout: 10_000 }).toBe(4);
    expect(await stepEditorPresent(page)).toBe(true);
    // The open editors sit on row 1 (data-row="1"), proving the verb targeted the right row.
    {
      const onRow1 = await page.evaluate(() => {
        const find = (root: Document | ShadowRoot): Element[] => {
          const out: Element[] = [];
          out.push(...Array.from(root.querySelectorAll('[data-editing-cell]')));
          for (const el of Array.from(root.querySelectorAll('*'))) {
            const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
            if (sr) out.push(...find(sr));
          }
          return out;
        };
        return find(document).every((el) => el.closest('[data-grid-cell]')?.getAttribute('data-row') === '1');
      });
      expect(onRow1).toBe(true);
    }
    // Escape closes the verb-opened row edit without a commit (the verb enters the same state).
    await mount.locator('[data-grid-cell][data-row="1"][data-col-index="0"] [data-editing-cell]').press('Escape');
    await expect.poll(async () => editingCellCount(page), { timeout: 10_000 }).toBe(0);
    expect(await rowCommitCount(page)).toBe(1); // verb-entered row was Escaped → no commit.
  });

  // req-7 — cell-range selection (Wave-(c), Plan 51-04). Index-based, one-way, distinct from
  // the row-selection slice. Drives DataTableEditDemo.
  runnerFor(target)(`data-table-edit [${target}]: Shift+Arrow/Shift+Click rectangular range; getSelectedRange + range-change; distinct from row-selection`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableEdit&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('edit-table')).toBeVisible({ timeout: 15_000 });

    // Columns: name(0) qty(1) status(2) active(3) score(4). Settle the active cell at (1,1).
    await focusBodyCellStable(page, 1, 1);

    // ── Shift+ArrowDown then Shift+ArrowRight marks the rectangle anchored at (1,1) →
    //    focus (2,2): the box is rows 1-2 × cols 1-2 (4 cells), each data-in-range="true". ──
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowRight');
    await expect
      .poll(async () => inRangeCells(page), { timeout: 10_000 })
      .toEqual(['1:1', '1:2', '2:1', '2:2']);
    // range-change fired (one emit per extend → 2) with the anchor:focus readout.
    await expect.poll(async () => readoutText(page, 'range-count'), { timeout: 10_000 }).toBe('2');
    expect(await readoutText(page, 'range-readout')).toBe('1,1:2,2');

    // getSelectedRange() returns the integer index pairs (no DOM node, no row data).
    await mount.getByTestId('call-getrange').click();
    await expect
      .poll(async () => readoutText(page, 'selected-range-readout'), { timeout: 10_000 })
      .toBe('1,1:2,2');

    // ── Shift+Click extends the range's moving corner to the clicked cell (0,0): the box is
    //    now rows 0-1 × cols 0-1 anchored at (1,1). ────────────────────────────────────────
    await page.evaluate(() => {
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
      const cell = grid?.querySelector('[data-grid-cell][data-row="0"][data-col-index="0"]') as HTMLElement | null;
      if (cell) {
        // Shift+Click: a shift-held mousedown carries shiftKey (a focusin does NOT), riding
        // the @mousedown range-extend seam, then the cell focuses (the follow-up focusin syncs
        // the active cell without collapsing the range).
        cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, shiftKey: true }));
        cell.focus();
      }
    });
    await expect
      .poll(async () => inRangeCells(page), { timeout: 10_000 })
      .toEqual(['0:0', '0:1', '1:0', '1:1']);
    expect(await readoutText(page, 'range-readout')).toBe('1,1:0,0');

    // ── Range vs row-selection do NOT corrupt each other: toggling all rows leaves the
    //    range intact; and a plain (non-shift) arrow collapses the range without touching
    //    row selection. ────────────────────────────────────────────────────────────────────
    await mount.getByTestId('call-toggleall').click();
    // The range is unchanged after a row-selection toggle.
    await mount.getByTestId('call-getrange').click();
    await expect
      .poll(async () => readoutText(page, 'selected-range-readout'), { timeout: 10_000 })
      .toBe('1,1:0,0');
    expect(await inRangeCells(page)).toEqual(['0:0', '0:1', '1:0', '1:1']);

    // A plain ArrowDown (no shift) collapses the range (no data-in-range cells remain).
    await focusBodyCellStable(page, 1, 1);
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => inRangeCells(page), { timeout: 10_000 }).toEqual([]);
  });

  // req-8 — clipboard TSV copy/paste + drag-fill (Wave-(c), Plan 51-04 Task 2). Drives
  // DataTableEditDemo; clipboard permissions granted per the Plan-01-proven approach.
  runnerFor(target)(`data-table-edit [${target}]: Ctrl/Cmd+C/V TSV skip-invalid + N-of-M announce; drag-fill value-copy; paste-as-text`, async ({
    page,
    context,
  }) => {
    // Grant clipboard permissions (the Plan-01-proven grantPermissions path — works in the
    // pinned container under single-worker). Use Control for the keyboard shortcut on Linux.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`/?example=DataTableEdit&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('edit-table')).toBeVisible({ timeout: 15_000 });

    // Columns: name(0,text) qty(1,number,validate>=0) status(2,select) active(3,checkbox)
    // score(4,#editor). Rows: Alpha/Beta/Gamma/Delta.

    // ── Ctrl/Cmd+C copies a 2×2 range (rows 0-1 × cols 0-1: name+qty of Alpha,Beta) as TSV. ─
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('Shift+ArrowDown'); // → (1,0)
    await page.keyboard.press('Shift+ArrowRight'); // → (1,1): box rows 0-1 × cols 0-1
    await expect
      .poll(async () => inRangeCells(page), { timeout: 10_000 })
      .toEqual(['0:0', '0:1', '1:0', '1:1']);
    await page.keyboard.press('ControlOrMeta+c');
    // The clipboard now holds the 2×2 TSV (Alpha\t3 / Beta\t7).
    await expect
      .poll(async () => page.evaluate(() => navigator.clipboard.readText()), { timeout: 10_000 })
      .toBe('Alpha\t3\nBeta\t7');

    // ── Ctrl/Cmd+V pastes a TSV grid anchored at the active cell under the D-03 skip rule.
    //    Seed a 1×2 TSV "Echo\t-5": col 0 (name, editable) writes; col 1 (qty) fails the
    //    >=0 validator → SKIPPED. Result: 1 of 2 cells pasted, one cell-edit-commit. ────────
    await page.evaluate(() => navigator.clipboard.writeText('Echo\t-5'));
    await focusBodyCellStable(page, 2, 0); // anchor at Gamma's name cell (row 2, col 0)
    const beforePaste = await commitCount(page);
    await page.keyboard.press('ControlOrMeta+v');
    // The name cell committed (Gamma → Echo); the qty cell was skipped (validator).
    // 5 columns per row → row r, col c is cell-display index (r*5 + c). Row 2 col 0 = index 10.
    await expect
      .poll(async () => cellDisplayValues(page).then((c) => c[10]), { timeout: 10_000 })
      .toBe('Echo');
    // Exactly ONE cell-edit-commit fired (the skipped invalid cell emitted nothing).
    await expect.poll(async () => commitCount(page), { timeout: 10_000 }).toBe(beforePaste + 1);
    // The N-of-M aria-live announce (D-03): 1 of 2 cells pasted.
    await expect
      .poll(async () => readoutText(page, 'paste-announce'), { timeout: 10_000 })
      .toBe('1 of 2 cells pasted');

    // ── T-51-01 (BLOCKING-high): pasted TSV is plain string DATA — markup is rendered as
    //    LITERAL TEXT, never parsed into elements / executed. Paste an <img onerror> payload
    //    into the editable name cell and assert the cell's textContent is the literal string
    //    and NO <img> element was created. ──────────────────────────────────────────────────
    const xss = '<img src=x onerror=alert(1)>';
    await page.evaluate((payload) => navigator.clipboard.writeText(payload), xss);
    await focusBodyCellStable(page, 3, 0); // Delta's name cell (row 3, col 0)
    await page.keyboard.press('ControlOrMeta+v');
    await expect
      .poll(async () => cellDisplayValues(page).then((c) => c[15]), { timeout: 10_000 })
      .toBe(xss); // row 3, col 0 = cell-display index 15: literal text, not markup.
    // No <img> element exists anywhere in the grid (shadow-pierced) — the payload was DATA.
    const imgCount = await page.evaluate(() => {
      let count = 0;
      const walk = (root: Document | ShadowRoot): void => {
        count += root.querySelectorAll('img').length;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) walk(sr);
        }
      };
      walk(document);
      return count;
    });
    expect(imgCount, 'pasted markup must render as text — no <img> element created (T-51-01)').toBe(0);

    // ── Drag-fill (D-04 — VALUE-COPY ONLY, no series detection; B7 — PER-COLUMN copy, no
    //    multi-column clobber): select a 1×2 horizontal SOURCE (row 0, cols 0-1 = Alpha + qty
    //    3), then drag the fill handle DOWN to row 2. Each source column copies its OWN value
    //    down its OWN column — name → Alpha down col 0, qty → 3 down col 1 — never a single
    //    scalar broadcast (which clobbered col 1, the B7 data-loss), never a numeric series. ──
    await focusBodyCellStable(page, 0, 0);
    await page.keyboard.press('Shift+ArrowRight'); // source row 0, cols 0-1 (handle at (0,1))
    await expect
      .poll(async () => inRangeCells(page), { timeout: 10_000 })
      .toEqual(['0:0', '0:1']);
    const anchorName = (await cellDisplayValues(page))[0]; // row 0 name (the col-0 fill source).
    await page.waitForTimeout(150); // let the SOURCE range internally commit (React useState async)
    // pointerdown on the handle (captures the pre-drag source box) + pointermove to cell (2,1)
    // (extends the range via the shadow-pierced cellIndexFromPoint; tracks the gesture's end cell).
    await page.evaluate(() => {
      const findCell = (sel: string): HTMLElement | null => {
        const walk = (root: Document | ShadowRoot): HTMLElement | null => {
          const direct = root.querySelector(sel) as HTMLElement | null;
          if (direct) return direct;
          for (const el of Array.from(root.querySelectorAll('*'))) {
            const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
            if (sr) { const inner = walk(sr); if (inner) return inner; }
          }
          return null;
        };
        return walk(document);
      };
      const handle = findCell('[data-fill-handle]');
      const target = findCell('[data-grid-cell][data-row="2"][data-col-index="1"]');
      if (handle && target) {
        const tr = target.getBoundingClientRect();
        const cx = tr.left + tr.width / 2;
        const cy = tr.top + tr.height / 2;
        const hr = handle.getBoundingClientRect();
        handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: hr.left + hr.width / 2, clientY: hr.top + hr.height / 2 }));
        document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: cx, clientY: cy }));
      }
    });
    await page.waitForTimeout(250); // let setRangeFocus + the gesture end cell settle (React)
    await page.evaluate(() => {
      const findCell = (sel: string): HTMLElement | null => {
        const walk = (root: Document | ShadowRoot): HTMLElement | null => {
          const direct = root.querySelector(sel) as HTMLElement | null;
          if (direct) return direct;
          for (const el of Array.from(root.querySelectorAll('*'))) {
            const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
            if (sr) { const inner = walk(sr); if (inner) return inner; }
          }
          return null;
        };
        return walk(document);
      };
      const target = findCell('[data-grid-cell][data-row="2"][data-col-index="1"]');
      if (target) {
        const tr = target.getBoundingClientRect();
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: tr.left + tr.width / 2, clientY: tr.top + tr.height / 2 }));
      }
    });
    // col 0 (name): rows 0-2 all equal the source name (value-copy down, NOT a series).
    // Name cells are at indices 0, 5, 10 (col 0 of rows 0,1,2 with 5 columns per row).
    await expect
      .poll(async () => cellDisplayValues(page).then((c) => [c[0], c[5], c[10]]), { timeout: 10_000 })
      .toEqual([anchorName, anchorName, anchorName]);
    // B7: col 1 (qty) ALSO copied its OWN source value (3) down — NOT clobbered by the name
    // broadcast (the pre-fix data loss), NOT incremented into a series. qty cells = 1, 6, 11.
    await expect
      .poll(async () => cellDisplayValues(page).then((c) => [c[1], c[6], c[11]]), { timeout: 10_000 })
      .toEqual(['3', '3', '3']);
  });

  // req-9 — editor + index-based range survive virtualization recycling (Wave-(c), Plan 51-04
  // Task 3). The D-02 pin-row mechanism wired into the real DataTable windowing. Drives
  // DataTableEditVirtualDemo (~2000 rows, virtual, maxHeight 400px).
  runnerFor(target)(`data-table-edit [${target}]: open editor + index-based range survive virtualization recycle`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableEditVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.getByTestId('edit-virtual-table')).toBeVisible({ timeout: 15_000 });

    // The virtual window renders only a small slice of the 2000-row model.
    await expect
      .poll(async () => virtualRenderedRows(page).then((r) => r.length), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // ── Open an editor on a row initially IN the window (row index 3, name col 0). ──────────
    await enterEditAt(page, 3, 0);
    await expect.poll(async () => (await openEditor(page))?.col, { timeout: 10_000 }).toBe('0');
    // Type a value into the editor (controlled draft) so we can prove it persists across scroll.
    const editor = mount.locator('[data-editing-cell]');
    await editor.fill('PinnedEdit');
    await expect.poll(async () => (await openEditor(page))?.value, { timeout: 10_000 }).toBe('PinnedEdit');

    // ── Scroll the editing row FAR out of the window (row 3 → scroll ~30000px down, well past
    //    its ~120px offset). The pinned row must stay mounted (D-02). ─────────────────────────
    await scrollGridTo(page, 30_000);

    // Exactly ONE editor exists throughout (no orphan / duplicate), its value persists, and the
    // pinned <tr> (data-index=3) is rendered + flagged pinned out-of-window.
    await expect.poll(async () => editingCellCount(page), { timeout: 10_000 }).toBe(1);
    await expect.poll(async () => (await openEditor(page))?.value, { timeout: 10_000 }).toBe('PinnedEdit');
    {
      const rows = await virtualRenderedRows(page);
      const pinned = rows.find((r) => r.index === 3);
      expect(pinned, 'the editing row 3 must stay mounted out-of-window (D-02)').toBeTruthy();
      expect(pinned?.pinned).toBe(true);
      // aria-rowindex stays monotonic with no gap across the rendered rows (== data-index + 2, header-inclusive).
      for (const r of rows) expect(r.ariaRowIndex).toBe(r.index + 2);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].ariaRowIndex).toBeGreaterThan(rows[i - 1].ariaRowIndex);
      }
    }

    // ── Scroll BACK so the editing row re-enters the natural window. The same single editor is
    //    still open with its value (NOT recycled into another row's data). ────────────────────
    await scrollGridTo(page, 0);
    await expect.poll(async () => editingCellCount(page), { timeout: 10_000 }).toBe(1);
    await expect.poll(async () => (await openEditor(page))?.value, { timeout: 10_000 }).toBe('PinnedEdit');
    {
      // Back in the window, row 3 is no longer a PINNED union entry (it rejoined naturally).
      const rows = await virtualRenderedRows(page);
      const r3 = rows.find((r) => r.index === 3);
      expect(r3, 'row 3 must be present back in the natural window').toBeTruthy();
      expect(r3?.pinned).toBe(false);
    }

    // ── Commit closes the editor; the pinned row rejoins normal windowing (no row flagged
    //    pinned, exactly zero open editors). Re-focus the editor before Enter and retry: after
    //    the scroll-back re-render the editor is a fresh DOM node on the fine-grained targets,
    //    so a one-shot .press() can race the remount (focus lands on a detached node). ─────────
    for (let i = 0; i < 8; i++) {
      const ed = mount.locator('[data-editing-cell]');
      if ((await ed.count()) === 0) break;
      await ed.first().focus();
      await ed.first().press('Enter');
      try {
        await expect.poll(async () => editingCellCount(page), { timeout: 1_500 }).toBe(0);
        break;
      } catch {
        // editor still open (remount race) — re-focus + retry.
      }
    }
    await expect.poll(async () => editingCellCount(page), { timeout: 10_000 }).toBe(0);
    expect((await virtualRenderedRows(page)).some((r) => r.pinned)).toBe(false);
    // The committed value rendered from the single model write (req-4/9).
    await expect
      .poll(async () => readoutText(page, 'commit-readout'), { timeout: 10_000 })
      .toBe('name=PinnedEdit');

    // ── The index-based range reattaches to the CORRECT cells across scroll-out-and-back
    //    (req-9): select a small rectangle, scroll it out and back, assert the range highlight
    //    lands on the same index cells. Re-settle focus + retry the Shift+ArrowDown: a stray
    //    deferred focus-return from the just-committed editor (the commit's rAF focus poll) can
    //    drift the active cell off (2,0) before the keypress on the fine-grained targets. ──────
    for (let i = 0; i < 8; i++) {
      await focusBodyCellStable(page, 2, 0);
      await page.keyboard.press('Shift+ArrowDown'); // box rows 2-3 × col 0
      try {
        await expect.poll(async () => readoutText(page, 'range-readout'), { timeout: 1_500 }).toBe('2,0:3,0');
        break;
      } catch {
        // focus drifted / range not set — clear any partial range and retry from (2,0).
        await page.keyboard.press('ArrowUp');
      }
    }
    await expect
      .poll(async () => readoutText(page, 'range-readout'), { timeout: 10_000 })
      .toBe('2,0:3,0');
    // Scroll the range far out of view, then back.
    await scrollGridTo(page, 30_000);
    await scrollGridTo(page, 0);
    // getSelectedRange still reports the same index pairs (index-based — survives recycling).
    await mount.getByTestId('call-getrange').click();
    await expect
      .poll(async () => readoutText(page, 'selected-range-readout'), { timeout: 10_000 })
      .toBe('2,0:3,0');
    // The highlight reattached to the SAME index cells (rows 2-3, col 0).
    await expect
      .poll(async () => inRangeCells(page), { timeout: 10_000 })
      .toEqual(['2:0', '3:0']);
  });
}
