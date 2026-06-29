/**
 * LB6 SEAM 1 — Lit `<dialog>` ref-type carve-out (emit-level assertion).
 *
 * The Lit per-target gate is an ESLINT gate (no tsc), so a `.showModal()` type
 * error never surfaces there. The red-first proof for Lit is an EMIT-LEVEL
 * assertion: an `@query` ref field bound to a native `<dialog>` must be typed
 * `HTMLDialogElement` (the dialog carve-out), while a ref on a non-dialog
 * element keeps the byte-identical `HTMLElement` default.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';

const DIALOG_SRC = `
<rozie name="DialogRef">
<script lang="ts">
$onMount(() => {
  $refs.dlg.showModal()
})
</script>
<template>
<dialog ref="dlg"><slot /></dialog>
</template>
</rozie>
`;

const DIV_SRC = `
<rozie name="DivRef">
<script lang="ts">
$onMount(() => {
  $refs.box.focus()
})
</script>
<template>
<div ref="box"><slot /></div>
</template>
</rozie>
`;

describe('Lit — <dialog> ref-type carve-out (LB6 SEAM 1)', () => {
  it('an @query ref field on <dialog> is typed HTMLDialogElement', () => {
    const result = compile(DIALOG_SRC, {
      target: 'lit',
      filename: 'DialogRef.rozie',
      sourceMap: false,
    });
    expect(result.code).toContain(
      `@query('[data-rozie-ref="dlg"]') private _refDlg!: HTMLDialogElement;`,
    );
  });

  it('an @query ref field on a non-dialog element keeps HTMLElement (byte-identical)', () => {
    const result = compile(DIV_SRC, {
      target: 'lit',
      filename: 'DivRef.rozie',
      sourceMap: false,
    });
    expect(result.code).toContain(
      `@query('[data-rozie-ref="box"]') private _refBox!: HTMLElement;`,
    );
  });
});
