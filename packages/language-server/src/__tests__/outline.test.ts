import { TextDocument } from 'vscode-languageserver-textdocument';
import { SymbolKind } from 'vscode-languageserver';
import { describe, expect, it } from 'vitest';
import { computeDocumentSymbols } from '../outline.js';

const SOURCE = [
  '<rozie name="Counter">',
  '<props>{ count: { type: Number } }</props>',
  '<data>{ hovering: false }</data>',
  '<components>{ Modal: "./Modal.rozie" }</components>',
  '<script>const x = 1;</script>',
  '<template><div ref="rootEl"><Modal /></div></template>',
  '<style>.x {}</style>',
  '</rozie>',
].join('\n');

const doc = (text = SOURCE) => TextDocument.create('file:///Counter.rozie', 'rozie', 1, text);

describe('computeDocumentSymbols', () => {
  it('wraps blocks under the component name', () => {
    const syms = computeDocumentSymbols(doc());
    expect(syms.length).toBe(1);
    expect(syms[0]?.name).toBe('Counter');
    expect(syms[0]?.kind).toBe(SymbolKind.Class);
  });

  it('lists each present block with member children', () => {
    const root = computeDocumentSymbols(doc())[0]!;
    const blocks = root.children!.map((c) => c.name);
    expect(blocks).toEqual(['props', 'data', 'components', 'script', 'template', 'style']);

    const props = root.children!.find((c) => c.name === 'props')!;
    expect(props.children!.map((c) => c.name)).toEqual(['count']);
    const components = root.children!.find((c) => c.name === 'components')!;
    expect(components.children!.map((c) => c.name)).toEqual(['Modal']);
    const template = root.children!.find((c) => c.name === 'template')!;
    expect(template.children!.map((c) => c.name)).toEqual(['rootEl']);
  });

  it('returns [] when there is no envelope', () => {
    expect(computeDocumentSymbols(doc('plain text'))).toEqual([]);
  });
});
