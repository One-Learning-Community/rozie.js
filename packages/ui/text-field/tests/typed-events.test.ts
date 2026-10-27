/**
 * typed-events.test.ts — `change` and `enter` must carry a real payload type on
 * every target instead of `(...args: any[]) => void` (the dialog F9 contract).
 *
 * Asserts the COMPILED output of TextField.rozie (the emitters own the lowering).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILENAME = 'TextField.rozie';
const source = readFileSync(resolve(HERE, '..', 'src', FILENAME), 'utf8');

const emit = (target: 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'lit') =>
  compile(source, { target, filename: FILENAME }).code;

describe('TextField typed events', () => {
  it('declares <emits> for change and enter with the value payload', () => {
    const { ast } = parse(source, { filename: FILENAME });
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    expect(ir.emitDecls?.map((d: { name: string }) => d.name)).toEqual(['change', 'enter']);
    expect(ir.types?.exportedNames).toEqual(expect.arrayContaining(['TextFieldValuePayload']));
  });

  it.each(['react', 'solid'] as const)('%s: onChange / onEnter are typed', (target) => {
    const code = emit(target);
    expect(code).not.toMatch(/onChange\?: \(\.\.\.args: any\[\]\) => void/);
    expect(code).toMatch(/onChange\?: \(payload: TextFieldValuePayload\) => void/);
    expect(code).toMatch(/onEnter\?: \(payload: TextFieldValuePayload\) => void/);
  });

  it('svelte: onchange / onenter are typed', () => {
    const code = emit('svelte');
    expect(code).toMatch(/onchange\?: \(payload: TextFieldValuePayload\) => void/);
    expect(code).toMatch(/onenter\?: \(payload: TextFieldValuePayload\) => void/);
  });

  it('vue: defineEmits carries the payload', () => {
    const code = emit('vue');
    expect(code).toMatch(/change: \[payload: TextFieldValuePayload\]/);
    expect(code).toMatch(/enter: \[payload: TextFieldValuePayload\]/);
  });

  it('angular: output<TextFieldValuePayload>()', () => {
    expect(emit('angular').match(/output<TextFieldValuePayload>\(\)/g)?.length).toBe(2);
  });

  it('lit: CustomEvent<TextFieldValuePayload> event map', () => {
    expect(emit('lit')).toMatch(/CustomEvent<TextFieldValuePayload>/);
  });
});
