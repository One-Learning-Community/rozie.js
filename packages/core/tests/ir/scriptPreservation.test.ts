// Wave 0 scaffold (Plan 02-01 Task 4) — Plan 02-05 fills these in.
//
// IR-04: <script> Babel Program is preserved through to IRComponent.setupBody.scriptProgram
// so target emitters can rewrite identifier references without re-parsing.
// Risk 5 trust-erosion floor extends to the IR layer: console.log("hello
// from rozie") survives parse → IR.
import { describe, it } from 'vitest';

describe('script preservation through IR — Plan 02-05 (IR-04)', () => {
  it.todo('IRComponent.setupBody.scriptProgram === parse(source).ast.script.program (referential equality OR structural equality stripped of parent pointers — IR-04)');
  it.todo('console.log("hello from rozie") in <script> survives to setupBody.scriptProgram verbatim — Risk 5 trust-erosion floor extends to IR layer');
  it.todo('SetupAnnotation[] correctly tags top-level $computed declarators as kind: "computed", lifecycle calls as kind: "lifecycle"');
});
