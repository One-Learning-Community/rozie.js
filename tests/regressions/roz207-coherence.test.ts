/**
 * roz207-coherence.test.ts — quick task 260830-m30.
 *
 * MACHINE-CHECKS THE ROZ207 COHERENCE INVARIANT:
 *
 *   A shape is ROZ207-exempt in `@rozie/core` IF AND ONLY IF it is reactively
 *   lowered by ALL FOUR target emitters (React, Solid, Angular, Lit).
 *
 * The invariant has, until now, been maintained by hand across five files —
 * core's `isCoveredNestedAssign` / `isCoveredDynDelete` and the four targets'
 * `detectCoveredNestedAssign` / `detectCoveredDynDelete`. A drift in any one of
 * them produces the exact failure ROZ207 exists to prevent: either a silently
 * non-reactive emit (exempt in core, unlowered by a target) or a spurious hard
 * error on code that actually works. This file binds all five together against
 * ONE shared table so the drift cannot survive a test run.
 *
 * `tests/regressions` is the only package that depends on `@rozie/core` AND all
 * four target packages, so it is the only place the invariant can be checked
 * end to end.
 *
 * TWO IMPORTANT MECHANICS:
 *
 * 1. The per-target half drives `parse -> lowerToIR -> emit<Target>` DIRECTLY.
 *    It must NOT go through `compile()`: `compile()` gates emit on any
 *    error-severity diagnostic and returns `code: ''`, so every FLAGGED row
 *    would yield empty code and the "was it lowered?" probe would pass
 *    vacuously.
 *
 * 2. This package resolves `@rozie/core` and the target packages through their
 *    published `dist/` (see package.json — no source paths), so a source change
 *    to a validator or an emitter is only reflected here AFTER a rebuild.
 *
 * Every row below is a NESTED mutation, so no shallow `$data.x = y` write can
 * produce a false positive on the per-target "reactive setter present" probes.
 */
import { createDefaultRegistry, compile, lowerToIR, parse } from '@rozie/core';
import { emitAngular } from '@rozie/target-angular';
import { emitLit } from '@rozie/target-lit';
import { emitReact } from '@rozie/target-react';
import { emitSolid } from '@rozie/target-solid';
import { describe, expect, it } from 'vitest';

const FILENAME = 'Roz207Coherence.rozie';

function rozie(data: string, scriptBody: string): string {
  return `<rozie name="Roz207Coherence">
<data>
${data}
</data>
<script lang="ts">
function go(): void {
${scriptBody}
}
</script>
<template>
<button @click="go()">Go</button>
</template>
</rozie>
`;
}

/** ROZ207 hit count from core's real diagnostic pipeline. */
function roz207Count(source: string): number {
  const { diagnostics } = compile(source, {
    target: 'react',
    filename: FILENAME,
    types: false,
    sourceMap: false,
  });
  return diagnostics.filter((d) => d.code === 'ROZ207').length;
}

type EmitFn = (ir: never, opts: { filename: string; source: string }) => { code: string };

/** Direct emit — never `compile()`, which returns empty code on any error. */
function emitWith(emitFn: EmitFn, source: string): string {
  const { ast } = parse(source, { filename: FILENAME });
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return emitFn(ir as never, { filename: FILENAME, source }).code;
}

/**
 * Per-target "this key was reactively lowered" probes. Each is the target's own
 * reactive-write idiom, which the emitter synthesizes ONLY on the covered path:
 * React/Solid a `setKey(` call, Angular `this.key.update(`, Lit
 * `this._key.value = `. A non-covered shape leaves the author's in-place write
 * verbatim and never produces these.
 */
const TARGETS: Array<{
  name: string;
  emit: EmitFn;
  probe: (key: string) => string;
}> = [
  {
    name: 'react',
    emit: emitReact as unknown as EmitFn,
    probe: (k) => `set${k[0]!.toUpperCase()}${k.slice(1)}(`,
  },
  {
    name: 'solid',
    emit: emitSolid as unknown as EmitFn,
    probe: (k) => `set${k[0]!.toUpperCase()}${k.slice(1)}(`,
  },
  {
    name: 'angular',
    emit: emitAngular as unknown as EmitFn,
    probe: (k) => `this.${k}.update(`,
  },
  {
    name: 'lit',
    emit: emitLit as unknown as EmitFn,
    probe: (k) => `this._${k}.value = `,
  },
];

/**
 * [label, dataBlock, scriptBody, mutatedKey, expectedCovered]
 *
 * Seeded from the union of the Task 2-6 case tables — both the covered and the
 * flagged rows. `mutatedKey` is the top-level `<data>` key the shape writes to;
 * it is what the per-target probe is built from.
 */
