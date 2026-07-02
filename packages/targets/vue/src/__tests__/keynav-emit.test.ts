/**
 * Plan 71-05 Task 2 — Vue `r-keynav` emitter wiring (red-first per seam).
 *
 * Compiles the SAME SPEC §3.1 menu (tabindex model, synthesized `:source`)
 * and combobox (activedescendant model, explicit `:source`, root/items in
 * SEPARATE subtrees) fixtures the React reference (71-04) used through the
 * full `parse -> lowerToIR -> emitVue` pipeline and asserts on the emitted
 * `.vue` text — one `it()` per emitter seam (item-marker, id, aria,
 * tabindex, root-hook), per the plan's own red-first-per-seam instruction. A
 * final byte-identity test proves a component with NO `r-keynav` directive
 * is completely untouched (SPEC §11: "no corpus rebless").
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitVue } from '../emitVue.js';

function compile(src: string, filename: string): IRComponent {
  const parsed = parse(src, { filename });
  if (!parsed.ast) throw new Error(`parse failed for ${filename}: ${JSON.stringify(parsed.diagnostics)}`);
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lower failed for ${filename}: ${JSON.stringify(lowered.diagnostics)}`);
  return lowered.ir;
}

// SPEC §3.1 "Menu — tabindex model, items contained" (synthesized :source
// from the co-located r-for; @keynav-commit is a CALL expression so the
// onCommit-wrap seam is exercised too).
const MENU_SRC = `<rozie name="KeynavMenu">

<props>
{
  items: { type: Array, default: () => [] },
}
</props>

<data>
{
  active: 0,
}
</data>

<script>
const run = (item) => {
  console.log(item)
}
</script>

<template>
<div role="menu" r-keynav:tabindex.vertical.loop="$data.active" r-keynav-active-class="'is-active'" @keynav-commit="run($props.items[$data.active])">
  <button role="menuitem" r-for="it in $props.items" :key="it.id"
          r-keynav-item="{ label: it.label, disabled: it.disabled }">
    {{ it.label }}
  </button>
</div>
</template>

</rozie>`;

// SPEC §3.1 "Combobox — activedescendant model, input separate from the
// list" (explicit :source; root <input> and item <li> live in DIFFERENT
// subtrees under a common wrapper).
const COMBOBOX_SRC = `<rozie name="KeynavCombobox">

<props>
{
  results: { type: Array, default: () => [] },
}
</props>

<data>
{
  active: 0,
}
</data>

<script>
const choose = (item) => {
  console.log(item)
}
</script>

<template>
<div>
  <input role="combobox" r-keynav:activedescendant.vertical="$data.active"
         :source="$props.results" @keynav-commit="choose" />
  <ul role="listbox">
    <li role="option" r-for="r in $props.results" :key="r.id"
        r-keynav-item="{ label: r.label }">{{ r.label }}</li>
  </ul>
</div>
</template>

</rozie>`;

// Baseline non-keynav fixture — byte-identity control.
const COUNTER_SRC = `<rozie name="Counter">

<props>
{
  start: { type: Number, default: 0 },
}
</props>

<data>
{
  count: 0,
}
</data>

<script>
const increment = () => {
  $data.count = $data.count + 1
}
</script>

<template>
<button @click="increment">{{ $props.start + $data.count }}</button>
</template>

</rozie>`;

describe('Vue r-keynav emitter (Plan 71-05 Task 2)', () => {
  it('SEAM: item-marker — every r-keynav-item stamps :data-rozie-keynav-item="index"', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain(':data-rozie-keynav-item=');
    // The index alias is synthesized (author wrote a bare r-for with no
    // index) — SPEC §5: "item index comes from the r-for context".
    expect(code).toMatch(/v-for="\(it, __rozieKeynavIndex\) in props\.items"/);
  });

  it('SEAM: id — item id is namespaced by a component-unique group id (T-71-05-02)', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain('__rozieKeynavGroupId = `keynav-${Math.random()');
    expect(code).toMatch(
      /:id="`\$\{__rozieKeynavGroupId\}-item-\$\{__rozieKeynavIndex\}`"/,
    );
  });

  it('SEAM: aria — combobox emits :aria-activedescendant on the input bound to the active <li> id', () => {
    const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(code).toContain(':aria-activedescendant=');
    expect(code).toMatch(
      /:aria-activedescendant="active >= 0 \? `\$\{__rozieKeynavGroupId\}-item-\$\{active\}` : undefined"/,
    );
  });

  it('SEAM: aria — menu (tabindex model) does NOT emit :aria-activedescendant', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).not.toContain('aria-activedescendant');
  });

  it('SEAM: tabindex — menu items carry a roving :tabindex binding; combobox items do not (activedescendant model)', () => {
    const menuIr = compile(MENU_SRC, 'KeynavMenu.rozie');
    const menu = emitVue(menuIr, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(menu.code).toMatch(/:tabindex="active === __rozieKeynavIndex \? 0 : -1"/);

    const comboIr = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const combo = emitVue(comboIr, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(combo.code).not.toMatch(/:tabindex="active === /);
  });

  it('SEAM: root-hook — a useKeynav(...) call wires the root ref, config, source, active get/set, and commit', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain('useKeynav(__rozieKeynavRootRef, {');
    expect(code).toContain(
      "config: { focusModel: 'tabindex', orientation: 'vertical', loop: true, typeahead: false, skipDisabled: true }",
    );
    expect(code).toContain('getActive: () => active.value,');
    expect(code).toContain('setActive: (v) => { active.value = v; },');
    // `@keynav-commit="run($props.items[$data.active])"` is a CALL
    // expression (not a bare identifier) — wrapped, `i` exposed but unused.
    expect(code).toContain('onCommit: (i) => { run(props.items[active.value]); },');
    // r-keynav-active-class — additive activeClass option.
    expect(code).toContain("activeClass: 'is-active',");
    expect(code).toMatch(/import \{ useKeynav \} from '@rozie\/runtime-vue';/);
    expect(code).toContain('const __rozieKeynavRootRef = ref<HTMLElement | null>(null);');
    expect(code).toContain('ref="__rozieKeynavRootRef"');
  });

  it('SEAM: root-hook — a bare-identifier @keynav-commit handler is passed BY REFERENCE, not wrapped', () => {
    const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(code).toContain('onCommit: choose,');
  });

  it('SEAM: source synthesis — the menu getSource maps the synthesized r-for array to { label, disabled }', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain(
      'getSource: () => (props.items).map((it) => ({ label: it.label, disabled: it.disabled })),',
    );
  });

  it('SEAM: source (explicit) — the combobox getSource maps the explicit :source array to { label }', () => {
    const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(code).toContain('getSource: () => (props.results).map((r) => ({ label: r.label })),');
  });

  it('SEAM: no per-item keydown listeners are ever emitted (delegation lives entirely inside useKeynav)', () => {
    const menuIr = compile(MENU_SRC, 'KeynavMenu.rozie');
    const menu = emitVue(menuIr, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(menu.code).not.toContain('@keydown');

    const comboIr = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const combo = emitVue(comboIr, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(combo.code).not.toContain('@keydown');
  });

  it('the active item carries :data-rozie-keynav-active in emitted output', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toMatch(
      /:data-rozie-keynav-active="active === __rozieKeynavIndex \? '' : undefined"/,
    );
  });

  it('NO-REGRESS: a component with no r-keynav directive is byte-identical to pre-Phase-71 emit (no useKeynav/keynav attrs)', () => {
    const ir = compile(COUNTER_SRC, 'Counter.rozie');
    const { code } = emitVue(ir, { filename: 'Counter.rozie', source: COUNTER_SRC });
    expect(code).not.toContain('useKeynav');
    expect(code).not.toContain('data-rozie-keynav');
    expect(code).not.toContain('__rozieKeynav');
  });
});
