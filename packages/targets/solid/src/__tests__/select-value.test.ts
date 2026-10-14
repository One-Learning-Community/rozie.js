/**
 * A `<select :value>` on Solid goes through `rozieSelectValue`, which re-applies
 * the value when the options change too: Solid set `el.value` only when the
 * value changed, so options arriving after it left another option selected.
 */
import { compile } from '@rozie/core';
import { describe, expect, it } from 'vitest';

const SRC = `<rozie name="Sel">
<data>{ pick: 'c', opts: [] }</data>
<template><div><select ref="box" :value="$data.pick"><option r-for="o in $data.opts" :key="o" :value="o">{{ o }}</option></select></div></template>
</rozie>`;

describe('Solid <select :value>', () => {
  const code = compile(SRC, { target: 'solid', filename: 'Sel.rozie' }).code;
  it('binds the value through rozieSelectValue in the element ref', () => {
    expect(code).toMatch(/<select ref=\{\(el\) => \{ rozieSelectValue\(el as HTMLSelectElement, \(\) => \(pick\(\)\)\); /);
    expect(code).not.toMatch(/<select[^>]*\svalue=\{/);
  });
});
