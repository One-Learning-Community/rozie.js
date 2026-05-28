import { parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import {
  componentTagAt,
  componentTagCompletionContext,
  resolveComponentUri,
  slotFillAt,
} from '../componentNav.js';
import { extractSymbols } from '../symbols.js';

const SOURCE = [
  '<rozie name="WrapperModal">',
  '<components>{ Modal: "./Modal.rozie", Card: "./ui/Card.rozie" }</components>',
  '<template>',
  '  <Modal :open="$props.open"><Card /></Modal>',
  '</template>',
  '</rozie>',
].join('\n');

function symbolsOf(source: string) {
  const { ast } = parse(source);
  if (!ast) throw new Error('expected an AST');
  return { ast, symbols: extractSymbols(ast, source) };
}

describe('componentTagAt', () => {
  it('hits the opening tag name span of a registered component', () => {
    const { ast, symbols } = symbolsOf(SOURCE);
    const offset = SOURCE.indexOf('<Modal') + 3; // inside "Modal"
    const hit = componentTagAt(ast.template!.children, symbols.components, offset);
    expect(hit?.symbol.name).toBe('Modal');
    expect(SOURCE.slice(hit!.nameLoc.start, hit!.nameLoc.end)).toBe('Modal');
  });

  it('hits nested component tags', () => {
    const { ast, symbols } = symbolsOf(SOURCE);
    const offset = SOURCE.indexOf('<Card') + 2;
    const hit = componentTagAt(ast.template!.children, symbols.components, offset);
    expect(hit?.symbol.name).toBe('Card');
    expect(hit?.symbol.path).toBe('./ui/Card.rozie');
  });

  it('returns null off any tag name and for unregistered tags', () => {
    const { ast, symbols } = symbolsOf(SOURCE);
    // The `:open` attribute is not a tag name.
    const attrOffset = SOURCE.indexOf(':open');
    expect(componentTagAt(ast.template!.children, symbols.components, attrOffset)).toBeNull();
  });
});

describe('slotFillAt', () => {
  const CONSUMER = [
    '<rozie name="W"><components>{ Modal: "./Modal.rozie" }</components>',
    '<template><Modal><template #header="{ x }">hi</template><template #footer>f</template></Modal></template>',
    '</rozie>',
  ].join('\n');

  function parsed() {
    const { ast } = parse(CONSUMER);
    if (!ast) throw new Error('expected AST');
    return { ast, symbols: extractSymbols(ast, CONSUMER) };
  }

  it('pairs a #slot fill with its enclosing component', () => {
    const { ast, symbols } = parsed();
    const offset = CONSUMER.indexOf('#header') + 2;
    const hit = slotFillAt(ast.template!.children, symbols.components, offset);
    expect(hit?.component.name).toBe('Modal');
    expect(hit?.slotName).toBe('header');
    expect(CONSUMER.slice(hit!.nameLoc.start, hit!.nameLoc.end)).toBe('#header');
  });

  it('returns null off any slot-fill attribute', () => {
    const { ast, symbols } = parsed();
    expect(slotFillAt(ast.template!.children, symbols.components, CONSUMER.indexOf('<Modal') + 3)).toBeNull();
  });
});

describe('resolveComponentUri', () => {
  it('resolves a relative path against the host document URI', () => {
    expect(resolveComponentUri('./Modal.rozie', 'file:///abs/dir/Wrapper.rozie')).toBe(
      'file:///abs/dir/Modal.rozie',
    );
    expect(resolveComponentUri('./ui/Card.rozie', 'file:///abs/dir/Wrapper.rozie')).toBe(
      'file:///abs/dir/ui/Card.rozie',
    );
    expect(resolveComponentUri('../shared/X.rozie', 'file:///abs/dir/Wrapper.rozie')).toBe(
      'file:///abs/shared/X.rozie',
    );
  });

  it('returns null for bare specifiers', () => {
    expect(resolveComponentUri('some-pkg/Modal.rozie', 'file:///abs/Wrapper.rozie')).toBeNull();
  });
});

describe('componentTagCompletionContext', () => {
  it('detects an opening-tag position with a partial name', () => {
    const text = '<template>\n  <Mo';
    const ctx = componentTagCompletionContext(text, text.length);
    expect(ctx?.partial).toBe('Mo');
    expect(ctx?.partialStart).toBe(text.length - 2);
  });

  it('detects a bare `<` with no partial', () => {
    const text = '<template>\n  <';
    expect(componentTagCompletionContext(text, text.length)?.partial).toBe('');
  });

  it('excludes closing tags and non-tag positions', () => {
    expect(componentTagCompletionContext('<div></', 7)).toBeNull();
    expect(componentTagCompletionContext('plain text', 10)).toBeNull();
  });
});
