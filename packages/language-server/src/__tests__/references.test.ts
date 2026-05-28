import { TextDocument } from 'vscode-languageserver-textdocument';
import { describe, expect, it } from 'vitest';
import { computeReferences } from '../features.js';

const SOURCE = [
  '<rozie name="Counter">',
  '<props>{ count: { type: Number } }</props>',
  '<script>const n = $props.count + 1;</script>',
  '<template><div :title="$props.count">{{ $props.count }}</div></template>',
  '</rozie>',
].join('\n');

const URI = 'file:///Counter.rozie';
const doc = (text = SOURCE) => TextDocument.create(URI, 'rozie', 1, text);

describe('computeReferences', () => {
  it('lists all usages plus the declaration when requested', () => {
    const d = doc();
    const offset = SOURCE.indexOf('$props.count') + '$props.'.length;
    const refs = computeReferences(d, d.positionAt(offset), true);
    expect(refs.length).toBe(4); // decl + 3 usages
    expect(refs.every((r) => r.uri === URI)).toBe(true);
    // First entry is the declaration.
    expect(d.offsetAt(refs[0]!.range.start)).toBe(SOURCE.indexOf('count'));
  });

  it('omits the declaration when includeDeclaration is false', () => {
    const d = doc();
    const offset = SOURCE.indexOf('$props.count') + '$props.'.length;
    expect(computeReferences(d, d.positionAt(offset), false).length).toBe(3);
  });

  it('resolves from the declaration site too', () => {
    const d = doc();
    const refs = computeReferences(d, d.positionAt(SOURCE.indexOf('count') + 2), true);
    expect(refs.length).toBe(4);
  });

  it('returns [] off any symbol', () => {
    const d = doc();
    expect(computeReferences(d, d.positionAt(0), true)).toEqual([]);
  });
});
