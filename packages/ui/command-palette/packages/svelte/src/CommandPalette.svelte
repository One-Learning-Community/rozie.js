<script lang="ts">
import Combobox from '@rozie-ui/combobox-svelte';
import { rozieAttr, rozieDisplay, rozieStyle } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onDestroy, onMount, untrack } from 'svelte';

interface Props {
  /**
   * Whether the palette overlay is shown (two-way `r-model`). Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`); every close path (backdrop click, Escape, selecting an item when `closeOnSelect`, the imperative `close()`) writes `open = false`. As one of two `model: true` props the component does not generate an Angular `ControlValueAccessor`.
   * @example
   * <CommandPalette r-model:open="paletteOpen" :items="commands" />
   */
  open?: boolean;
  /**
   * The current search text (two-way `r-model`). Two-way bind it to read the query, or pre-seed it by setting a value alongside `open` — an open no longer clears it, so the palette opens filtered to that query. The component ranks `items` by this string via `score` (fuzzy-subsequence by default, matched over each item `label` plus its `keywords`, label weighted above keywords). Reset to `""` when the palette closes, so each plain open starts with a fresh search box.
   */
  query?: string;
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
   * Pass-through to the vendored combobox's `groupCap`: cap each command section to its first `groupCap` results with an expand-in-place '+N more' row. `0`/absent = uncapped (default). Note: the ⌘K/Right-arrow row action menu resolves the highlighted row by section index, which assumes the uncapped section order — combining `groupCap` with per-row `actions` is not composed in this pass.
   */
  groupCap?: number;
  breadcrumb?: Snippet<[{ stack: any; back: any }]>;
  option?: Snippet<[{ option: any; index: any; active: any; selected: any; disabled: any; matches: any }]>;
  groupHeading?: Snippet<[{ group: any }]>;
  empty?: Snippet<[{ query: any }]>;
  loading?: Snippet<[{ query: any }]>;
  error?: Snippet<[{ query: any; error: any; retry: any }]>;
  footer?: Snippet;
  actionItem?: Snippet<[{ action: any; item: any; active: any; disabled: any }]>;
  icon?: Snippet<[{ option: any }]>;
  actions?: Snippet<[{ option: any; actions: any }]>;
  trailing?: Snippet<[{ option: any }]>;
  snippets?: Record<string, any>;
  onnavigate?: (...args: unknown[]) => void;
  onback?: (...args: unknown[]) => void;
  onselect?: (...args: unknown[]) => void;
  onactionselect?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultItems = (() => [])();
let __defaultDefaultItems = (() => [])();

let {
  open = $bindable(false),
  query = $bindable(''),
  score = null,
  items = __defaultItems,
  defaultItems = __defaultDefaultItems,
  placeholder = 'Type a command…',
  emptyText = 'No results.',
  closeOnSelect = true,
  ariaLabel = 'Command palette',
  idBase = 'rozie-command-palette',
  searchDebounce = 150,
  actionKey = '$mod+k',
  closeOnAction = true,
  groupCap = 0,
  breadcrumb: __breadcrumbProp,
  option: __optionProp,
  groupHeading: __groupHeadingProp,
  empty: __emptyProp,
  loading: __loadingProp,
  error: __errorProp,
  footer: __footerProp,
  actionItem: __actionItemProp,
  icon: __iconProp,
  actions: __actionsProp,
  trailing: __trailingProp,
  snippets,
  onnavigate,
  onback,
  onselect,
  onactionselect,
  ...__rozieAttrs
}: Props = $props();

const breadcrumb = $derived(__breadcrumbProp ?? snippets?.breadcrumb);
const option$$slot = $derived(__optionProp ?? snippets?.option);
const groupHeading$$slot = $derived(__groupHeadingProp ?? snippets?.groupHeading);
const empty$$slot = $derived(__emptyProp ?? snippets?.empty);
const loading = $derived(__loadingProp ?? snippets?.loading);
const error = $derived(__errorProp ?? snippets?.error);
const footer = $derived(__footerProp ?? snippets?.footer);
const actionItem = $derived(__actionItemProp ?? snippets?.actionItem);
const icon = $derived(__iconProp ?? snippets?.icon);
const actions = $derived(__actionsProp ?? snippets?.actions);
const trailing = $derived(__trailingProp ?? snippets?.trailing);

let activeValue: any = $state(null);
let levelStack: any[] = $state([]);
let activeSurface = $state('list');
let actionIndex = $state(-1);
let actionAnchor: any = $state(null);
let actionMenuTop = $state(0);

let frame = $state<HTMLElement | undefined>(undefined);
let panel = $state<HTMLElement | undefined>(undefined);
let combobox = $state<ReturnType<typeof Combobox> | undefined>(undefined);

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
let requestToken = 0;
let debounceTimerId: any = null;
// ---- level-stack derived views (plain functions, uniform ×6) -----------
// currentItems(): the ACTIVE level's items fed to the vendored <Combobox>.
// While the active level is 'loading' or 'error' this returns [] so combobox's
// own empty region shows (its #empty is the natural host for the re-projected
// #loading/#error status slots — combobox exposes no loading/error slot of its
// own). Otherwise the top frame's resolvedItems (nested) or the root
// $props.items. Levels sit ABOVE the pipeline: currentItems() → scoreCommands
// (below) → <Combobox>.
const currentItems = () => {
  const frame = currentFrame(levelStack);
  if (frame) {
    if (frame.status === 'loading' || frame.status === 'error') return [];
    return frame.resolvedItems;
  }
  return items;
};
// currentDefaultItems() (command-palette-13-empty-home-view-first): the
// ACTIVE level's empty/home-view items — the top frame's `defaultItems`
// (captured at push time by pushFrame from the navigating item's own
// `defaultItems` field) when nested, else the root `defaultItems` prop.
const currentDefaultItems = () => {
  const frame = currentFrame(levelStack);
  return frame ? frame.defaultItems : defaultItems;
};
// currentBaseItems(): the pre-scoring source fed to filteredItems() below.
// An EMPTY (trimmed) query with a non-empty currentDefaultItems() returns
// the home view (author order — never reaches the scorer, per scoreCommands'
// empty-query short-circuit); otherwise falls through to currentItems() —
// today's behavior, unchanged when no defaultItems is set.
const currentBaseItems = () => {
  const q = String(query == null ? '' : query).trim();
  const defaults = currentDefaultItems();
  if (q === '' && Array.isArray(defaults) && defaults.length > 0) return defaults;
  return currentItems();
};
// currentDepth(): the nesting depth (0 = root). Named to avoid shadowing the
// imported levelStack `depth` helper (aliased `levelDepth` above).
const currentDepth = () => levelDepth(levelStack);
// currentStatus()/currentError(): the active level's async status (LVL-ASYNC)
// off the top frame — 'ready' at root (the implicit root frame is never
// loading/error). Drive the #loading/#error re-projection inside combobox's
// #empty slot (below).
const currentStatus = () => {
  const frame = currentFrame(levelStack);
  return frame ? frame.status : 'ready';
};
const currentError = () => {
  const frame = currentFrame(levelStack);
  return frame ? frame.error : null;
};
// atDepth(): true when nested (depth>0) — gates the breadcrumb/back header
// (LVL-RENDER). A plain function — never $computed.
const atDepth = () => currentDepth() > 0;
// atActions(): true while the action menu owns the keyboard (ACT-SEAM). Gates
// the flyout r-if AND the combobox keepOpen consumption — a plain function,
// never $computed.
const atActions = () => activeSurface === 'actions';
// currentTitle(): the breadcrumb/header label for the active level — the top
// frame's `title` (already item.title ?? item.label, captured by pushFrame
// via levelTitle at push time). Falls back to `ariaLabel` at root (atDepth()
// gates the header off at root anyway, but keeps this total).
const currentTitle = () => {
  const frame = currentFrame(levelStack);
  return frame && frame.title != null ? frame.title : ariaLabel;
};
// currentPlaceholder(): the active level's input placeholder — the top
// frame's `placeholder` (item.placeholder, captured at push time) falling
// back to the component-level `placeholder` prop. Bound to the vendored
// <Combobox>'s :placeholder so a navigating item's `placeholder` drives its
// child level's input placeholder.
const currentPlaceholder = () => {
  const frame = currentFrame(levelStack);
  return frame && frame.placeholder != null ? frame.placeholder : placeholder;
};
// breadcrumbStack(): the full root..current breadcrumb (internal/levelStack.ts
// breadcrumb(), imported aliased `buildBreadcrumb` — the SVELTE EMITTER
// generates a local snippet binding named after the `breadcrumb` SLOT itself,
// which collides with a same-named top-level import on that one target only
// (a "slot-name == script-identifier" collision, adjacent to the
// slot==prop-name ROZ127 class but not caught by it since `breadcrumb` isn't
// a prop) — aliasing the import sidesteps it without renaming the public
// slot) fed to the #breadcrumb slot's `stack` scope param — the root entry's
// title is `ariaLabel` (the palette's own accessible name doubles as the
// root breadcrumb label; there is no separate "root title" prop).
const breadcrumbStack = () => buildBreadcrumb(levelStack, ariaLabel);
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
// Levels sit ABOVE the pipeline (LVL-STACK) — currentItems() resolves the
// active level's list (root or the top pushed frame) BEFORE ranking.
// currentBaseItems() (command-palette-13-empty-home-view-first) additionally
// swaps in the active level's `defaultItems` on an empty query — scoring's
// own empty-query short-circuit (scoreCommands.ts) then preserves author
// order for free, so a non-empty query still ranks currentItems() exactly
// as before (defaultItems is never scored/reordered).
const filteredItems = () => scoreCommands(currentBaseItems(), query, score);
// ---- native combobox groups (cp-adopts-combobox-groups) -----------------
// groupedView(): derives `{ groups, ordered }` off filteredItems() via the
// pure commandGroups.ts helper (mirrors combobox groupOptions() exactly —
// see that file's header). orderedItems()/commandGroups() split the result
// for the two template bindings below; grouped() gates the per-row badge.
// Plain functions (never $computed — the combobox value-vs-accessor split).
const groupedView = () => deriveCommandGroups(filteredItems());
const orderedItems = () => groupedView().ordered;
const commandGroups = () => groupedView().groups;
const grouped = () => commandGroups().length > 0;
// groupLabel(): UNTYPED display resolver for the re-projected #groupHeading
// scope param — `group` threads as `unknown` on the Lit leaf (the same
// cross-target slot-param-type gap as labelText/groupText/actionLabel
// above), so the default fill reads `.label` through this rather than
// `group.label` directly.
const groupLabel = (g: any) => g && g.label !== undefined ? g.label : '';
// The vendored <Combobox> commits the OPTION's value; resolve each command's value
// to its stable `id` (the key passed back on `select`). disabled is resolved off
// the item's own `disabled` flag (combobox's default `.disabled` fallback already
// handles it, but we pass an explicit resolver for clarity + safety on primitives).
const commandValue = (it: any) => it && it.id !== undefined ? it.id : it;
const commandDisabled = (it: any) => !!(it && it.disabled);
// Default-fill display helpers. The re-projected #option scope param `option`
// threads as `unknown` on the Lit leaf (the cross-target slot-param-type gap), so
// the default fill content reads its label/group through these UNTYPED helpers
// (neutralized to `any`) rather than `option.label` directly — keeps the Lit leaf
// typechecking without a per-target cast.
const labelText = (o: any) => o && o.label !== undefined ? o.label : '';
const groupText = (o: any) => o && o.group !== undefined ? o.group : '';
// Display-only #actions scope resolver: the optional `actions` item field,
// normalized to an array. Untyped param (neutralized to `any`) like the other
// display helpers above — same cross-target slot-param-type gap.
const actionsList = (o: any) => o && o.actions ? o.actions : [];
// hotKeyOf(): the optional per-item `hotKey?: string` display-only teaching
// field — resolved off the re-projected #option scope param (untyped, same
// cross-target slot-param-type gap as the other display helpers above). The
// palette NEVER binds or listens for this key; it is rendered through
// formatKeyToken() below as a right-aligned badge, purely advertising an
// app-global shortcut the CONSUMER owns (Copy `$mod+c`, Print `$mod+p`).
const hotKeyOf = (o: any) => o && o.hotKey ? o.hotKey : '';
// Untyped #actionItem display resolvers (ACT-RENDER) — the re-projected
// `action` scope param threads as `unknown` on the Lit leaf (the same
// cross-target slot-param-type gap as labelText/groupText/actionsList
// above), so the default fill reads label/shortcut/icon through these
// rather than `action.label` directly.
const actionLabel = (a: any) => a && a.label !== undefined ? a.label : '';
const actionShortcut = (a: any) => a && a.shortcut !== undefined ? a.shortcut : undefined;
const actionIcon = (a: any) => a && a.icon !== undefined ? a.icon : undefined;
// Platform sniff for the DISPLAY of the `$mod` token only — matching is
// platform-agnostic (`metaKey || ctrlKey`, see matchesActionKey). SSR-guarded
// like every other browser-global read; defaults to the non-Apple form.
const isApplePlatform = () => {
  if (typeof navigator === 'undefined') return false;
  const p = (navigator.platform || '') + ' ' + (navigator.userAgent || '');
  return /Mac|iPhone|iPad|iPod/.test(p);
};
// actionKeyHint(): a short display string for the actionKey prop, for the
// #actions row affordance's default (unfilled) hint — "$mod+k" → "⌘K" on
// Apple platforms / "Ctrl+K" elsewhere; delegates the full modifier grammar
// onto the shared formatKeyToken() helper (also used by the per-item hotKey
// badge below) — see internal/formatKeyToken.ts for the grammar. Keeps the
// existing typeof guard; '$mod+k' stays byte-identical (⌘K / Ctrl+K).
const actionKeyHint = () => {
  const k = actionKey;
  if (typeof k !== 'string') return '';
  return formatKeyToken(k, isApplePlatform());
};
// Split a command's visible label into ordered { text, match } segments from
// labelHighlight's [start,end) ranges, for the default #option fill row to
// render as highlighted runs. Reflects the query-subsequence on the LABEL
// regardless of which scorer produced the ranking (labelHighlight runs the
// same fuzzyMatch primitive independent of $props.score). Untyped param
// (neutralized to `any`) like the other display helpers above.
const labelSegments = (o: any) => {
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
};
// ---- close funnel ------------------------------------------------------
const closePalette = () => {
  open = false;
};
// ---- async source loading (LVL-ASYNC, absorbs #4) ----------------------
// Apply an already-resolving promise's outcome to the TOP frame, guarded by
// the race-drop token (T-cpl-01): `token` was captured by the CALLER at the
// moment the fetch was kicked off; if a newer token has since been issued
// (a push/pop/search/close superseded this in-flight call) the resolution is
// dropped — settleFrame/failFrame no-op on drop. Runs in a `.then` MICROTASK,
// so by the time it writes $data.levelStack the caller's own synchronous
// pushFrame setState has already flushed (React) → it reads the FRESH stack.
// `requestToken` is a module-level `let` (script top), so the comparison is
// synchronous + current across the await on every target.
const applyAsyncResult = (token: any, promise: any) => {
  return promise.then((items: any) => {
    if (!isLatestRequest(token, requestToken)) return;
    levelStack = settleFrame(levelStack, Array.isArray(items) ? items : []);
  }, (error: any) => {
    if (!isLatestRequest(token, requestToken)) return;
    levelStack = failFrame(levelStack, error);
  });
};
// Kick off (but do not await) an async level's initial/refetch load. A
// `children` level is already seeded ready by pushFrame and never reaches
// here; a `source` returning a Promise bumps + captures a fresh token then
// settles in a microtask; a `source` returning a sync array settles in a
// microtask too (deferred so React's pushFrame setState flushes first —
// settleFrame reads $data.levelStack). The #error slot's `retry` reuses this.
const beginLevelLoad = (item: any, query: any) => {
  const resolved = resolveChildSource(item, query);
  if (resolved.kind === 'async') {
    requestToken = nextRequestToken(requestToken);
    applyAsyncResult(requestToken, resolved.promise);
    return;
  }
  if (resolved.kind === 'sync') {
    const items = resolved.items;
    Promise.resolve().then(() => {
      levelStack = settleFrame(levelStack, items);
    });
  }
};
// Re-invoke the CURRENT level's source at the current query (the #error
// slot's `retry` — T-cpl-04 mitigation: an error leaves the input usable,
// retry on next keystroke OR this explicit retry).
const retryCurrentLevel = () => {
  const frame = currentFrame(levelStack);
  if (!frame || !frame.item || !isAsyncLevel(frame.item)) return;
  beginLevelLoad(frame.item, query);
};
// ---- level navigation (LVL-STACK, LVL-QUERY, LVL-NAV) -------------------
// Push a child level for a NAVIGATING item (isNavigating — a `children`
// array or a `source` function). pushFrame snapshots the CURRENT query into
// the new frame's parentQuery (restored on pop, below); the child level then
// starts with a cleared query + a cleared combobox input. A `children` level
// is seeded ready by pushFrame; a `source` level lands 'loading' and
// beginLevelLoad resolves it at query='' (empty-vs-search #8 falls out for
// free — a `source` branches on query==='' for its default view).
// The navigate `depth` reads the FRESH `nextStack` LOCAL, never
// currentDepth() — re-reading $data.levelStack right after writing it binds
// the pre-write (0) value on React (setState is async).
const pushLevel = (item: any) => {
  // Level nav always resets to the list surface (spec §Composition) — a
  // navigating item's own action menu, if somehow open, must not survive
  // the push.
  if (activeSurface !== 'list') closeActionMenu();
  const nextStack = pushFrame(levelStack, item, query);
  levelStack = nextStack;
  query = '';
  activeValue = null;
  combobox?.clear();
  focusInput();
  onnavigate?.({
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
};
// Pop one level: popFrame() → restore the query MODEL AND the vendored
// <Combobox>'s VISIBLE input text via seedQuery(restoreQuery) (Option B — the
// combobox seedQuery prerequisite) — full query undo, not just the
// model/list. Bumps the request token so any in-flight source resolution for
// the popped level is dropped. reopenComboboxPopup() re-opens the combobox
// popup (Escape closed it on the shared bubble through the combobox — see
// onPanelKeydown) so the restored parent level's list is visible. No-op at
// root (an empty levelStack — mirrors the spec's "back() — no-op at root").
export const goBack = () => {
  if (levelStack.length === 0) return;
  // Level nav always resets to the list surface (spec §Composition) — pop
  // closes an open action menu FIRST.
  if (activeSurface !== 'list') closeActionMenu();
  const {
    stack,
    restoreQuery
  } = popFrame(levelStack);
  levelStack = stack;
  requestToken = nextRequestToken(requestToken);
  const q = restoreQuery == null ? '' : restoreQuery;
  query = q;
  combobox?.seedQuery(q);
  activeValue = null;
  reopenComboboxPopup();
  onback?.();
};
// openTo(path): the ⌘P deep-link (LVL-RENDER, LVL-STACK) — opens the palette,
// resets to root, then drills through `path` (an array of item ids) one hop
// at a time: resolve the CURRENT level's items, find the item whose `id`
// matches the next path segment, push it, and — async-aware — AWAIT its
// source settling before resolving the NEXT hop (a child level's items must
// be settled before an id can be looked up in it). Threads the stack as a
// LOCAL (`stack`) rather than re-reading $data.levelStack between hops (the
// React setState-is-async stale-read); the $data.levelStack writes are for
// render reactivity. Stops silently (safe no-op on the unresolved remainder)
// at the first id that doesn't match anything in the current level.
export const openTo = async (path: any) => {
  open = true;
  let stack = [];
  levelStack = stack;
  query = '';
  const ids = Array.isArray(path) ? path : [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const list = stack.length === 0 ? items : stack[stack.length - 1].resolvedItems;
    const item = Array.isArray(list) ? list.find((it: any) => it && it.id === id) : null;
    if (!item) break;
    stack = pushFrame(stack, item, '');
    levelStack = stack;
    const resolved = resolveChildSource(item, '');
    if (resolved.kind === 'async') {
      requestToken = nextRequestToken(requestToken);
      const token = requestToken;
      try {
        const items = await resolved.promise;
        if (isLatestRequest(token, requestToken)) {
          stack = settleFrame(stack, Array.isArray(items) ? items : []);
          levelStack = stack;
        }
      } catch (error: any) {
        if (isLatestRequest(token, requestToken)) {
          stack = failFrame(stack, error);
          levelStack = stack;
        }
      }
    } else if (resolved.kind === 'sync') {
      stack = settleFrame(stack, resolved.items);
      levelStack = stack;
    }
  }
  activeValue = null;
  // Defer the combobox ref touch a frame (the onOpen() precedent) — openTo
  // may have just flipped `open` false→true in THIS call, so the overlay +
  // <Combobox> may not be mounted yet on every target when the drill loop's
  // awaits resolve.
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      combobox?.clear();
      focusInput();
    });
  } else {
    combobox?.clear();
    focusInput();
  }
};
// ---- selection ---------------------------------------------------------
// Combobox's `@change` fires `{ value, option }` on each commit. A NAVIGATING
// item (isNavigating — children/source) is intercepted here and PUSHES a
// child level instead of emitting `select` (presence of children/source is
// the navigation signal, no separate flag). Otherwise re-emit the PUBLIC
// `select` event as `{ item, path }` — `item` is the FULL original command
// object (the `option` IS the original command item, since we feed items
// straight through as combobox options — no id/label/group projection) and
// `path` is the id breadcrumb of levels navigated through to reach it
// (levelStack item ids, root excluded — root carries no item). This mirrors
// `navigate`'s `{ item, depth }` shape.
const onComboboxChange = (e: any) => {
  const item = e ? e.option : null;
  if (!item || item.disabled) return;
  if (isNavigating(item)) {
    pushLevel(item);
    return;
  }
  const path = levelStack.map((f: any) => f.item ? f.item.id : null);
  onselect?.({
    item,
    path
  });
  // Clear the internal selection so re-selecting the same command re-fires.
  activeValue = null;
  if (closeOnSelect) closePalette();
};
// Combobox's `@search` fires `{ query }` as the user types in its combobox input.
// Pipe it into command-palette's own two-way `query` model — `filteredItems()`
// then re-ranks via scoreCommands (keyword-aware, fuzzy). Capture the fresh value
// (never re-read a just-written $data/$model key on React — it is stale).
//
// At an ASYNC level (LVL-ASYNC), ALSO bump + capture a fresh request token
// immediately (dropping any earlier in-flight resolution, T-cpl-01) and
// schedule a DEBOUNCED (searchDebounce, T-cpl-02) source(query) refetch — the
// consumer source() function itself is only invoked once the debounce timer
// fires, never eagerly. A sync (root/children) level needs no refetch —
// filteredItems() already re-ranks currentItems() locally on every keystroke.
const onComboboxSearch = (e: any) => {
  const q = e && e.query !== undefined ? e.query : '';
  query = q;
  const frame = currentFrame(levelStack);
  if (!frame || !isAsyncLevel(frame.item)) return;
  // command-palette-13-empty-home-view-first: clearing back to '' on a level
  // that carries defaultItems must NOT refetch (no source('') call) and must
  // NOT let a late in-flight source result stomp the restored home view —
  // bump the token (drops any in-flight resolution), clear any pending
  // debounce timer, and return. currentBaseItems() already swaps back to
  // the frame's defaultItems on the next render via filteredItems().
  if (q === '' && levelDefaultItems(frame.item).length > 0) {
    requestToken = nextRequestToken(requestToken);
    if (debounceTimerId != null) clearTimeout(debounceTimerId);
    debounceTimerId = null;
    return;
  }
  requestToken = nextRequestToken(requestToken);
  const token = requestToken;
  const item = frame.item;
  if (debounceTimerId != null) clearTimeout(debounceTimerId);
  debounceTimerId = setTimeout(() => {
    const resolved = resolveChildSource(item, q);
    if (resolved.kind === 'sync') {
      if (isLatestRequest(token, requestToken)) {
        levelStack = settleFrame(levelStack, resolved.items);
      }
      return;
    }
    if (resolved.kind === 'async') applyAsyncResult(token, resolved.promise);
  }, searchDebounce);
};
// Backdrop click: a click whose target IS the backdrop (not the panel/children).
const onBackdropClick = (e: any) => {
  if (e && e.target === e.currentTarget) closePalette();
};
// ---- open/close reconcile ----------------------------------------------
// Focus the vendored <Combobox>'s search <input> via its exposed `focus` handle
// verb (Combobox.rozie:578 `$expose({ focus, clear })`). Focusing it fires the
// combobox's `@focus="open"` → the popup opens (the screenshot demo seeds the
// palette open, so this runs on mount). `$refs.combobox` is the composed child's
// TYPED handle across all 6 targets (Phase 66 composed-component-ref → handle
// typing), so `focus()` typechecks and resolves to the child's exposed verb —
// including on Lit, where this RETIRES the former `<rozie-combobox>` open-shadow-
// root DOM pierce that only existed because the composed ref used to type as a
// bare HTMLElement.
// $refs read in a post-mount callback only (ROZ123-safe).
const focusInput = () => {
  combobox?.focus();
};
// Shadow-aware deepest active element (walks open shadow roots) — so the
// blur/refocus reopen below works through Lit's shadow boundary (where
// document.activeElement resolves only to the outermost host).
const deepActiveElement = () => {
  let node = typeof document !== 'undefined' ? document.activeElement : null;
  while (node && node.shadowRoot && node.shadowRoot.activeElement) {
    node = node.shadowRoot.activeElement;
  }
  return node;
};
// Re-open the vendored combobox popup after a level pop (LVL-NAV). The combobox
// opens its popup on the input's `@focus`, but a plain focus() on an
// ALREADY-focused input fires no `@focus` — and Escape leaves the input focused
// while closing the popup (Combobox.rozie onKeydown → isOpen=false). So BLUR the
// deepest focused element first (which also runs combobox's `@blur` → isOpen
// stays false), then re-focus on the next frame so `@focus` fires and re-opens
// the popup showing the restored parent level. For a Backspace pop (popup never
// closed) this is a harmless close→reopen cycle.
const reopenComboboxPopup = () => {
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
};
// ---- action menu (ACT-SEAM/ACT-ARBITRATION/ACT-TRIGGER/ACT-KEEPOPEN) ---
// The single reusable seam: open a focus-owning sub-surface over the list,
// route Escape back to it, restore focus + reopen the list on close. Written
// once (activeSurface: 'list' | 'actions') so #12 (inline command arguments)
// reuses the identical transition shape for a future 'args' surface.
//
// $refs/$el usage note: bindings below use `$refs.panel` (the modal panel
// div's existing `ref="panel"`), NOT the `$el` sigil — a directly-typed bare
// assignment of `$el`/`$refs.<name>` (`const root: any = $el`, or even
// `const panel: any = $refs.panel`) compiles to a LITERAL, un-lowered
// `$refs.__rozieRoot` (or `$refs.panel`) on the Svelte target — a real
// Svelte-only emitter gap where the `: any` type annotation on the bare
// `$el`/`$refs.X` declarator suppresses the deconflict/lowering pass that
// otherwise correctly rewrites `const panel = $refs.panel` (UNTYPED) to
// Svelte's real `panel$local` binding (`deconflictAccessorShadows`, the
// same-name-as-accessor self-shadow guard — proven ×N in date-picker/
// dialog/pagination/tags/otp/resizable, none of which type-annotate the
// bare assignment). Workaround (source-only, not an emitter edit): keep the
// `$refs.panel` assignment BARE/untyped; only the DOWNSTREAM `.querySelector`
// RESULT gets `: any` (a separate declarator, unaffected by the gap).

