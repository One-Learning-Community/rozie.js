<template>

<div :class="['rozie-combobox', { 'rozie-combobox--open': isOpen, 'rozie-combobox--disabled': props.disabled, 'rozie-combobox--inline': props.inline }]" ref="__rozieRootRef" v-bind="$attrs">
  <input ref="inputElRef" class="rozie-combobox-input" type="text" role="combobox" aria-autocomplete="list" :aria-expanded="!!isOpen" :aria-controls="listId()" :aria-activedescendant="activeId()" :aria-label="props.ariaLabel" :value="query" :placeholder="props.placeholder" :disabled="!!props.disabled" autocomplete="off" @input="onInput($event)" @focus="onFocus($event)" @blur="onBlur()" @keydown="onKeydown($event)" />

  
  <ul v-if="isOpen && !props.virtual" class="rozie-combobox-list" :id="listId()" role="listbox">
    <li v-for="opt in filteredOptions()" :key="opt.value" :class="['rozie-combobox-option', { 'rozie-combobox-option--active': opt._i === activeIndex, 'rozie-combobox-option--selected': opt.value === value, 'rozie-combobox-option--disabled': opt.disabled }]" :id="optId(opt._i)" role="option" :aria-selected="opt.value === value" :aria-disabled="!!opt.disabled" @mousedown.prevent="selectOption(opt)" @mouseenter="activeIndex = opt._i">
      <slot name="option" :option="opt.option" :index="opt._i" :active="opt._i === activeIndex" :selected="opt.value === value" :disabled="opt.disabled">{{ opt.label }}</slot>
    </li>

    <li v-if="filteredOptions().length === 0" class="rozie-combobox-empty" role="presentation">
      <slot name="empty" :query="query">No results</slot>
    </li></ul><ul v-if="props.virtual" class="rozie-combobox-list rozie-combobox-list--virtual" :id="listId()" role="listbox" :style="(isOpen ? '' : 'display:none;') + (props.maxHeight ? 'height:' + props.maxHeight + ';max-height:' + props.maxHeight + ';overflow-y:auto;--rozie-combobox-list-max-height:' + props.maxHeight : 'overflow-y:auto')">
    <li class="rozie-combobox-spacer" aria-hidden="true" :style="'height:' + padTop() + 'px'"></li>

    <li v-for="wr in windowedRows()" :key="wr.row.id" :class="['rozie-combobox-option', { 'rozie-combobox-option--active': wr.vi.index === activeIndex, 'rozie-combobox-option--selected': wr.row.value === value, 'rozie-combobox-option--disabled': wr.row.disabled }]" :id="optId(wr.vi.index)" :data-index="wr.vi.index" role="option" :aria-selected="wr.row.value === value" :aria-disabled="!!wr.row.disabled" @mousedown.prevent="selectOption(wr.row)" @mouseenter="activeIndex = wr.vi.index">
      <slot name="option" :option="wr.row.option" :index="wr.vi.index" :active="wr.vi.index === activeIndex" :selected="wr.row.value === value" :disabled="wr.row.disabled">{{ wr.row.label }}</slot>
    </li>

    <li class="rozie-combobox-spacer" aria-hidden="true" :style="'height:' + padBottom() + 'px'"></li>

    <li v-if="windowSource().length === 0" class="rozie-combobox-empty" role="presentation">
      <slot name="empty" :query="query">No results</slot>
    </li></ul></div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The option list — `[{ value, label, disabled? }]`. `label` is the displayed text (and what client filtering matches against), `value` is what `r-model:value` reads and writes, and an optional `disabled` flag makes an option non-selectable.
     */
    options?: any[];
    /**
     * Placeholder text shown in the input while it is empty.
     */
    placeholder?: string;
    /**
     * Disable the control — the input becomes non-interactive and the popup cannot be opened. Also sets the Angular `ControlValueAccessor` disabled state.
     */
    disabled?: boolean;
    /**
     * Opt **out** of built-in client filtering (async / server-side mode): render `options` exactly as supplied and rely on the `search` event to refetch. By default the component filters `options` by `label`, case-insensitively, against the typed query.
     */
    disableFilter?: boolean;
    /**
     * Accessible name for the input (`aria-label`), used when there is no visible `<label for>` pointing at it. Provide this (or an external label) so the combobox is announced.
     */
    ariaLabel?: string | null;
    /**
     * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one combobox shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
     */
    idBase?: string;
    /**
     * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the combobox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
     */
    inline?: boolean;
    /**
     * Close the popup after a selection commits. Defaults `true` (standard autocomplete behavior); set to `false` to keep the popup open after a selection — e.g. when the combobox is embedded in a multi-action surface like a command palette.
     */
    closeOnSelect?: boolean;
    /**
     * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
     */
    optionLabel?: ((...args: any[]) => any) | null;
    /**
     * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
     */
    optionValue?: ((...args: any[]) => any) | null;
    /**
     * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
     */
    optionDisabled?: ((...args: any[]) => any) | null;
    /**
     * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling popup (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed combobox. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded.
     */
    virtual?: boolean;
    /**
     * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
     */
    estimateRowHeight?: number;
    /**
     * A CSS length string bounding the popup scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-combobox-list-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
     */
    maxHeight?: string;
  }>(),
  { options: () => [], placeholder: '', disabled: false, disableFilter: false, ariaLabel: null, idBase: 'rozie-combobox', inline: false, closeOnSelect: true, optionLabel: null, optionValue: null, optionDisabled: null, virtual: false, estimateRowHeight: 36, maxHeight: '' }
);

/**
 * The selected option's value (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a combobox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `null` when nothing is selected.
 * @example
 * <Combobox r-model:value="country" :options="countries" />
 */
const value = defineModel<unknown>('value', { default: null });

const emit = defineEmits<{
  change: [...args: any[]];
  search: [...args: any[]];
}>();

defineSlots<{
  option(props: { option: any; index: any; active: any; selected: any; disabled: any }): any;
  empty(props: { query: any }): any;
  option(props: { option: any; index: any; active: any; selected: any; disabled: any }): any;
  empty(props: { query: any }): any;
}>();

const query = ref('');
const isOpen = ref(false);
const activeIndex = ref(-1);
const rows = ref<any[]>([]);
const windowVer = ref(0);
const editVer = ref(0);

