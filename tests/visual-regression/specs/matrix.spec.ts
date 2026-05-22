import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module", so __dirname is
// not defined here. Synthesize it from import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 7 Plan 02 — the 48-cell cross-target visual-regression matrix (EX-06,
 * COMP-05).
 *
 * EXAMPLES and TARGETS are copied verbatim from
 * tests/dist-parity/parity.test.ts (lines 62-79) — the canonical 8×6 matrix.
 *
 * Angular column: 07-ANGULAR-SPIKE.md's `Decision:` line is `ANGULAR IN`, so
 * all 6 targets stay — the matrix is the full 8 × 6 = 48 cells. (If the spike
 * had decided `ANGULAR DOCUMENTED-OUT (D-03)`, `'angular'` would be filtered
 * out of TARGETS and the matrix would be 40 cells — that gate is the D-03 scope
 * branch, NOT a D-11 visual exemption.)
 *
 * Reference topology (D-10): every target's screenshot of an example diffs
 * against the SAME per-example baseline PNG (the Vue render) — the screenshot
 * name is keyed by example only (`Counter.png`), never suffixed with the
 * target. The Vue run generates/updates the baseline; the other 5 targets
 * compare against it.
 *
 * Per D-11 there are ZERO per-cell *visual* exemptions for the five targets
 * that build — every (example × target) cell is asserted with no `test.skip` /
 * `test.fixme`. The single exception is the Angular column: `build-cells.mjs`
 * soft-fails the Angular sub-build on a known out-of-scope upstream Vite-version
 * breakage (see `scripts/build-cells.mjs` SOFT_FAIL_TARGETS and
 * `docs/parity.md` "Angular — visual-regression rig host cell"). When
 * `dist/angular/` is absent the 8 Angular cells are gated with `test.fixme` so
 * the harness reports them as known-pending instead of failing the CI job with
 * 8 opaque screenshot errors. The moment the Angular sub-build succeeds and
 * produces `dist/angular/`, the gate lifts automatically and the cells run.
 * This is NOT a D-11 visual exemption — it is a build-availability gate.
 */

