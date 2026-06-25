import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './CommandPalette.css';
import { filterCommands } from './internal/filterCommands';

// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list, each carrying its filtered-list index `_i`. A plain
// function (called from the r-for AND handlers) — never $computed.

interface ItemCtx { item: any; active: any; }

interface CommandPaletteProps {
  /**
   * Whether the palette overlay is shown (two-way `r-model`). Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`); every close path (backdrop click, Escape, selecting an item when `closeOnSelect`, the imperative `close()`) writes `open = false`. As one of two `model: true` props the component does not generate an Angular `ControlValueAccessor`.
   * @example
   * <CommandPalette r-model:open="paletteOpen" :items="commands" />
   */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * The current search text (two-way `r-model`). Two-way bind it to read or pre-seed the query; the component filters `items` by this string over each item `label` plus its `keywords`. Cleared to `""` whenever the palette opens.
   */
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  /**
   * The command list — `[{ id, label, group?, keywords?, disabled? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; optional `group` buckets items under a heading; optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation.
   */
  items?: any[];
  /**
   * Placeholder text shown in the search input while the query is empty.
   */
  placeholder?: string;
  /**
   * Text shown when the query matches no items. Override the whole empty state with the `empty` slot when you need richer markup.
   */
  emptyText?: string;
  /**
   * Whether choosing an item closes the palette. Defaults to `true` (the cmdk convention); set to `false` to keep the palette open after a selection — e.g. for a multi-action menu where the user runs several commands in a row.
   */
  closeOnSelect?: boolean;
  /**
   * Accessible name for the dialog surface (`aria-label` on the `role="dialog"` panel). Override it to match the palette's purpose (e.g. "Search commands").
   */
  ariaLabel?: string;
  /**
   * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase?: string;
  onSelect?: (...args: any[]) => void;
  renderItem?: (ctx: ItemCtx) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderFooter?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface CommandPaletteHandle {
  show: (...args: any[]) => any;
  close: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  focus: (...args: any[]) => any;
}

const CommandPalette = forwardRef<CommandPaletteHandle, CommandPaletteProps>(function CommandPalette(_props: CommandPaletteProps, ref): JSX.Element {
  const __defaultItems = useState(() => (() => [])())[0];
  const props: Omit<CommandPaletteProps, 'items' | 'placeholder' | 'emptyText' | 'closeOnSelect' | 'ariaLabel' | 'idBase'> & { items: any[]; placeholder: string; emptyText: string; closeOnSelect: boolean; ariaLabel: string; idBase: string } = {
    ..._props,
    items: _props.items ?? __defaultItems,
    placeholder: _props.placeholder ?? 'Type a command…',
    emptyText: _props.emptyText ?? 'No results.',
    closeOnSelect: _props.closeOnSelect ?? true,
    ariaLabel: _props.ariaLabel ?? 'Command palette',
    idBase: _props.idBase ?? 'rozie-command-palette',
  };
  const attrs: Record<string, unknown> = (() => {
    const { open, query, items, placeholder, emptyText, closeOnSelect, ariaLabel, idBase, defaultValue, onOpenChange, defaultOpen, onQueryChange, defaultQuery, ...rest } = _props as CommandPaletteProps & Record<string, unknown>;
    void open; void query; void items; void placeholder; void emptyText; void closeOnSelect; void ariaLabel; void idBase; void defaultValue; void onOpenChange; void defaultOpen; void onQueryChange; void defaultQuery;
    return rest;
  })();
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultOpen ?? false,
    onValueChange: props.onOpenChange,
  });
  const [query, setQuery] = useControllableState({
    value: props.query,
    defaultValue: props.defaultQuery ?? '',
    onValueChange: props.onQueryChange,
  });
  const _openRef = useRef(open);
  _openRef.current = open;
  const [activeIndex, setActiveIndex] = useState(0);
  const inputEl = useRef<HTMLInputElement | null>(null);
  const _watch0First = useRef(true);

  function filteredItems() {
    const src = Array.isArray(props.items) ? props.items : [];
    const list = filterCommands(src, query);
    return list.map((it: any, i: any) => ({
      id: it.id,
      label: it.label,
      group: it.group,
      keywords: it.keywords,
      disabled: !!it.disabled,
      _i: i
    }));
  }
  function optId(i: any) {
    return props.idBase + '-opt-' + i;
  }
  function listId() {
    return props.idBase + '-list';
  }
  function inputId() {
    return props.idBase + '-input';
  }
  function activeId() {
    const list = filteredItems();
    if (activeIndex >= 0 && list[activeIndex]) return optId(activeIndex);
    return null;
  }
  function nextEnabled(list: any, from: any, dir: any) {
    let i = from;
    for (let step = 0; step < list.length; step++) {
      i = i + dir;
      if (i < 0) i = 0;
      if (i >= list.length) i = list.length - 1;
      if (list[i] && !list[i].disabled) return i;
      if (dir < 0 && i === 0 || dir > 0 && i === list.length - 1) break;
    }
    return from;
  }
  function firstEnabled(list: any) {
    for (let i = 0; i < list.length; i++) {
      if (list[i] && !list[i].disabled) return i;
    }
    return 0;
  }
  function closePalette() {
    setOpen(false);
  }
  const { onSelect: _rozieProp_onSelect } = props;
    const selectItem = useCallback((item: any) => {
    if (!item || item.disabled) return;
    _rozieProp_onSelect && _rozieProp_onSelect({
      id: item.id,
      label: item.label,
      group: item.group
    });
    if (props.closeOnSelect) closePalette();
  }, [_rozieProp_onSelect, closePalette, props.closeOnSelect]);
  const onInput = useCallback((e: any) => {
    const q = e && e.target ? e.target.value : '';
    setQuery(q);
    // Reset the highlight to the first enabled item of the NEW filtered list.
    const next = filterCommands(Array.isArray(props.items) ? props.items : [], q);
    setActiveIndex(firstEnabled(next));
  }, [firstEnabled, props.items, setQuery]);
  const onKeydown = useCallback((e: any) => {
    const key = e ? e.key : '';
    const list = filteredItems();
    const ai = activeIndex;
    if (key === 'ArrowDown') {
      if (e) e.preventDefault();
      setActiveIndex(nextEnabled(list, ai, 1));
    } else if (key === 'ArrowUp') {
      if (e) e.preventDefault();
      setActiveIndex(nextEnabled(list, ai, -1));
    } else if (key === 'Home') {
      if (e) e.preventDefault();
      setActiveIndex(nextEnabled(list, -1, 1));
    } else if (key === 'End') {
      if (e) e.preventDefault();
      setActiveIndex(nextEnabled(list, list.length, -1));
    } else if (key === 'Enter') {
      if (ai >= 0 && list[ai]) {
        if (e) e.preventDefault();
        selectItem(list[ai]);
      }
    } else if (key === 'Escape') {
      if (e) e.preventDefault();
      closePalette();
    }
  }, [activeIndex, closePalette, filteredItems, nextEnabled, selectItem]);
  const onBackdropClick = useCallback((e: any) => {
    if (e && e.target === e.currentTarget) closePalette();
  }, [closePalette]);
  const onOpen = useCallback(() => {
    setQuery('');
    setActiveIndex(firstEnabled(filterCommands(Array.isArray(props.items) ? props.items : [], '')));
    const el = inputEl.current;
    if (el && el.focus) {
      // Defer a tick so the overlay is mounted before focusing.
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          const again = inputEl.current;
          if (again && again.focus) again.focus();
        });
      } else {
        el.focus();
      }
    }
  }, [firstEnabled, props.items, setQuery]);
  function show() {
    setOpen(true);
  }
  function close() {
    closePalette();
  }
  function toggle() {
    setOpen(prev => !prev);
  }
  function focus() {
    return inputEl.current?.focus();
  }

  useEffect(() => {
    if (_openRef.current) onOpen();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const isOpen = open;
    if (isOpen) onOpen();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ show, close, toggle, focus });
  _rozieExposeRef.current = { show, close, toggle, focus };
  useImperativeHandle(ref, () => ({ show: (...args: Parameters<typeof show>): ReturnType<typeof show> => _rozieExposeRef.current.show(...args), close: (...args: Parameters<typeof close>): ReturnType<typeof close> => _rozieExposeRef.current.close(...args), toggle: (...args: Parameters<typeof toggle>): ReturnType<typeof toggle> => _rozieExposeRef.current.toggle(...args), focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args) }), []);

  return (
    <>
    {(open) && <div className={"rozie-command-palette"} onClick={($event) => { onBackdropClick($event); }} data-rozie-s-768cad96="">
      <div className={"rozie-command-palette-panel"} role="dialog" aria-modal="true" aria-label={props.ariaLabel} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-768cad96="">
        <div className={"rozie-command-palette-search"} data-rozie-s-768cad96="">
          <input ref={inputEl} className={"rozie-command-palette-input"} type="text" role="combobox" aria-autocomplete="list" id={rozieAttr(inputId())} aria-expanded={!!open} aria-controls={rozieAttr(listId())} aria-activedescendant={rozieAttr(activeId())} aria-label={props.ariaLabel} value={query} placeholder={props.placeholder} autoComplete="off" onInput={($event) => { onInput($event); }} data-rozie-s-768cad96="" />
        </div>

        {(filteredItems().length > 0) && <ul className={"rozie-command-palette-list"} id={rozieAttr(listId())} role="listbox" aria-label={props.ariaLabel} data-rozie-s-768cad96="">
          {filteredItems().map((item) => <li key={item.id} className={clsx("rozie-command-palette-option", { "rozie-command-palette-option--active": item._i === activeIndex, "rozie-command-palette-option--disabled": item.disabled })} id={rozieAttr(optId(item._i))} role="option" aria-selected={item._i === activeIndex} aria-disabled={!!item.disabled} onMouseDown={($event) => { $event.preventDefault(); selectItem(item); }} onMouseEnter={($event) => { setActiveIndex(item._i); }} data-rozie-s-768cad96="">
            {(props.renderItem ?? props.slots?.['item']) ? ((props.renderItem ?? props.slots?.['item']) as Function)({ item, active: item._i === activeIndex }) : <><span className={"rozie-command-palette-option-label"} data-rozie-s-768cad96="">{rozieDisplay(item.label)}</span>{(item.group) && <span className={"rozie-command-palette-option-group"} data-rozie-s-768cad96="">{rozieDisplay(item.group)}</span>}</>}
          </li>)}
        </ul>}{(filteredItems().length === 0) && <div className={"rozie-command-palette-empty"} data-rozie-s-768cad96="">
          {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)() : props.emptyText}
        </div>}{((props.renderFooter ?? props.slots?.['footer'])) && <div className={"rozie-command-palette-footer"} data-rozie-s-768cad96="">
          {(props.renderFooter ?? props.slots?.['footer'])?.()}
        </div>}</div>
    </div>}</>
  );
});
export default CommandPalette;
