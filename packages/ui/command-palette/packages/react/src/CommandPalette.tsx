import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clsx, parseInlineStyle, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './CommandPalette.css';
import Combobox, { type ComboboxHandle } from '@rozie-ui/combobox-react';
import { scoreCommands, labelHighlight } from './internal/scoreCommands';
import { isNavigating, pushFrame, popFrame, currentFrame, settleFrame, failFrame, breadcrumb as buildBreadcrumb, depth as levelDepth, levelDefaultItems } from './internal/levelStack';
import { resolveChildSource, isAsyncLevel, nextRequestToken, isLatestRequest } from './internal/asyncSource';
import { canOpenActions, actionsOf, firstEnabledActionIndex, rovingActionIndex, resolveEscape, matchesActionKey, caretAtEnd } from './internal/actionMenu';
import { deriveCommandGroups } from './internal/commandGroups';
import { formatKeyToken } from './internal/formatKeyToken';

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

interface GroupHeadingCtx { group: any; }

interface EmptyCtx { query: any; }

interface LoadingCtx { query: any; }

interface ErrorCtx { query: any; error: any; retry: any; }

interface ActionItemCtx { action: any; item: any; active: any; disabled: any; }

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
   * The command list — `[{ id, label, group?, keywords?, disabled?, icon?, actions? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; commands sharing an optional `group` string are bucketed under a labeled section heading (auto-derived, via the vendored combobox's native section groups) — commands with no `group` render first in a headingless block. The heading text is the `group` string itself; override its markup with the `#groupHeading` slot. Optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation. The optional `icon` and `actions` fields are display-only — unused by ranking — surfaced through the `#icon` and `#actions` option-row slots.
   */
  items?: any[];
  /**
   * Items shown when the query is empty (the empty/home state), resolved PER LEVEL. This top-level prop is the ROOT level's home view; a navigating item's own `defaultItems` field (alongside its `children`/`source`) is that CHILD level's home view. They render grouped when they carry `group` fields (composes with native sections, same as `items`), and scoring never reorders them (the empty-query short-circuit preserves author order). Typing a query switches to scored `items`/`source` results; clearing the query returns to `defaultItems`. This is the first-class replacement for branching on `query === ''` inside a `source` function — and the natural home for a recents/frecency list (composes with the `score` prop's recency boost). Leave unset (`default: () => []`) for today's behavior — no defaultItems is byte-behavior-identical to the full source-order list.
   * @example
   * <CommandPalette :default-items="recentCommands" :items="commands" />
   */
  defaultItems?: any[];
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
  /**
   * The keyboard shortcut that opens the highlighted row's action menu — a portable `$mod+<letter>` token (default `"$mod+k"`, i.e. ⌘K/Ctrl+K) matched via `(event.metaKey || event.ctrlKey) && event.key === <letter>`. A bare single-letter token (e.g. `"k"`) matches with no modifier required. Pressing it (or caret-at-end Right-arrow, or clicking the row's actions affordance) on a row with no `actions` is a no-op — the menu only opens for a row that has them.
   * @example
   * <CommandPalette action-key="$mod+j" :items="commands" />
   */
  actionKey?: string;
  /**
   * Whether choosing an action closes the whole palette. Defaults to `true` — running an action ALWAYS closes the action menu itself; `closeOnAction` additionally decides whether the palette dismisses too (`false` returns to the result list with the palette still open, e.g. for firing several actions in a row).
   */
  closeOnAction?: boolean;
  /**
   * Pass-through to the vendored combobox's `groupCap`: cap each command section to its first `groupCap` results with an expand-in-place '+N more' row. `0`/absent = uncapped (default). `groupCap` composes with per-row `actions`: the ⌘K/Right-arrow row action menu always anchors to the exact highlighted VISIBLE row (cap-aware, order-independent), and firing it on a '+N more' row is a no-op.
   */
  groupCap?: number;
  /**
   * Where the overlay portals to, escaping an ancestor `overflow:hidden`/`transform`/`filter`/`contain` that would otherwise clip a `position:fixed` overlay (e.g. an embedding iframe/app-shell with its own layout chrome). `false`/absent (default) renders in place — byte-behavior-identical to every existing consumer, zero churn. `true` or `'body'` portals to `document.body`. A CSS selector string portals to the first element that selector matches. An `Element` reference portals to that element directly. SSR-safe: falls back to in-place when `document` is unavailable. Token-placement note: theming custom properties (`--rozie-command-palette-*`) must be set on `:root` (or the `appendTo` container itself) to reach a portalled overlay — a host-scoped token does not cross the portal on any target.
   * @example
   * <CommandPalette append-to="body" :items="commands" />
   */
  appendTo?: boolean | string;
  onNavigate?: (...args: any[]) => void;
  onBack?: (...args: any[]) => void;
  onSelect?: (...args: any[]) => void;
  onActionSelect?: (...args: any[]) => void;
  renderBreadcrumb?: (ctx: BreadcrumbCtx) => ReactNode;
  renderOption?: (ctx: OptionCtx) => ReactNode;
  renderGroupHeading?: (ctx: GroupHeadingCtx) => ReactNode;
  renderEmpty?: (ctx: EmptyCtx) => ReactNode;
  renderLoading?: (ctx: LoadingCtx) => ReactNode;
  renderError?: (ctx: ErrorCtx) => ReactNode;
  renderFooter?: () => ReactNode;
  renderActionItem?: (ctx: ActionItemCtx) => ReactNode;
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
  const __defaultDefaultItems = useState(() => (() => [])())[0];
  const props: Omit<CommandPaletteProps, 'score' | 'items' | 'defaultItems' | 'placeholder' | 'emptyText' | 'closeOnSelect' | 'ariaLabel' | 'idBase' | 'searchDebounce' | 'actionKey' | 'closeOnAction' | 'groupCap' | 'appendTo'> & { score: ((...args: any[]) => any) | null; items: any[]; defaultItems: any[]; placeholder: string; emptyText: string; closeOnSelect: boolean; ariaLabel: string; idBase: string; searchDebounce: number; actionKey: string; closeOnAction: boolean; groupCap: number; appendTo: boolean | string } = {
    ..._props,
    score: _props.score ?? null,
    items: _props.items ?? __defaultItems,
    defaultItems: _props.defaultItems ?? __defaultDefaultItems,
    placeholder: _props.placeholder ?? 'Type a command…',
    emptyText: _props.emptyText ?? 'No results.',
    closeOnSelect: _props.closeOnSelect ?? true,
    ariaLabel: _props.ariaLabel ?? 'Command palette',
    idBase: _props.idBase ?? 'rozie-command-palette',
    searchDebounce: _props.searchDebounce ?? 150,
    actionKey: _props.actionKey ?? '$mod+k',
    closeOnAction: _props.closeOnAction ?? true,
    groupCap: _props.groupCap ?? 0,
    appendTo: _props.appendTo ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { open, query, score, items, defaultItems, placeholder, emptyText, closeOnSelect, ariaLabel, idBase, searchDebounce, actionKey, closeOnAction, groupCap, appendTo, defaultValue, onOpenChange, defaultOpen, onQueryChange, defaultQuery, ...rest } = _props as CommandPaletteProps & Record<string, unknown>;
    void open; void query; void score; void items; void defaultItems; void placeholder; void emptyText; void closeOnSelect; void ariaLabel; void idBase; void searchDebounce; void actionKey; void closeOnAction; void groupCap; void appendTo; void defaultValue; void onOpenChange; void defaultOpen; void onQueryChange; void defaultQuery;
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
  const [activeSurface, setActiveSurface] = useState('list');
  const [actionIndex, setActionIndex] = useState(-1);
  const [actionAnchor, setActionAnchor] = useState<any>(null);
  const [actionMenuTop, setActionMenuTop] = useState(0);
  const frame = useRef<HTMLDivElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const combobox = useRef<ComboboxHandle | null>(null);
  const _watch0First = useRef(true);

  const { onBack: _rozieProp_onBack } = props;
  function resolveAppendTo(to: any) {
    if (!to) return null;
    if (typeof document === 'undefined') return null;
    if (to === true || to === 'body') return document.body;
    if (typeof to === 'string') return document.querySelector(to);
    return to;
  }
  function currentItems() {
    const frame = currentFrame(levelStack);
    if (frame) {
      if (frame.status === 'loading' || frame.status === 'error') return [];
      return frame.resolvedItems;
    }
    return props.items;
  }
  function currentDefaultItems() {
    const frame = currentFrame(levelStack);
    return frame ? frame.defaultItems : props.defaultItems;
  }
  function currentBaseItems() {
    const q = String(query == null ? '' : query).trim();
    const defaults = currentDefaultItems();
    if (q === '' && Array.isArray(defaults) && defaults.length > 0) return defaults;
    return currentItems();
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
  function atActions() {
    return activeSurface === 'actions';
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
    return scoreCommands(currentBaseItems(), query, props.score);
  }
  function groupedView() {
    return deriveCommandGroups(filteredItems());
  }
  function orderedItems() {
    return groupedView().ordered;
  }
  function commandGroups() {
    return groupedView().groups;
  }
  function grouped() {
    return commandGroups().length > 0;
  }
  function groupLabel(g: any) {
    return g && g.label !== undefined ? g.label : '';
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
  function hotKeyOf(o: any) {
    return o && o.hotKey ? o.hotKey : '';
  }
  function actionLabel(a: any) {
    return a && a.label !== undefined ? a.label : '';
  }
  function actionShortcut(a: any) {
    return a && a.shortcut !== undefined ? a.shortcut : undefined;
  }
  function actionIcon(a: any) {
    return a && a.icon !== undefined ? a.icon : undefined;
  }
  function isApplePlatform() {
    if (typeof navigator === 'undefined') return false;
    const p = (navigator.platform || '') + ' ' + (navigator.userAgent || '');
    return /Mac|iPhone|iPad|iPod/.test(p);
  }
  function actionKeyHint() {
    const k = props.actionKey;
    if (typeof k !== 'string') return '';
    return formatKeyToken(k, isApplePlatform());
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
    // Level nav always resets to the list surface (spec §Composition) — a
    // navigating item's own action menu, if somehow open, must not survive
    // the push.
    if (activeSurface !== 'list') closeActionMenu();
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
    // command-palette-13-empty-home-view-first: an item carrying a non-empty
    // defaultItems is seeded 'ready' by pushFrame — skip the initial
    // beginLevelLoad('') kick-off entirely (no source('') call, no loading
    // flash). Typing still triggers the debounced source(query) refetch below
    // (onComboboxSearch); clearing back to '' returns to the home view without
    // ever invoking source.
    if (isAsyncLevel(item) && levelDefaultItems(item).length === 0) beginLevelLoad(item, '');
  }
  const goBack = useCallback(() => {
    if (levelStack.length === 0) return;
    // Level nav always resets to the list surface (spec §Composition) — pop
    // closes an open action menu FIRST.
    if (activeSurface !== 'list') closeActionMenu();
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
  }, [_rozieProp_onBack, activeSurface, closeActionMenu, levelStack, reopenComboboxPopup, setQuery]);
  const jumpToLevel = useCallback((targetDepth: any) => {
    let stack = levelStack;
    if (targetDepth < 0 || targetDepth >= stack.length) return;
    // Level nav always resets to the list surface (spec §Composition) — mirror
    // goBack: a jump always resets to the list surface FIRST.
    if (activeSurface !== 'list') closeActionMenu();
    let restoreQuery: any = null;
    while (stack.length > targetDepth) {
      const popped = popFrame(stack);
      stack = popped.stack;
      restoreQuery = popped.restoreQuery == null ? '' : popped.restoreQuery;
      _rozieProp_onBack && _rozieProp_onBack();
    }
    setLevelStack(stack);
    requestToken.current = nextRequestToken(requestToken.current);
    const q = restoreQuery == null ? '' : restoreQuery;
    setQuery(q);
    combobox.current?.seedQuery(q);
    setActiveValue(null);
    reopenComboboxPopup();
  }, [_rozieProp_onBack, activeSurface, closeActionMenu, levelStack, reopenComboboxPopup, setQuery]);
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
    // command-palette-13-empty-home-view-first: clearing back to '' on a level
    // that carries defaultItems must NOT refetch (no source('') call) and must
    // NOT let a late in-flight source result stomp the restored home view —
    // bump the token (drops any in-flight resolution), clear any pending
    // debounce timer, and return. currentBaseItems() already swaps back to
    // the frame's defaultItems on the next render via filteredItems().
    if (q === '' && levelDefaultItems(frame.item).length > 0) {
      requestToken.current = nextRequestToken(requestToken.current);
      if (debounceTimerId.current != null) clearTimeout(debounceTimerId.current);
      debounceTimerId.current = null;
      return;
    }
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
  function deepQuerySelector(root: any, selector: any) {
    if (!root || typeof root.querySelector !== 'function') return null;
    const direct = root.querySelector(selector);
    if (direct) return direct;
    const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (let i = 0; i < all.length; i++) {
      const sr = all[i].shadowRoot;
      if (sr) {
        const found = deepQuerySelector(sr, selector);
        if (found) return found;
      }
    }
    return null;
  }
  function highlightedItem() {
    const panel$local = panel.current;
    if (!panel$local) return null;
    const activeEl: any = deepQuerySelector(panel$local, '.rozie-combobox-option--active');
    if (!activeEl) return null;
    const anchorEl: any = activeEl.querySelector ? activeEl.querySelector('[data-cp-value]') : null;
    if (!anchorEl) return null;
    const value = anchorEl.getAttribute('data-cp-value');
    if (value == null) return null;
    const list = filteredItems();
    for (let i = 0; i < list.length; i++) {
      if (String(commandValue(list[i])) === value) return list[i];
    }
    return null;
  }
  function searchInputEl() {
    const panel$local = panel.current;
    return panel$local ? deepQuerySelector(panel$local, 'input[role="combobox"]') : null;
  }
  function focusFirstMenuItem() {
    const frame$local = frame.current;
    if (!frame$local) return;
    const el: any = frame$local.querySelector('[data-command-palette-menu] [role="menuitem"]:not([aria-disabled="true"])');
    if (el && typeof el.focus === 'function') el.focus();
  }
  const openActionMenu = useCallback((item: any) => {
    if (!canOpenActions(item)) return;
    const actions = actionsOf(item);
    // The flyout's `:aria-label` reads `$data.actionAnchor.label` (a plain
    // PROPERTY read, computed here in script) rather than calling
    // `labelText(item)` directly from the template attribute binding — a bare
    // top-level-helper CALL inside a plain (non-slot-scoped) `:attr` binding
    // throws `labelText is not defined` on the Angular target specifically
    // (the emitter's `this.`-qualification pass doesn't reach that binding
    // shape) — a source-level workaround, not an emitter change.
    setActionAnchor({
      item,
      actions,
      label: labelText(item)
    });
    setActionIndex(firstEnabledActionIndex(actions));
    setActiveSurface('actions');
    const panel$local = panel.current;
    const frame$local = frame.current;
    const activeRow: any = panel$local ? deepQuerySelector(panel$local, '.rozie-combobox-option--active') : null;
    // Frame-relative getBoundingClientRect delta (finding 1) — NOT
    // `activeRow.offsetTop`, which is relative to the row's offsetParent (the
    // `position: relative` `.rozie-combobox` root, Combobox.rozie) and so
    // omits the header height + the combobox's own top (would float the
    // flyout above its row at depth>0). A getBoundingClientRect delta is
    // viewport-relative on BOTH sides of the Lit nested-shadow boundary
    // (panel/combobox are separate shadow roots there) so it is correct ×6
    // AND correct when the combobox list is scrolled (offsetTop ignores
    // scroll). The frame wraps the panel tightly (no padding), so
    // frame-top ≈ panel-top and the flyout still aligns to its row.
    // `frame.scrollTop` is 0 — the frame does not scroll.
    setActionMenuTop(activeRow && frame$local ? activeRow.getBoundingClientRect().top - frame$local.getBoundingClientRect().top + frame$local.scrollTop : 0);
    combobox.current?.pinOpen(true);
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        focusFirstMenuItem();
        // Viewport clamp (finding 1) — a menu opening on a 1-row panel must
        // never run off the viewport bottom. Reads DOM post-mount (rAF), so
        // the flyout has laid out. Shifts the menu UP only; never above the
        // frame top.
        const menuEl: any = frame$local ? frame$local.querySelector('[data-command-palette-menu]') : null;
        if (menuEl && frame$local) {
          const frameTop = frame$local.getBoundingClientRect().top;
          const menuH = menuEl.getBoundingClientRect().height;
          const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
          const maxTop = Math.max(0, vh - 8 - frameTop - menuH);
          if (actionMenuTop > maxTop) setActionMenuTop(maxTop);
        }
      });
    } else {
      focusFirstMenuItem();
    }
  }, [actionMenuTop, deepQuerySelector, focusFirstMenuItem, labelText]);
  function closeActionMenu() {
    setActiveSurface('list');
    setActionIndex(-1);
    setActionAnchor(null);
    combobox.current?.pinOpen(false);
    reopenComboboxPopup();
  }
  function roveAction(dir: any) {
    const anchor = actionAnchor;
    if (!anchor) return;
    const idx = rovingActionIndex(anchor.actions, actionIndex, dir);
    setActionIndex(idx);
    // Re-rooted to $refs.frame (finding 1) — the flyout moved out of the
    // panel to be a frame child; see focusFirstMenuItem's comment.
    const frame$local = frame.current;
    if (!frame$local) return;
    const items: any = frame$local.querySelectorAll('[data-command-palette-menu] [role="menuitem"]');
    const el: any = items[idx];
    if (el && typeof el.focus === 'function') el.focus();
  }
  const { onActionSelect: _rozieProp_onActionSelect } = props;
    const selectAction = useCallback((action: any) => {
    if (!action || action.disabled) return;
    const anchor = actionAnchor;
    const item = anchor ? anchor.item : null;
    _rozieProp_onActionSelect && _rozieProp_onActionSelect({
      item,
      action
    });
    closeActionMenu();
    if (props.closeOnAction) closePalette();
  }, [_rozieProp_onActionSelect, actionAnchor, closeActionMenu, closePalette, props.closeOnAction]);
  const onActionMenuKeydown = useCallback((e: any) => {
    if (!e) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      roveAction(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      roveAction(-1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      const anchor = actionAnchor;
      const action = anchor && Array.isArray(anchor.actions) ? anchor.actions[actionIndex] : null;
      if (action) selectAction(action);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      closeActionMenu();
      return;
    }
    if (matchesActionKey(e, props.actionKey)) {
      e.preventDefault();
      e.stopPropagation();
      closeActionMenu();
    }
  }, [actionAnchor, actionIndex, closeActionMenu, props.actionKey, roveAction, selectAction]);
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
      const route = resolveEscape(activeSurface, currentDepth());
      if (route === 'close-surface') closeActionMenu();else if (route === 'pop-level') goBack();else closePalette();
      return;
    }
    if (activeSurface === 'list') {
      if (matchesActionKey(e, props.actionKey)) {
        const item = highlightedItem();
        if (canOpenActions(item)) {
          e.preventDefault();
          openActionMenu(item);
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        const input: any = searchInputEl();
        const item = highlightedItem();
        const value = input && input.value != null ? String(input.value) : '';
        if (input && caretAtEnd(input.selectionStart, input.selectionEnd, value.length) && canOpenActions(item)) {
          e.preventDefault();
          openActionMenu(item);
          return;
        }
      }
    }
    if (e.key === 'Backspace' && query === '' && currentDepth() > 0 && activeSurface === 'list') {
      e.preventDefault();
      goBack();
    }
  }, [activeSurface, closeActionMenu, closePalette, currentDepth, goBack, highlightedItem, openActionMenu, props.actionKey, query, searchInputEl]);
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
      // Reset the action surface directly (NOT closeActionMenu — the palette is
      // closing, so there is no combobox popup left to reopen/keepOpen-release;
      // a plain reset keeps a reopen starting clean, per spec §Composition).
      setActiveSurface('list');
      setActionIndex(-1);
      setActionAnchor(null);
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
    {!!(open) && ((() => { const __rozieContainer = typeof document === 'undefined' ? null : (resolveAppendTo(props.appendTo)); return __rozieContainer ? createPortal(<div className={"rozie-command-palette"} onClick={($event) => { onBackdropClick($event); }} data-rozie-s-768cad96="">
      
      <div ref={frame} className={"rozie-command-palette-frame"} data-testid="command-palette-frame" onKeyDown={($event) => { onPanelKeydown($event); }} data-rozie-s-768cad96="">
      <div ref={panel} className={"rozie-command-palette-panel"} role="dialog" aria-modal="true" aria-label={props.ariaLabel} data-rozie-s-768cad96="">
        
        {!!(atDepth()) && <div className={"rozie-command-palette-header"} data-rozie-s-768cad96="">
          {(props.renderBreadcrumb ?? props.slots?.['breadcrumb']) ? ((props.renderBreadcrumb ?? props.slots?.['breadcrumb']) as Function)({ stack: breadcrumbStack(), back: goBack }) : <><button type="button" className={"rozie-command-palette-back"} aria-label="Back" data-testid="command-palette-back" onClick={($event) => { goBack(); }} data-rozie-s-768cad96="">‹</button><nav className={"rozie-command-palette-breadcrumb-trail"} data-testid="command-palette-breadcrumb-trail" aria-label="Breadcrumb" data-rozie-s-768cad96="">
              {breadcrumbStack().map((entry, ei) => <span key={ei} className={"rozie-command-palette-breadcrumb-item"} data-rozie-s-768cad96="">
                {!!(Number(ei) > 0) && <span className={"rozie-command-palette-breadcrumb-separator"} aria-hidden="true" data-rozie-s-768cad96="">›</span>}{(Number(ei) < breadcrumbStack().length - 1) ? <button type="button" className={"rozie-command-palette-breadcrumb-segment rozie-command-palette-breadcrumb-segment--link"} aria-label={rozieAttr('Back to ' + entry.title)} data-testid="command-palette-breadcrumb-jump" onClick={($event) => { jumpToLevel(Number(ei)); }} data-rozie-s-768cad96="">{rozieDisplay(entry.title)}</button> : <span className={"rozie-command-palette-breadcrumb-segment rozie-command-palette-breadcrumb-segment--current"} data-testid="command-palette-title" data-rozie-s-768cad96="">{rozieDisplay(entry.title)}</span>}</span>)}
            </nav></>}
        </div>}<Combobox ref={combobox} inline={true} disableFilter={true} closeOnSelect={false} options={orderedItems()} groups={commandGroups()} groupCap={props.groupCap} optionValue={commandValue} optionDisabled={commandDisabled} placeholder={currentPlaceholder()} aria-label={props.ariaLabel} idBase={props.idBase} value={activeValue} onValueChange={setActiveValue} onChange={($event) => { onComboboxChange($event); }} onSearch={($event) => { onComboboxSearch($event); }} data-rozie-s-768cad96="" renderOption={({ option, index, active, selected, disabled }) => (<>
            <span className={"rozie-command-palette-option-anchor"} data-cp-value={rozieAttr(commandValue(option))} data-rozie-s-768cad96="">
            {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option, index, active, selected, disabled, matches: labelHighlight(labelText(option), query) }) : <div className={"rozie-command-palette-option"} data-rozie-s-768cad96="">
                {!!((props.renderIcon ?? props.slots?.['icon'])) && <span className={"rozie-command-palette-option-icon"} data-rozie-s-768cad96="">
                  {(props.renderIcon ?? props.slots?.['icon'])?.({ option })}
                </span>}<span className={"rozie-command-palette-option-main"} data-rozie-s-768cad96="">
                  <span className={"rozie-command-palette-option-label"} data-rozie-s-768cad96="">
                    {labelSegments(option).map((segment, si) => <span key={si} className={clsx({ "rozie-command-palette-option-label-match": segment.match })} data-rozie-s-768cad96="">{rozieDisplay(segment.text)}</span>)}
                  </span>
                  {!!(groupText(option) && !grouped()) && <span className={"rozie-command-palette-option-group"} data-rozie-s-768cad96="">{rozieDisplay(groupText(option))}</span>}</span>
                
                {!!(hotKeyOf(option)) && <span className={"rozie-command-palette-option-hotkey"} aria-hidden="true" data-rozie-s-768cad96="">{rozieDisplay(formatKeyToken(hotKeyOf(option), isApplePlatform()))}</span>}{!!((props.renderActions ?? props.slots?.['actions']) || actionsList(option).length > 0) && <span className={"rozie-command-palette-option-actions"} data-testid="command-palette-actions-affordance" onMouseDown={($event) => { $event.stopPropagation(); openActionMenu(option); }} data-rozie-s-768cad96="">
                  {(props.renderActions ?? props.slots?.['actions']) ? ((props.renderActions ?? props.slots?.['actions']) as Function)({ option, actions: actionsList(option) }) : !!(actionsList(option).length > 0) && <span className={"rozie-command-palette-option-actions-hint"} aria-hidden="true" data-rozie-s-768cad96="">{rozieDisplay(actionKeyHint())}</span>}
                </span>}{!!((props.renderTrailing ?? props.slots?.['trailing'])) && <span className={"rozie-command-palette-option-trailing"} data-rozie-s-768cad96="">
                  {(props.renderTrailing ?? props.slots?.['trailing'])?.({ option })}
                </span>}</div>}
            </span>
          </>)} renderGroupHeading={({ group }) => (<>
            {(props.renderGroupHeading ?? props.slots?.['groupHeading']) ? ((props.renderGroupHeading ?? props.slots?.['groupHeading']) as Function)({ group }) : rozieDisplay(groupLabel(group))}
          </>)} renderEmpty={({ query }) => (<>
            {!!(currentStatus() === 'ready') && ((props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : props.emptyText)}</>)} />

        
        {(currentStatus() === 'loading') ? <div className={"rozie-command-palette-loading"} data-rozie-s-768cad96="">
          {(props.renderLoading ?? props.slots?.['loading']) ? ((props.renderLoading ?? props.slots?.['loading']) as Function)({ query }) : "Loading…"}
        </div> : !!(currentStatus() === 'error') && <div className={"rozie-command-palette-error"} data-rozie-s-768cad96="">
          {(props.renderError ?? props.slots?.['error'])?.({ query, error: currentError(), retry: retryCurrentLevel })}
        </div>}{!!((props.renderFooter ?? props.slots?.['footer'])) && <div className={"rozie-command-palette-footer"} data-rozie-s-768cad96="">
          {(props.renderFooter ?? props.slots?.['footer'])?.()}
        </div>}</div>

      
      {!!(atActions()) && <div data-command-palette-menu="" data-testid="command-palette-actions-menu" className={"rozie-command-palette-actions-menu"} role="menu" aria-label={rozieAttr(actionAnchor ? actionAnchor.label : undefined)} style={parseInlineStyle('top:' + actionMenuTop + 'px')} onKeyDown={($event) => { onActionMenuKeydown($event); }} data-rozie-s-768cad96="">
        {(actionAnchor ? actionAnchor.actions : []).map((action, ai) => <div key={action.id} className={clsx("rozie-command-palette-actions-menu-item", { "rozie-command-palette-actions-menu-item--active": ai === actionIndex, "rozie-command-palette-actions-menu-item--disabled": !!action.disabled })} role="menuitem" data-testid="command-palette-action-item" aria-disabled={!!action.disabled} tabIndex={-1} onMouseEnter={($event) => { setActionIndex(Number(ai)); }} onMouseDown={($event) => { $event.preventDefault(); selectAction(action); }} data-rozie-s-768cad96="">
          {(props.renderActionItem ?? props.slots?.['actionItem']) ? ((props.renderActionItem ?? props.slots?.['actionItem']) as Function)({ action, item: actionAnchor ? actionAnchor.item : null, active: ai === actionIndex, disabled: !!action.disabled }) : <>{!!(actionIcon(action)) && <span className={"rozie-command-palette-actions-menu-item-icon"} data-rozie-s-768cad96="">{rozieDisplay(actionIcon(action))}</span>}<span className={"rozie-command-palette-actions-menu-item-label"} data-rozie-s-768cad96="">{rozieDisplay(actionLabel(action))}</span>{!!(actionShortcut(action)) && <span className={"rozie-command-palette-actions-menu-item-shortcut"} data-rozie-s-768cad96="">{rozieDisplay(actionShortcut(action))}</span>}</>}
        </div>)}
      </div>}</div>
    </div>, __rozieContainer) : (<div className={"rozie-command-palette"} onClick={($event) => { onBackdropClick($event); }} data-rozie-s-768cad96="">
      
      <div ref={frame} className={"rozie-command-palette-frame"} data-testid="command-palette-frame" onKeyDown={($event) => { onPanelKeydown($event); }} data-rozie-s-768cad96="">
      <div ref={panel} className={"rozie-command-palette-panel"} role="dialog" aria-modal="true" aria-label={props.ariaLabel} data-rozie-s-768cad96="">
        
        {!!(atDepth()) && <div className={"rozie-command-palette-header"} data-rozie-s-768cad96="">
          {(props.renderBreadcrumb ?? props.slots?.['breadcrumb']) ? ((props.renderBreadcrumb ?? props.slots?.['breadcrumb']) as Function)({ stack: breadcrumbStack(), back: goBack }) : <><button type="button" className={"rozie-command-palette-back"} aria-label="Back" data-testid="command-palette-back" onClick={($event) => { goBack(); }} data-rozie-s-768cad96="">‹</button><nav className={"rozie-command-palette-breadcrumb-trail"} data-testid="command-palette-breadcrumb-trail" aria-label="Breadcrumb" data-rozie-s-768cad96="">
              {breadcrumbStack().map((entry, ei) => <span key={ei} className={"rozie-command-palette-breadcrumb-item"} data-rozie-s-768cad96="">
                {!!(Number(ei) > 0) && <span className={"rozie-command-palette-breadcrumb-separator"} aria-hidden="true" data-rozie-s-768cad96="">›</span>}{(Number(ei) < breadcrumbStack().length - 1) ? <button type="button" className={"rozie-command-palette-breadcrumb-segment rozie-command-palette-breadcrumb-segment--link"} aria-label={rozieAttr('Back to ' + entry.title)} data-testid="command-palette-breadcrumb-jump" onClick={($event) => { jumpToLevel(Number(ei)); }} data-rozie-s-768cad96="">{rozieDisplay(entry.title)}</button> : <span className={"rozie-command-palette-breadcrumb-segment rozie-command-palette-breadcrumb-segment--current"} data-testid="command-palette-title" data-rozie-s-768cad96="">{rozieDisplay(entry.title)}</span>}</span>)}
            </nav></>}
        </div>}<Combobox ref={combobox} inline={true} disableFilter={true} closeOnSelect={false} options={orderedItems()} groups={commandGroups()} groupCap={props.groupCap} optionValue={commandValue} optionDisabled={commandDisabled} placeholder={currentPlaceholder()} aria-label={props.ariaLabel} idBase={props.idBase} value={activeValue} onValueChange={setActiveValue} onChange={($event) => { onComboboxChange($event); }} onSearch={($event) => { onComboboxSearch($event); }} data-rozie-s-768cad96="" renderOption={({ option, index, active, selected, disabled }) => (<>
            <span className={"rozie-command-palette-option-anchor"} data-cp-value={rozieAttr(commandValue(option))} data-rozie-s-768cad96="">
            {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option, index, active, selected, disabled, matches: labelHighlight(labelText(option), query) }) : <div className={"rozie-command-palette-option"} data-rozie-s-768cad96="">
                {!!((props.renderIcon ?? props.slots?.['icon'])) && <span className={"rozie-command-palette-option-icon"} data-rozie-s-768cad96="">
                  {(props.renderIcon ?? props.slots?.['icon'])?.({ option })}
                </span>}<span className={"rozie-command-palette-option-main"} data-rozie-s-768cad96="">
                  <span className={"rozie-command-palette-option-label"} data-rozie-s-768cad96="">
                    {labelSegments(option).map((segment, si) => <span key={si} className={clsx({ "rozie-command-palette-option-label-match": segment.match })} data-rozie-s-768cad96="">{rozieDisplay(segment.text)}</span>)}
                  </span>
                  {!!(groupText(option) && !grouped()) && <span className={"rozie-command-palette-option-group"} data-rozie-s-768cad96="">{rozieDisplay(groupText(option))}</span>}</span>
                
                {!!(hotKeyOf(option)) && <span className={"rozie-command-palette-option-hotkey"} aria-hidden="true" data-rozie-s-768cad96="">{rozieDisplay(formatKeyToken(hotKeyOf(option), isApplePlatform()))}</span>}{!!((props.renderActions ?? props.slots?.['actions']) || actionsList(option).length > 0) && <span className={"rozie-command-palette-option-actions"} data-testid="command-palette-actions-affordance" onMouseDown={($event) => { $event.stopPropagation(); openActionMenu(option); }} data-rozie-s-768cad96="">
                  {(props.renderActions ?? props.slots?.['actions']) ? ((props.renderActions ?? props.slots?.['actions']) as Function)({ option, actions: actionsList(option) }) : !!(actionsList(option).length > 0) && <span className={"rozie-command-palette-option-actions-hint"} aria-hidden="true" data-rozie-s-768cad96="">{rozieDisplay(actionKeyHint())}</span>}
                </span>}{!!((props.renderTrailing ?? props.slots?.['trailing'])) && <span className={"rozie-command-palette-option-trailing"} data-rozie-s-768cad96="">
                  {(props.renderTrailing ?? props.slots?.['trailing'])?.({ option })}
                </span>}</div>}
            </span>
          </>)} renderGroupHeading={({ group }) => (<>
            {(props.renderGroupHeading ?? props.slots?.['groupHeading']) ? ((props.renderGroupHeading ?? props.slots?.['groupHeading']) as Function)({ group }) : rozieDisplay(groupLabel(group))}
          </>)} renderEmpty={({ query }) => (<>
            {!!(currentStatus() === 'ready') && ((props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : props.emptyText)}</>)} />

        
        {(currentStatus() === 'loading') ? <div className={"rozie-command-palette-loading"} data-rozie-s-768cad96="">
          {(props.renderLoading ?? props.slots?.['loading']) ? ((props.renderLoading ?? props.slots?.['loading']) as Function)({ query }) : "Loading…"}
        </div> : !!(currentStatus() === 'error') && <div className={"rozie-command-palette-error"} data-rozie-s-768cad96="">
          {(props.renderError ?? props.slots?.['error'])?.({ query, error: currentError(), retry: retryCurrentLevel })}
        </div>}{!!((props.renderFooter ?? props.slots?.['footer'])) && <div className={"rozie-command-palette-footer"} data-rozie-s-768cad96="">
          {(props.renderFooter ?? props.slots?.['footer'])?.()}
        </div>}</div>

      
      {!!(atActions()) && <div data-command-palette-menu="" data-testid="command-palette-actions-menu" className={"rozie-command-palette-actions-menu"} role="menu" aria-label={rozieAttr(actionAnchor ? actionAnchor.label : undefined)} style={parseInlineStyle('top:' + actionMenuTop + 'px')} onKeyDown={($event) => { onActionMenuKeydown($event); }} data-rozie-s-768cad96="">
        {(actionAnchor ? actionAnchor.actions : []).map((action, ai) => <div key={action.id} className={clsx("rozie-command-palette-actions-menu-item", { "rozie-command-palette-actions-menu-item--active": ai === actionIndex, "rozie-command-palette-actions-menu-item--disabled": !!action.disabled })} role="menuitem" data-testid="command-palette-action-item" aria-disabled={!!action.disabled} tabIndex={-1} onMouseEnter={($event) => { setActionIndex(Number(ai)); }} onMouseDown={($event) => { $event.preventDefault(); selectAction(action); }} data-rozie-s-768cad96="">
          {(props.renderActionItem ?? props.slots?.['actionItem']) ? ((props.renderActionItem ?? props.slots?.['actionItem']) as Function)({ action, item: actionAnchor ? actionAnchor.item : null, active: ai === actionIndex, disabled: !!action.disabled }) : <>{!!(actionIcon(action)) && <span className={"rozie-command-palette-actions-menu-item-icon"} data-rozie-s-768cad96="">{rozieDisplay(actionIcon(action))}</span>}<span className={"rozie-command-palette-actions-menu-item-label"} data-rozie-s-768cad96="">{rozieDisplay(actionLabel(action))}</span>{!!(actionShortcut(action)) && <span className={"rozie-command-palette-actions-menu-item-shortcut"} data-rozie-s-768cad96="">{rozieDisplay(actionShortcut(action))}</span>}</>}
        </div>)}
      </div>}</div>
    </div>); })())}</>
  );
});
export default CommandPalette;
