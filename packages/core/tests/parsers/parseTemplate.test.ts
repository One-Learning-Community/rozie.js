// PARSE-04 — <template> block parser tests.
// Implementation: packages/core/src/parsers/parseTemplate.ts (Plan 03 Task 3).
// Anchors paths per RESEARCH.md Pitfall 8.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { splitBlocks } from '../../src/splitter/splitBlocks.js';
import { parseTemplate } from '../../src/parsers/parseTemplate.js';
import type {
  TemplateElement,
  TemplateNode,
  TemplateAttr,
  TemplateInterpolation,
} from '../../src/ast/blocks/TemplateAST.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

function loadTemplate(name: string) {
  const source = readFileSync(resolve(EXAMPLES_DIR, `${name}.rozie`), 'utf8');
  const blocks = splitBlocks(source, `${name}.rozie`);
  if (!blocks.template) throw new Error(`${name}.rozie has no <template> block`);
  return { source, content: blocks.template.content, contentLoc: blocks.template.contentLoc };
}

function findElements(nodes: readonly TemplateNode[], tagName: string): TemplateElement[] {
  const out: TemplateElement[] = [];
  for (const n of nodes) {
    if (n.type === 'TemplateElement') {
      if (n.tagName === tagName) out.push(n);
      out.push(...findElements(n.children, tagName));
    }
  }
  return out;
}

function attr(elem: TemplateElement, rawName: string): TemplateAttr | undefined {
  return elem.attributes.find(a => a.rawName === rawName);
}

function rootElement(node: { children: TemplateNode[] }): TemplateElement {
  const elems = node.children.filter((c): c is TemplateElement => c.type === 'TemplateElement');
  return elems[0]!;
}