// deepQuerySelector(root, selector): a shadow-piercing querySelector — the
// vendored <Combobox> renders its OWN internal shadow root on the Lit
// target, so a query rooted at `$refs.panel` (a light-DOM ancestor OUTSIDE
// that boundary) cannot reach `.rozie-combobox-option--active` /
// `input[role="combobox"]` via a plain `.querySelector` (it never pierces
// shadow roots) — it silently returns null there ONLY (menu never opens on
// Lit, the confirmed live-browser gap; the other 5 targets render combobox
// inline so a plain query already reaches it, which is why this only shows
// up under the REAL Lit custom-element build, never under compile()x6).
// Mirrors the existing `deepActiveElement` shadow-walk already in this file.
// Direct match first (the fast path, and what the other 5 targets hit
// immediately); falls back to recursing into every descendant's
// `.shadowRoot` only when nothing matched directly.
const deepQuerySelector = (root: any, selector: any) => {
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
};
// highlightedItem(): resolve the combobox's currently-highlighted row back to
// its command object. Combobox owns `activeIndex` internally (no public model
// for it), so this reads the ACTIVE option element's id — `idBase + '-opt-' +
// i`, where `i` is its position in orderedItems() (the group-visual-order
// list combobox was fed as `:options` — cp-adopts-combobox-groups: the
// combobox's own internal `groupOptions()` re-partition of an
// already-group-ordered list is idempotent, so its index-based option ids
// stay aligned with this same order) — off the DOM, via `deepQuerySelector`
// (ROZ123-safe: called only from post-mount handlers, never eagerly).
// Returns null when nothing is highlighted or the id can't be parsed.
const highlightedItem = () => {
  const panel$local = panel;
  if (!panel$local) return null;
  const activeEl: any = deepQuerySelector(panel$local, '.rozie-combobox-option--active');
  if (!activeEl) return null;
  const prefix = idBase + '-opt-';
  const id = String(activeEl.id || activeEl.getAttribute('id') || '');
  if (id.indexOf(prefix) !== 0) return null;
  const idx = parseInt(id.slice(prefix.length), 10);
  if (Number.isNaN(idx)) return null;
  const list = orderedItems();
  return idx >= 0 && idx < list.length ? list[idx] : null;
};
// searchInputEl(): the vendored combobox's underlying `<input role="combobox">`
// — needed for the caret-at-end Right-arrow trigger gate (selectionStart/End
// are not surfaced through the child's $expose handle). deepQuerySelector,
// ROZ123-safe (called only from the post-mount panel keydown handler).
const searchInputEl = () => {
  const panel$local = panel;
  return panel$local ? deepQuerySelector(panel$local, 'input[role="combobox"]') : null;
};
// focusFirstMenuItem(): move real DOM focus into the first enabled menuitem —
// the ACT-ARBITRATION "real focus" guarantee. Deferred a frame by the caller
// (openActionMenu) so the flyout has mounted first. The flyout is now a
// FRAME child (sibling of the panel, finding 1), so this queries
// `$refs.frame` — a light-DOM ancestor sharing the palette's OWN shadow
// root as the flyout (no nested shadow between frame and flyout), so a
// plain `querySelector` resolves it on all six.
const focusFirstMenuItem = () => {
  const frame$local = frame;
  if (!frame$local) return;
  const el: any = frame$local.querySelector('[data-command-palette-menu] [role="menuitem"]:not([aria-disabled="true"])');
  if (el && typeof el.focus === 'function') el.focus();
};
// openActionMenu(item): guarded no-op unless canOpenActions(item). Anchors
// the item + its resolved actions, lands actionIndex on the first ENABLED
// action, reads the flyout's vertical offset off the highlighted row's
// offsetTop, tells the vendored combobox to keepOpen (ACT-KEEPOPEN —
// pinOpen(true), so blurring the input into the flyout does not collapse the
// list), then moves real focus into the first enabled menuitem next frame.
const openActionMenu = (item: any) => {
  if (!canOpenActions(item)) return;
  const actions = actionsOf(item);
  // The flyout's `:aria-label` reads `$data.actionAnchor.label` (a plain
  // PROPERTY read, computed here in script) rather than calling
  // `labelText(item)` directly from the template attribute binding — a bare
  // top-level-helper CALL inside a plain (non-slot-scoped) `:attr` binding
  // throws `labelText is not defined` on the Angular target specifically
  // (the emitter's `this.`-qualification pass doesn't reach that binding
  // shape) — a source-level workaround, not an emitter change.
  actionAnchor = {
    item,
    actions,
    label: labelText(item)
  };
  actionIndex = firstEnabledActionIndex(actions);
  activeSurface = 'actions';
  const panel$local = panel;
  const frame$local = frame;
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
  actionMenuTop = activeRow && frame$local ? activeRow.getBoundingClientRect().top - frame$local.getBoundingClientRect().top + frame$local.scrollTop : 0;
  combobox?.pinOpen(true);
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
        if (actionMenuTop > maxTop) actionMenuTop = maxTop;
      }
    });
  } else {
    focusFirstMenuItem();
  }
};
// closeActionMenu(): the focus-restore invariant — ALWAYS returns to the
// list surface, releases keepOpen (pinOpen(false)), and reopens the combobox
// popup with focus back on the search input (reopenComboboxPopup — the
// existing level-pop blur/refocus primitive, reused verbatim here).
const closeActionMenu = () => {
  activeSurface = 'list';
  actionIndex = -1;
  actionAnchor = null;
  combobox?.pinOpen(false);
  reopenComboboxPopup();
};
// roveAction(dir): disabled-skip clamped roving (internal/actionMenu.ts
// rovingActionIndex — the combobox nextEnabled convention) over the anchored
// item's actions, then moves real focus to the new index's menuitem.
const roveAction = (dir: any) => {
  const anchor = actionAnchor;
  if (!anchor) return;
  const idx = rovingActionIndex(anchor.actions, actionIndex, dir);
  actionIndex = idx;
  // Re-rooted to $refs.frame (finding 1) — the flyout moved out of the
  // panel to be a frame child; see focusFirstMenuItem's comment.
  const frame$local = frame;
  if (!frame$local) return;
  const items: any = frame$local.querySelectorAll('[data-command-palette-menu] [role="menuitem"]');
  const el: any = items[idx];
  if (el && typeof el.focus === 'function') el.focus();
};
// selectAction(action): a disabled action is a no-op. Captures the anchored
// item into a LOCAL first (React stale-read guard — closeActionMenu clears
// $data.actionAnchor right after), fires the public `action-select` event,
// ALWAYS closes the menu, then closes the palette too IFF closeOnAction.
const selectAction = (action: any) => {
  if (!action || action.disabled) return;
  const anchor = actionAnchor;
  const item = anchor ? anchor.item : null;
  onactionselect?.({
    item,
    action
  });
  closeActionMenu();
  if (closeOnAction) closePalette();
};
// onActionMenuKeydown(e): the flyout's OWN keydown — focus is inside the
// menu while this fires, so the vendored combobox never sees these keys.
// Escape is DELIBERATELY not handled here — it bubbles up to onPanelKeydown's
// single Escape funnel below. Every other handled key stops propagation so a
// stale-but-now-'list'-surface bubble (e.g. the actionKey toggle-close,
// which flips activeSurface to 'list' BEFORE the event finishes bubbling)
// can't be re-interpreted as a fresh open-menu trigger by onPanelKeydown.
const onActionMenuKeydown = (e: any) => {
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
  if (matchesActionKey(e, actionKey)) {
    e.preventDefault();
    e.stopPropagation();
    closeActionMenu();
  }
};
// On open: clear the internal selection, then focus the search input. The query
// is NOT reset here — that would clobber a pre-seeded / `r-model`-bound query.
// The reset happens on the close transition (the $watch else-branch below), so a
// value set alongside `open` is honored and each plain open still starts fresh
// (the query was cleared at the prior close).
// Runs from $onMount and the lazy open $watch callback, both post-mount.
const onOpen = () => {
  activeValue = null;
  // Defer a tick so the overlay + <Combobox> are mounted before focusing.
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      focusInput();
    });
  } else {
    focusInput();
  }
};

