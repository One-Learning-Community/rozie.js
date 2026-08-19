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

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../emitLit.js';

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
    expect(code).toContain('id=${`${this._rozieKeynavGroupId}-item-${_idx}`}');
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
    expect(menu.code).toContain('tabindex=${this._active.value === _idx ? 0 : -1}');

    const combo = emitCombobox();
    expect(combo.code).not.toMatch(/tabindex=\$\{this\._active\.value === /);
  });

  it('SEAM: root field-decl — a KeynavController field wires config, source, active get/set, and commit', () => {
    const { code } = emitMenu();
    expect(code).toContain('private _rozieKeynavController = new KeynavController(this, {');
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
    expect(code).toContain('?data-rozie-keynav-active=${this._active.value === _idx}');
  });

  it('NO-REGRESS: a component with no r-keynav directive is byte-identical to pre-Phase-71 emit (no KeynavController/keynav attrs)', () => {
    const ir = compile(COUNTER_SRC, 'Counter.rozie');
    const { code } = emitLit(ir, { filename: 'Counter.rozie', source: COUNTER_SRC });
    expect(code).not.toContain('KeynavController');
    expect(code).not.toContain('data-rozie-keynav');
    expect(code).not.toContain('_rozieKeynav');
  });
});

// ---------------------------------------------------------------------------
// Phase 77 Plan 05 — multi-root plans, grid config, @keynav-page, explicit
// item index, and the multi-root DOM containment-scoping marker. Fixtures
// are kept SEPARATE from the Phase-71 fixtures above so the byte-identity
// test can assert the Phase-71 fixtures' emit is unchanged, character-for-
// character. Mirrors the React reference's (Plan 77-03 Task 2) fixtures/
// tests test-by-test, replicated by Vue/Svelte/Solid (Plan 77-04).
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

function emitTwoRoot() {
  const ir = compile(TWO_ROOT_SRC, 'KeynavTwoGroups.rozie');
  return emitLit(ir, { filename: 'KeynavTwoGroups.rozie', source: TWO_ROOT_SRC });
}

function emitGridPage(src: string = GRID_PAGE_SRC) {
  const ir = compile(src, 'KeynavGridPage.rozie');
  return emitLit(ir, { filename: 'KeynavGridPage.rozie', source: src });
}

function emitExplicitIndex() {
  const ir = compile(EXPLICIT_INDEX_SRC, 'KeynavExplicitIndex.rozie');
  return emitLit(ir, { filename: 'KeynavExplicitIndex.rozie', source: EXPLICIT_INDEX_SRC });
}

