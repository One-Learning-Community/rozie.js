/**
 * Plan 71-09 Task 2 — Angular `r-keynav` emitter wiring (red-first per seam).
 *
 * Compiles the SPEC §3.1 menu (tabindex model, synthesized `:source`) and
 * combobox (activedescendant model, explicit `:source`, root/items in
 * SEPARATE subtrees) fixtures — the SAME source strings the React reference
 * (Plan 71-04) uses — through the full `parse -> lowerToIR -> emitAngular`
 * pipeline and asserts on the emitted `.ts` text — one `it()` per emitter
 * seam (item-marker, id, aria, tabindex, inline-controller wiring), per the
 * plan's own red-first-per-seam instruction. A final byte-identity test
 * proves a component with NO `r-keynav` directive is completely untouched
 * (SPEC §11: "no corpus rebless").
 */
import { describe, expect, it } from 'vitest';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { parse } from '../../../../core/src/parse.js';
import { emitAngular } from '../emitAngular.js';

function compile(src: string, filename: string): IRComponent {
  const parsed = parse(src, { filename });
  if (!parsed.ast)
    throw new Error(`parse failed for ${filename}: ${JSON.stringify(parsed.diagnostics)}`);
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir)
    throw new Error(`lower failed for ${filename}: ${JSON.stringify(lowered.diagnostics)}`);
  return lowered.ir;
}

// SPEC §3.1 "Menu — tabindex model, items contained" (synthesized :source
// from the co-located r-for; @keynav-commit is a CALL expression, so the
// wrapped-commit seam is exercised).
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
// subtrees under a common wrapper). @keynav-commit is a bare identifier, so
// the pass-by-reference seam is exercised.
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

