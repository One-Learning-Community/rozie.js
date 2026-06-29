/**
 * LB6 SEAM 1 — Solid `<dialog>` ref-type carve-out (emit-level assertion).
 *
 * The Solid per-target gate is an ESLINT gate (no tsc), so a `.showModal()`
 * type error never surfaces there. The red-first proof for Solid is therefore
 * an EMIT-LEVEL assertion: a ref on a native `<dialog>` must declare the ref
 * variable typed `HTMLDialogElement | null` (the dialog carve-out), while a ref
 * on a non-dialog element keeps the byte-identical `HTMLElement | null` default.
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

describe('Solid — <dialog> ref-type carve-out (LB6 SEAM 1)', () => {
  it('a ref on <dialog> declares HTMLDialogElement | null', () => {
    const result = compile(DIALOG_SRC, {
      target: 'solid',
      filename: 'DialogRef.rozie',
      sourceMap: false,
    });
    expect(result.code).toContain('let dlgRef: HTMLDialogElement | null = null;');
  });

  it('a ref on a non-dialog element keeps the HTMLElement | null default (byte-identical)', () => {
    const result = compile(DIV_SRC, {
      target: 'solid',
      filename: 'DivRef.rozie',
      sourceMap: false,
    });
    expect(result.code).toContain('let boxRef: HTMLElement | null = null;');
  });
});
