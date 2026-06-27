import { defineConfig, type Plugin } from 'vite';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import Rozie from '@rozie/unplugin/vite';

/**
 * Phase 7 Plan 02 — visual-regression host (D-09).
 *
 * Per RESEARCH Open Question 2 (RESOLVED): the host is a thin mount shell, NOT
 * a 6-way Vite config. Vite can only host ONE `Rozie({ target })` per build, so
 * each target is built independently by `scripts/build-cells.mjs`, which invokes
 * `vite build` once per target with the `ROZIE_TARGET` env var set. Every
 * per-target sub-build writes into the SAME `dist/<target>/` subtree (with
 * `emptyOutDir: false` so siblings survive); the build script then drops the
 * `dist/index.html` host router. `pnpm preview` serves the unified `dist/` so
 * every (example × target) cell is reachable under one origin on port 4180.
 *
 * The Rozie() plugin is wired BEFORE the framework plugin per D-25/D-58 ordering.
 */

type Target = 'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit';

const TARGET = (process.env.ROZIE_TARGET ?? 'vue') as Target;

/**
 * Quick task 260515-1y4 follow-up. The Angular target's prebuild emits
 * `<repo>/examples/Foo.rozie.ts` files (which import `@angular/core`, etc.)
 * via `prebuildExtraRoots`. But Node's module resolution from those files
 * walks UP from `<repo>/examples/` and finds NO `@angular/*` packages
 * because `examples/` is not a workspace package and `<repo>/node_modules/`
 * is sparse with pnpm — the angular peer-deps live under
 * `tests/visual-regression/node_modules/`.
 *
 * Rather than hoist or symlink, intercept bare imports from any file under
 * the cross-tree extra root and re-resolve them via `createRequire(<this
 * config's dir>)` so resolution happens as if the importer were a sibling
 * of THIS vite.config.ts. Scoped to the angular target only — the Vue,
 * React, Svelte, Solid, Lit columns don't use cross-tree prebuild and so
 * never emit cross-tree .ts files that could trigger this code path.
 */
function resolveCrossTreeBareImports(extraRoots: readonly string[]): Plugin {
  const requireFromHere = createRequire(import.meta.url);
  return {
    name: 'rozie-vr:resolve-cross-tree-bare-imports',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null;
      // Only handle bare specifiers (no relative ./, ../, no absolute path).
      if (
        source.startsWith('./') ||
        source.startsWith('../') ||
        source.startsWith('/') ||
        source.startsWith('\0')
      ) {
        return null;
      }
      // Only intercept when the importer lives under one of our extra roots.
      const inExtraRoot = extraRoots.some((root) => importer.startsWith(root));
      if (!inExtraRoot) return null;
      // Preserve any query suffix (`?url`, `?raw`, `?worker`, …) so Vite's asset
      // plugins still handle it: `createRequire().resolve()` can't parse a query
      // (it would throw → null → the Angular build's resolver chain, which lacks
      // a `?url` handler here, then hard-fails). Split it off, resolve the bare
      // path, and re-append the query to the absolute id Vite emits the asset for.
      // (PdfViewerDemo imports `pdfjs-dist/build/pdf.worker.min.mjs?url` to bundle
      // the PDF.js worker offline.)
      const queryIdx = source.indexOf('?');
      const query = queryIdx === -1 ? '' : source.slice(queryIdx);
      const bareSource = queryIdx === -1 ? source : source.slice(0, queryIdx);
      if (query) {
        try {
          const resolved = requireFromHere.resolve(bareSource);
          return resolved + query;
        } catch {
          return null;
        }
      }
      source = bareSource;
      // PREFER the ESM (`import`/`module`) entry over the CJS (`require`)
      // entry. `createRequire().resolve()` walks package.json `exports` with
      // the `require` condition first and so picks a package's `.cjs` build
      // (e.g. `@fullcalendar/list` → `index.cjs`). For a *default* ES import
      // (`import listPlugin from '@fullcalendar/list'`) the CJS module's
      // esbuild interop yields `undefined` for the default binding — the
      // engine then throws `Cannot read properties of undefined (reading
      // 'name')` in `buildPluginHooks`. Resolving to the package's ESM `.`
      // → `import` entry (or top-level `module` field) hands back the real
      // default export, matching what Vite's own resolver does for the other
      // (non-cross-tree) `@fullcalendar/*` imports.
      try {
        const pkgJsonPath = requireFromHere.resolve(`${source}/package.json`);
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
          exports?: { '.'?: { import?: string } };
          module?: string;
        };
        const esmRel = pkg.exports?.['.']?.import ?? pkg.module;
        if (esmRel) {
          return resolve(dirname(pkgJsonPath), esmRel);
        }
      } catch {
        // Fall through to the plain createRequire resolution below.
      }
      try {
        const resolved = requireFromHere.resolve(source);
        return resolved;
      } catch {
        // Let the rest of Vite's resolver chain try.
        return null;
      }
    },
  };
}

