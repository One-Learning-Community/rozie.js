// All .rozie snippets the playground exposes in its picker dropdown.
//
// A snippet is a "bundle" — one or more .rozie files keyed by their virtual
// filename. Single-file snippets have one entry whose key matches `entry`.
// Multi-file snippets (e.g. SortableListDemo, which imports SortableList via a
// <components> block) carry the dependency in `files` so the playground's
// virtual-filesystem resolver can satisfy cross-file <components> imports
// without ever touching the real filesystem (the browser doesn't have one).
//
// Sourced from two places:
//   1. examples/*.rozie — top-level reference components (Counter, Modal, etc.)
//   2. examples/demos/*.rozie — composed-feature demos (DropdownDemo, ...)
//
// Multi-file bundles are registered explicitly below — each declares its
// entry file plus every sibling .rozie it imports.

const exampleFiles = import.meta.glob('../../*.rozie', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const demoFiles = import.meta.glob('../../demos/*.rozie', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// examples/match/*.rozie — the r-match feature-probe fixtures. These are
// covered by NEITHER the examples/*.rozie nor examples/demos/*.rozie glob
// (they live in a subdirectory). They are feature probes with verbose header
// comments rather than reference components, so they are NOT surfaced
// wholesale — exactly one is registered explicitly below (MATCH_SNIPPET_PATH)
// to give the playground an r-match demo without cluttering the picker.
const matchFiles = import.meta.glob('../../match/*.rozie', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// packages/ui/<product>/src/*.rozie — canonical `@rozie-ui` product sources.
// `SortableList` moved here from `examples/` in Phase 20-01, so the six
// `bundle/SortableList*` dependency globs resolve their `SortableList.rozie`
// dependency from this map (keyed by the package-source path) — covered by
// NEITHER the examples/*.rozie nor examples/demos/*.rozie glob.
const uiPackageFiles = import.meta.glob('../../../packages/ui/*/src/*.rozie', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// packages/ui/<product>/src/*.{rzts,rzjs} — COMPILE-TIME script partials
// (Phase 54). Unlike `.rozie` siblings, a `.rzts`/`.rzjs` partial is NOT a
// standalone component: @rozie/core's `inlineScriptPartials` INLINES its
// exported declarations into the importing host `<script>` BEFORE IR lowering,
// so the compiled leaf carries ZERO runtime import to the partial. They must
// therefore be present in the compile VFS keyed by the specifier the resolver
// produces, but must NEVER enter a bundle's `files` map (which would double-
// compile them through the sibling loop as if they were components).
//
// The virtualized pure-Rozie families (combobox/listbox/command-palette) and
// HeadlessCoreSmokeDemo import cross-package partials via a BARE specifier
// (`@rozie-ui/headless-core/windowing.rzts`). The glob captures every package's
// partials; `PARTIAL_SOURCES` re-keys each to its `@rozie-ui/<pkg>/<name>` bare
// specifier so compile.ts can seed them into `globalThis.__rozieVfs`.
const partialFiles = import.meta.glob('../../../packages/ui/*/src/*.{rzts,rzjs}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// packages/ui/<product>/src/internal/*.ts — PLAIN relative TS helper modules
// (Phase 68-03). UNLIKE the `.rzts`/`.rzjs` partials above (which @rozie/core
// INLINES at compile time so the leaf carries zero import), a family's
// `<script>` imports these as an ordinary RUNTIME relative specifier
// (`import { buildMonthGrid } from './internal/buildMonthGrid'`). The emitted
// leaf therefore keeps that import, and the helper must reach the iframe as a
// transformed blob SIBLING — never through the Rozie compiler. They enter a
// bundle's `files` map keyed by their basename-WITH-`.ts`, so compile.ts's
// sibling loop can spot them (non-`.rozie` → passthrough) and hand them over raw.
// Colocated `*.test.ts` unit tests are excluded (codegen also vendors internal/
// into leaves excluding tests).
const internalHelperGlob = import.meta.glob('../../../packages/ui/*/src/internal/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const internalHelperFiles: Record<string, string> = Object.fromEntries(
  Object.entries(internalHelperGlob).filter(([path]) => !path.endsWith('.test.ts')),
);

/**
 * Compile-time `.rzts`/`.rzjs` script partials, keyed by their cross-package
 * bare specifier (`@rozie-ui/<pkg>/<name>.rzts`). Derived from the on-disk
 * glob path `../../../packages/ui/<pkg>/src/<name>.rzts`.
 *
 * compile.ts seeds these into the VFS under `/vfs/<specifier>` — which is
 * exactly the path the playground's `enhanced-resolve` shim computes for a bare
 * `@rozie-ui/headless-core/windowing.rzts` import from a `/vfs/*.rozie` host
 * (`joinPath('/vfs', spec)` → `/vfs/@rozie-ui/headless-core/windowing.rzts`,
 * hit as the literal candidate). @rozie/core then `readFileSync`s that same key
 * from the VFS and inlines the partial. NOT part of any bundle's `files` map,
 * so the sibling-compile loop never touches them.
 */
export const PARTIAL_SOURCES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [path, source] of Object.entries(partialFiles)) {
    const m = path.match(/packages\/ui\/([^/]+)\/src\/(.+\.(?:rzts|rzjs))$/);
    if (m) out[`@rozie-ui/${m[1]}/${m[2]}`] = source;
  }
  return out;
})();

export interface Snippet {
  /** Display label shown in the dropdown. */
  label: string;
  /** Stable key used as the option value. */
  key: string;
  /** Entry .rozie filename (relative, e.g. `SortableListDemo.rozie`). */
  entry: string;
  /**
   * Virtual filesystem for this bundle — filename → source. For single-file
   * snippets this map has exactly one entry whose key matches `entry`.
   * Multi-file snippets include every sibling .rozie the entry imports via
   * a `<components>` block.
   */
  files: Record<string, string>;
  /**
   * D-2 "unsupported-with-reason". When set, the family compiles cleanly (the
   * Output pane still shows its emitted code) but cannot yet LIVE-RENDER in the
   * iframe because of a harness gap (unwired engine lib, `.rzts`/`./internal`
   * partial not yet in the VFS, portal/CSS/Solid limit). The picker appends an
   * "unsupported" marker and the preview short-circuits to `reason` INSTEAD of a
   * raw ROZ945 / blank-cell failure. Driven by the `UNSUPPORTED` registry below;
   * later plans remove entries as each gap is closed.
   */
  unsupported?: { reason: string };
}

function basename(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.rozie$/, '');
}

function filenameFromGlob(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Make a single-file snippet bundle from a globbed example/demo entry. */
function singleFileSnippet(
  path: string,
  source: string,
  prefix: string,
): Snippet {
  const filename = filenameFromGlob(path);
  const name = basename(path);
  return {
    key: prefix ? `${prefix}/${name}` : name,
    label: prefix ? `${prefix}/${name}` : name,
    entry: filename,
    files: { [filename]: source },
  };
}

/**
 * Multi-file bundle declarations — each lists the entry file's path under
 * exampleFiles and the sibling dependency paths. The bundle's `files` map
 * keys by the filename (no path prefix) so `<components>` imports like
 * `'./SortableList.rozie'` resolve against the virtual /vfs/ root.
 */
interface BundleDecl {
  key: string;
  label: string;
  entryGlobPath: string;
  dependencyGlobPaths: string[];
}

const BUNDLE_DECLS: readonly BundleDecl[] = [
  {
    key: 'bundle/SortableListDemo',
    label: 'bundle/SortableListDemo',
    entryGlobPath: '../../demos/SortableListDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/sortable-list/src/SortableList.rozie'],
  },
  {
    // SortableListPairDemo — two SortableList instances sharing a group;
    // drag between to move items, both bound arrays update via SortableList's
    // onAdd / onRemove cluster + module-level transfer slot.
    key: 'bundle/SortableListPairDemo',
    label: 'bundle/SortableListPairDemo',
    entryGlobPath: '../../demos/SortableListPairDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/sortable-list/src/SortableList.rozie'],
  },
  {
    // SortableListNestedDemo — Kanban-style board. Outer SortableList of
    // columns hosts inner KanbanColumn wrappers, each owning its own
    // SortableList of cards. Outer + inner use distinct groups so column
    // reorder and card reorder don't bleed into each other.
    key: 'bundle/SortableListNestedDemo',
    label: 'bundle/SortableListNestedDemo',
    entryGlobPath: '../../demos/SortableListNestedDemo.rozie',
    dependencyGlobPaths: [
      '../../../packages/ui/sortable-list/src/SortableList.rozie',
      '../../KanbanColumn.rozie',
    ],
  },
  {
    // SortableListCloneDemo — palette → canvas clone-mode showcase. Two
    // SortableList instances sharing `group="palette-canvas"`; the palette
    // uses the new `cloneable: true` prop so drags deposit copies on the
    // canvas while leaving the palette intact.
    key: 'bundle/SortableListCloneDemo',
    label: 'bundle/SortableListCloneDemo',
    entryGlobPath: '../../demos/SortableListCloneDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/sortable-list/src/SortableList.rozie'],
  },
  {
    // SortableListFilterDemo — SortableJS `filter` selector demo. Locked
    // rows render with 🔒 + a `[data-locked]` attribute; the `filter`
    // prop prevents drag initiation on matching rows.
    key: 'bundle/SortableListFilterDemo',
    label: 'bundle/SortableListFilterDemo',
    entryGlobPath: '../../demos/SortableListFilterDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/sortable-list/src/SortableList.rozie'],
  },
  {
    // SortableListShowcaseDemo — the marquee piece. Live-tunable
    // SortableList with every prop exposed via a control panel; uses
    // `:key="`${$data.forceFallback}-${$data.cloneable}-${$data.swapThreshold}`"`
    // to remount on construction-time-only knob changes.
    key: 'bundle/SortableListShowcaseDemo',
    label: 'bundle/SortableListShowcaseDemo',
    entryGlobPath: '../../demos/SortableListShowcaseDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/sortable-list/src/SortableList.rozie'],
  },
  {
    key: 'bundle/FlatpickrDemo',
    label: 'bundle/FlatpickrDemo',
    entryGlobPath: '../../demos/FlatpickrDemo.rozie',
    // `Flatpickr` moved into the @rozie-ui/flatpickr package; resolve its
    // canonical `.rozie` from the package src (cf. the SortableList* bundles).
    dependencyGlobPaths: ['../../../packages/ui/flatpickr/src/Flatpickr.rozie'],
  },
  {
    key: 'bundle/FlatpickrBehaviorDemo',
    label: 'bundle/FlatpickrBehaviorDemo',
    entryGlobPath: '../../demos/FlatpickrBehaviorDemo.rozie',
    // Same `Flatpickr` package-src resolution as bundle/FlatpickrDemo — the
    // behavioral demo exercises GAP-2/3/4 (:disable / :locale / :plugins).
    dependencyGlobPaths: ['../../../packages/ui/flatpickr/src/Flatpickr.rozie'],
  },
  {
    key: 'bundle/LeafletMapDemo',
    label: 'bundle/LeafletMapDemo',
    entryGlobPath: '../../demos/LeafletMapDemo.rozie',
    dependencyGlobPaths: ['../../LeafletMap.rozie'],
  },
  {
    key: 'bundle/LineChartDemo',
    label: 'bundle/LineChartDemo',
    entryGlobPath: '../../demos/LineChartDemo.rozie',
    // Phase 30 — the generic Chart wrapper moved into @rozie-ui/chartjs (was
    // ../../LineChart.rozie). KEEP-THE-URL: snippet key stays bundle/LineChartDemo.
    dependencyGlobPaths: ['../../../packages/ui/chartjs/src/Chart.rozie'],
  },
  {
    key: 'bundle/TipTapDemo',
    label: 'bundle/TipTapDemo',
    entryGlobPath: '../../demos/TipTapDemo.rozie',
    // Phase 32 — TipTap.rozie moved into @rozie-ui/tiptap (was ../../TipTap.rozie).
    // KEEP-THE-URL: snippet key stays bundle/TipTapDemo.
    dependencyGlobPaths: ['../../../packages/ui/tiptap/src/TipTap.rozie'],
  },
  {
    key: 'bundle/UppyDemo',
    label: 'bundle/UppyDemo',
    entryGlobPath: '../../demos/UppyDemo.rozie',
    dependencyGlobPaths: ['../../Uppy.rozie'],
  },
  {
    key: 'bundle/FullCalendarDemo',
    label: 'bundle/FullCalendarDemo',
    entryGlobPath: '../../demos/FullCalendarDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/fullcalendar/src/FullCalendar.rozie'],
  },
  {
    // Phase 35 — the MapLibre wrapper lives in @rozie-ui/maplibre
    // (packages/ui/maplibre/src/MapLibre.rozie). The demo entry
    // (demos/MapLibreDemo.rozie) is a minimal consumer:
    // <MapLibre r-model:center r-model:zoom :map-style :controls> with a marker
    // slot. KEEP-THE-URL: snippet key stays bundle/MapLibreDemo. The decl
    // gracefully no-ops (the bundle is skipped) until the demo entry exists.
    key: 'bundle/MapLibreDemo',
    label: 'bundle/MapLibreDemo',
    entryGlobPath: '../../demos/MapLibreDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/maplibre/src/MapLibre.rozie'],
  },
  {
    // Phase 41 — the CONTROLLED-GRAPH typed-pipeline advanced demo for
    // @rozie-ui/rete. The consumer binds ONE `r-model:graph` object (the single
    // source of truth) and declares a couple of `<NodeType type>` TYPE TEMPLATES
    // with nested typed `<Port output=|input= type=>` ports — nothing else. The
    // canvas owns the flow middleware: render-by-type, drag/connect/disconnect
    // write-back into the bound graph, and automatic typed-socket validation
    // (`:validate-types`, default ON) with `canConnect` as the optional override.
    // Dan's multi-port ask falls out of the per-type schema: a `source` type with
    // BOTH a number AND a string OUTPUT port, a `merge` type with BOTH a number AND
    // a string INPUT port (number=blue / string=green typed-port colors). The
    // FlowCanvas/NodeType/Port wrappers live in @rozie-ui/rete
    // (packages/ui/rete/src/*.rozie).
    key: 'bundle/FlowCanvasAdvancedDemo',
    label: 'bundle/FlowCanvasAdvancedDemo',
    entryGlobPath: '../../demos/FlowCanvasAdvancedDemo.rozie',
    dependencyGlobPaths: [
      '../../../packages/ui/rete/src/FlowCanvas.rozie',
      '../../../packages/ui/rete/src/NodeType.rozie',
      '../../../packages/ui/rete/src/Port.rozie',
    ],
  },

  // ---------------------------------------------------------------------------
  // Phase 68-01 — the 11 dependency-free PURE-ROZIE families (no vanilla-JS
  // engine). Each demo's `<components>` block imports exactly one sibling from
  // `packages/ui/<fam>/src`, already covered by the `uiPackageFiles` glob. All
  // 11 compile ×6 with zero error diagnostics (see scripts/verify-coverage.mjs).
  //
  // Seven live-render immediately (dialog/slider/tags/switch/otp/number-field/
  // toast). Four (date-picker/pagination/popover/resizable) COMPILE clean but
  // emit a `./internal/*` helper import the iframe VFS can't resolve yet — they
  // are marked unsupported-with-reason in the UNSUPPORTED registry below
  // (render pending 68-03), never left to fail with a raw error.
  // ---------------------------------------------------------------------------
  {
    key: 'bundle/DialogBehaviorDemo',
    label: 'bundle/DialogBehaviorDemo',
    entryGlobPath: '../../demos/DialogBehaviorDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/dialog/src/Dialog.rozie'],
  },
  {
    key: 'bundle/SliderBehaviorDemo',
    label: 'bundle/SliderBehaviorDemo',
    entryGlobPath: '../../demos/SliderBehaviorDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/slider/src/Slider.rozie'],
  },
  {
    key: 'bundle/TagsBehaviorDemo',
    label: 'bundle/TagsBehaviorDemo',
    entryGlobPath: '../../demos/TagsBehaviorDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/tags/src/Tags.rozie'],
  },
  {
    key: 'bundle/SwitchBehaviorDemo',
    label: 'bundle/SwitchBehaviorDemo',
    entryGlobPath: '../../demos/SwitchBehaviorDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/switch/src/Switch.rozie'],
  },
  {
    key: 'bundle/OtpBehaviorDemo',
    label: 'bundle/OtpBehaviorDemo',
    entryGlobPath: '../../demos/OtpBehaviorDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/otp/src/Otp.rozie'],
  },
  {
    key: 'bundle/NumberFieldBehaviorDemo',
    label: 'bundle/NumberFieldBehaviorDemo',
    entryGlobPath: '../../demos/NumberFieldBehaviorDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/number-field/src/NumberField.rozie'],
  },
  {
    key: 'bundle/ToasterBehaviorDemo',
    label: 'bundle/ToasterBehaviorDemo',
    entryGlobPath: '../../demos/ToasterBehaviorDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/toast/src/Toaster.rozie'],
  },
  {
    // Phase 68-03 — its `./internal/buildMonthGrid` helper is now carried as a
    // passthrough blob sibling, so all six targets live-render (un-marked).
    key: 'bundle/DatePickerBehaviorDemo',
    label: 'bundle/DatePickerBehaviorDemo',
    entryGlobPath: '../../demos/DatePickerBehaviorDemo.rozie',
    dependencyGlobPaths: [
      '../../../packages/ui/date-picker/src/DatePicker.rozie',
      '../../../packages/ui/date-picker/src/internal/buildMonthGrid.ts',
    ],
  },
  {
    // Phase 68-03 — `./internal/paginationItems` now a passthrough blob sibling.
    key: 'bundle/PaginationBehaviorDemo',
    label: 'bundle/PaginationBehaviorDemo',
    entryGlobPath: '../../demos/PaginationBehaviorDemo.rozie',
    dependencyGlobPaths: [
      '../../../packages/ui/pagination/src/Pagination.rozie',
      '../../../packages/ui/pagination/src/internal/paginationItems.ts',
    ],
  },
  {
    // Phase 68-03 — `./internal/middleware` is now wired as a passthrough blob
    // sibling, BUT the Popover component ALSO emits a runtime `@floating-ui/dom`
    // engine import that is not in the harness importmaps — so this family stays
    // marked unsupported (engine-importmap wiring pending 68-04). The internal
    // helper is declared here so it renders the moment the engine lands.
    key: 'bundle/PopoverBehaviorDemo',
    label: 'bundle/PopoverBehaviorDemo',
    entryGlobPath: '../../demos/PopoverBehaviorDemo.rozie',
    dependencyGlobPaths: [
      '../../../packages/ui/popover/src/Popover.rozie',
      '../../../packages/ui/popover/src/internal/middleware.ts',
    ],
  },
  {
    // Phase 68-03 — `./internal/resizeMath` now a passthrough blob sibling.
    key: 'bundle/ResizableBehaviorDemo',
    label: 'bundle/ResizableBehaviorDemo',
    entryGlobPath: '../../demos/ResizableBehaviorDemo.rozie',
    dependencyGlobPaths: [
      '../../../packages/ui/resizable/src/Resizable.rozie',
      '../../../packages/ui/resizable/src/internal/resizeMath.ts',
    ],
  },

  // ---------------------------------------------------------------------------
  // Phase 68-02 — the `.rzts`/`.rzjs` script-partial-consuming families. Each
  // imports cross-package `@rozie-ui/headless-core/{listCore,windowing,smoke}.rzts`
  // partials that @rozie/core INLINES at compile time; the playground now globs
  // those partials into the compile VFS (see PARTIAL_SOURCES + compile.ts's
  // seedPartials), so all four compile ×6 with zero error diagnostics.
  //
  // HeadlessCoreSmokeDemo LIVE-RENDERS immediately: its only dep is the inlined
  // smoke.rzts partial (`probe = headlessCoreSmoke(41)` → 42), so the rendered
  // cell proves the cross-package partial-inline path end-to-end with no engine.
  //
  // Combobox / Listbox / CommandPalette compile ×6 clean, but their SIBLING
  // components emit an unconditional runtime `@tanstack/virtual-core` import (the
  // windowing engine) — and CommandPalette additionally emits a `./internal/
  // filterCommands` runtime helper — neither yet in the harness importmap / VFS.
  // They stay marked unsupported-with-reason (render pending the engine-importmap
  // wiring in 68-04 and the internal-helper VFS wiring in 68-03), never silent.
  // ---------------------------------------------------------------------------
  {
    // Single-file demo: its only dep is the compile-time smoke.rzts partial,
    // VFS-seeded globally by seedPartials — so no `.rozie` sibling to declare.
    key: 'bundle/HeadlessCoreSmokeDemo',
    label: 'bundle/HeadlessCoreSmokeDemo',
    entryGlobPath: '../../demos/HeadlessCoreSmokeDemo.rozie',
    dependencyGlobPaths: [],
  },
  {
    key: 'bundle/ComboboxBehaviorDemo',
    label: 'bundle/ComboboxBehaviorDemo',
    entryGlobPath: '../../demos/ComboboxBehaviorDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/combobox/src/Combobox.rozie'],
  },
  {
    key: 'bundle/ListboxVirtualDemo',
    label: 'bundle/ListboxVirtualDemo',
    entryGlobPath: '../../demos/ListboxVirtualDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/listbox/src/Listbox.rozie'],
  },
  {
    // CommandPalette composes @rozie-ui/combobox/Combobox.rozie via <components>;
    // the command-palette package vendors its OWN Combobox.rozie sibling (the
    // specifier resolves by basename in the flat VFS), so BOTH are declared.
    key: 'bundle/CommandPaletteBehaviorDemo',
    label: 'bundle/CommandPaletteBehaviorDemo',
    entryGlobPath: '../../demos/CommandPaletteBehaviorDemo.rozie',
    dependencyGlobPaths: [
      '../../../packages/ui/command-palette/src/CommandPalette.rozie',
      '../../../packages/ui/command-palette/src/Combobox.rozie',
      // Phase 68-03 — its `./internal/filterCommands` helper is carried as a
      // passthrough blob sibling; Phase 68-04 added @tanstack/virtual-core to the
      // harness importmaps, so the vendored Combobox's windowing engine now
      // resolves and CommandPalette live-renders (un-marked).
      '../../../packages/ui/command-palette/src/internal/filterCommands.ts',
    ],
  },

  // ---------------------------------------------------------------------------
  // Phase 68-04 — WS1 SC-1: the single-engine-library families. Each demo's
  // `<components>` block imports exactly one sibling from `packages/ui/<fam>/src`
  // (already covered by `uiPackageFiles`); the engine libs those siblings import
  // at runtime (embla-carousel[+autoplay], the @codemirror/* set + codemirror,
  // cropperjs, pdfjs-dist) were added to all six harness importmaps in this plan.
  // Every demo VARIANT (incl. the *ScreenshotDemo fixtures) is bundled here so
  // un-marking the family token never leaves a screenshot demo silently blank.
  //
  // embla / codemirror / cropper LIVE-RENDER (every emitted runtime import now
  // resolves; cropper additionally needs the external `cropper.css` `<link>`
  // added to each harness `<head>`). pdf compiles ×6 and its `pdfjs-dist` dynamic
  // import resolves, but its PDF.js web worker (a cross-origin jsDelivr worker
  // URL) is not loadable from the sandboxed null-origin preview iframe — it stays
  // marked unsupported-with-reason (D-2). captcha has NO examples/demos entry, so
  // its package `Captcha.rozie` IS the bundle entry; it loads an EXTERNAL provider
  // script and its `sitekey` is required with no valid sample, so it cannot render
  // in a sandboxed iframe and is marked unsupported-with-reason immediately (D-2).
  // ---------------------------------------------------------------------------
  {
    key: 'bundle/CarouselDemo',
    label: 'bundle/CarouselDemo',
    entryGlobPath: '../../demos/CarouselDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/embla/src/Carousel.rozie'],
  },
  {
    key: 'bundle/CarouselScreenshotDemo',
    label: 'bundle/CarouselScreenshotDemo',
    entryGlobPath: '../../demos/CarouselScreenshotDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/embla/src/Carousel.rozie'],
  },
  {
    key: 'bundle/CarouselNavScreenshotDemo',
    label: 'bundle/CarouselNavScreenshotDemo',
    entryGlobPath: '../../demos/CarouselNavScreenshotDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/embla/src/Carousel.rozie'],
  },
  {
    key: 'bundle/CodeMirrorDemo',
    label: 'bundle/CodeMirrorDemo',
    entryGlobPath: '../../demos/CodeMirrorDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/codemirror/src/CodeMirror.rozie'],
  },
  {
    key: 'bundle/CodeMirrorScreenshotDemo',
    label: 'bundle/CodeMirrorScreenshotDemo',
    entryGlobPath: '../../demos/CodeMirrorScreenshotDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/codemirror/src/CodeMirror.rozie'],
  },
  {
    key: 'bundle/CropperDemo',
    label: 'bundle/CropperDemo',
    entryGlobPath: '../../demos/CropperDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/cropper/src/Cropper.rozie'],
  },
  {
    key: 'bundle/CropperScreenshotDemo',
    label: 'bundle/CropperScreenshotDemo',
    entryGlobPath: '../../demos/CropperScreenshotDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/cropper/src/Cropper.rozie'],
  },
  {
    // pdf compiles ×6 + its pdfjs-dist dynamic import resolves, but the PDF.js
    // web worker can't load in the sandboxed iframe → marked unsupported (below).
    key: 'bundle/PdfViewerDemo',
    label: 'bundle/PdfViewerDemo',
    entryGlobPath: '../../demos/PdfViewerDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/pdf/src/PdfViewer.rozie'],
  },
  {
    key: 'bundle/PdfViewerScreenshotDemo',
    label: 'bundle/PdfViewerScreenshotDemo',
    entryGlobPath: '../../demos/PdfViewerScreenshotDemo.rozie',
    dependencyGlobPaths: ['../../../packages/ui/pdf/src/PdfViewer.rozie'],
  },
  {
    // captcha has NO examples/demos wrapper — the package `Captcha.rozie` is the
    // bundle entry directly (resolvable via `uiPackageFiles`). Its `RecaptchaV3`
    // sibling + the `./internal/*` runtime helpers are declared so the bundle is
    // complete; it is marked unsupported-with-reason (external provider script +
    // required site key + non-sandboxed origin) — it does NOT render.
    key: 'bundle/Captcha',
    label: 'bundle/Captcha',
    entryGlobPath: '../../../packages/ui/captcha/src/Captcha.rozie',
    dependencyGlobPaths: [
      '../../../packages/ui/captcha/src/RecaptchaV3.rozie',
      '../../../packages/ui/captcha/src/internal/loadCaptchaApi.ts',
      '../../../packages/ui/captcha/src/internal/loadRecaptchaV3.ts',
    ],
  },
];

