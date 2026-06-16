<script lang="ts">
import { applyListeners, rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onDestroy } from 'svelte';

interface Props {
  options?: any[];
  value?: (unknown) | null;
  multiple?: boolean;
  combobox?: boolean;
  filterable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  closeOnSelect?: boolean;
  optionLabel?: ((...args: any[]) => any) | null;
  optionValue?: ((...args: any[]) => any) | null;
  optionDisabled?: ((...args: any[]) => any) | null;
  id?: string;
  ariaLabel?: (string) | null;
  selected?: Snippet<[{ selected: any; value: any }]>;
  option?: Snippet<[{ option: any; index: any; active: any; selected: any; disabled: any }]>;
  empty?: Snippet<[{ query: any }]>;
  snippets?: Record<string, any>;
  onopenchange?: (...args: unknown[]) => void;
  onchange?: (...args: unknown[]) => void;
  onsearch?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultOptions = (() => [])();

let {
  options = __defaultOptions,
  value = $bindable(null),
  multiple = false,
  combobox = false,
  filterable = true,
  disabled = false,
  placeholder = '',
  closeOnSelect = true,
  optionLabel = null,
  optionValue = null,
  optionDisabled = null,
  id = 'rozie-listbox',
  ariaLabel = null,
  selected: __selectedProp,
  option: __optionProp,
  empty: __emptyProp,
  snippets,
  onopenchange,
  onchange,
  onsearch,
  ...__rozieAttrs
}: Props = $props();

const selected = $derived(__selectedProp ?? snippets?.selected);
const option = $derived(__optionProp ?? snippets?.option);
const empty = $derived(__emptyProp ?? snippets?.empty);

let open$local = $state(false);
let activeIndex = $state(-1);
let query = $state('');

let controlEl = $state<HTMLElement | undefined>(undefined);
let inputEl = $state<HTMLInputElement | undefined>(undefined);
let triggerEl = $state<HTMLButtonElement | undefined>(undefined);
let listEl = $state<HTMLElement | undefined>(undefined);

// Type-ahead buffer for select-only (non-combobox) listboxes. Module-scope
// `let`s reassigned from handlers → the React emitter hoists them to `useRef`
// so they persist across renders (the setup-once guarantee); no-op elsewhere.
let typeBuffer = '';
let typeTimer: any = null;

// ---- option resolvers --------------------------------------------------
// ---- option resolvers --------------------------------------------------
const labelOf = (opt: any) => {
  if (optionLabel !== null) return optionLabel(opt);
  if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
  return String(opt);
};
const valueOf = (opt: any) => {
  if (optionValue !== null) return optionValue(opt);
  if (opt !== null && typeof opt === 'object' && 'value' in opt) return opt.value;
  return opt;
};
const disabledOf = (opt: any) => {
  if (optionDisabled !== null) return !!optionDisabled(opt);
  if (opt !== null && typeof opt === 'object' && 'disabled' in opt) return !!opt.disabled;
  return false;
};
const optionId = (index: any) => id + '-opt-' + index;

// ---- derived state -----------------------------------------------------
// The visible option list: identity in select-only / non-filtering mode,
// a case-insensitive substring filter when a combobox query is present.
// A plain function (not `$computed`) so it reads uniformly across all six
// targets — a `$computed` is a value on React but an accessor on Solid, so
// aliasing it to a local (`const opts = visibleOptions()`) diverges; calling a
// plain function is identical everywhere.
// ---- derived state -----------------------------------------------------
// The visible option list: identity in select-only / non-filtering mode,
// a case-insensitive substring filter when a combobox query is present.
// A plain function (not `$computed`) so it reads uniformly across all six
// targets — a `$computed` is a value on React but an accessor on Solid, so
// aliasing it to a local (`const opts = visibleOptions()`) diverges; calling a
// plain function is identical everywhere.
const visibleOptions = () => {
  if (!combobox || !filterable) return options;
  const q = query.trim().toLowerCase();
  if (q === '') return options;
  return options.filter((opt: any) => labelOf(opt).toLowerCase().includes(q));
};

// The label shown in the (select-only) trigger when closed. A real `$computed`
// — read bare in the template, never aliased in script, so the per-target
// accessor form stays uniform.
// Is a given option currently selected? Multi compares array membership.
const isSelected = (opt: any) => {
  const v = valueOf(opt);
  const cur = value;
  if (multiple) return Array.isArray(cur) && cur.includes(v);
  return cur === v;
};

// First enabled visible index, preferring the currently-selected option.
// First enabled visible index, preferring the currently-selected option.
const resolveInitialActive = () => {
  const opts = visibleOptions();
  const sel = opts.findIndex((o: any) => isSelected(o) && !disabledOf(o));
  if (sel !== -1) return sel;
  return opts.findIndex((o: any) => !disabledOf(o));
};

// ---- focus / scroll helpers (post-mount $refs only) --------------------
// Named `focusControl` (not `focus`): a `focus` $expose verb would override the
// inherited HTMLElement.focus method on the Lit custom element.
// ---- focus / scroll helpers (post-mount $refs only) --------------------
// Named `focusControl` (not `focus`): a `focus` $expose verb would override the
// inherited HTMLElement.focus method on the Lit custom element.
export const focusControl = () => {
  if (combobox) inputEl?.focus();else triggerEl?.focus();
};

// Keep the active option visible inside the scrolling listbox. Reads $refs in
// a post-mount callback only (never eagerly — ROZ123).
// Keep the active option visible inside the scrolling listbox. Reads $refs in
// a post-mount callback only (never eagerly — ROZ123).
const scrollActiveIntoView = () => {
  if (!listEl || activeIndex < 0) return;
  const el = listEl!.querySelector('#' + CSS.escape(optionId(activeIndex)));
  el?.scrollIntoView({
    block: 'nearest'
  });
};

// ---- open / close ------------------------------------------------------
// Single open-state mutator → the ONLY `$emit('open-change')` site, so the
// React prop-destructure for `onOpenChange` hoists exactly once.
// ---- open / close ------------------------------------------------------
// Single open-state mutator → the ONLY `$emit('open-change')` site, so the
// React prop-destructure for `onOpenChange` hoists exactly once.
const applyExpanded = (next: any) => {
  if (next && disabled) return;
  if (open$local === next) return;
  open$local = next;
  activeIndex = next ? resolveInitialActive() : -1;
  onopenchange?.({
    open: next
  });
};
export const open = () => applyExpanded(true);
export const close = () => applyExpanded(false);
export const toggle = () => applyExpanded(!open$local);

// ---- selection ---------------------------------------------------------
// Single `$emit('change')` site (called from both select + clear).
// ---- selection ---------------------------------------------------------
// Single `$emit('change')` site (called from both select + clear).
const fireChange = (value: any, option: any) => onchange?.({
  value,
  option
});
const select = (opt: any) => {
  if (disabledOf(opt)) return;
  const v = valueOf(opt);
  if (multiple) {
    const cur = value;
    const arr = Array.isArray(cur) ? cur : [];
    // Fresh array on every commit — in-place mutation is dropped by the
    // React/Solid/Lit/Angular change detectors.
    const next = arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v];
    value = next;
    fireChange(next, opt);
  } else {
    value = v;
    fireChange(v, opt);
    if (closeOnSelect) {
      close();
      focusControl();
    }
  }
};
export const clear = () => {
  const empty = multiple ? [] : null;
  value = empty;
  query = '';
  fireChange(empty, null);
};

