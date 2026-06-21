<script lang="ts">
import { applyListeners, rozieAttr, rozieClass, rozieStyle } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onMount, untrack } from 'svelte';

interface Props {
  items?: any[];
  itemKey?: (string | ((...args: any[]) => any)) | null;
  handle?: (string) | null;
  group?: (string) | null;
  animation?: number;
  disabled?: boolean;
  options?: any;
  labelFor?: ((...args: any[]) => any) | null;
  ghostClass?: (string) | null;
  chosenClass?: (string) | null;
  dragClass?: (string) | null;
  filter?: (string) | null;
  easing?: (string) | null;
  forceFallback?: boolean;
  swapThreshold?: number;
  cloneable?: boolean;
  listClass?: string | any[] | any;
  itemClass?: string | any[] | any | ((...args: any[]) => any);
  itemStyle?: (string | any | ((...args: any[]) => any)) | null;
  header?: Snippet;
  children?: Snippet<[{ item: any; index: any }]>;
  footer?: Snippet;
  snippets?: Record<string, any>;
  onchange?: (...args: unknown[]) => void;
  onadd?: (...args: unknown[]) => void;
  onremove?: (...args: unknown[]) => void;
  onstart?: (...args: unknown[]) => void;
  onend?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultOptions = (() => ({}))();

let {
  items = $bindable((() => [])()),
  itemKey = null,
  handle = null,
  group = null,
  animation = 150,
  disabled = false,
  options = __defaultOptions,
  labelFor = null,
  ghostClass = null,
  chosenClass = null,
  dragClass = null,
  filter = null,
  easing = null,
  forceFallback = false,
  swapThreshold = 1,
  cloneable = false,
  listClass = '',
  itemClass = '',
  itemStyle = null,
  header: __headerProp,
  children: __childrenProp,
  footer: __footerProp,
  snippets,
  onchange,
  onadd,
  onremove,
  onstart,
  onend,
  ...__rozieAttrs
}: Props = $props();

const header = $derived(__headerProp ?? snippets?.header);
const children = $derived(__childrenProp ?? snippets?.children);
const footer = $derived(__footerProp ?? snippets?.footer);

let liftedIndex: any = $state(null);
let ariaLiveText = $state('');

let listEl = $state<HTMLElement | undefined>(undefined);
let __rozieRoot = $state<HTMLElement | undefined>(undefined);

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
  if (typeof itemKey === 'function') {
    return itemKey(item, index);
  }
  // (b) string itemKey: a property name on a non-null object item.
  if (typeof itemKey === 'string' && item !== null && typeof item === 'object' && item[itemKey] != null) {
    return item[itemKey];
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
const itemClassFor = (item: any, index: any) => typeof itemClass === 'function' ? itemClass(item, index) : itemClass;

// Resolve itemStyle for a row: a static value (string | object) OR a per-row
// (item, index) => style function. Returns string | object | null; the dynamic
// :style binding normalizes it per target. null / empty → attribute dropped.
// Resolve itemStyle for a row: a static value (string | object) OR a per-row
// (item, index) => style function. Returns string | object | null; the dynamic
// :style binding normalizes it per target. null / empty → attribute dropped.
const itemStyleFor = (item: any, index: any) => {
  const s = typeof itemStyle === 'function' ? itemStyle(item, index) : itemStyle;
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
  const item = items[idx];
  if (labelFor !== null) return labelFor(item, idx);
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
const onRowKeyDown = ($event: any, index: any) => {
  const key = $event.key;
  // Space (' ' on browsers; KeyboardEvent.key === ' ') OR Enter — lift/drop.
  if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
    $event.preventDefault();
    if (liftedIndex === null) {
      // LIFT
      liftedIndex = index;
      ariaLiveText = 'Lifted ' + getLabel(index);
      return;
    }
    // DROP
    const dropped = getLabel(liftedIndex);
    const at = liftedIndex;
    liftedIndex = null;
    ariaLiveText = 'Dropped ' + dropped + ' at position ' + (at + 1);
    return;
  }
  if (key === 'Escape') {
    if (liftedIndex === null) return;
    $event.preventDefault();
    const cancelled = getLabel(liftedIndex);
    liftedIndex = null;
    ariaLiveText = 'Cancelled lift of ' + cancelled;
    return;
  }
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    if (liftedIndex === null) return;
    $event.preventDefault();
    const dir = key === 'ArrowDown' ? 1 : -1;
    const from = liftedIndex;
    const to = from + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    items = next;
    liftedIndex = to;
    ariaLiveText = 'Moved ' + getLabel(to) + ' to position ' + (to + 1);
    // After the keyed reorder write, restore focus to the moved row. No-op
    // on React/Vue/Angular (DOM identity preserved); queueMicrotask +
    // querySelectorAll + .focus() on Svelte/Solid/Lit (DOM re-created).
    queueMicrotask(() => (__rozieRoot!.querySelectorAll('[role="listitem"]')?.[to] as HTMLElement | undefined)?.focus?.());
    onchange?.({
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
export function getInstance() {
  return instance;
}
// toArray()/sort() operate on SortableJS's data-id ordering — every row carries
// :data-id="keyFor(item, index)", so toArray() returns the current key order and
// sort(order) reorders by those keys (set itemKey for stable object-list keys).
// toArray()/sort() operate on SortableJS's data-id ordering — every row carries
// :data-id="keyFor(item, index)", so toArray() returns the current key order and
// sort(order) reorders by those keys (set itemKey for stable object-list keys).
export function toArray() {
  return instance ? instance.toArray() : [];
}
export function sort(order: any, useAnimation = true) {
  instance?.sort(order, useAnimation);
}
// option(name) reads a live SortableJS option; option(name, value) sets one — the
// runtime escape hatch for any SortableJS option beyond the curated props.
// option(name) reads a live SortableJS option; option(name, value) sets one — the
// runtime escape hatch for any SortableJS option beyond the curated props.
export function option(name: any, value: any) {
  if (!instance) return undefined;
  if (value === undefined) return instance.option(name);
  instance.option(name, value);
  return value;
}

onMount(() => {
  // Named `sortable` (not `handle`) to avoid shadowing `$props.handle`
  // when the options object below references it.
  const sortable = useSortableJS(listEl!, {
    items: () => items,
    onCommit: (next: any) => {
      items = next;
    },
    options: {
      animation: animation,
      disabled: disabled,
      // `cloneable` is a high-level Rozie prop that REPLACES a string
      // `group` with SortableJS's `{ name, pull: 'clone', put: true }`
      // object form. When `cloneable:false`, pass `$props.group` through
      // verbatim. When `cloneable:true` AND `$props.group` is null,
      // leave it null — a clone-mode list without a group name is not
      // meaningful (no peer list can join the cross-list flow).
      group: cloneable && typeof group === 'string' ? {
        name: group,
        pull: 'clone',
        put: true
      } : group,
      handle: handle,
      ghostClass: ghostClass,
      chosenClass: chosenClass,
      dragClass: dragClass,
      filter: filter,
      forceFallback: forceFallback,
      swapThreshold: swapThreshold,
      easing: easing,
      ...options
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
      if (kind === 'reorder') onchange?.({
        oldIndex,
        newIndex,
        item
      });else if (kind === 'add') onadd?.({
        newIndex,
        item
      });else if (kind === 'remove') onremove?.({
        oldIndex,
        item
      });
    },
    onStart: (e: any) => onstart?.(e),
    onEnd: (e: any) => onend?.(e)
  });
  instance = sortable.instance;
  // $onMount's cleanup-return: closing over a setup-local (`sortable`) does
  // not survive the Solid emitter's setup/cleanup split — it scopes cleanup
  // outside the setup IIFE. Closing over `instance` (a module-scope `let`)
  // works on every target.
  return () => instance?.destroy();
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => disabled)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((v: any) => instance?.option('disabled', v))(__watchVal); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { const __watchVal = (() => group)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } ((v: any) => instance?.option('group', v))(__watchVal); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { const __watchVal = (() => handle)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } ((v: any) => instance?.option('handle', v))(__watchVal); }); });
let __rozieWatchInitial_3 = true;
$effect(() => { const __watchVal = (() => ghostClass)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } ((v: any) => instance?.option('ghostClass', v))(__watchVal); }); });
let __rozieWatchInitial_4 = true;
$effect(() => { const __watchVal = (() => chosenClass)(); untrack(() => { if (__rozieWatchInitial_4) { __rozieWatchInitial_4 = false; return; } ((v: any) => instance?.option('chosenClass', v))(__watchVal); }); });
let __rozieWatchInitial_5 = true;
$effect(() => { const __watchVal = (() => dragClass)(); untrack(() => { if (__rozieWatchInitial_5) { __rozieWatchInitial_5 = false; return; } ((v: any) => instance?.option('dragClass', v))(__watchVal); }); });
let __rozieWatchInitial_6 = true;
$effect(() => { const __watchVal = (() => filter)(); untrack(() => { if (__rozieWatchInitial_6) { __rozieWatchInitial_6 = false; return; } ((v: any) => instance?.option('filter', v))(__watchVal); }); });
let __rozieWatchInitial_7 = true;
$effect(() => { const __watchVal = (() => easing)(); untrack(() => { if (__rozieWatchInitial_7) { __rozieWatchInitial_7 = false; return; } ((v: any) => instance?.option('easing', v))(__watchVal); }); });
</script>

