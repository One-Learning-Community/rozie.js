/*
 * Phase 7 Plan 02 — shared host harness logic (D-09 / D-10).
 *
 * This module is the single source of truth for:
 *   1. parsing `?example=<Name>&target=<target>` out of `location.search`
 *   2. the canonical 8-example list (verbatim from tests/dist-parity/parity.test.ts)
 *   3. the kebab-cased `<rozie-*>` custom-element tag per example (for the Lit cell)
 *   4. resolving the chrome-reset `[data-testid="rozie-mount"]` wrapper
 *
 * The six per-target `entry.<target>.ts` files import from here, then perform
 * the framework-specific mount into the wrapper. Routing is by URL query
 * (RESEARCH Pattern 1) — never by build-time switch — so one built artifact
 * per target serves all 8 of that target's cells.
 */

export const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
  // Phase 07.2 Plan 06 — ModalConsumer dogfood mount (consumer-side fills).
  'ModalConsumer',
  // Phase 07.2 Plan 06 follow-ups (closed post-Phase 07.3.2.1):
  // standalone demos used by the dynamic-slot-name + lit-scoped-fill-firstpaint
  // specs to exercise runtime behaviors not covered by the matrix screenshots.
  // No canonical examples/<Name>.rozie sibling exists for these — the loader
  // falls through to `examples/demos/<Name>Demo.rozie` only. The tag-naming
  // convention still applies: LIT_TAGS[example] + '-demo' = the demo's tag.
  'DynamicSlotName',
  'LitScopedFillFirstpaint',
  // Spike 003 portal-slot primitive — VR coverage of the runtime mount
  // path. Loader resolves to `examples/demos/PortalListDemo.rozie` (which
  // imports `../PortalList.rozie`); the wrapper instantiates an inline
  // vanilla-JS engine and mounts each row's content through `$portals.item`.
  'PortalList',
  // FullCalendar (added 2026-05-19) — real-third-party-engine portal-slot
  // smoke. Loader resolves to `examples/demos/FullCalendarDemo.rozie`
  // (which imports `../FullCalendar.rozie`). The wrapper boots a real
  // FullCalendar 6.x instance; consumer's `<template #event>` fills mount
  // through `$portals.event` into engine-owned event cells. Validates the
  // portal-slot primitive against a real third-party JS engine,
  // complementing PortalList's synthetic in-line engine coverage.
  'FullCalendar',
  // LineChart (added 2026-05-19) — non-portal engine-wrapper runtime
  // smoke. Loader resolves to `examples/demos/LineChartDemo.rozie`
  // (which since Phase 30 imports the generic Chart from
  // `../../packages/ui/chartjs/src/Chart.rozie` with `type="line"`).
  // Validates the array-prop reconcile path on the generic Chart. (The
  // Chart wrapper DOES declare one `tooltip` portal slot now, but this
  // line-typed demo doesn't fill it.) Also exercises the Lit updated() shim on
  // `$watch(() => $props.data, ...)` where data is a
  // `{ labels, datasets: [{ data: [] }] }` ChartData object — a richer
  // all-`$props` getterDep shape than FullCalendar's flat events array.
  'LineChart',
  // CodeMirror (added 2026-05-19) — r-model:value two-way binding
  // through a non-input contenteditable engine. Existing model:true
  // examples in the suite wrap form inputs (Counter, SearchInput,
  // SortableList items). CodeMirror reflects user edits via an
  // `EditorView.updateListener` extension, not a DOM input event —
  // the archetypal engine-mediated two-way case. The demo binds two
  // editors to the same `$data.code` signal, so an edit in one round-
  // trips through the model emit path to the other.
  'CodeMirror',
  // Phase 29 (codemirror) D-07 tier 2 — CodeMirrorScreenshot is the content-
  // STABLE screenshot demo. Loader resolves to
  // examples/demos/CodeMirrorScreenshotDemo.rozie (which imports
  // ../../packages/ui/codemirror/src/CodeMirror.rozie). Where the date-floating
  // `CodeMirror` cell above is BEHAVIORAL-only (registered as a host cell but NOT
  // a matrix screenshot cell — CM6's blinking caret/selection/active-line +
  // async measure make a raw capture flake), THIS demo binds a FIXED doc +
  // theme="light" and applies the `screenshotStable` EditorView.theme via
  // :extensions (caret/selection/active-line neutralized) and never focuses the
  // editor, so a stable `CodeMirrorScreenshot.png` baseline CAN exist. Registered
  // in matrix.spec.ts (auto-fixme until 29-04 Task 3 lands the Linux PNG).
  'CodeMirrorScreenshot',
  // PortalListStyled (added 2026-05-20, quick-task 260520-8iu) — Spike 004
  // string-`:style` + `@portal` VR coverage. Loader resolves to
  // `examples/demos/PortalListStyledDemo.rozie` (which imports
  // `../PortalListStyled.rozie`). The consumer fills the `@portal`-scoped
  // `#item` slot with rows carrying BOTH an object-form `:style` (the
  // `.swatch` color) and a dynamic-string `:style` (the `.row` opacity) —
  // exercising the Part-A string-`:style` lowering visually, and giving the
  // `@portal` primitive its visual/runtime VR coverage to complement the
  // structural dist-parity coverage landed by 260519-vyv.
  'PortalListStyled',
  // Engine-wrapper demos (added 2026-05-20, quick-task 260520-hus) — standing
  // VR coverage for the 6-demo render-confirm sweep. Each loader-resolves to
  // `examples/demos/<Name>Demo.rozie` (which imports its canonical sibling
  // `../<Name>.rozie`). SortableList/Flatpickr/TipTap/Uppy + the already-wired
  // Table are baseline-gated screenshot cells in matrix.spec.ts; LeafletMap is
  // behavioral-only (live OSM tiles are non-deterministic — see
  // leaflet-map.spec.ts). All 6 build clean on all 6 targets.
  'SortableList',
  // SortableList family — drag-between (`SortableListPair`) and Kanban-nesting
  // (`SortableListNested`) demos paired with the canonical reorder demo. They
  // exercise SortableList's onAdd/onRemove + module-level transfer slot
  // (cross-list drag) and SortableList composing with itself + the
  // KanbanColumn wrapper (cross-column card drag with reorderable columns).
  'SortableListPair',
  'SortableListNested',
  // SortableList showcase trio (added 2026-05-27, quick-task 260526-uj3) —
  // dedicated marketing surface for the SortableList family.
  // SortableListClone exercises the new `cloneable: true` prop +
  // useSortableJS's onClone stash bridge + handleCommit pullMode='clone'
  // short-circuit (palette → canvas, source stays intact). SortableListFilter
  // exercises the new `filter` pass-through prop with a `[data-locked]`
  // attribute-selector pattern (data-* survives all 6 targets identically).
  // SortableListShowcase is the marquee piece — every prop wired into a
  // live control panel, construction-time knobs (forceFallback/swapThreshold/
  // cloneable) trigger remount via `:key` recomputation.
  'SortableListClone',
  'SortableListFilter',
  'SortableListShowcase',
  // Quick 260620-o6a — SortableListKeying is the BEHAVIORAL-only keying fixture
  // (loader → examples/demos/SortableListKeyingDemo.rozie, which imports
  // ../../packages/ui/sortable-list/src/SortableList.rozie + a per-row
  // KeyMarkerRow mount-marker child). It proves the id-less-object-list keying
  // data-corruption fix: two SortableLists of id-less objects (WeakMap default +
  // a function itemKey) reordered, asserting each row's mount marker stays bound
  // to its ORIGINAL item — see sortable-keying.spec.ts. Built for all 6 targets
  // but NOT a screenshot cell — deliberately NOT in matrix.spec.ts EXAMPLES
  // (behavioral-only; no pixel baseline).
  'SortableListKeying',
  'Flatpickr',
  'LeafletMap',
  'TipTap',
  'Uppy',
  'Table',
  // Phase 14 — ThemedButtonConsumer is the dist-parity dogfood for the
  // attribute-fallthrough feature (D-05/D-06). The consumer mounts a
  // ThemedButton (default auto-fallthrough) + ThemedButtonManual
  // (`inherit-attrs="false"` + manual `r-bind="$attrs"`) side by side and
  // forwards id / aria-* / data-* / type / extra class + a `style="--btn-bg: …"`
  // CSS-custom-property override onto each. Wired into the VR matrix here +
  // covered by structural assertions in themed-button.spec.ts (fallthrough
  // attributes on the rendered <button>s; the cross-target class/style merge
  // applied — auto and manual modes produce equivalent DOM).
  'ThemedButtonConsumer',
  // Phase 15 — listener-side sibling wrappers + ROnProbe (D-04 / D-05 / D-07).
  // ThemedButtonListenersManual / ThemedButtonAllManual are PRODUCER fixtures
  // mounted in isolation (no inner consumer). ROnProbe is a single-file probe
  // exercising the literal modifier-bearing `r-on`, dynamic spread, and R6
  // same-event source-order merge codegen across the 6 targets.
  'ThemedButtonListenersManual',
  'ThemedButtonAllManual',
  'ROnProbe',
  // Phase 17 — PartCardConsumer is the `::part()` cross-shadow-DOM dogfood.
  // A multi-rozie consumer (precedent: ThemedButtonConsumer) that embeds
  // <PartCard> via a <components> block and styles the child's `part="body"`
  // shadow element across the boundary with a `PartCard::part(body)` rule.
  // Base example — loader resolves directly to examples/PartCardConsumer.rozie
  // (no demo sibling); its <components> import of PartCard.rozie is resolved
  // by the unplugin at build time. On Lit the styled effect is visible across
  // the shadow boundary; on the 5 non-Lit targets the rule is a no-op.
  'PartCardConsumer',
  // Phase 21 — ExposeProbe is the $expose imperative-handle dogfood. A typed
  // input exposing reset()/focus(); base example, loader resolves directly to
  // examples/ExposeProbe.rozie (no demo sibling). The per-target entry shims
  // grab the native handle (React ref / Vue template ref / Svelte bind:this /
  // Angular viewChild / Solid ref callback / Lit element query) and render a
  // "reset via handle" button — the external-caller harness (D-07) the
  // expose-probe.spec drives to assert the exposed method clears the input.
  'ExposeProbe',
  // Quick 260601-x2p — FlatpickrBehavior is the behavioral-only gap-2/3/4 demo.
  // Loader resolves to examples/demos/FlatpickrBehaviorDemo.rozie (which imports
  // ../../packages/ui/flatpickr/src/Flatpickr.rozie). Built for all 6 targets
  // but NOT a screenshot cell — covered by flatpickr-behavior.spec.ts
  // (structural assertions for :disable / :locale / :plugins), deliberately NOT
  // in matrix.spec.ts EXAMPLES. Distinct from the existing 'Flatpickr' wrapper
  // screenshot cell (FlatpickrDemo.rozie), which stays byte-untouched.
  'FlatpickrBehavior',
  // Phase 27 (fullcalendar) D-03 — FullCalendarBehavior is the behavioral-only
  // demo for the EXPANDED FullCalendar surface (the new runtime-updatable props
  // nowIndicator/weekends, the new select/eventResize/datesSet events, and the
  // $expose handle next()/getApi()). Loader resolves to
  // examples/demos/FullCalendarBehaviorDemo.rozie (which imports
  // ../../packages/ui/fullcalendar/src/FullCalendar.rozie). Built for all 6
  // targets but NOT a screenshot cell — covered by full-calendar-behavior.spec.ts
  // (structural/behavioral assertions), deliberately NOT in matrix.spec.ts
  // EXAMPLES. Distinct from the existing 'FullCalendar' wrapper cell
  // (FullCalendarDemo.rozie), which stays byte-untouched.
  'FullCalendarBehavior',
  // Phase 28 (fullcalendar-parity-expansion) REQ-28-4 — FullCalendarSlots is
  // the date-PINNED 3-slot SCREENSHOT demo. Loader resolves to
  // examples/demos/FullCalendarSlotsDemo.rozie (which imports
  // ../../packages/ui/fullcalendar/src/FullCalendar.rozie). Fills the three
  // high-demand portal-slots (#event / #dayCell / #dayHeader) and pins the grid
  // via :options initialDate ('2026-06-15') so a stable Linux baseline can
  // exist — unlike the date-floating 'FullCalendar' cell. Registered in
  // matrix.spec.ts (auto-fixme until 28-04 lands the Linux PNG).
  'FullCalendarSlots',
  // Phase 28 (fullcalendar-parity-expansion) REQ-28-4 — FullCalendarAllSlots is
  // the behavioral-only "fill every slot" demo (all 7 portal-slots + the 5 new
  // events + a passthrough :options). Loader resolves to
  // examples/demos/FullCalendarAllSlotsDemo.rozie. Built for all 6 targets but
  // NOT a screenshot cell — covered by full-calendar-slots.spec.ts
  // (DOM-presence assertions), deliberately NOT in matrix.spec.ts EXAMPLES
  // (D-03 / flatpickr precedent).
  'FullCalendarAllSlots',
  // Phase 24 (security-self-test-battery) D-11 — base example; the loader
  // resolves directly to examples/RHtml.rozie (no demo sibling). Its String
  // `content` prop has a non-empty static-HTML default, so the cell renders raw
  // HTML (the bold "safe") without a parent supplying props.
  'RHtml',
  // quick-task 260608-sya — nullish attribute-binding DROP parity fixture. Base
  // example; loader resolves to examples/AttrNullishDrop.rozie (no demo). Self-
  // contained ($data only), so no parent props. The attr-nullish-drop.spec.ts
  // behavioral spec asserts the dropped attrs are ABSENT at runtime.
  'AttrNullishDrop',
  // Phase 30 (chartjs) — ChartScreenshot is the content-STABLE multi-type
  // SCREENSHOT demo. Loader resolves to examples/demos/ChartScreenshotDemo.rozie
  // (which imports ../../packages/ui/chartjs/src/Chart.rozie). It renders a grid
  // of THREE chart kinds (line + bar + doughnut) from the ONE generic Chart with
  // animation:false + devicePixelRatio:1 + a pinned font + fixed data, so a
  // stable `ChartScreenshot.png` baseline CAN exist (unlike a live/animated
  // chart). Registered in matrix.spec.ts (auto-fixme until the Linux PNG lands).
  'ChartScreenshot',
  // Phase 30 (chartjs) — ChartBehavior is the behavioral-only type-switching
  // cell. Loader resolves to examples/demos/ChartBehaviorDemo.rozie. Built for
  // all 6 targets but NOT a screenshot cell — covered by chart.spec.ts
  // (canvas paint + runtime line->bar->doughnut re-create + @click counter +
  // :plugins passthrough + tooltip portal-slot fill), deliberately NOT in
  // matrix.spec.ts EXAMPLES. Distinct from the line-typed 'LineChart' cell.
  'ChartBehavior',
  // Phase 32 (tiptap) — TipTapScreenshot is the content-STABLE SCREENSHOT demo
  // (loader → examples/demos/TipTapScreenshotDemo.rozie, which imports
  // ../../packages/ui/tiptap/src/TipTap.rozie). A fixed rich-HTML doc with the
  // caret neutralized + never focused, so a stable `TipTapScreenshot.png` baseline
  // CAN exist (contenteditable, NOT canvas — no first-paint problem). Registered
  // in matrix.spec.ts (auto-fixme until the Linux PNG lands).
  'TipTapScreenshot',
  // Phase 32 (tiptap) — TipTapBehavior is the behavioral-only command cell
  // (loader → examples/demos/TipTapBehaviorDemo.rozie). Built for all 6 targets
  // but NOT a screenshot cell — covered by tiptap.spec.ts (internal-toolbar
  // bullet-list command on all 6 + the $expose handle undo/getHTML on the 5
  // ref-resolving targets). Deliberately NOT in matrix.spec.ts EXAMPLES.
  'TipTapBehavior',
  // Phase 33 (reactive-portal-slots) — the reactive nodeView portal slot proving
  // cells. TipTapNodeView is the BEHAVIORAL cell (loader →
  // examples/demos/TipTapNodeViewDemo.rozie, which fills the `nodeView` REACTIVE
  // portal slot with a MentionChip atom + a CalloutChrome editable callout). It
  // proves in-place re-render on engine transactions (data-identity survives) +
  // the contentDOM composition (REQ-24/25/26). Built for all 6 targets but NOT a
  // screenshot cell — covered by tiptap-nodeview.spec.ts. TipTapNodeViewScreenshot
  // is the content-STABLE pixel cell (caret-neutralized fixed doc with both
  // custom nodes); registered in matrix.spec.ts (auto-fixme until the Linux PNG).
  'TipTapNodeView',
  'TipTapNodeViewScreenshot',
  // Phase 35 (maplibre) — the WebGL-map two-way-camera + portal-slot proving
  // cells. MapLibre is the BEHAVIORAL cell (loader →
  // examples/demos/MapLibreDemo.rozie, which imports
  // ../../packages/ui/maplibre/src/MapLibre.rozie). It binds r-model:center/zoom
  // to $data (live readout), passes an OFFLINE style object (network-free — CI
  // has no network), renders a navigation control, fills the REACTIVE
  // multi-instance `marker` portal slot (3 pins) and the MOUNT-ONCE `control`
  // portal slot. Built for all 6 targets but NOT a screenshot cell — covered by
  // maplibre-map.spec.ts (structural/behavioral assertions, no screenshot — like
  // leaflet-map.spec.ts), deliberately NOT in matrix.spec.ts EXAMPLES.
  // MapLibreScreenshot is the content-STABLE pixel cell (loader →
  // examples/demos/MapLibreScreenshotDemo.rozie): the OFFLINE colored-polygon
  // style + fixed center/zoom + fadeDuration:0/attributionControl:false/
  // interactive:false, NO controls/markers/interaction — registered in
  // matrix.spec.ts (auto-fixme until the Linux PNG lands).
  'MapLibre',
  'MapLibreScreenshot',
  // Phase 37 (declarative-children dogfood) — MapLibreDeclarative is the
  // BEHAVIORAL declarative-variant cell (loader → MapLibreDeclarativeDemo.rozie,
  // which imports ../../packages/ui/maplibre/src/{MapLibre,Source,Layer}.rozie).
  // It feeds ONE <MapLibre> BOTH a config-array (:sources/:layers) AND declarative
  // children — a nested <Source><Layer/></Source> + a flat background <Layer> — to
  // prove the D-02 union-merge (registry ∪ props, registry-overrides-array on id
  // collision). Behavioral-only, NO new pixel baseline (D-08): the engine output
  // equals the config-array path, so maplibre-map.spec.ts asserts each layer/source
  // via the $expose getMap() handle (D37-04 union entity count). Built for all 6
  // targets but NOT a matrix.spec.ts screenshot cell. The existing config-array
  // 'MapLibre'/'MapLibreScreenshot' cells stay byte-identical (D-5).
  'MapLibreDeclarative',
  // Cropper (Cropper.js v1) — the image-cropper image+overlay cells. Cropper is
  // the BEHAVIORAL cell (loader → examples/demos/CropperDemo.rozie, which imports
  // ../../packages/ui/cropper/src/Cropper.rozie). It binds r-model:data (the crop
  // box) to $data with a live rotate readout, drives the $expose handle's
  // rotateBy(90) from a button, and loads a network-free SVG data URL. Built for
  // all 6 targets but NOT a screenshot cell — covered by cropper.spec.ts
  // (structural/behavioral assertions, no screenshot), deliberately NOT in
  // matrix.spec.ts EXAMPLES. CropperScreenshot is the content-STABLE pixel cell
  // (loader → examples/demos/CropperScreenshotDemo.rozie): the same SVG data URL +
  // a FIXED :data crop box + responsive:false, NO controls/interaction —
  // registered in matrix.spec.ts (auto-fixme until the Linux PNG lands).
  'Cropper',
  'CropperScreenshot',
  // Waveform (wavesurfer.js v7) — the content-STABLE audio-waveform pixel cell
  // (loader → examples/demos/WaveformScreenshotDemo.rozie, which imports
  // ../../packages/ui/wavesurfer/src/Waveform.rozie). Renders from FIXED offline
  // peaks + duration (no network/decode) with two pinned regions + the timeline
  // ruler, container pinned to 480px for D-10. Registered as a screenshot cell in
  // matrix.spec.ts EXAMPLES.
  'WaveformScreenshot',
  // PdfViewer (PDF.js / pdfjs-dist v6) — the dynamic-import + canvas-render +
  // two-way-page cell. BEHAVIORAL (loader → examples/demos/PdfViewerDemo.rozie,
  // which imports ../../packages/ui/pdf/src/PdfViewer.rozie): a bundled worker + a
  // network-free 3-page base64 PDF, @load → numPages readout, a canvas + selectable
  // .textLayer, and r-model:page two-way driven by a Next button. Covered by
  // pdf.spec.ts (structural/behavioral).
  'PdfViewer',
  // PdfViewerScreenshot is the content-STABLE pixel cell (loader →
  // examples/demos/PdfViewerScreenshotDemo.rozie): the same network-free base64
  // PDF + bundled worker, pinned to page 1 at scale 0.45 with text-layer OFF. pdfjs
  // rasterizes the page into a 2D <canvas> from the SAME pdfjs-dist in every target,
  // so the bitmap is engine-painted + emit-family-independent and a shared D-10
  // `PdfViewerScreenshot.png` holds across all 6 (the Chart/MapLibre canvas-VR
  // precedent — the earlier "cross-emit byte-identity won't hold for canvas" worry
  // was disproven once those cells landed 6/6). Baseline-gates to test.fixme via
  // baselineExists() until the Linux-Docker PNG lands.
  'PdfViewerScreenshot',
  // FlowCanvas (Rete.js v2) — the node-flow-editor cells (Phase 41 CONTROLLED-GRAPH
  // redesign). FlowCanvas is the BEHAVIORAL cell (loader →
  // examples/demos/FlowCanvasDemo.rozie, which imports
  // ../../packages/ui/rete/src/{FlowCanvas,NodeType,Port}.rozie). It binds ONE
  // `r-model:graph` controlled graph object as the single source of truth, declares a
  // single `task` <NodeType> render-by-type template (with input/output <Port>s),
  // drives a two-way r-model:zoom, an "add node" graph-append reconcile, and proves
  // the DRAG WRITE-BACK (the canvas rewrites $data.graph.nodes[i].x/y back into the
  // bound model — the node0-x readout reflects it) — see rete-flow.spec.ts.
  // FlowCanvasScreenshot is the content-STABLE pixel cell (loader →
  // FlowCanvasScreenshotDemo.rozie): a fixed controlled graph with
  // pan/zoom/selection off + fitOnMount off (identity transform) + a minimal
  // render-by-type body. Registered as a host cell; the screenshot baseline is a
  // tracked deferral (the connection-path sub-pixel + canvas-VR precedent; the
  // controlled-model rework also regenerates it in 41-05) so it is NOT in
  // matrix.spec.ts EXAMPLES until a Linux PNG is generated and verified.
  'FlowCanvas',
  'FlowCanvasScreenshot',
  // (FlowCanvasDeclarative RETIRED in 41-04: it consumed the now-removed per-INSTANCE
  // <FlowNode id>/<Handle side>/<Connection> API + the config-array :nodes union,
  // which the controlled-graph + <NodeType>/<Port> model supersedes. Its render-by-
  // type + body-portal proof now lives in the FlowCanvas/FlowCanvasAdvanced cells.
  // The rete-flow.spec.ts `rete-flow-declarative` cell is removed alongside in 41-05.)
  // Phase 41 (controlled-graph typed pipeline) — FlowCanvasAdvanced is the BEHAVIORAL
  // typed-connect cell (loader → examples/demos/FlowCanvasAdvancedDemo.rozie, which
  // imports ../../packages/ui/rete/src/{FlowCanvas,NodeType,Port}.rozie). It is the
  // locked-authoring-API proof: ONE `r-model:graph` object + a handful of <NodeType>/
  // <Port> TYPE TEMPLATES — a `source` type with BOTH a number AND a string OUTPUT
  // port, and a `merge` type with BOTH a number AND a string INPUT port (Dan's multi-
  // port ask). It exercises AUTOMATIC :validate-types (a number→string drag is
  // REJECTED, no edge drawn, the readout-rejected text shows the routed ports), a
  // `:can-connect` OVERRIDE (a self-loop is rejected IN ADDITION to the typed check),
  // the DRAG WRITE-BACK (node0-x readout), the per-node ✕ → controlled-graph remove
  // (@pointerup/:data-id Solid design-around filtering $data.graph.nodes), two-way
  // r-model:zoom, and a fit ($expose zoomToFit) button — see rete-flow.spec.ts
  // (rete-flow-advanced). Built for all 6 targets but NOT a matrix.spec.ts screenshot
  // cell (behavioral-only, NO new pixel baseline; FlowCanvasScreenshot stays the
  // pixel gate).
  'FlowCanvasAdvanced',
  // Phase 42 (built-in MiniMap + viewport API) — FlowCanvasMinimap is the BEHAVIORAL
  // minimap cell (loader → examples/demos/FlowCanvasMinimapDemo.rozie, which imports
  // ../../packages/ui/rete/src/{FlowCanvas,NodeType,Port}.rozie). It binds a wide
  // 4-node controlled graph with `:minimap="true"` (+ :fit-on-mount="false" so the
  // graph overflows → the minimap viewport window is a real sub-rect) and proves: the
  // minimap host + node rects (count == graph nodes) + the viewport rect render, and a
  // pointer-drag on the minimap recenters the bound viewport (setCenter → @translated →
  // readout-tx) — see rete-flow.spec.ts (rete-flow-minimap). Built for all 6 targets
  // but NOT a screenshot cell (behavioral-only; FlowCanvasScreenshot stays the one
  // rete pixel baseline, with :minimap OFF).
  'FlowCanvasMinimap',
  // Phase 43 F1 (palette drag-drop) — FlowCanvasPalette is the BEHAVIORAL cell (loader →
  // examples/demos/FlowCanvasPaletteDemo.rozie). It proves the `screenToFlowPosition`
  // $expose verb: a "Drop at center" button projects the canvas-center screen point to
  // graph coords + appends a fresh node there; the spec asserts the new node lands at the
  // canvas center (round-trip projection). Behavioral-only; NOT a screenshot cell.
  'FlowCanvasPalette',
  // Phase 43 F2 (top/bottom handle positioning) — FlowCanvasVertical is the BEHAVIORAL
  // cell (loader → examples/demos/FlowCanvasVerticalDemo.rozie): a vertical pipeline where
  // each `step` node has a TOP input + BOTTOM output (`<Port position="top|bottom">`). The
  // spec asserts the top/bottom sockets render and the connection anchors shift on the Y
  // axis (the custom getDOMSocketPosition offset) — endpoints stay horizontally aligned
  // with the sockets. Behavioral-only; NOT a screenshot cell.
  'FlowCanvasVertical',
  // Phase 43 F3 (edge labels + styling) — FlowCanvasEdges is the BEHAVIORAL cell (loader →
  // examples/demos/FlowCanvasEdgesDemo.rozie): a Start node fanning out to Approve (green,
  // labeled 'approve') + Reject (red, dashed, labeled 'reject') via per-edge
  // `graph.connections[].label/stroke/dashed`. The spec asserts the labels render, the
  // styling applies, and a relabel writes through the controlled graph. Behavioral-only.
  'FlowCanvasEdges',
  // Phase 44 T1.1 (D-08, edge select + delete) — FlowCanvasEdgeDelete is the BEHAVIORAL
  // cell (loader → examples/demos/FlowCanvasEdgeDeleteDemo.rozie): a Start node fanning
  // out to Approve + Reject via two committed edges. The spec (rete-flow-edge-delete)
  // clicks a specific `.rozie-flow-connection__path`, presses Delete, and asserts the
  // path count dropped by exactly 1, the targeted edge's path is gone, and the
  // `connection-count` readout decremented. Behavioral-only; NOT a screenshot cell.
  'FlowCanvasEdgeDelete',
  // Phase 44 T1.2 (D-01, edge types) — FlowCanvasEdgeTypes is the BEHAVIORAL cell
  // (loader → examples/demos/FlowCanvasEdgeTypesDemo.rozie): a single Start node fanning
  // out to four targets, one edge per type via `graph.connections[].type`
  // (step/smoothstep/straight + a default no-type → bezier). The spec
  // (rete-flow-edge-types) asserts the step edge's `d` contains orthogonal `L` segments
  // and the default (bezier) edge's `d` still uses a `C` bezier command (bezier default
  // unchanged). Behavioral-only; NOT a screenshot cell.
  'FlowCanvasEdgeTypes',
  // Phase 44 T1.3 (D-02/03/04, undo/redo) — FlowCanvasUndo is the BEHAVIORAL cell
  // (loader → examples/demos/FlowCanvasUndoDemo.rozie): a 2-node graph + undo/redo
  // buttons calling the canvas's undo()/redo() $expose verbs. The spec (rete-flow-undo)
  // captures node A's bound x, drags it, asserts x changed, clicks undo (x EQUALS the
  // pre-drag value exactly), then redo (x returns to post-drag). One gesture = one undo
  // step. Behavioral-only; NOT a screenshot cell.
  'FlowCanvasUndo',
  // Phase 44 T2.4 (D-05, marquee select) — FlowCanvasMarquee is the BEHAVIORAL cell
  // (loader → examples/demos/FlowCanvasMarqueeDemo.rozie): a ≥2-node graph driving `mode`
  // INTERNALLY via a `mode-btn` toggle (with :marquee ON) + readouts `selected-count` (fed
  // by @selection-change) and `viewport-x` (fed by @translated). The spec (rete-flow-marquee)
  // sets mode='select' and drags a box over ≥2 nodes → asserts selected-count ≥ 2 (settled),
  // then sets mode='pan' and does the same drag → asserts viewport-x changed (panned) with no
  // new selection. Behavioral-only; NOT a screenshot cell.
  'FlowCanvasMarquee',
  // Phase 44 T2.5 (D-08, D-03, reconnectable edges) — FlowCanvasReconnect is the BEHAVIORAL
  // cell (loader → examples/demos/FlowCanvasReconnectDemo.rozie): a source→sink graph where
  // sink has TWO input sockets (in1/in2) and one seeded edge into in1. The spec
  // (rete-flow-reconnect) drags the edge's input endpoint from in1 to in2 → asserts
  // conn0-target-input changed to 'in2' (SETTLED) AND connection-count stayed 1 (one removed
  // + one added), then clicks undo ONCE → asserts conn0-target-input returns to 'in1'
  // (proving the reconnect coalesced into ONE history entry). Behavioral-only; NOT a
  // screenshot cell.
  'FlowCanvasReconnect',
  // Phase 44 T2.8 (D-06, NodeToolbar) — FlowCanvasToolbar is the BEHAVIORAL cell (loader →
  // examples/demos/FlowCanvasToolbarDemo.rozie): a 2-node graph with :node-toolbar ON +
  // readouts `node-count` (bound model) and `node-action-readout` (fed by @node-action).
  // The spec (rete-flow-toolbar) selects a node → asserts `.rozie-flow-toolbar` is visible
  // near it → clicks its Delete button → asserts the node is gone (toHaveCount(0)),
  // node-count decremented, @node-action fired 'delete'; ALSO asserts the FlowCanvas
  // (default demo, no flag) shows NO toolbar on select (pixel-safe). Behavioral-only.
  'FlowCanvasToolbar',
  // Phase 44 T2.6 (D-08, auto-layout) — FlowCanvasArrange is the BEHAVIORAL cell (loader →
  // examples/demos/FlowCanvasArrangeDemo.rozie): two `step` nodes seeded ON TOP of each
  // other (same x/y) + connected a→b, with `node0-x`/`node1-x` readouts and an `arrange-btn`
  // calling the canvas's autoArrange() $expose verb. The spec (rete-flow-arrange) asserts the
  // two x readouts START overlapping, then after arrange differ by ≥ a node width (the elkjs
  // layered preset separates source→target into adjacent columns — a RELATIVE assertion, not
  // exact px) and are STABLE on re-sample (no oscillation). Exercises the elkjs bundle on all
  // 6 incl Angular AOT + Lit. Behavioral-only — autoArrange is verb-only so FlowCanvasScreenshot
  // stays byte-identical.
  'FlowCanvasArrange',
  // Phase 44 T2.7 (D-07, connect-end-on-pane) — FlowCanvasConnectEnd is the BEHAVIORAL cell
  // (loader → examples/demos/FlowCanvasConnectEndDemo.rozie): one `src` node with an output
  // socket. The spec (rete-flow-connect-end) drags FROM the output socket and drops on EMPTY
  // canvas → asserts the @connect-end readout shows the source id ('src') + FINITE in-range
  // graph-coord x/y (NOT exact — synthetic drop is flaky), the emit fired (connect-count ≥ 1),
  // and the node count is UNCHANGED (the canvas auto-creates nothing — consumer owns creation).
  // Behavioral-only — connect-end is a pure emit so FlowCanvasScreenshot stays byte-identical.
  'FlowCanvasConnectEnd',
  // Phase 74 (D-01..D-04, background variant) — FlowCanvasBackground is the BEHAVIORAL cell
  // (loader → examples/demos/FlowCanvasBackgroundDemo.rozie): a single `step` node + 4 toggle
  // buttons (`bg-dots`/`bg-lines`/`bg-cross`/`bg-none`) driving the canvas's own local
  // `background` state, plus a `current-background` readout. The spec (rete-flow-background)
  // clicks each button and asserts the readout updates + the canvas's computed CSS background
  // differs pairwise across dots/lines/cross and is flat (no gradient) for none, and that the
  // untouched default FlowCanvas demo's computed background equals the `dots` variant's
  // (D-02 byte-identity at the rendered-CSS level). Behavioral-only — not a screenshot cell.
  'FlowCanvasBackground',
  // Phase 74 (D-05/D-08/D-09/D-10/D-15/D-16, NodeResizer) — FlowCanvasResize is the
  // BEHAVIORAL cell (loader → examples/demos/FlowCanvasResizeDemo.rozie): a single
  // `resizable` `note` node (min 80x60 / max 400x300) + an `undo-btn`, plus bound-model
  // `node-width`/`node-height` readouts (default `'auto'`). The spec (rete-flow-resize)
  // asserts the 4 corner handles are hidden pre-selection and visible+positioned
  // post-selection, a corner-drag write-back changes the readouts (settled), undo reverts
  // them to `'auto'`, and a handle double-click on a freshly re-resized node ALSO resets to
  // `'auto'`. Behavioral-only; NOT a screenshot cell.
  'FlowCanvasResize',
  // Embla Carousel (Embla v8) — the carousel two-way-index + drag cells. Carousel
  // is the BEHAVIORAL cell (loader → examples/demos/CarouselDemo.rozie, which
  // imports ../../packages/ui/embla/src/Carousel.rozie). It drives a 5-slide
  // config-array carousel, a two-way r-model:selectedIndex (live readout), a
  // `next-model` direct-model-write button (the uniform two-way driver) + a `next`
  // $expose scrollNext() button (structural; no-ops on Angular's host-element ref),
  // and a real pointer-drag swipe — see embla-carousel.spec.ts. Built for all 6
  // targets but NOT a screenshot cell — deliberately NOT in matrix.spec.ts EXAMPLES.
  // CarouselScreenshot is the content-STABLE pixel cell (loader →
  // examples/demos/CarouselScreenshotDemo.rozie): autoplay OFF + fixed startIndex +
  // a fixed-pixel-width root + fixed-width solid-color slides, so Embla's
  // measured-width transform is byte-identical across all 6 — registered in
  // matrix.spec.ts (auto-fixme until the Linux PNG lands).
  'Carousel',
  'CarouselScreenshot',
  // Built-in carousel navigation (dots + arrows + synced thumbnail strip) — the
  // content-STABLE pixel cell (loader → examples/demos/CarouselNavScreenshotDemo.rozie).
  'CarouselNavScreenshot',
  // @rozie-ui/listbox (pure-Rozie WAI-ARIA listbox/combobox, NO engine) — the
  // BEHAVIORAL cell (loader → examples/demos/ListboxBehaviorDemo.rozie, which
  // imports ../../packages/ui/listbox/src/Listbox.rozie). It drives single-select
  // with a two-way r-model:value (live readout), keyboard navigation
  // (ArrowDown/Enter/Escape), and a `set-value` direct-model-write button — see
  // listbox.spec.ts. Built for all 6 targets but NOT a screenshot cell —
  // deliberately NOT in matrix.spec.ts EXAMPLES (behavioral-only; no pixel baseline).
  'ListboxBehavior',
  // (P3/D-03: Listbox's editable combobox mode was retired — type-to-filter now
  // lives in @rozie-ui/combobox; the former ListboxCombobox cell is removed.)
  // Phase 64 P4 (headless windowing, SC-5) — the WINDOWED long-list cells (loaders →
  // examples/demos/{Listbox,Combobox}VirtualDemo.rozie, importing
  // packages/ui/{listbox,combobox}/src/<Component>.rozie). Each feeds a 1,000-option
  // list with :virtual (inline, bounded) so ONLY a small windowed [role="option"]
  // slice renders — backed by @rozie-ui/headless-core/windowing.rzts (the shared
  // virtual-core bridge, wired per-consumer with a no-op pin hook). Behavioral-only
  // (DOM assert, NOT in matrix.spec.ts — no pixel baseline); they live under
  // examples/demos/ so no Angular 3-file registration is needed (prebuildExtraRoots
  // [examplesRoot] + the examples tsconfig include + the glob-driven build-cells demos
  // sweep already cover them, importing the listbox/combobox source pkgs + the
  // headless-core src root already registered for Angular cross-tree AOT).
  'ListboxVirtual',
  'ComboboxVirtual',
  // @rozie-ui/slider (pure-Rozie WAI-ARIA slider/range, NO engine — the engine IS
  // the native <input type="range">) — the four BEHAVIORAL cells (loaders →
  // examples/demos/Slider{Behavior,Range,Vertical,Marks}Demo.rozie, each importing
  // ../../packages/ui/slider/src/Slider.rozie). They drive single + range two-way
  // r-model:value (live readouts), keyboard (Arrow/Home/End/PageUp), set-.value+
  // dispatch value commits, vertical aria-orientation, and the marks overlay — see
  // slider.spec.ts. Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline).
  'SliderBehavior',
  'SliderRange',
  'SliderVertical',
  'SliderMarks',
  // @rozie-ui pure-Rozie families (NO engine) — otp/dialog/combobox/toast. The
  // four BEHAVIORAL cells (loaders → examples/demos/{Otp,Dialog,Combobox,Toaster}-
  // BehaviorDemo.rozie, each importing packages/ui/<family>/src/<Component>.rozie).
  // OtpBehavior drives the segmented native-<input> one-time-code (two-way
  // r-model:value + @complete + set-code direct write); DialogBehavior drives the
  // native <dialog> showModal() two-way r-model:open + Escape `cancel` + consumer
  // close; ComboboxBehavior drives the WAI-ARIA input+listbox filter/keyboard-select
  // two-way r-model:value + set-value direct write; ToasterBehavior drives the
  // imperative $refs.toaster.show() handle + per-toast dismiss. See
  // otp/dialog/combobox/toaster.spec.ts. Behavioral-only; NOT in matrix.spec.ts
  // EXAMPLES (no pixel baseline).
  'OtpBehavior',
  'DialogBehavior',
  'ComboboxBehavior',
  'ToasterBehavior',
  // combobox-native-groups — the BEHAVIORAL cell (loader → examples/demos/
  // ComboboxGroupsDemo.rozie, importing packages/ui/combobox/src/Combobox.rozie)
  // proving the new opt-in `groups` prop: options render partitioned into
  // `role="group"` sections with `aria-label` headings, the flat keyboard model
  // (ArrowDown/Enter) walks the group-ordered sequence and never lands on a
  // heading, and the two-way r-model:value round-trip still commits on select.
  // See combobox-groups.spec.ts. Behavioral-only; NOT in matrix.spec.ts EXAMPLES.
  'ComboboxGroups',
  // combobox-group-cap — the BEHAVIORAL cell (loader → examples/demos/
  // ComboboxGroupCapDemo.rozie, importing packages/ui/combobox/src/Combobox.rozie)
  // proving the new opt-in `groupCap` prop: an overflowing section renders `cap`
  // options + one keyboard-reachable "+N more" row, ArrowDown roves onto it and
  // Enter/click expands that section in place with no value change, and the
  // two-way r-model:value round-trip still commits on a real-option select. See
  // combobox-group-cap.spec.ts. Behavioral-only; NOT in matrix.spec.ts EXAMPLES.
  'ComboboxGroupCap',
  // @rozie-ui otp/dialog/combobox/toast — the four content-STABLE SCREENSHOT cells
  // (loaders → examples/demos/{Otp,Combobox,Dialog,Toaster}ScreenshotDemo.rozie,
  // each importing packages/ui/<family>/src/<Component>.rozie). Two render
  // mechanisms (an architectural constraint): OtpScreenshot + ComboboxScreenshot
  // render INLINE → standard mount-clipped matrix cells (matrix.spec.ts);
  // DialogScreenshot (native <dialog> showModal → top layer + ::backdrop) +
  // ToasterScreenshot (position:fixed corner) ESCAPE the rozie-mount clip → a
  // dedicated FULL-PAGE spec (overlay-screenshot.spec.ts). All four seed a FIXED
  // deterministic frame and auto-fixme on baselineExists() until the Linux-Docker
  // PNGs land (feedback_vr_linux_baselines). Distinct from the *Behavior cells.
  'OtpScreenshot',
  'ComboboxScreenshot',
  'DialogScreenshot',
  'ToasterScreenshot',
  // TOAST-STACK (toast-ux-cluster) — the opt-in `stacked` collapsed-mode
  // content-STABLE pixel cell (loader → ToasterStackedScreenshotDemo.rozie,
  // which imports packages/ui/toast/src/Toaster.rozie). Same fixed top-right
  // `position:fixed` corner as ToasterScreenshot, so it ALSO escapes the
  // rozie-mount clip → the SAME dedicated FULL-PAGE spec
  // (overlay-screenshot.spec.ts). Seeds 4 sticky toasts + `stacked`, never
  // hovered, so the collapsed depth-driven grid overlay (depth>=3 hidden)
  // paints on first frame — a SEPARATE baseline from ToasterScreenshot.
  'ToasterStackedScreenshot',
  // @rozie-ui/data-table (headless, accessible, cross-framework data table on a
  // single inline @tanstack/table-core bridge — NO per-framework adapter) — the
  // six BEHAVIORAL cells (loaders → examples/demos/DataTable{Columns,Sort,
  // FilterPaginate,Selection,ColumnMgmt,Sticky}Demo.rozie, each importing
  // ../../packages/ui/data-table/src/{DataTable,Column}.rozie). They drive the two
  // column-declaration forms + 3-distinct-cell-template (req-2/3), sort cycle +
  // aria-sort + multi-sort (req-4), global/per-column filter + pagination (req-5/6),
  // single/multiple selection + select-all indeterminate (req-7), column
  // visibility/resize/reorder/pin (req-8-11), and the sticky header (req-12) — see
  // data-table.spec.ts. Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel
  // baseline). Angular cells mount NON-EMPTY via the three-file cross-tree
  // registration (vite.config.ts + tsconfig.app.json + build-cells.mjs).
  'DataTableColumns',
  'DataTableSort',
  // Task 1 (super-demo scaffold) — loader → examples/demos/DataTableSuperDemo.rozie,
  // which imports ../../packages/ui/data-table/src/{DataTable,Column}.rozie. One
  // .rozie wiring every data-table feature together for hand-dogfooding per
  // framework. Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline).
  'DataTableSuper',
  'DataTableFilterPaginate',
  'DataTableSelection',
  'DataTableColumnMgmt',
  'DataTableSticky',
  // Phase 49 (data-table grid interaction mode) WAVE-0 FOCUS PROBE — the
  // standalone, chrome-free cross-target focus() de-risk cell (loader →
  // examples/demos/DataTableGridProbeDemo.rozie, self-contained: NO DataTable /
  // @tanstack/table-core import). A 3-col grid (1 header row + 3 body rows,
  // interactionMode='grid') implementing RESEARCH Pattern-1 focus resolution
  // (data-row/data-col-index querySelector off a stable post-mount root +
  // .focus()) + a single delegated @keydown + the focusCell $expose verb. Covered
  // by data-table-grid-probe.spec.ts (single tabindex, ArrowRight focus move,
  // ArrowUp header crossing, Enter/Escape control entry/exit, focusCell(1,1)).
  // Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline). No new
  // Angular 3-file registration needed — it lives under examples/demos/ (already
  // covered by prebuildExtraRoots[examplesRoot] + the examples tsconfig include +
  // the glob-driven build-cells demos sweep) and imports no cross-tree package.
  'DataTableGridProbe',
  // Phase 49 (data-table grid interaction mode) LOCKED GATE — the grid-mode
  // behavioral VR cell (loader → examples/demos/DataTableGridNavDemo.rozie, which
  // imports ../../packages/ui/data-table/src/{DataTable,Column}.rozie). It mounts
  // the data-table TWICE: a getTestId="grid-table" instance with
  // interactionMode='grid' (sortable "name" header = control-bearing gridcell, a
  // #cell <button> on "score" = control-bearing body gridcell, @activecell-change
  // + getActiveCell()/focusCell(1,1) via the $refs.dt handle) and a sibling
  // getTestId="default-table" with NO interactionMode (the phase-48
  // role="table"/role="cell" default — proves the role flip). Covered by
  // data-table-grid.spec.ts across REQ-1..REQ-7. Behavioral-only; NOT in
  // matrix.spec.ts EXAMPLES (no pixel baseline). NO new Angular 3-file
  // registration needed — it lives under examples/demos/ (already covered by
  // prebuildExtraRoots[examplesRoot] + the examples tsconfig include + the
  // glob-driven build-cells demos sweep) and imports the SAME data-table source
  // pkg already registered for Angular cross-tree AOT in phase 48.
  'DataTableGridNav',
  // Phase 53 (data-table virtualization / row-windowing) — the two windowing
  // fixtures (loaders → examples/demos/DataTableVirtual{,VarHeight}Demo.rozie, each
  // importing ../../packages/ui/data-table/src/{DataTable,Column}.rozie).
  // DataTableVirtual is the LARGE-DATASET fixture: 100,000 rows (the D-13 tested-to
  // ceiling) with :virtual + maxHeight="400px" (PROP form, D-06), uniform ~40px rows
  // so getVirtualItems() is deterministic — proving only a small windowed <tr> set
  // renders. DataTableVirtualVarHeight is the NON-UNIFORM-height fixture: ~500 rows
  // whose "detail" #cell renders ((index % 3) + 1) stacked lines (deterministic non-
  // uniform), sized via the --rozie-data-table-max-height TOKEN form (no maxHeight
  // prop) — the measureElement de-risk fixture. Both behavioral-only; NOT in
  // matrix.spec.ts EXAMPLES (no pixel baseline). They live under examples/demos/ so
  // no new Angular 3-file registration is needed (prebuildExtraRoots[examplesRoot] +
  // the examples tsconfig include + the glob-driven build-cells demos sweep already
  // cover them, importing the data-table source pkg already registered for Angular
  // cross-tree AOT in phase 48).
  'DataTableVirtual',
  'DataTableVirtualVarHeight',
  // Phase 53 plan 04 (grid + virtual scroll-then-focus, req-5 / D-12) — the
  // intersection fixture (loader → examples/demos/DataTableVirtualGridDemo.rozie,
  // importing ../../packages/ui/data-table/src/{DataTable,Column}.rozie). A 5,000-row
  // grid (interactionMode="grid") with :virtual + maxHeight="400px": a focusCell(4000,1)
  // handle call targets a row FAR outside the rendered window, proving focusActiveCell
  // scrollToIndex-then-double-rAF-focus lands DOM focus on the (4000,1) cell across the
  // window boundary. Behavioral-only (DOM assert, NOT in matrix.spec.ts — no pixel
  // baseline); lives under examples/demos/ so no Angular 3-file registration is needed.
  'DataTableVirtualGrid',
  // Phase 53 plan 06 (windowing verification matrix, req-3/7/8) — the COMBINED
  // sticky+pinned+selection virtual fixture (loader →
  // examples/demos/DataTableVirtualStickySelectDemo.rozie, importing
  // ../../packages/ui/data-table/src/{DataTable,Column}.rozie). ~2,000 rows with
  // :virtual + :stickyHeader + maxHeight="400px" + selectionMode="multiple" +
  // r-model:columnPinning (left-pinned name col). Behavioral-only (DOM assert, NOT in
  // matrix.spec.ts — no pixel baseline); lives under examples/demos/ so no Angular
  // 3-file registration is needed.
  'DataTableVirtualStickySelect',
  // Phase 53 plan 06 (req-9 / D-07) — the virtual+pagination dev-warn + manual+virtual
  // change-event fixture (loader → examples/demos/DataTableVirtualWarnDemo.rozie). Mounts
  // a virtual table WITH a configured pagination (the only co-presence that trips the D-07
  // console.warn) + a manual+virtual table with bound selection (proving change events still
  // fire). Behavioral-only (DOM/console assert, NOT in matrix.spec.ts — no pixel baseline);
  // lives under examples/demos/ so no Angular 3-file registration is needed.
  'DataTableVirtualWarn',
  // Phase 51 (data-table editable cells) WAVE-0 D-02 PIN-ROW PROBE — the standalone,
  // chrome-free cross-target pin-row de-risk cell (loader →
  // examples/demos/DataTablePinProbeDemo.rozie, self-contained: NO DataTable /
  // @tanstack/virtual-core / @tanstack/table-core import). A ~100-row table rendered
  // through a minimal LOCAL copy of the Phase-53 windowedRows/padTop/padBottom math
  // that PINS an editing <tr> (keyed on row.id) in-flow when it scrolls outside the
  // natural window, subtracting its height from the appropriate spacer. Covered by
  // data-table-edit.spec.ts (D-02 pin-row block): proves the editing <tr> stays mounted
  // out-of-window, aria-rowindex stays monotonic, and total scroll height is invariant
  // ×6. Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline). No new
  // Angular 3-file registration needed — it lives under examples/demos/ (already covered
  // by prebuildExtraRoots[examplesRoot] + the examples tsconfig include + the
  // glob-driven build-cells demos sweep) and imports no cross-tree package.
  'DataTablePinProbe',
  // Phase 51 (data-table editable cells) — the editor fixtures the spec's editing-wave
  // assertions grow into (loaders → examples/demos/DataTableEdit{,Virtual}Demo.rozie,
  // each importing ../../packages/ui/data-table/src/{DataTable,Column}.rozie).
  // DataTableEdit is the NON-VIRTUAL editable fixture (text/number/select/checkbox
  // built-in editor columns + a `validate` column + a custom #editor scoped-slot column
  // exercising the React render-prop edge); DataTableEditVirtual is the VIRTUAL editable
  // fixture (~2000 rows, :virtual + maxHeight) for the req-9 pin-row survival assertions.
  // They reference the editable/editor/validate Column props + the #editor slot +
  // @cell-edit-commit that DO NOT EXIST until Plan 51-02 (Wave-(a)) declares them — today
  // they pass through inert (the #editor slot emits a harmless ROZ941 "slot not declared"
  // warning; the fixtures still compile + render the read-only table on all six). Their
  // editing assertions in data-table-edit.spec.ts sit behind test.fixme until Plans
  // 51-02..04 land. Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline).
  // They live under examples/demos/ so no new Angular 3-file registration is needed
  // (prebuildExtraRoots[examplesRoot] + the examples tsconfig include + the glob-driven
  // build-cells demos sweep already cover them, importing the data-table source pkg
  // already registered for Angular cross-tree AOT in phase 48).
  'DataTableEdit',
  'DataTableEditVirtual',
  // Phase 63 Wave-1 (grid-mode cell-edit correctness) — the cell-edit-under-grid-nav
  // RED-first fixture (loader → examples/demos/DataTableGridEditDemo.rozie, importing
  // ../../packages/ui/data-table/src/{DataTable,Column,EditorText}.rozie). ONE grid-mode
  // DataTable with five editable columns (text/number/select/checkbox built-ins + a
  // `note` #editor drop-in) bound r-model:data, with a model-readout JSON dump so
  // data-table-grid-edit.spec.ts asserts the committed model values + types (B1/B2/B3/
  // B4/B5/B24/B26). Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline).
  // Lives under examples/demos/ so no new Angular 3-file registration is needed
  // (prebuildExtraRoots[examplesRoot] + the examples tsconfig include + the glob-driven
  // build-cells demos sweep already cover it, importing the data-table source pkg already
  // registered for Angular cross-tree AOT in phase 48).
  'DataTableGridEdit',
  // Phase 63 Wave-2 (grid-mode row-edit + commit-under-sort correctness) — the
  // row-edit-cluster RED-first fixture (loader → examples/demos/DataTableGridRowEditDemo.rozie,
  // importing ../../packages/ui/data-table/src/{DataTable,Column}.rozie). ONE grid-mode
  // DataTable with four editable columns (name/qty/status/city) + a `validate` rule on qty +
  // a bound r-model:sorting driving an active sort, so data-table-grid-rowedit.spec.ts asserts
  // B21 (row Tab containment), B22 (validation focuses the offending cell), B23 (commit under
  // sort follows the relocated row's focus). Behavioral-only; NOT in matrix.spec.ts EXAMPLES
  // (no pixel baseline). Lives under examples/demos/ so no new Angular 3-file registration is
  // needed (prebuildExtraRoots[examplesRoot] + the examples tsconfig include + the glob-driven
  // build-cells demos sweep already cover it, importing the data-table source pkg already
  // registered for Angular cross-tree AOT in phase 48).
  'DataTableGridRowEdit',
  // Quick 260711-i5m (editor-owns-focus contract) — the DEDICATED row-mode reactive-refocus
  // RED-first fixture (loader → examples/demos/DataTableGridRowEditFocusDemo.rozie, importing
  // ../../packages/ui/data-table/src/{DataTable,Column,EditorText}.rozie). ONE grid-mode
  // DataTable with two editable columns (a built-in `name` text editor + a custom `note`
  // #editor drop-in whose validator ALWAYS rejects), so data-table-grid-rowedit.spec.ts can
  // assert the row-mode validation-failure refocus lands on an ALREADY-MOUNTED drop-in (the
  // lazy-$watch reactive autofocus path) WITHOUT touching DataTableGridRowEditDemo's B21/B22/
  // WR-01 fixture (editorCount===4 / city-is-last assumptions). Behavioral-only; NOT in
  // matrix.spec.ts EXAMPLES (no pixel baseline). Lives under examples/demos/ so no new
  // Angular 3-file registration is needed (prebuildExtraRoots[examplesRoot] + the examples
  // tsconfig include + the glob-driven build-cells demos sweep already cover it).
  'DataTableGridRowEditFocus',
  // Phase 63 Wave-3 (grid-mode clipboard + fill correctness) — the clipboard/fill-cluster
  // RED-first fixture (loader → examples/demos/DataTableGridClipboardDemo.rozie, importing
  // ../../packages/ui/data-table/src/{DataTable,Column}.rozie). ONE grid-mode DataTable with
  // four editable columns (label/qty/cost/city) where row 0's label carries a tab+newline+
  // quote, bound r-model:data + r-model:sorting + r-model:globalFilter, so
  // data-table-grid-clipboard.spec.ts asserts B7 (per-column fill-down + pre-drag origin on an
  // up-drag), B8 (range corners clamp on filter-to-fewer → no phantom copy rows), B9 (paste
  // coerces to the column type — numbers commit as Number, empty as null), B10 (TSV round-trips
  // a tab/newline/quote cell), B11 (Ctrl+C/Ctrl+V are no-ops while a header is active).
  // Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline). Lives under
  // examples/demos/ so no new Angular 3-file registration is needed (prebuildExtraRoots
  // [examplesRoot] + the examples tsconfig include + the glob-driven build-cells demos sweep
  // already cover it, importing the data-table source pkg already registered for Angular
  // cross-tree AOT in phase 48).
  'DataTableGridClipboard',
  // Quick 260709-8ct (grid-wide Undo/Redo) — the RED-first behavioral fixture (loader →
  // examples/demos/DataTableGridUndoDemo.rozie, importing
  // ../../packages/ui/data-table/src/{DataTable,Column}.rozie). TWO grid-mode DataTable
  // instances (a small undoLimit=2 `undoable` instance + an `undoable`-default-off
  // instance) with three editable columns (label/qty/city), r-model:data on each, plus a
  // history-change readout + undo/redo/canUndo/canRedo/clearHistory verb buttons and a
  // swap-data button, so data-table-grid-undo.spec.ts asserts: cell-edit revert, range-clear
  // revert, one-step paste revert, Ctrl+Y/Ctrl+Shift+Z redo, redo-invalidation on a new edit,
  // the undoLimit depth cap, external-swap history clear, undoable=false no-op, and
  // edge-triggered history-change + verb behavior. Behavioral-only; NOT in matrix.spec.ts
  // EXAMPLES (no pixel baseline). Lives under examples/demos/ so no new Angular 3-file
  // registration is needed (prebuildExtraRoots[examplesRoot] + the examples tsconfig include
  // + the glob-driven build-cells demos sweep already cover it, importing the data-table
  // source pkg already registered for Angular cross-tree AOT in phase 48).
  'DataTableGridUndo',
  // Phase 63 Wave-4 (grid-mode nav-edge correctness) — the nav-edge-cluster RED-first
  // fixtures (loaders → examples/demos/DataTableGridEmptyDemo.rozie /
  // DataTableGridGroupedHeaderDemo.rozie, each importing
  // ../../packages/ui/data-table/src/DataTable.rozie). DataTableGridEmpty is the
  // empty/all-filtered grid (a bound r-model:globalFilter shrinks the body to zero rows)
  // so data-table-grid-navedge.spec.ts asserts B6 (the grid keeps exactly one keyboard
  // tab-stop on a header fallback + recovers a body active cell on filter-clear);
  // DataTableGridGroupedHeader declares two 2-level header groups via the :columns
  // grouped-header form so the spec asserts B12 (the roving single-tab-stop invariant
  // holds across parent+leaf header rows + ArrowUp resolves the correct parent header).
  // Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline). They live under
  // examples/demos/ so no new Angular 3-file registration is needed (prebuildExtraRoots
  // [examplesRoot] + the examples tsconfig include + the glob-driven build-cells demos
  // sweep already cover them, importing the data-table source pkg already registered for
  // Angular cross-tree AOT in phase 48).
  'DataTableGridEmpty',
  'DataTableGridGroupedHeader',
  // Phase 63 Wave-5 (grid emit-hygiene / gating / re-focus) — the P2-cluster RED-first
  // fixture (loader → examples/demos/DataTableGridEmitDemo.rozie, importing
  // ../../packages/ui/data-table/src/DataTable.rozie). A grid instance (range selection +
  // fill handle, bound r-model:data + :pagination) plus a sibling TABLE-mode instance so
  // data-table-grid-emit.spec.ts asserts B14 (focusCell no-op suppression), B15
  // (getActiveCell header sentinel), B16 (isGrid-gated table-mode no-op), B17 (PageDown from
  // header lands a deep body cell), B18/B19 (extendRange no-op vs clearRange emit), B20
  // (fill-drag same-cell dedup), B25 (programmatic-shrink focus recovery). Behavioral-only;
  // NOT in matrix.spec.ts EXAMPLES (no pixel baseline). Lives under examples/demos/ so no new
  // Angular 3-file registration is needed (prebuildExtraRoots[examplesRoot] + the examples
  // tsconfig include + the glob-driven build-cells demos sweep already cover it, importing
  // the data-table source pkg already registered for Angular cross-tree AOT in phase 48).
  'DataTableGridEmit',
  // Phase 63 Wave-6 (C1 LOCKED: absolute-index addressing) — the abs-index RED-first fixture
  // (loader → examples/demos/DataTableGridAbsIndexDemo.rozie, importing
  // ../../packages/ui/data-table/src/DataTable.rozie). A paginated grid (pageSize=3, 9 rows =
  // 3 pages, bound r-model:pagination) so data-table-grid-absindex.spec.ts asserts C1
  // (focusCell(7)/getActiveCell()/activecell-change rowIndex is the ABSOLUTE display-order
  // position over getPrePaginationRowModel().rows — paginated focusCell(7) switches to page 3
  // then focuses; the previously page-relative meaning reversed to absolute), the
  // getRowIndexRelativeToPage() converter (abs → page-relative), and B27 (every body row
  // carries aria-rowindex == abs+1 → page 3 rows = aria-rowindex 7/8/9). The virtual half of
  // the cross-mode parity is asserted against the existing DataTableVirtualGrid cell.
  // Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline). Lives under
  // examples/demos/ so no new Angular 3-file registration is needed (prebuildExtraRoots
  // [examplesRoot] + the examples tsconfig include + the glob-driven build-cells demos sweep
  // already cover it, importing the data-table source pkg already registered for Angular
  // cross-tree AOT in phase 48).
  'DataTableGridAbsIndex',
  // Phase 63 Wave-8 (C2 LOCKED: land + treegrid semantics) — the treegrid RED-first
  // fixture (loader → examples/demos/DataTableGroupTreegridDemo.rozie, importing
  // ../../packages/ui/data-table/src/{DataTable,Column}.rozie). A grid (interactionMode=
  // 'grid') grouped by category at mount (r-model:grouping=['category'], 2 groups × 2 leaf
  // rows) so data-table-grid-treegrid.spec.ts asserts C2: the active cell LANDS on the
  // flattened group-header rows (ArrowUp/ArrowDown do not skip them), each group-header
  // <tr> carries role=row + aria-level + aria-expanded reflecting expanded/collapsed, Enter
  // on a group cell toggles the group's collapse, and cross-boundary nav coherence
  // (expanded header → first leaf; first leaf → header; collapsed header → next header).
  // Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline). Lives under
  // examples/demos/ so no new Angular 3-file registration is needed (prebuildExtraRoots
  // [examplesRoot] + the examples tsconfig include + the glob-driven build-cells demos
  // sweep already cover it, importing the data-table source pkg already registered for
  // Angular cross-tree AOT in phase 48).
  'DataTableGroupTreegrid',
  // Quick 260706-h2d — DataTableGroupPlaceholder is the multi-level-grouping
  // placeholder-blank behavioral fixture (loader → examples/demos/
  // DataTableGroupPlaceholderDemo.rozie, importing
  // ../../packages/ui/data-table/src/{DataTable,Column}.rozie). Groups by
  // ['region','city'] so the top-level region group-header row has a genuine
  // PLACEHOLDER cell (the `city` column — a grouping column, but not this row's
  // level); data-table-grid-treegrid.spec.ts asserts it renders blank while
  // aggregated cells still render. Behavioral-only; NOT in matrix.spec.ts EXAMPLES
  // (no pixel baseline). Lives under examples/demos/ so no new Angular 3-file
  // registration is needed (prebuildExtraRoots[examplesRoot] + the examples tsconfig
  // include + the glob-driven build-cells demos sweep already cover it, importing the
  // data-table source pkg already registered for Angular cross-tree AOT in phase 48).
  'DataTableGroupPlaceholder',
  // Phase 63 Wave-7 (B13 LOCKED: full parity — windowed-tbody grouping/expand) — the two
  // virtual+feature RED-first fixtures (loaders → examples/demos/DataTableVirtual{Group,
  // Expand}Demo.rozie, each importing ../../packages/ui/data-table/src/{DataTable,Column}.rozie).
  // DataTableVirtualGroup combines :virtual + maxHeight with :groupable + r-model:grouping so
  // GROUP-HEADER rows (toggle + (n) count + data-group-header/leaf/depth markers + the
  // rdt-group-header class) appear within the windowed <tbody> slice; DataTableVirtualExpand
  // combines :virtual + maxHeight with :expandable (#detail slot + a getSubRows sub-region) so
  // the expander chevron + a #detail <tr> + a depth-1 bodyCellStyle indent appear within the
  // window — so data-table-grid-virtual-parity.spec.ts asserts the windowed body is at full
  // parity with the non-virtual body (B13). Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no
  // pixel baseline). They live under examples/demos/ so no new Angular 3-file registration is
  // needed (prebuildExtraRoots[examplesRoot] + the examples tsconfig include + the glob-driven
  // build-cells demos sweep already cover them, importing the data-table source pkg already
  // registered for Angular cross-tree AOT in phase 48).
  'DataTableVirtualGroup',
  'DataTableVirtualExpand',
  // Phase 63 Wave-10 (C4: RTL logical-nav contract) — the RTL contract-pin fixture
  // (loader → examples/demos/DataTableGridRtlDemo.rozie, importing
  // ../../packages/ui/data-table/src/{DataTable,Column}.rozie). A 3-column grid
  // (interactionMode='grid') wrapped in a dir="rtl" container, so
  // data-table-grid-rtl.spec.ts asserts the arrow nav stays LOGICAL (index-based): from
  // col 0, ArrowRight increments data-col-index to 1 (NO physical flip under rtl),
  // ArrowLeft decrements, Home → col 0, End → last col, and the @activecell-change emit
  // carries the same logical colIndex. The grid nav is purely index-based (no dir/rtl
  // branch), so the contract holds by construction — this cell is the canonical CONTRACT
  // PIN that lands RED if a future change introduced a physical flip. Behavioral-only;
  // NOT in matrix.spec.ts EXAMPLES (no pixel baseline). Lives under examples/demos/ so no
  // new Angular 3-file registration is needed (prebuildExtraRoots[examplesRoot] + the
  // examples tsconfig include + the glob-driven build-cells demos sweep already cover it,
  // importing the data-table source pkg already registered for Angular cross-tree AOT in
  // phase 48).
  'DataTableGridRtl',
  // Phase 50 (data-table TanStack round-out: expandable rows + grouping/aggregation +
  // faceted filtering) WAVE-0 behavioral fixtures (loaders →
  // examples/demos/DataTable{Expand,Group,Facet}Demo.rozie, each importing
  // ../../packages/ui/data-table/src/{DataTable,Column}.rozie). DataTableExpand binds
  // the expand surface (#detail slot + getSubRows nested rows, r-model:expanded,
  // expanded-change, toggleRowExpanded/expandAll/collapseAll/getExpandedRows handles —
  // reqs 1-3); DataTableGroup binds grouping/aggregation (r-model:grouping, headless
  // #groupBar slot with NO drag, aggregationFn='sum' + a custom range fn, grouping-change,
  // applyGrouping/clearGrouping handles — reqs 4-7); DataTableFacet builds a category
  // checkbox facet + numeric range slider PURELY from the exposed uniqueValues/minMax via
  // the #filter slot props + getFacetedUniqueValues/getFacetedMinMaxValues handles, no
  // built-in facet control (reqs 8-9). They reference the expandable/groupable/faceted/
  // getSubRows/aggregationFn props, the #detail/#groupBar/#filter slots, the
  // expanded/grouping model slices, the *-change events, and the new $expose verbs that DO
  // NOT EXIST until Plans 50-02..04 land — today they pass through inert (a harmless ROZ941
  // "slot not declared" warning; the fixtures still render the read-only flat table on all
  // six). Their assertions in data-table-roundout.spec.ts sit behind the runnerFor
  // build-gate until each wave fills them. Behavioral-only; NOT in matrix.spec.ts EXAMPLES
  // (no pixel baseline). They live under examples/demos/ so no new Angular 3-file
  // registration is needed (prebuildExtraRoots[examplesRoot] + the examples tsconfig
  // include + the glob-driven build-cells demos sweep already cover them, importing the
  // data-table source pkg already registered for Angular cross-tree AOT in phase 48).
  'DataTableExpand',
  'DataTableGroup',
  'DataTableFacet',
  // Quick 260622-qpw — the four data-table slot DROP-IN behavioral cells. Each demo
  // imports the real Filter*/GroupBar/DetailPanel/Editor* drop-ins from
  // packages/ui/data-table/src and forwards the verified slot scope as props, proving the
  // drop-ins drive the parent's #filter / #groupBar / #detail / #editor slots at runtime
  // (not just compile) on all six targets. Behavioral-only (DOM assertions in
  // data-table-dropins.spec.ts); NOT in matrix.spec.ts EXAMPLES (no pixel baseline). They
  // live under examples/demos/ so the existing data-table/src cross-tree prebuild root +
  // the examples tsconfig include + the glob-driven demos sweep already cover them (no new
  // Angular 3-file registration needed).
  'DataTableFilterDropins',
  'DataTableGroupBar',
  'DataTableDetailPanel',
  'DataTableEditorDropins',
  // Phase 36 (cross-component-context-primitive, $provide / $inject) — the
  // context-primitive behavioral cells. ThemeContext is the minimal-trio cell
  // (loader → examples/demos/ThemeContextDemo.rozie, which composes three
  // SEPARATELY-COMPILED modules: ThemeProvider $provide('theme', { get color,
  // cycle }) > ThemePassthrough (an UNAWARE <slot/> middle) > ThemeButton
  // $inject('theme')). It proves inject reaches the deep consumer THROUGH the
  // unaware passthrough (R11, cross-file token identity / no-prop-drill) and
  // the click → red→green→blue reactive round-trip (R13). Tabs is the
  // compound-component showcase cell (loader → examples/demos/TabsDemo.rozie,
  // which composes Tabs $provide('tabs', { get active, setActive, register }) +
  // three injected Tab children). Both are BEHAVIORAL cells covered by
  // context-behavior.spec.ts (structural assertions + click round-trip, NO
  // screenshot — macOS/Linux baseline discipline), deliberately NOT in
  // matrix.spec.ts EXAMPLES. The Angular cell renders + round-trips in the real
  // analogjs VR build (REQ-31, first-class — content-projection injector
  // resolution via `providers`). Lit's injected value is async (REQ-30): the
  // spec waits for eventual fill (toBeVisible({ timeout })), not synchronous
  // presence.
  'ThemeContext',
  'Tabs',
  // Phase 60 @rozie-ui pure-Rozie headless families (NO engine) — tags /
  // number-field / pagination. The three BEHAVIORAL cells (loaders →
  // examples/demos/{Tags,NumberField,Pagination}BehaviorDemo.rozie, each importing
  // packages/ui/<family>/src/<Component>.rozie). TagsBehavior drives the token
  // input (two-way r-model:modelValue + @add/@remove + commit/dedup/backspace);
  // NumberFieldBehavior drives the spinbutton (steppers + keyboard + clamp);
  // PaginationBehavior drives the windowed pager (next/prev/goto + aria-current +
  // ellipsis window). See tags/number-field/pagination.spec.ts. Behavioral-only;
  // NOT in matrix.spec.ts EXAMPLES (no pixel baseline).
  'TagsBehavior',
  'NumberFieldBehavior',
  'PaginationBehavior',
  // Phase 60 — the three content-STABLE SCREENSHOT cells (loaders →
  // examples/demos/{Tags,NumberField,Pagination}ScreenshotDemo.rozie). All render
  // INLINE → standard mount-clipped matrix cells (matrix.spec.ts). Each seeds a
  // FIXED deterministic frame (Tags: 3 chips; NumberField: 42; Pagination: page 5
  // of 20 → both ellipses) and auto-fixmes on baselineExists() until the
  // Linux-Docker PNGs land (feedback_vr_linux_baselines). Distinct from *Behavior.
  'TagsScreenshot',
  'NumberFieldScreenshot',
  'PaginationScreenshot',
  // @rozie-ui/switch + popover headless families — the BEHAVIORAL cells (loaders →
  // examples/demos/{Switch,Popover}BehaviorDemo.rozie, each importing
  // packages/ui/<family>/src/<Component>.rozie). SwitchBehavior drives the
  // pure-Rozie WAI-ARIA toggle (two-way r-model:modelValue + @change +
  // click/Space + a sibling DISABLED switch that stays inert); PopoverBehavior
  // drives the @floating-ui/dom click popover (two-way r-model:open + @change +
  // anchor-click open / Escape + outside-click dismissal). See switch/popover.spec.ts.
  // Behavioral-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline). Both
  // families register their src root for the Angular cross-tree AOT prebuild
  // (vite.config.ts + tsconfig.app.json + build-cells.mjs).
  'SwitchBehavior',
  'PopoverBehavior',
  // @rozie-ui/switch + popover SCREENSHOT cells (loaders →
  // examples/demos/{Switch,Popover}ScreenshotDemo.rozie). SwitchScreenshot renders
  // INLINE (3 fixed states: on/off/disabled) → standard mount-clipped matrix cell
  // (matrix.spec.ts). PopoverScreenshot renders the popover OPEN; its floating
  // content is position:absolute and ESCAPES the mount clip → captured PAGE-LEVEL
  // by overlay-screenshot.spec.ts (the Dialog/Toaster precedent). Both auto-fixme
  // on baselineExists() until the Linux-Docker PNGs land (feedback_vr_linux_baselines).
  'SwitchScreenshot',
  'PopoverScreenshot',
  // @rozie-ui/date-picker + resizable + command-palette BEHAVIORAL cells (loaders →
  // examples/demos/{DatePicker,Resizable,CommandPalette}BehaviorDemo.rozie). Each is
  // a self-contained wrapper that seeds its own state in <data> and binds the inner
  // component via r-model. Behavioral-only (no pixel baseline). Each family registers
  // its src root for the Angular cross-tree AOT prebuild (vite.config.ts +
  // tsconfig.app.json + build-cells.mjs).
  'DatePickerBehavior',
  'ResizableBehavior',
  'CommandPaletteBehavior',
  // @rozie-ui/date-picker RANGE-mode cells (loaders →
  // examples/demos/DatePickerRange{Complete,Behavior}Demo.rozie +
  // DatePickerPresetActiveDemo.rozie). DatePickerRangeComplete + DatePickerPresetActive
  // are deterministic INLINE SCREENSHOT cells (a completed cross-month band /
  // an active preset pill) → standard mount-clipped matrix cells (matrix.spec.ts),
  // each auto-fixme on baselineExists() until the Linux-Docker PNGs land
  // (feedback_vr_linux_baselines). DatePickerRangeBehavior is the DRIVEN
  // behavioral cell (forward/backward hover preview, completed-range endpoints,
  // direction-agnostic, preset-active) asserted at the DOM level by
  // specs/date-picker-range-behavior.spec.ts — NO pixel baseline. All three live
  // under examples/demos/ (covered by the date-picker src root already registered
  // for the Angular cross-tree AOT prebuild).
  'DatePickerRangeComplete',
  'DatePickerPresetActive',
  'DatePickerRangeBehavior',
  // @rozie-ui/date-picker NAV + ERGONOMICS cells (Phase 70, loaders →
  // examples/demos/DatePicker{MonthsView,YearsView,TwoMonth,Footer,WeekendDisable,SingleMonth}Demo.rozie).
  // TwoMonth/Footer/WeekendDisable are deterministic INLINE SCREENSHOT cells (2-month
  // layout, footer row, greyed weekends) — they seed their target state on mount →
  // standard mount-clipped matrix cells (matrix.spec.ts), whose Linux baselines landed
  // in Plan 70-05.
  // MonthsView/YearsView/SingleMonth are BEHAVIORAL-ONLY (NO pixel baseline): the
  // months/years DRILL panels sit behind the heading button and cannot be seeded
  // statically (viewMode is private $data, not a prop), so a static shot would only
  // re-capture the default days grid. All six are DRIVEN behavioral targets of
  // specs/date-picker-drill-footer.spec.ts (drill day→month→year, range spanning two
  // months, footer Today/Clear, weekend click-rejection, numberOfMonths=1 DOM shape) —
  // asserted at the DOM level. All live under examples/demos/ (covered by the
  // date-picker src root already registered for the Angular cross-tree AOT prebuild).
  'DatePickerMonthsView',
  'DatePickerYearsView',
  'DatePickerTwoMonth',
  'DatePickerFooter',
  'DatePickerWeekendDisable',
  'DatePickerSingleMonth',
  // @rozie-ui/date-picker + resizable + command-palette SCREENSHOT cells (loaders →
  // examples/demos/{DatePicker,Resizable,CommandPalette}ScreenshotDemo.rozie).
  // DatePickerScreenshot pins value='2025-06-15' (its default month otherwise tracks
  // TODAY) → INLINE month grid → standard mount-clipped matrix cell (matrix.spec.ts).
  // ResizableScreenshot pins :size="50" in a fixed 420x180 box → INLINE → matrix.spec.ts.
  // CommandPaletteScreenshot seeds open=true + a fixed :items list; its overlay is
  // position:fixed and ESCAPES the mount clip → captured PAGE-LEVEL by
  // overlay-screenshot.spec.ts (the Dialog/Toaster/Popover precedent). All auto-fixme
  // on baselineExists() until the Linux-Docker PNGs land (feedback_vr_linux_baselines).
  'DatePickerScreenshot',
  'ResizableScreenshot',
  'CommandPaletteScreenshot',
  // Phase 64 P0 — @rozie-ui/headless-core CROSS-PACKAGE `.rzts` boundary proof
  // (loader → examples/demos/HeadlessCoreSmokeDemo.rozie, which imports the smoke
  // partial via the BARE specifier `@rozie-ui/headless-core/smoke.rzts`). The
  // load-bearing demo that proves a cross-package bare-specifier script-partial
  // inlines + builds + mounts ×6 BEFORE any real windowing/listCore code moves.
  // Behavioral/mount-only; NOT in matrix.spec.ts EXAMPLES (no pixel baseline).
  // headless-core registers its src root for the Angular cross-tree AOT prebuild
  // (vite.config.ts + tsconfig.app.json + build-cells.mjs) per D-08.
  'HeadlessCoreSmoke',
  // Phase 71 (r-keynav compiler-owned keyboard-navigation primitive) — the
  // two fresh proof cells (loaders → examples/demos/Keynav{Menu,Combobox}Demo.rozie).
  // KeynavMenu is the roving-tabindex model (role="menu", five r-keynav-item
  // buttons incl. one disabled, `.loop.typeahead`, active index bound via the
  // co-located-r-for `:source` sugar, DOM focus moves to the active item).
  // KeynavCombobox is the activedescendant model (role="combobox" input +
  // a SEPARATE role="listbox" subtree, DOM focus stays on the input,
  // explicit `:source`, aria-activedescendant tracks the active option) —
  // proving the association is shared-state, not DOM containment (SPEC §7).
  // Both are self-contained (no existing @rozie-ui family touched — the
  // scope fence) and deliberately unwindowed/small-N (Landmine 5). Each
  // doubles as the DOM-driven behavioral cell (keynav-behavior.spec.ts, no
  // screenshot — this is also the Angular real-DOM proof deferred from
  // 71-09) AND a VR pixel-baseline cell (matrix.spec.ts): the default
  // first-paint (active index 0, no interaction) is fully deterministic.
  // No new Angular 3-file registration needed — both live under
  // examples/demos/ (already covered by prebuildExtraRoots[examplesRoot] +
  // the examples tsconfig include + the glob-driven build-cells demos
  // sweep) and import no cross-tree package.
  'KeynavMenu',
  'KeynavCombobox',
] as const;