const inputElRef = ref<HTMLInputElement>();
const __rozieRootRef = ref<HTMLElement>();

// ══ Shared headless LIST SPINE (Phase 64, D-06) — the target-agnostic list-core bridge ══
// Lifted verbatim from Listbox.rozie's <script> (the monolithic pure-Rozie list logic). This
// partial holds ONLY the PURE list spine — option resolvers, the client-side filter, enabled-index
// navigation, the arrow/home/end/enter/escape/space/tab keyboard reducer, type-ahead, single+multi
// selection, open/close state, and activeDescendant derivation. It is a compile-time `.rzts`
// script-partial: it dissolves into each consumer's compiled leaf via inlineScriptPartials() before
// IR lowering — leaving zero runtime dependency (the 64-01-proven cross-package bare-specifier path).
//
// ── PARAMETERIZATION (D-06) ──────────────────────────────────────────────────────────────────
// The spine is parameterized BY HOST CONVENTION (the same implicit by-convention mixin contract
// windowing.rzts uses) along two axes:
//   - focus-model: `activedescendant` | `roving`. Both list families default to `activedescendant`
//     (what they use today): the highlighted option is tracked virtually via `activeDescendant`
//     (an option id) while DOM focus stays on the control. `roving` (real per-option tabindex
//     focus) is SUPPORTED-BUT-UNUSED — no focus rewrite is forced here; a roving host would supply
//     its own focus mover. The `activeDescendant` / `optionId` derivation below IS the
//     activedescendant model.
//   - input-mode: `select-only` (Listbox — a button trigger + type-ahead) | `filter-input`
//     (Combobox — a text <input> that filters by the typed query). The mode is by HOST CONVENTION,
//     NOT a discriminant prop (P3 retired the Listbox `combobox`/`filterable` props): a select-only
//     host never writes `$data.query`, so `visibleOptions` is the identity path for it and the
//     printable-char branch of the reducer feeds type-ahead; a filter-input host writes `$data.query`
//     from its <input>, so `visibleOptions` substring-filters and `onInput` drives the query.
//
// ── HOST CONTRACT (symbols the consuming host MUST define before importing) ────────────────────
//   - the reassigned module-`let`s `typeBuffer` / `typeTimer` — type-ahead scratch state. They are
//     reassigned from handlers → the React emitter hoists them to `useRef` (the setup-once
//     guarantee), so per the A==B playbook rule they STAY IN THE HOST; this partial only closes
//     over them (in `onTypeahead`).
//   - `focusControl()` / `scrollActiveIntoView()` — impure ref-reading functions (they touch the
//     control / list ref elements, which are post-mount-only per ROZ123), so they are per-consumer
//     HOST functions; this partial only closes over them (it reads NO refs itself).
//   - the option set + form surface (`$props.options` / `$props.value` (model) / `$props.multiple` /
//     `$props.id` / `$props.optionLabel` / `$props.optionValue` / `$props.optionDisabled` /
//     `$props.closeOnSelect` / `$props.disabled`) and the reactive state (`$data.open` /
//     `$data.activeIndex` / `$data.query`). Input-mode is by convention (the host's <input> writing
//     `$data.query`), NOT a discriminant prop.

// ---- option resolvers --------------------------------------------------
const labelOf = (opt: any) => {
  if (props.optionLabel !== null) return props.optionLabel(opt);
  if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
  return String(opt);
};
const valueOf = (opt: any) => {
  if (props.optionValue !== null) return props.optionValue(opt);
  if (opt !== null && typeof opt === 'object' && 'value' in opt) return opt.value;
  return opt;
};
const disabledOf = (opt: any) => {
  if (props.optionDisabled !== null) return !!props.optionDisabled(opt);
  if (opt !== null && typeof opt === 'object' && 'disabled' in opt) return !!opt.disabled;
  return false;
};

// ══ Generic vertical windowing math (Phase 64, D-04) — the target-agnostic virtual-core bridge ══
// Lifted verbatim from the DataTable virtualization.rzts (the Phase 53/63 B13 baseline). This partial
// holds ONLY the PURE windowing math; every DOM/refs/virtualizer-instance impurity stays per-consumer
// in the host (ROZ123). It is a compile-time `.rzts` script-partial: it dissolves into each consumer's
// compiled leaf via inlineScriptPartials() before IR lowering — leaving zero runtime dependency.
//
// HOST CONTRACT (symbols the consuming host MUST define before importing — the same implicit
// by-convention mixin contract the DataTable host's other partials already use for `$data.windowVer`):
//   - windowSource(): T[]   — the full list to window (the KEY generalization; the DataTable host
//                             returns its pre-pagination row model, listbox/combobox return the
//                             filtered options). This partial MUST NOT reach into the host data engine
//                             directly — rows arrive ONLY through windowSource().
//   - $props.estimateRowHeight — per-item size estimate (kept aliased for DataTable back-compat).
//   - $data.windowVer / $data.editVer — window/edit-version reactivity bumps.
//   - gridScrollEl              — the scroll-container element handle.
//   - virtualizer               — the host virtual-core instance (built in $onMount from the ref).
//   - observeElementRect / observeElementOffset / elementScroll / measureElement — virtual-core fns.
//   - scheduleRemeasure()       — the host's rAF/microtask remeasure defer.
//   - pinnedEditIndex() / pinnedMeasurement(pin) — the D-05 OPTIONAL pin-extension hook (host-provided,
//                             defaulting to no-op): the DataTable host passes its edit-pinning hooks;
//                             listbox passes nothing. Routing pinning through this host hook (NOT
//                             inlining it) keeps DataTable's B13 edit-pinning behavior byte-identical.

