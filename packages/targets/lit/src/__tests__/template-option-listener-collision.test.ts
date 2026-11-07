/**
 * Lit forbids two bindings with the same attribute name on one element: a second `@click=${…}`
 * shifts every later binding in the template by one part, so values land in the wrong places.
 * A listener with `.capture` / `.passive` / `.once` whose event already has a binding on the same
 * element therefore goes through the `rozieOptionListeners` element directive. An option listener
 * whose event is unique keeps Lit's own `@evt=${{ handleEvent, …options }}` form.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../emitLit.js';

function emit(template: string): string {
  const source = `<rozie name="Test">
<script>
const a = () => {}
const b = () => {}
</script>
<template>
  ${template}
</template>
</rozie>`;
  const { ast } = parse(source, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() returned null');
  return emitLit(ir, { filename: 'Test.rozie', source, modifierRegistry: registry }).code;
}

/** The opening tag of the first `<div …>` in the render template. */
const divTag = (code: string): string => code.match(/<div [^>]*>/)![0];
const count = (s: string, needle: string): number => s.split(needle).length - 1;

describe('Lit: same event with and without listener options on one element', () => {
  it('plain @click + @click.capture emits ONE @click binding plus the directive', () => {
    const code = emit(`<div @click="a" @click.capture="b"></div>`);
    const tag = divTag(code);
    expect(count(tag, '@click=')).toBe(1);
    expect(tag).toContain('${rozieOptionListeners([["click", ');
    expect(tag).toContain('{ capture: true }]])}');
    expect(code).toMatch(/import \{[^}]*rozieOptionListeners[^}]*\} from '@rozie\/runtime-lit'/);
  });

  it('two option listeners for one event: the first keeps the native form, the second uses the directive', () => {
    const tag = divTag(emit(`<div @click.capture="a" @click.once="b"></div>`));
    expect(count(tag, '@click=')).toBe(1);
    expect(tag).toContain('handleEvent:');
    expect(tag).toContain('{ once: true }]])}');
  });

  it('a unique option listener keeps the native { handleEvent } form and no directive import', () => {
    const code = emit(`<div @click="a" @keydown.capture="b"></div>`);
    expect(divTag(code)).toContain('@keydown=${{ handleEvent:');
    expect(code).not.toContain('rozieOptionListeners');
  });
});
