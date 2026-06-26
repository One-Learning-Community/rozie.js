<script lang="ts">
import Listbox from './Listbox.svelte';
import { rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onMount, untrack } from 'svelte';

interface Props {
  /**
   * Whether the palette overlay is shown (two-way `r-model`). Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`); every close path (backdrop click, Escape, selecting an item when `closeOnSelect`, the imperative `close()`) writes `open = false`. As one of two `model: true` props the component does not generate an Angular `ControlValueAccessor`.
   * @example
   * <CommandPalette r-model:open="paletteOpen" :items="commands" />
   */
  open?: boolean;
  /**
   * The current search text (two-way `r-model`). Two-way bind it to read or pre-seed the query; the component filters `items` by this string over each item `label` plus its `keywords`. Cleared to `""` whenever the palette opens.
   */
  query?: string;
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
  option?: Snippet<[{ option: any; index: any; active: any; selected: any; disabled: any }]>;
  empty?: Snippet<[{ query: any }]>;
  footer?: Snippet;
  snippets?: Record<string, any>;
  onselect?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultItems = (() => [])();

let {
  open = $bindable(false),
  query = $bindable(''),
  items = __defaultItems,
  placeholder = 'Type a command…',
  emptyText = 'No results.',
  closeOnSelect = true,
  ariaLabel = 'Command palette',
  idBase = 'rozie-command-palette',
  option: __optionProp,
  empty: __emptyProp,
  footer: __footerProp,
  snippets,
  onselect,
  ...__rozieAttrs
}: Props = $props();

const option$$slot = $derived(__optionProp ?? snippets?.option);
const empty$$slot = $derived(__emptyProp ?? snippets?.empty);
const footer = $derived(__footerProp ?? snippets?.footer);

let activeValue: any = $state(null);

let panel = $state<HTMLElement | undefined>(undefined);

import { filterCommands } from './internal/filterCommands';

// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list fed to the vendored <Listbox> as its `:options`.
// command-palette KEEPS its own label+keywords filter (filterCommands, A1) and
// runs <Listbox :filterable="false"> — listbox's built-in filter is label-only
// substring and would drop the keyword matching + source-order grouping. A plain
// function (called from the template binding AND handlers) — never $computed (the
// listbox value-vs-accessor split). Each item is passed through verbatim; listbox
// resolves its value via `optionValue` (below) and its label via `.label`.
// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list fed to the vendored <Listbox> as its `:options`.
// command-palette KEEPS its own label+keywords filter (filterCommands, A1) and
// runs <Listbox :filterable="false"> — listbox's built-in filter is label-only
// substring and would drop the keyword matching + source-order grouping. A plain
// function (called from the template binding AND handlers) — never $computed (the
// listbox value-vs-accessor split). Each item is passed through verbatim; listbox
// resolves its value via `optionValue` (below) and its label via `.label`.
const filteredItems = () => {
  const src = Array.isArray(items) ? items : [];
  return filterCommands(src, query);
};

// The vendored <Listbox> commits the OPTION's value; resolve each command's value
// to its stable `id` (the key passed back on `select`). disabled is resolved off
// the item's own `disabled` flag (listbox's default `.disabled` fallback already
// handles it, but we pass an explicit resolver for clarity + safety on primitives).
// The vendored <Listbox> commits the OPTION's value; resolve each command's value
// to its stable `id` (the key passed back on `select`). disabled is resolved off
// the item's own `disabled` flag (listbox's default `.disabled` fallback already
// handles it, but we pass an explicit resolver for clarity + safety on primitives).
const commandValue = (it: any) => it && it.id !== undefined ? it.id : it;
const commandDisabled = (it: any) => !!(it && it.disabled);

// Default-fill display helpers. The re-projected #option scope param `option`
// threads as `unknown` on the Lit leaf (the cross-target slot-param-type gap), so
// the default fill content reads its label/group through these UNTYPED helpers
// (neutralized to `any`) rather than `option.label` directly — keeps the Lit leaf
// typechecking without a per-target cast.
// Default-fill display helpers. The re-projected #option scope param `option`
// threads as `unknown` on the Lit leaf (the cross-target slot-param-type gap), so
// the default fill content reads its label/group through these UNTYPED helpers
// (neutralized to `any`) rather than `option.label` directly — keeps the Lit leaf
// typechecking without a per-target cast.
const labelText = (o: any) => o && o.label !== undefined ? o.label : '';
const groupText = (o: any) => o && o.group !== undefined ? o.group : '';

// ---- close funnel ------------------------------------------------------
// ---- close funnel ------------------------------------------------------
const closePalette = () => {
  open = false;
};

// ---- selection ---------------------------------------------------------
// Listbox's `@change` fires `{ value, option }` on each commit. Re-emit the
// PUBLIC `select` event with the chosen command and (optionally) close. The
// `option` IS the original command item (we feed items straight through as
// listbox options), so read its id/label/group directly.
// ---- selection ---------------------------------------------------------
// Listbox's `@change` fires `{ value, option }` on each commit. Re-emit the
// PUBLIC `select` event with the chosen command and (optionally) close. The
// `option` IS the original command item (we feed items straight through as
// listbox options), so read its id/label/group directly.
const onListboxChange = (e: any) => {
  const item = e ? e.option : null;
  if (!item || item.disabled) return;
  onselect?.({
    id: item.id,
    label: item.label,
    group: item.group
  });
  // Clear the internal selection so re-selecting the same command re-fires.
  activeValue = null;
  if (closeOnSelect) closePalette();
};

// Listbox's `@search` fires `{ query }` as the user types in its combobox input.
// Pipe it into command-palette's own two-way `query` model — `filteredItems()`
// then re-filters via filterCommands (keyword-aware). Capture the fresh value
// (never re-read a just-written $data/$model key on React — it is stale).
// Listbox's `@search` fires `{ query }` as the user types in its combobox input.
// Pipe it into command-palette's own two-way `query` model — `filteredItems()`
// then re-filters via filterCommands (keyword-aware). Capture the fresh value
// (never re-read a just-written $data/$model key on React — it is stale).
const onListboxSearch = (e: any) => {
  query = e && e.query !== undefined ? e.query : '';
};

// Backdrop click: a click whose target IS the backdrop (not the panel/children).
// Backdrop click: a click whose target IS the backdrop (not the panel/children).
const onBackdropClick = (e: any) => {
  if (e && e.target === e.currentTarget) closePalette();
};

// ---- open/close reconcile ----------------------------------------------
// Focus the vendored <Listbox>'s combobox <input>; focusing it fires the
// listbox's `@focus="open"` → the popup opens (the screenshot demo seeds the
// palette open, so this runs on mount). The five light-DOM targets render the
// input directly under the panel, so a plain `querySelector('input')` finds it.
// On Lit the <Listbox> compiles to a `<rozie-listbox>` CUSTOM ELEMENT whose input
// lives in its (open) SHADOW ROOT — a panel-level query can't reach it, so the
// palette never opened and rendered 0 options. Fall back to piercing the child
// element's open shadow root on Lit. A `$refs.listbox.focusControl()` handle call
// would be cleaner but is blocked by the refs-lowering type gap (a composed-
// component ref types inconsistently across targets, not as the ListboxHandle).
// $refs read in a post-mount callback only (ROZ123-safe).
// ---- open/close reconcile ----------------------------------------------
// Focus the vendored <Listbox>'s combobox <input>; focusing it fires the
// listbox's `@focus="open"` → the popup opens (the screenshot demo seeds the
// palette open, so this runs on mount). The five light-DOM targets render the
// input directly under the panel, so a plain `querySelector('input')` finds it.
// On Lit the <Listbox> compiles to a `<rozie-listbox>` CUSTOM ELEMENT whose input
// lives in its (open) SHADOW ROOT — a panel-level query can't reach it, so the
// palette never opened and rendered 0 options. Fall back to piercing the child
// element's open shadow root on Lit. A `$refs.listbox.focusControl()` handle call
// would be cleaner but is blocked by the refs-lowering type gap (a composed-
// component ref types inconsistently across targets, not as the ListboxHandle).
// $refs read in a post-mount callback only (ROZ123-safe).
const focusInput = () => {
  const panel$local = panel;
  if (!panel$local) return;
  const input = panel$local.querySelector('input') || panel$local.querySelector('rozie-listbox')?.shadowRoot?.querySelector('input');
  if (input && input.focus) input.focus();
};

// On open: clear the query + internal selection, then focus the search input.
// Runs from $onMount and the lazy open $watch callback, both post-mount.
// On open: clear the query + internal selection, then focus the search input.
// Runs from $onMount and the lazy open $watch callback, both post-mount.
const onOpen = () => {
  query = '';
  activeValue = null;
  // Defer a tick so the overlay + <Listbox> are mounted before focusing.
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      focusInput();
    });
  } else {
    focusInput();
  }
};

