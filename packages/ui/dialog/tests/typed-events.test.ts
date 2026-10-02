/**
 * typed-events.test.ts — oinbox 0.8.0 feedback F9: `close` must carry a real
 * payload type on every target instead of `(...args: any[]) => void`.
 *
 * Asserts the COMPILED output of Dialog.rozie (the emitters own the lowering),
 * so a regression to an untyped `<emits>`-less component fails here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILENAME = 'Dialog.rozie';
const source = readFileSync(resolve(HERE, '..', 'src', FILENAME), 'utf8');

const emit = (target: 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'lit') =>
  compile(source, { target, filename: FILENAME }).code;

describe('Dialog typed events (F9)', () => {
  it('declares <emits> for close with the reason payload', () => {
    const { ast } = parse(source, { filename: FILENAME });
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    expect(ir.emitDecls?.map((d: { name: string }) => d.name)).toEqual(['close']);
    expect(ir.types?.exportedNames).toEqual(
      expect.arrayContaining(['DialogCloseReason', 'DialogClosePayload']),
    );
  });

  it.each(['react', 'solid'] as const)('%s: onClose is typed, not (...args: any[])', (target) => {
    const code = emit(target);
    expect(code).not.toMatch(/onClose\?: \(\.\.\.args: any\[\]\) => void/);
    expect(code).toMatch(/onClose\?: \(payload: DialogClosePayload\) => void/);
  });

  it('svelte: onclose is typed', () => {
    const code = emit('svelte');
    expect(code).not.toMatch(/onclose\?: \(\.\.\.args: any\[\]\) => void/);
    expect(code).toMatch(/onclose\?: \(payload: DialogClosePayload\) => void/);
  });

  it('vue: defineEmits carries the payload', () => {
    expect(emit('vue')).toMatch(/close: \[payload: DialogClosePayload\]/);
  });

  it('angular: output<DialogClosePayload>()', () => {
    expect(emit('angular')).toMatch(/output<DialogClosePayload>\(\)/);
  });

  it('lit: CustomEvent<DialogClosePayload> event map', () => {
    expect(emit('lit')).toMatch(/CustomEvent<DialogClosePayload>/);
  });
});
