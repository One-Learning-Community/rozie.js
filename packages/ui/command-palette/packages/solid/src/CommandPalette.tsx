import type { JSX } from 'solid-js';
import { For, Show, createEffect, createSignal, mergeProps, on, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
import { filterCommands } from './internal/filterCommands';

// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list, each carrying its filtered-list index `_i`. A plain
// function (called from the r-for AND handlers) — never $computed.

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
}`);

interface ItemSlotCtx { item: any; active: any; }

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
   * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase?: string;
  onSelect?: (...args: unknown[]) => void;
  itemSlot?: (ctx: ItemSlotCtx) => JSX.Element;
  emptySlot?: JSX.Element;
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
  const _merged = mergeProps({ items: (() => [])(), placeholder: 'Type a command…', emptyText: 'No results.', closeOnSelect: true, ariaLabel: 'Command palette', idBase: 'rozie-command-palette' }, _props);
  const [local, attrs] = splitProps(_merged, ['open', 'query', 'items', 'placeholder', 'emptyText', 'closeOnSelect', 'ariaLabel', 'idBase', 'ref']);
  onMount(() => { local.ref?.({ show, close, toggle, focus }); });

  const [open, setOpen] = createControllableSignal<boolean>(_props as unknown as Record<string, unknown>, 'open', false);
  const [query, setQuery] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'query', '');
  const [activeIndex, setActiveIndex] = createSignal(0);
  onMount(() => {
    if (open()) onOpen();
  });
  createEffect(on(() => (() => open())(), (v) => untrack(() => ((isOpen: any) => {
    if (isOpen) onOpen();
  })(v)), { defer: true }));
  let inputElRef: HTMLElement | null = null;

  // ---- derived views (plain functions, uniform ×6) -----------------------
  // The filtered command list, each carrying its filtered-list index `_i`. A plain
  // function (called from the r-for AND handlers) — never $computed.
  function filteredItems() {
    const src = Array.isArray(local.items) ? local.items : [];
    const list = filterCommands(src, query());
    return list.map((it: any, i: any) => ({
      id: it.id,
      label: it.label,
      group: it.group,
      keywords: it.keywords,
      disabled: !!it.disabled,
      _i: i
    }));
  }
  function optId(i: any) {
    return local.idBase + '-opt-' + i;
  }
  function listId() {
    return local.idBase + '-list';
  }
  function inputId() {
    return local.idBase + '-input';
  }

  // The active option's id for aria-activedescendant (null when none).
  function activeId() {
    const list = filteredItems();
    if (activeIndex() >= 0 && list[activeIndex()]) return optId(activeIndex());
    return null;
  }

  // Next selectable index in `dir` (+1/-1), skipping disabled, clamped to ends.
  function nextEnabled(list: any, from: any, dir: any) {
    let i = from;
    for (let step = 0; step < list.length; step++) {
      i = i + dir;
      if (i < 0) i = 0;
      if (i >= list.length) i = list.length - 1;
      if (list[i] && !list[i].disabled) return i;
      if (dir < 0 && i === 0 || dir > 0 && i === list.length - 1) break;
    }
    return from;
  }

  // First selectable index (or 0). Used to reset the highlight on open / re-filter.
  function firstEnabled(list: any) {
    for (let i = 0; i < list.length; i++) {
      if (list[i] && !list[i].disabled) return i;
    }
    return 0;
  }

  // ---- close funnel ------------------------------------------------------
  function closePalette() {
    setOpen(false);
  }

  // ---- selection ---------------------------------------------------------
  function selectItem(item: any) {
    if (!item || item.disabled) return;
    _props.onSelect?.({
      id: item.id,
      label: item.label,
      group: item.group
    });
    if (local.closeOnSelect) closePalette();
  }

  // ---- input + keyboard handlers -----------------------------------------
  function onInput(e: any) {
    const q = e && e.target ? e.target.value : '';
    setQuery(q);
    // Reset the highlight to the first enabled item of the NEW filtered list.
    const next = filterCommands(Array.isArray(local.items) ? local.items : [], q);
    setActiveIndex(firstEnabled(next));
  }
  function onKeydown(e: any) {
    const key = e ? e.key : '';
    const list = filteredItems();
    const ai = activeIndex();
    if (key === 'ArrowDown') {
      if (e) e.preventDefault();
      setActiveIndex(nextEnabled(list, ai, 1));
    } else if (key === 'ArrowUp') {
      if (e) e.preventDefault();
      setActiveIndex(nextEnabled(list, ai, -1));
    } else if (key === 'Home') {
      if (e) e.preventDefault();
      setActiveIndex(nextEnabled(list, -1, 1));
    } else if (key === 'End') {
      if (e) e.preventDefault();
      setActiveIndex(nextEnabled(list, list.length, -1));
    } else if (key === 'Enter') {
      if (ai >= 0 && list[ai]) {
        if (e) e.preventDefault();
        selectItem(list[ai]);
      }
    } else if (key === 'Escape') {
      if (e) e.preventDefault();
      closePalette();
    }
  }

  // Backdrop click: a click whose target IS the backdrop (not the panel/children).
  function onBackdropClick(e: any) {
    if (e && e.target === e.currentTarget) closePalette();
  }

  // ---- open/close reconcile ----------------------------------------------
  // On open: clear the query, reset the highlight, focus the input (post-mount →
  // $refs safe). Reading $refs here is ROZ123-safe (this runs from $onMount and
  // the lazy $watch callback, both post-mount).
  function onOpen() {
    setQuery('');
    setActiveIndex(firstEnabled(filterCommands(Array.isArray(local.items) ? local.items : [], '')));
    const el = inputElRef;
    if (el && el.focus) {
      // Defer a tick so the overlay is mounted before focusing.
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          const again = inputElRef;
          if (again && again.focus) again.focus();
        });
      } else {
        el.focus();
      }
    }
  }

  // ---- lifecycle ---------------------------------------------------------

  // ---- imperative handle -------------------------------------------------
  // show()/close()/toggle() drive the `open` model. The OPEN verb is `show` (NOT
  // `open`) — an `open` verb collides with the `open` model on React (both collapse
  // onto the generated open/setOpen state). focus() focuses the input (accepted
  // ROZ137 Lit override). All post-mount → $refs safe.
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
    return inputElRef?.focus();
  }

  return (
    <>
    {<Show when={open()}><div class={"rozie-command-palette"} onClick={($event) => { onBackdropClick($event); }} data-rozie-s-768cad96="">
      <div role="dialog" aria-modal="true" aria-label={local.ariaLabel} class={"rozie-command-palette-panel"} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-768cad96="">
        <div class={"rozie-command-palette-search"} data-rozie-s-768cad96="">
          <input type="text" role="combobox" aria-autocomplete="list" aria-expanded={!!open()} aria-controls={rozieAttr(listId())} aria-activedescendant={rozieAttr(activeId())} aria-label={local.ariaLabel} autocomplete="off" ref={(el) => { inputElRef = el as HTMLElement; }} class={"rozie-command-palette-input"} id={rozieAttr(inputId())} value={query()} placeholder={local.placeholder} onInput={($event) => { onInput($event); }} data-rozie-s-768cad96="" />
        </div>

        {<Show when={filteredItems().length > 0}><ul class={"rozie-command-palette-list"} id={rozieAttr(listId())} role="listbox" aria-label={local.ariaLabel} data-rozie-s-768cad96="">
          <For each={filteredItems()}>{(item) => <li role="option" aria-selected={item._i === activeIndex()} aria-disabled={!!item.disabled} class={"rozie-command-palette-option" + " " + rozieClass({ 'rozie-command-palette-option--active': item._i === activeIndex(), 'rozie-command-palette-option--disabled': item.disabled })} id={rozieAttr(optId(item._i))} onMouseDown={($event) => { $event.preventDefault(); selectItem(item); }} onMouseEnter={($event) => { setActiveIndex(item._i); }} data-rozie-s-768cad96="">
            {(_props.itemSlot ?? _props.slots?.['item'])?.({ item, active: item._i === activeIndex() }) ?? <><span class={"rozie-command-palette-option-label"} data-rozie-s-768cad96="">{rozieDisplay(item.label)}</span>{<Show when={item.group}><span class={"rozie-command-palette-option-group"} data-rozie-s-768cad96="">{rozieDisplay(item.group)}</span></Show>}</>}
          </li>}</For>
        </ul></Show>}{<Show when={filteredItems().length === 0}><div class={"rozie-command-palette-empty"} data-rozie-s-768cad96="">
          {(_props.emptySlot ?? _props.slots?.['empty']?.({})) ?? local.emptyText}
        </div></Show>}{<Show when={(_props.footerSlot ?? _props.slots?.['footer'])}><div class={"rozie-command-palette-footer"} data-rozie-s-768cad96="">
          {(_props.footerSlot ?? _props.slots?.['footer']?.({}))}
        </div></Show>}</div>
    </div></Show>}</>
  );
}
