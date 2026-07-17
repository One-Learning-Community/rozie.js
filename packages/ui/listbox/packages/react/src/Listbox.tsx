import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, parseInlineStyle, rozieAttr, rozieDisplay, useControllableState, useOutsideClick } from '@rozie/runtime-react';
import './Listbox.css';
// virtual-core: the framework-agnostic windowing state machine (the data-table
// precedent — NO per-framework adapter). The static import is emitted unconditionally
// (a peer dep); every RUNTIME reference sits behind `if ($props.virtual)` / a
// `virtualizer` guard so the non-virtual emitted path executes none of it
// (byte-identical-off).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// Windowing instance state (the `let table` precedent — React hoists reassigned
// module-`let`s to useRef; do NOT const). NULL until $onMount, and ONLY constructed
// when $props.virtual. gridScrollEl is the captured .rozie-listbox-list scroll div the
// virtualizer observes; remeasurePending dedupes the deferred sweep.

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
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling list (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed listbox. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded.
   */
  virtual?: boolean;
  /**
   * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  estimateRowHeight?: number;
  /**
   * A CSS length string bounding the list scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-listbox-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
   */
  maxHeight?: string;
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
  const props: Omit<ListboxProps, 'options' | 'multiple' | 'inline' | 'disabled' | 'placeholder' | 'closeOnSelect' | 'optionLabel' | 'optionValue' | 'optionDisabled' | 'id' | 'ariaLabel' | 'virtual' | 'estimateRowHeight' | 'maxHeight'> & { options: any[]; multiple: boolean; inline: boolean; disabled: boolean; placeholder: string; closeOnSelect: boolean; optionLabel: ((...args: any[]) => any) | null; optionValue: ((...args: any[]) => any) | null; optionDisabled: ((...args: any[]) => any) | null; id: string; ariaLabel: (string) | null; virtual: boolean; estimateRowHeight: number; maxHeight: string } = {
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
    virtual: _props.virtual ?? false,
    estimateRowHeight: _props.estimateRowHeight ?? 36,
    maxHeight: _props.maxHeight ?? '',
  };
  const attrs: Record<string, unknown> = (() => {
    const { options, value, multiple, inline, disabled, placeholder, closeOnSelect, optionLabel, optionValue, optionDisabled, id, ariaLabel, virtual, estimateRowHeight, maxHeight, defaultValue, onValueChange, ...rest } = _props as ListboxProps & Record<string, unknown>;
    void options; void value; void multiple; void inline; void disabled; void placeholder; void closeOnSelect; void optionLabel; void optionValue; void optionDisabled; void id; void ariaLabel; void virtual; void estimateRowHeight; void maxHeight; void defaultValue; void onValueChange;
    return rest;
  })();
  const gridScrollEl = useRef<any>(null);
  const virtualizer = useRef<any>(null);
  const virtualizerCleanup = useRef<any>(null);
  const remeasurePending = useRef(false);
  const typeTimer = useRef<any>(null);
  const typeBuffer = useRef('');
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? null,
    onValueChange: props.onValueChange,
  });
  const [open$local, setOpen$local] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [windowVer, setWindowVer] = useState(0);
  const [editVer, setEditVer] = useState(0);
  const controlEl = useRef<HTMLDivElement | null>(null);
  const triggerEl = useRef<HTMLButtonElement | null>(null);
  const listEl = useRef<HTMLDivElement | null>(null);
  const __rozieRoot = useRef<HTMLDivElement | null>(null);
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
  function open() {
    if (props.disabled) return;
    if (open$local) return;
    setOpen$local(true);
    setActiveIndex(resolveInitialActive());
    props.onOpenChange && props.onOpenChange({
      open: true
    });
  }
  const { onOpenChange: _rozieProp_onOpenChange } = props;
    const close = useCallback(() => {
    if (!open$local) return;
    setOpen$local(false);
    setActiveIndex(-1);
    _rozieProp_onOpenChange && _rozieProp_onOpenChange({
      open: false
    });
  }, [_rozieProp_onOpenChange, open$local]);
  const toggle = useCallback(() => {
    if (open$local) close();else open();
  }, [close, open, open$local]);
  const { onChange: _rozieProp_onChange } = props;
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
      _rozieProp_onChange && _rozieProp_onChange({
        value: next,
        option: opt
      });
    } else {
      setValue(v);
      _rozieProp_onChange && _rozieProp_onChange({
        value: v,
        option: opt
      });
      if (props.closeOnSelect) {
        close();
        focusControl();
      }
    }
  }, [_rozieProp_onChange, close, disabledOf, focusControl, props.closeOnSelect, props.multiple, setValue, value, valueOf]);
  function clear() {
    const empty = props.multiple ? [] : null;
    setValue(empty);
    setQuery('');
    props.onChange && props.onChange({
      value: empty,
      option: null
    });
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
    typeBuffer.current += ch.toLowerCase();
    typeTimer.current = setTimeout(() => {
      typeBuffer.current = '';
    }, 600);
    const opts = visibleOptions();
    const idx = opts.findIndex((o: any) => !disabledOf(o) && labelOf(o).toLowerCase().startsWith(typeBuffer.current));
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
  function virtualItemKey(i: any) {
    const src = windowSource();
    return src && src[i] ? src[i].id : undefined;
  }
  const virtualizerOptions = useCallback((): any => ({
    count: windowSource().length,
    getScrollElement: () => gridScrollEl.current,
    estimateSize: () => props.estimateRowHeight,
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    measureElement,
    overscan: 8,
    getItemKey: virtualItemKey,
    onChange: () => {
      setWindowVer(prev => prev + 1);
      // CR-01: re-observe the freshly-committed window so RECYCLED rows get measured.
      // virtual-core only observe()s a node you explicitly hand to measureElement (it does
      // NOT auto-discover rendered rows — measureElement is the SOLE caller of
      // observer.observe, virtual-core@3.17.1 dist/esm/index.js:794-817). Rows that recycle
      // into view on scroll are brand-new DOM nodes; without re-sweeping they keep the
      // estimateRowHeight seed forever and the spacer math drifts (req-2). Deferred one frame
      // so the new <tr> set is in the DOM before we measure. Safe from an infinite
      // measure→onChange→measure loop: measureElement is idempotent on an already-observed
      // node (the `prevNode !== node` guard), and resizeItem only re-fires onChange when the
      // measured height actually DIFFERS from the cached one (delta !== 0) — an unchanged
      // re-measure is a no-op.
      scheduleRemeasure();
    }
  }), [props.estimateRowHeight, scheduleRemeasure, virtualItemKey, windowSource]);
  function pinMeasurement(pin: number): {
    start: number;
    size: number;
    index: number;
    end: number;
  } | null {
    return pinnedMeasurement(pin);
  }
  function windowedRows() {
    // SUBSCRIBE FIRST (fine-grained targets): touch the reactive windowVer at the TOP — BEFORE any
    // early return — so Solid's <For>/Svelte's {#each} accessor subscribes to it on its FIRST eval,
    // which happens at initial render while `virtualizer` is still null (it is built in $onMount,
    // after the first render). `virtualizer` is a non-reactive `let`, so if the windowVer read sat
    // BELOW the `!virtualizer` guard the accessor would early-return [] without ever reading the
    // signal → it would NEVER re-run when onChange later bumps windowVer, and the window would stay
    // blank forever (the Solid/Svelte fine-grained bug). Coarse targets re-render wholesale so the
    // placement is a no-op for them. The post-construction windowVer bump in $onMount fires the
    // first re-run that picks up the now-non-null virtualizer.
    // ALSO subscribe to editVer here so the slice re-derives when an editor opens/closes (the
    // pin/unpin transition), mirroring the probe's windowVer bump on pin (Solid/Svelte fine-grained).
    void windowVer;
    void editVer;
    if (!virtualizer.current) {
      // Virtual OFF → full set (the r-else table never calls this, but keep it total). Virtual ON
      // but the virtualizer is not yet constructed (pre-$onMount first paint) → render NOTHING so
      // the template never dereferences a null `vi` (the windowed bindings read wr.vi.index); the
      // rows appear on the first onChange after _didMount.
      if (!props.virtual) {
        const rowList = rows || [];
        return rowList.map((r: any) => ({
          vi: null,
          row: r
        }));
      }
      return [];
    }
    const items = virtualizer.current.getVirtualItems();
    const rowList = rows || [];
    // WR-01: drop any virtual item whose index outruns the current full-model rows (a brief
    // shrink window where the virtualizer count is stale relative to $data.rows on the async
    // onChange→windowVer path). The template keys on wr.row.id, so a row:undefined entry would
    // throw "Cannot read properties of undefined"; filter it here so the template never sees it.
    const out = items.map((vi: any) => ({
      vi,
      row: rowList[vi.index]
    })).filter((wr: any) => wr.row);
    // ── D-02 pin-row union (req-9): if an editor is open on a row that is NOT in the current
    // window, UNION it into the slice (keyed on row.id so Lit repeat / Solid For never recycle it
    // into another full-model row), LEADING the slice when it sits above the window and TRAILING
    // it when below — so DOM order matches visual/aria order. The spacer subtraction (padTop/
    // padBottom) keeps the total exactly getTotalSize(). This is the 51-01-proven mechanism wired
    // into the real windowing.
    const pin = pinnedEditIndex();
    if (pin >= 0 && rowList[pin]) {
      let inWindow = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].index === pin) {
          inWindow = true;
          break;
        }
      }
      if (!inWindow) {
        const pm = pinMeasurement(pin);
        const firstStart = items.length ? items[0].start : 0;
        const above = pm ? pm.start < firstStart : pin < (items.length ? items[0].index : pin);
        const pinnedEntry = {
          vi: pm != null ? pm : {
            index: pin
          },
          row: rowList[pin],
          pinned: true
        };
        if (above) out.unshift(pinnedEntry);else out.push(pinnedEntry);
      }
    }
    return out;
  }
  function padTop() {
    // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
    // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
    // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
    void windowVer;
    void editVer;
    if (!props.virtual || !virtualizer.current) return 0;
    const items = virtualizer.current.getVirtualItems();
    let pad = items.length ? items[0].start : 0;
    // D-02 spacer subtraction: when the pinned editing row sits ABOVE the window it is rendered
    // in-flow as the slice's LEADING <tr> (its measured height is now a real <tr>), so subtract
    // that height from the leading spacer to keep padTop + Σ rendered <tr> + padBottom = total.
    const pin = pinnedEditIndex();
    if (pin >= 0) {
      const pm = pinMeasurement(pin);
      const inWindow = pmIndexInWindow(items, pin);
      if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
    }
    return pad < 0 ? 0 : pad;
  }
  function padBottom() {
    // subscribe-first, see windowedRows() (IN-04): touch windowVer + editVer before the early
    // return so the fine-grained spacer :style binding subscribes on its first eval + re-derives
    // on pin/unpin.
    void windowVer;
    void editVer;
    if (!props.virtual || !virtualizer.current) return 0;
    const items = virtualizer.current.getVirtualItems();
    if (!items.length) return 0;
    let pad = virtualizer.current.getTotalSize() - items[items.length - 1].end;
    // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
    // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
    const pin = pinnedEditIndex();
    if (pin >= 0) {
      const pm = pinMeasurement(pin);
      const inWindow = pmIndexInWindow(items, pin);
      // WR-01: decide "below the window" by INDEX, not by start-OFFSET. On variable-height rows
      // measurement drift can leave pm.start at-or-past items[0].start while the pinned row's
      // index is actually ABOVE the window, mis-subtracting its height from the trailing spacer.
      // The pinned full-model index vs the last rendered item's index is drift-proof. Fall back to
      // the offset comparison only if the measurement lacks an index (defensive).
      const lastItemIdx = items[items.length - 1].index;
      const below = pm && pm.index != null ? pm.index > lastItemIdx : pm && pm.start >= items[0].start;
      if (pm && !inWindow && below) {
        // below the window → it trailed the slice; subtract its height from the trailing spacer.
        if (pm.end > items[items.length - 1].end) pad = pad - pm.size;
      }
    }
    return pad < 0 ? 0 : pad;
  }
  function pmIndexInWindow(items: any, idx: any) {
    for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
    return false;
  }
  function rowIsOutsideWindow(r: any) {
    if (!props.virtual || !virtualizer.current) return false;
    const items = virtualizer.current.getVirtualItems();
    for (const it of items as any) if (it.index === r) return false;
    return true;
  }
  const windowSourceCache = useMemo(() => ({
    keys: null as any[] | null,
    val: null as any
  }), []);
  function windowSource() {
    const __rozieMemoKey = [props.options, query, props.optionValue, props.optionLabel];
    const __rozieMemoPrev = windowSourceCache.keys;
    if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
      return windowSourceCache.val;
    }
    const __rozieMemoVal = visibleOptions().map((o: any, i: any) => ({
      id: valueOf(o),
      _opt: o,
      _i: i
    }));
    windowSourceCache.keys = __rozieMemoKey;
    windowSourceCache.val = __rozieMemoVal;
    return __rozieMemoVal;
  }
  function pinnedEditIndex() {
    return -1;
  }
  function pinnedMeasurement(pin: any) {
    return null;
  }
  const syncRows = useCallback(() => {
    setRows(windowSource());
  }, [windowSource]);
  function scheduleRemeasure() {
    if (remeasurePending.current) return;
    remeasurePending.current = true;
    let ranMicro = false;
    const microPass = () => {
      remeasureWindow();
    };
    const rafPass = () => {
      remeasurePending.current = false;
      remeasureWindow();
    };
    if (typeof queueMicrotask !== 'undefined') {
      ranMicro = true;
      queueMicrotask(microPass);
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) remeasurePending.current = false;else setTimeout(rafPass, 0);
  }
  function remeasureWindow() {
    if (!virtualizer.current || !gridScrollEl.current) return;
    if (virtualizer.current.scrollState) return;
    const els = gridScrollEl.current.querySelectorAll('.rozie-listbox-option[data-index]');
    for (const el of els as any) virtualizer.current.measureElement(el);
  }
  function focusControl() {
    triggerEl.current?.focus();
  }
  function scrollActiveIntoView() {
    if (activeIndex < 0) return;
    if (props.virtual && virtualizer.current) {
      // 'center' (not 'auto'): keep the active option well inside the rendered slice as the
      // window scrolls — 'auto' lands it at the viewport edge where the overscan band can
      // leave it just-unrendered for a frame on the fine-grained targets (Solid).
      virtualizer.current.scrollToIndex(activeIndex, {
        align: 'center'
      });
      scheduleRemeasure();
      return;
    }
    if (!listEl.current) return;
    const el = listEl.current!.querySelector('#' + CSS.escape(optionId(activeIndex)));
    el?.scrollIntoView({
      block: 'nearest'
    });
  }
  const kickWindow = useCallback((attempts: any) => {
    if (!virtualizer.current) return;
    gridScrollEl.current = __rozieRoot.current ? __rozieRoot.current!.querySelector('.rozie-listbox-list') : gridScrollEl.current;
    // Only re-feed the count from a NON-EMPTY source: on React these rAF closures capture
    // stale (mount-time, empty) props, so feeding here would CLOBBER the $watch's correct
    // count back to 0. The $watch (fresh useEffect props) owns React's count; the kick owns
    // the Solid/Lit scroll-element re-attach + the deferred windowVer re-derive.
    if (windowSource().length > 0) {
      syncRows();
      virtualizer.current.setOptions(virtualizerOptions());
    }
    virtualizer.current._willUpdate();
    setWindowVer(prev => prev + 1);
    remeasureWindow();
    if (windowedRows().length === 0 && attempts > 0) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => kickWindow(attempts - 1));else setTimeout(() => kickWindow(attempts - 1), 16);
    }
  }, [remeasureWindow, syncRows, virtualizerOptions, windowSource, windowedRows]);

  useEffect(() => {
    syncRows();
    if (props.virtual) {
      // The list renders at mount when virtual, so the .rozie-listbox-list scroll container
      // exists here. Capture it via $el.querySelector (the data-table gridScrollEl precedent,
      // proven ×6 incl Lit shadow + Solid) — $refs on a conditionally-rendered node is null on
      // Solid/Lit, which leaves the virtualizer with no scroll element.
      gridScrollEl.current = __rozieRoot.current ? __rozieRoot.current!.querySelector('.rozie-listbox-list') : null;
      virtualizer.current = new Virtualizer(virtualizerOptions());
      virtualizerCleanup.current = virtualizer.current._didMount();
      setWindowVer(prev => prev + 1);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => kickWindow(8));else setTimeout(() => kickWindow(8), 0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      if (typeTimer.current !== null) clearTimeout(typeTimer.current);
      // Tear down the virtualizer's scroll-element ResizeObserver (no-op when virtual off).
      if (virtualizerCleanup.current) virtualizerCleanup.current();
    };
  }, []);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    syncRows();
    if (props.virtual && virtualizer.current) {
      gridScrollEl.current = __rozieRoot.current ? __rozieRoot.current!.querySelector('.rozie-listbox-list') : gridScrollEl.current;
      virtualizer.current.setOptions(virtualizerOptions());
      virtualizer.current._willUpdate();
      setWindowVer(prev => prev + 1);
      scheduleRemeasure();
    }
  }, [props.options, query]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div ref={__rozieRoot} {...attrs} className={clsx(clsx("rozie-listbox", { "rozie-listbox-open": open$local, "rozie-listbox-disabled": props.disabled, "rozie-listbox-inline": props.inline }), (attrs.className as string | undefined))} data-rozie-s-b576227a="">

      
      <div className={"rozie-listbox-control"} ref={controlEl} data-rozie-s-b576227a="">
        <button ref={triggerEl} type="button" className={"rozie-listbox-trigger"} role="combobox" aria-haspopup="listbox" aria-expanded={open$local} aria-controls={rozieAttr(props.id + '-list')} aria-activedescendant={rozieAttr(activeDescendant)} aria-label={rozieAttr(props.ariaLabel)} disabled={props.disabled} onClick={toggle} onKeyDown={($event) => { onControlKeyDown($event); }} data-rozie-s-b576227a="">
          {(props.renderSelected ?? props.slots?.['selected']) ? ((props.renderSelected ?? props.slots?.['selected']) as Function)({ selected: selectedLabel, value }) : (selectedLabel) ? <span className={"rozie-listbox-selected"} data-rozie-s-b576227a="">{rozieDisplay(selectedLabel)}</span> : <span className={"rozie-listbox-placeholder"} data-rozie-s-b576227a="">{props.placeholder}</span>}
          <span className={"rozie-listbox-arrow"} aria-hidden="true" data-rozie-s-b576227a="">▾</span>
        </button>
      </div>

      
      {!!(open$local && !props.virtual) && <div ref={listEl} className={"rozie-listbox-list"} role="listbox" id={rozieAttr(props.id + '-list')} aria-label={rozieAttr(props.ariaLabel)} aria-multiselectable={props.multiple} data-rozie-s-b576227a="">
        {visibleOptions().map((opt, index) => <div key={optionId(index)} id={rozieAttr(optionId(index))} className={clsx("rozie-listbox-option", { "is-active": activeIndex === index, "is-selected": isSelected(opt), "is-disabled": disabledOf(opt) })} role="option" aria-selected={!!isSelected(opt)} aria-disabled={!!disabledOf(opt)} onClick={($event) => { select(opt); }} onMouseMove={($event) => { onOptionPointerMove(index); }} data-rozie-s-b576227a="">
          {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option: opt, index, active: activeIndex === index, selected: isSelected(opt), disabled: disabledOf(opt) }) : rozieDisplay(labelOf(opt))}
        </div>)}

        {!!(visibleOptions().length === 0) && <div className={"rozie-listbox-empty"} role="presentation" data-rozie-s-b576227a="">
          {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : "No options"}
        </div>}</div>}{!!(props.virtual) && <div ref={listEl} className={"rozie-listbox-list rozie-listbox-list--virtual"} role="listbox" id={rozieAttr(props.id + '-list')} aria-label={rozieAttr(props.ariaLabel)} aria-multiselectable={props.multiple} style={parseInlineStyle((open$local ? '' : 'display:none;') + (props.maxHeight ? 'height:' + props.maxHeight + ';max-height:' + props.maxHeight + ';overflow-y:auto;--rozie-listbox-max-height:' + props.maxHeight : 'overflow-y:auto'))} data-rozie-s-b576227a="">
        <div className={"rozie-listbox-spacer"} aria-hidden="true" style={parseInlineStyle('height:' + padTop() + 'px')} data-rozie-s-b576227a="" />

        {windowedRows().map((wr) => <div key={wr.row.id} id={rozieAttr(optionId(wr.vi.index))} data-index={rozieAttr(wr.vi.index)} className={clsx("rozie-listbox-option", { "is-active": activeIndex === wr.vi.index, "is-selected": isSelected(wr.row._opt), "is-disabled": disabledOf(wr.row._opt) })} role="option" aria-selected={!!isSelected(wr.row._opt)} aria-disabled={!!disabledOf(wr.row._opt)} onClick={($event) => { select(wr.row._opt); }} onMouseMove={($event) => { onOptionPointerMove(wr.vi.index); }} data-rozie-s-b576227a="">
          {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option: wr.row._opt, index: wr.vi.index, active: activeIndex === wr.vi.index, selected: isSelected(wr.row._opt), disabled: disabledOf(wr.row._opt) }) : rozieDisplay(labelOf(wr.row._opt))}
        </div>)}

        <div className={"rozie-listbox-spacer"} aria-hidden="true" style={parseInlineStyle('height:' + padBottom() + 'px')} data-rozie-s-b576227a="" />

        {!!(windowSource().length === 0) && <div className={"rozie-listbox-empty"} role="presentation" data-rozie-s-b576227a="">
          {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : "No options"}
        </div>}</div>}</div>
    </>
  );
});
export default Listbox;
