/**
 * A two-way (`model: true`) prop follows the controlled rule of the React /
 * Solid / Lit targets on Vue and Angular too: while the consumer binds a value,
 * a write by the component only notifies the consumer, so a consumer that
 * refuses the change keeps the control on its own value.
 *
 *  - Vue: `defineModel` updated its local value whenever no `onUpdate:x`
 *    listener was bound (a one-way `:x`), showing the refused value.
 *  - Angular: `model().set()` always updated the local value, and a bound value
 *    is pushed down only when it differs from the last one pushed, so a refused
 *    write stayed on screen (one-way, and two-way with the old value written back).
 */
import { describe, expect, it } from 'vitest';
import { compile } from '../compile.js';

const SRC = `<rozie name="M">
<props>{ value: { type: String, default: 'a', model: true } }</props>
<script>
const pick = (v) => { $model.value = v }
</script>
<template><div @click="pick('b')">{{ $props.value }}</div></template>
</rozie>`;

describe('two-way prop, controlled while bound', () => {
  it('vue: writes emit update:value while bound, and go to defineModel otherwise', () => {
    const code = compile(SRC, { target: 'vue', filename: 'M.rozie' }).code;
    expect(code).toContain("const __rozieModel_value = defineModel<string>('value', { default: 'a' });");
    expect(code).toContain(
      "set: (v) => { if (__rozieBound('value')) __rozieVm.emit('update:value', v); else __rozieModel_value.value = v; },",
    );
    expect(code).toContain('value.value = v');
  });

  it('angular: an aliased input + valueChange output read through rozieModel', () => {
    const code = compile(SRC, { target: 'angular', filename: 'M.rozie' }).code;
    expect(code).toContain("readonly __rozieModelIn_value = input<string | undefined>(undefined, { alias: 'value' });");
    expect(code).toContain('valueChange = output<string>();');
    expect(code).toContain("value = rozieModel<string, import('@angular/core').ModelSignal<string>>(this.__rozieModelIn_value, this.valueChange, 'a');");
    expect(code).toMatch(/import \{[^}]*\brozieModel\b[^}]*\} from '@rozie\/runtime-angular'/);
    expect(code).not.toMatch(/\bmodel</);
  });
});

describe('vue: one `vue` import line', () => {
  it('a template-hoisted `computed` joins the script import instead of redeclaring it', () => {
    // r-portal hoists `computed` from the template; the two-way prop brings it into the script.
    const src = `<rozie name="Hoist">
<props>{ open: { type: Boolean, default: false, model: true } }</props>
<template><div><div r-portal="'body'" r-if="$props.open">x</div></div></template>
</rozie>`;
    const code = compile(src, { target: 'vue', filename: 'Hoist.rozie' }).code;
    expect(code).toContain('__roziePortalTo');
    expect(code.match(/^import \{[^}]*\} from 'vue';$/gm)).toHaveLength(1);
  });
});
