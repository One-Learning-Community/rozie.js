/**
 * emitSlotInvocation — Phase 07.3.2 Plan 10 Task 2.
 *
 * §inner-guard-merged — the inner @if guard at L335 + L340 uses
 * mergedTplRef (mirroring the *ngTemplateOutlet binding at L327)
 * so the @if evaluates truthy when ONLY dynamic-name templates
 * are present (Modal 2 dynamic-name scenario).
 *
 * Without this, the outer r-if guard from Task 1's rewriter might evaluate
 * truthy via the merge, but the inner @if would still short-circuit on the
 * bare static tplField → *ngTemplateOutlet would never fire.
 *
 * Closes Angular row of F-07.3.2-05-A tier 2.
 */
import { describe, it, expect } from 'vitest';
import { emitSlotInvocation } from '../emit/emitSlotInvocation.js';
import type {
  IRComponent,
  SlotDecl,
  TemplateSlotInvocationIR,
} from '../../../../core/src/ir/types.js';

const sloc = { start: 0, end: 0 } as unknown as SlotDecl['sourceLoc'];

function makeSlot(
  name: string,
  presence: 'always' | 'conditional',
  defaultContent: SlotDecl['defaultContent'] = null,
): SlotDecl {
  return {
    type: 'SlotDecl',
    name,
    defaultContent,
    params: [],
    presence,
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

function makeInvocation(slotName: string): TemplateSlotInvocationIR {
  return {
    type: 'TemplateSlotInvocation',
    slotName,
    args: [],
    fallback: [],
    sourceLoc: sloc as any,
    context: 'declaration',
  };
}

describe('§inner-guard-merged — @if guard uses mergedTplRef (Plan 10 F-07.3.2-05-A)', () => {
  it('it #1: presence=conditional, no fallback — @if uses merged form', () => {
    const ir = makeIR([makeSlot('header', 'conditional')]);
    const inv = makeInvocation('header');
    const out = emitSlotInvocation(inv, {
      ir,
      emitChildren: () => '',
    });
    expect(out).toMatch(/^@if \(\(headerTpl \?\? templates\(\)\?\.\['header'\]\)\)/);
    // Make sure no bare-tplField @if leaked through.
    expect(out).not.toMatch(/@if \(headerTpl\) \{/);
  });

  it('it #2: presence=conditional WITH fallback — @if + @else both use merged form', () => {
    const ir = makeIR([
      makeSlot('header', 'conditional', {
        type: 'TemplateStaticText',
        text: 'Fallback',
        sourceLoc: sloc as any,
      } as any),
    ]);
    const inv = makeInvocation('header');
    const out = emitSlotInvocation(inv, {
      ir,
      emitChildren: () => 'Fallback',
    });
    expect(out).toContain("@if ((headerTpl ?? templates()?.['header'])) {");
    expect(out).toContain('@else {');
    expect(out).not.toMatch(/@if \(headerTpl\) \{/);
  });

  it('it #3: presence=always, no fallback — no @if guard (unchanged)', () => {
    const ir = makeIR([makeSlot('header', 'always')]);
    const inv = makeInvocation('header');
    const out = emitSlotInvocation(inv, {
      ir,
      emitChildren: () => '',
    });
    // No @if wrapper — bare outlet tag.
    expect(out).not.toContain('@if (');
    expect(out).toContain('*ngTemplateOutlet');
    // Outlet binding still uses the merged form (Plan 03).
    expect(out).toContain("(headerTpl ?? templates()?.['header'])");
  });
});
