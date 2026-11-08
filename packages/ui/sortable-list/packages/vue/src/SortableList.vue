<template>

<div class="rozie-sortable-wrap" v-bind="$attrs">
  <div :class="['rozie-sortable-list', props.listClass]" ref="listElRef" part="list" role="list" :aria-label="(props.listLabel) ?? undefined" :aria-orientation="props.orientation === 'horizontal' ? 'horizontal' : 'vertical'">
    <slot name="header"></slot>
    <div v-for="(item, index) in items" :key="keyFor(item, index)" :class="['rozie-sortable-item', itemClassFor(item, index), liftedIndex === index ? 'rozie-sortable-item-lifted' : '']" :style="itemStyleFor(item, index)" :data-id="keyFor(item, index)" role="listitem" :tabindex="(rowTabbable() ? 0 : undefined) ?? undefined" :aria-describedby="(rowTabbable() ? instructionsId : undefined) ?? undefined" @keydown="onRowKeyDown($event, index)">
      <slot :item="item" :index="index" :instructionsId="instructionsId"></slot>
    </div>
    <slot name="footer"></slot>
  </div>
  <div class="rozie-sortable-aria-live" data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true">{{ ariaLiveText }}</div>
  <span hidden :id="instructionsId">{{ instructionsText() }}</span>
</div>

