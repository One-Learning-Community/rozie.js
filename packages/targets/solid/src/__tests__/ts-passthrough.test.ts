// Phase 09 Plan 03 Task 1 — Solid `<script lang="ts">` author-annotation
// survival.
//
// `@babel/generator` prints `TS*` nodes verbatim, so author annotations on the
// cloned-and-rewritten script Program survive for free through Solid's
// clone→rewrite→generate path. Solid's emitScript has NO module-let hoisting
// (top-level `let X = init` declarations fall through verbatim into the
// residual `filteredStmts` Program — there is no typed signal/ref wrapper for
// module lets), so OQ-2 has no Solid analog: the author's `let editor: Editor
// | null = null` is emitted as-is, type intact.
//
// This suite locks:
//   - author type annotations on `let`/`const`/params survive into the `.tsx`
//   - `import type { … }` is hoisted to module top
//   - `interface`/`type` declared in `<script>` survive in the component body
//   - untyped emit is byte-identical to today (no dist-parity drift)

import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../emitSolid.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'TsPassthrough.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  const result = emitSolid(lowered.ir, { filename: 'TsPassthrough.rozie', source: src });
  return result.code;
}

const TYPED_SRC = `<rozie name="TsPassthrough">
<props>
{
  label: { type: String, default: 'Count' }
}
</props>
<script lang="ts">
import type { EditorOptions } from './editor-types';
interface InternalShape { id: number; ready: boolean }
type Mode = 'idle' | 'busy';
let count: number = 0;
let editor: Editor | null = null;
let mode: Mode = 'idle';
function inc(by: number): void {
  count = count + by;
}
$onMount(() => {
  editor = makeEditor();
});
$onUnmount(() => {
  editor = null;
});
</script>
<template>
  <button @click="inc(1)">{{ label }}: {{ count }}</button>
</template>
</rozie>`;

const UNTYPED_SRC = `<rozie name="TsPassthrough">
<props>
{
  label: { type: String, default: 'Count' }
}
</props>
<script>
let count = 0;
let editor = null;
let mode = 'idle';
function inc(by) {
  count = count + by;
}
$onMount(() => {
  editor = makeEditor();
});
$onUnmount(() => {
  editor = null;
});
</script>
<template>
  <button @click="inc(1)">{{ label }}: {{ count }}</button>
</template>
</rozie>`;

describe('Solid ts-passthrough — author annotation survival (Phase 09 Plan 03 Task 1)', () => {
  it('compiles a typed .rozie to a .tsx preserving author annotations', () => {
    const code = compile(TYPED_SRC);
    expect(code).toMatchSnapshot('typed-tsx');
  });

  it('preserves the typed `let count: number` and typed `inc(by: number)` param', () => {
    const code = compile(TYPED_SRC);
    expect(code).toContain('count: number');
    expect(code).toContain('by: number');
  });

  it('preserves a typed module-let `let editor: Editor | null` verbatim', () => {
    const code = compile(TYPED_SRC);
    // Solid emits module-lets as-is — author type intact (no useRef analog).
    expect(code).toContain('editor: Editor | null');
  });

  it('hoists `import type { … }` to module top of the .tsx', () => {
    const code = compile(TYPED_SRC);
    expect(code).toContain("import type { EditorOptions } from './editor-types';");
    const importIdx = code.indexOf('import type { EditorOptions }');
    const fnIdx = code.indexOf('function TsPassthrough');
    expect(importIdx).toBeGreaterThanOrEqual(0);
    expect(fnIdx).toBeGreaterThan(importIdx);
  });

  it('preserves an author `interface` / `type` declared in <script>', () => {
    const code = compile(TYPED_SRC);
    expect(code).toContain('interface InternalShape');
    expect(code).toContain("type Mode = 'idle' | 'busy'");
  });
});

describe('Solid ts-passthrough — untyped emit byte-identity anchor', () => {
  it('untyped emit is byte-identical to today (snapshot anchor)', () => {
    const code = compile(UNTYPED_SRC);
    expect(code).toMatchSnapshot('untyped-tsx-anchor');
  });
});

// WR-01 + ROOT CAUSE 1 regression — a callback typed via its DECLARATOR ID
// (`const f: (e: MouseEvent) => void = (e) => {…}`) must keep the author's
// `MouseEvent`. Solid hoists top-level `const` arrows to `function`
// declarations; the hoist must re-project the declarator function-type's
// param + return types onto the rebuilt FunctionDeclaration (a `function`'s
// `id` cannot carry a type annotation), and typeNeutralizeScript must NOT
// `: any`-stamp the contextually-typed param.
const DECLARATOR_TYPED_SRC = `<rozie name="DeclTyped">
<script lang="ts">
const onMove: (e: MouseEvent) => void = (e) => { document.title = String(e.clientX); };
</script>
<template><button @mousemove="onMove">go</button></template>
</rozie>`;

describe('Solid ts-passthrough — declarator-id-typed callback (WR-01 / ROOT CAUSE 1+2)', () => {
  it('keeps the author MouseEvent: hoisted function carries the re-projected param type', () => {
    const code = compile(DECLARATOR_TYPED_SRC);
    // The declarator function-type's param + return survive onto the hoist.
    expect(code).toContain('function onMove(e: MouseEvent): void');
    // The param must NOT be `: any`-stamped.
    expect(code).not.toMatch(/\be: any\b/);
  });
});

// WR-02 regression — a `<script lang="ts">` type-reference identifier that
// COLLIDES with a `$computed` runtime name must NOT be rewritten into a
// runtime accessor inside the type annotation. Solid's `rewriteScript`
// Identifier visitor rewrites a bare `$computed` name to `name()`; without the
// `isInTypePosition` guard a generic type parameter named `total` (a pure
// type-level identifier) would be mangled to `total()` inside the `: total`
// param / return annotations, producing invalid TS. The guard lives in
// `@rozie/core` (ast/typePosition.ts) and is shared with computeDeps.
const TYPE_COLLISION_SRC = `<rozie name="TypeCollision">
<props>
{
  step: { type: Number, default: 1 }
}
</props>
<script lang="ts">
const total = $computed(() => $props.step * 2)
// \`total\` here is a GENERIC TYPE PARAMETER — a pure type-level identifier
// that happens to share the name of the $computed memo above. The runtime
// \`total\` and the type-level \`total\` are distinct; the rewriter must touch
// only the runtime one.
function identity<total>(x: total): total {
  return x
}
const probe = identity<number>(total)
</script>
<template>
  <button @click="probe">{{ total }}</button>
</template>
</rozie>`;

describe('Solid ts-passthrough — type-reference / $computed name collision (WR-02)', () => {
  it('does NOT rewrite a type-position identifier colliding with a $computed name', () => {
    const code = compile(TYPE_COLLISION_SRC);
    // The generic param + its type-position uses survive verbatim — NOT `total()`.
    expect(code).toContain('function identity<total>(x: total): total');
    expect(code).not.toContain('x: total()');
    expect(code).not.toContain('): total()');
    // The genuine RUNTIME read of the $computed `total` IS still rewritten to
    // the Solid accessor call — proving the guard is narrow, not a blanket
    // disable. `identity<number>(total)` passes the runtime memo value.
    expect(code).toContain('identity<number>(total())');
  });
});
