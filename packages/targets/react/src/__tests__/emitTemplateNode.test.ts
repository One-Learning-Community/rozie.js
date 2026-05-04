/**
 * Plan 04-03 Task 1 — emitTemplateNode behaviour tests.
 * Covers: TemplateStaticText, TemplateInterpolation, TemplateFragment,
 * TemplateLoop, r-show, r-html, r-text.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { emitTemplate } from '../emit/emitTemplate.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function emit(ir: IRComponent) {
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  const result = emitTemplate(ir, collectors, createDefaultRegistry());
  return { ...result, collectors };
}

describe('emitTemplateNode — Plan 04-03 Task 1', () => {
  it('Test 1: TemplateStaticText is emitted verbatim', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div>hello</div>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    expect(jsx).toContain('hello');
  });

  it('Test 2: TemplateInterpolation produces single-brace JSX expression', () => {
    const ir = lowerInline(`
<rozie name="X">
<data>{ value: 0 }</data>
<template>
<div>{{ $data.value }}</div>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    expect(jsx).toContain('{value}');
  });

  it('Test 7: TemplateLoop with key produces .map((item) => <li key={...}>...</li>)', () => {
    const ir = lowerInline(`
<rozie name="X">
<props>{ items: { type: Array, default: () => [] } }</props>
<template>
<ul>
  <li r-for="item in $props.items" :key="item.id">{{ item.name }}</li>
</ul>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    expect(jsx).toMatch(/props\.items\.map/);
    expect(jsx).toMatch(/\(item\)\s*=>/);
    expect(jsx).toMatch(/key=\{item\.id\}/);
  });

  it('Test 14: r-show emits style display toggle', () => {
    const ir = lowerInline(`
<rozie name="X">
<props>{ open: { type: Boolean, default: false } }</props>
<template>
<div r-show="$props.open">visible</div>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    // Test expression is parenthesized for safe operator-precedence composition.
    expect(jsx).toContain("style={{ display: (props.open) ? '' : 'none' }}");
  });

  it('Test 15: r-html (no children) emits dangerouslySetInnerHTML', () => {
    const ir = lowerInline(`
<rozie name="X">
<props>{ bodyHtml: { type: String, default: '' } }</props>
<template>
<div r-html="$props.bodyHtml"></div>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    expect(jsx).toContain('dangerouslySetInnerHTML');
    expect(jsx).toContain('__html: props.bodyHtml');
  });

  it('Test 15b: r-html WITH children emits ROZ520 + drops children', () => {
    const ir = lowerInline(`
<rozie name="X">
<props>{ bodyHtml: { type: String, default: '' } }</props>
<template>
<div r-html="$props.bodyHtml">DROP_ME</div>
</template>
</rozie>
`);
    const { jsx, diagnostics } = emit(ir);
    expect(jsx).not.toContain('DROP_ME');
    expect(diagnostics.some((d) => d.code === 'ROZ520')).toBe(true);
  });

  it('Test 16: r-text replaces children with the expression', () => {
    const ir = lowerInline(`
<rozie name="X">
<props>{ label: { type: String, default: '' } }</props>
<template>
<div r-text="$props.label">old children</div>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    expect(jsx).not.toContain('old children');
    expect(jsx).toContain('{props.label}');
  });
});
