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

const TARGETS: CompileTarget[] = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

// Single-file engine wrappers (each wraps one vanilla-JS library).
const ENGINE_WRAPPERS = [
  'SortableList.rozie',
  'Flatpickr.rozie',
  'LeafletMap.rozie',
  'LineChart.rozie',
  'TipTap.rozie',
  'Uppy.rozie',
  'FullCalendar.rozie',
  // Spike 003 portal-slot demonstration. PortalList ships its own inline
  // vanilla-JS "engine" so the exhibit has no third-party deps; the wrapper
  // exercises the same authoring + lowering path the third-party engines do.
  'PortalList.rozie',
] as const;

// Multi-file consumer demos. Each imports its sibling engine wrapper via
// a <components> block, so compilation needs resolverRoot pointing at
// examples/.
const ENGINE_DEMOS = [
  'SortableListDemo.rozie',
  'FlatpickrDemo.rozie',
  'LeafletMapDemo.rozie',
  'LineChartDemo.rozie',
  'TipTapDemo.rozie',
  'UppyDemo.rozie',
  'FullCalendarDemo.rozie',
] as const;

describe('engine-wrapper examples — cross-target compile gate', () => {
  describe.each(ENGINE_WRAPPERS)('%s (engine wrapper)', (file) => {
    const path = resolve(EXAMPLES_DIR, file);
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
