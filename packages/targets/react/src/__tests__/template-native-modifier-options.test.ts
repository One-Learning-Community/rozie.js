/**
 * `.capture`, `.passive` and `.once` are ordinary modifiers on a template `@event`. React's JSX has
 * a prop form only for `.capture` (`on<Event>Capture`), so a listener carrying `.passive` or `.once`
 * on a DOM element is attached with `addEventListener` through the element's callback ref
 * (`rozieNativeListeners`), the same route `<input @change>` takes. The handler body is exactly the
 * one the JSX prop would get, so `.stop` / `.prevent` / `.self`, key filters and debounce/throttle
 * wraps still apply. `.capture` alone keeps the Capture prop.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../emitReact.js';

function emit(template: string, extra = '') {
  const src = `<rozie name="Test">
${extra}
<script>
const onKey = () => {}
const onClick = () => {}
const keep = (el) => {}
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
  return emitReact(ir, { filename: 'Test.rozie', modifierRegistry: registry });
}

const errors = (ds: { severity: string }[]) => ds.filter((d) => d.severity === 'error');

/** The single `ref={rozieNativeListeners…}` attribute's source text. */
function nativeRef(code: string): string {
  const refs = code.match(/ref=\{rozieNativeListeners<[\s\S]*?\)\}(?=[\s/>])/g) ?? [];
  expect(refs, code).toHaveLength(1);
  return refs[0]!;
}