export type Example = (typeof EXAMPLES)[number];

export const TARGETS = [
  'vue',
  'react',
  'svelte',
  'angular',
  'solid',
  'lit',
] as const;

export type Target = (typeof TARGETS)[number];

/** Kebab-cased `<rozie-*>` custom-element tag for each example (Lit cell). */
export const LIT_TAGS: Record<Example, string> = {
  Counter: 'rozie-counter',
  SearchInput: 'rozie-search-input',
  Dropdown: 'rozie-dropdown',
  TodoList: 'rozie-todo-list',
  Modal: 'rozie-modal',
  TreeNode: 'rozie-tree-node',
  Card: 'rozie-card',
  CardHeader: 'rozie-card-header',
  ModalConsumer: 'rozie-modal-consumer',
  DynamicSlotName: 'rozie-dynamic-slot-name',
  LitScopedFillFirstpaint: 'rozie-lit-scoped-fill-firstpaint',
  PortalList: 'rozie-portal-list',
  FullCalendar: 'rozie-full-calendar',
  LineChart: 'rozie-line-chart',
  CodeMirror: 'rozie-code-mirror',
  // Phase 29 — the lit entry appends '-demo' → tag
  // 'rozie-code-mirror-screenshot-demo' = kebab of CodeMirrorScreenshotDemo.
  CodeMirrorScreenshot: 'rozie-code-mirror-screenshot',
  PortalListStyled: 'rozie-portal-list-styled',
  // Engine-wrapper demos — canonical kebab tag; the lit entry appends `-demo`.
  SortableList: 'rozie-sortable-list',
  SortableListPair: 'rozie-sortable-list-pair',
  SortableListNested: 'rozie-sortable-list-nested',
  SortableListClone: 'rozie-sortable-list-clone',
  SortableListFilter: 'rozie-sortable-list-filter',
  SortableListShowcase: 'rozie-sortable-list-showcase',
  // Quick 260620-o6a — the lit entry appends '-demo' → tag
  // 'rozie-sortable-list-keying-demo' = kebab of SortableListKeyingDemo.
  SortableListKeying: 'rozie-sortable-list-keying',
  Flatpickr: 'rozie-flatpickr',
  LeafletMap: 'rozie-leaflet-map',
  TipTap: 'rozie-tip-tap',
  Uppy: 'rozie-uppy',
  Table: 'rozie-table',
  // Phase 14 ThemedButton dogfood — kebab tag for the Lit cell. The Lit
  // entry will append `-demo` if a `examples/demos/<Name>Demo.rozie` is
  // present; ThemedButtonConsumer is a base example (no `<Name>Demo` sibling),
  // so the loader resolves directly to `examples/ThemedButtonConsumer.rozie`.
  ThemedButtonConsumer: 'rozie-themed-button-consumer',
  // Phase 15 — kebab tags for the three new dogfood fixtures.
  ThemedButtonListenersManual: 'rozie-themed-button-listeners-manual',
  ThemedButtonAllManual: 'rozie-themed-button-all-manual',
  ROnProbe: 'rozie-r-on-probe',
  // Phase 17 — base example, loader resolves examples/PartCardConsumer.rozie.
  PartCardConsumer: 'rozie-part-card-consumer',
  // Phase 21 — $expose dogfood. The Lit cell queries this tag to grab the
  // element handle and call reset() (the external-caller harness).
  ExposeProbe: 'rozie-expose-probe',
  // Quick 260601-x2p — the lit entry appends '-demo' → tag
  // 'rozie-flatpickr-behavior-demo' = kebab of FlatpickrBehaviorDemo.
  FlatpickrBehavior: 'rozie-flatpickr-behavior',
  // Phase 27 — the lit entry appends '-demo' → tag
  // 'rozie-full-calendar-behavior-demo' = kebab of FullCalendarBehaviorDemo.
  FullCalendarBehavior: 'rozie-full-calendar-behavior',
  // Phase 28 — the lit entry appends '-demo' → tags
  // 'rozie-full-calendar-slots-demo' / 'rozie-full-calendar-all-slots-demo' =
  // kebab of FullCalendarSlotsDemo / FullCalendarAllSlotsDemo.
  FullCalendarSlots: 'rozie-full-calendar-slots',
  FullCalendarAllSlots: 'rozie-full-calendar-all-slots',
  // Phase 24 — kebab tag for the r-html fixture (matches the Lit-emitted
  // @customElement('rozie-r-html') in RHtml.lit.ts).
  RHtml: 'rozie-r-html',
  // quick-task 260608-sya — kebab tag for the nullish-attr-drop fixture
  // (matches @customElement('rozie-attr-nullish-drop') in AttrNullishDrop.lit.ts).
  AttrNullishDrop: 'rozie-attr-nullish-drop',
  // Phase 30 (chartjs) — the lit entry appends '-demo' → tags
  // 'rozie-chart-screenshot-demo' / 'rozie-chart-behavior-demo' = kebab of
  // ChartScreenshotDemo / ChartBehaviorDemo.
  ChartScreenshot: 'rozie-chart-screenshot',
  ChartBehavior: 'rozie-chart-behavior',
  // Phase 32 (tiptap) — the lit entry appends '-demo' → tags
  // 'rozie-tip-tap-screenshot-demo' / 'rozie-tip-tap-behavior-demo' = kebab of
  // TipTapScreenshotDemo / TipTapBehaviorDemo.
  TipTapScreenshot: 'rozie-tip-tap-screenshot',
  TipTapBehavior: 'rozie-tip-tap-behavior',
  // Phase 33 — the lit entry appends '-demo' → tags
  // 'rozie-tip-tap-node-view-demo' / 'rozie-tip-tap-node-view-screenshot-demo' =
  // kebab of TipTapNodeViewDemo / TipTapNodeViewScreenshotDemo.
  TipTapNodeView: 'rozie-tip-tap-node-view',
  TipTapNodeViewScreenshot: 'rozie-tip-tap-node-view-screenshot',
  // Phase 35 (maplibre) — the lit entry appends '-demo' → tags
  // 'rozie-map-libre-demo' / 'rozie-map-libre-screenshot-demo' = kebab of
  // MapLibreDemo / MapLibreScreenshotDemo.
  MapLibre: 'rozie-map-libre',
  MapLibreScreenshot: 'rozie-map-libre-screenshot',
  // Phase 37 — the lit entry appends '-demo' → tag
  // 'rozie-map-libre-declarative-demo' = kebab of MapLibreDeclarativeDemo.
  MapLibreDeclarative: 'rozie-map-libre-declarative',
  // Cropper — the lit entry appends '-demo' → tags 'rozie-cropper-demo' /
  // 'rozie-cropper-screenshot-demo' = kebab of CropperDemo / CropperScreenshotDemo.
  Cropper: 'rozie-cropper',
  CropperScreenshot: 'rozie-cropper-screenshot',
  // Waveform — the lit entry appends '-demo' → tag
  // 'rozie-waveform-screenshot-demo' = kebab of WaveformScreenshotDemo.
  WaveformScreenshot: 'rozie-waveform-screenshot',
  // PdfViewer — the lit entry appends '-demo' → tag 'rozie-pdf-viewer-demo' =
  // kebab of PdfViewerDemo (the wrapper component is name="PdfViewer" →
  // 'rozie-pdf-viewer'). Behavioral only — no screenshot cell.
  PdfViewer: 'rozie-pdf-viewer',
  PdfViewerScreenshot: 'rozie-pdf-viewer-screenshot',
  // FlowCanvas — the lit entry appends '-demo' → tags 'rozie-flow-canvas-demo' /
  // 'rozie-flow-canvas-screenshot-demo' = kebab of FlowCanvasDemo /
  // FlowCanvasScreenshotDemo (the wrapper component is name="FlowCanvas" →
  // 'rozie-flow-canvas').
  FlowCanvas: 'rozie-flow-canvas',
  FlowCanvasScreenshot: 'rozie-flow-canvas-screenshot',
  // (FlowCanvasDeclarative RETIRED in 41-04 — see the EXAMPLES note above.)
  // Phase 41 — the lit entry appends '-demo' → tag
  // 'rozie-flow-canvas-advanced-demo' = kebab of FlowCanvasAdvancedDemo.
  FlowCanvasAdvanced: 'rozie-flow-canvas-advanced',
  // Phase 42 minimap cell — '-demo' appended by the entry → 'rozie-flow-canvas-minimap-demo'
  // = kebab of FlowCanvasMinimapDemo.
  FlowCanvasMinimap: 'rozie-flow-canvas-minimap',
  // Phase 43 palette cell — '-demo' appended → 'rozie-flow-canvas-palette-demo'.
  FlowCanvasPalette: 'rozie-flow-canvas-palette',
  // Phase 43 vertical cell — '-demo' appended → 'rozie-flow-canvas-vertical-demo'.
  FlowCanvasVertical: 'rozie-flow-canvas-vertical',
  // Phase 43 edges cell — '-demo' appended → 'rozie-flow-canvas-edges-demo'.
  FlowCanvasEdges: 'rozie-flow-canvas-edges',
  // Phase 44 edge-delete cell — '-demo' appended → 'rozie-flow-canvas-edge-delete-demo'.
  FlowCanvasEdgeDelete: 'rozie-flow-canvas-edge-delete',
  // Phase 44 edge-types cell — '-demo' appended → 'rozie-flow-canvas-edge-types-demo'.
  FlowCanvasEdgeTypes: 'rozie-flow-canvas-edge-types',
  // Phase 44 undo/redo cell — '-demo' appended → 'rozie-flow-canvas-undo-demo'.
  FlowCanvasUndo: 'rozie-flow-canvas-undo',
  // Phase 44 marquee cell — '-demo' appended → 'rozie-flow-canvas-marquee-demo'.
  FlowCanvasMarquee: 'rozie-flow-canvas-marquee',
  // Phase 44 reconnect cell — '-demo' appended → 'rozie-flow-canvas-reconnect-demo'.
  FlowCanvasReconnect: 'rozie-flow-canvas-reconnect',
  // Phase 44 toolbar cell — '-demo' appended → 'rozie-flow-canvas-toolbar-demo'.
  FlowCanvasToolbar: 'rozie-flow-canvas-toolbar',
  // Phase 44 auto-layout cell — '-demo' appended → 'rozie-flow-canvas-arrange-demo'.
  FlowCanvasArrange: 'rozie-flow-canvas-arrange',
  // Phase 44 connect-end cell — '-demo' appended → 'rozie-flow-canvas-connect-end-demo'.
  FlowCanvasConnectEnd: 'rozie-flow-canvas-connect-end',
  // Phase 74 background-variant cell — '-demo' appended → 'rozie-flow-canvas-background-demo'.
  FlowCanvasBackground: 'rozie-flow-canvas-background',
  // Phase 74 NodeResizer cell — '-demo' appended → 'rozie-flow-canvas-resize-demo'.
  FlowCanvasResize: 'rozie-flow-canvas-resize',
  // Embla Carousel — the lit entry appends '-demo' → tags 'rozie-carousel-demo' /
  // 'rozie-carousel-screenshot-demo' = kebab of CarouselDemo / CarouselScreenshotDemo
  // (the wrapper component is name="Carousel" → 'rozie-carousel').
  Carousel: 'rozie-carousel',
  CarouselScreenshot: 'rozie-carousel-screenshot',
  CarouselNavScreenshot: 'rozie-carousel-nav-screenshot',
  // @rozie-ui/listbox — '-demo' appended → tag 'rozie-listbox-behavior-demo' =
  // kebab of ListboxBehaviorDemo (the wrapper component is name="Listbox" →
  // 'rozie-listbox'). Behavioral-only, no screenshot cell.
  ListboxBehavior: 'rozie-listbox-behavior',
  // Phase 64 P4 windowing — '-demo' appended on Lit → tags 'rozie-listbox-virtual-demo'
  // / 'rozie-combobox-virtual-demo' = kebab of {Listbox,Combobox}VirtualDemo.
  ListboxVirtual: 'rozie-listbox-virtual',
  ComboboxVirtual: 'rozie-combobox-virtual',
  // @rozie-ui/slider — '-demo' appended on Lit → tags 'rozie-slider-behavior-demo'
  // etc. = kebab of Slider*Demo (the wrapper component is name="Slider" →
  // 'rozie-slider'). Behavioral-only, no screenshot cell.
  SliderBehavior: 'rozie-slider-behavior',
  SliderRange: 'rozie-slider-range',
  SliderVertical: 'rozie-slider-vertical',
  SliderMarks: 'rozie-slider-marks',
  // @rozie-ui otp/dialog/combobox/toast — '-demo' appended on Lit → tags
  // 'rozie-otp-behavior-demo' etc. The wrapper components are name="Otp"/"Dialog"/
  // "Combobox"/"Toaster" → kebab bases 'rozie-otp'/'rozie-dialog'/'rozie-combobox'/
  // 'rozie-toaster' (toast's component is Toaster). Behavioral-only, no screenshot.
  OtpBehavior: 'rozie-otp-behavior',
  DialogBehavior: 'rozie-dialog-behavior',
  ComboboxBehavior: 'rozie-combobox-behavior',
  ToasterBehavior: 'rozie-toaster-behavior',
  // combobox-native-groups — '-demo' appended on Lit → tag
  // 'rozie-combobox-groups-demo' = kebab of ComboboxGroupsDemo (the wrapper
  // component is name="Combobox" → 'rozie-combobox', matching the *Behavior
  // cell's base). Behavioral-only, no screenshot cell.
  ComboboxGroups: 'rozie-combobox-groups',
  // combobox-group-cap — '-demo' appended on Lit → tag
  // 'rozie-combobox-group-cap-demo' = kebab of ComboboxGroupCapDemo (the wrapper
  // component is name="Combobox" → 'rozie-combobox', matching the *Groups cell's
  // base). Behavioral-only, no screenshot cell.
  ComboboxGroupCap: 'rozie-combobox-group-cap',
  // @rozie-ui otp/dialog/combobox/toast SCREENSHOT cells — '-demo' appended on Lit
  // → tags 'rozie-otp-screenshot-demo' etc. = kebab of the full *ScreenshotDemo
  // name (mirrors CodeMirrorScreenshot / ChartScreenshot).
  OtpScreenshot: 'rozie-otp-screenshot',
  ComboboxScreenshot: 'rozie-combobox-screenshot',
  DialogScreenshot: 'rozie-dialog-screenshot',
  ToasterScreenshot: 'rozie-toaster-screenshot',
  // 'rozie-toaster-stacked-screenshot-demo' = kebab of
  // ToasterStackedScreenshotDemo (the wrapper component is
  // name="ToasterStackedScreenshotDemo").
  ToasterStackedScreenshot: 'rozie-toaster-stacked-screenshot',
  // @rozie-ui/data-table — '-demo' appended on Lit → tags
  // 'rozie-data-table-columns-demo' etc. = kebab of DataTable*Demo (the wrapper
  // components are name="DataTable{Columns,...}Demo"). Behavioral-only, no
  // screenshot cell.
  DataTableColumns: 'rozie-data-table-columns',
  DataTableSort: 'rozie-data-table-sort',
  // Task 1 super-demo scaffold — behavioral-only, no screenshot cell.
  DataTableSuper: 'rozie-data-table-super',
  DataTableFilterPaginate: 'rozie-data-table-filter-paginate',
  DataTableSelection: 'rozie-data-table-selection',
  DataTableColumnMgmt: 'rozie-data-table-column-mgmt',
  DataTableSticky: 'rozie-data-table-sticky',
  // Phase 49 grid-probe — '-demo' appended on Lit → 'rozie-data-table-grid-probe-demo'
  // = kebab of DataTableGridProbeDemo (the component is name="DataTableGridProbeDemo").
  DataTableGridProbe: 'rozie-data-table-grid-probe',
  // Phase 49 grid-nav — '-demo' appended on Lit → 'rozie-data-table-grid-nav-demo'
  // = kebab of DataTableGridNavDemo (the component is name="DataTableGridNavDemo").
  DataTableGridNav: 'rozie-data-table-grid-nav',
  // Phase 53 virtualization — '-demo' appended on Lit → tags
  // 'rozie-data-table-virtual-demo' / 'rozie-data-table-virtual-var-height-demo' =
  // kebab of DataTableVirtualDemo / DataTableVirtualVarHeightDemo.
  DataTableVirtual: 'rozie-data-table-virtual',
  DataTableVirtualVarHeight: 'rozie-data-table-virtual-var-height',
  // = kebab of DataTableVirtualGridDemo (name="DataTableVirtualGridDemo").
  DataTableVirtualGrid: 'rozie-data-table-virtual-grid',
  // = kebab of DataTableVirtualStickySelectDemo (name="DataTableVirtualStickySelectDemo").
  DataTableVirtualStickySelect: 'rozie-data-table-virtual-sticky-select',
  // = kebab of DataTableVirtualWarnDemo (name="DataTableVirtualWarnDemo").
  DataTableVirtualWarn: 'rozie-data-table-virtual-warn',
  // Phase 51 editable cells — '-demo' appended on Lit → tags
  // 'rozie-data-table-pin-probe-demo' / 'rozie-data-table-edit-demo' /
  // 'rozie-data-table-edit-virtual-demo' = kebab of DataTablePinProbeDemo /
  // DataTableEditDemo / DataTableEditVirtualDemo.
  DataTablePinProbe: 'rozie-data-table-pin-probe',
  DataTableEdit: 'rozie-data-table-edit',
  DataTableEditVirtual: 'rozie-data-table-edit-virtual',
  // Phase 63 grid-mode cell-edit — '-demo' appended on Lit →
  // 'rozie-data-table-grid-edit-demo' = kebab of DataTableGridEditDemo.
  DataTableGridEdit: 'rozie-data-table-grid-edit',
  // Phase 63 grid-mode row-edit — '-demo' appended on Lit →
  // 'rozie-data-table-grid-row-edit-demo' = kebab of DataTableGridRowEditDemo.
  DataTableGridRowEdit: 'rozie-data-table-grid-row-edit',
  // Quick 260711-i5m editor-owns-focus contract — '-demo' appended on Lit →
  // 'rozie-data-table-grid-row-edit-focus-demo' = kebab of DataTableGridRowEditFocusDemo.
  DataTableGridRowEditFocus: 'rozie-data-table-grid-row-edit-focus',
  // Phase 63 grid-mode clipboard/fill — '-demo' appended on Lit →
  // 'rozie-data-table-grid-clipboard-demo' = kebab of DataTableGridClipboardDemo.
  DataTableGridClipboard: 'rozie-data-table-grid-clipboard',
  // Quick 260709-8ct grid-wide undo/redo — '-demo' appended on Lit →
  // 'rozie-data-table-grid-undo-demo' = kebab of DataTableGridUndoDemo.
  DataTableGridUndo: 'rozie-data-table-grid-undo',
  // Phase 63 grid-mode nav-edge — '-demo' appended on Lit → tags
  // 'rozie-data-table-grid-empty-demo' / 'rozie-data-table-grid-grouped-header-demo' =
  // kebab of DataTableGridEmptyDemo / DataTableGridGroupedHeaderDemo.
  DataTableGridEmpty: 'rozie-data-table-grid-empty',
  DataTableGridGroupedHeader: 'rozie-data-table-grid-grouped-header',
  // Phase 63 grid emit-hygiene — '-demo' appended on Lit →
  // 'rozie-data-table-grid-emit-demo' = kebab of DataTableGridEmitDemo.
  DataTableGridEmit: 'rozie-data-table-grid-emit',
  // Phase 63 wave-6 abs-index — '-demo' appended on Lit →
  // 'rozie-data-table-grid-abs-index-demo' = kebab of DataTableGridAbsIndexDemo.
  DataTableGridAbsIndex: 'rozie-data-table-grid-abs-index',
  // Phase 63 wave-8 treegrid — '-demo' appended on Lit →
  // 'rozie-data-table-group-treegrid-demo' = kebab of DataTableGroupTreegridDemo.
  DataTableGroupTreegrid: 'rozie-data-table-group-treegrid',
  // Quick 260706-h2d — the lit entry appends '-demo' → tag
  // 'rozie-data-table-group-placeholder-demo' = kebab of DataTableGroupPlaceholderDemo.
  DataTableGroupPlaceholder: 'rozie-data-table-group-placeholder',
  // Phase 63 wave-7 windowed-body parity — '-demo' appended on Lit → tags
  // 'rozie-data-table-virtual-group-demo' / 'rozie-data-table-virtual-expand-demo' =
  // kebab of DataTableVirtualGroupDemo / DataTableVirtualExpandDemo.
  DataTableVirtualGroup: 'rozie-data-table-virtual-group',
  DataTableVirtualExpand: 'rozie-data-table-virtual-expand',
  // Phase 63 wave-10 RTL contract — '-demo' appended on Lit →
  // 'rozie-data-table-grid-rtl-demo' = kebab of DataTableGridRtlDemo.
  DataTableGridRtl: 'rozie-data-table-grid-rtl',
  // Phase 50 round-out — '-demo' appended on Lit → tags
  // 'rozie-data-table-expand-demo' / 'rozie-data-table-group-demo' /
  // 'rozie-data-table-facet-demo' = kebab of DataTableExpandDemo / DataTableGroupDemo /
  // DataTableFacetDemo.
  DataTableExpand: 'rozie-data-table-expand',
  DataTableGroup: 'rozie-data-table-group',
  DataTableFacet: 'rozie-data-table-facet',
  // Quick 260622-qpw drop-in cells — Lit appends '-demo' → tags
  // 'rozie-data-table-filter-dropins-demo' etc. = kebab of the full Demo name.
  DataTableFilterDropins: 'rozie-data-table-filter-dropins',
  DataTableGroupBar: 'rozie-data-table-group-bar',
  DataTableDetailPanel: 'rozie-data-table-detail-panel',
  DataTableEditorDropins: 'rozie-data-table-editor-dropins',
  // Phase 36 ($provide / $inject) — the lit entry appends '-demo' → tags
  // 'rozie-theme-context-demo' / 'rozie-tabs-demo' = kebab of ThemeContextDemo /
  // TabsDemo (the demo wrappers are name="ThemeContextDemo" / "TabsDemo").
  ThemeContext: 'rozie-theme-context',
  Tabs: 'rozie-tabs',
  // Phase 60 pure-Rozie families — '-demo' appended on Lit → tags
  // 'rozie-tags-behavior-demo' etc. = kebab of {Tags,NumberField,Pagination}-
  // {Behavior,Screenshot}Demo. The wrapper components are name="<Name>Demo".
  TagsBehavior: 'rozie-tags-behavior',
  NumberFieldBehavior: 'rozie-number-field-behavior',
  PaginationBehavior: 'rozie-pagination-behavior',
  TagsScreenshot: 'rozie-tags-screenshot',
  NumberFieldScreenshot: 'rozie-number-field-screenshot',
  PaginationScreenshot: 'rozie-pagination-screenshot',
  // @rozie-ui/switch + popover — '-demo' appended on Lit → tags
  // 'rozie-switch-behavior-demo' etc. = kebab of {Switch,Popover}{Behavior,Screenshot}Demo
  // (the wrapper components are name="<Name>Demo").
  SwitchBehavior: 'rozie-switch-behavior',
  PopoverBehavior: 'rozie-popover-behavior',
  SwitchScreenshot: 'rozie-switch-screenshot',
  PopoverScreenshot: 'rozie-popover-screenshot',
  // @rozie-ui/date-picker + resizable + command-palette — '-demo' appended on Lit →
  // tags 'rozie-date-picker-behavior-demo' etc. = kebab of
  // {DatePicker,Resizable,CommandPalette}{Behavior,Screenshot}Demo (the wrapper
  // components are name="<Name>Demo").
  DatePickerBehavior: 'rozie-date-picker-behavior',
  ResizableBehavior: 'rozie-resizable-behavior',
  CommandPaletteBehavior: 'rozie-command-palette-behavior',
  DatePickerScreenshot: 'rozie-date-picker-screenshot',
  ResizableScreenshot: 'rozie-resizable-screenshot',
  CommandPaletteScreenshot: 'rozie-command-palette-screenshot',
  // @rozie-ui/date-picker RANGE-mode cells — '-demo' appended on Lit → tags
  // 'rozie-date-picker-range-complete-demo' etc. = kebab of
  // DatePickerRange{Complete,Behavior}Demo / DatePickerPresetActiveDemo.
  DatePickerRangeComplete: 'rozie-date-picker-range-complete',
  DatePickerPresetActive: 'rozie-date-picker-preset-active',
  DatePickerRangeBehavior: 'rozie-date-picker-range-behavior',
  // @rozie-ui/date-picker NAV + ERGONOMICS cells — '-demo' appended on Lit → tags
  // 'rozie-date-picker-months-view-demo' etc. = kebab of
  // DatePicker{MonthsView,YearsView,TwoMonth,Footer,WeekendDisable,SingleMonth}Demo.
  DatePickerMonthsView: 'rozie-date-picker-months-view',
  DatePickerYearsView: 'rozie-date-picker-years-view',
  DatePickerTwoMonth: 'rozie-date-picker-two-month',
  DatePickerFooter: 'rozie-date-picker-footer',
  DatePickerWeekendDisable: 'rozie-date-picker-weekend-disable',
  DatePickerSingleMonth: 'rozie-date-picker-single-month',
  // Phase 64 P0 — the Lit entry appends '-demo' → tag
  // 'rozie-headless-core-smoke-demo' = kebab of HeadlessCoreSmokeDemo.
  HeadlessCoreSmoke: 'rozie-headless-core-smoke',
  // Phase 71 — the Lit entry appends '-demo' → tags
  // 'rozie-keynav-menu-demo' / 'rozie-keynav-combobox-demo' = kebab of
  // KeynavMenuDemo / KeynavComboboxDemo.
  KeynavMenu: 'rozie-keynav-menu',
  KeynavCombobox: 'rozie-keynav-combobox',
};

