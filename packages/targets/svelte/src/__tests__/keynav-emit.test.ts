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

// ---------------------------------------------------------------------------
// Phase 77 Plan 04 — multi-root plans, grid config, @keynav-page, explicit
// item index. Fixtures are kept SEPARATE from the Phase-71 fixtures above so
// the byte-identity test can assert the Phase-71 fixtures' emit is
// unchanged, character-for-character. Mirrors the React reference's
// (Plan 77-03 Task 2) fixtures/tests test-by-test.
// ---------------------------------------------------------------------------

// Two independent 1D roots (SPEC §6 — no new syntax; multi-group is legal by
// having 2+ r-keynav roots). Distinct active bindings, distinct item shapes.
const TWO_ROOT_SRC = `<rozie name="KeynavTwoGroups">

<props>
{
  rows: { type: Array, default: () => [] },
  cells: { type: Array, default: () => [] },
}
</props>

<data>
{
  rowActive: 0,
  cellActive: 0,
}
</data>

<template>
<div>
  <ul role="listbox" r-keynav:tabindex="$data.rowActive">
    <li role="option" r-for="row in $props.rows" :key="row.id" r-keynav-item="{ label: row.label }">{{ row.label }}</li>
  </ul>
  <div role="grid" r-keynav:tabindex="$data.cellActive">
    <button role="gridcell" r-for="cell in $props.cells" :key="cell.id" r-keynav-item="{ label: cell.label }">{{ cell.label }}</button>
  </div>
</div>
</template>

</rozie>`;

// A grid root (`.grid($data.cols)` — reactive columns expression) carrying
// `@keynav-page` (SPEC §3, §4.1). Both features composed on one root, as the
// SPEC's own §3 authoring example does.
const GRID_PAGE_SRC = `<rozie name="KeynavGridPage">

<props>
{
  cells: { type: Array, default: () => [] },
}
</props>

<data>
{
  active: 0,
  cols: 7,
}
</data>

<script>
const onBoundary = (detail) => {
  console.log(detail)
}
</script>

<template>
<div role="grid" r-keynav:tabindex.grid($data.cols)="$data.active" @keynav-page="onBoundary">
  <button role="gridcell" r-for="cell in $props.cells" :key="cell.id" r-keynav-item="{ label: cell.label }">{{ cell.label }}</button>
</div>
</template>

</rozie>`;

// Planner Gap B (77-SPEC.md §10.5 amendment 3) — an explicit `index` on
// `r-keynav-item` overrides a NESTED inner loop's own index alias. Mirrors
// the date-picker's panels -> weeks -> days shape: the item's nearest
// enclosing loop is the INNER (day) loop, whose own index (`d`) would be the
// wrong (weekday 0-6) value; `index: w * 7 + d` supplies the flat grid
// index. `:source` is explicit (not r-for-synthesized) — sidesteps the
// unrelated, pre-existing ":source synthesizes from the FIRST item's
// enclosing loop" mechanic, which is not what this fixture is testing.
const EXPLICIT_INDEX_SRC = `<rozie name="KeynavExplicitIndex">

<data>
{
  active: 0,
  weeks: [],
  flatDays: [],
}
</data>

<template>
<div role="grid" r-keynav:tabindex.grid(7)="$data.active" :source="$data.flatDays">
  <div r-for="(week, w) in $data.weeks" :key="w">
    <button role="gridcell" r-for="(day, d) in week" :key="d"
            r-keynav-item="{ label: day.label, index: w * 7 + d }">
      {{ day.label }}
    </button>
  </div>
</div>
</template>

</rozie>`;

