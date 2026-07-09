<template>

<div :class="['rozie-listbox', { 'rozie-listbox-open': open$local, 'rozie-listbox-disabled': props.disabled, 'rozie-listbox-inline': props.inline }]" ref="__rozieRootRef" v-bind="$attrs">

  
  <div class="rozie-listbox-control" ref="controlElRef">
    <button ref="triggerElRef" type="button" class="rozie-listbox-trigger" role="combobox" aria-haspopup="listbox" :aria-expanded="(open$local) ?? undefined" :aria-controls="props.id + '-list'" :aria-activedescendant="(activeDescendant) ?? undefined" :aria-label="props.ariaLabel" :disabled="props.disabled" @click="toggle" @keydown="onControlKeyDown($event)">
      <slot name="selected" :selected="selectedLabel" :value="value">
        <span v-if="selectedLabel" class="rozie-listbox-selected">{{ selectedLabel }}</span><span v-else class="rozie-listbox-placeholder">{{ props.placeholder }}</span></slot>
      <span class="rozie-listbox-arrow" aria-hidden="true">▾</span>
    </button>
  </div>

  
  <div v-if="open$local && !props.virtual" ref="listElRef" class="rozie-listbox-list" role="listbox" :id="props.id + '-list'" :aria-label="props.ariaLabel" :aria-multiselectable="props.multiple">
    <div v-for="(opt, index) in visibleOptions()" :key="optionId(index)" :id="optionId(index)" :class="['rozie-listbox-option', { 'is-active': activeIndex === index, 'is-selected': isSelected(opt), 'is-disabled': disabledOf(opt) }]" role="option" :aria-selected="!!isSelected(opt)" :aria-disabled="!!disabledOf(opt)" @click="select(opt)" @mousemove="onOptionPointerMove(index)">
      <slot name="option" :option="opt" :index="index" :active="activeIndex === index" :selected="isSelected(opt)" :disabled="disabledOf(opt)">
        {{ labelOf(opt) }}
      </slot>
    </div>

    <div v-if="visibleOptions().length === 0" class="rozie-listbox-empty" role="presentation">
      <slot name="empty" :query="query">No options</slot>
    </div></div><div v-if="props.virtual" ref="listElRef" class="rozie-listbox-list rozie-listbox-list--virtual" role="listbox" :id="props.id + '-list'" :aria-label="props.ariaLabel" :aria-multiselectable="props.multiple" :style="(open$local ? '' : 'display:none;') + (props.maxHeight ? 'height:' + props.maxHeight + ';max-height:' + props.maxHeight + ';overflow-y:auto;--rozie-listbox-max-height:' + props.maxHeight : 'overflow-y:auto')">
    <div class="rozie-listbox-spacer" aria-hidden="true" :style="'height:' + padTop() + 'px'"></div>

    <div v-for="wr in windowedRows()" :key="wr.row.id" :id="optionId(wr.vi.index)" :data-index="wr.vi.index" :class="['rozie-listbox-option', { 'is-active': activeIndex === wr.vi.index, 'is-selected': isSelected(wr.row._opt), 'is-disabled': disabledOf(wr.row._opt) }]" role="option" :aria-selected="!!isSelected(wr.row._opt)" :aria-disabled="!!disabledOf(wr.row._opt)" @click="select(wr.row._opt)" @mousemove="onOptionPointerMove(wr.vi.index)">
      <slot name="option" :option="wr.row._opt" :index="wr.vi.index" :active="activeIndex === wr.vi.index" :selected="isSelected(wr.row._opt)" :disabled="disabledOf(wr.row._opt)">
        {{ labelOf(wr.row._opt) }}
      </slot>
    </div>

    <div class="rozie-listbox-spacer" aria-hidden="true" :style="'height:' + padBottom() + 'px'"></div>

    <div v-if="windowSource().length === 0" class="rozie-listbox-empty" role="presentation">
      <slot name="empty" :query="query">No options</slot>
    </div></div></div>

</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useOutsideClick } from '@rozie/runtime-vue';

