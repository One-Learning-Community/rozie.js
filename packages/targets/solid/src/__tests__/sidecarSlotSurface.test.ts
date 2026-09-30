/**
 * Sidecar slot surface parity (solid): the `.d.rozie.ts` is generated from
 * the same slot functions as the compiled module (typed-surface follow-up).
 */
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolidTypes } from '../index.js';

const SRC = "<rozie name=\"SlotShapes\">\n\n<types>\nexport type Count = number\n</types>\n\n<props>\n{\n  tone: { type: String, default: 'info' },\n}\n</props>\n\n<data>\n{\n  count: 0,\n}\n</data>\n\n<template>\n  <div>\n    <slot />\n    <slot name=\"foot\" />\n    <slot name=\"row\" :count=\"$data.count\" :param-types=\"{ count: 'Count' }\" />\n  </div>\n</template>\n\n</rozie>\n";

function sidecar(): string {
  const { ast } = parse(SRC, { filename: 'SlotShapes.rozie' });
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return emitSolidTypes(ir!);
}

describe('solid sidecar slot surface', () => {
  it('types slots exactly as the compiled module (footSlot: JSX.Element, rowSlot ctx fn)', () => {
    const dts = sidecar();
    expect(dts).toMatch(/\n  children\?: JSX\.Element;/);
    expect(dts).toMatch(/\n  footSlot\?: JSX\.Element;/);
    expect(dts).toMatch(/\n  rowSlot\?: \(ctx: RowSlotCtx\) => JSX\.Element;/);
    expect(dts).toMatch(/interface RowSlotCtx \{ count: Count; \}/);
    expect(dts).toContain("import type { JSX } from 'solid-js';");
    expect(dts).not.toMatch(/render(Foot|Row)/);
  });
});
