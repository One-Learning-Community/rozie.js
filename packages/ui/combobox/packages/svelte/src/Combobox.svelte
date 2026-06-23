<script lang="ts">
import { applyListeners, rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onMount, untrack } from 'svelte';

interface Props {
  value?: (unknown) | null;
  options?: any[];
  placeholder?: string;
  disabled?: boolean;
  disableFilter?: boolean;
  ariaLabel?: (string) | null;
  idBase?: string;
  option?: Snippet<[{ option: any; active: any; selected: any }]>;
  snippets?: Record<string, any>;
  onchange?: (...args: unknown[]) => void;
  onsearch?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultOptions = (() => [])();

let {
  value = $bindable(null),
  options = __defaultOptions,
  placeholder = '',
  disabled = false,
  disableFilter = false,
  ariaLabel = null,
  idBase = 'rozie-combobox',
  option: __optionProp,
  snippets,
  onchange,
  onsearch,
  ...__rozieAttrs
}: Props = $props();

const option = $derived(__optionProp ?? snippets?.option);

let query = $state('');
let isOpen = $state(false);
let activeIndex = $state(-1);

let inputEl = $state<HTMLInputElement | undefined>(undefined);

// ---- derived view (plain functions, uniform ×6) ------------------------
// The filtered option list, each carrying its filtered-list index `_i`. A plain
// function (called in the r-for AND handlers) — never $computed.
const filteredOptions = () => {
  const opts = Array.isArray(options) ? options : [];
  let list = opts;
  if (!disableFilter) {
    const q = query.toLowerCase();
    if (q) list = opts.filter((o: any) => String(o.label).toLowerCase().indexOf(q) !== -1);
  }
  return list.map((o: any, i: any) => ({
    value: o.value,
    label: o.label,
    disabled: !!o.disabled,
    _i: i
  }));
};
const optId = (i: any) => idBase + '-opt-' + i;
const listId = () => idBase + '-list';

// The active option's id for aria-activedescendant (null when none).
// The active option's id for aria-activedescendant (null when none).
const activeId = () => {
  const list = filteredOptions();
  if (isOpen && activeIndex >= 0 && list[activeIndex]) return optId(activeIndex);
  return null;
};

// Next selectable index in `dir` (+1/-1), skipping disabled, clamped to ends.
// Next selectable index in `dir` (+1/-1), skipping disabled, clamped to ends.
const nextEnabled = (list: any, from: any, dir: any) => {
  let i = from;
  for (let step = 0; step < list.length; step++) {
    i = i + dir;
    if (i < 0) i = 0;
    if (i >= list.length) i = list.length - 1;
    if (list[i] && !list[i].disabled) return i;
    if (dir < 0 && i === 0 || dir > 0 && i === list.length - 1) break;
  }
  return from;
};

// ---- selection (writes the model + syncs query) ------------------------
// ---- selection (writes the model + syncs query) ------------------------
const selectOption = (opt: any) => {
  if (!opt || opt.disabled) return;
  value = opt.value;
  query = String(opt.label);
  isOpen = false;
  activeIndex = -1;
  onchange?.({
    value: opt.value
  });
};

// Reflect the externally-selected value into the input text.
// Reflect the externally-selected value into the input text.
const syncQueryToValue = () => {
  const opts = Array.isArray(options) ? options : [];
  const opt = opts.find((o: any) => o.value === value);
  query = opt ? String(opt.label) : '';
};

// ---- input + keyboard handlers -----------------------------------------
// ---- input + keyboard handlers -----------------------------------------
const onInput = (e: any) => {
  const q = e && e.target ? e.target.value : '';
  query = q;
  isOpen = true;
  activeIndex = 0;
  onsearch?.({
    query: q
  });
};
const onFocus = (e: any) => {
  isOpen = true;
  if (e && e.target && e.target.select) e.target.select();
};

// @blur closes the popup. Option selection uses @mousedown.prevent, which keeps
// focus on the input, so a click on an option does NOT blur-close before select.
// @blur closes the popup. Option selection uses @mousedown.prevent, which keeps
// focus on the input, so a click on an option does NOT blur-close before select.
const onBlur = () => {
  isOpen = false;
};
const onKeydown = (e: any) => {
  const key = e ? e.key : '';
  const list = filteredOptions();
  // Capture the reactive reads into locals BEFORE any write so React never binds
  // a pre-write value (ROZ138; the read-then-write-same-key idiom). Each branch
  // is mutually exclusive, but a flow-insensitive analysis can't see that.
  const wasOpen = isOpen;
  const ai = activeIndex;
  if (key === 'ArrowDown') {
    if (e) e.preventDefault();
    if (!wasOpen) {
      isOpen = true;
      activeIndex = 0;
      return;
    }
    activeIndex = nextEnabled(list, ai, 1);
  } else if (key === 'ArrowUp') {
    if (e) e.preventDefault();
    if (!wasOpen) {
      isOpen = true;
      return;
    }
    activeIndex = nextEnabled(list, ai, -1);
  } else if (key === 'Enter') {
    if (wasOpen && ai >= 0 && list[ai]) {
      if (e) e.preventDefault();
      selectOption(list[ai]);
    }
  } else if (key === 'Escape') {
    if (wasOpen) {
      if (e) e.preventDefault();
      isOpen = false;
    }
  } else if (key === 'Home') {
    if (wasOpen) {
      if (e) e.preventDefault();
      activeIndex = nextEnabled(list, -1, 1);
    }
  } else if (key === 'End') {
    if (wasOpen) {
      if (e) e.preventDefault();
      activeIndex = nextEnabled(list, list.length, -1);
    }
  }
};

// ---- lifecycle + imperative handle -------------------------------------
// focus() — focus the input (accepted ROZ137 Lit override). clear() — reset the
// selection + query. Both post-mount → $refs safe.
export const focus = () => inputEl?.focus();
export const clear = () => {
  value = null;
  query = '';
  activeIndex = -1;
  onchange?.({
    value: null
  });
};

onMount(() => {
  syncQueryToValue();
});

let __rozieWatchInitial_0 = true;
$effect(() => { (() => value)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  syncQueryToValue();
})(); }); });
</script>