// getItemKey reads the LIVE source (never a frozen mount-render $data.rows closure — the F6
// React stale-closure lesson) so virtual-core's measurement cache keys by stable full-model row
// id across recycling, aligned with the windowed <tr> :key="row.id" (Pitfall 3 / req-10).
// ══ Generic vertical windowing math (Phase 64, D-04) — the target-agnostic virtual-core bridge ══
// Lifted verbatim from the DataTable virtualization.rzts (the Phase 53/63 B13 baseline). This partial
// holds ONLY the PURE windowing math; every DOM/refs/virtualizer-instance impurity stays per-consumer
// in the host (ROZ123). It is a compile-time `.rzts` script-partial: it dissolves into each consumer's
// compiled leaf via inlineScriptPartials() before IR lowering — leaving zero runtime dependency.
//
// HOST CONTRACT (symbols the consuming host MUST define before importing — the same implicit
// by-convention mixin contract the DataTable host's other partials already use for `$data.windowVer`):
//   - windowSource(): T[]   — the full list to window (the KEY generalization; the DataTable host
//                             returns its pre-pagination row model, listbox/combobox return the
//                             filtered options). This partial MUST NOT reach into the host data engine
//                             directly — rows arrive ONLY through windowSource().
//   - $props.estimateRowHeight — per-item size estimate (kept aliased for DataTable back-compat).
//   - $data.windowVer / $data.editVer — window/edit-version reactivity bumps.
//   - gridScrollEl              — the scroll-container element handle.
//   - virtualizer               — the host virtual-core instance (built in $onMount from the ref).
//   - observeElementRect / observeElementOffset / elementScroll / measureElement — virtual-core fns.
//   - scheduleRemeasure()       — the host's rAF/microtask remeasure defer.
//   - pinnedEditIndex() / pinnedMeasurement(pin) — the D-05 OPTIONAL pin-extension hook (host-provided,
//                             defaulting to no-op): the DataTable host passes its edit-pinning hooks;
//                             listbox passes nothing. Routing pinning through this host hook (NOT
//                             inlining it) keeps DataTable's B13 edit-pinning behavior byte-identical.

// getItemKey reads the LIVE source (never a frozen mount-render $data.rows closure — the F6
// React stale-closure lesson) so virtual-core's measurement cache keys by stable full-model row
// id across recycling, aligned with the windowed <tr> :key="row.id" (Pitfall 3 / req-10).
const virtualItemKey = (i: any) => {
  const src = windowSource();
  return src && src[i] ? src[i].id : undefined;
};

// The FULL virtualizer options. virtual-core's setOptions REPLACES options with
// `{ ...defaults, ...opts }` (it does NOT merge with prior options — verified in the 3.17.1
// source), so the re-feed MUST pass the complete set, exactly like every TanStack adapter.
// Returned `any` (the currentState() precedent) so the strict bundled-leaf tsc does not choke
// on virtual-core's generic option inference. onChange uses the `$data.x = $data.x + 1`
// increment the React emitter lowers to functional setState — correct even from a mount closure.
// The FULL virtualizer options. virtual-core's setOptions REPLACES options with
// `{ ...defaults, ...opts }` (it does NOT merge with prior options — verified in the 3.17.1
// source), so the re-feed MUST pass the complete set, exactly like every TanStack adapter.
// Returned `any` (the currentState() precedent) so the strict bundled-leaf tsc does not choke
// on virtual-core's generic option inference. onChange uses the `$data.x = $data.x + 1`
// increment the React emitter lowers to functional setState — correct even from a mount closure.
const virtualizerOptions = (): any => ({
  count: windowSource().length,
  getScrollElement: () => gridScrollEl,
  estimateSize: () => props.estimateRowHeight,
  observeElementRect,
  observeElementOffset,
  scrollToFn: elementScroll,
  measureElement,
  overscan: 8,
  getItemKey: virtualItemKey,
  onChange: () => {
    windowVer.value = windowVer.value + 1;
    // CR-01: re-observe the freshly-committed window so RECYCLED rows get measured.
    // virtual-core only observe()s a node you explicitly hand to measureElement (it does
    // NOT auto-discover rendered rows — measureElement is the SOLE caller of
    // observer.observe, virtual-core@3.17.1 dist/esm/index.js:794-817). Rows that recycle
    // into view on scroll are brand-new DOM nodes; without re-sweeping they keep the
    // estimateRowHeight seed forever and the spacer math drifts (req-2). Deferred one frame
    // so the new <tr> set is in the DOM before we measure. Safe from an infinite
    // measure→onChange→measure loop: measureElement is idempotent on an already-observed
    // node (the `prevNode !== node` guard), and resizeItem only re-fires onChange when the
    // measured height actually DIFFERS from the cached one (delta !== 0) — an unchanged
    // re-measure is a no-op.
    scheduleRemeasure();
  }
});

// pinMeasurement(pin): the D-05 pin-hook read, RE-TYPED at the windowing layer so the
// shared math is strict-clean across every host. The host-provided pinnedMeasurement() has
// two shapes: the DataTable host returns a real virtual-core measurement; the listbox/combobox
// no-op host returns bare `null` (inferred `(pin) => null`). Calling it directly makes
// `const pm = pinnedMeasurement(pin)` flow-narrow to `null`, so the downstream `pm && pm.start`
// guard collapses the object branch to `never` (TS2339, Class 3). Reading the hook through this
// thin wrapper with an EXPLICIT return type (a return-type annotation is NOT flow-narrowed)
// gives the measurement a real object-or-null shape, so `pm && pm.start` keeps the object branch.
// Typing-only: the runtime value (a measurement or null) is unchanged.
// pinMeasurement(pin): the D-05 pin-hook read, RE-TYPED at the windowing layer so the
// shared math is strict-clean across every host. The host-provided pinnedMeasurement() has
// two shapes: the DataTable host returns a real virtual-core measurement; the listbox/combobox
// no-op host returns bare `null` (inferred `(pin) => null`). Calling it directly makes
// `const pm = pinnedMeasurement(pin)` flow-narrow to `null`, so the downstream `pm && pm.start`
// guard collapses the object branch to `never` (TS2339, Class 3). Reading the hook through this
// thin wrapper with an EXPLICIT return type (a return-type annotation is NOT flow-narrowed)
// gives the measurement a real object-or-null shape, so `pm && pm.start` keeps the object branch.
// Typing-only: the runtime value (a measurement or null) is unchanged.
const pinMeasurement = (pin: number): {
  start: number;
  size: number;
  index: number;
  end: number;
} | null => pinnedMeasurement(pin);

