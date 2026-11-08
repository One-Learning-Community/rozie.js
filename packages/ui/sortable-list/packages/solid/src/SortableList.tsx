import type { JSX } from 'solid-js';
import { For, children, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, parseInlineStyle, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
import { useSortableJS } from './internal/useSortableJS';
import { getKeyboardRegistry, nextInstructionsId } from './internal/keyboardRegistry';

__rozieInjectStyle('SortableList-0af24eae', `.rozie-sortable-wrap[data-rozie-s-0af24eae] { display: block; }
.rozie-sortable-list[data-rozie-s-0af24eae] { display: block; }
.rozie-sortable-item[data-rozie-s-0af24eae] { display: block; outline: none; }
.rozie-sortable-item[data-rozie-s-0af24eae]:focus { outline: 2px solid rgba(0, 102, 204, 0.6); outline-offset: -2px; }
.rozie-sortable-item-lifted[data-rozie-s-0af24eae] {
  background: rgba(0, 102, 204, 0.08);
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.4) inset;
}
.rozie-sortable-aria-live[data-rozie-s-0af24eae] {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}`);

interface DefaultSlotCtx { item: any; index: any; instructionsId: any; }

interface SortableListProps extends Omit<import('solid-js').ComponentProps<'div'>, 'items' | 'defaultItems' | 'onItemsChange' | 'itemKey' | 'handle' | 'group' | 'animation' | 'disabled' | 'disableKeyboard' | 'keyboardTrigger' | 'options' | 'labelFor' | 'ghostClass' | 'chosenClass' | 'dragClass' | 'filter' | 'easing' | 'forceFallback' | 'swapThreshold' | 'cloneable' | 'listClass' | 'itemClass' | 'listLabel' | 'orientation' | 'pageStep' | 'keyboardInstructions' | 'itemStyle' | 'onChange' | 'onAdd' | 'onRemove' | 'onStart' | 'onEnd' | 'headerSlot' | 'children' | 'footerSlot' | 'slots' | 'ref' | 'innerHTML' | 'innerText' | 'textContent'> {
  /**
   * The bound items array. The sole `model: true` prop — two-way bind it (`r-model:items` / `v-model:items` / `bind:items` / `[(items)]`) and SortableList writes the re-ordered array back whenever a drag, cross-list move, or keyboard reorder commits, with no manual `onChange → setState` wiring.
   * @example
   * <SortableList items={todos()} onItemsChange={setTodos} itemKey="id" />
   */
  items?: any[];
  defaultItems?: any[];
  onItemsChange?: (items: any[]) => void;
  /**
   * The per-row key the framework reconciler tracks each item by across a reorder — either a property name (e.g. `itemKey="id"` reads `item.id`) or an `(item, index) => key` function. With neither, id-less object items get a stable synthetic key via an internal `WeakMap` (survives reorder by object identity); primitive items fall back to index — pass a function for reorderable duplicate primitives.
   */
  itemKey?: (string | ((...args: any[]) => any)) | null;
  /**
   * CSS selector identifying the per-row drag handle, so a drag starts only from that element rather than anywhere in the row. Authored class names render literally on every target (React included), so a plain `.grip` works; `$classSelector('grip')` is an optional, typo-checked way to author it.
   */
  handle?: (string) | null;
  /**
   * SortableJS group name enabling cross-list drag — two lists sharing a `group` accept items between each other (the source fires `remove`, the destination fires `add`). Set `cloneable: true` to flip a string group into clone-mode.
   */
  group?: (string) | null;
  /**
   * Reorder animation duration in milliseconds. `0` disables the animation. Runtime-updatable.
   */
  animation?: number;
  /**
   * Temporarily disable dragging without unmounting — reapplied live via `instance.option('disabled', v)` (no remount). Also suppresses keyboard reordering: a disabled list is not sortable by any input, so rows lose their `tabindex` and the keydown handler no-ops.
   */
  disabled?: boolean;
  /**
   * Opt out of keyboard reordering (Space lift / Arrow move / Esc cancel / Enter drop) while leaving pointer drag enabled. Rows drop out of the tab order (no `tabindex`) and the keydown handler no-ops. Keyboard access is gated on `!disabled && !disableKeyboard`.
   */
  disableKeyboard?: boolean;
  /**
   * Which element drives keyboard reordering. `'row'` (default): rows are tab stops and the keys on the focused row drive reordering. `'handle'`: rows are NOT tab stops, and only keys pressed inside the element matched by `handle` (inside that row) drive the same Space/Enter lift-drop, Arrow move and Escape cancel flow; handled keys call preventDefault so a handle `<button>`'s click does not fire. The consumer owns the handle markup (recommended: a `<button>` with its own aria-label such as "Reorder Hero banner") and the component adds no tabindex or role to slot content. `'handle'` without `handle` turns keyboard reordering off and logs a console warning. `disabled`/`disableKeyboard` still apply. Any value other than `'handle'` behaves as `'row'`.
   */
  keyboardTrigger?: string;
  /**
   * Verbatim SortableJS options pass-through for anything not covered by the named props. The named props win on key conflict but `options` lands AFTER them in the merge so consumers can override defaults; handler keys (`onStart`, `onEnd`, `onUpdate`, `onAdd`, `onRemove`, `onClone`) are stripped — the helper owns those paths.
   */
  options?: Record<string, any>;
  /**
   * Optional `(item, idx) => string` returning the screen-reader label for the aria-live announcer during keyboard drag. Defaults to `item.label` (or `String(item)` when no `label` field exists).
   */
  labelFor?: ((...args: any[]) => any) | null;
  /**
   * Class name applied to the drop-placeholder (ghost) element while dragging. Forwarded live via `instance.option`, so toggling it at runtime takes effect without a remount.
   */
  ghostClass?: (string) | null;
  /**
   * Class name applied to the currently-chosen item while dragging. Forwarded live via `instance.option` (no remount needed to change it).
   */
  chosenClass?: (string) | null;
  /**
   * Class name applied to the dragging element. Only takes effect in fallback mode (`forceFallback: true`). Forwarded live via `instance.option`.
   */
  dragClass?: (string) | null;
  /**
   * CSS selector that prevents drag initiation on matching rows (locked items). SortableJS checks it at `mousedown`/`touchstart` and aborts the drag if it matches. A `data-*` attribute selector (e.g. `[data-locked]`) is the most robust choice across all targets.
   */
  filter?: (string) | null;
  /**
   * CSS easing function for the reorder animation (e.g. `'ease-in'`, `'cubic-bezier(0.4, 0, 0.2, 1)'`). Runtime-updatable.
   */
  easing?: (string) | null;
  /**
   * Force SortableJS's mouse-event drag path over HTML5 DnD — useful for touch devices, consistent cross-browser behavior, and synthetic test drivers (and `dragClass` only applies in this mode). **Construction-time only**: SortableJS reads it once at construction, so re-key the `<SortableList>` to toggle it at runtime.
   */
  forceFallback?: boolean;
  /**
   * SortableJS swap threshold (0..1) — a lower value makes rows swap earlier as the dragged item overlaps a neighbor. Reapplied live via `instance.option('swapThreshold', v)` — SortableJS reads it on every dragover, so no remount is needed.
   */
  swapThreshold?: number;
  /**
   * High-level prop that REPLACES a string `group` with SortableJS's `{ name, pull: 'clone', put: true }` clone-mode object form — the source deposits a COPY onto the destination and keeps its own array unchanged (the palette → canvas pattern). With `group: null` it is a no-op (a clone-mode list with no group name has no peer to clone into). Reapplied live — toggling `cloneable` (or changing `group`) recomputes the clone-mode shape and reapplies it via `instance.option('group', …)`, no remount.
   */
  cloneable?: boolean;
  /**
   * Extra class(es) merged onto the list container (the SortableJS root) alongside the base `rozie-sortable-list` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding), normalized identically across all six targets — the hook for bridging a CSS framework (`.list-group`) or a flex/grid parent onto the component.
   */
  listClass?: string | any[] | Record<string, any>;
  /**
   * Extra class(es) merged onto every item row alongside the base `rozie-sortable-item` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding) applied uniformly, OR an `(item, index) => class` function for per-row classes evaluated at render time. Normalized identically across all six targets.
   */
  itemClass?: string | any[] | Record<string, any> | ((...args: any[]) => any);
  /**
   * The list's human name, such as `"Top sidebar"`. Sets `aria-label` on the list container (`role="list"`) and names the list in keyboard announcements. Pass the same words as the zone's visible heading. With no label, announcements fall back to a neutral `list 2 of 3`.
   */
  listLabel?: (string) | null;
  /**
   * Which arrow keys move a lifted row within the list: `'vertical'` (default) uses ↑/↓, `'horizontal'` uses ←/→. Also sets `aria-orientation` on the list container.
   */
  orientation?: string;
  /**
   * How many positions Page Up / Page Down move a lifted row. The move stops at the first or last position when fewer rows remain.
   */
  pageStep?: number;
  /**
   * Replaces the spoken keyboard instructions. The text sits in a hidden element referenced by `aria-describedby` from each tabbable row (row mode) or from the consumer's handle via the `instructionsId` slot prop (handle mode). Default: "Press Space or Enter to pick up. Use the arrow keys to move, Home and End to jump, and Escape to cancel." When `group` is set the default adds "Hold Shift with an arrow key to move to another list."
   */
  keyboardInstructions?: (string) | null;
  /**
   * Per-row inline style applied to the `.rozie-sortable-item` wrapper. Accepts a CSS `String`, a flat style object (`Record<string, string | number>`), or an `(item, index) => string | object` function for per-row styling. Because it lands on the wrapper — the direct child of the list container — it can drive CSS-grid placement (`grid-column` / `grid-row` / `align-self`) when `listClass` sets `display: grid`. Normalized per target; `null` / empty drops the attribute.
   */
  itemStyle?: (string | Record<string, any> | ((...args: any[]) => any)) | null;
  onChange?: (...args: any[]) => void;
  onAdd?: (...args: any[]) => void;
  onRemove?: (...args: any[]) => void;
  onStart?: (...args: any[]) => void;
  onEnd?: (...args: any[]) => void;
  headerSlot?: JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element | ((ctx: DefaultSlotCtx) => JSX.Element);
  footerSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: SortableListHandle) => void;
}

