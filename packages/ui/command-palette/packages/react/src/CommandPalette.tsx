import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './CommandPalette.css';
import Combobox, { type ComboboxHandle } from '@rozie-ui/combobox-react';
import { scoreCommands, labelHighlight } from './internal/scoreCommands';

// ---- derived views (plain functions, uniform ×6) -----------------------
// The ranked command list fed to the vendored <Combobox> as its `:options`.
// command-palette KEEPS its own ranking (scoreCommands, fuzzy-subsequence by
// default over label+keywords, label weighted above keywords, pluggable via
// $props.score) and runs <Combobox :disable-filter="true"> — combobox's
// built-in filter is label-only substring and would drop keyword matching +
// the ranked ordering. scoreCommands already normalizes non-array input, so
// no local Array.isArray guard is needed. A plain function (called from the
// template binding AND handlers) — never $computed (the combobox
// value-vs-accessor split). Each item is passed through verbatim; combobox
// resolves its value via `optionValue` (below) and its label via `.label`.

interface OptionCtx { option: any; index: any; active: any; selected: any; disabled: any; matches: any; }

interface EmptyCtx { query: any; }

interface IconCtx { option: any; }

interface ActionsCtx { option: any; actions: any; }

interface TrailingCtx { option: any; }

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
   * The current search text (two-way `r-model`). Two-way bind it to read the query, or pre-seed it by setting a value alongside `open` — an open no longer clears it, so the palette opens filtered to that query. The component ranks `items` by this string via `score` (fuzzy-subsequence by default, matched over each item `label` plus its `keywords`, label weighted above keywords). Reset to `""` when the palette closes, so each plain open starts with a fresh search box.
   */
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  /**
   * Custom ranking/exclusion hook: `(item, query) => number | null`. Return `null` to exclude an item from the results; otherwise higher numbers rank first. Leave unset (`default: null`) to use the built-in fuzzy-subsequence scorer (label weighted above keywords). A recency/frecency boost is added INSIDE `score` (e.g. `return baseScore + recencyBonus(item.id)`), not as a separate prop.
   * @example
   * <CommandPalette :score="(item, q) => item.label.includes(q) ? 1 : null" :items="commands" />
   */
  score?: ((...args: any[]) => any) | null;
  /**
   * The command list — `[{ id, label, group?, keywords?, disabled?, icon?, actions? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; optional `group` is shown as a per-row label on each matching command (it is not a section heading — items are not bucketed); optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation. The optional `icon` and `actions` fields are display-only — unused by ranking — surfaced through the `#icon` and `#actions` option-row slots.
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
   * Id base for the combobox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase?: string;
  onSelect?: (...args: any[]) => void;
  renderOption?: (ctx: OptionCtx) => ReactNode;
  renderEmpty?: (ctx: EmptyCtx) => ReactNode;
  renderFooter?: () => ReactNode;
  renderIcon?: (ctx: IconCtx) => ReactNode;
  renderActions?: (ctx: ActionsCtx) => ReactNode;
  renderTrailing?: (ctx: TrailingCtx) => ReactNode;
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
  const props: Omit<CommandPaletteProps, 'score' | 'items' | 'placeholder' | 'emptyText' | 'closeOnSelect' | 'ariaLabel' | 'idBase'> & { score: ((...args: any[]) => any) | null; items: any[]; placeholder: string; emptyText: string; closeOnSelect: boolean; ariaLabel: string; idBase: string } = {
    ..._props,
    score: _props.score ?? null,
    items: _props.items ?? __defaultItems,
    placeholder: _props.placeholder ?? 'Type a command…',
    emptyText: _props.emptyText ?? 'No results.',
    closeOnSelect: _props.closeOnSelect ?? true,
    ariaLabel: _props.ariaLabel ?? 'Command palette',
    idBase: _props.idBase ?? 'rozie-command-palette',
  };
  const attrs: Record<string, unknown> = (() => {
    const { open, query, score, items, placeholder, emptyText, closeOnSelect, ariaLabel, idBase, defaultValue, onOpenChange, defaultOpen, onQueryChange, defaultQuery, ...rest } = _props as CommandPaletteProps & Record<string, unknown>;
    void open; void query; void score; void items; void placeholder; void emptyText; void closeOnSelect; void ariaLabel; void idBase; void defaultValue; void onOpenChange; void defaultOpen; void onQueryChange; void defaultQuery;
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
  const combobox = useRef<ComboboxHandle | null>(null);
  const _watch0First = useRef(true);

  function filteredItems() {
    return scoreCommands(props.items, query, props.score);
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
  function actionsList(o: any) {
    return o && o.actions ? o.actions : [];
  }
  function labelSegments(o: any) {
    const label = labelText(o);
    const ranges = labelHighlight(label, query);
    const segments = [];
    let cursor = 0;
    for (let i = 0; i < ranges.length; i++) {
      const start = ranges[i][0];
      const end = ranges[i][1];
      if (start > cursor) segments.push({
        text: label.slice(cursor, start),
        match: false
      });
      segments.push({
        text: label.slice(start, end),
        match: true
      });
      cursor = end;
    }
    if (cursor < label.length) segments.push({
      text: label.slice(cursor),
      match: false
    });
    if (segments.length === 0) segments.push({
      text: label,
      match: false
    });
    return segments;
  }
  function closePalette() {
    setOpen(false);
  }
  const { onSelect: _rozieProp_onSelect } = props;
    const onComboboxChange = useCallback((e: any) => {
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
  const onComboboxSearch = useCallback((e: any) => {
    setQuery(e && e.query !== undefined ? e.query : '');
  }, [setQuery]);
  const onBackdropClick = useCallback((e: any) => {
    if (e && e.target === e.currentTarget) closePalette();
  }, [closePalette]);
  function focusInput() {
    combobox.current?.focus();
  }
  const onOpen = useCallback(() => {
    setActiveValue(null);
    // Defer a tick so the overlay + <Combobox> are mounted before focusing.
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        focusInput();
      });
    } else {
      focusInput();
    }
  }, [focusInput]);
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
    if (isOpen) onOpen();else setQuery('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ show, close, toggle, focus });
  _rozieExposeRef.current = { show, close, toggle, focus };
  useImperativeHandle(ref, () => ({ show: (...args: Parameters<typeof show>): ReturnType<typeof show> => _rozieExposeRef.current.show(...args), close: (...args: Parameters<typeof close>): ReturnType<typeof close> => _rozieExposeRef.current.close(...args), toggle: (...args: Parameters<typeof toggle>): ReturnType<typeof toggle> => _rozieExposeRef.current.toggle(...args), focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args) }), []);

  return (
    <>
    {!!(open) && <div className={"rozie-command-palette"} onClick={($event) => { onBackdropClick($event); }} data-rozie-s-768cad96="">
      <div ref={panel} className={"rozie-command-palette-panel"} role="dialog" aria-modal="true" aria-label={props.ariaLabel} onKeyDown={($event) => { onPanelKeydown($event); }} data-rozie-s-768cad96="">
        
        <Combobox ref={combobox} inline={true} disableFilter={true} closeOnSelect={false} options={filteredItems()} optionValue={commandValue} optionDisabled={commandDisabled} placeholder={props.placeholder} aria-label={props.ariaLabel} idBase={props.idBase} value={activeValue} onValueChange={setActiveValue} onChange={($event) => { onComboboxChange($event); }} onSearch={($event) => { onComboboxSearch($event); }} data-rozie-s-768cad96="" renderOption={({ option, index, active, selected, disabled }) => (<>
            {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option, index, active, selected, disabled, matches: labelHighlight(labelText(option), query) }) : <div className={"rozie-command-palette-option"} data-rozie-s-768cad96="">
                {!!((props.renderIcon ?? props.slots?.['icon'])) && <span className={"rozie-command-palette-option-icon"} data-rozie-s-768cad96="">
                  {(props.renderIcon ?? props.slots?.['icon'])?.({ option })}
                </span>}<span className={"rozie-command-palette-option-main"} data-rozie-s-768cad96="">
                  <span className={"rozie-command-palette-option-label"} data-rozie-s-768cad96="">
                    {labelSegments(option).map((segment, si) => <span key={si} className={clsx({ "rozie-command-palette-option-label-match": segment.match })} data-rozie-s-768cad96="">{rozieDisplay(segment.text)}</span>)}
                  </span>
                  {!!(groupText(option)) && <span className={"rozie-command-palette-option-group"} data-rozie-s-768cad96="">{rozieDisplay(groupText(option))}</span>}</span>
                {!!((props.renderActions ?? props.slots?.['actions'])) && <span className={"rozie-command-palette-option-actions"} data-rozie-s-768cad96="">
                  {(props.renderActions ?? props.slots?.['actions'])?.({ option, actions: actionsList(option) })}
                </span>}{!!((props.renderTrailing ?? props.slots?.['trailing'])) && <span className={"rozie-command-palette-option-trailing"} data-rozie-s-768cad96="">
                  {(props.renderTrailing ?? props.slots?.['trailing'])?.({ option })}
                </span>}</div>}
          </>)} renderEmpty={({ query }) => (<>
            {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : props.emptyText}
          </>)} />

        
        {!!((props.renderFooter ?? props.slots?.['footer'])) && <div className={"rozie-command-palette-footer"} data-rozie-s-768cad96="">
          {(props.renderFooter ?? props.slots?.['footer'])?.()}
        </div>}</div>
    </div>}</>
  );
});
export default CommandPalette;