// windowedRows(): the rendered slice. Off / pre-mount → the full $data.rows mapped to
// { vi:null, row } (the r-else path never calls this, but the guard keeps it total). On → read
// $data.windowVer to SUBSCRIBE (the rowIndexOf tick discipline) then map each VirtualItem to its
// full-model row. NB the local is `rowList` (NOT `rows` — React lowers $data.rows to a bare
// `rows` binding → TS2448 self-shadow, line ~1149 lesson).
// windowedRows(): the rendered slice. Off / pre-mount → the full $data.rows mapped to
// { vi:null, row } (the r-else path never calls this, but the guard keeps it total). On → read
// $data.windowVer to SUBSCRIBE (the rowIndexOf tick discipline) then map each VirtualItem to its
// full-model row. NB the local is `rowList` (NOT `rows` — React lowers $data.rows to a bare
// `rows` binding → TS2448 self-shadow, line ~1149 lesson).
const windowedRows = () => {
  // SUBSCRIBE FIRST (fine-grained targets): touch the reactive windowVer at the TOP — BEFORE any
  // early return — so Solid's <For>/Svelte's {#each} accessor subscribes to it on its FIRST eval,
  // which happens at initial render while `virtualizer` is still null (it is built in $onMount,
  // after the first render). `virtualizer` is a non-reactive `let`, so if the windowVer read sat
  // BELOW the `!virtualizer` guard the accessor would early-return [] without ever reading the
  // signal → it would NEVER re-run when onChange later bumps windowVer, and the window would stay
  // blank forever (the Solid/Svelte fine-grained bug). Coarse targets re-render wholesale so the
  // placement is a no-op for them. The post-construction windowVer bump in $onMount fires the
  // first re-run that picks up the now-non-null virtualizer.
  // ALSO subscribe to editVer here so the slice re-derives when an editor opens/closes (the
  // pin/unpin transition), mirroring the probe's windowVer bump on pin (Solid/Svelte fine-grained).
  void windowVer.value;
  void editVer.value;
  if (!virtualizer) {
    // Virtual OFF → full set (the r-else table never calls this, but keep it total). Virtual ON
    // but the virtualizer is not yet constructed (pre-$onMount first paint) → render NOTHING so
    // the template never dereferences a null `vi` (the windowed bindings read wr.vi.index); the
    // rows appear on the first onChange after _didMount.
    if (!props.virtual) {
      const rowList = rows.value || [];
      return rowList.map((r: any) => ({
        vi: null,
        row: r
      }));
    }
    return [];
  }
  const items = virtualizer.getVirtualItems();
  const rowList = rows.value || [];
  // WR-01: drop any virtual item whose index outruns the current full-model rows (a brief
  // shrink window where the virtualizer count is stale relative to $data.rows on the async
  // onChange→windowVer path). The template keys on wr.row.id, so a row:undefined entry would
  // throw "Cannot read properties of undefined"; filter it here so the template never sees it.
  const out = items.map((vi: any) => ({
    vi,
    row: rowList[vi.index]
  })).filter((wr: any) => wr.row);
  // ── D-02 pin-row union (req-9): if an editor is open on a row that is NOT in the current
  // window, UNION it into the slice (keyed on row.id so Lit repeat / Solid For never recycle it
  // into another full-model row), LEADING the slice when it sits above the window and TRAILING
  // it when below — so DOM order matches visual/aria order. The spacer subtraction (padTop/
  // padBottom) keeps the total exactly getTotalSize(). This is the 51-01-proven mechanism wired
  // into the real windowing.
  const pin = pinnedEditIndex();
  if (pin >= 0 && rowList[pin]) {
    let inWindow = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].index === pin) {
        inWindow = true;
        break;
      }
    }
    if (!inWindow) {
      const pm = pinMeasurement(pin);
      const firstStart = items.length ? items[0].start : 0;
      const above = pm ? pm.start < firstStart : pin < (items.length ? items[0].index : pin);
      const pinnedEntry = {
        vi: pm != null ? pm : {
          index: pin
        },
        row: rowList[pin],
        pinned: true
      };
      if (above) out.unshift(pinnedEntry);else out.push(pinnedEntry);
    }
  }
  return out;
};

// Spacer-<tr> heights (D-03): the leading spacer occupies items[0].start; the trailing spacer
// the gap between the last rendered item's end and getTotalSize(). Both windowVer-gated reads
// (the `$data.windowVer` touch re-derives them as the window/measurements change). 0 when off.
// Spacer-<tr> heights (D-03): the leading spacer occupies items[0].start; the trailing spacer
// the gap between the last rendered item's end and getTotalSize(). Both windowVer-gated reads
// (the `$data.windowVer` touch re-derives them as the window/measurements change). 0 when off.
const padTop = () => {
  // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
  // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
  // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
  void windowVer.value;
  void editVer.value;
  if (!props.virtual || !virtualizer) return 0;
  const items = virtualizer.getVirtualItems();
  let pad = items.length ? items[0].start : 0;
  // D-02 spacer subtraction: when the pinned editing row sits ABOVE the window it is rendered
  // in-flow as the slice's LEADING <tr> (its measured height is now a real <tr>), so subtract
  // that height from the leading spacer to keep padTop + Σ rendered <tr> + padBottom = total.
  const pin = pinnedEditIndex();
  if (pin >= 0) {
    const pm = pinMeasurement(pin);
    const inWindow = pmIndexInWindow(items, pin);
    if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
  }
  return pad < 0 ? 0 : pad;
};
const padBottom = () => {
  // subscribe-first, see windowedRows() (IN-04): touch windowVer + editVer before the early
  // return so the fine-grained spacer :style binding subscribes on its first eval + re-derives
  // on pin/unpin.
  void windowVer.value;
  void editVer.value;
  if (!props.virtual || !virtualizer) return 0;
  const items = virtualizer.getVirtualItems();
  if (!items.length) return 0;
  let pad = virtualizer.getTotalSize() - items[items.length - 1].end;
  // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
  // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
  const pin = pinnedEditIndex();
  if (pin >= 0) {
    const pm = pinMeasurement(pin);
    const inWindow = pmIndexInWindow(items, pin);
    // WR-01: decide "below the window" by INDEX, not by start-OFFSET. On variable-height rows
    // measurement drift can leave pm.start at-or-past items[0].start while the pinned row's
    // index is actually ABOVE the window, mis-subtracting its height from the trailing spacer.
    // The pinned full-model index vs the last rendered item's index is drift-proof. Fall back to
    // the offset comparison only if the measurement lacks an index (defensive).
    const lastItemIdx = items[items.length - 1].index;
    const below = pm && pm.index != null ? pm.index > lastItemIdx : pm && pm.start >= items[0].start;
    if (pm && !inWindow && below) {
      // below the window → it trailed the slice; subtract its height from the trailing spacer.
      if (pm.end > items[items.length - 1].end) pad = pad - pm.size;
    }
  }
  return pad < 0 ? 0 : pad;
};
// pmIndexInWindow: is full-model index `idx` present in the rendered virtual window?
// pmIndexInWindow: is full-model index `idx` present in the rendered virtual window?
const pmIndexInWindow = (items: any, idx: any) => {
  for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
  return false;
};
// rowIsOutsideWindow(r): is the full-model row index r absent from the currently rendered
// window? Used by the scroll-then-focus seam (req-5 — scroll a far row in before focusing).
// rowIsOutsideWindow(r): is the full-model row index r absent from the currently rendered
// window? Used by the scroll-then-focus seam (req-5 — scroll a far row in before focusing).
const rowIsOutsideWindow = (r: any) => {
  if (!props.virtual || !virtualizer) return false;
  const items = virtualizer.getVirtualItems();
  for (const it of items as any) if (it.index === r) return false;
  return true;
};

