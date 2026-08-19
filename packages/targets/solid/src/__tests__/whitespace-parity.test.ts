// Quick task 260709-f7q — cross-framework whitespace parity (Solid).
//
// Same divergence as the React target: JSX strips a leading/trailing whitespace
// run that contains a newline, so significant whitespace authored across a
// newline between text and an element vanished on Solid while the HTML-templating
// targets collapse it to one space. The emitter restores that boundary space as
// an explicit {" "} JSX child. See the React twin for the full rationale.

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../emitSolid.js';

function compile(src: string): string {
  const parsed = parse(src, { filename: 'Ws.rozie' });
  if (!parsed.ast) throw new Error('parse failed');
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR failed');
  return emitSolid(lowered.ir, { filename: 'Ws.rozie', source: src }).code;
}

describe('Solid JSX whitespace parity (260709-f7q)', () => {
  it('restores the significant space between text and a following element (newline boundary)', () => {
    const code = compile(`<rozie name="Ws">
<template>
<label>mode
  <select></select></label>
</template>
</rozie>`);
    expect(code).toContain('mode{" "}');
  });

  it('restores the significant space between text and a following interpolation', () => {
    const code = compile(`<rozie name="Ws">
<props>{ name: { type: String, default: '' } }</props>
<template>
<p>hello
{{ $props.name }}</p>
</template>
</rozie>`);
    expect(code).toContain('hello{" "}');
  });

  it('does NOT introduce a space at a whitespace-only element↔element newline boundary (parity with Vue/Angular/Svelte drop rule)', () => {
    const code = compile(`<rozie name="Ws">
<template>
<div><span>a</span>
<span>b</span></div>
</template>
</rozie>`);
    expect(code).not.toMatch(/<\/span>\{" "\}<span/);
    expect(code).not.toContain('{" "}');
  });

  it('does NOT add a boundary space at the parent content edge', () => {
    const code = compile(`<rozie name="Ws">
<template>
<p>
  hello
</p>
</template>
</rozie>`);
    expect(code).not.toContain('{" "}');
  });
});
