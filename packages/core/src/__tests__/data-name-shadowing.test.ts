/**
 * A name that shadows a `<data>` key.
 *
 *  - Svelte: a script parameter named like a `$data` key captured the rewrite
 *    (`(open) => { $data.open = open }` became `open = open`). The parameter is
 *    renamed `open$local`, as on Vue.
 *  - Every target: an r-for alias named like a `$data` key or a prop cannot be
 *    told apart from it inside the loop — ROZ161.
 */
import { describe, expect, it } from 'vitest';
import { compile } from '../compile.js';

describe('script parameter shadowing a $data key', () => {
  const SRC = `<rozie name="Shadow">
<data>{ open: false, count: 0 }</data>
<script>
const setOpen = (open) => { $data.open = open; $data.count = $data.count + 1 }
const each = (list) => list.forEach((count) => { $data.count = count })
</script>
<template><div @click="setOpen(!$data.open)">{{ $data.open }} {{ $data.count }}</div></template>
</rozie>`;

  it('svelte renames the parameter, not the state', () => {
    const code = compile(SRC, { target: 'svelte', filename: 'Shadow.rozie' }).code;
    expect(code).toContain('const setOpen = (open$local: any) => {\n  open = open$local;');
    expect(code).toContain('list.forEach((count$local: any) => {\n  count = count$local;');
  });
});

describe('ROZ161 r-for alias named like state', () => {
  const src = (alias: string) => `<rozie name="Alias">
<props>{ label: { type: String, default: '' } }</props>
<data>{ open: false, items: [1, 2] }</data>
<template><div><b r-for="${alias} in $data.items" :key="String(${alias})">{{ ${alias} }}</b></div></template>
</rozie>`;
  const codes = (alias: string) =>
    compile(src(alias), { target: 'vue', filename: 'Alias.rozie' }).diagnostics.map((d) => d.code);

  it('errors for a <data> key and for a prop', () => {
    expect(codes('open')).toContain('ROZ161');
    expect(codes('label')).toContain('ROZ161');
  });

  it('accepts any other alias', () => {
    expect(codes('item')).not.toContain('ROZ161');
  });
});
