import { TextDocument } from 'vscode-languageserver-textdocument';
import { describe, expect, it } from 'vitest';
import { computeCompletions, computeDefinition, computeHover } from '../features.js';

const SOURCE = [
  '<rozie name="Counter">',
  '<props>{ count: { type: Number, default: 0 }, label: { type: String } }</props>',
  '<data>{ hovering: false }</data>',
  '<template>',
  '  <div ref="rootEl">{{ $props.count }}</div>',
  '  <button @click="$data.hovering = true">{{ $props.label }}</button>',
  '</template>',
  '</rozie>',
].join('\n');

function doc(text = SOURCE, uri = 'file:///Counter.rozie'): TextDocument {
  return TextDocument.create(uri, 'rozie', 1, text);
}

function posAfter(d: TextDocument, marker: string) {
  return d.positionAt(SOURCE.indexOf(marker) + marker.length);
}

describe('computeCompletions', () => {
  it('lists <props> members after `$props.`', () => {
    const d = doc();
    // Insert a fresh `$props.` so the cursor sits right after the dot.
    const text = SOURCE.replace('{{ $props.count }}', '{{ $props. }}');
    const d2 = TextDocument.create('file:///Counter.rozie', 'rozie', 1, text);
    const pos = d2.positionAt(text.indexOf('$props.') + '$props.'.length);
    const items = computeCompletions(d2, pos);
    expect(items.map((i) => i.label).sort()).toEqual(['count', 'label']);
    expect(items.find((i) => i.label === 'count')?.detail).toBe('Number');
    void d;
  });

  it('lists $refs members and returns [] outside a sigil context', () => {
    const text = SOURCE.replace('ref="rootEl"', 'ref="rootEl" :id="$refs."');
    const d = TextDocument.create('file:///Counter.rozie', 'rozie', 1, text);
    const pos = d.positionAt(text.indexOf('$refs.') + '$refs.'.length);
    expect(computeCompletions(d, pos).map((i) => i.label)).toEqual(['rootEl']);
    // A position not after a sigil yields nothing.
    expect(computeCompletions(d, d.positionAt(0))).toEqual([]);
  });
});

describe('computeDefinition', () => {
  it('navigates a `$props.count` usage to its <props> declaration', () => {
    const d = doc();
    const usageOffset = SOURCE.indexOf('$props.count') + '$props.'.length;
    const loc = computeDefinition(d, d.positionAt(usageOffset));
    expect(loc).not.toBeNull();
    const start = d.offsetAt(loc!.range.start);
    const end = d.offsetAt(loc!.range.end);
    expect(SOURCE.slice(start, end)).toBe('count');
    // Resolves to the declaration (first occurrence), not the usage.
    expect(start).toBe(SOURCE.indexOf('count'));
  });

  it('navigates a `$refs.rootEl` usage to the ref attribute value', () => {
    const text = SOURCE.replace('{{ $props.label }}', '{{ $refs.rootEl }}');
    const d = TextDocument.create('file:///Counter.rozie', 'rozie', 1, text);
    const usageOffset = text.indexOf('{{ $refs.rootEl') + '{{ $refs.'.length;
    const loc = computeDefinition(d, d.positionAt(usageOffset));
    const start = d.offsetAt(loc!.range.start);
    const end = d.offsetAt(loc!.range.end);
    expect(text.slice(start, end)).toBe('rootEl');
    expect(start).toBe(text.indexOf('ref="rootEl"') + 'ref="'.length);
  });

  it('returns null off a sigil token', () => {
    const d = doc();
    expect(computeDefinition(d, posAfter(d, '<rozie'))).toBeNull();
  });
});

describe('computeHover', () => {
  it('shows the prop signature with its type', () => {
    const d = doc();
    const usageOffset = SOURCE.indexOf('$props.count') + '$props.'.length;
    const hover = computeHover(d, d.positionAt(usageOffset));
    expect(hover).not.toBeNull();
    const value = (hover!.contents as { value: string }).value;
    expect(value).toContain('$props.count: Number');
  });

  it('shows the data signature with its initial value', () => {
    const d = doc();
    const usageOffset = SOURCE.indexOf('$data.hovering') + '$data.'.length;
    const value = (computeHover(d, d.positionAt(usageOffset))!.contents as { value: string }).value;
    expect(value).toContain('$data.hovering: false');
  });

  it('returns null when the member is not declared', () => {
    const text = SOURCE.replace('$props.count', '$props.nope');
    const d = TextDocument.create('file:///Counter.rozie', 'rozie', 1, text);
    const usageOffset = text.indexOf('$props.nope') + '$props.'.length;
    expect(computeHover(d, d.positionAt(usageOffset))).toBeNull();
  });
});

const COMP_SOURCE = [
  '<rozie name="WrapperModal">',
  '<components>{ Modal: "./Modal.rozie" }</components>',
  '<template>',
  '  <Modal :open="true"><span>hi</span></Modal>',
  '</template>',
  '</rozie>',
].join('\n');

function compDoc(text = COMP_SOURCE, uri = 'file:///abs/dir/WrapperModal.rozie'): TextDocument {
  return TextDocument.create(uri, 'rozie', 1, text);
}

describe('component-tag features', () => {
  it('navigates a <Modal> tag to its sibling .rozie file', () => {
    const d = compDoc();
    const offset = COMP_SOURCE.indexOf('<Modal') + 3;
    const loc = computeDefinition(d, d.positionAt(offset));
    expect(loc?.uri).toBe('file:///abs/dir/Modal.rozie');
    expect(loc?.range.start).toEqual({ line: 0, character: 0 });
  });

  it('hovers a component tag with its import path', () => {
    const d = compDoc();
    const offset = COMP_SOURCE.indexOf('<Modal') + 3;
    const value = (computeHover(d, d.positionAt(offset))!.contents as { value: string }).value;
    expect(value).toContain('Modal');
    expect(value).toContain('./Modal.rozie');
  });

  it('completes component tag names after `<`', () => {
    const text = COMP_SOURCE.replace('<Modal :open', '<Mo :open');
    const d = compDoc(text);
    const pos = d.positionAt(text.indexOf('<Mo :open') + '<Mo'.length);
    const items = computeCompletions(d, pos);
    expect(items.map((i) => i.label)).toEqual(['Modal']);
    expect(items[0]?.detail).toBe('./Modal.rozie');
  });
});
