/**
 * WR-03 regression — Lit `.outside` Class-B path must respect `isHandlerLike`.
 *
 * Pre-fix bug (Phase 07.1 review): `emitOneListener`'s Class-B branch
 * unconditionally call-wrapped the handler — `(${handlerExpr})(e)`. When the
 * handler was an inline expression like `@click.outside="$data.open = false"`,
 * the rewrite produced `(this.open.value = false)(e)` — runtime TypeError
 * (assignment result is `false`, not a function).
 *
 * Fix (commit fixing Phase 07.1 WR-03/04): use the same `userCall` value
 * (computed by `isHandlerLike`) that the other listener classes use.
 *
 * This test compiles a tiny inline-handler `.outside` source and asserts the
 * emit is a bare statement, NOT a call. Prevents future regressions of the
 * same shape — including any new Class-B-adjacent emit added later.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';

function compile(source: string): string {
  const { ast } = parse(source, { filename: 'WR03.rozie' });
  if (!ast) throw new Error('parse failed');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lower failed');
  const { code } = emitLit(ir, { filename: 'WR03.rozie', source });
  return code;
}

describe('WR-03 — .outside inline-expression handler emits as statement', () => {
  it('inline expression handler is not call-wrapped', () => {
    const src = `<rozie name="WR03Inline">
<data>{ open: true }</data>
<listeners>
{
  "document:click.outside($refs.box)": {
    when:    "$data.open",
    handler: "$data.open = false",
  },
}
</listeners>
<template><div ref="box">box</div></template>
</rozie>`;
    const code = compile(src);
    // The attachOutsideClickListener call must contain the bare assignment
    // followed by ';' — no `(…)(e)` call-wrap around the assignment.
    expect(code).toContain('attachOutsideClickListener');
    expect(code).toMatch(/this\._open\.value\s*=\s*false;/);
    expect(code).not.toMatch(/\(this\._open\.value\s*=\s*false\)\s*\(\$event\)/);
  });

  it('method-identifier handler stays call-wrapped (negative case)', () => {
    const src = `<rozie name="WR03Method">
<data>{ open: true }</data>
<script>
function close() { $data.open = false }
</script>
<listeners>
{
  "document:click.outside($refs.box)": {
    when:    "$data.open",
    handler: close,
  },
}
</listeners>
<template><div ref="box">box</div></template>
</rozie>`;
    const code = compile(src);
    expect(code).toContain('attachOutsideClickListener');
    // Method-like handler should be call-wrapped: `((this.close) as ...)(e);`
    // The TS cast has parens of its own, so just assert the head + tail.
    expect(code).toContain('((this.close) as');
    expect(code).toMatch(/\)\s*\(\$event\);/);
  });
});
