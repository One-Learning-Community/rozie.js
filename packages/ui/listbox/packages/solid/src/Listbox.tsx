import type { JSX } from 'solid-js';
import { For, Show, createMemo, createSignal, mergeProps, onCleanup, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, createOutsideClick, rozieAttr, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('Listbox-b576227a', `.rozie-listbox[data-rozie-s-b576227a] {
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
.rozie-listbox-empty[data-rozie-s-b576227a] { padding: var(--rozie-listbox-option-padding, 0.5rem 0.6rem); color: var(--rozie-listbox-empty-fg, rgba(0, 0, 0, 0.5)); }`);

interface SelectedSlotCtx { selected: any; value: any; }

interface OptionSlotCtx { option: any; index: any; active: any; selected: any; disabled: any; }

interface EmptySlotCtx { query: any; }

interface ListboxProps {
  options?: any[];
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (value: (unknown) | null) => void;
  multiple?: boolean;
  combobox?: boolean;
  filterable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  closeOnSelect?: boolean;
  optionLabel?: ((...args: unknown[]) => unknown) | null;
  optionValue?: ((...args: unknown[]) => unknown) | null;
  optionDisabled?: ((...args: unknown[]) => unknown) | null;
  id?: string;
  ariaLabel?: (string) | null;
  onOpenChange?: (...args: unknown[]) => void;
  onChange?: (...args: unknown[]) => void;
  onSearch?: (...args: unknown[]) => void;
  selectedSlot?: (ctx: SelectedSlotCtx) => JSX.Element;
  optionSlot?: (ctx: OptionSlotCtx) => JSX.Element;
  emptySlot?: (ctx: EmptySlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: ListboxHandle) => void;
}

export interface ListboxHandle {
  open: (...args: any[]) => any;
  close: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  focusControl: (...args: any[]) => any;
}

export default function Listbox(_props: ListboxProps): JSX.Element {
  const _merged = mergeProps({ options: (() => [])(), multiple: false, combobox: false, filterable: true, disabled: false, placeholder: '', closeOnSelect: true, optionLabel: null, optionValue: null, optionDisabled: null, id: 'rozie-listbox', ariaLabel: null }, _props);
  const [local, attrs] = splitProps(_merged, ['options', 'value', 'multiple', 'combobox', 'filterable', 'disabled', 'placeholder', 'closeOnSelect', 'optionLabel', 'optionValue', 'optionDisabled', 'id', 'ariaLabel', 'ref']);
  onMount(() => { local.ref?.({ open, close, toggle, clear, focusControl }); });

  const [value, setValue] = createControllableSignal<unknown>(_props as unknown as Record<string, unknown>, 'value', null);
  const [expanded, setExpanded] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [query, setQuery] = createSignal('');
  const selectedLabel = createMemo(() => {
    const cur = value();
    if (local.multiple) {
      // Read the model value into a local before narrowing: `$props.value` lowers
      // to a `value()` accessor on Solid, and Array.isArray() can't narrow two
      // separate calls — narrowing one stable local works on every target.
      const arr = Array.isArray(cur) ? cur : [];
      if (arr.length === 0) return '';
      return local.options.filter((o: any) => arr.includes(readValue(o))).map(labelOf).join(', ');
    }
    const match = local.options.find((o: any) => readValue(o) === cur);
    return match === undefined ? '' : labelOf(match);
  });
  const activeDescendant = createMemo(() => {
    if (!expanded() || activeIndex() < 0) return null;
    return optionId(activeIndex());
  });
  onCleanup(() => {
    if (typeTimer !== null) clearTimeout(typeTimer);
  });
  let controlElRef: HTMLElement | null = null;
  let inputElRef: HTMLElement | null = null;
  let triggerElRef: HTMLElement | null = null;
  let listElRef: HTMLElement | null = null;

  // Type-ahead buffer for select-only (non-combobox) listboxes. Module-scope
  // `let`s reassigned from handlers → the React emitter hoists them to `useRef`
  // so they persist across renders (the setup-once guarantee); no-op elsewhere.
  let typeBuffer = '';
  let typeTimer: any = null;

  // ---- option resolvers --------------------------------------------------
  function labelOf(opt: any) {
    if (local.optionLabel !== null) return local.optionLabel(opt);
    if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
    return String(opt);
  }
  function readValue(opt: any) {
    if (local.optionValue !== null) return local.optionValue(opt);
    if (opt !== null && typeof opt === 'object' && 'value' in opt) return opt.value;
    return opt;
  }
  function disabledOf(opt: any) {
    if (local.optionDisabled !== null) return !!local.optionDisabled(opt);
    if (opt !== null && typeof opt === 'object' && 'disabled' in opt) return !!opt.disabled;
    return false;
  }
  function optionId(index: any) {
    return local.id + '-opt-' + index;
  }

  // ---- derived state -----------------------------------------------------
  // The visible option list: identity in select-only / non-filtering mode,
  // a case-insensitive substring filter when a combobox query is present.
  // A plain function (not `$computed`) so it reads uniformly across all six
  // targets — a `$computed` is a value on React but an accessor on Solid, so
  // aliasing it to a local (`const opts = visibleOptions()`) diverges; calling a
  // plain function is identical everywhere.
  function visibleOptions() {
    if (!local.combobox || !local.filterable) return local.options;
    const q = query().trim().toLowerCase();
    if (q === '') return local.options;
    return local.options.filter((opt: any) => labelOf(opt).toLowerCase().includes(q));
  }

  // The label shown in the (select-only) trigger when closed. A real `$computed`
  // — read bare in the template, never aliased in script, so the per-target
  // accessor form stays uniform.

  // Is a given option currently selected? Multi compares array membership.
  function isSelected(opt: any) {
    const v = readValue(opt);
    const cur = value();
    if (local.multiple) return Array.isArray(cur) && cur.includes(v);
    return cur === v;
  }

  // First enabled visible index, preferring the currently-selected option.
  function resolveInitialActive() {
    const opts = visibleOptions();
    const sel = opts.findIndex((o: any) => isSelected(o) && !disabledOf(o));
    if (sel !== -1) return sel;
    return opts.findIndex((o: any) => !disabledOf(o));
  }

  // ---- focus / scroll helpers (post-mount $refs only) --------------------
  // Named `focusControl` (not `focus`): a `focus` $expose verb would override the
  // inherited HTMLElement.focus method on the Lit custom element.
  function focusControl() {
    if (local.combobox) inputElRef?.focus();else triggerElRef?.focus();
  }

  // Keep the active option visible inside the scrolling listbox. Reads $refs in
  // a post-mount callback only (never eagerly — ROZ123).
  function scrollActiveIntoView() {
    if (!listElRef || activeIndex() < 0) return;
    const el = listElRef.querySelector('#' + CSS.escape(optionId(activeIndex())));
    el?.scrollIntoView({
      block: 'nearest'
    });
  }

  // ---- open / close ------------------------------------------------------
  // Single open-state mutator → the ONLY `$emit('open-change')` site, so the
  // React prop-destructure for `onOpenChange` hoists exactly once.
  function applyExpanded(next: any) {
    if (next && local.disabled) return;
    if (expanded() === next) return;
    setExpanded(next);
    setActiveIndex(next ? resolveInitialActive() : -1);
    _props.onOpenChange?.({
      open: next
    });
  }
  function open() {
    return applyExpanded(true);
  }
  function close() {
    return applyExpanded(false);
  }
  function toggle() {
    return applyExpanded(!expanded());
  }

  // ---- selection ---------------------------------------------------------
  // Single `$emit('change')` site (called from both select + clear).
  function fireChange(value: any, option: any) {
    return _props.onChange?.({
      value,
      option
    });
  }
  function select(opt: any) {
    if (disabledOf(opt)) return;
    const v = readValue(opt);
    if (local.multiple) {
      const cur = value();
      const arr = Array.isArray(cur) ? cur : [];
      // Fresh array on every commit — in-place mutation is dropped by the
      // React/Solid/Lit/Angular change detectors.
      const next = arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v];
      setValue(next);
      fireChange(next, opt);
    } else {
      setValue(v);
      fireChange(v, opt);
      if (local.closeOnSelect) {
        close();
        focusControl();
      }
    }
  }
  function clear() {
    const empty = local.multiple ? [] : null;
    setValue(empty);
    setQuery('');
    fireChange(empty, null);
  }

  // ---- keyboard navigation over the VISIBLE list -------------------------
  function nextEnabled(from: any, dir: any) {
    const opts = visibleOptions();
    if (opts.length === 0) return -1;
    let i = from;
    for (let step = 0; step < opts.length; step++) {
      i += dir;
      if (i < 0) i = opts.length - 1;else if (i >= opts.length) i = 0;
      if (!disabledOf(opts[i])) return i;
    }
    return from;
  }
  function move(dir: any) {
    if (!expanded()) {
      open();
      return;
    }
    const start = activeIndex() < 0 ? dir > 0 ? -1 : 0 : activeIndex();
    setActiveIndex(nextEnabled(start, dir));
    scrollActiveIntoView();
  }
  function moveEdge(toEnd: any) {
    if (!expanded()) open();
    setActiveIndex(toEnd ? nextEnabled(-1, -1) : nextEnabled(-1, 1));
    scrollActiveIntoView();
  }
  function commitActive() {
    const opts = visibleOptions();
    if (activeIndex() >= 0 && activeIndex() < opts.length) select(opts[activeIndex()]);
  }

  // Type-ahead for select-only listboxes: accumulate keystrokes and jump to the
  // first option whose label starts with the buffer.
  function onTypeahead(ch: any) {
    if (typeTimer !== null) clearTimeout(typeTimer);
    typeBuffer += ch.toLowerCase();
    typeTimer = setTimeout(() => {
      typeBuffer = '';
    }, 600);
    const opts = visibleOptions();
    const idx = opts.findIndex((o: any) => !disabledOf(o) && labelOf(o).toLowerCase().startsWith(typeBuffer));
    if (idx !== -1) {
      if (!expanded()) open();
      setActiveIndex(idx);
      scrollActiveIntoView();
    }
  }

  // Key handler shared by the trigger and the combobox input. The printable-
  // character branch is reached only in select-only mode (the combobox input
  // types through @input).
  function onControlKeyDown($event: any) {
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
      if (expanded()) {
        $event.preventDefault();
        commitActive();
      }
    } else if (key === 'Escape') {
      if (expanded()) {
        $event.preventDefault();
        close();
        focusControl();
      }
    } else if (key === ' ' || key === 'Spacebar') {
      // Space toggles / commits in select-only mode; a combobox input needs the
      // literal space, so do nothing there.
      if (!local.combobox) {
        $event.preventDefault();
        if (!expanded()) open();else commitActive();
      }
    } else if (key === 'Tab') {
      if (expanded()) close();
    } else if (!local.combobox && key.length === 1 && !$event.metaKey && !$event.ctrlKey && !$event.altKey) {
      onTypeahead(key);
    }
  }

  // Combobox input handler: keep the popup open while typing, reset the active
  // highlight to the first match, and surface the query for remote filtering.
  function fireSearch(query: any) {
    return _props.onSearch?.({
      query
    });
  }
  function onInput($event: any) {
    // Use the fresh input value throughout — a re-read of `$data.query` right
    // after writing it is STALE on React (setState is async; the closure's
    // `query` is the pre-write value), so emit + filter off `q`, not `$data.query`.
    const q = $event.target.value;
    setQuery(q);
    if (!expanded()) open();
    setActiveIndex(nextEnabled(-1, 1));
    fireSearch(q);
  }

  // Pointer hover sets the virtual highlight (matches native <select> feel).
  function onOptionPointerMove(index: any) {
    if (activeIndex() !== index) setActiveIndex(index);
  }

  createOutsideClick(
    [() => controlElRef, () => listElRef],
    close,
    () => expanded(),
  );

  return (
    <>
    <div classList={{ 'rozie-listbox-open': expanded(), 'rozie-listbox-disabled': local.disabled }} {...attrs} class={"rozie-listbox" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-b576227a="">

      
      <div class={"rozie-listbox-control"} ref={(el) => { controlElRef = el as HTMLElement; }} data-rozie-s-b576227a="">
        {<Show when={local.combobox} fallback={<button type="button" role="combobox" aria-haspopup="listbox" aria-expanded={expanded()} aria-controls={rozieAttr(local.id + '-list')} aria-activedescendant={rozieAttr(activeDescendant())} aria-label={local.ariaLabel} ref={(el) => { triggerElRef = el as HTMLElement; }} class={"rozie-listbox-trigger"} disabled={local.disabled} onClick={toggle} onKeyDown={($event) => { onControlKeyDown($event); }} data-rozie-s-b576227a="">
          {(_props.selectedSlot ?? _props.slots?.['selected'])?.({ selected: selectedLabel(), value: value() }) ?? <Show when={selectedLabel()} fallback={<span class={"rozie-listbox-placeholder"} data-rozie-s-b576227a="">{local.placeholder}</span>}><span class={"rozie-listbox-selected"} data-rozie-s-b576227a="">{rozieDisplay(selectedLabel())}</span></Show>}
          <span class={"rozie-listbox-arrow"} aria-hidden="true" data-rozie-s-b576227a="">▾</span>
        </button>}><input type="text" role="combobox" autocomplete="off" aria-autocomplete="list" aria-expanded={expanded()} aria-controls={rozieAttr(local.id + '-list')} aria-activedescendant={rozieAttr(activeDescendant())} aria-label={local.ariaLabel} ref={(el) => { inputElRef = el as HTMLElement; }} class={"rozie-listbox-input"} disabled={local.disabled} placeholder={local.placeholder} value={query()} onInput={($event) => { onInput($event); }} onKeyDown={($event) => { onControlKeyDown($event); }} onFocus={open} data-rozie-s-b576227a="" /></Show>}</div>

      
      {<Show when={expanded()}><div ref={(el) => { listElRef = el as HTMLElement; }} class={"rozie-listbox-list"} role="listbox" id={rozieAttr(local.id + '-list')} aria-label={local.ariaLabel} aria-multiselectable={local.multiple} data-rozie-s-b576227a="">
        <For each={visibleOptions()}>{(opt, index) => <div role="option" aria-selected={!!isSelected(opt)} aria-disabled={!!disabledOf(opt)} id={rozieAttr(optionId(index()))} class={"rozie-listbox-option"} classList={{ 'is-active': activeIndex() === index(), 'is-selected': isSelected(opt), 'is-disabled': disabledOf(opt) }} onClick={($event) => { select(opt); }} onMouseMove={($event) => { onOptionPointerMove(index()); }} data-rozie-s-b576227a="">
          {(_props.optionSlot ?? _props.slots?.['option'])?.({ option: opt, index: index(), active: activeIndex() === index(), selected: isSelected(opt), disabled: disabledOf(opt) }) ?? rozieDisplay(labelOf(opt))}
        </div>}</For>

        {<Show when={visibleOptions().length === 0}><div class={"rozie-listbox-empty"} role="presentation" data-rozie-s-b576227a="">
          {(_props.emptySlot ?? _props.slots?.['empty'])?.({ query: query() }) ?? "No options"}
        </div></Show>}</div></Show>}</div>
    </>
  );
}
