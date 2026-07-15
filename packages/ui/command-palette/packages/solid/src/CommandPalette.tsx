import type { JSX } from 'solid-js';
import { For, Show, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
import Combobox, { type ComboboxHandle } from '@rozie-ui/combobox-solid';
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

__rozieInjectStyle('CommandPalette-768cad96', `.rozie-command-palette[data-rozie-s-768cad96] {
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
.rozie-command-palette-panel[data-rozie-s-768cad96] {
  display: flex;
  flex-direction: column;
  width: var(--rozie-command-palette-width, min(40rem, 100%));
  max-height: var(--rozie-command-palette-max-height, 70vh);
  overflow: hidden;
  font: var(--rozie-command-palette-font, inherit);
  color: var(--rozie-command-palette-color, inherit);
  background: var(--rozie-command-palette-bg, #fff);
  border: var(--rozie-command-palette-border, none);
  border-radius: var(--rozie-command-palette-radius, 0.75rem);
  box-shadow: var(--rozie-command-palette-shadow, 0 10px 38px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.25));
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
}`);

interface BreadcrumbSlotCtx { stack: any; back: any; }

interface OptionSlotCtx { option: any; index: any; active: any; selected: any; disabled: any; matches: any; }

interface EmptySlotCtx { query: any; }

interface LoadingSlotCtx { query: any; }

interface ErrorSlotCtx { query: any; error: any; retry: any; }

interface IconSlotCtx { option: any; }

interface ActionsSlotCtx { option: any; actions: any; }

interface TrailingSlotCtx { option: any; }

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
  onNavigate?: (...args: unknown[]) => void;
  onBack?: (...args: unknown[]) => void;
  onSelect?: (...args: unknown[]) => void;
  breadcrumbSlot?: (ctx: BreadcrumbSlotCtx) => JSX.Element;
  optionSlot?: (ctx: OptionSlotCtx) => JSX.Element;
  emptySlot?: (ctx: EmptySlotCtx) => JSX.Element;
  loadingSlot?: (ctx: LoadingSlotCtx) => JSX.Element;
  errorSlot?: (ctx: ErrorSlotCtx) => JSX.Element;
  footerSlot?: JSX.Element;
  iconSlot?: (ctx: IconSlotCtx) => JSX.Element;
  actionsSlot?: (ctx: ActionsSlotCtx) => JSX.Element;
  trailingSlot?: (ctx: TrailingSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: CommandPaletteHandle) => void;
}

export interface CommandPaletteHandle {
  show: (...args: any[]) => any;
  close: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  focus: (...args: any[]) => any;
  goBack: (...args: any[]) => any;
  openTo: (...args: any[]) => any;
}