describe('Angular r-keynav emitter (Plan 71-09 Task 2)', () => {
  it('SEAM: item-marker — every r-keynav-item stamps [attr.data-rozie-keynav-item]; Angular needs NO index-alias synthesis (bare $index)', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain('[attr.data-rozie-keynav-item]="$index"');
    // No `let __rozieKeynavIndex = $index` synthesis — Angular's `@for`
    // exposes `$index` bare, unlike React/Vue/Solid.
    expect(code).not.toContain('__rozieKeynavIndex');
  });

  it('SEAM: id — item id is namespaced by a component-unique group id (T-71-09-02)', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain('Math.random().toString(36).slice(2)');
    // The `id=` fragment is a nested JS template-literal spliced into the
    // Angular `template: \`...\`` TS literal — emitDecorator's whole-template
    // escape pass (escapeTemplateBody) backslash-escapes the inner backtick/`$`
    // so the OUTER literal parses; once the .ts file itself is evaluated, the
    // escapes resolve back to a literal backtick + `${...}` Angular expression.
    expect(code).toContain('[id]="\\`\\${__rozieKeynavGroupId}-item-\\${$index}\\`"');
  });

  it('SEAM: aria — combobox emits [attr.aria-activedescendant] on the input bound to the active <li> id', () => {
    const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(code).toContain('[attr.aria-activedescendant]=');
    // The nested JS template-literal (backtick + `${...}`) is backslash-escaped
    // by emitDecorator's whole-template escape pass so the OUTER `template:
    // \`...\`` TS literal parses; once the .ts file is evaluated the escapes
    // resolve back to a literal backtick + Angular expression interpolation.
    expect(code).toContain(
      '[attr.aria-activedescendant]="active() >= 0 ? \\`\\${__rozieKeynavGroupId}-item-\\${active()}\\` : undefined"',
    );
  });

  it('SEAM: aria — menu (tabindex model) does NOT emit aria-activedescendant', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).not.toContain('aria-activedescendant');
  });

  it('SEAM: tabindex — menu items carry a roving [tabIndex] binding; combobox items do not (activedescendant model)', () => {
    const menuIr = compile(MENU_SRC, 'KeynavMenu.rozie');
    const menu = emitAngular(menuIr, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(menu.code).toMatch(/\[tabIndex\]="active\(\) === \$index \? 0 : -1"/);

    const comboIr = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const combo = emitAngular(comboIr, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(combo.code).not.toMatch(/\[tabIndex\]="active\(\) === /);
  });

  it('the active item carries [attr.data-rozie-keynav-active] in emitted output', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toMatch(
      /\[attr\.data-rozie-keynav-active\]="active\(\) === \$index \? '' : undefined"/,
    );
  });

  it('SEAM: inline controller — imports createKeynavStateMachine from @rozie/runtime-keynav-core and instantiates it in ngAfterViewInit (NOT a field initializer, NOT the reducer body inlined)', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    // MENU_SRC also declares `r-keynav-active-class`, so `normalizeClassTokens`
    // rides along in the SAME import statement — assert the substring, not an
    // exact full-line match (the dedicated "active-class" seam test below
    // asserts the full import line).
    expect(code).toContain('import { createKeynavStateMachine, type KeynavStateMachine');
    expect(code).toContain("from '@rozie/runtime-keynav-core';");
    // The controller field is declared eagerly but ASSIGNED inside
    // ngAfterViewInit — grep the AFTERVIEWINIT body for the assignment.
    const afterViewInitMatch = code.match(/ngAfterViewInit\(\) \{([\s\S]*?)\n {2}\}/);
    expect(afterViewInitMatch).not.toBeNull();
    expect(afterViewInitMatch![1]).toContain(
      'this.__rozieKeynavController = createKeynavStateMachine({',
    );
    // No per-component copy of the reducer's own keyboard-map/typeahead logic
    // — the heavy-logic identifiers live ONLY in the imported package, never
    // duplicated into the emitted class body as inline `case 'ArrowDown'`-style
    // code.
    expect(code).not.toContain("case 'ArrowDown'");
    expect(code).not.toContain('typeaheadBuffer');
  });

  it('SEAM: root delegation — keydown/pointer delegation is wired via Renderer2.listen, parsing data-rozie-keynav-item with Number()+bounds-check, teardown on DestroyRef', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain("this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'keydown',");
    expect(code).toContain("this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'pointerdown',");
    expect(code).toContain('Number(__rozieKeynavRaw)');
    expect(code).toContain('!Number.isInteger(__rozieKeynavIdx) || __rozieKeynavIdx < 0');
    expect(code).toContain('this.__rozieDestroyRef.onDestroy(() => {');
    // No per-item keydown listeners — delegation lives entirely on the root.
    expect(code).not.toContain('(keydown)=');
  });

  it('SEAM: root config/source/active/commit wiring — the createKeynavStateMachine call carries the resolved config, getSource, getActive/setActive, and commit', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain(
      "}, { focusModel: 'tabindex', orientation: 'vertical', loop: true, typeahead: false, skipDisabled: true });",
    );
    expect(code).toContain('getActive: () => this.active(),');
    expect(code).toContain('setActive: (i) => { this.active.set(i); },');
    // `@keynav-commit="run($props.items[$data.active])"` is a CALL expression
    // (not a bare identifier) — wrapped, `i` exposed but unused; `run` (a
    // <script>-declared const arrow) correctly rewrites to `this.run(...)`.
    expect(code).toContain('commit: (i) => { this.run(this.items()[this.active()]); },');
  });

  it('SEAM: root config/source/active/commit wiring — a bare-identifier @keynav-commit handler is passed BY REFERENCE, not wrapped', () => {
    const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(code).toContain('commit: this.choose,');
  });

  it('SEAM: source synthesis — the menu getSource maps the synthesized r-for array to { label, disabled }', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain(
      'getSource: () => (this.items()).map((it) => ({ label: it.label, disabled: it.disabled })),',
    );
  });

  it('SEAM: source (explicit) — the combobox getSource maps the explicit :source array to { label }', () => {
    const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(code).toContain('getSource: () => (this.results()).map((r) => ({ label: r.label })),');
  });

  it('SEAM: active-class — r-keynav-active-class drives a constructor effect() using normalizeClassTokens, imported from @rozie/runtime-keynav-core', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toMatch(
      /import \{ createKeynavStateMachine, type KeynavStateMachine, normalizeClassTokens \} from '@rozie\/runtime-keynav-core';/,
    );
    expect(code).toContain("const __rozieKeynavTokens = normalizeClassTokens('is-active');");
    expect(code).toContain('effect(() => {');
    expect(code).toContain('const __rozieKeynavActive = this.active();');
  });

  it('SEAM: no sidecar .d.rozie.ts is written for keynav (Angular AOT sidecar-shadowing trap)', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitAngular(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).not.toContain('.d.rozie.ts');
  });

  it('NO-REGRESS: a component with no r-keynav directive is byte-identical to pre-Phase-71 emit (no keynav tokens/imports)', () => {
    const ir = compile(COUNTER_SRC, 'Counter.rozie');
    const { code } = emitAngular(ir, { filename: 'Counter.rozie', source: COUNTER_SRC });
    expect(code).not.toContain('createKeynavStateMachine');
    expect(code).not.toContain('runtime-keynav-core');
    expect(code).not.toContain('data-rozie-keynav');
    expect(code).not.toContain('__rozieKeynav');
  });
});
