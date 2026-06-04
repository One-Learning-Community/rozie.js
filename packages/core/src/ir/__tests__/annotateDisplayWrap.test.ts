/**
 * annotateDisplayWrap — Phase 26 Plan 03 Task 1 gate-predicate unit tests.
 *
 * Exercises the full RAW/WRAP case matrix (D-06/D-07) including the three
 * locked open-question resolutions:
 *   - OQ1: identifier-ref-to-$computed → WRAP (no computed-return resolution).
 *   - OQ2: <data> primitiveness inferred from a trivially-literal initializer.
 *   - Pitfall 5: LogicalExpression (&&/||/??) → WRAP (operands may be objects).
 *
 * The invariant under test: a false-WRAP is behavior-neutral, but a false-RAW
 * re-introduces the React "Objects are not valid as a React child" crash — so
 * the predicate must default to WRAP on ANY uncertainty.
 */
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import type { Expression } from '@babel/types';
import * as t from '@babel/types';
import { annotateDisplayWrap } from '../annotateDisplayWrap.js';
import type {
  IRComponent,
  PropDecl,
  PropTypeAnnotation,
  StateDecl,
  TemplateInterpolationIR,
  TemplateNode,
} from '../types.js';

const LOC = { start: 0, end: 0 };

function expr(src: string): Expression {
  return parseExpression(src) as Expression;
}

function prop(name: string, annotation: PropTypeAnnotation): PropDecl {
  return {
    type: 'PropDecl',
    name,
    typeAnnotation: annotation,
    defaultValue: null,
    isModel: false,
    required: false,
    sourceLoc: LOC,
  };
}

function state(name: string, initializer: Expression): StateDecl {
  return { type: 'StateDecl', name, initializer, sourceLoc: LOC };
}

function interp(src: string): TemplateInterpolationIR {
  return {
    type: 'TemplateInterpolation',
    expression: expr(src),
    deps: [],
    sourceLoc: LOC,
    wrapForDisplay: true,
  };
}

/**
 * Build a minimal IRComponent carrying only the fields the gate reads
 * (`props`, `state`, `computed`, `template`). The template is a single root
 * `<div>` whose children are the supplied interpolation nodes.
 */
function makeIR(opts: {
  interpolations: TemplateInterpolationIR[];
  props?: PropDecl[];
  state?: StateDecl[];
  computed?: Array<{ name: string }>;
}): IRComponent {
  const root: TemplateNode = {
    type: 'TemplateElement',
    tagName: 'div',
    tagKind: 'html',
    events: [],
    listenerSpreads: [],
    attributes: [],
    children: opts.interpolations,
    sourceLoc: LOC,
  } as unknown as TemplateNode;

  return {
    type: 'IRComponent',
    name: 'Test',
    props: opts.props ?? [],
    state: opts.state ?? [],
    computed: (opts.computed ?? []).map((c) => ({
      type: 'ComputedDecl',
      name: c.name,
      body: t.numericLiteral(0),
      deps: [],
      sourceLoc: LOC,
    })),
    refs: [],
    slots: [],
    emits: [],
    expose: [],
    lifecycle: [],
    watchers: [],
    listeners: [],
    setupBody: { type: 'SetupBody', scriptProgram: t.file(t.program([])), annotations: [] },
    template: root,
    inheritAttrs: true,
    inheritListeners: true,
    styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], sourceLoc: LOC },
    components: [],
    sourceLoc: LOC,
  } as unknown as IRComponent;
}

/** Compute wrapForDisplay for a single interpolation expression. */
function gateOf(src: string, ir?: Partial<Parameters<typeof makeIR>[0]>): boolean {
  const node = interp(src);
  const component = makeIR({ interpolations: [node], ...ir });
  annotateDisplayWrap(component, true);
  return node.wrapForDisplay;
}

