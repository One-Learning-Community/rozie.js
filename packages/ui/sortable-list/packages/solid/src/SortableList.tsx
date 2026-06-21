import type { JSX } from 'solid-js';
import { For, children, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, parseInlineStyle, rozieAttr, rozieClass } from '@rozie/runtime-solid';
import { useSortableJS } from './internal/useSortableJS';

__rozieInjectStyle('SortableList-0af24eae', `.rozie-sortable-wrap[data-rozie-s-0af24eae] { display: block; }
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
}`);

interface SortableListProps {
  items?: any[];
  defaultItems?: any[];
  onItemsChange?: (items: any[]) => void;
  itemKey?: (string | ((...args: unknown[]) => unknown)) | null;
  handle?: (string) | null;
  group?: (string) | null;
  animation?: number;
  disabled?: boolean;
  disableKeyboard?: boolean;
  options?: Record<string, any>;
  labelFor?: ((...args: unknown[]) => unknown) | null;
  ghostClass?: (string) | null;
  chosenClass?: (string) | null;
  dragClass?: (string) | null;
  filter?: (string) | null;
  easing?: (string) | null;
  forceFallback?: boolean;
  swapThreshold?: number;
  cloneable?: boolean;
  listClass?: string | any[] | Record<string, any>;
  itemClass?: string | any[] | Record<string, any> | ((...args: unknown[]) => unknown);
  itemStyle?: (string | Record<string, any> | ((...args: unknown[]) => unknown)) | null;
  onChange?: (...args: unknown[]) => void;
  onAdd?: (...args: unknown[]) => void;
  onRemove?: (...args: unknown[]) => void;
  onStart?: (...args: unknown[]) => void;
  onEnd?: (...args: unknown[]) => void;
  headerSlot?: JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  footerSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: SortableListHandle) => void;
}

export interface SortableListHandle {
  getInstance: (...args: any[]) => any;
  toArray: (...args: any[]) => any;
  sort: (...args: any[]) => any;
  option: (...args: any[]) => any;
}

