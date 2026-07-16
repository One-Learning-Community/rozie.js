import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { RoziePortalController, adoptConsumerStyles, createLitControllableProperty, injectGlobalStyles, rozieAttr, rozieDisplay, rozieStyle } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';
import { ref } from 'lit/directives/ref.js';
import '@rozie-ui/combobox-lit';
import type { Combobox } from '@rozie-ui/combobox-lit';
import { scoreCommands, labelHighlight } from './internal/scoreCommands';
import { isNavigating, pushFrame, popFrame, currentFrame, settleFrame, failFrame, breadcrumb as buildBreadcrumb, depth as levelDepth, levelDefaultItems, levelVirtual, levelVirtualMaxHeight, levelVirtualEstimateRowHeight } from './internal/levelStack';
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

interface RozieBreadcrumbSlotCtx {
  stack: unknown;
  back: unknown;
}

interface RozieOptionSlotCtx {
  option: unknown;
  index: unknown;
  active: unknown;
  selected: unknown;
  disabled: unknown;
  matches: unknown;
}

interface RozieGroupHeadingSlotCtx {
  group: unknown;
}

interface RozieEmptySlotCtx {
  query: unknown;
}

interface RozieArgsFieldSlotCtx {
  item: unknown;
  arg: unknown;
  value: unknown;
  setValue: unknown;
}

interface RozieLoadingSlotCtx {
  query: unknown;
}

interface RozieErrorSlotCtx {
  query: unknown;
  error: unknown;
  retry: unknown;
}

interface RozieActionItemSlotCtx {
  action: unknown;
  item: unknown;
  active: unknown;
  disabled: unknown;
}

interface RozieIconSlotCtx {
  option: unknown;
}

interface RozieActionsSlotCtx {
  option: unknown;
  actions: unknown;
}

interface RozieTrailingSlotCtx {
  option: unknown;
}

@customElement('rozie-command-palette')
export default class CommandPalette extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
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
}
`;

  /**
   * Whether the palette overlay is shown (two-way `r-model`). Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`); every close path (backdrop click, Escape, selecting an item when `closeOnSelect`, the imperative `close()`) writes `open = false`. As one of two `model: true` props the component does not generate an Angular `ControlValueAccessor`.
   * @example
   * <CommandPalette r-model:open="paletteOpen" :items="commands" />
   */
  @property({ type: Boolean, attribute: 'open' }) _open_attr: boolean = false;
  private _openControllable = createLitControllableProperty<boolean>({ host: this, eventName: 'open-change', defaultValue: false, initialControlledValue: undefined });
  /**
   * The current search text (two-way `r-model`). Two-way bind it to read the query, or pre-seed it by setting a value alongside `open` — an open no longer clears it, so the palette opens filtered to that query. The component ranks `items` by this string via `score` (fuzzy-subsequence by default, matched over each item `label` plus its `keywords`, label weighted above keywords). Reset to `""` when the palette closes, so each plain open starts with a fresh search box.
   */
  @property({ type: String, attribute: 'query' }) _query_attr: string = '';
  private _queryControllable = createLitControllableProperty<string>({ host: this, eventName: 'query-change', defaultValue: '', initialControlledValue: undefined });
  /**
   * Custom ranking/exclusion hook: `(item, query) => number | null`. Return `null` to exclude an item from the results; otherwise higher numbers rank first. Leave unset (`default: null`) to use the built-in fuzzy-subsequence scorer (label weighted above keywords). A recency/frecency boost is added INSIDE `score` (e.g. `return baseScore + recencyBonus(item.id)`), not as a separate prop.
   * @example
   * <CommandPalette :score="(item, q) => item.label.includes(q) ? 1 : null" :items="commands" />
   */
  @property({ type: Function }) score: ((...args: any[]) => any) | null = null;
  /**
   * The command list — `[{ id, label, group?, keywords?, disabled?, icon?, actions? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; commands sharing an optional `group` string are bucketed under a labeled section heading (auto-derived, via the vendored combobox's native section groups) — commands with no `group` render first in a headingless block. The heading text is the `group` string itself; override its markup with the `#groupHeading` slot. Optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation. The optional `icon` and `actions` fields are display-only — unused by ranking — surfaced through the `#icon` and `#actions` option-row slots.
   */
  @property({ type: Array }) items: any[] = [];
  /**
   * Items shown when the query is empty (the empty/home state), resolved PER LEVEL. This top-level prop is the ROOT level's home view; a navigating item's own `defaultItems` field (alongside its `children`/`source`) is that CHILD level's home view. They render grouped when they carry `group` fields (composes with native sections, same as `items`), and scoring never reorders them (the empty-query short-circuit preserves author order). Typing a query switches to scored `items`/`source` results; clearing the query returns to `defaultItems`. This is the first-class replacement for branching on `query === ''` inside a `source` function — and the natural home for a recents/frecency list (composes with the `score` prop's recency boost). Leave unset (`default: () => []`) for today's behavior — no defaultItems is byte-behavior-identical to the full source-order list.
   * @example
   * <CommandPalette :default-items="recentCommands" :items="commands" />
   */
  @property({ type: Array }) defaultItems: any[] = [];
  /**
   * Placeholder text shown in the search input while the query is empty.
   */
  @property({ type: String, reflect: true }) placeholder: string = 'Type a command…';
  /**
   * Text shown when the query matches no items. Override the whole empty state with the `empty` slot when you need richer markup.
   */
  @property({ type: String, reflect: true }) emptyText: string = 'No results.';
  /**
   * Whether choosing an item closes the palette. Defaults to `true` (the cmdk convention); set to `false` to keep the palette open after a selection — e.g. for a multi-action menu where the user runs several commands in a row.
   */
  @property({ type: Boolean, reflect: true }) closeOnSelect: boolean = true;
  /**
   * Accessible name for the dialog surface (`aria-label` on the `role="dialog"` panel). Override it to match the palette's purpose (e.g. "Search commands").
   */
  @property({ type: String, reflect: true }) ariaLabel: string = 'Command palette';
  /**
   * Id base for the combobox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  @property({ type: String, reflect: true }) idBase: string = 'rozie-command-palette';
  /**
   * Debounce (ms) applied to a nested level's ASYNC `source(query)` keystroke refetch only — sync (`children`) levels re-rank locally on every keystroke with no debounce. Defaults to ~150ms (`internal/asyncSource.ts`'s `DEFAULT_SEARCH_DEBOUNCE`).
   * @example
   * <CommandPalette :search-debounce="300" :items="commands" />
   */
  @property({ type: Number, reflect: true }) searchDebounce: number = 150;
  /**
   * The keyboard shortcut that opens the highlighted row's action menu — a portable `$mod+<letter>` token (default `"$mod+k"`, i.e. ⌘K/Ctrl+K) matched via `(event.metaKey || event.ctrlKey) && event.key === <letter>`. A bare single-letter token (e.g. `"k"`) matches with no modifier required. Pressing it (or caret-at-end Right-arrow, or clicking the row's actions affordance) on a row with no `actions` is a no-op — the menu only opens for a row that has them.
   * @example
   * <CommandPalette action-key="$mod+j" :items="commands" />
   */
  @property({ type: String, reflect: true }) actionKey: string = '$mod+k';
  /**
   * Whether choosing an action closes the whole palette. Defaults to `true` — running an action ALWAYS closes the action menu itself; `closeOnAction` additionally decides whether the palette dismisses too (`false` returns to the result list with the palette still open, e.g. for firing several actions in a row).
   */
  @property({ type: Boolean, reflect: true }) closeOnAction: boolean = true;
  /**
   * Pass-through to the vendored combobox's `groupCap`: cap each command section to its first `groupCap` results with an expand-in-place '+N more' row. `0`/absent = uncapped (default). `groupCap` composes with per-row `actions`: the ⌘K/Right-arrow row action menu always anchors to the exact highlighted VISIBLE row (cap-aware, order-independent), and firing it on a '+N more' row is a no-op.
   */
  @property({ type: Number, reflect: true }) groupCap: number = 0;
  /**
   * Where the overlay portals to, escaping an ancestor `overflow:hidden`/`transform`/`filter`/`contain` that would otherwise clip a `position:fixed` overlay (e.g. an embedding iframe/app-shell with its own layout chrome). `false`/absent (default) renders in place — byte-behavior-identical to every existing consumer, zero churn. `true` or `'body'` portals to `document.body`. A CSS selector string portals to the first element that selector matches. An `Element` reference portals to that element directly. SSR-safe: falls back to in-place when `document` is unavailable. Token-placement note: theming custom properties (`--rozie-command-palette-*`) must be set on `:root` (or the `appendTo` container itself) to reach a portalled overlay — a host-scoped token does not cross the portal on any target.
   * @example
   * <CommandPalette append-to="body" :items="commands" />
   */
  @property({ type: Boolean }) appendTo: boolean | string = false;
  /**
   * Opt-in vertical windowing for a long list, resolved PER LEVEL — this prop is the ROOT level; a navigating item's own `virtual` field windows THAT child level instead. A virtual level renders FLAT: the auto-derived groups + `groupCap` + `#groupHeading` are inactive for that level (the vendored combobox's `isGrouped` requires `!virtual`) — popping back to a grouped non-virtual level restores its groups. Windowing needs a bounded scroll height — pair with `virtualMaxHeight`. Default `false` is byte-behavior-identical to today (non-windowed).
   * @example
   * <CommandPalette virtual virtual-max-height="320px" :items="longCommandList" />
   */
  @property({ type: Boolean, reflect: true }) virtual: boolean = false;
  /**
   * A CSS length string (e.g. `"320px"`) bounding the windowed scroll container while the active level is virtual, resolved PER LEVEL like `virtual` above — passed straight through to the vendored combobox's `maxHeight`. Distinct from and non-conflicting with the panel's own `--rozie-command-palette-max-height` token (that clips the WHOLE panel; this bounds the INNER windowed list). Ignored while the active level is not virtual.
   * @example
   * <CommandPalette virtual virtual-max-height="320px" :items="longCommandList" />
   */
  @property({ type: String, reflect: true }) virtualMaxHeight: string | null = null;
  /**
   * Estimated option row height (px) seeding the windowing engine, resolved PER LEVEL like `virtual` above. Unset falls back to the vendored combobox's own default (36px) — but command-palette rows are typically taller (an icon + a right-aligned hotkey badge), so a consumer windowing a real palette level should usually raise this.
   * @example
   * <CommandPalette virtual :virtual-estimate-row-height="44" :items="longCommandList" />
   */
  @property({ type: Number, reflect: true }) virtualEstimateRowHeight: number | null = null;
  private _activeValue = signal<any>(null);
  private _levelStack = signal<any[]>([]);
  private _activeSurface = signal('list');
  private _actionIndex = signal(-1);
  private _actionAnchor = signal<any>(null);
  private _actionMenuTop = signal(0);
  private _argsState = signal<any>(null);
  @query('[data-rozie-ref="frame"]') private _refFrame!: HTMLElement;
  @query('[data-rozie-ref="panel"]') private _refPanel!: HTMLElement;
  @query('[data-rozie-ref="combobox"]') private _refCombobox!: Combobox;