describe('Lit r-keynav emitter — multi-root, grid, page, explicit index (Plan 77-05 Task 1)', () => {
  it('multi-root: two r-keynav roots emit TWO independent KeynavController field initializers', () => {
    const { code } = emitTwoRoot();
    const callCount = (code.match(/new KeynavController\(this, \{/g) ?? []).length;
    expect(callCount).toBe(2);
  });

  it('multi-root: each root gets its own suffixed group-id/controller field identifiers', () => {
    const { code } = emitTwoRoot();
    expect(code).toContain(
      'private _rozieKeynavGroupId = `keynav-${Math.random().toString(36).slice(2)}`;',
    );
    expect(code).toContain(
      'private _rozieKeynavGroupId1 = `keynav-${Math.random().toString(36).slice(2)}`;',
    );
    expect(code).toContain('private _rozieKeynavController = new KeynavController(this, {');
    expect(code).toContain('private _rozieKeynavController1 = new KeynavController(this, {');
  });

  it('multi-root: each root carries its OWN active-index get/set binding', () => {
    const { code } = emitTwoRoot();
    expect(code).toContain('getActive: () => this._rowActive.value,');
    expect(code).toContain('setActive: (i: number) => { this._rowActive.value = i; },');
    expect(code).toContain('getActive: () => this._cellActive.value,');
    expect(code).toContain('setActive: (i: number) => { this._cellActive.value = i; },');
  });

  it("multi-root: each item's four attributes are keyed to ITS OWN root's group id and active binding", () => {
    const { code } = emitTwoRoot();
    // Group 0 (rows) — bare group-id/active identifiers.
    expect(code).toContain('id=${`${this._rozieKeynavGroupId}-item-${_idx}`}');
    expect(code).toContain('?data-rozie-keynav-active=${this._rowActive.value === _idx}');
    // Group 1 (cells) — suffixed group-id/active identifiers.
    expect(code).toContain('id=${`${this._rozieKeynavGroupId1}-item-${_idx}`}');
    expect(code).toContain('?data-rozie-keynav-active=${this._cellActive.value === _idx}');
  });

  it('multi-root: each root element stamps its OWN data-rozie-keynav-root containment marker, and the controller receives the matching rootMarker opt', () => {
    const { code } = emitTwoRoot();
    expect(code).toContain('data-rozie-keynav-root="0"');
    expect(code).toContain('data-rozie-keynav-root="1"');
    expect(code).toContain("rootMarker: '0',");
    expect(code).toContain("rootMarker: '1',");
  });

  it('single-root: no data-rozie-keynav-root marker or rootMarker opt is emitted (matches the byte-identity fixture)', () => {
    const { code } = emitMenu();
    expect(code).not.toContain('data-rozie-keynav-root');
    expect(code).not.toContain('rootMarker');
  });

  it('grid: the config literal is UNCHANGED (no grid key) — the columns getter is a SIBLING gridColumns option', () => {
    const { code } = emitGridPage();
    expect(code).toContain(
      "config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },",
    );
    expect(code).not.toMatch(/config:\s*\{[^}]*grid/);
    expect(code).toContain('gridColumns: () => this._cols.value,');
  });

  it('page: @keynav-page routes into the onPage controller option and never appears as a template binding', () => {
    const { code } = emitGridPage();
    // Bare-identifier handler — passed BY REFERENCE (mirrors onCommit's convention).
    expect(code).toContain('onPage: this.onBoundary,');
    expect(code).not.toContain('@keynavPage');
    expect(code).not.toContain('@keynav-page');
  });

  it('page: an arbitrary @keynav-page expression is wrapped in a (detail) => { ...; } arrow', () => {
    const src = GRID_PAGE_SRC.replace(
      '@keynav-page="onBoundary"',
      '@keynav-page="onBoundary($props.cells)"',
    );
    const { code } = emitGridPage(src);
    expect(code).toContain('onPage: (detail) => { this.onBoundary(this.cells); },');
  });

  it('grid: a root with no .grid() modifier omits the gridColumns option entirely', () => {
    const { code } = emitMenu();
    expect(code).not.toContain('gridColumns');
  });

  it("explicit item index: an item's own index expression overrides a NESTED inner loop's index alias in all four attributes", () => {
    const { code } = emitExplicitIndex();
    // `w`/`d` are the loop's own item-index aliases — plain bound
    // identifiers within the loop callback's scope, NOT `$data.X` reads, so
    // `rewriteTemplateExpression` leaves them bare (no `this._` prefix).
    expect(code).toContain('id=${`${this._rozieKeynavGroupId}-item-${w * 7 + d}`}');
    expect(code).toContain('data-rozie-keynav-item=${w * 7 + d}');
    expect(code).toContain('?data-rozie-keynav-active=${this._active.value === w * 7 + d}');
    expect(code).toContain('tabindex=${this._active.value === w * 7 + d ? 0 : -1}');
  });

  it('BYTE-IDENTITY: the Phase-71 menu fixture emits character-for-character the same output as before this plan', () => {
    const { code } = emitMenu();
    expect(code).toBe(
      "import { LitElement, css, html } from 'lit';\n" +
        "import { customElement, property } from 'lit/decorators.js';\n" +
        "import { SignalWatcher, signal } from '@lit-labs/preact-signals';\n" +
        "import { KeynavController, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';\n" +
        "import { repeat } from 'lit/directives/repeat.js';\n\n" +
        "@customElement('rozie-keynav-menu')\n" +
        'export default class KeynavMenu extends SignalWatcher(LitElement) {\n' +
        '  static styles = css`\n' +
        ':host{display:contents}\n' +
        '`;\n\n' +
        '  @property({ type: Array }) items: any[] = [];\n' +
        '  private _active = signal(0);\n\n' +
        '  private _rozieKeynavGroupId = `keynav-${Math.random().toString(36).slice(2)}`;\n' +
        '  private _rozieKeynavController = new KeynavController(this, {\n' +
        "    config: { focusModel: 'tabindex', orientation: 'vertical', loop: true, typeahead: false, skipDisabled: true },\n" +
        '    getSource: () => (this.items).map((it) => ({ label: it.label, disabled: it.disabled })),\n' +
        '    getActive: () => this._active.value,\n' +
        '    setActive: (i: number) => { this._active.value = i; },\n' +
        '    onCommit: (i) => { this.run(this.items[this._active.value]); },\n' +
        "    activeClass: 'is-active',\n" +
        '  });\n\n' +
        '  private _disconnectCleanups: Array<() => void> = [];\n' +
        '  // Re-parenting guard: set true once the deferred teardown has actually\n' +
        '  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.\n' +
        '  private _rozieTornDown = false;\n\n' +
        '  disconnectedCallback(): void {\n' +
        '    super.disconnectedCallback();\n' +
        '    queueMicrotask(() => {\n' +
        '      if (this.isConnected || this._rozieTornDown) return;\n' +
        '      this._rozieTornDown = true;\n' +
        '      for (const fn of this._disconnectCleanups) fn();\n' +
        '      this._disconnectCleanups = [];\n' +
        '    });\n' +
        '  }\n\n' +
        '  render() {\n' +
        '    return html`\n' +
        '<div role="menu" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-d30ecb02>\n' +
        '  ${repeat<any>(this.items, (it, _idx) => it.id, (it, _idx) => html`<button role="menuitem" id=${`${this._rozieKeynavGroupId}-item-${_idx}`} data-rozie-keynav-item=${_idx} ?data-rozie-keynav-active=${this._active.value === _idx} tabindex=${this._active.value === _idx ? 0 : -1} data-rozie-s-d30ecb02>\n' +
        '    ${rozieDisplay(it.label)}\n' +
        '  </button>`)}\n' +
        '</div>\n' +
        '`;\n' +
        '  }\n\n' +
        '  run = (item: any) => {\n' +
        '  console.log(item);\n' +
        '};\n\n' +
        '  /**\n' +
        '   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the\n' +
        "   * host custom element's attributes on each call so a consumer-side bound\n" +
        '   * attribute flows through on every render. The `rozieSpread` directive\n' +
        '   * (D-02) does the cross-render diff downstream.\n' +
        '   *\n' +
        '   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered\n' +
        '   * out so `$attrs` returns "rest after declared props" (semantic parity\n' +
        '   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming\n' +
        '   * forms are folded into the skip set: kebab-case for model props\n' +
        "   * (explicit `attribute:`) AND lowercased property name (Lit's default).\n" +
        '   *\n' +
        '   * command-palette-per-level-virtual / portal-through-portal cluster —\n' +
        '   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping\n' +
        '   * attribute, never a consumer prop) so a parent-assigned `ref=` on this\n' +
        "   * component's own host tag can never clobber this component's OWN\n" +
        '   * internal `data-rozie-ref` ref markers via fallthrough re-application.\n' +
        '   */\n' +
        '  private get $attrs(): Record<string, string> {\n' +
        "    const __skip = new Set<string>(['data-rozie-ref', 'items']);\n" +
        '    const out: Record<string, string> = {};\n' +
        '    for (const a of Array.from(this.attributes)) {\n' +
        '      if (__skip.has(a.name)) continue;\n' +
        '      out[a.name] = a.value;\n' +
        '    }\n' +
        '    return out;\n' +
        '  }\n\n' +
        '  /**\n' +
        '   * Phase 15 D-19 — consumer-passed listener cluster placeholder.\n' +
        '   * Lit attaches event listeners directly on the host element via\n' +
        '   * `addEventListener` (no per-instance prop rest binding), so the\n' +
        "   * runtime value is undefined; the `rozieListeners` directive's\n" +
        '   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.\n' +
        '   * The declaration exists to satisfy `tsc --noEmit` on consumer\n' +
        '   * projects with strict mode — bare `$listeners` in `render()`\n' +
        '   * would otherwise raise TS2304 (Cannot find name).\n' +
        '   */\n' +
        '  private get $listeners(): Record<string, EventListener> | undefined {\n' +
        '    return undefined;\n' +
        '  }\n' +
        '}\n',
    );
  });
});
