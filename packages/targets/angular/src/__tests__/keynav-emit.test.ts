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

// ---------------------------------------------------------------------------
// Phase 77 Plan 05 Task 2 — multi-root plans, grid config, @keynav-page,
// explicit item index, and the deferred one-frame-late focus retry. Fixtures
// are kept SEPARATE from the Phase-71 fixtures above so every pre-existing
// assertion (checked with toContain/toMatch, never toBe) stays a substring of
// the new output — the byte-identity proof for a NON-GRID single root.
// Mirrors the React reference's (Plan 77-03) fixtures/tests, replicated by
// Vue/Svelte/Solid (Plan 77-04) and Lit (Plan 77-05 Task 1).
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

// Plan 77-10 (KNG-06 gap closure) — a `.grid(3)` keynav root nested inside an
// `r-if` branch. This is the exact shape the date-picker's drill panels have
// (a grid keynav root whose nearest ancestor chain crosses a conditional),
// and Angular had zero fixtures of this shape before this plan.
const CONDITIONAL_ROOT_SRC = `<rozie name="KeynavConditionalRoot">

<props>
{
  cells: { type: Array, default: () => [] },
}
</props>

<data>
{
  active: 0,
  open: false,
}
</data>

<template>
<div>
  <div r-if="$data.open">
    <div role="grid" r-keynav:tabindex.grid(3)="$data.active">
      <button role="gridcell" r-for="cell in $props.cells" :key="cell.id"
              r-keynav-item="{ label: cell.label }">{{ cell.label }}</button>
    </div>
  </div>
</div>
</template>

</rozie>`;

// Plan 77-10 — two SIBLING conditional roots, mirroring DatePicker.rozie's
// months/years drill pair, so group-index isolation is exercised for the
// real consumer shape.
const TWO_CONDITIONAL_ROOTS_SRC = `<rozie name="KeynavTwoConditionalRoots">

<props>
{
  months: { type: Array, default: () => [] },
  years: { type: Array, default: () => [] },
}
</props>

<data>
{
  showMonths: false,
  showYears: false,
  monthActive: 0,
  yearActive: 0,
}
</data>

<template>
<div>
  <div r-if="$data.showMonths">
    <div role="grid" r-keynav:tabindex.grid(3)="$data.monthActive">
      <button role="gridcell" r-for="month in $props.months" :key="month.id"
              r-keynav-item="{ label: month.label }">{{ month.label }}</button>
    </div>
  </div>
  <div r-if="$data.showYears">
    <div role="grid" r-keynav:tabindex.grid(3)="$data.yearActive">
      <button role="gridcell" r-for="year in $props.years" :key="year.id"
              r-keynav-item="{ label: year.label }">{{ year.label }}</button>
    </div>
  </div>
</div>
</template>

</rozie>`;

function emitMenu() {
  const ir = compile(MENU_SRC, 'KeynavMenu.rozie');
  return emitAngular(ir, { filename: 'KeynavMenu.rozie', source: MENU_SRC });
}