private __rozieWatchInitial_0 = true;

  @query('[data-rozie-portal-ref="__roziePortal0"]') private __roziePortal0!: HTMLElement;
  @query('[data-rozie-portal-anchor="__roziePortal0"]') private __roziePortal0Anchor!: HTMLElement;
  private __roziePortal0Controller = new RoziePortalController(this, () => this.__roziePortal0, () => this.__roziePortal0Anchor, () => (this.resolveAppendTo(this.appendTo)));

  @state() private _hasSlotBreadcrumb = false;
  @queryAssignedElements({ slot: 'breadcrumb', flatten: true }) private _slotBreadcrumbElements!: Element[];
  @property({ attribute: false }) breadcrumb?: (scope: { stack: unknown; back: unknown }) => unknown;
  @state() private _hasSlotOption = false;
  @queryAssignedElements({ slot: 'option', flatten: true }) private _slotOptionElements!: Element[];
  @property({ attribute: false }) option?: (scope: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown; matches: unknown }) => unknown;
  @state() private _hasSlotGroupHeading = false;
  @queryAssignedElements({ slot: 'groupHeading', flatten: true }) private _slotGroupHeadingElements!: Element[];
  @property({ attribute: false }) groupHeading?: (scope: { group: unknown }) => unknown;
  @state() private _hasSlotEmpty = false;
  @queryAssignedElements({ slot: 'empty', flatten: true }) private _slotEmptyElements!: Element[];
  @property({ attribute: false }) empty?: (scope: { query: unknown }) => unknown;
  @state() private _hasSlotArgsField = false;
  @queryAssignedElements({ slot: 'argsField', flatten: true }) private _slotArgsFieldElements!: Element[];
  @property({ attribute: false }) argsField?: (scope: { item: unknown; arg: unknown; value: unknown; setValue: unknown }) => unknown;
  @state() private _hasSlotLoading = false;
  @queryAssignedElements({ slot: 'loading', flatten: true }) private _slotLoadingElements!: Element[];
  @property({ attribute: false }) loading?: (scope: { query: unknown }) => unknown;
  @state() private _hasSlotError = false;
  @queryAssignedElements({ slot: 'error', flatten: true }) private _slotErrorElements!: Element[];
  @property({ attribute: false }) error?: (scope: { query: unknown; error: unknown; retry: unknown }) => unknown;
  @state() private _hasSlotFooter = false;
  @queryAssignedElements({ slot: 'footer', flatten: true }) private _slotFooterElements!: Element[];
  @state() private _hasSlotActionItem = false;
  @queryAssignedElements({ slot: 'actionItem', flatten: true }) private _slotActionItemElements!: Element[];
  @property({ attribute: false }) actionItem?: (scope: { action: unknown; item: unknown; active: unknown; disabled: unknown }) => unknown;
  @state() private _hasSlotIcon = false;
  @queryAssignedElements({ slot: 'icon', flatten: true }) private _slotIconElements!: Element[];
  @property({ attribute: false }) icon?: (scope: { option: unknown }) => unknown;
  @state() private _hasSlotActions = false;
  @queryAssignedElements({ slot: 'actions', flatten: true }) private _slotActionsElements!: Element[];
  @property({ attribute: false }) actions?: (scope: { option: unknown; actions: unknown }) => unknown;
  @state() private _hasSlotTrailing = false;
  @queryAssignedElements({ slot: 'trailing', flatten: true }) private _slotTrailingElements!: Element[];
  @property({ attribute: false }) trailing?: (scope: { option: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="breadcrumb"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotBreadcrumb = this._slotBreadcrumbElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="option"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotOption = this._slotOptionElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="groupHeading"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotGroupHeading = this._slotGroupHeadingElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="empty"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotEmpty = this._slotEmptyElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="argsField"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotArgsField = this._slotArgsFieldElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="loading"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotLoading = this._slotLoadingElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="error"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotError = this._slotErrorElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="footer"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotFooter = this._slotFooterElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="actionItem"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotActionItem = this._slotActionItemElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="icon"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotIcon = this._slotIconElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="actions"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotActions = this._slotActionsElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="trailing"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotTrailing = this._slotTrailingElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotBreadcrumb = Array.from(this.children).some((el) => el.getAttribute('slot') === 'breadcrumb');
    this._hasSlotOption = Array.from(this.children).some((el) => el.getAttribute('slot') === 'option');
    this._hasSlotGroupHeading = Array.from(this.children).some((el) => el.getAttribute('slot') === 'groupHeading');
    this._hasSlotEmpty = Array.from(this.children).some((el) => el.getAttribute('slot') === 'empty');
    this._hasSlotArgsField = Array.from(this.children).some((el) => el.getAttribute('slot') === 'argsField');
    this._hasSlotLoading = Array.from(this.children).some((el) => el.getAttribute('slot') === 'loading');
    this._hasSlotError = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    this._hasSlotFooter = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
    this._hasSlotActionItem = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actionItem');
    this._hasSlotIcon = Array.from(this.children).some((el) => el.getAttribute('slot') === 'icon');
    this._hasSlotActions = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actions');
    this._hasSlotTrailing = Array.from(this.children).some((el) => el.getAttribute('slot') === 'trailing');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.open)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      if (isOpen) this.onOpen();else {
        this._queryControllable.write('');
        this._levelStack.value = [];
        this._activeValue.value = null;
        // Reset the action/args surface directly (NOT closeActionMenu/
        // closeArgsSurface — the palette is closing, so there is no combobox
        // popup left to reopen/keepOpen-release; a plain reset keeps a reopen
        // starting clean, per spec §Composition).
        this._activeSurface.value = 'list';
        this._actionIndex.value = -1;
        this._actionAnchor.value = null;
        this._argsState.value = null;
        if (this.debounceTimerId != null) clearTimeout(this.debounceTimerId);
        this.debounceTimerId = null;
        this.requestToken = nextRequestToken(this.requestToken);
      }
    })(__watchVal); }); }));

    if (this.open) this.onOpen();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      () => {
        if (this.debounceTimerId != null) clearTimeout(this.debounceTimerId);
      };
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'open') this._openControllable.notifyAttributeChange(value !== null);
    if (name === 'query') this._queryControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