export interface HostQuery {
  example: Example;
  target: Target;
}

export const DEFAULT_PROPS: Record<Example, Record<string, unknown>> = {
  Counter: { value: 0, min: 0, max: 10 },
  SearchInput: { placeholder: 'Search...' },
  Dropdown: { open: true },
  // `items` is `model: true` — passing here gives correct first-render
  // state; the rig has no parent listener for `update:items`, so any user
  // interaction inside the component won't persist (acceptable for a
  // screenshot). Shape per template: { id, text, done } — `toggle/remove`
  // look up by id, the row reads `.text`, the strikethrough class reads
  // `.done`. Strings would silently render blank.
  TodoList: {
    items: [
      { id: 't1', text: 'Buy groceries', done: false },
      { id: 't2', text: 'Walk the dog', done: true },
      { id: 't3', text: 'Write the report', done: false },
    ],
    title: 'Todo List',
  },
  Modal: { open: true, title: 'Modal Title' },
  TreeNode: { node: { id: 'root', label: 'Root', children: [
        { id: 'child1', label: 'Child 1', children: [] },
          { id: 'child2', label: 'Child 2', children: [
              { id: 'grandchild1', label: 'Grandchild 1', children: [] },
                { id: 'grandchild2', label: 'Grandchild 2', children: [] },
            ] },
      ] } },
  Card: { title: 'Card Title' },
  CardHeader: { title: 'Card Header' },
  ModalConsumer: { title: 'Confirm action' },
  // Both follow-up demos are self-contained — no props needed; the consumer's
  // `<data>` block holds all reactive state (slotName for DynamicSlotName;
  // none for LitScopedFillFirstpaint).
  DynamicSlotName: {},
  LitScopedFillFirstpaint: {},
  // PortalListDemo carries its item array in <data>; no props needed.
  PortalList: {},
  // FullCalendarDemo carries events + view in <data> and seeds them in
  // `$onMount`; no parent-supplied props needed. (FullCalendar itself
  // has `events`, `view`, `weekends`, etc. props but the demo wrapper is
  // self-contained.)
  FullCalendar: {},
  // LineChartDemo seeds its own state in `<data>` (points array + live-feed
  // flag); the LineChart wrapper itself takes `data` / `options` / `type` /
  // `height` props but the demo wrapper is self-contained.
  LineChart: {},
  // CodeMirrorDemo seeds the `code` string and `theme` in `<data>`; the
  // CodeMirror wrapper itself takes `value` (model: true) / `theme` / etc.
  // but the demo wrapper is self-contained.
  CodeMirror: {},
  // CodeMirrorScreenshotDemo seeds its own FIXED doc string + the screenshotStable
  // theme (via :extensions) inside the demo's <script>; no parent props needed.
  CodeMirrorScreenshot: {},
  // PortalListStyledDemo carries its 4-item array in <data>; no props needed.
  PortalListStyled: {},
  // Engine-wrapper demos — each <Name>Demo carries its reactive state in
  // <data> (and seeds it in `$onMount` where needed); the wrappers themselves
  // expose props, but the demo consumers are self-contained, so `{}`.
  SortableList: {},
  SortableListPair: {},
  SortableListNested: {},
  // SortableList showcase trio — each Demo carries its reactive state in
  // <data> (palette/canvas arrays for Clone, filter+items for Filter, the
  // full control-panel state for Showcase); the wrappers themselves expose
  // props, but the demo consumers are self-contained, so `{}`.
  SortableListClone: {},
  SortableListFilter: {},
  // Quick 260620-o6a — SortableListKeying is self-contained: both lists' id-less
  // object arrays live in the demo's <data> (items / fnItems), seeded in $onMount.
  SortableListKeying: {},
  SortableListShowcase: {},
  Flatpickr: {},
  LeafletMap: {},
  TipTap: {},
  Uppy: {},
  Table: {},
  // ThemedButtonConsumer is self-contained — it forwards a hardcoded set of
  // attributes onto its two ThemedButton wrapper instances (id, aria-*,
  // data-*, type, style="--btn-bg: …", extra class). No parent-side props
  // are needed.
  ThemedButtonConsumer: {},
  // Phase 15 listener-side wrappers + R6 probe. ThemedButtonListenersManual
  // and ThemedButtonAllManual are PRODUCER fixtures (no consumer); each takes
  // a `label` prop. ROnProbe takes no props (single-file probe).
  ThemedButtonListenersManual: { label: 'Listeners Manual' },
  ThemedButtonAllManual: { label: 'All Manual' },
  ROnProbe: {},
  // PartCardConsumer is self-contained — its template hardcodes
  // `<PartCard :title="'Hello'">` and styles it via `PartCard::part(body)`.
  // No parent-side props needed.
  PartCardConsumer: {},
  // ExposeProbe is self-contained — its <data> value drives the input; no
  // parent-side props. The exposed reset()/focus() handle is driven by the
  // per-target VR external-caller shim, not props.
  ExposeProbe: {},
  // Quick 260601-x2p — self-contained; all reactive state lives in the demo's
  // <data> (picked / disableWeekends / lang / rangeValue / rangeEnabled).
  FlatpickrBehavior: {},
  // Phase 27 — self-contained; all reactive state lives in the demo's <data>
  // (view / events / nowIndicator / weekends / lastEvent / apiTitle), seeded in
  // $onMount. The FullCalendar wrapper itself has props, but the demo consumer
  // is self-contained, so {}.
  FullCalendarBehavior: {},
  // Phase 28 — both FullCalendar slot demos are self-contained: all reactive
  // state lives in their <data> (view / events for Slots; view / events /
  // calendarMounted / lastEvent for AllSlots), seeded/bound internally. The
  // demos bind `view` via r-model internally (not parent-supplied), so no
  // MODEL_PROPS entry — matching the existing FullCalendar/FullCalendarBehavior
  // precedent (DEFAULT_PROPS-only, absent from MODEL_PROPS).
  FullCalendarSlots: {},
  FullCalendarAllSlots: {},
  // Phase 24 — RHtml is self-contained: its `content` String prop has a
  // non-empty static-HTML default ('<strong>safe</strong>'), so no parent props
  // are needed for the cell to render visible raw HTML.
  RHtml: {},
  // quick-task 260608-sya — AttrNullishDrop is self-contained ($data cond/maybeNull);
  // no parent-supplied props needed for the cell to render the probe <span>.
  AttrNullishDrop: {},
  // Phase 30 (chartjs) — both Chart demos are self-contained: ChartScreenshot
  // hardcodes its 3 datasets in <script>; ChartBehavior carries chartType +
  // clickCount in <data>. No parent-supplied props.
  ChartScreenshot: {},
  ChartBehavior: {},
  // Phase 32 (tiptap) — both TipTap demos are self-contained: TipTapScreenshot
  // hardcodes its fixed rich doc in <script>; TipTapBehavior seeds its content +
  // out state in <data>. No parent props needed.
  TipTapScreenshot: {},
  TipTapBehavior: {},
  // Phase 33 — both node-view demos are self-contained: each seeds its own
  // fixed/seed doc (with the custom nodes) in <data>/<script> and fills the
  // nodeView slot. No parent props needed.
  TipTapNodeView: {},
  TipTapNodeViewScreenshot: {},
  // Phase 35 — both MapLibre demos are self-contained: MapLibreDemo seeds its
  // center/zoom/markers in <data> and the OFFLINE_STYLE in <script>;
  // MapLibreScreenshotDemo hardcodes the OFFLINE_STYLE + fixed center/zoom in
  // <script>. The demos bind center/zoom via r-model internally (not
  // parent-supplied), so no MODEL_PROPS entry — matching the FullCalendar/
  // CodeMirror precedent. No parent props needed.
  MapLibre: {},
  MapLibreScreenshot: {},
  // Phase 37 — MapLibreDeclarativeDemo is self-contained: it seeds its
  // arraySources/arrayLayers/geojson/circlePaint in <data> and the OFFLINE_STYLE
  // in <script>, and passes center/zoom as static attrs (not r-model). No parent
  // props needed.
  MapLibreDeclarative: {},
  // Cropper — both demos are self-contained: CropperDemo seeds box:undefined in
  // <data> and the SVG data URL + SAMPLE in <script>; CropperScreenshotDemo
  // hardcodes the SVG data URL + FIXED_BOX in <script>. No parent props needed.
  Cropper: {},
  CropperScreenshot: {},
  // PdfViewer — both demos are self-contained: PdfViewerDemo seeds page:1/total:0
  // in <data>; PdfViewerScreenshotDemo hardcodes the bundled workerSrc + SAMPLE
  // base64 PDF + fixed page/scale in <script>. No parent props needed.
  PdfViewer: {},
  PdfViewerScreenshot: {},
  // Phase 41 — both FlowCanvas demos are self-contained: they seed the controlled
  // `graph` (+ zoom / counters) in <data> and bind `r-model:graph` + `r-model:zoom`
  // INTERNALLY (not parent-supplied), so NO MODEL_PROPS entry (the FlowCanvas/MapLibre
  // self-binding precedent — the host supplies no parent graph). No parent props.
  FlowCanvas: {},
  FlowCanvasScreenshot: {},
  // (FlowCanvasDeclarative RETIRED in 41-04 — see the EXAMPLES note above.)
  // Phase 41 — FlowCanvasAdvancedDemo is self-contained: it seeds the controlled
  // `graph` + zoom/lastRejected/acceptedCount in <data>, declares its <NodeType>/<Port>
  // type templates + the canConnect override from its own <script>, and binds
  // r-model:graph + r-model:zoom internally (not parent-supplied), so NO MODEL_PROPS
  // entry (the FlowCanvas/MapLibre precedent). No parent props needed.
  FlowCanvasAdvanced: {},
  // Phase 42 — FlowCanvasMinimapDemo is self-contained (seeds its own controlled graph
  // + :minimap internally), so no parent props (the FlowCanvas/MapLibre precedent).
  FlowCanvasMinimap: {},
  // Phase 43 — FlowCanvasPaletteDemo is self-contained (seeds its own graph). No parent props.
  FlowCanvasPalette: {},
  // Phase 43 — FlowCanvasVerticalDemo is self-contained (seeds its own vertical graph).
  FlowCanvasVertical: {},
  // Phase 43 — FlowCanvasEdgesDemo is self-contained (seeds its own labeled/styled graph).
  FlowCanvasEdges: {},
  // Phase 44 — FlowCanvasEdgeDeleteDemo is self-contained (seeds its own graph + edges).
  FlowCanvasEdgeDelete: {},
  // Phase 44 — FlowCanvasEdgeTypesDemo is self-contained (seeds its own typed-edge graph).
  FlowCanvasEdgeTypes: {},
  // Phase 44 — FlowCanvasUndoDemo is self-contained (seeds its own 2-node graph).
  FlowCanvasUndo: {},
  // Phase 44 — FlowCanvasMarqueeDemo is self-contained (seeds its own graph, drives `mode`
  // internally via r-model:mode + a mode-btn toggle, :marquee ON). No parent props; no
  // MODEL_PROPS entry (mode is bound internally — the FlowCanvas/MapLibre precedent).
  FlowCanvasMarquee: {},
  // Phase 44 — FlowCanvasReconnectDemo is self-contained (seeds its own source→sink graph
  // with a two-input sink + one edge into in1). No parent props; no MODEL_PROPS entry
  // (graph/zoom are bound internally — the FlowCanvas precedent).
  FlowCanvasReconnect: {},
  // Phase 44 — FlowCanvasToolbarDemo is self-contained (seeds its own 2-node graph,
  // :node-toolbar ON internally). No parent props; no MODEL_PROPS entry (graph/zoom bound
  // internally — the FlowCanvas precedent).
  FlowCanvasToolbar: {},
  // Phase 44 — FlowCanvasArrangeDemo is self-contained (seeds its own 2 overlapping nodes;
  // graph/zoom bound internally — the FlowCanvas precedent). No parent props.
  FlowCanvasArrange: {},
  // Phase 44 — FlowCanvasConnectEndDemo is self-contained (seeds its own 1-node graph;
  // graph/zoom bound internally — the FlowCanvas precedent). No parent props.
  FlowCanvasConnectEnd: {},
  // Phase 74 — FlowCanvasBackgroundDemo is self-contained (seeds its own 1-node graph +
  // local `background` state toggled by its own buttons). No parent props; no MODEL_PROPS
  // entry (`background` is one-way, driven internally, not a model).
  FlowCanvasBackground: {},
  // Phase 74 — FlowCanvasResizeDemo is self-contained (seeds its own single resizable
  // node; graph/zoom bound internally — the FlowCanvas precedent). No parent props.
  FlowCanvasResize: {},
  // Embla Carousel — both demos are self-contained: CarouselDemo seeds idx:0 in
  // <data> and SLIDES in <script>; CarouselScreenshotDemo hardcodes SLIDES in
  // <script>. CarouselDemo binds selectedIndex via r-model internally (not
  // parent-supplied), so no MODEL_PROPS entry (the FlowCanvas/MapLibre precedent).
  // No parent props needed.
  Carousel: {},
  CarouselScreenshot: {},
  CarouselNavScreenshot: {},
  // @rozie-ui/listbox — ListboxBehaviorDemo is self-contained: it seeds OPTIONS in
  // <script> + value:null in <data> and binds r-model:value internally (not
  // parent-supplied), so no MODEL_PROPS entry. No parent props needed.
  ListboxBehavior: {},
  // Phase 64 P4 windowing — both VirtualDemos are self-contained: each seeds its own
  // 1,000-option list in $onMount and binds r-model:value internally (not
  // parent-supplied), so no MODEL_PROPS entry. No parent props needed.
  ListboxVirtual: {},
  ComboboxVirtual: {},
  // @rozie-ui/slider — every Slider*Demo is self-contained: it seeds its own value
  // in <data> and binds r-model:value internally (not parent-supplied), so no
  // MODEL_PROPS entry. No parent props needed.
  SliderBehavior: {},
  SliderRange: {},
  SliderVertical: {},
  SliderMarks: {},
  // @rozie-ui otp/dialog/combobox/toast — every *BehaviorDemo is self-contained: it
  // seeds its own state in <data> and binds r-model / drives the $expose handle
  // internally (not parent-supplied), so no MODEL_PROPS entry. No parent props.
  OtpBehavior: {},
  DialogBehavior: {},
  ComboboxBehavior: {},
  ToasterBehavior: {},
  // combobox-native-groups — ComboboxGroupsDemo is self-contained: it seeds its
  // own OPTIONS/GROUPS + <data>.value and binds r-model:value internally (not
  // parent-supplied), so no MODEL_PROPS entry. No parent props.
  ComboboxGroups: {},
  // combobox-group-cap — ComboboxGroupCapDemo is self-contained: it seeds its
  // own OPTIONS/GROUPS + <data>.value and binds r-model:value internally (not
  // parent-supplied), so no MODEL_PROPS entry. No parent props.
  ComboboxGroupCap: {},
  // @rozie-ui otp/dialog/combobox/toast SCREENSHOT cells — every *ScreenshotDemo is
  // self-contained: it seeds its own FIXED state in <data>/<script> and binds
  // r-model / drives the $expose handle internally (not parent-supplied), so no
  // MODEL_PROPS entry. No parent props.
  OtpScreenshot: {},
  ComboboxScreenshot: {},
  DialogScreenshot: {},
  ToasterScreenshot: {},
  // ToasterStackedScreenshotDemo is self-contained too: it seeds its own 4
  // sticky toasts in $onMount and passes `stacked` as a literal template
  // attribute (not parent-supplied), so no MODEL_PROPS entry. No parent props.
  ToasterStackedScreenshot: {},
  // @rozie-ui/data-table — every DataTable*Demo is self-contained: it seeds its
  // own rows + column-declaration in <data>/<components> and binds the state
  // slices via r-model internally (not parent-supplied), so no MODEL_PROPS entry.
  // No parent props needed.
  DataTableColumns: {},
  DataTableSort: {},
  // Task 1 super-demo scaffold — self-contained ($data only). No parent props.
  DataTableSuper: {},
  DataTableFilterPaginate: {},
  DataTableSelection: {},
  DataTableColumnMgmt: {},
  DataTableSticky: {},
  // Phase 49 grid-probe — self-contained ($data only: interactionMode='grid' +
  // the active-cell index pair). No parent-supplied props.
  DataTableGridProbe: {},
  // Phase 49 grid-nav — self-contained ($data only: the rows + sorting + the two
  // readouts). The DataTable instances are mounted inline with their props.
  DataTableGridNav: {},
  // Phase 63 wave-8 treegrid — self-contained ($data only: the rows + grouping model +
  // the readouts). The DataTable is mounted inline with its props.
  DataTableGroupTreegrid: {},
  // Quick 260706-h2d placeholder-blank — self-contained ($data only: rows + grouping
  // model). The DataTable is mounted inline with its props. No parent-supplied props.
  DataTableGroupPlaceholder: {},
  // Phase 53 virtualization — both windowing demos are self-contained: each seeds its
  // own rows in $onMount and passes :virtual + the bounded-container sizing inline
  // (DataTableVirtual via maxHeight prop, DataTableVirtualVarHeight via the
  // --rozie-data-table-max-height token on a wrapper). No parent-supplied props.
  DataTableVirtual: {},
  DataTableVirtualVarHeight: {},
  // Phase 53 plan 04 grid+virtual — self-contained ($data only: 5,000 rows seeded in
  // $onMount + the readouts; the DataTable is mounted inline with its props). No
  // parent-supplied props.
  DataTableVirtualGrid: {},
  DataTableVirtualStickySelect: {},
  DataTableVirtualWarn: {},
  // Phase 63 wave-7 windowed-body parity — both virtual+feature demos are self-contained:
  // each seeds its own rows in $onMount and mounts the DataTable inline with its props. No
  // parent-supplied props.
  DataTableVirtualGroup: {},
  DataTableVirtualExpand: {},
  // Phase 63 wave-10 RTL contract — self-contained ($data only: the rows + the
  // activecell readout). The DataTable is mounted inline with its props inside a
  // dir="rtl" wrapper. No parent-supplied props.
  DataTableGridRtl: {},
  // Phase 50 round-out — all three behavioral demos are self-contained: each seeds its
  // own rows + readouts in <data> and mounts the DataTable inline with its props. No
  // parent-supplied props.
  DataTableExpand: {},
  DataTableGroup: {},
  DataTableFacet: {},
  // Quick 260622-qpw drop-in cells — each demo seeds its own rows + readouts in <data> and
  // mounts the DataTable inline with its props. No parent-supplied props.
  DataTableFilterDropins: {},
  DataTableGroupBar: {},
  DataTableDetailPanel: {},
  DataTableEditorDropins: {},
  // Phase 36 ($provide / $inject) — both context demos are self-contained:
  // ThemeContextDemo composes ThemeProvider/ThemePassthrough/ThemeButton (state
  // lives in ThemeProvider's $data.color); TabsDemo composes Tabs/Tab (state
  // lives in Tabs' $data.active). No parent-supplied props.
  ThemeContext: {},
  Tabs: {},
  // Phase 60 pure-Rozie families — all six demos are self-contained wrappers
  // (each seeds its own state in <data> and binds the inner component via
  // r-model:modelValue). No parent-supplied props.
  TagsBehavior: {},
  NumberFieldBehavior: {},
  PaginationBehavior: {},
  TagsScreenshot: {},
  NumberFieldScreenshot: {},
  PaginationScreenshot: {},
  // @rozie-ui/switch + popover — all four demos are self-contained wrappers (each
  // seeds its own state in <data> and binds the inner component via r-model). No
  // parent-supplied props; no MODEL_PROPS entry (the model is bound internally —
  // the FlowCanvas/MapLibre self-binding precedent).
  SwitchBehavior: {},
  PopoverBehavior: {},
  SwitchScreenshot: {},
  PopoverScreenshot: {},
  // @rozie-ui/date-picker + resizable + command-palette — all six demos are
  // self-contained wrappers (each seeds its own state in <data> and binds the inner
  // component via r-model). No parent-supplied props; no MODEL_PROPS entry (the model
  // is bound internally — the FlowCanvas/MapLibre self-binding precedent).
  DatePickerBehavior: {},
  ResizableBehavior: {},
  CommandPaletteBehavior: {},
  DatePickerScreenshot: {},
  ResizableScreenshot: {},
  CommandPaletteScreenshot: {},
  // @rozie-ui/date-picker RANGE-mode cells — self-contained wrappers (each seeds
  // its own range value + presets in <data> and binds the inner DatePicker via
  // r-model). No parent-supplied props; no MODEL_PROPS entry (the model is bound
  // internally — the self-binding precedent).
  DatePickerRangeComplete: {},
  DatePickerPresetActive: {},
  DatePickerRangeBehavior: {},
  // @rozie-ui/date-picker NAV + ERGONOMICS cells — self-contained wrappers (each
  // seeds its own value in <data> and binds the inner DatePicker via r-model). No
  // parent-supplied props; no MODEL_PROPS entry (the model is bound internally).
  DatePickerMonthsView: {},
  DatePickerYearsView: {},
  DatePickerTwoMonth: {},
  DatePickerFooter: {},
  DatePickerWeekendDisable: {},
  DatePickerSingleMonth: {},
  // Phase 64 P0 — self-contained cross-package boundary demo; no parent-supplied
  // props (the inlined probe is computed in <script>).
  HeadlessCoreSmoke: {},
  // Phase 71 (r-keynav) — both demos are self-contained (ITEMS/RESULTS live
  // in <script>, active index in <data>); no parent-supplied props.
  KeynavMenu: {},
  KeynavCombobox: {},
};