</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The per-row key the framework reconciler tracks each item by across a reorder — either a property name (e.g. `itemKey="id"` reads `item.id`) or an `(item, index) => key` function. With neither, id-less object items get a stable synthetic key via an internal `WeakMap` (survives reorder by object identity); primitive items fall back to index — pass a function for reorderable duplicate primitives.
     */
    itemKey?: string | ((...args: any[]) => any) | null;
    /**
     * CSS selector identifying the per-row drag handle, so a drag starts only from that element rather than anywhere in the row. Authored class names render literally on every target (React included), so a plain `.grip` works; `$classSelector('grip')` is an optional, typo-checked way to author it.
     */
    handle?: string | null;
    /**
     * SortableJS group name enabling cross-list drag — two lists sharing a `group` accept items between each other (the source fires `remove`, the destination fires `add`). Set `cloneable: true` to flip a string group into clone-mode.
     */
    group?: string | null;
    /**
     * Reorder animation duration in milliseconds. `0` disables the animation. Runtime-updatable.
     */
    animation?: number;
    /**
     * Temporarily disable dragging without unmounting — reapplied live via `instance.option('disabled', v)` (no remount). Also suppresses keyboard reordering: a disabled list is not sortable by any input, so rows lose their `tabindex` and the keydown handler no-ops.
     */
    disabled?: boolean;
    /**
     * Opt out of keyboard reordering (Space lift / Arrow move / Esc cancel / Enter drop) while leaving pointer drag enabled. Rows drop out of the tab order (no `tabindex`) and the keydown handler no-ops. Keyboard access is gated on `!disabled && !disableKeyboard`.
     */
    disableKeyboard?: boolean;
    /**
     * Which element drives keyboard reordering. `'row'` (default): rows are tab stops and the keys on the focused row drive reordering. `'handle'`: rows are NOT tab stops, and only keys pressed inside the element matched by `handle` (inside that row) drive the same Space/Enter lift-drop, Arrow move and Escape cancel flow; handled keys call preventDefault so a handle `<button>`'s click does not fire. The consumer owns the handle markup (recommended: a `<button>` with its own aria-label such as "Reorder Hero banner") and the component adds no tabindex or role to slot content. `'handle'` without `handle` turns keyboard reordering off and logs a console warning. `disabled`/`disableKeyboard` still apply. Any value other than `'handle'` behaves as `'row'`.
     */
    keyboardTrigger?: string;
    /**
     * Verbatim SortableJS options pass-through for anything not covered by the named props. The named props win on key conflict but `options` lands AFTER them in the merge so consumers can override defaults; handler keys (`onStart`, `onEnd`, `onUpdate`, `onAdd`, `onRemove`, `onClone`) are stripped — the helper owns those paths.
     */
    options?: Record<string, any>;
    /**
     * Optional `(item, idx) => string` returning the screen-reader label for the aria-live announcer during keyboard drag. Defaults to `item.label` (or `String(item)` when no `label` field exists).
     */
    labelFor?: ((...args: any[]) => any) | null;
    /**
     * Class name applied to the drop-placeholder (ghost) element while dragging. Forwarded live via `instance.option`, so toggling it at runtime takes effect without a remount.
     */
    ghostClass?: string | null;
    /**
     * Class name applied to the currently-chosen item while dragging. Forwarded live via `instance.option` (no remount needed to change it).
     */
    chosenClass?: string | null;
    /**
     * Class name applied to the dragging element. Only takes effect in fallback mode (`forceFallback: true`). Forwarded live via `instance.option`.
     */
    dragClass?: string | null;
    /**
     * CSS selector that prevents drag initiation on matching rows (locked items). SortableJS checks it at `mousedown`/`touchstart` and aborts the drag if it matches. A `data-*` attribute selector (e.g. `[data-locked]`) is the most robust choice across all targets.
     */
    filter?: string | null;
    /**
     * CSS easing function for the reorder animation (e.g. `'ease-in'`, `'cubic-bezier(0.4, 0, 0.2, 1)'`). Runtime-updatable.
     */
    easing?: string | null;
    /**
     * Force SortableJS's mouse-event drag path over HTML5 DnD — useful for touch devices, consistent cross-browser behavior, and synthetic test drivers (and `dragClass` only applies in this mode). **Construction-time only**: SortableJS reads it once at construction, so re-key the `<SortableList>` to toggle it at runtime.
     */
    forceFallback?: boolean;
    /**
     * SortableJS swap threshold (0..1) — a lower value makes rows swap earlier as the dragged item overlaps a neighbor. Reapplied live via `instance.option('swapThreshold', v)` — SortableJS reads it on every dragover, so no remount is needed.
     */
    swapThreshold?: number;
    /**
     * High-level prop that REPLACES a string `group` with SortableJS's `{ name, pull: 'clone', put: true }` clone-mode object form — the source deposits a COPY onto the destination and keeps its own array unchanged (the palette → canvas pattern). With `group: null` it is a no-op (a clone-mode list with no group name has no peer to clone into). Reapplied live — toggling `cloneable` (or changing `group`) recomputes the clone-mode shape and reapplies it via `instance.option('group', …)`, no remount.
     */
    cloneable?: boolean;
    /**
     * Extra class(es) merged onto the list container (the SortableJS root) alongside the base `rozie-sortable-list` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding), normalized identically across all six targets — the hook for bridging a CSS framework (`.list-group`) or a flex/grid parent onto the component.
     */
    listClass?: string | any[] | Record<string, any>;
    /**
     * Extra class(es) merged onto every item row alongside the base `rozie-sortable-item` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding) applied uniformly, OR an `(item, index) => class` function for per-row classes evaluated at render time. Normalized identically across all six targets.
     */
    itemClass?: string | any[] | Record<string, any> | ((...args: any[]) => any);
    /**
     * The list's human name, such as `"Top sidebar"`. Sets `aria-label` on the list container (`role="list"`) and names the list in keyboard announcements. Pass the same words as the zone's visible heading. With no label, announcements fall back to a neutral `list 2 of 3`.
     */
    listLabel?: string | null;
    /**
     * Which arrow keys move a lifted row within the list: `'vertical'` (default) uses ↑/↓, `'horizontal'` uses ←/→. Also sets `aria-orientation` on the list container.
     */
    orientation?: string;
    /**
     * How many positions Page Up / Page Down move a lifted row. The move stops at the first or last position when fewer rows remain.
     */
    pageStep?: number;
    /**
     * Replaces the spoken keyboard instructions. The text sits in a hidden element referenced by `aria-describedby` from each tabbable row (row mode) or from the consumer's handle via the `instructionsId` slot prop (handle mode). Default: "Press Space or Enter to pick up. Use the arrow keys to move, Home and End to jump, and Escape to cancel." When `group` is set the default adds "Hold Shift with an arrow key to move to another list."
     */
    keyboardInstructions?: string | null;
    /**
     * Per-row inline style applied to the `.rozie-sortable-item` wrapper. Accepts a CSS `String`, a flat style object (`Record<string, string | number>`), or an `(item, index) => string | object` function for per-row styling. Because it lands on the wrapper — the direct child of the list container — it can drive CSS-grid placement (`grid-column` / `grid-row` / `align-self`) when `listClass` sets `display: grid`. Normalized per target; `null` / empty drops the attribute.
     */
    itemStyle?: string | Record<string, any> | ((...args: any[]) => any) | null;
  }>(),
  { itemKey: null, handle: null, group: null, animation: 150, disabled: false, disableKeyboard: false, keyboardTrigger: 'row', options: () => ({}), labelFor: null, ghostClass: null, chosenClass: null, dragClass: null, filter: null, easing: null, forceFallback: false, swapThreshold: 1, cloneable: false, listClass: '', itemClass: '', listLabel: null, orientation: 'vertical', pageStep: 5, keyboardInstructions: null, itemStyle: null }
);

