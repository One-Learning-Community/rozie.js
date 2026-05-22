// Phase 12 Plan 02 Task 1 — parser modifier-chain split on `r-model`.
//
// The `r-` branch of `finalizeCurrentAttr` must dot-split a `.modifier`
// chain off `r-model` ONLY. Non-`model` directives (`r-if`/`r-for`/
// `r-show`/`r-html`/`r-text`) keep taking the whole remainder as the
// directive name — byte-identical to pre-phase. A `.` on a non-`model`
// directive (`r-show.foo`) stays observable in `name` so the lowerer
// (Task 2) can emit ROZ962 from it.
import { describe, it, expect } from 'vitest';
import { parseTemplate } from '../../src/parsers/parseTemplate.js';
import type {
  TemplateElement,
  TemplateNode,
  TemplateAttr,
} from '../../src/ast/blocks/TemplateAST.js';

// Wrap a single element body in a synthetic <template> content string.
// contentLoc.start = 0 keeps byte offsets simple (the body IS the input).
function parseBody(body: string): {
  source: string;
  node: { children: TemplateNode[] } | null;
  diagnostics: ReturnType<typeof parseTemplate>['diagnostics'];
} {
  const { node, diagnostics } = parseTemplate(
    body,
    { start: 0, end: body.length },
    body,
    'synthetic.rozie',
  );
  return { source: body, node, diagnostics };
}

function firstElement(node: { children: TemplateNode[] }): TemplateElement {
  const el = node.children.find(
    (c): c is TemplateElement => c.type === 'TemplateElement',
  );
  if (!el) throw new Error('no element parsed');
  return el;
}

function attrByRaw(el: TemplateElement, rawName: string): TemplateAttr {
  const a = el.attributes.find((x) => x.rawName === rawName);
  if (!a) throw new Error(`attr ${rawName} not found`);
  return a;
}

describe('parseTemplate — r-model modifier-chain split (Phase 12)', () => {
  it('r-model.lazy.number.trim → name "model" + modifierChainText ".lazy.number.trim"', () => {
    const { node } = parseBody('<input r-model.lazy.number.trim="$data.x"/>');
    const el = firstElement(node!);
    const a = attrByRaw(el, 'r-model.lazy.number.trim');
    expect(a.kind).toBe('directive');
    expect(a.name).toBe('model');
    expect(a.modifierChainText).toBe('.lazy.number.trim');
  });

  it('r-model:open.lazy → name "model:open" + modifierChainText ".lazy"', () => {
    const { node } = parseBody('<Modal r-model:open.lazy="$data.x"></Modal>');
    const el = firstElement(node!);
    const a = attrByRaw(el, 'r-model:open.lazy');
    expect(a.kind).toBe('directive');
    expect(a.name).toBe('model:open');
    expect(a.modifierChainText).toBe('.lazy');
  });

  it('bare r-model → name "model" + empty modifierChainText (byte-identical to pre-phase)', () => {
    const { node } = parseBody('<input r-model="$data.x"/>');
    const el = firstElement(node!);
    const a = attrByRaw(el, 'r-model');
    expect(a.kind).toBe('directive');
    expect(a.name).toBe('model');
    expect(a.modifierChainText).toBe('');
  });

  it('r-model:open (no chain) → name "model:open" + empty modifierChainText', () => {
    const { node } = parseBody('<Modal r-model:open="$data.x"></Modal>');
    const el = firstElement(node!);
    const a = attrByRaw(el, 'r-model:open');
    expect(a.kind).toBe('directive');
    expect(a.name).toBe('model:open');
    expect(a.modifierChainText).toBe('');
  });

  it('non-model directives without a dot parse byte-identically (whole remainder is name)', () => {
    const cases: Array<[string, string]> = [
      ['<button r-if="x">x</button>', 'if'],
      ['<li r-for="x in xs">x</li>', 'for'],
      ['<div r-show="x"></div>', 'show'],
      ['<div r-html="x"></div>', 'html'],
      ['<span r-text="x"></span>', 'text'],
    ];
    for (const [body, expectedName] of cases) {
      const { node } = parseBody(body);
      const el = firstElement(node!);
      const a = el.attributes.find((x) => x.rawName.startsWith('r-'))!;
      expect(a.kind, body).toBe('directive');
      expect(a.name, body).toBe(expectedName);
      expect(a.modifierChainText, body).toBe('');
    }
  });

  it('r-show.foo → dot is observable in name (not split off)', () => {
    const { node } = parseBody('<div r-show.foo="x"></div>');
    const el = firstElement(node!);
    const a = attrByRaw(el, 'r-show.foo');
    expect(a.kind).toBe('directive');
    // The dot stays in `name` for the lowerer (Task 2) to emit ROZ962.
    expect(a.name).toBe('show.foo');
    expect(a.modifierChainText).toBe('');
  });

  it('r-html.x / r-text.x / r-if.x / r-for.x keep the dot in name', () => {
    const cases: Array<[string, string]> = [
      ['<div r-html.x="y"></div>', 'html.x'],
      ['<span r-text.x="y"></span>', 'text.x'],
      ['<div r-if.x="y"></div>', 'if.x'],
      ['<li r-for.x="y in z"></li>', 'for.x'],
    ];
    for (const [body, expectedName] of cases) {
      const { node } = parseBody(body);
      const el = firstElement(node!);
      const a = el.attributes.find((x) => x.rawName.startsWith('r-'))!;
      expect(a.name, body).toBe(expectedName);
      expect(a.modifierChainText, body).toBe('');
    }
  });

  it('modifierChainBaseOffset for r-model.x points at the leading "."', () => {
    const body = '<input r-model.number="$data.x"/>';
    const { node } = parseBody(body);
    const el = firstElement(node!);
    const a = attrByRaw(el, 'r-model.number');
    // The leading '.' of the chain sits in the source — slicing from the
    // offset must start with '.number'.
    expect(body.slice(a.modifierChainBaseOffset)).toMatch(/^\.number/);
  });
});
