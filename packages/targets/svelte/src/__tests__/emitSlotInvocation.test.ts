// Phase 07.3.1 Plan 02 — Svelte producer snippet-arg object-shape regression test.
//
// Locks the D-02 contract: `{@render header({ close })}` (object-shape) NOT
// `{@render header(close)}` (positional tuple). The consumer-side Phase 07.2
// `{#snippet header({ close })}` destructure receives a real object payload;
// without this lock, the producer could silently regress to positional and
// the destructured `close` would resolve to `undefined`, no-op the click.
//
// Modeled on sibling `emitTemplate.test.ts` describe/it layout. Tests the
// pure `emitSlotInvocation` function with hand-built IR nodes — no SFC parse
// step required, so failures point directly at the emitter not at the lowerer.
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { emitSlotInvocation } from '../emit/emitSlotInvocation.js';
import type {
  EmitSlotInvocationCtx,
} from '../emit/emitSlotInvocation.js';
import type {
  IRComponent,
  SlotDecl,
  TemplateSlotInvocationIR,
} from '../../../../core/src/ir/types.js';

/**
 * Minimal mock IR — only `slots` is read by emitSlotInvocation (decl lookup
 * for `presence` + `defaultContent`). All other IR fields are stubbed so the
 * tests stay focused on the arg-shape contract.
 */
function makeCtx(slots: SlotDecl[] = []): EmitSlotInvocationCtx {
  const ir = {
    type: 'IRComponent',
    name: 'TestComponent',
    props: [],
    state: [],
    computed: [],
    refs: [],
    slots,
    emits: [],
    lifecycle: [],
    watchers: [],
    listeners: [],
    template: null,
    styles: { content: '', scoped: false, escapeHatchSelectors: [], sourceLoc: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } } },
    components: [],
  } as unknown as IRComponent;
  return {
    ir,
    emitChildren: () => '',
  };
}

function makeSlotDecl(name: string, paramNames: string[]): SlotDecl {
  return {
    name,
    presence: 'always',
    defaultContent: null,
    params: paramNames.map((n) => ({
      name: n,
      sourceLoc: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
    })),
    sourceLoc: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
  } as unknown as SlotDecl;
}

function makeInvocation(
  slotName: string,
  args: Array<{ name: string; expression: t.Expression }>,
): TemplateSlotInvocationIR {
  return {
    type: 'TemplateSlotInvocation',
    slotName,
    args: args.map((a) => ({
      name: a.name,
      expression: a.expression,
      deps: [],
    })),
    fallback: [],
    sourceLoc: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
    context: 'declaration',
  };
}

describe('emitSlotInvocation (Phase 07.3.1 Blocker #2 D-02)', () => {
  it('emits object-shape snippet args for single-arg scoped slot', () => {
    const node = makeInvocation('header', [
      { name: 'close', expression: t.identifier('close') },
    ]);
    const ctx = makeCtx([makeSlotDecl('header', ['close'])]);
    const out = emitSlotInvocation(node, ctx);
    expect(out).toContain('{@render header?.({ close })}');
    // Guard against regression to positional form.
    expect(out).not.toMatch(/\{@render header\?\.\(close\)\}/);
  });

  it('emits object-shape with multiple args for trigger-style slot', () => {
    const node = makeInvocation('trigger', [
      { name: 'open', expression: t.identifier('open') },
      { name: 'toggle', expression: t.identifier('toggle') },
    ]);
    const ctx = makeCtx([makeSlotDecl('trigger', ['open', 'toggle'])]);
    const out = emitSlotInvocation(node, ctx);
    expect(out).toContain('{@render trigger?.({ open, toggle })}');
    expect(out).not.toMatch(/\{@render trigger\?\.\(open, toggle\)\}/);
  });

  it('emits zero-arg call for unscoped slot', () => {
    const node = makeInvocation('footer', []);
    const ctx = makeCtx([makeSlotDecl('footer', [])]);
    const out = emitSlotInvocation(node, ctx);
    expect(out).toContain('{@render footer?.()}');
    // No object literal for zero-arg case.
    expect(out).not.toMatch(/\{@render footer\?\.\(\{[^}]*\}\)\}/);
  });

  it('emits key: expr when IR arg expression is not a bare identifier', () => {
    const node = makeInvocation('header', [
      {
        name: 'remaining',
        expression: t.binaryExpression(
          '-',
          t.identifier('total'),
          t.identifier('done'),
        ),
      },
    ]);
    const ctx = makeCtx([makeSlotDecl('header', ['remaining'])]);
    const out = emitSlotInvocation(node, ctx);
    expect(out).toContain('{@render header?.({ remaining: total - done })}');
  });
});
