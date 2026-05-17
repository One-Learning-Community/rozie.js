/**
 * emit-two-way.test.ts — Lit consumer-side r-model:propName= emit branch
 * (Phase 07.3 Plan 07.3-08, requirement TWO-WAY-03).
 *
 * Per CONTEXT.md D-01 + PATTERNS.md lines 599-624, a Lit consumer
 * `<Modal r-model:open="$data.open1">` lowers to an AttributeBinding with
 * `kind: 'twoWayBinding'` and must emit the html`` template-fragment pair:
 *
 *   .open=${this._open1.value} @open-change=${(e: CustomEvent) => { this._open1.value = e.detail; }}
 *
 * Tests pin:
 *   1. $data.X case — preact-signals signal-backed state → `this._X.value`
 *   2. CamelCase propName → kebab-cased event name landmine (A2)
 *   3. Forwarding $props.X (model:true) → @property setter `this.X`
 *   4. (e: CustomEvent) type annotation MUST be present (Lit @event landmine)
 *   5. kebabize unit test cases (open/closeOnEscape/aBC)
 */
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import type {
  AttributeBinding,
  IRComponent,
} from '../../../../core/src/ir/types.js';
import { emitTemplateAttribute } from '../emit/emitTemplateAttribute.js';
import {
  resolveLitSetterText,
  kebabize,
} from '../emit/resolveLitSetterText.js';

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
    setupBody: {
      type: 'SetupBody',
      scriptProgram: t.file(t.program([])),
      annotations: [],
    },
    template: null,
    styles: {
      type: 'StyleSection',
      scopedRules: [],
      rootRules: [],
      sourceLoc: LOC,
    },
    sourceLoc: LOC,
  };
}

describe('Lit emit — twoWayBinding (Phase 07.3 Plan 08 — TWO-WAY-03)', () => {
  it('$data.X case: emits `.open=${this._open1.value} @open-change=${(e: CustomEvent) => { this._open1.value = e.detail; }}`', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'open1',
      initializer: t.booleanLiteral(false),
      sourceLoc: LOC,
    });
    const attr: AttributeBinding = {
      kind: 'twoWayBinding',
      name: 'open',
      expression: parseExpression('$data.open1'),
      deps: [],
      sourceLoc: LOC,
    };
    const out = emitTemplateAttribute(attr, ir);
    expect(out).toBe(
      '.open=${this._open1.value} @open-change=${(e: CustomEvent) => { this._open1.value = e.detail; }}',
    );
  });

  it('camelCase propName → kebab-cased event name (Landmine A2)', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'flag',
      initializer: t.booleanLiteral(false),
      sourceLoc: LOC,
    });
    const attr: AttributeBinding = {
      kind: 'twoWayBinding',
      name: 'closeOnEscape',
      expression: parseExpression('$data.flag'),
      deps: [],
      sourceLoc: LOC,
    };
    const out = emitTemplateAttribute(attr, ir);
    expect(out).toBe(
      '.closeOnEscape=${this._flag.value} @close-on-escape-change=${(e: CustomEvent) => { this._flag.value = e.detail; }}',
    );
    // Belt-and-suspenders: event name must contain kebabized propName + -change
    expect(out).toContain('@close-on-escape-change=');
  });

  it('forwarding $props.X (model:true) → uses @property setter `this.X`', () => {
    const ir = emptyIR();
    ir.props.push({
      type: 'PropDecl',
      name: 'open',
      typeAnnotation: { kind: 'identifier', name: 'Boolean' },
      defaultValue: t.booleanLiteral(false),
      isModel: true,
      sourceLoc: LOC,
    });
    const attr: AttributeBinding = {
      kind: 'twoWayBinding',
      name: 'open',
      expression: parseExpression('$props.open'),
      deps: [],
      sourceLoc: LOC,
    };
    const out = emitTemplateAttribute(attr, ir);
    expect(out).toBe(
      '.open=${this.open} @open-change=${(e: CustomEvent) => { this.open = e.detail; }}',
    );
  });

  it('(e: CustomEvent) type annotation is mandatory (Landmine guard)', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'open',
      initializer: t.booleanLiteral(false),
      sourceLoc: LOC,
    });
    const attr: AttributeBinding = {
      kind: 'twoWayBinding',
      name: 'open',
      expression: parseExpression('$data.open'),
      deps: [],
      sourceLoc: LOC,
    };
    const out = emitTemplateAttribute(attr, ir);
    // The annotation must be present — never `(e: Event)` or untyped `(e)`.
    expect(out).toContain('(e: CustomEvent)');
    expect(out).not.toMatch(/\(e:\s*Event\)/);
    expect(out).not.toMatch(/\(e\)\s*=>/);
  });
});

describe('Lit emit — kebabize utility', () => {
  it('single-word identity: open → open', () => {
    expect(kebabize('open')).toBe('open');
  });

  it('camelCase: closeOnEscape → close-on-escape', () => {
    expect(kebabize('closeOnEscape')).toBe('close-on-escape');
  });

  it('multi-cap acronym: aBC → a-b-c', () => {
    expect(kebabize('aBC')).toBe('a-b-c');
  });

  it('idempotent on already-kebab: foo-bar → foo-bar', () => {
    expect(kebabize('foo-bar')).toBe('foo-bar');
  });
});

describe('Lit emit — resolveLitSetterText helper', () => {
  it('$data.X (signal-backed) → `this._X.value`', () => {
    const ir = emptyIR();
    ir.state.push({
      type: 'StateDecl',
      name: 'open1',
      initializer: t.booleanLiteral(false),
      sourceLoc: LOC,
    });
    expect(resolveLitSetterText(parseExpression('$data.open1'), ir)).toBe(
      'this._open1.value',
    );
  });

  it('$props.X (model:true) → `this.X` (@property setter)', () => {
    const ir = emptyIR();
    ir.props.push({
      type: 'PropDecl',
      name: 'open',
      typeAnnotation: { kind: 'identifier', name: 'Boolean' },
      defaultValue: t.booleanLiteral(false),
      isModel: true,
      sourceLoc: LOC,
    });
    expect(resolveLitSetterText(parseExpression('$props.open'), ir)).toBe(
      'this.open',
    );
  });
});
