<template>

<div class="rozie-sortable-wrap" ref="__rozieRootRef" v-bind="$attrs">
  <div :class="['rozie-sortable-list', props.listClass]" ref="listElRef" part="list">
    <slot name="header"></slot>
    <div v-for="(item, index) in items" :key="keyFor(item, index)" :class="['rozie-sortable-item', itemClassFor(item, index), { 'rozie-sortable-item-lifted': liftedIndex === index }]" :style="itemStyleFor(item, index)" :data-id="keyFor(item, index)" role="listitem" :tabindex="keyboardEnabled() ? 0 : undefined" @keydown="onRowKeyDown($event, index)">
      <slot :item="item" :index="index"></slot>
    </div>
    <slot name="footer"></slot>
  </div>
  <div class="rozie-sortable-aria-live" data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true">{{ ariaLiveText }}</div>
</div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{ itemKey?: string | ((...args: any[]) => any) | null; handle?: string | null; group?: string | null; animation?: number; disabled?: boolean; disableKeyboard?: boolean; options?: Record<string, any>; labelFor?: ((...args: any[]) => any) | null; ghostClass?: string | null; chosenClass?: string | null; dragClass?: string | null; filter?: string | null; easing?: string | null; forceFallback?: boolean; swapThreshold?: number; cloneable?: boolean; listClass?: string | any[] | Record<string, any>; itemClass?: string | any[] | Record<string, any> | ((...args: any[]) => any) | null; itemStyle?: string | Record<string, any> | ((...args: any[]) => any) | null }>(),
  { itemKey: null, handle: null, group: null, animation: 150, disabled: false, disableKeyboard: false, options: () => ({}), labelFor: null, ghostClass: null, chosenClass: null, dragClass: null, filter: null, easing: null, forceFallback: false, swapThreshold: 1, cloneable: false, listClass: '', itemClass: '', itemStyle: null }
);

const items = defineModel<any[]>('items', { default: () => [] });

const emit = defineEmits<{
  change: [...args: any[]];
  add: [...args: any[]];
  remove: [...args: any[]];
  start: [...args: any[]];
  end: [...args: any[]];
}>();

defineSlots<{
  header(props: {  }): any;
  default(props: { item: any; index: any }): any;
  footer(props: {  }): any;
}>();

const liftedIndex = ref<any>(null);
const ariaLiveText = ref('');

const listElRef = ref<HTMLElement>();
const __rozieRootRef = ref<HTMLElement>();

import { useSortableJS } from './internal/useSortableJS';
let instance: any = null;

// Instance-scoped synthetic-id store for id-less object items. Keyed by object
// IDENTITY, so the same object keeps its synthetic id across a reorder (the
// framework reconciler then rebinds the row component instance to its ORIGINAL
// item, not its slot position — the data-corruption fix). BOTH the WeakMap and
// the monotonic counter live in ONE member-mutated fresh-instance object so the
// React emitter hoists the whole thing to a single useMemo(() => …, []) (the
// setup-once-persistence guarantee). Folding the counter in is deliberate: a
// bare `let __rowKeySeq = 0` mutated only inside the non-hook keyFor helper is
// NOT caught by React's hoistModuleLet (it resets every render → an item added
// in a later render collides on an already-issued synthetic id → corruption).
// new WeakMap()/seq inside one object dodges that emitter gap. Verified in codegen.
// Instance-scoped synthetic-id store for id-less object items. Keyed by object
// IDENTITY, so the same object keeps its synthetic id across a reorder (the
// framework reconciler then rebinds the row component instance to its ORIGINAL
// item, not its slot position — the data-corruption fix). BOTH the WeakMap and
// the monotonic counter live in ONE member-mutated fresh-instance object so the
// React emitter hoists the whole thing to a single useMemo(() => …, []) (the
// setup-once-persistence guarantee). Folding the counter in is deliberate: a
// bare `let __rowKeySeq = 0` mutated only inside the non-hook keyFor helper is
// NOT caught by React's hoistModuleLet (it resets every render → an item added
// in a later render collides on an already-issued synthetic id → corruption).
// new WeakMap()/seq inside one object dodges that emitter gap. Verified in codegen.
const __rowKey = {
  map: new WeakMap(),
  seq: 0
};

// 4-tier per-row key precedence. Its return feeds BOTH :key and :data-id.
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
    if (!__rowKey.map.has(item)) {
      __rowKey.map.set(item, '__rk' + __rowKey.seq++);
    }
    return __rowKey.map.get(item);
  }
  // (d) primitive item: fall back to index. NOTE: duplicate primitives are
  //     unsafe to reorder this way — pass a function itemKey for those.
  return index;
};

// Resolve itemClass for a row: a static value (string | array | object) OR a
// per-row (item, index) => class function. The result is fed into the :class
// array and normalized by each target's class path (rozieClass / clsx / native).
// Resolve itemClass for a row: a static value (string | array | object) OR a
// per-row (item, index) => class function. The result is fed into the :class
// array and normalized by each target's class path (rozieClass / clsx / native).
const itemClassFor = (item: any, index: any) => typeof props.itemClass === 'function' ? props.itemClass(item, index) : props.itemClass;

// Resolve itemStyle for a row: a static value (string | object) OR a per-row
// (item, index) => style function. Returns string | object | null; the dynamic
// :style binding normalizes it per target. null / empty → attribute dropped.
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
// Read the display label for an item — used by the aria-live announcer.
// Phase 16 R7 / D-08: $props.labelFor reads as `null` on all 6 targets when
// the consumer omits it (Plan 16-01 prop-default coercion fix); the check is
// a plain null compare — NO runtime callable-type coercion.
const getLabel = (idx: any) => {
  const item = items.value[idx];
  if (props.labelFor !== null) return props.labelFor(item, idx);
  if (item !== null && typeof item === 'object' && 'label' in item) return item.label;
  return String(item);
};

