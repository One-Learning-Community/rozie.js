import { TextDocument } from 'vscode-languageserver-textdocument';
import { describe, expect, it } from 'vitest';
import { computePrepareRename, computeRename } from '../features.js';

const SOURCE = [
  '<rozie name="Counter">',
  '<props>{ count: { type: Number, default: 0 } }</props>',
  '<data>{ hovering: false }</data>',
  '<script>const next = $props.count + 1;</script>',
  '<template>',
  '  <div ref="rootEl" :title="$props.count">{{ $props.count }}</div>',
  '</template>',
  '</rozie>',
].join('\n');

const URI = 'file:///Counter.rozie';

function doc(text = SOURCE): TextDocument {
  return TextDocument.create(URI, 'rozie', 1, text);
}

function applyEdits(text: string, edits: { range: { start: unknown; end: unknown }; newText: string }[], d: TextDocument): string {
  // Apply edits back-to-front by offset so earlier edits don't shift later ones.
  const withOffsets = edits
    .map((e) => ({
      start: d.offsetAt(e.range.start as never),
      end: d.offsetAt(e.range.end as never),
      newText: e.newText,
    }))
    .sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of withOffsets) out = out.slice(0, e.start) + e.newText + out.slice(e.end);
  return out;
}

describe('computePrepareRename', () => {
  it('accepts a $props usage and selects the member range', () => {
    const d = doc();
    const offset = SOURCE.indexOf('$props.count') + '$props.'.length;
    const range = computePrepareRename(d, d.positionAt(offset));
    expect(range).not.toBeNull();
    expect(d.offsetAt(range!.start)).toBe(SOURCE.indexOf('$props.count') + '$props.'.length);
  });

  it('accepts the <props> declaration site', () => {
    const d = doc();
    const range = computePrepareRename(d, d.positionAt(SOURCE.indexOf('count') + 2));
    expect(range).not.toBeNull();
  });

  it('rejects positions off any symbol', () => {
    const d = doc();
    expect(computePrepareRename(d, d.positionAt(0))).toBeNull();
  });
});

describe('computeRename', () => {
  it('rewrites the <props> declaration and all $props.count usages', () => {
    const d = doc();
    const offset = SOURCE.indexOf('$props.count') + '$props.'.length;
    const edit = computeRename(d, d.positionAt(offset), 'total');
    const edits = edit!.changes![URI]!;
    // 1 declaration + 3 usages (script, :title binding, interpolation).
    expect(edits.length).toBe(4);
    const result = applyEdits(SOURCE, edits, d);
    expect(result).toContain('<props>{ total: { type: Number, default: 0 } }');
    expect(result.match(/\$props\.total/g)?.length).toBe(3);
    expect(result).not.toContain('$props.count');
    // Untouched: the $data symbol stays put.
    expect(result).toContain('hovering: false');
  });

  it('renames a $refs symbol from its ref="..." declaration', () => {
    const text = SOURCE.replace('{{ $props.count }}', '{{ $refs.rootEl }}');
    const d = doc(text);
    const declOffset = text.indexOf('ref="rootEl"') + 'ref="'.length + 1;
    const edit = computeRename(d, d.positionAt(declOffset), 'containerEl');
    const result = applyEdits(text, edit!.changes![URI]!, d);
    expect(result).toContain('ref="containerEl"');
    expect(result).toContain('$refs.containerEl');
    expect(result).not.toContain('rootEl');
  });

  it('rejects an invalid identifier as the new name', () => {
    const d = doc();
    const offset = SOURCE.indexOf('$props.count') + '$props.'.length;
    expect(computeRename(d, d.positionAt(offset), '1bad')).toBeNull();
    expect(computeRename(d, d.positionAt(offset), 'has space')).toBeNull();
  });
});
