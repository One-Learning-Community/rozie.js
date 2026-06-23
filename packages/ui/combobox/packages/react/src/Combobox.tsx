import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './Combobox.css';

interface OptionCtx { option: any; active: any; selected: any; }

interface ComboboxProps {
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (value: (unknown) | null) => void;
  options?: any[];
  placeholder?: string;
  disabled?: boolean;
  disableFilter?: boolean;
  ariaLabel?: (string) | null;
  idBase?: string;
  onChange?: (...args: any[]) => void;
  onSearch?: (...args: any[]) => void;
  renderOption?: (ctx: OptionCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface ComboboxHandle {
  focus: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

const Combobox = forwardRef<ComboboxHandle, ComboboxProps>(function Combobox(_props: ComboboxProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => [])())[0];
  const props: Omit<ComboboxProps, 'options' | 'placeholder' | 'disabled' | 'disableFilter' | 'ariaLabel' | 'idBase'> & { options: any[]; placeholder: string; disabled: boolean; disableFilter: boolean; ariaLabel: (string) | null; idBase: string } = {
    ..._props,
    options: _props.options ?? __defaultOptions,
    placeholder: _props.placeholder ?? '',
    disabled: _props.disabled ?? false,
    disableFilter: _props.disableFilter ?? false,
    ariaLabel: _props.ariaLabel ?? null,
    idBase: _props.idBase ?? 'rozie-combobox',
  };
  const attrs: Record<string, unknown> = (() => {
    const { value, options, placeholder, disabled, disableFilter, ariaLabel, idBase, defaultValue, onValueChange, ...rest } = _props as ComboboxProps & Record<string, unknown>;
    void value; void options; void placeholder; void disabled; void disableFilter; void ariaLabel; void idBase; void defaultValue; void onValueChange;
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

  function filteredOptions() {
    const opts = Array.isArray(props.options) ? props.options : [];
    let list = opts;
    if (!props.disableFilter) {
      const q = query.toLowerCase();
      if (q) list = opts.filter((o: any) => String(o.label).toLowerCase().indexOf(q) !== -1);
    }
    return list.map((o: any, i: any) => ({
      value: o.value,
      label: o.label,
      disabled: !!o.disabled,
      _i: i
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
    setIsOpen(false);
    setActiveIndex(-1);
    _rozieProp_onChange && _rozieProp_onChange({
      value: opt.value
    });
  }, [_rozieProp_onChange, setValue]);
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
    <div {...attrs} className={clsx(clsx("rozie-combobox", { "rozie-combobox--open": isOpen, "rozie-combobox--disabled": props.disabled }), (attrs.className as string | undefined))} data-rozie-s-9546115a="">
      <input ref={inputEl} className={"rozie-combobox-input"} type="text" role="combobox" aria-autocomplete="list" aria-expanded={!!isOpen} aria-controls={rozieAttr(listId())} aria-activedescendant={rozieAttr(activeId())} aria-label={props.ariaLabel} value={query} placeholder={props.placeholder} disabled={!!props.disabled} autoComplete="off" onInput={($event) => { onInput($event); }} onFocus={($event) => { onFocus($event); }} onBlur={($event) => { onBlur(); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-9546115a="" />

      {(isOpen && filteredOptions().length > 0) && <ul className={"rozie-combobox-list"} id={rozieAttr(listId())} role="listbox" data-rozie-s-9546115a="">
        {filteredOptions().map((opt) => <li key={opt.value} className={clsx("rozie-combobox-option", { "rozie-combobox-option--active": opt._i === activeIndex, "rozie-combobox-option--selected": opt.value === value, "rozie-combobox-option--disabled": opt.disabled })} id={rozieAttr(optId(opt._i))} role="option" aria-selected={opt.value === value} aria-disabled={!!opt.disabled} onMouseDown={($event) => { $event.preventDefault(); selectOption(opt); }} onMouseEnter={($event) => { setActiveIndex(opt._i); }} data-rozie-s-9546115a="">
          {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option: opt, active: opt._i === activeIndex, selected: opt.value === value }) : rozieDisplay(opt.label)}
        </li>)}
      </ul>}</div>
    </>
  );
});
export default Combobox;