<div {...__rozieAttrs} class={["rozie-combobox", { 'rozie-combobox--open': isOpen, 'rozie-combobox--disabled': disabled }, (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-9546115a><input bind:this={inputEl} class="rozie-combobox-input" type="text" role="combobox" aria-autocomplete="list" aria-expanded={!!isOpen} aria-controls={rozieAttr(listId())} aria-activedescendant={rozieAttr(activeId())} aria-label={ariaLabel} value={query} placeholder={placeholder} disabled={!!disabled} autocomplete="off" oninput={($event) => { onInput($event); }} onfocus={($event) => { onFocus($event); }} onblur={($event) => { onBlur(); }} onkeydown={($event) => { onKeydown($event); }} data-rozie-s-9546115a />{#if isOpen && filteredOptions().length > 0}<ul class="rozie-combobox-list" id={rozieAttr(listId())} role="listbox" data-rozie-s-9546115a>{#each filteredOptions() as opt (opt.value)}<li class={["rozie-combobox-option", { 'rozie-combobox-option--active': opt._i === activeIndex, 'rozie-combobox-option--selected': opt.value === value, 'rozie-combobox-option--disabled': opt.disabled }]} id={rozieAttr(optId(opt._i))} role="option" aria-selected={opt.value === value} aria-disabled={!!opt.disabled} onmousedown={($event) => { $event.preventDefault(); selectOption(opt); }} onmouseenter={($event) => { activeIndex = opt._i; }} data-rozie-s-9546115a>{#if option}{@render option({ option: opt, active: opt._i === activeIndex, selected: opt.value === value })}{:else}{rozieDisplay(opt.label)}{/if}</li>{/each}</ul>{/if}</div>

<style>
:global {
  .rozie-combobox[data-rozie-s-9546115a] {
    position: relative;
    display: inline-block;
    width: var(--rozie-combobox-width, 16rem);
    font: var(--rozie-combobox-font, inherit);
  }
  .rozie-combobox-input[data-rozie-s-9546115a] {
    box-sizing: border-box;
    width: 100%;
    padding: var(--rozie-combobox-input-padding, 0.5rem 0.75rem);
    font: inherit;
    color: var(--rozie-combobox-color, inherit);
    background: var(--rozie-combobox-bg, #fff);
    border: var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-border-color, rgba(0, 0, 0, 0.25));
    border-radius: var(--rozie-combobox-radius, 0.5rem);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .rozie-combobox-input[data-rozie-s-9546115a]:focus {
    border-color: var(--rozie-combobox-accent, #0066cc);
    box-shadow: 0 0 0 var(--rozie-combobox-focus-ring-width, 3px) var(--rozie-combobox-focus-ring-color, rgba(0, 102, 204, 0.25));
  }
  .rozie-combobox--disabled[data-rozie-s-9546115a] .rozie-combobox-input[data-rozie-s-9546115a] {
    cursor: not-allowed;
    opacity: var(--rozie-combobox-disabled-opacity, 0.55);
    background: var(--rozie-combobox-disabled-bg, rgba(0, 0, 0, 0.04));
  }
  .rozie-combobox-list[data-rozie-s-9546115a] {
    position: absolute;
    z-index: var(--rozie-combobox-list-z, 50);
    top: calc(100% + var(--rozie-combobox-list-gap, 0.25rem));
    left: 0;
    right: 0;
    margin: 0;
    padding: var(--rozie-combobox-list-padding, 0.25rem);
    list-style: none;
    max-height: var(--rozie-combobox-list-max-height, 16rem);
    overflow-y: auto;
    background: var(--rozie-combobox-list-bg, #fff);
    border: var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-list-border-color, rgba(0, 0, 0, 0.15));
    border-radius: var(--rozie-combobox-radius, 0.5rem);
    box-shadow: var(--rozie-combobox-list-shadow, 0 10px 24px rgba(0, 0, 0, 0.16));
  }
  .rozie-combobox-option[data-rozie-s-9546115a] {
    padding: var(--rozie-combobox-option-padding, 0.4rem 0.6rem);
    border-radius: var(--rozie-combobox-option-radius, 0.375rem);
    cursor: pointer;
    color: var(--rozie-combobox-option-color, inherit);
  }
  .rozie-combobox-option--active[data-rozie-s-9546115a] {
    background: var(--rozie-combobox-option-active-bg, rgba(0, 102, 204, 0.12));
  }
  .rozie-combobox-option--selected[data-rozie-s-9546115a] {
    font-weight: var(--rozie-combobox-option-selected-weight, 600);
    color: var(--rozie-combobox-option-selected-color, var(--rozie-combobox-accent, #0066cc));
  }
  .rozie-combobox-option--disabled[data-rozie-s-9546115a] {
    cursor: not-allowed;
    opacity: var(--rozie-combobox-option-disabled-opacity, 0.45);
  }
}
</style>
