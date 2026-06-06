// Cross-target compile gate for the vanilla-JS-engine example wrappers.
//
// These examples are the "killer demo" set — each one wraps a popular
// framework-agnostic JS library (SortableJS, Flatpickr, Leaflet, Chart.js,
// …) and is exposed to consumers as a ready-to-use cross-framework
// component. They are the canonical exhibit for "Rozie ports the wrapper
// once, ship to all 6 frameworks."
//
// Per-target byte-identity is enforced separately by the parity suite for
// the fixture-frozen Counter/Modal/etc. set. This file only asserts that
// each wrapper + its companion demo compiles cleanly (zero error
// diagnostics) on every target — a regression gate for the engine-wrapper
// authoring pattern itself.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile, type CompileTarget } from '../src/compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');
const REPO_ROOT = resolve(__dirname, '../../..');

// SortableList + Flatpickr + FullCalendar + CodeMirror + Chart graduated from
// examples into their @rozie-ui/<product> packages (git-mv'd examples/<Name>.rozie
// -> packages/ui/<product>/src/<Name>.rozie). They are still the canonical
// engine-wrapper exhibits for this compile gate, so resolve them from the
// package path. All other wrappers still live under examples/.
const PKG_WRAPPER_SRC: Record<string, string> = {
  'SortableList.rozie': 'packages/ui/sortable-list/src/SortableList.rozie',
  'Flatpickr.rozie': 'packages/ui/flatpickr/src/Flatpickr.rozie',
  'FullCalendar.rozie': 'packages/ui/fullcalendar/src/FullCalendar.rozie',
  'CodeMirror.rozie': 'packages/ui/codemirror/src/CodeMirror.rozie',
  // Phase 30 — LineChart.rozie generalized to the generic Chart.rozie (full
  // controller set) and moved into @rozie-ui/chartjs.
  'Chart.rozie': 'packages/ui/chartjs/src/Chart.rozie',
  // Phase 32 — TipTap.rozie moved into @rozie-ui/tiptap and expanded feature-rich
  // (8 props / 4 events / 14 $expose / 1 toolbar portal slot).
  'TipTap.rozie': 'packages/ui/tiptap/src/TipTap.rozie',
};
function resolveEngineWrapper(file: string): string {
  const pkg = PKG_WRAPPER_SRC[file];
  if (pkg) return resolve(REPO_ROOT, pkg);
  return resolve(EXAMPLES_DIR, file);
}

const TARGETS: CompileTarget[] = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

// Single-file engine wrappers (each wraps one vanilla-JS library).
const ENGINE_WRAPPERS = [
  'SortableList.rozie',
  'Flatpickr.rozie',
  'LeafletMap.rozie',
  // Phase 30 — the generic Chart.js wrapper (was LineChart.rozie; now the full
  // controller set, moved into packages/ui/chartjs/src/Chart.rozie).
  'Chart.rozie',
  'TipTap.rozie',
  'Uppy.rozie',
  'FullCalendar.rozie',
  // Spike 003 portal-slot demonstration. PortalList ships its own inline
  // vanilla-JS "engine" so the exhibit has no third-party deps; the wrapper
  // exercises the same authoring + lowering path the third-party engines do.
  'PortalList.rozie',
  // CodeMirror (added 2026-05-19) — r-model:value through a non-input
  // contenteditable engine. Two-way binding archetype for engine-mediated
  // value flows; consumer edits flow back via an `updateListener` extension,
  // not a DOM input event.
  'CodeMirror.rozie',
] as const;

// Multi-file consumer demos. Each imports its sibling engine wrapper via
// a <components> block, so compilation needs resolverRoot pointing at
// examples/.
const ENGINE_DEMOS = [
  'demos/SortableListDemo.rozie',
  'demos/FlatpickrDemo.rozie',
  'demos/LeafletMapDemo.rozie',
  'demos/LineChartDemo.rozie',
  'demos/TipTapDemo.rozie',
  'demos/UppyDemo.rozie',
  'demos/FullCalendarDemo.rozie',
  'demos/CodeMirrorDemo.rozie',
  // Phase 29 Plan 04 — the content-stable screenshot demo (D-07 tier 2). A
  // SEPARATE consumer from CodeMirrorDemo: fixed doc + theme=light + the
  // screenshotStable EditorView.theme via :extensions. Compiled here so a
  // per-target consumer-side regression surfaces in this fast gate, not just
  // the Docker-backed VR pipeline.
  'demos/CodeMirrorScreenshotDemo.rozie',
  // Phase 30 (chartjs) — the deterministic multi-type SCREENSHOT consumer
  // (line+bar+doughnut grid, animation:false) and the behavioral type-switching
  // consumer (line->bar->doughnut + @click + :plugins + the tooltip portal-slot
  // consumer-fill). Both import ../../packages/ui/chartjs/src/Chart.rozie;
  // compiled here so a per-target consumer-side regression (notably the tooltip
  // slot fill across all 6 targets) surfaces in this fast gate.
  'demos/ChartScreenshotDemo.rozie',
  'demos/ChartBehaviorDemo.rozie',
  // Phase 32 (tiptap) — the content-stable SCREENSHOT consumer (fixed rich doc +
  // caret-neutralized editorProps, never focused) and the behavioral consumer
  // (internal-toolbar bullet-list command + the $expose handle via ref). Both
  // import ../../packages/ui/tiptap/src/TipTap.rozie; compiled here so a
  // per-target consumer-side regression surfaces in this fast gate.
  'demos/TipTapScreenshotDemo.rozie',
  'demos/TipTapBehaviorDemo.rozie',
] as const;

describe('engine-wrapper examples — cross-target compile gate', () => {
  describe.each(ENGINE_WRAPPERS)('%s (engine wrapper)', (file) => {
    const path = resolveEngineWrapper(file);
    const source = readFileSync(path, 'utf8');
    it.each(TARGETS)('compiles to %s with zero errors', (target) => {
      const result = compile(source, { target, filename: path });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toEqual([]);
      expect(result.code.length).toBeGreaterThan(0);
    });
  });

  describe.each(ENGINE_DEMOS)('%s (consumer demo)', (file) => {
    const path = resolve(EXAMPLES_DIR, file);
    const source = readFileSync(path, 'utf8');
    it.each(TARGETS)('compiles to %s with zero errors', (target) => {
      const result = compile(source, {
        target,
        filename: path,
        resolverRoot: EXAMPLES_DIR,
      });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toEqual([]);
      expect(result.code.length).toBeGreaterThan(0);
    });
  });

  // VR-rig demos live under `examples/demos/` and exist purely to drive
  // visual-regression screenshots — they import their canonical sibling from
  // `../<Name>.rozie`. Adding the portal-list one to the compile gate ensures
  // a per-target consumer-side regression surfaces here instead of waiting for
  // the (slower, Docker-backed) VR pipeline to catch it.
  const VR_DEMOS = ['PortalListDemo.rozie'] as const;
  describe.each(VR_DEMOS)('%s (vr demo)', (file) => {
    const path = resolve(EXAMPLES_DIR, 'demos', file);
    const source = readFileSync(path, 'utf8');
    it.each(TARGETS)('compiles to %s with zero errors', (target) => {
      const result = compile(source, {
        target,
        filename: path,
        resolverRoot: EXAMPLES_DIR,
      });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toEqual([]);
      expect(result.code.length).toBeGreaterThan(0);
    });
  });
});
