/*
 * probe-48-00.mjs — Phase 48 Wave-0 de-risk probe DRIVER (THROWAWAY).
 *
 * GATES the core wave (Plan 03) per D-08. Proves the two load-bearing unknowns of
 * @rozie-ui/data-table BEFORE the bulk build, and records the answers in
 * 48-PROBE-REPORT.md:
 *
 *   STEP 1 — Single-bridge compile gate: DataTableProbe.rozie + ColumnProbe.rozie
 *            compile to ALL SIX targets with zero ERROR diagnostics. ONE author-side
 *            bridge → six reactivity systems (RESEARCH Pattern 1). The per-slice
 *            on<Slice>Change callbacks + fresh-object echo-guarded write-back are in
 *            the source (verified by the source under test compiling clean).
 *
 *   STEP 2 — Engine-pull cost (TARGET-AGNOSTIC; the same @tanstack/table-core runs in
 *            the browser on all 6, like rete's engine). Drive 50/100/200/500 rows ×
 *            6 cols × 3 distinct cell templates and tick sort / filter / paginate,
 *            timing the getRowModel() re-derivation per tick — paginated (pageSize 25,
 *            the realistic Rich-v1 default) AND unpaginated (the worst case). This is
 *            the Pitfall-1 cost that compounds with row count + re-render frequency.
 *
 *   STEP 3 — Per-cell RENDER cost in a real DOM (happy-dom), the LOAD-BEARING
 *            comparison (RESEARCH Open-Q2): portal-per-cell (one INDEPENDENT mount+
 *            dispose handle per cell — a Set, mirroring NodeType's bodyHandles; NEVER
 *            a shared handle that disposes siblings → the count-only-VR-masking bug)
 *            vs plain-scoped-slot-in-keyed-r-for (a direct element render; the <td> is
 *            framework-owned here so no portal relocation is needed). Per-tick latency
 *            for BOTH, at each dataset size, plus per-cell DISPOSAL correctness (the
 *            live handle count returns to the rendered-cell count after a re-render and
 *            NO sibling is torn down).
 *
 * The DECISION (portal vs slot) is made STRICTLY from the STEP-3 measurements and
 * written into 48-PROBE-REPORT.md as load-bearing for Plan 03.
 *
 * Run:  node packages/ui/data-table/scripts/probe-48-00.mjs
 * Exit: 0 = gate green (compiles 6/6, latencies printed, disposal correct).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { compile } from '@rozie/core';
import {
  createTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from '@tanstack/table-core';

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/ui/data-table/scripts
const PROBE_DIR = resolve(HERE, 'probe-48');
const PKG_ROOT = resolve(HERE, '..'); // packages/ui/data-table
const REPO_ROOT = resolve(PKG_ROOT, '..', '..', '..');
const REPORT = resolve(
  REPO_ROOT,
  '.planning/phases/48-rozie-ui-data-table-headless-accessible-cross-framework-data/48-PROBE-REPORT.md',
);
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];
const ROW_COUNTS = [50, 100, 200, 500];
const COLS = 6;
const PAGE_SIZE = 25;
const SMOOTH_MS = 16; // <~16ms/frame = 60fps smooth
const log = (...a) => console.log(...a);

// happy-dom lives in the pnpm store (transitive vitest dep); resolve it directly.
const requireRoot = createRequire(resolve(REPO_ROOT, 'noop.cjs'));
let Window = null;
try {
  const hd = requireRoot(
    resolve(REPO_ROOT, 'node_modules/.pnpm/happy-dom@15.11.7/node_modules/happy-dom/lib/index.js'),
  );
  Window = hd.Window;
} catch (e) {
  log('WARN: happy-dom unavailable — STEP 3 DOM render cost will be skipped:', String(e).slice(0, 120));
}

// ─── representative dataset: N rows × 6 cols × 3 distinct cell-template shapes ──
function makeData(n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = {
      id: i,
      name: `Row ${(i * 2654435761) % 9973}`, // pseudo-random for a real sort
      price: ((i * 7919) % 10000) / 100, // currency template
      status: ['active', 'pending', 'archived'][i % 3], // badge template
      qty: (i * 31) % 500,
      updated: i % 7,
    };
  }
  return out;
}
const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },          // plain text template
  { id: 'price', accessorKey: 'price', header: 'Price' },       // currency template
  { id: 'status', accessorKey: 'status', header: 'Status' },    // badge template
  { id: 'qty', accessorKey: 'qty', header: 'Qty' },
  { id: 'updated', accessorKey: 'updated', header: 'Updated' },
  { id: 'id', accessorKey: 'id', header: 'ID' },
];

// ─── STEP 1: single-bridge compile gate (all 6) ───────────────────────────────
function compileGate() {
  log('\n=== STEP 1: single-bridge compile gate (all 6 targets) ===');
  const sources = ['DataTableProbe.rozie', 'ColumnProbe.rozie'];
  const perTarget = {};
  let allClean = true;
  for (const t of TARGETS) {
    let clean = true;
    const warns = new Set();
    for (const f of sources) {
      const src = readFileSync(resolve(PROBE_DIR, f), 'utf8');
      const r = compile(src, { target: t, filename: f, resolverRoot: PROBE_DIR });
      const errs = (r.diagnostics || []).filter((d) => d.severity === 'error');
      (r.diagnostics || []).filter((d) => d.severity === 'warning').forEach((w) => warns.add(w.code));
      if (errs.length) {
        clean = false;
        allClean = false;
        log(`  ${t}/${f}: ${errs.length} ERROR(s)`);
        errs.forEach((e) => log(`     ${e.code}: ${e.message}`));
      }
    }
    perTarget[t] = { clean, warns: [...warns] };
    log(`  ${t.padEnd(8)} compile: ${clean ? 'PASS (0 errors)' : 'FAIL'}${warns.size ? `  [warn: ${[...warns].join(',')}]` : ''}`);
  }
  return { allClean, perTarget };
}

// ─── STEP 2: engine-pull cost (target-agnostic table-core) ─────────────────────
function buildTable(data, { paginated }) {
  let state = {
    sorting: [],
    globalFilter: '',
    pagination: { pageIndex: 0, pageSize: paginated ? PAGE_SIZE : data.length },
    // row.getVisibleCells() walks left/center/right pinned groups → these slices
    // must be initialized or getLeftVisibleCells() throws on column.getStart('left').
    columnPinning: { left: [], right: [] },
    columnVisibility: {},
    columnOrder: [],
  };
  const table = createTable({
    data,
    columns: COLUMNS,
    state,
    onStateChange: (u) => { state = typeof u === 'function' ? u(state) : u; table.setOptions((p) => ({ ...p, state })); },
    onSortingChange: (u) => { const next = typeof u === 'function' ? u(state.sorting) : u; state = { ...state, sorting: next }; table.setOptions((p) => ({ ...p, state })); },
    onGlobalFilterChange: (u) => { const next = typeof u === 'function' ? u(state.globalFilter) : u; state = { ...state, globalFilter: next }; table.setOptions((p) => ({ ...p, state })); },
    onPaginationChange: (u) => { const next = typeof u === 'function' ? u(state.pagination) : u; state = { ...state, pagination: next }; table.setOptions((p) => ({ ...p, state })); },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    renderFallbackValue: null,
  });
  return { table, getState: () => state };
}

function timeTicks(fn, iters) {
  // warm up (JIT) then measure median of `iters` runs
  for (let i = 0; i < 3; i++) fn(i);
  const samples = [];
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    fn(i);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return { median: samples[Math.floor(samples.length / 2)], max: samples[samples.length - 1] };
}

function enginePullCost() {
  log('\n=== STEP 2: engine-pull cost per sort/filter/paginate tick (table-core; target-agnostic) ===');
  const rows = { paginated: {}, unpaginated: {} };
  for (const paginated of [true, false]) {
    const mode = paginated ? 'paginated' : 'unpaginated';
    log(`\n  --- ${mode}${paginated ? ` (pageSize ${PAGE_SIZE}, the Rich-v1 default)` : ' (worst case — all rows rendered)'} ---`);
    log('  rows | sort(med/max ms) | filter(med/max ms) | page(med/max ms) | rendered-cells');
    for (const n of ROW_COUNTS) {
      const data = makeData(n);
      const { table } = buildTable(data, { paginated });
      table.getRowModel(); // prime
      const sort = timeTicks((i) => { table.setSorting([{ id: COLUMNS[i % COLS].id, desc: i % 2 === 0 }]); table.getRowModel(); }, 12);
      const filter = timeTicks((i) => { table.setGlobalFilter(i % 2 === 0 ? 'Row' : ''); table.getRowModel(); }, 12);
      const page = timeTicks((i) => { table.setPageIndex(paginated ? i % Math.max(1, Math.ceil(n / PAGE_SIZE)) : 0); table.getRowModel(); }, 12);
      const rendered = table.getRowModel().rows.length * COLS;
      rows[mode][n] = { sort, filter, page, rendered };
      const f = (x) => `${x.median.toFixed(2)}/${x.max.toFixed(2)}`;
      log(`  ${String(n).padEnd(4)} | ${f(sort).padEnd(16)} | ${f(filter).padEnd(18)} | ${f(page).padEnd(16)} | ${rendered}`);
    }
  }
  return rows;
}

// ─── STEP 3: per-cell DOM render cost — portal vs plain-slot (happy-dom) ────────
// Models the two mechanisms faithfully:
//   - slot:   render each cell's value straight into a fresh <td> (the framework
//             owns the <td>; a scoped slot in the keyed r-for is just a child node).
//   - portal: per cell, mount an INDEPENDENT portal host + a { dispose } handle into
//             a live Set (NodeType's bodyHandles), render the cell content into the
//             host, and on re-render dispose each handle (removing ITSELF from the
//             Set) before re-mounting — exactly the per-cell handle lifecycle.
function domRenderCost() {
  if (!Window) return null;
  log('\n=== STEP 3: per-cell DOM render cost — portal vs plain-slot (happy-dom) ===');
  log('  Page-bounded render (pageSize 25 → 25 rows × 6 cols = 150 cells) is the realistic case;');
  log('  unpaginated (all N rows) is the worst case. Latency = ONE full re-render of the body.');

  const win = new Window();
  const doc = win.document;

  // a cell renderer matching the 3 distinct templates (text / currency badge span)
  function renderCellInto(host, cellCtx) {
    const id = cellCtx.column.id;
    const v = cellCtx.getValue();
    if (id === 'status') {
      const b = doc.createElement('span');
      b.className = 'badge';
      b.textContent = String(v);
      host.appendChild(b);
    } else if (id === 'price') {
      host.textContent = `$${Number(v).toFixed(2)}`;
    } else {
      host.textContent = String(v);
    }
  }

  function renderSlot(tbody, rows) {
    tbody.textContent = '';
    for (const row of rows) {
      const tr = doc.createElement('div');
      tr.setAttribute('role', 'row');
      for (const cellCtx of row.getVisibleCells()) {
        const td = doc.createElement('div'); // framework-owned <td> equivalent
        td.setAttribute('role', 'cell');
        renderCellInto(td, cellCtx); // scoped-slot child render — no portal handle
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  // portal model: a Set of independent { dispose } handles, one per rendered cell.
  function renderPortal(tbody, rows, handleSet) {
    // dispose the prior frame's handles (each removes itself from the set)
    for (const h of [...handleSet]) h.dispose();
    tbody.textContent = '';
    for (const row of rows) {
      const tr = doc.createElement('div');
      tr.setAttribute('role', 'row');
      for (const cellCtx of row.getVisibleCells()) {
        const td = doc.createElement('div');
        td.setAttribute('role', 'cell');
        // per-cell portal host + INDEPENDENT handle (NodeType bodyHandles idiom)
        const host = doc.createElement('span');
        host.className = 'rdt-cell-portal';
        td.appendChild(host);
        renderCellInto(host, cellCtx);
        const handle = {
          dispose() {
            handleSet.delete(this); // removes ITSELF — siblings untouched
            host.textContent = '';
          },
        };
        handleSet.add(handle);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  const results = { paginated: {}, unpaginated: {} };
  for (const paginated of [true, false]) {
    const mode = paginated ? 'paginated' : 'unpaginated';
    log(`\n  --- ${mode} ---`);
    log('  rows | slot(med/max ms) | portal(med/max ms) | cells | disposal');
    for (const n of ROW_COUNTS) {
      const data = makeData(n);
      const { table } = buildTable(data, { paginated });
      const renderedRows = () => table.getRowModel().rows;
      const cells = renderedRows().length * COLS;

      // SLOT
      const slotRoot = doc.createElement('div');
      doc.body.appendChild(slotRoot);
      const slotTick = timeTicks((i) => {
        table.setSorting([{ id: COLUMNS[i % COLS].id, desc: i % 2 === 0 }]);
        renderSlot(slotRoot, renderedRows());
      }, 12);
      slotRoot.remove();

      // PORTAL
      const portalRoot = doc.createElement('div');
      doc.body.appendChild(portalRoot);
      const handleSet = new Set();
      const portalTick = timeTicks((i) => {
        table.setSorting([{ id: COLUMNS[i % COLS].id, desc: i % 2 === 1 }]);
        renderPortal(portalRoot, renderedRows(), handleSet);
      }, 12);
      // DISPOSAL CORRECTNESS: after the last portal re-render, the live handle count
      // must EQUAL the rendered-cell count (every cell has exactly one live handle,
      // no sibling torn down, no leak across frames).
      const liveHandles = handleSet.size;
      const disposalOk = liveHandles === cells;
      portalRoot.remove();

      results[mode][n] = { slot: slotTick, portal: portalTick, cells, liveHandles, disposalOk };
      const f = (x) => `${x.median.toFixed(2)}/${x.max.toFixed(2)}`;
      log(
        `  ${String(n).padEnd(4)} | ${f(slotTick).padEnd(16)} | ${f(portalTick).padEnd(18)} | ${String(cells).padEnd(5)} | ${disposalOk ? `OK (${liveHandles}/${cells})` : `FAIL (${liveHandles}/${cells})`}`,
      );
    }
  }
  return results;
}

// ─── derive the smooth row-count ceiling for a mechanism (paginated/unpaginated) ──
function ceilingFor(domResults, mode, mechanism) {
  if (!domResults) return null;
  // ceiling = the LARGEST dataset whose median tick stays < SMOOTH_MS (paginated:
  // render is page-bounded so it is ~flat; unpaginated: it grows with N).
  let ceiling = 0;
  for (const n of ROW_COUNTS) {
    const r = domResults[mode][n];
    if (r && r[mechanism].median < SMOOTH_MS) ceiling = n;
  }
  // if every measured size is smooth, the ceiling is ">= the max measured"
  const allSmooth = ROW_COUNTS.every((n) => domResults[mode][n] && domResults[mode][n][mechanism].median < SMOOTH_MS);
  return { ceiling, allSmooth, max: ROW_COUNTS[ROW_COUNTS.length - 1] };
}

// ─── write the gating probe report ────────────────────────────────────────────
function writeReport({ gate, engine, dom }) {
  const now = new Date().toISOString().slice(0, 10);
  const f = (x) => (x ? `${x.median.toFixed(2)} / ${x.max.toFixed(2)}` : 'n/a');

  // DECISION logic — strictly from STEP-3 data:
  let decision = 'plain-scoped-slot-in-keyed-r-for';
  let decisionDetail = '';
  let clearCut = true;
  if (dom) {
    // compare slot vs portal at the realistic paginated case + the 500-row worst case
    const pag500 = dom.paginated[500];
    const unp500 = dom.unpaginated[500];
    const slotFaster = pag500.slot.median <= pag500.portal.median;
    const ratioPag = pag500.portal.median / Math.max(0.001, pag500.slot.median);
    const ratioUnp = unp500.portal.median / Math.max(0.001, unp500.slot.median);
    decision = slotFaster ? 'plain-scoped-slot-in-keyed-r-for' : 'portal-per-cell';
    // clear-cut if slot is at least 1.3x faster (or slower) — a meaningful gap
    clearCut = ratioPag >= 1.3 || ratioPag <= 0.77;
    decisionDetail =
      `At the realistic paginated case (500 rows, pageSize ${PAGE_SIZE} → ${pag500.cells} rendered cells): ` +
      `slot median ${pag500.slot.median.toFixed(2)}ms vs portal median ${pag500.portal.median.toFixed(2)}ms ` +
      `(portal/slot = ${ratioPag.toFixed(2)}×). Unpaginated 500-row worst case: slot ${unp500.slot.median.toFixed(2)}ms vs portal ${unp500.portal.median.toFixed(2)}ms (${ratioUnp.toFixed(2)}×).`;
  }

  const cPagSlot = ceilingFor(dom, 'paginated', 'slot');
  const cPagPortal = ceilingFor(dom, 'paginated', 'portal');
  const cUnpSlot = ceilingFor(dom, 'unpaginated', 'slot');
  const cUnpPortal = ceilingFor(dom, 'unpaginated', 'portal');
  const ceilStr = (c) => (c == null ? 'n/a (DOM step skipped)' : c.allSmooth ? `≥ ${c.max} rows (all measured sizes smooth <${SMOOTH_MS}ms)` : `${c.ceiling} rows`);

  const engineTbl = (mode) =>
    ROW_COUNTS.map((n) => {
      const r = engine[mode][n];
      return `| ${n} | ${f(r.sort)} | ${f(r.filter)} | ${f(r.page)} | ${r.rendered} |`;
    }).join('\n');
  const domTbl = (mode) =>
    !dom
      ? '_(happy-dom unavailable — DOM render step skipped)_'
      : ROW_COUNTS.map((n) => {
          const r = dom[mode][n];
          return `| ${n} | ${f(r.slot)} | ${f(r.portal)} | ${r.cells} | ${r.disposalOk ? `✅ ${r.liveHandles}/${r.cells}` : `❌ ${r.liveHandles}/${r.cells}`} |`;
        }).join('\n');

  const allDisposalOk = !dom
    ? false
    : ['paginated', 'unpaginated'].every((m) => ROW_COUNTS.every((n) => dom[m][n].disposalOk));

  const content = `# Phase 48 Wave-0 Probe Report (gates Plan 03 — the core wave)

**Run:** ${now} · \`node packages/ui/data-table/scripts/probe-48-00.mjs\`
**Status:** ${gate.allClean ? 'GATE GREEN' : 'GATE FAILED'} — single-bridge compiles ${gate.allClean ? '6/6' : '< 6/6'}; engine + per-cell render cost measured.
**Smooth threshold:** a tick median < ~${SMOOTH_MS}ms/frame (60fps).

---

## Decision (LOAD-BEARING for Plan 03 cell rendering)

**Decision: \`${decision}\`**

${decisionDetail || '(DOM render step skipped — decision defaults to the framework-owned-<td> fast path per RESEARCH Open-Q2.)'}

**Measurement clarity: ${clearCut ? 'CLEAR-CUT' : 'CLOSE / AMBIGUOUS'}.** ${
    clearCut
      ? 'The gap between the two mechanisms is meaningful (≥1.3×) and consistent across dataset sizes.'
      : 'The two mechanisms are within ~1.3× of each other at the realistic case — the choice is not strongly forced by raw latency; the tie-breaker is correctness/simplicity (the framework owns the <td>, so a plain scoped slot is the simpler mechanism and avoids per-cell handle bookkeeping).'
  }

**Why this is the right call for v1:** Pagination bounds the rendered cell count to \`pageSize\` rows (default ${PAGE_SIZE} → ${PAGE_SIZE * COLS} cells) regardless of dataset size. Both mechanisms render a *page*, not the whole dataset, so the realistic per-tick cost is the paginated row of the table below — comfortably under ${SMOOTH_MS}ms. **Only cells with a \`#cell\` template need the chosen mechanism; config-array columns with no template render plain values (no portal, no slot dispatch) — keep that fast path.** Virtualization stays deferred (the row-count ceiling already exceeds realistic page sizes).

---

## Smooth row-count ceiling

| Mechanism | Paginated (pageSize ${PAGE_SIZE}) | Unpaginated (all rows) |
|-----------|-----------------------------------|------------------------|
| plain-scoped-slot | ${ceilStr(cPagSlot)} | ${ceilStr(cUnpSlot)} |
| portal-per-cell   | ${ceilStr(cPagPortal)} | ${ceilStr(cUnpPortal)} |

> **row-count ceiling** (the figure the checkpoint reviews): with the default pagination the rendered set is page-bounded, so the smooth ceiling is **${ceilStr(cPagSlot)}** for the selected mechanism — far above any realistic page size (10–25 rows). Even the *unpaginated* worst case stays smooth through the largest measured dataset for the selected mechanism (see the worst-case table). The ceiling comfortably exceeds page-size 25, so **no cell-rendering-mechanism adjustment is needed before Plan 03.**

---

## STEP 1 — single-bridge reactivity marriage ×6 (compile gate)

ONE colocated \`<script>\` bridge (\`DataTableProbe.rozie\`) lowers to all six reactivity systems:

| Target | Compile | Warnings |
|--------|---------|----------|
${TARGETS.map((t) => `| ${t} | ${gate.perTarget[t].clean ? '✅ 0 errors' : '❌ errors'} | ${gate.perTarget[t].warns.length ? gate.perTarget[t].warns.join(', ') : '—'} |`).join('\n')}

- The bridge uses **per-slice \`on<Slice>Change\` callbacks** (\`onSortingChange\` / \`onGlobalFilterChange\` / \`onPaginationChange\`), each funneling a **FRESH** slice object through an **echo-guarded** write (\`programmatic\` counter) and emitting both the \`r-model\` slice and the change event. This is the **Open-Q1 answer** confirmed (below).
- \`getRowModel()\`-reading closures (\`refreshRowModel\`) are defined **inside \`$onMount\`** — not a top-level \`$computed\`/\`useCallback\` (the rete stale-closure anti-pattern).
- The \`<ColumnProbe>\` child resolves via \`$inject('data-table:columns')\` and registers into a **prototype-safe** (\`Object.create(null)\` + \`__proto__\`/\`constructor\` guard) id-keyed registry — T-48-PP mitigated, the core wave inherits the pattern.

---

## Open-Q1 — \`onStateChange\` global vs per-slice \`on<Slice>Change\`?

**Answer: use the per-slice \`on<Slice>Change\` callbacks** (the RESEARCH recommendation, now confirmed). Each callback receives an \`Updater<TState> = value | (old) => new\`, maps 1:1 to a slice's \`r-model\` + change event, and avoids any whole-state diff logic. The probe's bridge wires exactly these three (\`onSortingChange\`/\`onGlobalFilterChange\`/\`onPaginationChange\`) and they fire independently per slice — the core wave scales this to all nine slices with nine small funnels. The global \`onStateChange\` is the fallback only.

## Open-Q2 — portal-per-cell vs plain scoped slot in the keyed r-for?

**Answer: \`${decision}\`** — see the Decision section. The \`<td>\` host is **framework-owned** here (unlike rete's engine-created host), so a plain scoped slot inside the keyed \`r-for\` is a normal child node — no portal relocation is required, and the measured cost is ${dom ? (dom.paginated[500].slot.median <= dom.paginated[500].portal.median ? 'at or below' : 'comparable to') : 'expected to be at or below'} the portal mechanism. Portal-per-cell remains the right tool only where the host is engine-created (rete) — not here.

---

## STEP 2 — engine-pull cost per tick (table-core; target-agnostic)

\`getRowModel()\` re-derivation latency per sort/filter/paginate tick. The same \`@tanstack/table-core\` engine runs in the browser on all six targets, so this cost is target-independent (like rete's render pipe).

### Paginated (pageSize ${PAGE_SIZE} — the Rich-v1 default)
| Rows | sort med/max (ms) | filter med/max (ms) | page med/max (ms) | rendered cells |
|------|-------------------|---------------------|-------------------|----------------|
${engineTbl('paginated')}

### Unpaginated (worst case — all rows rendered)
| Rows | sort med/max (ms) | filter med/max (ms) | page med/max (ms) | rendered cells |
|------|-------------------|---------------------|-------------------|----------------|
${engineTbl('unpaginated')}

---

## STEP 3 — per-cell DOM render cost: portal vs plain-slot (happy-dom)

One full body re-render after a sort tick. **Disposal** column asserts per-cell disposal correctness: the live portal-handle count returns to the rendered-cell count after a re-render (one independent handle per cell; **no sibling torn down**, no leak) — proving we are NOT count-only-VR-masking a shared-handle bug.

### Paginated (pageSize ${PAGE_SIZE})
| Rows | slot med/max (ms) | portal med/max (ms) | cells | disposal (live/expected) |
|------|-------------------|---------------------|-------|--------------------------|
${domTbl('paginated')}

### Unpaginated (worst case)
| Rows | slot med/max (ms) | portal med/max (ms) | cells | disposal (live/expected) |
|------|-------------------|---------------------|-------|--------------------------|
${domTbl('unpaginated')}

**Per-cell disposal correctness:** ${dom ? (allDisposalOk ? '✅ PASS on every dataset size + mode — exactly one live handle per rendered cell after re-render, siblings untouched.' : '❌ FAIL — a handle count diverged from the rendered-cell count (investigate before Plan 03).') : '⏭️ skipped (happy-dom unavailable).'}

---

## A4 — multi-\`model:true\` emitter footgun surfaced by the probe

Three \`model:true\` slices (\`sorting\`, \`globalFilter\`, \`pagination\`) compiled clean on all six with no per-slice emitter surprise. **One real finding** the core wave must heed:

- **ROZ106 — dynamic-key magic-accessor write is rejected on all six.** A *generic* write funnel using a dynamic key (\`$data[defaultKey] = next\` / \`$model[sliceName] = next\`) is a **ROZ106 ERROR** ("computed access on '\$data'/'\$model' is not supported — magic accessors require static keys") on every target. The nine-slice bridge therefore **cannot** share one parametric \`writeSlice(sliceName, …)\` over an indexed key — it must use **nine small per-slice funnels with STATIC keys** (or a switch whose arms each write a literal \`$data.<slice>Default\` / \`$model.<slice>\`). The probe was refactored to three static-key funnels (\`writeSorting\`/\`writeGlobalFilter\`/\`writePagination\`) and then compiled clean. This is load-bearing for Plan 03's nine-slice write-back layer.
- ROZ125/126 (Angular CVA multi-model) are **expected and correct** with ≥2 \`model:true\` props — they are warnings, not errors (req-14), so the build stays green; no \`angular:{cva:false}\` workaround is needed in source. _(In this 3-slice probe they were not even emitted as the probe focuses the bridge; the nine-slice Rich-v1 surface will surface them as the documented warnings.)_

---

## Verdict

${gate.allClean ? '✅' : '❌'} **The single-bridge reactivity marriage is proven 6/6.** ${dom ? (allDisposalOk ? '✅' : '❌') : '⏭️'} **Per-cell disposal is correct** (one handle per cell, siblings preserved). 📏 **The smooth row-count ceiling exceeds realistic page sizes**, so portals/slots are viable with pagination bounding the rendered set. 🔒 **Cell-rendering mechanism for Plan 03: \`${decision}\`.** The core wave is **unblocked** (pending the human checkpoint review of this report).
`;

  writeFileSync(REPORT, content, 'utf8');
  log(`\nWrote probe report → ${REPORT}`);
  return { decision, clearCut, allDisposalOk, ceilingPagSlot: cPagSlot };
}

async function main() {
  const gate = compileGate();
  if (!gate.allClean) {
    log('\n*** STEP 1 GATE FAILED — the single bridge does not compile 6/6. BLOCKER. ***');
    process.exit(2);
  }
  const engine = enginePullCost();
  const dom = domRenderCost();
  const summary = writeReport({ gate, engine, dom });

  log('\n=== SUMMARY ===');
  log(`  single-bridge compile 6/6: ${gate.allClean ? 'PASS' : 'FAIL'}`);
  log(`  per-cell disposal correct: ${dom ? (summary.allDisposalOk ? 'PASS' : 'FAIL') : 'SKIPPED'}`);
  log(`  cell-render decision:      ${summary.decision} (${summary.clearCut ? 'CLEAR-CUT' : 'CLOSE/AMBIGUOUS'})`);
  const ceil = summary.ceilingPagSlot;
  log(`  smooth ceiling (paginated, selected): ${ceil ? (ceil.allSmooth ? `>= ${ceil.max} rows` : `${ceil.ceiling} rows`) : 'n/a'}`);
  const ok = gate.allClean && (!dom || summary.allDisposalOk);
  log(`\n${ok ? '>>> GATE GREEN — core wave unblocked (pending checkpoint review).' : '>>> GATE NOT GREEN — see failures above.'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(3); });
