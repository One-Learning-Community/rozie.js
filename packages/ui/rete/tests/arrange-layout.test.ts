/**
 * arrange-layout.test.ts — the truthful-arrange-geometry leaf structural gate
 * (260826-h7k).
 *
 * THE FAILURE MODE THIS FILE GUARDS: `rete-auto-arrange-plugin@2.0.2`'s built-in
 * classic preset (`m.Presets.classic.setup()`) reports ELK port offsets that
 * match rete's own DEFAULT node view, not FlowCanvas's — and the plugin
 * hard-pins `portConstraints: 'FIXED_POS'` on every node AFTER a preset's
 * `options?.(id)` is spread, so a preset option CANNOT override it. ELK then
 * faithfully aligns each edge's two mismatched endpoints, shifting every
 * successive node in a source→target chain by a FIXED PER-HOP Y OFFSET (a
 * staircase, measured +33px/hop on a 140x52 node chain) — and drags
 * intermediate nodes into the lane ELK reserved for a skip edge, which is why
 * that edge visually cuts through them. The fix replaces the built-in preset
 * with a LOCAL one (`src/internal/arrangeGeometry.ts`, vendored into every
 * leaf by codegen's `copyInternal`) that reports each socket's REAL measured
 * geometry. This file asserts the vendored leaf structure is intact and that
 * the built-in preset registration is gone everywhere it could have leaked
 * back in.
 *
 * BUILD-BEFORE-TEST CONTRACT: every assertion in this file reads EMITTED /
 * COMMITTED leaf output. `pnpm --filter @rozie-ui/rete build` MUST precede
 * `pnpm --filter @rozie-ui/rete test`, or the leaf reads below are stale and
 * this file gives a FALSE GREEN — the same contract `dark-palette-drift.test.ts`
 * states.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKGS = resolve(HERE, '..', 'packages');

/** The emitted FlowCanvas leaf source per target — the file that ships. */
const LEAVES: Array<[target: string, relPath: string]> = [
  ['react', 'react/src/FlowCanvas.tsx'],
  ['vue', 'vue/src/FlowCanvas.vue'],
  ['svelte', 'svelte/src/FlowCanvas.svelte'],
  ['angular', 'angular/src/FlowCanvas.ts'],
  ['solid', 'solid/src/FlowCanvas.tsx'],
  ['lit', 'lit/src/FlowCanvas.ts'],
];

/** The plugin's built-in preset registration this fix removes — must appear on NO leaf. */
const BUILTIN_PRESET = /\bm\s*\.\s*Presets\s*\.\s*classic/;

describe('arrangeGeometry is vendored into every leaf (the truthful port geometry)', () => {
  for (const [target] of LEAVES) {
    it(`${target}: vendors src/internal/arrangeGeometry.ts`, () => {
      const p = resolve(PKGS, target, 'src', 'internal', 'arrangeGeometry.ts');
      expect(existsSync(p), `${p} does not exist — codegen's copyInternal did not vendor it`).toBe(true);
    });
  }

  for (const [target, relPath] of LEAVES) {
    it(`${target}: does not register the plugin's built-in classic preset`, () => {
      const src = readFileSync(resolve(PKGS, relPath), 'utf8');
      const offender = src.split('\n').find((l) => BUILTIN_PRESET.test(l));
      expect(
        offender ?? null,
        `${relPath} still registers m.Presets.classic — the built-in preset reports node-view-mismatched ` +
          `port offsets that ELK's hard-pinned FIXED_POS makes unfixable via options. The local preset ` +
          `(src/internal/arrangeGeometry.ts's arrangePortRect, wired through the component-scope arrangePort) ` +
          `must be the only one registered.`,
      ).toBeNull();
    });
  }

  for (const [target] of LEAVES) {
    it(`${target}: does not vendor a *.test.ts from src/internal/`, () => {
      const p = resolve(PKGS, target, 'src', 'internal', 'arrangeGeometry.test.ts');
      expect(existsSync(p), `${p} exists — codegen's copyInternal filter must exclude *.test.ts`).toBe(false);
    });
  }
});

/**
 * Phase 84 (D-01/D-03/D-05) — ELK-routed edges (connection.waypoints). Two parallel
 * leaf-structural guards, matching the file's existing style:
 *
 * 1. Every leaf's vendored `internal/arrangeGeometry.ts` must export the new waypoint
 *    geometry helpers — a leaf whose vendored copy is missing them shipped from a stale
 *    build (the same class of drift `arrangeGeometry is vendored into every leaf` above
 *    guards).
 * 2. Every leaf's EMITTED FlowCanvas source must call the signature helper
 *    (`waypointsSignature`) inside its `edgeStyleSig` change-detection signature. This is
 *    the six-target guard on the phase's single highest-risk line (84-CONTEXT.md D5): a
 *    leaf that regenerated without it would silently ship the "autoArrange() writes a
 *    correct route, but the canvas never redraws a pre-existing edge" no-op on THAT target
 *    only, while the other five stayed correct — exactly the class of bug a same-source,
 *    six-target compiler is supposed to make impossible, and exactly the class this test
 *    would have caught before a single leaf shipped it.
 *
 * BUILD-BEFORE-TEST CONTRACT (see file header): these assertions read EMITTED / COMMITTED
 * leaf output — `pnpm --filter @rozie-ui/rete build` MUST precede `pnpm --filter
 * @rozie-ui/rete test`, or these reads are stale and this file gives a FALSE GREEN.
 */
const WAYPOINT_EXPORTS = [
  'waypointsFromElkEdges',
  'sanitizeWaypoints',
  'waypointsSignature',
  'withWaypoints',
  'withoutWaypoints',
  'waypointPathD',
];

describe('waypoint geometry helpers are vendored into every leaf, and edgeStyleSig consumes them (Phase 84)', () => {
  for (const [target] of LEAVES) {
    it(`${target}: vendored arrangeGeometry.ts exports every waypoint geometry helper`, () => {
      const p = resolve(PKGS, target, 'src', 'internal', 'arrangeGeometry.ts');
      const src = readFileSync(p, 'utf8');
      const missing = WAYPOINT_EXPORTS.filter((name) => !src.includes(`export function ${name}`));
      expect(
        missing,
        `${p} is missing ${missing.join(', ')} — codegen's copyInternal vendored a stale ` +
          `arrangeGeometry.ts. Rebuild (pnpm --filter @rozie-ui/rete build) before re-running tests.`,
      ).toEqual([]);
    });
  }

  for (const [target, relPath] of LEAVES) {
    it(`${target}: edgeStyleSig calls waypointsSignature (the no-op trap this phase exists to close)`, () => {
      const src = readFileSync(resolve(PKGS, relPath), 'utf8');
      const sigLine = src.split('\n').find((l) => l.includes('edgeStyleSig') && l.includes('=>'));
      expect(
        sigLine ? sigLine.includes('waypointsSignature') : false,
        `${relPath}'s edgeStyleSig does not call waypointsSignature — autoArrange() would write a ` +
          `correct route into the model while this target's reconcileConnections never sees it change, ` +
          `so a PRE-EXISTING edge on ${target} would silently never redraw its route (84-CONTEXT.md D5).`,
      ).toBe(true);
    });
  }
});
