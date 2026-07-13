import type { JSX } from 'solid-js';
import { Show, createEffect, createSignal, mergeProps, on, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieDisplay } from '@rozie/runtime-solid';
import Combobox, { type ComboboxHandle } from '@rozie-ui/combobox-solid';
import { filterCommands } from './internal/filterCommands';

// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list fed to the vendored <Combobox> as its `:options`.
// command-palette KEEPS its own label+keywords filter (filterCommands, A1) and
// runs <Combobox :filterable="false"> — combobox's built-in filter is label-only
// substring and would drop the keyword matching + source-order grouping. A plain
// function (called from the template binding AND handlers) — never $computed (the
// combobox value-vs-accessor split). Each item is passed through verbatim; combobox
// resolves its value via `optionValue` (below) and its label via `.label`.

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
}`);

interface OptionSlotCtx { option: any; index: any; active: any; selected: any; disabled: any; }

interface EmptySlotCtx { query: any; }

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
   * Id base for the combobox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase?: string;
  onSelect?: (...args: unknown[]) => void;
  optionSlot?: (ctx: OptionSlotCtx) => JSX.Element;
  emptySlot?: (ctx: EmptySlotCtx) => JSX.Element;
  footerSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: CommandPaletteHandle) => void;
}

export interface CommandPaletteHandle {
  show: (...args: any[]) => any;
  close: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  focus: (...args: any[]) => any;
}

export default function CommandPalette(_props: CommandPaletteProps): JSX.Element {
  const _merged = mergeProps({ items: (() => [])() as any[], placeholder: 'Type a command…', emptyText: 'No results.', closeOnSelect: true, ariaLabel: 'Command palette', idBase: 'rozie-command-palette' }, _props);
  const [local, attrs] = splitProps(_merged, ['open', 'query', 'items', 'placeholder', 'emptyText', 'closeOnSelect', 'ariaLabel', 'idBase', 'ref']);
  onMount(() => { local.ref?.({ show, close, toggle, focus }); });

  const [open, setOpen] = createControllableSignal<boolean>(_props as unknown as Record<string, unknown>, 'open', false);
  const [query, setQuery] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'query', '');
  const [activeValue, setActiveValue] = createSignal<any>(null);
  onMount(() => {
    if (open()) onOpen();
  });
  createEffect(on(() => (() => open())(), (v) => untrack(() => ((isOpen: any) => {
    if (isOpen) onOpen();
  })(v)), { defer: true }));
  let panelRef: HTMLElement | null = null;
  let comboboxRef: ComboboxHandle | null = null;

  // ---- derived views (plain functions, uniform ×6) -----------------------
  // The filtered command list fed to the vendored <Combobox> as its `:options`.
  // command-palette KEEPS its own label+keywords filter (filterCommands, A1) and
  // runs <Combobox :filterable="false"> — combobox's built-in filter is label-only
  // substring and would drop the keyword matching + source-order grouping. A plain
  // function (called from the template binding AND handlers) — never $computed (the
  // combobox value-vs-accessor split). Each item is passed through verbatim; combobox
  // resolves its value via `optionValue` (below) and its label via `.label`.
  function filteredItems() {
    const src = Array.isArray(local.items) ? local.items : [];
    return filterCommands(src, query());
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

  // ---- close funnel ------------------------------------------------------
  function closePalette() {
    setOpen(false);
  }

  // ---- selection ---------------------------------------------------------
  // Combobox's `@change` fires `{ value, option }` on each commit. Re-emit the
  // PUBLIC `select` event with the chosen command and (optionally) close. The
  // `option` IS the original command item (we feed items straight through as
  // combobox options), so read its id/label/group directly.
  function onComboboxChange(e: any) {
    const item = e ? e.option : null;
    if (!item || item.disabled) return;
    _props.onSelect?.({
      id: item.id,
      label: item.label,
      group: item.group
    });
    // Clear the internal selection so re-selecting the same command re-fires.
    setActiveValue(null);
    if (local.closeOnSelect) closePalette();
  }

  // Combobox's `@search` fires `{ query }` as the user types in its combobox input.
  // Pipe it into command-palette's own two-way `query` model — `filteredItems()`
  // then re-filters via filterCommands (keyword-aware). Capture the fresh value
  // (never re-read a just-written $data/$model key on React — it is stale).
  function onComboboxSearch(e: any) {
    setQuery(e && e.query !== undefined ? e.query : '');
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

  // On open: clear the query + internal selection, then focus the search input.
  // Runs from $onMount and the lazy open $watch callback, both post-mount.
  function onOpen() {
    setQuery('');
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

  // Escape closes from anywhere in the panel (the vendored <Combobox> only closes
  // its own popup on Escape; the palette overlay close is command-palette's).
  function onPanelKeydown(e: any) {
    if (e && e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  }

  // ---- imperative handle -------------------------------------------------
  // show()/close()/toggle() drive the `open` model. The OPEN verb is `show` (NOT
  // `open`) — an `open` verb collides with the `open` model on React (both collapse
  // onto the generated open/setOpen state). focus() focuses the vendored combobox's
  // control via its exposed handle (accepted ROZ137 Lit override). All post-mount →
  // $refs safe.
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
        
        <Combobox aria-label={local.ariaLabel} ref={(el) => { comboboxRef = el as ComboboxHandle; }} inline={true} disableFilter={true} closeOnSelect={false} options={filteredItems()} optionValue={commandValue} optionDisabled={commandDisabled} placeholder={local.placeholder} idBase={local.idBase} value={activeValue()} onValueChange={setActiveValue} onChange={($event) => { onComboboxChange($event); }} onSearch={($event) => { onComboboxSearch($event); }} data-rozie-s-768cad96="" optionSlot={({ option, index, active, selected, disabled }) => (<>
            {(_props.optionSlot ?? _props.slots?.['option'])?.({ option, index, active, selected, disabled }) ?? <div class={"rozie-command-palette-option"} data-rozie-s-768cad96="">
                <span class={"rozie-command-palette-option-label"} data-rozie-s-768cad96="">{rozieDisplay(labelText(option))}</span>
                {<Show when={groupText(option)}><span class={"rozie-command-palette-option-group"} data-rozie-s-768cad96="">{rozieDisplay(groupText(option))}</span></Show>}</div>}
          </>)} emptySlot={({ query }) => (<>
            {(_props.emptySlot ?? _props.slots?.['empty'])?.({ query }) ?? local.emptyText}
          </>)} />

        
        {<Show when={(_props.footerSlot ?? _props.slots?.['footer'])}><div class={"rozie-command-palette-footer"} data-rozie-s-768cad96="">
          {(_props.footerSlot ?? _props.slots?.['footer']?.({}))}
        </div></Show>}</div>
    </div></Show>}</>
  );
}
