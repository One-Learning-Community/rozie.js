/**
 * typed-events.test.ts — oinbox 0.8.0 feedback F9: CommandPalette's four events
 * (navigate, back, select, action-select) must carry real payload types on
 * every target instead of `(...args: any[]) => void`.
 *
 * Asserts the COMPILED output of CommandPalette.rozie (the emitters own the
 * lowering).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILENAME = resolve(HERE, '..', 'src', 'CommandPalette.rozie');
const source = readFileSync(FILENAME, 'utf8');

const emit = (target: 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'lit') =>
  compile(source, { target, filename: FILENAME }).code;

describe('CommandPalette typed events (F9)', () => {
  it('declares <emits> for all four events', () => {
    const { ast } = parse(source, { filename: FILENAME });
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry(), filename: FILENAME });
    expect(ir.emitDecls?.map((d: { name: string }) => d.name).sort()).toEqual(
      ['action-select', 'back', 'navigate', 'select'],
    );
    expect(ir.types?.exportedNames).toEqual(
      expect.arrayContaining([
        'CommandPaletteItem',
        'CommandPaletteAction',
        'CommandPaletteNavigatePayload',
        'CommandPaletteSelectPayload',
        'CommandPaletteActionSelectPayload',
      ]),
    );
  });

  it.each(['react', 'solid'] as const)('%s: handlers are typed, not (...args: any[])', (target) => {
    const code = emit(target);
    expect(code).not.toMatch(/on(Navigate|Back|Select|ActionSelect)\?: \(\.\.\.args: any\[\]\) => void/);
    expect(code).toMatch(/onNavigate\?: \(payload: CommandPaletteNavigatePayload\) => void/);
    expect(code).toMatch(/onBack\?: \(\) => void/);
    expect(code).toMatch(/onSelect\?: \(payload: CommandPaletteSelectPayload\) => void/);
    expect(code).toMatch(/onActionSelect\?: \(payload: CommandPaletteActionSelectPayload\) => void/);
  });

  it('svelte: handlers are typed', () => {
    const code = emit('svelte');
    expect(code).not.toMatch(/on(navigate|back|select|actionselect)\?: \(\.\.\.args: any\[\]\) => void/);
    expect(code).toMatch(/onnavigate\?: \(payload: CommandPaletteNavigatePayload\) => void/);
    expect(code).toMatch(/onselect\?: \(payload: CommandPaletteSelectPayload\) => void/);
    expect(code).toMatch(/onactionselect\?: \(payload: CommandPaletteActionSelectPayload\) => void/);
  });

  it('vue: defineEmits carries the payloads', () => {
    const code = emit('vue');
    expect(code).toMatch(/navigate: \[payload: CommandPaletteNavigatePayload\]/);
    expect(code).toMatch(/select: \[payload: CommandPaletteSelectPayload\]/);
    expect(code).toMatch(/'action-select': \[payload: CommandPaletteActionSelectPayload\]/);
  });

  it('angular: typed outputs', () => {
    const code = emit('angular');
    expect(code).toMatch(/output<CommandPaletteNavigatePayload>\(\)/);
    expect(code).toMatch(/output<CommandPaletteSelectPayload>\(\)/);
    // `action-select` carries an `{ alias: 'action-select' }` option.
    expect(code).toMatch(/output<CommandPaletteActionSelectPayload>\(/);
  });

  it('lit: CustomEvent payloads in the event map', () => {
    const code = emit('lit');
    expect(code).toMatch(/CustomEvent<CommandPaletteNavigatePayload>/);
    expect(code).toMatch(/CustomEvent<CommandPaletteSelectPayload>/);
    expect(code).toMatch(/CustomEvent<CommandPaletteActionSelectPayload>/);
  });
});