const props = withDefaults(
  defineProps<{
    /**
     * The option set. Each entry is either a primitive (`string`/`number`) or an object; objects resolve their label, value, and disabled state via the `option*` resolver props, falling back to `.label` / `.value` / `.disabled`.
     */
    options?: any[];
    /**
     * Enable multi-select: `value` becomes an array, selecting an option toggles its membership, and the popup stays open after each commit.
     */
    multiple?: boolean;
    /**
     * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the listbox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
     */
    inline?: boolean;
    /**
     * Disable the control entirely. Also sets the Angular `ControlValueAccessor` disabled state.
     */
    disabled?: boolean;
    /**
     * Placeholder text shown in the empty control.
     */
    placeholder?: string;
    /**
     * Close the popup after a single-select commit. Defaults `true`; multi-select keeps the popup open regardless of this setting.
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
     * Stable id base for the ARIA wiring (the listbox id, per-option ids, and `aria-activedescendant`). Give each instance on a page a distinct id so these references stay unique.
     */
    id?: string;
    /**
     * Accessible name for the control when there is no visible `<label for>` pointing at its `id` (`aria-label`).
     */
    ariaLabel?: string | null;
    /**
     * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling list (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed listbox. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded.
     */
    virtual?: boolean;
    /**
     * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
     */
    estimateRowHeight?: number;
    /**
     * A CSS length string bounding the list scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-listbox-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
     */
    maxHeight?: string;
  }>(),
  { options: () => [], multiple: false, inline: false, disabled: false, placeholder: '', closeOnSelect: true, optionLabel: null, optionValue: null, optionDisabled: null, id: 'rozie-listbox', ariaLabel: null, virtual: false, estimateRowHeight: 36, maxHeight: '' }
);

/**
 * The selected value (two-way `r-model`) — a scalar in single-select, an array of values in multi-select. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Listbox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
 * @example
 * <Listbox r-model:value="fruit" :options="fruits" />
 */
const value = defineModel<unknown | null>('value', { default: null });

const emit = defineEmits<{
  'open-change': [...args: any[]];
  change: [...args: any[]];
}>();

defineSlots<{
  selected(props: { selected: any; value: any }): any;
  option(props: { option: any; index: any; active: any; selected: any; disabled: any }): any;
  empty(props: { query: any }): any;
  option(props: { option: any; index: any; active: any; selected: any; disabled: any }): any;
  empty(props: { query: any }): any;
}>();

const open$local = ref(false);
const activeIndex = ref(-1);
const query = ref('');
const rows = ref<any[]>([]);
const windowVer = ref(0);
const editVer = ref(0);

const controlElRef = ref<HTMLElement>();
const triggerElRef = ref<HTMLButtonElement>();
const listElRef = ref<HTMLElement>();
const __rozieRootRef = ref<HTMLElement>();

const selectedLabel = computed(() => {
  const cur = value.value;
  if (props.multiple) {
    // Read the model value into a local before narrowing: `$props.value` lowers
    // to a `value()` accessor on Solid, and Array.isArray() can't narrow two
    // separate calls — narrowing one stable local works on every target.
    const arr = Array.isArray(cur) ? cur : [];
    if (arr.length === 0) return '';
    return props.options.filter((o: any) => arr.includes(valueOf(o))).map(labelOf).join(', ');
  }
  const match = props.options.find((o: any) => valueOf(o) === cur);
  return match === undefined ? '' : labelOf(match);
});
const activeDescendant = computed(() => {
  if (!open$local.value || activeIndex.value < 0) return null;
  return optionId(activeIndex.value);
});

// Type-ahead buffer for the select-only listbox trigger. Module-scope
// `let`s reassigned from handlers → the React emitter hoists them to `useRef`
// so they persist across renders (the setup-once guarantee); no-op elsewhere.
// They STAY in this host (not the shared spine) per the A==B rule: reassigned
// module-`let`s + sigils live in the host; the partial only closes over them.
let typeBuffer = '';
let typeTimer: any = null;

// ---- shared list spine (P2: @rozie-ui/headless-core/listCore.rzts) ------
// The option resolvers, client filter, enabled-index navigation, the keyboard
// reducer, type-ahead, single+multi selection, open/close state, and
// activeDescendant derivation now live in the shared, focus-/input-mode
// parameterized list spine. It is a compile-time `.rzts` script-partial: it
// dissolves into this leaf via inlineScriptPartials() before IR lowering (zero
// runtime dep). Listbox consumes it in focus-model `activedescendant` +
// input-mode `select-only` + multi + type-ahead. The spine closes over this
// host's pieces by convention: the reassigned module-`let`s typeBuffer/typeTimer
// (above) and the impure ref fns focusControl/scrollActiveIntoView (below).
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
const optionId = (index: any) => props.id + '-opt-' + index;

