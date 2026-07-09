// Quick task 260709-f7q — cross-framework whitespace parity.
//
// Significant whitespace between text and an element (authored across a newline)
// renders a collapsed space on the HTML-templating targets (Vue/Svelte/Angular/
// Lit) because the browser collapses the whitespace run to one significant space
// in an inline context. JSX (Babel `cleanJSXElementLiteralChild`) instead STRIPS
// any leading/trailing whitespace run that contains a newline, so React/Solid
// dropped the space. The emitter now restores parity by re-emitting that boundary
// space as an explicit `{" "}` JSX child — but only at a real boundary (a rendered
// sibling on that side) and only when JSX would have stripped it.
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

function emitJsx(rozie: string): string {
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  return emitTemplate(lowerInline(rozie), collectors, createDefaultRegistry()).jsx;
}

describe('React JSX whitespace parity (260709-f7q)', () => {
  it('restores the significant space between text and a following element (newline boundary)', () => {
    const jsx = emitJsx(`
<rozie name="X">
<template>
<label>mode
  <select></select></label>
</template>
</rozie>
`);
    // "mode" then a newline+indent then <select>: HTML renders "mode <select>".
    // JSX would strip the newline-ws, so the emitter restores it as {" "}.
    expect(jsx).toContain('mode{" "}');
  });

  it('restores the significant space between text and a following interpolation', () => {
    const jsx = emitJsx(`
<rozie name="X">
<props>{ name: { type: String, default: '' } }</props>
<template>
<p>hello
{{ $props.name }}</p>
</template>
</rozie>
`);
    // Content text "hello" then newline then {{ name }}: the other targets condense
    // the trailing whitespace of the content node to one space → "hello <name>".
    expect(jsx).toContain('hello{" "}');
  });

  it('does NOT introduce a space at a whitespace-only element↔element newline boundary (parity with Vue/Angular/Svelte drop rule)', () => {
    const jsx = emitJsx(`
<rozie name="X">
<template>
<div><span>a</span>
<span>b</span></div>
</template>
</rozie>
`);
    // A whitespace-only text node containing a newline is layout formatting: every
    // target drops it (Svelte isDroppableWhitespace, Vue/Angular condense, JSX
    // strips). React/Solid must NOT widen it to {" "}.
    expect(jsx).not.toMatch(/<\/span>\{" "\}<span/);
    expect(jsx).not.toContain('{" "}');
  });

  it('does NOT add a boundary space at the parent content edge (leading/trailing trimmed like HTML)', () => {
    const jsx = emitJsx(`
<rozie name="X">
<template>
<p>
  hello
</p>
</template>
</rozie>
`);
    // Leading/trailing whitespace against the block edge is trimmed by HTML and by
    // JSX alike — no {" "} should be injected for an only-child text node.
    expect(jsx).not.toContain('{" "}');
  });
});
