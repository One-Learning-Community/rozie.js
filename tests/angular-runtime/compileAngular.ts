/**
 * Shared harness helper for tests/angular-runtime.
 *
 * D-07b (2026-08-18) supersedes this file's original content: it used to
 * host `evalEsModule` + `babelTransformAngular`, extracted from
 * tests/timing/SearchInput.debounce.parity.test.ts to drive a hand-rolled
 * Babel-decorator-strip + `new Function()` eval pipeline against a JIT
 * TestBed. That whole pipeline is dead — JIT cannot discover signal-based
 * `contentChildren()` queries at all (see 80-CONTEXT.md D-07b). This harness
 * now compiles fixtures through REAL ngtsc AOT via the Vite pipeline
 * (`@rozie/unplugin` + `@analogjs/vite-plugin-angular`, wired in
 * vitest.config.ts) and mounts them with plain ES `import` statements —
 * `evalEsModule` and `babelTransformAngular` have no remaining callers and
 * are deliberately not carried forward.
 *
 * `compileAngular` survives because `fixtures.compile.test.ts` (Task 2)
 * needs to assert on the raw emitted TEXT of each fixture (e.g. "the
 * producer declares a `templates` signal input", "no consumer emits a
 * `ContentChild` capture") without going through Vite at all — a plain
 * Node-level parse -> lowerToIR -> emitAngular call is the simplest way to
 * get that text.
 */
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitAngular } from '@rozie/target-angular';

/**
 * Compile a `.rozie` source string to Angular output through the standard
 * parse -> lowerToIR -> emitAngular pipeline. Throws if any stage fails to
 * produce an `ast`/`ir`.
 */
export function compileAngular(src: string, filename: string): string {
  const parseRes = parse(src, { filename });
  if (!parseRes.ast) throw new Error(`parse failed for ${filename}`);
  const lowerRes = lowerToIR(parseRes.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowerRes.ir) throw new Error(`lowerToIR failed for ${filename}`);
  const { code } = emitAngular(lowerRes.ir, { filename, source: src });
  return code;
}
