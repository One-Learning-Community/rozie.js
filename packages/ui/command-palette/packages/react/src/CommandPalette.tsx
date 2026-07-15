import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './CommandPalette.css';
import Combobox, { type ComboboxHandle } from '@rozie-ui/combobox-react';
import { scoreCommands, labelHighlight } from './internal/scoreCommands';
import { isNavigating, pushFrame, popFrame, currentFrame, settleFrame, failFrame, breadcrumb as buildBreadcrumb, depth as levelDepth } from './internal/levelStack';
import { resolveChildSource, isAsyncLevel, nextRequestToken, isLatestRequest } from './internal/asyncSource';

// ---- async race-drop token + debounce timer (module-level lets) ---------
// These are NOT $data. They are read-after-write SYNCHRONOUSLY across async
// boundaries within a single handler (bump a token, then compare it after an
// await; clear/replace a timer id on every keystroke), which React's useState
// ($data) binds STALE (setState is async — the pre-write value is read). As
// module-level `let`s referenced ONLY from handlers/lifecycle (never the
// template), the React emitter hoists them to `useRef` (persistent +
// synchronous) via hoistModuleLet — giving a correct, target-uniform token
// comparison. Kept out of $data specifically to dodge the documented
// stale-read (the plan's $data placement broke the race-drop AND the navigate
// depth on React/Solid/Lit).

interface BreadcrumbCtx { stack: any; back: any; }

interface OptionCtx { option: any; index: any; active: any; selected: any; disabled: any; matches: any; }

interface EmptyCtx { query: any; }

interface LoadingCtx { query: any; }

interface ErrorCtx { query: any; error: any; retry: any; }

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
  /**
   * Debounce (ms) applied to a nested level's ASYNC `source(query)` keystroke refetch only — sync (`children`) levels re-rank locally on every keystroke with no debounce. Defaults to ~150ms (`internal/asyncSource.ts`'s `DEFAULT_SEARCH_DEBOUNCE`).
   * @example
   * <CommandPalette :search-debounce="300" :items="commands" />
   */
  searchDebounce?: number;
  onNavigate?: (...args: any[]) => void;
  onBack?: (...args: any[]) => void;
  onSelect?: (...args: any[]) => void;
  renderBreadcrumb?: (ctx: BreadcrumbCtx) => ReactNode;
  renderOption?: (ctx: OptionCtx) => ReactNode;
  renderEmpty?: (ctx: EmptyCtx) => ReactNode;
  renderLoading?: (ctx: LoadingCtx) => ReactNode;
  renderError?: (ctx: ErrorCtx) => ReactNode;
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
  goBack: (...args: any[]) => any;
  openTo: (...args: any[]) => any;
}

