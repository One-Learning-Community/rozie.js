import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface CommandPaletteProps {
  /**
   * Whether the palette overlay is shown (two-way `r-model`). Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`); every close path (backdrop click, Escape, selecting an item when `closeOnSelect`, the imperative `close()`) writes `open = false`. As one of two `model: true` props the component does not generate an Angular `ControlValueAccessor`.
   * @example
   * <CommandPalette r-model:open="paletteOpen" :items="commands" />
   */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
  /**
   * The current search text (two-way `r-model`). Two-way bind it to read the query, or pre-seed it by setting a value alongside `open` — an open no longer clears it, so the palette opens filtered to that query. The component ranks `items` by this string via `score` (fuzzy-subsequence by default, matched over each item `label` plus its `keywords`, label weighted above keywords). Reset to `""` when the palette closes, so each plain open starts with a fresh search box.
   */
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (next: string) => void;
  /**
   * Custom ranking/exclusion hook: `(item, query) => number | null`. Return `null` to exclude an item from the results; otherwise higher numbers rank first. Leave unset (`default: null`) to use the built-in fuzzy-subsequence scorer (label weighted above keywords). A recency/frecency boost is added INSIDE `score` (e.g. `return baseScore + recencyBonus(item.id)`), not as a separate prop.
   * @example
   * <CommandPalette :score="(item, q) => item.label.includes(q) ? 1 : null" :items="commands" />
   */
  score?: ((...args: any[]) => any) | null;
  /**
   * The command list — `[{ id, label, group?, keywords?, disabled?, icon?, actions? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; commands sharing an optional `group` string are bucketed under a labeled section heading (auto-derived, via the vendored combobox's native section groups) — commands with no `group` render first in a headingless block. The heading text is the `group` string itself; override its markup with the `#groupHeading` slot. Optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation. The optional `icon` and `actions` fields are display-only — unused by ranking — surfaced through the `#icon` and `#actions` option-row slots.
   */
  items?: unknown[];
  /**
   * Items shown when the query is empty (the empty/home state), resolved PER LEVEL. This top-level prop is the ROOT level's home view; a navigating item's own `defaultItems` field (alongside its `children`/`source`) is that CHILD level's home view. They render grouped when they carry `group` fields (composes with native sections, same as `items`), and scoring never reorders them (the empty-query short-circuit preserves author order). Typing a query switches to scored `items`/`source` results; clearing the query returns to `defaultItems`. This is the first-class replacement for branching on `query === ''` inside a `source` function — and the natural home for a recents/frecency list (composes with the `score` prop's recency boost). Leave unset (`default: () => []`) for today's behavior — no defaultItems is byte-behavior-identical to the full source-order list.
   * @example
   * <CommandPalette :default-items="recentCommands" :items="commands" />
   */
  defaultItems?: unknown[];
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
  /**
   * Opt-in vertical windowing for a long list, resolved PER LEVEL — this prop is the ROOT level; a navigating item's own `virtual` field windows THAT child level instead. A virtual level renders FLAT: the auto-derived groups + `groupCap` + `#groupHeading` are inactive for that level (the vendored combobox's `isGrouped` requires `!virtual`) — popping back to a grouped non-virtual level restores its groups. Windowing needs a bounded scroll height — pair with `virtualMaxHeight`. Default `false` is byte-behavior-identical to today (non-windowed).
   * @example
   * <CommandPalette virtual virtual-max-height="320px" :items="longCommandList" />
   */
  virtual?: boolean;
  /**
   * A CSS length string (e.g. `"320px"`) bounding the windowed scroll container while the active level is virtual, resolved PER LEVEL like `virtual` above — passed straight through to the vendored combobox's `maxHeight`. Distinct from and non-conflicting with the panel's own `--rozie-command-palette-max-height` token (that clips the WHOLE panel; this bounds the INNER windowed list). Ignored while the active level is not virtual.
   * @example
   * <CommandPalette virtual virtual-max-height="320px" :items="longCommandList" />
   */
  virtualMaxHeight?: (string) | null;
  /**
   * Estimated option row height (px) seeding the windowing engine, resolved PER LEVEL like `virtual` above. Unset falls back to the vendored combobox's own default (36px) — but command-palette rows are typically taller (an icon + a right-aligned hotkey badge), so a consumer windowing a real palette level should usually raise this.
   * @example
   * <CommandPalette virtual :virtual-estimate-row-height="44" :items="longCommandList" />
   */
  virtualEstimateRowHeight?: (number) | null;
  onNavigate?: (...args: unknown[]) => void;
  onBack?: (...args: unknown[]) => void;
  onSelect?: (...args: unknown[]) => void;
  onActionSelect?: (...args: unknown[]) => void;
  renderBreadcrumb?: (params: { stack: unknown; back: () => void }) => ReactNode;
  renderOption?: (params: { option: () => void; index: () => void; active: () => void; selected: () => void; disabled: () => void; matches: unknown }) => ReactNode;
  renderGroupHeading?: (params: { group: () => void }) => ReactNode;
  renderEmpty?: (params: { query: string }) => ReactNode;
  renderArgsField?: (params: { item: unknown; arg: () => void; value: unknown; setValue: unknown }) => ReactNode;
  renderLoading?: (params: { query: string }) => ReactNode;
  renderError?: (params: { query: string; error: unknown; retry: () => void }) => ReactNode;
  renderFooter?: () => ReactNode;
  renderActionItem?: (params: { action: () => void; item: unknown; active: unknown; disabled: unknown }) => ReactNode;
  renderIcon?: (params: { option: () => void }) => ReactNode;
  renderActions?: (params: { option: () => void; actions: unknown }) => ReactNode;
  renderTrailing?: (params: { option: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface CommandPaletteHandle {
  show: (...args: any[]) => any;
  close: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  focus: (...args: any[]) => any;
  goBack: (...args: any[]) => any;
  openTo: (...args: any[]) => any;
}

declare const CommandPalette: React.ForwardRefExoticComponent<CommandPaletteProps & React.RefAttributes<CommandPaletteHandle>>;
export default CommandPalette;