/**
 * `model: true` prop keys per example — the props the host must mount
 * UNCONTROLLED on strict-controllable targets (React, Solid). See
 * `toUncontrolledProps` below. Examples absent from this map have no model
 * prop and are mounted with `DEFAULT_PROPS` verbatim.
 */
export const MODEL_PROPS: Partial<Record<Example, readonly string[]>> = {
  Counter: ['value'],
  Dropdown: ['open'],
  TodoList: ['items'],
  Modal: ['open'],
};

/**
 * Rewrite a `DEFAULT_PROPS` entry so every `model: true` prop is passed via the
 * uncontrolled-default seed prop (`default<Key>` — `defaultValue`, `defaultOpen`,
 * `defaultItems`) instead of its controlled value name.
 *
 * Why: React (`useControllableState`) and Solid (`createControllableSignal`)
 * implement strict Radix-style controllable state — when a controlled value is
 * supplied WITHOUT a change listener, every internal write is silently dropped
 * and the value stays frozen at what the parent passed. The VR host wires no
 * parent listener, so on those two targets Counter/TodoList/Modal/Dropdown are
 * completely inert (TodoList: Add clears the box but appends nothing; toggling
 * a checkbox snaps straight back; Remove does nothing).
 *
 * Mounting uncontrolled hands state ownership to the component itself, so the
 * compare.html 6-up is fully interactive. First paint is identical (the seed
 * value is the same either way), so `matrix.spec.ts` screenshots are unaffected.
 *
 * Both targets emit the same `default<Key>` seed-prop name (the React emitter
 * keys it to the model identifier just like Solid), so this helper is shared
 * verbatim by `entry.react.ts` and `entry.solid.ts`.
 *
 * Vue (`defineModel`) / Svelte (`$bindable`) / Angular (`model()`) keep local
 * state even when the controlled prop is supplied without a listener, so those
 * entries pass `DEFAULT_PROPS` unchanged.
 *
 * Lit is NOT in that list. Its emitted model-prop setter routes through
 * `createLitControllableProperty.notifyPropertyWrite`, which flips the component
 * into strict controlled mode on a `.prop=` write (same as React/Solid) — so a
 * seed supplied without a listener freezes it. It also cannot use this helper:
 * the Lit emitter bakes `defaultValue` into the controllable and emits no
 * `default<Key>` public prop, so a `value`→`defaultValue` remap would drop the
 * seed. `entry.lit.ts` instead keeps `DEFAULT_PROPS` verbatim and wires a
 * per-model-prop `<prop>-change` writeback listener so the host acts as the
 * controlling parent (see the comment there).
 */
