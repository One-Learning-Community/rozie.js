// Phase 66 Plan 66-01 Task 1 — resolveComponentRefs core-shared resolver.
//
// Lifted VERBATIM from Angular's collectComponentRefTypes (D-1). The four
// behaviors below pin the contract every emitter (Angular included) consumes:
//   - composed-component ref present in the Map (name -> child local name)
//   - DOM ref ABSENT (inertness guarantee — the byte-identity carve-out)
//   - self-recursion ref (elementTag === ir.name) present -> ir.name
//   - nullish ir.components / ir.refs → empty Map, no throw (D-08 guard)
//
// Partial IRs are hand-built and cast to IRComponent — the resolver only reads
// `components`, `refs`, `name` and guards the rest with `?? []` (mirrors the
// Angular unit-test convention for componentRefs.ts).
import { describe, it, expect } from 'vitest';
import { resolveComponentRefs } from '../resolveComponentRefs.js';
import type { IRComponent } from '../../ir/types.js';

/** Build a minimal partial IR for the resolver (only reads name/components/refs). */
function partialIR(over: Partial<IRComponent>): IRComponent {
  return { name: 'Parent', components: [], refs: [], ...over } as IRComponent;
}

describe('resolveComponentRefs', () => {
  it('maps a composed-component ref to the child local component name', () => {
    const ir = partialIR({
      components: [{ type: 'ComponentDecl', localName: 'Combobox', importPath: './Combobox.rozie' }] as IRComponent['components'],
      refs: [{ type: 'RefDecl', name: 'combobox', elementTag: 'Combobox' }] as IRComponent['refs'],
    });
    const out = resolveComponentRefs(ir);
    expect(out.get('combobox')).toBe('Combobox');
  });

  it('does NOT contain a plain DOM ref (inertness guarantee)', () => {
    const ir = partialIR({
      components: [{ type: 'ComponentDecl', localName: 'Combobox', importPath: './Combobox.rozie' }] as IRComponent['components'],
      refs: [{ type: 'RefDecl', name: 'panel', elementTag: 'div' }] as IRComponent['refs'],
    });
    const out = resolveComponentRefs(ir);
    expect(out.has('panel')).toBe(false);
    expect(out.size).toBe(0);
  });

  it('resolves a self-recursion ref (elementTag === ir.name) to ir.name', () => {
    const ir = partialIR({
      name: 'TreeNode',
      components: [],
      refs: [{ type: 'RefDecl', name: 'self', elementTag: 'TreeNode' }] as IRComponent['refs'],
    });
    const out = resolveComponentRefs(ir);
    expect(out.get('self')).toBe('TreeNode');
  });

  it('returns an empty Map without throwing when components/refs are nullish', () => {
    const ir = { name: 'Parent' } as IRComponent;
    expect(() => resolveComponentRefs(ir)).not.toThrow();
    expect(resolveComponentRefs(ir).size).toBe(0);
  });
});