// virtual-core: the framework-agnostic windowing state machine (the data-table
// precedent — NO per-framework adapter). The static import is emitted unconditionally;
// every RUNTIME reference sits behind `if ($props.virtual)` / a `virtualizer` guard so
// the non-virtual emitted path executes none of it (byte-identical-off).
// virtual-core: the framework-agnostic windowing state machine (the data-table
// precedent — NO per-framework adapter). The static import is emitted unconditionally;
// every RUNTIME reference sits behind `if ($props.virtual)` / a `virtualizer` guard so
// the non-virtual emitted path executes none of it (byte-identical-off).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// Windowing instance state (reassigned module-`let`s → React hoists to useRef; do NOT
// const). NULL until $onMount, ONLY constructed when $props.virtual. gridScrollEl is the
// captured .rozie-combobox-list scroll div; remeasurePending dedupes the deferred sweep.
// Windowing instance state (reassigned module-`let`s → React hoists to useRef; do NOT
// const). NULL until $onMount, ONLY constructed when $props.virtual. gridScrollEl is the
// captured .rozie-combobox-list scroll div; remeasurePending dedupes the deferred sweep.
let virtualizer: any = null;
let virtualizerCleanup: any = null;
let gridScrollEl: any = null;
let remeasurePending = false;

// ---- derived view (plain functions, uniform ×6) ------------------------
// The filtered option list, each carrying its filtered-list index `_i`, a stable
// windowing key `id`, and the RAW source option (`option`) so `@change` + the
// `#option` slot expose the original object (CP reads `e.option.id` / `option.group`).
//
// REFERENCE-KEYED MEMO, NOT $computed — this is load-bearing for windowed perf. TanStack
// virtual-core calls getItemKey(i)/getMeasurements O(count) times per pass, and windowSource()
// (below) aliases this, so without a memo every scroll re-`.map()`s ALL options into fresh
// wrapper objects — O(N²). On vue each wrapper read trips a reactive Proxy trap (valueOf/labelOf/
// disabledOf), so a 60-ArrowDown batch over 1,000 options cost ~16s. It is deliberately NOT a
// $computed: a $computed would re-SUBSCRIBE to the reactive `options` Proxy and re-run on
// unrelated reactive churn (and on vue re-trip the Proxy traps); the whole point is to AVOID
// re-mapping when only activeIndex changed. The cache key is pure VALUE/REFERENCE comparison
// (no reactive subscription), so it adds zero reactivity churn — it collapses virtual-core's
// O(count) re-maps to ONE map per real (options-ref / query / disableFilter) change.
//
// foCache is a member-mutated FRESH-OBJECT const (NOT a reassigned `let`): the React emitter
// lowers `const X = {…}` that is member-mutated to `useMemo(() => ({…}), [])` (per-instance,
// stable across renders — feedback_react_const_mutinstance_not_stabilized); on the 5 setup-once
// targets the top-level const persists for the instance lifetime naturally. A reassigned
// `let X = null` would NOT survive React renders (filteredOptions() is reached from the TEMPLATE,
// not a hook-root → per-render reset trap), so it MUST be a fresh-object const.
// ---- derived view (plain functions, uniform ×6) ------------------------
// The filtered option list, each carrying its filtered-list index `_i`, a stable
// windowing key `id`, and the RAW source option (`option`) so `@change` + the
// `#option` slot expose the original object (CP reads `e.option.id` / `option.group`).
//
// REFERENCE-KEYED MEMO, NOT $computed — this is load-bearing for windowed perf. TanStack
// virtual-core calls getItemKey(i)/getMeasurements O(count) times per pass, and windowSource()
// (below) aliases this, so without a memo every scroll re-`.map()`s ALL options into fresh
// wrapper objects — O(N²). On vue each wrapper read trips a reactive Proxy trap (valueOf/labelOf/
// disabledOf), so a 60-ArrowDown batch over 1,000 options cost ~16s. It is deliberately NOT a
// $computed: a $computed would re-SUBSCRIBE to the reactive `options` Proxy and re-run on
// unrelated reactive churn (and on vue re-trip the Proxy traps); the whole point is to AVOID
// re-mapping when only activeIndex changed. The cache key is pure VALUE/REFERENCE comparison
// (no reactive subscription), so it adds zero reactivity churn — it collapses virtual-core's
// O(count) re-maps to ONE map per real (options-ref / query / disableFilter) change.
//
// foCache is a member-mutated FRESH-OBJECT const (NOT a reassigned `let`): the React emitter
// lowers `const X = {…}` that is member-mutated to `useMemo(() => ({…}), [])` (per-instance,
// stable across renders — feedback_react_const_mutinstance_not_stabilized); on the 5 setup-once
// targets the top-level const persists for the instance lifetime naturally. A reassigned
// `let X = null` would NOT survive React renders (filteredOptions() is reached from the TEMPLATE,
// not a hook-root → per-render reset trap), so it MUST be a fresh-object const.
const foCache = {
  optsRef: null,
  q: null,
  df: null,
  val: null,
  hasVal: false
};
const filteredOptions = () => {
  // SUBSCRIBE FIRST (fine-grained Solid <For> / Svelte {#each}): read ALL three reactive inputs
  // into locals at the TOP, BEFORE any cache-hit early return — read $data.query UNCONDITIONALLY
  // (even when disableFilter is true, mirroring windowing.rzts windowedRows void-touch discipline)
  // so the r-for accessor subscribes to them on every eval. An early return that skipped reading
  // them would leave the accessor un-subscribed → it would never re-run on a real input change →
  // stale/blank window.
  const opts = Array.isArray(props.options) ? props.options : [];
  const df = !!props.disableFilter;
  const q = String(query.value == null ? '' : query.value);
  // Reference-keyed cache HIT: same options reference, same query, same disableFilter → return the
  // SAME array reference (no re-map, no new wrappers). Pure ===, NOT a reactive subscription.
  if (foCache.hasVal && foCache.optsRef === opts && foCache.q === q && foCache.df === df) return foCache.val;
  // MISS → run the existing filter + map, then store keyed on (opts ref, query, disableFilter).
  let list = opts;
  if (!df) {
    const ql = q.toLowerCase();
    if (ql) list = opts.filter((o: any) => String(labelOf(o)).toLowerCase().indexOf(ql) !== -1);
  }
  const val = list.map((o: any, i: any) => ({
    value: valueOf(o),
    label: labelOf(o),
    disabled: disabledOf(o),
    _i: i,
    id: valueOf(o),
    option: o
  }));
  foCache.optsRef = opts;
  foCache.q = q;
  foCache.df = df;
  foCache.val = val;
  foCache.hasVal = true;
  return val;
};

