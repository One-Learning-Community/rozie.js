import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, parseInlineStyle, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './Combobox.css';
// virtual-core: the framework-agnostic windowing state machine (the data-table
// precedent — NO per-framework adapter). The static import is emitted unconditionally;
// every RUNTIME reference sits behind `if ($props.virtual)` / a `virtualizer` guard so
// the non-virtual emitted path executes none of it (byte-identical-off).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// ---- native option grouping (combobox-native-groups: src/internal/groupOptions.ts) ----
// The PURE stable-partition helper is a RUNTIME import (unlike listCore/windowing
// above, it is NOT a compile-time `.rzts` partial that dissolves at compile) —
// codegen's `copyInternal` vendors it verbatim into each leaf at
// `./internal/groupOptions`, mirroring command-palette's `scoreCommands.ts`.
import { groupOptions } from './internal/groupOptions';

// Windowing instance state (reassigned module-`let`s → React hoists to useRef; do NOT
// const). NULL until $onMount, ONLY constructed when $props.virtual. gridScrollEl is the
// captured .rozie-combobox-list scroll div; remeasurePending dedupes the deferred sweep.

interface OptionCtx { option: any; index: any; active: any; selected: any; disabled: any; }

interface EmptyCtx { query: any; }

interface GroupHeadingCtx { group: any; }