function emitTwoRoot() {
  const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
  return emitAngular(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
}

function emitGridPage(src: string = GRID_PAGE_SRC) {
  const ir = compile(src, 'KeynavGridPage.rozie');
  return emitAngular(ir, { filename: 'KeynavGridPage.rozie', source: src });
}

function emitExplicitIndex() {
  const ir = compile(EXPLICIT_INDEX_SRC, 'KeynavExplicitIndex.rozie');
  return emitAngular(ir, { filename: 'KeynavExplicitIndex.rozie', source: EXPLICIT_INDEX_SRC });
}

function emitConditionalRoot() {
  const ir = compile(CONDITIONAL_ROOT_SRC, 'KeynavConditionalRoot.rozie');
  return emitAngular(ir, {
    filename: 'KeynavConditionalRoot.rozie',
    source: CONDITIONAL_ROOT_SRC,
  });
}

function emitTwoConditionalRoots() {
  const ir = compile(TWO_CONDITIONAL_ROOTS_SRC, 'KeynavTwoConditionalRoots.rozie');
  return emitAngular(ir, {
    filename: 'KeynavTwoConditionalRoots.rozie',
    source: TWO_CONDITIONAL_ROOTS_SRC,
  });
}

describe('Angular r-keynav emitter — multi-root, grid, page, explicit index (Plan 77-05 Task 2)', () => {
  it('multi-root: two r-keynav roots emit TWO independent createKeynavStateMachine(...) controller calls', () => {
    const { code } = emitTwoRoot();
    const callCount = (code.match(/= createKeynavStateMachine\(\{/g) ?? []).length;
    expect(callCount).toBe(2);
  });

  it('multi-root: each root gets its own suffixed group-id/root-ref/controller identifiers', () => {
    const { code } = emitTwoRoot();
    expect(code).toContain(
      "private __rozieKeynavGroupId = 'rozie-keynav-' + Math.random().toString(36).slice(2);",
    );
    expect(code).toContain(
      "private __rozieKeynavGroupId1 = 'rozie-keynav-' + Math.random().toString(36).slice(2);",
    );
    expect(code).toContain("private __rozieKeynavRootRef = viewChild<ElementRef<HTMLElement>>('__rozieKeynavRootRef');");
    expect(code).toContain("private __rozieKeynavRootRef1 = viewChild<ElementRef<HTMLElement>>('__rozieKeynavRootRef1');");
    expect(code).toContain('this.__rozieKeynavController = createKeynavStateMachine({');
    expect(code).toContain('this.__rozieKeynavController1 = createKeynavStateMachine({');
  });

  it('multi-root: the injected Renderer2 field is declared exactly ONCE and shared by every group\'s delegation block', () => {
    const { code } = emitTwoRoot();
    const rendererFieldCount = (
      code.match(/private __rozieKeynavRenderer = inject\(Renderer2\);/g) ?? []
    ).length;
    expect(rendererFieldCount).toBe(1);
    expect(code).toContain("this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'keydown',");
  });

  it('multi-root: each root carries its OWN active-index get/set binding', () => {
    const { code } = emitTwoRoot();
    expect(code).toContain('getActive: () => this.rowActive(),');
    expect(code).toContain('setActive: (i) => { this.rowActive.set(i); },');
    expect(code).toContain('getActive: () => this.cellActive(),');
    expect(code).toContain('setActive: (i) => { this.cellActive.set(i); },');
  });

  it("multi-root: each item's four attributes are keyed to ITS OWN root's group id and active binding", () => {
    const { code } = emitTwoRoot();
    // The nested JS template-literal (backtick + `${...}`) is backslash-escaped
    // by emitDecorator's whole-template escape pass so the OUTER `template:
    // \`...\`` TS literal parses — mirrors the pre-existing "SEAM: id" test's
    // identical escaping convention.
    // Group 0 (rows) — bare group-id/active identifiers.
    expect(code).toContain('[id]="\\`\\${__rozieKeynavGroupId}-item-\\${$index}\\`"');
    expect(code).toContain('[attr.data-rozie-keynav-active]="rowActive() === $index ? \'\' : undefined"');
    // Group 1 (cells) — suffixed group-id/active identifiers.
    expect(code).toContain('[id]="\\`\\${__rozieKeynavGroupId1}-item-\\${$index}\\`"');
    expect(code).toContain('[attr.data-rozie-keynav-active]="cellActive() === $index ? \'\' : undefined"');
  });

  it('multi-root: each root mints its OWN viewChild()-backed template ref, scoping Renderer2.listen naturally via DOM structure (no shared-delegation containment marker needed)', () => {
    const { code } = emitTwoRoot();
    expect(code).toContain('#__rozieKeynavRootRef');
    expect(code).toContain('#__rozieKeynavRootRef1');
    // Angular never needs Lit's data-rozie-keynav-root marker — each root's
    // Renderer2.listen call attaches DIRECTLY on its own nativeElement.
    expect(code).not.toContain('data-rozie-keynav-root');
  });

  it('grid: the config literal gains a grid entry ONLY when .grid() is used — the columns getter is a closure inside config, not a captured value', () => {
    const { code } = emitGridPage();
    expect(code).toContain(
      "{ focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false, grid: { columns: () => this.cols() } }",
    );
  });

  it('page: @keynav-page routes into the KeynavHost.page field and never appears as an Angular template binding', () => {
    const { code } = emitGridPage();
    // Bare-identifier handler — passed BY REFERENCE (mirrors commit's convention).
    expect(code).toContain('page: this.onBoundary,');
    expect(code).not.toContain('(keynavPage)=');
    expect(code).not.toContain('@keynav-page');
  });

  it('page: an arbitrary @keynav-page expression is wrapped in a (detail) => { ...; } arrow', () => {
    const src = GRID_PAGE_SRC.replace(
      '@keynav-page="onBoundary"',
      '@keynav-page="onBoundary($props.cells)"',
    );
    const { code } = emitGridPage(src);
    expect(code).toContain('page: (detail) => { this.onBoundary(this.cells()); },');
  });

  it('grid: a root with no .grid() modifier omits the grid config key entirely', () => {
    const { code } = emitMenu();
    expect(code).not.toContain('grid:');
  });

  it("explicit item index: an item's own index expression overrides a NESTED inner loop's index alias in all four attributes", () => {
    const { code } = emitExplicitIndex();
    expect(code).toContain('[id]="\\`\\${__rozieKeynavGroupId}-item-\\${w * 7 + d}\\`"');
    expect(code).toContain('[attr.data-rozie-keynav-item]="w * 7 + d"');
    expect(code).toContain(
      '[attr.data-rozie-keynav-active]="active() === w * 7 + d ? \'\' : undefined"',
    );
    expect(code).toContain('[tabIndex]="active() === w * 7 + d ? 0 : -1"');
  });

  it('deferred focus: a same-tick-dataset-swap active change schedules exactly one requestAnimationFrame retry, cancelled on a newer active-change and on destroy', () => {
    const { code } = emitGridPage();
    expect(code).toContain(
      'if (this.__rozieKeynavRafId !== null) { cancelAnimationFrame(this.__rozieKeynavRafId); this.__rozieKeynavRafId = null; }',
    );
    expect(code).toContain('this.__rozieKeynavRafId = requestAnimationFrame(() => {');
    expect(code).toContain('if (this.active() !== __rozieKeynavActive) return;');
    expect(code).toContain('if (this.__rozieKeynavRafId !== null) cancelAnimationFrame(this.__rozieKeynavRafId);');
  });

  it("after-view-init active sync: the generated class calls this.__rozieKeynavSyncActive() explicitly at the end of ngAfterViewInit, in addition to the constructor effect() (71-11 lesson)", () => {
    const { code } = emitMenu();
    const afterViewInitMatch = code.match(/ngAfterViewInit\(\) \{([\s\S]*?)\n {2}\}/);
    expect(afterViewInitMatch).not.toBeNull();
    expect(afterViewInitMatch![1]).toContain('this.__rozieKeynavSyncActive();');
    expect(code).toContain('effect(() => {\n      this.__rozieKeynavSyncActive();\n    });');
  });

  it('BYTE-IDENTITY (non-grid single root): every pre-existing Phase-71 assertion string is still a literal substring of the menu fixture\'s emit', () => {
    const { code } = emitMenu();
    expect(code).toContain(
      "}, { focusModel: 'tabindex', orientation: 'vertical', loop: true, typeahead: false, skipDisabled: true });",
    );
    expect(code).toContain('getActive: () => this.active(),');
    expect(code).toContain('setActive: (i) => { this.active.set(i); },');
    expect(code).toContain('commit: (i) => { this.run(this.items()[this.active()]); },');
    expect(code).toContain(
      'getSource: () => (this.items()).map((it) => ({ label: it.label, disabled: it.disabled })),',
    );
    expect(code).toContain("this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'keydown',");
    expect(code).toContain("this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, 'pointerdown',");
    expect(code).toContain('Number(__rozieKeynavRaw)');
    expect(code).toContain('!Number.isInteger(__rozieKeynavIdx) || __rozieKeynavIdx < 0');
    expect(code).toContain('this.__rozieDestroyRef.onDestroy(() => {');
    expect(code).toContain("const __rozieKeynavTokens = normalizeClassTokens('is-active');");
    expect(code).toContain('const __rozieKeynavActive = this.active();');
    // No multi-root machinery leaks into a single-root emit.
    expect(code).not.toContain('__rozieKeynavGroupId1');
    expect(code).not.toContain('__rozieKeynavController1');
    expect(code).not.toContain('data-rozie-keynav-root');
  });
});

// ---------------------------------------------------------------------------
// Plan 77-10 — KNG-06 gap closure: Angular's inlined `r-keynav` listener
// delegation must be reactive and identity-diffed so a root behind `r-if`
// receives keyboard delegation the moment it resolves — not only at
// `ngAfterViewInit` time. Mirrors React's no-deps effect / Vue's
// `watch(..., { immediate: true })` / Lit's persistent-attach re-attach idiom.
// ---------------------------------------------------------------------------

describe('Angular r-keynav emitter — conditional-root re-attach (Plan 77-10)', () => {
  it('declares a per-group attached-root anchor and detach slot', () => {
    const { code } = emitConditionalRoot();
    expect(code).toContain('private __rozieKeynavAttachedRoot: HTMLElement | null = null;');
    expect(code).toContain('private __rozieKeynavDetach: (() => void) | null = null;');
  });

  it('emits the three Renderer2.listen(...) delegation calls inside an arrow-field attach method, BEFORE the ngAfterViewInit boundary', () => {
    const { code } = emitConditionalRoot();
    const attachMethodIndex = code.indexOf('private __rozieKeynavAttachRoot = () => {');
    expect(attachMethodIndex).toBeGreaterThan(-1);
    const afterViewInitBoundary = code.indexOf('ngAfterViewInit() {');
    expect(afterViewInitBoundary).toBeGreaterThan(-1);

    const preBoundarySlice = code.slice(0, afterViewInitBoundary);
    const postBoundarySlice = code.slice(afterViewInitBoundary);

    for (const eventName of ['keydown', 'pointerdown', 'focusin']) {
      const listenSubstr = `this.__rozieKeynavRenderer.listen(__rozieKeynavRootEl, '${eventName}',`;
      expect(preBoundarySlice).toContain(listenSubstr);
      expect(postBoundarySlice).not.toContain(listenSubstr);
    }
    // The attach method itself must open before the boundary too.
    expect(attachMethodIndex).toBeLessThan(afterViewInitBoundary);
  });

  it('the constructor effect() calling the attach method runs BEFORE the effect() calling the active-sync method', () => {
    const { code } = emitConditionalRoot();
    expect(code).toContain('effect(() => {');
    const attachCallIndex = code.indexOf('this.__rozieKeynavAttachRoot();');
    const syncCallIndex = code.indexOf('this.__rozieKeynavSyncActive();');
    expect(attachCallIndex).toBeGreaterThan(-1);
    expect(syncCallIndex).toBeGreaterThan(-1);
    expect(attachCallIndex).toBeLessThan(syncCallIndex);
  });

  it('the attach method identity-diffs the freshly-read root and detaches before re-attaching to a different one', () => {
    const { code } = emitConditionalRoot();
    expect(code).toContain(
      'if (__rozieKeynavRootEl === this.__rozieKeynavAttachedRoot) return;',
    );
    const detachGuardIndex = code.indexOf(
      'if (this.__rozieKeynavDetach) { this.__rozieKeynavDetach(); this.__rozieKeynavDetach = null; }',
    );
    const storeAttachedIndex = code.indexOf(
      'this.__rozieKeynavAttachedRoot = __rozieKeynavRootEl;',
    );
    expect(detachGuardIndex).toBeGreaterThan(-1);
    expect(storeAttachedIndex).toBeGreaterThan(-1);
    expect(detachGuardIndex).toBeLessThan(storeAttachedIndex);
  });

  it('DestroyRef.onDestroy registers unconditionally in ngAfterViewInit — not nested inside a root-present guard — and ngAfterViewInit no longer contains any listen(...) call', () => {
    const { code } = emitConditionalRoot();
    const afterViewInitMatch = code.match(/ngAfterViewInit\(\) \{([\s\S]*?)\n {2}\}/);
    expect(afterViewInitMatch).not.toBeNull();
    const afterViewInitBody = afterViewInitMatch![1];
    expect(afterViewInitBody).toContain('this.__rozieDestroyRef.onDestroy(');
    expect(afterViewInitBody).not.toContain('this.__rozieKeynavRenderer.listen(');
  });

  it('two sibling conditional roots emit two fully independent, suffix-isolated attach fields/method/effect', () => {
    const { code } = emitTwoConditionalRoots();
    expect(code).toContain('private __rozieKeynavAttachRoot = () => {');
    expect(code).toContain('private __rozieKeynavAttachRoot1 = () => {');
    expect(code).toContain('private __rozieKeynavAttachedRoot: HTMLElement | null = null;');
    expect(code).toContain('private __rozieKeynavAttachedRoot1: HTMLElement | null = null;');
    expect(code).toContain('private __rozieKeynavDetach: (() => void) | null = null;');
    expect(code).toContain('private __rozieKeynavDetach1: (() => void) | null = null;');

    const attachEffectMatches =
      code.match(/effect\(\(\) => \{\n\s*this\.__rozieKeynavAttachRoot\d*\(\);\n\s*\}\);/g) ?? [];
    expect(attachEffectMatches.length).toBe(2);

    // Group 1's effect body references ONLY the 1-suffixed method.
    expect(code).toMatch(/effect\(\(\) => \{\n\s*this\.__rozieKeynavAttachRoot1\(\);\n\s*\}\);/);
  });

  it('the T-71-09-01 marker-validation guards survive verbatim in the new attach method (both pointerdown and focusin paths)', () => {
    const { code } = emitConditionalRoot();
    const guardOccurrences = (
      code.match(/if \(!Number\.isInteger\(__rozieKeynavIdx\) \|\| __rozieKeynavIdx < 0\) return;/g) ??
      []
    ).length;
    expect(guardOccurrences).toBe(2);
  });
});
