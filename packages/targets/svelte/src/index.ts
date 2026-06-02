// @rozie/target-svelte — Phase 5 Plan 05-01 Wave 0 public surface.
// emitSvelte stub coordinator returns a placeholder shell so the snapshot
// harness can run; Plan 05-02 fills in real lowering logic.
export { emitSvelte, type EmitSvelteOptions, type EmitSvelteResult } from './emitSvelte.js';
// Phase 22 Plan 22-03 — Svelte `.d.rozie.ts` renderer (typed `.rozie` imports).
export { emitSvelteTypes } from './emit/emitTypes.js';
export type { EmitSvelteTypesOptions } from './emit/emitTypes.js';
