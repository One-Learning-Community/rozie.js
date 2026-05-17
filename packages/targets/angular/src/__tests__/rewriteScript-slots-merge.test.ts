/**
 * rewriteScript — Phase 07.3.2 Plan 10 Task 1.
 *
 * §slots-X-merge — $slots.X in <script> context lowers to the merged
 * `(this.<X>Tpl ?? this.templates()?.['<x>'])` form (script-side uses
 * `this.` prefix).
 *
 * Closes Angular row of F-07.3.2-05-A.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import _generate from '@babel/generator';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';

const generate = (typeof _generate === 'function'
  ? _generate
  : (_generate as any).default) as typeof _generate;

const sloc = { start: 0, end: 0 } as unknown as SlotDecl['sourceLoc'];

function makeSlot(name: string): SlotDecl {
  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params: [],
    presence: 'conditional',
    nestedSlots: [],
    sourceLoc: sloc,
  };
}

function makeIR(slots: SlotDecl[]): IRComponent {
  return {
    name: 'TestComp',
    props: [],
    state: [],
    refs: [],
    computed: [],
    methods: [],
    lifecycle: {},
    slots,
    events: [],
    template: { type: 'TemplateFragment', children: [] },
    styles: [],
    components: [],
    listenersBlock: { listeners: [] },
    emits: [],
  } as unknown as IRComponent;
}

describe('§slots-X-merge-script — $slots.X in <script> context', () => {
  it('it #6: script statement `if ($slots.header) { ... }` rewrites to merged form with this. prefix', () => {
    const ir = makeIR([makeSlot('header')]);
    const program = parse('if ($slots.header) { foo(); }', {
      sourceType: 'module',
      plugins: ['typescript'],
    });
    const { rewrittenProgram } = rewriteRozieIdentifiers(program, ir);
    const out = generate(rewrittenProgram, { retainLines: false, compact: false }).code;
    expect(out).toContain("(this.headerTpl ?? this.templates()?.['header'])");
  });
});
