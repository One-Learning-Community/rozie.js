/**
 * Quick 260802-v1v Task 3 — SEAM 1 RED: emit-handler prop names fall through
 * to the root DOM spread.
 *
 * `emitSolid.ts:248-256` builds `propKeys` from `ir.props` + conditional
 * `children`/`ref` ONLY. `$emit('change', v)` lowers to a direct
 * `local.onChange` invocation, and `emitPropsInterface.ts:151-155`
 * (Solid's own copy) DECLARES `onChange?` on the props interface — but the
 * `splitProps(...)` key list never learns the name, so `onChange`/
 * `onComplete` fall into the `attrs` rest bucket that spreads onto the root
 * DOM element. A consumer's handler fires TWICE on Solid the same way it
 * does on React.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../../emitSolid.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitSolid(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

describe('emitSolid — emit-handler fallthrough spread (Quick 260802-v1v seam 1)', () => {
  it('splitProps key list must contain onChange + onComplete alongside the declared prop', () => {
    const src = `<rozie name="Test">
<props>
  { value: { type: String, required: true } }
</props>
<template>
  <input :value="$props.value" />
</template>
<script>
function commit(next) {
  $emit('change', next)
  $emit('complete', next)
}
</script>
</rozie>`;
    const code = compile(src);

    // RED (seam 1 target): the splitProps key list must contain BOTH
    // emit-handler prop names, not just the declared 'value' prop.
    expect(code).toContain("splitProps(_props, ['value', 'onChange', 'onComplete'])");

    // Non-regression: the props interface already declares both fields.
    expect(code).toContain('onChange?: (...args: unknown[]) => void;');
    expect(code).toContain('onComplete?: (...args: unknown[]) => void;');
  });

  it('a call-getter-free $emit-only component (zero props) stays syntactically valid', () => {
    // Solid's splitProps handles an empty key array gracefully (unlike
    // React's IIFE-destructure branch, which has the documented CR-01
    // history of emitting invalid `const { , ...rest }`), so there is no
    // equivalent degenerate-syntax risk here — this guard just proves
    // compile() does not throw and the interface still declares onChange.
    const src = `<rozie name="Bare">
<template>
  <button @click="fire">go</button>
</template>
<script>
function fire() {
  $emit('change', 1)
}
</script>
</rozie>`;
    const code = compile(src);
    expect(code).toContain('onChange?: (...args: unknown[]) => void;');
  });
});