// ---- keyboard navigation over the VISIBLE list -------------------------
// ---- keyboard navigation over the VISIBLE list -------------------------
const nextEnabled = (from: any, dir: any) => {
  const opts = visibleOptions();
  if (opts.length === 0) return -1;
  let i = from;
  for (let step = 0; step < opts.length; step++) {
    i += dir;
    if (i < 0) i = opts.length - 1;else if (i >= opts.length) i = 0;
    if (!disabledOf(opts[i])) return i;
  }
  return from;
};
const move = (dir: any) => {
  if (!open$local) {
    open();
    return;
  }
  const start = activeIndex < 0 ? dir > 0 ? -1 : 0 : activeIndex;
  activeIndex = nextEnabled(start, dir);
  scrollActiveIntoView();
};
const moveEdge = (toEnd: any) => {
  if (!open$local) open();
  activeIndex = toEnd ? nextEnabled(-1, -1) : nextEnabled(-1, 1);
  scrollActiveIntoView();
};
const commitActive = () => {
  const opts = visibleOptions();
  if (activeIndex >= 0 && activeIndex < opts.length) select(opts[activeIndex]);
};

// Type-ahead for select-only listboxes: accumulate keystrokes and jump to the
// first option whose label starts with the buffer.
// Type-ahead for select-only listboxes: accumulate keystrokes and jump to the
// first option whose label starts with the buffer.
const onTypeahead = (ch: any) => {
  if (typeTimer !== null) clearTimeout(typeTimer);
  typeBuffer += ch.toLowerCase();
  typeTimer = setTimeout(() => {
    typeBuffer = '';
  }, 600);
  const opts = visibleOptions();
  const idx = opts.findIndex((o: any) => !disabledOf(o) && labelOf(o).toLowerCase().startsWith(typeBuffer));
  if (idx !== -1) {
    if (!open$local) open();
    activeIndex = idx;
    scrollActiveIntoView();
  }
};

