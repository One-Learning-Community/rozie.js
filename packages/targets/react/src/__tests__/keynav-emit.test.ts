/**
 * Plan 71-04 Task 2 — React `r-keynav` emitter wiring (red-first per seam).
 *
 * Compiles the SPEC §3.1 menu (tabindex model, synthesized `:source`) and
 * combobox (activedescendant model, explicit `:source`, root/items in
 * SEPARATE subtrees) fixtures through the full `parse -> lowerToIR ->
 * emitReact` pipeline and asserts on the emitted `.tsx` text — one `it()`
 * per emitter seam (item-marker, id, aria, tabindex, root-hook), per the
 * plan's own red-first-per-seam instruction. A final byte-identity test
 * proves a component with NO `r-keynav` directive is completely untouched
 * (SPEC §11: "no corpus rebless").
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitReact } from '../emitReact.js';

function compile(src: string, filename: string): IRComponent {
  const parsed = parse(src, { filename });
  if (!parsed.ast) throw new Error(`parse failed for ${filename}: ${JSON.stringify(parsed.diagnostics)}`);
  const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lower failed for ${filename}: ${JSON.stringify(lowered.diagnostics)}`);
  return lowered.ir;
}

// SPEC §3.1 "Menu — tabindex model, items contained" (synthesized :source
// from the co-located r-for; @keynav-commit is a bare-identifier handler so
// the onCommit-passthrough seam is exercised too).
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
         :source="$props.results" @keynav-commit="choose($props.results[$data.active])" />
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

describe('React r-keynav emitter (Plan 71-04 Task 2)', () => {
  it('SEAM: item-marker — every r-keynav-item stamps data-rozie-keynav-item={index}', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain('data-rozie-keynav-item=');
    // The index alias is synthesized (author wrote a bare r-for with no
    // index) — SPEC §5: "item index comes from the r-for context".
    expect(code).toMatch(/\.map\(\(it, __rozieKeynavIndex\) =>/);
  });

  it('SEAM: id — item id is namespaced by a component-unique group id (T-71-04-02)', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain('useId()');
    expect(code).toMatch(/id=\{`\$\{__rozieKeynavGroupId\}-item-\$\{__rozieKeynavIndex\}`\}/);
  });

  it('SEAM: aria — combobox emits aria-activedescendant on the input bound to the active <li> id', () => {
    const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(code).toContain('aria-activedescendant=');
    expect(code).toMatch(/aria-activedescendant=\{active >= 0 \? `\$\{__rozieKeynavGroupId\}-item-\$\{active\}` : undefined\}/);
  });

  it('SEAM: aria — menu (tabindex model) does NOT emit aria-activedescendant', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).not.toContain('aria-activedescendant');
  });

  it('SEAM: tabindex — menu items carry a roving tabIndex binding; combobox items do not (activedescendant model)', () => {
    const menuIr = compile(MENU_SRC, 'KeynavMenu.rozie');
    const menu = emitReact(menuIr, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(menu.code).toMatch(/tabIndex=\{active === __rozieKeynavIndex \? 0 : -1\}/);

    const comboIr = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const combo = emitReact(comboIr, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(combo.code).not.toMatch(/tabIndex=\{active === /);
  });

  it('SEAM: root-hook — a useKeynav(...) call wires the root ref, config, source, active get/set, and commit', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain('useKeynav(__rozieKeynavRootRef, {');
    expect(code).toContain(
      "config: { focusModel: 'tabindex', orientation: 'vertical', loop: true, typeahead: false, skipDisabled: true }",
    );
    expect(code).toContain('getActive: () => active,');
    expect(code).toContain('setActive: setActive,');
    // `@keynav-commit="run($props.items[$data.active])"` is a CALL
    // expression (not a bare identifier) — wrapped, `i` exposed but unused.
    expect(code).toContain('onCommit: (i) => { run(props.items[active]); },');
    // r-keynav-active-class — additive activeClass option.
    expect(code).toContain("activeClass: 'is-active',");
    expect(code).toMatch(/import \{[^}]*useKeynav[^}]*\} from '@rozie\/runtime-react';/);
    expect(code).toMatch(/import \{[^}]*useId[^}]*\} from 'react';/);
    expect(code).toContain('ref={__rozieKeynavRootRef}');
  });

  it('SEAM: root-hook — a bare-identifier @keynav-commit handler is passed BY REFERENCE, not wrapped', () => {
    // Reuses the combobox fixture's `choose` handler as a bare reference by
    // authoring a second variant inline — proves the bare-identifier
    // passthrough branch (mirrors emitTemplateEvent's own convention).
    const src = COMBOBOX_SRC.replace(
      '@keynav-commit="choose($props.results[$data.active])"',
      '@keynav-commit="choose"',
    );
    const ir = compile(src, 'KeynavCombobox.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavCombobox.rozie', source: src });
    expect(code).toContain('onCommit: choose,');
  });

  it('SEAM: source synthesis — the menu getSource maps the synthesized r-for array to { label, disabled }', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toContain(
      'getSource: () => (props.items).map((it) => ({ label: it.label, disabled: it.disabled })),',
    );
  });

  it('SEAM: source (explicit) — the combobox getSource maps the explicit :source array to { label }', () => {
    const ir = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(code).toContain('getSource: () => (props.results).map((r) => ({ label: r.label })),');
  });

  it('SEAM: no per-item keydown listeners are ever emitted (delegation lives entirely inside useKeynav)', () => {
    const menuIr = compile(MENU_SRC, 'KeynavMenu.rozie');
    const menu = emitReact(menuIr, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(menu.code).not.toContain('onKeyDown');

    const comboIr = compile(COMBOBOX_SRC, 'KeynavCombobox.rozie');
    const combo = emitReact(comboIr, { filename: 'KeynavCombobox.rozie', source: COMBOBOX_SRC });
    expect(combo.code).not.toContain('onKeyDown');
  });

  it('the active item carries data-rozie-keynav-active in emitted output', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toMatch(
      /data-rozie-keynav-active=\{active === __rozieKeynavIndex \? '' : undefined\}/,
    );
  });

  it('NO-REGRESS: a component with no r-keynav directive is byte-identical to pre-Phase-71 emit (no useKeynav/useId/keynav attrs)', () => {
    const ir = compile(COUNTER_SRC, 'Counter.rozie');
    const { code } = emitReact(ir, { filename: 'Counter.rozie', source: COUNTER_SRC });
    expect(code).not.toContain('useKeynav');
    expect(code).not.toContain('useId');
    expect(code).not.toContain('data-rozie-keynav');
    expect(code).not.toContain('__rozieKeynav');
  });
});

// ---------------------------------------------------------------------------
// Phase 77 Plan 03 — multi-root plans, grid config, @keynav-page, explicit
// item index. Fixtures are kept SEPARATE from the Phase-71 fixtures above so
// the byte-identity test can assert the Phase-71 fixtures' emit is
// unchanged, character-for-character.
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

describe('React r-keynav emitter — multi-root, grid, page, explicit index (Plan 77-03 Task 2)', () => {
  it('multi-root: two r-keynav roots emit TWO independent useKeynav(...) controller calls', () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
    const callCount = (code.match(/useKeynav\(/g) ?? []).length;
    expect(callCount).toBe(2);
  });

  it('multi-root: each root gets its own suffixed root-ref/group-id identifiers', () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
    expect(code).toContain('useKeynav(__rozieKeynavRootRef, {');
    expect(code).toContain('useKeynav(__rozieKeynavRootRef1, {');
    expect(code).toContain('const __rozieKeynavGroupId = useId();');
    expect(code).toContain('const __rozieKeynavGroupId1 = useId();');
  });

  it('multi-root: each root carries its OWN active-index get/set binding', () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
    expect(code).toContain('getActive: () => rowActive,');
    expect(code).toContain('setActive: setRowActive,');
    expect(code).toContain('getActive: () => cellActive,');
    expect(code).toContain('setActive: setCellActive,');
  });

  it("multi-root: each item's four attributes are keyed to ITS OWN root's group id and active binding", () => {
    const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
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
    const { code } = emitReact(ir, { filename: 'KeynavGridPage.rozie', source: GRID_PAGE_SRC });
    expect(code).toContain(
      "config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },",
    );
    expect(code).not.toMatch(/config:\s*\{[^}]*grid/);
    expect(code).toContain('gridColumns: () => cols,');
  });

  it('page: @keynav-page routes into the onPage controller option and never appears as a JSX prop', () => {
    const ir = compile(GRID_PAGE_SRC, 'KeynavGridPage.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavGridPage.rozie', source: GRID_PAGE_SRC });
    // Bare-identifier handler — passed BY REFERENCE (mirrors onCommit's convention).
    expect(code).toContain('onPage: onBoundary,');
    expect(code).not.toContain('onKeynavPage');
    expect(code).not.toContain('@keynav-page');
  });

  it('page: an arbitrary @keynav-page expression is wrapped in a (detail) => { ...; } arrow', () => {
    const src = GRID_PAGE_SRC.replace(
      '@keynav-page="onBoundary"',
      '@keynav-page="onBoundary($props.cells)"',
    );
    const ir = compile(src, 'KeynavGridPage.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavGridPage.rozie', source: src });
    expect(code).toContain('onPage: (detail) => { onBoundary(props.cells); },');
  });

  it('grid: a root with no .grid() modifier omits the gridColumns option entirely', () => {
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).not.toContain('gridColumns');
  });

  it("explicit item index: an item's own index expression overrides a NESTED inner loop's index alias in all four attributes", () => {
    const ir = compile(EXPLICIT_INDEX_SRC, 'KeynavExplicitIndex.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavExplicitIndex.rozie', source: EXPLICIT_INDEX_SRC });
    expect(code).toMatch(/id=\{`\$\{__rozieKeynavGroupId\}-item-\$\{w \* 7 \+ d\}`\}/);
    expect(code).toMatch(/data-rozie-keynav-item=\{w \* 7 \+ d\}/);
    expect(code).toMatch(/data-rozie-keynav-active=\{active === w \* 7 \+ d \? '' : undefined\}/);
    expect(code).toMatch(/tabIndex=\{active === w \* 7 \+ d \? 0 : -1\}/);
  });

  it('77-08: an explicit :source="…" binding on the root is consumed by getSource and NEVER leaks onto the root element as a literal JSX prop', () => {
    // EXPLICIT_INDEX_SRC's root already carries `:source="$data.flatDays"` —
    // this fixture existed since Plan 77-03 but nothing here ever asserted
    // on the ROOT element's own emitted attributes (only the item's four).
    // `resolveKeynavGroups`'s own module doc comment flags that it does NOT
    // strip an explicit `:source` binding out of `attributes` — every
    // per-target emitter must do that itself. Latent since 77-03 (every
    // prior keynav-root fixture, incl. this one, synthesized its source from
    // a co-located r-for OR was never run through `tsc`) until the
    // date-picker day grid's flat, triple-nested-loop source (77-08) — a
    // real PUBLISHED leaf with its own `tsc --noEmit` gate — surfaced it as
    // TS2322 (`source` is not a valid <div> DOM prop).
    const ir = compile(EXPLICIT_INDEX_SRC, 'KeynavExplicitIndex.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavExplicitIndex.rozie', source: EXPLICIT_INDEX_SRC });
    expect(code).not.toMatch(/<div role="grid"[^>]*\bsource=/);
    expect(code).toContain('getSource: () => (flatDays).map((day) => ({ label: day.label })),');
  });

  it('77-07: the minted root ref is typed by the root element\'s OWN tag (HTMLDivElement here), not a bare HTMLElement', () => {
    // Was a BYTE-IDENTITY assertion through Plan 77-06 — `useRef<HTMLElement
    // | null>` for EVERY minted keynav root regardless of its actual tag.
    // 77-07 (the date-picker drill retrofit) is the first real PUBLISHED
    // leaf to place a fresh r-keynav root on a `<div>` and run `tsc
    // --noEmit` against it, which surfaced a genuine, pre-existing bug:
    // `useRef<HTMLElement | null>` is NOT assignable to a `<div ref={X}>`'s
    // `LegacyRef<HTMLDivElement>` (TS2322 — a `<div>`-specific quirk in
    // React's DOM typings: `HTMLElement` is missing the deprecated `align`
    // property `HTMLDivElement` still carries). `htmlElementTypeForTag`
    // (shared with `emitTemplateAttribute.ts`'s `$refs` ref-typing) fixes
    // this for every consumer, not just date-picker — this fixture (a
    // `<div r-keynav:...>` root, same shape as the drill panels) is the
    // ONLY existing corpus member affected (`pnpm --filter @rozie/target-react
    // test` full-suite green confirms no other fixture's expected output
    // changed) — snapshot-tests-cement-bugs: a fixture asserting the OLD,
    // provably-broken type is not an invariant worth preserving.
    const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
    const { code } = emitReact(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
    expect(code).toBe(
      "import { useCallback, useId, useRef, useState } from 'react';\n" +
        "import { rozieDisplay, useKeynav } from '@rozie/runtime-react';\n\n" +
        'interface KeynavMenuProps {\n' +
        '  items?: any[];\n' +
        '}\n\n' +
        'export default function KeynavMenu(_props: KeynavMenuProps): JSX.Element {\n' +
        '  const __defaultItems = useState(() => (() => [])())[0];\n' +
        "  const props: Omit<KeynavMenuProps, 'items'> & { items: any[] } = {\n" +
        '    ..._props,\n' +
        '    items: _props.items ?? __defaultItems,\n' +
        '  };\n' +
        '  const attrs: Record<string, unknown> = (() => {\n' +
        '    const { items, ...rest } = _props as KeynavMenuProps & Record<string, unknown>;\n' +
        '    void items;\n' +
        '    return rest;\n' +
        '  })();\n' +
        '  const [active, setActive] = useState(0);\n\n' +
        '  const run = useCallback((item: any) => {\n' +
        '    console.log(item);\n' +
        '  }, []);\n\n' +
        '  const __rozieKeynavRootRef = useRef<HTMLDivElement | null>(null);\n' +
        '  const __rozieKeynavGroupId = useId();\n' +
        '  useKeynav(__rozieKeynavRootRef, {\n' +
        "    config: { focusModel: 'tabindex', orientation: 'vertical', loop: true, typeahead: false, skipDisabled: true },\n" +
        '    getSource: () => (props.items).map((it) => ({ label: it.label, disabled: it.disabled })),\n' +
        '    getActive: () => active,\n' +
        '    setActive: setActive,\n' +
        '    onCommit: (i) => { run(props.items[active]); },\n' +
        "    activeClass: 'is-active',\n" +
        '  });\n\n' +
        '  return (\n' +
        '    <>\n' +
        '    <div role="menu" {...attrs} ref={__rozieKeynavRootRef} data-rozie-s-d30ecb02="">\n' +
        '      {props.items.map((it, __rozieKeynavIndex) => <button key={it.id} role="menuitem" id={`${__rozieKeynavGroupId}-item-${__rozieKeynavIndex}`} data-rozie-keynav-item={__rozieKeynavIndex} data-rozie-keynav-active={active === __rozieKeynavIndex ? \'\' : undefined} tabIndex={active === __rozieKeynavIndex ? 0 : -1} data-rozie-s-d30ecb02="">\n' +
        '        {rozieDisplay(it.label)}\n' +
        '      </button>)}\n' +
        '    </div>\n' +
        '    </>\n' +
        '  );\n' +
        '}\n',
    );
  });
});
