// Typed public surface phase 3 (spec §5) — `resolveAttrsFallthroughRoot` is the
// single "does auto-fallthrough fire, and onto which element" predicate shared
// by `synthesizeAttrsFallthrough` (runtime spread) and the props-interface
// `extends` clause (typing), so the two can never disagree.
import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { resolveAttrsFallthroughRoot } from '../ir/lowerers/lowerTemplate.js';

function ir(source: string) {
  const { ast } = parse(source, { filename: 'Probe.rozie' });
  if (!ast) throw new Error('parse failed');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lower failed');
  return ir;
}

const wrap = (attrs: string, body: string) =>
  `<rozie name="Probe"${attrs}>\n<template>\n${body}\n</template>\n</rozie>\n`;

describe('resolveAttrsFallthroughRoot', () => {
  it('returns the single html root', () => {
    const r = ir(wrap('', '<button class="b">x</button>'));
    expect(resolveAttrsFallthroughRoot(r.template, r.inheritAttrs)?.tagName).toBe('button');
  });
  it('tolerates slot + whitespace siblings (Phase 82 D-01)', () => {
    const r = ir(wrap('', '<slot name="before" />\n<section>x</section>'));
    expect(resolveAttrsFallthroughRoot(r.template, r.inheritAttrs)?.tagName).toBe('section');
  });
  it('returns null for inherit-attrs="false"', () => {
    const r = ir(wrap(' inherit-attrs="false"', '<div>x</div>'));
    expect(resolveAttrsFallthroughRoot(r.template, r.inheritAttrs)).toBeNull();
  });
  it('returns null for an r-if root', () => {
    const r = ir(wrap('', '<div r-if="true">x</div>'));
    expect(resolveAttrsFallthroughRoot(r.template, r.inheritAttrs)).toBeNull();
  });
  it('agrees with synthesis: the resolved root carries the synthesized $attrs spread', () => {
    const r = ir(wrap('', '<article>x</article>'));
    const root = resolveAttrsFallthroughRoot(r.template, r.inheritAttrs);
    expect(
      root?.attributes.some(
        (a) =>
          a.kind === 'spreadBinding' &&
          a.expression.type === 'Identifier' &&
          a.expression.name === '$attrs',
      ),
    ).toBe(true);
  });
});