// Bundle entry/dep paths can resolve against either glob root: top-level
// `examples/*.rozie` (the original convention) OR `examples/demos/*.rozie`
// (the VR-rig convention for demo wrappers that import a sibling
// `<components>` engine). Look up against both maps so a bundle whose
// entry lives under demos/ — like FullCalendarDemo and LineChartDemo —
// resolves regardless of where future demos land.
function lookupRozieSource(path: string): string | undefined {
  return (
    exampleFiles[path] ??
    demoFiles[path] ??
    uiPackageFiles[path] ??
    // Phase 68-03 — plain relative `.ts` helpers imported by a family's
    // `<script>` (`./internal/<name>`). Resolved here so a bundle decl can list
    // the helper as a `dependencyGlobPaths` entry; it lands in `files` keyed by
    // `<name>.ts` and compile.ts routes it to the passthrough-sibling branch.
    internalHelperFiles[path]
  );
}

function bundleSnippetFromDecl(decl: BundleDecl): Snippet | null {
  const entrySource = lookupRozieSource(decl.entryGlobPath);
  if (entrySource === undefined) return null;
  const files: Record<string, string> = {
    [filenameFromGlob(decl.entryGlobPath)]: entrySource,
  };
  for (const depPath of decl.dependencyGlobPaths) {
    const depSource = lookupRozieSource(depPath);
    if (depSource === undefined) {
      // Missing dependency — skip the bundle rather than emit a half-broken one.
      return null;
    }
    files[filenameFromGlob(depPath)] = depSource;
  }
  return {
    key: decl.key,
    label: decl.label,
    entry: filenameFromGlob(decl.entryGlobPath),
    files,
  };
}

