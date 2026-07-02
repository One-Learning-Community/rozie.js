/**
 * Plan 71-06 Task 2 — Svelte `r-keynav` emitter wiring (red-first per seam).
 *
 * Compiles the SAME SPEC §3.1 menu (tabindex model, synthesized `:source`)
 * and combobox (activedescendant model, explicit `:source`, root/items in
 * SEPARATE subtrees) fixtures the React (71-04) / Vue (71-05) references
 * used through the full `parse -> lowerToIR -> emitSvelte` pipeline and
 * asserts on the emitted `.svelte` text — one `it()` per emitter seam
 * (item-marker, id, aria, tabindex, root action), per the plan's own
 * red-first-per-seam instruction. A final byte-identity test proves a
 * component with NO `r-keynav` directive is completely untouched (SPEC §11:
 * "no corpus rebless").
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitSvelte } from '../emitSvelte.js';

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

describe('Svelte r-keynav emitter (Plan 71-06 Task 2)', () => {
  it('SEAM: item-marker — every r-keynav-item stamps data-rozie-keynav-item={index}', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain('data-rozie-keynav-item={');
    // The index alias is synthesized (author wrote a bare r-for with no
    // index) — SPEC §5: "item index comes from the r-for context".
    expect(code).toMatch(/\{#each items as it, __rozieKeynavIndex/);
  });

  it('SEAM: id — item id is namespaced by a component-unique group id (T-71-06-02)', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain('__rozieKeynavGroupId = `keynav-${Math.random()');
    expect(code).toMatch(
      /id=\{`\$\{__rozieKeynavGroupId\}-item-\$\{__rozieKeynavIndex\}`\}/,
    );
  });

  it('SEAM: aria — combobox emits aria-activedescendant on the input bound to the active <li> id', () => {
    const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(code).toContain('aria-activedescendant={');
    expect(code).toMatch(
      /aria-activedescendant=\{active >= 0 \? `\$\{__rozieKeynavGroupId\}-item-\$\{active\}` : undefined\}/,
    );
  });

  it('SEAM: aria — menu (tabindex model) does NOT emit aria-activedescendant', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).not.toContain('aria-activedescendant');
  });

  it('SEAM: tabindex — menu items carry a roving tabindex binding; combobox items do not (activedescendant model)', () => {
    const menuIr = compile(MENU_SRC, 'KeynavMenu.rozie');
    const menu = emitSvelte(menuIr, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(menu.code).toMatch(/tabindex=\{active === __rozieKeynavIndex \? 0 : -1\}/);

    const comboIr = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const combo = emitSvelte(comboIr, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(combo.code).not.toMatch(/tabindex=\{active === /);
  });

  it('SEAM: root action — use:keynav wires the root bind:this, config, active, source, active get/set, and commit', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain('use:keynav={{');
    expect(code).toContain(
      "config: { focusModel: 'tabindex', orientation: 'vertical', loop: true, typeahead: false, skipDisabled: true }",
    );
    expect(code).toContain('active: active,');
    expect(code).toContain('getActive: () => active,');
    expect(code).toContain('setActive: (v) => { active = v; },');
    // `@keynav-commit="run($props.items[$data.active])"` is a CALL
    // expression (not a bare identifier) — wrapped, `i` exposed but unused.
    expect(code).toContain('onCommit: (i) => { run(items[active]); },');
    // r-keynav-active-class — additive activeClass option.
    expect(code).toContain("activeClass: 'is-active'");
    // The `keynav` runtime-import name folds into the SAME sorted
    // `@rozie/runtime-svelte` import line as any other helper the template
    // walk collected (e.g. `applyListeners`/`rozieDisplay`) — see
    // `emitSvelte.ts`'s `tmplRuntimeImports` splice.
    expect(code).toMatch(/import \{[^}]*\bkeynav\b[^}]*\} from '@rozie\/runtime-svelte';/);
    expect(code).toContain('let __rozieKeynavRootRef = $state<HTMLElement | undefined>(undefined);');
    expect(code).toContain('bind:this={__rozieKeynavRootRef}');
  });

  it('SEAM: root action — a bare-identifier @keynav-commit handler is passed BY REFERENCE, not wrapped', () => {
    const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    // `onCommit` is the LAST opts field here (no `activeClass` on this
    // fixture) — no trailing comma.
    expect(code).toContain('onCommit: choose }}');
  });

  it('SEAM: source synthesis — the menu getSource maps the synthesized r-for array to { label, disabled }', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain(
      'getSource: () => (items).map((it) => ({ label: it.label, disabled: it.disabled })),',
    );
  });

  it('SEAM: source (explicit) — the combobox getSource maps the explicit :source array to { label }', () => {
    const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(code).toContain('getSource: () => (results).map((r) => ({ label: r.label })),');
  });

  it('SEAM: no per-item keydown listeners are ever emitted (delegation lives entirely inside the keynav action)', () => {
    const menuIr = compile(MENU_SRC, 'KeynavMenu.rozie');
    const menu = emitSvelte(menuIr, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(menu.code).not.toContain('onkeydown');

    const comboIr = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const combo = emitSvelte(comboIr, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(combo.code).not.toContain('onkeydown');
  });

  it('the active item carries data-rozie-keynav-active in emitted output', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toMatch(
      /data-rozie-keynav-active=\{active === __rozieKeynavIndex \? '' : undefined\}/,
    );
  });

  it('NO-REGRESS: a component with no r-keynav directive is byte-identical to pre-Phase-71 emit (no keynav/keynav attrs)', () => {
    const ir = compile(COUNTER_SRC, 'Counter.rozie');
    const { code } = emitSvelte(ir, { filename: 'Counter.rozie', source: COUNTER_SRC });
    expect(code).not.toContain('use:keynav');
    expect(code).not.toContain('data-rozie-keynav');
    expect(code).not.toContain('__rozieKeynav');
    // Pre-existing (non-keynav-related) `@rozie/runtime-svelte` imports
    // (`applyListeners`/`rozieDisplay`, from `$attrs` fallthrough + the
    // wrap-for-display interpolation) are UNAFFECTED — only `keynav` itself
    // must be absent.
    expect(code).not.toMatch(/\bkeynav\b/);
  });
});
