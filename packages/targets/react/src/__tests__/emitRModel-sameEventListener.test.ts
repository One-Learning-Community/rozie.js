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

/**
 * Reviewer minor (fix2) — scope the onChange/onChangeCapture occurrence
 * assertions to the `<select ...>` opening tag under test, rather than
 * counting across the whole emitted `jsx` string. A stray `onChange={` on
 * an unrelated element elsewhere in the tree must not be able to mask a
 * regression on THIS element.
 */
function selectOpeningTag(jsx: string): string {
  const start = jsx.indexOf('<select');
  expect(start).toBeGreaterThanOrEqual(0);
  // Brace-depth-aware scan — JSX attribute expressions like
  // `onChange={($event) => { ... }}` contain bare `>` characters (arrow
  // syntax) that would prematurely terminate a naive regex/`indexOf('>')`
  // scan before reaching the tag's real closing `>`.
  let depth = 0;
  for (let i = start; i < jsx.length; i++) {
    const ch = jsx[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) {
      return jsx.slice(start, i + 1);
    }
  }
  throw new Error('selectOpeningTag: no closing `>` found for <select ...> at depth 0');
}

/** Extract the `{...}` body of a JSX attribute (brace-depth-aware) from a tag string. */
function extractAttrBody(tag: string, attrName: string): string {
  const marker = `${attrName}={`;
  const idx = tag.indexOf(marker);
  expect(idx).toBeGreaterThanOrEqual(0);
  const bodyStart = idx + marker.length;
  let depth = 1;
  let i = bodyStart;
  for (; i < tag.length; i++) {
    const ch = tag[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  expect(depth).toBe(0);
  return tag.slice(bodyStart, i);
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
    const tag = selectOpeningTag(jsx);

    // Exactly one onChange={...} attribute on THIS <select> — never two.
    const onChangeOccurrences = tag.match(/onChange=\{/g) ?? [];
    expect(onChangeOccurrences.length).toBe(1);

    // The single onChange must invoke BOTH the r-model setter (setTheme, from
    // the target's event value) and the explicit applyTheme(...) call, in
    // that order — model write first, explicit handler second.
    const handlerBody = extractAttrBody(tag, 'onChange');
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
    const tag = selectOpeningTag(jsx);
    const onChangeOccurrences = tag.match(/onChange=\{/g) ?? [];
    expect(onChangeOccurrences.length).toBe(1);
    expect(extractAttrBody(tag, 'onChange')).toMatch(/setTheme/);
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
    const tag = selectOpeningTag(jsx);
    const onChangeOccurrences = tag.match(/onChange=\{/g) ?? [];
    const onClickOccurrences = tag.match(/onClick=\{/g) ?? [];
    expect(onChangeOccurrences.length).toBe(1);
    expect(onClickOccurrences.length).toBe(1);
    expect(extractAttrBody(tag, 'onChange')).toMatch(/setTheme/);
  });

  /**
   * fix2 (review finding) — a `.capture` modifier renders as a DISTINCT JSX
   * prop (`onChangeCapture`, per emitTemplateEvent.ts's native/capture
   * branch), so it does NOT collide with the model's own `onChange`. Before
   * the fix, the collision predicate compared `eventNameToJsxProp(ev.event)`
   * (== 'onChange', ignoring modifiers) against the model's base prop name —
   * falsely matching and merging the capture handler INTO onChange, silently
   * dropping the capture-phase registration entirely (no onChangeCapture prop
   * emitted at all).
   */
  it('<select r-model + @change.capture> emits BOTH onChange (model write) AND onChangeCapture (user handler) as SEPARATE props', () => {
    const ir = lowerInline(`
<rozie name="ThemePickerCapture">
<data>{ theme: 'base' }</data>
<script>
function applyTheme(t) { console.log(t); }
</script>
<template>
<select data-testid="ctl-theme" r-model="$data.theme" @change.capture="applyTheme($data.theme)">
  <option value="base">base</option>
  <option value="material">material</option>
</select>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    const tag = selectOpeningTag(jsx);

    // Two DISTINCT props — never merged into one, never dropped.
    const onChangeOccurrences = tag.match(/onChange=\{/g) ?? [];
    const onChangeCaptureOccurrences = tag.match(/onChangeCapture=\{/g) ?? [];
    expect(onChangeOccurrences.length).toBe(1);
    expect(onChangeCaptureOccurrences.length).toBe(1);

    // onChange is the r-model write, untouched by the capture listener.
    expect(extractAttrBody(tag, 'onChange')).toMatch(/setTheme/);
    expect(extractAttrBody(tag, 'onChange')).not.toMatch(/applyTheme/);

    // onChangeCapture is the user's capture-phase handler, NOT swallowed by
    // the model merge.
    expect(extractAttrBody(tag, 'onChangeCapture')).toMatch(/applyTheme/);
  });

  it('<select r-model + @change + @change.capture> merges the plain @change into onChange but keeps @change.capture as its own onChangeCapture', () => {
    const ir = lowerInline(`
<rozie name="ThemePickerBoth">
<data>{ theme: 'base' }</data>
<script>
function applyTheme(t) { console.log(t); }
function trackChange(t) { console.log('track', t); }
</script>
<template>
<select data-testid="ctl-theme" r-model="$data.theme" @change="applyTheme($data.theme)" @change.capture="trackChange($data.theme)">
  <option value="base">base</option>
  <option value="material">material</option>
</select>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    const tag = selectOpeningTag(jsx);

    const onChangeOccurrences = tag.match(/onChange=\{/g) ?? [];
    const onChangeCaptureOccurrences = tag.match(/onChangeCapture=\{/g) ?? [];
    expect(onChangeOccurrences.length).toBe(1);
    expect(onChangeCaptureOccurrences.length).toBe(1);

    const onChangeBody = extractAttrBody(tag, 'onChange');
    const setThemeIdx = onChangeBody.indexOf('setTheme');
    const applyThemeIdx = onChangeBody.indexOf('applyTheme');
    expect(setThemeIdx).toBeGreaterThanOrEqual(0);
    expect(applyThemeIdx).toBeGreaterThanOrEqual(0);
    expect(setThemeIdx).toBeLessThan(applyThemeIdx);
    expect(onChangeBody).not.toMatch(/trackChange/);

    expect(extractAttrBody(tag, 'onChangeCapture')).toMatch(/trackChange/);
  });
});