export default function CommandPalette(_props: CommandPaletteProps): JSX.Element {
  const _merged = mergeProps({ score: null, items: (() => [])() as any[], placeholder: 'Type a command…', emptyText: 'No results.', closeOnSelect: true, ariaLabel: 'Command palette', idBase: 'rozie-command-palette', searchDebounce: 150 }, _props);
  const [local, attrs] = splitProps(_merged, ['open', 'query', 'score', 'items', 'placeholder', 'emptyText', 'closeOnSelect', 'ariaLabel', 'idBase', 'searchDebounce', 'ref']);
  onMount(() => { local.ref?.({ show, close, toggle, focus, goBack, openTo }); });

  const [open, setOpen] = createControllableSignal<boolean>(_props as unknown as Record<string, unknown>, 'open', false);
  const [query, setQuery] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'query', '');
  const [activeValue, setActiveValue] = createSignal<any>(null);
  const [levelStack, setLevelStack] = createSignal<any[]>([]);
  onMount(() => {
    if (open()) onOpen();
  });
  onCleanup(() => {
    if (debounceTimerId != null) clearTimeout(debounceTimerId);
  });
  createEffect(on(() => (() => open())(), (v) => untrack(() => ((isOpen: any) => {
    if (isOpen) onOpen();else {
      setQuery('');
      setLevelStack([]);
      setActiveValue(null);
      if (debounceTimerId != null) clearTimeout(debounceTimerId);
      debounceTimerId = null;
      requestToken = nextRequestToken(requestToken);
    }
  })(v)), { defer: true }));
  let panelRef: HTMLElement | null = null;
  let comboboxRef: ComboboxHandle | null = null;

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
  function currentItems() {
    const frame = currentFrame(levelStack());
    if (frame) {
      if (frame.status === 'loading' || frame.status === 'error') return [];
      return frame.resolvedItems;
    }
    return local.items;
  }

  // currentDepth(): the nesting depth (0 = root). Named to avoid shadowing the
  // imported levelStack `depth` helper (aliased `levelDepth` above).
  function currentDepth() {
    return levelDepth(levelStack());
  }

  // currentStatus()/currentError(): the active level's async status (LVL-ASYNC)
  // off the top frame — 'ready' at root (the implicit root frame is never
  // loading/error). Drive the #loading/#error re-projection inside combobox's
  // #empty slot (below).
  function currentStatus() {
    const frame = currentFrame(levelStack());
    return frame ? frame.status : 'ready';
  }
  function currentError() {
    const frame = currentFrame(levelStack());
    return frame ? frame.error : null;
  }

  // atDepth(): true when nested (depth>0) — gates the breadcrumb/back header
  // (LVL-RENDER). A plain function — never $computed.
  function atDepth() {
    return currentDepth() > 0;
  }

  // currentTitle(): the breadcrumb/header label for the active level — the top
  // frame's `title` (already item.title ?? item.label, captured by pushFrame
  // via levelTitle at push time). Falls back to `ariaLabel` at root (atDepth()
  // gates the header off at root anyway, but keeps this total).
  function currentTitle() {
    const frame = currentFrame(levelStack());
    return frame && frame.title != null ? frame.title : local.ariaLabel;
  }

  // currentPlaceholder(): the active level's input placeholder — the top
  // frame's `placeholder` (item.placeholder, captured at push time) falling
  // back to the component-level `placeholder` prop. Bound to the vendored
  // <Combobox>'s :placeholder so a navigating item's `placeholder` drives its
  // child level's input placeholder.
  function currentPlaceholder() {
    const frame = currentFrame(levelStack());
    return frame && frame.placeholder != null ? frame.placeholder : local.placeholder;
  }

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
  function breadcrumbStack() {
    return buildBreadcrumb(levelStack(), local.ariaLabel);
  }

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
  function filteredItems() {
    return scoreCommands(currentItems(), query(), local.score);
  }

  // The vendored <Combobox> commits the OPTION's value; resolve each command's value
  // to its stable `id` (the key passed back on `select`). disabled is resolved off
  // the item's own `disabled` flag (combobox's default `.disabled` fallback already
  // handles it, but we pass an explicit resolver for clarity + safety on primitives).
  function commandValue(it: any) {
    return it && it.id !== undefined ? it.id : it;
  }
  function commandDisabled(it: any) {
    return !!(it && it.disabled);
  }

  // Default-fill display helpers. The re-projected #option scope param `option`
  // threads as `unknown` on the Lit leaf (the cross-target slot-param-type gap), so
  // the default fill content reads its label/group through these UNTYPED helpers
  // (neutralized to `any`) rather than `option.label` directly — keeps the Lit leaf
  // typechecking without a per-target cast.
  function labelText(o: any) {
    return o && o.label !== undefined ? o.label : '';
  }
  function groupText(o: any) {
    return o && o.group !== undefined ? o.group : '';
  }
  // Display-only #actions scope resolver: the optional `actions` item field,
  // normalized to an array. Untyped param (neutralized to `any`) like the other
  // display helpers above — same cross-target slot-param-type gap.
  function actionsList(o: any) {
    return o && o.actions ? o.actions : [];
  }

  // Split a command's visible label into ordered { text, match } segments from
  // labelHighlight's [start,end) ranges, for the default #option fill row to
  // render as highlighted runs. Reflects the query-subsequence on the LABEL
  // regardless of which scorer produced the ranking (labelHighlight runs the
  // same fuzzyMatch primitive independent of $props.score). Untyped param
  // (neutralized to `any`) like the other display helpers above.
  function labelSegments(o: any) {
    const label = labelText(o);
    const ranges = labelHighlight(label, query());
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

  // ---- close funnel ------------------------------------------------------
  function closePalette() {
    setOpen(false);
  }

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
  function applyAsyncResult(token: any, promise: any) {
    return promise.then((items: any) => {
      if (!isLatestRequest(token, requestToken)) return;
      setLevelStack(settleFrame(levelStack(), Array.isArray(items) ? items : []));
    }, (error: any) => {
      if (!isLatestRequest(token, requestToken)) return;
      setLevelStack(failFrame(levelStack(), error));
    });
  }

  // Kick off (but do not await) an async level's initial/refetch load. A
  // `children` level is already seeded ready by pushFrame and never reaches
  // here; a `source` returning a Promise bumps + captures a fresh token then
  // settles in a microtask; a `source` returning a sync array settles in a
  // microtask too (deferred so React's pushFrame setState flushes first —
  // settleFrame reads $data.levelStack). The #error slot's `retry` reuses this.
  function beginLevelLoad(item: any, query: any) {
    const resolved = resolveChildSource(item, query);
    if (resolved.kind === 'async') {
      requestToken = nextRequestToken(requestToken);
      applyAsyncResult(requestToken, resolved.promise);
      return;
    }
    if (resolved.kind === 'sync') {
      const items = resolved.items;
      Promise.resolve().then(() => {
        setLevelStack(settleFrame(levelStack(), items));
      });
    }
  }

  // Re-invoke the CURRENT level's source at the current query (the #error
  // slot's `retry` — T-cpl-04 mitigation: an error leaves the input usable,
  // retry on next keystroke OR this explicit retry).
  function retryCurrentLevel() {
    const frame = currentFrame(levelStack());
    if (!frame || !frame.item || !isAsyncLevel(frame.item)) return;
    beginLevelLoad(frame.item, query());
  }

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
  function pushLevel(item: any) {
    const nextStack = pushFrame(levelStack(), item, query());
    setLevelStack(nextStack);
    setQuery('');
    setActiveValue(null);
    comboboxRef?.clear();
    focusInput();
    _props.onNavigate?.({
      item,
      depth: nextStack.length
    });
    if (isAsyncLevel(item)) beginLevelLoad(item, '');
  }

  // Pop one level: popFrame() → restore the query MODEL AND the vendored
  // <Combobox>'s VISIBLE input text via seedQuery(restoreQuery) (Option B — the
  // combobox seedQuery prerequisite) — full query undo, not just the
  // model/list. Bumps the request token so any in-flight source resolution for
  // the popped level is dropped. reopenComboboxPopup() re-opens the combobox
  // popup (Escape closed it on the shared bubble through the combobox — see
  // onPanelKeydown) so the restored parent level's list is visible. No-op at
  // root (an empty levelStack — mirrors the spec's "back() — no-op at root").
  function goBack() {
    if (levelStack().length === 0) return;
    const {
      stack,
      restoreQuery
    } = popFrame(levelStack());
    setLevelStack(stack);
    requestToken = nextRequestToken(requestToken);
    const q = restoreQuery == null ? '' : restoreQuery;
    setQuery(q);
    comboboxRef?.seedQuery(q);
    setActiveValue(null);
    reopenComboboxPopup();
    _props.onBack?.();
  }

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
  async function openTo(path: any) {
    setOpen(true);
    let stack = [];
    setLevelStack(stack);
    setQuery('');
    const ids = Array.isArray(path) ? path : [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const list = stack.length === 0 ? local.items : stack[stack.length - 1].resolvedItems;
      const item = Array.isArray(list) ? list.find((it: any) => it && it.id === id) : null;
      if (!item) break;
      stack = pushFrame(stack, item, '');
      setLevelStack(stack);
      const resolved = resolveChildSource(item, '');
      if (resolved.kind === 'async') {
        requestToken = nextRequestToken(requestToken);
        const token = requestToken;
        try {
          const items = await resolved.promise;
          if (isLatestRequest(token, requestToken)) {
            stack = settleFrame(stack, Array.isArray(items) ? items : []);
            setLevelStack(stack);
          }
        } catch (error: any) {
          if (isLatestRequest(token, requestToken)) {
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
        comboboxRef?.clear();
        focusInput();
      });
    } else {
      comboboxRef?.clear();
      focusInput();
    }
  }

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
  function onComboboxChange(e: any) {
    const item = e ? e.option : null;
    if (!item || item.disabled) return;
    if (isNavigating(item)) {
      pushLevel(item);
      return;
    }
    const path = levelStack().map((f: any) => f.item ? f.item.id : null);
    _props.onSelect?.({
      item,
      path
    });
    // Clear the internal selection so re-selecting the same command re-fires.
    setActiveValue(null);
    if (local.closeOnSelect) closePalette();
  }

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
  function onComboboxSearch(e: any) {
    const q = e && e.query !== undefined ? e.query : '';
    setQuery(q);
    const frame = currentFrame(levelStack());
    if (!frame || !isAsyncLevel(frame.item)) return;
    requestToken = nextRequestToken(requestToken);
    const token = requestToken;
    const item = frame.item;
    if (debounceTimerId != null) clearTimeout(debounceTimerId);
    debounceTimerId = setTimeout(() => {
      const resolved = resolveChildSource(item, q);
      if (resolved.kind === 'sync') {
        if (isLatestRequest(token, requestToken)) {
          setLevelStack(settleFrame(levelStack(), resolved.items));
        }
        return;
      }
      if (resolved.kind === 'async') applyAsyncResult(token, resolved.promise);
    }, local.searchDebounce);
  }

  // Backdrop click: a click whose target IS the backdrop (not the panel/children).
  function onBackdropClick(e: any) {
    if (e && e.target === e.currentTarget) closePalette();
  }

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
  function focusInput() {
    comboboxRef?.focus();
  }

  // Shadow-aware deepest active element (walks open shadow roots) — so the
  // blur/refocus reopen below works through Lit's shadow boundary (where
  // document.activeElement resolves only to the outermost host).
  function deepActiveElement() {
    let node = typeof document !== 'undefined' ? document.activeElement : null;
    while (node && node.shadowRoot && node.shadowRoot.activeElement) {
      node = node.shadowRoot.activeElement;
    }
    return node;
  }

  // Re-open the vendored combobox popup after a level pop (LVL-NAV). The combobox
  // opens its popup on the input's `@focus`, but a plain focus() on an
  // ALREADY-focused input fires no `@focus` — and Escape leaves the input focused
  // while closing the popup (Combobox.rozie onKeydown → isOpen=false). So BLUR the
  // deepest focused element first (which also runs combobox's `@blur` → isOpen
  // stays false), then re-focus on the next frame so `@focus` fires and re-opens
  // the popup showing the restored parent level. For a Backspace pop (popup never
  // closed) this is a harmless close→reopen cycle.
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

  // On open: clear the internal selection, then focus the search input. The query
  // is NOT reset here — that would clobber a pre-seeded / `r-model`-bound query.
  // The reset happens on the close transition (the $watch else-branch below), so a
  // value set alongside `open` is honored and each plain open still starts fresh
  // (the query was cleared at the prior close).
  // Runs from $onMount and the lazy open $watch callback, both post-mount.
  function onOpen() {
    setActiveValue(null);
    // Defer a tick so the overlay + <Combobox> are mounted before focusing.
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        focusInput();
      });
    } else {
      focusInput();
    }
  }

  // ---- lifecycle ---------------------------------------------------------

  // Bubble-phase panel keydown (LVL-NAV):
  //   - Escape at depth>0 → pop one level (does NOT close the palette); at
  //     depth 0 → close the palette. The vendored <Combobox> (a child) sees the
  //     Escape FIRST on the bubble path and closes its OWN popup (Combobox.rozie
  //     onKeydown → isOpen=false); goBack()'s reopenComboboxPopup() re-opens it
  //     afterward so the restored parent level's list is visible.
  //   - Backspace on an empty query at depth>0 → pop one level (Backspace does
  //     NOT close the combobox popup — its onKeydown ignores it — so the reopen
  //     is a harmless no-op cycle there). Otherwise Backspace edits the query
  //     text normally (never intercepted at the root or with text in the box).
  function onPanelKeydown(e: any) {
    if (!e) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (currentDepth() > 0) goBack();else closePalette();
      return;
    }
    if (e.key === 'Backspace' && query() === '' && currentDepth() > 0) {
      e.preventDefault();
      goBack();
    }
  }

  // ---- imperative handle -------------------------------------------------
  // show()/close()/toggle() drive the `open` model. The OPEN verb is `show` (NOT
  // `open`) — an `open` verb collides with the `open` model on React (both collapse
  // onto the generated open/setOpen state). focus() focuses the vendored combobox's
  // control via its exposed handle (accepted ROZ137 Lit override). All post-mount →
  // $refs safe. The POP verb is `goBack` — NOT `back` (a `back()` expose verb would
  // collide with the `@back` EMIT, ROZ121: expose∩emits must be empty). `openTo` is
  // the ⌘P deep-link (stubbed above; Task 6 fills the drill-through).
  function show() {
    setOpen(true);
  }
  function close() {
    closePalette();
  }
  function toggle() {
    setOpen(!open());
  }
  function focus() {
    return focusInput();
  }

  return (
    <>
    {<Show when={open()}><div class={"rozie-command-palette"} onClick={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onBackdropClick($event); }} data-rozie-s-768cad96="">
      <div role="dialog" aria-modal="true" aria-label={local.ariaLabel} ref={(el) => { panelRef = el as HTMLElement; }} class={"rozie-command-palette-panel"} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: Element }) => { onPanelKeydown($event); }} data-rozie-s-768cad96="">
        
        {<Show when={atDepth()}><div class={"rozie-command-palette-header"} data-rozie-s-768cad96="">
          {(_props.breadcrumbSlot ?? _props.slots?.['breadcrumb'])?.({ stack: breadcrumbStack(), back: goBack }) ?? <><button type="button" aria-label="Back" data-testid="command-palette-back" class={"rozie-command-palette-back"} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { goBack(); }} data-rozie-s-768cad96="">‹</button><span class={"rozie-command-palette-title"} data-testid="command-palette-title" data-rozie-s-768cad96="">{rozieDisplay(currentTitle())}</span></>}
        </div></Show>}<Combobox aria-label={local.ariaLabel} ref={(el) => { comboboxRef = el as ComboboxHandle; }} inline={true} disableFilter={true} closeOnSelect={false} options={filteredItems()} optionValue={commandValue} optionDisabled={commandDisabled} placeholder={currentPlaceholder()} idBase={local.idBase} value={activeValue()} onValueChange={setActiveValue} onChange={($event) => { onComboboxChange($event); }} onSearch={($event) => { onComboboxSearch($event); }} data-rozie-s-768cad96="" optionSlot={({ option, index, active, selected, disabled }) => (<>
            {(_props.optionSlot ?? _props.slots?.['option'])?.({ option, index, active, selected, disabled, matches: labelHighlight(labelText(option), query()) }) ?? <div class={"rozie-command-palette-option"} data-rozie-s-768cad96="">
                {<Show when={(_props.iconSlot ?? _props.slots?.['icon'])}><span class={"rozie-command-palette-option-icon"} data-rozie-s-768cad96="">
                  {(_props.iconSlot ?? _props.slots?.['icon'])?.({ option })}
                </span></Show>}<span class={"rozie-command-palette-option-main"} data-rozie-s-768cad96="">
                  <span class={"rozie-command-palette-option-label"} data-rozie-s-768cad96="">
                    <For each={labelSegments(option)}>{(segment, si) => <span class={rozieClass({ 'rozie-command-palette-option-label-match': segment.match })} data-rozie-s-768cad96="">{rozieDisplay(segment.text)}</span>}</For>
                  </span>
                  {<Show when={groupText(option)}><span class={"rozie-command-palette-option-group"} data-rozie-s-768cad96="">{rozieDisplay(groupText(option))}</span></Show>}</span>
                {<Show when={(_props.actionsSlot ?? _props.slots?.['actions'])}><span class={"rozie-command-palette-option-actions"} data-rozie-s-768cad96="">
                  {(_props.actionsSlot ?? _props.slots?.['actions'])?.({ option, actions: actionsList(option) })}
                </span></Show>}{<Show when={(_props.trailingSlot ?? _props.slots?.['trailing'])}><span class={"rozie-command-palette-option-trailing"} data-rozie-s-768cad96="">
                  {(_props.trailingSlot ?? _props.slots?.['trailing'])?.({ option })}
                </span></Show>}</div>}
          </>)} emptySlot={({ query }) => (<>
            {<Show when={currentStatus() === 'ready'}>{(_props.emptySlot ?? _props.slots?.['empty'])?.({ query }) ?? local.emptyText}</Show>}</>)} />

        
        {<Show when={currentStatus() === 'loading'} fallback={<Show when={currentStatus() === 'error'}><div class={"rozie-command-palette-error"} data-rozie-s-768cad96="">
          {(_props.errorSlot ?? _props.slots?.['error'])?.({ query: query(), error: currentError(), retry: retryCurrentLevel })}
        </div></Show>}><div class={"rozie-command-palette-loading"} data-rozie-s-768cad96="">
          {(_props.loadingSlot ?? _props.slots?.['loading'])?.({ query: query() }) ?? "Loading…"}
        </div></Show>}{<Show when={(_props.footerSlot ?? _props.slots?.['footer'])}><div class={"rozie-command-palette-footer"} data-rozie-s-768cad96="">
          {(_props.footerSlot ?? _props.slots?.['footer']?.({}))}
        </div></Show>}</div>
    </div></Show>}</>
  );
}