// windowSource(): the windowing.rzts host-contract row source — the FILTERED option
// list (the same wrapper rows the template iterates). Kept === $data.rows so the math's
// rowList[vi.index] resolves to the same wrapper the count windows over.
// windowSource(): the windowing.rzts host-contract row source — the FILTERED option
// list (the same wrapper rows the template iterates). Kept === $data.rows so the math's
// rowList[vi.index] resolves to the same wrapper the count windows over.
const windowSource = () => filteredOptions();

// D-05 NO-OP PIN HOOK (defined in THIS host, NOT the shared partial — keeps data-table
// A==B intact). The shared windowedRows/padTop/padBottom call pinnedEditIndex()/
// pinnedMeasurement() UNGUARDED by convention; a combobox has no edit-pinning, so these
// reduce the pin union (-1 → never unioned) and the spacer subtraction (null → identity)
// to a no-op. They MUST exist or the by-convention call ReferenceErrors at mount.
// D-05 NO-OP PIN HOOK (defined in THIS host, NOT the shared partial — keeps data-table
// A==B intact). The shared windowedRows/padTop/padBottom call pinnedEditIndex()/
// pinnedMeasurement() UNGUARDED by convention; a combobox has no edit-pinning, so these
// reduce the pin union (-1 → never unioned) and the spacer subtraction (null → identity)
// to a no-op. They MUST exist or the by-convention call ReferenceErrors at mount.
const pinnedEditIndex = () => -1;
const pinnedMeasurement = (pin: any) => null;

// Keep $data.rows === windowSource() so the windowing math indexes the live filtered set.
// Keep $data.rows === windowSource() so the windowing math indexes the live filtered set.
const syncRows = () => {
  rows.value = windowSource();
};

// Defer remeasureWindow() until AFTER the framework commits the recycled window: TWO
// passes (microtask THEN rAF) behind one in-flight flag (the data-table
// virtualization.rzts pattern, copied per-consumer per D-04/D-09) — microtask catches
// Solid's <For> / Svelte's {#each} synchronous commit (the Phase 63 Solid
// under-convergence hazard — D-09 rAF-defer budget), rAF catches React's async commit.
// Defer remeasureWindow() until AFTER the framework commits the recycled window: TWO
// passes (microtask THEN rAF) behind one in-flight flag (the data-table
// virtualization.rzts pattern, copied per-consumer per D-04/D-09) — microtask catches
// Solid's <For> / Svelte's {#each} synchronous commit (the Phase 63 Solid
// under-convergence hazard — D-09 rAF-defer budget), rAF catches React's async commit.
const scheduleRemeasure = () => {
  if (remeasurePending) return;
  remeasurePending = true;
  let ranMicro = false;
  const microPass = () => {
    remeasureWindow();
  };
  const rafPass = () => {
    remeasurePending = false;
    remeasureWindow();
  };
  if (typeof queueMicrotask !== 'undefined') {
    ranMicro = true;
    queueMicrotask(microPass);
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) remeasurePending = false;else setTimeout(rafPass, 0);
};

// measureElement sweep: hand every rendered windowed option to the virtualizer so its
// true height is observed (virtual-core measures ONLY nodes passed to measureElement,
// keyed by the data-index attribute). Bails during a programmatic scroll.
// measureElement sweep: hand every rendered windowed option to the virtualizer so its
// true height is observed (virtual-core measures ONLY nodes passed to measureElement,
// keyed by the data-index attribute). Bails during a programmatic scroll.
const remeasureWindow = () => {
  if (!virtualizer || !gridScrollEl) return;
  if (virtualizer.scrollState) return;
  const els = gridScrollEl.querySelectorAll('.rozie-combobox-option[data-index]');
  for (const el of els as any) virtualizer.measureElement(el);
};

// Keep the active option visible inside the windowed popup. When windowing, route
// through the virtualizer (scrollToIndex) so an active option OUTSIDE the rendered
// window scrolls into view (the windowed-arrow-nav seam). No-op when not virtual (the
// non-virtual combobox popup is short enough not to need it — unchanged behavior).
// Keep the active option visible inside the windowed popup. When windowing, route
// through the virtualizer (scrollToIndex) so an active option OUTSIDE the rendered
// window scrolls into view (the windowed-arrow-nav seam). No-op when not virtual (the
// non-virtual combobox popup is short enough not to need it — unchanged behavior).
const scrollActiveIntoView = () => {
  if (!props.virtual || !virtualizer || activeIndex.value < 0) return;
  // 'center' (not 'auto'): keep the active option well inside the rendered slice — 'auto'
  // lands it at the viewport edge where the overscan band can leave it just-unrendered for
  // a frame on the fine-grained targets (Solid).
  virtualizer.scrollToIndex(activeIndex.value, {
    align: 'center'
  });
  scheduleRemeasure();
};
const optId = (i: any) => props.idBase + '-opt-' + i;
const listId = () => props.idBase + '-list';