// ---- lifecycle ---------------------------------------------------------
// Escape closes from anywhere in the panel (the vendored <Listbox> only closes
// its own popup on Escape; the palette overlay close is command-palette's).
const onPanelKeydown = (e: any) => {
  if (e && e.key === 'Escape') {
    e.preventDefault();
    closePalette();
  }
};

// ---- imperative handle -------------------------------------------------
// show()/close()/toggle() drive the `open` model. The OPEN verb is `show` (NOT
// `open`) — an `open` verb collides with the `open` model on React (both collapse
// onto the generated open/setOpen state). focus() focuses the vendored listbox's
// control via its exposed handle (accepted ROZ137 Lit override). All post-mount →
// $refs safe.
// ---- imperative handle -------------------------------------------------
// show()/close()/toggle() drive the `open` model. The OPEN verb is `show` (NOT
// `open`) — an `open` verb collides with the `open` model on React (both collapse
// onto the generated open/setOpen state). focus() focuses the vendored listbox's
// control via its exposed handle (accepted ROZ137 Lit override). All post-mount →
// $refs safe.
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

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => open)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
  if (isOpen) onOpen();
})(__watchVal); }); });
</script>

{#if open}<div class="rozie-command-palette" onclick={($event) => { onBackdropClick($event); }} data-rozie-s-768cad96><div bind:this={panel} class="rozie-command-palette-panel" role="dialog" aria-modal="true" aria-label={ariaLabel} onkeydown={($event) => { onPanelKeydown($event); }} data-rozie-s-768cad96><Listbox combobox={true} inline={true} filterable={false} closeOnSelect={false} options={filteredItems()} optionValue={commandValue} optionDisabled={commandDisabled} placeholder={placeholder} aria-label={ariaLabel} id={idBase} bind:value={activeValue} onchange={($event) => { onListboxChange($event); }} onsearch={($event) => { onListboxSearch($event); }} data-rozie-s-768cad96>{#snippet option({ option, index, active, selected, disabled })}{#if option$$slot}{@render option$$slot({ option, index, active, selected, disabled })}{:else}<span class="rozie-command-palette-option-label" data-rozie-s-768cad96>{rozieDisplay(labelText(option))}</span>{#if groupText(option)}<span class="rozie-command-palette-option-group" data-rozie-s-768cad96>{rozieDisplay(groupText(option))}</span>{/if}{/if}{/snippet}{#snippet empty({ query })}{#if empty$$slot}{@render empty$$slot({ query })}{:else}{emptyText}{/if}{/snippet}</Listbox>{#if footer}<div class="rozie-command-palette-footer" data-rozie-s-768cad96>{#if footer}{@render footer()}{/if}</div>{/if}</div></div>{/if}

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
    justify-content: space-between;
    gap: var(--rozie-command-palette-option-gap, 0.75rem);
    padding: var(--rozie-command-palette-option-padding, 0.5rem 0.625rem);
    border-radius: var(--rozie-command-palette-option-radius, 0.5rem);
    cursor: pointer;
    color: var(--rozie-command-palette-option-color, inherit);
  }
  .rozie-command-palette-option--active[data-rozie-s-768cad96] {
    background: var(--rozie-command-palette-option-active-bg, rgba(0, 102, 204, 0.12));
    color: var(--rozie-command-palette-option-active-color, inherit);
  }
  .rozie-command-palette-option--disabled[data-rozie-s-768cad96] {
    cursor: not-allowed;
    opacity: var(--rozie-command-palette-option-disabled-opacity, 0.45);
  }
  .rozie-command-palette-option-group[data-rozie-s-768cad96] {
    font-size: var(--rozie-command-palette-group-font-size, 0.75rem);
    color: var(--rozie-command-palette-group-color, rgba(0, 0, 0, 0.5));
    text-transform: var(--rozie-command-palette-group-transform, uppercase);
    letter-spacing: 0.04em;
  }
  .rozie-command-palette-empty[data-rozie-s-768cad96] {
    padding: var(--rozie-command-palette-empty-padding, 1.5rem);
    text-align: center;
    color: var(--rozie-command-palette-empty-color, rgba(0, 0, 0, 0.5));
  }
  .rozie-command-palette-footer[data-rozie-s-768cad96] {
    padding: var(--rozie-command-palette-footer-padding, 0.5rem 0.75rem);
    border-top: var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1));
    font-size: var(--rozie-command-palette-footer-font-size, 0.8125rem);
    color: var(--rozie-command-palette-footer-color, rgba(0, 0, 0, 0.55));
  }
}
</style>
