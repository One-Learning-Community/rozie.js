import { parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { extractSymbols, symbolsForSigil } from '../symbols.js';

const SOURCE = [
  '<rozie name="Counter">',
  '<props>{ count: { type: Number, default: 0 }, label: { type: String } }</props>',
  '<data>{ hovering: false }</data>',
  '<template>',
  '  <div ref="rootEl">{{ $props.count }}</div>',
  '  <button>{{ $props.label }}</button>',
  '</template>',
  '</rozie>',
].join('\n');

function symbolsOf(source: string) {
  const { ast } = parse(source);
  if (!ast) throw new Error('expected an AST');
  return extractSymbols(ast, source);
}

describe('extractSymbols', () => {
  it('collects <props> keys with type detail and name-accurate locs', () => {
    const { props } = symbolsOf(SOURCE);
    expect(props.map((p) => p.name)).toEqual(['count', 'label']);
    expect(props.find((p) => p.name === 'count')?.detail).toBe('Number');
    expect(props.find((p) => p.name === 'label')?.detail).toBe('String');
    // loc points at the declaration name itself, not the descriptor.
    const count = props.find((p) => p.name === 'count')!;
    expect(SOURCE.slice(count.loc.start, count.loc.end)).toBe('count');
  });

  it('collects <data> keys with value detail', () => {
    const { data } = symbolsOf(SOURCE);
    expect(data.map((d) => d.name)).toEqual(['hovering']);
    expect(data[0]?.detail).toBe('false');
  });

  it('collects template refs from ref="..." attributes', () => {
    const { refs } = symbolsOf(SOURCE);
    expect(refs.map((r) => r.name)).toEqual(['rootEl']);
    const rootEl = refs[0]!;
    expect(SOURCE.slice(rootEl.loc.start, rootEl.loc.end)).toBe('rootEl');
    expect(rootEl.detail).toBe('template ref');
  });

  it('returns empty arrays for blocks that are absent', () => {
    const { ast } = parse('<rozie name="X"><template><div /></template></rozie>');
    const symbols = extractSymbols(ast!, '');
    expect(symbols.props).toEqual([]);
    expect(symbols.data).toEqual([]);
    expect(symbols.refs).toEqual([]);
  });
});

describe('symbolsForSigil', () => {
  it('routes each sigil to its declaration list', () => {
    const symbols = symbolsOf(SOURCE);
    expect(symbolsForSigil(symbols, 'props')).toBe(symbols.props);
    expect(symbolsForSigil(symbols, 'data')).toBe(symbols.data);
    expect(symbolsForSigil(symbols, 'refs')).toBe(symbols.refs);
  });
});
