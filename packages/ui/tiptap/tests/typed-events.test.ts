/**
 * typed-events.test.ts — oinbox 0.8.0 feedback F9: TipTap's events must carry
 * real payload types on every target instead of `(...args: any[]) => void`.
 *
 * Asserts the COMPILED output of TipTap.rozie (the emitters own the lowering).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILENAME = 'TipTap.rozie';
const source = readFileSync(resolve(HERE, '..', 'src', FILENAME), 'utf8');

const emit = (target: 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'lit') =>
  compile(source, { target, filename: FILENAME }).code;

describe('TipTap typed events (F9)', () => {
  it('declares <emits> for all six events', () => {
    const { ast } = parse(source, { filename: FILENAME });
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    expect(ir.emitDecls?.map((d: { name: string }) => d.name).sort()).toEqual(
      ['blur', 'error', 'focus', 'ready', 'selectionUpdate', 'update'].sort(),
    );
    expect(ir.types?.exportedNames).toEqual(expect.arrayContaining(['TipTapErrorPayload']));
  });

  it.each(['react', 'solid'] as const)('%s: handlers are typed, not (...args: any[])', (target) => {
    const code = emit(target);
    expect(code).not.toMatch(/on(Update|SelectionUpdate|Focus|Blur|Ready|Error)\?: \(\.\.\.args: any\[\]\) => void/);
    expect(code).toMatch(/onUpdate\?: \(payload: string\) => void/);
    expect(code).toMatch(/onSelectionUpdate\?: \(\) => void/);
    expect(code).toMatch(/onFocus\?: \(\) => void/);
    expect(code).toMatch(/onBlur\?: \(\) => void/);
    expect(code).toMatch(/onReady\?: \(payload: Editor\) => void/);
    expect(code).toMatch(/onError\?: \(payload: TipTapErrorPayload\) => void/);
  });

  it('svelte: handlers are typed', () => {
    const code = emit('svelte');
    expect(code).not.toMatch(/on(update|selectionupdate|focus|blur|ready|error)\?: \(\.\.\.args: any\[\]\) => void/);
    expect(code).toMatch(/onupdate\?: \(payload: string\) => void/);
    expect(code).toMatch(/onready\?: \(payload: Editor\) => void/);
    expect(code).toMatch(/onerror\?: \(payload: TipTapErrorPayload\) => void/);
  });

  it('vue: defineEmits carries the payloads', () => {
    const code = emit('vue');
    expect(code).toMatch(/update: \[payload: string\]/);
    expect(code).toMatch(/ready: \[payload: Editor\]/);
    expect(code).toMatch(/error: \[payload: TipTapErrorPayload\]/);
  });

  it('angular: typed outputs', () => {
    const code = emit('angular');
    expect(code).toMatch(/output<string>\(\)/);
    expect(code).toMatch(/output<Editor>\(\)/);
    expect(code).toMatch(/output<TipTapErrorPayload>\(\)/);
  });

  it('lit: CustomEvent payloads in the event map', () => {
    const code = emit('lit');
    expect(code).toMatch(/CustomEvent<Editor>/);
    expect(code).toMatch(/CustomEvent<TipTapErrorPayload>/);
  });
});