// ---- derived state -----------------------------------------------------
// The visible option list: identity in select-only / non-filtering mode,
// a case-insensitive substring filter when a combobox query is present.
// A plain function (not `$computed`) so it reads uniformly across all six
// targets — a `$computed` is a value on React but an accessor on Solid, so
// aliasing it to a local (`const opts = visibleOptions()`) diverges; calling a
// plain function is identical everywhere.
// ---- derived state -----------------------------------------------------
// The visible option list: identity in select-only / non-filtering mode,
// a case-insensitive substring filter when a combobox query is present.
// A plain function (not `$computed`) so it reads uniformly across all six
// targets — a `$computed` is a value on React but an accessor on Solid, so
// aliasing it to a local (`const opts = visibleOptions()`) diverges; calling a
// plain function is identical everywhere.
const visibleOptions = () => {
  const q = (query.value || '').trim().toLowerCase();
  if (q === '') return props.options;
  return props.options.filter((opt: any) => labelOf(opt).toLowerCase().includes(q));
};

// The label shown in the (select-only) trigger when closed. A real `$computed`
// — read bare in the template, never aliased in script, so the per-target
// accessor form stays uniform.

// Is a given option currently selected? Multi compares array membership.
// Is a given option currently selected? Multi compares array membership.
const isSelected = (opt: any) => {
  const v = valueOf(opt);
  const cur = value.value;
  if (props.multiple) return Array.isArray(cur) && cur.includes(v);
  return cur === v;
};

// First enabled visible index, preferring the currently-selected option.
// First enabled visible index, preferring the currently-selected option.
const resolveInitialActive = () => {
  const opts = visibleOptions();
  const sel = opts.findIndex((o: any) => isSelected(o) && !disabledOf(o));
  if (sel !== -1) return sel;
  return opts.findIndex((o: any) => !disabledOf(o));
};

// ---- open / close ------------------------------------------------------
// Phase 73 item #8 (emitter-hardening batch): each of `open`/`close`/`toggle`
// $emit's directly — no longer funneled through a single wrapper. The
// former "route every emit through ONE wrapper fn" workaround guarded
// against a React duplicate `const {onOpenChange}=props` per emit-site
// (TS2451); verified against the current emitter (target-react
// `emitScript-multiEmitDedupe.test.ts`) that the shipped ITEM-1 (Phase 46)
// hoist-once dedupe already collapses N ESCAPING helpers sharing an emit
// target into exactly one destructure, and a non-escaping function (e.g.
// `open`, reachable here only via `$expose`) never destructures at all — so
// no combination of these three functions can produce the duplicate-const
// shape. See project_next_port_listbox / project_emitter_hardening_backlog.
// ---- open / close ------------------------------------------------------
// Phase 73 item #8 (emitter-hardening batch): each of `open`/`close`/`toggle`
// $emit's directly — no longer funneled through a single wrapper. The
// former "route every emit through ONE wrapper fn" workaround guarded
// against a React duplicate `const {onOpenChange}=props` per emit-site
// (TS2451); verified against the current emitter (target-react
// `emitScript-multiEmitDedupe.test.ts`) that the shipped ITEM-1 (Phase 46)
// hoist-once dedupe already collapses N ESCAPING helpers sharing an emit
// target into exactly one destructure, and a non-escaping function (e.g.
// `open`, reachable here only via `$expose`) never destructures at all — so
// no combination of these three functions can produce the duplicate-const
// shape. See project_next_port_listbox / project_emitter_hardening_backlog.
const open = () => {
  if (props.disabled) return;
  if (open$local.value) return;
  open$local.value = true;
  activeIndex.value = resolveInitialActive();
  emit('open-change', {
    open: true
  });
};
const close = () => {
  if (!open$local.value) return;
  open$local.value = false;
  activeIndex.value = -1;
  emit('open-change', {
    open: false
  });
};
const toggle = () => {
  if (open$local.value) close();else open();
};