const __rozieVm = getCurrentInstance()!;
/** Whether the consumer binds a value (not `undefined`) to the two-way prop `name`. */
const __rozieBound = (name: string): boolean => {
  const raw = __rozieVm.vnode.props;
  if (!raw) return false;
  const kebab = name.replace(/\B([A-Z])/g, '-$1').toLowerCase();
  return (name in raw ? raw[name] : raw[kebab]) !== undefined;
};
/**
 * The bound items array. The sole `model: true` prop — two-way bind it (`r-model:items` / `v-model:items` / `bind:items` / `[(items)]`) and SortableList writes the re-ordered array back whenever a drag, cross-list move, or keyboard reorder commits, with no manual `onChange → setState` wiring.
 * @example
 * <SortableList v-model:items="todos" itemKey="id" />
 */
const __rozieModel_items = defineModel<any[]>('items', { default: () => [] });
const items = computed<any[]>({
  get: () => __rozieModel_items.value,
  set: (v) => { if (__rozieBound('items')) __rozieVm.emit('update:items', v); else __rozieModel_items.value = v; },
});

const emit = defineEmits<{
  change: [...args: any[]];
  add: [...args: any[]];
  remove: [...args: any[]];
  start: [...args: any[]];
  end: [...args: any[]];
}>();

defineSlots<{
  header(props: {  }): any;
  default(props: { item: any; index: any; instructionsId: any }): any;
  footer(props: {  }): any;
}>();

const liftedIndex = ref<any>(null);
const ariaLiveText = ref('');

const listElRef = ref<HTMLElement>();