export interface SortableListHandle {
  getInstance: (...args: any[]) => any;
  toArray: (...args: any[]) => any;
  sort: (...args: any[]) => any;
  option: (...args: any[]) => any;
}

export default function SortableList(_props: SortableListProps): JSX.Element {
  const _merged = mergeProps({ itemKey: null, handle: null, group: null, animation: 150, disabled: false, disableKeyboard: false, keyboardTrigger: 'row', options: (() => ({}))() as Record<string, any>, labelFor: null, ghostClass: null, chosenClass: null, dragClass: null, filter: null, easing: null, forceFallback: false, swapThreshold: 1, cloneable: false, listClass: '', itemClass: '', listLabel: null, orientation: 'vertical', pageStep: 5, keyboardInstructions: null, itemStyle: null }, _props);
  const [local, attrs] = splitProps(_merged, ['items', 'itemKey', 'handle', 'group', 'animation', 'disabled', 'disableKeyboard', 'keyboardTrigger', 'options', 'labelFor', 'ghostClass', 'chosenClass', 'dragClass', 'filter', 'easing', 'forceFallback', 'swapThreshold', 'cloneable', 'listClass', 'itemClass', 'listLabel', 'orientation', 'pageStep', 'keyboardInstructions', 'itemStyle', 'children', 'ref', 'onChange', 'onAdd', 'onRemove', 'onStart', 'onEnd', 'headerSlot', 'footerSlot', 'slots']);
  const resolved = children(() => local.children as JSX.Element);
  onMount(() => { local.ref?.({ getInstance, toArray, sort, option }); });

  const [items, setItems] = createControllableSignal<any[]>(_props as unknown as Record<string, unknown>, 'items', (() => [])());
  const [liftedIndex, setLiftedIndex] = createSignal<any>(null);
  const [ariaLiveText, setAriaLiveText] = createSignal('');
  createEffect(on(() => (() => local.disabled)(), (v) => untrack(() => ((v: any) => instance?.option('disabled', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.group)(), (v) => untrack(() => (() => instance?.option('group', resolveGroup()))()), { defer: true }));
  createEffect(on(() => (() => local.cloneable)(), (v) => untrack(() => (() => instance?.option('group', resolveGroup()))()), { defer: true }));
  createEffect(on(() => (() => local.swapThreshold)(), (v) => untrack(() => ((v: any) => instance?.option('swapThreshold', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.handle)(), (v) => untrack(() => ((v: any) => {
    instance?.option('handle', v);
    warnIfHandleMissing();
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.keyboardTrigger)(), (v) => untrack(() => (() => warnIfHandleMissing())()), { defer: true }));
  createEffect(on(() => (() => local.ghostClass)(), (v) => untrack(() => ((v: any) => instance?.option('ghostClass', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.chosenClass)(), (v) => untrack(() => ((v: any) => instance?.option('chosenClass', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.dragClass)(), (v) => untrack(() => ((v: any) => instance?.option('dragClass', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.filter)(), (v) => untrack(() => ((v: any) => instance?.option('filter', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.easing)(), (v) => untrack(() => ((v: any) => instance?.option('easing', v))(v)), { defer: true }));
  onMount(() => {
    const _cleanup = (() => {
    warnIfHandleMissing();
    // Named `sortable` (not `handle`) to avoid shadowing `$props.handle`
    // when the options object below references it.
    const sortable = useSortableJS(listElRef!, {
      items: () => items(),
      onCommit: (next: any) => {
        setItems(next);
      },
      options: {
        animation: local.animation,
        disabled: local.disabled,
        group: resolveGroup(),
        handle: local.handle ?? undefined,
        ghostClass: local.ghostClass ?? undefined,
        chosenClass: local.chosenClass ?? undefined,
        dragClass: local.dragClass ?? undefined,
        filter: local.filter ?? undefined,
        forceFallback: local.forceFallback,
        swapThreshold: local.swapThreshold,
        easing: local.easing ?? undefined,
        ...local.options
      },
      // Lit lit-html `repeat` directive caches its part array by sentinel-
      // comment node identity; SortableJS's physical DOM mutation desyncs
      // that cache. The sigil lowers to `__rozieReconcileAfterDomMutation(this)`
      // on Lit (real call) and `void 0` on the other 5 targets (no-op).
      afterCommit: () => void 0,
      onChange: ({
        kind,
        oldIndex,
        newIndex,
        item
      }: any) => {
        if (kind === 'reorder') _props.onChange?.({
          oldIndex,
          newIndex,
          item,
          interaction: 'pointer'
        });else if (kind === 'add') _props.onAdd?.({
          newIndex,
          item,
          interaction: 'pointer'
        });else if (kind === 'remove') _props.onRemove?.({
          oldIndex,
          item,
          interaction: 'pointer'
        });
      },
      onStart: (e: any) => {
        // A pointer drag ends any active keyboard lift first.
        if (registry.lift != null) endLift('drop');
        (e as any).interaction = 'pointer';
        _props.onStart?.(e);
      },
      onEnd: (e: any) => {
        (e as any).interaction = 'pointer';
        _props.onEnd?.(e);
      }
    });
    instance = sortable.instance;

    // Register with the keyboard registry. Other instances call these methods
    // when a keyboard lift hands a row between lists.
    const listEl = listElRef;
    entry = {
      el: listEl,
      instructionsId,
      group: () => resolveGroup(),
      label: () => local.listLabel,
      keyboardEnabled: () => keyboardEnabled(),
      items: () => items(),
      keyOf: (item: any, i: any) => String(keyFor(item, i)),
      write: (next: any) => {
        setItems(next);
      },
      setLifted: (i: any) => {
        setLiftedIndex(i);
      },
      announce: (text: any) => {
        setAriaLiveText(text);
      },
      focusRow: (item: any, i: any) => refocusRow(item, i),
      rowEl: (i: any) => {
        const list = items();
        if (i < 0 || i >= list.length) return null;
        return rowByKey(listEl, String(keyFor(list[i], i)));
      },
      emit: (name: any, payload: any) => {
        if (name === 'add') _props.onAdd?.(payload);else if (name === 'remove') _props.onRemove?.(payload);else if (name === 'change') _props.onChange?.(payload);else if (name === 'start') _props.onStart?.(payload);else if (name === 'end') _props.onEnd?.(payload);
      }
    };
    unregisterEntry = registry.register(entry);
    // $onMount's cleanup-return: closing over a setup-local (`sortable`) does
    // not survive the Solid emitter's setup/cleanup split — it scopes cleanup
    // outside the setup IIFE. Closing over `instance` / `unregisterEntry`
    // (module-scope `let`s) works on every target.
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    instance?.destroy();
    unregisterEntry?.();
    unregisterEntry = null;
  });
  });
  let listElRef: HTMLElement | null = null;

  let instance: any = null;

  // Keyboard lift state lives in the shared registry (one active keyboard lift
  // per page, so a later task can hand a lifted row between lists).
  // `$data.liftedIndex` is only its mirror, for the lifted-row styling.
  const registry = getKeyboardRegistry();
  // This list's registry entry (a ListEntry), built and registered in $onMount.
  let entry: any = null;
  let unregisterEntry: any = null;

  // Per-instance id of the hidden spoken-instructions element. Assigned once
  // per instance: it is also read in $onMount (the registry entry), which makes
  // the React emitter keep it across renders instead of minting a new id each
  // render.
  const instructionsId = nextInstructionsId();
  const DEFAULT_INSTRUCTIONS = 'Press Space or Enter to pick up. Use the arrow keys to move, Home and End to jump, and Escape to cancel.';
  const GROUP_INSTRUCTIONS = ' Hold Shift with an arrow key to move to another list.';
  function instructionsText() {
    if (local.keyboardInstructions != null) return local.keyboardInstructions;
    return local.group != null ? DEFAULT_INSTRUCTIONS + GROUP_INSTRUCTIONS : DEFAULT_INSTRUCTIONS;
  }

  // Instance-scoped synthetic-id store for id-less object items. Keyed by object
  // IDENTITY, so the same object keeps its synthetic id across a reorder (the
  // framework reconciler then rebinds the row component instance to its ORIGINAL
  // item, not its slot position — the data-corruption fix).
  //
  // Phase 73 item #11-b removed the former "fold the WeakMap + counter into ONE
  // member-mutated object const" workaround: `hoistModuleLet`'s reachability
  // walk now also roots at helpers called ONLY from a template expression
  // (`keyFor` is called from `:key`/`:data-id`, never from a hook), so the bare
  // `let __rowKeySeq = 0` below hoists to a `useRef` on React exactly like the
  // hook-reached case — no more per-render reset. Verified in codegen.
  const __rowKeyMap = new WeakMap();
  let __rowKeySeq = 0;

  // 4-tier per-row key precedence. Its return feeds BOTH :key and :data-id.
  function keyFor(item: any, index: any) {
    // (a) function itemKey: consumer-supplied (item, index) => key.
    if (typeof local.itemKey === 'function') {
      return local.itemKey(item, index);
    }
    // (b) string itemKey: a property name on a non-null object item.
    if (typeof local.itemKey === 'string' && item !== null && typeof item === 'object' && item[local.itemKey] != null) {
      return item[local.itemKey];
    }
    // (c) id-less object (or function) item: assign-on-first-sight WeakMap
    //     synthetic id. Survives reorder because it is keyed by object identity.
    if (item !== null && typeof item === 'object' || typeof item === 'function') {
      if (!__rowKeyMap.has(item)) {
        __rowKeyMap.set(item, '__rk' + __rowKeySeq++);
      }
      return __rowKeyMap.get(item);
    }
    // (d) primitive item: fall back to index. NOTE: duplicate primitives are
    //     unsafe to reorder this way — pass a function itemKey for those.
    return index;
  }

  // Resolve the SortableJS `group` option: `cloneable` is a high-level Rozie
  // prop that REPLACES a string `group` with SortableJS's
  // `{ name, pull: 'clone', put: true }` clone-mode object form. When
  // `cloneable:false`, pass `$props.group` through verbatim. When
  // `cloneable:true` AND `$props.group` is null, leave it null — a clone-mode
  // list without a group name is not meaningful (no peer list can join the
  // cross-list flow). Shared by $onMount construction AND the group/cloneable
  // $watch reconcile below — single source of truth, no duplicated ternary.
  function resolveGroup() {
    return local.cloneable && typeof local.group === 'string' ? {
      name: local.group,
      pull: 'clone' as const,
      put: true as const
    } : local.group ?? undefined;
  }

  // Resolve itemClass for a row: a static value (string | array | object) OR a
  // per-row (item, index) => class function. The result is fed into the :class
  // array and normalized by each target's class path (rozieClass / clsx / native).
  function itemClassFor(item: any, index: any) {
    const v = local.itemClass;
    return typeof v === 'function' ? v(item, index) : v;
  }

  // Resolve itemStyle for a row: a static value (string | object) OR a per-row
  // (item, index) => style function. Returns string | object | null; the dynamic
  // :style binding normalizes it per target. null / empty → attribute dropped.
  function itemStyleFor(item: any, index: any) {
    const s = typeof local.itemStyle === 'function' ? local.itemStyle(item, index) : local.itemStyle;
    return s == null || s === '' ? null : s;
  }

  // Read the display label for an item — used by the aria-live announcer.
  // Phase 16 R7 / D-08: $props.labelFor reads as `null` on all 6 targets when
  // the consumer omits it (Plan 16-01 prop-default coercion fix); the check is
  // a plain null compare — NO runtime callable-type coercion.
  function labelOf(item: any, idx: any) {
    if (local.labelFor !== null) return local.labelFor(item, idx);
    if (item !== null && typeof item === 'object' && 'label' in item) return item.label;
    return String(item);
  }

  // Keyboard handler (Phase 16 R7): Space/Enter lift and drop; while lifted,
  // ArrowUp/ArrowDown (ArrowLeft/ArrowRight when horizontal), Home/End and
  // PageUp/PageDown move the row, and Escape returns it to where it was lifted
  // from. The lift itself lives in the shared keyboard registry. After
  // any array-reorder write, refocusRow() keeps focus on the moved row (or its
  // handle) on all six targets.
  //
  // Note: `index` is passed directly as a number. Plan 16-02 (Solid call-arg
  // accessor unwrap) ensures Solid's <For> alias unwraps to `index()` at the
  // call site — no runtime callable-type coercion needed in user source.
  // Keyboard reordering is available only when the list is not disabled AND the
  // `disableKeyboard` opt-out is off. Drives BOTH the row tabindex (rows are
  // focusable only when reorderable) and the onRowKeyDown guard below. Reads
  // straight off $props so the tabindex binding re-evaluates reactively when
  // `disabled`/`disableKeyboard` toggle at runtime.
  function keyboardEnabled() {
    return !local.disabled && !local.disableKeyboard;
  }

  // keyboardTrigger='handle' mode: rows are not tab stops and the keys are read
  // from the consumer's handle element instead. Any other value is 'row' mode.
  function handleMode() {
    return local.keyboardTrigger === 'handle';
  }
  // Rows are tab stops only in row mode (and only while keyboard is enabled).
  function rowTabbable() {
    return keyboardEnabled() && !handleMode();
  }

  // One-time-per-change dev warning: handle mode needs a handle selector. Without
  // one the keyboard is OFF (see the onRowKeyDown gate) — never a silent fallback
  // to row mode, which would re-introduce the tab stops the consumer opted out of.
  function warnIfHandleMissing() {
    if (handleMode() && local.handle == null) {
      console.warn('[rozie-sortable-list] keyboardTrigger is "handle" but no handle selector is set, so keyboard reordering is off. Pass a handle selector (e.g. handle=".grip") or use keyboardTrigger "row".');
    }
  }

  // True only when a keydown originated inside a `handle` element that belongs to
  // THIS row. Walks the COMPOSED ancestor chain from the event target up to (but
  // excluding) the row (currentTarget): assignedSlot -> parentNode -> shadow host.
  // Plain closest()/contains() stop at a shadow boundary, and Lit renders a Rozie
  // consumer's slot content inside the SortableList shadow root while plain-HTML
  // consumers project light-DOM nodes through a <slot>. composedPath() is not
  // used because React's synthetic event does not expose it. Another
  // .rozie-sortable-item met first means the key came from a NESTED list's row,
  // which must not reorder this (outer) list.
  function isHandleKeyOrigin($event: any) {
    const sel = local.handle;
    if (sel == null) return false;
    const row = $event.currentTarget;
    let n: any = $event.target;
    while (n && n !== row) {
      if (n.nodeType === 1) {
        if (n.matches(sel)) {
          // Matched a handle: it counts only if this row is reachable from here
          // without crossing a different sortable item.
          let m: any = n.assignedSlot ?? n.parentNode ?? n.host;
          while (m && m !== row) {
            if (m.nodeType === 1 && m.classList.contains('rozie-sortable-item')) return false;
            m = m.assignedSlot ?? m.parentNode ?? m.host;
          }
          return m === row;
        }
        if (n.classList.contains('rozie-sortable-item')) return false;
      }
      n = n.assignedSlot ?? n.parentNode ?? n.host;
    }
    return false;
  }

  // Put focus back on the MOVED row (row mode) or its handle (handle mode) after
  // a reorder write. Looks the row up by KEY (data-id), not by index, so it finds
  // the moved row whether this runs before the framework commit (the row element
  // is the same one) or after it (Svelte/Solid/Lit re-create the DOM) — and it is
  // correct for index-keyed primitive lists too. Direct children of the list
  // container only: that skips nested-list rows and the header/footer slot
  // content.
  //
  // Two passes. (1) A microtask covers targets that commit synchronously or in an
  // earlier microtask (Vue's scheduler flush is queued by the model write, before
  // this one). (2) A timer + rAF "heal" pass covers targets whose DOM commit is
  // scheduled AFTER the key handler returns (Angular): the commit can MOVE the
  // focused row, and moving a focused node blurs it, so a Home/End/Escape jump or
  // a rapid Space/Arrow/Arrow/Space burst would otherwise end with focus on
  // <body>. The heal pass never steals: it acts only when focus has been lost to
  // <body>. (`$restoreFocus(selector, index)` is not enough here: it is a no-op on
  // Vue/Angular, where a long jump moves the focused row itself, and it looks the
  // row up by index, which can land on a neighbour on Lit.) The $refs read
  // happens here, synchronously, inside an event handler — which is safe.
  function refocusRow(item: any, idx: any) {
    const listEl = listElRef;
    const sel = local.handle;
    const useHandle = handleMode();
    const key = String(keyFor(item, idx));
    const focusIt = (onlyIfLost: any) => {
      if (!listEl) return;
      if (useHandle && sel == null) return;
      if (onlyIfLost && document.activeElement && document.activeElement !== document.body) return;
      for (const row of Array.from(listEl.children) as any[]) {
        if (row.getAttribute('data-id') === key) {
          const target = useHandle ? row.querySelector(sel) : row;
          if (target && typeof target.focus === 'function') target.focus();
          return;
        }
      }
    };
    queueMicrotask(() => focusIt(false));
    setTimeout(() => focusIt(true), 0);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => focusIt(true));
  }

  // The row element carrying `data-id === key` among a list element's direct
  // children (skips nested-list rows and header/footer slot content).
  function rowByKey(listEl: any, key: any) {
    if (!listEl || key == null) return null;
    for (const row of Array.from(listEl.children) as any[]) {
      if (row.getAttribute('data-id') === key) return row;
    }
    return null;
  }

  // Keyboard `start` / `end` payload, shaped like SortableJS's pointer event:
  // `item` is the row element, `data` the item value. `start` fires from the
  // origin list (`from`), `end` from the list the row ends up in (`to`). Reads
  // the lift, so call it while `registry.lift` is still set.
  function keyboardStartEnd(name: any, from: any, to: any, oldIndex: any, newIndex: any) {
    const lift = registry.lift;
    const host = name === 'start' ? from : to;
    const payload = {
      interaction: 'keyboard',
      item: lift ? rowByKey(host.el, lift.key) : null,
      data: lift ? lift.data : null,
      from: from.el,
      to: to.el,
      oldIndex,
      newIndex
    };
    host.emit(name, payload);
  }

  // Move the lifted row to `toIndex` (clamped) within the list holding it.
  // Works through the registry entry, so it acts on the current holder.
  function moveLiftTo(toIndex: any) {
    const lift = registry.lift;
    if (!lift) return;
    const h = lift.holder;
    const from = registry.indexOfLift();
    if (from < 0) {
      // The lifted item is no longer in its list (the consumer changed the
      // items). End the lift without writing anything.
      registry.lift = null;
      h.setLifted(null);
      return;
    }
    const items = h.items();
    const to = Math.max(0, Math.min(items.length - 1, toIndex));
    if (to === from) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    h.write(next);
    // Index keys (primitive items without itemKey) change with the position.
    lift.key = h.keyOf(moved, to);
    h.setLifted(to);
    // Name the row that MOVED from the local `moved` item: on React/Vue/Lit the
    // items prop still holds the pre-write array here.
    h.announce('Moved ' + labelOf(moved, to) + ' to position ' + (to + 1));
    h.focusRow(moved, to);
    h.emit('change', {
      oldIndex: from,
      newIndex: to,
      item: moved,
      interaction: 'keyboard'
    });
  }

  // End the active keyboard lift. 'drop' leaves the row where it is; 'cancel'
  // returns it to the position it was lifted from. Emits `end` once.
  function endLift(kind: any) {
    const lift = registry.lift;
    if (!lift) return;
    const h = lift.holder;
    const origin = lift.origin;
    const at = registry.indexOfLift();
    if (at < 0) {
      registry.lift = null;
      h.setLifted(null);
      return;
    }
    const items = h.items();
    const item = items[at];
    let finalIndex = at;
    if (kind === 'drop') {
      h.announce('Dropped ' + labelOf(item, at) + ' at position ' + (at + 1));
    } else if (h === origin.list) {
      const to = Math.max(0, Math.min(items.length - 1, origin.index));
      if (to !== at) {
        const next = [...items];
        next.splice(at, 1);
        next.splice(to, 0, item);
        h.write(next);
        lift.key = h.keyOf(item, to);
        h.focusRow(item, to);
        h.emit('change', {
          oldIndex: at,
          newIndex: to,
          item,
          interaction: 'keyboard'
        });
      }
      finalIndex = to;
      h.announce('Cancelled. ' + labelOf(item, to) + ' returned to position ' + (to + 1));
    }
    h.setLifted(null);
    keyboardStartEnd('end', origin.list, h, origin.index, finalIndex);
    registry.lift = null;
  }

  // Lift the row at `index` of this list.
  function startLift(index: any) {
    if (!entry) return;
    const item = items()[index];
    registry.lift = {
      holder: entry,
      key: entry.keyOf(item, index),
      data: item,
      copy: false,
      origin: {
        list: entry,
        index
      },
      liftedRowEl: entry.rowEl(index)
    };
    setLiftedIndex(index);
    setAriaLiveText('Lifted ' + labelOf(item, index));
    keyboardStartEnd('start', entry, entry, index, index);
  }
  function onRowKeyDown($event: any, index: any) {
    // Origin guard — must run FIRST, before the keyboardEnabled() check.
    //  - handle mode (keyboardTrigger='handle'): reorder keys apply ONLY when the
    //    keydown came from inside this row's `handle` element. A missing `handle`
    //    selector means keyboard is OFF (warned in warnIfHandleMissing).
    //  - row mode (quick 260716-ggq): reorder keys apply ONLY when the row
    //    element ITSELF is focused. A slotted interactive child (an <input>,
    //    <button>, etc. rendered into the row's default slot) bubbles its own
    //    keydown up to this handler — without this guard, Space/Enter typed into
    //    that child would be hijacked for lift/drop instead of reaching the
    //    child.
    if (handleMode()) {
      if (local.handle == null || !isHandleKeyOrigin($event)) return;
    } else if ($event.target !== $event.currentTarget) {
      return;
    }
    // Defense-in-depth: when keyboard reordering is off the rows carry no
    // tabindex and can't receive focus, but a consumer-focused row (or a
    // programmatic .focus()) must still no-op here rather than reorder.
    if (!keyboardEnabled()) return;
    const key = $event.key;
    const lift = registry.lift;
    const liftedHere = lift != null && lift.holder === entry;
    // Space (' ' on browsers; KeyboardEvent.key === ' ') OR Enter — lift/drop.
    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      $event.preventDefault();
      if (liftedHere) {
        endLift('drop');
        return;
      }
      // A lift still active in another list ends (as a drop) before this one.
      if (lift != null) endLift('drop');
      startLift(index);
      return;
    }
    // Every other key acts only while a row of this list is lifted, so it never
    // steals keys from fields inside a row.
    if (!liftedHere) return;
    if (key === 'Escape') {
      $event.preventDefault();
      endLift('cancel');
      return;
    }
    const horizontal = local.orientation === 'horizontal';
    const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
    const from = registry.indexOfLift();
    const step = local.pageStep > 0 ? Math.floor(local.pageStep) : 5;
    let to: any = null;
    if (key === nextKey) to = from + 1;else if (key === prevKey) to = from - 1;else if (key === 'Home') to = 0;else if (key === 'End') to = items().length - 1;else if (key === 'PageDown') to = from + step;else if (key === 'PageUp') to = from - step;
    if (to === null) return;
    $event.preventDefault();
    moveLiftTo(to);
  }

  // SortableJS wiring lives in `useSortableJS()` (./internal/useSortableJS).
  // The helper owns the SortableJS-vs-reconciler dance — DOM-restore hardening
  // against fragile-event paths, identity-based item lookup over fragile
  // `e.oldIndex`, and the single-onEnd disambiguation that collapses
  // onUpdate / onAdd / onRemove into one handler.
  //
  // What stays here is purely declarative: which array to read, what to write
  // back, what to emit, and how to bridge `afterCommit` to the Lit-only
  // `$reconcileAfterDomMutation()` sigil.

  // Imperative handle (Phase 21 $expose). The SortableJS imperative surface a
  // consumer can't drive through props alone — exposed uniformly to all 6 targets.
  // Each guards the pre-mount/destroyed `instance = null`. Collision-clear: none of
  // the 4 verb names collide with the 16 props or the 5 events — `option` is a
  // distinct identifier from the `options` prop, so ROZ121 is clear.
  function getInstance() {
    return instance;
  }
  // toArray()/sort() operate on SortableJS's data-id ordering — every row carries
  // :data-id="keyFor(item, index)", so toArray() returns the current key order and
  // sort(order) reorders by those keys (set itemKey for stable object-list keys).
  function toArray() {
    return instance ? instance.toArray() : [];
  }
  function sort(order: any, useAnimation = true) {
    instance?.sort(order, useAnimation);
  }
  // option(name) reads a live SortableJS option; option(name, value) sets one — the
  // runtime escape hatch for any SortableJS option beyond the curated props.
  function option(name: any, value: any) {
    if (!instance) return undefined;
    if (value === undefined) return instance.option(name);
    instance.option(name, value);
    return value;
  }

  return (
    <>
    <div {...attrs} class={"rozie-sortable-wrap" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-0af24eae="">
      <div class={rozieClass(['rozie-sortable-list', local.listClass])} ref={(el) => { listElRef = el as HTMLElement; }} part="list" role="list" aria-label={rozieAttr(local.listLabel)} aria-orientation={rozieAttr(local.orientation === 'horizontal' ? 'horizontal' : 'vertical')} data-rozie-s-0af24eae="">
        {(_props.headerSlot ?? _props.slots?.['header']?.({}))}
        <For each={items()}>{(item, index) => <div data-id={rozieAttr(keyFor(item, index()))} role="listitem" aria-describedby={rozieAttr(rowTabbable() ? instructionsId : null)} class={rozieClass(['rozie-sortable-item', itemClassFor(item, index()), { 'rozie-sortable-item-lifted': liftedIndex() === index() }])} style={parseInlineStyle(itemStyleFor(item, index()))} tabIndex={rozieAttr(rowTabbable() ? 0 : null)} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: Element }) => { onRowKeyDown($event, index()); }} data-rozie-s-0af24eae="">
          {typeof local.children === 'function' ? (local.children as (s: any) => any)({ item, get index() { return index(); }, instructionsId }) : resolved()}
        </div>}</For>
        {(_props.footerSlot ?? _props.slots?.['footer']?.({}))}
      </div>
      <div class={"rozie-sortable-aria-live"} data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true" data-rozie-s-0af24eae="">{ariaLiveText()}</div>
      <span hidden={true} id={rozieAttr(instructionsId)} data-rozie-s-0af24eae="">{rozieDisplay(instructionsText())}</span>
    </div>
    </>
  );
}