// ---- selection ---------------------------------------------------------
// ---- selection ---------------------------------------------------------
const select = (opt: any) => {
  if (disabledOf(opt)) return;
  const v = valueOf(opt);
  if (props.multiple) {
    const cur = value.value;
    const arr = Array.isArray(cur) ? cur : [];
    // Fresh array on every commit — in-place mutation is dropped by the
    // React/Solid/Lit/Angular change detectors.
    const next = arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v];
    value.value = next;
    emit('change', {
      value: next,
      option: opt
    });
  } else {
    value.value = v;
    emit('change', {
      value: v,
      option: opt
    });
    if (props.closeOnSelect) {
      close();
      focusControl();
    }
  }
};
const clear = () => {
  const empty = props.multiple ? [] : null;
  value.value = empty;
  query.value = '';
  emit('change', {
    value: empty,
    option: null
  });
};

// ---- keyboard navigation over the VISIBLE list -------------------------
// ---- keyboard navigation over the VISIBLE list -------------------------
const nextEnabled = (from: any, dir: any) => {
  const opts = visibleOptions();
  if (opts.length === 0) return -1;
  let i = from;
  for (let step = 0; step < opts.length; step++) {
    i += dir;
    if (i < 0) i = opts.length - 1;else if (i >= opts.length) i = 0;
    if (!disabledOf(opts[i])) return i;
  }
  return from;
};
const move = (dir: any) => {
  if (!open$local.value) {
    open();
    return;
  }
  const start = activeIndex.value < 0 ? dir > 0 ? -1 : 0 : activeIndex.value;
  activeIndex.value = nextEnabled(start, dir);
  scrollActiveIntoView();
};
const moveEdge = (toEnd: any) => {
  if (!open$local.value) open();
  activeIndex.value = toEnd ? nextEnabled(-1, -1) : nextEnabled(-1, 1);
  scrollActiveIntoView();
};
const commitActive = () => {
  const opts = visibleOptions();
  if (activeIndex.value >= 0 && activeIndex.value < opts.length) select(opts[activeIndex.value]);
};

// Type-ahead for select-only listboxes: accumulate keystrokes and jump to the
// first option whose label starts with the buffer.
// Type-ahead for select-only listboxes: accumulate keystrokes and jump to the
// first option whose label starts with the buffer.
const onTypeahead = (ch: any) => {
  if (typeTimer !== null) clearTimeout(typeTimer);
  typeBuffer += ch.toLowerCase();
  typeTimer = setTimeout(() => {
    typeBuffer = '';
  }, 600);
  const opts = visibleOptions();
  const idx = opts.findIndex((o: any) => !disabledOf(o) && labelOf(o).toLowerCase().startsWith(typeBuffer));
  if (idx !== -1) {
    if (!open$local.value) open();
    activeIndex.value = idx;
    scrollActiveIntoView();
  }
};

// Key handler shared by the trigger and the combobox input. The printable-
// character branch is reached only in select-only mode (the combobox input
// types through @input).
// Key handler shared by the trigger and the combobox input. The printable-
// character branch is reached only in select-only mode (the combobox input
// types through @input).
const onControlKeyDown = ($event: any) => {
  const key = $event.key;
  if (key === 'ArrowDown') {
    $event.preventDefault();
    move(1);
  } else if (key === 'ArrowUp') {
    $event.preventDefault();
    move(-1);
  } else if (key === 'Home') {
    $event.preventDefault();
    moveEdge(false);
  } else if (key === 'End') {
    $event.preventDefault();
    moveEdge(true);
  } else if (key === 'Enter') {
    if (open$local.value) {
      $event.preventDefault();
      commitActive();
    }
  } else if (key === 'Escape') {
    if (open$local.value) {
      $event.preventDefault();
      close();
      focusControl();
    }
  } else if (key === ' ' || key === 'Spacebar') {
    // Space toggles / commits in a select-only host (a button trigger). A
    // filter-input host types the literal space into its <input> and does NOT
    // route Space through this reducer, so this branch is select-only by use.
    $event.preventDefault();
    if (!open$local.value) open();else commitActive();
  } else if (key === 'Tab') {
    if (open$local.value) close();
  } else if (key.length === 1 && !$event.metaKey && !$event.ctrlKey && !$event.altKey) {
    onTypeahead(key);
  }
};

