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

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitVue } from '../emitVue.js';

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
    expect(code).toMatch(/:id="`\$\{__rozieKeynavGroupId\}-item-\$\{__rozieKeynavIndex\}`"/);
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

describe('Vue r-keynav emitter — multi-root, grid, page, explicit index (Plan 77-04 Task 1)', () => {
  it('multi-root: two r-keynav roots emit TWO independent useKeynav(...) controller calls', () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
    const callCount = (code.match(/useKeynav\(/g) ?? []).length;
    expect(callCount).toBe(2);
  });

  it('multi-root: each root gets its own suffixed root-ref/group-id identifiers', () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
    expect(code).toContain('useKeynav(__rozieKeynavRootRef, {');
    expect(code).toContain('useKeynav(__rozieKeynavRootRef1, {');
    expect(code).toContain('const __rozieKeynavRootRef = ref<HTMLElement | null>(null);');
    expect(code).toContain('const __rozieKeynavRootRef1 = ref<HTMLElement | null>(null);');
    expect(code).toContain('__rozieKeynavGroupId = `keynav-${Math.random()');
    expect(code).toContain('__rozieKeynavGroupId1 = `keynav-${Math.random()');
  });

  it('multi-root: each root carries its OWN active-index get/set binding', () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
    expect(code).toContain('getActive: () => rowActive.value,');
    expect(code).toContain('setActive: (v) => { rowActive.value = v; },');
    expect(code).toContain('getActive: () => cellActive.value,');
    expect(code).toContain('setActive: (v) => { cellActive.value = v; },');
  });

  it("multi-root: each item's four attributes are keyed to ITS OWN root's group id and active binding", () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
    // Group 0 (rows) — bare group-id/active identifiers.
    expect(code).toMatch(/:id="`\$\{__rozieKeynavGroupId\}-item-\$\{__rozieKeynavIndex\}`"/);
    expect(code).toMatch(/:data-rozie-keynav-active="rowActive === __rozieKeynavIndex/);
    // Group 1 (cells) — suffixed group-id/active identifiers, and a
    // suffixed loop index alias (the compiler-synthesized index is scoped
    // per-loop, so the SECOND loop gets its own alias name).
    expect(code).toMatch(/:id="`\$\{__rozieKeynavGroupId1\}-item-\$\{__rozieKeynavIndex\d*\}`"/);
    expect(code).toMatch(/:data-rozie-keynav-active="cellActive === __rozieKeynavIndex\d*/);
  });

  it('grid: the config literal is UNCHANGED (no grid key) — the columns getter is a SIBLING gridColumns option', () => {
    const ir = compile(GRID_PAGE_SRC, 'KeynavGridPage.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavGridPage.rozie', source: GRID_PAGE_SRC });
    expect(code).toContain(
      "config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },",
    );
    expect(code).not.toMatch(/config:\s*\{[^}]*grid/);
    expect(code).toContain('gridColumns: () => cols.value,');
  });

  it('page: @keynav-page routes into the onPage controller option and never appears as a template attribute', () => {
    const ir = compile(GRID_PAGE_SRC, 'KeynavGridPage.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavGridPage.rozie', source: GRID_PAGE_SRC });
    // Bare-identifier handler — passed BY REFERENCE (mirrors onCommit's convention).
    expect(code).toContain('onPage: onBoundary,');
    expect(code).not.toContain('@keynav-page');
  });

  it('page: an arbitrary @keynav-page expression is wrapped in a (detail) => { ...; } arrow', () => {
    const src = GRID_PAGE_SRC.replace(
      '@keynav-page="onBoundary"',
      '@keynav-page="onBoundary($props.cells)"',
    );
    const ir = compile(src, 'KeynavGridPage.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavGridPage.rozie', source: src });
    expect(code).toContain('onPage: (detail) => { onBoundary(props.cells); },');
  });

  it('grid: a root with no .grid() modifier omits the gridColumns option entirely', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).not.toContain('gridColumns');
  });

  it("explicit item index: an item's own index expression overrides a NESTED inner loop's index alias in all four attributes", () => {
    const ir = compile(EXPLICIT_INDEX_SRC, 'KeynavExplicitIndex.rozie');
    const { code } = emitVue(ir, {
      filename: 'KeynavExplicitIndex.rozie',
      source: EXPLICIT_INDEX_SRC,
    });
    expect(code).toMatch(/:id="`\$\{__rozieKeynavGroupId\}-item-\$\{w \* 7 \+ d\}`"/);
    expect(code).toMatch(/:data-rozie-keynav-item="w \* 7 \+ d"/);
    expect(code).toMatch(/:data-rozie-keynav-active="active === w \* 7 \+ d \? '' : undefined"/);
    expect(code).toMatch(/:tabindex="active === w \* 7 \+ d \? 0 : -1"/);
  });

  it('BYTE-IDENTITY: the Phase-71 menu fixture emits character-for-character the same output as before this plan', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toBe(
      '<template>\n\n' +
        '<div role="menu" v-bind="$attrs" ref="__rozieKeynavRootRef">\n' +
        '  <button v-for="(it, __rozieKeynavIndex) in props.items" :key="it.id" role="menuitem" :id="`${__rozieKeynavGroupId}-item-${__rozieKeynavIndex}`" :data-rozie-keynav-item="__rozieKeynavIndex" :data-rozie-keynav-active="active === __rozieKeynavIndex ? \'\' : undefined" :tabindex="active === __rozieKeynavIndex ? 0 : -1">\n' +
        '    {{ it.label }}\n' +
        '  </button>\n' +
        '</div>\n\n' +
        '</template>\n\n' +
        '<script setup lang="ts">\n' +
        "import { ref } from 'vue';\n" +
        "import { useKeynav } from '@rozie/runtime-vue';\n\n" +
        'const props = withDefaults(\n' +
        '  defineProps<{ items?: any[] }>(),\n' +
        '  { items: () => [] }\n' +
        ');\n\n' +
        'const active = ref(0);\n\n' +
        'const run = (item: any) => {\n' +
        '  console.log(item);\n' +
        '};\n\n' +
        'const __rozieKeynavRootRef = ref<HTMLElement | null>(null);\n' +
        'const __rozieKeynavGroupId = `keynav-${Math.random().toString(36).slice(2)}`;\n' +
        'useKeynav(__rozieKeynavRootRef, {\n' +
        "  config: { focusModel: 'tabindex', orientation: 'vertical', loop: true, typeahead: false, skipDisabled: true },\n" +
        '  getSource: () => (props.items).map((it) => ({ label: it.label, disabled: it.disabled })),\n' +
        '  getActive: () => active.value,\n' +
        '  setActive: (v) => { active.value = v; },\n' +
        '  onCommit: (i) => { run(props.items[active.value]); },\n' +
        "  activeClass: 'is-active',\n" +
        '  getFocusScope: () => [__rozieKeynavRootRef.value],\n' +
        '});\n' +
        '</script>\n',
    );
  });
});

