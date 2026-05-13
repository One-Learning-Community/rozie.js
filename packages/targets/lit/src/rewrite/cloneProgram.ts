/**
 * cloneScriptProgram — deep-clone a Babel `File` node before per-target mutation.
 *
 * Verbatim copy of packages/targets/solid/src/rewrite/cloneProgram.ts — the
 * helper is target-agnostic. Phase 2's IR-04 lock guarantees
 * `componentIR.setupBody.scriptProgram === ast.script.program` (referential
 * identity, no clone at IR-construction time). Per-target emitters that
 * traverse this Babel `File` to rewrite identifier references MUST clone
 * first because a multi-target build pipeline shares the SAME IR across
 * targets — mutating in place would corrupt downstream targets.
 *
 * Implementation per RESEARCH.md Pattern 2:
 *   - `deep: true`        — every descendant is cloned (no shared mutable nodes)
 *   - `withoutLoc: false` — `loc` field preserved on the clone so emitted
 *                            output references original .rozie source positions
 *                            (DX-01 source maps).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { File } from '@babel/types';

export function cloneScriptProgram(file: File): File {
  return t.cloneNode(file, true, false);
}