// Combobox input handler: keep the popup open while typing, reset the active
// highlight to the first match, and surface the query for remote filtering.

// Pointer hover sets the virtual highlight (matches native <select> feel).
// Pointer hover sets the virtual highlight (matches native <select> feel).
const onOptionPointerMove = (index: any) => {
  if (activeIndex.value !== index) activeIndex.value = index;
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
// precedent — NO per-framework adapter). The static import is emitted unconditionally
// (a peer dep); every RUNTIME reference sits behind `if ($props.virtual)` / a
// `virtualizer` guard so the non-virtual emitted path executes none of it
// (byte-identical-off).
// virtual-core: the framework-agnostic windowing state machine (the data-table
// precedent — NO per-framework adapter). The static import is emitted unconditionally
// (a peer dep); every RUNTIME reference sits behind `if ($props.virtual)` / a
// `virtualizer` guard so the non-virtual emitted path executes none of it
// (byte-identical-off).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// Windowing instance state (the `let table` precedent — React hoists reassigned
// module-`let`s to useRef; do NOT const). NULL until $onMount, and ONLY constructed
// when $props.virtual. gridScrollEl is the captured .rozie-listbox-list scroll div the
// virtualizer observes; remeasurePending dedupes the deferred sweep.
// Windowing instance state (the `let table` precedent — React hoists reassigned
// module-`let`s to useRef; do NOT const). NULL until $onMount, and ONLY constructed
// when $props.virtual. gridScrollEl is the captured .rozie-listbox-list scroll div the
// virtualizer observes; remeasurePending dedupes the deferred sweep.
let virtualizer: any = null;
let virtualizerCleanup: any = null;
let gridScrollEl: any = null;
let remeasurePending = false;

// windowSource(): the windowing.rzts host-contract row source — the FILTERED option
// set. CR-02: the shared windowing contract requires each row to carry a STABLE `.id`
// (windowing.rzts virtualItemKey reads src[i].id, and the windowed template keys on
// wr.row.id). A raw Listbox option is a primitive or a bare { label, value, disabled }
// — NOT guaranteed to have `.id` — so an unwrapped raw set keyed on wr.row.id collapses
// every framework :key (and every virtual-core measurement key) to `undefined`, which
// recycles the wrong DOM node as the window scrolls. Wrap each option into an id-bearing
// row the way the sibling Combobox's filteredOptions() does — `id` is the resolved
// value, `_opt` the original option (read via wr.row._opt in the windowed template),
// `_i` the source index. Kept === $data.rows so the math's rowList[vi.index] resolves to
// the same wrapped row the count windows over.
// windowSource(): the windowing.rzts host-contract row source — the FILTERED option
// set. CR-02: the shared windowing contract requires each row to carry a STABLE `.id`
// (windowing.rzts virtualItemKey reads src[i].id, and the windowed template keys on
// wr.row.id). A raw Listbox option is a primitive or a bare { label, value, disabled }
// — NOT guaranteed to have `.id` — so an unwrapped raw set keyed on wr.row.id collapses
// every framework :key (and every virtual-core measurement key) to `undefined`, which
// recycles the wrong DOM node as the window scrolls. Wrap each option into an id-bearing
// row the way the sibling Combobox's filteredOptions() does — `id` is the resolved
// value, `_opt` the original option (read via wr.row._opt in the windowed template),
// `_i` the source index. Kept === $data.rows so the math's rowList[vi.index] resolves to
// the same wrapped row the count windows over.
const windowSource = () => visibleOptions().map((o: any, i: any) => ({
  id: valueOf(o),
  _opt: o,
  _i: i
}));

// D-05 NO-OP PIN HOOK (defined in THIS host, NOT the shared partial — keeps data-table
// A==B intact). The shared windowedRows/padTop/padBottom call pinnedEditIndex()/
// pinnedMeasurement() UNGUARDED by convention; a listbox has no edit-pinning, so these
// reduce the pin union (-1 → never unioned) and the spacer subtraction (null → identity)
// to a no-op. They MUST exist or the by-convention call ReferenceErrors at mount.
// D-05 NO-OP PIN HOOK (defined in THIS host, NOT the shared partial — keeps data-table
// A==B intact). The shared windowedRows/padTop/padBottom call pinnedEditIndex()/
// pinnedMeasurement() UNGUARDED by convention; a listbox has no edit-pinning, so these
// reduce the pin union (-1 → never unioned) and the spacer subtraction (null → identity)
// to a no-op. They MUST exist or the by-convention call ReferenceErrors at mount.
const pinnedEditIndex = () => -1;
const pinnedMeasurement = (pin: any) => null;

// Keep $data.rows === windowSource() so the windowing math indexes the live option set.
// Keep $data.rows === windowSource() so the windowing math indexes the live option set.
const syncRows = () => {
  rows.value = windowSource();
};

// Defer remeasureWindow() until AFTER the framework commits the recycled window
// (onChange fires BEFORE React/Solid commit). TWO deferred passes (microtask THEN rAF)
// behind one in-flight flag (the data-table virtualization.rzts:46-56 pattern, copied
// per-consumer per D-04/D-09): the microtask catches Solid's <For> / Svelte's {#each}
// SYNCHRONOUS commit (the Phase 63 Solid under-convergence hazard — D-09 rAF-defer
// budget), the rAF catches React's async commit. measureElement is idempotent on an
// already-observed node, so running both is cheap and loop-free.
// Defer remeasureWindow() until AFTER the framework commits the recycled window
// (onChange fires BEFORE React/Solid commit). TWO deferred passes (microtask THEN rAF)
// behind one in-flight flag (the data-table virtualization.rzts:46-56 pattern, copied
// per-consumer per D-04/D-09): the microtask catches Solid's <For> / Svelte's {#each}
// SYNCHRONOUS commit (the Phase 63 Solid under-convergence hazard — D-09 rAF-defer
// budget), the rAF catches React's async commit. measureElement is idempotent on an
// already-observed node, so running both is cheap and loop-free.
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
// true (variable) height is observed (virtual-core measures ONLY nodes passed to
// measureElement, keyed by the data-index attribute). Bails during a programmatic
// scroll (scrollToIndex) so a measure can't starve the scroll target.
// measureElement sweep: hand every rendered windowed option to the virtualizer so its
// true (variable) height is observed (virtual-core measures ONLY nodes passed to
// measureElement, keyed by the data-index attribute). Bails during a programmatic
// scroll (scrollToIndex) so a measure can't starve the scroll target.
const remeasureWindow = () => {
  if (!virtualizer || !gridScrollEl) return;
  if (virtualizer.scrollState) return;
  const els = gridScrollEl.querySelectorAll('.rozie-listbox-option[data-index]');
  for (const el of els as any) virtualizer.measureElement(el);
};

// ---- focus / scroll helpers (post-mount $refs only) --------------------
// Impure ($refs) → per the ROZ123 + A==B rules they stay in the host (the spine
// only closes over them). Named `focusControl` (not `focus`): a `focus` $expose
// verb would override the inherited HTMLElement.focus method on the Lit element.
// ---- focus / scroll helpers (post-mount $refs only) --------------------
// Impure ($refs) → per the ROZ123 + A==B rules they stay in the host (the spine
// only closes over them). Named `focusControl` (not `focus`): a `focus` $expose
// verb would override the inherited HTMLElement.focus method on the Lit element.
const focusControl = () => {
  triggerElRef.value?.focus();
};

// Keep the active option visible inside the scrolling listbox. Reads $refs in
// a post-mount callback only (never eagerly — ROZ123). When windowing, route through
// the virtualizer (scrollToIndex) so an active option OUTSIDE the rendered window is
// scrolled into view (the windowed-arrow-nav seam); else the native scrollIntoView.
// Keep the active option visible inside the scrolling listbox. Reads $refs in
// a post-mount callback only (never eagerly — ROZ123). When windowing, route through
// the virtualizer (scrollToIndex) so an active option OUTSIDE the rendered window is
// scrolled into view (the windowed-arrow-nav seam); else the native scrollIntoView.
const scrollActiveIntoView = () => {
  if (activeIndex.value < 0) return;
  if (props.virtual && virtualizer) {
    // 'center' (not 'auto'): keep the active option well inside the rendered slice as the
    // window scrolls — 'auto' lands it at the viewport edge where the overscan band can
    // leave it just-unrendered for a frame on the fine-grained targets (Solid).
    virtualizer.scrollToIndex(activeIndex.value, {
      align: 'center'
    });
    scheduleRemeasure();
    return;
  }
  if (!listElRef.value) return;
  const el = listElRef.value!.querySelector('#' + CSS.escape(optionId(activeIndex.value)));
  el?.scrollIntoView({
    block: 'nearest'
  });
};

// ---- windowing lifecycle (post-mount; ONLY when virtual) ----------------
// kickWindow: the cross-target first-paint settle. Re-captures the LIVE scroll element,
// re-feeds the CURRENT option count into the virtualizer, re-attaches its rect observer
// (_willUpdate), and bumps the windowVer signal so the windowed <For>/{#each}/repeat
// re-derives. Retried over a few frames because (a) virtual-core measures the scroll rect
// asynchronously (D-09 Solid rAF-defer — a synchronous kick sees rectH 0 → empty window),
// (b) Solid/Lit recreate the list node between mount and first commit (leaving virtual-core's
// scrollElement stale), and (c) the consumer often seeds options AFTER the listbox mounts
// (Lit/React), so the count must be re-read once the prop propagates. Stops once the window
// paints (or attempts run out) — idempotent + loop-free.
// ---- windowing lifecycle (post-mount; ONLY when virtual) ----------------
// kickWindow: the cross-target first-paint settle. Re-captures the LIVE scroll element,
// re-feeds the CURRENT option count into the virtualizer, re-attaches its rect observer
// (_willUpdate), and bumps the windowVer signal so the windowed <For>/{#each}/repeat
// re-derives. Retried over a few frames because (a) virtual-core measures the scroll rect
// asynchronously (D-09 Solid rAF-defer — a synchronous kick sees rectH 0 → empty window),
// (b) Solid/Lit recreate the list node between mount and first commit (leaving virtual-core's
// scrollElement stale), and (c) the consumer often seeds options AFTER the listbox mounts
// (Lit/React), so the count must be re-read once the prop propagates. Stops once the window
// paints (or attempts run out) — idempotent + loop-free.
const kickWindow = (attempts: any) => {
  if (!virtualizer) return;
  gridScrollEl = __rozieRootRef.value ? __rozieRootRef.value!.querySelector('.rozie-listbox-list') : gridScrollEl;
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

onMounted(() => {
  syncRows();
  if (props.virtual) {
    // The list renders at mount when virtual, so the .rozie-listbox-list scroll container
    // exists here. Capture it via $el.querySelector (the data-table gridScrollEl precedent,
    // proven ×6 incl Lit shadow + Solid) — $refs on a conditionally-rendered node is null on
    // Solid/Lit, which leaves the virtualizer with no scroll element.
    gridScrollEl = __rozieRootRef.value ? __rozieRootRef.value!.querySelector('.rozie-listbox-list') : null;
    virtualizer = new Virtualizer(virtualizerOptions());
    virtualizerCleanup = virtualizer._didMount();
    windowVer.value = windowVer.value + 1;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => kickWindow(8));else setTimeout(() => kickWindow(8), 0);
  }
});
onBeforeUnmount(() => {
  if (typeTimer !== null) clearTimeout(typeTimer);
  // Tear down the virtualizer's scroll-element ResizeObserver (no-op when virtual off).
  if (virtualizerCleanup) virtualizerCleanup();
});

watch(() => (props.options ? props.options.length : 0) + '|' + query.value, () => {
  syncRows();
  if (props.virtual && virtualizer) {
    gridScrollEl = __rozieRootRef.value ? __rozieRootRef.value!.querySelector('.rozie-listbox-list') : gridScrollEl;
    virtualizer.setOptions(virtualizerOptions());
    virtualizer._willUpdate();
    windowVer.value = windowVer.value + 1;
    scheduleRemeasure();
  }
});

defineExpose({ open, close, toggle, clear, focusControl });

useOutsideClick(
  [controlElRef, listElRef],
  () => close(),
  () => open$local.value,
);
</script>

<style scoped>
.rozie-listbox {
  position: relative;
  display: inline-block;
  min-width: var(--rozie-listbox-min-width, 12rem);
  font: var(--rozie-listbox-font, inherit);
}
.rozie-listbox-control { display: block; }
.rozie-listbox-input,
.rozie-listbox-trigger {
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-listbox-gap, 0.5rem);
  padding: var(--rozie-listbox-control-padding, 0.5rem 0.75rem);
  font: inherit;
  text-align: left;
  background: var(--rozie-listbox-bg, #fff);
  color: var(--rozie-listbox-fg, #1a1a1a);
  border: var(--rozie-listbox-border-width, 1px) solid var(--rozie-listbox-border, rgba(0, 0, 0, 0.2));
  border-radius: var(--rozie-listbox-radius, 6px);
  cursor: pointer;
}
.rozie-listbox-input { cursor: text; }
.rozie-listbox-input:focus-visible,
.rozie-listbox-input:focus,
.rozie-listbox-trigger:focus-visible,
.rozie-listbox-trigger:focus {
  outline: var(--rozie-listbox-ring-width, 2px) solid var(--rozie-listbox-ring, var(--rozie-listbox-accent, #0066cc));
  outline-offset: var(--rozie-listbox-ring-offset, 1px);
}
.rozie-listbox-disabled { opacity: var(--rozie-listbox-disabled-opacity, 0.6); pointer-events: none; }
.rozie-listbox-placeholder { color: var(--rozie-listbox-placeholder, rgba(0, 0, 0, 0.45)); }
.rozie-listbox-arrow {
  font-size: 0.75em;
  color: var(--rozie-listbox-arrow-color, currentColor);
  opacity: var(--rozie-listbox-arrow-opacity, 0.7);
}
.rozie-listbox-list {
  position: absolute;
  z-index: var(--rozie-listbox-z, 1000);
  top: calc(100% + var(--rozie-listbox-popup-offset, 4px));
  left: 0;
  right: 0;
  margin: 0;
  padding: var(--rozie-listbox-popup-padding, 0.25rem);
  max-height: var(--rozie-listbox-max-height, 16rem);
  overflow-y: auto;
  list-style: none;
  background: var(--rozie-listbox-popup-bg, var(--rozie-listbox-bg, #fff));
  color: var(--rozie-listbox-fg, #1a1a1a);
  border: var(--rozie-listbox-border-width, 1px) solid var(--rozie-listbox-popup-border, var(--rozie-listbox-border, rgba(0, 0, 0, 0.15)));
  border-radius: var(--rozie-listbox-popup-radius, var(--rozie-listbox-radius, 6px));
  box-shadow: var(--rozie-listbox-shadow, 0 6px 24px rgba(0, 0, 0, 0.12));
}
.rozie-listbox-inline {
  display: block;
  width: 100%;
}
.rozie-listbox-inline .rozie-listbox-list {
  position: static;
  margin-top: var(--rozie-listbox-popup-offset, 4px);
  border: none;
  border-radius: 0;
  box-shadow: none;
}
.rozie-listbox-option {
  padding: var(--rozie-listbox-option-padding, 0.4rem 0.6rem);
  border-radius: var(--rozie-listbox-option-radius, 4px);
  color: var(--rozie-listbox-option-fg, inherit);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-listbox-gap, 0.5rem);
}
.rozie-listbox-option.is-active {
  background: var(--rozie-listbox-active-bg, rgba(0, 102, 204, 0.12));
  color: var(--rozie-listbox-active-fg, inherit);
}
.rozie-listbox-option.is-selected {
  background: var(--rozie-listbox-selected-bg, transparent);
  color: var(--rozie-listbox-selected-fg, inherit);
  font-weight: var(--rozie-listbox-selected-weight, 600);
}
.rozie-listbox-option.is-selected::after {
  content: var(--rozie-listbox-check, '✓');
  color: var(--rozie-listbox-check-color, var(--rozie-listbox-accent, #0066cc));
}
.rozie-listbox-option.is-disabled { opacity: var(--rozie-listbox-disabled-opacity, 0.45); cursor: not-allowed; }
.rozie-listbox-empty { padding: var(--rozie-listbox-option-padding, 0.5rem 0.6rem); color: var(--rozie-listbox-empty-fg, rgba(0, 0, 0, 0.5)); }
.rozie-listbox-spacer { margin: 0; padding: 0; border: 0; flex: none; }
</style>
