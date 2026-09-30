/**
 * Sidecar slot surface parity (lit): the `.d.rozie.ts` is generated from
 * the same slot functions as the compiled module (typed-surface follow-up).
 */
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLitTypes } from '../index.js';

const SRC = "<rozie name=\"SlotShapes\">\n\n<types>\nexport type Count = number\n</types>\n\n<props>\n{\n  tone: { type: String, default: 'info' },\n}\n</props>\n\n<data>\n{\n  count: 0,\n}\n</data>\n\n<template>\n  <div>\n    <slot />\n    <slot name=\"foot\" />\n    <slot name=\"row\" :count=\"$data.count\" :param-types=\"{ count: 'Count' }\" />\n  </div>\n</template>\n\n</rozie>\n";

function sidecar(): string {
  const { ast } = parse(SRC, { filename: 'SlotShapes.rozie' });
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return emitLitTypes(ir!);
}

describe('lit sidecar slot surface', () => {
  it('declares no slot props (slots are not props on this target)', () => {
    const dts = sidecar();
    expect(dts).toContain('export interface SlotShapesProps');
    expect(dts).not.toMatch(/render(Foot|Row)/);
    expect(dts).not.toMatch(/children\?:/);
    expect(dts).not.toMatch(/slots\?:/);
  });
});
