/*
 * Phase 7 Plan 02 — visual-regression host build orchestrator.
 *
 * Vite can host only ONE `Rozie({ target })` per build. This script runs
 * `vite build` once per target (6 sub-builds), each with `ROZIE_TARGET` set, so
 * `vite.config.ts` wires the matching `Rozie({ target })` + framework plugin.
 * Each sub-build emits into `dist/<target>/` (its `build.outDir`).
 *
 * Finally it writes `dist/index.html` — the URL-query router that redirects
 * `?example=&target=` to the matching per-target entry HTML. `pnpm preview`
 * (vite.preview.config.ts) then serves the unified `dist/` on port 4180.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
// Repo root for cross-tree disk-cache cleanup. Three levels up: scripts → rig
// → tests → repo.
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const EXAMPLES_DIR = resolve(REPO_ROOT, 'examples');
// Phase 20: SortableList.rozie moved out of examples/ into the
// @rozie-ui/sortable-list package. The Angular sub-build now walks this dir via
// `prebuildExtraRoots` (vite.config.ts) and emits the same cross-tree disk-cache
// artefacts here (`SortableList.rozie.ts` + the `SortableList.ts` composition
// shim) that it drops in examples/. They must be swept after the Angular build
// for the same reason — the @angular/core-importing files poison the later
// solid/lit sub-builds (and unrelated workspace typechecks). See
// cleanupCrossTreeAngularArtifacts().
const SORTABLE_LIST_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'sortable-list',
  'src',
);
// Same packaging move for @rozie-ui/flatpickr: Flatpickr.rozie lives in the
// package src; the Angular sub-build walks it via `prebuildExtraRoots` and drops
// the same cross-tree `.rozie.ts` + `Flatpickr.ts` shim artefacts that must be
// swept after the Angular build (see cleanupCrossTreeAngularArtifacts).
const FLATPICKR_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'flatpickr',
  'src',
);
// Same packaging move for @rozie-ui/fullcalendar: FullCalendar.rozie lives in
// the package src; the Angular sub-build walks it via `prebuildExtraRoots` and
// drops the same cross-tree `.rozie.ts` + `FullCalendar.ts` shim artefacts that
// must be swept after the Angular build (see cleanupCrossTreeAngularArtifacts).
const FULLCALENDAR_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'fullcalendar',
  'src',
);
// Same packaging move for @rozie-ui/codemirror: CodeMirror.rozie lives in the
// package src; the Angular sub-build walks it via `prebuildExtraRoots` and drops
// the same cross-tree `.rozie.ts` + `CodeMirror.ts` shim artefacts that must be
// swept after the Angular build (see cleanupCrossTreeAngularArtifacts).
const CODEMIRROR_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'codemirror',
  'src',
);
// Same packaging move for @rozie-ui/chartjs (Phase 30): the generic Chart.rozie
// lives in the package src; the Angular sub-build walks it via
// `prebuildExtraRoots` and drops the same cross-tree `.rozie.ts` + `Chart.ts`
// shim artefacts that must be swept after the Angular build (see
// cleanupCrossTreeAngularArtifacts).
const CHARTJS_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'chartjs',
  'src',
);
// Same packaging move for @rozie-ui/tiptap (Phase 32): TipTap.rozie lives in the
// package src; the Angular sub-build walks it via `prebuildExtraRoots` and drops
// the same cross-tree `.rozie.ts` + `TipTap.ts` shim artefacts that must be swept
// after the Angular build (see cleanupCrossTreeAngularArtifacts).
const TIPTAP_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'tiptap',
  'src',
);
// Same packaging move for @rozie-ui/maplibre (Phase 35): MapLibre.rozie lives in
// the package src; the Angular sub-build walks it via `prebuildExtraRoots` and
// drops the same cross-tree `.rozie.ts` + `MapLibre.ts` shim artefacts that must
// be swept after the Angular build (see cleanupCrossTreeAngularArtifacts).
const MAPLIBRE_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'maplibre',
  'src',
);
// Same packaging move for @rozie-ui/cropper: Cropper.rozie lives in the package
// src; the Angular sub-build walks it via `prebuildExtraRoots` and drops the same
// cross-tree `.rozie.ts` + `Cropper.ts` shim artefacts that must be swept after
// the Angular build (see cleanupCrossTreeAngularArtifacts).
const CROPPER_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'cropper',
  'src',
);
// Same packaging move for @rozie-ui/wavesurfer: Waveform.rozie lives in the
// package src; the Angular sub-build walks it via `prebuildExtraRoots` and drops
// the same cross-tree `.rozie.ts` + `Waveform.ts` shim artefacts that must be
// swept after the Angular build (see cleanupCrossTreeAngularArtifacts).
const WAVESURFER_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'wavesurfer',
  'src',
);
// Same packaging move for @rozie-ui/pdf: PdfViewer.rozie lives in the package
// src; the Angular sub-build walks it via `prebuildExtraRoots` and drops the same
// cross-tree `.rozie.ts` + `PdfViewer.ts` shim artefacts that must be swept after
// the Angular build (see cleanupCrossTreeAngularArtifacts).
const PDF_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'pdf',
  'src',
);
// Same packaging move for @rozie-ui/rete: FlowCanvas.rozie lives in the package
// src; the Angular sub-build walks it via `prebuildExtraRoots` and drops the same
// cross-tree `.rozie.ts` + `FlowCanvas.ts` shim artefacts that must be swept after
// the Angular build (see cleanupCrossTreeAngularArtifacts).
const RETE_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'rete',
  'src',
);
// Same packaging move for @rozie-ui/embla: Carousel.rozie lives in the package
// src; the Angular sub-build walks it via `prebuildExtraRoots` and drops the same
// cross-tree `.rozie.ts` + `Carousel.ts` shim artefacts that must be swept after
// the Angular build (see cleanupCrossTreeAngularArtifacts).
const EMBLA_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'embla',
  'src',
);
// Same packaging move for @rozie-ui/listbox: Listbox.rozie lives in the package
// src; the Angular sub-build walks it via `prebuildExtraRoots` and drops the same
// cross-tree `.rozie.ts` + `Listbox.ts` shim artefacts that must be swept after
// the Angular build (see cleanupCrossTreeAngularArtifacts).
const LISTBOX_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'listbox',
  'src',
);
// Same packaging move for @rozie-ui/slider: Slider.rozie lives in the package
// src; the Angular sub-build walks it via `prebuildExtraRoots` and drops the same
// cross-tree `.rozie.ts` + `Slider.ts` shim artefacts that must be swept after
// the Angular build (see cleanupCrossTreeAngularArtifacts).
const SLIDER_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'slider',
  'src',
);
// Same packaging move for @rozie-ui/data-table: DataTable.rozie + Column.rozie
// live in the package src; the Angular sub-build walks it via `prebuildExtraRoots`
// and drops the cross-tree `.rozie.ts` + the `DataTable.ts` / `Column.ts` shim
// artefacts (a MULTI-component family → TWO shims) that must be swept after the
// Angular build (see cleanupCrossTreeAngularArtifacts).
// The Phase 50 round-out demos (examples/demos/DataTable{Expand,Group,Facet}Demo.rozie,
// data-table-roundout.spec.ts) consume THIS src — they need NO new Angular 3-file
// registration: they live under examples/demos/ (covered by prebuildExtraRoots[examplesRoot]
// + the examples tsconfig include + the DEMOS_DIR `.rozie.ts` cleanup sweep below) and
// import the data-table package src already registered for Angular cross-tree AOT here.
const DATA_TABLE_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'data-table',
  'src',
);
// Same packaging move for @rozie-ui/otp: Otp.rozie lives in the package src; the
// Angular sub-build walks it via `prebuildExtraRoots` and drops the same cross-tree
// `.rozie.ts` + `Otp.ts` shim artefacts that must be swept after the Angular build
// (see cleanupCrossTreeAngularArtifacts).
const OTP_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'otp',
  'src',
);
// Same packaging move for @rozie-ui/dialog: Dialog.rozie lives in the package src;
// the Angular sub-build walks it via `prebuildExtraRoots` and drops the same
// cross-tree `.rozie.ts` + `Dialog.ts` shim artefacts that must be swept after the
// Angular build (see cleanupCrossTreeAngularArtifacts).
const DIALOG_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'dialog',
  'src',
);
// Same packaging move for @rozie-ui/combobox: Combobox.rozie lives in the package
// src; the Angular sub-build walks it via `prebuildExtraRoots` and drops the same
// cross-tree `.rozie.ts` + `Combobox.ts` shim artefacts that must be swept after
// the Angular build (see cleanupCrossTreeAngularArtifacts).
const COMBOBOX_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'combobox',
  'src',
);
// Same packaging move for @rozie-ui/toast: Toaster.rozie lives in the package src;
// the Angular sub-build walks it via `prebuildExtraRoots` and drops the same
// cross-tree `.rozie.ts` + `Toaster.ts` shim artefacts that must be swept after the
// Angular build (see cleanupCrossTreeAngularArtifacts).
const TOAST_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'toast',
  'src',
);
// Same packaging move for @rozie-ui/tags / number-field / pagination: each
// family's <Name>.rozie lives in the package src; the Angular sub-build walks it
// via `prebuildExtraRoots` and drops the cross-tree `.rozie.ts` + `<Name>.ts`
// shim artefacts that must be swept after the Angular build (see
// cleanupCrossTreeAngularArtifacts).
const TAGS_SRC = resolve(REPO_ROOT, 'packages', 'ui', 'tags', 'src');
const NUMBER_FIELD_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'number-field',
  'src',
);
const PAGINATION_SRC = resolve(
  REPO_ROOT,
  'packages',
  'ui',
  'pagination',
  'src',
);
const SWITCH_SRC = resolve(REPO_ROOT, 'packages', 'ui', 'switch', 'src');
const POPOVER_SRC = resolve(REPO_ROOT, 'packages', 'ui', 'popover', 'src');
// Same packaging move for @rozie-ui/date-picker / resizable / command-palette: each
// family's <Name>.rozie lives in the package src; the Angular sub-build walks it via
// `prebuildExtraRoots` and drops the cross-tree `.rozie.ts` + `<Name>.ts` shim
// artefacts that must be swept after the Angular build (cleanupCrossTreeAngularArtifacts).
const DATE_PICKER_SRC = resolve(REPO_ROOT, 'packages', 'ui', 'date-picker', 'src');
const RESIZABLE_SRC = resolve(REPO_ROOT, 'packages', 'ui', 'resizable', 'src');
const COMMAND_PALETTE_SRC = resolve(REPO_ROOT, 'packages', 'ui', 'command-palette', 'src');
// Same packaging move for @rozie-ui/lexical (Phase 76, D-09): the family src
// (LexicalEditor shell + RichText/History/List/Link plugins + Toolbar) lives in the
// package src; the Angular sub-build walks it via `prebuildExtraRoots` and drops the
// cross-tree `.rozie.ts` disk-cache + one `<Name>.ts` composition shim PER referenced
// component (the Lexical{Screenshot,Behavior}Demo cells compose the shell + toolbar +
// the 3 plugins via <components>, so FIVE shims: LexicalEditor/Toolbar/HistoryPlugin/
// ListPlugin/LinkPlugin). These must be swept after the Angular build (see
// cleanupCrossTreeAngularArtifacts). MentionNode.ts + bridges/mountDecorators.*.ts are
// REAL vendored files (not shims) and are left untouched — the sweep only globs the
// top-level `.rozie.ts` + rm's the enumerated shim names.
const LEXICAL_SRC = resolve(REPO_ROOT, 'packages', 'ui', 'lexical', 'src');
// Phase 64 (D-08): @rozie-ui/headless-core is a SOURCE-ONLY package of shared
// `.rzts` partials. UNLIKE the component families above it emits NO `.rozie.ts`
// and NO `<Name>.ts` shim (the partial inlines into the CONSUMER's `.rozie.ts`),
// so this sweep is a DEFENSIVE no-op registered per the D-08 trio. Phase 64 P0
// Task 3 A/B-tests whether the sweep is load-bearing for a partial-only package.
const HEADLESS_CORE_SRC = resolve(REPO_ROOT, 'packages', 'ui', 'headless-core', 'src');
// Phase 71 (r-keynav) — KeynavMenuDemo / KeynavComboboxDemo (examples/demos/)
// need NO new SRC const / prebuildExtraRoots entry here: both are
// self-contained single-file demos (no `<components>` import of a
// packages/ui/* family — the scope fence), so their `.rozie.ts` Angular
// disk-cache artefacts land directly under `examples/demos/` and are already
// swept by the existing glob-driven `DEMOS_DIR` cleanup below (no hand-listed
// basename needed, matching the DataTableGridProbeDemo self-contained
// precedent).
const REFERENCE_BASENAMES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
  // Phase 07.2 Plan 06 — ModalConsumer dogfood + sibling WrapperModal.
  // Both get cross-tree Angular `.rozie.ts` artefacts emitted during the
  // Angular sub-build; both must be cleaned up after.
  'ModalConsumer',
  'WrapperModal',
  // Spike 003 — PortalList wrapper. PortalListDemo (in examples/demos/) is
  // loaded by the VR rig; both write Angular `.rozie.ts` cache artefacts
  // that the directory-glob cleanup below sweeps.
  'PortalList',
  // Chart.js wrapper. LineChartDemo (in examples/demos/) is loaded by the VR
  // rig; it composes the generic Chart from @rozie-ui/chartjs (Phase 30 move).
  // The Angular `.rozie.ts` cache artefacts land in the package src now and are
  // swept by the CHARTJS_SRC glob below (REFERENCE_BASENAMES is vestigial —
  // cleanup is glob-driven). LineChartDemo's own .rozie.ts is swept by the
  // examples/demos/ glob.
  'LineChartDemo',
  // CodeMirror wrapper (added 2026-05-19). CodeMirrorDemo (in examples/demos/)
  // is loaded by the VR rig; same Angular `.rozie.ts` + cross-rozie shim
  // cleanup pattern as LineChart.
  'CodeMirror',
  // PortalListStyled wrapper (added 2026-05-20, quick-task 260520-8iu).
  // PortalListStyledDemo (in examples/demos/) is loaded by the VR rig;
  // both write Angular `.rozie.ts` cache artefacts that the directory-glob
  // cleanup below sweeps. Doc-parity entry — the cleanup is glob-driven.
  'PortalListStyled',
];

// Cross-tree disk-cache files emitted by the Angular sub-build into the
// shared `<repo>/examples/` directory:
//   - `<basename>.rozie.ts`: D-70 disk-cache (analogjs's TS Program input)
//   - `Counter.ts`/`CardHeader.ts`: cross-rozie composition shims emitted by
//     `writeCrossRozieShimsFor()` because Card.rozie composes them via
//     `<components>{ Counter, CardHeader }</components>`.
//
// These files MUST exist during the Angular sub-build. After it completes
// they MUST be removed — they share `examples/` with every other consumer
// demo (vue-vite, react-vite, etc.) and TypeScript's bundler-mode module
// resolution prefers `.ts` extensions over the `*.rozie` ambient shims those
// demos rely on. Leaving them on disk poisons the whole workspace's `pnpm
// typecheck` with "Cannot find module '@angular/core'" errors in non-Angular
// consumers (the .rozie.ts files contain Angular imports).
//
// The `.gitignore` already filters them; this cleanup is for local
// developer experience (so `pnpm typecheck` works after a visual-regression
// build) and CI hygiene (workspace typecheck steps in unrelated workflows
// don't trip on leftover artifacts from a prior visual-regression CI run
// on the same runner cache).
function cleanupCrossTreeAngularArtifacts() {
  // Glob `examples/*.rozie.ts` (Angular disk-cache artefacts) — keeps cleanup
  // in sync with new fixtures/demos automatically. Previously this was driven
  // by REFERENCE_BASENAMES alone, which missed transitively-walked components
  // like Table.rozie (composed by examples/demos/TableDemo.rozie). The walk
  // happens via `RozieOptions.prebuildExtraRoots: [examplesRoot]`, so any
  // .rozie file the Angular target reaches lands a sibling .rozie.ts here.
  try {
    for (const entry of readdirSync(EXAMPLES_DIR)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(EXAMPLES_DIR, entry), { force: true });
      }
    }
  } catch {
    // examples dir always exists in a checkout — defensive only
  }
  // Cross-rozie composition shims at examples/ root (referenced from the 8
  // reference components — Counter and CardHeader by Card/Modal compositions;
  // Dropdown by examples/demos/DropdownDemo's `../Dropdown.rozie` reference;
  // Table by examples/demos/TableDemo's `../Table.rozie` reference).
  rmSync(resolve(EXAMPLES_DIR, 'Counter.ts'), { force: true });
  rmSync(resolve(EXAMPLES_DIR, 'CardHeader.ts'), { force: true });
  rmSync(resolve(EXAMPLES_DIR, 'Dropdown.ts'), { force: true });
  rmSync(resolve(EXAMPLES_DIR, 'Table.ts'), { force: true });
  // Demo-folder cross-tree artifacts. The Angular sub-build walks
  // `examples/demos/` as part of `prebuildExtraRoots: [examplesRoot]` and
  // emits `<DemoName>.rozie.ts` alongside the source. Leftover files break
  // the lit/solid sub-builds the same way the top-level ones do (cross-tree
  // imports of @angular/* from emitted Angular sources).
  //
  // Glob all `*.rozie.ts` files in `examples/demos/` so the cleanup keeps up
  // with new demos automatically (D-07.3.2-05-B fix — previously this list
  // was hand-maintained and missed `TableDemo.rozie.ts`, which broke the lit
  // sub-build because the Angular-emitted file imports `@angular/core`).
  const DEMOS_DIR = resolve(EXAMPLES_DIR, 'demos');
  try {
    for (const entry of readdirSync(DEMOS_DIR)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(DEMOS_DIR, entry), { force: true });
      }
    }
  } catch {
    // demos dir may not exist in some checkouts — ignore
  }
  // Phase 20: the Angular sub-build also walks `packages/ui/sortable-list/src/`
  // (the moved SortableList canonical source) via `prebuildExtraRoots`. It emits
  // `SortableList.rozie.ts` (D-70 disk-cache, imports @angular/core) and the
  // `SortableList.ts` cross-rozie composition shim there. Without sweeping them
  // between sub-builds, the later solid/lit `vite build` resolves the leftover
  // `.rozie.ts` (it shadows the `.rozie` virtual module) and fails with
  // "Rollup failed to resolve import 'lit'/'solid-js'" — the same cross-tree
  // contamination the examples/ + demos/ sweeps above prevent.
  try {
    for (const entry of readdirSync(SORTABLE_LIST_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(SORTABLE_LIST_SRC, entry), { force: true });
      }
    }
  } catch {
    // sortable-list src always exists post-Phase-20 — defensive only
  }
  rmSync(resolve(SORTABLE_LIST_SRC, 'SortableList.ts'), { force: true });
  // Same sweep for @rozie-ui/flatpickr's package src (FlatpickrDemo composes
  // Flatpickr via <components>, so the Angular sub-build emits Flatpickr.rozie.ts
  // + the Flatpickr.ts shim here). Leftovers poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(FLATPICKR_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(FLATPICKR_SRC, entry), { force: true });
      }
    }
  } catch {
    // flatpickr src always exists post-port — defensive only
  }
  rmSync(resolve(FLATPICKR_SRC, 'Flatpickr.ts'), { force: true });
  // Same sweep for @rozie-ui/fullcalendar's package src (FullCalendarDemo
  // composes FullCalendar via <components>, so the Angular sub-build emits
  // FullCalendar.rozie.ts + the FullCalendar.ts shim here). Leftovers (the
  // emitted .rozie.ts imports @angular/core) poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(FULLCALENDAR_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(FULLCALENDAR_SRC, entry), { force: true });
      }
    }
  } catch {
    // fullcalendar src always exists post-port — defensive only
  }
  rmSync(resolve(FULLCALENDAR_SRC, 'FullCalendar.ts'), { force: true });
  // Same sweep for @rozie-ui/codemirror's package src (CodeMirrorDemo composes
  // CodeMirror via <components>, so the Angular sub-build emits CodeMirror.rozie.ts
  // + the CodeMirror.ts shim here). Leftovers (the emitted .rozie.ts imports
  // @angular/core) poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(CODEMIRROR_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(CODEMIRROR_SRC, entry), { force: true });
      }
    }
  } catch {
    // codemirror src always exists post-port — defensive only
  }
  rmSync(resolve(CODEMIRROR_SRC, 'CodeMirror.ts'), { force: true });
  // Same sweep for @rozie-ui/chartjs's package src (LineChartDemo composes the
  // generic Chart via <components>, so the Angular sub-build emits Chart.rozie.ts
  // + the Chart.ts shim here). Leftovers (the emitted .rozie.ts imports
  // @angular/core) poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(CHARTJS_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(CHARTJS_SRC, entry), { force: true });
      }
    }
  } catch {
    // chartjs src always exists post-port — defensive only
  }
  rmSync(resolve(CHARTJS_SRC, 'Chart.ts'), { force: true });
  // Same sweep for @rozie-ui/tiptap's package src (TipTapDemo composes TipTap via
  // <components>, so the Angular sub-build emits TipTap.rozie.ts + the TipTap.ts
  // shim here). Leftovers (the emitted .rozie.ts imports @angular/core) poison the
  // later solid/lit builds.
  try {
    for (const entry of readdirSync(TIPTAP_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(TIPTAP_SRC, entry), { force: true });
      }
    }
  } catch {
    // tiptap src always exists post-port — defensive only
  }
  rmSync(resolve(TIPTAP_SRC, 'TipTap.ts'), { force: true });
  // Same sweep for @rozie-ui/maplibre's package src (MapLibreDemo +
  // MapLibreScreenshotDemo compose MapLibre via <components>, so the Angular
  // sub-build emits MapLibre.rozie.ts + the MapLibre.ts shim here). Leftovers
  // (the emitted .rozie.ts imports @angular/core) poison the later solid/lit
  // builds.
  try {
    for (const entry of readdirSync(MAPLIBRE_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(MAPLIBRE_SRC, entry), { force: true });
      }
    }
  } catch {
    // maplibre src always exists post-port — defensive only
  }
  rmSync(resolve(MAPLIBRE_SRC, 'MapLibre.ts'), { force: true });
  // Same sweep for @rozie-ui/cropper's package src (CropperDemo +
  // CropperScreenshotDemo compose Cropper via <components>, so the Angular
  // sub-build emits Cropper.rozie.ts + the Cropper.ts shim here). Leftovers (the
  // emitted .rozie.ts imports @angular/core) poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(CROPPER_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(CROPPER_SRC, entry), { force: true });
      }
    }
  } catch {
    // cropper src always exists post-port — defensive only
  }
  rmSync(resolve(CROPPER_SRC, 'Cropper.ts'), { force: true });
  // Same sweep for @rozie-ui/wavesurfer's package src (WaveformScreenshotDemo
  // composes Waveform via <components>, so the Angular sub-build emits
  // Waveform.rozie.ts + the Waveform.ts shim here). Leftovers (the emitted
  // .rozie.ts imports @angular/core) poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(WAVESURFER_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(WAVESURFER_SRC, entry), { force: true });
      }
    }
  } catch {
    // wavesurfer src always exists post-port — defensive only
  }
  rmSync(resolve(WAVESURFER_SRC, 'Waveform.ts'), { force: true });
  // Same sweep for @rozie-ui/pdf's package src (PdfViewerDemo composes PdfViewer
  // via <components>, so the Angular sub-build emits PdfViewer.rozie.ts + the
  // PdfViewer.ts shim here). Leftovers (the emitted .rozie.ts imports
  // @angular/core) poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(PDF_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(PDF_SRC, entry), { force: true });
      }
    }
  } catch {
    // pdf src always exists post-port — defensive only
  }
  rmSync(resolve(PDF_SRC, 'PdfViewer.ts'), { force: true });
  // Same sweep for @rozie-ui/rete's package src (FlowCanvasDemo +
  // FlowCanvasScreenshotDemo compose FlowCanvas via <components>, so the Angular
  // sub-build emits FlowCanvas.rozie.ts + the FlowCanvas.ts shim here). Leftovers
  // (the emitted .rozie.ts imports @angular/core) poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(RETE_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(RETE_SRC, entry), { force: true });
      }
    }
  } catch {
    // rete src always exists post-port — defensive only
  }
  rmSync(resolve(RETE_SRC, 'FlowCanvas.ts'), { force: true });
  // Same sweep for @rozie-ui/embla's package src (CarouselDemo +
  // CarouselScreenshotDemo compose Carousel via <components>, so the Angular
  // sub-build emits Carousel.rozie.ts + the Carousel.ts shim here). Leftovers (the
  // emitted .rozie.ts imports @angular/core) poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(EMBLA_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(EMBLA_SRC, entry), { force: true });
      }
    }
  } catch {
    // embla src always exists post-port — defensive only
  }
  rmSync(resolve(EMBLA_SRC, 'Carousel.ts'), { force: true });
  // Same sweep for @rozie-ui/listbox's package src (ListboxBehaviorDemo composes
  // Listbox via <components>, so the Angular sub-build emits Listbox.rozie.ts +
  // the Listbox.ts shim here). Leftovers (the emitted .rozie.ts imports
  // @angular/core) poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(LISTBOX_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(LISTBOX_SRC, entry), { force: true });
      }
    }
  } catch {
    // listbox src always exists post-port — defensive only
  }
  rmSync(resolve(LISTBOX_SRC, 'Listbox.ts'), { force: true });
  // Same sweep for @rozie-ui/slider's package src (the Slider*Demo cells compose
  // Slider via <components>, so the Angular sub-build emits Slider.rozie.ts +
  // the Slider.ts shim here). Leftovers (the emitted .rozie.ts imports
  // @angular/core) poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(SLIDER_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(SLIDER_SRC, entry), { force: true });
      }
    }
  } catch {
    // slider src always exists post-port — defensive only
  }
  rmSync(resolve(SLIDER_SRC, 'Slider.ts'), { force: true });
  // Same sweep for @rozie-ui/data-table's package src (the DataTable*Demo cells
  // compose DataTable + Column via <components>, so the Angular sub-build emits
  // DataTable.rozie.ts + Column.rozie.ts + the DataTable.ts / Column.ts shims
  // here — a MULTI-component family → TWO shims). Leftovers (the emitted
  // .rozie.ts imports @angular/core) poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(DATA_TABLE_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(DATA_TABLE_SRC, entry), { force: true });
      }
    }
  } catch {
    // data-table src always exists post-port — defensive only
  }
  rmSync(resolve(DATA_TABLE_SRC, 'DataTable.ts'), { force: true });
  rmSync(resolve(DATA_TABLE_SRC, 'Column.ts'), { force: true });
  // Same sweep for @rozie-ui/otp's package src (OtpBehaviorDemo composes Otp via
  // <components>, so the Angular sub-build emits Otp.rozie.ts + the Otp.ts shim
  // here). Leftovers (the emitted .rozie.ts imports @angular/core) poison the later
  // solid/lit builds.
  try {
    for (const entry of readdirSync(OTP_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(OTP_SRC, entry), { force: true });
      }
    }
  } catch {
    // otp src always exists post-port — defensive only
  }
  rmSync(resolve(OTP_SRC, 'Otp.ts'), { force: true });
  // Same sweep for @rozie-ui/dialog's package src (DialogBehaviorDemo composes
  // Dialog via <components>, so the Angular sub-build emits Dialog.rozie.ts + the
  // Dialog.ts shim here). Leftovers poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(DIALOG_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(DIALOG_SRC, entry), { force: true });
      }
    }
  } catch {
    // dialog src always exists post-port — defensive only
  }
  rmSync(resolve(DIALOG_SRC, 'Dialog.ts'), { force: true });
  // Same sweep for @rozie-ui/combobox's package src (ComboboxBehaviorDemo composes
  // Combobox via <components>, so the Angular sub-build emits Combobox.rozie.ts +
  // the Combobox.ts shim here). Leftovers poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(COMBOBOX_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(COMBOBOX_SRC, entry), { force: true });
      }
    }
  } catch {
    // combobox src always exists post-port — defensive only
  }
  rmSync(resolve(COMBOBOX_SRC, 'Combobox.ts'), { force: true });
  // Same sweep for @rozie-ui/toast's package src (ToasterBehaviorDemo composes
  // Toaster via <components>, so the Angular sub-build emits Toaster.rozie.ts + the
  // Toaster.ts shim here). Leftovers poison the later solid/lit builds.
  try {
    for (const entry of readdirSync(TOAST_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(TOAST_SRC, entry), { force: true });
      }
    }
  } catch {
    // toast src always exists post-port — defensive only
  }
  rmSync(resolve(TOAST_SRC, 'Toaster.ts'), { force: true });
  // Same sweep for @rozie-ui/tags / number-field / pagination package src (the
  // *BehaviorDemo / *ScreenshotDemo cells compose each family via <components>, so
  // the Angular sub-build emits <Name>.rozie.ts + the <Name>.ts shim here).
  // Leftovers poison the later solid/lit builds.
  // @rozie-ui/switch + popover join the same sweep ({Switch,Popover}{Behavior,
  // Screenshot}Demo compose each family via <components>, so the Angular sub-build
  // emits <Name>.rozie.ts + the <Name>.ts shim here). popover also has a plain
  // ./internal/*.ts helper tree but emits no .rozie.ts there (no nested .rozie).
  for (const [src, shim] of [
    [TAGS_SRC, 'Tags.ts'],
    [NUMBER_FIELD_SRC, 'NumberField.ts'],
    [PAGINATION_SRC, 'Pagination.ts'],
    [SWITCH_SRC, 'Switch.ts'],
    [POPOVER_SRC, 'Popover.ts'],
    [DATE_PICKER_SRC, 'DatePicker.ts'],
    [RESIZABLE_SRC, 'Resizable.ts'],
    [COMMAND_PALETTE_SRC, 'CommandPalette.ts'],
  ]) {
    try {
      for (const entry of readdirSync(src)) {
        if (entry.endsWith('.rozie.ts')) {
          rmSync(resolve(src, entry), { force: true });
        }
      }
    } catch {
      // family src always exists post-port — defensive only
    }
    rmSync(resolve(src, shim), { force: true });
  }
  // Phase 76 (D-09): @rozie-ui/lexical sweep. The Lexical{Screenshot,Behavior}Demo
  // cells compose the shell + toolbar + 3 plugins via <components>, so the Angular
  // sub-build emits `<Name>.rozie.ts` for each + a `<Name>.ts` composition shim here.
  // Glob-remove the `.rozie.ts` disk-cache + rm the FIVE enumerated shims. MentionNode.ts
  // (real neutral node) + bridges/mountDecorators.*.ts (real vendored bridges, in a
  // subdir the top-level readdir never reaches) are left untouched.
  try {
    for (const entry of readdirSync(LEXICAL_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(LEXICAL_SRC, entry), { force: true });
      }
    }
  } catch {
    // lexical src always exists post-Phase-76 — defensive only
  }
  for (const shim of ['LexicalEditor.ts', 'Toolbar.ts', 'HistoryPlugin.ts', 'ListPlugin.ts', 'LinkPlugin.ts']) {
    rmSync(resolve(LEXICAL_SRC, shim), { force: true });
  }
  // The LexicalMentionDriver demo-helper lives under examples/demos/ and is composed
  // by both lexical demos via <components>, so its `LexicalMentionDriver.ts` shim lands
  // beside it in demos/. The DEMOS_DIR `.rozie.ts` glob above sweeps its disk-cache; rm
  // the shim explicitly (the glob only matches `.rozie.ts`, not the `.ts` shim).
  rmSync(resolve(DEMOS_DIR, 'LexicalMentionDriver.ts'), { force: true });
  // Phase 64 (D-08): @rozie-ui/headless-core sweep — DEFENSIVE no-op. It is a
  // SOURCE-ONLY package of shared `.rzts` partials with NO component, so the
  // Angular sub-build emits NO `<Name>.rozie.ts` and NO `<Name>.ts` shim here
  // (the partial inlines into the CONSUMER's `.rozie.ts`, e.g.
  // HeadlessCoreSmokeDemo.rozie.ts under examples/demos, which the examples sweep
  // already handles). Registered per the D-08 trio; Phase 64 P0 Task 3
  // A/B-confirms it is a no-op for a partial-only package (no shim rm — there is
  // no shim to remove).
  try {
    for (const entry of readdirSync(HEADLESS_CORE_SRC)) {
      if (entry.endsWith('.rozie.ts')) {
        rmSync(resolve(HEADLESS_CORE_SRC, entry), { force: true });
      }
    }
  } catch {
    // headless-core src always exists post-P0 — defensive only
  }
}

const ALL_TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

// Iteration filter: `ROZIE_VR_TARGETS=lit,vue` builds ONLY those targets, so a
// focused debug rebuild skips the 4 you aren't looking at (each sub-build bundles
// the full example corpus incl. the multi-MB engine ports, so per-target cost is
// real). Unset/empty → all six (CI + blessing default, unchanged). Unknown names
// fail loudly rather than silently building nothing. PARTIAL builds are for local
// iteration only — never bless a baseline or trust CI parity off a filtered build.
const targetFilter = (process.env.ROZIE_VR_TARGETS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const unknownTargets = targetFilter.filter((t) => !ALL_TARGETS.includes(t));
if (unknownTargets.length > 0) {
  process.stderr.write(
    `\n[visual-regression] ROZIE_VR_TARGETS: unknown target(s) ${unknownTargets.join(', ')} ` +
      `— valid: ${ALL_TARGETS.join(', ')}\n`,
  );
  process.exit(1);
}
const TARGETS = targetFilter.length
  ? ALL_TARGETS.filter((t) => targetFilter.includes(t))
  : ALL_TARGETS;
if (targetFilter.length > 0) {
  process.stdout.write(
    `\n[visual-regression] ROZIE_VR_TARGETS filter active → building ${TARGETS.join(', ')} ` +
      `(PARTIAL build — local iteration only; not for blessing/CI)\n`,
  );
}

// Targets whose sub-build failure is treated as non-fatal. Empty after Quick
// task 260515-1y4: the cross-tree prebuild fix
// (`RozieOptions.prebuildExtraRoots`) makes the Angular sub-build
// self-sufficient — the disk-cache walker now reaches `<repo>/examples/`
// from `tests/visual-regression/`'s vite.config.ts. The Angular sub-build is
// hard-required.
//
// If a future upstream-tooling regression re-breaks the column, add 'angular'
// back here AND open a follow-up issue. Silent re-soft-failing is forbidden —
// the matrix should fail loudly so the regression is surfaced rather than
// papered over. The plumbing below is preserved for that contingency.
const SOFT_FAIL_TARGETS = new Set();

const failures = [];

for (const target of TARGETS) {
  process.stdout.write(`\n[visual-regression] building target: ${target}\n`);
  const result = spawnSync(
    'pnpm',
    ['exec', 'vite', 'build', '--config', 'vite.config.ts'],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, ROZIE_TARGET: target },
    },
  );
  // Always clean Angular's cross-tree disk-cache leftovers between targets.
  // Before this hook, the Angular sub-build (which succeeds now per the
  // pnpm.packageExtensions analogjs patch) was leaving `.rozie.ts` and `.ts`
  // shim files in `<repo>/examples/`. The next target's vite build would then
  // glob those leftovers via `import.meta.glob('../../../examples/*.rozie')`
  // and fail to resolve `lit`/`solid-js`/etc. from the Angular-emitted files
  // (the Angular sources import `@angular/core`, not the next target's
  // runtime). Cleanup-between-targets isolates each sub-build.
  if (target === 'angular') {
    cleanupCrossTreeAngularArtifacts();
  }
  if (result.status !== 0) {
    if (SOFT_FAIL_TARGETS.has(target)) {
      process.stderr.write(
        `\n[visual-regression] sub-build failed for target: ${target} ` +
          `(known out-of-scope upstream breakage — see deferred-items.md); continuing\n`,
      );
      failures.push(target);
      continue;
    }
    process.stderr.write(
      `\n[visual-regression] sub-build FAILED for target: ${target}\n`,
    );
    // Clean up cross-tree disk-cache artifacts on failure too — leftover
    // .rozie.ts files in <repo>/examples/ would break unrelated demos'
    // typechecks. The user has bigger problems if we got here, but at
    // least don't leave the workspace in a broken state.
    cleanupCrossTreeAngularArtifacts();
    process.exit(result.status ?? 1);
  }
}

// Drop the dist-root router. host/index.html redirects ?target= to the matching
// per-target entry HTML, preserving the query string.
const distDir = resolve(ROOT, 'dist');
mkdirSync(distDir, { recursive: true });
copyFileSync(
  resolve(ROOT, 'host', 'index.html'),
  resolve(distDir, 'index.html'),
);
// Side-by-side compare page — opens 6 iframes (one per target) with an
// example dropdown. Served at /compare.html for manual debugging; not part
// of the Playwright matrix.
copyFileSync(
  resolve(ROOT, 'host', 'compare.html'),
  resolve(distDir, 'compare.html'),
);

// Clean up cross-tree disk-cache artifacts the Angular sub-build dropped into
// the shared `<repo>/examples/` directory — see the function comment for why.
cleanupCrossTreeAngularArtifacts();

const built = TARGETS.length - failures.length;
process.stdout.write(
  `\n[visual-regression] ${built}/${TARGETS.length} target sub-builds complete` +
    (failures.length > 0
      ? ` (soft-failed: ${failures.join(', ')} — see deferred-items.md)`
      : '') +
    '; dist/index.html router written\n',
);
