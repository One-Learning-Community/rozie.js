/**
 * Quick 260802-v1v Task 1 — SEAM 5 RED: `HTML_TO_JSX_ATTR` is missing
 * `autocorrect`.
 *
 * `@types/react@18.3.28:2952` and `@19.2.14:2833` both declare
 * `autoCorrect?: string` on `InputHTMLAttributes` and NO lowercase
 * `autocorrect` — verified for this plan. `HTML_TO_JSX_ATTR`
 * (`emitTemplateAttribute.ts:99-142`) already maps `spellcheck` →
 * `spellCheck` and `autocapitalize` → `autoCapitalize` but has no
 * `autocorrect` entry, so a static `autocorrect="off"` attribute currently
 * falls through `htmlAttrToJsxName`'s `?? name` default and emits the
 * lowercase HTML name verbatim — invalid/no-op JSX for this prop.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../../emitReact.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitReact(ir, { filename: 'Test.rozie', source: rozieSrc });
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

describe('emitTemplateAttribute (React) — HTML_TO_JSX_ATTR name map (Quick 260802-v1v seam 5)', () => {
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

    // RED (seam 5 target): autocorrect must map to autoCorrect. @types/react
    // declares NO lowercase `autocorrect` prop — the current fallthrough
    // emits it verbatim.
    expect(jsx).toContain('autoCorrect="off"');
    expect(jsx).not.toContain('autocorrect=');

    // Non-regression guards — already correct, must stay green.
    expect(jsx).toContain('spellCheck="false"');
    expect(jsx).not.toContain('autocapitalize=');
    expect(jsx).toContain('autoCapitalize="off"');
  });
});