<div bind:this={__rozieRoot} {...__rozieAttrs} class={["rozie-sortable-wrap", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-0af24eae><div class={rozieClass(['rozie-sortable-list', listClass])} bind:this={listEl} part="list" data-rozie-s-0af24eae>{@render header?.()}{#each items as item, index (keyFor(item, index))}<div class={rozieClass(['rozie-sortable-item', itemClassFor(item, index), { 'rozie-sortable-item-lifted': liftedIndex === index }])} style={rozieStyle(itemStyleFor(item, index))} data-id={rozieAttr(keyFor(item, index))} role="listitem" tabindex="0" onkeydown={($event) => { onRowKeyDown($event, index); }} data-rozie-s-0af24eae>{@render children?.({ item, index })}</div>{/each}{@render footer?.()}</div><div class="rozie-sortable-aria-live" data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true" data-rozie-s-0af24eae>{ariaLiveText}</div></div>

<style>
:global {
  .rozie-sortable-wrap[data-rozie-s-0af24eae] { display: block; }
  .rozie-sortable-list[data-rozie-s-0af24eae] { display: block; }
  .rozie-sortable-item[data-rozie-s-0af24eae] { display: block; outline: none; }
  .rozie-sortable-item[data-rozie-s-0af24eae]:focus { outline: 2px solid rgba(0, 102, 204, 0.6); outline-offset: -2px; }
  .rozie-sortable-item-lifted[data-rozie-s-0af24eae] {
    background: rgba(0, 102, 204, 0.08);
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.4) inset;
  }
  .rozie-sortable-aria-live[data-rozie-s-0af24eae] {
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
}
</style>
