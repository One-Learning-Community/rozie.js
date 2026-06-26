import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './CommandPalette.css';
import Listbox from './Listbox';
import { filterCommands } from './internal/filterCommands';

// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list fed to the vendored <Listbox> as its `:options`.
// command-palette KEEPS its own label+keywords filter (filterCommands, A1) and
// runs <Listbox :filterable="false"> — listbox's built-in filter is label-only
// substring and would drop the keyword matching + source-order grouping. A plain
// function (called from the template binding AND handlers) — never $computed (the
// listbox value-vs-accessor split). Each item is passed through verbatim; listbox
// resolves its value via `optionValue` (below) and its label via `.label`.

interface OptionCtx { option: any; index: any; active: any; selected: any; disabled: any; }

interface EmptyCtx { query: any; }

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
  renderOption?: (ctx: OptionCtx) => ReactNode;
  renderEmpty?: (ctx: EmptyCtx) => ReactNode;
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
  const [activeValue, setActiveValue] = useState<any>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);

  function filteredItems() {
    const src = Array.isArray(props.items) ? props.items : [];
    return filterCommands(src, query);
  }
  function commandValue(it: any) {
    return it && it.id !== undefined ? it.id : it;
  }
  function commandDisabled(it: any) {
    return !!(it && it.disabled);
  }
  function labelText(o: any) {
    return o && o.label !== undefined ? o.label : '';
  }
  function groupText(o: any) {
    return o && o.group !== undefined ? o.group : '';
  }
  function closePalette() {
    setOpen(false);
  }
  const { onSelect: _rozieProp_onSelect } = props;
    const onListboxChange = useCallback((e: any) => {
    const item = e ? e.option : null;
    if (!item || item.disabled) return;
    _rozieProp_onSelect && _rozieProp_onSelect({
      id: item.id,
      label: item.label,
      group: item.group
    });
    // Clear the internal selection so re-selecting the same command re-fires.
    setActiveValue(null);
    if (props.closeOnSelect) closePalette();
  }, [_rozieProp_onSelect, closePalette, props.closeOnSelect]);
  const onListboxSearch = useCallback((e: any) => {
    setQuery(e && e.query !== undefined ? e.query : '');
  }, [setQuery]);
  const onBackdropClick = useCallback((e: any) => {
    if (e && e.target === e.currentTarget) closePalette();
  }, [closePalette]);
  function focusInput() {
    const panel$local = panel.current;
    if (!panel$local) return;
    const input = panel$local.querySelector('input');
    if (input && input.focus) input.focus();
  }
  const onOpen = useCallback(() => {
    setQuery('');
    setActiveValue(null);
    // Defer a tick so the overlay + <Listbox> are mounted before focusing.
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        focusInput();
      });
    } else {
      focusInput();
    }
  }, [focusInput, setQuery]);
  const onPanelKeydown = useCallback((e: any) => {
    if (e && e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  }, [closePalette]);
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
    return focusInput();
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
      <div ref={panel} className={"rozie-command-palette-panel"} role="dialog" aria-modal="true" aria-label={props.ariaLabel} onKeyDown={($event) => { onPanelKeydown($event); }} data-rozie-s-768cad96="">
        
        <Listbox combobox={true} filterable={false} closeOnSelect={false} options={filteredItems()} optionValue={commandValue} optionDisabled={commandDisabled} placeholder={props.placeholder} aria-label={props.ariaLabel} id={props.idBase} value={activeValue} onValueChange={setActiveValue} onChange={($event) => { onListboxChange($event); }} onSearch={($event) => { onListboxSearch($event); }} data-rozie-s-768cad96="" renderOption={({ option, index, active, selected, disabled }) => (<>
            {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option, index, active, selected, disabled }) : <><span className={"rozie-command-palette-option-label"} data-rozie-s-768cad96="">{rozieDisplay(labelText(option))}</span>{(groupText(option)) && <span className={"rozie-command-palette-option-group"} data-rozie-s-768cad96="">{rozieDisplay(groupText(option))}</span>}</>}
          </>)} renderEmpty={({ query }) => (<>
            {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : props.emptyText}
          </>)} />

        
        {((props.renderFooter ?? props.slots?.['footer'])) && <div className={"rozie-command-palette-footer"} data-rozie-s-768cad96="">
          {(props.renderFooter ?? props.slots?.['footer'])?.()}
        </div>}</div>
    </div>}</>
  );
});
export default CommandPalette;