// Key handler shared by the trigger and the combobox input. The printable-
// character branch is reached only in select-only mode (the combobox input
// types through @input).
// Key handler shared by the trigger and the combobox input. The printable-
// character branch is reached only in select-only mode (the combobox input
// types through @input).
const onControlKeyDown = ($event: any) => {
  const key = $event.key;
  if (key === 'ArrowDown') {
    $event.preventDefault();
    move(1);
  } else if (key === 'ArrowUp') {
    $event.preventDefault();
    move(-1);
  } else if (key === 'Home') {
    $event.preventDefault();
    moveEdge(false);
  } else if (key === 'End') {
    $event.preventDefault();
    moveEdge(true);
  } else if (key === 'Enter') {
    if (open$local) {
      $event.preventDefault();
      commitActive();
    }
  } else if (key === 'Escape') {
    if (open$local) {
      $event.preventDefault();
      close();
      focusControl();
    }
  } else if (key === ' ' || key === 'Spacebar') {
    // Space toggles / commits in select-only mode; a combobox input needs the
    // literal space, so do nothing there.
    if (!combobox) {
      $event.preventDefault();
      if (!open$local) open();else commitActive();
    }
  } else if (key === 'Tab') {
    if (open$local) close();
  } else if (!combobox && key.length === 1 && !$event.metaKey && !$event.ctrlKey && !$event.altKey) {
    onTypeahead(key);
  }
};

// Combobox input handler: keep the popup open while typing, reset the active
// highlight to the first match, and surface the query for remote filtering.
// Combobox input handler: keep the popup open while typing, reset the active
// highlight to the first match, and surface the query for remote filtering.
const fireSearch = (query: any) => onsearch?.({
  query
});
const onInput = ($event: any) => {
  // Use the fresh input value throughout — a re-read of `$data.query` right
  // after writing it is STALE on React (setState is async; the closure's
  // `query` is the pre-write value), so emit + filter off `q`, not `$data.query`.
  const q = $event.target.value;
  query = q;
  if (!open$local) open();
  activeIndex = nextEnabled(-1, 1);
  fireSearch(q);
};

// Pointer hover sets the virtual highlight (matches native <select> feel).
// Pointer hover sets the virtual highlight (matches native <select> feel).
const onOptionPointerMove = (index: any) => {
  if (activeIndex !== index) activeIndex = index;
};

const selectedLabel = $derived.by(() => {
  const cur = value;
  if (multiple) {
    // Read the model value into a local before narrowing: `$props.value` lowers
    // to a `value()` accessor on Solid, and Array.isArray() can't narrow two
    // separate calls — narrowing one stable local works on every target.
    const arr = Array.isArray(cur) ? cur : [];
    if (arr.length === 0) return '';
    return options.filter((o: any) => arr.includes(valueOf(o))).map(labelOf).join(', ');
  }
  const match = options.find((o: any) => valueOf(o) === cur);
  return match === undefined ? '' : labelOf(match);
});
const activeDescendant = $derived.by(() => {
  if (!open$local || activeIndex < 0) return null;
  return optionId(activeIndex);
});