interface GroupMoreCtx { group: any; hidden: any; expand: any; }

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
   * The option list — `[{ value, label, disabled?, group? }]`. `label` is the displayed text (and what client filtering matches against), `value` is what `r-model:value` reads and writes, an optional `disabled` flag makes an option non-selectable, and an optional `group` string buckets the option under a matching entry of the `groups` prop (or a first-appearance fallback section) when grouping is active.
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
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling popup (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed combobox. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded.
   */
  virtual?: boolean;
  /**
   * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  estimateRowHeight?: number;
  /**
   * A CSS length string bounding the popup scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-combobox-list-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
   */
  maxHeight?: string;
  /**
   * Ordered section list `[{ id, label }]` setting group order + heading text. Options are partitioned by their optional `group?` string; groups present on options but absent here fall back to first-appearance order after the listed ones. Empty/absent ⇒ flat, ungrouped rendering (default).
   */
  groups?: any[];
  /**
   * Cap each native section group to its first `groupCap` results, adding a keyboard-reachable '+N more' row that expands that group IN PLACE when activated. `0`/absent = uncapped (default), byte-identical to today. Only applies to the non-virtual grouped render (`groups` non-empty); ignored when `virtual` is on.
   */
  groupCap?: number;
  onChange?: (...args: any[]) => void;
  onSearch?: (...args: any[]) => void;
  renderOption?: (ctx: OptionCtx) => ReactNode;
  renderEmpty?: (ctx: EmptyCtx) => ReactNode;
  renderGroupHeading?: (ctx: GroupHeadingCtx) => ReactNode;
  renderGroupMore?: (ctx: GroupMoreCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface ComboboxHandle {
  focus: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  seedQuery: (...args: any[]) => any;
  pinOpen: (...args: any[]) => any;
}

const Combobox = forwardRef<ComboboxHandle, ComboboxProps>(function Combobox(_props: ComboboxProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => [])())[0];
  const __defaultGroups = useState(() => (() => [])())[0];
  const props: Omit<ComboboxProps, 'options' | 'placeholder' | 'disabled' | 'disableFilter' | 'ariaLabel' | 'idBase' | 'inline' | 'closeOnSelect' | 'optionLabel' | 'optionValue' | 'optionDisabled' | 'virtual' | 'estimateRowHeight' | 'maxHeight' | 'groups' | 'groupCap'> & { options: any[]; placeholder: string; disabled: boolean; disableFilter: boolean; ariaLabel: (string) | null; idBase: string; inline: boolean; closeOnSelect: boolean; optionLabel: ((...args: any[]) => any) | null; optionValue: ((...args: any[]) => any) | null; optionDisabled: ((...args: any[]) => any) | null; virtual: boolean; estimateRowHeight: number; maxHeight: string; groups: any[]; groupCap: number } = {
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
    virtual: _props.virtual ?? false,
    estimateRowHeight: _props.estimateRowHeight ?? 36,
    maxHeight: _props.maxHeight ?? '',
    groups: _props.groups ?? __defaultGroups,
    groupCap: _props.groupCap ?? 0,
  };
  const attrs: Record<string, unknown> = (() => {
    const { value, options, placeholder, disabled, disableFilter, ariaLabel, idBase, inline, closeOnSelect, optionLabel, optionValue, optionDisabled, virtual, estimateRowHeight, maxHeight, groups, groupCap, defaultValue, onValueChange, ...rest } = _props as ComboboxProps & Record<string, unknown>;
    void value; void options; void placeholder; void disabled; void disableFilter; void ariaLabel; void idBase; void inline; void closeOnSelect; void optionLabel; void optionValue; void optionDisabled; void virtual; void estimateRowHeight; void maxHeight; void groups; void groupCap; void defaultValue; void onValueChange;
    return rest;
  })();
  const didMount = useRef(false);
  const virtualizer = useRef<any>(null);
  const gridScrollEl = useRef<any>(null);
  const virtualizerCleanup = useRef<any>(null);
  const remeasurePending = useRef(false);
  const pinned = useRef(false);
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? null,
    onValueChange: props.onValueChange,
  });
  const _virtualRef = useRef(props.virtual);
  _virtualRef.current = props.virtual;
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rows, setRows] = useState<any[]>([]);
  const [windowVer, setWindowVer] = useState(0);
  const [editVer, setEditVer] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, any>>({});
  const inputEl = useRef<HTMLInputElement | null>(null);
  const __rozieRoot = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);

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
  function virtualItemKey(i: any) {
    const src = windowSource();
    return src && src[i] ? src[i].id : undefined;
  }
  function virtualizerOptions(): any {
    return {
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
    };
  }
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
  const filteredOptionsCache = useMemo(() => ({
    keys: null as any[] | null,
    val: null as any
  }), []);
  function filteredOptions() {
    const __rozieMemoKey = (() => {
      const opts = Array.isArray(props.options) ? props.options : [];
      const df = !!props.disableFilter;
      const q = String(query == null ? '' : query);
      const groupsProp = props.groups;
      return [opts, q, df, groupsProp];
    })();
    const __rozieMemoPrev = filteredOptionsCache.keys;
    if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
      return filteredOptionsCache.val;
    }
    const __rozieMemoVal = (() => {
      const opts = Array.isArray(props.options) ? props.options : [];
      const df = !!props.disableFilter;
      const q = String(query == null ? '' : query);
      const groupsProp = props.groups;
      let list = opts;
      if (!df) {
        const ql = q.toLowerCase();
        if (ql) list = opts.filter((o: any) => String(labelOf(o)).toLowerCase().indexOf(ql) !== -1);
      }
      // Gated to !$props.virtual (groups×virtual is deferred/unsupported per design) AND to
      // $props.groups being a NON-EMPTY array — an explicit author opt-in. This is deliberately
      // NOT just "!$props.virtual" (groupOptions() would otherwise also fire whenever any raw
      // option happens to carry a `.group` field, even with `groups` absent — a real collision
      // discovered against command-palette's CommandItem.group, which is a PRE-EXISTING,
      // unrelated per-row-badge field, not an opt-in to combobox's native grouping. The design's
      // "Empty/absent `groups` ⇒ today's flat behavior, byte-identical" contract is about the
      // `groups` PROP only — never inferred from incidental option shape.
      if (!props.virtual && Array.isArray(groupsProp) && groupsProp.length > 0) {
        const partition = groupOptions(list, groupsProp, (o: any) => o && o.group != null ? String(o.group) : null);
        list = partition.ordered;
      }
      // `_i` is assigned over the (now group-ordered) list, so the flat keyboard model
      // (activeIndex/aria-activedescendant/nextEnabled) walks visual order unchanged.
      // `group` carries the wrapper's normalized group id for groupBlocks() below.
      return list.map((o: any, i: any) => ({
        value: valueOf(o),
        label: labelOf(o),
        disabled: disabledOf(o),
        _i: i,
        id: valueOf(o),
        option: o,
        group: o && o.group != null ? String(o.group) : null
      }));
    })();
    filteredOptionsCache.keys = __rozieMemoKey;
    filteredOptionsCache.val = __rozieMemoVal;
    return __rozieMemoVal;
  }
  function windowSource() {
    return filteredOptions();
  }
  function windowedView() {
    // SUBSCRIBE FIRST (fine-grained Solid <For> / Svelte {#each}) — touch windowVer at the
    // TOP, mirroring windowedRows()'s own subscribe-first discipline (windowing.rzts), so
    // the accessor re-runs when buildVirtualizer()/kickWindow() bump windowVer once the
    // virtualizer attaches — the transition OUT of this fallback and into windowedRows().
    void windowVer;
    if (props.virtual && !virtualizer.current && didMount.current) {
      return windowSource().map((row: any) => ({
        vi: {
          index: row._i
        },
        row
      }));
    }
    return windowedRows();
  }
  function groupBlocks() {
    const wrappers = filteredOptions();
    const groupsProp = Array.isArray(props.groups) ? props.groups : [];
    const labelFor = (gid: any) => {
      const found = groupsProp.find((g: any) => g && g.id === gid);
      return found ? found.label : gid;
    };
    const blocks = [];
    let lastGid;
    for (let i = 0; i < wrappers.length; i++) {
      const w = wrappers[i];
      if (i === 0 || w.group !== lastGid) {
        blocks.push({
          group: w.group == null ? null : {
            id: w.group,
            label: labelFor(w.group)
          },
          items: [w]
        });
      } else {
        blocks[blocks.length - 1].items.push(w);
      }
      lastGid = w.group;
    }
    return blocks;
  }
  function isGrouped() {
    return !props.virtual && Array.isArray(props.groups) && props.groups.length > 0;
  }
  function capNum() {
    const n = Number(props.groupCap);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  function isCapped() {
    return isGrouped() && capNum() > 0;
  }
  function gkey(gid: any) {
    return gid == null ? '__ungrouped__' : String(gid);
  }
  function isExpanded(gid: any) {
    return !!(expandedGroups && expandedGroups[gkey(gid)]);
  }
  function expandGroup(gid: any) {
    setExpandedGroups(prev => Object.assign({}, prev, {
      [gkey(gid)]: true
    }));
  }
  function cappedBlocks() {
    const blocks = groupBlocks();
    const cap = capNum();
    let running = 0;
    const out = [];
    for (let bi = 0; bi < blocks.length; bi++) {
      const blk = blocks[bi];
      const gid = blk.group ? blk.group.id : null;
      const showAll = isExpanded(gid) || blk.items.length <= cap;
      const visibleSrc = showAll ? blk.items : blk.items.slice(0, cap);
      const items = [];
      for (let vi = 0; vi < visibleSrc.length; vi++) {
        items.push(Object.assign({}, visibleSrc[vi], {
          _i: running
        }));
        running++;
      }
      let more: any = null;
      if (!showAll) {
        more = {
          isMore: true,
          group: gid,
          hidden: blk.items.length - cap,
          disabled: false,
          _i: running,
          expand: () => expandGroup(gid)
        };
        running++;
      }
      out.push({
        group: blk.group,
        items,
        more
      });
    }
    return out;
  }
  function navRows() {
    if (!isCapped()) return filteredOptions();
    const out = [];
    const blocks = cappedBlocks();
    for (let bi = 0; bi < blocks.length; bi++) {
      const blk = blocks[bi];
      for (let ii = 0; ii < blk.items.length; ii++) out.push(blk.items[ii]);
      if (blk.more) out.push(blk.more);
    }
    return out;
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
    const els = gridScrollEl.current.querySelectorAll('.rozie-combobox-option[data-index]');
    for (const el of els as any) virtualizer.current.measureElement(el);
  }
  function scrollActiveIntoView() {
    if (!props.virtual && isOpen && activeIndex >= 0) {
      const list = __rozieRoot.current ? __rozieRoot.current!.querySelector('.rozie-combobox-list') : null;
      const opt = list ? list.querySelector('#' + optId(activeIndex)) : null;
      if (opt) opt.scrollIntoView({
        block: 'nearest'
      });
      return;
    }
    if (!props.virtual || !virtualizer.current || activeIndex < 0) return;
    // 'center' (not 'auto'): keep the active option well inside the rendered slice — 'auto'
    // lands it at the viewport edge where the overscan band can leave it just-unrendered for
    // a frame on the fine-grained targets (Solid).
    virtualizer.current.scrollToIndex(activeIndex, {
      align: 'center'
    });
    scheduleRemeasure();
  }
  function optId(i: any) {
    return props.idBase + '-opt-' + i;
  }
  function listId() {
    return props.idBase + '-list';
  }
  function activeId() {
    const list = navRows();
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
    if (!opt) return;
    if (opt.isMore) {
      expandGroup(opt.group);
      setActiveIndex(opt._i);
      return;
    }
    if (opt.disabled) return;
    setValue(opt.value);
    setQuery(String(opt.label));
    if (props.closeOnSelect) setIsOpen(false);
    setActiveIndex(-1);
    _rozieProp_onChange && _rozieProp_onChange({
      value: opt.value,
      option: opt.option
    });
  }, [_rozieProp_onChange, expandGroup, props.closeOnSelect, setValue]);
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
    if (pinned.current) return;
    setIsOpen(false);
  }, []);
  const onKeydown = useCallback((e: any) => {
    const key = e ? e.key : '';
    const list = navRows();
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
    // Keep the (new) active option in view — routes through the virtualizer when
    // windowing, direct scrollIntoView otherwise.
    scrollActiveIntoView();
  }, [activeIndex, isOpen, navRows, nextEnabled, scrollActiveIntoView, selectOption]);
  function kickWindow(attempts: any) {
    if (!virtualizer.current) return;
    gridScrollEl.current = __rozieRoot.current ? __rozieRoot.current!.querySelector('.rozie-combobox-list') : gridScrollEl.current;
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
  }
  const buildVirtualizer = useCallback(() => {
    if (!props.virtual || virtualizer.current) return;
    // Capture the scroll container via $el.querySelector (the data-table gridScrollEl
    // precedent, proven ×6 incl Lit shadow + Solid) — $refs on a conditionally-rendered
    // node is null on Solid/Lit, leaving the virtualizer with no scroll element. The windowed
    // popup stays mounted whenever virtual (r-if="$props.virtual"); it is only hidden via
    // display:none when closed (CR-01), so the .rozie-combobox-list scroll container already
    // exists here for the virtualizer to attach to.
    gridScrollEl.current = __rozieRoot.current ? __rozieRoot.current!.querySelector('.rozie-combobox-list') : null;
    virtualizer.current = new Virtualizer(virtualizerOptions());
    virtualizerCleanup.current = virtualizer.current._didMount();
    setWindowVer(prev => prev + 1);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => kickWindow(8));else setTimeout(() => kickWindow(8), 0);
  }, [kickWindow, props.virtual, virtualizerOptions]);
  function teardownVirtualizer() {
    if (virtualizerCleanup.current) virtualizerCleanup.current();
    virtualizer.current = null;
    virtualizerCleanup.current = null;
    gridScrollEl.current = null;
    setWindowVer(prev => prev + 1);
  }
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
  function seedQuery(text: any) {
    setQuery(String(text == null ? '' : text));
  }
  function pinOpen(v: any) {
    pinned.current = !!v;
  }

  useEffect(() => {
    syncQueryToValue();
    syncRows();
    didMount.current = true;
    // Routes through the SAME buildVirtualizer() the virtual $watch calls below
    // (VIRT-BUILD) — one construction site, so the mount path cannot drift from the flip
    // path.
    if (_virtualRef.current) buildVirtualizer();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      if (virtualizerCleanup.current) virtualizerCleanup.current();
    };
  }, []);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    syncQueryToValue();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    if (expandedGroups && Object.keys(expandedGroups).length) setExpandedGroups({});
    syncRows();
    if (props.virtual && virtualizer.current) {
      virtualizer.current.setOptions(virtualizerOptions());
      virtualizer.current._willUpdate();
      setWindowVer(prev => prev + 1);
      scheduleRemeasure();
    }
  }, [props.options, query]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    if (expandedGroups && Object.keys(expandedGroups).length) setExpandedGroups({});
    if (props.virtual) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => buildVirtualizer());else setTimeout(() => buildVirtualizer(), 0);
    } else {
      teardownVirtualizer();
    }
  }, [props.virtual]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ focus, clear, seedQuery, pinOpen });
  _rozieExposeRef.current = { focus, clear, seedQuery, pinOpen };
  useImperativeHandle(ref, () => ({ focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args), seedQuery: (...args: Parameters<typeof seedQuery>): ReturnType<typeof seedQuery> => _rozieExposeRef.current.seedQuery(...args), pinOpen: (...args: Parameters<typeof pinOpen>): ReturnType<typeof pinOpen> => _rozieExposeRef.current.pinOpen(...args) }), []);

  return (
    <>
    <div ref={__rozieRoot} {...attrs} className={clsx(clsx("rozie-combobox", { "rozie-combobox--open": isOpen, "rozie-combobox--disabled": props.disabled, "rozie-combobox--inline": props.inline }), (attrs.className as string | undefined))} data-rozie-s-9546115a="">
      <input ref={inputEl} className={"rozie-combobox-input"} type="text" role="combobox" aria-autocomplete="list" aria-expanded={!!isOpen} aria-controls={rozieAttr(listId())} aria-activedescendant={rozieAttr(activeId())} aria-label={rozieAttr(props.ariaLabel)} value={query} placeholder={props.placeholder} disabled={!!props.disabled} autoComplete="off" onInput={($event) => { onInput($event); }} onFocus={($event) => { onFocus($event); }} onBlur={($event) => { onBlur(); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-9546115a="" />

      
      {!!(isOpen && !props.virtual && !isGrouped()) && <ul className={"rozie-combobox-list"} id={rozieAttr(listId())} role="listbox" data-rozie-s-9546115a="">
        {filteredOptions().map((opt) => <li key={opt.value} className={clsx("rozie-combobox-option", { "rozie-combobox-option--active": opt._i === activeIndex, "rozie-combobox-option--selected": opt.value === value, "rozie-combobox-option--disabled": opt.disabled })} id={rozieAttr(optId(opt._i))} role="option" aria-selected={opt.value === value} aria-disabled={!!opt.disabled} onMouseDown={($event) => { $event.preventDefault(); selectOption(opt); }} onMouseEnter={($event) => { setActiveIndex(opt._i); }} data-rozie-s-9546115a="">
          {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option: opt.option, index: opt._i, active: opt._i === activeIndex, selected: opt.value === value, disabled: opt.disabled }) : rozieDisplay(opt.label)}
        </li>)}

        {!!(filteredOptions().length === 0) && <li className={"rozie-combobox-empty"} role="presentation" data-rozie-s-9546115a="">
          {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : "No results"}
        </li>}</ul>}{!!(isOpen && !props.virtual && isGrouped() && !isCapped()) && <ul className={"rozie-combobox-list"} id={rozieAttr(listId())} role="listbox" data-rozie-s-9546115a="">
        {groupBlocks().map((blk) => <li key={'grp-' + (blk.group ? blk.group.id : '_ungrouped')} className={"rozie-combobox-group"} role="group" aria-label={rozieAttr(blk.group ? blk.group.label : undefined)} data-rozie-s-9546115a="">
          {!!(blk.group) && <div className={"rozie-combobox-group-heading"} role="presentation" data-rozie-s-9546115a="">
            {(props.renderGroupHeading ?? props.slots?.['groupHeading']) ? ((props.renderGroupHeading ?? props.slots?.['groupHeading']) as Function)({ group: blk.group }) : rozieDisplay(blk.group.label)}
          </div>}{blk.items.map((opt) => <div key={opt.value} className={clsx("rozie-combobox-option", { "rozie-combobox-option--active": opt._i === activeIndex, "rozie-combobox-option--selected": opt.value === value, "rozie-combobox-option--disabled": opt.disabled })} id={rozieAttr(optId(opt._i))} role="option" aria-selected={opt.value === value} aria-disabled={!!opt.disabled} onMouseDown={($event) => { $event.preventDefault(); selectOption(opt); }} onMouseEnter={($event) => { setActiveIndex(opt._i); }} data-rozie-s-9546115a="">
            {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option: opt.option, index: opt._i, active: opt._i === activeIndex, selected: opt.value === value, disabled: opt.disabled }) : rozieDisplay(opt.label)}
          </div>)}
        </li>)}

        {!!(groupBlocks().length === 0) && <li className={"rozie-combobox-empty"} role="presentation" data-rozie-s-9546115a="">
          {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : "No results"}
        </li>}</ul>}{!!(isOpen && !props.virtual && isCapped()) && <ul className={"rozie-combobox-list"} id={rozieAttr(listId())} role="listbox" data-rozie-s-9546115a="">
        {cappedBlocks().map((blk) => <li key={'grp-' + (blk.group ? blk.group.id : '_ungrouped')} className={"rozie-combobox-group"} role="group" aria-label={rozieAttr(blk.group ? blk.group.label : undefined)} data-rozie-s-9546115a="">
          {!!(blk.group) && <div className={"rozie-combobox-group-heading"} role="presentation" data-rozie-s-9546115a="">
            {(props.renderGroupHeading ?? props.slots?.['groupHeading']) ? ((props.renderGroupHeading ?? props.slots?.['groupHeading']) as Function)({ group: blk.group }) : rozieDisplay(blk.group.label)}
          </div>}{blk.items.map((opt) => <div key={opt.value} className={clsx("rozie-combobox-option", { "rozie-combobox-option--active": opt._i === activeIndex, "rozie-combobox-option--selected": opt.value === value, "rozie-combobox-option--disabled": opt.disabled })} id={rozieAttr(optId(opt._i))} role="option" aria-selected={opt.value === value} aria-disabled={!!opt.disabled} onMouseDown={($event) => { $event.preventDefault(); selectOption(opt); }} onMouseEnter={($event) => { setActiveIndex(opt._i); }} data-rozie-s-9546115a="">
            {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option: opt.option, index: opt._i, active: opt._i === activeIndex, selected: opt.value === value, disabled: opt.disabled }) : rozieDisplay(opt.label)}
          </div>)}

          {!!(blk.more) && <div className={clsx("rozie-combobox-option", "rozie-combobox-more", { "rozie-combobox-option--active": blk.more._i === activeIndex })} id={rozieAttr(optId(blk.more._i))} role="option" onMouseDown={($event) => { $event.preventDefault(); selectOption(blk.more); }} onMouseEnter={($event) => { setActiveIndex(blk.more._i); }} data-rozie-s-9546115a="">
            {(props.renderGroupMore ?? props.slots?.['groupMore']) ? ((props.renderGroupMore ?? props.slots?.['groupMore']) as Function)({ group: blk.group, hidden: blk.more.hidden, expand: blk.more.expand }) : <>+{rozieDisplay(blk.more.hidden)} more</>}
          </div>}</li>)}

        {!!(cappedBlocks().length === 0) && <li className={"rozie-combobox-empty"} role="presentation" data-rozie-s-9546115a="">
          {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : "No results"}
        </li>}</ul>}{!!(props.virtual) && <ul className={"rozie-combobox-list rozie-combobox-list--virtual"} id={rozieAttr(listId())} role="listbox" style={parseInlineStyle((isOpen ? '' : 'display:none;') + (props.maxHeight ? 'height:' + props.maxHeight + ';max-height:' + props.maxHeight + ';overflow-y:auto;--rozie-combobox-list-max-height:' + props.maxHeight : 'overflow-y:auto'))} data-rozie-s-9546115a="">
        <li className={"rozie-combobox-spacer"} aria-hidden="true" style={parseInlineStyle('height:' + padTop() + 'px')} data-rozie-s-9546115a="" />

        {windowedView().map((wr) => <li key={wr.row.id} className={clsx("rozie-combobox-option", { "rozie-combobox-option--active": wr.vi.index === activeIndex, "rozie-combobox-option--selected": wr.row.value === value, "rozie-combobox-option--disabled": wr.row.disabled })} id={rozieAttr(optId(wr.vi.index))} data-index={rozieAttr(wr.vi.index)} role="option" aria-selected={wr.row.value === value} aria-disabled={!!wr.row.disabled} onMouseDown={($event) => { $event.preventDefault(); selectOption(wr.row); }} onMouseEnter={($event) => { setActiveIndex(wr.vi.index); }} data-rozie-s-9546115a="">
          {(props.renderOption ?? props.slots?.['option']) ? ((props.renderOption ?? props.slots?.['option']) as Function)({ option: wr.row.option, index: wr.vi.index, active: wr.vi.index === activeIndex, selected: wr.row.value === value, disabled: wr.row.disabled }) : rozieDisplay(wr.row.label)}
        </li>)}

        <li className={"rozie-combobox-spacer"} aria-hidden="true" style={parseInlineStyle('height:' + padBottom() + 'px')} data-rozie-s-9546115a="" />

        {!!(windowSource().length === 0) && <li className={"rozie-combobox-empty"} role="presentation" data-rozie-s-9546115a="">
          {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)({ query }) : "No results"}
        </li>}</ul>}</div>
    </>
  );
});
export default Combobox;
