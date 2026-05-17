/**
 * rewriteListenerExpression — Phase 07.3.2 Plan 10 Task 1.
 *
 * §slots-X-merge — $slots.X in <listeners> when/handler context lowers
 * to merged form. Listeners run in class-body context (use `this.` prefix).
 *
 * Closes Angular row of F-07.3.2-05-A.
 */
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import { rewriteListenerExpression } from '../rewrite/rewriteListenerExpression.js';
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';

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

describe('§slots-X-merge-listener — $slots.X in <listeners> context', () => {
  it('it #7: listener expression `$slots.header && open` rewrites to merged form with this. prefix', () => {
    const ir = makeIR([makeSlot('header')]);
    const expr = parseExpression('$slots.header');
    const out = rewriteListenerExpression(expr, ir);
    expect(out).toBe("(this.headerTpl ?? this.templates()?.['header'])");
  });
});