describe('template @event .passive / .once on React', () => {
  it('.passive.once on a <div> attaches natively with both options', () => {
    const { code, diagnostics } = emit(`<div @keydown.passive.once="onKey"></div>`);
    expect(errors(diagnostics)).toEqual([]);
    expect(nativeRef(code)).toBe(
      'ref={rozieNativeListeners<HTMLDivElement, ["keydown"]>([["keydown", onKey, { passive: true, once: true }]])}',
    );
    expect(code).not.toMatch(/onKeyDown/);
    expect(code).toMatch(/import \{[^}]*rozieNativeListeners[^}]*\} from '@rozie\/runtime-react'/);
  });

  for (const mod of ['passive', 'once']) {
    it(`.${mod} alone compiles with no error`, () => {
      const { code, diagnostics } = emit(`<button @click.${mod}="onClick">x</button>`);
      expect(errors(diagnostics)).toEqual([]);
      expect(nativeRef(code)).toBe(
        `ref={rozieNativeListeners<HTMLButtonElement, ["click"]>([["click", onClick, { ${mod}: true }]])}`,
      );
    });
  }

  it('.capture.once carries capture as an option', () => {
    const { code, diagnostics } = emit(`<div @keydown.capture.once="onKey"></div>`);
    expect(errors(diagnostics)).toEqual([]);
    expect(nativeRef(code)).toContain('["keydown", onKey, { capture: true, once: true }]');
    expect(code).not.toMatch(/onKeyDownCapture/);
  });

  it('.capture alone keeps the Capture JSX prop', () => {
    const { code, diagnostics } = emit(`<div @keydown.capture="onKey"></div>`);
    expect(errors(diagnostics)).toEqual([]);
    // A root element folds its events into `mergeListeners({ … })` with the consumer's.
    expect(code).toMatch(/onKeyDownCapture(=\{|: )onKey/);
    expect(code).not.toContain('rozieNativeListeners');
  });

  it('guards (.stop .prevent .self, key filters) are in the native handler body', () => {
    const { code, diagnostics } = emit(
      `<div @keydown.enter.stop.prevent.self.once="onKey"></div>`,
    );
    expect(errors(diagnostics)).toEqual([]);
    const ref = nativeRef(code);
    expect(ref).toContain("'Enter'");
    expect(ref).toContain('stopPropagation()');
    expect(ref).toContain('preventDefault()');
    expect(ref).toContain('$event.currentTarget');
    expect(ref).toContain('{ once: true }');
  });

  it('.debounce(ms) wrap is referenced from the native handler', () => {
    const { code, diagnostics } = emit(`<div @keydown.debounce(200).passive="onKey"></div>`);
    expect(errors(diagnostics)).toEqual([]);
    const ref = nativeRef(code);
    const wrap = code.match(/const (\w+) = useDebouncedCallback\(/);
    expect(wrap, code).not.toBeNull();
    expect(ref).toContain(`["keydown", ${wrap![1]}, { passive: true }]`);
  });

  it('a same-event listener with and without options: optioned goes native, plain stays JSX', () => {
    const { code, diagnostics } = emit(`<div @keydown="onKey" @keydown.once="onClick"></div>`);
    expect(errors(diagnostics)).toEqual([]);
    expect(code).toMatch(/onKeyDown(=\{|: )onKey/);
    expect(nativeRef(code)).toContain('["keydown", onClick, { once: true }]');
  });

  it('several option listeners on one element share ONE ref call', () => {
    const { code, diagnostics } = emit(
      `<div @keydown.once="onKey" @click.passive="onClick" @wheel.passive="onClick"></div>`,
    );
    expect(errors(diagnostics)).toEqual([]);
    expect(nativeRef(code)).toBe(
      'ref={rozieNativeListeners<HTMLDivElement, ["keydown", "click", "wheel"]>([["keydown", onKey, { once: true }], ["click", onClick, { passive: true }], ["wheel", onClick, { passive: true }]])}',
    );
  });

  it('<input> with @change AND @keydown.once shares one ref call', () => {
    const { code, diagnostics } = emit(`<input @change="onKey" @keydown.once="onClick" />`);
    expect(errors(diagnostics)).toEqual([]);
    expect(nativeRef(code)).toBe(
      'ref={rozieNativeListeners<HTMLInputElement, ["change", "keydown"]>([["change", onKey], ["keydown", onClick, { once: true }]])}',
    );
  });

  it('forwards an author ref', () => {
    const { code } = emit(`<div ref="box" @keydown.once="onKey"></div>`);
    expect(nativeRef(code)).toMatch(/\]\], box\)\}$/);
    expect(code.match(/\bref=/g)).toHaveLength(1);
  });

  it('forwards a bound :ref', () => {
    const { code } = emit(`<div :ref="keep" @keydown.once="onKey"></div>`);
    expect(nativeRef(code)).toMatch(/\]\], keep\)\}$/);
    expect(code.match(/\bref=/g)).toHaveLength(1);
  });

  it('works inside r-for (one ref per iterated element)', () => {
    const { code, diagnostics } = emit(
      `<ul><li r-for="item in $data.items" :key="item" @click.once="onClick">{{ item }}</li></ul>`,
      `<data>{ items: ['a', 'b'] }</data>`,
    );
    expect(errors(diagnostics)).toEqual([]);
    expect(nativeRef(code)).toContain('rozieNativeListeners<HTMLLIElement, ["click"]>');
  });

  it('an unknown / custom element falls back to HTMLElement', () => {
    const { code, diagnostics } = emit(`<my-widget @ping.once="onKey"></my-widget>`);
    expect(errors(diagnostics)).toEqual([]);
    expect(nativeRef(code)).toContain('rozieNativeListeners<HTMLElement, ["ping"]>');
  });

  it('a root element merging consumer listeners keeps the merge and adds the native ref', () => {
    const { code, diagnostics } = emit(`<div r-on="$listeners" @click="onClick" @keydown.once="onKey"></div>`);
    expect(errors(diagnostics)).toEqual([]);
    expect(nativeRef(code)).toContain('["keydown", onKey, { once: true }]');
    expect(code).toMatch(/onClick/);
  });

  for (const mod of ['capture', 'passive', 'once']) {
    it(`.${mod} on a component event is an error (a component event is a callback prop, not a DOM listener)`, () => {
      const { diagnostics } = emit(
        `<Child @ping.${mod}="onClick" />`,
        `<components>\n{ Child: './Child.rozie' }\n</components>`,
      );
      const e = errors(diagnostics);
      expect(e).toHaveLength(1);
      expect((e[0] as { message: string }).message).toContain('component event');
    });
  }

  it('.outside stays rejected on a template @event', () => {
    const { diagnostics } = emit(`<div @click.outside="onClick"></div>`);
    expect(errors(diagnostics).length).toBeGreaterThan(0);
  });

  it('.once on <input @change> still compiles', () => {
    const { code, diagnostics } = emit(`<input @change.once="onKey" />`);
    expect(errors(diagnostics)).toEqual([]);
    expect(code).toContain('once: true');
  });
});
