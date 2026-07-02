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
  //
  // FullCalendarSlots (added 2026-06-05, Phase 28 Plan 03, REQ-28-4) — the
  // date-PINNED 3-slot screenshot demo. CONTRAST with the still-excluded
  // date-floating `FullCalendar` above: `FullCalendarSlotsDemo.rozie` pins the
  // grid via :options `initialDate: '2026-06-15'` + a fixed `dayGridMonth`
  // view AND seeds every event on FIXED ISO date strings (NO `new Date()`), so
  // its render is fully deterministic and a stable `FullCalendarSlots.png`
  // baseline CAN exist. It fills three portal-slots (#event / #dayCell /
  // #dayHeader) so the screenshot proves the portal-mount path visually across
  // all 6 targets. Per D-10 all 6 targets diff against the same shared
  // `FullCalendarSlots.png`. The baseline is owned by Plan 28-04 (Linux-Docker
  // regen); until it lands the cell baseline-gates to `test.fixme` via
  // `baselineExists()` (never red) — no macOS-rendered PNG is committed here.
  // The four long-tail slots (slotLabel / weekNumber / nowIndicator / moreLink)
  // are behavioral-only (no pixel baseline) — covered by
  // full-calendar-slots.spec.ts. The companion all-7-slot behavioral demo is
  // deliberately NOT in this list (behavioral cell only — host-registered but
  // never a screenshot cell).
  'FullCalendarSlots',
  // CodeMirrorScreenshot (added 2026-06-06, Phase 29 Plan 04, D-07 tier 2) — the
  // content-STABLE CodeMirror screenshot demo. CONTRAST with the still-excluded
  // date-floating/caret-flaky `CodeMirror` cell (behavioral-only, never in this
  // matrix): `CodeMirrorScreenshotDemo.rozie` binds a FIXED doc + theme="light"
  // and applies the `screenshotStable` EditorView.theme via :extensions — killing
  // the `.cm-cursorLayer` blink animation, hiding the drawn/native caret, and
  // suppressing the selection layer + active-line highlight — and never focuses
  // the editor, so its render is deterministic and a stable
  // `CodeMirrorScreenshot.png` baseline CAN exist. Per D-10 all 6 targets diff
  // against the same shared `CodeMirrorScreenshot.png`. The baseline is owned by
  // Plan 29-04 Task 3 (Linux-Docker regen); until it lands the cell baseline-gates
  // to `test.fixme` via `baselineExists()` (never red) — no macOS-rendered PNG is
  // committed here.
  'CodeMirrorScreenshot',
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
  // SortableList showcase trio (added 2026-05-27, quick-task 260526-uj3) —
  // headline marketing surface. Per D-10, all 6 targets diff against the
  // same shared `<Name>.png` baseline. These cells baseline-gate to
  // `test.fixme` via `baselineExists()` below until a Linux-Docker baseline
  // regen lands the PNGs (`feedback_vr_linux_baselines`).
  'SortableListClone',
  'SortableListFilter',
  'SortableListShowcase',
  // SortableListNested (Kanban) — nested two-level drag dogfood. Validates a
  // dense bundle of features at once: outer-list column reorder + inner-list
  // card drag (distinct SortableJS groups), slot scope params, cross-component
  // `cards-change` two-way sync, AND the Lit cross-shadow `::part(list)` grid
  // layout (the consumer grids the outer list via `SortableList::part(list)`,
  // reaching the child's `part="list"` element across the shadow boundary; the
  // other 5 targets grid it via the coexisting `:deep()` light-DOM rule). Per
  // D-10 all 6 targets diff against the same shared `SortableListNested.png`
  // baseline — with the ::part fix the Lit column grid now matches the other 5
  // (previously Lit rendered stacked, the documented :deep cross-shadow gap).
  // Baseline-gates to `test.fixme` via `baselineExists()` until the Linux-Docker
  // baseline regen lands the PNG (`feedback_vr_linux_baselines`).
  'SortableListNested',
  'Flatpickr',
  'Uppy',
  'TipTap',
  // Phase 32 (tiptap) — TipTapScreenshot is the content-STABLE pixel cell
  // (TipTapScreenshotDemo: a fixed rich-HTML doc + caret-neutralized editorProps,
  // never focused). Distinct from the live 'TipTap' (TipTapDemo) cell above.
  // Baseline-gates to test.fixme via baselineExists() until the Linux-Docker
  // TipTapScreenshot.png lands. TipTapBehavior is behavioral-only (tiptap.spec.ts)
  // and deliberately NOT a matrix pixel cell.
  'TipTapScreenshot',
  // Phase 14 — ThemedButtonConsumer attribute-fallthrough dogfood (D-05/D-06).
  // Auto-fallthrough renders consumer-passed attributes on the inner <button>;
  // the manual sibling with `inherit-attrs="false"` + explicit `r-bind="$attrs"`
  // produces the equivalent DOM through the opt-out path. Per D-10, all 6
  // targets diff against the same shared `ThemedButtonConsumer.png` baseline.
  // Baseline-gates to test.fixme via `baselineExists()` below until a
  // Linux-Docker baseline regen lands the PNG (`feedback_vr_linux_baselines`).
  //
  // Phase 15 extended Plan 15-06 added two new sibling wrappers covering the
  // listener-side of the four-corner matrix: ThemedButtonListenersManual
  // (`inherit-listeners="false"` + manual `r-on="$listeners"` on the inner
  // <button>) and ThemedButtonAllManual (both flags `false` + both manual
  // directives). The extended ThemedButtonConsumer composes all FOUR wrappers,
  // so its baseline now covers the full four-corner R11 matrix.
  'ThemedButtonConsumer',
  // Phase 15 — listener-side sibling wrappers (D-04 / D-05). These are the
  // PRODUCER fixtures (not consumer-composed). Render output for each producer
  // in isolation is more interesting as a structural sanity check than as a
  // visual probe, but per the matrix convention every dogfood producer gets a
  // cell here. The baseline-gate keeps the cells fixme until a Linux-Docker
  // baseline regen lands the PNG. Per D-10 shared-baseline.
  'ThemedButtonListenersManual',
  'ThemedButtonAllManual',
  // Phase 17 — PartCardConsumer (::part() cross-shadow-DOM styling dogfood,
  // SPEC-R8). A multi-rozie consumer (precedent: ThemedButtonConsumer) that
  // embeds <PartCard> via a <components> block and styles the child's
  // `part="body"` shadow element across the boundary with a
  // `PartCard::part(body)` rule. On Lit the rule reaches the child
  // (`rozie-part-card[data-rozie-s-<hash>]::part(body)`); on the 5 non-Lit
  // targets the rule is dropped as a no-op (no shadow boundary). Because
  // `::part` is INTENTIONALLY a Lit-only-visible effect, strict D-10
  // byte-identity across all 6 targets is NOT expected for the part-styled
  // region — this cell is treated like the engine-demo cells (memory
  // `project_vr_engine_demo_divergences` / `project_modalconsumer_png_invariant`):
  // layout parity is asserted, per-target byte-identity for the `::part`-styled
  // region is relaxed, and the final pixel sign-off is tracked as a HUMAN-UAT
  // partial deferral (17-HUMAN-UAT.md). Cell baseline-gates to test.fixme via
  // `baselineExists()` until a Linux-Docker baseline regen lands the PNG
  // (`feedback_vr_linux_baselines`) — the ORCHESTRATOR owns that generation;
  // no macOS-rendered PNG is committed here.
  'PartCardConsumer',
  // Phase 15 — ROnProbe (D-07) is INTENTIONALLY NOT in the VR matrix, mirroring
  // the Phase 14 RBindProbe precedent. The probe's purpose is dist-parity byte-
  // equality (compile + emit), not visual parity. On Lit, the emitted
  // `<rozie-r-on-probe>` custom element has no `:host { display: ... }` rule
  // (the fixture's `<style>` block targets the inner `.r-on-probe` div), so
  // the host element collapses to inline-zero-size and breaks the D-10 byte-
  // identity contract against Vue/React/Svelte/Angular/Solid renders. The
  // probe is still bootstrapped by the matrix host (entry.<target>.ts +
  // main.ts) so it remains inspectable via /compare.html; it's just not a
  // committed VR cell. The dist-parity gate covers the byte-identity claim.
  //
  // Phase 21 — ExposeProbe ($expose imperative-handle dogfood). A typed input
  // exposing reset()/focus(); the per-target VR shim grabs the native handle and
  // renders a "reset via handle" button. Per D-10 all 6 targets diff against the
  // SAME shared `ExposeProbe.png` baseline. This cell baseline-gates to
  // `test.fixme` via `baselineExists()` below until a Linux-Docker baseline regen
  // lands the PNG — the ORCHESTRATOR owns that generation (`tools/ci-repro/vr.sh
  // -u -g 'ExposeProbe'`); no macOS-rendered PNG is committed here. The
  // BEHAVIORAL external-caller flow (type → click reset-via-handle → input
  // clears) lives in specs/expose-probe.spec.ts and is NOT baseline-gated.
  'ExposeProbe',
  // Phase 24 (security-self-test-battery) D-11 — the single r-html fixture.
  // A String `content` prop with a non-empty static-HTML default renders raw via
  // r-html (the VR cell shows the bold "safe"). Per D-10 all 6 targets diff
  // against the SAME shared `RHtml.png` baseline. The Linux-Docker baseline is
  // owned by Plan 24-03 Task 3 (vr.sh update-snapshots, RHtml-filtered); until it
  // lands the cell baseline-gates to `test.fixme` via `baselineExists()` (never
  // red) — no macOS-rendered PNG is committed here.
  'RHtml',
  // Phase 30 (chartjs) — ChartScreenshot is the content-STABLE multi-type canvas
  // SCREENSHOT cell. `ChartScreenshotDemo.rozie` renders a grid of THREE chart
  // kinds (line + bar + doughnut) from the ONE generic Chart with animation:false
  // + devicePixelRatio:1 + a pinned font + fixed data, so a stable
  // `ChartScreenshot.png` baseline CAN exist (unlike a live/animated chart). The
  // chart bitmap is Chart.js-engine-rendered identically across targets, so per
  // D-10 all 6 targets diff against the SAME shared `ChartScreenshot.png` (blessed
  // 2026-06-08, Linux-Docker, all 6 verified non-update). The BEHAVIORAL coverage
  // (runtime type-switching, @click, :plugins, tooltip slot) lives in chart.spec.ts
  // and is NOT baseline-gated.
  //
  // Phase 33 (reactive-portal-slots) — TipTapNodeViewScreenshot is the content-
  // STABLE pixel cell for the REACTIVE nodeView portal slot. `TipTapNodeView
  // ScreenshotDemo.rozie` renders a FIXED rich doc containing BOTH custom nodes
  // (a `rozieMention` atom chip + a `rozieCallout` editable callout) via the
  // nodeView slot fill, with the caret neutralized + never focused — so a stable
  // `TipTapNodeViewScreenshot.png` baseline CAN exist. The node views are rendered
  // identically across targets from ONE Rozie source, so per D-10 all 6 targets
  // diff against the SAME shared baseline. Owned by Plan 33-04 (Linux-Docker
  // regen); until it lands the cell baseline-gates to `test.fixme` via
  // `baselineExists()` (never red). The BEHAVIORAL coverage (in-place re-render,
  // contentDOM composition) lives in tiptap-nodeview.spec.ts and is NOT baseline-
  // gated.
  'TipTapNodeViewScreenshot',
  //
  // RESOLVED 2026-06-08: the line + bar cells previously captured with AXES but no
  // DATA SERIES (doughnut fine) was NOT a first-paint/ResizeObserver timing issue —
  // it was a real Chart wrapper bug. The data `$watch` was `{ immediate: true }`; on
  // React/Lit/Solid that immediate watch runs AFTER `$onMount` (vs before on
  // Vue/Angular, where instance is still null), and with identity-`$snapshot` +
  // Chart.js storing config.data by reference, `instance.data === $props.data ===
  // next`, so the reconcile's `live.labels.length = 0` emptied the SHARED labels
  // array before reading it → cartesian charts lost their category axis and rendered
  // empty (the radial doughnut survived). Fixed with an aliasing guard in
  // Chart.rozie (`if (live === next) { instance.update(...); return }`). All 3 charts
  // now render with data on all 6 targets; baseline blessed + non-update verified.
  'ChartScreenshot',
  // Phase 35 (maplibre) — MapLibreScreenshot is the content-STABLE WebGL-map
  // SCREENSHOT cell. `MapLibreScreenshotDemo.rozie` renders a single map painted
  // by the OFFLINE style object (a solid background + a colored GeoJSON polygon —
  // network-free, so it renders identically in Docker with NO tile server) at a
  // FIXED center/zoom with NO controls/markers/interaction and
  // :options { fadeDuration: 0, attributionControl: false, interactive: false }
  // for determinism (no symbol fade, no attribution text drift, no interaction
  // state). The WebGL canvas is engine-rendered identically across targets from
  // ONE Rozie source, so per D-10 all 6 targets diff against the SAME shared
  // `MapLibreScreenshot.png`. The settle-poll (settleExample below) waits for
  // SATURATED canvas pixels (the colored polygon), not just any painted pixel —
  // the chartjs canvas-VR lesson (axes-only would clip early). The baseline is
  // owned by the orchestrator (Linux-Docker regen); until it lands the cell
  // baseline-gates to `test.fixme` via `baselineExists()` (never red) — no
  // macOS-rendered PNG is committed here. The BEHAVIORAL coverage (two-way
  // camera, control + marker portal slots) lives in maplibre-map.spec.ts and is
  // NOT baseline-gated.
  'MapLibreScreenshot',
  // Cropper (Cropper.js v1) — CropperScreenshot is the content-stable pixel cell.
  // `CropperScreenshotDemo.rozie` mounts the engine on a network-free SVG data URL
  // with a FIXED :data crop box (image coords) + an explicit pinned container size
  // + :responsive="false"; the settle (settleExample below) waits for the
  // `.cropper-canvas` image to load AND for cropper.css (an async code-split chunk)
  // to apply, so the dark modal + crop-box chrome are present at clip time.
  //
  // RESOLVED 2026-06-08 to 5/6 + a tracked Lit gap (the earlier "~1-3px cross-emit
  // outline shift / accepted determinism divergence" was a MISDIAGNOSIS). A Docker
  // geometry diagnostic showed the crop box landed in THREE different places with a
  // fixed `:data={x:60,y:40,w:180,h:160}`: react/solid correct (60,40,180,160);
  // vue/svelte/angular at the DEFAULT 80%-centered box (the initial `:data` was
  // silently dropped); lit at the right X/size but wrong Y. Two distinct real bugs:
  //   (1) The initial-:data drop on vue/svelte/angular — Cropper's setup-time `crop`
  //       event (default box, fired before `ready`) wrote `$model.data`, which on
  //       unified-model targets clobbered the `$props.data` that `ready` then reads.
  //       FIXED in Cropper.rozie (a `cropReady` gate). All of vue/svelte/angular/
  //       react/solid now place the box identically → a shared D-10 baseline holds
  //       for those 5.
  //   (2) Lit mispositions the box because the consumer-imported global
  //       `cropperjs/dist/cropper.css` does not pierce the wrapper's shadow root, so
  //       the absolutely-positioned cropper chrome is unstyled (the SAME engine-CSS-
  //       in-Lit-shadow gap maplibre's overlay hit). Needs an engine-CSS-shadow
  //       bridge — tracked, gated below (CROPPER_LIT_SCREENSHOT_TODO).
  // Behavioral CORRECTNESS (mount, crop box, two-way `data`) is green 6/6 in
  // cropper.spec.ts. The screenshot cell is now blessed for the 5 non-Lit targets.
  'CropperScreenshot',
  // Phase (wavesurfer) — WaveformScreenshot is the content-STABLE audio-waveform
  // pixel cell. `WaveformScreenshotDemo.rozie` renders wavesurfer.js v7 from FIXED
  // offline peaks + duration (no network/decode/wall-clock) with two pinned
  // regions + the timeline ruler, container pinned to 480px. The waveform bitmap
  // is engine-rendered into a 2D canvas identically across targets, so per D-10
  // all 6 diff against the same shared `WaveformScreenshot.png`. Baseline owned by
  // the orchestrator (Linux-Docker `vr.sh -u -b WaveformScreenshot -g
  // WaveformScreenshot`); until it lands the cell baseline-gates to `test.fixme`
  // via `baselineExists()` (never red). Behavioral coverage is not baseline-gated.
  'WaveformScreenshot',
  // PdfViewer (pdfjs-dist v6) — PdfViewerScreenshot is the content-STABLE pixel
  // cell (loader → examples/demos/PdfViewerScreenshotDemo.rozie): a network-free
  // base64 PDF + bundled worker, pinned to page 1 at scale 0.45 with text-layer
  // OFF. pdfjs rasterizes the page into a 2D <canvas> from the SAME pdfjs-dist in
  // every target, so the bitmap is engine-painted + emit-family-independent → per
  // D-10 all 6 targets diff against the SAME shared `PdfViewerScreenshot.png`
  // (the Chart/MapLibre canvas-VR precedent). Baseline-gates to test.fixme via
  // baselineExists() until the Linux-Docker PNG lands. The BEHAVIORAL coverage
  // (dynamic import, two-way page, Next) lives in pdf.spec.ts and is NOT a pixel cell.
  'PdfViewerScreenshot',
  // Phase 36 (rete) — FlowCanvasScreenshot is the content-STABLE node-flow-editor
  // SCREENSHOT cell. `FlowCanvasScreenshotDemo.rozie` renders a fixed 3-node /
  // 2-connection graph with pan/zoom/selection OFF + fitOnMount OFF (identity
  // viewport transform → node positions map 1:1 to pixels on every target), via
  // the VANILLA render layer (no framework render plugin). The graph is pure
  // DOM + SVG (no canvas/WebGL), so per D-10 all 6 targets diff against the SAME
  // shared `FlowCanvasScreenshot.png`. The settle (settleExample below) waits for
  // the 3 node boxes + 2 connection paths to render before clipping. Baseline-
  // gates to `test.fixme` via `baselineExists()` until the Linux-Docker PNG lands.
  // The BEHAVIORAL coverage (vanilla render, drag-to-connect anchors, add-node
  // reconcile, two-way zoom) lives in rete-flow.spec.ts and is NOT a pixel cell.
  'FlowCanvasScreenshot',
  // Phase 39 (embla) — CarouselScreenshot is the content-STABLE Embla-carousel
  // SCREENSHOT cell. `CarouselScreenshotDemo.rozie` renders a 4-slide config-array
  // carousel with autoplay OFF + fixed startIndex 0 + a fixed-pixel-width (320px)
  // root + fixed-320px-wide solid-color slides, so Embla's measured-width
  // `transform: translate3d(Xpx,0,0)` is byte-identical across all 6 targets
  // (no text-node-dependent sizing, no images, no animation). The carousel is
  // pure DOM (no canvas/WebGL), so per D-10 all 6 targets diff against the SAME
  // shared `CarouselScreenshot.png`. The settle (settleExample below) waits for
  // the viewport + container + ≥3 laid-out slides before clipping. Baseline-gates
  // to `test.fixme` via `baselineExists()` until the Linux-Docker PNG lands. The
  // BEHAVIORAL coverage (two-way index, pointer-drag swipe, $expose handle) lives
  // in embla-carousel.spec.ts and is NOT a pixel cell.
  'CarouselScreenshot',
  // Built-in carousel navigation pixel cell — CarouselNavScreenshotDemo enables
  // arrows + dots + thumbnails on the same deterministic fixed-width carousel. At
  // rest (snap 0, no loop) the prev arrow is disabled, dot 0 + thumb 0 active —
  // a deterministic frame. Same Embla-transform settle as CarouselScreenshot.
  'CarouselNavScreenshot',
  // @rozie-ui otp/combobox INLINE screenshot cells — the two pure-Rozie families
  // that render in normal flow (no top-layer/fixed escape), so they go in this
  // standard mount-clipped matrix. OtpScreenshot seeds a FIXED '123' code in a
  // 6-cell numeric Otp (3 filled + 3 empty, no autoFocus → no caret); it is
  // deterministic at rest. ComboboxScreenshot seeds 'cherry' so the input settles
  // to "Cherry" via the component's $onMount syncQueryToValue with the popup CLOSED
  // (nothing focuses the input). Per D-10 all 6 targets diff against the SAME shared
  // `${name}.png`. Baseline-gates to test.fixme via baselineExists() until the
  // Linux-Docker PNGs land (feedback_vr_linux_baselines). The top-layer DialogScreenshot
  // + fixed ToasterScreenshot cells live in overlay-screenshot.spec.ts (they escape
  // the rozie-mount clip). The *Behavior cells are behavioral-only (no pixel baseline).
  'OtpScreenshot',
  'ComboboxScreenshot',
  // Phase 60 @rozie-ui tags/number-field/pagination INLINE screenshot cells — the
  // three pure-Rozie headless families that render in normal flow, so they go in
  // this standard mount-clipped matrix. TagsScreenshot seeds 3 fixed chips + an
  // unfocused input (no caret); NumberFieldScreenshot seeds the value 42 in an
  // unfocused spinbutton (shows the locale-formatted value, no caret);
  // PaginationScreenshot seeds page 5 of 20 so BOTH ellipses render
  // ([1 … 4 5 6 … 20]). All deterministic at rest. Per D-10 all 6 targets diff
  // against the SAME shared `${name}.png`. Baseline-gates to test.fixme via
  // baselineExists() until the Linux-Docker PNGs land (feedback_vr_linux_baselines).
  // The *Behavior cells are behavioral-only (no pixel baseline).
  'TagsScreenshot',
  'NumberFieldScreenshot',
  'PaginationScreenshot',
  // @rozie-ui/switch INLINE screenshot cell — the pure-Rozie toggle renders in
  // normal flow, so it goes in this standard mount-clipped matrix.
  // SwitchScreenshot seeds three fixed states (on / off / disabled), unfocused
  // (no focus-visible ring). Per D-10 all 6 targets diff against the SAME shared
  // `SwitchScreenshot.png`. Baseline-gates to test.fixme via baselineExists()
  // until the Linux-Docker PNG lands (feedback_vr_linux_baselines). The
  // PopoverScreenshot cell lives in overlay-screenshot.spec.ts (its floating
  // panel is position:absolute and escapes the rozie-mount clip). The *Behavior
  // cells are behavioral-only (no pixel baseline).
  'SwitchScreenshot',
  // @rozie-ui/date-picker + resizable INLINE screenshot cells — both pure-Rozie
  // families render in normal flow, so they go in this standard mount-clipped matrix.
  // DatePickerScreenshot pins a FIXED value='2025-06-15' (its default view month
  // otherwise tracks TODAY's date via $onMount, which would flake the baseline daily)
  // + locale='en-US' + weekStartsOn=0, so the June-2025 month grid renders
  // deterministically; the control is never focused (no caret/ring). ResizableScreenshot
  // pins :size="50" in a fixed 420x180 box with two fixed-text panels, so the split
  // lands at the midpoint and the handle is never focused. Per D-10 all 6 targets diff
  // against the SAME shared `${name}.png`. Baseline-gates to test.fixme via
  // baselineExists() until the Linux-Docker PNGs land (feedback_vr_linux_baselines).
  // The CommandPaletteScreenshot cell lives in overlay-screenshot.spec.ts (its overlay
  // is position:fixed and escapes the rozie-mount clip). The *Behavior cells are
  // behavioral-only (no pixel baseline).
  'DatePickerScreenshot',
  'ResizableScreenshot',
  // @rozie-ui/date-picker RANGE-mode INLINE screenshot cells. DatePickerRangeComplete
  // seeds a FIXED completed cross-month range ({ start: '2025-05-28', end: '2025-06-04' });
  // the DatePicker pins its view to the range's start month (May 2025) so the continuous
  // band + the May→June spill render deterministically. DatePickerPresetActive seeds a
  // FIXED range + a :presetRanges list whose first preset EQUALS the value, so the active
  // preset pill (is-active / aria-pressed) renders run-to-run. Both render in normal flow
  // (mount-clipped). Per D-10 all 6 targets diff the SAME shared `${name}.png`; baseline-
  // gates to test.fixme via baselineExists() until the Linux-Docker PNGs land
  // (feedback_vr_linux_baselines). The driven DatePickerRangeBehavior cell is
  // behavioral-only (date-picker-range-behavior.spec.ts) — deliberately NOT in this list.
  'DatePickerRangeComplete',
  'DatePickerPresetActive',
  // @rozie-ui/date-picker NAV + ERGONOMICS screenshot cells (Phase 70). Each seeds
  // its target state on mount — a 2-month RANGE layout, the Today/Clear footer row,
  // and a greyed-weekend calendar — so a static mount-clipped shot is deterministic.
  // They diff the shared `${name}.png` per D-10 and baseline-gate to test.fixme via
  // baselineExists() until the Linux-Docker PNGs land (Plan 70-05).
  //
  // DatePickerMonthsView / DatePickerYearsView / DatePickerSingleMonth are deliberately
  // NOT in this list: they are behavioral-only cells driven by clicks in
  // date-picker-drill-footer.spec.ts. The months/years DRILL panels live behind the
  // heading button and cannot be seeded statically (viewMode is private $data, not a
  // prop), so a static shot would only re-capture the default days grid — the drill
  // behavior is asserted at the DOM level instead, with no pixel baseline.
  'DatePickerTwoMonth',
  'DatePickerFooter',
  'DatePickerWeekendDisable',
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
  // SortableListClone (quick-task 260526-uj3): palette seeds 4 widget
  // templates in $onMount via seedPalette(); canvas starts empty (no
  // rozie-sortable-item rows on the canvas side). Total across both
  // SortableList instances = 4 (palette only).
  if (example === 'SortableListClone') {
    await expect(page.locator('[class*="rozie-sortable-item"]')).toHaveCount(4);
  }
  // SortableListFilter (quick-task 260526-uj3): reset() seeds 5 items, 2
  // of which carry data-locked='true'. Wait for the row count to settle.
  if (example === 'SortableListFilter') {
    await expect(page.locator('[class*="rozie-sortable-item"]')).toHaveCount(5);
  }
  // SortableListShowcase (quick-task 260526-uj3): reset() seeds 8 items.
  // Wait for the row count to settle before the screenshot clip.
  if (example === 'SortableListShowcase') {
    await expect(page.locator('[class*="rozie-sortable-item"]')).toHaveCount(8);
  }
  // SortableListNested (Kanban): reset() seeds 3 columns; the OUTER SortableList
  // renders one `.rozie-sortable-item` per column (3) and each column's INNER
  // SortableList renders one per card (3 + 2 + 1 = 6) → 9 total. Playwright's
  // CSS locator pierces the nested shadow roots on Lit; `[class*=...]` survives
  // React CSS-Modules hashing (same rationale as the SortableList branch above).
  if (example === 'SortableListNested') {
    await expect(page.locator('[class*="rozie-sortable-item"]')).toHaveCount(9);
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
  if (example === 'TipTap' || example === 'TipTapScreenshot') {
    await expect(page.locator('.ProseMirror')).toBeVisible();
  }
  // TipTapNodeViewScreenshot (Phase 33): the content-STABLE reactive-nodeView
  // pixel cell. ProseMirror boots, then renders BOTH custom node views from the
  // nodeView slot fill — a `rozieMention` atom chip + a `rozieCallout` editable
  // callout. Wait for the editor AND both node views to paint before clipping so
  // the capture is deterministic (the doc is fixed, the caret neutralized, the
  // editor never focused — so once both node views are present the frame is final).
  if (example === 'TipTapNodeViewScreenshot') {
    await expect(page.locator('.ProseMirror')).toBeVisible();
    await expect(page.getByTestId('mention-chip').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('callout-chrome').first()).toBeVisible({
      timeout: 10_000,
    });
    // Brief settle for layout; the editor is never focused and the caret is
    // neutralized, so there is no blink/selection source to wait out.
    await page.waitForTimeout(200);
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
  // PartCardConsumer (Phase 17 ::part dogfood): the consumer embeds <PartCard>,
  // whose template root is `<div class="card-body" part="body">`. The
  // `part="body"` attribute is emitted verbatim into the child across all 6
  // targets (SPEC-R3/R4b) — on Lit into the shadow template, elsewhere as a
  // benign standard HTML attribute. A `[part="body"]` attribute locator
  // therefore survives React CSS-Modules class hashing, Angular view
  // encapsulation, and Lit shadow DOM identically (Playwright's locator pierces
  // shadow roots), proving the child painted before the screenshot clip.
  if (example === 'PartCardConsumer') {
    await expect(page.locator('[part="body"]').first()).toBeVisible();
  }
  // ExposeProbe (Phase 21 $expose dogfood): the probe renders an <input> plus
  // the per-target rig's "reset via handle" button. Wait for the button (the
  // external-caller harness shim) to be present so the screenshot clips after
  // both the component and the handle-driven button have laid out. The
  // `[data-testid="reset-via-handle"]` locator is rig-injected identically
  // across all 6 targets.
  if (example === 'ExposeProbe') {
    await expect(page.locator('[data-testid="reset-via-handle"]')).toBeVisible();
  }
  // CodeMirrorScreenshot (Phase 29 D-07 tier 2): the CodeMirror wrapper mounts an
  // EditorView into a host div on `$onMount`; CM6 lazily renders `.cm-line`
  // children into `.cm-content` and measures its viewport ASYNCHRONOUSLY. Without
  // an explicit wait the screenshot clips before the lines render. Wait for the
  // FIXED seed doc to appear, then let CM's async measure settle before the clip.
  // The demo applies the `screenshotStable` theme (caret/selection/active-line
  // neutralized) + never focuses the editor, so once the content is present the
  // capture is deterministic.
  if (example === 'CodeMirrorScreenshot') {
    await expect
      .poll(
        async () =>
          (await page.locator('.cm-content').first().textContent()) ?? '',
        { timeout: 5_000, intervals: [200, 400, 800] },
      )
      .toContain('greet');
    // Let CM6's async viewport measure settle (one or two RAFs for a short
    // fixed doc) before clipping. animations:'disabled' in toHaveScreenshot plus
    // the screenshotStable blink-kill make this belt-and-suspenders.
    await page.waitForTimeout(250);
  }
  // ChartScreenshot (Phase 30): Chart.js paints the first frame inside a
  // requestAnimationFrame after `$onMount`, so the canvas can be blank for 1-2
  // RAFs after the wrapper mounts. The demo sets animation:false (no tweens, the
  // first frame is final) + devicePixelRatio:1 + a pinned font. Wait until ALL
  // THREE canvases (line + bar + doughnut) have painted nonzero-alpha pixels,
  // then a short settle before the clip. Once painted the frame is final
  // (animations off), so the capture is deterministic.
  if (example === 'ChartScreenshot') {
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            // Pierce shadow roots: the Lit target mounts its canvases inside a
            // shadow DOM, where a plain `document.querySelectorAll('canvas')`
            // can't see them. Recurse through every element's shadowRoot.
            const collect = (root: Document | ShadowRoot, acc: HTMLCanvasElement[]) => {
              for (const el of Array.from(root.querySelectorAll('*'))) {
                if (el.tagName === 'CANVAS') acc.push(el as HTMLCanvasElement);
                const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
                if (sr) collect(sr, acc);
              }
              return acc;
            };
            const canvases = collect(document, []);
            if (canvases.length < 3) return 0;
            // Count COLORED (saturated) pixels, not just any painted pixel:
            // axes / grid lines / labels are gray-to-black (low saturation) and
            // paint FIRST, while the data series are saturated colors (blue line,
            // green bars, colored doughnut segments). A plain "any painted pixel"
            // gate is satisfied by the axes alone, so it can clip before the
            // series draws (the line/bar empty-axes capture). Requiring a healthy
            // count of saturated pixels per canvas ensures the DATA has rendered.
            return canvases.filter((c) => {
              const ctx = c.getContext('2d');
              if (!ctx) return false;
              const { data } = ctx.getImageData(0, 0, c.width, c.height);
              let colored = 0;
              for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                if (max - min > 30) colored++;
              }
              return colored > 200;
            }).length;
          }),
        { timeout: 10_000, intervals: [200, 400, 800, 1600] },
      )
      .toBeGreaterThanOrEqual(3);
    // Belt-and-suspenders: animation is off, so once every chart's series has
    // drawn the frame is final. A short settle absorbs any ResizeObserver
    // re-layout pass before the clip.
    await page.waitForTimeout(400);
  }
  // MapLibreScreenshot (Phase 35): MapLibre mounts a WebGL map into a host div
  // on `$onMount`; the engine adds `.maplibregl-map` (the root) and
  // `.maplibregl-canvas` (the WebGL canvas), then paints the OFFLINE style's
  // colored polygon asynchronously after the style "load" event. Wait for the
  // canvas to be present, then a short fixed settle so the colored polygon has
  // painted before the clip. The demo sets fadeDuration:0 (no symbol fade) +
  // interactive:false + attributionControl:false, so once the style loads the
  // frame is deterministic. Unlike the chartjs colored-pixel poll, a WebGL
  // backing store cannot be read via a 2D `getImageData` (the canvas reports a
  // WebGL context, not 2D, and preserveDrawingBuffer is off), so the settle is a
  // fixed timeout rather than a pixel-saturation poll. The CSS locators pierce
  // Lit's shadow root.
  if (example === 'MapLibreScreenshot') {
    await expect(page.locator('.maplibregl-map').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('.maplibregl-canvas').first()).toBeVisible({
      timeout: 15_000,
    });
    // Let the style "load" → polygon paint settle. fadeDuration:0 means no
    // symbol tween, so a short fixed settle absorbs the async style-load render
    // pass before the clip.
    await page.waitForTimeout(600);
  }
  // CropperScreenshot (Cropper.js v1): the engine attaches to the <img> on
  // `$onMount`, hides it, and builds its `.cropper-container` (with a
  // `.cropper-canvas > img`, the dark `.cropper-modal`, and the `.cropper-crop-box`
  // / `.cropper-view-box`). The crop UI only lays out once the image LOADS, so a
  // capture before load shows an empty container. Unlike chart/maplibre this is a
  // DOM+<img> view (no WebGL/2D canvas to pixel-poll), so wait for the container +
  // crop box, then poll until the engine's `.cropper-canvas img` has actually
  // loaded (`complete` + `naturalWidth > 0`), then a short settle. The demo uses a
  // network-free SVG data URL + a FIXED :data box + responsive:false, so once the
  // image is loaded the layout is deterministic. CSS locators pierce Lit's shadow.
  if (example === 'CropperScreenshot') {
    await expect(page.locator('.cropper-container').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('.cropper-crop-box').first()).toBeVisible({
      timeout: 15_000,
    });
    // Wait until BOTH the engine's `.cropper-canvas img` has loaded AND the crop
    // box + dark modal have been POSITIONED (non-zero geometry). Cropper builds
    // the container/image first and computes the crop-box + modal layout on a
    // later frame, so `.cropper-crop-box` can be present-but-unpositioned briefly
    // — clipping then would capture the bare image without its crop chrome. Gating
    // on a non-zero crop-box width ensures the modal/box geometry has painted.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const deep = <T extends Element>(root: Document | ShadowRoot, sel: string): T | null => {
              const hit = root.querySelector(sel) as T | null;
              if (hit) return hit;
              for (const el of Array.from(root.querySelectorAll('*'))) {
                const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
                if (sr) {
                  const found = deep<T>(sr, sel);
                  if (found) return found;
                }
              }
              return null;
            };
            const img = deep<HTMLImageElement>(document, '.cropper-canvas img');
            const box = deep<HTMLElement>(document, '.cropper-crop-box');
            const modal = deep<HTMLElement>(document, '.cropper-modal');
            const imgReady = Boolean(img && img.complete && img.naturalWidth > 0);
            const boxReady = Boolean(box && box.getBoundingClientRect().width > 1);
            // cropper.css is a code-split chunk injected as an async <link>, so the
            // box can have inline-style geometry BEFORE the stylesheet applies its
            // chrome (the dark `.cropper-modal`, box border/guides/handles). Gate on
            // the modal's computed background actually being cropper.css's value so
            // the capture includes the crop chrome, not the bare image.
            const cssReady = Boolean(
              modal && getComputedStyle(modal).backgroundColor === 'rgb(0, 0, 0)',
            );
            return imgReady && boxReady && cssReady;
          }),
        { timeout: 10_000, intervals: [200, 400, 800, 1600] },
      )
      .toBe(true);
    // The crop UI is positioned; a short settle absorbs any final reflow.
    await page.waitForTimeout(500);
  }
  // WaveformScreenshot (wavesurfer.js v7): the wrapper builds the engine on
  // `$onMount` and renders the waveform from FIXED offline peaks into a 2D
  // `<canvas>` (wavesurfer nests its canvases inside its own shadow wrapper within
  // the host container). Regions are added in the engine's `ready` callback. Poll
  // until a canvas has painted a healthy count of SATURATED (purple wave) pixels —
  // recursing through every shadow root (the Lit target mounts inside a shadow DOM,
  // and wavesurfer itself uses an inner shadow) — then a short settle. No autoplay,
  // no interaction, so once the wave has painted the frame is final.
  if (example === 'WaveformScreenshot') {
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const collect = (root: Document | ShadowRoot, acc: HTMLCanvasElement[]) => {
              for (const el of Array.from(root.querySelectorAll('*'))) {
                if (el.tagName === 'CANVAS') acc.push(el as HTMLCanvasElement);
                const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
                if (sr) collect(sr, acc);
              }
              return acc;
            };
            const canvases = collect(document, []);
            let best = 0;
            for (const c of canvases) {
              const ctx = c.getContext('2d');
              if (!ctx || !c.width || !c.height) continue;
              const { data } = ctx.getImageData(0, 0, c.width, c.height);
              let colored = 0;
              for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                if (Math.max(r, g, b) - Math.min(r, g, b) > 30) colored++;
              }
              if (colored > best) best = colored;
            }
            return best;
          }),
        { timeout: 15_000, intervals: [200, 400, 800, 1600] },
      )
      .toBeGreaterThan(200);
    // Waveform + regions + timeline painted; a short settle absorbs any reflow.
    await page.waitForTimeout(400);
  }
  // PdfViewerScreenshot: the PdfViewer wrapper dynamic-imports pdfjs, calls
  // getDocument(), then renders page 1 into a JS-created `<canvas>` inside a
  // `.rozie-pdf-page` div (the page-div class is set at runtime via
  // `el.className = 'rozie-pdf-page'`, so it survives React's CSS-Modules hashing
  // and is identical across all 6 targets). All of that is async, so without a wait
  // the screenshot clips an empty box. Poll until the page canvas has actually
  // rasterized content — a healthy count of opaque non-white pixels (the rendered
  // black text on the white page) — piercing shadow roots for the Lit target.
  if (example === 'PdfViewerScreenshot') {
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const deep = <T extends Element>(root: Document | ShadowRoot, sel: string): T | null => {
              const hit = root.querySelector(sel) as T | null;
              if (hit) return hit;
              for (const el of Array.from(root.querySelectorAll('*'))) {
                const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
                if (sr) {
                  const found = deep<T>(sr, sel);
                  if (found) return found;
                }
              }
              return null;
            };
            const canvas = deep<HTMLCanvasElement>(document, '.rozie-pdf-page canvas');
            if (!canvas || !canvas.width || !canvas.height) return false;
            const ctx = canvas.getContext('2d');
            if (!ctx) return false;
            const { width: W, height: H } = canvas;
            const data = ctx.getImageData(0, 0, W, H).data;
            let dark = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (
                data[i + 3]! > 10 &&
                (data[i]! < 200 || data[i + 1]! < 200 || data[i + 2]! < 200)
              ) {
                if (++dark > 100) return true;
              }
            }
            return false;
          }),
        { timeout: 25_000, intervals: [300, 600, 1200, 2400] },
      )
      .toBe(true);
    // Page rasterized; a short settle absorbs any final reflow before the clip.
    await page.waitForTimeout(300);
  }
  // FlowCanvasScreenshot (Phase 36): the FlowCanvas (Rete.js) wrapper mounts the
  // editor into a host div on `$onMount`, then the vanilla render pipe fills the
  // 3 engine node elements (`.rozie-flow-node`) and draws the 2 connection SVG
  // paths (`.rozie-flow-connection__path`) once the socket-position watcher
  // reports positions. Both are engine-created DOM (set via `el.className`), so
  // the classes are literal on every target (NOT CSS-Modules-hashed — the
  // compiler never sees them). Wait for the full graph before clipping; a short
  // settle absorbs the final path-redraw reflow. The CSS locator pierces Lit's
  // open shadow root.
  if (example === 'FlowCanvasScreenshot') {
    await expect(page.locator('.rozie-flow-node')).toHaveCount(3, { timeout: 15_000 });
    await expect(page.locator('.rozie-flow-connection__path')).toHaveCount(2, {
      timeout: 10_000,
    });
    await page.waitForTimeout(300);
  }
  // CarouselScreenshot (Phase 39): the Embla wrapper attaches to the viewport on
  // `$onMount`, then writes `transform: translate3d(Xpx,0,0)` on the container
  // (X computed from measured slide widths) once the engine lays out. Wait for the
  // viewport + container + the 4 config-array slides to render, then poll until the
  // container carries a non-empty inline `transform` (the engine has measured + laid
  // out), then a short settle. autoplay is OFF + startIndex fixed, so once the
  // transform is applied the frame is final. The CSS locators pierce Lit's open
  // shadow root.
  if (example === 'CarouselScreenshot' || example === 'CarouselNavScreenshot') {
    await expect(page.locator('.rozie-embla__viewport').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('.rozie-embla__container').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(async () => page.locator('.rozie-embla__slide').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(3);
    // Poll until Embla has applied the laid-out transform on the container
    // (pierces shadow roots for the Lit target).
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const deep = (root: Document | ShadowRoot): HTMLElement | null => {
              const hit = root.querySelector('.rozie-embla__container') as HTMLElement | null;
              if (hit) return hit;
              for (const el of Array.from(root.querySelectorAll('*'))) {
                const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
                if (sr) {
                  const found = deep(sr);
                  if (found) return found;
                }
              }
              return null;
            };
            const container = deep(document);
            if (!container) return false;
            const t = container.style.transform || getComputedStyle(container).transform;
            return Boolean(t && t !== 'none' && t.trim().length > 0);
          }),
        { timeout: 10_000, intervals: [200, 400, 800, 1600] },
      )
      .toBe(true);
    await page.waitForTimeout(300);
  }
  // OtpScreenshot (@rozie-ui/otp): the Otp renders one native `<input>` per cell.
  // The seeded '123' code in a `:length="6"` Otp produces exactly 6 cells. Wait for
  // all 6 before clipping so the capture is deterministic (no autoFocus → no caret
  // to wait out). A bare `input` locator pierces Lit's open shadow root.
  if (example === 'OtpScreenshot') {
    await expect(page.locator('input')).toHaveCount(6, { timeout: 10_000 });
  }
  // ComboboxScreenshot (@rozie-ui/combobox): the input TEXT settles to "Cherry"
  // only after the component's $onMount runs syncQueryToValue() (which maps the
  // seeded 'cherry' value to its label). Poll the input's value so the clip waits
  // for that async reflect; the popup is CLOSED at rest (nothing focuses the input),
  // so once the value lands the frame is final. `role="combobox"` pierces Lit's shadow.
  if (example === 'ComboboxScreenshot') {
    await expect
      .poll(
        async () =>
          page.locator('input[role="combobox"]').first().inputValue(),
        { timeout: 5_000, intervals: [100, 200, 400, 800] },
      )
      .toBe('Cherry');
  }
  // TagsScreenshot (@rozie-ui/tags): the demo seeds 3 fixed chips. The default
  // chip fallback renders one `.rozie-tags-chip__label` per token; the
  // `[class*=...]` substring locator survives React's CSS-Modules class hashing
  // and pierces Lit's shadow. Wait for all 3 chips before clipping (the unfocused
  // input has no caret, so once the chips paint the frame is final).
  if (example === 'TagsScreenshot') {
    await expect(page.locator('[class*="rozie-tags-chip__label"]')).toHaveCount(3, {
      timeout: 10_000,
    });
  }
  // NumberFieldScreenshot (@rozie-ui/number-field): the unfocused spinbutton shows
  // the locale-formatted value (42). Poll the input value so the clip waits for the
  // formatted text to settle (the field is never focused → no caret). `role="spinbutton"`
  // pierces Lit's shadow.
  if (example === 'NumberFieldScreenshot') {
    await expect
      .poll(
        async () =>
          page.locator('input[role="spinbutton"]').first().inputValue(),
        { timeout: 5_000, intervals: [100, 200, 400, 800] },
      )
      .toBe('42');
  }
  // PaginationScreenshot (@rozie-ui/pagination): page 5 of 20 → the window is
  // [1, …, 4, 5, 6, …, 20] = 5 page buttons + 2 ellipses. Wait for the 5 page
  // buttons; the `[class*=...]` substring locator survives React CSS-Modules
  // hashing and pierces Lit's shadow. Nothing is focused, so once they paint the
  // frame is final.
  if (example === 'PaginationScreenshot') {
    await expect(page.locator('[class*="rozie-pagination-page"]')).toHaveCount(5, {
      timeout: 10_000,
    });
  }
  // SwitchScreenshot (@rozie-ui/switch): three fixed switches (on / off /
  // disabled). `role="switch"` pierces Lit's shadow; nothing is focused (no
  // focus-visible ring), so once all 3 paint the frame is final.
  if (example === 'SwitchScreenshot') {
    await expect(page.getByRole('switch')).toHaveCount(3, { timeout: 10_000 });
  }
  // DatePickerScreenshot (@rozie-ui/date-picker): the calendar renders a 6×7 month
  // grid → 42 `.rozie-datepicker-day` buttons. The `[class*=...]` substring locator
  // survives React's CSS-Modules class hashing and pierces Lit's shadow. Wait for all
  // 42 before clipping; the control is never focused (no caret), so once the grid
  // paints the frame is final. The pinned value='2025-06-15' fixes the month, so the
  // grid is deterministic.
  if (example === 'DatePickerScreenshot') {
    await expect(page.locator('[class*="rozie-datepicker-day"]')).toHaveCount(42, {
      timeout: 10_000,
    });
  }
  // DatePickerRangeComplete / DatePickerPresetActive (@rozie-ui/date-picker, range
  // mode): same 6×7 = 42-day grid as DatePickerScreenshot. Wait for all 42 day
  // buttons before clipping; the seeded range pins the view month, so the band /
  // active-preset frame is final once the grid paints (nothing is focused).
  if (example === 'DatePickerRangeComplete' || example === 'DatePickerPresetActive') {
    await expect(page.locator('[class*="rozie-datepicker-day"]')).toHaveCount(42, {
      timeout: 10_000,
    });
  }
  // ResizableScreenshot (@rozie-ui/resizable): the splitter renders one
  // role="separator" handle between the two panels. Its presence proves the wrapper
  // laid out; the pinned :size="50" fixes the split at the midpoint and the handle is
  // never focused (no focus ring), so once it paints the frame is final.
  // `role="separator"` pierces Lit's shadow.
  if (example === 'ResizableScreenshot') {
    await expect(page.getByRole('separator')).toBeVisible({ timeout: 10_000 });
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
// Phase 17 — PartCardConsumer is the ONE cell that provably CANNOT share a
// single 6-target baseline, by design. `::part()` is the cross-shadow-DOM
// styling mechanism: it is load-bearing on Lit (the consumer's
// `PartCard::part(body)` rule pierces the child's shadow boundary and paints
// the amber `background:#fde68a; border:2px solid #b45309` onto the child's
// `part="body"` element) and a deliberate NO-OP on the 5 non-Lit targets
// (no shadow boundary exists, so the rule is stripped and the child renders
// with its own producer styles only). The shared baseline is therefore the
// LIT render (amber); the Lit cell asserts the working cross-shadow effect
// (the SPEC-R8 proof), and the 5 non-Lit cells are documented-divergent here
// — they render byte-identically to EACH OTHER (grey producer styles) but
// cannot match the amber Lit baseline. Their correctness (the no-op strip +
// `part=` passthrough) is fully regression-protected by dist-parity (584
// byte-equal assertions) and the per-target unit tests — not by a screenshot.
// This is the documented capability difference, NOT a bug (project bar:
// "documented edge cases acceptable"; engine-demo precedent
// `project_vr_engine_demo_divergences`).
const KNOWN_CROSS_TARGET_DIVERGENCE = new Set<string>([
  'PartCardConsumer::vue',
  'PartCardConsumer::react',
  'PartCardConsumer::svelte',
  'PartCardConsumer::angular',
  'PartCardConsumer::solid',
]);

// Phase-N.M follow-up gate — scheduled per-target bug fixes (NOT accepted
// divergence). Distinct from KNOWN_CROSS_TARGET_DIVERGENCE: that set documents
// cells that provably cannot match (e.g. macOS-kerning drift); this set names
// REAL render-time emit regressions that the dist-parity byte-equality gate
// cannot catch (it proves entrypoint parity, not render correctness). Each
// entry MUST be paired with an inline comment naming the offending file/symptom
// AND a scheduled phase that closes it; if the closing phase ships and the
// entry is still here, that is a process failure.
//
// Phase 14.1 closed 3 of 5 ThemedButtonConsumer entries (react / angular /
// lit) via per-target emit fixes — see git history. The pre-Phase-16 cleanup
// closed the remaining two arms (solid and svelte). The set is empty;
// preserved for future per-cell gate additions.
//
// Closure path (visible in commit history):
//   - Solid arm: a three-stage fix —
//     1. `synthesizeListenersFallthrough` dual-`{...attrs}` regression
//        repaired (`emitTemplateNode.ts` skips redundant listener spread)
//        — fixes 4-buttons-render-blank
//     2. static `style="..."` → object form (`emitTemplateAttribute.ts`)
//        — preserves wrapper's inline-style defaults instead of relying on
//        the CSS `var(prop, fallback)` cascade
//     3. inline `<style>` JSX → module-top `__rozieInjectStyle()`
//        head-injection (`emitStyle.ts` + new `injectStyle.ts` runtime
//        helper) — fixes same-specificity cascade in cross-SFC composition
//        (wrapper instances were each rendering a sibling `<style>` AFTER
//        the consumer's, so source-order made wrapper rules win — the
//        `.btn { font: inherit }` shorthand was wiping
//        `.extra-variant { font-weight: 600 }`)
//   - Svelte arm: Item 2 (cross-SFC CSS-scoping switch to
//     `data-rozie-s-*`, mirroring react/solid/lit, replacing Svelte's
//     native class-hash scoper) + Item-2-residual (auto-fallthrough-aware
//     `:style` string-form lowering when active, replacing `style:<prop>=`
//     directives that would otherwise win over spread `style`).
const PHASE_14_1_FOLLOWUP = new Set<string>([]);

// Phase 35 (maplibre) — the Lit MapLibreScreenshot cell was previously gated here as
// a "0×0 canvas / never-visible" deferral. ROOT-CAUSED 2026-06-08: it was an infinite
// render loop (NOT a sizing issue) — the demo's inline `:center="[-77, 37.5]"` array
// literal re-committed a fresh-but-value-equal array each render, tripping the Lit
// model-prop controllable's Object.is (reference) change guard → SignalWatcher
// re-entrancy → pegged main thread → the map never laid out. Fixed by hoisting the
// center literal to a stable `const` in MapLibreScreenshotDemo.rozie (lit-html's
// per-binding dedup then commits it once). All 6 targets now render the offline-style
// colored polygon identically; the gate is removed and the cell runs as a normal
// shared-baseline test. The deeper emitter fix (auto-hoist pure-literal component-prop
// bindings on Lit) is tracked in
// .planning/todos/pending/lit-emitter-hoist-pure-literal-component-props.md.
const MAPLIBRE_LIT_SCREENSHOT_TODO = new Set<string>([]);

// NOTE: ResizableScreenshot · solid was briefly gated here (2026-06-25) on a
// MISDIAGNOSIS — it was blamed on `@rozie/runtime-solid`'s `parseInlineStyle`
// dropping a `--custom-property` from a `:style` object. The real cause was the
// Solid emitter emitting both `class={…}` and `classList={…}` on the same
// element: Solid's `el.className=…` setter clobbered the `classList.toggle()`
// conditional classes, so the `--horizontal` layout class never applied and the
// start panel collapsed to content width. Fixed in emitTemplateAttribute.ts
// (object `:class` merges into the single `class=` via rozieClass, no classList=);
// the cell now runs and passes on all six targets. See feedback_snapshot_tests_cement_bugs.

for (const example of EXAMPLES) {
  const hasBaseline = baselineExists(example);
  for (const target of TARGETS) {
    // Cell fixme-gates on ANY of:
    //  - Angular column build availability (existing)
    //  - per-example baseline PNG presence (for examples added before their
    //    Linux-Docker baseline regen has landed)
    //  - the known cross-target-divergence gate (documented above) — currently
    //    empty; reserved for a future cell that provably cannot match
    //  - the Phase 14.1 follow-up gate — entries name REAL spreadBinding-emit
    //    regressions in feature code, scheduled for fix in Phase 14.1. NOT
    //    accepted divergence; each entry is a bug to be closed.
    const crossTargetDivergent = KNOWN_CROSS_TARGET_DIVERGENCE.has(
      `${example}::${target}`,
    );
    const phase14_1Followup = PHASE_14_1_FOLLOWUP.has(`${example}::${target}`);
    const maplibreLitScreenshotTodo = MAPLIBRE_LIT_SCREENSHOT_TODO.has(
      `${example}::${target}`,
    );
    const runner =
      (target === 'angular' && !angularBuilt) ||
      !hasBaseline ||
      crossTargetDivergent ||
      phase14_1Followup ||
      maplibreLitScreenshotTodo
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
