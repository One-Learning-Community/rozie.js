// Phase 09 Plan 03 Task 1 — React `<script lang="ts">` author-annotation
// survival + OQ-2 module-let `useRef<T>` + `.d.ts` insulation.
//
// `@babel/generator` prints `TS*` nodes verbatim, so author annotations on the
// cloned-and-rewritten script Program survive for free through the dominant
// emitter path. This suite locks that:
//   - author type annotations on `let`/`const`/params survive into the `.tsx`
//   - OQ-2: a typed module-let referenced from a lifecycle hook emits
//     `useRef<AuthorType>(...)` — NOT `useRef<any>(...)`
//   - an untyped module-let still emits `useRef<any>(...)` (the
//     typeNeutralizeScript-injected `: any` fallback)
//   - `import type { … }` is hoisted to module top
//   - `interface`/`type` declared in `<script>` survive in the component body
//   - the synthesized `.d.ts` contains NO author `<script>` type identifier and
//     is byte-identical to the `.d.ts` for the untyped fork of the component
//   - untyped emit is byte-identical to today (no dist-parity drift)

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../src/emitReact.js';
import { emitReactTypes } from '../src/emit/emitTypes.js';

function compile(src: string): { code: string; dts: string } {
  const parsed = parse(src, { filename: 'TsPassthrough.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  const result = emitReact(lowered.ir, { filename: 'TsPassthrough.rozie', source: src });
  const dts = emitReactTypes(lowered.ir);
  return { code: result.code, dts };
}

// A typed Counter exercising: typed `let`, typed function param, a typed
// module-let referenced from `$onMount` (OQ-2), an untyped module-let, an
// `import type`, and an `interface` declaration.
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
let untypedHandle = null;
let mode: Mode = 'idle';
function inc(by: number): void {
  count = count + by;
}
$onMount(() => {
  editor = makeEditor();
  untypedHandle = openHandle();
});
$onUnmount(() => {
  editor = null;
  untypedHandle = null;
});
</script>
<template>
  <button @click="inc(1)">{{ label }}: {{ count }}</button>
</template>
</rozie>`;

// The untyped fork of the same component — identical logic, all annotations
// removed. The `.d.ts` synthesized from this must be byte-identical to the
// typed fork's `.d.ts` (author `<script>` types are component-internal).
const UNTYPED_SRC = `<rozie name="TsPassthrough">
<props>
{
  label: { type: String, default: 'Count' }
}
</props>
<script>
let count = 0;
let editor = null;
let untypedHandle = null;
let mode = 'idle';
function inc(by) {
  count = count + by;
}
$onMount(() => {
  editor = makeEditor();
  untypedHandle = openHandle();
});
$onUnmount(() => {
  editor = null;
  untypedHandle = null;
});
</script>
<template>
  <button @click="inc(1)">{{ label }}: {{ count }}</button>
</template>
</rozie>`;

describe('React ts-passthrough — author annotation survival (Phase 09 Plan 03 Task 1)', () => {
  it('compiles a typed .rozie to a .tsx preserving author annotations', () => {
    const { code } = compile(TYPED_SRC);
    expect(code).toMatchSnapshot('typed-tsx');
  });

  it('preserves the typed `let count: number` and typed `inc(by: number)` param', () => {
    const { code } = compile(TYPED_SRC);
    // `count` is a non-lifecycle-referenced local — survives as residual emit.
    expect(code).toContain('count: number');
    // The typed function param survives verbatim.
    expect(code).toContain('by: number');
  });

  it('OQ-2: a typed module-let referenced from a lifecycle hook emits useRef<AuthorType>', () => {
    const { code } = compile(TYPED_SRC);
    // `editor` is `Editor | null`, referenced from $onMount → hoisted to useRef.
    // The author type — NOT `any` — must be the useRef type argument.
    expect(code).toContain('useRef<Editor | null>(null)');
    expect(code).not.toContain('const editor = useRef<any>(null)');
  });

  it('OQ-2 fallback: an untyped module-let still emits useRef<any>', () => {
    const { code } = compile(TYPED_SRC);
    // `untypedHandle` has no author annotation; typeNeutralizeScript injects
    // `: any`, which must still drive the `useRef<any>` fallback.
    expect(code).toContain('const untypedHandle = useRef<any>(null)');
  });

  it('hoists `import type { … }` to module top of the .tsx', () => {
    const { code } = compile(TYPED_SRC);
    expect(code).toContain("import type { EditorOptions } from './editor-types';");
    const importIdx = code.indexOf('import type { EditorOptions }');
    const fnIdx = code.indexOf('function TsPassthrough');
    expect(importIdx).toBeGreaterThanOrEqual(0);
    expect(fnIdx).toBeGreaterThan(importIdx);
  });

  it('preserves an author `interface` / `type` declared in <script>', () => {
    const { code } = compile(TYPED_SRC);
    expect(code).toContain('interface InternalShape');
    expect(code).toContain("type Mode = 'idle' | 'busy'");
  });
});

describe('React ts-passthrough — .d.ts insulation (closes CONTEXT.md .d.ts decision)', () => {
  it('the synthesized .d.ts contains no author <script> type identifier', () => {
    const { dts } = compile(TYPED_SRC);
    // emitTypes.ts / emitPropsInterface.ts synthesize from the IR props/slots
    // model only — author <script>-internal types must not leak into the
    // public .d.ts.
    expect(dts).not.toContain('InternalShape');
    expect(dts).not.toContain('EditorOptions');
    expect(dts).not.toContain('Mode');
    expect(dts).not.toContain('Editor');
  });

  it('the typed component .d.ts is byte-identical to the untyped fork .d.ts', () => {
    const { dts: typedDts } = compile(TYPED_SRC);
    const { dts: untypedDts } = compile(UNTYPED_SRC);
    expect(typedDts).toBe(untypedDts);
  });
});

describe('React ts-passthrough — untyped emit byte-identity anchor', () => {
  it('untyped emit is byte-identical to today (snapshot anchor)', () => {
    const { code } = compile(UNTYPED_SRC);
    expect(code).toMatchSnapshot('untyped-tsx-anchor');
  });
});

// WR-01 + ROOT CAUSE 1 regression — a callback typed via its DECLARATOR ID
// (`const f: (e: MouseEvent) => void = (e) => {…}`) must keep the author's
// `MouseEvent`: typeNeutralizeScript must NOT `: any`-stamp the contextually-
// typed param, and the React `useCallback` wrap / function-decl hoist must NOT
// drop the declarator-id annotation.
const DECLARATOR_TYPED_SRC = `<rozie name="DeclTyped">
<script lang="ts">
const onMove: (e: MouseEvent) => void = (e) => { document.title = String(e.clientX); };
</script>
<template><button @mousemove="onMove">go</button></template>
</rozie>`;

describe('React ts-passthrough — declarator-id-typed callback (WR-01 / ROOT CAUSE 1+2)', () => {
  it('keeps the author MouseEvent: declarator annotation survives, param stays bare', () => {
    const { code } = compile(DECLARATOR_TYPED_SRC);
    // The declarator annotation must survive the useCallback/hoist rebuild.
    expect(code).toContain('onMove: (e: MouseEvent) => void');
    // The param must NOT be `: any`-stamped — it is contextually typed by the
    // declarator annotation. A typo `e.clientXX` would then be a tsc error.
    expect(code).not.toContain('(e: any)');
  });
});