// The active option's id for aria-activedescendant (null when none).
// The active option's id for aria-activedescendant (null when none).
const activeId = () => {
  const list = filteredOptions();
  if (isOpen.value && activeIndex.value >= 0 && list[activeIndex.value]) return optId(activeIndex.value);
  return null;
};

// Next selectable index in `dir` (+1/-1), skipping disabled, clamped to ends.
// Next selectable index in `dir` (+1/-1), skipping disabled, clamped to ends.
const nextEnabled = (list: any, from: any, dir: any) => {
  let i = from;
  for (let step = 0; step < list.length; step++) {
    i = i + dir;
    if (i < 0) i = 0;
    if (i >= list.length) i = list.length - 1;
    if (list[i] && !list[i].disabled) return i;
    if (dir < 0 && i === 0 || dir > 0 && i === list.length - 1) break;
  }
  return from;
};

// ---- selection (writes the model + syncs query) ------------------------
// `opt` is a filtered-row wrapper ({ value, label, disabled, _i, option }). Fire
// `@change` with BOTH the committed value AND the raw source `option` (CP reads
// `e.option`). `closeOnSelect` (default true) gates the popup close — a caller
// embedding the combobox in a multi-action surface passes `:close-on-select="false"`.
// ---- selection (writes the model + syncs query) ------------------------
// `opt` is a filtered-row wrapper ({ value, label, disabled, _i, option }). Fire
// `@change` with BOTH the committed value AND the raw source `option` (CP reads
// `e.option`). `closeOnSelect` (default true) gates the popup close — a caller
// embedding the combobox in a multi-action surface passes `:close-on-select="false"`.
const selectOption = (opt: any) => {
  if (!opt || opt.disabled) return;
  value.value = opt.value;
  query.value = String(opt.label);
  if (props.closeOnSelect) isOpen.value = false;
  activeIndex.value = -1;
  emit('change', {
    value: opt.value,
    option: opt.option
  });
};

// Reflect the externally-selected value into the input text.
// Reflect the externally-selected value into the input text.
const syncQueryToValue = () => {
  const opts = Array.isArray(props.options) ? props.options : [];
  const opt = opts.find((o: any) => o.value === value.value);
  query.value = opt ? String(opt.label) : '';
};

// ---- input + keyboard handlers -----------------------------------------
// ---- input + keyboard handlers -----------------------------------------
const onInput = (e: any) => {
  const q = e && e.target ? e.target.value : '';
  query.value = q;
  isOpen.value = true;
  activeIndex.value = 0;
  emit('search', {
    query: q
  });
};
const onFocus = (e: any) => {
  isOpen.value = true;
  if (e && e.target && e.target.select) e.target.select();
};

// @blur closes the popup. Option selection uses @mousedown.prevent, which keeps
// focus on the input, so a click on an option does NOT blur-close before select.
// @blur closes the popup. Option selection uses @mousedown.prevent, which keeps
// focus on the input, so a click on an option does NOT blur-close before select.
const onBlur = () => {
  isOpen.value = false;
};
const onKeydown = (e: any) => {
  const key = e ? e.key : '';
  const list = filteredOptions();
  // Capture the reactive reads into locals BEFORE any write so React never binds
  // a pre-write value (ROZ138; the read-then-write-same-key idiom). Each branch
  // is mutually exclusive, but a flow-insensitive analysis can't see that.
  const wasOpen = isOpen.value;
  const ai = activeIndex.value;
  if (key === 'ArrowDown') {
    if (e) e.preventDefault();
    if (!wasOpen) {
      isOpen.value = true;
      activeIndex.value = 0;
      return;
    }
    activeIndex.value = nextEnabled(list, ai, 1);
  } else if (key === 'ArrowUp') {
    if (e) e.preventDefault();
    if (!wasOpen) {
      isOpen.value = true;
      return;
    }
    activeIndex.value = nextEnabled(list, ai, -1);
  } else if (key === 'Enter') {
    if (wasOpen && ai >= 0 && list[ai]) {
      if (e) e.preventDefault();
      selectOption(list[ai]);
    }
  } else if (key === 'Escape') {
    if (wasOpen) {
      if (e) e.preventDefault();
      isOpen.value = false;
    }
  } else if (key === 'Home') {
    if (wasOpen) {
      if (e) e.preventDefault();
      activeIndex.value = nextEnabled(list, -1, 1);
    }
  } else if (key === 'End') {
    if (wasOpen) {
      if (e) e.preventDefault();
      activeIndex.value = nextEnabled(list, list.length, -1);
    }
  }
  // Keep the (new) active option in view when windowing — no-op when not virtual.
  scrollActiveIntoView();
};

// ---- lifecycle + imperative handle -------------------------------------
// kickWindow: the cross-target first-paint settle (the data-table / listbox precedent).
// Re-captures the LIVE scroll element, re-feeds the CURRENT option count, re-attaches the
// rect observer (_willUpdate), and bumps the windowVer signal so the windowed slice
// re-derives. Retried over a few frames because (a) virtual-core measures the scroll rect
// asynchronously (D-09 Solid rAF-defer — a synchronous kick sees rectH 0 → empty window),
// (b) Solid/Lit recreate the list node between mount and first commit (stale scrollElement),
// and (c) the consumer often seeds options AFTER the combobox mounts (Lit/React). Stops once
// the window paints — idempotent + loop-free.
// ---- lifecycle + imperative handle -------------------------------------
// kickWindow: the cross-target first-paint settle (the data-table / listbox precedent).
// Re-captures the LIVE scroll element, re-feeds the CURRENT option count, re-attaches the
// rect observer (_willUpdate), and bumps the windowVer signal so the windowed slice
// re-derives. Retried over a few frames because (a) virtual-core measures the scroll rect
// asynchronously (D-09 Solid rAF-defer — a synchronous kick sees rectH 0 → empty window),
// (b) Solid/Lit recreate the list node between mount and first commit (stale scrollElement),
// and (c) the consumer often seeds options AFTER the combobox mounts (Lit/React). Stops once
// the window paints — idempotent + loop-free.
const kickWindow = (attempts: any) => {
  if (!virtualizer) return;
  gridScrollEl = __rozieRootRef.value ? __rozieRootRef.value!.querySelector('.rozie-combobox-list') : gridScrollEl;
  // Only re-feed the count from a NON-EMPTY source: on React these rAF closures capture
  // stale (mount-time, empty) props, so feeding here would CLOBBER the $watch's correct
  // count back to 0. The $watch (fresh useEffect props) owns React's count; the kick owns
  // the Solid/Lit scroll-element re-attach + the deferred windowVer re-derive.
  if (windowSource().length > 0) {
    syncRows();
    virtualizer.setOptions(virtualizerOptions());
  }
  virtualizer._willUpdate();
  windowVer.value = windowVer.value + 1;
  remeasureWindow();
  if (windowedRows().length === 0 && attempts > 0) {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => kickWindow(attempts - 1));else setTimeout(() => kickWindow(attempts - 1), 16);
  }
};
// focus() — focus the input (accepted ROZ137 Lit override). clear() — reset the
// selection + query. Both post-mount → $refs safe.
const focus = () => inputElRef.value?.focus();
const clear = () => {
  value.value = null;
  query.value = '';
  activeIndex.value = -1;
  emit('change', {
    value: null
  });
};

