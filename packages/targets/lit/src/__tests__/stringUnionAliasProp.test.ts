/**
 * A prop typed with a `<types>` alias of string literals (`'row' | 'handle'`)
 * is a string attribute on Lit.
 *
 * Pre-fix bug: `renderType()` mapped every non-constructor identifier to
 * `type: Object`, so a plain-HTML `keyboard-trigger="handle"` went through
 * Lit's Object converter (`JSON.parse('handle')` throws → `null`) and the
 * attribute was lost. The TS field type keeps the alias.
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../emitLit.js';

function compile(source: string): string {
  const { ast } = parse(source, { filename: 'AliasProbe.rozie' });
  if (!ast) throw new Error('parse failed');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lower failed');
  const { code } = emitLit(ir, { filename: 'AliasProbe.rozie', source });
  return code;
}

const SOURCE = `<rozie name="AliasProbe">
<types>
export type Trigger = 'row' | 'handle'
export type Single = 'only'
type Step = 1 | 2 | 3
export type Mixed = 'a' | 1
export interface Shape { x: number }
</types>
<props>
{
  keyboardTrigger: { type: Trigger, default: 'row' },
  single: { type: Single, default: 'only' },
  step: { type: Step, default: 1 },
  mixed: { type: Mixed, default: 'a' },
  shape: { type: Shape, default: null },
}
</props>
<template><div>x</div></template>
</rozie>`;

function propertyLine(code: string, field: string): string {
  const re = new RegExp(`@property\\(.*\\) ${field}[!?:]`);
  const lines = code.split('\n').filter((l) => re.test(l));
  expect(lines, `exactly one @property line for ${field}`).toHaveLength(1);
  return lines[0]!.trim();
}

describe('Lit: <types> literal-union alias props', () => {
  const code = compile(SOURCE);

  it('a string-literal union alias is a reflected String attribute, typed by the alias', () => {
    expect(propertyLine(code, 'keyboardTrigger')).toBe(
      "@property({ type: String, reflect: true, attribute: 'keyboard-trigger' }) keyboardTrigger: Trigger = 'row';",
    );
    expect(propertyLine(code, 'single')).toBe("@property({ type: String, reflect: true }) single: Single = 'only';");
  });

  it('a number-literal union alias is a reflected Number attribute', () => {
    expect(propertyLine(code, 'step')).toBe('@property({ type: Number, reflect: true }) step: Step = 1;');
  });

  it('a mixed union and an interface stay Object', () => {
    expect(propertyLine(code, 'mixed')).toBe("@property({ type: Object }) mixed: Mixed = 'a';");
    expect(propertyLine(code, 'shape')).toBe('@property({ type: Object }) shape: Shape | null = null;');
  });
});