${this.open ? html`<span data-rozie-portal-anchor="__roziePortal0" hidden></span><div class="rozie-command-palette" @click=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onBackdropClick($event); }} data-rozie-portal-ref="__roziePortal0" data-rozie-s-768cad96>
  
  <div class="rozie-command-palette-frame" data-testid="command-palette-frame" @keydown=${($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onPanelKeydown($event); }} data-rozie-ref="frame" data-rozie-s-768cad96>
  <div class="rozie-command-palette-panel" role="dialog" aria-modal="true" aria-label=${this.ariaLabel} data-rozie-ref="panel" data-rozie-s-768cad96>
    
    ${this.atDepth() ? html`<div class="rozie-command-palette-header" data-rozie-s-768cad96>
      ${this.breadcrumb !== undefined ? this.breadcrumb({stack: this.breadcrumbStack(), back: this.goBack}) : html`<slot name="breadcrumb" data-rozie-params=${(() => { try { return JSON.stringify({stack: this.breadcrumbStack()}); } catch { return '{}'; } })()} @rozie-breadcrumb-back=${($event: CustomEvent) => ((this.goBack) as (...args: any[]) => any)($event.detail)}>
        <button class="rozie-command-palette-back" type="button" aria-label="Back" data-testid="command-palette-back" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.goBack(); }} data-rozie-s-768cad96>‹</button>
        <nav class="rozie-command-palette-breadcrumb-trail" data-testid="command-palette-breadcrumb-trail" aria-label="Breadcrumb" data-rozie-s-768cad96>
          ${repeat<any>(this.breadcrumbStack(), (entry, ei) => ei, (entry, ei) => html`<span class="rozie-command-palette-breadcrumb-item" key=${rozieAttr(ei)} data-rozie-s-768cad96>
            ${Number(ei) > 0 ? html`<span class="rozie-command-palette-breadcrumb-separator" aria-hidden="true" data-rozie-s-768cad96>›</span>` : nothing}${Number(ei) < this.breadcrumbStack().length - 1 ? html`<button class="rozie-command-palette-breadcrumb-segment rozie-command-palette-breadcrumb-segment--link" type="button" aria-label=${rozieAttr('Back to ' + entry.title)} data-testid="command-palette-breadcrumb-jump" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.jumpToLevel(Number(ei)); }} data-rozie-s-768cad96>${rozieDisplay(entry.title)}</button>` : html`<span class="rozie-command-palette-breadcrumb-segment rozie-command-palette-breadcrumb-segment--current" data-testid="command-palette-title" data-rozie-s-768cad96>${rozieDisplay(entry.title)}</span>`}</span>`)}
        </nav>
      </slot>`}
    </div>` : nothing}<div class="${Object.entries({ "rozie-command-palette-list-region": true, 'rozie-command-palette-list-region--inert': this._activeSurface.value === 'args' }).filter(([, v]) => v).map(([k]) => k).join(' ')}" aria-hidden=${!!(this._activeSurface.value === 'args')} data-rozie-s-768cad96>
    
    <rozie-combobox .inline=${true} .disableFilter=${true} .closeOnSelect=${false} .options=${this.orderedItems()} .groups=${this.commandGroups()} .groupCap=${this.groupCap} .virtual=${this.currentVirtual()} .maxHeight=${this.currentVirtualMaxHeight()} .estimateRowHeight=${this.currentVirtualEstimateRowHeight()} .optionValue=${this.commandValue} .optionDisabled=${this.commandDisabled} .placeholder=${this.currentPlaceholder()} .ariaLabel=${this.ariaLabel} .idBase=${this.idBase} .value=${this._activeValue.value} @value-change=${($event: CustomEvent) => { this._activeValue.value = $event.detail; }} @change=${(__rozieEv: Event) => { const $event = __rozieEv instanceof CustomEvent ? __rozieEv.detail : __rozieEv; this.onComboboxChange($event); }} @search=${(__rozieEv: Event) => { const $event = __rozieEv instanceof CustomEvent ? __rozieEv.detail : __rozieEv; this.onComboboxSearch($event); }} data-rozie-ref="combobox" data-rozie-s-768cad96 .option=${(scope: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown }) => html`
        <span class="rozie-command-palette-option-anchor" data-cp-value=${rozieAttr(this.commandValue(scope.option))} data-rozie-s-768cad96>
        ${this.option !== undefined ? this.option({option: scope.option, index: scope.index, active: scope.active, selected: scope.selected, disabled: scope.disabled, matches: labelHighlight(this.labelText(scope.option), this.query)}) : html`<slot name="option" data-rozie-params=${(() => { try { return JSON.stringify({option: scope.option, index: scope.index, active: scope.active, selected: scope.selected, disabled: scope.disabled, matches: labelHighlight(this.labelText(scope.option), this.query)}); } catch { return '{}'; } })()}>
          <div class="rozie-command-palette-option" data-rozie-s-768cad96>
            ${this._hasSlotIcon || this.icon !== undefined ? html`<span class="rozie-command-palette-option-icon" data-rozie-s-768cad96>
              ${this.icon !== undefined ? this.icon({option: scope.option}) : html`<slot name="icon" data-rozie-params=${(() => { try { return JSON.stringify({option: scope.option}); } catch { return '{}'; } })()}></slot>`}
            </span>` : nothing}<span class="rozie-command-palette-option-main" data-rozie-s-768cad96>
              <span class="rozie-command-palette-option-label" data-rozie-s-768cad96>
                ${repeat<any>(this.labelSegments(scope.option), (segment, si) => si, (segment, si) => html`<span class="${Object.entries({ 'rozie-command-palette-option-label-match': segment.match }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(si)} data-rozie-s-768cad96>${rozieDisplay(segment.text)}</span>`)}
              </span>
              ${this.groupText(scope.option) && !this.grouped() ? html`<span class="rozie-command-palette-option-group" data-rozie-s-768cad96>${rozieDisplay(this.groupText(scope.option))}</span>` : nothing}</span>
            
            ${this.hotKeyOf(scope.option) ? html`<span class="rozie-command-palette-option-hotkey" aria-hidden="true" data-rozie-s-768cad96>${rozieDisplay(formatKeyToken(this.hotKeyOf(scope.option), this.isApplePlatform()))}</span>` : nothing}${this._hasSlotActions || this.actions !== undefined || this.actionsList(scope.option).length > 0 ? html`<span class="rozie-command-palette-option-actions" data-testid="command-palette-actions-affordance" @mousedown=${($event: MouseEvent & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { $event.stopPropagation(); this.openActionMenu(scope.option); }} data-rozie-s-768cad96>
              ${this.actions !== undefined ? this.actions({option: scope.option, actions: this.actionsList(scope.option)}) : html`<slot name="actions" data-rozie-params=${(() => { try { return JSON.stringify({option: scope.option, actions: this.actionsList(scope.option)}); } catch { return '{}'; } })()}>
                ${this.actionsList(scope.option).length > 0 ? html`<span class="rozie-command-palette-option-actions-hint" aria-hidden="true" data-rozie-s-768cad96>${rozieDisplay(this.actionKeyHint())}</span>` : nothing}</slot>`}
            </span>` : nothing}${this._hasSlotTrailing || this.trailing !== undefined ? html`<span class="rozie-command-palette-option-trailing" data-rozie-s-768cad96>
              ${this.trailing !== undefined ? this.trailing({option: scope.option}) : html`<slot name="trailing" data-rozie-params=${(() => { try { return JSON.stringify({option: scope.option}); } catch { return '{}'; } })()}></slot>`}
            </span>` : nothing}</div>
        </slot>`}
        </span>
      `} .groupHeading=${(scope: { group: unknown }) => html`
        ${this.groupHeading !== undefined ? this.groupHeading({group: scope.group}) : html`<slot name="groupHeading" data-rozie-params=${(() => { try { return JSON.stringify({group: scope.group}); } catch { return '{}'; } })()}>${rozieDisplay(this.groupLabel(scope.group))}</slot>`}
      `} .empty=${(scope: { query: unknown }) => html`
        ${this.currentStatus() === 'ready' ? html`${this.empty !== undefined ? this.empty({query: scope.query}) : html`<slot name="empty" data-rozie-params=${(() => { try { return JSON.stringify({query: scope.query}); } catch { return '{}'; } })()}>${this.emptyText}</slot>`}` : nothing}`} ${ref((el: Element | undefined) => el && adoptConsumerStyles(el, (this.constructor as { styles?: unknown }).styles))}></rozie-combobox>
    </div>

    
    ${this._activeSurface.value === 'args' ? html`<div class="rozie-command-palette-args" data-command-palette-args="" data-testid="command-palette-args" role="group" aria-label=${rozieAttr('Arguments for ' + (this._argsState.value ? this._argsState.value.label : ''))} data-rozie-s-768cad96>
      <span class="rozie-command-palette-args-chip rozie-command-palette-breadcrumb-segment--current" data-testid="command-palette-args-chip" aria-hidden="true" data-rozie-s-768cad96>${rozieDisplay(this._argsState.value ? this._argsState.value.label : '')}</span>
      ${repeat<any>(this._argsState.value ? this._argsState.value.argList : [], (arg, argIdx) => arg.id, (arg, argIdx) => html`<span class="rozie-command-palette-args-field" key=${rozieAttr(arg.id)} data-rozie-s-768cad96>
        ${this.argsField !== undefined ? this.argsField({item: this._argsState.value ? this._argsState.value.item : null, arg: arg, value: this._argsState.value ? this._argsState.value.values[arg.id] : '', setValue: this.setArgValueFor(arg.id)}) : html`<slot name="argsField" data-rozie-params=${(() => { try { return JSON.stringify({item: this._argsState.value ? this._argsState.value.item : null, arg: arg, value: this._argsState.value ? this._argsState.value.values[arg.id] : '', setValue: this.setArgValueFor(arg.id)}); } catch { return '{}'; } })()}>
          <input class="rozie-command-palette-args-input" type="text" data-testid="command-palette-args-input" .value=${this._argsState.value ? this._argsState.value.values[arg.id] : ''} placeholder=${rozieAttr(arg.placeholder || arg.id)} aria-label=${rozieAttr(arg.placeholder || arg.id)} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onArgFieldInput(arg.id, $event); }} data-rozie-s-768cad96 />
        </slot>`}
      </span>`)}
    </div>` : nothing}${this.currentStatus() === 'loading' ? html`<div class="rozie-command-palette-loading" data-rozie-s-768cad96>
      ${this.loading !== undefined ? this.loading({query: this.query}) : html`<slot name="loading" data-rozie-params=${(() => { try { return JSON.stringify({query: this.query}); } catch { return '{}'; } })()}>Loading…</slot>`}
    </div>` : this.currentStatus() === 'error' ? html`<div class="rozie-command-palette-error" data-rozie-s-768cad96>
      ${this.error !== undefined ? this.error({query: this.query, error: this.currentError(), retry: this.retryCurrentLevel}) : html`<slot name="error" data-rozie-params=${(() => { try { return JSON.stringify({query: this.query, error: this.currentError()}); } catch { return '{}'; } })()} @rozie-error-retry=${($event: CustomEvent) => ((this.retryCurrentLevel) as (...args: any[]) => any)($event.detail)}></slot>`}
    </div>` : nothing}${this._hasSlotFooter ? html`<div class="rozie-command-palette-footer" data-rozie-s-768cad96>
      <slot name="footer"></slot>
    </div>` : nothing}</div>

  
  ${this.atActions() ? html`<div class="rozie-command-palette-actions-menu" data-command-palette-menu="" data-testid="command-palette-actions-menu" role="menu" aria-label=${rozieAttr(this._actionAnchor.value ? this._actionAnchor.value.label : null)} style=${rozieStyle('top:' + this._actionMenuTop.value + 'px')} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onActionMenuKeydown($event); }} data-rozie-s-768cad96>
    ${repeat<any>(this._actionAnchor.value ? this._actionAnchor.value.actions : [], (action, ai) => action.id, (action, ai) => html`<div class="${Object.entries({ "rozie-command-palette-actions-menu-item": true, 'rozie-command-palette-actions-menu-item--active': ai === this._actionIndex.value, 'rozie-command-palette-actions-menu-item--disabled': !!action.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(action.id)} role="menuitem" data-testid="command-palette-action-item" aria-disabled=${!!action.disabled} tabindex="-1" @mouseenter=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this._actionIndex.value = Number(ai); }} @mousedown=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { $event.preventDefault(); this.selectAction(action); }} data-rozie-s-768cad96>
      ${this.actionItem !== undefined ? this.actionItem({action: action, item: this._actionAnchor.value ? this._actionAnchor.value.item : null, active: ai === this._actionIndex.value, disabled: !!action.disabled}) : html`<slot name="actionItem" data-rozie-params=${(() => { try { return JSON.stringify({action: action, item: this._actionAnchor.value ? this._actionAnchor.value.item : null, active: ai === this._actionIndex.value, disabled: !!action.disabled}); } catch { return '{}'; } })()}>
        ${this.actionIcon(action) ? html`<span class="rozie-command-palette-actions-menu-item-icon" data-rozie-s-768cad96>${rozieDisplay(this.actionIcon(action))}</span>` : nothing}<span class="rozie-command-palette-actions-menu-item-label" data-rozie-s-768cad96>${rozieDisplay(this.actionLabel(action))}</span>
        ${this.actionShortcut(action) ? html`<span class="rozie-command-palette-actions-menu-item-shortcut" data-rozie-s-768cad96>${rozieDisplay(this.actionShortcut(action))}</span>` : nothing}</slot>`}
    </div>`)}
  </div>` : nothing}</div>
</div>` : nothing}`;
  }

  requestToken = 0;

  debounceTimerId: any = null;

  resolveAppendTo = (to: any) => {
  if (!to) return null;
  if (typeof document === 'undefined') return null;
  if (to === true || to === 'body') return document.body;
  if (typeof to === 'string') return document.querySelector(to);
  return to;
};

  currentItems = () => {
  const frame = currentFrame(this._levelStack.value);
  if (frame) {
    if (frame.status === 'loading' || frame.status === 'error') return [];
    return frame.resolvedItems;
  }
  return this.items;
};

  currentDefaultItems = () => {
  const frame = currentFrame(this._levelStack.value);
  return frame ? frame.defaultItems : this.defaultItems;
};

  currentBaseItems = () => {
  const q = String(this.query == null ? '' : this.query).trim();
  const defaults = this.currentDefaultItems();
  if (q === '' && Array.isArray(defaults) && defaults.length > 0) return defaults;
  return this.currentItems();
};

  currentDepth = () => levelDepth(this._levelStack.value);

  currentStatus = () => {
  const frame = currentFrame(this._levelStack.value);
  return frame ? frame.status : 'ready';
};

  currentError = () => {
  const frame = currentFrame(this._levelStack.value);
  return frame ? frame.error : null;
};

  atDepth = () => this.currentDepth() > 0;

  atActions = () => this._activeSurface.value === 'actions';

  currentTitle = () => {
  const frame = currentFrame(this._levelStack.value);
  return frame && frame.title != null ? frame.title : this.ariaLabel;
};

  currentPlaceholder = () => {
  const frame = currentFrame(this._levelStack.value);
  return frame && frame.placeholder != null ? frame.placeholder : this.placeholder;
};

  currentVirtual = () => {
  const frame = currentFrame(this._levelStack.value);
  return frame ? frame.virtual : this.virtual === true;
};

  currentVirtualMaxHeight = () => {
  const frame = currentFrame(this._levelStack.value);
  const raw = frame ? frame.virtualMaxHeight : this.virtualMaxHeight;
  return this.currentVirtual() && raw != null ? raw : '';
};

  currentVirtualEstimateRowHeight = () => {
  const frame = currentFrame(this._levelStack.value);
  const raw = frame ? frame.virtualEstimateRowHeight : this.virtualEstimateRowHeight;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 36;
};

  breadcrumbStack = () => buildBreadcrumb(this._levelStack.value, this.ariaLabel);

  filteredItems = () => scoreCommands(this.currentBaseItems(), this.query, this.score);

  groupedView = () => deriveCommandGroups(this.filteredItems());

  orderedItems = () => this.groupedView().ordered;

  commandGroups = () => this.groupedView().groups;

  grouped = () => this.commandGroups().length > 0;

  groupLabel = (g: any) => g && g.label !== undefined ? g.label : '';

  commandValue = (it: any) => it && it.id !== undefined ? it.id : it;

  commandDisabled = (it: any) => !!(it && it.disabled);

  labelText = (o: any) => o && o.label !== undefined ? o.label : '';

  groupText = (o: any) => o && o.group !== undefined ? o.group : '';

  actionsList = (o: any) => o && o.actions ? o.actions : [];

  hotKeyOf = (o: any) => o && o.hotKey ? o.hotKey : '';

  actionLabel = (a: any) => a && a.label !== undefined ? a.label : '';

  actionShortcut = (a: any) => a && a.shortcut !== undefined ? a.shortcut : undefined;

  actionIcon = (a: any) => a && a.icon !== undefined ? a.icon : undefined;

  isApplePlatform = () => {
  if (typeof navigator === 'undefined') return false;
  const p = (navigator.platform || '') + ' ' + (navigator.userAgent || '');
  return /Mac|iPhone|iPad|iPod/.test(p);
};

  actionKeyHint = () => {
  const k = this.actionKey;
  if (typeof k !== 'string') return '';
  return formatKeyToken(k, this.isApplePlatform());
};

  labelSegments = (o: any) => {
  const label = this.labelText(o);
  const ranges = labelHighlight(label, this.query);
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

  closePalette = () => {
  this._openControllable.write(false);
};

  applyAsyncResult = (token: any, promise: any) => {
  return promise.then((items: any) => {
    if (!isLatestRequest(token, this.requestToken)) return;
    this._levelStack.value = settleFrame(this._levelStack.value, Array.isArray(items) ? items : []);
  }, (error: any) => {
    if (!isLatestRequest(token, this.requestToken)) return;
    this._levelStack.value = failFrame(this._levelStack.value, error);
  });
};

  beginLevelLoad = (item: any, query: any) => {
  const resolved = resolveChildSource(item, query);
  if (resolved.kind === 'async') {
    this.requestToken = nextRequestToken(this.requestToken);
    this.applyAsyncResult(this.requestToken, resolved.promise);
    return;
  }
  if (resolved.kind === 'sync') {
    const items = resolved.items;
    Promise.resolve().then(() => {
      this._levelStack.value = settleFrame(this._levelStack.value, items);
    });
  }
};

  retryCurrentLevel = () => {
  const frame = currentFrame(this._levelStack.value);
  if (!frame || !frame.item || !isAsyncLevel(frame.item)) return;
  this.beginLevelLoad(frame.item, this.query);
};

  pushLevel = (item: any) => {
  // Level nav always resets to the list surface (spec §Composition) — a
  // navigating item's own action menu (or, feature #12, an in-progress args
  // surface), if somehow open, must not survive the push.
  this.closeAnySurface();
  const nextStack = pushFrame(this._levelStack.value, item, this.query);
  this._levelStack.value = nextStack;
  this._queryControllable.write('');
  this._activeValue.value = null;
  this._refCombobox?.clear();
  this.focusInput();
  this.dispatchEvent(new CustomEvent("navigate", {
    detail: {
      item,
      depth: nextStack.length
    },
    bubbles: true,
    composed: true
  }));
  // command-palette-13-empty-home-view-first: an item carrying a non-empty
  // defaultItems is seeded 'ready' by pushFrame — skip the initial
  // beginLevelLoad('') kick-off entirely (no source('') call, no loading
  // flash). Typing still triggers the debounced source(query) refetch below
  // (onComboboxSearch); clearing back to '' returns to the home view without
  // ever invoking source.
  if (isAsyncLevel(item) && levelDefaultItems(item).length === 0) this.beginLevelLoad(item, '');
};

  goBack = () => {
  if (this._levelStack.value.length === 0) return;
  // Level nav always resets to the list surface (spec §Composition) — pop
  // closes an open action menu (or args surface, feature #12) FIRST.
  this.closeAnySurface();
  const {
    stack,
    restoreQuery
  } = popFrame(this._levelStack.value);
  this._levelStack.value = stack;
  this.requestToken = nextRequestToken(this.requestToken);
  const q = restoreQuery == null ? '' : restoreQuery;
  this._queryControllable.write(q);
  this._refCombobox?.seedQuery(q);
  this._activeValue.value = null;
  this.reopenComboboxPopup();
  this.dispatchEvent(new CustomEvent("back", {
    detail: undefined,
    bubbles: true,
    composed: true
  }));
};

  jumpToLevel = (targetDepth: any) => {
  let stack = this._levelStack.value;
  if (targetDepth < 0 || targetDepth >= stack.length) return;
  // Level nav always resets to the list surface (spec §Composition) — mirror
  // goBack: a jump always resets to the list surface FIRST.
  this.closeAnySurface();
  let restoreQuery: any = null;
  while (stack.length > targetDepth) {
    const popped = popFrame(stack);
    stack = popped.stack;
    restoreQuery = popped.restoreQuery == null ? '' : popped.restoreQuery;
    this.dispatchEvent(new CustomEvent("back", {
      detail: undefined,
      bubbles: true,
      composed: true
    }));
  }
  this._levelStack.value = stack;
  this.requestToken = nextRequestToken(this.requestToken);
  const q = restoreQuery == null ? '' : restoreQuery;
  this._queryControllable.write(q);
  this._refCombobox?.seedQuery(q);
  this._activeValue.value = null;
  this.reopenComboboxPopup();
};

  openTo = async (path: any) => {
  this._openControllable.write(true);
  let stack = [];
  this._levelStack.value = stack;
  this._queryControllable.write('');
  const ids = Array.isArray(path) ? path : [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const list = stack.length === 0 ? this.items : stack[stack.length - 1].resolvedItems;
    const item = Array.isArray(list) ? list.find((it: any) => it && it.id === id) : null;
    if (!item) break;
    stack = pushFrame(stack, item, '');
    this._levelStack.value = stack;
    const resolved = resolveChildSource(item, '');
    if (resolved.kind === 'async') {
      this.requestToken = nextRequestToken(this.requestToken);
      const token = this.requestToken;
      try {
        const items = await resolved.promise;
        if (isLatestRequest(token, this.requestToken)) {
          stack = settleFrame(stack, Array.isArray(items) ? items : []);
          this._levelStack.value = stack;
        }
      } catch (error: any) {
        if (isLatestRequest(token, this.requestToken)) {
          stack = failFrame(stack, error);
          this._levelStack.value = stack;
        }
      }
    } else if (resolved.kind === 'sync') {
      stack = settleFrame(stack, resolved.items);
      this._levelStack.value = stack;
    }
  }
  this._activeValue.value = null;
  // Defer the combobox ref touch a frame (the onOpen() precedent) — openTo
  // may have just flipped `open` false→true in THIS call, so the overlay +
  // <Combobox> may not be mounted yet on every target when the drill loop's
  // awaits resolve.
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      this._refCombobox?.clear();
      this.focusInput();
    });
  } else {
    this._refCombobox?.clear();
    this.focusInput();
  }
};

  onComboboxChange = (e: any) => {
  // Inert guard (ARGS-SURFACE): the result list stays visibly open (dimmed +
  // aria-hidden) while the args surface owns focus — a stray commit from the
  // combobox (e.g. a residual pointer event) must never fire a leaf @select
  // out from under an in-progress args form. The onComboboxChange handler is
  // the SAME single entry point args auto-entry uses below, so this leading
  // guard covers every path.
  if (this._activeSurface.value === 'args') return;
  const item = e ? e.option : null;
  if (!item || item.disabled) return;
  // args WINS over source/children navigation (spec: args × source mutually
  // exclusive) — checked BEFORE isNavigating so a source+args item enters
  // the args surface, never a child level.
  if (hasArgs(item)) {
    this.openArgsSurface(item);
    return;
  }
  if (isNavigating(item)) {
    this.pushLevel(item);
    return;
  }
  const path = this._levelStack.value.map((f: any) => f.item ? f.item.id : null);
  this.dispatchEvent(new CustomEvent("select", {
    detail: {
      item,
      path
    },
    bubbles: true,
    composed: true
  }));
  // Clear the internal selection so re-selecting the same command re-fires.
  this._activeValue.value = null;
  if (this.closeOnSelect) this.closePalette();
};

  onComboboxSearch = (e: any) => {
  const q = e && e.query !== undefined ? e.query : '';
  this._queryControllable.write(q);
  const frame = currentFrame(this._levelStack.value);
  if (!frame || !isAsyncLevel(frame.item)) return;
  // command-palette-13-empty-home-view-first: clearing back to '' on a level
  // that carries defaultItems must NOT refetch (no source('') call) and must
  // NOT let a late in-flight source result stomp the restored home view —
  // bump the token (drops any in-flight resolution), clear any pending
  // debounce timer, and return. currentBaseItems() already swaps back to
  // the frame's defaultItems on the next render via filteredItems().
  if (q === '' && levelDefaultItems(frame.item).length > 0) {
    this.requestToken = nextRequestToken(this.requestToken);
    if (this.debounceTimerId != null) clearTimeout(this.debounceTimerId);
    this.debounceTimerId = null;
    return;
  }
  this.requestToken = nextRequestToken(this.requestToken);
  const token = this.requestToken;
  const item = frame.item;
  if (this.debounceTimerId != null) clearTimeout(this.debounceTimerId);
  this.debounceTimerId = setTimeout(() => {
    const resolved = resolveChildSource(item, q);
    if (resolved.kind === 'sync') {
      if (isLatestRequest(token, this.requestToken)) {
        this._levelStack.value = settleFrame(this._levelStack.value, resolved.items);
      }
      return;
    }
    if (resolved.kind === 'async') this.applyAsyncResult(token, resolved.promise);
  }, this.searchDebounce);
};

  onBackdropClick = (e: any) => {
  if (e && e.target === e.currentTarget) this.closePalette();
};

  focusInput = () => {
  this._refCombobox?.focus();
};

  deepActiveElement = () => {
  let node = typeof document !== 'undefined' ? document.activeElement : null;
  while (node && node.shadowRoot && node.shadowRoot.activeElement) {
    node = node.shadowRoot.activeElement;
  }
  return node;
};

  reopenComboboxPopup = () => {
  // `any` — document.activeElement types as `Element` (no `.blur`); the deepest
  // focused node is really an HTMLElement across all six leaves.
  const active: any = this.deepActiveElement();
  if (active && typeof active.blur === 'function') active.blur();
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      this.focusInput();
    });
  } else {
    this.focusInput();
  }
};

  deepQuerySelector = (root: any, selector: any) => {
  if (!root || typeof root.querySelector !== 'function') return null;
  const direct = root.querySelector(selector);
  if (direct) return direct;
  const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
  for (let i = 0; i < all.length; i++) {
    const sr = all[i].shadowRoot;
    if (sr) {
      const found = this.deepQuerySelector(sr, selector);
      if (found) return found;
    }
  }
  return null;
};

  highlightedItem = () => {
  const panel = this._refPanel;
  if (!panel) return null;
  const activeEl: any = this.deepQuerySelector(panel, '.rozie-combobox-option--active');
  if (!activeEl) return null;
  const anchorEl: any = activeEl.querySelector ? activeEl.querySelector('[data-cp-value]') : null;
  if (!anchorEl) return null;
  const value = anchorEl.getAttribute('data-cp-value');
  if (value == null) return null;
  const list = this.filteredItems();
  for (let i = 0; i < list.length; i++) {
    if (String(this.commandValue(list[i])) === value) return list[i];
  }
  return null;
};

  searchInputEl = () => {
  const panel = this._refPanel;
  return panel ? this.deepQuerySelector(panel, 'input[role="combobox"]') : null;
};

  focusFirstMenuItem = () => {
  const frame = this._refFrame;
  if (!frame) return;
  const el: any = frame.querySelector('[data-command-palette-menu] [role="menuitem"]:not([aria-disabled="true"])');
  if (el && typeof el.focus === 'function') el.focus();
};

  openActionMenu = (item: any) => {
  if (!canOpenActions(item)) return;
  const actions = actionsOf(item);
  // The flyout's `:aria-label` reads `$data.actionAnchor.label` (a plain
  // PROPERTY read, computed here in script) rather than calling
  // `labelText(item)` directly from the template attribute binding — a bare
  // top-level-helper CALL inside a plain (non-slot-scoped) `:attr` binding
  // throws `labelText is not defined` on the Angular target specifically
  // (the emitter's `this.`-qualification pass doesn't reach that binding
  // shape) — a source-level workaround, not an emitter change.
  this._actionAnchor.value = {
    item,
    actions,
    label: this.labelText(item)
  };
  this._actionIndex.value = firstEnabledActionIndex(actions);
  this._activeSurface.value = 'actions';
  const panel = this._refPanel;
  const frame = this._refFrame;
  const activeRow: any = panel ? this.deepQuerySelector(panel, '.rozie-combobox-option--active') : null;
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
  this._actionMenuTop.value = activeRow && frame ? activeRow.getBoundingClientRect().top - frame.getBoundingClientRect().top + frame.scrollTop : 0;
  this._refCombobox?.pinOpen(true);
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      this.focusFirstMenuItem();
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
        if (this._actionMenuTop.value > maxTop) this._actionMenuTop.value = maxTop;
      }
    });
  } else {
    this.focusFirstMenuItem();
  }
};

  closeActionMenu = () => {
  this._activeSurface.value = 'list';
  this._actionIndex.value = -1;
  this._actionAnchor.value = null;
  this._refCombobox?.pinOpen(false);
  this.reopenComboboxPopup();
};

  focusFirstArgField = () => {
  const frame = this._refFrame;
  if (!frame) return;
  const el: any = frame.querySelector('[data-command-palette-args] input');
  if (el && typeof el.focus === 'function') el.focus();
  if (el && typeof el.select === 'function') el.select();
};

  focusArgFieldAt = (idx: any) => {
  const frame = this._refFrame;
  if (!frame) return;
  const els: any = frame.querySelectorAll('[data-command-palette-args] input');
  const el: any = els[idx];
  if (el && typeof el.focus === 'function') el.focus();
};

  openArgsSurface = (item: any) => {
  if (!hasArgs(item)) return;
  const argList = argsOf(item);
  // The chip's :aria-label reads $data.argsState.label (a plain PROPERTY
  // read, computed here in script) rather than calling labelText(item)
  // directly from a template attribute binding — a bare top-level-helper
  // CALL inside a plain (non-slot-scoped) :attr binding throws on Angular
  // specifically (the same trap openActionMenu's actionAnchor.label
  // precomputation dodges above) — a source-level workaround, not an
  // emitter change.
  this._argsState.value = {
    item,
    values: initArgValues(argList),
    label: this.labelText(item),
    argList
  };
  this._activeSurface.value = 'args';
  this._refCombobox?.pinOpen(true);
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      this.focusFirstArgField();
    });
  } else {
    this.focusFirstArgField();
  }
};

  setArgValue = (id: any, v: any) => {
  const state = this._argsState.value;
  if (!state) return;
  this._argsState.value = {
    ...state,
    values: {
      ...state.values,
      [id]: v
    }
  };
};

  setArgValueFor = (id: any) => (v: any) => this.setArgValue(id, v);

  onArgFieldInput = (id: any, e: any) => {
  this.setArgValue(id, e && e.target ? e.target.value : '');
};

  submitArgs = () => {
  const state = this._argsState.value;
  if (!state) return;
  const argList = state.argList;
  const values = state.values;
  if (!canSubmitArgs(argList, values)) {
    this.focusArgFieldAt(firstUnfilledRequiredIndex(argList, values));
    return;
  }
  const item = state.item;
  const path = this._levelStack.value.map((f: any) => f.item ? f.item.id : null);
  const args = buildArgsPayload(argList, values);
  this.dispatchEvent(new CustomEvent("select", {
    detail: {
      item,
      path,
      args
    },
    bubbles: true,
    composed: true
  }));
  this._activeValue.value = null;
  this.closeArgsSurface();
  if (this.closeOnSelect) this.closePalette();
};

  closeArgsSurface = () => {
  this._activeSurface.value = 'list';
  this._argsState.value = null;
  this._refCombobox?.pinOpen(false);
  this.reopenComboboxPopup();
};

  closeAnySurface = () => {
  if (this._activeSurface.value === 'args') this.closeArgsSurface();else if (this._activeSurface.value !== 'list') this.closeActionMenu();
};

  roveAction = (dir: any) => {
  const anchor = this._actionAnchor.value;
  if (!anchor) return;
  const idx = rovingActionIndex(anchor.actions, this._actionIndex.value, dir);
  this._actionIndex.value = idx;
  // Re-rooted to $refs.frame (finding 1) — the flyout moved out of the
  // panel to be a frame child; see focusFirstMenuItem's comment.
  const frame = this._refFrame;
  if (!frame) return;
  const items: any = frame.querySelectorAll('[data-command-palette-menu] [role="menuitem"]');
  const el: any = items[idx];
  if (el && typeof el.focus === 'function') el.focus();
};

  selectAction = (action: any) => {
  if (!action || action.disabled) return;
  const anchor = this._actionAnchor.value;
  const item = anchor ? anchor.item : null;
  this.dispatchEvent(new CustomEvent("action-select", {
    detail: {
      item,
      action
    },
    bubbles: true,
    composed: true
  }));
  this.closeActionMenu();
  if (this.closeOnAction) this.closePalette();
};

  onActionMenuKeydown = (e: any) => {
  if (!e) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    e.stopPropagation();
    this.roveAction(1);
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    this.roveAction(-1);
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
    const anchor = this._actionAnchor.value;
    const action = anchor && Array.isArray(anchor.actions) ? anchor.actions[this._actionIndex.value] : null;
    if (action) this.selectAction(action);
    return;
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    e.stopPropagation();
    this.closeActionMenu();
    return;
  }
  if (matchesActionKey(e, this.actionKey)) {
    e.preventDefault();
    e.stopPropagation();
    this.closeActionMenu();
  }
};

  onOpen = () => {
  this._activeValue.value = null;
  // Defer a tick so the overlay + <Combobox> are mounted before focusing.
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      this.focusInput();
    });
  } else {
    this.focusInput();
  }
};

  onPanelKeydown = (e: any) => {
  if (!e) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    const route = resolveEscape(this._activeSurface.value, this.currentDepth());
    if (route === 'close-surface') {
      if (this._activeSurface.value === 'args') this.closeArgsSurface();else this.closeActionMenu();
    } else if (route === 'pop-level') this.goBack();else this.closePalette();
    return;
  }
  if (this._activeSurface.value === 'args') {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.submitArgs();
      return;
    }
    if (e.key === 'Backspace') {
      const state = this._argsState.value;
      const argList = state ? state.argList : [];
      const values = state ? state.values : {};
      const frame = this._refFrame;
      const firstInput: any = frame ? frame.querySelector('[data-command-palette-args] input') : null;
      if (e.target === firstInput && isFirstFieldEmpty(argList, values)) {
        e.preventDefault();
        this.closeArgsSurface();
      }
    }
    return;
  }
  if (this._activeSurface.value === 'list') {
    if (matchesActionKey(e, this.actionKey)) {
      const item = this.highlightedItem();
      if (canOpenActions(item)) {
        e.preventDefault();
        this.openActionMenu(item);
      }
      return;
    }
    if (e.key === 'ArrowRight') {
      const input: any = this.searchInputEl();
      const item = this.highlightedItem();
      const value = input && input.value != null ? String(input.value) : '';
      if (input && caretAtEnd(input.selectionStart, input.selectionEnd, value.length) && canOpenActions(item)) {
        e.preventDefault();
        this.openActionMenu(item);
        return;
      }
    }
  }
  if (e.key === 'Backspace' && this.query === '' && this.currentDepth() > 0 && this._activeSurface.value === 'list') {
    e.preventDefault();
    this.goBack();
  }
};

  show = () => {
  this._openControllable.write(true);
};

  close = () => {
  this.closePalette();
};

  toggle = () => {
  this._openControllable.write(!this.open);
};

  focus = () => this.focusInput();

  get open(): boolean { return this._openControllable.read(); }
  set open(v: boolean) { this._openControllable.notifyPropertyWrite(v); }
  get query(): string { return this._queryControllable.read(); }
  set query(v: string) { this._queryControllable.notifyPropertyWrite(v); }
}

injectGlobalStyles('rozie-command-palette-global', `
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
}
`);