onMounted(() => {
  syncQueryToValue();
  syncRows();
  // ── Windowing: construct the virtualizer (ONLY when virtual) ──────────────
  // The windowed popup stays mounted whenever virtual (r-if="$props.virtual"); it is only
  // hidden via display:none when closed (CR-01), so the .rozie-combobox-list scroll
  // container already exists here for the virtualizer to attach to.
  if (props.virtual) {
    // Capture the scroll container via $el.querySelector (the data-table gridScrollEl
    // precedent, proven ×6 incl Lit shadow + Solid) — $refs on a conditionally-rendered
    // node is null on Solid/Lit, leaving the virtualizer with no scroll element.
    gridScrollEl = __rozieRootRef.value ? __rozieRootRef.value!.querySelector('.rozie-combobox-list') : null;
    virtualizer = new Virtualizer(virtualizerOptions());
    virtualizerCleanup = virtualizer._didMount();
    windowVer.value = windowVer.value + 1;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => kickWindow(8));else setTimeout(() => kickWindow(8), 0);
  }
});
onBeforeUnmount(() => {
  if (virtualizerCleanup) virtualizerCleanup();
});

watch(() => value.value, () => {
  syncQueryToValue();
});
watch(() => (props.options ? props.options.length : 0) + '|' + query.value, () => {
  syncRows();
  if (props.virtual && virtualizer) {
    virtualizer.setOptions(virtualizerOptions());
    virtualizer._willUpdate();
    windowVer.value = windowVer.value + 1;
    scheduleRemeasure();
  }
});

defineExpose({ focus, clear });
</script>

<style scoped>
.rozie-combobox {
  position: relative;
  display: inline-block;
  width: var(--rozie-combobox-width, 16rem);
  font: var(--rozie-combobox-font, inherit);
}
.rozie-combobox-input {
  box-sizing: border-box;
  width: 100%;
  padding: var(--rozie-combobox-input-padding, 0.5rem 0.75rem);
  font: inherit;
  color: var(--rozie-combobox-color, inherit);
  background: var(--rozie-combobox-bg, #fff);
  border: var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-border-color, rgba(0, 0, 0, 0.25));
  border-radius: var(--rozie-combobox-radius, 0.5rem);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.rozie-combobox-input:focus {
  border-color: var(--rozie-combobox-accent, #0066cc);
  box-shadow: 0 0 0 var(--rozie-combobox-focus-ring-width, 3px) var(--rozie-combobox-focus-ring-color, rgba(0, 102, 204, 0.25));
}
.rozie-combobox--disabled .rozie-combobox-input {
  cursor: not-allowed;
  opacity: var(--rozie-combobox-disabled-opacity, 0.55);
  background: var(--rozie-combobox-disabled-bg, rgba(0, 0, 0, 0.04));
}
.rozie-combobox-list {
  position: absolute;
  z-index: var(--rozie-combobox-list-z, 50);
  top: calc(100% + var(--rozie-combobox-list-gap, 0.25rem));
  left: 0;
  right: 0;
  margin: 0;
  padding: var(--rozie-combobox-list-padding, 0.25rem);
  list-style: none;
  max-height: var(--rozie-combobox-list-max-height, 16rem);
  overflow-y: auto;
  background: var(--rozie-combobox-list-bg, #fff);
  border: var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-list-border-color, rgba(0, 0, 0, 0.15));
  border-radius: var(--rozie-combobox-radius, 0.5rem);
  box-shadow: var(--rozie-combobox-list-shadow, 0 10px 24px rgba(0, 0, 0, 0.16));
}
.rozie-combobox-option {
  padding: var(--rozie-combobox-option-padding, 0.4rem 0.6rem);
  border-radius: var(--rozie-combobox-option-radius, 0.375rem);
  cursor: pointer;
  color: var(--rozie-combobox-option-color, inherit);
}
.rozie-combobox-option--active {
  background: var(--rozie-combobox-option-active-bg, rgba(0, 102, 204, 0.12));
}
.rozie-combobox-option--selected {
  font-weight: var(--rozie-combobox-option-selected-weight, 600);
  color: var(--rozie-combobox-option-selected-color, var(--rozie-combobox-accent, #0066cc));
}
.rozie-combobox-option--disabled {
  cursor: not-allowed;
  opacity: var(--rozie-combobox-option-disabled-opacity, 0.45);
}
.rozie-combobox-empty {
  padding: var(--rozie-combobox-empty-padding, 0.5rem 0.6rem);
  color: var(--rozie-combobox-empty-color, rgba(0, 0, 0, 0.5));
  list-style: none;
}
.rozie-combobox-spacer { margin: 0; padding: 0; border: 0; list-style: none; }
.rozie-combobox--inline {
  display: block;
  width: 100%;
}
.rozie-combobox--inline .rozie-combobox-list {
  position: static;
  margin-top: var(--rozie-combobox-list-gap, 0.25rem);
  border: none;
  border-radius: 0;
  box-shadow: none;
}
</style>