import { useSortableJS } from './internal/useSortableJS';
import { getKeyboardRegistry, nextInstructionsId } from './internal/keyboardRegistry';
let instance: any = null;
// Keyboard lift state lives in the shared registry (one active keyboard lift
// per page, so a later task can hand a lifted row between lists).
// `$data.liftedIndex` is only its mirror, for the lifted-row styling.
// (The row :class adds that class as a plain string entry, not a nested
// `{ cls: cond }` object: Angular's [class] binding drops objects nested in an
// array, so the lifted class never applied there.)
const registry = getKeyboardRegistry();
// This list's registry entry (a ListEntry), built and registered in $onMount.
let entry: any = null;
let unregisterEntry: any = null;
// Removes the listeners that keep SortableJS's own DOM events inside the list.
let unhookNativeEvents: any = null;
// SortableJS also dispatches its events as BUBBLING native DOM events
// (`start`, `end`, `change`, `add`, …) on the list element, before it calls
// the option callbacks. Angular's `(start)` / `(change)` output bindings on the
// component host also catch native DOM events of the same name, so an Angular
// consumer got the raw SortableJS event as an extra `start`, plus a native
// `change` on every mid-drag position change. The component re-emits the
// committed events itself, so stop the raw ones at the list element (only
// events dispatched ON the list — an `<input>`'s own `change` is untouched).
const SORTABLE_DOM_EVENTS = ['choose', 'unchoose', 'start', 'end', 'add', 'update', 'sort', 'remove', 'filter', 'clone', 'change', 'select', 'deselect'];
// Per-instance id of the hidden spoken-instructions element. Assigned once
// per instance: it is also read in $onMount (the registry entry), which makes
// the React emitter keep it across renders instead of minting a new id each
// render.
const instructionsId = nextInstructionsId();
const DEFAULT_INSTRUCTIONS = 'Press Space or Enter to pick up. Use the arrow keys to move, Home and End to jump, and Escape to cancel.';
const GROUP_INSTRUCTIONS = ' Hold Shift with an arrow key to move to another list.';
const instructionsText = () => {
  if (props.keyboardInstructions != null) return props.keyboardInstructions;
  return props.group != null ? DEFAULT_INSTRUCTIONS + GROUP_INSTRUCTIONS : DEFAULT_INSTRUCTIONS;
};
// Instance-scoped synthetic-id store for id-less object items. Keyed by object
// IDENTITY, so the same object keeps its synthetic id across a reorder (the
// framework reconciler then rebinds the row component instance to its ORIGINAL
// item, not its slot position — the data-corruption fix).
//
// Phase 73 item #11-b removed the former "fold the WeakMap + counter into ONE
// member-mutated object const" workaround: `hoistModuleLet`'s reachability
// walk now also roots at helpers called ONLY from a template expression
// (`keyFor` is called from `:key`/`:data-id`, never from a hook), so the bare
// `let __rowKeySeq = 0` below hoists to a `useRef` on React exactly like the
// hook-reached case — no more per-render reset. Verified in codegen.
const __rowKeyMap = new WeakMap();
let __rowKeySeq = 0;
// 4-tier per-row key precedence. Its return feeds BOTH :key and :data-id.
const keyFor = (item: any, index: any) => {
  // (a) function itemKey: consumer-supplied (item, index) => key.
  if (typeof props.itemKey === 'function') {
    return props.itemKey(item, index);
  }
  // (b) string itemKey: a property name on a non-null object item.
  if (typeof props.itemKey === 'string' && item !== null && typeof item === 'object' && item[props.itemKey] != null) {
    return item[props.itemKey];
  }
  // (c) id-less object (or function) item: assign-on-first-sight WeakMap
  //     synthetic id. Survives reorder because it is keyed by object identity.
  if (item !== null && typeof item === 'object' || typeof item === 'function') {
    if (!__rowKeyMap.has(item)) {
      __rowKeyMap.set(item, '__rk' + __rowKeySeq++);
    }
    return __rowKeyMap.get(item);
  }
  // (d) primitive item: fall back to index. NOTE: duplicate primitives are
  //     unsafe to reorder this way — pass a function itemKey for those.
  return index;
};
// Resolve the SortableJS `group` option: `cloneable` is a high-level Rozie
// prop that REPLACES a string `group` with SortableJS's
// `{ name, pull: 'clone', put: true }` clone-mode object form. When
// `cloneable:false`, pass `$props.group` through verbatim. When
// `cloneable:true` AND `$props.group` is null, leave it null — a clone-mode
// list without a group name is not meaningful (no peer list can join the
// cross-list flow). Shared by $onMount construction AND the group/cloneable
// $watch reconcile below — single source of truth, no duplicated ternary.
const resolveGroup = () => props.cloneable && typeof props.group === 'string' ? {
  name: props.group,
  pull: 'clone' as const,
  put: true as const
} : props.group ?? undefined;
// Resolve itemClass for a row: a static value (string | array | object) OR a
// per-row (item, index) => class function. The result is fed into the :class
// array and normalized by each target's class path (rozieClass / clsx / native).
const itemClassFor = (item: any, index: any) => {
  const v = props.itemClass;
  return typeof v === 'function' ? v(item, index) : v;
};
// Resolve itemStyle for a row: a static value (string | object) OR a per-row
// (item, index) => style function. Returns string | object | null; the dynamic
// :style binding normalizes it per target. null / empty → attribute dropped.
const itemStyleFor = (item: any, index: any) => {
  const s = typeof props.itemStyle === 'function' ? props.itemStyle(item, index) : props.itemStyle;
  return s == null || s === '' ? null : s;
};
// Read the display label for an item — used by the aria-live announcer.
// Phase 16 R7 / D-08: $props.labelFor reads as `null` on all 6 targets when
// the consumer omits it (Plan 16-01 prop-default coercion fix); the check is
// a plain null compare — NO runtime callable-type coercion.
const labelOf = (item: any, idx: any) => {
  if (props.labelFor !== null) return props.labelFor(item, idx);
  if (item !== null && typeof item === 'object' && 'label' in item) return item.label;
  return String(item);
};
// Keyboard handler (Phase 16 R7): Space/Enter lift and drop; while lifted,
// ArrowUp/ArrowDown (ArrowLeft/ArrowRight when horizontal), Home/End and
// PageUp/PageDown move the row, and Escape returns it to where it was lifted
// from. The lift itself lives in the shared keyboard registry. After
// any array-reorder write, refocusRow() keeps focus on the moved row (or its
// handle) on all six targets.
//
// Note: `index` is passed directly as a number. Plan 16-02 (Solid call-arg
// accessor unwrap) ensures Solid's <For> alias unwraps to `index()` at the
// call site — no runtime callable-type coercion needed in user source.
// Keyboard reordering is available only when the list is not disabled AND the
// `disableKeyboard` opt-out is off. Drives BOTH the row tabindex (rows are
// focusable only when reorderable) and the onRowKeyDown guard below. Reads
// straight off $props so the tabindex binding re-evaluates reactively when
// `disabled`/`disableKeyboard` toggle at runtime.
const keyboardEnabled = () => !props.disabled && !props.disableKeyboard;
// keyboardTrigger='handle' mode: rows are not tab stops and the keys are read
// from the consumer's handle element instead. Any other value is 'row' mode.
const handleMode = () => props.keyboardTrigger === 'handle';
// Rows are tab stops only in row mode (and only while keyboard is enabled).
const rowTabbable = () => keyboardEnabled() && !handleMode();
// One-time-per-change dev warning: handle mode needs a handle selector. Without
// one the keyboard is OFF (see the onRowKeyDown gate) — never a silent fallback
// to row mode, which would re-introduce the tab stops the consumer opted out of.
const warnIfHandleMissing = () => {
  if (handleMode() && props.handle == null) {
    console.warn('[rozie-sortable-list] keyboardTrigger is "handle" but no handle selector is set, so keyboard reordering is off. Pass a handle selector (e.g. handle=".grip") or use keyboardTrigger "row".');
  }
};
// True only when a keydown originated inside a `handle` element that belongs to
// THIS row. Walks the COMPOSED ancestor chain from the event target up to (but
// excluding) the row (currentTarget): assignedSlot -> parentNode -> shadow host.
// Plain closest()/contains() stop at a shadow boundary, and Lit renders a Rozie
// consumer's slot content inside the SortableList shadow root while plain-HTML
// consumers project light-DOM nodes through a <slot>. composedPath() is not
// used because React's synthetic event does not expose it. Another
// .rozie-sortable-item met first means the key came from a NESTED list's row,
// which must not reorder this (outer) list.
const isHandleKeyOrigin = ($event: any) => {
  const sel = props.handle;
  if (sel == null) return false;
  const row = $event.currentTarget;
  let n: any = $event.target;
  while (n && n !== row) {
    if (n.nodeType === 1) {
      if (n.matches(sel)) {
        // Matched a handle: it counts only if this row is reachable from here
        // without crossing a different sortable item.
        let m: any = n.assignedSlot ?? n.parentNode ?? n.host;
        while (m && m !== row) {
          if (m.nodeType === 1 && m.classList.contains('rozie-sortable-item')) return false;
          m = m.assignedSlot ?? m.parentNode ?? m.host;
        }
        return m === row;
      }
      if (n.classList.contains('rozie-sortable-item')) return false;
    }
    n = n.assignedSlot ?? n.parentNode ?? n.host;
  }
  return false;
};
// Put focus back on the MOVED row (row mode) or its handle (handle mode) after
// a reorder write. Looks the row up by KEY (data-id), not by index, so it finds
// the moved row whether this runs before the framework commit (the row element
// is the same one) or after it (Svelte/Solid/Lit re-create the DOM) — and it is
// correct for index-keyed primitive lists too. Direct children of the list
// container only: that skips nested-list rows and the header/footer slot
// content.
//
// Two passes. (1) A microtask covers targets that commit synchronously or in an
// earlier microtask (Vue's scheduler flush is queued by the model write, before
// this one). (2) A timer + rAF "heal" pass covers targets whose DOM commit is
// scheduled AFTER the key handler returns (Angular): the commit can MOVE the
// focused row, and moving a focused node blurs it, so a Home/End/Escape jump or
// a rapid Space/Arrow/Arrow/Space burst would otherwise end with focus on
// <body>. The heal pass never steals: it acts only when focus has been lost to
// <body>. (`$restoreFocus(selector, index)` is not enough here: it is a no-op on
// Vue/Angular, where a long jump moves the focused row itself, and it looks the
// row up by index, which can land on a neighbour on Lit.) The $refs read
// happens here, synchronously, inside an event handler — which is safe.
const refocusRow = (item: any, idx: any) => {
  const listEl = listElRef.value;
  const sel = props.handle;
  const useHandle = handleMode();
  const key = String(keyFor(item, idx));
  const focusIt = (onlyIfLost: any) => {
    if (!listEl) return;
    if (useHandle && sel == null) return;
    if (onlyIfLost && document.activeElement && document.activeElement !== document.body) return;
    for (const row of Array.from(listEl.children) as any[]) {
      if (row.getAttribute('data-id') === key) {
        const target = useHandle ? row.querySelector(sel) : row;
        if (target && typeof target.focus === 'function') target.focus();
        return;
      }
    }
  };
  queueMicrotask(() => focusIt(false));
  setTimeout(() => focusIt(true), 0);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => focusIt(true));
};
// The row element carrying `data-id === key` among a list element's direct
// children (skips nested-list rows and header/footer slot content).
const rowByKey = (listEl: any, key: any) => {
  if (!listEl || key == null) return null;
  for (const row of Array.from(listEl.children) as any[]) {
    if (row.getAttribute('data-id') === key) return row;
  }
  return null;
};
// Keyboard `start` / `end` payload, shaped like SortableJS's pointer event:
// `item` is the row element, `data` the item value. `start` fires from the
// origin list (`from`), `end` from the list the row ends up in (`to`). Reads
// the lift, so call it while `registry.lift` is still set.
const keyboardStartEnd = (name: any, from: any, to: any, oldIndex: any, newIndex: any) => {
  const lift = registry.lift;
  const host = name === 'start' ? from : to;
  const payload = {
    interaction: 'keyboard',
    item: lift ? rowByKey(host.el, lift.key) : null,
    data: lift ? lift.data : null,
    from: from.el,
    to: to.el,
    oldIndex,
    newIndex
  };
  host.emit(name, payload);
};
// Move the lifted row to `toIndex` (clamped) within the list holding it.
// Works through the registry entry, so it acts on the current holder.
const moveLiftTo = (toIndex: any) => {
  const lift = registry.lift;
  if (!lift) return;
  const h = lift.holder;
  const from = registry.indexOfLift();
  if (from < 0) {
    // The lifted item is no longer in its list (the consumer changed the
    // items). End the lift without writing anything.
    registry.lift = null;
    h.setLifted(null);
    return;
  }
  const items = h.items();
  const to = Math.max(0, Math.min(items.length - 1, toIndex));
  if (to === from) return;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  h.write(next);
  // Index keys (primitive items without itemKey) change with the position.
  lift.key = h.keyOf(moved, to);
  h.setLifted(to);
  // Name the row that MOVED from the local `moved` item: on React/Vue/Lit the
  // items prop still holds the pre-write array here.
  h.announce('Moved ' + labelOf(moved, to) + ' to position ' + (to + 1));
  h.focusRow(moved, to);
  h.emit('change', {
    oldIndex: from,
    newIndex: to,
    item: moved,
    interaction: 'keyboard'
  });
};
// End the active keyboard lift. 'drop' leaves the row where it is; 'cancel'
// returns it to the position it was lifted from. Emits `end` once.
const endLift = (kind: any) => {
  const lift = registry.lift;
  if (!lift) return;
  const h = lift.holder;
  const origin = lift.origin;
  const at = registry.indexOfLift();
  if (at < 0) {
    registry.lift = null;
    h.setLifted(null);
    return;
  }
  const items = h.items();
  const item = items[at];
  let finalIndex = at;
  if (kind === 'drop') {
    h.announce('Dropped ' + labelOf(item, at) + ' at position ' + (at + 1));
  } else if (h === origin.list) {
    const to = Math.max(0, Math.min(items.length - 1, origin.index));
    if (to !== at) {
      const next = [...items];
      next.splice(at, 1);
      next.splice(to, 0, item);
      h.write(next);
      lift.key = h.keyOf(item, to);
      h.focusRow(item, to);
      h.emit('change', {
        oldIndex: at,
        newIndex: to,
        item,
        interaction: 'keyboard'
      });
    }
    finalIndex = to;
    h.announce('Cancelled. ' + labelOf(item, to) + ' returned to position ' + (to + 1));
  }
  h.setLifted(null);
  keyboardStartEnd('end', origin.list, h, origin.index, finalIndex);
  registry.lift = null;
};
// Lift the row at `index` of this list.
const startLift = (index: any) => {
  if (!entry) return;
  const item = items.value[index];
  registry.lift = {
    holder: entry,
    key: entry.keyOf(item, index),
    data: item,
    copy: false,
    origin: {
      list: entry,
      index
    },
    liftedRowEl: entry.rowEl(index)
  };
  liftedIndex.value = index;
  ariaLiveText.value = 'Lifted ' + labelOf(item, index);
  keyboardStartEnd('start', entry, entry, index, index);
};
const onRowKeyDown = ($event: any, index: any) => {
  // Origin guard — must run FIRST, before the keyboardEnabled() check.
  //  - handle mode (keyboardTrigger='handle'): reorder keys apply ONLY when the
  //    keydown came from inside this row's `handle` element. A missing `handle`
  //    selector means keyboard is OFF (warned in warnIfHandleMissing).
  //  - row mode (quick 260716-ggq): reorder keys apply ONLY when the row
  //    element ITSELF is focused. A slotted interactive child (an <input>,
  //    <button>, etc. rendered into the row's default slot) bubbles its own
  //    keydown up to this handler — without this guard, Space/Enter typed into
  //    that child would be hijacked for lift/drop instead of reaching the
  //    child.
  if (handleMode()) {
    if (props.handle == null || !isHandleKeyOrigin($event)) return;
  } else if ($event.target !== $event.currentTarget) {
    return;
  }
  // Defense-in-depth: when keyboard reordering is off the rows carry no
  // tabindex and can't receive focus, but a consumer-focused row (or a
  // programmatic .focus()) must still no-op here rather than reorder.
  if (!keyboardEnabled()) return;
  const key = $event.key;
  const lift = registry.lift;
  const liftedHere = lift != null && lift.holder === entry;
  // Space (' ' on browsers; KeyboardEvent.key === ' ') OR Enter — lift/drop.
  if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
    $event.preventDefault();
    if (liftedHere) {
      endLift('drop');
      return;
    }
    // A lift still active in another list ends (as a drop) before this one.
    if (lift != null) endLift('drop');
    startLift(index);
    return;
  }
  // Every other key acts only while a row of this list is lifted, so it never
  // steals keys from fields inside a row.
  if (!liftedHere) return;
  if (key === 'Escape') {
    $event.preventDefault();
    endLift('cancel');
    return;
  }
  const horizontal = props.orientation === 'horizontal';
  const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
  const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
  const from = registry.indexOfLift();
  // pageStep below 1 (or not a number) still moves by at least one position.
  const step = Math.max(1, Math.floor(Number(props.pageStep) || 1));
  let to: any = null;
  if (key === nextKey) to = from + 1;else if (key === prevKey) to = from - 1;else if (key === 'Home') to = 0;else if (key === 'End') to = items.value.length - 1;else if (key === 'PageDown') to = from + step;else if (key === 'PageUp') to = from - step;
  if (to === null) return;
  $event.preventDefault();
  moveLiftTo(to);
};

