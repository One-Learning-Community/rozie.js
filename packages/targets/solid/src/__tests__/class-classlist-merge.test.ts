/**
 * class / classList merge — regression guard.
 *
 * Solid applies `class={…}` via `el.className = …`, which OVERWRITES any classes
 * a sibling `classList.toggle()` set on the SAME element. The emitter used to
 * route an object-form `:class="{…}"` to a separate `classList={…}` while a
 * static `class="…"` (or class fallthrough) went to `class={…}` — so on an
 * element carrying BOTH, Solid silently dropped every conditional class. This
 * was invisible until a conditional class GATED layout (the resizable splitter's
 * `--horizontal` descendant rule), which collapsed the first panel on Solid only.
 *
 * Contract: an element with a static class AND an object `:class` must emit a
 * SINGLE `class={…}` (object normalized through `rozieClass`) and NEVER a
 * separate `classList={…}`.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../emitSolid.js';

function emit(source: string): string {
  const { ast } = parse(source, { filename: 'ClassMerge.rozie' });
  expect(ast).not.toBeNull();
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  expect(ir).not.toBeNull();
  const result = emitSolid(ir!, { filename: 'ClassMerge.rozie', source });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return result.code;
}

describe('Solid class/classList merge', () => {
  it('merges a static class + object :class into ONE class= via rozieClass, never classList=', () => {
    const code = emit(
      `<rozie name="ClassMerge">\n` +
        `<props>{ on: { type: Boolean, default: false } }</props>\n` +
        `<template>\n` +
        `<div class="base" :class="{ active: $props.on }"></div>\n` +
        `</template>\n` +
        `</rozie>\n`,
    );
    // The conflicting attribute must NOT appear.
    expect(code).not.toContain('classList=');
    // The object is folded into the single class string through rozieClass.
    expect(code).toContain('rozieClass(');
    expect(code).toMatch(/class=\{"base"/);
    // Exactly one class= attribute on the element.
    expect(code.match(/\bclass=\{/g)?.length).toBe(1);
  });

  it('an object :class WITHOUT a static class also emits class= (not classList=)', () => {
    const code = emit(
      `<rozie name="ClassMergeBare">\n` +
        `<props>{ on: { type: Boolean, default: false } }</props>\n` +
        `<template>\n` +
        `<div :class="{ active: $props.on }"></div>\n` +
        `</template>\n` +
        `</rozie>\n`,
    );
    expect(code).not.toContain('classList=');
    expect(code).toContain('rozieClass(');
  });
});
