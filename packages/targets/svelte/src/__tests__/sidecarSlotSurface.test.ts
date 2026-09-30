/**
 * Sidecar slot surface parity (svelte): the `.d.rozie.ts` is generated from
 * the same slot functions as the compiled module (typed-surface follow-up).
 */
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSvelteTypes } from '../index.js';

const SRC = "<rozie name=\"SlotShapes\">\n\n<types>\nexport type Count = number\n</types>\n\n<props>\n{\n  tone: { type: String, default: 'info' },\n}\n</props>\n\n<data>\n{\n  count: 0,\n}\n</data>\n\n<template>\n  <div>\n    <slot />\n    <slot name=\"foot\" />\n    <slot name=\"row\" :count=\"$data.count\" :param-types=\"{ count: 'Count' }\" />\n  </div>\n</template>\n\n</rozie>\n";

function sidecar(): string {
  const { ast } = parse(SRC, { filename: 'SlotShapes.rozie' });
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return emitSvelteTypes(ir!);
}

describe('svelte sidecar slot surface', () => {
  it('types slots exactly as the compiled module (Snippet / Snippet<[{..}]>, snippets record)', () => {
    const dts = sidecar();
    expect(dts).toMatch(/\n  children\?: Snippet;/);
    expect(dts).toMatch(/\n  foot\?: Snippet;/);
    expect(dts).toMatch(/\n  row\?: Snippet<\[\{ count: Count \}\]>;/);
    expect(dts).toMatch(/\n  snippets\?: Record<string, any>;/);
    expect(dts).not.toMatch(/render(Foot|Row)/);
    expect(dts).not.toMatch(/\n  slots\?:/);
  });
});
