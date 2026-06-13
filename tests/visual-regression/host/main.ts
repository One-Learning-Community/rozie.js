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
  // Embla Carousel — the lit entry appends '-demo' → tags 'rozie-carousel-demo' /
  // 'rozie-carousel-screenshot-demo' = kebab of CarouselDemo / CarouselScreenshotDemo
  // (the wrapper component is name="Carousel" → 'rozie-carousel').
  Carousel: 'rozie-carousel',
  CarouselScreenshot: 'rozie-carousel-screenshot',
  // Phase 36 ($provide / $inject) — the lit entry appends '-demo' → tags
  // 'rozie-theme-context-demo' / 'rozie-tabs-demo' = kebab of ThemeContextDemo /
  // TabsDemo (the demo wrappers are name="ThemeContextDemo" / "TabsDemo").
  ThemeContext: 'rozie-theme-context',
  Tabs: 'rozie-tabs',
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
  // Embla Carousel — both demos are self-contained: CarouselDemo seeds idx:0 in
  // <data> and SLIDES in <script>; CarouselScreenshotDemo hardcodes SLIDES in
  // <script>. CarouselDemo binds selectedIndex via r-model internally (not
  // parent-supplied), so no MODEL_PROPS entry (the FlowCanvas/MapLibre precedent).
  // No parent props needed.
  Carousel: {},
  CarouselScreenshot: {},
  // Phase 36 ($provide / $inject) — both context demos are self-contained:
  // ThemeContextDemo composes ThemeProvider/ThemePassthrough/ThemeButton (state
  // lives in ThemeProvider's $data.color); TabsDemo composes Tabs/Tab (state
  // lives in Tabs' $data.active). No parent-supplied props.
  ThemeContext: {},
  Tabs: {},
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
 * Vue (`defineModel`) / Svelte (`$bindable`) / Angular (`model()`) / Lit keep
 * local state even when the controlled prop is supplied without a listener, so
 * those entries pass `DEFAULT_PROPS` unchanged.
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
