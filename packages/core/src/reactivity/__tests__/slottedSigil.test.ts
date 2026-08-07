// computeExpressionDeps — `$slotted.<name>` sigil dep-collection contract
// (quick 260807-cor, D4).
//
// `$slotted.<name>` MUST collect as a `{ scope: 'slotted', path: [name] }`
// SignalRef — the MEMBER shape is what makes the dep visible to
// `computeExpressionDeps` at all (a CALL shape like `$slotted('name')` is
// invisible to the MemberExpression-rooted collector, per RESEARCH.md's
// "why member shape, not call shape" — a `$watch` over it would silently
// never fire). See computeDeps.ts's explicit pre-`detectMagicAccess` branch.
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import { parse } from '../../parse.js';
import { collectAllDeclarations } from '../../semantic/bindings.js';
import { computeExpressionDeps } from '../computeDeps.js';

/** Build a BindingsTable with a known <props> field `x` for the mixed-dep test. */
function propsXBindings() {
  const source = `<rozie name="SlottedDepProbe">
<props>{ x: { type: Number, default: 0 } }</props>
<template><div></div></template>
</rozie>`;
  const { ast } = parse(source, { filename: 'SlottedDepProbe.rozie' });
  if (!ast) throw new Error('parse failed');
  return collectAllDeclarations(ast);
}

function emptyBindings() {
  const source = `<rozie name="SlottedDepProbe">
<template><div></div></template>
</rozie>`;
  const { ast } = parse(source, { filename: 'SlottedDepProbe.rozie' });
  if (!ast) throw new Error('parse failed');
  return collectAllDeclarations(ast);
}

describe('computeExpressionDeps — $slotted.<name> sigil (quick 260807-cor D4)', () => {
  it('a $watch getter reading $slotted.default.length yields exactly one SignalRef, scope "slotted", path ["default"]', () => {
    const bindings = emptyBindings();
    const expr = parseExpression('$slotted.default.length', { sourceType: 'module' });
    const deps = computeExpressionDeps(expr, bindings);

    expect(deps.length, JSON.stringify(deps)).toBe(1);
    const dep = deps[0]!;
    expect(dep.scope).toBe('slotted');
    if (dep.scope === 'slotted') {
      expect(dep.path).toEqual(['default']);
    }
  });

  it('a bare $slotted identifier never appears as a closure dep', () => {
    const bindings = emptyBindings();
    // Bare-identifier form has no legal read surface (member-only sigil), but
    // the collector must still never mis-classify the OBJECT half of a member
    // chain as a free closure identifier — the MAGIC_ACCESSOR_NAMES entry is
    // the guard under test.
    const expr = parseExpression('$slotted.slide', { sourceType: 'module' });
    const deps = computeExpressionDeps(expr, bindings);

    const bareClosure = deps.filter(
      (d) => d.scope === 'closure' && d.identifier === '$slotted',
    );
    expect(
      bareClosure,
      `$slotted must never surface as a bare closure dep; got ${JSON.stringify(deps)}`,
    ).toEqual([]);
  });

  it('$slotted.slide and $props.x in one getter yield two distinct deps', () => {
    const bindings = propsXBindings();
    const expr = parseExpression('$slotted.slide.length + $props.x', {
      sourceType: 'module',
    });
    const deps = computeExpressionDeps(expr, bindings);

    expect(deps.length, JSON.stringify(deps)).toBe(2);
    const slotted = deps.filter((d) => d.scope === 'slotted');
    const props = deps.filter((d) => d.scope === 'props');
    expect(slotted.length, JSON.stringify(deps)).toBe(1);
    expect(props.length, JSON.stringify(deps)).toBe(1);
    if (slotted[0]!.scope === 'slotted') {
      expect(slotted[0]!.path).toEqual(['slide']);
    }
    if (props[0]!.scope === 'props') {
      expect(props[0]!.path).toEqual(['x']);
    }
  });
});