// SortableJS wiring lives in `useSortableJS()` (./internal/useSortableJS).
// The helper owns the SortableJS-vs-reconciler dance — DOM-restore hardening
// against fragile-event paths, identity-based item lookup over fragile
// `e.oldIndex`, and the single-onEnd disambiguation that collapses
// onUpdate / onAdd / onRemove into one handler.
//
// What stays here is purely declarative: which array to read, what to write
// back, what to emit, and how to bridge `afterCommit` to the Lit-only
// `$reconcileAfterDomMutation()` sigil.
// Imperative handle (Phase 21 $expose). The SortableJS imperative surface a
// consumer can't drive through props alone — exposed uniformly to all 6 targets.
// Each guards the pre-mount/destroyed `instance = null`. Collision-clear: none of
// the 4 verb names collide with the 16 props or the 5 events — `option` is a
// distinct identifier from the `options` prop, so ROZ121 is clear.
function getInstance() {
  return instance;
}
// toArray()/sort() operate on SortableJS's data-id ordering — every row carries
// :data-id="keyFor(item, index)", so toArray() returns the current key order and
// sort(order) reorders by those keys (set itemKey for stable object-list keys).
function toArray() {
  return instance ? instance.toArray() : [];
}
function sort(order: any, useAnimation = true) {
  instance?.sort(order, useAnimation);
}
// option(name) reads a live SortableJS option; option(name, value) sets one — the
// runtime escape hatch for any SortableJS option beyond the curated props.
function option(name: any, value: any) {
  if (!instance) return undefined;
  if (value === undefined) return instance.option(name);
  instance.option(name, value);
  return value;
}

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  warnIfHandleMissing();
  // Named `sortable` (not `handle`) to avoid shadowing `$props.handle`
  // when the options object below references it.
  const sortable = useSortableJS(listElRef.value!, {
    items: () => items.value,
    onCommit: (next: any) => {
      items.value = next;
    },
    options: {
      animation: props.animation,
      disabled: props.disabled,
      group: resolveGroup(),
      handle: props.handle,
      ghostClass: props.ghostClass,
      chosenClass: props.chosenClass,
      dragClass: props.dragClass,
      filter: props.filter,
      forceFallback: props.forceFallback,
      swapThreshold: props.swapThreshold,
      easing: props.easing,
      ...props.options
    },
    // Lit lit-html `repeat` directive caches its part array by sentinel-
    // comment node identity; SortableJS's physical DOM mutation desyncs
    // that cache. The sigil lowers to `__rozieReconcileAfterDomMutation(this)`
    // on Lit (real call) and `void 0` on the other 5 targets (no-op).
    afterCommit: () => void 0,
    onChange: ({
      kind,
      oldIndex,
      newIndex,
      item
    }: any) => {
      if (kind === 'reorder') emit('change', {
        oldIndex,
        newIndex,
        item,
        interaction: 'pointer'
      });else if (kind === 'add') emit('add', {
        newIndex,
        item,
        interaction: 'pointer'
      });else if (kind === 'remove') emit('remove', {
        oldIndex,
        item,
        interaction: 'pointer'
      });
    },
    onStart: (e: any) => {
      // A pointer drag ends any active keyboard lift first.
      if (registry.lift != null) endLift('drop');
      (e as any).interaction = 'pointer';
      emit('start', e);
    },
    onEnd: (e: any) => {
      (e as any).interaction = 'pointer';
      emit('end', e);
    }
  });
  instance = sortable.instance;
  const listEl = listElRef.value;
  const stopNative = (ev: any) => {
    if (ev.target === listEl) ev.stopPropagation();
  };
  for (const name of SORTABLE_DOM_EVENTS as any) listEl?.addEventListener(name, stopNative);
  unhookNativeEvents = () => {
    for (const name of SORTABLE_DOM_EVENTS as any) listEl?.removeEventListener(name, stopNative);
  };

  // Register with the keyboard registry. Other instances call these methods
  // when a keyboard lift hands a row between lists.
  entry = {
    el: listEl,
    instructionsId,
    group: () => resolveGroup(),
    label: () => props.listLabel,
    keyboardEnabled: () => keyboardEnabled(),
    items: () => items.value,
    keyOf: (item: any, i: any) => String(keyFor(item, i)),
    write: (next: any) => {
      items.value = next;
    },
    setLifted: (i: any) => {
      liftedIndex.value = i;
    },
    announce: (text: any) => {
      ariaLiveText.value = text;
    },
    focusRow: (item: any, i: any) => refocusRow(item, i),
    rowEl: (i: any) => {
      const list = items.value;
      if (i < 0 || i >= list.length) return null;
      return rowByKey(listEl, String(keyFor(list[i], i)));
    },
    emit: (name: any, payload: any) => {
      if (name === 'add') emit('add', payload);else if (name === 'remove') emit('remove', payload);else if (name === 'change') emit('change', payload);else if (name === 'start') emit('start', payload);else if (name === 'end') emit('end', payload);
    }
  };
  unregisterEntry = registry.register(entry);
  // $onMount's cleanup-return: closing over a setup-local (`sortable`) does
  // not survive the Solid emitter's setup/cleanup split — it scopes cleanup
  // outside the setup IIFE. Closing over `instance` / `unregisterEntry`
  // (module-scope `let`s) works on every target.
  _cleanup_0 = () => {
    instance?.destroy();
    unregisterEntry?.();
    unregisterEntry = null;
    unhookNativeEvents?.();
    unhookNativeEvents = null;
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => props.disabled, (v: any) => instance?.option('disabled', v), { flush: 'post' });
watch(() => props.group, () => instance?.option('group', resolveGroup()), { flush: 'post' });
watch(() => props.cloneable, () => instance?.option('group', resolveGroup()), { flush: 'post' });
watch(() => props.swapThreshold, (v: any) => instance?.option('swapThreshold', v), { flush: 'post' });
watch(() => props.handle, (v: any) => {
  instance?.option('handle', v);
  warnIfHandleMissing();
}, { flush: 'post' });
watch(() => props.keyboardTrigger, () => warnIfHandleMissing(), { flush: 'post' });
watch(() => props.ghostClass, (v: any) => instance?.option('ghostClass', v), { flush: 'post' });
watch(() => props.chosenClass, (v: any) => instance?.option('chosenClass', v), { flush: 'post' });
watch(() => props.dragClass, (v: any) => instance?.option('dragClass', v), { flush: 'post' });
watch(() => props.filter, (v: any) => instance?.option('filter', v), { flush: 'post' });
watch(() => props.easing, (v: any) => instance?.option('easing', v), { flush: 'post' });

defineExpose({ getInstance, toArray, sort, option });
</script>

<style scoped>
.rozie-sortable-wrap { display: block; }
.rozie-sortable-list { display: block; }
.rozie-sortable-item { display: block; outline: none; }
.rozie-sortable-item:focus { outline: 2px solid rgba(0, 102, 204, 0.6); outline-offset: -2px; }
.rozie-sortable-item-lifted {
  background: rgba(0, 102, 204, 0.08);
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.4) inset;
}
.rozie-sortable-aria-live {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