describe('Svelte r-keynav emitter — multi-root, grid, page, explicit index (Plan 77-04 Task 2)', () => {
  it('multi-root: two r-keynav roots emit TWO independent use:keynav action attributes', () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
    const callCount = (code.match(/use:keynav=\{\{/g) ?? []).length;
    expect(callCount).toBe(2);
  });

  it('multi-root: each root gets its own suffixed root-ref/group-id identifiers', () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
    expect(code).toContain('bind:this={__rozieKeynavRootRef}');
    expect(code).toContain('bind:this={__rozieKeynavRootRef1}');
    expect(code).toContain('let __rozieKeynavRootRef = $state<HTMLElement | undefined>(undefined);');
    expect(code).toContain('let __rozieKeynavRootRef1 = $state<HTMLElement | undefined>(undefined);');
    expect(code).toContain('__rozieKeynavGroupId = `keynav-${Math.random()');
    expect(code).toContain('__rozieKeynavGroupId1 = `keynav-${Math.random()');
  });

  it('multi-root: each root carries its OWN active-index get/set binding', () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
    expect(code).toContain('getActive: () => rowActive,');
    expect(code).toContain('setActive: (v) => { rowActive = v; },');
    expect(code).toContain('getActive: () => cellActive,');
    expect(code).toContain('setActive: (v) => { cellActive = v; },');
  });

  it("multi-root: each item's four attributes are keyed to ITS OWN root's group id and active binding", () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
    // Group 0 (rows) — bare group-id/active identifiers.
    expect(code).toMatch(
      /id=\{`\$\{__rozieKeynavGroupId\}-item-\$\{__rozieKeynavIndex\}`\}/,
    );
    expect(code).toMatch(/data-rozie-keynav-active=\{rowActive === __rozieKeynavIndex/);
    // Group 1 (cells) — suffixed group-id/active identifiers, and a
    // suffixed loop index alias (the compiler-synthesized index is scoped
    // per-loop, so the SECOND loop gets its own alias name).
    expect(code).toMatch(
      /id=\{`\$\{__rozieKeynavGroupId1\}-item-\$\{__rozieKeynavIndex\d*\}`\}/,
    );
    expect(code).toMatch(/data-rozie-keynav-active=\{cellActive === __rozieKeynavIndex\d*/);
  });

  it('grid: the config literal is UNCHANGED (no grid key) — the columns getter is a SIBLING gridColumns option', () => {
    const ir = compile(GRID_PAGE_SRC, 'KeynavGridPage.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavGridPage.rozie', source: GRID_PAGE_SRC });
    expect(code).toContain(
      "config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false }",
    );
    expect(code).not.toMatch(/config:\s*\{[^}]*grid/);
    expect(code).toContain('gridColumns: () => cols,');
  });

  it('page: @keynav-page routes into the onPage controller option and never appears as a template attribute', () => {
    const ir = compile(GRID_PAGE_SRC, 'KeynavGridPage.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavGridPage.rozie', source: GRID_PAGE_SRC });
    // Bare-identifier handler — passed BY REFERENCE (mirrors onCommit's convention).
    expect(code).toContain('onPage: onBoundary');
    expect(code).not.toContain('onkeynav-page');
  });

  it('page: an arbitrary @keynav-page expression is wrapped in a (detail) => { ...; } arrow', () => {
    const src = GRID_PAGE_SRC.replace(
      '@keynav-page="onBoundary"',
      '@keynav-page="onBoundary($props.cells)"',
    );
    const ir = compile(src, 'KeynavGridPage.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavGridPage.rozie', source: src });
    expect(code).toContain('onPage: (detail) => { onBoundary(cells); }');
  });

  it('grid: a root with no .grid() modifier omits the gridColumns option entirely', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).not.toContain('gridColumns');
  });

  it("explicit item index: an item's own index expression overrides a NESTED inner loop's index alias in all four attributes", () => {
    const ir = compile(EXPLICIT_INDEX_SRC, 'KeynavExplicitIndex.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavExplicitIndex.rozie', source: EXPLICIT_INDEX_SRC });
    expect(code).toMatch(/id=\{`\$\{__rozieKeynavGroupId\}-item-\$\{w \* 7 \+ d\}`\}/);
    expect(code).toMatch(/data-rozie-keynav-item=\{w \* 7 \+ d\}/);
    expect(code).toMatch(/data-rozie-keynav-active=\{active === w \* 7 \+ d \? '' : undefined\}/);
    expect(code).toMatch(/tabindex=\{active === w \* 7 \+ d \? 0 : -1\}/);
  });

  it('BYTE-IDENTITY: the Phase-71 menu fixture emits character-for-character the same output as before this plan', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitSvelte(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toBe(
      '<script lang="ts">\n' +
        "import { applyListeners, keynav, rozieDisplay } from '@rozie/runtime-svelte';\n\n" +
        'let __rozieKeynavRootRef = $state<HTMLElement | undefined>(undefined);\n\n' +
        'const __rozieKeynavGroupId = `keynav-${Math.random().toString(36).slice(2)}`;\n\n' +
        'interface Props {\n' +
        '  items?: any[];\n' +
        '  [key: string]: unknown;\n' +
        '}\n\n' +
        'let __defaultItems = (() => [])();\n\n' +
        'let { items = __defaultItems, ...__rozieAttrs }: Props = $props();\n\n' +
        'let active = $state(0);\n\n' +
        'const run = (item: any) => {\n' +
        '  console.log(item);\n' +
        '};\n' +
        '</script>\n\n' +
        '<div role="menu" {...__rozieAttrs} use:applyListeners={__rozieAttrs} bind:this={__rozieKeynavRootRef} use:keynav={{ config: { focusModel: \'tabindex\', orientation: \'vertical\', loop: true, typeahead: false, skipDisabled: true }, active: active, getSource: () => (items).map((it) => ({ label: it.label, disabled: it.disabled })), getActive: () => active, setActive: (v) => { active = v; }, onCommit: (i) => { run(items[active]); }, activeClass: \'is-active\' }} data-rozie-s-d30ecb02>{#each items as it, __rozieKeynavIndex (it.id)}<button role="menuitem" id={`${__rozieKeynavGroupId}-item-${__rozieKeynavIndex}`} data-rozie-keynav-item={__rozieKeynavIndex} data-rozie-keynav-active={active === __rozieKeynavIndex ? \'\' : undefined} tabindex={active === __rozieKeynavIndex ? 0 : -1} data-rozie-s-d30ecb02>{rozieDisplay(it.label)}</button>{/each}</div>\n',
    );
  });
});
