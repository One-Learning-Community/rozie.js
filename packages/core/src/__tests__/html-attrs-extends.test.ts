// Typed public surface phase 3 (spec §5) — `renderHtmlAttrsExtends` renders the
// `extends Omit<RootAttrs, OwnKeys | ContentOwnedKeys>` clause that lets a
// consumer pass the root element's HTML attributes through a props interface.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import {
  collectInterfaceMemberNames,
  renderHtmlAttrsExtends,
} from '../codegen/htmlAttrsExtends.js';
import { renderPropsInterface } from '../codegen/renderPropsInterface.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const ATTRS_BUTTON = readFileSync(
  resolve(ROOT, 'tests/fixtures/typed-surface/AttrsButton.rozie'),
  'utf8',
);

function ir(source: string) {
  const { ast } = parse(source, { filename: 'Probe.rozie' });
  if (!ast) throw new Error('parse failed');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lower failed');
  return ir;
}
const wrap = (attrs: string, body: string) =>
  `<rozie name="Probe"${attrs}>\n<template>\n${body}\n</template>\n</rozie>\n`;

describe('collectInterfaceMemberNames', () => {
  it('reads top-level members, skipping JSDoc, nested lines and index signatures', () => {
    const lines = [
      '  /**\n   * The label: shown.\n   */',
      '  label?: string;',
      "  'aria-x'?: string;",
      '  onPress?: (...args: any[]) => void;',
      '  slots?: { nested: string };',
      '    deeper: number;',
      '  [key: string]: unknown;',
      '  readonly id: string;',
    ];
    expect(collectInterfaceMemberNames(lines)).toEqual(['label', 'aria-x', 'onPress', 'slots', 'id']);
  });
  it('unescapes a quoted key', () => {
    expect(collectInterfaceMemberNames(["  'it\\'s'?: string;"])).toEqual(["it's"]);
  });
});

describe('renderHtmlAttrsExtends', () => {
  const fields = ['  label?: string;', '  title?: number;', '  onPress?: (...args: any[]) => void;'];

  it('react: element-specific base, own keys + content-owned keys omitted', () => {
    expect(renderHtmlAttrsExtends(ir(ATTRS_BUTTON), 'react', fields)).toBe(
      " extends Omit<import('react').ComponentPropsWithoutRef<'button'>, 'label' | 'title' | 'onPress' | 'children' | 'dangerouslySetInnerHTML'>",
    );
  });
  it('solid: ComponentProps base, ref + content keys omitted', () => {
    expect(renderHtmlAttrsExtends(ir(ATTRS_BUTTON), 'solid', fields)).toBe(
      " extends Omit<import('solid-js').ComponentProps<'button'>, 'label' | 'title' | 'onPress' | 'children' | 'innerHTML' | 'innerText' | 'textContent' | 'ref'>",
    );
  });
  it('svelte: SvelteHTMLElements base', () => {
    expect(renderHtmlAttrsExtends(ir(ATTRS_BUTTON), 'svelte', fields)).toBe(
      " extends Omit<import('svelte/elements').SvelteHTMLElements['button'], 'label' | 'title' | 'onPress' | 'children'>",
    );
  });
  it('custom-element root falls back to the generic HTMLAttributes<HTMLElement>', () => {
    const r = ir(wrap('', '<my-widget>x</my-widget>'));
    expect(renderHtmlAttrsExtends(r, 'react', [])).toBe(
      " extends Omit<import('react').HTMLAttributes<HTMLElement>, 'children' | 'dangerouslySetInnerHTML'>",
    );
    expect(renderHtmlAttrsExtends(r, 'solid', [])).toContain(
      "import('solid-js').JSX.HTMLAttributes<HTMLElement>",
    );
    // Svelte indexes SvelteHTMLElements by the real tag: its catch-all
    // `[name: string]: { [name: string]: any }` entry covers custom elements.
    expect(renderHtmlAttrsExtends(r, 'svelte', [])).toContain(
      "import('svelte/elements').SvelteHTMLElements['my-widget']",
    );
  });
  it('an <svg> root gets the SVG element attributes on every target (review finding #1)', () => {
    const r = ir(wrap('', '<svg viewBox="0 0 1 1"><path d="M0 0" /></svg>'));
    expect(renderHtmlAttrsExtends(r, 'react', [])).toContain("import('react').ComponentPropsWithoutRef<'svg'>");
    expect(renderHtmlAttrsExtends(r, 'solid', [])).toContain("import('solid-js').ComponentProps<'svg'>");
    expect(renderHtmlAttrsExtends(r, 'svelte', [])).toContain("import('svelte/elements').SvelteHTMLElements['svg']");
  });
  it('an upper-case root tag resolves case-insensitively', () => {
    const r = ir(wrap('', '<DIV>x</DIV>'));
    const out = renderHtmlAttrsExtends(r, 'react', []);
    // Either the tag lowered to a known `div`, or the parser kept it verbatim
    // and it is treated as unknown — never an invalid `ComponentPropsWithoutRef<'DIV'>`.
    expect(out).not.toContain("<'DIV'>");
  });
  it('dedupes an own key that is also content-owned', () => {
    expect(renderHtmlAttrsExtends(ir(ATTRS_BUTTON), 'react', ['  children?: unknown;'])).toBe(
      " extends Omit<import('react').ComponentPropsWithoutRef<'button'>, 'children' | 'dangerouslySetInnerHTML'>",
    );
  });
  it.each([
    ['inherit-attrs="false"', wrap(' inherit-attrs="false"', '<div>x</div>')],
    ['r-if root', wrap('', '<div r-if="true">x</div>')],
  ])('returns "" when fallthrough does not fire (%s)', (_label, src) => {
    for (const t of ['react', 'solid', 'svelte'] as const) {
      expect(renderHtmlAttrsExtends(ir(src), t, [])).toBe('');
    }
  });
  it('inherit-listeners="false" still accepts on* keys (the attrs spread carries them at runtime — Task 3 probe)', () => {
    const r = ir(wrap(' inherit-listeners="false"', '<button>x</button>'));
    for (const t of ['react', 'solid', 'svelte'] as const) {
      expect(renderHtmlAttrsExtends(r, t, [])).not.toContain('`on${string}`');
    }
  });
});

describe('renderPropsInterface htmlAttrs option', () => {
  it('is byte-identical when the option is absent', () => {
    const out = renderPropsInterface(ir(ATTRS_BUTTON), { slotChildrenType: 'ReactNode', target: 'react' });
    expect(out.split('\n')[0]).toBe('export interface AttrsButtonProps {');
  });
  it('splices the clause into the header when present', () => {
    const out = renderPropsInterface(ir(ATTRS_BUTTON), {
      slotChildrenType: 'ReactNode',
      target: 'react',
      htmlAttrs: 'react',
    });
    expect(out.split('\n')[0]).toBe(
      "export interface AttrsButtonProps extends Omit<import('react').ComponentPropsWithoutRef<'button'>, 'label' | 'title' | 'onPress' | 'children' | 'dangerouslySetInnerHTML'> {",
    );
  });
  it('leaves an inherit-attrs="false" component byte-identical even with the option', () => {
    const r = ir(wrap(' inherit-attrs="false"', '<div>x</div>'));
    const a = renderPropsInterface(r, { slotChildrenType: 'ReactNode', target: 'react' });
    const b = renderPropsInterface(r, { slotChildrenType: 'ReactNode', target: 'react', htmlAttrs: 'react' });
    expect(b).toBe(a);
  });
});