describe('annotateDisplayWrap — RAW cases (provably primitive → wrapForDisplay=false)', () => {
  it('string literal', () => {
    expect(gateOf("'hi'")).toBe(false);
  });

  it('number literal', () => {
    expect(gateOf('42')).toBe(false);
  });

  it('boolean literal', () => {
    expect(gateOf('true')).toBe(false);
  });

  it('$props.x declared String', () => {
    expect(
      gateOf('$props.title', { props: [prop('title', { kind: 'identifier', name: 'String' })] }),
    ).toBe(false);
  });

  it('$props.x declared Number', () => {
    expect(
      gateOf('$props.count', { props: [prop('count', { kind: 'identifier', name: 'Number' })] }),
    ).toBe(false);
  });

  it('$props.x declared Boolean', () => {
    expect(
      gateOf('$props.open', { props: [prop('open', { kind: 'identifier', name: 'Boolean' })] }),
    ).toBe(false);
  });

  it('.length member access', () => {
    expect(gateOf('$props.items.length')).toBe(false);
  });

  it('typeof unary', () => {
    expect(gateOf('typeof x')).toBe(false);
  });

  it('comparison BinaryExpression (===)', () => {
    expect(gateOf('a === b')).toBe(false);
  });

  it('comparison BinaryExpression (<)', () => {
    expect(gateOf('a < b')).toBe(false);
  });

  it('logical-not UnaryExpression (!x)', () => {
    expect(gateOf('!x')).toBe(false);
  });

  it('String(x) coercion call', () => {
    expect(gateOf('String(x)')).toBe(false);
  });

  it('Number(x) coercion call', () => {
    expect(gateOf('Number(x)')).toBe(false);
  });

  it('$data.x with a literal-number initializer (OQ2)', () => {
    expect(gateOf('$data.count', { state: [state('count', t.numericLiteral(0))] })).toBe(false);
  });

  it('$data.x with a literal-string initializer (OQ2)', () => {
    expect(gateOf('$data.label', { state: [state('label', t.stringLiteral(''))] })).toBe(false);
  });

  it('$data.x with a literal-boolean initializer (OQ2)', () => {
    expect(gateOf('$data.flag', { state: [state('flag', t.booleanLiteral(false))] })).toBe(false);
  });
});

describe('annotateDisplayWrap — WRAP cases (uncertain/non-primitive → wrapForDisplay=true)', () => {
  it('$props.x declared Array', () => {
    expect(
      gateOf('$props.items', { props: [prop('items', { kind: 'identifier', name: 'Array' })] }),
    ).toBe(true);
  });

  it('$props.x declared Object', () => {
    expect(
      gateOf('$props.config', { props: [prop('config', { kind: 'identifier', name: 'Object' })] }),
    ).toBe(true);
  });

  it('$props.x untyped (not declared)', () => {
    expect(gateOf('$props.mystery')).toBe(true);
  });

  it('untyped member chain (r-for alias item.text)', () => {
    expect(gateOf('item.text')).toBe(true);
  });

  it('non-String/Number CallExpression', () => {
    expect(gateOf('getCellValue(row)')).toBe(true);
  });

  it('identifier-ref-to-$computed (OQ1 → WRAP)', () => {
    expect(gateOf('remaining', { computed: [{ name: 'remaining' }] })).toBe(true);
  });

  it('&& LogicalExpression (Pitfall 5)', () => {
    expect(gateOf('a && obj')).toBe(true);
  });

  it('|| LogicalExpression (Pitfall 5)', () => {
    expect(gateOf('a || obj')).toBe(true);
  });

  it('?? LogicalExpression (Pitfall 5)', () => {
    expect(gateOf('a ?? obj')).toBe(true);
  });

  it('$data.x with an object initializer (OQ2)', () => {
    expect(
      gateOf('$data.config', { state: [state('config', expr('{ a: 1, b: [2, 3] }'))] }),
    ).toBe(true);
  });

  it('object literal interpolation', () => {
    expect(gateOf('({ a: 1 })')).toBe(true);
  });

  it('array literal interpolation', () => {
    expect(gateOf('[1, 2, 3]')).toBe(true);
  });
});

