import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, parseInlineStyle, rozieAttr, useControllableState } from '@rozie/runtime-react';
import './SortableList.css';
import { useSortableJS } from './internal/useSortableJS';

interface ChildrenCtx { item: any; index: any; }

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
  const props: Omit<SortableListProps, 'itemKey' | 'handle' | 'group' | 'animation' | 'disabled' | 'disableKeyboard' | 'options' | 'labelFor' | 'ghostClass' | 'chosenClass' | 'dragClass' | 'filter' | 'easing' | 'forceFallback' | 'swapThreshold' | 'cloneable' | 'listClass' | 'itemClass' | 'itemStyle'> & { itemKey: (string | ((...args: any[]) => any)) | null; handle: (string) | null; group: (string) | null; animation: number; disabled: boolean; disableKeyboard: boolean; options: Record<string, any>; labelFor: ((...args: any[]) => any) | null; ghostClass: (string) | null; chosenClass: (string) | null; dragClass: (string) | null; filter: (string) | null; easing: (string) | null; forceFallback: boolean; swapThreshold: number; cloneable: boolean; listClass: string | any[] | Record<string, any>; itemClass: string | any[] | Record<string, any> | ((...args: any[]) => any); itemStyle: (string | Record<string, any> | ((...args: any[]) => any)) | null } = {
    ..._props,
    itemKey: _props.itemKey ?? null,
    handle: _props.handle ?? null,
    group: _props.group ?? null,
    animation: _props.animation ?? 150,
    disabled: _props.disabled ?? false,
    disableKeyboard: _props.disableKeyboard ?? false,
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
    itemStyle: _props.itemStyle ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { items, itemKey, handle, group, animation, disabled, disableKeyboard, options, labelFor, ghostClass, chosenClass, dragClass, filter, easing, forceFallback, swapThreshold, cloneable, listClass, itemClass, itemStyle, defaultValue, onItemsChange, defaultItems, ...rest } = _props as SortableListProps & Record<string, unknown>;
    void items; void itemKey; void handle; void group; void animation; void disabled; void disableKeyboard; void options; void labelFor; void ghostClass; void chosenClass; void dragClass; void filter; void easing; void forceFallback; void swapThreshold; void cloneable; void listClass; void itemClass; void itemStyle; void defaultValue; void onItemsChange; void defaultItems;
    return rest;
  })();
  const instance = useRef<any>(null);
  const __rowKeySeq = useRef(0);
  const [items, setItems] = useControllableState({
    value: props.items,
    defaultValue: props.defaultItems ?? (() => [])(),
    onValueChange: props.onItemsChange,
  });
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
  const _ghostClassRef = useRef(props.ghostClass);
  _ghostClassRef.current = props.ghostClass;
  const _handleRef = useRef(props.handle);
  _handleRef.current = props.handle;
  const _swapThresholdRef = useRef(props.swapThreshold);
  _swapThresholdRef.current = props.swapThreshold;
  const _itemsRef = useRef(items);
  _itemsRef.current = items;
  const [liftedIndex, setLiftedIndex] = useState<any>(null);
  const [ariaLiveText, setAriaLiveText] = useState('');
  const listEl = useRef<HTMLDivElement | null>(null);
  const __rozieRoot = useRef<HTMLDivElement | null>(null);
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

  const __rowKeyMap = useMemo(() => new WeakMap(), []);
  function keyFor(item: any, index: any) {
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
        __rowKeyMap.set(item, '__rk' + __rowKeySeq.current++);
      }
      return __rowKeyMap.get(item);
    }
    // (d) primitive item: fall back to index. NOTE: duplicate primitives are
    //     unsafe to reorder this way — pass a function itemKey for those.
    return index;
  }
  const resolveGroup = useCallback(() => props.cloneable && typeof props.group === 'string' ? {
    name: props.group,
    pull: 'clone',
    put: true
  } : props.group, [props.cloneable, props.group]);
  function itemClassFor(item: any, index: any) {
    const v = props.itemClass;
    return typeof v === 'function' ? v(item, index) : v;
  }
  function itemStyleFor(item: any, index: any) {
    const s = typeof props.itemStyle === 'function' ? props.itemStyle(item, index) : props.itemStyle;
    return s == null || s === '' ? null : s;
  }
  function getLabel(idx: any) {
    const item = items[idx];
    if (props.labelFor !== null) return props.labelFor(item, idx);
    if (item !== null && typeof item === 'object' && 'label' in item) return item.label;
    return String(item);
  }
  function keyboardEnabled() {
    return !props.disabled && !props.disableKeyboard;
  }
  const { onChange: _rozieProp_onChange } = props;
    const onRowKeyDown = useCallback(($event: any, index: any) => {
    // Defense-in-depth: when keyboard reordering is off the rows carry no
    // tabindex and can't receive focus, but a consumer-focused row (or a
    // programmatic .focus()) must still no-op here rather than reorder.
    if (!keyboardEnabled()) return;
    const key = $event.key;
    // Space (' ' on browsers; KeyboardEvent.key === ' ') OR Enter — lift/drop.
    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      $event.preventDefault();
      if (liftedIndex === null) {
        // LIFT
        setLiftedIndex(index);
        setAriaLiveText('Lifted ' + getLabel(index));
        return;
      }
      // DROP
      const dropped = getLabel(liftedIndex);
      const at = liftedIndex;
      setLiftedIndex(null);
      setAriaLiveText('Dropped ' + dropped + ' at position ' + (at + 1));
      return;
    }
    if (key === 'Escape') {
      if (liftedIndex === null) return;
      $event.preventDefault();
      const cancelled = getLabel(liftedIndex);
      setLiftedIndex(null);
      setAriaLiveText('Cancelled lift of ' + cancelled);
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
      setItems(next);
      setLiftedIndex(to);
      setAriaLiveText('Moved ' + getLabel(to) + ' to position ' + (to + 1));
      // After the keyed reorder write, restore focus to the moved row. No-op
      // on React/Vue/Angular (DOM identity preserved); queueMicrotask +
      // querySelectorAll + .focus() on Svelte/Solid/Lit (DOM re-created).
      void 0;
      _rozieProp_onChange && _rozieProp_onChange({
        oldIndex: from,
        newIndex: to,
        item: moved
      });
    }
  }, [_rozieProp_onChange, getLabel, items, keyboardEnabled, liftedIndex, setItems]);
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
  // option(name) reads a live SortableJS option; option(name, value) sets one — the
  // runtime escape hatch for any SortableJS option beyond the curated props.
  function option(name: any, value: any) {
    if (!instance.current) return undefined;
    if (value === undefined) return instance.current.option(name);
    instance.current.option(name, value);
    return value;
  }

  useEffect(() => {
    // Named `sortable` (not `handle`) to avoid shadowing `$props.handle`
    // when the options object below references it.
    const sortable = useSortableJS(listEl.current!, {
      items: () => _itemsRef.current,
      onCommit: (next: any) => {
        setItems(next);
      },
      options: {
        animation: props.animation,
        disabled: _disabledRef.current,
        group: resolveGroup(),
        handle: _handleRef.current,
        ghostClass: _ghostClassRef.current,
        chosenClass: _chosenClassRef.current,
        dragClass: _dragClassRef.current,
        filter: _filterRef.current,
        forceFallback: props.forceFallback,
        swapThreshold: _swapThresholdRef.current,
        easing: _easingRef.current,
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
        if (kind === 'reorder') props.onChange && props.onChange({
          oldIndex,
          newIndex,
          item
        });else if (kind === 'add') props.onAdd && props.onAdd({
          newIndex,
          item
        });else if (kind === 'remove') props.onRemove && props.onRemove({
          oldIndex,
          item
        });
      },
      onStart: (e: any) => props.onStart && props.onStart(e),
      onEnd: (e: any) => props.onEnd && props.onEnd(e)
    });
    instance.current = sortable.instance;
    // $onMount's cleanup-return: closing over a setup-local (`sortable`) does
    // not survive the Solid emitter's setup/cleanup split — it scopes cleanup
    // outside the setup IIFE. Closing over `instance` (a module-scope `let`)
    // works on every target.
    return () => instance.current?.destroy();
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
  }, [props.handle]);
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
    const v = props.ghostClass;
    instance.current?.option('ghostClass', v);
  }, [props.ghostClass]);
  useEffect(() => {
    if (_watch6First.current) { _watch6First.current = false; return; }
    const v = props.chosenClass;
    instance.current?.option('chosenClass', v);
  }, [props.chosenClass]);
  useEffect(() => {
    if (_watch7First.current) { _watch7First.current = false; return; }
    const v = props.dragClass;
    instance.current?.option('dragClass', v);
  }, [props.dragClass]);
  useEffect(() => {
    if (_watch8First.current) { _watch8First.current = false; return; }
    const v = props.filter;
    instance.current?.option('filter', v);
  }, [props.filter]);
  useEffect(() => {
    if (_watch9First.current) { _watch9First.current = false; return; }
    const v = props.easing;
    instance.current?.option('easing', v);
  }, [props.easing]);

  const _rozieExposeRef = useRef({ getInstance, toArray, sort, option });
  _rozieExposeRef.current = { getInstance, toArray, sort, option };
  useImperativeHandle(ref, () => ({ getInstance: (...args: Parameters<typeof getInstance>): ReturnType<typeof getInstance> => _rozieExposeRef.current.getInstance(...args), toArray: (...args: Parameters<typeof toArray>): ReturnType<typeof toArray> => _rozieExposeRef.current.toArray(...args), sort: (...args: Parameters<typeof sort>): ReturnType<typeof sort> => _rozieExposeRef.current.sort(...args), option: (...args: Parameters<typeof option>): ReturnType<typeof option> => _rozieExposeRef.current.option(...args) }), []);

  return (
    <>
    <div ref={__rozieRoot} {...attrs} className={clsx("rozie-sortable-wrap", (attrs.className as string | undefined))} data-rozie-s-0af24eae="">
      <div className={clsx(['rozie-sortable-list', props.listClass])} ref={listEl} part="list" data-rozie-s-0af24eae="">
        {(props.renderHeader ?? props.slots?.['header'])?.()}
        {items.map((item, index) => <div key={keyFor(item, index)} className={clsx(['rozie-sortable-item', itemClassFor(item, index), { 'rozie-sortable-item-lifted': liftedIndex === index }])} style={parseInlineStyle(itemStyleFor(item, index))} data-id={rozieAttr(keyFor(item, index))} role="listitem" tabIndex={(keyboardEnabled() ? 0 : undefined) ?? undefined} onKeyDown={($event) => { onRowKeyDown($event, index); }} data-rozie-s-0af24eae="">
          {typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)({ item, index }) : (props.children ?? props.slots?.[''])}
        </div>)}
        {(props.renderFooter ?? props.slots?.['footer'])?.()}
      </div>
      <div className={"rozie-sortable-aria-live"} data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true" data-rozie-s-0af24eae="">{ariaLiveText}</div>
    </div>
    </>
  );
});
export default SortableList;
