/**
 * Typed public surface P1 — final fix wave L4. `IRComponent.types` /
 * `emitDecls` are `null` when the blocks are absent, but hand-built IRs (tests,
 * third-party tooling written before P1) omit the fields entirely. The shared
 * renderers must treat `undefined` like `null` instead of crashing.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { renderTypesBlock, typesExportedNames } from '../codegen/renderTypesBlock.js';
import { renderPropsInterface } from '../codegen/renderPropsInterface.js';
import { buildManifest } from '../manifest/buildManifest.js';
import type { IRComponent } from '../ir/types.js';

function legacyIR(): IRComponent {
  const { ast } = parse(`<rozie name="Legacy">\n<props>{ a: { type: Number, default: 1 } }</props>\n<script>\nfunction go() { $emit('ping', 1) }\n</script>\n<template><button @click="go()">x</button></template>\n</rozie>`, { filename: 'Legacy.rozie' });
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  const legacy = { ...ir! } as Partial<IRComponent>;
  delete legacy.types;
  delete legacy.emitDecls;
  return legacy as IRComponent;
}

describe('hand-built IR without types/emitDecls (L4)', () => {
  it('renderTypesBlock / typesExportedNames', () => {
    expect(renderTypesBlock(legacyIR())).toBe('');
    expect(renderTypesBlock(legacyIR(), { module: true })).toBe('');
    expect(typesExportedNames(legacyIR())).toEqual([]);
  });
  it('renderPropsInterface with includeTypesBlock', () => {
    const out = renderPropsInterface(legacyIR(), { slotChildrenType: 'unknown', includeTypesBlock: true, target: 'vue' });
    expect(out).toContain('export interface LegacyProps');
    expect(out).toContain('onPing?: (...args: any[]) => void;');
  });
  it('buildManifest', () => {
    const m = buildManifest(legacyIR());
    expect(m.types).toBeNull();
    expect(m.emits.map((e) => e.name)).toEqual(['ping']);
  });
});
