/**
 * Quick 260802-v1v Task 1 — SEAM 5 RED: `HTML_TO_SOLID_ATTR` and
 * `RBIND_HTML_TO_SOLID_ATTR` mis-camelCase `spellcheck`.
 *
 * `solid-js@1.9.12/types/jsx.d.ts:1233` declares lowercase `spellcheck` on
 * Solid's JSX intrinsics and does NOT declare `spellCheck` — verified for
 * this plan. `:1211` declares lowercase `autocorrect`, which Solid's maps
 * already pass through correctly (no entry = `?? name` fallthrough keeps it
 * lowercase). `HTML_TO_SOLID_ATTR:147` and `RBIND_HTML_TO_SOLID_ATTR:329`
 * both currently map `spellcheck: 'spellCheck'` — the wrong direction, one
 * line below the correct `autocapitalize: 'autocapitalize'` native-lowercase
 * passthrough precedent at `:150`.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../../emitSolid.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitSolid(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

/**
 * Extract the JSX returned by the emitted component — paren-balanced text
 * between `return (` and the matching `);` (copied from listenerSpread.test.ts).
 */
function extractJsx(emitted: string): string {
  const start = emitted.search(/return\s*\(/);
  if (start < 0) return emitted;
  const openIdx = emitted.indexOf('(', start);
  let depth = 1;
  let i = openIdx + 1;
  while (i < emitted.length && depth > 0) {
    const ch = emitted[i]!;
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth === 0) break;
    i++;
  }
  return emitted.slice(openIdx + 1, i).trim();
}

describe('emitTemplateAttribute (Solid) — HTML_TO_SOLID_ATTR name map (Quick 260802-v1v seam 5)', () => {
  const PROLOGUE = '<rozie name="Test" inherit-attrs="false">';

  it('autocorrect / spellcheck / autocapitalize on a static <input>', () => {
    const src = `${PROLOGUE}
<template>
  <input autocorrect="off" spellcheck="false" autocapitalize="off" />
</template>
</rozie>`;
    const code = compile(src);
    const jsx = extractJsx(code);
    expect(jsx).toMatchSnapshot();

    // RED (seam 5 target): spellcheck must stay native-cased. solid-js's
    // jsx.d.ts declares NO `spellCheck` — the current map mis-camelCases it.
    expect(jsx).toContain('spellcheck="false"');
    expect(jsx).not.toContain('spellCheck=');

    // Non-regression guards — already correct, must stay green.
    expect(jsx).toContain('autocorrect="off"');
    expect(jsx).toContain('autocapitalize="off"');
  });

  it('r-bind literal covers the same map (RBIND_HTML_TO_SOLID_ATTR:329)', () => {
    const src = `${PROLOGUE}
<template>
  <input r-bind="{ spellcheck: false }" />
</template>
</rozie>`;
    const code = compile(src);
    const jsx = extractJsx(code);
    expect(jsx).toMatchSnapshot();

    // RED (seam 5 target): same wrong-direction map on the r-bind literal
    // key-remap path.
    expect(jsx).toContain('spellcheck:');
    expect(jsx).not.toContain('spellCheck:');
  });
});
