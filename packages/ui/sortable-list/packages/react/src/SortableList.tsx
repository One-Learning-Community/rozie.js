import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { clsx, parseInlineStyle, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './SortableList.css';
import { useSortableJS } from './internal/useSortableJS';
import { getKeyboardRegistry, nextInstructionsId } from './internal/keyboardRegistry';

interface ChildrenCtx { item: any; index: any; instructionsId: any; }

interface SortableListProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'items' | 'defaultItems' | 'onItemsChange' | 'itemKey' | 'handle' | 'group' | 'animation' | 'disabled' | 'disableKeyboard' | 'keyboardTrigger' | 'options' | 'labelFor' | 'ghostClass' | 'chosenClass' | 'dragClass' | 'filter' | 'easing' | 'forceFallback' | 'swapThreshold' | 'cloneable' | 'listClass' | 'itemClass' | 'listLabel' | 'orientation' | 'pageStep' | 'keyboardInstructions' | 'itemStyle' | 'onChange' | 'onAdd' | 'onRemove' | 'onStart' | 'onEnd' | 'renderHeader' | 'children' | 'renderFooter' | 'slots' | 'dangerouslySetInnerHTML'> {
  /**
   * The bound items array. The sole `model: true` prop — two-way bind it (`r-model:items` / `v-model:items` / `bind:items` / `[(items)]`) and SortableList writes the re-ordered array back whenever a drag, cross-list move, or keyboard reorder commits, with no manual `onChange → setState` wiring.
   * @example
   * <SortableList items={todos} onItemsChange={setTodos} itemKey="id" />
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
   * The list's human name, such as `"Top sidebar"`. Sets `aria-label` on the list container (`role="list"`) and names the list in keyboard announcements. Pass the same words as the zone's visible heading. With no label, announcements fall back to a neutral `list 2 of 3`.
   */
  listLabel?: (string) | null;
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
  keyboardInstructions?: (string) | null;
  /**
   * Per-row inline style applied to the `.rozie-sortable-item` wrapper. Accepts a CSS `String`, a flat style object (`Record<string, string | number>`), or an `(item, index) => string | object` function for per-row styling. Because it lands on the wrapper — the direct child of the list container — it can drive CSS-grid placement (`grid-column` / `grid-row` / `align-self`) when `listClass` sets `display: grid`. Normalized per target; `null` / empty drops the attribute.
   */
  itemStyle?: (string | Record<string, any> | ((...args: any[]) => any)) | null;
  onChange?: (...args: any[]) => void;
  onAdd?: (...args: any[]) => void;
  onRemove?: (...args: any[]) => void;
  onStart?: (...args: any[]) => void;
  onEnd?: (...args: any[]) => void;
  renderHeader?: () => ReactNode;
  children?: ReactNode | ((ctx: ChildrenCtx) => ReactNode);
  renderFooter?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface SortableListHandle {
  getInstance: (...args: any[]) => any;
  toArray: (...args: any[]) => any;
  sort: (...args: any[]) => any;
  option: (...args: any[]) => any;
}

const SortableList = forwardRef<SortableListHandle, SortableListProps>(function SortableList(_props: SortableListProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const props: Omit<SortableListProps, 'itemKey' | 'handle' | 'group' | 'animation' | 'disabled' | 'disableKeyboard' | 'keyboardTrigger' | 'options' | 'labelFor' | 'ghostClass' | 'chosenClass' | 'dragClass' | 'filter' | 'easing' | 'forceFallback' | 'swapThreshold' | 'cloneable' | 'listClass' | 'itemClass' | 'listLabel' | 'orientation' | 'pageStep' | 'keyboardInstructions' | 'itemStyle'> & { itemKey: (string | ((...args: any[]) => any)) | null; handle: (string) | null; group: (string) | null; animation: number; disabled: boolean; disableKeyboard: boolean; keyboardTrigger: string; options: Record<string, any>; labelFor: ((...args: any[]) => any) | null; ghostClass: (string) | null; chosenClass: (string) | null; dragClass: (string) | null; filter: (string) | null; easing: (string) | null; forceFallback: boolean; swapThreshold: number; cloneable: boolean; listClass: string | any[] | Record<string, any>; itemClass: string | any[] | Record<string, any> | ((...args: any[]) => any); listLabel: (string) | null; orientation: string; pageStep: number; keyboardInstructions: (string) | null; itemStyle: (string | Record<string, any> | ((...args: any[]) => any)) | null } = {
    ..._props,
    itemKey: _props.itemKey ?? null,
    handle: _props.handle ?? null,
    group: _props.group ?? null,
    animation: _props.animation ?? 150,
    disabled: _props.disabled ?? false,
    disableKeyboard: _props.disableKeyboard ?? false,
    keyboardTrigger: _props.keyboardTrigger ?? 'row',
    options: _props.options ?? __defaultOptions,
    labelFor: _props.labelFor ?? null,
    ghostClass: _props.ghostClass ?? null,
    chosenClass: _props.chosenClass ?? null,
    dragClass: _props.dragClass ?? null,
    filter: _props.filter ?? null,
    easing: _props.easing ?? null,
    forceFallback: _props.forceFallback ?? false,
    swapThreshold: _props.swapThreshold ?? 1,
    cloneable: _props.cloneable ?? false,
    listClass: _props.listClass ?? '',
    itemClass: _props.itemClass ?? '',
    listLabel: _props.listLabel ?? null,
    orientation: _props.orientation ?? 'vertical',
    pageStep: _props.pageStep ?? 5,
    keyboardInstructions: _props.keyboardInstructions ?? null,
    itemStyle: _props.itemStyle ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { items, itemKey, handle, group, animation, disabled, disableKeyboard, keyboardTrigger, options, labelFor, ghostClass, chosenClass, dragClass, filter, easing, forceFallback, swapThreshold, cloneable, listClass, itemClass, listLabel, orientation, pageStep, keyboardInstructions, itemStyle, defaultValue, onItemsChange, defaultItems, onChange, onAdd, onRemove, onStart, onEnd, renderHeader, children, renderFooter, slots, ...rest } = _props as SortableListProps & Record<string, unknown>;
    void items; void itemKey; void handle; void group; void animation; void disabled; void disableKeyboard; void keyboardTrigger; void options; void labelFor; void ghostClass; void chosenClass; void dragClass; void filter; void easing; void forceFallback; void swapThreshold; void cloneable; void listClass; void itemClass; void listLabel; void orientation; void pageStep; void keyboardInstructions; void itemStyle; void defaultValue; void onItemsChange; void defaultItems; void onChange; void onAdd; void onRemove; void onStart; void onEnd; void renderHeader; void children; void renderFooter; void slots;
    return rest;
  })();
  const instance = useRef<any>(null);
  const entry = useRef<any>(null);
  const unregisterEntry = useRef<any>(null);
  const __rowKeySeq = useRef(0);
  const [items, setItems] = useControllableState({
    value: props.items,
    defaultValue: props.defaultItems ?? (() => [])(),
    onValueChange: props.onItemsChange,
  });
  const _animationRef = useRef(props.animation);
  _animationRef.current = props.animation;
  const _chosenClassRef = useRef(props.chosenClass);
  _chosenClassRef.current = props.chosenClass;
  const _disabledRef = useRef(props.disabled);
  _disabledRef.current = props.disabled;
  const _dragClassRef = useRef(props.dragClass);
  _dragClassRef.current = props.dragClass;
  const _easingRef = useRef(props.easing);
  _easingRef.current = props.easing;
  const _filterRef = useRef(props.filter);
  _filterRef.current = props.filter;
  const _forceFallbackRef = useRef(props.forceFallback);
  _forceFallbackRef.current = props.forceFallback;
  const _ghostClassRef = useRef(props.ghostClass);
  _ghostClassRef.current = props.ghostClass;
  const _handleRef = useRef(props.handle);
  _handleRef.current = props.handle;
  const _listLabelRef = useRef(props.listLabel);
  _listLabelRef.current = props.listLabel;
  const _onAddRef = useRef(props.onAdd);
  _onAddRef.current = props.onAdd;
  const _onChangeRef = useRef(props.onChange);
  _onChangeRef.current = props.onChange;
  const _onEndRef = useRef(props.onEnd);
  _onEndRef.current = props.onEnd;
  const _onRemoveRef = useRef(props.onRemove);
  _onRemoveRef.current = props.onRemove;
  const _onStartRef = useRef(props.onStart);
  _onStartRef.current = props.onStart;
  const _optionsRef = useRef(props.options);
  _optionsRef.current = props.options;
  const _swapThresholdRef = useRef(props.swapThreshold);
  _swapThresholdRef.current = props.swapThreshold;
  const _itemsRef = useRef(items);
  _itemsRef.current = items;
  const [liftedIndex, setLiftedIndex] = useState<any>(null);
  const [ariaLiveText, setAriaLiveText] = useState('');
  const listEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);
  const _watch5First = useRef(true);
  const _watch6First = useRef(true);
  const _watch7First = useRef(true);
  const _watch8First = useRef(true);
  const _watch9First = useRef(true);
  const _watch10First = useRef(true);

  // Keyboard lift state lives in the shared registry (one active keyboard lift
  // per page, so a later task can hand a lifted row between lists).
  // `$data.liftedIndex` is only its mirror, for the lifted-row styling.
  const registry = useMemo(() => getKeyboardRegistry(), []);
  // This list's registry entry (a ListEntry), built and registered in $onMount.
  // Per-instance id of the hidden spoken-instructions element. Assigned once
  // per instance: it is also read in $onMount (the registry entry), which makes
  // the React emitter keep it across renders instead of minting a new id each
  // render.
  const instructionsId = useMemo(() => nextInstructionsId(), []);
  const DEFAULT_INSTRUCTIONS = 'Press Space or Enter to pick up. Use the arrow keys to move, Home and End to jump, and Escape to cancel.';
  const GROUP_INSTRUCTIONS = ' Hold Shift with an arrow key to move to another list.';
  function instructionsText() {
    if (props.keyboardInstructions != null) return props.keyboardInstructions;
    return props.group != null ? DEFAULT_INSTRUCTIONS + GROUP_INSTRUCTIONS : DEFAULT_INSTRUCTIONS;
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
  const __rowKeyMap = useMemo(() => new WeakMap(), []);
  // 4-tier per-row key precedence. Its return feeds BOTH :key and :data-id.
  const { itemKey: _rozieProp_itemKey } = props;
    const keyFor = useCallback((item: any, index: any) => {
    // (a) function itemKey: consumer-supplied (item, index) => key.
    if (typeof _rozieProp_itemKey === 'function') {
      return _rozieProp_itemKey(item, index);
    }
    // (b) string itemKey: a property name on a non-null object item.
    if (typeof _rozieProp_itemKey === 'string' && item !== null && typeof item === 'object' && item[_rozieProp_itemKey] != null) {
      return item[_rozieProp_itemKey];
    }
    // (c) id-less object (or function) item: assign-on-first-sight WeakMap
    //     synthetic id. Survives reorder because it is keyed by object identity.
    if (item !== null && typeof item === 'object' || typeof item === 'function') {
      if (!__rowKeyMap.has(item)) {
        __rowKeyMap.set(item, '__rk' + __rowKeySeq.current++);
      }
      return __rowKeyMap.get(item);
    }
    // (d) primitive item: fall back to index. NOTE: duplicate primitives are
    //     unsafe to reorder this way — pass a function itemKey for those.
    return index;
  }, [_rozieProp_itemKey]);
  // Resolve the SortableJS `group` option: `cloneable` is a high-level Rozie
  // prop that REPLACES a string `group` with SortableJS's
  // `{ name, pull: 'clone', put: true }` clone-mode object form. When
  // `cloneable:false`, pass `$props.group` through verbatim. When
  // `cloneable:true` AND `$props.group` is null, leave it null — a clone-mode
  // list without a group name is not meaningful (no peer list can join the
  // cross-list flow). Shared by $onMount construction AND the group/cloneable
  // $watch reconcile below — single source of truth, no duplicated ternary.
  const resolveGroup = useCallback(() => props.cloneable && typeof props.group === 'string' ? {
    name: props.group,
    pull: 'clone' as const,
    put: true as const
  } : props.group ?? undefined, [props.cloneable, props.group]);
  // Resolve itemClass for a row: a static value (string | array | object) OR a
  // per-row (item, index) => class function. The result is fed into the :class
  // array and normalized by each target's class path (rozieClass / clsx / native).
  function itemClassFor(item: any, index: any) {
    const v = props.itemClass;
    return typeof v === 'function' ? v(item, index) : v;
  }

  // Resolve itemStyle for a row: a static value (string | object) OR a per-row
  // (item, index) => style function. Returns string | object | null; the dynamic
  // :style binding normalizes it per target. null / empty → attribute dropped.
  function itemStyleFor(item: any, index: any) {
    const s = typeof props.itemStyle === 'function' ? props.itemStyle(item, index) : props.itemStyle;
    return s == null || s === '' ? null : s;
  }

  // Read the display label for an item — used by the aria-live announcer.
  // Phase 16 R7 / D-08: $props.labelFor reads as `null` on all 6 targets when
  // the consumer omits it (Plan 16-01 prop-default coercion fix); the check is
  // a plain null compare — NO runtime callable-type coercion.
  function labelOf(item: any, idx: any) {
    if (props.labelFor !== null) return props.labelFor(item, idx);
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
  const keyboardEnabled = useCallback(() => !props.disabled && !props.disableKeyboard, [props.disableKeyboard, props.disabled]);
  // keyboardTrigger='handle' mode: rows are not tab stops and the keys are read
  // from the consumer's handle element instead. Any other value is 'row' mode.
  function handleMode() {
    return props.keyboardTrigger === 'handle';
  }
  // Rows are tab stops only in row mode (and only while keyboard is enabled).
  function rowTabbable() {
    return keyboardEnabled() && !handleMode();
  }

  // One-time-per-change dev warning: handle mode needs a handle selector. Without
  // one the keyboard is OFF (see the onRowKeyDown gate) — never a silent fallback
  // to row mode, which would re-introduce the tab stops the consumer opted out of.
  const warnIfHandleMissing = useCallback(() => {
    if (handleMode() && props.handle == null) {
      console.warn('[rozie-sortable-list] keyboardTrigger is "handle" but no handle selector is set, so keyboard reordering is off. Pass a handle selector (e.g. handle=".grip") or use keyboardTrigger "row".');
    }
  }, [handleMode, props.handle]);
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
  const refocusRow = useCallback((item: any, idx: any) => {
    const listEl$local = listEl.current;
    const sel = props.handle;
    const useHandle = handleMode();
    const key = String(keyFor(item, idx));
    const focusIt = (onlyIfLost: any) => {
      if (!listEl$local) return;
      if (useHandle && sel == null) return;
      if (onlyIfLost && document.activeElement && document.activeElement !== document.body) return;
      for (const row of Array.from(listEl$local.children) as any[]) {
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
  }, [handleMode, keyFor, props.handle]);
  // The row element carrying `data-id === key` among a list element's direct
  // children (skips nested-list rows and header/footer slot content).
  const rowByKey = useCallback((listEl: any, key: any) => {
    if (!listEl || key == null) return null;
    for (const row of Array.from(listEl.children) as any[]) {
      if (row.getAttribute('data-id') === key) return row;
    }
    return null;
  }, []);
  // Keyboard `start` / `end` payload, shaped like SortableJS's pointer event:
  // `item` is the row element, `data` the item value. `start` fires from the
  // origin list (`from`), `end` from the list the row ends up in (`to`). Reads
  // the lift, so call it while `registry.lift` is still set.
  function keyboardStartEnd(name: any, from: any, to: any, oldIndex: any, newIndex: any) {
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
  }

  // Move the lifted row to `toIndex` (clamped) within the list holding it.
  // Works through the registry entry, so it acts on the current holder.
  function moveLiftTo(toIndex: any) {
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
  }

  // End the active keyboard lift. 'drop' leaves the row where it is; 'cancel'
  // returns it to the position it was lifted from. Emits `end` once.
  const endLift = useCallback((kind: any) => {
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
  }, [keyboardStartEnd, labelOf]);
  // Lift the row at `index` of this list.
  function startLift(index: any) {
    if (!entry.current) return;
    const item = items[index];
    registry.lift = {
      holder: entry.current,
      key: entry.current.keyOf(item, index),
      data: item,
      copy: false,
      origin: {
        list: entry.current,
        index
      },
      liftedRowEl: entry.current.rowEl(index)
    };
    setLiftedIndex(index);
    setAriaLiveText('Lifted ' + labelOf(item, index));
    keyboardStartEnd('start', entry.current, entry.current, index, index);
  }
  const onRowKeyDown = useCallback(($event: any, index: any) => {
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
    const liftedHere = lift != null && lift.holder === entry.current;
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
    const step = props.pageStep > 0 ? Math.floor(props.pageStep) : 5;
    let to: any = null;
    if (key === nextKey) to = from + 1;else if (key === prevKey) to = from - 1;else if (key === 'Home') to = 0;else if (key === 'End') to = items.length - 1;else if (key === 'PageDown') to = from + step;else if (key === 'PageUp') to = from - step;
    if (to === null) return;
    $event.preventDefault();
    moveLiftTo(to);
  }, [endLift, handleMode, isHandleKeyOrigin, items, keyboardEnabled, moveLiftTo, props.handle, props.orientation, props.pageStep, startLift]);
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
    return instance.current;
  }
  // toArray()/sort() operate on SortableJS's data-id ordering — every row carries
  // :data-id="keyFor(item, index)", so toArray() returns the current key order and
  // sort(order) reorders by those keys (set itemKey for stable object-list keys).
  function toArray() {
    return instance.current ? instance.current.toArray() : [];
  }
  function sort(order: any, useAnimation = true) {
    instance.current?.sort(order, useAnimation);
  }
  // option(name) reads a live SortableJS option; option(name, value) sets one — the
  // runtime escape hatch for any SortableJS option beyond the curated props.
  function option(name: any, value: any) {
    if (!instance.current) return undefined;
    if (value === undefined) return instance.current.option(name);
    instance.current.option(name, value);
    return value;
  }

  const _endLiftRef = useRef(endLift);
  _endLiftRef.current = endLift;
  const _keyForRef = useRef(keyFor);
  _keyForRef.current = keyFor;
  const _keyboardEnabledRef = useRef(keyboardEnabled);
  _keyboardEnabledRef.current = keyboardEnabled;
  const _refocusRowRef = useRef(refocusRow);
  _refocusRowRef.current = refocusRow;
  const _resolveGroupRef = useRef(resolveGroup);
  _resolveGroupRef.current = resolveGroup;
  const _warnIfHandleMissingRef = useRef(warnIfHandleMissing);
  _warnIfHandleMissingRef.current = warnIfHandleMissing;
  useEffect(() => {
    _warnIfHandleMissingRef.current();
    // Named `sortable` (not `handle`) to avoid shadowing `$props.handle`
    // when the options object below references it.
    const sortable = useSortableJS(listEl.current!, {
      items: () => _itemsRef.current,
      onCommit: (next: any) => {
        setItems(next);
      },
      options: {
        animation: _animationRef.current,
        disabled: _disabledRef.current,
        group: _resolveGroupRef.current(),
        handle: _handleRef.current,
        ghostClass: _ghostClassRef.current,
        chosenClass: _chosenClassRef.current,
        dragClass: _dragClassRef.current,
        filter: _filterRef.current,
        forceFallback: _forceFallbackRef.current,
        swapThreshold: _swapThresholdRef.current,
        easing: _easingRef.current,
        ..._optionsRef.current
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
        if (kind === 'reorder') _onChangeRef.current && _onChangeRef.current({
          oldIndex,
          newIndex,
          item,
          interaction: 'pointer'
        });else if (kind === 'add') _onAddRef.current && _onAddRef.current({
          newIndex,
          item,
          interaction: 'pointer'
        });else if (kind === 'remove') _onRemoveRef.current && _onRemoveRef.current({
          oldIndex,
          item,
          interaction: 'pointer'
        });
      },
      onStart: (e: any) => {
        // A pointer drag ends any active keyboard lift first.
        if (registry.lift != null) _endLiftRef.current('drop');
        (e as any).interaction = 'pointer';
        _onStartRef.current && _onStartRef.current(e);
      },
      onEnd: (e: any) => {
        (e as any).interaction = 'pointer';
        _onEndRef.current && _onEndRef.current(e);
      }
    });
    instance.current = sortable.instance;

    // Register with the keyboard registry. Other instances call these methods
    // when a keyboard lift hands a row between lists.
    const listEl$local = listEl.current;
    entry.current = {
      el: listEl$local,
      instructionsId,
      group: () => _resolveGroupRef.current(),
      label: () => _listLabelRef.current,
      keyboardEnabled: () => _keyboardEnabledRef.current(),
      items: () => _itemsRef.current,
      keyOf: (item: any, i: any) => String(_keyForRef.current(item, i)),
      write: (next: any) => {
        setItems(next);
      },
      setLifted: (i: any) => {
        setLiftedIndex(i);
      },
      announce: (text: any) => {
        setAriaLiveText(text);
      },
      focusRow: (item: any, i: any) => _refocusRowRef.current(item, i),
      rowEl: (i: any) => {
        const list = _itemsRef.current;
        if (i < 0 || i >= list.length) return null;
        return rowByKey(listEl$local, String(_keyForRef.current(list[i], i)));
      },
      emit: (name: any, payload: any) => {
        if (name === 'add') _onAddRef.current && _onAddRef.current(payload);else if (name === 'remove') _onRemoveRef.current && _onRemoveRef.current(payload);else if (name === 'change') _onChangeRef.current && _onChangeRef.current(payload);else if (name === 'start') _onStartRef.current && _onStartRef.current(payload);else if (name === 'end') _onEndRef.current && _onEndRef.current(payload);
      }
    };
    unregisterEntry.current = registry.register(entry.current);
    // $onMount's cleanup-return: closing over a setup-local (`sortable`) does
    // not survive the Solid emitter's setup/cleanup split — it scopes cleanup
    // outside the setup IIFE. Closing over `instance` / `unregisterEntry`
    // (module-scope `let`s) works on every target.
    return () => {
      instance.current?.destroy();
      unregisterEntry.current?.();
      unregisterEntry.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = props.disabled;
    instance.current?.option('disabled', v);
  }, [props.disabled]);
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    instance.current?.option('group', resolveGroup());
  }, [props.group]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    instance.current?.option('group', resolveGroup());
  }, [props.cloneable]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    const v = props.swapThreshold;
    instance.current?.option('swapThreshold', v);
  }, [props.swapThreshold]);
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    const v = props.handle;
    instance.current?.option('handle', v);
    warnIfHandleMissing();
  }, [props.handle]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
    warnIfHandleMissing();
  }, [props.keyboardTrigger]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch6First.current) { _watch6First.current = false; return; }
    const v = props.ghostClass;
    instance.current?.option('ghostClass', v);
  }, [props.ghostClass]);
  useEffect(() => {
    if (_watch7First.current) { _watch7First.current = false; return; }
    const v = props.chosenClass;
    instance.current?.option('chosenClass', v);
  }, [props.chosenClass]);
  useEffect(() => {
    if (_watch8First.current) { _watch8First.current = false; return; }
    const v = props.dragClass;
    instance.current?.option('dragClass', v);
  }, [props.dragClass]);
  useEffect(() => {
    if (_watch9First.current) { _watch9First.current = false; return; }
    const v = props.filter;
    instance.current?.option('filter', v);
  }, [props.filter]);
  useEffect(() => {
    if (_watch10First.current) { _watch10First.current = false; return; }
    const v = props.easing;
    instance.current?.option('easing', v);
  }, [props.easing]);

  const _rozieExposeRef = useRef({ getInstance, toArray, sort, option });
  _rozieExposeRef.current = { getInstance, toArray, sort, option };
  useImperativeHandle(ref, () => ({ getInstance: (...args: Parameters<typeof getInstance>): ReturnType<typeof getInstance> => flushSync(() => _rozieExposeRef.current.getInstance(...args)), toArray: (...args: Parameters<typeof toArray>): ReturnType<typeof toArray> => flushSync(() => _rozieExposeRef.current.toArray(...args)), sort: (...args: Parameters<typeof sort>): ReturnType<typeof sort> => flushSync(() => _rozieExposeRef.current.sort(...args)), option: (...args: Parameters<typeof option>): ReturnType<typeof option> => flushSync(() => _rozieExposeRef.current.option(...args)) }), []);

  return (
    <>
    <div {...attrs} className={clsx("rozie-sortable-wrap", (attrs.className as string | undefined))} data-rozie-s-0af24eae="">
      <div className={clsx(['rozie-sortable-list', props.listClass])} ref={listEl} part="list" role="list" aria-label={rozieAttr(props.listLabel)} aria-orientation={rozieAttr(props.orientation === 'horizontal' ? 'horizontal' : 'vertical')} data-rozie-s-0af24eae="">
        {(props.renderHeader ?? props.slots?.['header'])?.()}
        {items.map((item, index) => <div key={keyFor(item, index)} className={clsx(['rozie-sortable-item', itemClassFor(item, index), { 'rozie-sortable-item-lifted': liftedIndex === index }])} style={parseInlineStyle(itemStyleFor(item, index))} data-id={rozieAttr(keyFor(item, index))} role="listitem" tabIndex={(rowTabbable() ? 0 : undefined) ?? undefined} aria-describedby={rozieAttr(rowTabbable() ? instructionsId : undefined)} onKeyDown={($event) => { onRowKeyDown($event, index); }} data-rozie-s-0af24eae="">
          {typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)({ item, index, instructionsId }) : (props.children ?? props.slots?.[''])}
        </div>)}
        {(props.renderFooter ?? props.slots?.['footer'])?.()}
      </div>
      <div className={"rozie-sortable-aria-live"} data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true" data-rozie-s-0af24eae="">{ariaLiveText}</div>
      <span hidden={true} id={rozieAttr(instructionsId)} data-rozie-s-0af24eae="">{rozieDisplay(instructionsText())}</span>
    </div>
    </>
  );
});
export default SortableList;
