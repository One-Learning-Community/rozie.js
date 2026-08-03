/**
 * Quick 260802-v1v Task 3 — SEAM 1 RED: emit-handler prop names fall through
 * to the root DOM spread.
 *
 * `emitScript.ts:2216-2232` builds `declaredNames` from `ir.props` (+ the
 * model triplet) ONLY — its own comment at :2209 documents this as the
 * existing (buggy) behavior. `$emit('change', v)` lowers to
 * `props.onChange && props.onChange(v)` (`rewriteTemplateExpression.ts:14,300`)
 * and `emitPropsInterface.ts:151-155` DECLARES `onChange?` on the props
 * interface — but the destructure/rest-bucket skip list never learns the
 * name, so `onChange`/`onComplete` fall into the `{...attrs}` fallthrough
 * spread on the root DOM element. A consumer's handler fires TWICE: once via
 * the direct `props.onChange && props.onChange(v)` call, once more because
 * React invokes `attrs.onChange` as a native DOM `onChange` listener.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../../emitReact.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitReact(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

describe('emitScript (React) — emit-handler fallthrough spread (Quick 260802-v1v seam 1)', () => {
  it('destructure list must contain onChange + onComplete alongside the declared prop', () => {
    const src = `<rozie name="Test">
<props>
  { value: { type: String, default: '' } }
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

    // RED (seam 1 target): the attrs IIFE destructure list must skip
    // onChange/onComplete so they never spread onto the DOM.
    expect(code).toMatch(/const\s*\{\s*value,\s*onChange,\s*onComplete,\s*\.\.\.rest\s*\}/);

    // Non-regression: the props interface already declares both fields.
    expect(code).toContain('onChange?: (...args: any[]) => void;');
    expect(code).toContain('onComplete?: (...args: any[]) => void;');

    // Non-regression: $emit still lowers to the direct props.onX(...) call.
    expect(code).toContain('props.onChange && props.onChange(next)');
    expect(code).toContain('props.onComplete && props.onComplete(next)');
  });

  it('a call-getter-free $emit-only component (zero props) stays syntactically valid', () => {
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
    // CR-01 guard — the zero-declared-names branch has a documented history
    // of emitting invalid `const { , ...rest }` / `void ;`. Once `onChange`
    // enters declaredNames the IIFE path is taken instead of the
    // `props as Record<string, unknown>` shortcut; assert it's well-formed.
    expect(code).not.toContain('const { , ...rest }');
    // The literal CR-01 regression shape is a bare `void ;` statement (no
    // expression name before the semicolon) — NOT the `=> void;` return-type
    // annotation every emitted handler prop legitimately carries.
    expect(code).not.toContain('void ;');
    expect(code).toContain('onChange');
  });
});