async function frameworkPlugins(target: Target) {
  switch (target) {
    case 'vue': {
      const { default: vue } = await import('@vitejs/plugin-vue');
      return [
        vue({
          template: {
            compilerOptions: {
              isCustomElement: (tag: string) => tag.startsWith('rozie-'),
            },
          },
        }),
      ];
    }
    case 'react': {
      const { default: react } = await import('@vitejs/plugin-react');
      return [react()];
    }
    case 'svelte': {
      const { svelte } = await import('@sveltejs/vite-plugin-svelte');
      return [svelte()];
    }
    case 'solid': {
      const { default: solid } = await import('vite-plugin-solid');
      return [solid()];
    }
    case 'angular': {
      const { default: angular } = await import('@analogjs/vite-plugin-angular');
      return [angular()];
    }
    case 'lit':
      // Lit has no host Vite plugin — components are plain ES modules.
      return [];
    default:
      return [];
  }
}

export default defineConfig(async () => {
  const examplesRoot = resolve(__dirname, '..', '..', 'examples');
  // Phase 20: SortableList.rozie moved out of `examples/` into the
  // `@rozie-ui/sortable-list` package. The Angular AOT prebuild + NgtscProgram
  // must also walk the package src so the moved component's `.rozie.ts`
  // disk-cache artifact is generated and type-resolved — otherwise the demo's
  // `imports: [SortableList]` collapses to `any[]`, `ɵcmp` is skipped, and the
  // cell falls back to JIT → empty mount. The matching disk-cache sweep lives
  // in scripts/build-cells.mjs `cleanupCrossTreeAngularArtifacts()` so the
  // emitted `.rozie.ts` here doesn't poison the later solid/lit sub-builds.
  // See DEBUG.md "vr Angular JIT compiler unavailable".
  const sortableListSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'sortable-list',
    'src',
  );
  // Same move as sortable-list: Flatpickr.rozie lives in @rozie-ui/flatpickr.
  // The Angular sub-build must walk it too (FlatpickrDemo's
  // `imports: [Flatpickr]` would otherwise collapse to `any[]` → empty mount).
  const flatpickrSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'flatpickr',
    'src',
  );
  // Same move as sortable-list/flatpickr: FullCalendar.rozie lives in
  // @rozie-ui/fullcalendar. The Angular sub-build must walk it too
  // (FullCalendarDemo's `imports: [FullCalendar]` would otherwise collapse to
  // `any[]` → empty mount). Lockstep with tsconfig.app.json `include` +
  // build-cells.mjs `FULLCALENDAR_SRC` sweep.
  const fullCalendarSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'fullcalendar',
    'src',
  );
  // Same move as fullcalendar: CodeMirror.rozie lives in @rozie-ui/codemirror.
  // The Angular sub-build must walk it too (CodeMirrorDemo's
  // `imports: [CodeMirror]` would otherwise collapse to `any[]` → empty mount).
  // Lockstep with tsconfig.app.json `include` + build-cells.mjs `CODEMIRROR_SRC`
  // sweep. NO `@codemirror/*` ESM-interop alias needed (unlike @fullcalendar/list):
  // CM6 packages ship clean ESM default/named exports.
  const codeMirrorSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'codemirror',
    'src',
  );
  // Same move as codemirror (Phase 30): the generic Chart.rozie lives in
  // @rozie-ui/chartjs. The Angular sub-build must walk it too (LineChartDemo's
  // `imports: [Chart]` would otherwise collapse to `any[]` → empty mount).
  // Lockstep with tsconfig.app.json `include` + build-cells.mjs `CHARTJS_SRC`
  // sweep. NO `chart.js` ESM-interop alias needed (chart.js ships clean ESM).
  const chartSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'chartjs',
    'src',
  );
  // Same move as chartjs (Phase 32): TipTap.rozie lives in @rozie-ui/tiptap. The
  // Angular sub-build must walk it too (TipTapDemo's `imports: [TipTap]` would
  // otherwise collapse to `any[]` → empty mount). Lockstep with tsconfig.app.json
  // `include` + build-cells.mjs `TIPTAP_SRC` sweep. NO `@tiptap/*` ESM-interop
  // alias needed (the @tiptap packages ship clean ESM).
  const tipTapSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'tiptap',
    'src',
  );
  // Same move as tiptap (Phase 35): MapLibre.rozie lives in @rozie-ui/maplibre.
  // The Angular sub-build must walk it too (MapLibreDemo's `imports: [MapLibre]`
  // would otherwise collapse to `any[]` → empty mount). Lockstep with
  // tsconfig.app.json `include` + build-cells.mjs `MAPLIBRE_SRC` sweep. NO
  // `maplibre-gl` ESM-interop alias needed (maplibre-gl ships clean ESM).
  const mapLibreSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'maplibre',
    'src',
  );
  // Same move as maplibre: Cropper.rozie lives in @rozie-ui/cropper. The Angular
  // sub-build must walk it too (CropperDemo / CropperScreenshotDemo's
  // `imports: [Cropper]` would otherwise collapse to `any[]` → empty mount + a
  // runtime "JIT compiler unavailable"). Lockstep with build-cells.mjs
  // `CROPPER_SRC` sweep. NO `cropperjs` ESM-interop alias needed (cropperjs ships
  // a `module` ESM entry with a default export).
  const cropperSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'cropper',
    'src',
  );
  // Same move for @rozie-ui/pdf: PdfViewer.rozie lives in the package src, so the
  // Angular sub-build must walk it too (PdfViewerDemo's `imports: [PdfViewer]`
  // would otherwise collapse to `any[]` → empty mount + "JIT compiler
  // unavailable"). Lockstep with build-cells.mjs `PDF_SRC` sweep. NO `pdfjs-dist`
  // ESM-interop alias needed — the wrapper dynamic-imports it inside $onMount, so
  // it never goes through the Angular AOT type surface.
  const pdfSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'pdf',
    'src',
  );
  // Same move for @rozie-ui/rete: FlowCanvas.rozie lives in the package src, so the
  // Angular sub-build must walk it too (FlowCanvasDemo / FlowCanvasScreenshotDemo's
  // `imports: [FlowCanvas]` would otherwise collapse to `any[]` → empty mount +
  // "JIT compiler unavailable"). Lockstep with build-cells.mjs `RETE_SRC` sweep.
  // NO ESM-interop alias needed — rete + its plugins ship clean ESM.
  const reteSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'rete',
    'src',
  );
  // Same move for @rozie-ui/embla: Carousel.rozie lives in the package src, so the
  // Angular sub-build must walk it too (CarouselDemo / CarouselScreenshotDemo's
  // `imports: [Carousel]` would otherwise collapse to `any[]` → empty mount +
  // "JIT compiler unavailable"). Lockstep with build-cells.mjs `EMBLA_SRC` sweep
  // + tsconfig.app.json `include`. NO ESM-interop alias needed — embla-carousel +
  // embla-carousel-autoplay ship clean ESM.
  const emblaSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'embla',
    'src',
  );
  // Same move for @rozie-ui/listbox: Listbox.rozie lives in the package src, so
  // the Angular sub-build must walk it too (ListboxBehaviorDemo's
  // `imports: [Listbox]` would otherwise collapse to `any[]` → empty mount +
  // "JIT compiler unavailable"). Lockstep with build-cells.mjs `LISTBOX_SRC`
  // sweep + tsconfig.app.json `include`. NO ESM-interop alias needed — the
  // listbox component is pure-Rozie with no third-party engine deps.
  const listboxSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'listbox',
    'src',
  );
  // Same move for @rozie-ui/slider: Slider.rozie lives in the package src, so the
  // Angular sub-build must walk it too (SliderBehaviorDemo et al. `imports: [Slider]`
  // would otherwise collapse to `any[]` → empty mount + "JIT compiler unavailable").
  // Lockstep with build-cells.mjs `SLIDER_SRC` sweep + tsconfig.app.json `include`.
  // NO ESM-interop alias needed — slider is pure-Rozie with no third-party engine deps.
  const sliderSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'slider',
    'src',
  );
  // Same move for @rozie-ui/data-table: DataTable.rozie + Column.rozie live in
  // the package src, so the Angular sub-build must walk it too (the DataTable*Demo
  // cells `imports: [DataTable, Column]` would otherwise collapse to `any[]` →
  // empty mount + "JIT compiler unavailable"). Lockstep with build-cells.mjs
  // `DATA_TABLE_SRC` sweep + tsconfig.app.json `include`. NO ESM-interop alias
  // needed — @tanstack/table-core is a normal ESM dep resolved by Vite.
  const dataTableSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'data-table',
    'src',
  );
  // Same move for @rozie-ui/otp: Otp.rozie lives in the package src, so the Angular
  // sub-build must walk it too (the OtpBehaviorDemo's `imports: [Otp]` would
  // otherwise collapse to `any[]` → empty mount + "JIT compiler unavailable").
  // Lockstep with build-cells.mjs `OTP_SRC` sweep + tsconfig.app.json `include`.
  // NO ESM-interop alias needed — otp is pure-Rozie with no third-party engine deps.
  const otpSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'otp',
    'src',
  );
  // Same move for @rozie-ui/dialog: Dialog.rozie lives in the package src, so the
  // Angular sub-build must walk it too (DialogBehaviorDemo's `imports: [Dialog]`
  // would otherwise collapse to `any[]` → empty mount). Lockstep with
  // build-cells.mjs `DIALOG_SRC` sweep + tsconfig.app.json `include`. NO ESM-interop
  // alias needed — dialog is pure-Rozie with no third-party engine deps.
  const dialogSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'dialog',
    'src',
  );
  // Same move for @rozie-ui/combobox: Combobox.rozie lives in the package src, so
  // the Angular sub-build must walk it too (ComboboxBehaviorDemo's
  // `imports: [Combobox]` would otherwise collapse to `any[]` → empty mount).
  // Lockstep with build-cells.mjs `COMBOBOX_SRC` sweep + tsconfig.app.json
  // `include`. NO ESM-interop alias needed — pure-Rozie, no engine deps.
  const comboboxSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'combobox',
    'src',
  );
  // Same move for @rozie-ui/toast: Toaster.rozie lives in the package src, so the
  // Angular sub-build must walk it too (ToasterBehaviorDemo's `imports: [Toaster]`
  // would otherwise collapse to `any[]` → empty mount). Lockstep with
  // build-cells.mjs `TOAST_SRC` sweep + tsconfig.app.json `include`. NO ESM-interop
  // alias needed — toast is pure-Rozie with no third-party engine deps.
  const toastSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'toast',
    'src',
  );
  // Same move for @rozie-ui/tags / number-field / pagination: each family's
  // <Name>.rozie lives in the package src, so the Angular sub-build must walk it
  // (the *BehaviorDemo / *ScreenshotDemo cells' `imports: [<Name>]` would
  // otherwise collapse to `any[]` → empty mount). Lockstep with build-cells.mjs
  // {TAGS,NUMBER_FIELD,PAGINATION}_SRC sweeps + tsconfig.app.json `include`.
  // NO ESM-interop alias needed — all three are pure-Rozie, no third-party engine.
  const tagsSrc = resolve(__dirname, '..', '..', 'packages', 'ui', 'tags', 'src');
  const numberFieldSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'number-field',
    'src',
  );
  const paginationSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'pagination',
    'src',
  );
  // Same move for @rozie-ui/switch + popover: Switch.rozie / Popover.rozie live in
  // the package src, so the Angular sub-build must walk them too (the
  // {Switch,Popover}{Behavior,Screenshot}Demo cells' `imports: [Switch]` /
  // `imports: [Popover]` would otherwise collapse to `any[]` → empty mount +
  // "JIT compiler unavailable"). Lockstep with build-cells.mjs {SWITCH,POPOVER}_SRC
  // sweeps + tsconfig.app.json `include`. NO ESM-interop alias needed — switch is
  // pure-Rozie, and popover's @floating-ui/dom is a normal ESM dep resolved by Vite
  // (the @tanstack/table-core / data-table precedent).
  const switchSrc = resolve(__dirname, '..', '..', 'packages', 'ui', 'switch', 'src');
  const popoverSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'popover',
    'src',
  );
  // Same move for @rozie-ui/date-picker + resizable + command-palette: each family's
  // <Name>.rozie lives in the package src, so the Angular sub-build must walk it too
  // (the {DatePicker,Resizable,CommandPalette}{Behavior,Screenshot}Demo cells'
  // `imports: [<Name>]` would otherwise collapse to `any[]` → empty mount + "JIT
  // compiler unavailable"). Lockstep with build-cells.mjs
  // {DATE_PICKER,RESIZABLE,COMMAND_PALETTE}_SRC sweeps + tsconfig.app.json `include`.
  // NO ESM-interop alias needed — all three are pure-Rozie with no engine deps.
  const datePickerSrc = resolve(__dirname, '..', '..', 'packages', 'ui', 'date-picker', 'src');
  const resizableSrc = resolve(__dirname, '..', '..', 'packages', 'ui', 'resizable', 'src');
  const commandPaletteSrc = resolve(__dirname, '..', '..', 'packages', 'ui', 'command-palette', 'src');
  // Phase 64 (D-08): @rozie-ui/headless-core is a SOURCE-ONLY package of shared
  // `.rzts` script-partials (smoke.rzts P0; windowing.rzts P1; listCore.rzts P2).
  // HeadlessCoreSmokeDemo (examples/demos) imports a partial via the BARE
  // specifier `@rozie-ui/headless-core/smoke.rzts`. UNLIKE the component families
  // above, headless-core emits NO `.rozie.ts` (the partial is inlined into the
  // CONSUMER's `.rozie.ts` before the leaf is emitted), so the cross-tree trio
  // here is registered defensively per D-08 — Phase 64 P0 Task 3 A/B-tests which
  // of the three points are actually load-bearing for a partial-only package and
  // records the finding (A3) for future shared-`.rzts` packages.
  const headlessCoreSrc = resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'ui',
    'headless-core',
    'src',
  );
  // @fullcalendar/list ESM-entry alias (see optimizeDeps note below). The
  // package's CJS build does `exports["default"] = plugin` without
  // `__esModule`, so a default ES import bundled through the CJS-interop path
  // yields `{ default: plugin }` instead of the plugin — and the engine throws
  // `Cannot read properties of undefined (reading 'name')` at mount. Pinning
  // the bare specifier to the package's real ESM entry (`index.js`, a proper
  // `export default plugin`) forces the correct default binding on every
  // resolver in the chain — including Analog's Angular AOT pipeline, which
  // pre-bundles the consumer-supplied import outside the cross-tree resolver's
  // reach. Resolved at config time so the alias is the exact on-disk ESM file.
  const requireFromHere = createRequire(import.meta.url);
  const fullCalendarListEsm = requireFromHere.resolve('@fullcalendar/list/index.js');
  return {
  // Sub-builds are served from dist/<target>/; the host router lives at dist root.
  base: `/${TARGET}/`,
  resolve: {
    alias: [
      { find: /^@fullcalendar\/list$/, replacement: fullCalendarListEsm },
      // Phase 999.4 / P3 — cross-family composition (Option B). command-palette's
      // CommandPalette.rozie composes the combobox primitive via the STABLE D-07
      // specifier `@rozie-ui/combobox/Combobox.rozie`. Compile-time `<components>`
      // type-threading resolves that through the primitive's `exports` map
      // (@rozie-ui/combobox devDep). But the EMITTED per-target import is
      // ext-swapped to a cross-package specifier (`@rozie-ui/combobox/Combobox`,
      // `…/Combobox.vue`, `…/Combobox.svelte`), and @rozie/unplugin's composition
      // resolveId only routes LOCAL sibling `.rozie` imports — it has no
      // cross-package branch. Under codegen the specifier is remapped to the
      // LOCAL vendored sibling before compile, so the shipped leaf never hits
      // this; the VR harness compiles the RAW authored source, so we reproduce
      // that vendoring here by aliasing every emitted `@rozie-ui/combobox/Combobox*`
      // import to command-palette's vendored copy (byte-identical to canonical
      // per the D-04 drift guard). The aliased `.rozie` path then flows through
      // the unplugin's standard `.rozie` → synthetic-id resolveId branch ×6.
      {
        find: /^@rozie-ui\/combobox\/Combobox(\.\w+)?$/,
        replacement: resolve(commandPaletteSrc, 'Combobox.rozie'),
      },
    ],
  },
  // Quick task 260515-1y4 — angular only: the Angular sub-build's
  // `import.meta.glob('../../../examples/*.rozie')` pulls files from OUTSIDE
  // the Vite project root (`tests/visual-regression/`). The Angular target's
  // D-70 disk-cache prebuild only walks DOWN from the project root, so
  // without `prebuildExtraRoots` the `<repo>/examples/*.rozie` files never
  // get prebuilt to `.rozie.ts` siblings — cross-rozie composition imports
  // (Card → CardHeader) then fail at Rollup bind time with "Could not
  // resolve './CardHeader' from 'examples/Card.rozie.ts'". Symlinking
  // examples/ into here is blocked by the T-05-04b-03 / WR-01 closure
  // (correct and must stay), so the explicit allowlist is the real fix.
  // Other targets do not need this option (their resolveId+load pipelines
  // consume upstream `code` directly without an on-disk TS Program).
  //
  // The companion `resolveCrossTreeBareImports` plugin closes the second
  // half of the cross-tree gap: prebuilt `examples/Foo.rozie.ts` files
  // import `@angular/core` etc., but those packages live under
  // `tests/visual-regression/node_modules/`, not under `examples/`. The
  // bare-import re-resolver uses `createRequire(this config dir)` so
  // resolution happens as if the importer were a sibling of this file.
  plugins: [
    // Scoped to the Angular target only. The Angular sub-build's D-70
    // disk-cache prebuild emits `<repo>/examples/Foo.rozie.ts` files that
    // import `@angular/core` etc.; those deps live under
    // `tests/visual-regression/node_modules/` so Node's upward walk from
    // `<repo>/examples/` doesn't find them. createRequire-from-this-config
    // closes that gap.
    //
    // CRITICAL: do NOT enable this for browser-targeted builds (Solid, Lit,
    // …). Node's `createRequire().resolve()` walks package.json `exports`
    // with default conditions `require`/`import`/`node` and never
    // `browser` — so `solid-js/web` would resolve to its SSR `dist/server.js`
    // instead of `dist/web.js`, and the runtime throws
    // "Client-only API called on the server side" when components mount.
    // The other targets' `.rozie.ts/.tsx` virtual modules go through Vite's
    // own resolver, which honors `browser` via vite-plugin-solid's
    // `configEnvironment` hook (and the equivalent for other plugins).
    ...(TARGET === 'angular' ? [resolveCrossTreeBareImports([examplesRoot, sortableListSrc, flatpickrSrc, fullCalendarSrc, codeMirrorSrc, chartSrc, tipTapSrc, mapLibreSrc, cropperSrc, pdfSrc, reteSrc, emblaSrc, listboxSrc, sliderSrc, dataTableSrc, otpSrc, dialogSrc, comboboxSrc, toastSrc, tagsSrc, numberFieldSrc, paginationSrc, switchSrc, popoverSrc, datePickerSrc, resizableSrc, commandPaletteSrc, headlessCoreSrc])] : []),
    Rozie({
      target: TARGET,
      ...(TARGET === 'angular' ? { prebuildExtraRoots: [examplesRoot, sortableListSrc, flatpickrSrc, fullCalendarSrc, codeMirrorSrc, chartSrc, tipTapSrc, mapLibreSrc, cropperSrc, pdfSrc, reteSrc, emblaSrc, listboxSrc, sliderSrc, dataTableSrc, otpSrc, dialogSrc, comboboxSrc, toastSrc, tagsSrc, numberFieldSrc, paginationSrc, switchSrc, popoverSrc, datePickerSrc, resizableSrc, commandPaletteSrc, headlessCoreSrc] } : {}),
    }),
    ...(await frameworkPlugins(TARGET)),
  ],
  // FullCalendar plugin packages ship a CJS build whose interop shape is
  // `exports["default"] = plugin` WITHOUT `__esModule`. When Vite's esbuild
  // dep-optimizer pre-bundles them as CJS, a default ES import
  // (`import listPlugin from '@fullcalendar/list'`) resolves to the whole
  // `{ default: plugin }` wrapper object rather than the plugin itself — so
  // `listPlugin.name` is `undefined` and FullCalendar's `buildPluginHooks`
  // throws `Cannot read properties of undefined (reading 'name')` at mount.
  // (This bites the *consumer-supplied* `@fullcalendar/list` import in the
  // all-slots demo, which the dep-optimizer scans from the entry graph; the
  // wrapper's own `@fullcalendar/*` imports dodge it because the cross-tree
  // resolver intercepts them to their ESM entry first.) Excluding the family
  // from pre-bundling makes Vite serve each package's `import`-condition ESM
  // build (`index.js`, a real `export default plugin`) — correct on every
  // target, with no CJS-interop guesswork.
  optimizeDeps: {
    exclude: [
      '@fullcalendar/core',
      '@fullcalendar/daygrid',
      '@fullcalendar/timegrid',
      '@fullcalendar/interaction',
      '@fullcalendar/list',
    ],
  },
  // D-VR-01: the `@rozie/target-lit` emitter emits TC39-stage-3 *class-field*
  // decorators (`@property() foo;`). esbuild — Vite's transform pipeline — does
  // not read the workspace `tsconfig.json` for the `.rozie.ts` virtual modules
  // `@rozie/unplugin` produces, so it defaulted to standard-decorator semantics
  // and the Lit/preact-signals runtime threw `Unsupported decorator location:
  // field` at class-construction time. Passing `tsconfigRaw` with
  // `experimentalDecorators` (and `useDefineForClassFields: false`) tells
  // esbuild to lower Lit's class-field decorators in the legacy form the Lit 3
  // decorator runtime accepts. Scoped to the Lit sub-build only — the other
  // five targets emit no class-field decorators.
  ...(TARGET === 'lit'
    ? {
        esbuild: {
          tsconfigRaw: {
            compilerOptions: {
              experimentalDecorators: true,
              useDefineForClassFields: false,
            },
          },
        },
      }
    : {}),
  build: {
    outDir: resolve(__dirname, 'dist', TARGET),
    // Each target build must NOT wipe sibling target builds.
    emptyOutDir: false,
    // Sourcemaps are OFF for CI / VR matrix builds (the screenshot tests
    // don't need them and they bloat dist/). For manual debugging via the
    // /compare.html iframes, set ROZIE_VR_SOURCEMAP=true (external .map
    // files) or ROZIE_VR_SOURCEMAP=inline (data-URI sourcemaps embedded in
    // the bundles — handy because iframes can't always fetch sibling .map
    // files cleanly).
    sourcemap:
      process.env.ROZIE_VR_SOURCEMAP === 'inline'
        ? 'inline'
        : process.env.ROZIE_VR_SOURCEMAP === 'true',
    // Set ROZIE_VR_MINIFY=false to ship readable bundles for manual
    // debugging — variable names, comments, and module boundaries survive
    // so DevTools "Sources" shows something close to the emitted .ts /
    // .tsx / .vue per-target output. CI / VR matrix runs keep the default
    // (minified via esbuild).
    minify: process.env.ROZIE_VR_MINIFY === 'false' ? false : 'esbuild',
    rollupOptions: {
      input: resolve(__dirname, 'host', `entry.${TARGET}.html`),
    },
  },
  preview: {
    port: 4180,
    strictPort: true,
  },
  };
});
