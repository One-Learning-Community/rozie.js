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
