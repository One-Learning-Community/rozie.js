/**
 * `.capture` / `.passive` / `.once` on a TEMPLATE `@event` attach with those listener options.
 *
 * Solid's JSX event props (`onKeyDown={…}`) take no listener options, and the `on:` namespace
 * only passes them from solid-js 1.9's compiler (1.8's drops them). So a template listener with
 * any of the three is attached in the element's ref through `rozieNativeListeners(el, [...])`:
 * the ref runs once per element (so `.once` is the DOM's own flag), the listener is removed on
 * cleanup, and the handler is the same expression the JSX prop would get — inline guards
 * (`.stop`, key filters) and debounce/throttle wrappers included.
 *
 * On a COMPONENT tag the event is a component event, not a DOM listener: still an error.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../emitSolid.js';

function compile(template: string, extraScript = '') {
  const src = `<rozie name="Test">
<script>
const onKey = () => {}
const other = () => {}
const items = [1, 2]
${extraScript}
</script>
<template>
${template}
</template>
</rozie>`;
  const { ast } = parse(src, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitSolid(ir, { filename: 'Test.rozie', source: src });
  return {
    code: result.code,
    errors: result.diagnostics.filter((d) => d.severity === 'error'),
    noJsxEquivalent: result.diagnostics.filter((d) => /has no JSX-prop equivalent/.test(d.message)),
  };
}

const KEY_PARAM = '$event: KeyboardEvent & { currentTarget: HTMLDivElement; target: Element }';

describe('template @event .capture/.passive/.once on Solid', () => {
  for (const mod of ['capture', 'passive', 'once']) {
    it(`.${mod} compiles without an error and attaches through the element ref`, () => {
      const { code, errors } = compile(`<div @keydown.${mod}="onKey"></div>`);
      expect(errors).toEqual([]);
      expect(code).toContain(
        `<div ref={(el) => { rozieNativeListeners(el, [["keydown", onKey, { ${mod}: true }]]); }}`,
      );
      // Not also bound as the JSX prop (would fire twice, once without the option).
      expect(code).not.toContain('onKeyDown');
      expect(code).toMatch(
        /import \{[^}]*\brozieNativeListeners\b[^}]*\} from '@rozie\/runtime-solid'/,
      );
    });
  }

  it('combines options: <div @keydown.capture.once="onKey">', () => {
    const { code, errors } = compile(`<div @keydown.capture.once="onKey"></div>`);
    expect(errors).toEqual([]);
    expect(code).toContain(
      '<div ref={(el) => { rozieNativeListeners(el, [["keydown", onKey, { capture: true, once: true }]]); }}',
    );
  });

  it('keeps guard semantics: .stop, .prevent, .self and key filters run in the attached handler', () => {
    const { code, errors } = compile(
      `<div @keydown.capture.enter.stop.prevent.self="onKey"></div>`,
    );
    expect(errors).toEqual([]);
    expect(code).toContain(
      `rozieNativeListeners(el, [["keydown", (${KEY_PARAM}) => { if ($event.key !== 'Enter') return; $event.stopPropagation(); $event.preventDefault(); if ($event.target !== $event.currentTarget) return; onKey(); }, { capture: true }]])`,
    );
  });

  it('a statement handler is wrapped the same way as on the JSX prop', () => {
    const { code, errors } = compile(`<div @keydown.passive="onKey($event)"></div>`);
    expect(errors).toEqual([]);
    expect(code).toContain(
      `rozieNativeListeners(el, [["keydown", (${KEY_PARAM}) => { onKey($event); }, { passive: true }]])`,
    );
  });

  it('combines with .debounce(ms) — the debounced wrapper is the attached handler', () => {
    const { code, errors } = compile(`<div @scroll.passive.debounce(100)="onKey"></div>`);
    expect(errors).toEqual([]);
    expect(code).toContain('const _rozieDebouncedOnKey = createDebouncedHandler(onKey, 100);');
    expect(code).toContain(
      'rozieNativeListeners(el, [["scroll", _rozieDebouncedOnKey, { passive: true }]])',
    );
  });

  it('combines with .throttle(ms) and a guard', () => {
    const { code, errors } = compile(`<div @keydown.capture.throttle(50).enter="onKey"></div>`);
    expect(errors).toEqual([]);
    expect(code).toContain('createThrottledHandler(onKey, 50)');
    expect(code).toContain(
      `rozieNativeListeners(el, [["keydown", (${KEY_PARAM}) => { if ($event.key !== 'Enter') return; _rozieThrottledOnKey($event); }, { capture: true }]])`,
    );
  });

  it('the same event with and without options: JSX prop for one, ref listener for the other', () => {
    const { code, errors } = compile(
      `<div @keydown="other" @keydown.capture="onKey" @click.once="other"></div>`,
    );
    expect(errors).toEqual([]);
    expect(code).toContain(
      '<div ref={(el) => { rozieNativeListeners(el, [["keydown", onKey, { capture: true }], ["click", other, { once: true }]]); }}',
    );
    // A root element: the plain listener still goes through mergeListeners with the consumer's.
    expect(code).toContain('{...mergeListeners({ onKeyDown: other }, pickListeners(attrs))}');
    expect(code).not.toContain('onClick');
  });

  it('same event with and without options on a NON-root element: plain JSX prop kept', () => {
    const { code, errors } = compile(
      `<section><div @keydown="other" @keydown.capture="onKey"></div></section>`,
    );
    expect(errors).toEqual([]);
    expect(code).toContain(
      '<div ref={(el) => { rozieNativeListeners(el, [["keydown", onKey, { capture: true }]]); }} onKeyDown={other}',
    );
  });

  it('per element inside a keyless r-for (<For>)', () => {
    const { code, errors } = compile(
      `<ul><li r-for="item in items" @click.once="pick(item)">{{ item }}</li></ul>`,
      'const pick = (a) => {}',
    );
    expect(errors).toEqual([]);
    expect(code).toMatch(
      /<For each=\{[^}]*\}>\{\(item[^)]*\) => <li ref=\{\(el\) => \{ rozieNativeListeners\(el, \[\["click", /,
    );
    expect(code).toContain('=> { pick(item); }, { once: true }]]); }}');
  });

  it('two option-bearing listeners for the same event are both attached', () => {
    const { code, errors } = compile(`<div @keydown.capture="onKey" @keydown.once="other"></div>`);
    expect(errors).toEqual([]);
    expect(code).toContain(
      'rozieNativeListeners(el, [["keydown", onKey, { capture: true }], ["keydown", other, { once: true }]])',
    );
  });

  it('shares the element ref with an author ref="…" (one ref= attribute)', () => {
    const { code, errors } = compile(`<div ref="box" @keydown.capture="onKey"></div>`);
    expect(errors).toEqual([]);
    expect(code).toContain(
      '<div ref={(el) => { rozieNativeListeners(el, [["keydown", onKey, { capture: true }]]); boxRef = el as HTMLElement; }}',
    );
    expect(code.match(/\bref=\{/g)).toHaveLength(1);
  });

  it('root element: consumer listeners still merge, the option-bearing listener goes to the ref', () => {
    const { code, errors } = compile(
      `<div ref="box" @keydown.capture="onKey" @click="other"><span>x</span></div>`,
    );
    expect(errors).toEqual([]);
    expect(code).toContain(
      '<div ref={(el) => { rozieNativeListeners(el, [["keydown", onKey, { capture: true }]]); boxRef = el as HTMLElement; }} {...attrs} {...mergeListeners({ onClick: other }, pickListeners(attrs))}',
    );
  });

  it('root element whose only listener has options: attrs still fall through', () => {
    const { code, errors } = compile(`<div @keydown.capture="onKey"><span>x</span></div>`);
    expect(errors).toEqual([]);
    expect(code).toContain('rozieNativeListeners(el, [["keydown", onKey, { capture: true }]])');
    expect(code).toContain('{...attrs}');
  });

  it('per element inside r-for (keyed), with the loop accessors read at event time', () => {
    const { code, errors } = compile(
      `<ul><li r-for="(item, index) in items" :key="item" @click.capture="pick(item, index)">{{ item }}</li></ul>`,
      'const pick = (a, b) => {}',
    );
    expect(errors).toEqual([]);
    expect(code).toContain(
      '<li ref={(el) => { rozieNativeListeners(el, [["click", ($event: MouseEvent & { currentTarget: HTMLLIElement; target: Element }) => { pick(item(), index()); }, { capture: true }]]); }}',
    );
  });

  it('a prop callback handler is read at event time, not snapshotted', () => {
    const src = `<rozie name="Test">
<props>{ onPing: { type: Function } }</props>
<template>
  <div @click.capture="$props.onPing"></div>
</template>
</rozie>`;
    const { ast } = parse(src, { filename: 'Test.rozie' });
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
    const result = emitSolid(ir!, { filename: 'Test.rozie', source: src });
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.code).toContain(
      'rozieNativeListeners(el, [["click", ($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { (local.onPing)?.($event); }, { capture: true }]])',
    );
  });

  it('on a COMPONENT tag the modifiers stay an error (a component event has no listener options)', () => {
    const src = `<rozie name="Test">
<components>{ Child: './Child.rozie' }</components>
<script>
const onKey = () => {}
</script>
<template>
  <Child @change.capture="onKey" />
</template>
</rozie>`;
    const { ast } = parse(src, { filename: 'Test.rozie' });
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
    const result = emitSolid(ir!, { filename: 'Test.rozie', source: src });
    const ds = result.diagnostics.filter((d) => d.severity === 'error');
    expect(ds).toHaveLength(1);
    expect(ds[0]!.message).toContain("'.capture'");
    expect(result.code).not.toContain('rozieNativeListeners');
  });

  it('.outside stays rejected on a template @event', () => {
    const { errors } = compile(`<div ref="box" @click.outside($refs.box)="onKey"></div>`);
    expect(errors.some((d) => /listenerOnly/.test(d.message))).toBe(true);
  });

  it('elements without option-bearing listeners are unchanged (no helper import)', () => {
    const { code, noJsxEquivalent } = compile(`<div @keydown.enter="onKey"></div>`);
    expect(noJsxEquivalent).toEqual([]);
    expect(code).not.toContain('rozieNativeListeners');
  });
});