// ---------------------------------------------------------------------------
// Plan 260806-lz7 Task 1 Step 8 — the strict-containment focus scope. Fresh
// fixtures kept SEPARATE from the fixtures above so the existing byte-exact
// snapshot test only had to absorb the ONE expected `getFocusScope` line
// (already reconciled above), not a second unrelated shape change.
// ---------------------------------------------------------------------------

const SCOPE_ROOT_ONLY_SRC = MENU_SRC;

const SCOPE_WITH_HEADING_SRC = `<rozie name="KeynavWithHeading">

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

<template>
<button type="button">Heading</button>
<ul role="menu" r-keynav:tabindex="$data.active">
  <li role="menuitem" r-for="it in $props.items" :key="it.id"
      r-keynav-item="{ label: it.label }">{{ it.label }}</li>
</ul>
</template>

</rozie>`;

const SCOPE_WITH_AUTHOR_REF_SRC = `<rozie name="KeynavWithAuthorRef">

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
</script>

<template>
<button type="button" ref="heading">Heading</button>
<ul role="menu" r-keynav:tabindex="$data.active">
  <li role="menuitem" r-for="it in $props.items" :key="it.id"
      r-keynav-item="{ label: it.label }">{{ it.label }}</li>
</ul>
</template>

</rozie>`;

describe('Vue r-keynav emitter — strict-containment focus scope (Plan 260806-lz7 Task 1 Step 8)', () => {
  it('single top-level root: getFocusScope reuses the ROOT ref — no fresh ref minted', () => {
    const ir = compile(SCOPE_ROOT_ONLY_SRC, 'KeynavMenu.rozie');
    const { code } = emitVue(ir, { filename: 'KeynavMenu.rozie', source: SCOPE_ROOT_ONLY_SRC });
    expect(code).toContain('getFocusScope: () => [__rozieKeynavRootRef.value],');
    expect(code).not.toContain('__rozieKeynavScopeRef');
  });

  it('a persistent sibling top-level element gets a FRESH minted ref, stamped on the element and read by getFocusScope', () => {
    const ir = compile(SCOPE_WITH_HEADING_SRC, 'KeynavWithHeading.rozie');
    const { code } = emitVue(ir, {
      filename: 'KeynavWithHeading.rozie',
      source: SCOPE_WITH_HEADING_SRC,
    });
    expect(code).toContain('const __rozieKeynavScopeRef0 = ref<HTMLElement | null>(null);');
    expect(code).toMatch(/<button type="button" ref="__rozieKeynavScopeRef0">/);
    expect(code).toContain(
      'getFocusScope: () => [__rozieKeynavScopeRef0.value, __rozieKeynavRootRef.value],',
    );
  });

  it('an author-declared ref on a top-level sibling is REUSED, not shadowed by a second minted ref', () => {
    const ir = compile(SCOPE_WITH_AUTHOR_REF_SRC, 'KeynavWithAuthorRef.rozie');
    const { code } = emitVue(ir, {
      filename: 'KeynavWithAuthorRef.rozie',
      source: SCOPE_WITH_AUTHOR_REF_SRC,
    });
    expect(code).not.toContain('__rozieKeynavScopeRef');
    expect(code).toContain('getFocusScope: () => [headingRef.value, __rozieKeynavRootRef.value],');
  });

  it('NO-REGRESS: a component with no r-keynav directive never mints a scope ref', () => {
    const ir = compile(COUNTER_SRC, 'Counter.rozie');
    const { code } = emitVue(ir, { filename: 'Counter.rozie', source: COUNTER_SRC });
    expect(code).not.toContain('getFocusScope');
    expect(code).not.toContain('__rozieKeynavScopeRef');
  });
});
