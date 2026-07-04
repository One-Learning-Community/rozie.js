/**
 * Regression test — finding §3.3 (data-table-super-crosstarget-findings.md).
 *
 * When an element carries BOTH `r-model` AND an explicit `@event` listener
 * for the SAME native event that `r-model` lowers to (e.g. `@change` on a
 * `<select r-model="...">`), the React emitter must NOT emit two same-named
 * JSX attributes (`onChange={...} onChange={...}`). Per JS object-literal
 * semantics the second occurrence silently wins, dropping the r-model
 * two-way write entirely — the compiled `<select>`'s bound state never
 * updates on change.
 *
 * The fix: pre-merge the collision into ONE handler that runs the r-model
 * write FIRST, then the explicit user handler — matching the other 5
 * targets' "both fire" semantics (Vue: distinct `onUpdate:modelValue` +
 * `onChange` vnode props; Svelte/Solid: two independent listener
 * registrations; Lit: two directives).
 *
 * @experimental
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { emitTemplate } from '../emit/emitTemplate.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function emit(ir: IRComponent) {
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  const result = emitTemplate(ir, collectors, createDefaultRegistry());
  return { ...result, collectors };
}

describe('React r-model + same-event @listener collision — finding §3.3', () => {
  it('<select r-model + @change> emits ONE onChange (model write, then user handler) — never two onChange keys', () => {
    const ir = lowerInline(`
<rozie name="ThemePicker">
<data>{ theme: 'base' }</data>
<script>
function applyTheme(t) { console.log(t); }
</script>
<template>
<select data-testid="ctl-theme" r-model="$data.theme" @change="applyTheme($data.theme)">
  <option value="base">base</option>
  <option value="material">material</option>
</select>
</template>
</rozie>
`);
    const { jsx } = emit(ir);

    // Exactly one onChange={...} attribute on the <select> — never two.
    const onChangeOccurrences = jsx.match(/onChange=\{/g) ?? [];
    expect(onChangeOccurrences.length).toBe(1);

    // The single onChange must invoke BOTH the r-model setter (setTheme, from
    // the target's event value) and the explicit applyTheme(...) call, in
    // that order — model write first, explicit handler second.
    const match = jsx.match(/onChange=\{([\s\S]*?)\}\s*(?:>|\/>|children:)/);
    expect(match).not.toBeNull();
    const handlerBody = match![1]!;
    const setThemeIdx = handlerBody.indexOf('setTheme');
    const applyThemeIdx = handlerBody.indexOf('applyTheme');
    expect(setThemeIdx).toBeGreaterThanOrEqual(0);
    expect(applyThemeIdx).toBeGreaterThanOrEqual(0);
    expect(setThemeIdx).toBeLessThan(applyThemeIdx);
  });

  it('non-colliding case stays untouched: r-model alone still emits its own onChange', () => {
    const ir = lowerInline(`
<rozie name="Plain">
<data>{ theme: 'base' }</data>
<template>
<select data-testid="ctl-theme" r-model="$data.theme">
  <option value="base">base</option>
</select>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    const onChangeOccurrences = jsx.match(/onChange=\{/g) ?? [];
    expect(onChangeOccurrences.length).toBe(1);
    expect(jsx).toMatch(/onChange=\{[^}]*setTheme/);
  });

  it('non-colliding case stays untouched: r-model + @click (different event) emits both onChange and onClick separately', () => {
    const ir = lowerInline(`
<rozie name="Plain2">
<data>{ theme: 'base' }</data>
<script>
function onSelectClick() { console.log('clicked'); }
</script>
<template>
<select data-testid="ctl-theme" r-model="$data.theme" @click="onSelectClick()">
  <option value="base">base</option>
</select>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    const onChangeOccurrences = jsx.match(/onChange=\{/g) ?? [];
    const onClickOccurrences = jsx.match(/onClick=\{/g) ?? [];
    expect(onChangeOccurrences.length).toBe(1);
    expect(onClickOccurrences.length).toBe(1);
    expect(jsx).toMatch(/onChange=\{[^}]*setTheme/);
  });
});
