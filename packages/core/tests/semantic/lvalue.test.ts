// Phase 07.3 Plan 01 Task 2 — `isWritableLValue` helper test scaffold
// (Wave 1 — RED).
//
// Per 07.3-SPEC.md TWO-WAY-04 / 07.3-PATTERNS.md §`packages/core/src/semantic/lvalue.ts`:
// the shared helper `isWritableLValue(expr, ir)` implements the D-03 permissive
// LHS rule for `r-model:propName="expr"`. The helper is consumed by the new
// `validateTwoWayBindings` IR validator (ROZ951). It is NOT consumed by the
// existing `propWriteValidator` (which keeps using `detectMagicAccess` to
// preserve ROZ200 semantics).
//
// Positive cases:
//   - $data.x          → true (x declared in <data>)
//   - $data.x.y        → true (deep member chain rooted in $data; x declared)
//   - $props.x         → true ONLY when x has model:true in consumer's own props
//
// Negative cases:
//   - $computed(() => ...) ref → false
//   - Literal (true/42/"") → false
//   - $props.x (no model:true)  → false (one-way prop; not writable from consumer)
//   - Unknown $data.foo (not declared) → false
//   - $refs.x → false (refs are read-only)
//
// WAVE 1 RED STATE: the file at packages/core/src/semantic/lvalue.ts does NOT
// yet exist. Importing it produces a module-resolution error at test-collection
// time — vitest reports the file as failing without running individual it()s.
// That is acceptable for the RED scaffold: Wave 2 ships the helper and the
// test goes green.
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
// @ts-expect-error — Wave 2 creates packages/core/src/semantic/lvalue.ts.
import { isWritableLValue } from '../../src/semantic/lvalue.js';
import type { IRComponent, StateDecl, PropDecl } from '../../src/ir/types.js';

function buildIR(opts: {
  state?: Array<{ name: string }>;
  props?: Array<{ name: string; isModel?: boolean }>;
}): IRComponent {
  return {
    name: 'TestComp',
    props: (opts.props ?? []).map<PropDecl>((p) => ({
      name: p.name,
      type: { kind: 'inferred' },
      isModel: p.isModel ?? false,
      sourceLoc: { start: 0, end: 0 },
    })),
    state: (opts.state ?? []).map<StateDecl>((s) => ({
      name: s.name,
      initializerType: 'literal',
      sourceLoc: { start: 0, end: 0 },
    })),
    computeds: [],
    refs: [],
    slots: [],
    components: [],
    lifecycleHooks: [],
    watches: [],
    listeners: [],
    setupBody: { statements: [], annotations: [] },
    template: null,
    style: null,
    rawSource: '',
    diagnostics: [],
  } as unknown as IRComponent;
}

function parse(src: string) {
  // parseExpression returns an Expression node.
  return parseExpression(src);
}

describe('isWritableLValue — Phase 07.3 (D-03 permissive LHS rule)', () => {
  it('accepts $data.x when x is declared in <data>', () => {
    const ir = buildIR({ state: [{ name: 'x' }] });
    expect(isWritableLValue(parse('$data.x'), ir)).toBe(true);
  });

  it('accepts $data.x.y (deep member chain rooted in $data)', () => {
    const ir = buildIR({ state: [{ name: 'x' }] });
    expect(isWritableLValue(parse('$data.x.y'), ir)).toBe(true);
  });

  it('accepts $props.x when consumer prop x has model: true (forwarding pattern)', () => {
    const ir = buildIR({ props: [{ name: 'x', isModel: true }] });
    expect(isWritableLValue(parse('$props.x'), ir)).toBe(true);
  });

  it('rejects $props.x when consumer prop x lacks model: true (one-way)', () => {
    const ir = buildIR({ props: [{ name: 'x', isModel: false }] });
    expect(isWritableLValue(parse('$props.x'), ir)).toBe(false);
  });

  it('rejects unknown $data.foo (foo not declared in <data>)', () => {
    const ir = buildIR({ state: [{ name: 'x' }] });
    expect(isWritableLValue(parse('$data.foo'), ir)).toBe(false);
  });

  it('rejects literals (boolean, number, string)', () => {
    const ir = buildIR({});
    expect(isWritableLValue(parse('true'), ir)).toBe(false);
    expect(isWritableLValue(parse('42'), ir)).toBe(false);
    expect(isWritableLValue(parse('"hello"'), ir)).toBe(false);
  });

  it('rejects ternary expressions', () => {
    const ir = buildIR({ state: [{ name: 'x' }, { name: 'y' }] });
    expect(isWritableLValue(parse('$data.x ? $data.y : false'), ir)).toBe(false);
  });

  it('rejects function calls', () => {
    const ir = buildIR({ state: [{ name: 'x' }] });
    expect(isWritableLValue(parse('getOpen()'), ir)).toBe(false);
  });

  it('rejects $refs.x (refs are read-only DOM-element wrappers)', () => {
    const ir = buildIR({});
    expect(isWritableLValue(parse('$refs.foo'), ir)).toBe(false);
  });
});
