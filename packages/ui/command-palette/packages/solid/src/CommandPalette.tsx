import type { JSX } from 'solid-js';
import { For, Show, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, createControllableSignal, parseInlineStyle, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
import Combobox, { type ComboboxHandle } from '@rozie-ui/combobox-solid';
import { scoreCommands, labelHighlight } from './internal/scoreCommands';
import { isNavigating, pushFrame, popFrame, currentFrame, settleFrame, failFrame, breadcrumb, depth as levelDepth, levelDefaultItems, levelVirtual, levelVirtualMaxHeight, levelVirtualEstimateRowHeight } from './internal/levelStack';
import { resolveChildSource, isAsyncLevel, nextRequestToken, isLatestRequest } from './internal/asyncSource';
import { canOpenActions, actionsOf, firstEnabledActionIndex, rovingActionIndex, resolveEscape, matchesActionKey, caretAtEnd } from './internal/actionMenu';
import { hasArgs, argsOf, initArgValues, firstUnfilledRequiredIndex, canSubmitArgs, buildArgsPayload, isFirstFieldEmpty } from './internal/argsSurface';
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
.rozie-command-palette-breadcrumb-segment--link[data-rozie-s-768cad96] {
  padding: 0;
  font: inherit;
  line-height: inherit;
  background: none;
  border: none;
  border-radius: var(--rozie-command-palette-breadcrumb-jump-radius, 0.25rem);
  cursor: pointer;
}
.rozie-command-palette-breadcrumb-segment--link[data-rozie-s-768cad96]:hover {
  color: var(--rozie-command-palette-breadcrumb-jump-hover-color, var(--rozie-command-palette-breadcrumb-current-color, inherit));
  text-decoration: var(--rozie-command-palette-breadcrumb-jump-hover-decoration, underline);
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
.rozie-command-palette-option-anchor[data-rozie-s-768cad96] {
  display: contents;
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
.rozie-command-palette-list-region--inert[data-rozie-s-768cad96] {
  pointer-events: none;
  opacity: var(--rozie-command-palette-args-dim-opacity, 0.45);
}
.rozie-command-palette-args[data-rozie-s-768cad96] {
  display: flex;
  flex-direction: column;
  gap: var(--rozie-command-palette-args-gap, 0.5rem);
  padding: var(--rozie-command-palette-args-padding, 0.75rem);
}
.rozie-command-palette-args-chip[data-rozie-s-768cad96] {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: var(--rozie-command-palette-args-chip-padding, 0.125rem 0.5rem);
  color: var(--rozie-command-palette-args-chip-color, inherit);
  background: var(--rozie-command-palette-args-chip-bg, rgba(0, 0, 0, 0.06));
  border-radius: var(--rozie-command-palette-back-radius, 0.375rem);
}
.rozie-command-palette-args-field[data-rozie-s-768cad96] {
  display: block;
}
.rozie-command-palette-args-input[data-rozie-s-768cad96] {
  box-sizing: border-box;
  width: 100%;
  padding: var(--rozie-command-palette-args-field-padding, var(--rozie-command-palette-input-padding, 0.5rem 0.75rem));
  font: inherit;
  color: inherit;
  background: var(--rozie-command-palette-args-field-bg, var(--rozie-command-palette-input-bg, transparent));
  border: var(--rozie-command-palette-args-field-border, var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1)));
  border-radius: var(--rozie-command-palette-args-field-radius, var(--rozie-command-palette-input-radius, 0.5rem));
  outline: none;
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

interface GroupHeadingSlotCtx { group: any; }

interface EmptySlotCtx { query: any; }

interface ArgsFieldSlotCtx { item: any; arg: any; value: any; setValue: any; }

interface LoadingSlotCtx { query: any; }

interface ErrorSlotCtx { query: any; error: any; retry: any; }

interface ActionItemSlotCtx { action: any; item: any; active: any; disabled: any; }

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
  breadcrumbSlot?: (ctx: BreadcrumbSlotCtx) => JSX.Element;
  optionSlot?: (ctx: OptionSlotCtx) => JSX.Element;
  groupHeadingSlot?: (ctx: GroupHeadingSlotCtx) => JSX.Element;
  emptySlot?: (ctx: EmptySlotCtx) => JSX.Element;
  argsFieldSlot?: (ctx: ArgsFieldSlotCtx) => JSX.Element;
  loadingSlot?: (ctx: LoadingSlotCtx) => JSX.Element;
  errorSlot?: (ctx: ErrorSlotCtx) => JSX.Element;
  footerSlot?: JSX.Element;
  actionItemSlot?: (ctx: ActionItemSlotCtx) => JSX.Element;
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
  const _merged = mergeProps({ score: null, items: (() => [])() as any[], defaultItems: (() => [])() as any[], placeholder: 'Type a command…', emptyText: 'No results.', closeOnSelect: true, ariaLabel: 'Command palette', idBase: 'rozie-command-palette', searchDebounce: 150, actionKey: '$mod+k', closeOnAction: true, groupCap: 0, appendTo: false, virtual: false, virtualMaxHeight: null, virtualEstimateRowHeight: null }, _props);
  const [local, attrs] = splitProps(_merged, ['open', 'query', 'score', 'items', 'defaultItems', 'placeholder', 'emptyText', 'closeOnSelect', 'ariaLabel', 'idBase', 'searchDebounce', 'actionKey', 'closeOnAction', 'groupCap', 'appendTo', 'virtual', 'virtualMaxHeight', 'virtualEstimateRowHeight', 'ref']);
  onMount(() => { local.ref?.({ show, close, toggle, focus, goBack, openTo }); });

  const [open, setOpen] = createControllableSignal<boolean>(_props as unknown as Record<string, unknown>, 'open', false);
  const [query, setQuery] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'query', '');
  const [activeValue, setActiveValue] = createSignal<any>(null);
  const [levelStack, setLevelStack] = createSignal<any[]>([]);
  const [activeSurface, setActiveSurface] = createSignal('list');
  const [actionIndex, setActionIndex] = createSignal(-1);
  const [actionAnchor, setActionAnchor] = createSignal<any>(null);
  const [actionMenuTop, setActionMenuTop] = createSignal(0);
  const [argsState, setArgsState] = createSignal<any>(null);
  const [platformIsApple, setPlatformIsApple] = createSignal(false);
  onMount(() => {
    setPlatformIsApple(sniffApplePlatform());
  });
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
      // Reset the action/args surface directly (NOT closeActionMenu/
      // closeArgsSurface — the palette is closing, so there is no combobox
      // popup left to reopen/keepOpen-release; a plain reset keeps a reopen
      // starting clean, per spec §Composition).
      setActiveSurface('list');
      setActionIndex(-1);
      setActionAnchor(null);
      setArgsState(null);
      if (debounceTimerId != null) clearTimeout(debounceTimerId);
      debounceTimerId = null;
      requestToken = nextRequestToken(requestToken);
    }
  })(v)), { defer: true }));
  let frameRef: HTMLElement | null = null;
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

  // ---- args-surface opening-Enter guard (finding 2) -----------------------
  // openArgsSurface flips $data.activeSurface to 'args' SYNCHRONOUSLY from inside
  // onComboboxChange, which itself runs from the vendored <Combobox>'s Enter
  // commit (Combobox.rozie onKeydown → selectOption → synchronous `@change`).
  // That Enter keydown preventDefaults but does NOT stopPropagation, so the SAME
  // keystroke keeps bubbling up to the frame's @keydown (onPanelKeydown); its
  // args-branch would then fire submitArgs() on the very key that opened the
  // surface — instantly @select-ing any command whose args are already valid on
  // open (a required arg with a `default`, or all-optional args). This flag,
  // armed in openArgsSurface and disarmed on the next microtask (after the
  // opening keydown has finished bubbling, before any later keystroke), makes
  // onPanelKeydown's args-branch Enter — and ONLY Enter; Escape/Backspace stay
  // live — a no-op for exactly that opening keystroke. A module-level `let`
  // (never $data) so the read-after-write across the synchronous bubble is exact
  // ×6 (the requestToken/debounceTimerId precedent); the React emitter hoists it
  // to useRef. On React the surface flip is async (setState), so onPanelKeydown
  // reads the pre-flip 'list' surface and never reaches the args-branch on the
  // opening event anyway — the guard is a correct no-op there.
  let argsJustOpened = false;

  // command-palette-portal-overlay phase — resolveAppendTo(): normalizes the
  // `appendTo` prop into a portal container (or `null` = render in place). A
  // PLAIN function (never $computed — this is read from inside `r-portal`'s
  // container expression, a runtime/reactive-effect position on every target,
  // not a template-bare-read derived value). SSR-guarded FIRST so a falsy `to`
  // or a missing `document` never reaches `document.querySelector` — `null`
  // feeds `r-portal`'s falsy/disabled path, which is what makes
  // `appendTo:false` (the default) byte-behavior-identical to no directive at
  // all. `to === true || to === 'body'` -> `document.body`; a CSS selector
  // string -> `document.querySelector(to)` (no match = `null`, in place — never
  // a blank overlay); anything else (e.g. an author-passed Element reference,
  // outside the declared Boolean|String prop type but tolerated at runtime) is
  // returned as-is.
  function resolveAppendTo(to: any) {
    if (!to) return null;
    if (typeof document === 'undefined') return null;
    if (to === true || to === 'body') return document.body;
    if (typeof to === 'string') return document.querySelector(to);
    return to;
  }

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

  // currentDefaultItems() (command-palette-13-empty-home-view-first): the
  // ACTIVE level's empty/home-view items — the top frame's `defaultItems`
  // (captured at push time by pushFrame from the navigating item's own
  // `defaultItems` field) when nested, else the root `defaultItems` prop.
  function currentDefaultItems() {
    const frame = currentFrame(levelStack());
    return frame ? frame.defaultItems : local.defaultItems;
  }

  // currentBaseItems(): the pre-scoring source fed to filteredItems() below.
  // An EMPTY (trimmed) query with a non-empty currentDefaultItems() returns
  // the home view (author order — never reaches the scorer, per scoreCommands'
  // empty-query short-circuit); otherwise falls through to currentItems() —
  // today's behavior, unchanged when no defaultItems is set.
  function currentBaseItems() {
    const q = String(query() == null ? '' : query()).trim();
    const defaults = currentDefaultItems();
    if (q === '' && Array.isArray(defaults) && defaults.length > 0) return defaults;
    return currentItems();
  }

  // currentDepth(): the nesting depth (0 = root). Named to avoid shadowing the
  // imported levelStack `depth` helper (aliased `levelDepth` above).
  function currentDepth() {
    return levelDepth(levelStack());
  }

  // currentFrameField(key, fallback): quick 260716-npt Finding 4 (reuse) —
  // the shared shape behind currentStatus/currentError/currentVirtual/
  // currentVirtualMaxHeight/currentVirtualEstimateRowHeight below (5
  // mechanically-identical `const frame = currentFrame($data.levelStack);
  // return frame ? frame.KEY : FALLBACK` blocks, collapsed into one). NOT used
  // by currentTitle/currentPlaceholder — those use a genuinely divergent
  // `frame && frame.KEY != null` nullish-check shape, left as-is.
  function currentFrameField(key: any, fallback: any) {
    const frame = currentFrame(levelStack());
    return frame ? frame[key] : fallback;
  }

  // currentStatus()/currentError(): the active level's async status (LVL-ASYNC)
  // off the top frame — 'ready' at root (the implicit root frame is never
  // loading/error). Drive the #loading/#error re-projection inside combobox's
  // #empty slot (below).
  function currentStatus() {
    return currentFrameField('status', 'ready');
  }
  function currentError() {
    return currentFrameField('error', null);
  }

  // atDepth(): true when nested (depth>0) — gates the breadcrumb/back header
  // (LVL-RENDER). A plain function — never $computed.
  function atDepth() {
    return currentDepth() > 0;
  }

  // atActions(): true while the action menu owns the keyboard (ACT-SEAM). Gates
  // the flyout r-if AND the combobox keepOpen consumption — a plain function,
  // never $computed.
  function atActions() {
    return activeSurface() === 'actions';
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

  // currentVirtual()/currentVirtualMaxHeight()/currentVirtualEstimateRowHeight()
  // (command-palette-per-level-virtual, FD-01 resolved): the active level's
  // windowing trio bound onto the vendored <Combobox> below — the top frame's
  // captured `virtual`/`virtualMaxHeight`/`virtualEstimateRowHeight` (levelStack.ts
  // pushFrame, mirroring defaultItems/title/placeholder) when nested, else the
  // root `virtual`/`virtualMaxHeight`/`virtualEstimateRowHeight` props. Plain
  // functions (never $computed — the combobox value-vs-accessor split), each
  // reading currentFrame($data.levelStack) once.
  function currentVirtual() {
    return currentFrameField('virtual', local.virtual === true);
  }
  // combobox's own empty-string default falls back to its
  // `--rozie-combobox-list-max-height` token; maxHeight is also ignored by
  // combobox whenever `virtual` is off — so `''` here is byte-identical-off.
  function currentVirtualMaxHeight() {
    const raw = currentFrameField('virtualMaxHeight', local.virtualMaxHeight);
    return currentVirtual() && raw != null ? raw : '';
  }
  // MUST fall back to a real number — combobox consumes this as
  // `estimateSize: () => $props.estimateRowHeight` (headless-core/windowing.rzts),
  // so a null binding would seed the virtualizer with null. `36` mirrors
  // combobox's own `estimateRowHeight` default.
  function currentVirtualEstimateRowHeight() {
    const raw = currentFrameField('virtualEstimateRowHeight', local.virtualEstimateRowHeight);
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : 36;
  }

  // breadcrumbStack(): the full root..current breadcrumb (internal/levelStack.ts
  // breadcrumb()) fed to the #breadcrumb slot's `stack` scope param — the root
  // entry's title is `ariaLabel` (the palette's own accessible name doubles as
  // the root breadcrumb label; there is no separate "root title" prop).
  // Quick 260717-8zb (Task 2 Item 4): the import is the NATURAL `breadcrumb`
  // name again (previously aliased `as buildBreadcrumb` to sidestep a
  // Svelte-only collision with the emitter's own `breadcrumb` slot-merge
  // binding — the same top-level `<script>` scope as this import). The Svelte
  // emitter now auto-renames its generated slot-merge binding to
  // `breadcrumb$$slot` on collision (Class 3, findRForSlotNameCollisions.ts),
  // the same mechanism that already fixes the r-for-loop-var and script-param
  // collision classes — no author-side alias needed.
  function breadcrumbStack() {
    return breadcrumb(levelStack(), local.ariaLabel);
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
  // currentBaseItems() (command-palette-13-empty-home-view-first) additionally
  // swaps in the active level's `defaultItems` on an empty query — scoring's
  // own empty-query short-circuit (scoreCommands.ts) then preserves author
  // order for free, so a non-empty query still ranks currentItems() exactly
  // as before (defaultItems is never scored/reordered).
  function filteredItems() {
    return scoreCommands(currentBaseItems(), query(), local.score);
  }

  // ---- data-cp-index resolution (finding 7a) ------------------------------
  // commandValue(it) falls back to the item OBJECT when a command carries no
  // `id` — stamped through :data-cp-value it stringifies to '[object Object]'
  // for EVERY id-less row, so they all collide and highlightedItem()'s value
  // scan returns the FIRST match regardless of which row is highlighted (wrong
  // action menu + wrong @action-select payload). The collision-free
  // discriminator is the command's POSITIONAL index within filteredItems() (the
  // pre-group, pre-cap canonical ranked list) — unique by construction, id or
  // no id, and cap/order-independent (combobox's own row index is its CAPPED
  // running index, which is why a positional-into-orderedItems() scheme broke
  // once a section overflowed its cap).
  //
  // scoreCommands() returns a FRESH array each call, so cache an identity→index
  // Map keyed on the (base items, query, score) inputs that fully determine the
  // ranking — the per-row stamp is then O(1) and the whole render O(n), never
  // O(n²). Plain module-lets: on the 5 setup-once targets they persist and the
  // ref-keyed signature invalidates on any input change; on React (the body
  // re-runs each render, and these are template-only — never hook-referenced —
  // so hoistModuleLet leaves them as per-render locals) they reset per render,
  // which is exactly the desired render-scoped cache lifetime.
  let _cpIdxBase: any = null;
  let _cpIdxQuery: any = null;
  let _cpIdxScore: any = null;
  let _cpIdxMap: any = null;
  function cpAnchorIndexMap() {
    const base = currentBaseItems();
    const query$local = query();
    const score$local = local.score;
    if (_cpIdxMap && base === _cpIdxBase && query$local === _cpIdxQuery && score$local === _cpIdxScore) {
      return _cpIdxMap;
    }
    const list = filteredItems();
    const map = new Map();
    for (let i = 0; i < list.length; i++) map.set(list[i], i);
    _cpIdxBase = base;
    _cpIdxQuery = query$local;
    _cpIdxScore = score$local;
    _cpIdxMap = map;
    return map;
  }
  // cpAnchorIndex(option): the option's canonical filteredItems() position,
  // stamped as data-cp-index on the option-anchor span. -1 for a stray option
  // not present in the current ranked list (the no-op guard — never expected).
  function cpAnchorIndex(option: any) {
    const idx = cpAnchorIndexMap().get(option);
    return idx === undefined ? -1 : idx;
  }

  // ---- native combobox groups (cp-adopts-combobox-groups) -----------------
  // groupedView(): derives `{ groups, ordered }` off filteredItems() via the
  // pure commandGroups.ts helper (mirrors combobox groupOptions() exactly —
  // see that file's header). orderedItems()/commandGroups() split the result
  // for the two template bindings below; grouped() gates the per-row badge.
  // Plain functions (never $computed — the combobox value-vs-accessor split).
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

  // groupLabel(): UNTYPED display resolver for the re-projected #groupHeading
  // scope param — `group` threads as `unknown` on the Lit leaf (the same
  // cross-target slot-param-type gap as labelText/groupText/actionLabel
  // above), so the default fill reads `.label` through this rather than
  // `group.label` directly.
  function groupLabel(g: any) {
    return g && g.label !== undefined ? g.label : '';
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

  // hotKeyOf(): the optional per-item `hotKey?: string` display-only teaching
  // field — resolved off the re-projected #option scope param (untyped, same
  // cross-target slot-param-type gap as the other display helpers above). The
  // palette NEVER binds or listens for this key; it is rendered through
  // formatKeyToken() below as a right-aligned badge, purely advertising an
  // app-global shortcut the CONSUMER owns (Copy `$mod+c`, Print `$mod+p`).
  function hotKeyOf(o: any) {
    return o && o.hotKey ? o.hotKey : '';
  }

  // Untyped #actionItem display resolvers (ACT-RENDER) — the re-projected
  // `action` scope param threads as `unknown` on the Lit leaf (the same
  // cross-target slot-param-type gap as labelText/groupText/actionsList
  // above), so the default fill reads label/shortcut/icon through these
  // rather than `action.label` directly.
  function actionLabel(a: any) {
    return a && a.label !== undefined ? a.label : '';
  }
  function actionShortcut(a: any) {
    return a && a.shortcut !== undefined ? a.shortcut : undefined;
  }
  function actionIcon(a: any) {
    return a && a.icon !== undefined ? a.icon : undefined;
  }

  // Platform sniff for the DISPLAY of the `$mod` token only — matching is
  // platform-agnostic (`metaKey || ctrlKey`, see matchesActionKey). SSR-guarded
  // like every other browser-global read; defaults to the non-Apple form.
  //
  // Quick 260716-npt Finding 4 (efficiency): this used to be called directly
  // from the template ONCE PER ROW (via actionKeyHint()/hotKey badge below),
  // re-sniffing navigator on every render for every option. `navigator` never
  // changes mid-session, so sniff it ONCE in $onMount into $data.platformIsApple
  // and read that everywhere instead — see the two call sites below.
  function sniffApplePlatform() {
    if (typeof navigator === 'undefined') return false;
    const p = (navigator.platform || '') + ' ' + (navigator.userAgent || '');
    return /Mac|iPhone|iPad|iPod/.test(p);
  }
  // actionKeyHint(): a short display string for the actionKey prop, for the
  // #actions row affordance's default (unfilled) hint — "$mod+k" → "⌘K" on
  // Apple platforms / "Ctrl+K" elsewhere; delegates the full modifier grammar
  // onto the shared formatKeyToken() helper (also used by the per-item hotKey
  // badge below) — see internal/formatKeyToken.ts for the grammar. Keeps the
  // existing typeof guard; '$mod+k' stays byte-identical (⌘K / Ctrl+K). Reads
  // the mount-time-cached $data.platformIsApple (Finding 4) instead of
  // re-sniffing navigator per call.
  function actionKeyHint() {
    const k = local.actionKey;
    if (typeof k !== 'string') return '';
    return formatKeyToken(k, platformIsApple());
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
    // Level nav always resets to the list surface (spec §Composition) — a
    // navigating item's own action menu (or, feature #12, an in-progress args
    // surface), if somehow open, must not survive the push.
    closeAnySurface();
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
    // command-palette-13-empty-home-view-first: an item carrying a non-empty
    // defaultItems is seeded 'ready' by pushFrame — skip the initial
    // beginLevelLoad('') kick-off entirely (no source('') call, no loading
    // flash). Typing still triggers the debounced source(query) refetch below
    // (onComboboxSearch); clearing back to '' returns to the home view without
    // ever invoking source.
    if (isAsyncLevel(item) && levelDefaultItems(item).length === 0) beginLevelLoad(item, '');
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
    // Level nav always resets to the list surface (spec §Composition) — pop
    // closes an open action menu (or args surface, feature #12) FIRST.
    closeAnySurface();
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

  // jumpToLevel(targetDepth): the breadcrumb ANCESTOR click-to-jump affordance
  // (260715-uz1). A breadcrumb index `ei` maps directly onto a target stack
  // depth (breadcrumbStack() index 0 = root/depth 0, index k = the k-th pushed
  // frame/depth k) — see breadcrumb()/depth() in internal/levelStack.ts. Pops
  // the stack from its CURRENT length down to `targetDepth`, emitting ONE
  // `@back` per popped level — the LOCKED event-sequence decision: N-T `@back`
  // emits for a depth-N→depth-T jump, byte-identical to pressing Backspace
  // (N-T) times (see the levels design spec + the VR `readout-back-count`,
  // which counts one increment per level — a single "pop-to-depth" emit would
  // under-report to consumers/counters).
  //
  // Script-internal ONLY — deliberately NOT added to $expose (keeps the
  // surface gate, surface.test.ts, byte-unchanged; see the plan's must_haves).
  //
  // The pops are threaded through a LOCAL `stack` (mirrors openTo/pushLevel)
  // rather than re-reading $data.levelStack inside the loop — the documented
  // React/Solid/Lit setState-is-async stale-read (openTo's comment above).
  // $data.levelStack is written once at the end for render reactivity; the
  // query-restore / seedQuery / reopen happen ONCE with the final restored
  // query — the final visible state is identical to N sequential goBack()
  // calls, only the intermediate restores (invisible either way) are skipped.
  function jumpToLevel(targetDepth: any) {
    let stack = levelStack();
    if (targetDepth < 0 || targetDepth >= stack.length) return;
    // Level nav always resets to the list surface (spec §Composition) — mirror
    // goBack: a jump always resets to the list surface FIRST.
    closeAnySurface();
    let restoreQuery: any = null;
    while (stack.length > targetDepth) {
      const popped = popFrame(stack);
      stack = popped.stack;
      restoreQuery = popped.restoreQuery == null ? '' : popped.restoreQuery;
      _props.onBack?.();
    }
    setLevelStack(stack);
    requestToken = nextRequestToken(requestToken);
    const q = restoreQuery == null ? '' : restoreQuery;
    setQuery(q);
    comboboxRef?.seedQuery(q);
    setActiveValue(null);
    reopenComboboxPopup();
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
    // Inert guard (ARGS-SURFACE): the result list stays visibly open (dimmed +
    // aria-hidden) while the args surface owns focus — a stray commit from the
    // combobox (e.g. a residual pointer event) must never fire a leaf @select
    // out from under an in-progress args form. The onComboboxChange handler is
    // the SAME single entry point args auto-entry uses below, so this leading
    // guard covers every path.
    if (activeSurface() === 'args') return;
    const item = e ? e.option : null;
    if (!item || item.disabled) return;
    // args WINS over source/children navigation (spec: args × source mutually
    // exclusive) — checked BEFORE isNavigating so a source+args item enters
    // the args surface, never a child level.
    if (hasArgs(item)) {
      openArgsSurface(item);
      return;
    }
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

  // ---- action menu (ACT-SEAM/ACT-ARBITRATION/ACT-TRIGGER/ACT-KEEPOPEN) ---
  // The single reusable seam: open a focus-owning sub-surface over the list,
  // route Escape back to it, restore focus + reopen the list on close. Written
  // once (activeSurface: 'list' | 'actions') so #12 (inline command arguments)
  // reuses the identical transition shape for a future 'args' surface.
  //
  // $refs/$el usage note: bindings below use `$refs.panel` (the modal panel
  // div's existing `ref="panel"`), NOT the `$el` sigil — the panel is a
  // specific descendant the flyout/args surfaces need to query, whereas `$el`
  // is the component's own root. Quick 260717-8zb (Task 2 Item 3) VERIFIED
  // this file's `$refs.panel` reads are NOT affected by a typing gap: a
  // battery of probes (typed/untyped, self-shadow/non-self-shadow local name,
  // nested/top-level scope, `$refs.X` AND `$el`) all lower correctly on the
  // Svelte target — `isInTypePosition`'s ancestry walk correctly treats a
  // declarator's `id.typeAnnotation` as a SIBLING of `init`, never an
  // ancestor, so it never suppresses the init's rewrite. The prior comment's
  // premise (a `: any` type annotation on the bare `$refs.X`/`$el` declarator
  // breaks the Svelte lowering) was stale/incorrect — see
  // packages/targets/svelte/src/__tests__/typedRefsDeclarator.test.ts for the
  // permanent regression guard. `panel`/`frame` stay untyped here only because
  // that already matches the rest of this file's house style, not to dodge
  // any emitter gap.

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

  // highlightedItem() (finding 7a, index-keyed resolution): resolve the
  // combobox's currently-highlighted row back to its command object. Combobox
  // owns `activeIndex` internally (no public model for it), so this locates the
  // ACTIVE option element (`.rozie-combobox-option--active`) off the DOM via
  // `deepQuerySelector` (ROZ123-safe: called only from post-mount handlers,
  // never eagerly), then reads the `data-cp-index` the palette itself stamped
  // onto the `.rozie-command-palette-option-anchor` span wrapping its #option
  // re-projection (see the <template #option> comment above) — the row's
  // POSITIONAL index within filteredItems(), returning `filteredItems()[idx]`.
  //
  // This supersedes the earlier value-keyed scan (260715-vkr): `data-cp-value`
  // stamps commandValue(), which for an id-LESS command falls back to the item
  // object → '[object Object]' for every id-less row → they all collide and the
  // value scan returned the FIRST match regardless of which row was highlighted
  // (the wrong action menu + wrong @action-select payload). The positional
  // index is unique by construction, id or no id, and — like the value scan it
  // replaces — order-independent and cap-independent (combobox's own row index
  // is its CAPPED running index; a positional-into-orderedItems() scheme broke
  // once a section overflowed its cap). `data-cp-value` is retained as a
  // secondary sanity cross-check below. filteredItems() (not orderedItems()) is
  // the index space: it is the same pre-group-partition list
  // commandValue()/commandGroups() derive from.
  //
  // The '+N more' row renders combobox's OWN `#groupMore` slot, which the
  // palette does not fill — it carries no anchor, so `activeEl.querySelector`
  // finds nothing and this returns null (the no-op path for Assertion B).
  function highlightedItem() {
    const panel = panelRef;
    if (!panel) return null;
    const activeEl: any = deepQuerySelector(panel, '.rozie-combobox-option--active');
    // No active row element — e.g. a per-level-virtual level whose highlighted
    // row is windowed out of the rendered DOM (finding 7b). Graceful null →
    // canOpenActions(null) is false → the actionKey/Right-arrow trigger no-ops.
    // Full support for actions on a windowed-out row needs a combobox
    // `activeValue` exposure (a future combobox verb — not added here).
    if (!activeEl) return null;
    const anchorEl: any = activeEl.querySelector ? activeEl.querySelector('[data-cp-index]') : null;
    // No anchor — combobox's own '+N more' expand row renders combobox's
    // #groupMore (which the palette does not fill), so it carries no anchor →
    // null (not a command).
    if (!anchorEl) return null;
    const rawIndex = anchorEl.getAttribute('data-cp-index');
    if (rawIndex == null) return null;
    const idx = Number(rawIndex);
    if (!Number.isInteger(idx) || idx < 0) return null;
    const list = filteredItems();
    if (idx >= list.length) return null;
    const item = list[idx];
    // Secondary sanity (finding 7a): the stamped value must still agree — guards
    // a torn frame where the stamped DOM index outran a just-changed list. A
    // mismatch degrades to null (no menu) rather than opening the wrong command.
    const value = anchorEl.getAttribute('data-cp-value');
    if (value != null && String(commandValue(item)) !== value) return null;
    return item;
  }

  // searchInputEl(): the vendored combobox's underlying `<input role="combobox">`
  // — needed for the caret-at-end Right-arrow trigger gate (selectionStart/End
  // are not surfaced through the child's $expose handle). deepQuerySelector,
  // ROZ123-safe (called only from the post-mount panel keydown handler).
  function searchInputEl() {
    const panel = panelRef;
    return panel ? deepQuerySelector(panel, 'input[role="combobox"]') : null;
  }

  // focusFirstMenuItem(): move real DOM focus into the first enabled menuitem —
  // the ACT-ARBITRATION "real focus" guarantee. Deferred a frame by the caller
  // (openActionMenu) so the flyout has mounted first. The flyout is now a
  // FRAME child (sibling of the panel, finding 1), so this queries
  // `$refs.frame` — a light-DOM ancestor sharing the palette's OWN shadow
  // root as the flyout (no nested shadow between frame and flyout), so a
  // plain `querySelector` resolves it on all six.
  function focusFirstMenuItem() {
    const frame = frameRef;
    if (!frame) return;
    const el: any = frame.querySelector('[data-command-palette-menu] [role="menuitem"]:not([aria-disabled="true"])');
    if (el && typeof el.focus === 'function') el.focus();
  }

  // openActionMenu(item): guarded no-op unless canOpenActions(item). Anchors
  // the item + its resolved actions, lands actionIndex on the first ENABLED
  // action, reads the flyout's vertical offset off the highlighted row's
  // offsetTop, tells the vendored combobox to keepOpen (ACT-KEEPOPEN —
  // pinOpen(true), so blurring the input into the flyout does not collapse the
  // list), then moves real focus into the first enabled menuitem next frame.
  function openActionMenu(item: any) {
    if (!canOpenActions(item)) return;
    const actions = actionsOf(item);
    // Quick 260717-8zb (Task 2 Item 2): the flyout's `:aria-label` calls
    // `labelText($data.actionAnchor.item)` directly from the template
    // attribute binding. The prior workaround precomputed a `label` field here
    // to dodge an Angular emitter gap (a bare top-level-helper CALL inside a
    // hoisted double-read ternary getter survived un-`this.`-qualified —
    // ReferenceError at runtime); the emitter now `this.`-qualifies it, so the
    // natural direct-call form is restored.
    setActionAnchor({
      item,
      actions
    });
    setActionIndex(firstEnabledActionIndex(actions));
    setActiveSurface('actions');
    const panel = panelRef;
    const frame = frameRef;
    const activeRow: any = panel ? deepQuerySelector(panel, '.rozie-combobox-option--active') : null;
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
    setActionMenuTop(activeRow && frame ? activeRow.getBoundingClientRect().top - frame.getBoundingClientRect().top + frame.scrollTop : 0);
    comboboxRef?.pinOpen(true);
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        focusFirstMenuItem();
        // Viewport clamp (finding 1) — a menu opening on a 1-row panel must
        // never run off the viewport bottom. Reads DOM post-mount (rAF), so
        // the flyout has laid out. Shifts the menu UP only; never above the
        // frame top.
        const menuEl: any = frame ? frame.querySelector('[data-command-palette-menu]') : null;
        if (menuEl && frame) {
          const frameTop = frame.getBoundingClientRect().top;
          const menuH = menuEl.getBoundingClientRect().height;
          const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
          const maxTop = Math.max(0, vh - 8 - frameTop - menuH);
          if (actionMenuTop() > maxTop) setActionMenuTop(maxTop);
        }
      });
    } else {
      focusFirstMenuItem();
    }
  }

  // closeActionMenu(): the focus-restore invariant — ALWAYS returns to the
  // list surface, releases keepOpen (pinOpen(false)), and reopens the combobox
  // popup with focus back on the search input (reopenComboboxPopup — the
  // existing level-pop blur/refocus primitive, reused verbatim here).
  function closeActionMenu() {
    setActiveSurface('list');
    setActionIndex(-1);
    setActionAnchor(null);
    comboboxRef?.pinOpen(false);
    reopenComboboxPopup();
  }

  // ---- inline command arguments (ARGS-SURFACE/ARGS-SUBMIT/ARGS-ESCAPE, #12) --
  // Reuses the action-menu seam VERBATIM: pinOpen(true/false) + real
  // $refs.frame-rooted focus + reopenComboboxPopup on close (openActionMenu/
  // closeActionMenu's exact shape). The args-SPECIFIC pure logic (entry-init
  // with `default`, required-gating after trim, submit-payload trimming,
  // backspace-empty) lives in internal/argsSurface.ts (imported above) — this
  // script only orchestrates $refs/$data around it.

  // focusFirstArgField(): real DOM focus into the FIRST args <input> —
  // $refs.frame-rooted (a light-DOM ancestor sharing this component's OWN
  // shadow root as the args fields, mirroring focusFirstMenuItem). Also
  // selects the field's text (spec: "default prefills its field, selected on
  // focus so typing replaces") — a harmless no-op on an empty field.
  function focusFirstArgField() {
    const frame = frameRef;
    if (!frame) return;
    const el: any = frame.querySelector('[data-command-palette-args] input');
    if (el && typeof el.focus === 'function') el.focus();
    if (el && typeof el.select === 'function') el.select();
  }

  // focusArgFieldAt(idx): real DOM focus into the args field at `idx` — the
  // "focus the first unfilled required field instead of firing" submit-block
  // target (ARGS-SUBMIT).
  function focusArgFieldAt(idx: any) {
    const frame = frameRef;
    if (!frame) return;
    const els: any = frame.querySelectorAll('[data-command-palette-args] input');
    const el: any = els[idx];
    if (el && typeof el.focus === 'function') el.focus();
  }

  // openArgsSurface(item): guarded no-op unless hasArgs(item). Seeds
  // argsState (values via initArgValues — default-prefilled, fresh object;
  // argList via argsOf), lands activeSurface='args', pinOpen(true) (ACT-
  // KEEPOPEN — the result list stays visibly open but INERT, see
  // onComboboxChange's leading guard + the template's dimming wrapper), then
  // moves real focus into the first field next frame.
  function openArgsSurface(item: any) {
    if (!hasArgs(item)) return;
    const argList = argsOf(item);
    // Quick 260717-8zb (Task 2 Item 2): the chip's :aria-label calls
    // `labelText($data.argsState.item)` directly from the template (the same
    // Angular emitter gap openActionMenu dodged above — now fixed at the
    // emitter, so the precomputed `label` field workaround is dropped here too).
    setArgsState({
      item,
      values: initArgValues(argList),
      argList
    });
    setActiveSurface('args');
    // finding 2: arm the opening-Enter guard, disarmed on the next microtask —
    // after the opening keydown has finished bubbling through onPanelKeydown but
    // before any later user keystroke. Promise-based (SSR-safe, the
    // beginLevelLoad microtask precedent); a real Enter to submit lands in a
    // strictly later task.
    argsJustOpened = true;
    Promise.resolve().then(() => {
      argsJustOpened = false;
    });
    comboboxRef?.pinOpen(true);
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        focusFirstArgField();
      });
    } else {
      focusFirstArgField();
    }
  }

  // setArgValue(id, v): fresh-object write (the setup-once-persistence /
  // React-setState-is-async discipline — never member-mutate $data in place).
  function setArgValue(id: any, v: any) {
    const state = argsState();
    if (!state) return;
    setArgsState({
      ...state,
      values: {
        ...state.values,
        [id]: v
      }
    });
  }

  // setArgValueFor(id): a curried write helper — the #argsField slot scope's
  // `setValue` (mirrors data-table's editorCommitFor(colId) => (value) => …
  // curry-per-id pattern) rather than an inline arrow literal in the template
  // attribute.
  function setArgValueFor(id: any) {
    return (v: any) => setArgValue(id, v);
  }

  // onArgFieldInput(id, e): the default (unfilled #argsField) field's own
  // @input handler — untyped `e` neutralizes to `any` so reading
  // e.target.value typechecks ×6 (the global-filter idiom; never inline
  // `$data.x = $event.target.value` directly in the template).
  function onArgFieldInput(id: any, e: any) {
    setArgValue(id, e && e.target ? e.target.value : '');
  }

  // submitArgs(): captures a FRESH local of argList/values BEFORE any $data
  // write (the React stale-read guard — mirrors pushLevel/selectAction).
  // !canSubmitArgs -> focus the first unfilled required field and return (no
  // emit, no close — the "missing required" no-op). Otherwise fires the
  // EXISTING @select with the additive, trimmed `args` payload key, then
  // closes the args surface and — mirroring onComboboxChange's own leaf-select
  // path — closes the palette too iff closeOnSelect.
  function submitArgs() {
    const state = argsState();
    if (!state) return;
    const argList = state.argList;
    const values = state.values;
    if (!canSubmitArgs(argList, values)) {
      focusArgFieldAt(firstUnfilledRequiredIndex(argList, values));
      return;
    }
    const item = state.item;
    const path = levelStack().map((f: any) => f.item ? f.item.id : null);
    const args = buildArgsPayload(argList, values);
    _props.onSelect?.({
      item,
      path,
      args
    });
    setActiveValue(null);
    closeArgsSurface();
    if (local.closeOnSelect) closePalette();
  }

  // closeArgsSurface(): the focus-restore invariant — ALWAYS returns to the
  // list surface, releases keepOpen (pinOpen(false)), and reopens the combobox
  // popup with focus back on the search input (reopenComboboxPopup — reused
  // verbatim, the same primitive closeActionMenu uses).
  function closeArgsSurface() {
    setActiveSurface('list');
    setArgsState(null);
    comboboxRef?.pinOpen(false);
    reopenComboboxPopup();
  }

  // closeAnySurface(): a no-op at the list surface; otherwise routes to
  // whichever sub-surface transition-closer applies. The level-nav call sites
  // (pushLevel/goBack/jumpToLevel) always reset to the list surface first —
  // this is their single dispatch point so neither an open action menu NOR an
  // in-progress args surface (#12) can survive a level push/pop/jump.
  function closeAnySurface() {
    if (activeSurface() === 'args') closeArgsSurface();else if (activeSurface() !== 'list') closeActionMenu();
  }

  // roveAction(dir): disabled-skip clamped roving (internal/actionMenu.ts
  // rovingActionIndex — the combobox nextEnabled convention) over the anchored
  // item's actions, then moves real focus to the new index's menuitem.
  function roveAction(dir: any) {
    const anchor = actionAnchor();
    if (!anchor) return;
    const idx = rovingActionIndex(anchor.actions, actionIndex(), dir);
    setActionIndex(idx);
    // Re-rooted to $refs.frame (finding 1) — the flyout moved out of the
    // panel to be a frame child; see focusFirstMenuItem's comment.
    const frame = frameRef;
    if (!frame) return;
    const items: any = frame.querySelectorAll('[data-command-palette-menu] [role="menuitem"]');
    const el: any = items[idx];
    if (el && typeof el.focus === 'function') el.focus();
  }

  // selectAction(action): a disabled action is a no-op. Captures the anchored
  // item into a LOCAL first (React stale-read guard — closeActionMenu clears
  // $data.actionAnchor right after), fires the public `action-select` event,
  // ALWAYS closes the menu, then closes the palette too IFF closeOnAction.
  function selectAction(action: any) {
    if (!action || action.disabled) return;
    const anchor = actionAnchor();
    const item = anchor ? anchor.item : null;
    _props.onActionSelect?.({
      item,
      action
    });
    closeActionMenu();
    if (local.closeOnAction) closePalette();
  }

  // onActionMenuKeydown(e): the flyout's OWN keydown — focus is inside the
  // menu while this fires, so the vendored combobox never sees these keys.
  // Escape is DELIBERATELY not handled here — it bubbles up to onPanelKeydown's
  // single Escape funnel below. Every other handled key stops propagation so a
  // stale-but-now-'list'-surface bubble (e.g. the actionKey toggle-close,
  // which flips activeSurface to 'list' BEFORE the event finishes bubbling)
  // can't be re-interpreted as a fresh open-menu trigger by onPanelKeydown.
  function onActionMenuKeydown(e: any) {
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
      const anchor = actionAnchor();
      const action = anchor && Array.isArray(anchor.actions) ? anchor.actions[actionIndex()] : null;
      if (action) selectAction(action);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      closeActionMenu();
      return;
    }
    if (matchesActionKey(e, local.actionKey)) {
      e.preventDefault();
      e.stopPropagation();
      closeActionMenu();
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

  // Bubble-phase panel keydown (LVL-NAV, ACT-ARBITRATION, ACT-TRIGGER, ARGS-
  // SURFACE/ARGS-SUBMIT/ARGS-ESCAPE):
  //   - Escape: routed through resolveEscape(activeSurface, currentDepth()) —
  //     the SINGLE precedence oracle (menu-close/args-close > level-pop >
  //     palette-close-at-root). A sub-surface open (activeSurface!=='list')
  //     ALWAYS wins — closeArgsSurface()/closeActionMenu() (whichever surface
  //     is open) and STOP; only once the sub-surface is closed does Escape
  //     fall through to level-pop or root-close on a LATER keypress. The
  //     vendored <Combobox> (a child) sees the Escape FIRST on the bubble path
  //     and closes its OWN popup (Combobox.rozie onKeydown → isOpen=false);
  //     goBack()'s reopenComboboxPopup() re-opens it afterward so the restored
  //     parent level's list is visible.
  //   - Args surface (activeSurface==='args', #12): Enter submits (via
  //     submitArgs — regardless of which field has focus, per spec "Enter
  //     submits when valid"); Backspace on an empty FIRST field pops back to
  //     the list (isFirstFieldEmpty, gated on e.target === the first field so
  //     backspacing in a LATER empty field just edits text normally). Neither
  //     falls through to the level-nav Backspace-pop below — args entry/exit
  //     never emits @navigate/@back (spec §Composition).
  //   - actionKey (⌘K) / caret-at-end Right-arrow (ACT-TRIGGER): open the
  //     action menu for the highlighted row, but ONLY while activeSurface is
  //     'list' (the menu owns these keys itself once open, via
  //     onActionMenuKeydown) and the row canOpenActions — a no-op otherwise
  //     (an action-less row, or no highlighted row).
  //   - Backspace on an empty query at depth>0 → pop one level, but ONLY while
  //     activeSurface==='list' (Backspace must never pop a level while a
  //     sub-surface owns focus). Backspace does NOT close the combobox popup —
  //     its onKeydown ignores it — so the reopen is a harmless no-op cycle
  //     there. Otherwise Backspace edits the query text normally (never
  //     intercepted at the root or with text in the box).
  function onPanelKeydown(e: any) {
    if (!e) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      const route = resolveEscape(activeSurface(), currentDepth());
      if (route === 'close-surface') {
        if (activeSurface() === 'args') closeArgsSurface();else closeActionMenu();
      } else if (route === 'pop-level') goBack();else closePalette();
      return;
    }
    if (activeSurface() === 'args') {
      if (e.key === 'Enter') {
        e.preventDefault();
        // finding 2: swallow the very Enter that opened this surface (it bubbled
        // here from the vendored combobox's synchronous Enter commit). A real
        // submit needs a fresh Enter, after the guard disarms next microtask.
        if (argsJustOpened) return;
        submitArgs();
        return;
      }
      if (e.key === 'Backspace') {
        const state = argsState();
        const argList = state ? state.argList : [];
        const values = state ? state.values : {};
        const frame = frameRef;
        const firstInput: any = frame ? frame.querySelector('[data-command-palette-args] input') : null;
        if (e.target === firstInput && isFirstFieldEmpty(argList, values)) {
          e.preventDefault();
          closeArgsSurface();
        }
      }
      return;
    }
    if (activeSurface() === 'list') {
      if (matchesActionKey(e, local.actionKey)) {
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
    if (e.key === 'Backspace' && query() === '' && currentDepth() > 0 && activeSurface() === 'list') {
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
    {<Show when={open()}><Show when={(typeof document === 'undefined' ? null : (resolveAppendTo(local.appendTo)))} fallback={<div class={"rozie-command-palette"} onClick={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onBackdropClick($event); }} data-rozie-s-768cad96="">
      
      <div data-testid="command-palette-frame" ref={(el) => { frameRef = el as HTMLElement; }} class={"rozie-command-palette-frame"} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: Element }) => { onPanelKeydown($event); }} data-rozie-s-768cad96="">
      <div ref={(el) => { panelRef = el as HTMLElement; }} class={"rozie-command-palette-panel"} role="dialog" aria-modal="true" aria-label={local.ariaLabel} data-rozie-s-768cad96="">
        
        {<Show when={atDepth()}><div class={"rozie-command-palette-header"} data-rozie-s-768cad96="">
          {(_props.breadcrumbSlot ?? _props.slots?.['breadcrumb'])?.({ stack: breadcrumbStack(), back: goBack }) ?? <><button type="button" aria-label="Back" data-testid="command-palette-back" class={"rozie-command-palette-back"} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { goBack(); }} data-rozie-s-768cad96="">‹</button><nav class={"rozie-command-palette-breadcrumb-trail"} data-testid="command-palette-breadcrumb-trail" aria-label="Breadcrumb" data-rozie-s-768cad96="">
              <For each={breadcrumbStack()}>{(entry, ei) => <span class={"rozie-command-palette-breadcrumb-item"} data-rozie-s-768cad96="">
                {<Show when={Number(ei()) > 0}><span class={"rozie-command-palette-breadcrumb-separator"} aria-hidden="true" data-rozie-s-768cad96="">›</span></Show>}{<Show when={Number(ei()) < breadcrumbStack().length - 1} fallback={<span class={"rozie-command-palette-breadcrumb-segment rozie-command-palette-breadcrumb-segment--current"} data-testid="command-palette-title" data-rozie-s-768cad96="">{rozieDisplay(entry.title)}</span>}><button type="button" aria-label={rozieAttr('Back to ' + entry.title)} data-testid="command-palette-breadcrumb-jump" class={"rozie-command-palette-breadcrumb-segment rozie-command-palette-breadcrumb-segment--link"} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { jumpToLevel(Number(ei())); }} data-rozie-s-768cad96="">{rozieDisplay(entry.title)}</button></Show>}</span>}</For>
            </nav></>}
        </div></Show>}<div class={"rozie-command-palette-list-region" + " " + rozieClass({ 'rozie-command-palette-list-region--inert': activeSurface() === 'args' })} aria-hidden={!!(activeSurface() === 'args')} data-rozie-s-768cad96="">
        
        <Combobox aria-label={local.ariaLabel} ref={(el) => { comboboxRef = el as ComboboxHandle; }} inline={true} disableFilter={true} closeOnSelect={false} options={orderedItems()} groups={commandGroups()} groupCap={local.groupCap} virtual={currentVirtual()} maxHeight={currentVirtualMaxHeight()} estimateRowHeight={currentVirtualEstimateRowHeight()} optionValue={commandValue} optionDisabled={commandDisabled} placeholder={currentPlaceholder()} idBase={local.idBase} value={activeValue()} onValueChange={setActiveValue} onChange={($event) => { onComboboxChange($event); }} onSearch={($event) => { onComboboxSearch($event); }} data-rozie-s-768cad96="" optionSlot={({ option, index, active, selected, disabled }) => (<>
            <span class={"rozie-command-palette-option-anchor"} data-cp-index={rozieAttr(cpAnchorIndex(option))} data-cp-value={rozieAttr(commandValue(option))} data-rozie-s-768cad96="">
            {(_props.optionSlot ?? _props.slots?.['option'])?.({ option, index, active, selected, disabled, matches: labelHighlight(labelText(option), query()) }) ?? <div class={"rozie-command-palette-option"} data-rozie-s-768cad96="">
                {<Show when={(_props.iconSlot ?? _props.slots?.['icon'])}><span class={"rozie-command-palette-option-icon"} data-rozie-s-768cad96="">
                  {(_props.iconSlot ?? _props.slots?.['icon'])?.({ option })}
                </span></Show>}<span class={"rozie-command-palette-option-main"} data-rozie-s-768cad96="">
                  <span class={"rozie-command-palette-option-label"} data-rozie-s-768cad96="">
                    <For each={labelSegments(option)}>{(segment, si) => <span class={rozieClass({ 'rozie-command-palette-option-label-match': segment.match })} data-rozie-s-768cad96="">{rozieDisplay(segment.text)}</span>}</For>
                  </span>
                  {<Show when={groupText(option) && !grouped()}><span class={"rozie-command-palette-option-group"} data-rozie-s-768cad96="">{rozieDisplay(groupText(option))}</span></Show>}</span>
                
                {<Show when={hotKeyOf(option)}><span class={"rozie-command-palette-option-hotkey"} aria-hidden="true" data-rozie-s-768cad96="">{rozieDisplay(formatKeyToken(hotKeyOf(option), platformIsApple()))}</span></Show>}{<Show when={(_props.actionsSlot ?? _props.slots?.['actions']) || actionsList(option).length > 0}><span data-testid="command-palette-actions-affordance" class={"rozie-command-palette-option-actions"} onMouseDown={($event: MouseEvent & { currentTarget: HTMLSpanElement; target: Element }) => { $event.stopPropagation(); openActionMenu(option); }} data-rozie-s-768cad96="">
                  {(_props.actionsSlot ?? _props.slots?.['actions'])?.({ option, actions: actionsList(option) }) ?? <Show when={actionsList(option).length > 0}><span class={"rozie-command-palette-option-actions-hint"} aria-hidden="true" data-rozie-s-768cad96="">{rozieDisplay(actionKeyHint())}</span></Show>}
                </span></Show>}{<Show when={(_props.trailingSlot ?? _props.slots?.['trailing'])}><span class={"rozie-command-palette-option-trailing"} data-rozie-s-768cad96="">
                  {(_props.trailingSlot ?? _props.slots?.['trailing'])?.({ option })}
                </span></Show>}</div>}
            </span>
          </>)} groupHeadingSlot={({ group }) => (<>
            {(_props.groupHeadingSlot ?? _props.slots?.['groupHeading'])?.({ group }) ?? rozieDisplay(groupLabel(group))}
          </>)} emptySlot={({ query }) => (<>
            {<Show when={currentStatus() === 'ready'}>{(_props.emptySlot ?? _props.slots?.['empty'])?.({ query }) ?? local.emptyText}</Show>}</>)} />
        </div>

        
        {<Show when={activeSurface() === 'args'}><div data-command-palette-args="" data-testid="command-palette-args" class={"rozie-command-palette-args"} role="group" aria-label={rozieAttr('Arguments for ' + (argsState() ? labelText(argsState().item) : ''))} data-rozie-s-768cad96="">
          <span class={"rozie-command-palette-args-chip rozie-command-palette-breadcrumb-segment--current"} data-testid="command-palette-args-chip" aria-hidden="true" data-rozie-s-768cad96="">{rozieDisplay(argsState() ? labelText(argsState().item) : '')}</span>
          <Key each={(argsState() ? argsState().argList : []) as readonly any[]} by={(arg) => arg.id}>{(arg, argIdx) => <span class={"rozie-command-palette-args-field"} data-rozie-s-768cad96="">
            {(_props.argsFieldSlot ?? _props.slots?.['argsField'])?.({ item: argsState() ? argsState().item : null, arg: arg(), value: argsState() ? argsState().values[arg().id] : '', setValue: setArgValueFor(arg().id) }) ?? <input type="text" data-testid="command-palette-args-input" aria-label={rozieAttr(arg().placeholder || arg().id)} class={"rozie-command-palette-args-input"} value={argsState() ? argsState().values[arg().id] : ''} placeholder={rozieAttr(arg().placeholder || arg().id)} onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { onArgFieldInput(arg().id, $event); }} data-rozie-s-768cad96="" />}
          </span>}</Key>
        </div></Show>}{<Show when={currentStatus() === 'loading'} fallback={<Show when={currentStatus() === 'error'}><div class={"rozie-command-palette-error"} data-rozie-s-768cad96="">
          {(_props.errorSlot ?? _props.slots?.['error'])?.({ query: query(), error: currentError(), retry: retryCurrentLevel })}
        </div></Show>}><div class={"rozie-command-palette-loading"} data-rozie-s-768cad96="">
          {(_props.loadingSlot ?? _props.slots?.['loading'])?.({ query: query() }) ?? "Loading…"}
        </div></Show>}{<Show when={(_props.footerSlot ?? _props.slots?.['footer'])}><div class={"rozie-command-palette-footer"} data-rozie-s-768cad96="">
          {(_props.footerSlot ?? _props.slots?.['footer']?.({}))}
        </div></Show>}</div>

      
      {<Show when={atActions()}><div data-command-palette-menu="" data-testid="command-palette-actions-menu" role="menu" aria-label={rozieAttr(actionAnchor() ? labelText(actionAnchor().item) : null)} class={"rozie-command-palette-actions-menu"} style={parseInlineStyle('top:' + actionMenuTop() + 'px')} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: Element }) => { onActionMenuKeydown($event); }} data-rozie-s-768cad96="">
        <Key each={(actionAnchor() ? actionAnchor().actions : []) as readonly any[]} by={(action) => action.id}>{(action, ai) => <div role="menuitem" data-testid="command-palette-action-item" aria-disabled={!!action().disabled} class={"rozie-command-palette-actions-menu-item" + " " + rozieClass({ 'rozie-command-palette-actions-menu-item--active': ai() === actionIndex(), 'rozie-command-palette-actions-menu-item--disabled': !!action().disabled })} tabIndex={-1} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { setActionIndex(Number(ai())); }} onMouseDown={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { $event.preventDefault(); selectAction(action()); }} data-rozie-s-768cad96="">
          {(_props.actionItemSlot ?? _props.slots?.['actionItem'])?.({ action: action(), item: actionAnchor() ? actionAnchor().item : null, active: ai() === actionIndex(), disabled: !!action().disabled }) ?? <>{<Show when={actionIcon(action())}><span class={"rozie-command-palette-actions-menu-item-icon"} data-rozie-s-768cad96="">{rozieDisplay(actionIcon(action()))}</span></Show>}<span class={"rozie-command-palette-actions-menu-item-label"} data-rozie-s-768cad96="">{rozieDisplay(actionLabel(action()))}</span>{<Show when={actionShortcut(action())}><span class={"rozie-command-palette-actions-menu-item-shortcut"} data-rozie-s-768cad96="">{rozieDisplay(actionShortcut(action()))}</span></Show>}</>}
        </div>}</Key>
      </div></Show>}</div>
    </div>}><Portal mount={(typeof document === 'undefined' ? null : (resolveAppendTo(local.appendTo)))}><div class={"rozie-command-palette"} onClick={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onBackdropClick($event); }} data-rozie-s-768cad96="">
      
      <div data-testid="command-palette-frame" ref={(el) => { frameRef = el as HTMLElement; }} class={"rozie-command-palette-frame"} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: Element }) => { onPanelKeydown($event); }} data-rozie-s-768cad96="">
      <div ref={(el) => { panelRef = el as HTMLElement; }} class={"rozie-command-palette-panel"} role="dialog" aria-modal="true" aria-label={local.ariaLabel} data-rozie-s-768cad96="">
        
        {<Show when={atDepth()}><div class={"rozie-command-palette-header"} data-rozie-s-768cad96="">
          {(_props.breadcrumbSlot ?? _props.slots?.['breadcrumb'])?.({ stack: breadcrumbStack(), back: goBack }) ?? <><button type="button" aria-label="Back" data-testid="command-palette-back" class={"rozie-command-palette-back"} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { goBack(); }} data-rozie-s-768cad96="">‹</button><nav class={"rozie-command-palette-breadcrumb-trail"} data-testid="command-palette-breadcrumb-trail" aria-label="Breadcrumb" data-rozie-s-768cad96="">
              <For each={breadcrumbStack()}>{(entry, ei) => <span class={"rozie-command-palette-breadcrumb-item"} data-rozie-s-768cad96="">
                {<Show when={Number(ei()) > 0}><span class={"rozie-command-palette-breadcrumb-separator"} aria-hidden="true" data-rozie-s-768cad96="">›</span></Show>}{<Show when={Number(ei()) < breadcrumbStack().length - 1} fallback={<span class={"rozie-command-palette-breadcrumb-segment rozie-command-palette-breadcrumb-segment--current"} data-testid="command-palette-title" data-rozie-s-768cad96="">{rozieDisplay(entry.title)}</span>}><button type="button" aria-label={rozieAttr('Back to ' + entry.title)} data-testid="command-palette-breadcrumb-jump" class={"rozie-command-palette-breadcrumb-segment rozie-command-palette-breadcrumb-segment--link"} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { jumpToLevel(Number(ei())); }} data-rozie-s-768cad96="">{rozieDisplay(entry.title)}</button></Show>}</span>}</For>
            </nav></>}
        </div></Show>}<div class={"rozie-command-palette-list-region" + " " + rozieClass({ 'rozie-command-palette-list-region--inert': activeSurface() === 'args' })} aria-hidden={!!(activeSurface() === 'args')} data-rozie-s-768cad96="">
        
        <Combobox aria-label={local.ariaLabel} ref={(el) => { comboboxRef = el as ComboboxHandle; }} inline={true} disableFilter={true} closeOnSelect={false} options={orderedItems()} groups={commandGroups()} groupCap={local.groupCap} virtual={currentVirtual()} maxHeight={currentVirtualMaxHeight()} estimateRowHeight={currentVirtualEstimateRowHeight()} optionValue={commandValue} optionDisabled={commandDisabled} placeholder={currentPlaceholder()} idBase={local.idBase} value={activeValue()} onValueChange={setActiveValue} onChange={($event) => { onComboboxChange($event); }} onSearch={($event) => { onComboboxSearch($event); }} data-rozie-s-768cad96="" optionSlot={({ option, index, active, selected, disabled }) => (<>
            <span class={"rozie-command-palette-option-anchor"} data-cp-index={rozieAttr(cpAnchorIndex(option))} data-cp-value={rozieAttr(commandValue(option))} data-rozie-s-768cad96="">
            {(_props.optionSlot ?? _props.slots?.['option'])?.({ option, index, active, selected, disabled, matches: labelHighlight(labelText(option), query()) }) ?? <div class={"rozie-command-palette-option"} data-rozie-s-768cad96="">
                {<Show when={(_props.iconSlot ?? _props.slots?.['icon'])}><span class={"rozie-command-palette-option-icon"} data-rozie-s-768cad96="">
                  {(_props.iconSlot ?? _props.slots?.['icon'])?.({ option })}
                </span></Show>}<span class={"rozie-command-palette-option-main"} data-rozie-s-768cad96="">
                  <span class={"rozie-command-palette-option-label"} data-rozie-s-768cad96="">
                    <For each={labelSegments(option)}>{(segment, si) => <span class={rozieClass({ 'rozie-command-palette-option-label-match': segment.match })} data-rozie-s-768cad96="">{rozieDisplay(segment.text)}</span>}</For>
                  </span>
                  {<Show when={groupText(option) && !grouped()}><span class={"rozie-command-palette-option-group"} data-rozie-s-768cad96="">{rozieDisplay(groupText(option))}</span></Show>}</span>
                
                {<Show when={hotKeyOf(option)}><span class={"rozie-command-palette-option-hotkey"} aria-hidden="true" data-rozie-s-768cad96="">{rozieDisplay(formatKeyToken(hotKeyOf(option), platformIsApple()))}</span></Show>}{<Show when={(_props.actionsSlot ?? _props.slots?.['actions']) || actionsList(option).length > 0}><span data-testid="command-palette-actions-affordance" class={"rozie-command-palette-option-actions"} onMouseDown={($event: MouseEvent & { currentTarget: HTMLSpanElement; target: Element }) => { $event.stopPropagation(); openActionMenu(option); }} data-rozie-s-768cad96="">
                  {(_props.actionsSlot ?? _props.slots?.['actions'])?.({ option, actions: actionsList(option) }) ?? <Show when={actionsList(option).length > 0}><span class={"rozie-command-palette-option-actions-hint"} aria-hidden="true" data-rozie-s-768cad96="">{rozieDisplay(actionKeyHint())}</span></Show>}
                </span></Show>}{<Show when={(_props.trailingSlot ?? _props.slots?.['trailing'])}><span class={"rozie-command-palette-option-trailing"} data-rozie-s-768cad96="">
                  {(_props.trailingSlot ?? _props.slots?.['trailing'])?.({ option })}
                </span></Show>}</div>}
            </span>
          </>)} groupHeadingSlot={({ group }) => (<>
            {(_props.groupHeadingSlot ?? _props.slots?.['groupHeading'])?.({ group }) ?? rozieDisplay(groupLabel(group))}
          </>)} emptySlot={({ query }) => (<>
            {<Show when={currentStatus() === 'ready'}>{(_props.emptySlot ?? _props.slots?.['empty'])?.({ query }) ?? local.emptyText}</Show>}</>)} />
        </div>

        
        {<Show when={activeSurface() === 'args'}><div data-command-palette-args="" data-testid="command-palette-args" class={"rozie-command-palette-args"} role="group" aria-label={rozieAttr('Arguments for ' + (argsState() ? labelText(argsState().item) : ''))} data-rozie-s-768cad96="">
          <span class={"rozie-command-palette-args-chip rozie-command-palette-breadcrumb-segment--current"} data-testid="command-palette-args-chip" aria-hidden="true" data-rozie-s-768cad96="">{rozieDisplay(argsState() ? labelText(argsState().item) : '')}</span>
          <Key each={(argsState() ? argsState().argList : []) as readonly any[]} by={(arg) => arg.id}>{(arg, argIdx) => <span class={"rozie-command-palette-args-field"} data-rozie-s-768cad96="">
            {(_props.argsFieldSlot ?? _props.slots?.['argsField'])?.({ item: argsState() ? argsState().item : null, arg: arg(), value: argsState() ? argsState().values[arg().id] : '', setValue: setArgValueFor(arg().id) }) ?? <input type="text" data-testid="command-palette-args-input" aria-label={rozieAttr(arg().placeholder || arg().id)} class={"rozie-command-palette-args-input"} value={argsState() ? argsState().values[arg().id] : ''} placeholder={rozieAttr(arg().placeholder || arg().id)} onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { onArgFieldInput(arg().id, $event); }} data-rozie-s-768cad96="" />}
          </span>}</Key>
        </div></Show>}{<Show when={currentStatus() === 'loading'} fallback={<Show when={currentStatus() === 'error'}><div class={"rozie-command-palette-error"} data-rozie-s-768cad96="">
          {(_props.errorSlot ?? _props.slots?.['error'])?.({ query: query(), error: currentError(), retry: retryCurrentLevel })}
        </div></Show>}><div class={"rozie-command-palette-loading"} data-rozie-s-768cad96="">
          {(_props.loadingSlot ?? _props.slots?.['loading'])?.({ query: query() }) ?? "Loading…"}
        </div></Show>}{<Show when={(_props.footerSlot ?? _props.slots?.['footer'])}><div class={"rozie-command-palette-footer"} data-rozie-s-768cad96="">
          {(_props.footerSlot ?? _props.slots?.['footer']?.({}))}
        </div></Show>}</div>

      
      {<Show when={atActions()}><div data-command-palette-menu="" data-testid="command-palette-actions-menu" role="menu" aria-label={rozieAttr(actionAnchor() ? labelText(actionAnchor().item) : null)} class={"rozie-command-palette-actions-menu"} style={parseInlineStyle('top:' + actionMenuTop() + 'px')} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: Element }) => { onActionMenuKeydown($event); }} data-rozie-s-768cad96="">
        <Key each={(actionAnchor() ? actionAnchor().actions : []) as readonly any[]} by={(action) => action.id}>{(action, ai) => <div role="menuitem" data-testid="command-palette-action-item" aria-disabled={!!action().disabled} class={"rozie-command-palette-actions-menu-item" + " " + rozieClass({ 'rozie-command-palette-actions-menu-item--active': ai() === actionIndex(), 'rozie-command-palette-actions-menu-item--disabled': !!action().disabled })} tabIndex={-1} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { setActionIndex(Number(ai())); }} onMouseDown={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { $event.preventDefault(); selectAction(action()); }} data-rozie-s-768cad96="">
          {(_props.actionItemSlot ?? _props.slots?.['actionItem'])?.({ action: action(), item: actionAnchor() ? actionAnchor().item : null, active: ai() === actionIndex(), disabled: !!action().disabled }) ?? <>{<Show when={actionIcon(action())}><span class={"rozie-command-palette-actions-menu-item-icon"} data-rozie-s-768cad96="">{rozieDisplay(actionIcon(action()))}</span></Show>}<span class={"rozie-command-palette-actions-menu-item-label"} data-rozie-s-768cad96="">{rozieDisplay(actionLabel(action()))}</span>{<Show when={actionShortcut(action())}><span class={"rozie-command-palette-actions-menu-item-shortcut"} data-rozie-s-768cad96="">{rozieDisplay(actionShortcut(action()))}</span></Show>}</>}
        </div>}</Key>
      </div></Show>}</div>
    </div></Portal></Show></Show>}</>
  );
}
