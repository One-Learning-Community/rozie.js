// `r-external` engine-wrapper marker — lowerTemplate detection.
//
// The bare-attribute form (`<div r-external>`) sets
// `TemplateElementIR.isExternal === true` and is stripped from the
// `attributes` array so it doesn't reach per-target emitters as a regular
// directive. Authors apply the marker to the DOM container they hand to a
// third-party engine (SortableJS-bound list, TipTap editor host, …); Lit's
// emitter wraps the marked element's CHILDREN in `keyed(seq, …)` so
// `$reconcileAfterDomMutation()` can dispose stale children without
// detaching the marked element itself (and any listeners attached to it).
// The other five targets ignore the marker — their keyed reconcilers cope
// with engine DOM mutation natively.

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import type {
  IRComponent,
  TemplateElementIR,
} from '../../src/ir/types.js';

function lower(src: string): IRComponent {
  const result = parse(src, { filename: 'probe.rozie' });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  const { ir } = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!ir) throw new Error('lowerToIR returned null IR');
  return ir;
}

function rozie(templateBody: string): string {
  return `<rozie name="Probe">
<template>
${templateBody}
</template>
</rozie>
`;
}

function firstElement(ir: IRComponent): TemplateElementIR {
  const root = ir.template;
  if (!root) throw new Error('ir.template is null');
  // The template-block content lands inside a TemplateFragment whose first
  // element child is the user-authored root tag.
  const node =
    root.type === 'TemplateFragment'
      ? root.children.find((c) => c.type === 'TemplateElement')
      : root;
  if (!node || node.type !== 'TemplateElement') {
    throw new Error(
      `expected a TemplateElement; got ${node?.type ?? 'undefined'}`,
    );
  }
  return node;
}

describe('lowerTemplate — r-external marker', () => {
  it('flags `isExternal: true` on the element bearing the bare `r-external` attribute', () => {
    const ir = lower(rozie('<div r-external><span>child</span></div>'));
    const root = firstElement(ir);
    expect(root.isExternal).toBe(true);
  });

  it('strips the `r-external` directive from the emitted attributes', () => {
    const ir = lower(rozie('<div class="host" r-external></div>'));
    const root = firstElement(ir);
    // `r-external` is a compile-time marker; it must not surface in
    // `attributes` as a regular directive binding. The `class` attribute is
    // preserved; the synthesized `$attrs` spread (Phase 14 auto-fallthrough)
    // lands as a name-less `spreadBinding` — and there is NO entry named
    // `external` or `r-external`.
    const names = root.attributes.map((a) => a.name);
    expect(names).not.toContain('external');
    expect(names).not.toContain('r-external');
    expect(names).toContain('class');
  });

  it('omits the flag on an element without `r-external` (no IR drift for the common case)', () => {
    const ir = lower(rozie('<div class="plain"></div>'));
    const root = firstElement(ir);
    // Spread-when-set keeps the field absent (not `false`) so dist-parity
    // byte-equality assertions on existing fixtures stay stable.
    expect(root.isExternal).toBeUndefined();
  });

  it('does not propagate the flag to descendants', () => {
    const ir = lower(
      rozie('<div r-external><section><span>child</span></section></div>'),
    );
    const root = firstElement(ir);
    expect(root.isExternal).toBe(true);
    const child = root.children[0] as TemplateElementIR;
    expect(child.type).toBe('TemplateElement');
    expect(child.isExternal).toBeUndefined();
  });

  it('coexists with other directives on the same element', () => {
    // r-bind / @click / static class all coexist with the marker — none of
    // the existing directive paths short-circuit when r-external is present.
    const ir = lower(
      rozie('<div class="host" r-external r-bind="$attrs" @click="onClick"></div>'),
    );
    const root = firstElement(ir);
    expect(root.isExternal).toBe(true);
    // class + spreadBinding from r-bind should both reach attributes; the
    // @click event lands in `events`.
    expect(root.attributes.map((a) => a.name).sort()).toEqual(
      expect.arrayContaining(['class']),
    );
    expect(root.events.map((e) => e.event)).toEqual(['click']);
  });
});
