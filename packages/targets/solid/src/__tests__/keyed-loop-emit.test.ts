// Quick task 260704-mf3 — Solid target must honor the author `:key` on `r-for`.
//
// Today a keyed `r-for="item in xs" :key="item.id"` compiles on Solid ONLY to a
// bare `<For each={xs()}>`, which reconciles by array-item REFERENCE identity and
// silently discards the parsed key at `TemplateLoopIR.keyExpression`. That tears
// down composed-child state (an open Popover menu) when table-core returns fresh
// wrapper objects on pin/column changes. Direction (a): emit
// `@solid-primitives/keyed`'s `<Key>` when a key exists.
//
// RED-first: these assertions FAIL against current HEAD (emitLoop drops
// keyExpression). Committed alone before the GREEN implementation.
//
// Harness mirrors emitTemplate.test.ts (same parse → lowerToIR → emitSolid path).
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitSolid } from '../emitSolid.js';

function lowerInline(source: string, name = 'KeyedLoop'): IRComponent {
  const result = parse(source, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

const KEYED = `<rozie name="KeyedLoop">
<data>{ rows: [] }</data>
<template>
<ul><li r-for="item in $data.rows" :key="item.id">{{ item.label }}</li></ul>
</template>
</rozie>
`;

const KEYLESS = `<rozie name="KeylessLoop">
<data>{ rows: [] }</data>
<template>
<ul><li r-for="item in $data.rows">{{ item.label }}</li></ul>
</template>
</rozie>
`;

const KEYED_INDEX = `<rozie name="KeyedIndexLoop">
<data>{ rows: [] }</data>
<template>
<ul><li r-for="(item, i) in $data.rows" :key="item.id">{{ item.label }}-{{ i }}</li></ul>
</template>
</rozie>
`;

describe('Solid keyed r-for → <Key> (260704-mf3)', () => {
  it('Test 1 — keyed loop emits <Key ... by={...}> with accessor-invoked item refs', () => {
    const ir = lowerInline(KEYED);
    const { code } = emitSolid(ir, { filename: 'KeyedLoop.rozie', source: KEYED });
    // <Key> replaces <For> for the keyed loop.
    expect(code).toContain('<Key each={');
    expect(code).toContain('by={(item) => item().id}');
    // Body item ref is invoked as an accessor (Key yields accessors).
    expect(code).toContain('item().label');
    // The keyless <For> element must NOT appear for this keyed source.
    expect(code).not.toContain('<For');
    // Import injected from @solid-primitives/keyed (NOT solid-js).
    expect(code).toContain("import { Key } from '@solid-primitives/keyed'");
  });

  it('Test 2 — keyless loop stays byte-identical <For> (no <Key>, no keyed import)', () => {
    const ir = lowerInline(KEYLESS);
    const { code } = emitSolid(ir, { filename: 'KeylessLoop.rozie', source: KEYLESS });
    expect(code).toContain('<For each={');
    expect(code).toContain('{(item) => ');
    // RAW item ref — no accessor invocation under <For>.
    expect(code).toContain('item.label');
    expect(code).not.toContain('item().label');
    expect(code).not.toContain('<Key');
    expect(code).not.toContain('@solid-primitives/keyed');
  });

  it('Test 3 — index alias under <Key> is routed through invokeAccessors (i())', () => {
    const ir = lowerInline(KEYED_INDEX);
    const { code } = emitSolid(ir, { filename: 'KeyedIndexLoop.rozie', source: KEYED_INDEX });
    expect(code).toContain('by={(item) => item().id}');
    expect(code).toContain('item().label');
    // Key passes index as an ACCESSOR too — the author alias `i` must invoke.
    expect(code).toContain('i()');
    expect(code).toContain('<Key each={');
  });
});
