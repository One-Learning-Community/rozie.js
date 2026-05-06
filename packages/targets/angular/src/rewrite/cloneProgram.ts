/**
 * cloneScriptProgram — Phase 5 Plan 05-04a Task 1.
 *
 * Deep-clone a Babel `File` node before per-target mutation. Phase 2's IR-04
 * lock guarantees `componentIR.setupBody.scriptProgram === ast.script.program`
 * (referential identity). Per-target emitters MUST clone before mutating in a
 * multi-target build to avoid corrupting downstream emitters.
 *
 * Mirror of packages/targets/react/src/rewrite/cloneProgram.ts and
 * packages/targets/svelte/src/rewrite/cloneProgram.ts.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { File } from '@babel/types';

export function cloneScriptProgram(file: File): File {
  return t.cloneNode(file, true, false);
}
