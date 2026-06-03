// Phase 13 Plan 13-01 — React `$classSelector` emit test.
// Phase 25 Plan 25-01 — REBLESSED: React no longer hashes class names via CSS
// Modules. `$classSelector('grip')` now lowers to the static compile-time
// selector `"." + "grip"` (identical to the other five targets), and the
// component emits a plain side-effect `import './<Name>.css'` rather than a
// CSS-Modules default `import styles from './<Name>.module.css'`. The
// `styles` symbol no longer exists in emitted React output.
//
// `$classSelector('<class>')` is the Phase 13 helper that lowers a class name
// to a CSS selector matching the class as it actually renders at runtime.
// After Phase 25, React class names are NOT hashed, so a plain `".grip"`
// matches the rendered DOM directly — `$classSelector` becomes a convenience
// rather than a necessity.
//
// Covers (per 13-VALIDATION Requirement -> Test Map, updated for Phase 25):
//   R1 — `$classSelector('grip')` compiles with no error diagnostic.
//   R2 — emitted output lowers to the static `"." + "grip"` selector for BOTH
//        the `<script>`-position call AND the `:attr`-position call.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitReact } from '../emitReact.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

/** Compile `examples/ClassSelectorProbe.rozie` to React `.tsx` output. */
function compileProbe(): { code: string; diagnostics: Diagnostic[] } {
  const filename = 'ClassSelectorProbe.rozie';
  const source = readFileSync(resolve(ROOT, `examples/${filename}`), 'utf8');
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  const registry = createDefaultRegistry();
  const { ir, diagnostics: lowerDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
  });
  if (!ir) throw new Error('lowerToIR returned null IR');
  const emitted = emitReact(ir, { filename, source, modifierRegistry: registry });
  return {
    code: emitted.code,
    diagnostics: [...parseDiags, ...lowerDiags, ...emitted.diagnostics],
  };
}

/** Lower an inline `.rozie` source to IR. */
function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

describe('$classSelector emit (React) — Phase 25 static plain-string lowering', () => {
  it("R1: ClassSelectorProbe compiles with no error diagnostic", () => {
    const { diagnostics } = compileProbe();
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
  });

  it("R2: <script>-position $classSelector('grip') lowers to a static \".\" + \"grip\" selector", () => {
    const { code } = compileProbe();
    // Phase 25 — React lowers `$classSelector('grip')` to `"." + "grip"`.
    expect(code).toContain('"." + "grip"');
    // No `styles` CSS-Modules symbol survives.
    expect(code).not.toMatch(/\bstyles\./);
    // The raw helper call must NOT survive into emitted output.
    expect(code).not.toContain('$classSelector');
  });

  it("R2: :attr-position $classSelector('panel') lowers to a static \".\" + \"panel\" selector", () => {
    const { code } = compileProbe();
    // The :data-handle binding flows through rewriteTemplateExpression.ts.
    expect(code).toContain('"." + "panel"');
    expect(code).not.toContain('$classSelector');
  });

  it("R2: hyphenated class lowers to a plain string literal (no bracket member access)", () => {
    const ir = lowerInline(`
<rozie name="HyphenProbe">
<script>
const sel = $classSelector('my-handle')
</script>
<template>
<div class="my-handle">x</div>
</template>
<style>
.my-handle { cursor: grab; }
</style>
</rozie>
`);
    const { code } = emitReact(ir, { filename: 'HyphenProbe.rozie' });
    // Hyphenated class is now a plain string literal — no `styles['my-handle']`.
    expect(code).toContain('"." + "my-handle"');
    expect(code).not.toMatch(/\bstyles\[/);
    expect(code).not.toContain('$classSelector');
  });

  it("ROZ968 guard removed: $classSelector on a component compiled WITHOUT opts.source no longer errors", () => {
    // Phase 25 — `$classSelector` lowers to a static string with NO `styles`
    // dependency, so the obsolete ROZ968 CLASS_SELECTOR_REACT_NO_SOURCE guard
    // is gone. Compiling without `opts.source` must NOT emit any error.
    const ir = lowerInline(`
<rozie name="NoSourceProbe">
<script>
const sel = $classSelector('grip')
</script>
<template>
<div class="grip">x</div>
</template>
<style>
.grip { cursor: grab; }
</style>
</rozie>
`);
    // NOTE: no `source` passed — the back-compat no-source emit path.
    const emitted = emitReact(ir, { filename: 'NoSourceProbe.rozie' });
    const errors = emitted.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
    expect(emitted.code).toContain('"." + "grip"');
  });
});
