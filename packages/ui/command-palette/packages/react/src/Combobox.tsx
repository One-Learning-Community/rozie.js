import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './Combobox.css';

interface OptionCtx { option: any; index: any; active: any; selected: any; disabled: any; }

interface EmptyCtx { query: any; }

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
  optionLabel?: ((...args: any[]) => any) | null;
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  optionValue?: ((...args: any[]) => any) | null;
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  optionDisabled?: ((...args: any[]) => any) | null;
  onChange?: (...args: any[]) => void;
  onSearch?: (...args: any[]) => void;
  renderOption?: (ctx: OptionCtx) => ReactNode;
  renderEmpty?: (ctx: EmptyCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface ComboboxHandle {
  focus: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

const Combobox = forwardRef<ComboboxHandle, ComboboxProps>(function Combobox(_props: ComboboxProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => [])())[0];
  const props: Omit<ComboboxProps, 'options' | 'placeholder' | 'disabled' | 'disableFilter' | 'ariaLabel' | 'idBase' | 'inline' | 'closeOnSelect' | 'optionLabel' | 'optionValue' | 'optionDisabled'> & { options: any[]; placeholder: string; disabled: boolean; disableFilter: boolean; ariaLabel: (string) | null; idBase: string; inline: boolean; closeOnSelect: boolean; optionLabel: ((...args: any[]) => any) | null; optionValue: ((...args: any[]) => any) | null; optionDisabled: ((...args: any[]) => any) | null } = {
    ..._props,
    options: _props.options ?? __defaultOptions,
    placeholder: _props.placeholder ?? '',
    disabled: _props.disabled ?? false,
    disableFilter: _props.disableFilter ?? false,
    ariaLabel: _props.ariaLabel ?? null,
    idBase: _props.idBase ?? 'rozie-combobox',
    inline: _props.inline ?? false,
    closeOnSelect: _props.closeOnSelect ?? true,
    optionLabel: _props.optionLabel ?? null,
    optionValue: _props.optionValue ?? null,
    optionDisabled: _props.optionDisabled ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { value, options, placeholder, disabled, disableFilter, ariaLabel, idBase, inline, closeOnSelect, optionLabel, optionValue, optionDisabled, defaultValue, onValueChange, ...rest } = _props as ComboboxProps & Record<string, unknown>;
    void value; void options; void placeholder; void disabled; void disableFilter; void ariaLabel; void idBase; void inline; void closeOnSelect; void optionLabel; void optionValue; void optionDisabled; void defaultValue; void onValueChange;
    return rest;
  })();
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? null,
    onValueChange: props.onValueChange,
  });
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputEl = useRef<HTMLInputElement | null>(null);
  const _watch0First = useRef(true);

  function labelOf(opt: any) {
    if (props.optionLabel !== null) return props.optionLabel(opt);
    if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
    return String(opt);
  }
  function valueOf(opt: any) {
    if (props.optionValue !== null) return props.optionValue(opt);
    if (opt !== null && typeof opt === 'object' && 'value' in opt) return opt.value;
    return opt;
  }
  function disabledOf(opt: any) {
    if (props.optionDisabled !== null) return !!props.optionDisabled(opt);
    if (opt !== null && typeof opt === 'object' && 'disabled' in opt) return !!opt.disabled;
    return false;
  }
  function filteredOptions() {
    const opts = Array.isArray(props.options) ? props.options : [];
    let list = opts;
    if (!props.disableFilter) {
      const q = query.toLowerCase();
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
    return props.idBase + '-opt-' + i;
  }
  function listId() {
    return props.idBase + '-list';
  }
  function activeId() {
    const list = filteredOptions();
    if (isOpen && activeIndex >= 0 && list[activeIndex]) return optId(activeIndex);
    return null;
  }
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
  const { onChange: _rozieProp_onChange } = props;
    const selectOption = useCallback((opt: any) => {
    if (!opt || opt.disabled) return;
    setValue(opt.value);
    setQuery(String(opt.label));
    if (props.closeOnSelect) setIsOpen(false);
    setActiveIndex(-1);
    _rozieProp_onChange && _rozieProp_onChange({
      value: opt.value,
      option: opt.option
    });
  }, [_rozieProp_onChange, props.closeOnSelect, setValue]);
  const syncQueryToValue = useCallback(() => {
    const opts = Array.isArray(props.options) ? props.options : [];
    const opt = opts.find((o: any) => o.value === value);
    setQuery(opt ? String(opt.label) : '');
  }, [props.options, value]);
  const { onSearch: _rozieProp_onSearch } = props;
    const onInput = useCallback((e: any) => {
    const q = e && e.target ? e.target.value : '';
    setQuery(q);
    setIsOpen(true);
    setActiveIndex(0);
    _rozieProp_onSearch && _rozieProp_onSearch({
      query: q
    });
  }, [_rozieProp_onSearch]);
  const onFocus = useCallback((e: any) => {
    setIsOpen(true);
    if (e && e.target && e.target.select) e.target.select();
  }, []);
  const onBlur = useCallback(() => {
    setIsOpen(false);
  }, []);
  const onKeydown = useCallback((e: any) => {
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
  }, [activeIndex, filteredOptions, isOpen, nextEnabled, selectOption]);
  function focus() {
    return inputEl.current?.focus();
  }
  function clear() {
    setValue(null);
    setQuery('');
    setActiveIndex(-1);
    props.onChange && props.onChange({
      value: null
    });
  }

  useEffect(() => {
    syncQueryToValue();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    syncQueryToValue();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ focus, clear });
  _rozieExposeRef.current = { focus, clear };
  useImperativeHandle(ref, () => ({ focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args) }), []);

  return (
    <>
    <div {...attrs} className={clsx(clsx("rozie-combobox", { "rozie-combobox--open": isOpen, "rozie-combobox--disabled": props.disabled, "rozie-combobox--inline": props.inline }), (attrs.className as string | undefined))} data-rozie-s-9546115a="">
      <input ref={inputEl} className={"rozie-combobox-input"} type="text" role="combobox" aria-autocomplete="list" aria-expanded={!!isOpen} aria-controls={rozieAttr(listId())} aria-activedescendant={rozieAttr(activeId())} aria-label={props.ariaLabel} value={query} placeholder={props.placeholder} disabled={!!props.disabled} autoComplete="off" onInput={($event) => { onInput($event); }} onFocus={($event) => { onFocus($event); }} onBlur={($event) => { onBlur(); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-9546115a="" />

      {(isOpen) && <ul className={"rozie-combobox-list"} id={rozieAttr(listId())} role="listbox" data-rozie-s-9546115a="">
        {filteredOptions().map((opt) => <li key={opt.value} className={clsx("rozie-combobox-option", { "rozie-combobox-option--active": opt._i === activeIndex, "rozie-combobox-option--selected": opt.value === value, "rozie-combobox-option--disabled": opt.disabled })} id={rozieAttr(optId(opt._i))} role="option" aria-selected={opt.value === value} aria-disabled={!!opt.disabled} onMouseDown={($event) => { $event.preventDefault(); selectOption(opt); }} onMouseEnter={($event) => { setActiveIndex(opt._i); }} data-rozie-s-9546115a="">
          {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option: opt.option, index: opt._i, active: opt._i === activeIndex, selected: opt.value === value, disabled: opt.disabled }) : rozieDisplay(opt.label)}
        </li>)}

        {(filteredOptions().length === 0) && <li className={"rozie-combobox-empty"} role="presentation" data-rozie-s-9546115a="">
          {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : "No results"}
        </li>}</ul>}</div>
    </>
  );
});
export default Combobox;
