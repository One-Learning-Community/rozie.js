/**
 * cloneScriptProgram — deep-clone a Babel `File` node before per-target mutation.
 *
 * Phase 2's IR-04 lock guarantees `componentIR.setupBody.scriptProgram ===
 * ast.script.program` (referential identity — no clone at IR construction
 * time). Phase 3+ target emitters that traverse this Babel `File` to rewrite
 * `$props.x` / `$data.y` / `$refs.z` / `$emit` MUST clone first because
 * Phase 4 (React) and Phase 5 (Svelte/Angular) consume the SAME IR — mutating
 * in place would corrupt downstream targets in a multi-target build.
 *
 * Per packages/core/src/ir/types.ts SetupBody comment lines 249-253:
 *
 *   "Cross-mutation hazard (T-2-05-01): per-target emitters MUST clone the
 *    Program before mutation if they need to mutate. Plan 05 documents this
 *    but does not enforce immutability at runtime (Object.freeze on Babel
 *    ASTs is too costly)."
 *
 * Implementation per RESEARCH.md Pattern 2 (lines 324-330): use
 * `t.cloneNode(file, deep=true, withoutLoc=false)` so:
 *   - `deep: true`        — every descendant is cloned (no shared mutable nodes)
 *   - `withoutLoc: false` — `loc` field preserved on the clone, so the clone's
 *                            @babel/generator output references the original
 *                            .rozie source positions (DX-01 source maps).
 *
 * Mirror of packages/targets/vue/src/rewrite/cloneProgram.ts.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { File } from '@babel/types';

export function cloneScriptProgram(file: File): File {
  return t.cloneNode(file, true, false);
}