onDestroy(() => (() => {
  if (typeTimer !== null) clearTimeout(typeTimer);
})());

$effect(() => {
  if (!(open$local)) return;
  const handler = ($event: MouseEvent) => {
    const target = $event.target as Node;
    if (controlEl?.contains(target) || listEl?.contains(target)) return;
    close();
  };
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
});
</script>

<div {...__rozieAttrs} class={["rozie-listbox", { 'rozie-listbox-open': open$local, 'rozie-listbox-disabled': disabled }, (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-b576227a><div class="rozie-listbox-control" bind:this={controlEl} data-rozie-s-b576227a>{#if combobox}<input bind:this={inputEl} class="rozie-listbox-input" type="text" role="combobox" autocomplete="off" aria-autocomplete="list" aria-expanded={open$local} aria-controls={rozieAttr(id + '-list')} aria-activedescendant={rozieAttr(activeDescendant)} aria-label={ariaLabel} disabled={disabled} placeholder={placeholder} value={query} oninput={($event) => { onInput($event); }} onkeydown={($event) => { onControlKeyDown($event); }} onfocus={open} data-rozie-s-b576227a />{:else}<button bind:this={triggerEl} type="button" class="rozie-listbox-trigger" role="combobox" aria-haspopup="listbox" aria-expanded={open$local} aria-controls={rozieAttr(id + '-list')} aria-activedescendant={rozieAttr(activeDescendant)} aria-label={ariaLabel} disabled={disabled} onclick={toggle} onkeydown={($event) => { onControlKeyDown($event); }} data-rozie-s-b576227a>{#if selected}{@render selected({ selected: selectedLabel, value })}{:else}{#if selectedLabel}<span class="rozie-listbox-selected" data-rozie-s-b576227a>{rozieDisplay(selectedLabel)}</span>{:else}<span class="rozie-listbox-placeholder" data-rozie-s-b576227a>{placeholder}</span>{/if}{/if}<span class="rozie-listbox-arrow" aria-hidden="true" data-rozie-s-b576227a>▾</span></button>{/if}</div>{#if open$local}<div bind:this={listEl} class="rozie-listbox-list" role="listbox" id={rozieAttr(id + '-list')} aria-label={ariaLabel} aria-multiselectable={multiple} data-rozie-s-b576227a>{#each visibleOptions() as opt, index (optionId(index))}<div id={rozieAttr(optionId(index))} class={["rozie-listbox-option", { 'is-active': activeIndex === index, 'is-selected': isSelected(opt), 'is-disabled': disabledOf(opt) }]} role="option" aria-selected={!!isSelected(opt)} aria-disabled={!!disabledOf(opt)} onclick={($event) => { select(opt); }} onmousemove={($event) => { onOptionPointerMove(index); }} data-rozie-s-b576227a>{#if option}{@render option({ option: opt, index, active: activeIndex === index, selected: isSelected(opt), disabled: disabledOf(opt) })}{:else}{rozieDisplay(labelOf(opt))}{/if}</div>{/each}{#if visibleOptions().length === 0}<div class="rozie-listbox-empty" role="presentation" data-rozie-s-b576227a>{#if empty}{@render empty({ query })}{:else}No options{/if}</div>{/if}</div>{/if}</div>

<style>
:global {
  .rozie-listbox[data-rozie-s-b576227a] {
    position: relative;
    display: inline-block;
    min-width: var(--rozie-listbox-min-width, 12rem);
    font: var(--rozie-listbox-font, inherit);
  }
  .rozie-listbox-control[data-rozie-s-b576227a] { display: block; }
  .rozie-listbox-input[data-rozie-s-b576227a],
  .rozie-listbox-trigger[data-rozie-s-b576227a] {
    box-sizing: border-box;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rozie-listbox-gap, 0.5rem);
    padding: var(--rozie-listbox-control-padding, 0.5rem 0.75rem);
    font: inherit;
    text-align: left;
    background: var(--rozie-listbox-bg, #fff);
    color: var(--rozie-listbox-fg, #1a1a1a);
    border: var(--rozie-listbox-border-width, 1px) solid var(--rozie-listbox-border, rgba(0, 0, 0, 0.2));
    border-radius: var(--rozie-listbox-radius, 6px);
    cursor: pointer;
  }
  .rozie-listbox-input[data-rozie-s-b576227a] { cursor: text; }
  .rozie-listbox-input[data-rozie-s-b576227a]:focus-visible,
  .rozie-listbox-input[data-rozie-s-b576227a]:focus,
  .rozie-listbox-trigger[data-rozie-s-b576227a]:focus-visible,
  .rozie-listbox-trigger[data-rozie-s-b576227a]:focus {
    outline: var(--rozie-listbox-ring-width, 2px) solid var(--rozie-listbox-ring, var(--rozie-listbox-accent, #0066cc));
    outline-offset: var(--rozie-listbox-ring-offset, 1px);
  }
  .rozie-listbox-disabled[data-rozie-s-b576227a] { opacity: var(--rozie-listbox-disabled-opacity, 0.6); pointer-events: none; }
  .rozie-listbox-placeholder[data-rozie-s-b576227a] { color: var(--rozie-listbox-placeholder, rgba(0, 0, 0, 0.45)); }
  .rozie-listbox-arrow[data-rozie-s-b576227a] {
    font-size: 0.75em;
    color: var(--rozie-listbox-arrow-color, currentColor);
    opacity: var(--rozie-listbox-arrow-opacity, 0.7);
  }
  .rozie-listbox-list[data-rozie-s-b576227a] {
    position: absolute;
    z-index: var(--rozie-listbox-z, 1000);
    top: calc(100% + var(--rozie-listbox-popup-offset, 4px));
    left: 0;
    right: 0;
    margin: 0;
    padding: var(--rozie-listbox-popup-padding, 0.25rem);
    max-height: var(--rozie-listbox-max-height, 16rem);
    overflow-y: auto;
    list-style: none;
    background: var(--rozie-listbox-popup-bg, var(--rozie-listbox-bg, #fff));
    color: var(--rozie-listbox-fg, #1a1a1a);
    border: var(--rozie-listbox-border-width, 1px) solid var(--rozie-listbox-popup-border, var(--rozie-listbox-border, rgba(0, 0, 0, 0.15)));
    border-radius: var(--rozie-listbox-popup-radius, var(--rozie-listbox-radius, 6px));
    box-shadow: var(--rozie-listbox-shadow, 0 6px 24px rgba(0, 0, 0, 0.12));
  }
  .rozie-listbox-option[data-rozie-s-b576227a] {
    padding: var(--rozie-listbox-option-padding, 0.4rem 0.6rem);
    border-radius: var(--rozie-listbox-option-radius, 4px);
    color: var(--rozie-listbox-option-fg, inherit);
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--rozie-listbox-gap, 0.5rem);
  }
  .rozie-listbox-option.is-active[data-rozie-s-b576227a] {
    background: var(--rozie-listbox-active-bg, rgba(0, 102, 204, 0.12));
    color: var(--rozie-listbox-active-fg, inherit);
  }
  .rozie-listbox-option.is-selected[data-rozie-s-b576227a] {
    background: var(--rozie-listbox-selected-bg, transparent);
    color: var(--rozie-listbox-selected-fg, inherit);
    font-weight: var(--rozie-listbox-selected-weight, 600);
  }
  .rozie-listbox-option.is-selected[data-rozie-s-b576227a]::after {
    content: var(--rozie-listbox-check, '✓');
    color: var(--rozie-listbox-check-color, var(--rozie-listbox-accent, #0066cc));
  }
  .rozie-listbox-option.is-disabled[data-rozie-s-b576227a] { opacity: var(--rozie-listbox-disabled-opacity, 0.45); cursor: not-allowed; }
  .rozie-listbox-empty[data-rozie-s-b576227a] { padding: var(--rozie-listbox-option-padding, 0.5rem 0.6rem); color: var(--rozie-listbox-empty-fg, rgba(0, 0, 0, 0.5)); }
}
</style>
