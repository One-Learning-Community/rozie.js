// Phase 9 Plan 09-02 Task 1 — TS* node tolerance across the semantic +
// IR-lowering passes.
//
// A `<script lang="ts">` Program carries `TS*` Babel AST nodes (type
// annotations, `TSInterfaceDeclaration`, `TSTypeAliasDeclaration`, type
// references). Every `@rozie/core` pass that traverses the script AST must:
//   - NOT crash on a `TS*` node, and
//   - NOT misclassify a type-only construct as a runtime binding / diagnostic.
//
// This file exercises the real pipeline (`parse` → `analyzeAST` → `lowerToIR`)
// on TS-typed `.rozie` sources and asserts:
//   - the unknown-ref / prop-write / reserved-identifier validators run without
//     throwing and without spurious diagnostics for type-only identifiers,
//   - `collectScriptDecls` does not register `interface`/`type` declarations as
//     runtime declarations,
//   - `lowerScript` / `buildAnnotations` classifies `TSInterfaceDeclaration` /
//     `TSTypeAliasDeclaration` as plain declarations and they survive into the
//     IR's script Program.
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parse } from '../../src/parse.js';
import { analyzeAST } from '../../src/semantic/analyze.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import type { RozieAST } from '../../src/ast/types.js';

/** Parse a `.rozie` source; assert the AST is non-null and return it. */
function parseRozie(source: string, filename = 'TsTolerance.rozie'): RozieAST {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return ast;
}

// A TS-typed component declaring an interface + type alias, typed `<data>`-free
// locals, a typed callback param, a typed catch binding, and a genuine runtime
// magic-accessor read inside a $computed.
const TYPED_SOURCE = `<rozie name="TsTolerance">
<props>
{ label: { type: String, default: "hi" } }
</props>
<data>
{ count: 0 }
</data>
<script lang="ts">
interface ItemShape { id: number; name: string }
type Mode = "on" | "off"

let mode: Mode = "off"
let pending: ItemShape | null = null

const doubled = $computed(() => {
  let local: ItemShape | null = pending
  return $data.count * 2
})

function handle(ev: ItemShape) {
  return ev.id
}

$onMount(() => {
  try {
    handle({ id: 1, name: $props.label })
  } catch (err) {
    return undefined
  }
})
</script>
<template><div>{{ doubled }}</div></template>
</rozie>`;

describe('TS* node tolerance — semantic validators', () => {
  it('analyzeAST runs on a TS-typed script without throwing', () => {
    const ast = parseRozie(TYPED_SOURCE);
    expect(() => analyzeAST(ast)).not.toThrow();
  });

  it('emits no spurious unknown-reference diagnostic for a type-only identifier', () => {
    const ast = parseRozie(TYPED_SOURCE);
    const { diagnostics } = analyzeAST(ast);
    // `ItemShape` / `Mode` are pure type references — they must NOT surface as
    // ROZ100..ROZ106 unknown-ref diagnostics. The only valid magic accessors in
    // the source (`$data.count`, `$props.label`) are declared, so a correct run
    // produces zero unknown-ref diagnostics.
    const unknownRef = diagnostics.filter((d) => /^ROZ10[0-6]$/.test(d.code));
    expect(unknownRef).toEqual([]);
  });

  it('emits no prop-write diagnostic — the typed script writes no props', () => {
    const ast = parseRozie(TYPED_SOURCE);
    const { diagnostics } = analyzeAST(ast);
    expect(diagnostics.filter((d) => d.code === 'ROZ200')).toEqual([]);
  });

  it('emits no reserved-identifier collision for a type-only declaration', () => {
    const ast = parseRozie(TYPED_SOURCE);
    const { diagnostics } = analyzeAST(ast);
    expect(diagnostics.filter((d) => d.code === 'ROZ202')).toEqual([]);
  });
});

describe('TS* node tolerance — collectScriptDecls', () => {
  it('does not register interface / type declarations as runtime bindings', () => {
    const ast = parseRozie(TYPED_SOURCE);
    const { bindings } = analyzeAST(ast);
    // `interface ItemShape` and `type Mode` are type-only — they must not enter
    // the computeds / data / props / refs runtime binding tables. `doubled` IS
    // a real $computed and SHOULD be present (proves the collector still works).
    expect(bindings.computeds.has('ItemShape')).toBe(false);
    expect(bindings.computeds.has('Mode')).toBe(false);
    expect(bindings.data.has('ItemShape')).toBe(false);
    expect(bindings.props.has('Mode')).toBe(false);
    expect(bindings.computeds.has('doubled')).toBe(true);
  });
});

describe('TS* node tolerance — lowerScript / buildAnnotations', () => {
  it('lowerToIR does not throw on a script with a TSInterfaceDeclaration', () => {
    const ast = parseRozie(TYPED_SOURCE);
    expect(() =>
      lowerToIR(ast, { modifierRegistry: createDefaultRegistry() }),
    ).not.toThrow();
  });

  it('the interface + type-alias statements survive into the IR script Program', () => {
    const ast = parseRozie(TYPED_SOURCE);
    const { ir } = lowerToIR(ast, {
      modifierRegistry: createDefaultRegistry(),
    });
    expect(ir).not.toBeNull();
    const body = ir!.setupBody.scriptProgram.program.body;
    const hasInterface = body.some((s) => t.isTSInterfaceDeclaration(s));
    const hasTypeAlias = body.some((s) => t.isTSTypeAliasDeclaration(s));
    expect(hasInterface).toBe(true);
    expect(hasTypeAlias).toBe(true);
  });

  it('buildAnnotations produces one annotation per top-level statement, type decls included', () => {
    const ast = parseRozie(TYPED_SOURCE);
    const { ir } = lowerToIR(ast, {
      modifierRegistry: createDefaultRegistry(),
    });
    expect(ir).not.toBeNull();
    const body = ir!.setupBody.scriptProgram.program.body;
    // Every statement — including TSInterfaceDeclaration / TSTypeAliasDeclaration
    // — must be annotated; buildAnnotations buckets unknown statement types into
    // its `plain-decl` catch-all rather than throwing.
    expect(ir!.setupBody.annotations.length).toBe(body.length);
  });
});
