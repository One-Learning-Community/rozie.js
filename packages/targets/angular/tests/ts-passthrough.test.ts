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

// WR-01 + ROOT CAUSE 1 regression — a callback typed via its DECLARATOR ID
// (`const f: (e: MouseEvent) => void = (e) => {…}`) must keep the author's
// `MouseEvent`. The arrow becomes a class field; the field rebuild must
// re-emit the declarator annotation (`f: (e: MouseEvent) => void = …`) — it is
// the sole type carrier once typeNeutralizeScript correctly leaves the
// contextually-typed param bare instead of `: any`-stamping it.
const DECLARATOR_TYPED_SRC = `<rozie name="DeclTyped">
<script lang="ts">
const onMove: (e: MouseEvent) => void = (e) => { document.title = String(e.clientX); };
</script>
<template><button @mousemove="onMove">go</button></template>
</rozie>`;

describe('ts-passthrough — declarator-id-typed callback (WR-01 / ROOT CAUSE 1+2)', () => {
  it('keeps the author MouseEvent: declarator annotation survives onto the class field', () => {
    const code = compileSource(DECLARATOR_TYPED_SRC, 'DeclTyped.rozie');
    expect(code).toContain('onMove: (e: MouseEvent) => void');
    // The param must NOT be `: any`-stamped — it is contextually typed by the
    // class-field annotation. A typo `e.clientXX` would then be a tsc error.
    expect(code).not.toMatch(/\be: any\b/);
  });
});

// WR-02 regression — a `<script lang="ts">` type-reference identifier that
// COLLIDES with a promoted class-member name must NOT be rewritten into a
// `this.` member access inside the type annotation. Angular's `rewriteScript`
// Identifier visitor rewrites every bare reference to a `<script>` function /
// computed into `this.X` / `this.X()`. Without the `isInTypePosition` guard a
// generic type parameter named `compute` (a pure type-level identifier
// sharing a name with the `<script>` function `compute`) would be mangled to
// `this.compute` inside the `: compute` annotations, producing invalid TS.
const TYPE_COLLISION_SRC = `<rozie name="TypeCollision">
<props>
{
  step: { type: Number, default: 1 }
}
</props>
<script lang="ts">
function compute(): number {
  return $props.step * 2
}
// \`compute\` here is a GENERIC TYPE PARAMETER — a pure type-level identifier
// sharing the name of the \`<script>\` function above. Only the runtime call
// may be rewritten to \`this.compute()\`; the type-position uses survive.
function identity<compute>(x: compute): compute {
  return x
}
const probe = identity<number>(compute())
</script>
<template>
  <button @click="probe">{{ compute() }}</button>
</template>
</rozie>`;

describe('ts-passthrough — type-reference / class-member name collision (WR-02)', () => {
  it('does NOT rewrite a type-position identifier colliding with a class-member name', () => {
    const code = compileSource(TYPE_COLLISION_SRC, 'TypeCollision.rozie');
    // `identity` is promoted to a class-field arrow; its generic param and the
    // type-position `compute` uses survive verbatim — NOT rewritten to `this.`.
    expect(code).toContain('(x: compute): compute');
    expect(code).not.toContain('x: this.compute');
    expect(code).not.toContain('): this.compute');
    // The genuine RUNTIME call to the `<script>` function `compute` IS still
    // rewritten to the Angular `this.` member access — proving the guard is
    // narrow, not a blanket disable.
    expect(code).toContain('this.identity<number>(this.compute())');
  });
});
