// Phase 24 (req 1) — Vue r-html → v-html attribute directive emit.
//
// Mirrors the existing React/Svelte/Angular/Solid r-html intercepts. Vue's
// `v-html` is an attribute directive (NOT element-content). The `r-html`
// binding must be stripped from the attribute set BEFORE the open tag is
// built so no literal `r-html=`/`:r-html=` leaks (Pitfall 2). An r-html
// element with children raises ROZ421 (severity error).
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import type {
  IRComponent,
  TemplateNode,
} from '../../../../core/src/ir/types.js';
import { emitTemplate } from '../emit/emitTemplate.js';

const LOC = { start: 0, end: 0 };

function emptyIR(): IRComponent {
  return {
    type: 'IRComponent',
    name: 'Test',
    props: [
      {
        type: 'PropDecl',
        name: 'content',
        typeAnnotation: { kind: 'identifier', name: 'String' },
        defaultValue: null,
        isModel: false,
        required: false,
        sourceLoc: LOC,
      },
    ],
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
      portalRules: [],
      engineRules: [],
      sourceLoc: LOC,
    },
    sourceLoc: LOC,
  };
}

function rHtmlElement(children: TemplateNode[] = []): TemplateNode {
  return {
    type: 'TemplateElement',
    tagName: 'div',
    attributes: [
      {
        kind: 'binding',
        name: 'r-html',
        expression: parseExpression('$props.content'),
        deps: [],
        sourceLoc: LOC,
      },
    ],
    events: [],
    children,
    sourceLoc: LOC,
  };
}

describe('Vue r-html → v-html (Phase 24 req 1)', () => {
  const registry = createDefaultRegistry();

  it('Test 1: r-html emits a v-html attribute directive bound to the rewritten expression', () => {
    const ir = emptyIR();
    ir.template = rHtmlElement();
    const { template } = emitTemplate(ir, registry);
    expect(template).toContain('v-html="props.content"');
  });

  it('Test 2: no literal r-html= (nor :r-html=) survives in the output (Pitfall 2)', () => {
    const ir = emptyIR();
    ir.template = rHtmlElement();
    const { template } = emitTemplate(ir, registry);
    expect(template).not.toContain('r-html=');
    expect(template).not.toContain(':r-html=');
  });

  it('Test 3: r-html with children raises ROZ421, severity error', () => {
    const ir = emptyIR();
    ir.template = rHtmlElement([
      { type: 'TemplateStaticText', text: 'child', sourceLoc: LOC },
    ]);
    const { diagnostics } = emitTemplate(ir, registry);
    const diag = diagnostics.find(
      (d) => d.code === RozieErrorCode.TARGET_VUE_RHTML_WITH_CHILDREN,
    );
    expect(diag).toBeDefined();
    expect(diag!.severity).toBe('error');
  });

  it('Test 5 (WR-01): r-html on a component tag whose only children are slot-fillers does NOT raise ROZ421', () => {
    // The Phase 07.2 parallel-array invariant keeps `node.children` populated
    // even when those children are consumed as slot-fillers (which emit via the
    // slotFillers branch, never as raw HTML content). The children-coexistence
    // guard must therefore exclude the slotFiller-only case — otherwise a valid
    // component-tag source false-fires ROZ421.
    const ir = emptyIR();
    const slotChild: TemplateNode = {
      type: 'TemplateStaticText',
      text: 'hi',
      sourceLoc: LOC,
    };
    const componentEl: TemplateNode = {
      type: 'TemplateElement',
      tagName: 'Child',
      attributes: [
        {
          kind: 'binding',
          name: 'r-html',
          expression: parseExpression('$props.content'),
          deps: [],
          sourceLoc: LOC,
        },
      ],
      events: [],
      // Parallel array: children mirror the slot-filler body (lowerSlotFillers).
      children: [slotChild],
      slotFillers: [
        {
          type: 'SlotFillerDecl',
          name: 'header',
          params: [],
          body: [slotChild],
          sourceLoc: LOC,
        },
      ],
      tagKind: 'component',
      sourceLoc: LOC,
    } as TemplateNode;
    ir.template = componentEl;
    const { template, diagnostics } = emitTemplate(ir, registry);
    expect(
      diagnostics.some(
        (d) => d.code === RozieErrorCode.TARGET_VUE_RHTML_WITH_CHILDREN,
      ),
      'ROZ421 false-fired on a slotFiller-only component tag',
    ).toBe(false);
    // The element still emits via the slotFillers path with v-html attached.
    expect(template).toContain('v-html="props.content"');
  });

  it('Test 4: an element with no r-html attribute emits unchanged (no v-html, no diagnostic)', () => {
    const ir = emptyIR();
    ir.template = {
      type: 'TemplateElement',
      tagName: 'div',
      attributes: [],
      events: [],
      children: [{ type: 'TemplateStaticText', text: 'plain', sourceLoc: LOC }],
      sourceLoc: LOC,
    };
    const { template, diagnostics } = emitTemplate(ir, registry);
    expect(template).toContain('<div>plain</div>');
    expect(template).not.toContain('v-html');
    expect(
      diagnostics.some(
        (d) => d.code === RozieErrorCode.TARGET_VUE_RHTML_WITH_CHILDREN,
      ),
    ).toBe(false);
  });
});
