/**
 * Emitter parity (quick 260710-fjj): every emitted Lit host gets a default
 * `:host{display:contents}` so the custom element lays out identically to the
 * four hostless targets (React/Vue/Svelte/Solid) — no inline-host descender gap,
 * no shrink-to-content on block roots. Prepended BEFORE author rules so an
 * explicit `:host{display:X}` in the component wins via the CSS cascade (same
 * specificity, later source order). Applies even to style-LESS components (their
 * host still defaults to display:inline without it).
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitStyle } from '../emitStyle.js';
import {
  LitImportCollector,
  RuntimeLitImportCollector,
} from '../../rewrite/collectLitImports.js';

function staticStyles(rozieSource: string): string {
  const result = parse(rozieSource, { filename: 'probe.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return emitStyle(lowered.ir.styles, rozieSource, {
    componentName: 'X',
    lit: new LitImportCollector(),
    runtime: new RuntimeLitImportCollector(),
  }).staticStylesField;
}

const COMP = (style: string) => `<rozie name="X">
<template><div /></template>
${style}
</rozie>`;

describe('Lit emitStyle — default :host{display:contents} parity', () => {
  it('prepends :host{display:contents} ahead of author styles', () => {
    const out = staticStyles(COMP('<style>.a { color: red; }</style>'));
    expect(out).toContain('static styles = css`');
    expect(out).toContain(':host{display:contents}');
    expect(out).toContain('.a');
    // host default comes BEFORE the author rule (so the author can override it)
    expect(out.indexOf(':host{display:contents}')).toBeLessThan(out.indexOf('.a'));
  });

  it('emits the host rule even for a style-LESS component', () => {
    const out = staticStyles(COMP(''));
    expect(out).toContain('static styles = css`');
    expect(out).toContain(':host{display:contents}');
  });

  it('an author :host{display:block} appears AFTER the default (cascade override)', () => {
    const out = staticStyles(COMP('<style>:host { display: block; }</style>'));
    const iDefault = out.indexOf(':host{display:contents}');
    const iAuthor = out.indexOf('display: block');
    expect(iDefault).toBeGreaterThanOrEqual(0);
    expect(iAuthor).toBeGreaterThan(iDefault);
  });
});
