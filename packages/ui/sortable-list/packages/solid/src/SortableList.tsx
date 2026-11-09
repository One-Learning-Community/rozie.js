import type { JSX } from 'solid-js';
import { For, children, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, parseInlineStyle, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
import { useSortableJS } from './internal/useSortableJS';
import { canHop, getKeyboardRegistry, isRenderable, nextInstructionsId, rowLiftable } from './internal/keyboardRegistry';

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

interface DefaultSlotCtx { item: any; index: any; instructionsId: any; }

interface SortableListProps extends Omit<import('solid-js').ComponentProps<'div'>, 'items' | 'defaultItems' | 'onItemsChange' | 'itemKey' | 'handle' | 'group' | 'animation' | 'disabled' | 'disableKeyboard' | 'keyboardTrigger' | 'options' | 'labelFor' | 'ghostClass' | 'chosenClass' | 'dragClass' | 'filter' | 'easing' | 'forceFallback' | 'swapThreshold' | 'cloneable' | 'listClass' | 'itemClass' | 'listLabel' | 'orientation' | 'pageStep' | 'keyboardInstructions' | 'itemStyle' | 'onReorder' | 'onAdd' | 'onRemove' | 'onStart' | 'onEnd' | 'headerSlot' | 'children' | 'footerSlot' | 'slots' | 'ref' | 'innerHTML' | 'innerText' | 'textContent'> {
  /**
   * The bound items array. The sole `model: true` prop — two-way bind it (`r-model:items` / `v-model:items` / `bind:items` / `[(items)]`) and SortableList writes the re-ordered array back whenever a drag, cross-list move, or keyboard reorder commits, with no manual `onChange → setState` wiring.
   * @example
   * <SortableList items={todos()} onItemsChange={setTodos} itemKey="id" />
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
   * SortableJS group name enabling cross-list drag — two lists sharing a `group` accept items between each other (the source fires `remove`, the destination fires `add`). Set `cloneable: true` to flip a string group into clone-mode. Lists that share a `group` also exchange rows by keyboard: Shift+arrow while a row is lifted hops it to the previous or next list of the same group (in source order), subject to the same pull/put rules as a mouse drag. `options.group` takes precedence over this prop, for keyboard hops as for drags. Function-valued `pull`/`put` cannot be evaluated without a drag, so those lists are unreachable by keyboard. Set `itemKey` on grouped lists.
   */
  group?: (string) | null;
  /**
   * Reorder animation duration in milliseconds. `0` disables the animation. Runtime-updatable.
   */
  animation?: number;
  /**
   * Temporarily disable dragging without unmounting — reapplied live via `instance.option('disabled', v)` (no remount). Also suppresses keyboard reordering: a disabled list is not sortable by any input, so rows lose their `tabindex` and the keydown handler no-ops. Turning it on while a row is lifted ends the lift where the row is (`Lift ended`, and `end` fires); `options.disabled` and `option('disabled', v)` do the same.
   */
  disabled?: boolean;
  /**
   * Opt out of keyboard reordering (Space lift / Arrow move / Shift+Arrow hop between lists / Esc cancel / Enter drop) while leaving pointer drag enabled. Rows drop out of the tab order (no `tabindex`) and the keydown handler no-ops. Keyboard access is gated on `!disabled && !disableKeyboard`. Turning it on while a row is lifted ends the lift where the row is.
   */
  disableKeyboard?: boolean;
  /**
   * Which element drives keyboard reordering. `'row'` (default): rows are tab stops and the keys on the focused row drive reordering. `'handle'`: rows are NOT tab stops, and only keys pressed inside the element matched by `handle` (inside that row) drive the same Space/Enter lift-drop, Arrow move, Shift+Arrow hop and Escape cancel flow; handled keys call preventDefault so a handle `<button>`'s click does not fire. The consumer owns the handle markup (recommended: a `<button>` with its own aria-label such as "Reorder Hero banner") and the component adds no tabindex or role to slot content. `'handle'` without `handle` turns keyboard reordering off and logs a console warning. `disabled`/`disableKeyboard` still apply. Any value other than `'handle'` behaves as `'row'`.
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
   * CSS selector that prevents drag initiation on matching rows (locked items). SortableJS checks it at `mousedown`/`touchstart` and aborts the drag if it matches. The keyboard honours it too: a row that matches (the row element or its slot root, the element the row template renders) cannot be lifted with Space/Enter; a control nested deeper that matches blocks only presses on it. `options.filter` (which may also be a SortableJS filter function) takes precedence. A `data-*` attribute selector (e.g. `[data-locked]`) is the most robust choice across all targets.
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
   * The list's human name, such as `"Top sidebar"`. Sets `aria-label` on the list container (`role="list"`) and names the list in keyboard announcements when a row moves between lists (`Moved Hero banner to Top sidebar, position 1`, `Dropped Hero banner in Top sidebar at position 3`, `No list after Top sidebar`). Pass the same words as the zone's visible heading. With no label, announcements fall back to a neutral `list 2 of 3`, counting the mounted lists of the same group in hop (source) order.
   */
  listLabel?: (string) | null;
  /**
   * Which arrow keys move a lifted row within the list: `'vertical'` (default) uses ↑/↓, `'horizontal'` uses ←/→. A horizontal list's default spoken instructions say "Use the left and right arrow keys to move" (`role="list"` has no `aria-orientation`).
   */
  orientation?: string;
  /**
   * How many positions Page Up / Page Down move a lifted row. The move stops at the first or last position when fewer rows remain.
   */
  pageStep?: number;
  /**
   * Replaces the spoken keyboard instructions. The text sits in a hidden element referenced by `aria-describedby` from each tabbable row (row mode) or from the consumer's handle via the `instructionsId` slot prop (handle mode). Default: "Press Space or Enter to pick up. Use the arrow keys to move, Home and End to jump, and Escape to cancel." (with `orientation: 'horizontal'`, "Use the left and right arrow keys to move"). When `group` is set the default adds "Hold Shift with an arrow key to move to another list."
   */
  keyboardInstructions?: (string) | null;
  /**
   * Per-row inline style applied to the `.rozie-sortable-item` wrapper. Accepts a CSS `String`, a flat style object (`Record<string, string | number>`), or an `(item, index) => string | object` function for per-row styling. Because it lands on the wrapper — the direct child of the list container — it can drive CSS-grid placement (`grid-column` / `grid-row` / `align-self`) when `listClass` sets `display: grid`. Normalized per target; `null` / empty drops the attribute.
   */
  itemStyle?: (string | Record<string, any> | ((...args: any[]) => any)) | null;
  onReorder?: (...args: any[]) => void;
  onAdd?: (...args: any[]) => void;
  onRemove?: (...args: any[]) => void;
  onStart?: (...args: any[]) => void;
  onEnd?: (...args: any[]) => void;
  headerSlot?: JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element | ((ctx: DefaultSlotCtx) => JSX.Element);
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
  const _merged = mergeProps({ itemKey: null, handle: null, group: null, animation: 150, disabled: false, disableKeyboard: false, keyboardTrigger: 'row', options: (() => ({}))() as Record<string, any>, labelFor: null, ghostClass: null, chosenClass: null, dragClass: null, filter: null, easing: null, forceFallback: false, swapThreshold: 1, cloneable: false, listClass: '', itemClass: '', listLabel: null, orientation: 'vertical', pageStep: 5, keyboardInstructions: null, itemStyle: null }, _props);
  const [local, attrs] = splitProps(_merged, ['items', 'itemKey', 'handle', 'group', 'animation', 'disabled', 'disableKeyboard', 'keyboardTrigger', 'options', 'labelFor', 'ghostClass', 'chosenClass', 'dragClass', 'filter', 'easing', 'forceFallback', 'swapThreshold', 'cloneable', 'listClass', 'itemClass', 'listLabel', 'orientation', 'pageStep', 'keyboardInstructions', 'itemStyle', 'children', 'ref', 'onReorder', 'onAdd', 'onRemove', 'onStart', 'onEnd', 'headerSlot', 'footerSlot', 'slots']);
  const resolved = children(() => local.children as JSX.Element);
  onMount(() => { local.ref?.({ getInstance, toArray, sort, option }); });

  const [items, setItems] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'items', (() => [])());
  const [liftedIndex, setLiftedIndex] = createSignal<any>(null);
  const [ariaLiveText, setAriaLiveText] = createSignal('');
  const [optionOverrides, setOptionOverrides] = createSignal<Record<string, any>>({});
  createEffect(on(() => (() => local.disabled)(), (v) => untrack(() => ((v: any) => {
    instance?.option('disabled', v);
    setOverride('disabled', v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => [local.disabled, local.disableKeyboard, local.options, optionOverrides()])(), (v) => untrack(() => (() => {
    if (!keyboardEnabled()) keyboardTurnedOff();
  })()), { defer: true }));
  createEffect(on(() => (() => local.group)(), (v) => untrack(() => (() => instance?.option('group', resolveGroup()))()), { defer: true }));
  createEffect(on(() => (() => local.cloneable)(), (v) => untrack(() => (() => instance?.option('group', resolveGroup()))()), { defer: true }));
  createEffect(on(() => (() => local.swapThreshold)(), (v) => untrack(() => ((v: any) => instance?.option('swapThreshold', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.handle)(), (v) => untrack(() => ((v: any) => {
    instance?.option('handle', v);
    warnIfHandleMissing();
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.keyboardTrigger)(), (v) => untrack(() => (() => warnIfHandleMissing())()), { defer: true }));
  createEffect(on(() => (() => local.ghostClass)(), (v) => untrack(() => ((v: any) => instance?.option('ghostClass', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.chosenClass)(), (v) => untrack(() => ((v: any) => instance?.option('chosenClass', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.dragClass)(), (v) => untrack(() => ((v: any) => instance?.option('dragClass', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.filter)(), (v) => untrack(() => ((v: any) => {
    instance?.option('filter', v);
    setOverride('filter', v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.easing)(), (v) => untrack(() => ((v: any) => instance?.option('easing', v))(v)), { defer: true }));
  createEffect(on(() => (() => items())(), (v) => untrack(() => (() => {
    const lift = registry.lift;
    if (lift == null || lift.holder !== entry) return;
    const i = registry.indexOfLift();
    if (i < 0) {
      loseLift();
      return;
    }
    if (liftedIndex() !== i) setLiftedIndex(i);
    // Once the holder has rendered the lifted row, that is the lifted row
    // element. After a hop this drops the source's old row, which the source
    // may reuse for another item (index keys).
    const row = entry.rowEl(i);
    if (row != null) lift.liftedRowEl = row;
    focusNearRow(i, lift.key);
  })()), { defer: true }));
  onMount(() => {
    const _cleanup = (() => {
    warnIfHandleMissing();
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
      // Every pointer event carries the same payload as the keyboard ones, with
      // item-row indices and the raw SortableJS event as `originalEvent`.
      onChange: (c: any) => {
        const payload = {
          interaction: 'pointer',
          item: c.item,
          el: c.el,
          from: c.from,
          to: c.to,
          oldIndex: c.oldIndex,
          newIndex: c.newIndex,
          originalEvent: c.event
        };
        if (c.kind === 'reorder') _props.onReorder?.(payload);else if (c.kind === 'add') _props.onAdd?.(payload);else if (c.kind === 'remove') _props.onRemove?.(payload);
      },
      onStart: (d: any) => {
        // A pointer drag ends any active keyboard lift first.
        if (registry.lift != null) endLift('drop');
        // That lift's `end` (pending until a task) comes before this `start`.
        registry.flushEnds();
        _props.onStart?.({
          interaction: 'pointer',
          item: d.item,
          el: d.el,
          from: d.from,
          to: d.to,
          oldIndex: d.oldIndex,
          newIndex: d.newIndex,
          originalEvent: d.event
        });
      },
      // Runs once per drag, in a task after every list involved has written its
      // items and the re-render those writes scheduled (see useSortableJS).
      // `end` comes from the list the row ended up in: the destination when it
      // is a SortableList, else (dropped outside, or into a SortableJS list
      // that isn't one of ours) this source list.
      onEnd: (d: any) => {
        const dest = registry.entryFor(d.to) ?? entry;
        if (dest == null) return;
        const row = d.item === undefined ? null : rowByKey(d.to, dest.keyOf(d.item, d.newIndex));
        dest.emit('end', {
          interaction: 'pointer',
          item: d.item,
          el: row ?? d.el,
          from: d.from,
          to: d.to,
          oldIndex: d.oldIndex,
          newIndex: d.newIndex,
          originalEvent: d.event
        });
      }
    });
    instance = sortable.instance;
    const listEl = listElRef;
    const stopNative = (ev: any) => {
      if (ev.target === listEl) ev.stopPropagation();
    };
    for (const name of SORTABLE_DOM_EVENTS as any) listEl?.addEventListener(name, stopNative);
    // A focused row that stops being focusable (its tabindex goes when the
    // keyboard turns off) is blurred at once, during the framework's DOM
    // update, with focus going nowhere (`relatedTarget` null): it would land on
    // <body>. Move it to the list instead.
    const rowBlurred = (ev: any) => {
      const row: any = ev.target;
      if (ev.relatedTarget != null || row == null || row.parentNode !== listEl) return;
      if (!row.classList.contains('rozie-sortable-item') || row.hasAttribute('tabindex') || !row.isConnected) return;
      if (!listEl.hasAttribute('tabindex')) listEl.setAttribute('tabindex', '-1');
      listEl.focus();
    };
    listEl?.addEventListener('focusout', rowBlurred);
    unhookNativeEvents = () => {
      for (const name of SORTABLE_DOM_EVENTS as any) listEl?.removeEventListener(name, stopNative);
      listEl?.removeEventListener('focusout', rowBlurred);
    };

    // Register with the keyboard registry. Other instances call these methods
    // when a keyboard lift hands a row between lists.
    entry = {
      el: listEl,
      instructionsId,
      group: () => effectiveGroup(),
      label: () => local.listLabel,
      // A handle-mode list without a handle selector has its keyboard off.
      keyboardEnabled: () => keyboardEnabled() && !(handleMode() && local.handle == null),
      items: () => items(),
      keyOf: (item: any, i: any) => String(keyFor(item, i)),
      labelOf: (item: any, i: any) => String(labelOf(item, i)),
      onKey: (key: any, shift: any) => holderKey(key, shift),
      write: (next: any) => {
        setItems(next);
      },
      setLifted: (i: any) => {
        setLiftedIndex(i);
      },
      announce: (text: any) => {
        setAriaLiveText(text);
      },
      focusRow: (item: any, i: any) => refocusRow(item, i),
      focusNear: (i: any) => focusNearRow(i),
      rowEl: (i: any) => {
        const list = items();
        if (i < 0 || i >= list.length) return null;
        return rowByKey(listEl, String(keyFor(list[i], i)));
      },
      emit: (name: any, payload: any) => {
        if (name === 'add') _props.onAdd?.(payload);else if (name === 'remove') _props.onRemove?.(payload);else if (name === 'reorder') _props.onReorder?.(payload);else if (name === 'start') _props.onStart?.(payload);else if (name === 'end') _props.onEnd?.(payload);
      }
    };
    unregisterEntry = registry.register(entry);
    const strayKey = (ev: any) => onStrayKey(ev);
    // A pointer press means the user moved on: keys lost to <body> after it
    // are not routed to the lift.
    const pointerPress = () => {
      if (registry.lift != null) registry.lift.focusPending = false;
    };
    document.addEventListener('keydown', strayKey);
    document.addEventListener('pointerdown', pointerPress, true);
    unhookStrayKeys = () => {
      document.removeEventListener('keydown', strayKey);
      document.removeEventListener('pointerdown', pointerPress, true);
    };
    // $onMount's cleanup-return: closing over a setup-local (`sortable`) does
    // not survive the Solid emitter's setup/cleanup split — it scopes cleanup
    // outside the setup IIFE. Closing over `instance` / `unregisterEntry`
    // (module-scope `let`s) works on every target.
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    instance?.destroy();
    // Unmounting while holding a keyboard lift ends it (with its `end` event,
    // which some targets may no longer deliver during unmount).
    if (registry.lift != null && registry.lift.holder === entry) loseLift(true);
    unregisterEntry?.();
    unregisterEntry = null;
    unhookNativeEvents?.();
    unhookNativeEvents = null;
    unhookStrayKeys?.();
    unhookStrayKeys = null;
  });
  });
  let listElRef: HTMLElement | null = null;

  let instance: any = null;

  // Keyboard lift state lives in the shared registry (one active keyboard lift
  // per page, so a later task can hand a lifted row between lists).
  // `$data.liftedIndex` is only its mirror, for the lifted-row styling.
  const registry = getKeyboardRegistry();
  // This list's registry entry (a ListEntry), built and registered in $onMount.
  let entry: any = null;
  let unregisterEntry: any = null;
  // Removes the listeners that keep SortableJS's own DOM events inside the list.
  let unhookNativeEvents: any = null;
  // Removes the document keydown listener that catches keys lost to <body>.
  let unhookStrayKeys: any = null;

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

  // role="list" takes no aria-orientation, so a horizontal list says which
  // arrow keys move in its instructions instead.
  const GROUP_INSTRUCTIONS = ' Hold Shift with an arrow key to move to another list.';
  function instructionsText() {
    if (local.keyboardInstructions != null) return local.keyboardInstructions;
    const arrows = local.orientation === 'horizontal' ? 'Use the left and right arrow keys to move' : 'Use the arrow keys to move';
    const text = 'Press Space or Enter to pick up. ' + arrows + ', Home and End to jump, and Escape to cancel.';
    return local.group != null ? text + GROUP_INSTRUCTIONS : text;
  }

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

  // The group SortableJS actually runs with: `options.group` lands after the
  // named props in the merge, so it wins. Keyboard hops follow the same rules
  // as the mouse, so they read this one.
  function effectiveGroup() {
    const o: any = local.options;
    return o != null && o.group != null ? o.group : resolveGroup();
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
  function labelOf(item: any, idx: any) {
    if (local.labelFor !== null) return local.labelFor(item, idx);
    if (item !== null && typeof item === 'object' && 'label' in item) return item.label;
    return String(item);
  }

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
  //
  // The keyboard follows the SortableJS options the mouse obeys: `disabled`
  // (the prop, `options.disabled`, or `option('disabled', v)`), `filter` and
  // `draggable` (which rows lift, see rowLiftable) and `sort: false` (no moves
  // within the list). `liveOption` reads the value SortableJS runs with: one set
  // at runtime, else `options`, else the named prop.
  const KEYBOARD_OPTIONS = ['disabled', 'filter', 'draggable', 'sort'];
  function liveOption(name: any, fallback: any) {
    const ov: any = optionOverrides();
    if (ov != null && Object.prototype.hasOwnProperty.call(ov, name)) return ov[name];
    const o: any = local.options;
    if (o != null && o[name] !== undefined) return o[name];
    return fallback;
  }
  function setOverride(name: any, value: any) {
    setOptionOverrides({
      ...optionOverrides(),
      [name]: value
    });
  }
  function keyboardEnabled() {
    return !local.disableKeyboard && !liveOption('disabled', local.disabled);
  }

  // keyboardTrigger='handle' mode: rows are not tab stops and the keys are read
  // from the consumer's handle element instead. Any other value is 'row' mode.
  function handleMode() {
    return local.keyboardTrigger === 'handle';
  }
  // Rows are tab stops only in row mode (and only while keyboard is enabled).
  function rowTabbable() {
    return keyboardEnabled() && !handleMode();
  }

  // One-time-per-change dev warning: handle mode needs a handle selector. Without
  // one the keyboard is OFF (see the onRowKeyDown gate) — never a silent fallback
  // to row mode, which would re-introduce the tab stops the consumer opted out of.
  function warnIfHandleMissing() {
    if (handleMode() && local.handle == null) {
      console.warn('[rozie-sortable-list] keyboardTrigger is "handle" but no handle selector is set, so keyboard reordering is off. Pass a handle selector (e.g. handle=".grip") or use keyboardTrigger "row".');
    }
  }

  // True only when a keydown originated inside a `handle` element that belongs to
  // THIS row. Walks the COMPOSED ancestor chain from the event target up to (but
  // excluding) the row (currentTarget): assignedSlot -> parentNode -> shadow host.
  // Plain closest()/contains() stop at a shadow boundary, and Lit renders a Rozie
  // consumer's slot content inside the SortableList shadow root while plain-HTML
  // consumers project light-DOM nodes through a <slot>. composedPath() is not
  // used because React's synthetic event does not expose it. Another
  // .rozie-sortable-item met first means the key came from a NESTED list's row,
  // which must not reorder this (outer) list.
  function isHandleKeyOrigin($event: any) {
    const sel = local.handle;
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
  }

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
  function refocusRow(item: any, idx: any) {
    const listEl = listElRef;
    const sel = local.handle;
    const useHandle = handleMode();
    const key = String(keyFor(item, idx));
    // While this refocus is outstanding, a key that falls to <body> belongs to
    // the lift (see onStrayKey). Cleared once the row has focus again, or by a
    // pointer press anywhere.
    const pending = registry.lift;
    if (pending != null) pending.focusPending = true;
    const focusIt = (onlyIfLost: any) => {
      if (!listEl) return;
      if (useHandle && sel == null) return;
      if (onlyIfLost && document.activeElement && document.activeElement !== document.body) return;
      for (const row of Array.from(listEl.children) as any[]) {
        if (row.getAttribute('data-id') === key) {
          const target = useHandle ? row.querySelector(sel) : row;
          if (target && typeof target.focus === 'function') {
            target.focus();
            const l = registry.lift;
            if (l != null && l === pending && l.key === key) {
              l.focusPending = false;
              // This row is the lifted row element now (see the items watcher).
              l.liftedRowEl = row;
            }
          }
          return;
        }
      }
    };
    queueMicrotask(() => focusIt(false));
    setTimeout(() => focusIt(true), 0);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => focusIt(true));
  }

  // The row element carrying `data-id === key` among a list element's direct
  // children (skips nested-list rows and header/footer slot content).
  function rowByKey(listEl: any, key: any) {
    if (!listEl || key == null) return null;
    for (const row of Array.from(listEl.children) as any[]) {
      if (row.getAttribute('data-id') === key) return row;
    }
    return null;
  }

  // After the consumer changed the items of the list holding a lift, put focus
  // on the row (or its handle) whose key is `key`, else the row nearest `index`
  // (or the list itself when it has no rows left) — but only once focus has fallen to <body> (the focused row's element went
  // away: the lift was lost, or a framework that keys rows by object identity
  // re-created the lifted row). Never steals focus from anywhere else. Same
  // three passes as refocusRow, for targets that commit late.
  function focusNearRow(index: number, key: string | null = null) {
    const listEl = listElRef;
    const sel = local.handle;
    const useHandle = handleMode();
    const focusIt = () => {
      if (!listEl) return;
      if (useHandle && sel == null) return;
      if (document.activeElement && document.activeElement !== document.body) return;
      const rows = Array.from(listEl.children).filter((r: any) => r.hasAttribute('data-id') && r.classList.contains('rozie-sortable-item')) as any[];
      if (rows.length === 0) {
        // The list is now empty: focus the list itself (out of the tab order)
        // so keyboard and screen-reader users stay where they were.
        if (!listEl.hasAttribute('tabindex')) listEl.setAttribute('tabindex', '-1');
        listEl.focus();
        return;
      }
      const row = rows.find((r: any) => key != null && r.getAttribute('data-id') === key) ?? rows[Math.max(0, Math.min(rows.length - 1, index))];
      const target = useHandle ? row.querySelector(sel) : row;
      if (target && typeof target.focus === 'function') target.focus();
    };
    queueMicrotask(focusIt);
    setTimeout(focusIt, 0);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusIt);
  }

  // Speak `text` from `target`'s aria-live region. The region that spoke last
  // is cleared when it belongs to another list, so a message is heard once, from
  // the list the row is in now, and never from a list that just lost it.
  function speak(target: any, text: any) {
    const prev = registry.speaker;
    if (prev != null && prev !== target && registry.has(prev)) prev.announce('');
    registry.speaker = target;
    target.announce(text);
  }

  // The lifted item is no longer in the list holding it: the consumer changed
  // that list's items (or re-keyed the item), or the list is unmounting. End the
  // lift without writing anything (the item is wherever the consumer's data put
  // it). `end` still fires once, with `item` = the lifted value and `el: null`
  // (there is no row), so keyboard `start` / `end` always pair. Lost to a consumer change (not an
  // unmount), the holder says `Lift ended` and, if focus fell to <body> with the
  // row, focuses its row nearest where the lifted row was.
  function loseLift(unmounting = false) {
    const lift = registry.lift;
    if (!lift) return;
    const h = lift.holder;
    registry.lift = null;
    h.setLifted(null);
    if (!unmounting) {
      speak(h, 'Lift ended');
      h.focusNear(lift.index ?? lift.origin.index);
    }
    const payload = {
      interaction: 'keyboard',
      item: lift.item,
      el: null,
      from: lift.origin.list.el,
      to: h.el,
      oldIndex: lift.origin.index,
      newIndex: -1
    };
    // Like every `end`, in a task after the writes. An unmounting list emits it
    // now: a later emit from an unmounted component would not be delivered.
    if (unmounting) h.emit('end', payload);else registry.deferEnd(() => h.emit('end', payload));
  }

  // Keyboard `start` / `end` (the same payload as every other event): `item` is
  // the item value, `el` its row element. `start` fires from the origin list
  // (`from`), `end` from the list the row ends up in (`to`). `el` is the row in
  // that list when it is rendered, else `fallbackEl` (the row element the move
  // started from, before a target re-rendered). `end` is called after
  // `registry.lift` is cleared, so a consumer `end` handler that writes the
  // items (re-keying a clone copy) is not mistaken for a lost lift, and it is
  // emitted in a task (`registry.deferEnd`), after the writes AND the re-render
  // they schedule: a consumer `end` handler reads the new state on every target
  // (React included, whose handler closure is the one from the latest render).
  function keyboardStartEnd(name: any, lift: any, from: any, to: any, oldIndex: any, newIndex: any, fallbackEl = null) {
    const host = name === 'start' ? from : to;
    const fire = () => host.emit(name, {
      interaction: 'keyboard',
      item: lift ? lift.item : null,
      el: (lift ? rowByKey(host.el, lift.key) : null) ?? fallbackEl,
      from: from.el,
      to: to.el,
      oldIndex,
      newIndex
    });
    if (name === 'end') registry.deferEnd(fire);else fire();
  }

  // Move the lifted row to `toIndex` (clamped) within the list holding it.
  // Works through the registry entry, so it acts on the current holder.
  function moveLiftTo(toIndex: any) {
    const lift = registry.lift;
    if (!lift) return;
    const h = lift.holder;
    const from = registry.indexOfLift();
    if (from < 0) {
      loseLift();
      return;
    }
    const items = h.items();
    const to = Math.max(0, Math.min(items.length - 1, toIndex));
    if (to === from) return;
    // The moved row's element, read before the write (an index key changes).
    const el = h.rowEl(from);
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    // Index keys (primitive items without itemKey) change with the position.
    // Update the lift BEFORE writing: a target whose watchers run synchronously
    // on the write must already see where the row is going.
    lift.key = h.keyOf(moved, to);
    lift.index = to;
    h.write(next);
    h.setLifted(to);
    // Name the row that MOVED from the local `moved` item: on React/Vue/Lit the
    // items prop still holds the pre-write array here. Labels come from the
    // holder's own `labelFor`.
    speak(h, 'Moved ' + h.labelOf(moved, to) + ' to position ' + (to + 1));
    h.focusRow(moved, to);
    h.emit('reorder', {
      interaction: 'keyboard',
      item: moved,
      el,
      from: h.el,
      to: h.el,
      oldIndex: from,
      newIndex: to
    });
  }

  // Hop the lifted row to the next (`dir` 1) or previous (-1) list it could
  // also reach by mouse, in composed-tree source order. One hand-off: the source
  // writes its items without the row and emits `remove`, the destination writes
  // them with it and emits `add`, and the destination becomes the holder. A
  // forward hop lands first, a backward hop lands last.
  function hop(dir: any) {
    const lift = registry.lift;
    if (!lift) return;
    const from = lift.holder;
    const i = registry.indexOfLift();
    if (i < 0) {
      loseLift();
      return;
    }
    const fromItems = from.items();
    const data = fromItems[i];
    const el = from.rowEl(i);
    // Keep the lifted row element current: lists nested inside it (a grid
    // widget's columns) are never hop targets. Before a target re-renders the
    // row may not exist yet, so keep the last known element then.
    lift.liftedRowEl = el ?? lift.liftedRowEl;
    const to = registry.findHopTarget(from, dir);
    if (to == null) {
      speak(from, (dir === 1 ? 'No list after ' : 'No list before ') + registry.listName(from));
      return;
    }
    const origin = lift.origin;
    const toItems = to.items();
    // A clone copy hopping back into the list it was cloned from merges with
    // its original there (that list never gave it up), rather than adding a
    // second row with the same key.
    if (lift.copy && to === origin.list) {
      let home = toItems.indexOf(data);
      if (home < 0) home = Math.max(0, Math.min(toItems.length - 1, origin.index));
      lift.holder = to;
      lift.copy = false;
      lift.key = to.keyOf(toItems[home], home);
      lift.item = toItems[home];
      lift.index = home;
      const rest = [...fromItems];
      rest.splice(i, 1);
      from.write(rest);
      from.emit('remove', {
        interaction: 'keyboard',
        item: data,
        el,
        from: from.el,
        to: to.el,
        oldIndex: i,
        newIndex: -1
      });
      from.setLifted(null);
      to.setLifted(home);
      speak(to, 'Moved ' + to.labelOf(data, home) + ' to ' + registry.listName(to) + ', position ' + (home + 1));
      to.focusRow(toItems[home], home);
      return;
    }
    // The first hop out of a clone source (`pull: 'clone'`) leaves the source
    // untouched and carries a copy (the same item value the mouse path
    // inserts); from then on the copy moves like any row.
    const cloneOut = canHop(from.group(), to.group()).copy && from === origin.list && !lift.copy;
    const at = dir === 1 ? 0 : toItems.length;
    // Update the lift BEFORE writing, so a target whose watchers run
    // synchronously on a write already sees the new holder.
    lift.holder = to;
    lift.key = to.keyOf(data, at);
    lift.index = at;
    lift.hopped = true;
    if (cloneOut) {
      lift.copy = true;
    } else {
      const rest = [...fromItems];
      rest.splice(i, 1);
      from.write(rest);
      from.emit('remove', {
        interaction: 'keyboard',
        item: data,
        el,
        from: from.el,
        to: to.el,
        oldIndex: i,
        newIndex: -1
      });
    }
    const next = [...toItems];
    next.splice(at, 0, data);
    to.write(next);
    // The destination has not rendered its new row yet: `el` is the row the
    // move started from.
    to.emit('add', {
      interaction: 'keyboard',
      item: data,
      el,
      from: from.el,
      to: to.el,
      oldIndex: -1,
      newIndex: at
    });
    from.setLifted(null);
    to.setLifted(at);
    speak(to, 'Moved ' + to.labelOf(data, at) + ' to ' + registry.listName(to) + ', position ' + (at + 1));
    to.focusRow(data, at);
  }

  // End the active keyboard lift. 'drop' leaves the row where it is ('off' too,
  // announced as `Lift ended`: the holder's keyboard was turned off); 'cancel'
  // returns it to the list and position it was lifted from (after hops, a
  // reverse hand-off with its own `remove` / `add`; a clone copy is removed).
  // Emits `end` once, from the list the row ends up in.
  function endLift(kind: any) {
    const lift = registry.lift;
    if (!lift) return;
    const h = lift.holder;
    const origin = lift.origin;
    const at = registry.indexOfLift();
    if (at < 0) {
      loseLift();
      return;
    }
    const items = h.items();
    const item = items[at];
    // The lifted row's element, read before any write below.
    const el = h.rowEl(at);
    const name = (e: any) => registry.listName(e);
    if (kind === 'drop' || kind === 'off') {
      // A row that hopped always names its list, even back in its origin. The
      // keyboard turned off mid-lift ('off') ends it where it is, too.
      speak(h, kind === 'off' ? 'Lift ended' : !lift.hopped ? 'Dropped ' + h.labelOf(item, at) + ' at position ' + (at + 1) : 'Dropped ' + h.labelOf(item, at) + ' in ' + name(h) + ' at position ' + (at + 1));
      h.setLifted(null);
      registry.lift = null;
      keyboardStartEnd('end', lift, origin.list, h, origin.index, at, el);
      return;
    }
    if (h !== origin.list && !registry.has(origin.list) && lift.copy) {
      // A clone copy is removed on cancel even when its source list has
      // unmounted (the source never gave its item up). Focus moves to the
      // neighbouring row, if any. The lift ends BEFORE the write: the copy is
      // leaving on purpose, and a target whose items watcher runs synchronously
      // on the write (Solid) must not take it for a lost lift (a second `end`).
      registry.lift = null;
      const rest = [...items];
      rest.splice(at, 1);
      h.write(rest);
      h.emit('remove', {
        interaction: 'keyboard',
        item,
        el,
        from: h.el,
        to: h.el,
        oldIndex: at,
        newIndex: -1
      });
      h.setLifted(null);
      speak(h, 'Cancelled. ' + h.labelOf(item, at) + ' removed from ' + name(h));
      if (rest.length > 0) {
        const k = Math.min(at, rest.length - 1);
        h.focusRow(rest[k], k);
      }
      // The copy is gone, so there is no row: `el: null`.
      const fromEl = origin.list.el;
      registry.deferEnd(() => h.emit('end', {
        interaction: 'keyboard',
        item,
        el: null,
        from: fromEl,
        to: h.el,
        oldIndex: origin.index,
        newIndex: -1
      }));
      return;
    }
    if (h !== origin.list && (!registry.has(origin.list) || !isRenderable(origin.list.el) || !origin.list.keyboardEnabled())) {
      // The origin list has unmounted, is hidden, or has its keyboard off:
      // there is nowhere to return to (focus would be stranded), so the row
      // stays where it is (the lift ends as a drop at its position).
      speak(h, 'Cancelled. ' + h.labelOf(item, at) + ' stays in ' + name(h) + ', position ' + (at + 1));
      h.setLifted(null);
      registry.lift = null;
      keyboardStartEnd('end', lift, origin.list, h, origin.index, at, el);
      return;
    }
    if (h === origin.list) {
      const to = Math.max(0, Math.min(items.length - 1, origin.index));
      if (to !== at) {
        const next = [...items];
        next.splice(at, 1);
        next.splice(to, 0, item);
        lift.key = h.keyOf(item, to);
        h.write(next);
        h.focusRow(item, to);
        h.emit('reorder', {
          interaction: 'keyboard',
          item,
          el,
          from: h.el,
          to: h.el,
          oldIndex: at,
          newIndex: to
        });
      }
      speak(h, lift.hopped ? 'Cancelled. ' + h.labelOf(item, to) + ' returned to ' + name(h) + ', position ' + (to + 1) : 'Cancelled. ' + h.labelOf(item, to) + ' returned to position ' + (to + 1));
      h.setLifted(null);
      registry.lift = null;
      keyboardStartEnd('end', lift, origin.list, h, origin.index, to, el);
      return;
    }
    // Reverse hand-off from the current holder back to the origin list.
    const home = origin.list;
    const homeItems = home.items();
    let back;
    if (lift.copy) {
      // The clone source never gave its item up: drop the copy, focus the
      // original.
      back = homeItems.indexOf(item);
      if (back < 0) back = Math.max(0, Math.min(homeItems.length - 1, origin.index));
    } else {
      back = Math.min(origin.index, homeItems.length);
    }
    lift.holder = home;
    lift.key = home.keyOf(item, back);
    const rest = [...items];
    rest.splice(at, 1);
    h.write(rest);
    h.emit('remove', {
      interaction: 'keyboard',
      item,
      el,
      from: h.el,
      to: home.el,
      oldIndex: at,
      newIndex: -1
    });
    if (!lift.copy) {
      const next = [...homeItems];
      next.splice(back, 0, item);
      home.write(next);
      home.emit('add', {
        interaction: 'keyboard',
        item,
        el,
        from: h.el,
        to: home.el,
        oldIndex: -1,
        newIndex: back
      });
    }
    h.setLifted(null);
    // `home` holds the lift during its write, so a target whose items watcher
    // runs synchronously on the write (Solid) highlighted the row there: clear it.
    home.setLifted(null);
    speak(home, 'Cancelled. ' + home.labelOf(item, back) + ' returned to ' + name(home) + ', position ' + (back + 1));
    home.focusRow(lift.copy ? homeItems[back] : item, back);
    registry.lift = null;
    keyboardStartEnd('end', lift, home, home, origin.index, back, lift.copy ? home.rowEl(back) : el);
  }

  // This list's keyboard was turned off (`disabled`, `disableKeyboard`, or
  // `option('disabled', true)`): a lift it holds ends where the row is, with
  // its `end`.
  function endLiftIfHeld() {
    const lift = registry.lift;
    if (lift != null && lift.holder === entry) endLift('off');
  }

  // In row mode the rows leave the tab order when the keyboard turns off, and a
  // focused element that stops being focusable drops focus to <body>. If one of
  // this list's rows still has focus (a target whose watcher runs before its DOM
  // update), move it to the list itself (out of the tab order), like an emptied
  // list. Once the DOM update has run, the `focusout` listener added in $onMount
  // does it instead.
  function keepFocusOffBody() {
    const listEl = entry ? entry.el : null;
    if (!listEl) return;
    const root: any = listEl.getRootNode();
    const a: any = root != null ? root.activeElement : null;
    if (a == null || a.parentNode !== listEl || !a.classList.contains('rozie-sortable-item')) return;
    if (!listEl.hasAttribute('tabindex')) listEl.setAttribute('tabindex', '-1');
    listEl.focus();
  }
  function keyboardTurnedOff() {
    endLiftIfHeld();
    keepFocusOffBody();
  }

  // Lift the row at `index` of this list.
  function startLift(index: any) {
    if (!entry) return;
    // A previous drag's or lift's `end` that is still pending fires first, so
    // every `end` comes before the next `start`.
    registry.flushEnds();
    const item = items()[index];
    registry.lift = {
      holder: entry,
      key: entry.keyOf(item, index),
      item,
      copy: false,
      hopped: false,
      origin: {
        list: entry,
        index
      },
      liftedRowEl: entry.rowEl(index),
      index
    };
    setLiftedIndex(index);
    speak(entry, 'Lifted ' + labelOf(item, index));
    keyboardStartEnd('start', registry.lift, entry, entry, index, index);
  }
  function onRowKeyDown($event: any, index: any) {
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
      if (local.handle == null || !isHandleKeyOrigin($event)) return;
    } else if ($event.target !== $event.currentTarget) {
      return;
    }
    // Defense-in-depth: when keyboard reordering is off the rows carry no
    // tabindex and can't receive focus, but a consumer-focused row (or a
    // programmatic .focus()) must still no-op here rather than reorder.
    if (!keyboardEnabled()) return;
    // While a lift exists, reorder keys in the list holding it act on it. A key
    // from ANOTHER list of the holder's group is routed to the holder only when
    // it comes from the lifted row element itself (its old row, still there
    // before the frameworks re-render after a hop; compared by element, so a
    // row of another list that shares the lifted row's key is not it) or while a refocus after a move is
    // outstanding (a fast burst). Any other row — and every row of an unrelated
    // list (another group, or none) — keeps single-list behaviour: Space/Enter
    // there drops the foreign lift and lifts its own row, other keys do nothing.
    const lift = registry.lift;
    const key = $event.key;
    if (lift != null) {
      const mine = groupNameOf(effectiveGroup());
      const sameGroup = mine != null && mine === groupNameOf(lift.holder.group());
      const fromLiftedRow = lift.liftedRowEl != null && $event.currentTarget === lift.liftedRowEl;
      if (lift.holder === entry || sameGroup && (fromLiftedRow || lift.focusPending === true)) {
        if (lift.holder.onKey(key, !!$event.shiftKey)) $event.preventDefault();
        return;
      }
    }
    // Space (' ' on browsers; KeyboardEvent.key === ' ') OR Enter — lift. A row
    // the mouse can't drag (it matches `filter`, or not `draggable`) can't be
    // lifted either: the key is left alone (not prevented).
    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      const rules = {
        filter: liveOption('filter', local.filter),
        draggable: liveOption('draggable', undefined),
        sortable: instance
      };
      if (!rowLiftable($event.currentTarget as any, rules)) return;
      $event.preventDefault();
      if (lift != null) endLift('drop');
      startLift(index);
    }
  }

  // The group NAME of a SortableJS group option (string or object form).
  function groupNameOf(g: any) {
    return g == null ? null : typeof g === 'string' ? g : g.name ?? null;
  }

  // A reorder key for the lift THIS list holds (routed here from any list via
  // the registry entry's onKey). Returns true when the key was handled. Every
  // key except Space/Enter acts only while lifted, so it never steals keys from
  // fields inside a row.
  function holderKey(key: any, shift: any) {
    const lift = registry.lift;
    if (lift == null || lift.holder !== entry) return false;
    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      endLift('drop');
      return true;
    }
    if (key === 'Escape') {
      endLift('cancel');
      return true;
    }
    const horizontal = local.orientation === 'horizontal';
    const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
    if (shift && (key === nextKey || key === prevKey)) {
      // Hopping is on wherever a group is set; an ungrouped list ignores it.
      if (effectiveGroup() == null) return false;
      hop(key === nextKey ? 1 : -1);
      return true;
    }
    const from = registry.indexOfLift();
    if (from < 0) {
      loseLift();
      return false;
    }
    // pageStep below 1 (or not a number) still moves by at least one position.
    const step = Math.max(1, Math.floor(Number(local.pageStep) || 1));
    let to: any = null;
    if (key === nextKey) to = from + 1;else if (key === prevKey) to = from - 1;else if (key === 'Home') to = 0;else if (key === 'End') to = entry.items().length - 1;else if (key === 'PageDown') to = from + step;else if (key === 'PageUp') to = from - step;
    if (to === null) return false;
    // `sort: false`: no moves within the list (as by mouse). The key is still
    // taken, so it does not scroll the page while a row is lifted.
    if (liveOption('sort', true) === false) return true;
    moveLiftTo(to);
    return true;
  }

  // A key pressed while focus has fallen to <body> during a lift. A hop removes
  // the focused row from one list and the destination may render (and take
  // focus) only after the handler returns (Angular), so the next key of a fast
  // burst can reach <body>. The list holding the lift handles it as if it had
  // landed on the lifted row, then puts focus back on that row.
  //
  // Only while a refocus of ours is outstanding (`focusPending`): focus that left
  // the lifted row for any other reason (the user clicked elsewhere or tabbed
  // away) keeps today's behaviour, and those keys are not ours. Modified keys
  // and keys someone already handled are never taken.
  function onStrayKey(ev: any) {
    const lift = registry.lift;
    if (lift == null || lift.holder !== entry || !lift.focusPending) return;
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target;
    if (t !== document.body && t !== document.documentElement) return;
    const item = lift.item;
    const at = registry.indexOfLift();
    if (!holderKey(ev.key, !!ev.shiftKey)) return;
    ev.preventDefault();
    const now = registry.lift;
    if (now != null) now.holder.focusRow(now.item, registry.indexOfLift());else if (at >= 0) entry.focusRow(item, at);
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
  // Setting `disabled`, `filter`, `draggable` or `sort` also applies to the
  // keyboard; `option('disabled', true)` mid-lift ends the lift this list holds.
  function option(name: any, value: any) {
    if (!instance) return undefined;
    if (value === undefined) return instance.option(name);
    instance.option(name, value);
    if (KEYBOARD_OPTIONS.includes(name)) setOverride(name, value);
    if (name === 'disabled' && value) keyboardTurnedOff();
    return value;
  }

  return (
    <>
    <div {...attrs} class={"rozie-sortable-wrap" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-0af24eae="">
      <div class={rozieClass(['rozie-sortable-list', local.listClass])} ref={(el) => { listElRef = el as HTMLElement; }} part="list" role="list" aria-label={rozieAttr(local.listLabel)} data-rozie-s-0af24eae="">
        {(_props.headerSlot ?? _props.slots?.['header']?.({}))}
        <For each={items()}>{(item, index) => <div data-id={rozieAttr(keyFor(item, index()))} role="listitem" aria-describedby={rozieAttr(rowTabbable() ? instructionsId : null)} class={rozieClass(['rozie-sortable-item', itemClassFor(item, index()), liftedIndex() === index() ? 'rozie-sortable-item-lifted' : ''])} style={parseInlineStyle(itemStyleFor(item, index()))} tabIndex={rozieAttr(rowTabbable() ? 0 : null)} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: Element }) => { onRowKeyDown($event, index()); }} data-rozie-s-0af24eae="">
          {typeof local.children === 'function' ? (local.children as (s: any) => any)({ item, get index() { return index(); }, instructionsId }) : resolved()}
        </div>}</For>
        {(_props.footerSlot ?? _props.slots?.['footer']?.({}))}
      </div>
      <div class={"rozie-sortable-aria-live"} data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true" data-rozie-s-0af24eae="">{ariaLiveText()}</div>
      <span hidden={true} id={rozieAttr(instructionsId)} data-rozie-s-0af24eae="">{rozieDisplay(instructionsText())}</span>
    </div>
    </>
  );
}