const bundles: Snippet[] = BUNDLE_DECLS.map(bundleSnippetFromDecl).filter(
  (b): b is Snippet => b !== null,
);

// Files claimed by a multi-file bundle (either as entry or dependency) are
// SKIPPED from the single-file list so they don't show up twice — the bundle
// is the canonical entry point that exercises composition.
const claimedGlobPaths = new Set<string>(
  BUNDLE_DECLS.flatMap((d) => [d.entryGlobPath, ...d.dependencyGlobPaths]),
);

const singleFileEntries = (
  map: Record<string, string>,
  prefix: string,
): Snippet[] =>
  Object.entries(map)
    .filter(([path]) => !claimedGlobPaths.has(path))
    .map(([path, source]) => singleFileSnippet(path, source, prefix))
    .sort((a, b) => a.label.localeCompare(b.label));

// One explicitly-registered r-match snippet, sourced from a real
// examples/match/*.rozie feature-probe fixture. CommaAlternatives is the
// clearest single-file demonstration of the construct (discriminant +
// comma-alternative r-case + r-default). The other match/ probes are not
// surfaced — they exist for the compile/snapshot matrix, not the picker.
const MATCH_SNIPPET_PATH = '../../match/CommaAlternatives.rozie';

const matchSnippets: Snippet[] = (() => {
  const source = matchFiles[MATCH_SNIPPET_PATH];
  if (source === undefined) return [];
  return [singleFileSnippet(MATCH_SNIPPET_PATH, source, 'match')];
})();

