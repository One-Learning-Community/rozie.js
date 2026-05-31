import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import styles from './SortableList.module.css';
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

export default function SortableList(_props: SortableListProps): JSX.Element {
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
    const v = props.disabled;
    instance.current?.option('disabled', v);
  }, [props.disabled]);
  useEffect(() => {
    const v = props.group;
    instance.current?.option('group', v);
  }, [props.group]);
  useEffect(() => {
    const v = props.handle;
    instance.current?.option('handle', v);
  }, [props.handle]);
  useEffect(() => {
    const v = props.ghostClass;
    instance.current?.option('ghostClass', v);
  }, [props.ghostClass]);
  useEffect(() => {
    const v = props.chosenClass;
    instance.current?.option('chosenClass', v);
  }, [props.chosenClass]);
  useEffect(() => {
    const v = props.dragClass;
    instance.current?.option('dragClass', v);
  }, [props.dragClass]);
  useEffect(() => {
    const v = props.filter;
    instance.current?.option('filter', v);
  }, [props.filter]);
  useEffect(() => {
    const v = props.easing;
    instance.current?.option('easing', v);
  }, [props.easing]);

  return (
    <>
    <div ref={__rozieRoot} {...attrs} className={clsx(styles["rozie-sortable-wrap"], (attrs.className as string | undefined))} data-rozie-s-0af24eae="">
      <div className={styles["rozie-sortable-list"]} ref={listEl} data-rozie-s-0af24eae="">
        {items.map((item, index) => <div key={keyFor(item, index)} className={clsx(styles["rozie-sortable-item"], { [styles["rozie-sortable-item-lifted"]]: liftedIndex === index })} role="listitem" tabIndex={0} onKeyDown={($event) => { onRowKeyDown($event, index); }} data-rozie-s-0af24eae="">
          {typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)({ item, index }) : (props.children ?? props.slots?.[''])}
        </div>)}
      </div>
      <div className={styles["rozie-sortable-aria-live"]} data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true" data-rozie-s-0af24eae="">{ariaLiveText}</div>
    </div>
    </>
  );
}
