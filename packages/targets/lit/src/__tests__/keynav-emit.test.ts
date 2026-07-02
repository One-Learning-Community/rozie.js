/**
 * Plan 71-08 Task 2 — Lit `r-keynav` emitter wiring (red-first per seam).
 *
 * Compiles the SAME SPEC §3.1 menu (tabindex model, synthesized `:source`)
 * and combobox (activedescendant model, explicit `:source`, root/items in
 * SEPARATE subtrees) fixtures the React/Vue/Svelte/Solid references
 * (71-04/05/06/07) used through the full `parse -> lowerToIR -> emitLit`
 * pipeline and asserts on the emitted `.ts` text — one `it()` per emitter
 * seam (item-marker, id, aria, tabindex, root field-decl), per the plan's
 * own red-first-per-seam instruction. A final byte-identity test proves a
 * component with NO `r-keynav` directive is completely untouched
 * (SPEC §11: "no corpus rebless").
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitLit } from '../emitLit.js';

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

function emitMenu() {
  const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
  return emitLit(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
}

function emitCombobox() {
  const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
  return emitLit(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
}

describe('Lit r-keynav emitter (Plan 71-08 Task 2)', () => {
  it('SEAM: item-marker — every r-keynav-item stamps data-rozie-keynav-item=${index}', () => {
    const { code, diagnostics } = emitMenu();
    expect(diagnostics).toEqual([]);
    expect(code).toContain('data-rozie-keynav-item=${');
    // Lit's repeat() template callback ALWAYS receives an index parameter —
    // no synthesized-alias seam to assert here (unlike React/Solid), since
    // the author's bare r-for already gets a working `_idx` for free.
    expect(code).toMatch(/repeat<any>\(this\.items, \(it, _idx\) => it\.id, \(it, _idx\) => html`/);
    expect(code).toContain('data-rozie-keynav-item=${_idx}');
  });

  it('SEAM: id — item id is namespaced by a component-unique group id (T-71-08-02)', () => {
    const { code } = emitMenu();
    expect(code).toContain(
      'private _rozieKeynavGroupId = `keynav-${Math.random().toString(36).slice(2)}`;',
    );
    expect(code).toContain(
      'id=${`${this._rozieKeynavGroupId}-item-${_idx}`}',
    );
  });

  it('SEAM: aria — combobox emits aria-activedescendant on the input bound to the active <li> id', () => {
    const { code } = emitCombobox();
    expect(code).toContain('aria-activedescendant=${rozieAttr(');
    expect(code).toContain(
      'aria-activedescendant=${rozieAttr(this._active.value >= 0 ? `${this._rozieKeynavGroupId}-item-${this._active.value}` : undefined)}',
    );
  });

  it('SEAM: aria — menu (tabindex model) does NOT emit aria-activedescendant', () => {
    const { code } = emitMenu();
    expect(code).not.toContain('aria-activedescendant');
  });

  it('SEAM: tabindex — menu items carry a roving tabindex binding; combobox items do not (activedescendant model)', () => {
    const menu = emitMenu();
    expect(menu.code).toContain(
      'tabindex=${this._active.value === _idx ? 0 : -1}',
    );

    const combo = emitCombobox();
    expect(combo.code).not.toMatch(/tabindex=\$\{this\._active\.value === /);
  });

  it('SEAM: root field-decl — a KeynavController field wires config, source, active get/set, and commit', () => {
    const { code } = emitMenu();
    expect(code).toContain(
      'private _rozieKeynavController = new KeynavController(this, {',
    );
    expect(code).toContain(
      "config: { focusModel: 'tabindex', orientation: 'vertical', loop: true, typeahead: false, skipDisabled: true },",
    );
    expect(code).toContain('getActive: () => this._active.value,');
    expect(code).toContain('setActive: (i: number) => { this._active.value = i; },');
    // `@keynav-commit="run($props.items[$data.active])"` is a CALL
    // expression (not a bare identifier) — wrapped, `i` exposed but unused.
    expect(code).toContain('onCommit: (i) => { this.run(this.items[this._active.value]); },');
    // r-keynav-active-class — additive activeClass option.
    expect(code).toContain("activeClass: 'is-active',");
    expect(code).toMatch(/import \{[^}]*\bKeynavController\b[^}]*\} from '@rozie\/runtime-lit';/);
    // NO root `ref=` is minted — Landmine 6: delegation lives entirely
    // inside the shadow root via KeynavController's own `host.renderRoot`.
    expect(code).not.toContain('data-rozie-ref="__rozieKeynav');
  });

  it('SEAM: root field-decl — a bare-identifier @keynav-commit handler is passed BY REFERENCE, not wrapped', () => {
    const { code } = emitCombobox();
    expect(code).toContain('onCommit: this.choose,');
    // Must NOT fall through to the dead-statement wrap bug this plan fixed.
    expect(code).not.toContain('onCommit: (i) => { this.choose; },');
  });

  it('SEAM: source synthesis — the menu getSource maps the synthesized r-for array to { label, disabled }', () => {
    const { code } = emitMenu();
    expect(code).toContain(
      'getSource: () => (this.items).map((it) => ({ label: it.label, disabled: it.disabled })),',
    );
  });

  it('SEAM: source (explicit) — the combobox getSource maps the explicit :source array to { label }', () => {
    const { code } = emitCombobox();
    expect(code).toContain('getSource: () => (this.results).map((r) => ({ label: r.label })),');
  });

  it('SEAM: no per-item keydown listeners are ever emitted (delegation lives entirely inside KeynavController)', () => {
    const menu = emitMenu();
    expect(menu.code).not.toContain('@keydown=');

    const combo = emitCombobox();
    expect(combo.code).not.toContain('@keydown=');
  });

  it('the active item carries the data-rozie-keynav-active boolean-attribute sigil in emitted output', () => {
    const { code } = emitMenu();
    expect(code).toContain(
      '?data-rozie-keynav-active=${this._active.value === _idx}',
    );
  });

  it('NO-REGRESS: a component with no r-keynav directive is byte-identical to pre-Phase-71 emit (no KeynavController/keynav attrs)', () => {
    const ir = compile(COUNTER_SRC, 'Counter.rozie');
    const { code } = emitLit(ir, { filename: 'Counter.rozie', source: COUNTER_SRC });
    expect(code).not.toContain('KeynavController');
    expect(code).not.toContain('data-rozie-keynav');
    expect(code).not.toContain('_rozieKeynav');
  });
});