// ---------------------------------------------------------------------------
// D-2 — "unsupported-with-reason" registry (the phase-68 escape hatch).
//
// Maps either an EXACT snippet key OR a family token (matched as a substring of
// the snippet key) to a human-readable reason a family cannot yet live-render.
// The bar per D-2: NO silent ROZ945 / blank grid cell — a family that can't
// render must show a curated reason in the picker + preview. Compilation still
// runs (Output pane shows the real emitted code); only the iframe render is
// short-circuited to the reason string (see main.ts).
//
// This is the reusable seam every later 68-plan consumes: as a plan lands
// coverage for a family it DELETES that family's entry here. Exact-key entries
// (used for the wired internal-helper bundles below, added in 68-01 Task 3)
// take precedence over family-token substring entries.
// ---------------------------------------------------------------------------
const UNSUPPORTED: Record<string, string> = {
  // Phase 68-04 added the engine libs to all six harness importmaps, un-blocking
  // the families that were held for an unwired engine:
  //   • embla (embla-carousel[+autoplay]), codemirror (@codemirror/* + codemirror),
  //     cropper (cropperjs + the external cropper.css <link>) — every emitted
  //     runtime import now resolves → LIVE-RENDER (entries DELETED).
  //   • combobox / listbox — their @tanstack/virtual-core windowing engine is now
  //     in the importmap (their .rzts partials inlined in 68-02) → un-marked.
  //   • popover — its @floating-ui/dom engine is now in the importmap (its
  //     ./internal/middleware blob sibling wired in 68-03) → un-marked.
  //   • command-palette — @tanstack/virtual-core (via its vendored Combobox) is now
  //     in the importmap + its ./internal/filterCommands helper wired in 68-03 →
  //     un-marked.
  //
  // Two engine families still cannot LIVE-RENDER for a genuine harness limit (not
  // an unwired lib) and stay marked-with-reason per D-2 — never a silent blank:
  PdfViewer:
    'compiles ×6 and its `pdfjs-dist` dynamic import now resolves from the importmap, but PDF.js sets GlobalWorkerOptions.workerSrc to a cross-origin jsDelivr worker URL and that web worker is not loadable from the sandboxed null-origin preview iframe — live render blocked by the harness sandbox, not by an unwired engine (bundled-worker support is WS3/Phase 69)',
  Captcha:
    'compiles ×6, but loads an EXTERNAL provider script (recaptcha/hcaptcha/turnstile) at runtime and its `sitekey` prop is required with no valid sample — it needs a real provider site key + network + a non-sandboxed origin, so it cannot live-render in the sandboxed preview iframe',
  // Still pending its own plan — DataTable is the multi-partial engine family wired
  // separately in 68-05 (TanStack table-core), not part of this single-engine slice.
  DataTable:
    'engine-backed (TanStack table-core) — the multi-partial data-table family is wired separately in 68-05',
};

/**
 * Resolve the unsupported reason for a snippet key. Exact-key match wins; then
 * a family-token substring match. Returns undefined for fully-supported
 * families (which render normally).
 */
function unsupportedReason(key: string): string | undefined {
  const exact = UNSUPPORTED[key];
  if (exact !== undefined) return exact;
  for (const [token, reason] of Object.entries(UNSUPPORTED)) {
    if (key.includes(token)) return reason;
  }
  return undefined;
}

/** Stamp `unsupported` onto any snippet the UNSUPPORTED registry marks. */
function markUnsupported(snippet: Snippet): Snippet {
  const reason = unsupportedReason(snippet.key);
  return reason ? { ...snippet, unsupported: { reason } } : snippet;
}

export const SNIPPETS: Snippet[] = [
  ...bundles,
  ...singleFileEntries(exampleFiles, ''),
  ...singleFileEntries(demoFiles, 'demos'),
  ...matchSnippets,
].map(markUnsupported);

export const DEFAULT_SNIPPET_KEY = 'bundle/SortableListDemo';

export function findSnippet(key: string): Snippet | undefined {
  return SNIPPETS.find((s) => s.key === key);
}
