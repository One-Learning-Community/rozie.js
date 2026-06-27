import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay, useControllableState, useOutsideClick } from '@rozie/runtime-react';
import './Listbox.css';

interface SelectedCtx { selected: any; value: any; }

interface OptionCtx { option: any; index: any; active: any; selected: any; disabled: any; }

interface EmptyCtx { query: any; }

interface ListboxProps {
  /**
   * The option set. Each entry is either a primitive (`string`/`number`) or an object; objects resolve their label, value, and disabled state via the `option*` resolver props, falling back to `.label` / `.value` / `.disabled`.
   */
  options?: any[];
  /**
   * The selected value (two-way `r-model`) — a scalar in single-select, an array of values in multi-select. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Listbox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <Listbox r-model:value="fruit" :options="fruits" />
   */
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (value: (unknown) | null) => void;
  /**
   * Enable multi-select: `value` becomes an array, selecting an option toggles its membership, and the popup stays open after each commit.
   */
  multiple?: boolean;
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the listbox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
   */
  inline?: boolean;
  /**
   * Disable the control entirely. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * Placeholder text shown in the empty control.
   */
  placeholder?: string;
  /**
   * Close the popup after a single-select commit. Defaults `true`; multi-select keeps the popup open regardless of this setting.
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
  /**
   * Stable id base for the ARIA wiring (the listbox id, per-option ids, and `aria-activedescendant`). Give each instance on a page a distinct id so these references stay unique.
   */
  id?: string;
  /**
   * Accessible name for the control when there is no visible `<label for>` pointing at its `id` (`aria-label`).
   */
  ariaLabel?: (string) | null;
  onOpenChange?: (...args: any[]) => void;
  onChange?: (...args: any[]) => void;
  renderSelected?: (ctx: SelectedCtx) => ReactNode;
  renderOption?: (ctx: OptionCtx) => ReactNode;
  renderEmpty?: (ctx: EmptyCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface ListboxHandle {
  open: (...args: any[]) => any;
  close: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  focusControl: (...args: any[]) => any;
}

const Listbox = forwardRef<ListboxHandle, ListboxProps>(function Listbox(_props: ListboxProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => [])())[0];
  const props: Omit<ListboxProps, 'options' | 'multiple' | 'inline' | 'disabled' | 'placeholder' | 'closeOnSelect' | 'optionLabel' | 'optionValue' | 'optionDisabled' | 'id' | 'ariaLabel'> & { options: any[]; multiple: boolean; inline: boolean; disabled: boolean; placeholder: string; closeOnSelect: boolean; optionLabel: ((...args: any[]) => any) | null; optionValue: ((...args: any[]) => any) | null; optionDisabled: ((...args: any[]) => any) | null; id: string; ariaLabel: (string) | null } = {
    ..._props,
    options: _props.options ?? __defaultOptions,
    multiple: _props.multiple ?? false,
    inline: _props.inline ?? false,
    disabled: _props.disabled ?? false,
    placeholder: _props.placeholder ?? '',
    closeOnSelect: _props.closeOnSelect ?? true,
    optionLabel: _props.optionLabel ?? null,
    optionValue: _props.optionValue ?? null,
    optionDisabled: _props.optionDisabled ?? null,
    id: _props.id ?? 'rozie-listbox',
    ariaLabel: _props.ariaLabel ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { options, value, multiple, inline, disabled, placeholder, closeOnSelect, optionLabel, optionValue, optionDisabled, id, ariaLabel, defaultValue, onValueChange, ...rest } = _props as ListboxProps & Record<string, unknown>;
    void options; void value; void multiple; void inline; void disabled; void placeholder; void closeOnSelect; void optionLabel; void optionValue; void optionDisabled; void id; void ariaLabel; void defaultValue; void onValueChange;
    return rest;
  })();
  const typeTimer = useRef<any>(null);
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? null,
    onValueChange: props.onValueChange,
  });
  const [open$local, setOpen$local] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const controlEl = useRef<HTMLDivElement | null>(null);
  const triggerEl = useRef<HTMLButtonElement | null>(null);
  const listEl = useRef<HTMLDivElement | null>(null);
  const selectedLabel = useMemo(() => {
    const cur = value;
    if (props.multiple) {
      // Read the model value into a local before narrowing: `$props.value` lowers
      // to a `value()` accessor on Solid, and Array.isArray() can't narrow two
      // separate calls — narrowing one stable local works on every target.
      const arr = Array.isArray(cur) ? cur : [];
      if (arr.length === 0) return '';
      return props.options.filter((o: any) => arr.includes(valueOf(o))).map(labelOf).join(', ');
    }
    const match = props.options.find((o: any) => valueOf(o) === cur);
    return match === undefined ? '' : labelOf(match);
  }, [Array, labelOf, props.multiple, props.options, value, valueOf]);
  const activeDescendant = useMemo(() => {
    if (!open$local || activeIndex < 0) return null;
    return optionId(activeIndex);
  }, [activeIndex, open$local, optionId]);

  // Type-ahead buffer for the select-only listbox trigger. Module-scope
  // `let`s reassigned from handlers → the React emitter hoists them to `useRef`
  // so they persist across renders (the setup-once guarantee); no-op elsewhere.
  // They STAY in this host (not the shared spine) per the A==B rule: reassigned
  // module-`let`s + sigils live in the host; the partial only closes over them.
  let typeBuffer = '';
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
  function optionId(index: any) {
    return props.id + '-opt-' + index;
  }
  function visibleOptions() {
    const q = (query || '').trim().toLowerCase();
    if (q === '') return props.options;
    return props.options.filter((opt: any) => labelOf(opt).toLowerCase().includes(q));
  }
  function isSelected(opt: any) {
    const v = valueOf(opt);
    const cur = value;
    if (props.multiple) return Array.isArray(cur) && cur.includes(v);
    return cur === v;
  }
  function resolveInitialActive() {
    const opts = visibleOptions();
    const sel = opts.findIndex((o: any) => isSelected(o) && !disabledOf(o));
    if (sel !== -1) return sel;
    return opts.findIndex((o: any) => !disabledOf(o));
  }
  function applyExpanded(next: any) {
    if (next && props.disabled) return;
    if (open$local === next) return;
    setOpen$local(next);
    setActiveIndex(next ? resolveInitialActive() : -1);
    props.onOpenChange && props.onOpenChange({
      open: next
    });
  }
  function open() {
    return applyExpanded(true);
  }
  const close = useCallback(() => applyExpanded(false), [applyExpanded]);
  const toggle = useCallback(() => applyExpanded(!open$local), [applyExpanded, open$local]);
  function fireChange(value: any, option: any) {
    return props.onChange && props.onChange({
      value,
      option
    });
  }
  const select = useCallback((opt: any) => {
    if (disabledOf(opt)) return;
    const v = valueOf(opt);
    if (props.multiple) {
      const cur = value;
      const arr = Array.isArray(cur) ? cur : [];
      // Fresh array on every commit — in-place mutation is dropped by the
      // React/Solid/Lit/Angular change detectors.
      const next = arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v];
      setValue(next);
      fireChange(next, opt);
    } else {
      setValue(v);
      fireChange(v, opt);
      if (props.closeOnSelect) {
        close();
        focusControl();
      }
    }
  }, [close, disabledOf, fireChange, focusControl, props.closeOnSelect, props.multiple, setValue, value, valueOf]);
  function clear() {
    const empty = props.multiple ? [] : null;
    setValue(empty);
    setQuery('');
    fireChange(empty, null);
  }
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
    if (!open$local) {
      open();
      return;
    }
    const start = activeIndex < 0 ? dir > 0 ? -1 : 0 : activeIndex;
    setActiveIndex(nextEnabled(start, dir));
    scrollActiveIntoView();
  }
  function moveEdge(toEnd: any) {
    if (!open$local) open();
    setActiveIndex(toEnd ? nextEnabled(-1, -1) : nextEnabled(-1, 1));
    scrollActiveIntoView();
  }
  function commitActive() {
    const opts = visibleOptions();
    if (activeIndex >= 0 && activeIndex < opts.length) select(opts[activeIndex]);
  }
  function onTypeahead(ch: any) {
    if (typeTimer.current !== null) clearTimeout(typeTimer.current);
    typeBuffer += ch.toLowerCase();
    typeTimer.current = setTimeout(() => {
      typeBuffer = '';
    }, 600);
    const opts = visibleOptions();
    const idx = opts.findIndex((o: any) => !disabledOf(o) && labelOf(o).toLowerCase().startsWith(typeBuffer));
    if (idx !== -1) {
      if (!open$local) open();
      setActiveIndex(idx);
      scrollActiveIntoView();
    }
  }
  const onControlKeyDown = useCallback(($event: any) => {
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
      // Space toggles / commits in a select-only host (a button trigger). A
      // filter-input host types the literal space into its <input> and does NOT
      // route Space through this reducer, so this branch is select-only by use.
      $event.preventDefault();
      if (!open$local) open();else commitActive();
    } else if (key === 'Tab') {
      if (open$local) close();
    } else if (key.length === 1 && !$event.metaKey && !$event.ctrlKey && !$event.altKey) {
      onTypeahead(key);
    }
  }, [close, commitActive, focusControl, move, moveEdge, onTypeahead, open, open$local]);
  const onOptionPointerMove = useCallback((index: any) => {
    if (activeIndex !== index) setActiveIndex(index);
  }, [activeIndex]);
  function focusControl() {
    triggerEl.current?.focus();
  }
  function scrollActiveIntoView() {
    if (!listEl.current || activeIndex < 0) return;
    const el = listEl.current!.querySelector('#' + CSS.escape(optionId(activeIndex)));
    el?.scrollIntoView({
      block: 'nearest'
    });
  }

  useEffect(() => {
    return () => {
      if (typeTimer.current !== null) clearTimeout(typeTimer.current);
    };
  }, []);

  useOutsideClick(
    [controlEl, listEl],
    close,
    () => !!(open$local),
  );

  const _rozieExposeRef = useRef({ open, close, toggle, clear, focusControl });
  _rozieExposeRef.current = { open, close, toggle, clear, focusControl };
  useImperativeHandle(ref, () => ({ open: (...args: Parameters<typeof open>): ReturnType<typeof open> => _rozieExposeRef.current.open(...args), close: (...args: Parameters<typeof close>): ReturnType<typeof close> => _rozieExposeRef.current.close(...args), toggle: (...args: Parameters<typeof toggle>): ReturnType<typeof toggle> => _rozieExposeRef.current.toggle(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args), focusControl: (...args: Parameters<typeof focusControl>): ReturnType<typeof focusControl> => _rozieExposeRef.current.focusControl(...args) }), []);

  return (
    <>
    <div {...attrs} className={clsx(clsx("rozie-listbox", { "rozie-listbox-open": open$local, "rozie-listbox-disabled": props.disabled, "rozie-listbox-inline": props.inline }), (attrs.className as string | undefined))} data-rozie-s-b576227a="">

      
      <div className={"rozie-listbox-control"} ref={controlEl} data-rozie-s-b576227a="">
        <button ref={triggerEl} type="button" className={"rozie-listbox-trigger"} role="combobox" aria-haspopup="listbox" aria-expanded={open$local} aria-controls={rozieAttr(props.id + '-list')} aria-activedescendant={rozieAttr(activeDescendant)} aria-label={props.ariaLabel} disabled={props.disabled} onClick={toggle} onKeyDown={($event) => { onControlKeyDown($event); }} data-rozie-s-b576227a="">
          {(props.renderSelected ?? props.slots?.['selected']) ? ((props.renderSelected ?? props.slots?.['selected']) as Function)({ selected: selectedLabel, value }) : (selectedLabel) ? <span className={"rozie-listbox-selected"} data-rozie-s-b576227a="">{rozieDisplay(selectedLabel)}</span> : <span className={"rozie-listbox-placeholder"} data-rozie-s-b576227a="">{props.placeholder}</span>}
          <span className={"rozie-listbox-arrow"} aria-hidden="true" data-rozie-s-b576227a="">▾</span>
        </button>
      </div>

      
      {(open$local) && <div ref={listEl} className={"rozie-listbox-list"} role="listbox" id={rozieAttr(props.id + '-list')} aria-label={props.ariaLabel} aria-multiselectable={props.multiple} data-rozie-s-b576227a="">
        {visibleOptions().map((opt, index) => <div key={optionId(index)} id={rozieAttr(optionId(index))} className={clsx("rozie-listbox-option", { "is-active": activeIndex === index, "is-selected": isSelected(opt), "is-disabled": disabledOf(opt) })} role="option" aria-selected={!!isSelected(opt)} aria-disabled={!!disabledOf(opt)} onClick={($event) => { select(opt); }} onMouseMove={($event) => { onOptionPointerMove(index); }} data-rozie-s-b576227a="">
          {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option: opt, index, active: activeIndex === index, selected: isSelected(opt), disabled: disabledOf(opt) }) : rozieDisplay(labelOf(opt))}
        </div>)}

        {(visibleOptions().length === 0) && <div className={"rozie-listbox-empty"} role="presentation" data-rozie-s-b576227a="">
          {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : "No options"}
        </div>}</div>}</div>
    </>
  );
});
export default Listbox;