export default function SortableList(_props: SortableListProps): JSX.Element {
  const _merged = mergeProps({ itemKey: null, handle: null, group: null, animation: 150, disabled: false, disableKeyboard: false, options: (() => ({}))(), labelFor: null, ghostClass: null, chosenClass: null, dragClass: null, filter: null, easing: null, forceFallback: false, swapThreshold: 1, cloneable: false, listClass: '', itemClass: '', itemStyle: null }, _props);
  const [local, attrs] = splitProps(_merged, ['items', 'itemKey', 'handle', 'group', 'animation', 'disabled', 'disableKeyboard', 'options', 'labelFor', 'ghostClass', 'chosenClass', 'dragClass', 'filter', 'easing', 'forceFallback', 'swapThreshold', 'cloneable', 'listClass', 'itemClass', 'itemStyle', 'children', 'ref']);
  const resolved = children(() => local.children);
  onMount(() => { local.ref?.({ getInstance, toArray, sort, option }); });

  const [items, setItems] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'items', (() => [])());
  const [liftedIndex, setLiftedIndex] = createSignal(null);
  const [ariaLiveText, setAriaLiveText] = createSignal('');
  onMount(() => {
    const _cleanup = (() => {
    // Named `sortable` (not `handle`) to avoid shadowing `$props.handle`
    // when the options object below references it.
    const sortable = useSortableJS(listElRef, {
      items: () => items(),
      onCommit: (next: any) => {
        setItems(next);
      },
      options: {
        animation: local.animation,
        disabled: local.disabled,
        // `cloneable` is a high-level Rozie prop that REPLACES a string
        // `group` with SortableJS's `{ name, pull: 'clone', put: true }`
        // object form. When `cloneable:false`, pass `$props.group` through
        // verbatim. When `cloneable:true` AND `$props.group` is null,
        // leave it null — a clone-mode list without a group name is not
        // meaningful (no peer list can join the cross-list flow).
        group: local.cloneable && typeof local.group === 'string' ? {
          name: local.group,
          pull: 'clone',
          put: true
        } : local.group,
        handle: local.handle,
        ghostClass: local.ghostClass,
        chosenClass: local.chosenClass,
        dragClass: local.dragClass,
        filter: local.filter,
        forceFallback: local.forceFallback,
        swapThreshold: local.swapThreshold,
        easing: local.easing,
        ...local.options
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
        if (kind === 'reorder') _props.onChange?.({
          oldIndex,
          newIndex,
          item
        });else if (kind === 'add') _props.onAdd?.({
          newIndex,
          item
        });else if (kind === 'remove') _props.onRemove?.({
          oldIndex,
          item
        });
      },
      onStart: (e: any) => _props.onStart?.(e),
      onEnd: (e: any) => _props.onEnd?.(e)
    });
    instance = sortable.instance;
    // $onMount's cleanup-return: closing over a setup-local (`sortable`) does
    // not survive the Solid emitter's setup/cleanup split — it scopes cleanup
    // outside the setup IIFE. Closing over `instance` (a module-scope `let`)
    // works on every target.
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => instance?.destroy());
  });
  createEffect(on(() => (() => local.disabled)(), (v) => untrack(() => ((v: any) => instance?.option('disabled', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.group)(), (v) => untrack(() => ((v: any) => instance?.option('group', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.handle)(), (v) => untrack(() => ((v: any) => instance?.option('handle', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.ghostClass)(), (v) => untrack(() => ((v: any) => instance?.option('ghostClass', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.chosenClass)(), (v) => untrack(() => ((v: any) => instance?.option('chosenClass', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.dragClass)(), (v) => untrack(() => ((v: any) => instance?.option('dragClass', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.filter)(), (v) => untrack(() => ((v: any) => instance?.option('filter', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.easing)(), (v) => untrack(() => ((v: any) => instance?.option('easing', v))(v)), { defer: true }));
  let listElRef: HTMLElement | null = null;
  let __rozieRootRef: HTMLElement | null = null;

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
  const __rowKey = {
    map: new WeakMap(),
    seq: 0
  };

  // 4-tier per-row key precedence. Its return feeds BOTH :key and :data-id.
  function keyFor(item: any, index: any) {
    // (a) function itemKey: consumer-supplied (item, index) => key.
    if (typeof local.itemKey === 'function') {
      return local.itemKey(item, index);
    }
    // (b) string itemKey: a property name on a non-null object item.
    if (typeof local.itemKey === 'string' && item !== null && typeof item === 'object' && item[local.itemKey] != null) {
      return item[local.itemKey];
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
  }

  // Resolve itemClass for a row: a static value (string | array | object) OR a
  // per-row (item, index) => class function. The result is fed into the :class
  // array and normalized by each target's class path (rozieClass / clsx / native).
  function itemClassFor(item: any, index: any) {
    return typeof local.itemClass === 'function' ? local.itemClass(item, index) : local.itemClass;
  }

  // Resolve itemStyle for a row: a static value (string | object) OR a per-row
  // (item, index) => style function. Returns string | object | null; the dynamic
  // :style binding normalizes it per target. null / empty → attribute dropped.
  function itemStyleFor(item: any, index: any) {
    const s = typeof local.itemStyle === 'function' ? local.itemStyle(item, index) : local.itemStyle;
    return s == null || s === '' ? null : s;
  }

  // Read the display label for an item — used by the aria-live announcer.
  // Phase 16 R7 / D-08: $props.labelFor reads as `null` on all 6 targets when
  // the consumer omits it (Plan 16-01 prop-default coercion fix); the check is
  // a plain null compare — NO runtime callable-type coercion.
  function getLabel(idx: any) {
    const item = items()[idx];
    if (local.labelFor !== null) return local.labelFor(item, idx);
    if (item !== null && typeof item === 'object' && 'label' in item) return item.label;
    return String(item);
  }

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
  function keyboardEnabled() {
    return !local.disabled && !local.disableKeyboard;
  }
  function onRowKeyDown($event: any, index: any) {
    // Defense-in-depth: when keyboard reordering is off the rows carry no
    // tabindex and can't receive focus, but a consumer-focused row (or a
    // programmatic .focus()) must still no-op here rather than reorder.
    if (!keyboardEnabled()) return;
    const key = $event.key;
    // Space (' ' on browsers; KeyboardEvent.key === ' ') OR Enter — lift/drop.
    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      $event.preventDefault();
      if (liftedIndex() === null) {
        // LIFT
        setLiftedIndex(index);
        setAriaLiveText('Lifted ' + getLabel(index));
        return;
      }
      // DROP
      const dropped = getLabel(liftedIndex());
      const at = liftedIndex();
      setLiftedIndex(null);
      setAriaLiveText('Dropped ' + dropped + ' at position ' + (at + 1));
      return;
    }
    if (key === 'Escape') {
      if (liftedIndex() === null) return;
      $event.preventDefault();
      const cancelled = getLabel(liftedIndex());
      setLiftedIndex(null);
      setAriaLiveText('Cancelled lift of ' + cancelled);
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      if (liftedIndex() === null) return;
      $event.preventDefault();
      const dir = key === 'ArrowDown' ? 1 : -1;
      const from = liftedIndex();
      const to = from + dir;
      if (to < 0 || to >= items().length) return;
      const next = [...items()];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setItems(next);
      setLiftedIndex(to);
      setAriaLiveText('Moved ' + getLabel(to) + ' to position ' + (to + 1));
      // After the keyed reorder write, restore focus to the moved row. No-op
      // on React/Vue/Angular (DOM identity preserved); queueMicrotask +
      // querySelectorAll + .focus() on Svelte/Solid/Lit (DOM re-created).
      queueMicrotask(() => (__rozieRootRef!.querySelectorAll('[role="listitem"]')?.[to] as HTMLElement | undefined)?.focus?.());
      _props.onChange?.({
        oldIndex: from,
        newIndex: to,
        item: moved
      });
    }
  }

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

  return (
    <>
    <div ref={(el) => { __rozieRootRef = el as HTMLElement; }} {...attrs} class={"rozie-sortable-wrap" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-0af24eae="">
      <div class={rozieClass(['rozie-sortable-list', local.listClass])} ref={(el) => { listElRef = el as HTMLElement; }} part="list" data-rozie-s-0af24eae="">
        {(_props.headerSlot ?? _props.slots?.['header']?.({}))}
        <For each={items()}>{(item, index) => <div data-id={rozieAttr(keyFor(item, index()))} role="listitem" class={rozieClass(['rozie-sortable-item', itemClassFor(item, index()), { 'rozie-sortable-item-lifted': liftedIndex() === index() }])} style={parseInlineStyle(itemStyleFor(item, index()))} tabIndex={rozieAttr(keyboardEnabled() ? 0 : null)} onKeyDown={($event) => { onRowKeyDown($event, index()); }} data-rozie-s-0af24eae="">
          {typeof local.children === 'function' ? (local.children as (s: any) => any)({ item, index: index() }) : resolved()}
        </div>}</For>
        {(_props.footerSlot ?? _props.slots?.['footer']?.({}))}
      </div>
      <div class={"rozie-sortable-aria-live"} data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true" data-rozie-s-0af24eae="">{ariaLiveText()}</div>
    </div>
    </>
  );
}
