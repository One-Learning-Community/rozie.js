import type { JSX } from 'solid-js';
import { For, Show, createEffect, createSignal, mergeProps, on, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('Combobox-9546115a', `.rozie-combobox[data-rozie-s-9546115a] {
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
.rozie-combobox-empty[data-rozie-s-9546115a] {
  padding: var(--rozie-combobox-empty-padding, 0.5rem 0.6rem);
  color: var(--rozie-combobox-empty-color, rgba(0, 0, 0, 0.5));
  list-style: none;
}
.rozie-combobox--inline[data-rozie-s-9546115a] {
  display: block;
  width: 100%;
}
.rozie-combobox--inline[data-rozie-s-9546115a] .rozie-combobox-list[data-rozie-s-9546115a] {
  position: static;
  margin-top: var(--rozie-combobox-list-gap, 0.25rem);
  border: none;
  border-radius: 0;
  box-shadow: none;
}`);

interface OptionSlotCtx { option: any; index: any; active: any; selected: any; disabled: any; }

interface EmptySlotCtx { query: any; }

interface ComboboxProps {
  /**
   * The selected option's value (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a combobox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `null` when nothing is selected.
   * @example
   * <Combobox r-model:value="country" :options="countries" />
   */
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (value: (unknown) | null) => void;
  /**
   * The option list — `[{ value, label, disabled? }]`. `label` is the displayed text (and what client filtering matches against), `value` is what `r-model:value` reads and writes, and an optional `disabled` flag makes an option non-selectable.
   */
  options?: any[];
  /**
   * Placeholder text shown in the input while it is empty.
   */
  placeholder?: string;
  /**
   * Disable the control — the input becomes non-interactive and the popup cannot be opened. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * Opt **out** of built-in client filtering (async / server-side mode): render `options` exactly as supplied and rely on the `search` event to refetch. By default the component filters `options` by `label`, case-insensitively, against the typed query.
   */
  disableFilter?: boolean;
  /**
   * Accessible name for the input (`aria-label`), used when there is no visible `<label for>` pointing at it. Provide this (or an external label) so the combobox is announced.
   */
  ariaLabel?: (string) | null;
  /**
   * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one combobox shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase?: string;
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the combobox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
   */
  inline?: boolean;
  /**
   * Close the popup after a selection commits. Defaults `true` (standard autocomplete behavior); set to `false` to keep the popup open after a selection — e.g. when the combobox is embedded in a multi-action surface like a command palette.
   */
  closeOnSelect?: boolean;
  /**
   * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
   */
  optionLabel?: ((...args: unknown[]) => unknown) | null;
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  optionValue?: ((...args: unknown[]) => unknown) | null;
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  optionDisabled?: ((...args: unknown[]) => unknown) | null;
  onChange?: (...args: unknown[]) => void;
  onSearch?: (...args: unknown[]) => void;
  optionSlot?: (ctx: OptionSlotCtx) => JSX.Element;
  emptySlot?: (ctx: EmptySlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: ComboboxHandle) => void;
}

export interface ComboboxHandle {
  focus: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

export default function Combobox(_props: ComboboxProps): JSX.Element {
  const _merged = mergeProps({ options: (() => [])(), placeholder: '', disabled: false, disableFilter: false, ariaLabel: null, idBase: 'rozie-combobox', inline: false, closeOnSelect: true, optionLabel: null, optionValue: null, optionDisabled: null }, _props);
  const [local, attrs] = splitProps(_merged, ['value', 'options', 'placeholder', 'disabled', 'disableFilter', 'ariaLabel', 'idBase', 'inline', 'closeOnSelect', 'optionLabel', 'optionValue', 'optionDisabled', 'ref']);
  onMount(() => { local.ref?.({ focus, clear }); });

  const [value, setValue] = createControllableSignal<unknown>(_props as unknown as Record<string, unknown>, 'value', null);
  const [query, setQuery] = createSignal('');
  const [isOpen, setIsOpen] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  onMount(() => {
    syncQueryToValue();
  });
  createEffect(on(() => (() => value())(), (v) => untrack(() => (() => {
    syncQueryToValue();
  })()), { defer: true }));
  let inputElRef: HTMLElement | null = null;

  // ══ Shared headless LIST SPINE (Phase 64, D-06) — the target-agnostic list-core bridge ══
  // Lifted verbatim from Listbox.rozie's <script> (the monolithic pure-Rozie list logic). This
  // partial holds ONLY the PURE list spine — option resolvers, the client-side filter, enabled-index
  // navigation, the arrow/home/end/enter/escape/space/tab keyboard reducer, type-ahead, single+multi
  // selection, open/close state, and activeDescendant derivation. It is a compile-time `.rzts`
  // script-partial: it dissolves into each consumer's compiled leaf via inlineScriptPartials() before
  // IR lowering — leaving zero runtime dependency (the 64-01-proven cross-package bare-specifier path).
  //
  // ── PARAMETERIZATION (D-06) ──────────────────────────────────────────────────────────────────
  // The spine is parameterized BY HOST CONVENTION (the same implicit by-convention mixin contract
  // windowing.rzts uses) along two axes:
  //   - focus-model: `activedescendant` | `roving`. Both list families default to `activedescendant`
  //     (what they use today): the highlighted option is tracked virtually via `activeDescendant`
  //     (an option id) while DOM focus stays on the control. `roving` (real per-option tabindex
  //     focus) is SUPPORTED-BUT-UNUSED — no focus rewrite is forced here; a roving host would supply
  //     its own focus mover. The `activeDescendant` / `optionId` derivation below IS the
  //     activedescendant model.
  //   - input-mode: `select-only` (Listbox — a button trigger + type-ahead) | `filter-input`
  //     (Combobox — a text <input> that filters by the typed query). The mode discriminant is read
  //     from the HOST by convention via `$props.combobox` / `$props.filterable`: a `select-only` host
  //     leaves them false/absent (the `visibleOptions` identity path, the type-ahead printable-char
  //     branch); a `filter-input` host sets them (the `visibleOptions` substring filter, `onInput`).
  //
  // ── HOST CONTRACT (symbols the consuming host MUST define before importing) ────────────────────
  //   - the reassigned module-`let`s `typeBuffer` / `typeTimer` — type-ahead scratch state. They are
  //     reassigned from handlers → the React emitter hoists them to `useRef` (the setup-once
  //     guarantee), so per the A==B playbook rule they STAY IN THE HOST; this partial only closes
  //     over them (in `onTypeahead`).
  //   - `focusControl()` / `scrollActiveIntoView()` — impure ref-reading functions (they touch the
  //     control / list ref elements, which are post-mount-only per ROZ123), so they are per-consumer
  //     HOST functions; this partial only closes over them (it reads NO refs itself).
  //   - the input-mode discriminant props (`$props.combobox` / `$props.filterable`) + the option set
  //     (`$props.options` / `$props.value` (model) / `$props.multiple` / `$props.id` /
  //     `$props.optionLabel` / `$props.optionValue` / `$props.optionDisabled` / `$props.closeOnSelect`
  //     / `$props.disabled`) and the reactive state (`$data.open` / `$data.activeIndex` /
  //     `$data.query`).

  // ---- option resolvers --------------------------------------------------
  function labelOf(opt: any) {
    if (local.optionLabel !== null) return local.optionLabel(opt);
    if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
    return String(opt);
  }
  function valueOf(opt: any) {
    if (local.optionValue !== null) return local.optionValue(opt);
    if (opt !== null && typeof opt === 'object' && 'value' in opt) return opt.value;
    return opt;
  }
  function disabledOf(opt: any) {
    if (local.optionDisabled !== null) return !!local.optionDisabled(opt);
    if (opt !== null && typeof opt === 'object' && 'disabled' in opt) return !!opt.disabled;
    return false;
  }

  // ---- derived view (plain functions, uniform ×6) ------------------------
  // The filtered option list, each carrying its filtered-list index `_i` and the
  // RAW source option (`option`) so `@change` + the `#option` slot expose the
  // original object (CP reads `e.option.id` / `option.group`). A plain function
  // (called in the r-for AND handlers) — never $computed.
  function filteredOptions() {
    const opts = Array.isArray(local.options) ? local.options : [];
    let list = opts;
    if (!local.disableFilter) {
      const q = query().toLowerCase();
      if (q) list = opts.filter((o: any) => String(labelOf(o)).toLowerCase().indexOf(q) !== -1);
    }
    return list.map((o: any, i: any) => ({
      value: valueOf(o),
      label: labelOf(o),
      disabled: disabledOf(o),
      _i: i,
      option: o
    }));
  }
  function optId(i: any) {
    return local.idBase + '-opt-' + i;
  }
  function listId() {
    return local.idBase + '-list';
  }

  // The active option's id for aria-activedescendant (null when none).
  function activeId() {
    const list = filteredOptions();
    if (isOpen() && activeIndex() >= 0 && list[activeIndex()]) return optId(activeIndex());
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

  // ---- selection (writes the model + syncs query) ------------------------
  // `opt` is a filtered-row wrapper ({ value, label, disabled, _i, option }). Fire
  // `@change` with BOTH the committed value AND the raw source `option` (CP reads
  // `e.option`). `closeOnSelect` (default true) gates the popup close — a caller
  // embedding the combobox in a multi-action surface passes `:close-on-select="false"`.
  function selectOption(opt: any) {
    if (!opt || opt.disabled) return;
    setValue(opt.value);
    setQuery(String(opt.label));
    if (local.closeOnSelect) setIsOpen(false);
    setActiveIndex(-1);
    _props.onChange?.({
      value: opt.value,
      option: opt.option
    });
  }

  // Reflect the externally-selected value into the input text.
  function syncQueryToValue() {
    const opts = Array.isArray(local.options) ? local.options : [];
    const opt = opts.find((o: any) => o.value === value());
    setQuery(opt ? String(opt.label) : '');
  }

  // ---- input + keyboard handlers -----------------------------------------
  function onInput(e: any) {
    const q = e && e.target ? e.target.value : '';
    setQuery(q);
    setIsOpen(true);
    setActiveIndex(0);
    _props.onSearch?.({
      query: q
    });
  }
  function onFocus(e: any) {
    setIsOpen(true);
    if (e && e.target && e.target.select) e.target.select();
  }

  // @blur closes the popup. Option selection uses @mousedown.prevent, which keeps
  // focus on the input, so a click on an option does NOT blur-close before select.
  function onBlur() {
    setIsOpen(false);
  }
  function onKeydown(e: any) {
    const key = e ? e.key : '';
    const list = filteredOptions();
    // Capture the reactive reads into locals BEFORE any write so React never binds
    // a pre-write value (ROZ138; the read-then-write-same-key idiom). Each branch
    // is mutually exclusive, but a flow-insensitive analysis can't see that.
    const wasOpen = isOpen();
    const ai = activeIndex();
    if (key === 'ArrowDown') {
      if (e) e.preventDefault();
      if (!wasOpen) {
        setIsOpen(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex(nextEnabled(list, ai, 1));
    } else if (key === 'ArrowUp') {
      if (e) e.preventDefault();
      if (!wasOpen) {
        setIsOpen(true);
        return;
      }
      setActiveIndex(nextEnabled(list, ai, -1));
    } else if (key === 'Enter') {
      if (wasOpen && ai >= 0 && list[ai]) {
        if (e) e.preventDefault();
        selectOption(list[ai]);
      }
    } else if (key === 'Escape') {
      if (wasOpen) {
        if (e) e.preventDefault();
        setIsOpen(false);
      }
    } else if (key === 'Home') {
      if (wasOpen) {
        if (e) e.preventDefault();
        setActiveIndex(nextEnabled(list, -1, 1));
      }
    } else if (key === 'End') {
      if (wasOpen) {
        if (e) e.preventDefault();
        setActiveIndex(nextEnabled(list, list.length, -1));
      }
    }
  }

  // ---- lifecycle + imperative handle -------------------------------------

  // focus() — focus the input (accepted ROZ137 Lit override). clear() — reset the
  // selection + query. Both post-mount → $refs safe.
  function focus() {
    return inputElRef?.focus();
  }
  function clear() {
    setValue(null);
    setQuery('');
    setActiveIndex(-1);
    _props.onChange?.({
      value: null
    });
  }

  return (
    <>
    <div {...attrs} class={"rozie-combobox" + " " + rozieClass({ 'rozie-combobox--open': isOpen(), 'rozie-combobox--disabled': local.disabled, 'rozie-combobox--inline': local.inline }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-9546115a="">
      <input type="text" role="combobox" aria-autocomplete="list" aria-expanded={!!isOpen()} aria-controls={rozieAttr(listId())} aria-activedescendant={rozieAttr(activeId())} aria-label={local.ariaLabel} autocomplete="off" ref={(el) => { inputElRef = el as HTMLElement; }} class={"rozie-combobox-input"} value={query()} placeholder={local.placeholder} disabled={!!local.disabled} onInput={($event) => { onInput($event); }} onFocus={($event) => { onFocus($event); }} onBlur={($event) => { onBlur(); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-9546115a="" />

      {<Show when={isOpen()}><ul class={"rozie-combobox-list"} id={rozieAttr(listId())} role="listbox" data-rozie-s-9546115a="">
        <For each={filteredOptions()}>{(opt) => <li role="option" aria-selected={opt.value === value()} aria-disabled={!!opt.disabled} class={"rozie-combobox-option" + " " + rozieClass({ 'rozie-combobox-option--active': opt._i === activeIndex(), 'rozie-combobox-option--selected': opt.value === value(), 'rozie-combobox-option--disabled': opt.disabled })} id={rozieAttr(optId(opt._i))} onMouseDown={($event) => { $event.preventDefault(); selectOption(opt); }} onMouseEnter={($event) => { setActiveIndex(opt._i); }} data-rozie-s-9546115a="">
          {(_props.optionSlot ?? _props.slots?.['option'])?.({ option: opt.option, index: opt._i, active: opt._i === activeIndex(), selected: opt.value === value(), disabled: opt.disabled }) ?? rozieDisplay(opt.label)}
        </li>}</For>

        {<Show when={filteredOptions().length === 0}><li class={"rozie-combobox-empty"} role="presentation" data-rozie-s-9546115a="">
          {(_props.emptySlot ?? _props.slots?.['empty'])?.({ query: query() }) ?? "No results"}
        </li></Show>}</ul></Show>}</div>
    </>
  );
}