// ---- lifecycle ---------------------------------------------------------
// Bubble-phase panel keydown (LVL-NAV, ACT-ARBITRATION, ACT-TRIGGER):
//   - Escape: routed through resolveEscape(activeSurface, currentDepth()) —
//     the SINGLE precedence oracle (menu-close > level-pop > palette-close-
//     at-root). A sub-surface open (activeSurface!=='list') ALWAYS wins —
//     closeActionMenu() and STOP; only once the menu is closed does Escape
//     fall through to level-pop or root-close on a LATER keypress. The
//     vendored <Combobox> (a child) sees the Escape FIRST on the bubble path
//     and closes its OWN popup (Combobox.rozie onKeydown → isOpen=false);
//     goBack()'s reopenComboboxPopup() re-opens it afterward so the restored
//     parent level's list is visible.
//   - actionKey (⌘K) / caret-at-end Right-arrow (ACT-TRIGGER): open the
//     action menu for the highlighted row, but ONLY while activeSurface is
//     'list' (the menu owns these keys itself once open, via
//     onActionMenuKeydown) and the row canOpenActions — a no-op otherwise
//     (an action-less row, or no highlighted row).
//   - Backspace on an empty query at depth>0 → pop one level, but ONLY while
//     activeSurface==='list' (Backspace must never pop a level while the menu
//     owns focus). Backspace does NOT close the combobox popup — its
//     onKeydown ignores it — so the reopen is a harmless no-op cycle there.
//     Otherwise Backspace edits the query text normally (never intercepted
//     at the root or with text in the box).
const onPanelKeydown = (e: any) => {
  if (!e) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    const route = resolveEscape(activeSurface, currentDepth());
    if (route === 'close-surface') closeActionMenu();else if (route === 'pop-level') goBack();else closePalette();
    return;
  }
  if (activeSurface === 'list') {
    if (matchesActionKey(e, actionKey)) {
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
};
// ---- imperative handle -------------------------------------------------
// show()/close()/toggle() drive the `open` model. The OPEN verb is `show` (NOT
// `open`) — an `open` verb collides with the `open` model on React (both collapse
// onto the generated open/setOpen state). focus() focuses the vendored combobox's
// control via its exposed handle (accepted ROZ137 Lit override). All post-mount →
// $refs safe. The POP verb is `goBack` — NOT `back` (a `back()` expose verb would
// collide with the `@back` EMIT, ROZ121: expose∩emits must be empty). `openTo` is
// the ⌘P deep-link (stubbed above; Task 6 fills the drill-through).
export const show = () => {
  open = true;
};
export const close = () => {
  closePalette();
};
export const toggle = () => {
  open = !open;
};
export const focus = () => focusInput();

onMount(() => {
  if (open) onOpen();
});
onDestroy(() => (() => {
  if (debounceTimerId != null) clearTimeout(debounceTimerId);
})());

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => open)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
  if (isOpen) onOpen();else {
    query = '';
    levelStack = [];
    activeValue = null;
    // Reset the action surface directly (NOT closeActionMenu — the palette is
    // closing, so there is no combobox popup left to reopen/keepOpen-release;
    // a plain reset keeps a reopen starting clean, per spec §Composition).
    activeSurface = 'list';
    actionIndex = -1;
    actionAnchor = null;
    if (debounceTimerId != null) clearTimeout(debounceTimerId);
    debounceTimerId = null;
    requestToken = nextRequestToken(requestToken);
  }
})(__watchVal); }); });
</script>