// Keyboard handler (Phase 16 R7): Space lifts/drops, ArrowDown/ArrowUp move
// the lifted row, Escape cancels, Enter is an alternate drop trigger. After
// any array-reorder write, $restoreFocus('[role="listitem"]', newIdx) keeps
// focus on the moved row across the React/Vue/Angular vs Svelte/Solid/Lit
// keyed-reconciler divide (Plan 16-03 sigil — no-op on the first three;
// queueMicrotask + querySelectorAll + .focus() on the latter three).
//
// Note: `index` is passed directly as a number. Plan 16-02 (Solid call-arg
// accessor unwrap) ensures Solid's <For> alias unwraps to `index()` at the
// call site — no runtime callable-type coercion needed in user source.
// Keyboard reordering is available only when the list is not disabled AND the
// `disableKeyboard` opt-out is off. Drives BOTH the row tabindex (rows are
// focusable only when reorderable) and the onRowKeyDown guard below. Reads
// straight off $props so the tabindex binding re-evaluates reactively when
// `disabled`/`disableKeyboard` toggle at runtime.
// Keyboard handler (Phase 16 R7): Space lifts/drops, ArrowDown/ArrowUp move
// the lifted row, Escape cancels, Enter is an alternate drop trigger. After
// any array-reorder write, $restoreFocus('[role="listitem"]', newIdx) keeps
// focus on the moved row across the React/Vue/Angular vs Svelte/Solid/Lit
// keyed-reconciler divide (Plan 16-03 sigil — no-op on the first three;
// queueMicrotask + querySelectorAll + .focus() on the latter three).
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
const onRowKeyDown = ($event: any, index: any) => {
  // Defense-in-depth: when keyboard reordering is off the rows carry no
  // tabindex and can't receive focus, but a consumer-focused row (or a
  // programmatic .focus()) must still no-op here rather than reorder.
  if (!keyboardEnabled()) return;
  const key = $event.key;
  // Space (' ' on browsers; KeyboardEvent.key === ' ') OR Enter — lift/drop.
  if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
    $event.preventDefault();
    if (liftedIndex.value === null) {
      // LIFT
      liftedIndex.value = index;
      ariaLiveText.value = 'Lifted ' + getLabel(index);
      return;
    }
    // DROP
    const dropped = getLabel(liftedIndex.value);
    const at = liftedIndex.value;
    liftedIndex.value = null;
    ariaLiveText.value = 'Dropped ' + dropped + ' at position ' + (at + 1);
    return;
  }
  if (key === 'Escape') {
    if (liftedIndex.value === null) return;
    $event.preventDefault();
    const cancelled = getLabel(liftedIndex.value);
    liftedIndex.value = null;
    ariaLiveText.value = 'Cancelled lift of ' + cancelled;
    return;
  }
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    if (liftedIndex.value === null) return;
    $event.preventDefault();
    const dir = key === 'ArrowDown' ? 1 : -1;
    const from = liftedIndex.value;
    const to = from + dir;
    if (to < 0 || to >= items.value.length) return;
    const next = [...items.value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    items.value = next;
    liftedIndex.value = to;
    ariaLiveText.value = 'Moved ' + getLabel(to) + ' to position ' + (to + 1);
    // After the keyed reorder write, restore focus to the moved row. No-op
    // on React/Vue/Angular (DOM identity preserved); queueMicrotask +
    // querySelectorAll + .focus() on Svelte/Solid/Lit (DOM re-created).
    void 0;
    emit('change', {
      oldIndex: from,
      newIndex: to,
      item: moved
    });
  }
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
      // `cloneable` is a high-level Rozie prop that REPLACES a string
      // `group` with SortableJS's `{ name, pull: 'clone', put: true }`
      // object form. When `cloneable:false`, pass `$props.group` through
      // verbatim. When `cloneable:true` AND `$props.group` is null,
      // leave it null — a clone-mode list without a group name is not
      // meaningful (no peer list can join the cross-list flow).
      group: props.cloneable && typeof props.group === 'string' ? {
        name: props.group,
        pull: 'clone',
        put: true
      } : props.group,
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
        item
      });else if (kind === 'add') emit('add', {
        newIndex,
        item
      });else if (kind === 'remove') emit('remove', {
        oldIndex,
        item
      });
    },
    onStart: (e: any) => emit('start', e),
    onEnd: (e: any) => emit('end', e)
  });
  instance = sortable.instance;
  // $onMount's cleanup-return: closing over a setup-local (`sortable`) does
  // not survive the Solid emitter's setup/cleanup split — it scopes cleanup
  // outside the setup IIFE. Closing over `instance` (a module-scope `let`)
  // works on every target.
  _cleanup_0 = () => instance?.destroy();
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => props.disabled, (v: any) => instance?.option('disabled', v));
watch(() => props.group, (v: any) => instance?.option('group', v));
watch(() => props.handle, (v: any) => instance?.option('handle', v));
watch(() => props.ghostClass, (v: any) => instance?.option('ghostClass', v));
watch(() => props.chosenClass, (v: any) => instance?.option('chosenClass', v));
watch(() => props.dragClass, (v: any) => instance?.option('dragClass', v));
watch(() => props.filter, (v: any) => instance?.option('filter', v));
watch(() => props.easing, (v: any) => instance?.option('easing', v));

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
