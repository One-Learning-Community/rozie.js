/**
 * typed-events.test.ts — the `change` event must carry a real payload type on
 * every target instead of `(...args: any[]) => void` (Angular `unknown`, Lit with
 * no typed `addEventListener` overload before this was declared).
 *
 * Asserts the COMPILED output of Pagination.rozie (the emitters own the lowering),
 * so a regression to an `<emits>`-less component fails here. The strict-consumer
 * gates under tests/{strict-conformance,vue-typecheck,svelte-typecheck,
 * angular-typecheck}/pagination-typed-surface.test.ts prove the consumer side.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILENAME = 'Pagination.rozie';
const source = readFileSync(resolve(HERE, '..', 'src', FILENAME), 'utf8');

const emit = (target: 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'lit') =>
  compile(source, { target, filename: FILENAME }).code;

describe('Pagination typed events', () => {
  it('declares <emits> for change with the page payload', () => {
    const { ast } = parse(source, { filename: FILENAME });
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    expect(ir.emitDecls?.map((d: { name: string }) => d.name)).toEqual(['change']);
    expect(ir.types?.exportedNames).toEqual(expect.arrayContaining(['PaginationChangePayload']));
  });

  it.each(['react', 'solid'] as const)('%s: onChange is typed, not (...args: any[])', (target) => {
    const code = emit(target);
    expect(code).not.toMatch(/onChange\?: \(\.\.\.args: any\[\]\) => void/);
    expect(code).toMatch(/onChange\?: \(payload: PaginationChangePayload\) => void/);
  });

  it('svelte: onchange is typed', () => {
    const code = emit('svelte');
    expect(code).not.toMatch(/onchange\?: \(\.\.\.args: any\[\]\) => void/);
    expect(code).toMatch(/onchange\?: \(payload: PaginationChangePayload\) => void/);
  });

  it('vue: defineEmits carries the payload', () => {
    expect(emit('vue')).toMatch(/change: \[payload: PaginationChangePayload\]/);
  });

  it('angular: output<PaginationChangePayload>()', () => {
    expect(emit('angular')).toMatch(/output<PaginationChangePayload>\(\)/);
  });

  it('lit: CustomEvent<PaginationChangePayload> event map', () => {
    expect(emit('lit')).toMatch(/CustomEvent<PaginationChangePayload>/);
  });
});
