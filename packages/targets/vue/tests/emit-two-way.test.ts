// Phase 07.3 Plan 03 (TWO-WAY-03) — Vue consumer-side two-way binding emit.
//
// Asserts the new `kind: 'twoWayBinding'` AttributeBinding (introduced in
// Wave 2, Plan 07.3-02) lowers to Vue 3.4+ idiom:
//   <Modal r-model:open="$data.open1">
// emits the attribute string `v-model:open="open1"` (after rewriteTemplateExpression
// maps $data.open1 → open1 per existing Vue auto-unwrap conventions).
//
// Also verifies bare `r-model` form-input case is untouched (no regression to
// TWO-WAY-02 producer-side machinery).
//
// Reference: 07.3-RESEARCH.md §"Per-Target Consumer Two-Way Idiom — Vue"
//   <Modal :open="open">  →  <Modal v-model:open="open1">
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import type {
  IRComponent,
  AttributeBinding,
} from '../../../core/src/ir/types.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitMergedAttributes } from '../src/emit/emitTemplateAttribute.js';

const LOC = { start: 0, end: 0 };

function emptyIR(): IRComponent {
  return {
    type: 'IRComponent',
    name: 'Test',
    props: [],
    state: [],
    computed: [],
    refs: [],
    slots: [],
    emits: [],
    lifecycle: [],
    watchers: [],
    listeners: [],
    setupBody: { type: 'SetupBody', scriptProgram: t.file(t.program([])), annotations: [] },
    template: null,
    styles: {
      type: 'StyleSection',
      scopedRules: [],
      rootRules: [],
      sourceLoc: { start: 0, end: 0 },
    },
    sourceLoc: { start: 0, end: 0 },
  };
}

describe('Vue emitTemplateAttribute — r-model:propName= consumer-side two-way binding (TWO-WAY-03)', () => {
  const registry = createDefaultRegistry();

  it('emits `v-model:open="open1"` for AttributeBinding kind=twoWayBinding name=open expression=$data.open1', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'open1',
      initializer: t.booleanLiteral(false),
      sourceLoc: LOC,
    });
    const attrs: AttributeBinding[] = [
      {
        kind: 'twoWayBinding',
        name: 'open',
        expression: parseExpression('$data.open1'),
        deps: [],
        sourceLoc: LOC,
      },
    ];
    const result = emitMergedAttributes(attrs, { ir, registry });
    expect(result).toBe('v-model:open="open1"');
  });

  it('preserves camelCase propName (no kebab-casing) — emits `v-model:closeOnEscape="flag"` for `r-model:closeOnEscape="$data.flag"`', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'flag',
      initializer: t.booleanLiteral(false),
      sourceLoc: LOC,
    });
    const attrs: AttributeBinding[] = [
      {
        kind: 'twoWayBinding',
        name: 'closeOnEscape',
        expression: parseExpression('$data.flag'),
        deps: [],
        sourceLoc: LOC,
      },
    ];
    const result = emitMergedAttributes(attrs, { ir, registry });
    expect(result).toBe('v-model:closeOnEscape="flag"');
  });

  it('handles forwarding pattern (D-03 permissive LHS) — `r-model:open="$props.open"` on a wrapper with model:true prop emits `v-model:open="open"`', () => {
    const ir = emptyIR();
    ir.props.push({
      type: 'PropDecl',
      name: 'open',
      typeAnnotation: { kind: 'identifier', name: 'Boolean' },
      defaultValue: t.booleanLiteral(false),
      isModel: true,
      sourceLoc: LOC,
    });
    const attrs: AttributeBinding[] = [
      {
        kind: 'twoWayBinding',
        name: 'open',
        expression: parseExpression('$props.open'),
        deps: [],
        sourceLoc: LOC,
      },
    ];
    const result = emitMergedAttributes(attrs, { ir, registry });
    // $props.open with model:true is auto-unwrapped to `open` (same as $data per Vue auto-unwrap).
    expect(result).toBe('v-model:open="open"');
  });

  it('does NOT regress bare `r-model` form-input case (TWO-WAY-02) — `<input r-model="$data.draft">` still emits `v-model="draft"`', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'draft',
      initializer: t.stringLiteral(''),
      sourceLoc: LOC,
    });
    const attrs: AttributeBinding[] = [
      {
        kind: 'binding',
        name: 'r-model',
        expression: parseExpression('$data.draft'),
        deps: [],
        sourceLoc: LOC,
      },
    ];
    const result = emitMergedAttributes(attrs, { ir, registry });
    expect(result).toBe('v-model="draft"');
  });
});
