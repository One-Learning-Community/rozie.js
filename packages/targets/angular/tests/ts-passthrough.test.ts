// Phase 9 Plan 09-04 Task 1 — Angular `<script lang="ts">` author-annotation
// survival + statement-position type hoisting (OQ-3 / RESEARCH Pattern 5).
//
// Angular emits a class-based standalone component. Its `partitionUserImports`
// already hoists `import` statements out of the class body, but a
// `TSInterfaceDeclaration` / `TSTypeAliasDeclaration` declared in `<script>`
// would fall through the residual-statement loop into the CONSTRUCTOR body —
// and an `interface`/`type` declaration inside a class body (or a method body)
// is a TypeScript syntax error (TS1068 / TS1184).
//
// This file asserts:
//   (a) author type annotations survive verbatim into the emitted .ts,
//   (b) a `<script>`-declared `interface` / `type` is emitted at MODULE scope —
//       outside the `@Component`-decorated class — NOT in the class body,
//   (c) `import type { … }` is hoisted to module top,
//   (d) an untyped Counter emit is byte-identical to today (anchor snapshot).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../src/emitAngular.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');

/** Compile an inline `.rozie` source string to Angular `.ts` output. */
function compileSource(source: string, filename = 'TsPassthrough.rozie'): string {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR returned null IR');
  return emitAngular(ir, { filename, source, modifierRegistry: registry }).code;
}

/** Compile a flat `examples/*.rozie` fixture to Angular `.ts` output. */
function compileExample(name: string): string {
  const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
  return compileSource(source, `${name}.rozie`);
}

// A TS-typed component that DECLARES an interface + a type alias in <script>,
// uses a type-only import, and carries author annotations on locals, a
// function parameter, and a callback parameter.
const TYPED_SOURCE = `<rozie name="TypedCounter">
<props>
{ start: { type: Number, default: 0 } }
</props>
<data>
{ count: 0 }
</data>
<script lang="ts">
import type { Item } from './types'

interface Snapshot { count: number; label: string }
type Mode = "idle" | "busy"

let mode: Mode = "idle"
let current: Snapshot | null = null

const increment = (by: number): void => {
  $data.count = $data.count + by
}

function describe(item: Item): string {
  return item.name
}
</script>
<template>
  <button @click="increment(1)">{{ count }}</button>
</template>
</rozie>`;

describe('Angular <script lang="ts"> passthrough — Plan 09-04', () => {
  it('emits a typed component where author annotations survive verbatim', () => {
    const code = compileSource(TYPED_SOURCE);
    // The `: number` parameter annotation on the lifted `increment` arrow.
    expect(code).toMatch(/increment\s*=\s*\(\s*by\s*:\s*number\s*\)/);
    // The `: void` return annotation survives.
    expect(code).toContain(': void');
    // The `describe` function's `Item` parameter type and `string` return.
    expect(code).toMatch(/describe\s*=\s*\(\s*item\s*:\s*Item\s*\)\s*:\s*string/);
    // The `let mode: Mode` annotation survives onto the class field.
    expect(code).toMatch(/mode\s*:\s*Mode/);
    // The `let current: Snapshot | null` annotation survives.
    expect(code).toMatch(/current\s*:\s*Snapshot\s*\|\s*null/);
  });

  it('hoists a <script>-declared interface to MODULE scope, not the class body', () => {
    const code = compileSource(TYPED_SOURCE);
    const ifaceIdx = code.indexOf('interface Snapshot');
    const classIdx = code.indexOf('export class TypedCounter');
    expect(ifaceIdx).toBeGreaterThanOrEqual(0);
    expect(classIdx).toBeGreaterThanOrEqual(0);
    // The interface declaration must appear BEFORE the class opens — i.e. at
    // module scope. If it landed in the constructor body it would appear AFTER
    // `export class TypedCounter`.
    expect(ifaceIdx).toBeLessThan(classIdx);
  });

  it('hoists a <script>-declared type alias to MODULE scope, not the class body', () => {
    const code = compileSource(TYPED_SOURCE);
    const aliasIdx = code.indexOf('type Mode');
    const classIdx = code.indexOf('export class TypedCounter');
    expect(aliasIdx).toBeGreaterThanOrEqual(0);
    expect(aliasIdx).toBeLessThan(classIdx);
  });

  it('does not leave an interface/type declaration inside the class body', () => {
    const code = compileSource(TYPED_SOURCE);
    // Slice the text from the class opening brace to end-of-file and confirm
    // no statement-position type declaration leaked into the class body.
    const classOpen = code.indexOf('export class TypedCounter');
    const classBody = code.slice(classOpen);
    expect(classBody).not.toMatch(/^\s*interface\s/m);
    expect(classBody).not.toMatch(/^\s*type\s+\w+\s*=/m);
  });

  it('hoists `import type { … }` to module top', () => {
    const code = compileSource(TYPED_SOURCE);
    const importIdx = code.indexOf("import type { Item }");
    const classIdx = code.indexOf('export class TypedCounter');
    expect(importIdx).toBeGreaterThanOrEqual(0);
    // The type-only import must precede the class — i.e. be at module top.
    expect(importIdx).toBeLessThan(classIdx);
  });

  it('untyped Counter emit is byte-identical to today (anchor snapshot)', () => {
    const code = compileExample('Counter');
    expect(code).toMatchSnapshot();
  });
});
