/**
 * `$onUpdate` on Angular lowers to `ngAfterViewChecked()` — a post-render hook,
 * like React `useEffect`, Vue `onUpdated` and Lit `updated()`.
 *
 * It used to emit `effect(() => () => { … })`: Angular 19's `effect` ignores a
 * returned function, so the body never ran. Dropping the extra arrow would not
 * have been enough — an auto-tracking effect does not re-run when an array prop
 * is pushed in place, while a post-render hook runs after every check.
 */
import { compile } from '@rozie/core';
import { describe, expect, it } from 'vitest';

const SOURCE = `<rozie name="OnUpd">
<props>{ items: { type: Array, default: () => [] } }</props>
<data>{ n: 0 }</data>
<script>
$onUpdate(() => {
  console.log('updated', $props.items.length, $data.n)
})
$onUpdate(() => {
  if ($data.n > 1) return
  console.log('second')
})
</script>
<template><div>{{ $data.n }}</div></template>
</rozie>`;

describe('Angular $onUpdate lowering', () => {
  const code = compile(SOURCE, { target: 'angular', filename: 'OnUpd.rozie' }).code;

  it('emits ngAfterViewChecked, not an effect returning a function', () => {
    expect(code).not.toMatch(/effect\(\(\) => \(\) =>/);
    expect(code).toContain('ngAfterViewChecked() {');
    expect(code).toContain("console.log('updated', this.items().length, this.n());");
  });

  it('a hook that returns early does not skip the hooks after it', () => {
    const body = code.slice(code.indexOf('ngAfterViewChecked() {'));
    expect(body).toMatch(/\(\(\) => \{\s*if \(this\.n\(\) > 1\) return;/);
  });
});

describe('Angular output named like a non-composed native event', () => {
  const NAT = `<rozie name="Nat">
<props>{ value: { type: null, default: null, model: true } }</props>
<script>
const onNativeChange = ($event) => { $model.value = $event.target.value; $emit('change', { value: $event.target.value }) }
</script>
<template><div><select @change="onNativeChange($event)"><option value="0">a</option></select></div></template>
</rozie>`;
  const code = compile(NAT, { target: 'angular', filename: 'Nat.rozie' }).code;

  it('stops the native event at the host so a consumer (change) fires once', () => {
    expect(code).toContain("['change'].map((type) => renderer.listen(host, type, (e: Event) => { if (e.target !== host) e.stopImmediatePropagation(); })");
  });

  it('adds no guard for an output that is not such an event', () => {
    const other = compile(NAT.replace("$emit('change'", "$emit('pick'"), { target: 'angular', filename: 'Nat.rozie' }).code;
    expect(other).not.toContain('__rozieNativeEventGuard');
  });
});