const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
  // Phase 07.2 Plan 06 — ModalConsumer dogfood example added to the 48-cell
  // matrix (now 54 cells = 9 × 6). Linux-rendered baseline ModalConsumer.png
  // is generated via the pinned Playwright Docker image per memory
  // `feedback_vr_linux_baselines`. Per D-10, all 6 targets diff against the
  // SAME shared baseline (collapsed from per-target baselines on 2026-05-17
  // post-Phase 07.3.2.1 F-07.3.2-11-A closure once empirical byte-identity
  // across all 6 targets was verified — MD5 0d5d3108053af5b7d264affcae82b43d).
  'ModalConsumer',
  // Spike 003 portal-slot primitive (added 2026-05-18). PortalListDemo fills
  // a `<template #item>` filler that mounts through `$portals.item` into the
  // inline vanilla-JS engine's row containers. Per D-10, all 6 targets diff
  // against the same shared `PortalList.png` baseline — any per-target
  // rendering drift in the portal-mount path will fail the matcher.
  'PortalList',
  // FullCalendar is deliberately NOT in this list (removed 2026-05-22). Like
  // LeafletMap below, its render is non-deterministic: `FullCalendarDemo.rozie`
  // anchors its calendar grid + seed events to `new Date()` ("today"), so a
  // pixel baseline would change every day/month. A stable `FullCalendar.png`
  // is therefore impossible — the baseline was never generated and the 6 cells
  // sat permanently baseline-gated. FullCalendar keeps full behavioral coverage
  // in `full-calendar.spec.ts` (structural assertions, no screenshot).
  // PortalListStyled (added 2026-05-20, quick-task 260520-8iu) — Spike 004
  // string-`:style` + `@portal` VR coverage. PortalListStyledDemo fills a
  // `<template #item>` whose rows carry an object-form `:style` (the swatch
  // color) AND a dynamic-string `:style` (the row opacity), mounting through
  // `$portals.item` into the `@portal`-scoped MiniListEngine subtree. Per
  // D-10, all 6 targets diff against the same shared `PortalListStyled.png`
  // baseline — any per-target drift in the string-`:style` lowering or the
  // `@portal` scoped-CSS path will fail the matcher. Baseline must be
  // Linux-rendered via the pinned Playwright Docker image per
  // `feedback_vr_linux_baselines`; cells gate on baseline presence below.
  'PortalListStyled',
  // Engine-wrapper demos (added 2026-05-20, quick-task 260520-hus) — standing
  // VR coverage for the render-confirm sweep. Each <Name>Demo wraps a real
  // vanilla-JS engine (SortableJS / Flatpickr / TipTap / Uppy) or the
  // dynamic-slot Table example. Per D-10, all 6 targets diff against the same
  // shared `<Name>.png` baseline. These cells baseline-gate to `test.fixme`
  // (via `baselineExists()` below) until a Linux-Docker baseline regen lands
  // the PNG — `feedback_vr_linux_baselines` requires Linux-rendered baselines.
  // LeafletMap is deliberately NOT in this list: it renders live OSM network
  // tiles (non-deterministic) so a pixel screenshot would flake — it gets a
  // behavioral-only spec instead (`leaflet-map.spec.ts`).
  'Table',
  'SortableList',
  'Flatpickr',
  'Uppy',
  'TipTap',
  // Phase 14 — ThemedButtonConsumer attribute-fallthrough dogfood (D-05/D-06).
  // Auto-fallthrough renders consumer-passed attributes on the inner <button>;
  // the manual sibling with `inherit-attrs="false"` + explicit `r-bind="$attrs"`
  // produces the equivalent DOM through the opt-out path. Per D-10, all 6
  // targets diff against the same shared `ThemedButtonConsumer.png` baseline.
  // Baseline-gates to test.fixme via `baselineExists()` below until a
  // Linux-Docker baseline regen lands the PNG (`feedback_vr_linux_baselines`).
  'ThemedButtonConsumer',
] as const;
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// Baseline-availability gate (per-example). When __screenshots__/<Name>.png
// is missing, the cells for that example downgrade to test.fixme so the
// suite stays green until a Linux-Docker baseline regen lands the PNG.
// Mirrors the Angular column build-availability gate below.
//
// Bootstrap escape hatch: a brand-new example has a chicken-and-egg problem
// — its cell is `test.fixme` until its `.png` exists, but the `.png` can only
// be generated by running the cell with Playwright's `-u`. `-u` does not
// override `test.fixme`. Set `ROZIE_VR_BOOTSTRAP_BASELINE=<ExampleName>`
// (comma-separated for several) to force-ungate that example for ONE `-u`
// generation pass. Used only by the Docker baseline-regen recipe in DEBUG.md;
// never set in CI.
const BOOTSTRAP_BASELINES = new Set(
  (process.env.ROZIE_VR_BOOTSTRAP_BASELINE ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
function baselineExists(name: string): boolean {
  if (BOOTSTRAP_BASELINES.has(name)) return true;
  return existsSync(resolve(__dirname, `../__screenshots__/${name}.png`));
}

// Build-availability gate for the Angular column. `build-cells.mjs` soft-fails
// the Angular sub-build on a known out-of-scope upstream breakage, so
// `dist/angular/` may not exist. When it is absent the Angular cells are
// registered with `test.fixme` (known-pending) instead of `test`, keeping the
// CI job green while still surfacing the column as unimplemented. When the
// sub-build succeeds the gate lifts and the cells run normally.
const angularBuilt = existsSync(
  resolve(__dirname, '../dist/angular/host/entry.angular.html'),
);

// Phase 07.5 closure — PORTAL_LIT_GAP removed once consumer-side function-prop
// emit landed for portal slots. PortalList · lit renders against the SAME
// shared `PortalList.png` baseline as the other 5 targets (D-10 byte-identity).


// Per-example pre-screenshot settle conditions.
//
// Plan 07.2-06.1 debug-fix follow-up. ModalConsumer renders THREE modals (per
// the Plan 07.2-06 dogfood: scoped header+footer fill, dynamic-name fill,
// re-projection via WrapperModal). Without an explicit wait, the bounding box
// for `[data-testid="rozie-mount"]` is captured before all three modals
// have laid out, producing non-deterministic screenshot heights (one regen pass
// captured 309px with 1-2 modals visible, the verify pass rendered 517px with
// all 3). The fix is to wait for all three `<div role="dialog">` panels to
// be present before clipping the screenshot. `getByRole('dialog')` pierces
// shadow DOM (Lit) and is unaffected by CSS Modules class hashing (React/Solid)
// — all 6 targets emit `role="dialog"` on the dialog panel (verified in
// tests/dist-parity/fixtures/Modal.*).
async function settleExample(
  example: string,
  page: import('@playwright/test').Page,
): Promise<void> {
  if (example === 'ModalConsumer') {
    await expect(page.getByRole('dialog')).toHaveCount(3);
  }
  // PortalListStyled (quick-task 260520-8iu): the demo's MiniListEngine
  // builds a `<ul>` with one `<li>` per item ASYNCHRONOUSLY inside the
  // wrapper's `$onMount` — without an explicit wait, the screenshot clips
  // before the engine-rendered rows exist. Wait for all 4 rows. The rows
  // carry `data-portal-list-row`; a `data-*` attribute locator survives
  // React/Solid CSS-Modules class hashing, Angular view-encapsulation, and
  // Lit shadow DOM identically across all 6 targets.
  if (example === 'PortalListStyled') {
    await expect(page.locator('[data-portal-list-row]')).toHaveCount(4);
  }
  // Engine-wrapper demos (quick-task 260520-hus): each engine renders its DOM
  // ASYNCHRONOUSLY inside the wrapper's `$onMount` — without an explicit wait
  // the screenshot clips before the engine-rendered subtree exists. Each
  // branch waits for a stable post-mount locator (mirrors the PortalListStyled
  // `[data-portal-list-row]` pattern above).
  //
  // SortableList: the SortableList wrapper renders one `.rozie-sortable-item`
  // per item; SortableListDemo seeds 5 items in `$onMount` via reset() — wait
  // for exactly 5. The `[class*=...]` substring locator survives React's
  // CSS-Modules class hashing: the wrapper styles `.rozie-sortable-item` in
  // its `<style>` block, so the React target emits it as `_rozie-sortable-
  // item_xxxx_NN` (original class preserved as a substring per Vite/PostCSS-
  // Modules' localIdentName default). Same rationale as the Table branch below.
  if (example === 'SortableList') {
    await expect(page.locator('[class*="rozie-sortable-item"]')).toHaveCount(5);
  }
  // Flatpickr: the Flatpickr wrapper renders `<input class="rozie-flatpickr">`;
  // the flatpickr engine attaches to it on `$onMount`. Wait for the input to
  // be visible — its presence proves the wrapper template painted and the
  // engine had a host element to attach to. The `[class*=...]` substring
  // locator survives React's CSS-Modules class hashing — same rationale as
  // the Table branch below.
  if (example === 'Flatpickr') {
    await expect(page.locator('[class*="rozie-flatpickr"]').first()).toBeVisible();
  }
  // Uppy: the Uppy wrapper renders `<label class="rozie-uppy-picker">`; the
  // Uppy core engine wires its file-input to it on `$onMount`. Wait for the
  // picker label to be visible. The `[class*=...]` substring locator survives
  // React's CSS-Modules class hashing — same rationale as the Table branch
  // below.
  if (example === 'Uppy') {
    await expect(page.locator('[class*="rozie-uppy-picker"]').first()).toBeVisible();
  }
  // TipTap: the TipTap wrapper mounts a ProseMirror editor into a host div;
  // ProseMirror adds the `.ProseMirror` class to its contenteditable root once
  // the editor finishes mounting. Wait for `.ProseMirror` to be visible — it
  // is the deterministic post-mount signal that the editor engine booted.
  if (example === 'TipTap') {
    await expect(page.locator('.ProseMirror')).toBeVisible();
  }
  // Table: TableDemo renders `<table class="rozie-table">`. The React target
  // applies CSS Modules to consumer styles, renaming `rozie-table` to a scoped
  // name like `_rozie-table_xxxx_NN` (the original class is preserved as a
  // substring per Vite/PostCSS-Modules' localIdentName default). The substring
  // locator `[class*="rozie-table"]` subsumes both the literal-class targets
  // (Vue/Svelte/Angular/Solid/Lit) and the React CSS-Modules form — mirrors
  // the `[class*="fc-event-title"]` rationale in full-calendar.spec.ts.
  if (example === 'Table') {
    await expect(page.locator('[class*="rozie-table"]').first()).toBeVisible();
  }
}

// TipTap · solid Solid-emitter TDZ runtime crash — RESOLVED 2026-05-20
// (quick-task 260520-hus follow-up). TipTapDemo@solid threw at runtime with
// `ReferenceError: Cannot access 'stripHtml' before initialization`: a
// `$computed` (→ `createMemo`, eager callback) called a user `<script>`
// helper that the Solid emitter emitted as a non-hoisting `const` arrow
// AFTER the memo. Fixed by hoisting `const X = () => …` helpers to
// `function X() {…}` declarations (Solid emitScript `tryHoistArrowToFunction`,
// mirroring the React emitter). The cell now renders and runs normally; the
// dedicated runtime-bug gate is removed.

// Known cross-target-divergence gate — NOW EMPTY. The engine-wrapper demos
// all render byte-identical to the Vue baseline; every (example × target) cell
// runs as `test`. The set is kept (empty) so a future genuinely-divergent cell
// has a documented, single place to be quarantined — never as a D-11 escape
// hatch for hidden drift, only for a cell that provably cannot match.
//
// RESOLVED (quick-task 260520-hus follow-up, 2026-05-20) — the 4 Table cells
// that previously diverged are fixed and now pass; their entries are removed:
//   - Table·react: dynamic `:class` template literal (`badge badge-${value}`)
//     bypassed the React CSS-Modules `styles` lookup → hashed `._badge_<h>`
//     selectors never matched, badge pills lost styling. Fixed in the React
//     emitter (composeClassName routes StringLiteral/TemplateLiteral `:class`
//     through `styles`).
//   - Table·angular: dynamic `:colspan` emitted `[colspan]` — an Angular
//     DOM-property binding to a non-existent lowercase property, a silent
//     no-op → footer cell never spanned → table ~24px wider. Fixed via the
//     Angular emitter's HTML_ATTR_CASING map (`[colSpan]`, et al.).
//   - Table·solid / Table·lit: ~33px caption antialiasing — the `width:100%`
//     table tracked the toggle button's `fit-content` width, which kerns
//     ~1/64px wider on react/solid/lit (Chromium text-node-boundary drift),
//     shifting the `-webkit-center` <caption>. Fixed by pinning a fixed
//     `.table-demo` width in TableDemo.rozie. Table.png baseline regenerated.
//
// RESOLVED (2026-05-20, untyped-<script> follow-up) — TipTap·angular and
// Uppy·angular previously threw "JIT compiler unavailable" at runtime. Earlier
// notes here mislabelled this "settle-timing"; the real cause was an Angular
// emitter bug. A merged object-literal `[ngClass]` / `[ngStyle]` value with a
// hyphenated (hence single-quoted) class key was emitted with its quotes
// backslash-escaped — `[ngClass]="{ \'is-readonly\': … }"`. `\'` is invalid in
// an Angular template expression, so the template failed to parse, ngtsc
// skipped the component's AOT `ɵcmp`, and the class fell back to a runtime
// `@Component` decorator → JIT compilation → "JIT compiler unavailable" in the
// prod bundle (which ships no `@angular/compiler`). Fixed in
// `packages/targets/angular/src/emit/emitTemplateAttribute.ts` — the merged
// value is now emitted verbatim, matching the single-binding path. Both cells
// render again. Uppy·angular is un-gated below: Uppy is deterministic and the
// other non-react Uppy cells already match the shared `Uppy.png` baseline.
//
// (Separately, the engine wrappers also emitted type-broken TypeScript because
// `<script>` is parsed as plain JS — fixed by `typeNeutralizeScript` in
// @rozie/core. That bug failed `tsc`/`ngc`/`vue-tsc`/`svelte-check`, NOT the
// runtime render — it was not the JIT-crash cause. See the writeup at
// .planning/todos/pending/untyped-script-emits-type-broken-output.md.)
//
// RESOLVED (2026-05-22, vr-uppy-matrix-red follow-up) — SortableList·react,
// Flatpickr·react and Uppy·react were NEVER a pixel divergence. The earlier
// "STABLE CROSS-TARGET PIXEL DIVERGENCE" note here was wrong: those cells
// never reached the screenshot matcher at all. `settleExample` waited on a
// LITERAL-class locator (`.rozie-sortable-item` / `.rozie-flatpickr` /
// `.rozie-uppy-picker`); each wrapper styles that class in its `<style>`
// block, so the React target emits it CSS-Modules-hashed (`_rozie-..._xxxx`)
// and the literal locator found nothing → 5s settle timeout → the cell was
// gated as "divergent". Fixed by switching those three settle locators to the
// `[class*=...]` substring form (the pattern the Table branch already used).
// All three React cells now render and match the shared baseline within the
// 2px tolerance — un-gated. This was a test-harness bug, not an emitter bug.
//
// RESOLVED (2026-05-22, vr-uppy-matrix-red follow-up) — TipTap·angular is no
// longer divergent. Verified in the pinned container: it renders byte-identical
// to the Vue baseline and passes.
//
// RESOLVED (2026-05-22, debug session tiptap-rmodel-html-init-emit) —
// TipTap·react / ·svelte / ·solid / ·lit are no longer divergent. The init-time
// `r-model:html` round-trip was NOT a `$watch` lowering inconsistency: it was a
// stale-API call in `examples/TipTap.rozie`. The wrapper's reconciler `$watch`
// called `editor.commands.setContent(v, false)` using the TipTap **v2** API,
// where the 2nd arg was an `emitUpdate` boolean. The repo is on TipTap
// **v3.23.5**, where `setContent`'s 2nd arg is an options OBJECT
// (`{ emitUpdate?, parseOptions?, errorOnInvalidContent? }`). Passing the bare
// `false` destructured to `{ emitUpdate = true }` (the v3 default), so the
// update was emitted: ProseMirror's onUpdate fired, `editor.getHTML()` returned
// the NORMALISED 247-byte doc, and the `model:true` two-way path wrote it back
// into `$data.content`. The immediate `$watch` runs AFTER `$onMount` on
// react/svelte/solid/lit (editor already created → `setContent` actually
// executes) but BEFORE it on vue/angular (editor still `null` → the
// `if (!editor) return` guard short-circuits) — hence the 4-vs-2 split. Fixed
// by changing the call to the v3 form `setContent(v, { emitUpdate: false })`.
// All 6 TipTap cells now render byte-identical to the shared baseline.
const KNOWN_CROSS_TARGET_DIVERGENCE = new Set<string>([]);

for (const example of EXAMPLES) {
  const hasBaseline = baselineExists(example);
  for (const target of TARGETS) {
    // Cell fixme-gates on ANY of:
    //  - Angular column build availability (existing)
    //  - per-example baseline PNG presence (for examples added before their
    //    Linux-Docker baseline regen has landed)
    //  - the known cross-target-divergence gate (documented above) — currently
    //    empty; reserved for a future cell that provably cannot match
    const crossTargetDivergent = KNOWN_CROSS_TARGET_DIVERGENCE.has(
      `${example}::${target}`,
    );
    const runner =
      (target === 'angular' && !angularBuilt) ||
      !hasBaseline ||
      crossTargetDivergent
        ? test.fixme
        : test;
    runner(`${example} · ${target}`, async ({ page }) => {
      await page.goto(`/?example=${example}&target=${target}`);
      const component = page.getByTestId('rozie-mount');
      await expect(component).toBeVisible();
      await settleExample(example, page);
      // Baseline keyed by example only (D-10) — all 6 targets diff against
      // the same Vue-generated `${example}.png`. The earlier ModalConsumer
      // special case (per-target baselines for the 3-modal dogfood) was
      // collapsed on 2026-05-17 after Phase 07.3.2.1 closed F-07.3.2-11-A:
      // the 6 ModalConsumer-<target>.png baselines proved byte-identical
      // (MD5 0d5d3108053af5b7d264affcae82b43d), empirically disproving the
      // earlier worry that CSS Modules class hashing (React/Solid), Lit's
      // shadow-DOM-bounded custom elements, and Angular's view-encapsulation
      // attribute selectors would force per-target rendering divergence.
      // The shared-baseline pattern now ENFORCES cross-target byte-identity:
      // any future single-target drift fails the matcher rather than being
      // hidden behind a per-target baseline.
      await expect(component).toHaveScreenshot(`${example}.png`, {
        maxDiffPixels: 2,
        animations: 'disabled',
      });
    });
  }
}
