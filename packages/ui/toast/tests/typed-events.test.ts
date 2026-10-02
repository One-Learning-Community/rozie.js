/**
 * typed-events.test.ts — oinbox 0.8.0 feedback F9: `dismissed` must carry a
 * real payload type on every target instead of `(...args: any[]) => void`,
 * and the `toast` scoped slot must type its params.
 *
 * Asserts the COMPILED output of Toaster.rozie (the emitters own the lowering).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILENAME = 'Toaster.rozie';
const source = readFileSync(resolve(HERE, '..', 'src', FILENAME), 'utf8');

const emit = (target: 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'lit') =>
  compile(source, { target, filename: FILENAME }).code;

describe('Toaster typed events (F9)', () => {
  it('declares <emits> for dismissed with the { toast, reason } payload', () => {
    const { ast } = parse(source, { filename: FILENAME });
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    expect(ir.emitDecls?.map((d: { name: string }) => d.name)).toEqual(['dismissed']);
    expect(ir.types?.exportedNames).toEqual(
      expect.arrayContaining(['ToastEntry', 'ToastDismissReason', 'ToastDismissedPayload']),
    );
  });

  it.each(['react', 'solid'] as const)('%s: onDismissed is typed, not (...args: any[])', (target) => {
    const code = emit(target);
    expect(code).not.toMatch(/onDismissed\?: \(\.\.\.args: any\[\]\) => void/);
    expect(code).toMatch(/onDismissed\?: \(payload: ToastDismissedPayload\) => void/);
  });

  it('svelte: ondismissed is typed', () => {
    const code = emit('svelte');
    expect(code).not.toMatch(/ondismissed\?: \(\.\.\.args: any\[\]\) => void/);
    expect(code).toMatch(/ondismissed\?: \(payload: ToastDismissedPayload\) => void/);
  });

  it('vue: defineEmits carries the payload', () => {
    expect(emit('vue')).toMatch(/dismissed: \[payload: ToastDismissedPayload\]/);
  });

  it('angular: output<ToastDismissedPayload>()', () => {
    expect(emit('angular')).toMatch(/output<ToastDismissedPayload>\(\)/);
  });

  it('lit: CustomEvent<ToastDismissedPayload> event map', () => {
    expect(emit('lit')).toMatch(/CustomEvent<ToastDismissedPayload>/);
  });

  it('react: the toast slot ctx types its params', () => {
    const code = emit('react');
    expect(code).toMatch(/toast: ToastEntry/);
    expect(code).toMatch(/dismiss: \(id: string\) => void/);
  });
});
