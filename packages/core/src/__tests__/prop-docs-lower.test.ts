// Phase 58 (first-class prop documentation) — RED-first core unit test (SC-1).
//
// This file is INTENTIONALLY RED at the end of Plan 01. It asserts on two
// surfaces that DO NOT EXIST YET:
//   1. `PropDecl.docs` — a structured `{ description?, deprecated?, example? }`
//      object lowered from a `<props>` entry's `docs:` key.
//   2. ROZ018 — a collected (never thrown) diagnostic on a malformed `docs`
//      shape. The codes.ts entry is not declared yet, so the test references
//      the code by the STRING `'ROZ018'` rather than the RozieErrorCode enum.
//
// Plan 02 turns these green by adding extraction in lowerProps + the ROZ018
// diagnostic. A GREEN result here BEFORE Plan 02 means the test is not actually
// asserting the new field and must be tightened — do not "fix" it by relaxing.
//
// Harness mirrors validateSlotPropCollision.test.ts: drive an inline `.rozie`
// source through parse() → lowerToIR() (the shared @rozie/unplugin chokepoint),
// then read `ir.props` and the collected diagnostics array.
import { describe, it, expect } from 'vitest';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import type { PropDecl } from '../ir/types.js';

const ROZ018 = 'ROZ018';

/** parse + lower an inline `.rozie` source, returning ir.props + diagnostics. */
function lowerProps(source: string) {
  const { ast } = parse(source, { filename: 'PropDocsLower.rozie' });
  expect(ast, 'parse() should produce an AST for a well-formed source').not.toBeNull();
  const { ir, diagnostics } = lowerToIR(ast!, {
    modifierRegistry: createDefaultRegistry(),
  });
  expect(ir, 'lowerToIR should produce an IR for a well-formed source').not.toBeNull();
  return { props: ir!.props, diagnostics };
}

/** Locate a lowered prop by name. */
function byName(props: PropDecl[], name: string): PropDecl {
  const p = props.find((pr) => pr.name === name);
  expect(p, `expected a lowered prop named '${name}'`).toBeDefined();
  return p!;
}

describe('prop docs lowering [Phase 58] — SC-1 (RED until Plan 02)', () => {
  it('A: a `docs` object with description + deprecated-string + example lowers to PropDecl.docs', () => {
    const source = `<rozie name="DocsA">
<props>
{
  label: {
    type: String,
    default: '',
    docs: {
      description: 'The visible label.',
      deprecated: 'Use text instead.',
      example: '<DocsA label="Save" />',
    },
  },
}
</props>
<template><div>{{ $props.label }}</div></template>
</rozie>
`;
    const { props } = lowerProps(source);
    const label = byName(props, 'label');
    // `docs` is the new field — absent today, so this assertion is RED.
    expect((label as unknown as { docs?: unknown }).docs).toEqual({
      description: 'The visible label.',
      deprecated: 'Use text instead.',
      example: '<DocsA label="Save" />',
    });
  });

  it('B: `deprecated: true` (boolean) lowers docs.deprecated === true (bare-@deprecated branch)', () => {
    const source = `<rozie name="DocsB">
<props>
{
  legacy: {
    type: String,
    default: '',
    docs: {
      description: 'A legacy prop.',
      deprecated: true,
    },
  },
}
</props>
<template><div>{{ $props.legacy }}</div></template>
</rozie>
`;
    const { props } = lowerProps(source);
    const legacy = byName(props, 'legacy');
    const docs = (legacy as unknown as { docs?: { deprecated?: unknown } }).docs;
    expect(docs).toBeDefined();
    expect(docs!.deprecated).toBe(true);
  });

  it('C: a malformed `docs` shape pushes a ROZ018 diagnostic and does NOT throw', () => {
    // `docs: 42` is not an object literal — the malformed-shape case.
    const source = `<rozie name="DocsC">
<props>
{
  broken: {
    type: String,
    default: '',
    docs: 42,
  },
}
</props>
<template><div>{{ $props.broken }}</div></template>
</rozie>
`;
    // Must not throw — diagnostics are collected, per D-08.
    const { diagnostics } = lowerProps(source);
    const malformed = diagnostics.filter((d) => d.code === ROZ018);
    expect(
      malformed.length,
      'expected exactly one ROZ018 diagnostic on a malformed docs shape',
    ).toBe(1);
  });

  it('D: a prop with NO `docs` key lowers PropDecl.docs === undefined', () => {
    const source = `<rozie name="DocsD">
<props>
{
  plain: { type: Number, default: 0 },
}
</props>
<template><div>{{ $props.plain }}</div></template>
</rozie>
`;
    const { props } = lowerProps(source);
    const plain = byName(props, 'plain');
    expect((plain as unknown as { docs?: unknown }).docs).toBeUndefined();
  });
});
