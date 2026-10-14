/**
 * Lit splices lifecycle bodies into shared methods (`firstUpdated()`,
 * `updated()`):
 *  - a comment between two statements of an `$onUpdate` body was printed twice
 *    (each neighbour carried a cloned copy of it);
 *  - a body that returned early would skip the hooks spliced after it.
 */
import { describe, expect, it } from 'vitest';
import { compile } from '../compile.js';

const SRC = `<rozie name="LitCom">
<data>{ n: 0 }</data>
<script>
const refeed = () => { $data.n = $data.n + 1 }
$onUpdate(() => {
  if ($data.n > 3) refeed()
  // The native element's selection is DOM state.
  if ($data.n > 9) refeed()
})
$onUpdate(() => {
  if ($data.n > 20) return
  console.log('second')
})
</script>
<template><div>{{ $data.n }}</div></template>
</rozie>`;

describe('Lit lifecycle bodies spliced into updated()', () => {
  const code = compile(SRC, { target: 'lit', filename: 'LitCom.rozie' }).code;
  const updated = code.slice(code.indexOf('updated(changedProperties'));

  it('prints a comment between two statements once', () => {
    expect(updated.split("// The native element's selection is DOM state.").length - 1).toBe(1);
  });

  it('calls a body that returns early instead of splicing it', () => {
    expect(updated).toMatch(/\(\(\) => \{\s*if \(this\._n\.value > 20\) return;/);
  });
});