export function toUncontrolledProps(
  example: Example,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const modelKeys = MODEL_PROPS[example];
  if (!modelKeys || modelKeys.length === 0) return props;
  const seedKey = (k: string): string =>
    `default${k.charAt(0).toUpperCase()}${k.slice(1)}`;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    out[modelKeys.includes(key) ? seedKey(key) : key] = value;
  }
  return out;
}

/** Parse `?example=&target=` from the current URL, falling back to defaults. */
export function parseQuery(): HostQuery {
  const params = new URLSearchParams(location.search);
  const exampleParam = params.get('example') ?? 'Counter';
  const targetParam = params.get('target') ?? 'vue';
  const example = (EXAMPLES as readonly string[]).includes(exampleParam)
    ? (exampleParam as Example)
    : 'Counter';
  const target = (TARGETS as readonly string[]).includes(targetParam)
    ? (targetParam as Target)
    : 'vue';
  return { example, target };
}

/** The chrome-reset wrapper element Playwright clips its screenshot to. */
export function mountWrapper(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-testid="rozie-mount"]');
  if (!el) {
    throw new Error(
      'visual-regression host: missing [data-testid="rozie-mount"] wrapper',
    );
  }
  return el;
}

/**
 * Phase 21 D-07 — append the ExposeProbe external-caller harness button OUTSIDE
 * `rozie-mount`. The button is VR scaffolding (it drives the grabbed imperative
 * handle), NOT component output, so it MUST live outside the screenshot-clipped
 * mount: keeping it inside coupled the shared matrix baseline to the button's
 * cross-target rendering, and Lit's shadow-DOM custom-element host sized the
 * button row 4px wider than the other 5 targets, breaking the D-10 byte-identity
 * matcher. Appending to `document.body` (a sibling of rozie-mount) keeps it
 * clickable + locatable-by-testid for the behavioral expose-probe.spec while
 * excluding it from `toHaveScreenshot(rozie-mount)`, so the ExposeProbe matrix
 * cell now renders byte-identical across all 6 targets (like SearchInput).
 * Shared across all 6 entry shims so the handle-grab differs per target but the
 * button is identical everywhere.
 */
export function appendExternalCallerButton(onClick: () => void): void {
  const btn = document.createElement('button');
  btn.textContent = 'reset via handle';
  btn.setAttribute('data-testid', 'reset-via-handle');
  btn.addEventListener('click', onClick);
  document.body.appendChild(btn);
}