describe('parseTemplate (PARSE-04)', () => {
  it("Counter.rozie root <div> with class/:class/@mouseenter/@mouseleave attributes", () => {
    const { source, content, contentLoc } = loadTemplate('Counter');
    const { node, diagnostics } = parseTemplate(content, contentLoc, source, 'Counter.rozie');
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    const root = rootElement(node!);
    expect(root.tagName).toBe('div');
    // The root should have 4 attributes: class, :class, @mouseenter, @mouseleave
    expect(root.attributes.length).toBe(4);

    const classAttr = attr(root, 'class')!;
    expect(classAttr.kind).toBe('static');
    expect(classAttr.value).toBe('counter');

    const colonClass = attr(root, ':class')!;
    expect(colonClass.kind).toBe('binding');
    expect(colonClass.name).toBe('class');
    expect(colonClass.value).toBe('{ hovering: $data.hovering }');

    const me = attr(root, '@mouseenter')!;
    expect(me.kind).toBe('event');
    expect(me.name).toBe('mouseenter');
    expect(me.modifierChainText).toBe('');

    const ml = attr(root, '@mouseleave')!;
    expect(ml.kind).toBe('event');
    expect(ml.name).toBe('mouseleave');
  });

  it('Counter.rozie inner <span>{{ $props.value }}</span> produces a TemplateInterpolation child', () => {
    const { source, content, contentLoc } = loadTemplate('Counter');
    const { node } = parseTemplate(content, contentLoc, source, 'Counter.rozie');
    const spans = findElements(node!.children, 'span');
    // The .value span has a single TemplateInterpolation child.
    const valueSpan = spans.find(s => attr(s, 'class')?.value === 'value');
    expect(valueSpan).toBeDefined();
    const interp = valueSpan!.children.find(
      (c): c is TemplateInterpolation => c.type === 'TemplateInterpolation',
    );
    expect(interp).toBeDefined();
    expect(interp!.rawExpr).toMatch(/\$props\.value/);
  });

  it('SearchInput.rozie <input> attributes: ref, :placeholder, r-model, @input.debounce(300), @keydown.enter, @keydown.escape', () => {
    const { source, content, contentLoc } = loadTemplate('SearchInput');
    const { node, diagnostics } = parseTemplate(content, contentLoc, source, 'SearchInput.rozie');
    expect(diagnostics).toEqual([]);
    const inputs = findElements(node!.children, 'input');
    const input = inputs[0]!;

    const ref = attr(input, 'ref')!;
    expect(ref.kind).toBe('static');
    expect(ref.value).toBe('inputEl');

    const placeholder = attr(input, ':placeholder')!;
    expect(placeholder.kind).toBe('binding');
    expect(placeholder.value).toBe('$props.placeholder');

    const rmodel = attr(input, 'r-model')!;
    expect(rmodel.kind).toBe('directive');
    expect(rmodel.name).toBe('model');
    expect(rmodel.value).toBe('$data.query');

    const inputEvent = attr(input, '@input.debounce(300)')!;
    expect(inputEvent.kind).toBe('event');
    expect(inputEvent.name).toBe('input');
    expect(inputEvent.modifierChainText).toBe('.debounce(300)');
    expect(inputEvent.value).toBe('onSearch');

    const enter = attr(input, '@keydown.enter')!;
    expect(enter.kind).toBe('event');
    expect(enter.name).toBe('keydown');
    expect(enter.modifierChainText).toBe('.enter');

    const escape = attr(input, '@keydown.escape')!;
    expect(escape.kind).toBe('event');
    expect(escape.modifierChainText).toBe('.escape');
  });

  it('SearchInput.rozie <button r-if="..."> and <span r-else> directives', () => {
    const { source, content, contentLoc } = loadTemplate('SearchInput');
    const { node } = parseTemplate(content, contentLoc, source, 'SearchInput.rozie');
    const buttons = findElements(node!.children, 'button');
    const rif = buttons.find(b => attr(b, 'r-if'))!;
    expect(rif).toBeDefined();
    const rifAttr = attr(rif, 'r-if')!;
    expect(rifAttr.kind).toBe('directive');
    expect(rifAttr.name).toBe('if');
    expect(rifAttr.value).toBe('$data.query.length > 0');

    const spans = findElements(node!.children, 'span');
    const relseSpan = spans.find(s => attr(s, 'r-else'))!;
    const relse = attr(relseSpan, 'r-else')!;
    expect(relse.kind).toBe('directive');
    expect(relse.name).toBe('else');
    expect(relse.value).toBeNull();
  });

  it('TodoList.rozie <li> has both r-for and :key as separate attributes', () => {
    const { source, content, contentLoc } = loadTemplate('TodoList');
    const { node } = parseTemplate(content, contentLoc, source, 'TodoList.rozie');
    const lis = findElements(node!.children, 'li');
    const li = lis[0]!;
    const rfor = attr(li, 'r-for')!;
    expect(rfor.kind).toBe('directive');
    expect(rfor.name).toBe('for');
    expect(rfor.value).toBe('item in $props.items');

    const key = attr(li, ':key')!;
    expect(key.kind).toBe('binding');
    expect(key.name).toBe('key');
    expect(key.value).toBe('item.id');
  });

  it('Modal.rozie backdrop div has @click.self event with .self modifier', () => {
    const { source, content, contentLoc } = loadTemplate('Modal');
    const { node } = parseTemplate(content, contentLoc, source, 'Modal.rozie');
    const divs = findElements(node!.children, 'div');
    const backdrop = divs.find(d => attr(d, 'class')?.value === 'modal-backdrop')!;
    const click = attr(backdrop, '@click.self')!;
    expect(click.kind).toBe('event');
    expect(click.name).toBe('click');
    expect(click.modifierChainText).toBe('.self');
  });

  it('byte-accurate absolute loc on attributes — Counter.rozie class="counter"', () => {
    const { source, content, contentLoc } = loadTemplate('Counter');
    const { node } = parseTemplate(content, contentLoc, source, 'Counter.rozie');
    const root = rootElement(node!);
    const classAttr = attr(root, 'class')!;
    // The attribute name 'class' should land at an absolute offset that
    // slices to 'class' in the source.
    expect(source.slice(classAttr.loc.start, classAttr.loc.start + 5)).toBe('class');
    // The value loc spans the bare value text 'counter' (between the quotes).
    expect(classAttr.valueLoc).not.toBeNull();
    expect(source.slice(classAttr.valueLoc!.start, classAttr.valueLoc!.end)).toBe('counter');
  });

  it('synthetic mustache split — "before {{ x }} after"', () => {
    const synthetic = '<span>before {{ x }} after</span>';
    const { node, diagnostics } = parseTemplate(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(diagnostics).toEqual([]);
    const spans = findElements(node!.children, 'span');
    const span = spans[0]!;
    expect(span.children.length).toBe(3);
    expect(span.children[0]!.type).toBe('TemplateText');
    expect((span.children[0] as { text: string }).text).toBe('before ');
    expect(span.children[1]!.type).toBe('TemplateInterpolation');
    expect((span.children[1] as TemplateInterpolation).rawExpr).toBe(' x ');
    expect(span.children[2]!.type).toBe('TemplateText');
    expect((span.children[2] as { text: string }).text).toBe(' after');
  });

  it('emits ROZ050 on unclosed element (synthetic)', () => {
    const synthetic = '<div><span>oops';
    const { diagnostics } = parseTemplate(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(diagnostics.some(d => d.code === 'ROZ050')).toBe(true);
  });

  it('emits ROZ051 on unmatched mustache "{{ x"', () => {
    const synthetic = '<span>{{ x </span>';
    const { diagnostics } = parseTemplate(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(diagnostics.some(d => d.code === 'ROZ051')).toBe(true);
  });

  it('mustache regex does NOT exhibit catastrophic backtracking on 10kb attribute payload (T-1-03-03 mitigation)', () => {
    // Build a synthetic 10KB attribute value with no closing }} — the regex
    // `[^}]` is linear; this MUST complete in <50ms.
    const payload = '{{' + 'a'.repeat(10_000);
    const synthetic = `<div>${payload}</div>`;
    const t0 = Date.now();
    parseTemplate(synthetic, { start: 0, end: synthetic.length }, synthetic);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(200); // generous CI cushion; locally <5ms
  });

  it('does NOT throw on hostile input — D-08 collected-not-thrown', () => {
    const synthetic = '<<<<>>>><<<<';
    let threw = false;
    try {
      parseTemplate(synthetic, { start: 0, end: synthetic.length }, synthetic);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  it('preserves mustache verbatim inside attribute values (no pre-parse)', () => {
    // Rozie permits {{ }} in attribute values (Vue forbids).
    const synthetic = '<div :class="card card--{{ variant }}"></div>';
    const { node, diagnostics } = parseTemplate(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(diagnostics).toEqual([]);
    const root = rootElement(node!);
    const cls = attr(root, ':class')!;
    expect(cls.kind).toBe('binding');
    expect(cls.value).toBe('card card--{{ variant }}');
  });
});
