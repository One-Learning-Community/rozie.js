// Phase 21 Plan 21-01 Task 3 — synthesizeHandleType core-shared helper.
//
// Renders the `<Name>Handle` TS interface from the `<script>` function
// signatures of the exposed methods (D-04 preserve-author/fill-untyped):
//   - typed <script lang="ts"> method → real signature preserved
//   - untyped method → (...args: any[]) => any
//   - empty ir.expose → null (callers skip emission)
//   - uses the passed interfaceName
//   - no @ts-ignore / `as any` cast tokens (the rest-arg type is a TYPE, D-04)
import { describe, it, expect } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../../ir/lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { synthesizeHandleType } from '../synthesizeHandleType.js';
import type { IRComponent } from '../../ir/types.js';

function lower(source: string, filename = 'ExposeProbe.rozie'): IRComponent {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR returned null ir');
  return ir;
}

const TYPED = `<rozie name="ExposeProbe">
<data>{ value: '' }</data>
<script lang="ts">
function reset(): void { $data.value = '' }
function setDate(d: Date): void { void d }
$expose({ reset, setDate })
</script>
<template><input ref="field" /></template>
</rozie>`;

const UNTYPED = `<rozie name="ExposeProbe">
<data>{ value: '' }</data>
<script>
function reset() { $data.value = '' }
function focus() { $refs.field.focus() }
$expose({ reset, focus })
</script>
<template><input ref="field" /></template>
</rozie>`;

const NONE = `<rozie name="Plain">
<data>{ value: '' }</data>
<script>
function reset() {}
</script>
<template><input ref="field" /></template>
</rozie>`;

describe('synthesizeHandleType', () => {
  it('typed <script lang="ts"> preserves author param + return annotations', () => {
    const out = synthesizeHandleType(lower(TYPED), 'ExposeProbeHandle');
    expect(out).not.toBeNull();
    expect(out).toContain('interface ExposeProbeHandle');
    expect(out).toContain('reset(): void;');
    expect(out).toContain('setDate(d: Date): void;');
  });

  it('untyped <script> fills each method with (...args: any[]) => any', () => {
    const out = synthesizeHandleType(lower(UNTYPED), 'ExposeProbeHandle')!;
    expect(out).toContain('interface ExposeProbeHandle');
    expect(out).toContain('reset: (...args: any[]) => any;');
    expect(out).toContain('focus: (...args: any[]) => any;');
  });

  it('returns null when ir.expose is empty', () => {
    expect(synthesizeHandleType(lower(NONE), 'PlainHandle')).toBeNull();
  });

  it('uses the passed interfaceName', () => {
    const out = synthesizeHandleType(lower(UNTYPED), 'WidgetHandle')!;
    expect(out).toContain('interface WidgetHandle {');
    expect(out).not.toContain('ExposeProbeHandle');
  });

  it('emits no @ts-ignore / `as any` cast tokens', () => {
    for (const src of [TYPED, UNTYPED]) {
      const out = synthesizeHandleType(lower(src), 'H')!;
      expect(out).not.toContain('@ts-ignore');
      expect(out).not.toContain('as any');
    }
  });

  it('does not prepend `export` (callers add it for the .d.ts surface)', () => {
    const out = synthesizeHandleType(lower(UNTYPED), 'ExposeProbeHandle')!;
    expect(out.startsWith('interface ')).toBe(true);
  });

  it('resolves arrow-const declarations (const reset = (): void => {})', () => {
    const src = `<rozie name="P">
<data>{ value: '' }</data>
<script lang="ts">
const reset = (): void => { $data.value = '' }
$expose({ reset })
</script>
<template><input ref="field" /></template>
</rozie>`;
    const out = synthesizeHandleType(lower(src), 'PHandle')!;
    expect(out).toContain('reset(): void;');
  });

  it('inline-arrow getter renders a typed method when annotated', () => {
    const src = `<rozie name="P">
<data>{ value: '' }</data>
<script lang="ts">
$expose({ getValue: (): string => $data.value })
</script>
<template><input ref="field" /></template>
</rozie>`;
    const out = synthesizeHandleType(lower(src), 'PHandle')!;
    expect(out).toContain('getValue(): string;');
  });
});
