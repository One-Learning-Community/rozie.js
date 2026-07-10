/**
 * Emitter host-display parity (quick 260710-fjj) — Angular arm.
 *
 * Angular emits a persistent component-selector host element the four hostless
 * targets (React/Vue/Svelte/Solid) don't. With no display rule the host defaults
 * to `display: inline`, so a baseline-aligned root picks up a descender gap and a
 * block root shrinks-to-content. The emitter normalizes the host to
 * `display: contents` (layout-transparent → parity with the hostless targets).
 *
 * CRITICAL: this is emitted as an ELEMENT-NAME-QUALIFIED CSS rule
 * `:host(rozie-x) { display: contents; }` in the component `styles: [...]`, NOT
 * as a bare `:host{}` rule and NOT as a `host: { '[style.display]': ... }`
 * binding. Two earlier attempts failed and this guards against both:
 *   1. bare `:host` → `[_nghost-ng-cN]`, which the shared-attr root also carries,
 *      collapsing the root box. `:host(rozie-x)` → `rozie-x[_nghost-ng-cN]`
 *      requires tag `rozie-x`, so the root (`<button>`/`<div>`) can't match.
 *   2. a `[style.display]` host binding writes an inline `style` attribute on the
 *      host; components that spread `$attrs` onto their root read the host's live
 *      attributes and re-apply them to the root with `!important` → box collapse.
 *      A stylesheet rule is not an attribute, so the spread never forwards it.
 * emitStyle is deliberately left UNCHANGED (no host rule in the styles array);
 * the rule is injected by emitDecorator, which knows the component selector.
 */
import { describe, it, expect } from 'vitest';
import { emitDecorator } from '../emitDecorator.js';
import { emitStyle } from '../emitStyle.js';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../../core/src/ir/types.js';
import type { PropDecl } from '../../../../../core/src/ir/types.js';

const STUB_IR = { name: 'Stub' } as unknown as IRComponent;

describe('Angular emitDecorator — default host display:contents parity', () => {
  it('emits an element-name-qualified :host(rozie-x) display:contents rule', () => {
    const out = emitDecorator(STUB_IR, {
      componentName: 'Demo',
      template: '<div>x</div>',
      stylesArrayBody: '',
      hasSlots: false,
      hasNgModel: false,
    });
    expect(out).toContain('styles: [');
    expect(out).toContain(':host(rozie-demo) { display: contents; }');
    // NOT a bare `:host {` rule (would collapse the shared-_nghost root)...
    expect(out).not.toMatch(/:host\s*\{/);
    // ...and NOT a host-binding inline style (the spread-$attrs leak path).
    expect(out).not.toContain('[style.display]');
  });

  it('emits the styles array even for a style-LESS component', () => {
    const out = emitDecorator(STUB_IR, {
      componentName: 'Demo',
      template: '<div>x</div>',
      stylesArrayBody: '',
      hasSlots: false,
      hasNgModel: false,
    });
    expect(out).toContain(':host(rozie-demo) { display: contents; }');
  });

  it('prepends the host rule AHEAD of author styles (cascade override)', () => {
    const out = emitDecorator(STUB_IR, {
      componentName: 'Demo',
      template: '<div>x</div>',
      stylesArrayBody: '.a { color: red; }',
      hasSlots: false,
      hasNgModel: false,
    });
    expect(out.indexOf(':host(rozie-demo) { display: contents; }')).toBeLessThan(
      out.indexOf('.a { color: red; }'),
    );
  });

  it('kebab-cases a multi-word component name in the selector', () => {
    const out = emitDecorator(STUB_IR, {
      componentName: 'DatePicker',
      template: '<div>x</div>',
      stylesArrayBody: '',
      hasSlots: false,
      hasNgModel: false,
    });
    expect(out).toContain(':host(rozie-date-picker) { display: contents; }');
  });

  it('leaves the CVA host binding untouched (parity is CSS, not a host binding)', () => {
    const out = emitDecorator(STUB_IR, {
      componentName: 'Demo',
      template: '<input />',
      stylesArrayBody: '',
      hasSlots: false,
      hasNgModel: false,
      cvaModelProp: {} as PropDecl,
    });
    // The only host binding remains the CVA touched handler — no display in it.
    expect(out).toContain(`host: { '(focusout)': '__rozieCvaOnTouched()' },`);
    expect(out).not.toContain('[style.display]');
  });

  it('emitStyle does NOT inject a host-display rule (parity lives in the decorator)', () => {
    const src = '<rozie name="X">\n<template><div /></template>\n<style>.a { color: red; }</style>\n</rozie>';
    const result = parse(src, { filename: 'probe.rozie' });
    if (!result.ast) throw new Error('parse() returned null AST');
    const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
    if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
    const body = emitStyle(lowered.ir.styles, src).stylesArrayBody;
    expect(body).not.toContain('display: contents');
    // A style-LESS component still produces no host rule from emitStyle.
    const emptySrc = '<rozie name="X">\n<template><div /></template>\n</rozie>';
    const empty = parse(emptySrc, { filename: 'probe.rozie' });
    if (!empty.ast) throw new Error('parse() returned null AST');
    const loweredEmpty = lowerToIR(empty.ast, { modifierRegistry: createDefaultRegistry() });
    if (!loweredEmpty.ir) throw new Error('lowerToIR() returned null IR');
    expect(emitStyle(loweredEmpty.ir.styles, emptySrc).stylesArrayBody).toBe('');
  });
});
