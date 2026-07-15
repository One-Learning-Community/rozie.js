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
  /**
   * The bound items array. The sole `model: true` prop — two-way bind it (`r-model:items` / `v-model:items` / `bind:items` / `[(items)]`) and SortableList writes the re-ordered array back whenever a drag, cross-list move, or keyboard reorder commits, with no manual `onChange → setState` wiring.
   * @example
   * <SortableList r-model:items="$data.todos" itemKey="id" />
   */
  items?: any[];
  defaultItems?: any[];
  onItemsChange?: (items: any[]) => void;
  /**
   * The per-row key the framework reconciler tracks each item by across a reorder — either a property name (e.g. `itemKey="id"` reads `item.id`) or an `(item, index) => key` function. With neither, id-less object items get a stable synthetic key via an internal `WeakMap` (survives reorder by object identity); primitive items fall back to index — pass a function for reorderable duplicate primitives.
   */
  itemKey?: (string | ((...args: any[]) => any)) | null;
  /**
   * CSS selector identifying the per-row drag handle, so a drag starts only from that element rather than anywhere in the row. Authored class names render literally on every target (React included), so a plain `.grip` works; `$classSelector('grip')` is an optional, typo-checked way to author it.
   */
  handle?: (string) | null;
  /**
   * SortableJS group name enabling cross-list drag — two lists sharing a `group` accept items between each other (the source fires `remove`, the destination fires `add`). Set `cloneable: true` to flip a string group into clone-mode.
   */
  group?: (string) | null;
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
  ghostClass?: (string) | null;
  /**
   * Class name applied to the currently-chosen item while dragging. Forwarded live via `instance.option` (no remount needed to change it).
   */
  chosenClass?: (string) | null;
  /**
   * Class name applied to the dragging element. Only takes effect in fallback mode (`forceFallback: true`). Forwarded live via `instance.option`.
   */
  dragClass?: (string) | null;
  /**
   * CSS selector that prevents drag initiation on matching rows (locked items). SortableJS checks it at `mousedown`/`touchstart` and aborts the drag if it matches. A `data-*` attribute selector (e.g. `[data-locked]`) is the most robust choice across all targets.
   */
  filter?: (string) | null;
  /**
   * CSS easing function for the reorder animation (e.g. `'ease-in'`, `'cubic-bezier(0.4, 0, 0.2, 1)'`). Runtime-updatable.
   */
  easing?: (string) | null;
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
   * Per-row inline style applied to the `.rozie-sortable-item` wrapper. Accepts a CSS `String`, a flat style object (`Record<string, string | number>`), or an `(item, index) => string | object` function for per-row styling. Because it lands on the wrapper — the direct child of the list container — it can drive CSS-grid placement (`grid-column` / `grid-row` / `align-self`) when `listClass` sets `display: grid`. Normalized per target; `null` / empty drops the attribute.
   */
  itemStyle?: (string | Record<string, any> | ((...args: any[]) => any)) | null;
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
  const _merged = mergeProps({ itemKey: null, handle: null, group: null, animation: 150, disabled: false, disableKeyboard: false, options: (() => ({}))() as Record<string, any>, labelFor: null, ghostClass: null, chosenClass: null, dragClass: null, filter: null, easing: null, forceFallback: false, swapThreshold: 1, cloneable: false, listClass: '', itemClass: '', itemStyle: null }, _props);
  const [local, attrs] = splitProps(_merged, ['items', 'itemKey', 'handle', 'group', 'animation', 'disabled', 'disableKeyboard', 'options', 'labelFor', 'ghostClass', 'chosenClass', 'dragClass', 'filter', 'easing', 'forceFallback', 'swapThreshold', 'cloneable', 'listClass', 'itemClass', 'itemStyle', 'children', 'ref']);
  const resolved = children(() => local.children);
  onMount(() => { local.ref?.({ getInstance, toArray, sort, option }); });

  const [items, setItems] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'items', (() => [])());
  const [liftedIndex, setLiftedIndex] = createSignal<any>(null);
  const [ariaLiveText, setAriaLiveText] = createSignal('');
  onMount(() => {
    const _cleanup = (() => {
    // Named `sortable` (not `handle`) to avoid shadowing `$props.handle`
    // when the options object below references it.
    const sortable = useSortableJS(listElRef!, {
      items: () => items(),
      onCommit: (next: any) => {
        setItems(next);
      },
      options: {
        animation: local.animation,
        disabled: local.disabled,
        group: resolveGroup(),
        handle: local.handle ?? undefined,
        ghostClass: local.ghostClass ?? undefined,
        chosenClass: local.chosenClass ?? undefined,
        dragClass: local.dragClass ?? undefined,
        filter: local.filter ?? undefined,
        forceFallback: local.forceFallback,
        swapThreshold: local.swapThreshold,
        easing: local.easing ?? undefined,
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
  createEffect(on(() => (() => local.group)(), (v) => untrack(() => (() => instance?.option('group', resolveGroup()))()), { defer: true }));
  createEffect(on(() => (() => local.cloneable)(), (v) => untrack(() => (() => instance?.option('group', resolveGroup()))()), { defer: true }));
  createEffect(on(() => (() => local.swapThreshold)(), (v) => untrack(() => ((v: any) => instance?.option('swapThreshold', v))(v)), { defer: true }));
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
      if (!__rowKeyMap.has(item)) {
        __rowKeyMap.set(item, '__rk' + __rowKeySeq++);
      }
      return __rowKeyMap.get(item);
    }
    // (d) primitive item: fall back to index. NOTE: duplicate primitives are
    //     unsafe to reorder this way — pass a function itemKey for those.
    return index;
  }

  // Resolve the SortableJS `group` option: `cloneable` is a high-level Rozie
  // prop that REPLACES a string `group` with SortableJS's
  // `{ name, pull: 'clone', put: true }` clone-mode object form. When
  // `cloneable:false`, pass `$props.group` through verbatim. When
  // `cloneable:true` AND `$props.group` is null, leave it null — a clone-mode
  // list without a group name is not meaningful (no peer list can join the
  // cross-list flow). Shared by $onMount construction AND the group/cloneable
  // $watch reconcile below — single source of truth, no duplicated ternary.
  function resolveGroup() {
    return local.cloneable && typeof local.group === 'string' ? {
      name: local.group,
      pull: 'clone' as const,
      put: true as const
    } : local.group ?? undefined;
  }

  // Resolve itemClass for a row: a static value (string | array | object) OR a
  // per-row (item, index) => class function. The result is fed into the :class
  // array and normalized by each target's class path (rozieClass / clsx / native).
  function itemClassFor(item: any, index: any) {
    const v = local.itemClass;
    return typeof v === 'function' ? v(item, index) : v;
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
        <For each={items()}>{(item, index) => <div data-id={rozieAttr(keyFor(item, index()))} role="listitem" class={rozieClass(['rozie-sortable-item', itemClassFor(item, index()), { 'rozie-sortable-item-lifted': liftedIndex() === index() }])} style={parseInlineStyle(itemStyleFor(item, index()))} tabIndex={rozieAttr(keyboardEnabled() ? 0 : null)} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: Element }) => { onRowKeyDown($event, index()); }} data-rozie-s-0af24eae="">
          {typeof local.children === 'function' ? (local.children as (s: any) => any)({ item, index: index() }) : resolved()}
        </div>}</For>
        {(_props.footerSlot ?? _props.slots?.['footer']?.({}))}
      </div>
      <div class={"rozie-sortable-aria-live"} data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true" data-rozie-s-0af24eae="">{ariaLiveText()}</div>
    </div>
    </>
  );
}
