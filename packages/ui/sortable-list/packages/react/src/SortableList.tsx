import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, useControllableState } from '@rozie/runtime-react';
import './SortableList.css';
import { useSortableJS } from './internal/useSortableJS';

interface ChildrenCtx { item: any; index: any; }

interface SortableListProps {
  items?: any[];
  defaultItems?: any[];
  onItemsChange?: (items: any[]) => void;
  itemKey?: (string) | null;
  handle?: (string) | null;
  group?: (string) | null;
  animation?: number;
  disabled?: boolean;
  options?: Record<string, any>;
  labelFor?: ((...args: any[]) => any) | null;
  ghostClass?: (string) | null;
  chosenClass?: (string) | null;
  dragClass?: (string) | null;
  filter?: (string) | null;
  easing?: (string) | null;
  forceFallback?: boolean;
  swapThreshold?: number;
  cloneable?: boolean;
  onChange?: (...args: any[]) => void;
  onAdd?: (...args: any[]) => void;
  onRemove?: (...args: any[]) => void;
  onStart?: (...args: any[]) => void;
  onEnd?: (...args: any[]) => void;
  children?: ReactNode | ((ctx: ChildrenCtx) => ReactNode);
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
  const props: Omit<SortableListProps, 'itemKey' | 'handle' | 'group' | 'animation' | 'disabled' | 'options' | 'labelFor' | 'ghostClass' | 'chosenClass' | 'dragClass' | 'filter' | 'easing' | 'forceFallback' | 'swapThreshold' | 'cloneable'> & { itemKey: (string) | null; handle: (string) | null; group: (string) | null; animation: number; disabled: boolean; options: Record<string, any>; labelFor: ((...args: any[]) => any) | null; ghostClass: (string) | null; chosenClass: (string) | null; dragClass: (string) | null; filter: (string) | null; easing: (string) | null; forceFallback: boolean; swapThreshold: number; cloneable: boolean } = {
    ..._props,
    itemKey: _props.itemKey ?? null,
    handle: _props.handle ?? null,
    group: _props.group ?? null,
    animation: _props.animation ?? 150,
    disabled: _props.disabled ?? false,
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
  };
  const attrs: Record<string, unknown> = (() => {
    const { items, itemKey, handle, group, animation, disabled, options, labelFor, ghostClass, chosenClass, dragClass, filter, easing, forceFallback, swapThreshold, cloneable, defaultValue, onItemsChange, defaultItems, ...rest } = _props as SortableListProps & Record<string, unknown>;
    void items; void itemKey; void handle; void group; void animation; void disabled; void options; void labelFor; void ghostClass; void chosenClass; void dragClass; void filter; void easing; void forceFallback; void swapThreshold; void cloneable; void defaultValue; void onItemsChange; void defaultItems;
    return rest;
  })();
  const instance = useRef<any>(null);
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
  const _groupRef = useRef(props.group);
  _groupRef.current = props.group;
  const _handleRef = useRef(props.handle);
  _handleRef.current = props.handle;
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

  function keyFor(item: any, index: any) {
    if (props.itemKey && item !== null && typeof item === 'object') {
      return item[props.itemKey] ?? index;
    }
    return item ?? index;
  }
  function getLabel(idx: any) {
    const item = items[idx];
    if (props.labelFor !== null) return props.labelFor(item, idx);
    if (item !== null && typeof item === 'object' && 'label' in item) return item.label;
    return String(item);
  }
  const { onChange: _rozieProp_onChange } = props;
    const onRowKeyDown = useCallback(($event: any, index: any) => {
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
  }, [_rozieProp_onChange, getLabel, items, liftedIndex, setItems]);
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
        // `cloneable` is a high-level Rozie prop that REPLACES a string
        // `group` with SortableJS's `{ name, pull: 'clone', put: true }`
        // object form. When `cloneable:false`, pass `$props.group` through
        // verbatim. When `cloneable:true` AND `$props.group` is null,
        // leave it null — a clone-mode list without a group name is not
        // meaningful (no peer list can join the cross-list flow).
        group: props.cloneable && typeof _groupRef.current === 'string' ? {
          name: _groupRef.current,
          pull: 'clone',
          put: true
        } : _groupRef.current,
        handle: _handleRef.current,
        ghostClass: _ghostClassRef.current,
        chosenClass: _chosenClassRef.current,
        dragClass: _dragClassRef.current,
        filter: _filterRef.current,
        forceFallback: props.forceFallback,
        swapThreshold: props.swapThreshold,
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
    const v = props.group;
    instance.current?.option('group', v);
  }, [props.group]);
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    const v = props.handle;
    instance.current?.option('handle', v);
  }, [props.handle]);
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    const v = props.ghostClass;
    instance.current?.option('ghostClass', v);
  }, [props.ghostClass]);
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    const v = props.chosenClass;
    instance.current?.option('chosenClass', v);
  }, [props.chosenClass]);
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
    const v = props.dragClass;
    instance.current?.option('dragClass', v);
  }, [props.dragClass]);
  useEffect(() => {
    if (_watch6First.current) { _watch6First.current = false; return; }
    const v = props.filter;
    instance.current?.option('filter', v);
  }, [props.filter]);
  useEffect(() => {
    if (_watch7First.current) { _watch7First.current = false; return; }
    const v = props.easing;
    instance.current?.option('easing', v);
  }, [props.easing]);

  const _rozieExposeRef = useRef({ getInstance, toArray, sort, option });
  _rozieExposeRef.current = { getInstance, toArray, sort, option };
  useImperativeHandle(ref, () => ({ getInstance: (...args: Parameters<typeof getInstance>): ReturnType<typeof getInstance> => _rozieExposeRef.current.getInstance(...args), toArray: (...args: Parameters<typeof toArray>): ReturnType<typeof toArray> => _rozieExposeRef.current.toArray(...args), sort: (...args: Parameters<typeof sort>): ReturnType<typeof sort> => _rozieExposeRef.current.sort(...args), option: (...args: Parameters<typeof option>): ReturnType<typeof option> => _rozieExposeRef.current.option(...args) }), []);

  return (
    <>
    <div ref={__rozieRoot} {...attrs} className={clsx("rozie-sortable-wrap", (attrs.className as string | undefined))} data-rozie-s-0af24eae="">
      <div className={"rozie-sortable-list"} ref={listEl} part="list" data-rozie-s-0af24eae="">
        {items.map((item, index) => <div key={keyFor(item, index)} className={clsx("rozie-sortable-item", { "rozie-sortable-item-lifted": liftedIndex === index })} data-id={rozieAttr(keyFor(item, index))} role="listitem" tabIndex={0} onKeyDown={($event) => { onRowKeyDown($event, index); }} data-rozie-s-0af24eae="">
          {typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)({ item, index }) : (props.children ?? props.slots?.[''])}
        </div>)}
      </div>
      <div className={"rozie-sortable-aria-live"} data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true" data-rozie-s-0af24eae="">{ariaLiveText}</div>
    </div>
    </>
  );
});
export default SortableList;