const TABLE: Array<[string, string, string, string, boolean]> = [
  // ---- COVERED (quick 260718-uvq subset) ----
  ['CW-MEMBER member write', '{ obj: { field: 0 } }', '$data.obj.field = 5;', 'obj', true],
  ['CW-INDEX numeric literal on array init', '{ arr: [1, 2] }', '$data.arr[0] = 9;', 'arr', true],
  ['CW-ARRAY push', '{ items: [1] }', '$data.items.push(2);', 'items', true],
  ['CW-ARRAY pop', '{ items: [1, 2] }', '$data.items.pop();', 'items', true],
  ['CW-ARRAY shift', '{ items: [1, 2] }', '$data.items.shift();', 'items', true],
  ['CW-ARRAY unshift', '{ items: [1] }', '$data.items.unshift(2);', 'items', true],
  ['CW-ARRAY splice', '{ items: [1, 2] }', '$data.items.splice(0, 1);', 'items', true],

  // ---- COVERED (quick 260830-m30 — the dynamic-key registry pair) ----
  ['CW-DYNKEY identifier key on object init', '{ reg: {} }', 'const id = "k"; $data.reg[id] = 5;', 'reg', true],
  ['CW-DYNKEY string key on object init', '{ reg: {} }', '$data.reg["k"] = 5;', 'reg', true],
  ['CW-DYNKEY identifier index on array init', '{ arr: [1, 2] }', 'const i = 1; $data.arr[i] = 9;', 'arr', true],
  ['CW-INDEX RETROFIT numeric literal on object init', '{ obj: {} }', '$data.obj[0] = 9;', 'obj', true],
  ['CW-DYNDELETE on object init', '{ reg: {} }', 'const id = "k"; delete $data.reg[id];', 'reg', true],

  // ---- FLAGGED (pre-existing) ----
  ['depth-3 member write', '{ a: { b: { c: 0 } } }', '$data.a.b.c = 1;', 'a', false],
  ['compound nested assignment', '{ obj: { n: 0 } }', '$data.obj.n += 1;', 'obj', false],
  ['UpdateExpression on a nested member', '{ obj: { n: 0 } }', '$data.obj.n++;', 'obj', false],
  ['in-place sort', '{ items: [2, 1] }', '$data.items.sort();', 'items', false],
  ['in-place reverse', '{ items: [1, 2] }', '$data.items.reverse();', 'items', false],
  ['in-place fill', '{ items: [1, 2] }', '$data.items.fill(0);', 'items', false],
  ['Map mutator (set)', '{ m: new Map() }', "$data.m.set('k', 1);", 'm', false],
  ['Set mutator (add)', '{ s: new Set() }', '$data.s.add(1);', 's', false],
  ['Set mutator (clear)', '{ s: new Set() }', '$data.s.clear();', 's', false],
  [
    'expression-context covered mutator',
    '{ items: [1, 2] }',
    'const removed = $data.items.pop(); void removed;',
    'items',
    false,
  ],

  // ---- FLAGGED (quick 260830-m30 — newly loud; all of these were SILENT) ----
  ['delete on array init (hole semantics)', '{ arr: [] }', 'const i = 0; delete $data.arr[i];', 'arr', false],
  [
    'delete on non-literal init',
    '{ reg: null }',
    'const id = "k"; delete $data.reg[id];',
    'reg',
    false,
  ],
  ['non-computed nested delete', '{ obj: { field: 1 } }', 'delete $data.obj.field;', 'obj', false],
  ['depth-3 delete', '{ a: { b: {} } }', 'const k = "x"; delete $data.a.b[k];', 'a', false],
  [
    'expression-context delete',
    '{ reg: {} }',
    'const id = "k"; const ok = delete $data.reg[id]; void ok;',
    'reg',
    false,
  ],
  [
    'impure key expression',
    '{ reg: {} }',
    'function k(){ return "a"; } $data.reg[k()] = 5;',
    'reg',
    false,
  ],
  ['numeric index on non-literal init', '{ reg: null }', '$data.reg[0] = 5;', 'reg', false],
];

describe('ROZ207 coherence invariant (core exemption <-> four target lowerings)', () => {
  for (const [label, data, body, key, expectedCovered] of TABLE) {
    const source = rozie(data, body);

    it(`core: ${label} is ${expectedCovered ? 'EXEMPT' : 'FLAGGED'}`, () => {
      const hits = roz207Count(source);
      if (expectedCovered) {
        expect(hits, `expected no ROZ207 for a covered shape`).toBe(0);
      } else {
        expect(hits, `expected exactly one ROZ207 for an uncovered shape`).toBe(1);
      }
    });

    for (const target of TARGETS) {
      it(`${target.name}: ${label} is ${expectedCovered ? 'LOWERED' : 'NOT lowered'}`, () => {
        const code = emitWith(target.emit, source);
        const probe = target.probe(key);
        expect(
          code.includes(probe),
          `expected \`${probe}\` to be ${expectedCovered ? 'PRESENT' : 'ABSENT'} in ${target.name} output`,
        ).toBe(expectedCovered);
      });
    }
  }
});