{#if open}<div class="rozie-command-palette" onclick={($event) => { onBackdropClick($event); }} data-rozie-s-768cad96><div bind:this={frame} class="rozie-command-palette-frame" data-testid="command-palette-frame" onkeydown={($event) => { onPanelKeydown($event); }} data-rozie-s-768cad96><div bind:this={panel} class="rozie-command-palette-panel" role="dialog" aria-modal="true" aria-label={ariaLabel} data-rozie-s-768cad96>{#if atDepth()}<div class="rozie-command-palette-header" data-rozie-s-768cad96>{#if breadcrumb}{@render breadcrumb({ stack: breadcrumbStack(), back: goBack })}{:else}<button type="button" class="rozie-command-palette-back" aria-label="Back" data-testid="command-palette-back" onclick={($event) => { goBack(); }} data-rozie-s-768cad96>‹</button><nav class="rozie-command-palette-breadcrumb-trail" data-testid="command-palette-breadcrumb-trail" aria-label="Breadcrumb" data-rozie-s-768cad96>{#each breadcrumbStack() as entry, ei (ei)}<span class="rozie-command-palette-breadcrumb-item" data-rozie-s-768cad96>{#if Number(ei) > 0}<span class="rozie-command-palette-breadcrumb-separator" aria-hidden="true" data-rozie-s-768cad96>›</span>{/if}<span class={["rozie-command-palette-breadcrumb-segment", { 'rozie-command-palette-breadcrumb-segment--current': Number(ei) === breadcrumbStack().length - 1 }]} data-testid={rozieAttr(Number(ei) === breadcrumbStack().length - 1 ? 'command-palette-title' : null)} data-rozie-s-768cad96>{rozieDisplay(entry.title)}</span></span>{/each}</nav>{/if}</div>{/if}<Combobox bind:this={combobox} inline={true} disableFilter={true} closeOnSelect={false} options={orderedItems()} groups={commandGroups()} groupCap={groupCap} optionValue={commandValue} optionDisabled={commandDisabled} placeholder={currentPlaceholder()} aria-label={ariaLabel} idBase={idBase} bind:value={activeValue} onchange={($event) => { onComboboxChange($event); }} onsearch={($event) => { onComboboxSearch($event); }} data-rozie-s-768cad96>{#snippet option({ option, index, active, selected, disabled })}{#if option$$slot}{@render option$$slot({ option, index, active, selected, disabled, matches: labelHighlight(labelText(option), query) })}{:else}<div class="rozie-command-palette-option" data-rozie-s-768cad96>{#if icon}<span class="rozie-command-palette-option-icon" data-rozie-s-768cad96>{#if icon}{@render icon({ option })}{/if}</span>{/if}<span class="rozie-command-palette-option-main" data-rozie-s-768cad96><span class="rozie-command-palette-option-label" data-rozie-s-768cad96>{#each labelSegments(option) as segment, si (si)}<span class={{ 'rozie-command-palette-option-label-match': segment.match }} data-rozie-s-768cad96>{rozieDisplay(segment.text)}</span>{/each}</span>{#if groupText(option) && !grouped()}<span class="rozie-command-palette-option-group" data-rozie-s-768cad96>{rozieDisplay(groupText(option))}</span>{/if}</span>{#if hotKeyOf(option)}<span class="rozie-command-palette-option-hotkey" aria-hidden="true" data-rozie-s-768cad96>{rozieDisplay(formatKeyToken(hotKeyOf(option), isApplePlatform()))}</span>{/if}{#if actions || actionsList(option).length > 0}<span class="rozie-command-palette-option-actions" data-testid="command-palette-actions-affordance" onmousedown={($event) => { $event.stopPropagation(); openActionMenu(option); }} data-rozie-s-768cad96>{#if actions}{@render actions({ option, actions: actionsList(option) })}{:else}{#if actionsList(option).length > 0}<span class="rozie-command-palette-option-actions-hint" aria-hidden="true" data-rozie-s-768cad96>{rozieDisplay(actionKeyHint())}</span>{/if}{/if}</span>{/if}{#if trailing}<span class="rozie-command-palette-option-trailing" data-rozie-s-768cad96>{#if trailing}{@render trailing({ option })}{/if}</span>{/if}</div>{/if}{/snippet}{#snippet groupHeading({ group })}{#if groupHeading$$slot}{@render groupHeading$$slot({ group })}{:else}{rozieDisplay(groupLabel(group))}{/if}{/snippet}{#snippet empty({ query })}{#if currentStatus() === 'ready'}{#if empty$$slot}{@render empty$$slot({ query })}{:else}{emptyText}{/if}{/if}{/snippet}</Combobox>{#if currentStatus() === 'loading'}<div class="rozie-command-palette-loading" data-rozie-s-768cad96>{#if loading}{@render loading({ query })}{:else}Loading…{/if}</div>{:else if currentStatus() === 'error'}<div class="rozie-command-palette-error" data-rozie-s-768cad96>{@render error?.({ query, error: currentError(), retry: retryCurrentLevel })}</div>{/if}{#if footer}<div class="rozie-command-palette-footer" data-rozie-s-768cad96>{#if footer}{@render footer()}{/if}</div>{/if}</div>{#if atActions()}<div data-command-palette-menu="" data-testid="command-palette-actions-menu" class="rozie-command-palette-actions-menu" role="menu" aria-label={rozieAttr(actionAnchor ? actionAnchor.label : null)} style={rozieStyle('top:' + actionMenuTop + 'px')} onkeydown={($event) => { onActionMenuKeydown($event); }} data-rozie-s-768cad96>{#each actionAnchor ? actionAnchor.actions : [] as action, ai (action.id)}<div class={["rozie-command-palette-actions-menu-item", { 'rozie-command-palette-actions-menu-item--active': ai === actionIndex, 'rozie-command-palette-actions-menu-item--disabled': !!action.disabled }]} role="menuitem" data-testid="command-palette-action-item" aria-disabled={!!action.disabled} tabindex="-1" onmouseenter={($event) => { actionIndex = Number(ai); }} onmousedown={($event) => { $event.preventDefault(); selectAction(action); }} data-rozie-s-768cad96>{#if actionItem}{@render actionItem({ action, item: actionAnchor ? actionAnchor.item : null, active: ai === actionIndex, disabled: !!action.disabled })}{:else}{#if actionIcon(action)}<span class="rozie-command-palette-actions-menu-item-icon" data-rozie-s-768cad96>{rozieDisplay(actionIcon(action))}</span>{/if}<span class="rozie-command-palette-actions-menu-item-label" data-rozie-s-768cad96>{rozieDisplay(actionLabel(action))}</span>{#if actionShortcut(action)}<span class="rozie-command-palette-actions-menu-item-shortcut" data-rozie-s-768cad96>{rozieDisplay(actionShortcut(action))}</span>{/if}{/if}</div>{/each}</div>{/if}</div></div>{/if}

<style>
:global {
  .rozie-command-palette[data-rozie-s-768cad96] {
    position: fixed;
    inset: 0;
    z-index: var(--rozie-command-palette-z, 1000);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: var(--rozie-command-palette-overlay-padding, 12vh 1rem 1rem);
    background: var(--rozie-command-palette-backdrop-bg, rgba(0, 0, 0, 0.5));
    backdrop-filter: var(--rozie-command-palette-backdrop-filter, none);
  }
  .rozie-command-palette-frame[data-rozie-s-768cad96] {
    position: relative;
    display: flex;
    flex-direction: column;
    width: var(--rozie-command-palette-width, min(40rem, 100%));
    max-width: 100%;
  }
  .rozie-command-palette-panel[data-rozie-s-768cad96] {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: var(--rozie-command-palette-max-height, 70vh);
    overflow: hidden;
    font: var(--rozie-command-palette-font, inherit);
    color: var(--rozie-command-palette-color, inherit);
    background: var(--rozie-command-palette-bg, #fff);
    border: var(--rozie-command-palette-border, none);
    border-radius: var(--rozie-command-palette-radius, 0.75rem);
    box-shadow: var(--rozie-command-palette-shadow, 0 10px 38px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.25));
    /*
      Drive the vendored <Combobox>'s render-neutral tokens from panel scope
      (260715-50l findings 3+4) — custom properties inherit through the Lit
      nested-shadow boundary since this panel is the combobox's DOM ancestor.
      Each declaration is itself token-driven with a fallback so a palette
      consumer can still re-override. Result: a square, borderless-on-three-
      sides, ring-free input with a subtle bottom divider that stays put on
      focus (the clean cmdk look), plus subtle top separation above group
      headings (separating the leading ungrouped block from the first group).
    */
    --rozie-combobox-radius: var(--rozie-command-palette-input-radius, 0);
    --rozie-combobox-border-color: var(--rozie-command-palette-input-border-color, transparent);
    --rozie-combobox-focus-border-color: var(--rozie-command-palette-input-focus-border-color, transparent);
    --rozie-combobox-focus-ring-width: var(--rozie-command-palette-input-focus-ring-width, 0);
    --rozie-combobox-input-underline: var(--rozie-command-palette-input-underline, var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1)));
    --rozie-combobox-group-heading-margin-top: var(--rozie-command-palette-section-gap, 0.375rem);
  }
  .rozie-command-palette-search[data-rozie-s-768cad96] {
    padding: var(--rozie-command-palette-search-padding, 0.75rem);
    border-bottom: var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1));
  }
  .rozie-command-palette-header[data-rozie-s-768cad96] {
    display: flex;
    align-items: center;
    gap: var(--rozie-command-palette-header-gap, 0.5rem);
    padding: var(--rozie-command-palette-header-padding, 0.5rem 0.75rem);
    border-bottom: var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1));
    font-size: var(--rozie-command-palette-header-font-size, 0.875rem);
  }
  .rozie-command-palette-back[data-rozie-s-768cad96] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--rozie-command-palette-back-padding, 0.125rem 0.375rem);
    font: inherit;
    font-size: var(--rozie-command-palette-back-font-size, 1.1rem);
    line-height: 1;
    color: inherit;
    background: var(--rozie-command-palette-back-bg, transparent);
    border: var(--rozie-command-palette-back-border, none);
    border-radius: var(--rozie-command-palette-back-radius, 0.375rem);
    cursor: pointer;
  }
  .rozie-command-palette-back[data-rozie-s-768cad96]:hover {
    background: var(--rozie-command-palette-back-hover-bg, rgba(0, 0, 0, 0.06));
  }
  .rozie-command-palette-title[data-rozie-s-768cad96] {
    font-weight: var(--rozie-command-palette-title-weight, 600);
  }
  .rozie-command-palette-breadcrumb-trail[data-rozie-s-768cad96] {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--rozie-command-palette-breadcrumb-gap, 0.25rem);
    min-width: 0;
  }
  .rozie-command-palette-breadcrumb-item[data-rozie-s-768cad96] {
    display: inline-flex;
    align-items: baseline;
    gap: var(--rozie-command-palette-breadcrumb-gap, 0.25rem);
    min-width: 0;
  }
  .rozie-command-palette-breadcrumb-segment[data-rozie-s-768cad96] {
    color: var(--rozie-command-palette-breadcrumb-color, rgba(0, 0, 0, 0.55));
    font-weight: var(--rozie-command-palette-breadcrumb-weight, 400);
    white-space: nowrap;
  }
  .rozie-command-palette-breadcrumb-segment--current[data-rozie-s-768cad96] {
    color: var(--rozie-command-palette-breadcrumb-current-color, inherit);
    font-weight: var(--rozie-command-palette-breadcrumb-current-weight, 600);
  }
  .rozie-command-palette-breadcrumb-separator[data-rozie-s-768cad96] {
    color: var(--rozie-command-palette-breadcrumb-separator-color, rgba(0, 0, 0, 0.35));
  }
  .rozie-command-palette-input[data-rozie-s-768cad96] {
    box-sizing: border-box;
    width: 100%;
    padding: var(--rozie-command-palette-input-padding, 0.5rem 0.75rem);
    font: inherit;
    font-size: var(--rozie-command-palette-input-font-size, 1.05rem);
    color: inherit;
    background: var(--rozie-command-palette-input-bg, transparent);
    border: var(--rozie-command-palette-input-border, none);
    border-radius: var(--rozie-command-palette-input-radius, 0.5rem);
    outline: none;
  }
  .rozie-command-palette-list[data-rozie-s-768cad96] {
    margin: 0;
    padding: var(--rozie-command-palette-list-padding, 0.5rem);
    list-style: none;
    overflow-y: auto;
  }
  .rozie-command-palette-option[data-rozie-s-768cad96] {
    display: flex;
    align-items: center;
    gap: var(--rozie-command-palette-option-gap, 0.75rem);
  }
  .rozie-command-palette-option-main[data-rozie-s-768cad96] {
    display: flex;
    align-items: center;
    gap: var(--rozie-command-palette-option-gap, 0.75rem);
    flex: 1 1 auto;
    min-width: 0;
  }
  .rozie-command-palette-option-icon[data-rozie-s-768cad96] {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    color: var(--rozie-command-palette-icon-color, inherit);
    font-size: var(--rozie-command-palette-icon-size, 1rem);
  }
  .rozie-command-palette-option-actions[data-rozie-s-768cad96] {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    gap: var(--rozie-command-palette-actions-gap, 0.375rem);
    color: var(--rozie-command-palette-actions-color, rgba(0, 0, 0, 0.55));
    font-size: var(--rozie-command-palette-actions-font-size, 0.75rem);
    cursor: pointer;
    border-radius: var(--rozie-command-palette-actions-radius, 0.25rem);
  }
  .rozie-command-palette-option-actions[data-rozie-s-768cad96]:hover {
    color: var(--rozie-command-palette-actions-hover-color, rgba(0, 0, 0, 0.85));
    background: var(--rozie-command-palette-actions-hover-bg, rgba(0, 0, 0, 0.06));
  }
  .rozie-command-palette-option-actions-hint[data-rozie-s-768cad96] {
    padding: var(--rozie-command-palette-actions-hint-padding, 0.0625rem 0.3125rem);
    font-size: var(--rozie-command-palette-actions-hint-font-size, 0.6875rem);
    color: var(--rozie-command-palette-actions-hint-color, inherit);
    background: var(--rozie-command-palette-actions-hint-bg, rgba(0, 0, 0, 0.06));
    border-radius: var(--rozie-command-palette-actions-hint-radius, 0.25rem);
  }
  .rozie-command-palette-option-hotkey[data-rozie-s-768cad96] {
    flex: 0 0 auto;
    padding: var(--rozie-command-palette-hotkey-padding, var(--rozie-command-palette-actions-hint-padding, 0.0625rem 0.3125rem));
    font-size: var(--rozie-command-palette-hotkey-font-size, var(--rozie-command-palette-actions-hint-font-size, 0.6875rem));
    color: var(--rozie-command-palette-hotkey-color, var(--rozie-command-palette-actions-hint-color, inherit));
    background: var(--rozie-command-palette-hotkey-bg, var(--rozie-command-palette-actions-hint-bg, rgba(0, 0, 0, 0.06)));
    border-radius: var(--rozie-command-palette-hotkey-radius, var(--rozie-command-palette-actions-hint-radius, 0.25rem));
  }
  .rozie-command-palette-actions-menu[data-rozie-s-768cad96] {
    position: absolute;
    right: var(--rozie-command-palette-action-right, 0.5rem);
    z-index: var(--rozie-command-palette-action-z, 10);
    min-width: var(--rozie-command-palette-action-min-width, 10rem);
    max-width: var(--rozie-command-palette-action-max-width, 16rem);
    padding: var(--rozie-command-palette-action-padding, 0.25rem);
    background: var(--rozie-command-palette-action-bg, #fff);
    border: var(--rozie-command-palette-action-border, 1px solid rgba(0, 0, 0, 0.1));
    border-radius: var(--rozie-command-palette-action-radius, 0.5rem);
    box-shadow: var(--rozie-command-palette-action-shadow, 0 6px 24px rgba(0, 0, 0, 0.25));
  }
  .rozie-command-palette-actions-menu-item[data-rozie-s-768cad96] {
    display: flex;
    align-items: center;
    gap: var(--rozie-command-palette-action-gap, 0.5rem);
    padding: var(--rozie-command-palette-action-item-padding, 0.375rem 0.5rem);
    border-radius: var(--rozie-command-palette-action-item-radius, 0.375rem);
    cursor: pointer;
    outline: none;
  }
  .rozie-command-palette-actions-menu-item--active[data-rozie-s-768cad96],
  .rozie-command-palette-actions-menu-item[data-rozie-s-768cad96]:focus {
    background: var(--rozie-command-palette-action-active-bg, rgba(0, 0, 0, 0.08));
  }
  .rozie-command-palette-actions-menu-item--disabled[data-rozie-s-768cad96] {
    opacity: var(--rozie-command-palette-action-disabled-opacity, 0.5);
    cursor: default;
  }
  .rozie-command-palette-actions-menu-item-icon[data-rozie-s-768cad96] {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    color: var(--rozie-command-palette-action-icon-color, inherit);
  }
  .rozie-command-palette-actions-menu-item-label[data-rozie-s-768cad96] {
    flex: 1 1 auto;
    min-width: 0;
  }
  .rozie-command-palette-actions-menu-item-shortcut[data-rozie-s-768cad96] {
    flex: 0 0 auto;
    font-size: var(--rozie-command-palette-action-shortcut-font-size, 0.75rem);
    color: var(--rozie-command-palette-action-shortcut-color, rgba(0, 0, 0, 0.5));
  }
  .rozie-command-palette-option-trailing[data-rozie-s-768cad96] {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    color: var(--rozie-command-palette-trailing-color, rgba(0, 0, 0, 0.5));
    font-size: var(--rozie-command-palette-trailing-font-size, 0.75rem);
  }
  .rozie-command-palette-option-group[data-rozie-s-768cad96] {
    font-size: var(--rozie-command-palette-group-font-size, 0.75rem);
    color: var(--rozie-command-palette-group-color, rgba(0, 0, 0, 0.5));
    text-transform: var(--rozie-command-palette-group-transform, uppercase);
    letter-spacing: 0.04em;
  }
  .rozie-command-palette-option-label-match[data-rozie-s-768cad96] {
    font-weight: var(--rozie-command-palette-match-weight, 600);
    color: var(--rozie-command-palette-match-color, inherit);
  }
  .rozie-command-palette-empty[data-rozie-s-768cad96] {
    padding: var(--rozie-command-palette-empty-padding, 1.5rem);
    text-align: center;
    color: var(--rozie-command-palette-empty-color, rgba(0, 0, 0, 0.5));
  }
  .rozie-command-palette-loading[data-rozie-s-768cad96] {
    padding: var(--rozie-command-palette-empty-padding, 1.5rem);
    text-align: center;
    color: var(--rozie-command-palette-loading-color, rgba(0, 0, 0, 0.5));
  }
  .rozie-command-palette-error[data-rozie-s-768cad96] {
    padding: var(--rozie-command-palette-empty-padding, 1.5rem);
    text-align: center;
    color: var(--rozie-command-palette-error-color, #c0392b);
  }
  .rozie-command-palette-footer[data-rozie-s-768cad96] {
    padding: var(--rozie-command-palette-footer-padding, 0.5rem 0.75rem);
    border-top: var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1));
    font-size: var(--rozie-command-palette-footer-font-size, 0.8125rem);
    color: var(--rozie-command-palette-footer-color, rgba(0, 0, 0, 0.55));
  }
}
</style>
