// Phase 73 Plan 04 — emitter-hardening backlog #10 ("Lit `<script>` parser
// rejects `import type` / inline `type` (codemirror) — forces a lit-only
// `: any` for transitive engine types (TS2742)").
//
// PREMISE FALSIFIED — no red reproduces against the current emitter.
//
// `parseScript.ts` (:96-104) already enables the `typescript` Babel plugin
// for `<script lang="ts">`, so `import type { X } from 'pkg'` parses as a
// real `ImportDeclaration` (`importKind: 'type'`) rather than being rejected.
// `partitionUserImports.ts` hoists EVERY top-level `ImportDeclaration` — value
// AND type-only alike, it does not branch on `importKind` at all (see its own
// doc comment: "Type-only imports ... and value imports are treated
// identically") — into the module-top `userImports` bucket. Nothing in the
// Lit pipeline special-cases or drops a type-only import.
//
// This is independently proven end-to-end, not just by this new guard:
//   - `packages/targets/lit/tests/ts-passthrough.test.ts` ("hoists `import
//     type { … }` to module top") already locks this exact shape.
//   - `examples/typed/TypedCard.rozie` (the Phase 9 dogfood fixture)
//     `import type { Options } from 'sortablejs'` and consumes it in a typed
//     function parameter; `tests/lit-lint/lit-lint.test.ts`'s "LIT-TSC
//     (typed)" suite compiles it to Lit and runs a REAL `tsc --noEmit` over
//     the output (against an ambient `sortablejs` stub) — green today.
//
// The `: any` hand-patch actually found in the shipped `@rozie-ui/codemirror`
// Lit leaf (`packages/ui/codemirror/packages/lit/src/CodeMirror.ts`,
// `themeExt = (): any => {...}`) is UNRELATED to this premise:
// `CodeMirror.rozie`'s `<script>` has NO `lang="ts"` at all (plain JS, zero
// author type annotations anywhere in the source) — there is no `import
// type` for any parser to reject or drop, because none is ever written. The
// TS2742 there is a return-type-INFERENCE limit (strict `tsc` can't name an
// externally-imported `@codemirror/state` `Extension` type on a class field
// when the author supplies NO annotation at all for tsc to fall back to) —
// a different failure shape than "the parser rejects `import type`", and
// not addressable by "teach the parser `import type`" since the parser
// already accepts it — there's simply nothing typed in that particular
// source to preserve.
//
// This guard locks the CORRECT, already-working behavior this plan
// re-verified: an author-annotated function whose return type is a
// type-only-imported TRANSITIVE ENGINE TYPE (the closest analogue to
// codemirror's actual shape — an external editor-engine type threaded
// through a local helper) survives verbatim to the Lit class field, with NO
// `: any` substitution anywhere.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../src/emitLit.js';

function compile(source: string, name: string): string {
  const { ast, diagnostics } = parse(source, { filename: `${name}.rozie` });
  if (!ast) {
    throw new Error(`parse() failed: ${JSON.stringify(diagnostics)}`);
  }
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() returned null');
  ir.name = name;
  return emitLit(ir, {
    filename: `${name}.rozie`,
    source,
    modifierRegistry: registry,
  }).code;
}

// Mirrors CodeMirror's actual shape (an external editor-engine `Extension`
// type threaded through a compartment-style theme resolver helper) but
// AUTHORED with `lang="ts"` + an explicit annotation — the shape item #10's
// proposed fix ("emit per-target type annotations") would have produced,
// proven to already work without any emitter change.
const TRANSITIVE_ENGINE_TYPE_SRC = `<rozie name="EngineThemeHost">

<props>
{ theme: { type: String, default: 'light' } }
</props>

<script lang="ts">
import type { Extension } from 'some-editor-engine'

// Transitive engine type consumed as a function's RETURN type annotation —
// the codemirror themeExt() shape, but with the author annotation codemirror
// itself omits (its <script> has no lang="ts" at all).
const themeExt = (): Extension | Extension[] => {
  const t = $props.theme
  if (t === 'dark') return [] as Extension[]
  return [] as Extension[]
}

const themeLabel: string = String(themeExt().length)
</script>

<template>
  <div>{{ themeLabel }}</div>
</template>
`;

describe('Lit import type — transitive engine type passthrough (backlog #10, falsified premise guard)', () => {
  it('hoists the type-only import for a transitive engine type to module scope', () => {
    const code = compile(TRANSITIVE_ENGINE_TYPE_SRC, 'EngineThemeHost');
    const importIdx = code.indexOf("import type { Extension } from 'some-editor-engine'");
    const classIdx = code.indexOf('class EngineThemeHost extends');
    expect(importIdx).toBeGreaterThanOrEqual(0);
    expect(classIdx).toBeGreaterThan(0);
    expect(importIdx).toBeLessThan(classIdx);
  });

  it('preserves the author return-type annotation verbatim on the class field — NO `: any` substitution', () => {
    const code = compile(TRANSITIVE_ENGINE_TYPE_SRC, 'EngineThemeHost');
    expect(code).toContain('themeExt = (): Extension | Extension[] =>');
    // The specific bug this backlog item alleged: the transitive engine
    // type gets dropped and replaced with a bare `: any` on Lit. Confirm it
    // does NOT happen anywhere near the themeExt field.
    const fieldIdx = code.indexOf('themeExt = (');
    const fieldLine = code.slice(fieldIdx, code.indexOf('\n', fieldIdx));
    expect(fieldLine).not.toContain(': any');
  });
});
