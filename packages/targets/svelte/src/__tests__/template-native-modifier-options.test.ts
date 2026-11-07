/**
 * Template `@event` native listener options — `.capture` / `.passive` / `.once`.
 *
 * Svelte 5's `on<event>={...}` attributes carry no listener options, so a
 * template `@event` that uses any of the three native-option modifiers is
 * attached through the `rozieListeners` action from `@rozie/runtime-svelte`:
 *
 *   <div @keydown.capture.once="onKey">
 *     → <div use:rozieListeners={[["keydown", onKey, { capture: true, once: true }]]}>
 *
 * The handler value is exactly what the `onkeydown={...}` attribute would
 * have carried (same guards, same debounce/throttle wrapper) — only the
 * attach mechanism changes. Listeners without options keep the plain
 * `on<event>` attribute, including a same-event sibling on the same element.
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import type { Diagnostic } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSvelte } from '../emitSvelte.js';

const PROLOGUE = '<rozie name="Test" inherit-listeners="false" inherit-attrs="false">';

function compile(template: string, script = 'const onKey = (e) => undefined;\nconst other = (e) => undefined;'): {
  code: string;
  markup: string;
  diagnostics: Diagnostic[];
} {
  const src = `${PROLOGUE}
<data>
{ items: [] }
</data>
<template>
${template}
</template>
<script>
${script}
</script>
</rozie>`;
  const { ast, diagnostics: parseDiags } = parse(src, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const lowered = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null');
  const result = emitSvelte(lowered.ir, { filename: 'Test.rozie', source: src });
  const markup = result.code
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
    .trim();
  return {
    code: result.code,
    markup,
    diagnostics: [...parseDiags, ...lowered.diagnostics, ...result.diagnostics],
  };
}

const errors = (ds: Diagnostic[]): Diagnostic[] => ds.filter((d) => d.severity === 'error');
const IMPORT = "import { rozieListeners } from '@rozie/runtime-svelte';";

describe('Svelte template @event — .capture/.passive/.once attach with listener options', () => {
  it('.capture.once on a plain element compiles via the rozieListeners action', () => {
    const { code, markup, diagnostics } = compile('<div @keydown.capture.once="onKey"></div>');
    expect(errors(diagnostics)).toEqual([]);
    expect(markup).toContain(
      'use:rozieListeners={[["keydown", onKey, { capture: true, once: true }]]}',
    );
    expect(markup).not.toContain('onkeydown=');
    expect(code).toContain(IMPORT);
  });

  it('.capture / .passive / .once alone each produce their own option', () => {
    for (const [mod, opt] of [
      ['capture', '{ capture: true }'],
      ['passive', '{ passive: true }'],
      ['once', '{ once: true }'],
    ] as const) {
      const { markup, diagnostics } = compile(`<div @wheel.${mod}="onKey"></div>`);
      expect(errors(diagnostics)).toEqual([]);
      expect(markup).toContain(`use:rozieListeners={[["wheel", onKey, ${opt}]]}`);
    }
  });

  it('combines with .stop/.prevent/.self, key filters and the handler body stays the same', () => {
    const plain = compile('<div @keydown.stop.prevent.self.enter="onKey"></div>').markup;
    const withOpts = compile('<div @keydown.stop.prevent.self.enter.capture="onKey"></div>');
    expect(errors(withOpts.diagnostics)).toEqual([]);
    const handler = plain.match(/onkeydown=\{(.*)\} data-rozie/s)?.[1];
    expect(handler).toBeDefined();
    expect(handler).toContain('stopPropagation()');
    expect(handler).toContain("$event.key !== 'Enter'");
    expect(withOpts.markup).toContain(
      `use:rozieListeners={[["keydown", ${handler}, { capture: true }]]}`,
    );
  });

  it('combines with .debounce(ms) — the script-level wrapper is the attached handler', () => {
    const { code, markup, diagnostics } = compile('<input @input.debounce(200).passive="onKey" />');
    expect(errors(diagnostics)).toEqual([]);
    expect(code).toContain('const debouncedOnKey = (() => {');
    expect(markup).toContain('use:rozieListeners={[["input", debouncedOnKey, { passive: true }]]}');
  });

  it('same event with and without options on one element: attr + action side by side', () => {
    const { markup, diagnostics } = compile(
      '<div @keydown="other" @keydown.capture="onKey" @click.once="other"></div>',
    );
    expect(errors(diagnostics)).toEqual([]);
    expect(markup).toContain('onkeydown={other}');
    expect(markup).toContain(
      'use:rozieListeners={[["keydown", onKey, { capture: true }], ["click", other, { once: true }]]}',
    );
    // Exactly one action per element.
    expect(markup.match(/use:rozieListeners=/g)?.length).toBe(1);
  });

  it('works per element inside r-for (handler closes over the loop item)', () => {
    const { markup, diagnostics } = compile(
      '<ul><li r-for="item in $data.items" :key="item" @click.once="onKey(item)">x</li></ul>',
    );
    expect(errors(diagnostics)).toEqual([]);
    expect(markup).toContain('{#each items as item (item)}');
    expect(markup).toContain(
      'use:rozieListeners={[["click", ($event) => { onKey(item); }, { once: true }]]}',
    );
  });

  it('coexists with refs and the $attrs/$listeners fallthrough spread', () => {
    const { markup, diagnostics } = compile(
      '<div ref="box" r-bind="$attrs" r-on="$listeners" @click.capture="onKey"></div>',
      'const onKey = (e) => undefined;\n$onMount(() => { void $refs.box; });',
    );
    expect(errors(diagnostics)).toEqual([]);
    expect(markup).toContain('bind:this={box}');
    expect(markup).toContain('use:applyListeners={__rozieAttrs}');
    expect(markup).toContain('use:rozieListeners={[["click", onKey, { capture: true }]]}');
  });

  it('on a COMPONENT tag the options stay ROZ621 (the event is a callback prop, not a DOM listener)', () => {
    const src = `${PROLOGUE}
<components>{ Child: './Child.rozie' }</components>
<template>
<Child @change.once="onKey" />
</template>
<script>
const onKey = (e) => undefined;
</script>
</rozie>`;
    const { ast } = parse(src, { filename: 'Test.rozie' });
    const lowered = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
    const result = emitSvelte(lowered.ir!, { filename: 'Test.rozie', source: src });
    expect(result.diagnostics.some((d) => d.code === 'ROZ621' && d.severity === 'error')).toBe(true);
    expect(result.code).not.toContain('rozieListeners');
  });

  it('.outside stays rejected on template @event (listenerOnly)', () => {
    const { diagnostics } = compile('<div ref="box" @click.outside($refs.box)="onKey"></div>');
    expect(errors(diagnostics).some((d) => d.code === 'ROZ621')).toBe(true);
  });
});