const CommandPalette = forwardRef<CommandPaletteHandle, CommandPaletteProps>(function CommandPalette(_props: CommandPaletteProps, ref): JSX.Element {
  const __defaultItems = useState(() => (() => [])())[0];
  const props: Omit<CommandPaletteProps, 'score' | 'items' | 'placeholder' | 'emptyText' | 'closeOnSelect' | 'ariaLabel' | 'idBase' | 'searchDebounce'> & { score: ((...args: any[]) => any) | null; items: any[]; placeholder: string; emptyText: string; closeOnSelect: boolean; ariaLabel: string; idBase: string; searchDebounce: number } = {
    ..._props,
    score: _props.score ?? null,
    items: _props.items ?? __defaultItems,
    placeholder: _props.placeholder ?? 'Type a command…',
    emptyText: _props.emptyText ?? 'No results.',
    closeOnSelect: _props.closeOnSelect ?? true,
    ariaLabel: _props.ariaLabel ?? 'Command palette',
    idBase: _props.idBase ?? 'rozie-command-palette',
    searchDebounce: _props.searchDebounce ?? 150,
  };
  const attrs: Record<string, unknown> = (() => {
    const { open, query, score, items, placeholder, emptyText, closeOnSelect, ariaLabel, idBase, searchDebounce, defaultValue, onOpenChange, defaultOpen, onQueryChange, defaultQuery, ...rest } = _props as CommandPaletteProps & Record<string, unknown>;
    void open; void query; void score; void items; void placeholder; void emptyText; void closeOnSelect; void ariaLabel; void idBase; void searchDebounce; void defaultValue; void onOpenChange; void defaultOpen; void onQueryChange; void defaultQuery;
    return rest;
  })();
  const debounceTimerId = useRef<any>(null);
  const requestToken = useRef(0);
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
  const [levelStack, setLevelStack] = useState<any[]>([]);
  const panel = useRef<HTMLDivElement | null>(null);
  const combobox = useRef<ComboboxHandle | null>(null);
  const _watch0First = useRef(true);

  function currentItems() {
    const frame = currentFrame(levelStack);
    if (frame) {
      if (frame.status === 'loading' || frame.status === 'error') return [];
      return frame.resolvedItems;
    }
    return props.items;
  }
  function currentDepth() {
    return levelDepth(levelStack);
  }
  function currentStatus() {
    const frame = currentFrame(levelStack);
    return frame ? frame.status : 'ready';
  }
  function currentError() {
    const frame = currentFrame(levelStack);
    return frame ? frame.error : null;
  }
  function atDepth() {
    return currentDepth() > 0;
  }
  function currentTitle() {
    const frame = currentFrame(levelStack);
    return frame && frame.title != null ? frame.title : props.ariaLabel;
  }
  function currentPlaceholder() {
    const frame = currentFrame(levelStack);
    return frame && frame.placeholder != null ? frame.placeholder : props.placeholder;
  }
  function breadcrumbStack() {
    return buildBreadcrumb(levelStack, props.ariaLabel);
  }
  function filteredItems() {
    return scoreCommands(currentItems(), query, props.score);
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
  function applyAsyncResult(token: any, promise: any) {
    return promise.then((items: any) => {
      if (!isLatestRequest(token, requestToken.current)) return;
      setLevelStack(prev => settleFrame(prev, Array.isArray(items) ? items : []));
    }, (error: any) => {
      if (!isLatestRequest(token, requestToken.current)) return;
      setLevelStack(prev => failFrame(prev, error));
    });
  }
  function beginLevelLoad(item: any, query: any) {
    const resolved = resolveChildSource(item, query);
    if (resolved.kind === 'async') {
      requestToken.current = nextRequestToken(requestToken.current);
      applyAsyncResult(requestToken.current, resolved.promise);
      return;
    }
    if (resolved.kind === 'sync') {
      const items = resolved.items;
      Promise.resolve().then(() => {
        setLevelStack(prev => settleFrame(prev, items));
      });
    }
  }
  function retryCurrentLevel() {
    const frame = currentFrame(levelStack);
    if (!frame || !frame.item || !isAsyncLevel(frame.item)) return;
    beginLevelLoad(frame.item, query);
  }
  function pushLevel(item: any) {
    const nextStack = pushFrame(levelStack, item, query);
    setLevelStack(nextStack);
    setQuery('');
    setActiveValue(null);
    combobox.current?.clear();
    focusInput();
    props.onNavigate && props.onNavigate({
      item,
      depth: nextStack.length
    });
    if (isAsyncLevel(item)) beginLevelLoad(item, '');
  }
  const { onBack: _rozieProp_onBack } = props;
    const goBack = useCallback(() => {
    if (levelStack.length === 0) return;
    const {
      stack,
      restoreQuery
    } = popFrame(levelStack);
    setLevelStack(stack);
    requestToken.current = nextRequestToken(requestToken.current);
    const q = restoreQuery == null ? '' : restoreQuery;
    setQuery(q);
    combobox.current?.seedQuery(q);
    setActiveValue(null);
    reopenComboboxPopup();
    _rozieProp_onBack && _rozieProp_onBack();
  }, [_rozieProp_onBack, levelStack, reopenComboboxPopup, setQuery]);
  async function openTo(path: any) {
    setOpen(true);
    let stack = [];
    setLevelStack(stack);
    setQuery('');
    const ids = Array.isArray(path) ? path : [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const list = stack.length === 0 ? props.items : stack[stack.length - 1].resolvedItems;
      const item = Array.isArray(list) ? list.find((it: any) => it && it.id === id) : null;
      if (!item) break;
      stack = pushFrame(stack, item, '');
      setLevelStack(stack);
      const resolved = resolveChildSource(item, '');
      if (resolved.kind === 'async') {
        requestToken.current = nextRequestToken(requestToken.current);
        const token = requestToken.current;
        try {
          const items = await resolved.promise;
          if (isLatestRequest(token, requestToken.current)) {
            stack = settleFrame(stack, Array.isArray(items) ? items : []);
            setLevelStack(stack);
          }
        } catch (error: any) {
          if (isLatestRequest(token, requestToken.current)) {
            stack = failFrame(stack, error);
            setLevelStack(stack);
          }
        }
      } else if (resolved.kind === 'sync') {
        stack = settleFrame(stack, resolved.items);
        setLevelStack(stack);
      }
    }
    setActiveValue(null);
    // Defer the combobox ref touch a frame (the onOpen() precedent) — openTo
    // may have just flipped `open` false→true in THIS call, so the overlay +
    // <Combobox> may not be mounted yet on every target when the drill loop's
    // awaits resolve.
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        combobox.current?.clear();
        focusInput();
      });
    } else {
      combobox.current?.clear();
      focusInput();
    }
  }
  const { onSelect: _rozieProp_onSelect } = props;
    const onComboboxChange = useCallback((e: any) => {
    const item = e ? e.option : null;
    if (!item || item.disabled) return;
    if (isNavigating(item)) {
      pushLevel(item);
      return;
    }
    const path = levelStack.map((f: any) => f.item ? f.item.id : null);
    _rozieProp_onSelect && _rozieProp_onSelect({
      item,
      path
    });
    // Clear the internal selection so re-selecting the same command re-fires.
    setActiveValue(null);
    if (props.closeOnSelect) closePalette();
  }, [_rozieProp_onSelect, closePalette, levelStack, props.closeOnSelect, pushLevel]);
  const onComboboxSearch = useCallback((e: any) => {
    const q = e && e.query !== undefined ? e.query : '';
    setQuery(q);
    const frame = currentFrame(levelStack);
    if (!frame || !isAsyncLevel(frame.item)) return;
    requestToken.current = nextRequestToken(requestToken.current);
    const token = requestToken.current;
    const item = frame.item;
    if (debounceTimerId.current != null) clearTimeout(debounceTimerId.current);
    debounceTimerId.current = setTimeout(() => {
      const resolved = resolveChildSource(item, q);
      if (resolved.kind === 'sync') {
        if (isLatestRequest(token, requestToken.current)) {
          setLevelStack(prev => settleFrame(prev, resolved.items));
        }
        return;
      }
      if (resolved.kind === 'async') applyAsyncResult(token, resolved.promise);
    }, props.searchDebounce);
  }, [applyAsyncResult, levelStack, props.searchDebounce, setQuery]);
  const onBackdropClick = useCallback((e: any) => {
    if (e && e.target === e.currentTarget) closePalette();
  }, [closePalette]);
  function focusInput() {
    combobox.current?.focus();
  }
  function deepActiveElement() {
    let node = typeof document !== 'undefined' ? document.activeElement : null;
    while (node && node.shadowRoot && node.shadowRoot.activeElement) {
      node = node.shadowRoot.activeElement;
    }
    return node;
  }
  function reopenComboboxPopup() {
    // `any` — document.activeElement types as `Element` (no `.blur`); the deepest
    // focused node is really an HTMLElement across all six leaves.
    const active: any = deepActiveElement();
    if (active && typeof active.blur === 'function') active.blur();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        focusInput();
      });
    } else {
      focusInput();
    }
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
    if (!e) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (currentDepth() > 0) goBack();else closePalette();
      return;
    }
    if (e.key === 'Backspace' && query === '' && currentDepth() > 0) {
      e.preventDefault();
      goBack();
    }
  }, [closePalette, currentDepth, goBack, query]);
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
    return () => {
      if (debounceTimerId.current != null) clearTimeout(debounceTimerId.current);
    };
  }, []);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const isOpen = open;
    if (isOpen) onOpen();else {
      setQuery('');
      setLevelStack([]);
      setActiveValue(null);
      if (debounceTimerId.current != null) clearTimeout(debounceTimerId.current);
      debounceTimerId.current = null;
      requestToken.current = nextRequestToken(requestToken.current);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ show, close, toggle, focus, goBack, openTo });
  _rozieExposeRef.current = { show, close, toggle, focus, goBack, openTo };
  useImperativeHandle(ref, () => ({ show: (...args: Parameters<typeof show>): ReturnType<typeof show> => _rozieExposeRef.current.show(...args), close: (...args: Parameters<typeof close>): ReturnType<typeof close> => _rozieExposeRef.current.close(...args), toggle: (...args: Parameters<typeof toggle>): ReturnType<typeof toggle> => _rozieExposeRef.current.toggle(...args), focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), goBack: (...args: Parameters<typeof goBack>): ReturnType<typeof goBack> => _rozieExposeRef.current.goBack(...args), openTo: (...args: Parameters<typeof openTo>): ReturnType<typeof openTo> => _rozieExposeRef.current.openTo(...args) }), []);

  return (
    <>
    {!!(open) && <div className={"rozie-command-palette"} onClick={($event) => { onBackdropClick($event); }} data-rozie-s-768cad96="">
      <div ref={panel} className={"rozie-command-palette-panel"} role="dialog" aria-modal="true" aria-label={props.ariaLabel} onKeyDown={($event) => { onPanelKeydown($event); }} data-rozie-s-768cad96="">
        
        {!!(atDepth()) && <div className={"rozie-command-palette-header"} data-rozie-s-768cad96="">
          {(props.renderBreadcrumb ?? props.slots?.['breadcrumb']) ? ((props.renderBreadcrumb ?? props.slots?.['breadcrumb']) as Function)({ stack: breadcrumbStack(), back: goBack }) : <><button type="button" className={"rozie-command-palette-back"} aria-label="Back" data-testid="command-palette-back" onClick={($event) => { goBack(); }} data-rozie-s-768cad96="">‹</button><span className={"rozie-command-palette-title"} data-testid="command-palette-title" data-rozie-s-768cad96="">{rozieDisplay(currentTitle())}</span></>}
        </div>}<Combobox ref={combobox} inline={true} disableFilter={true} closeOnSelect={false} options={filteredItems()} optionValue={commandValue} optionDisabled={commandDisabled} placeholder={currentPlaceholder()} aria-label={props.ariaLabel} idBase={props.idBase} value={activeValue} onValueChange={setActiveValue} onChange={($event) => { onComboboxChange($event); }} onSearch={($event) => { onComboboxSearch($event); }} data-rozie-s-768cad96="" renderOption={({ option, index, active, selected, disabled }) => (<>
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
            {!!(currentStatus() === 'ready') && ((props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : props.emptyText)}</>)} />

        
        {(currentStatus() === 'loading') ? <div className={"rozie-command-palette-loading"} data-rozie-s-768cad96="">
          {(props.renderLoading ?? props.slots?.['loading']) ? ((props.renderLoading ?? props.slots?.['loading']) as Function)({ query }) : "Loading…"}
        </div> : !!(currentStatus() === 'error') && <div className={"rozie-command-palette-error"} data-rozie-s-768cad96="">
          {(props.renderError ?? props.slots?.['error'])?.({ query, error: currentError(), retry: retryCurrentLevel })}
        </div>}{!!((props.renderFooter ?? props.slots?.['footer'])) && <div className={"rozie-command-palette-footer"} data-rozie-s-768cad96="">
          {(props.renderFooter ?? props.slots?.['footer'])?.()}
        </div>}</div>
    </div>}</>
  );
});
export default CommandPalette;