describe('annotateDisplayWrap — safeInterpolation off forces all-false', () => {
  it('forces every wrapForDisplay to false on an otherwise-WRAP expression', () => {
    const node = interp('$props.items');
    const ir = makeIR({
      interpolations: [node],
      props: [prop('items', { kind: 'identifier', name: 'Array' })],
    });
    annotateDisplayWrap(ir, false);
    expect(node.wrapForDisplay).toBe(false);
  });

  it('forces attribute-binding + class-interpolation wrap to false', () => {
    const bindingExpr = expr('$props.items');
    const classExpr = expr('$props.config');
    const root: TemplateNode = {
      type: 'TemplateElement',
      tagName: 'div',
      tagKind: 'html',
      events: [],
      listenerSpreads: [],
      attributes: [
        {
          kind: 'binding',
          name: 'data-x',
          expression: bindingExpr,
          deps: [],
          sourceLoc: LOC,
          wrapForDisplay: true,
        },
        {
          kind: 'interpolated',
          name: 'class',
          segments: [
            { kind: 'static', text: 'card--' },
            { kind: 'binding', expression: classExpr, deps: [], wrapForDisplay: true },
          ],
          sourceLoc: LOC,
        },
      ],
      children: [],
      sourceLoc: LOC,
    } as unknown as TemplateNode;
    const ir = {
      ...makeIR({ interpolations: [] }),
      props: [prop('items', { kind: 'identifier', name: 'Array' })],
      template: root,
    } as unknown as IRComponent;
    annotateDisplayWrap(ir, false);
    // Re-read the mutated nodes off the template.
    const el = (ir.template as { attributes: Array<Record<string, unknown>> });
    const binding = el.attributes[0] as { wrapForDisplay: boolean };
    const classAttr = el.attributes[1] as {
      segments: Array<{ kind: string; wrapForDisplay?: boolean }>;
    };
    expect(binding.wrapForDisplay).toBe(false);
    const seg = classAttr.segments.find((s) => s.kind === 'binding') as { wrapForDisplay: boolean };
    expect(seg.wrapForDisplay).toBe(false);
  });
});

describe('annotateDisplayWrap — attribute-binding + class-interpolation gate (safeInterpolation on)', () => {
  it('WRAPs an untyped :data-x binding and an untyped class segment', () => {
    const bindingExpr = expr('$props.config');
    const classExpr = expr('item.text');
    const root: TemplateNode = {
      type: 'TemplateElement',
      tagName: 'div',
      tagKind: 'html',
      events: [],
      listenerSpreads: [],
      attributes: [
        {
          kind: 'binding',
          name: 'data-x',
          expression: bindingExpr,
          deps: [],
          sourceLoc: LOC,
          wrapForDisplay: true,
        },
        {
          kind: 'interpolated',
          name: 'class',
          segments: [
            { kind: 'static', text: 'row--' },
            { kind: 'binding', expression: classExpr, deps: [], wrapForDisplay: true },
          ],
          sourceLoc: LOC,
        },
      ],
      children: [],
      sourceLoc: LOC,
    } as unknown as TemplateNode;
    const ir = { ...makeIR({ interpolations: [] }), template: root } as unknown as IRComponent;
    annotateDisplayWrap(ir, true);
    const el = ir.template as { attributes: Array<Record<string, unknown>> };
    const binding = el.attributes[0] as { wrapForDisplay: boolean };
    const classAttr = el.attributes[1] as {
      segments: Array<{ kind: string; wrapForDisplay?: boolean }>;
    };
    expect(binding.wrapForDisplay).toBe(true);
    const seg = classAttr.segments.find((s) => s.kind === 'binding') as { wrapForDisplay: boolean };
    expect(seg.wrapForDisplay).toBe(true);
  });

  it('keeps a String-typed :data-x binding RAW', () => {
    const bindingExpr = expr('$props.title');
    const root: TemplateNode = {
      type: 'TemplateElement',
      tagName: 'div',
      tagKind: 'html',
      events: [],
      listenerSpreads: [],
      attributes: [
        {
          kind: 'binding',
          name: 'data-x',
          expression: bindingExpr,
          deps: [],
          sourceLoc: LOC,
          wrapForDisplay: true,
        },
      ],
      children: [],
      sourceLoc: LOC,
    } as unknown as TemplateNode;
    const ir = {
      ...makeIR({ interpolations: [] }),
      props: [prop('title', { kind: 'identifier', name: 'String' })],
      template: root,
    } as unknown as IRComponent;
    annotateDisplayWrap(ir, true);
    const el = ir.template as { attributes: Array<{ wrapForDisplay: boolean }> };
    expect(el.attributes[0]?.wrapForDisplay).toBe(false);
  });
});

describe('annotateDisplayWrap — never throws', () => {
  it('handles a null template gracefully', () => {
    const ir = { ...makeIR({ interpolations: [] }), template: null } as unknown as IRComponent;
    expect(() => annotateDisplayWrap(ir, true)).not.toThrow();
  });
});
