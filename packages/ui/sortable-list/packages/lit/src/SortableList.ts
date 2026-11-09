import { LitElement, css, html } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { RozieSlotDistributor, __rozieReconcileAfterDomMutation, createLitControllableProperty, rozieAttr, rozieClass, rozieDisplay, rozieListeners, rozieSpread, rozieStyle } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';
import { keyed } from 'lit/directives/keyed.js';
import { useSortableJS } from './internal/useSortableJS';
import { canHop, getKeyboardRegistry, isRenderable, nextInstructionsId, rowLiftable } from './internal/keyboardRegistry';
import { announcementText, defaultInstructions, fallbackLabel } from './internal/announcements';

interface RozieDefaultSlotCtx {
  item: any;
  index: any;
  instructionsId: any;
}

@customElement('rozie-sortable-list')
export default class SortableList extends SignalWatcher(LitElement) {
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' };

  static styles = css`
:host{display:contents}
.rozie-sortable-wrap[data-rozie-s-0af24eae] { display: block; }
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
}
`;

  /**
   * The bound items array. The sole `model: true` prop — two-way bind it (`r-model:items` / `v-model:items` / `bind:items` / `[(items)]`) and SortableList writes the re-ordered array back whenever a drag, cross-list move, or keyboard reorder commits, with no manual `onChange → setState` wiring.
   * @example
   * <rozie-sortable-list .items=${todos} @items-change=${…} itemKey="id"></rozie-sortable-list>
   */
  @property({ type: Array, attribute: 'items' }) _items_attr: any[] = [];
  private _itemsControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'items-change', defaultValue: [], initialControlledValue: undefined });
  /**
   * The per-row key the framework reconciler tracks each item by across a reorder — either a property name (e.g. `itemKey="id"` reads `item.id`) or an `(item, index) => key` function. With neither, id-less object items get a stable synthetic key via an internal `WeakMap` (survives reorder by object identity); primitive items fall back to index — pass a function for reorderable duplicate primitives.
   */
  @property({ type: String, attribute: 'item-key' }) itemKey: string | (((...args: any[]) => any) | null) = null;
  /**
   * CSS selector identifying the per-row drag handle, so a drag starts only from that element rather than anywhere in the row. Authored class names render literally on every target (React included), so a plain `.grip` works; `$classSelector('grip')` is an optional, typo-checked way to author it.
   */
  @property({ type: String, reflect: true }) handle: string | null = null;
  /**
   * SortableJS group name enabling cross-list drag — two lists sharing a `group` accept items between each other (the source fires `remove`, the destination fires `add`). Set `cloneable: true` to flip a string group into clone-mode. Lists that share a `group` also exchange rows by keyboard: Shift+arrow while a row is lifted hops it to the previous or next list of the same group (in source order), subject to the same pull/put rules as a mouse drag. `options.group` takes precedence over this prop, for keyboard hops as for drags. Function-valued `pull`/`put` cannot be evaluated without a drag, so those lists are unreachable by keyboard. Set `itemKey` on grouped lists.
   */
  @property({ type: String, reflect: true }) group: string | null = null;
  /**
   * Reorder animation duration in milliseconds. `0` disables the animation. Runtime-updatable.
   */
  @property({ type: Number, reflect: true }) animation: number = 150;
  /**
   * Temporarily disable dragging without unmounting — reapplied live via `instance.option('disabled', v)` (no remount). Also suppresses keyboard reordering: a disabled list is not sortable by any input, so rows lose their `tabindex` and the keydown handler no-ops. Turning it on while a row is lifted ends the lift where the row is (`Lift ended`, and `end` fires); `options.disabled` and `option('disabled', v)` do the same.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Opt out of keyboard reordering (Space lift / Arrow move / Shift+Arrow hop between lists / Esc cancel / Enter drop) while leaving pointer drag enabled. Rows drop out of the tab order (no `tabindex`) and the keydown handler no-ops. Keyboard access is gated on `!disabled && !disableKeyboard`. Turning it on while a row is lifted ends the lift where the row is.
   */
  @property({ type: Boolean, reflect: true, attribute: 'disable-keyboard' }) disableKeyboard: boolean = false;
  /**
   * Which element drives keyboard reordering. `'row'` (default): rows are tab stops and the keys on the focused row drive reordering. `'handle'`: rows are NOT tab stops, and only keys pressed inside the element matched by `handle` (inside that row) drive the same Space/Enter lift-drop, Arrow move, Shift+Arrow hop and Escape cancel flow; handled keys call preventDefault so a handle `<button>`'s click does not fire. The consumer owns the handle markup (recommended: a `<button>` with its own aria-label such as "Reorder Hero banner") and the component adds no tabindex or role to slot content. `'handle'` without `handle` turns keyboard reordering off and logs a console warning. `disabled`/`disableKeyboard` still apply. Any value other than `'handle'` behaves as `'row'`.
   */
  @property({ type: String, reflect: true, attribute: 'keyboard-trigger' }) keyboardTrigger: string = 'row';
  /**
   * Verbatim SortableJS options pass-through for anything not covered by the named props. The named props win on key conflict but `options` lands AFTER them in the merge so consumers can override defaults; handler keys (`onStart`, `onEnd`, `onUpdate`, `onAdd`, `onRemove`, `onClone`) are stripped — the helper owns those paths.
   */
  @property({ type: Object }) options: any = {};
  /**
   * Optional `(item, idx) => string` returning the screen-reader label for the aria-live announcer during keyboard drag. Defaults to `item.label`; without a `label` field, the row's text (whitespace collapsed, without nested lists or hidden content), else `String(item)` for a primitive, else `item {position}`.
   */
  @property({ type: Function, attribute: 'label-for' }) labelFor: ((...args: any[]) => any) | null = null;
  /**
   * Class name applied to the drop-placeholder (ghost) element while dragging. Forwarded live via `instance.option`, so toggling it at runtime takes effect without a remount.
   */
  @property({ type: String, reflect: true, attribute: 'ghost-class' }) ghostClass: string | null = null;
  /**
   * Class name applied to the currently-chosen item while dragging. Forwarded live via `instance.option` (no remount needed to change it).
   */
  @property({ type: String, reflect: true, attribute: 'chosen-class' }) chosenClass: string | null = null;
  /**
   * Class name applied to the dragging element. Only takes effect in fallback mode (`forceFallback: true`). Forwarded live via `instance.option`.
   */
  @property({ type: String, reflect: true, attribute: 'drag-class' }) dragClass: string | null = null;
  /**
   * CSS selector that prevents drag initiation on matching rows (locked items). SortableJS checks it at `mousedown`/`touchstart` and aborts the drag if it matches. The keyboard honours it too: a row that matches (the row element or its slot root, the element the row template renders) cannot be lifted with Space/Enter; a control nested deeper that matches blocks only presses on it. `options.filter` (which may also be a SortableJS filter function) takes precedence. A `data-*` attribute selector (e.g. `[data-locked]`) is the most robust choice across all targets.
   */
  @property({ type: String, reflect: true }) filter: string | null = null;
  /**
   * CSS easing function for the reorder animation (e.g. `'ease-in'`, `'cubic-bezier(0.4, 0, 0.2, 1)'`). Runtime-updatable.
   */
  @property({ type: String, reflect: true }) easing: string | null = null;
  /**
   * Force SortableJS's mouse-event drag path over HTML5 DnD — useful for touch devices, consistent cross-browser behavior, and synthetic test drivers (and `dragClass` only applies in this mode). **Construction-time only**: SortableJS reads it once at construction, so re-key the `<SortableList>` to toggle it at runtime.
   */
  @property({ type: Boolean, reflect: true, attribute: 'force-fallback' }) forceFallback: boolean = false;
  /**
   * SortableJS swap threshold (0..1) — a lower value makes rows swap earlier as the dragged item overlaps a neighbor. Reapplied live via `instance.option('swapThreshold', v)` — SortableJS reads it on every dragover, so no remount is needed.
   */
  @property({ type: Number, reflect: true, attribute: 'swap-threshold' }) swapThreshold: number = 1;
  /**
   * High-level prop that REPLACES a string `group` with SortableJS's `{ name, pull: 'clone', put: true }` clone-mode object form — the source deposits a COPY onto the destination and keeps its own array unchanged (the palette → canvas pattern). With `group: null` it is a no-op (a clone-mode list with no group name has no peer to clone into). Reapplied live — toggling `cloneable` (or changing `group`) recomputes the clone-mode shape and reapplies it via `instance.option('group', …)`, no remount.
   */
  @property({ type: Boolean, reflect: true }) cloneable: boolean = false;
  /**
   * Extra class(es) merged onto the list container (the SortableJS root) alongside the base `rozie-sortable-list` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding), normalized identically across all six targets — the hook for bridging a CSS framework (`.list-group`) or a flex/grid parent onto the component.
   */
  @property({ type: String, attribute: 'list-class' }) listClass: string | any[] | any = '';
  /**
   * Extra class(es) merged onto every item row alongside the base `rozie-sortable-item` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding) applied uniformly, OR an `(item, index) => class` function for per-row classes evaluated at render time. Normalized identically across all six targets.
   */
  @property({ type: String, attribute: 'item-class' }) itemClass: string | any[] | any | (((...args: any[]) => any) | null) = '';
  /**
   * The list's human name, such as `"Top sidebar"`. Sets `aria-label` on the list container (`role="list"`) and names the list in keyboard announcements when a row moves between lists (`Moved Hero banner to Top sidebar, position 1 of 4`, `Dropped Hero banner in Top sidebar at position 3 of 4`, `No list after Top sidebar`). Pass the same words as the zone's visible heading. With no label, announcements fall back to a neutral `list 2 of 3`, counting the mounted lists of the same group in hop (source) order.
   */
  @property({ type: String, reflect: true, attribute: 'list-label' }) listLabel: string | null = null;
  /**
   * Which arrow keys move a lifted row within the list: `'vertical'` (default) uses ↑/↓, `'horizontal'` uses ←/→. A horizontal list's default spoken instructions say "Use the left and right arrow keys to move" (`role="list"` has no `aria-orientation`).
   */
  @property({ type: String, reflect: true }) orientation: string = 'vertical';
  /**
   * How many positions Page Up / Page Down move a lifted row. The move stops at the first or last position when fewer rows remain.
   */
  @property({ type: Number, reflect: true, attribute: 'page-step' }) pageStep: number = 5;
  /**
   * Replaces the spoken keyboard instructions. The text sits in a hidden element referenced by `aria-describedby` from each tabbable row (row mode) or from the consumer's handle via the `instructionsId` slot prop (handle mode). Default: "Press Space or Enter to pick up, and again to drop. Use the up and down arrow keys to move, Home and End to jump to the start or end, Page Up and Page Down to move several places, and Escape to cancel." (with `orientation: 'horizontal'`, "the left and right arrow keys"; a `sort: false` list says only "Press Space or Enter to pick up, and again to drop. Press Escape to cancel."). When the list has a group (`group` or `options.group`) the default adds "Hold Shift with an arrow key to move to another list."
   */
  @property({ type: String, reflect: true, attribute: 'keyboard-instructions' }) keyboardInstructions: string | null = null;
  /**
   * Rewords or translates what the list says during keyboard reordering. An object of optional functions keyed by message kind (`lifted`, `moved`, `movedToList`, `dropped`, `droppedInList`, `atStart`, `atEnd`, `notSortable`, `noListBefore`, `noListAfter`, `cancelledReturnedToList`, `cancelledReturned`, `cancelledStays`, `cancelledRemoved`, `liftEnded`). Each receives a context (`label`, `item`, `list`, and for kinds with a position `position` (1-based) and `total`; `movedToList` also `fromList`) and returns the text to speak; `null` or `''` says nothing. Kinds without a function keep the default English text (see "Announcements").
   * @example
   * <rozie-sortable-list .items=${todos} @items-change=${…} .announcements=${{ moved: ({ label, position, total }) => label + ' → ' + position + '/' + total }}></rozie-sortable-list>
   */
  @property({ type: Object }) announcements: any = null;
  /**
   * Per-row inline style applied to the `.rozie-sortable-item` wrapper. Accepts a CSS `String`, a flat style object (`Record<string, string | number>`), or an `(item, index) => string | object` function for per-row styling. Because it lands on the wrapper — the direct child of the list container — it can drive CSS-grid placement (`grid-column` / `grid-row` / `align-self`) when `listClass` sets `display: grid`. Normalized per target; `null` / empty drops the attribute.
   */
  @property({ type: String, attribute: 'item-style' }) itemStyle: string | any | (((...args: any[]) => any) | null) = null;
  private _liftedIndex = signal<any>(null);
  private _ariaLiveText = signal('');
  private _optionOverrides = signal<any>({});
  @query('[data-rozie-ref="listEl"]') private _refListEl!: HTMLElement;
private __rozieWatchPrev_1: unknown;
private __rozieWatchInitial_1 = true;
private __rozieWatchInitial_12 = true;
private __rozieFirstUpdateDone = false;

  private _rozieSlotDistributor = new RozieSlotDistributor(this);

  @state() private _hasSlotHeader = false;
  @queryAssignedElements({ slot: 'header', flatten: true }) private _slotHeaderElements!: Element[];
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @property({ attribute: false }) __rozieDefaultSlot__?: (scope: { item: any; index: any; instructionsId: any }) => unknown;
  @state() private _hasSlotFooter = false;
  @queryAssignedElements({ slot: 'footer', flatten: true }) private _slotFooterElements!: Element[];
  // Phase 79 Plan 08 (R4) contract for 79-09: the record intake for
  // record-routed slot fills. 79-09's consumer-side emitSlotFiller
  // accumulates an object literal onto the SAME `.rozieSlots=${{ ... }}`
  // open-tag binding; the KEY is the fill's authored (possibly
  // non-identifier) name and the VALUE is a scope-taking render
  // function. `rozieSlots?.[name]` must be checked BEFORE the legacy
  // named function-prop / <slot> fallback (AC-9). Attribute
  // deserialization is disabled — this is a function-valued record,
  // never reflected to/from an HTML attribute.
  @property({ attribute: false }) rozieSlots?: Record<string, (scope: any) => unknown>;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  _rozieReconcileSeq = 0;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="header"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotHeader = this._slotHeaderElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDefault = this._slotDefaultElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="footer"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotFooter = this._slotFooterElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotHeader = Array.from(this.children).some((el) => el.getAttribute('slot') === 'header');
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    this._hasSlotFooter = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push((() => {
      this.instance?.destroy();
      // Unmounting while holding a keyboard lift ends it (with its `end` event,
      // which some targets may no longer deliver during unmount).
      if (this.registry.lift != null && this.registry.lift.holder === this.entry) this.loseLift(true);
      this.unregisterEntry?.();
      this.unregisterEntry = null;
      this.unhookNativeEvents?.();
      this.unhookNativeEvents = null;
      this.unhookStrayKeys?.();
      this.unhookStrayKeys = null;
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => [this.disabled, this.disableKeyboard, this.options, this._optionOverrides.value])(); untracked(() => { this.__rozieWatchPrev_1 = __watchVal; if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      if (!this.keyboardEnabled()) this.keyboardTurnedOff();
    })(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.items)(); untracked(() => { if (this.__rozieWatchInitial_12) { this.__rozieWatchInitial_12 = false; return; } (() => {
      const lift = this.registry.lift;
      if (lift == null || lift.holder !== this.entry) return;
      const i = this.registry.indexOfLift();
      if (i < 0) {
        this.loseLift();
        return;
      }
      if (this._liftedIndex.value !== i) this._liftedIndex.value = i;
      // Once the holder has rendered the lifted row, that is the lifted row
      // element. After a hop this drops the source's old row, which the source
      // may reuse for another item (index keys).
      const row = this.entry.rowEl(i);
      if (row != null) lift.liftedRowEl = row;
      this.focusNearRow(i, lift.key);
    })(); }); }));

    this.warnIfHandleMissing();
    // Named `sortable` (not `handle`) to avoid shadowing `$props.handle`
    // when the options object below references it.
    const sortable = useSortableJS(this._refListEl, {
      items: () => this.items,
      onCommit: (next: any) => {
        this._itemsControllable.write(next);
      },
      options: {
        animation: this.animation,
        disabled: this.disabled,
        group: this.resolveGroup(),
        handle: this.handle,
        ghostClass: this.ghostClass,
        chosenClass: this.chosenClass,
        dragClass: this.dragClass,
        filter: this.filter,
        forceFallback: this.forceFallback,
        swapThreshold: this.swapThreshold,
        easing: this.easing,
        ...this.options
      },
      // Lit lit-html `repeat` directive caches its part array by sentinel-
      // comment node identity; SortableJS's physical DOM mutation desyncs
      // that cache. The sigil lowers to `__rozieReconcileAfterDomMutation(this)`
      // on Lit (real call) and `void 0` on the other 5 targets (no-op).
      afterCommit: () => __rozieReconcileAfterDomMutation(this),
      // Every pointer event carries the same payload as the keyboard ones, with
      // item-row indices and the raw SortableJS event as `originalEvent`.
      onChange: (c: any) => {
        const payload = {
          interaction: 'pointer',
          item: c.item,
          el: c.el,
          from: c.from,
          to: c.to,
          oldIndex: c.oldIndex,
          newIndex: c.newIndex,
          originalEvent: c.event
        };
        if (c.kind === 'reorder') this.dispatchEvent(new CustomEvent("reorder", {
          detail: payload,
          bubbles: true,
          composed: true
        }));else if (c.kind === 'add') this.dispatchEvent(new CustomEvent("add", {
          detail: payload,
          bubbles: true,
          composed: true
        }));else if (c.kind === 'remove') this.dispatchEvent(new CustomEvent("remove", {
          detail: payload,
          bubbles: true,
          composed: true
        }));
      },
      onStart: (d: any) => {
        // A pointer drag ends any active keyboard lift first.
        if (this.registry.lift != null) this.endLift('drop');
        // That lift's `end` (pending until a task) comes before this `start`.
        this.registry.flushEnds();
        this.dispatchEvent(new CustomEvent("start", {
          detail: {
            interaction: 'pointer',
            item: d.item,
            el: d.el,
            from: d.from,
            to: d.to,
            oldIndex: d.oldIndex,
            newIndex: d.newIndex,
            originalEvent: d.event
          },
          bubbles: true,
          composed: true
        }));
      },
      // Runs once per drag, in a task after every list involved has written its
      // items and the re-render those writes scheduled (see useSortableJS).
      // `end` comes from the list the row ended up in: the destination when it
      // is a SortableList, else (dropped outside, or into a SortableJS list
      // that isn't one of ours) this source list.
      onEnd: (d: any) => {
        const dest = this.registry.entryFor(d.to) ?? this.entry;
        if (dest == null) return;
        const row = d.item === undefined ? null : this.rowByKey(d.to, dest.keyOf(d.item, d.newIndex));
        dest.emit('end', {
          interaction: 'pointer',
          item: d.item,
          el: row ?? d.el,
          from: d.from,
          to: d.to,
          oldIndex: d.oldIndex,
          newIndex: d.newIndex,
          originalEvent: d.event
        });
      }
    });
    this.instance = sortable.instance;
    const listEl = this._refListEl;
    const stopNative = (ev: any) => {
      if (ev.target === listEl) ev.stopPropagation();
    };
    for (const name of this.SORTABLE_DOM_EVENTS as any) listEl?.addEventListener(name, stopNative);
    // A focused row that stops being focusable (its tabindex goes when the
    // keyboard turns off) is blurred at once, during the framework's DOM
    // update, with focus going nowhere (`relatedTarget` null): it would land on
    // <body>. Move it to the list instead.
    const rowBlurred = (ev: any) => {
      const row: any = ev.target;
      if (ev.relatedTarget != null || row == null || row.parentNode !== listEl) return;
      if (!row.classList.contains('rozie-sortable-item') || row.hasAttribute('tabindex') || !row.isConnected) return;
      if (!listEl.hasAttribute('tabindex')) listEl.setAttribute('tabindex', '-1');
      listEl.focus();
    };
    listEl?.addEventListener('focusout', rowBlurred);
    this.unhookNativeEvents = () => {
      for (const name of this.SORTABLE_DOM_EVENTS as any) listEl?.removeEventListener(name, stopNative);
      listEl?.removeEventListener('focusout', rowBlurred);
    };

    // Register with the keyboard registry. Other instances call these methods
    // when a keyboard lift hands a row between lists.
    this.entry = {
      el: listEl,
      instructionsId: this.instructionsId,
      group: () => this.effectiveGroup(),
      label: () => this.listLabel,
      // A handle-mode list without a handle selector has its keyboard off.
      keyboardEnabled: () => this.keyboardEnabled() && !(this.handleMode() && this.handle == null),
      items: () => this.items,
      keyOf: (item: any, i: any) => String(this.keyFor(item, i)),
      labelOf: (item: any, i: any, row = null) => String(this.labelOf(item, i, row)),
      message: (kind: any, ctx: any) => announcementText(this.announcements, kind, ctx),
      onKey: (key: any, shift: any) => this.holderKey(key, shift),
      write: (next: any) => {
        this._itemsControllable.write(next);
      },
      setLifted: (i: any) => {
        this._liftedIndex.value = i;
      },
      // The same text twice in a row would not change the region, and a screen
      // reader would not read it again ("Apple is already first", twice): a
      // repeat alternates a trailing no-break space, which is not spoken.
      announce: (text: any) => {
        const next = text !== '' && text === this.lastSpoken ? text + '\u00A0' : text;
        this.lastSpoken = next;
        this._ariaLiveText.value = next;
      },
      focusRow: (item: any, i: any) => this.refocusRow(item, i),
      focusNear: (i: any) => this.focusNearRow(i),
      rowEl: (i: any) => {
        const list = this.items;
        if (i < 0 || i >= list.length) return null;
        return this.rowByKey(listEl, String(this.keyFor(list[i], i)));
      },
      emit: (name: any, payload: any) => {
        if (name === 'add') this.dispatchEvent(new CustomEvent("add", {
          detail: payload,
          bubbles: true,
          composed: true
        }));else if (name === 'remove') this.dispatchEvent(new CustomEvent("remove", {
          detail: payload,
          bubbles: true,
          composed: true
        }));else if (name === 'reorder') this.dispatchEvent(new CustomEvent("reorder", {
          detail: payload,
          bubbles: true,
          composed: true
        }));else if (name === 'start') this.dispatchEvent(new CustomEvent("start", {
          detail: payload,
          bubbles: true,
          composed: true
        }));else if (name === 'end') this.dispatchEvent(new CustomEvent("end", {
          detail: payload,
          bubbles: true,
          composed: true
        }));
      }
    };
    this.unregisterEntry = this.registry.register(this.entry);
    const strayKey = (ev: any) => this.onStrayKey(ev);
    // A pointer press means the user moved on: keys lost to <body> after it
    // are not routed to the lift.
    const pointerPress = () => {
      if (this.registry.lift != null) this.registry.lift.focusPending = false;
    };
    document.addEventListener('keydown', strayKey);
    document.addEventListener('pointerdown', pointerPress, true);
    this.unhookStrayKeys = () => {
      document.removeEventListener('keydown', strayKey);
      document.removeEventListener('pointerdown', pointerPress, true);
    };
    // $onMount's cleanup-return: closing over a setup-local (`sortable`) does
    // not survive the Solid emitter's setup/cleanup split — it scopes cleanup
    // outside the setup IIFE. Closing over `instance` / `unregisterEntry`
    // (module-scope `let`s) works on every target.
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('disabled'))) { const __watchVal = (() => this.disabled)(); ((v: any) => {
      this.instance?.option('disabled', v);
      this.setOverride('disabled', v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('disabled') || changedProperties.has('disableKeyboard') || changedProperties.has('options'))) { const __watchVal = untracked(() => [this.disabled, this.disableKeyboard, this.options, this._optionOverrides.value]); if (!Object.is(__watchVal, this.__rozieWatchPrev_1)) { this.__rozieWatchPrev_1 = __watchVal; untracked(() => (() => {
      if (!this.keyboardEnabled()) this.keyboardTurnedOff();
    })()); } }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('group'))) { const __watchVal = (() => this.group)(); (() => this.instance?.option('group', this.resolveGroup()))(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('cloneable'))) { const __watchVal = (() => this.cloneable)(); (() => this.instance?.option('group', this.resolveGroup()))(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('swapThreshold'))) { const __watchVal = (() => this.swapThreshold)(); ((v: any) => this.instance?.option('swapThreshold', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('handle'))) { const __watchVal = (() => this.handle)(); ((v: any) => {
      this.instance?.option('handle', v);
      this.warnIfHandleMissing();
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('keyboardTrigger'))) { const __watchVal = (() => this.keyboardTrigger)(); (() => this.warnIfHandleMissing())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('ghostClass'))) { const __watchVal = (() => this.ghostClass)(); ((v: any) => this.instance?.option('ghostClass', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('chosenClass'))) { const __watchVal = (() => this.chosenClass)(); ((v: any) => this.instance?.option('chosenClass', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('dragClass'))) { const __watchVal = (() => this.dragClass)(); ((v: any) => this.instance?.option('dragClass', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('filter'))) { const __watchVal = (() => this.filter)(); ((v: any) => {
      this.instance?.option('filter', v);
      this.setOverride('filter', v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('easing'))) { const __watchVal = (() => this.easing)(); ((v: any) => this.instance?.option('easing', v))(__watchVal); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'items') this._itemsControllable.notifyAttributeChange(value as unknown as any[]);
  }

  render() {
    return html`
<div class="rozie-sortable-wrap" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-0af24eae>
  <div class="${(rozieClass(['rozie-sortable-list', this.listClass]))}" part="list" role="list" aria-label=${rozieAttr(this.listLabel)} data-rozie-ref="listEl" data-rozie-s-0af24eae>${keyed(this._rozieReconcileSeq ?? 0, html`
    <slot name="header"></slot>
    ${repeat<any>(this.items, (item, index) => this.keyFor(item, index), (item, index) => html`<div class="${(rozieClass(['rozie-sortable-item', this.itemClassFor(item, index), this._liftedIndex.value === index ? 'rozie-sortable-item-lifted' : '']))}" style=${rozieStyle(this.itemStyleFor(item, index))} data-id=${rozieAttr(this.keyFor(item, index))} role="listitem" tabindex=${rozieAttr(this.rowTabbable() ? 0 : null)} aria-describedby=${rozieAttr(this.rowTabbable() ? this.instructionsId : null)} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onRowKeyDown($event, index); }} data-rozie-s-0af24eae>
      ${this.__rozieDefaultSlot__ !== undefined ? this.__rozieDefaultSlot__({item: item, index: index, instructionsId: this.instructionsId}) : html`<slot data-rozie-params=${(() => { try { return JSON.stringify({item: item, index: index, instructionsId: this.instructionsId}); } catch { return '{}'; } })()}></slot>`}
    </div>`)}
    <slot name="footer"></slot>
  `)}</div>
  <div class="rozie-sortable-aria-live" data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true" data-rozie-s-0af24eae>${this._ariaLiveText.value}</div>
  <span hidden="" id=${rozieAttr(this.instructionsId)} data-rozie-s-0af24eae>${rozieDisplay(this.instructionsText())}</span>
</div>
`;
  }

  instance: any = null;

  // Keyboard lift state lives in the shared registry (one active keyboard lift
  // per page, so a later task can hand a lifted row between lists).
  // `$data.liftedIndex` is only its mirror, for the lifted-row styling.
  registry = getKeyboardRegistry();

  // This list's registry entry (a ListEntry), built and registered in $onMount.
  entry: any = null;

  unregisterEntry: any = null;

  // Removes the listeners that keep SortableJS's own DOM events inside the list.
  unhookNativeEvents: any = null;

  // Removes the document keydown listener that catches keys lost to <body>.
  unhookStrayKeys: any = null;

  // SortableJS also dispatches its events as BUBBLING native DOM events
  // (`start`, `end`, `change`, `add`, …) on the list element, before it calls
  // the option callbacks. Angular's `(start)` / `(change)` output bindings on the
  // component host also catch native DOM events of the same name, so an Angular
  // consumer got the raw SortableJS event as an extra `start`, plus a native
  // `change` on every mid-drag position change. The component re-emits the
  // committed events itself, so stop the raw ones at the list element (only
  // events dispatched ON the list — an `<input>`'s own `change` is untouched).
  SORTABLE_DOM_EVENTS = ['choose', 'unchoose', 'start', 'end', 'add', 'update', 'sort', 'remove', 'filter', 'clone', 'change', 'select', 'deselect'];

  // Per-instance id of the hidden spoken-instructions element. Assigned once
  // per instance: it is also read in $onMount (the registry entry), which makes
  // the React emitter keep it across renders instead of minting a new id each
  // render.
  instructionsId = nextInstructionsId();

  // role="list" takes no aria-orientation, so a horizontal list says which
  // arrow keys move in its instructions instead. A `sort: false` list leaves out
  // the move sentence, and a list with a group (the one SortableJS runs with,
  // `options.group` included) says how to hop.
  instructionsText = () => {
  if (this.keyboardInstructions != null) return this.keyboardInstructions;
  return defaultInstructions({
    horizontal: this.orientation === 'horizontal',
    sortable: this.liveOption('sort', true) !== false,
    grouped: this.effectiveGroup() != null
  });
};

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
  __rowKeyMap = new WeakMap();

  __rowKeySeq = 0;

  // 4-tier per-row key precedence. Its return feeds BOTH :key and :data-id.
  keyFor = (item: any, index: any) => {
  // (a) function itemKey: consumer-supplied (item, index) => key.
  if (typeof this.itemKey === 'function') {
    return this.itemKey(item, index);
  }
  // (b) string itemKey: a property name on a non-null object item.
  if (typeof this.itemKey === 'string' && item !== null && typeof item === 'object' && item[this.itemKey] != null) {
    return item[this.itemKey];
  }
  // (c) id-less object (or function) item: assign-on-first-sight WeakMap
  //     synthetic id. Survives reorder because it is keyed by object identity.
  if (item !== null && typeof item === 'object' || typeof item === 'function') {
    if (!this.__rowKeyMap.has(item)) {
      this.__rowKeyMap.set(item, '__rk' + this.__rowKeySeq++);
    }
    return this.__rowKeyMap.get(item);
  }
  // (d) primitive item: fall back to index. NOTE: duplicate primitives are
  //     unsafe to reorder this way — pass a function itemKey for those.
  return index;
};

  // Resolve the SortableJS `group` option: `cloneable` is a high-level Rozie
  // prop that REPLACES a string `group` with SortableJS's
  // `{ name, pull: 'clone', put: true }` clone-mode object form. When
  // `cloneable:false`, pass `$props.group` through verbatim. When
  // `cloneable:true` AND `$props.group` is null, leave it null — a clone-mode
  // list without a group name is not meaningful (no peer list can join the
  // cross-list flow). Shared by $onMount construction AND the group/cloneable
  // $watch reconcile below — single source of truth, no duplicated ternary.
  resolveGroup = () => this.cloneable && typeof this.group === 'string' ? {
  name: this.group,
  pull: 'clone' as const,
  put: true as const
} : this.group ?? undefined;

  // The group SortableJS actually runs with: `options.group` lands after the
  // named props in the merge, so it wins. Keyboard hops follow the same rules
  // as the mouse, so they read this one.
  effectiveGroup = () => {
  const o: any = this.options;
  return o != null && o.group != null ? o.group : this.resolveGroup();
};

  // Resolve itemClass for a row: a static value (string | array | object) OR a
  // per-row (item, index) => class function. The result is fed into the :class
  // array and normalized by each target's class path (rozieClass / clsx / native).
  itemClassFor = (item: any, index: any) => {
  const v = this.itemClass;
  return typeof v === 'function' ? v(item, index) : v;
};

  // Resolve itemStyle for a row: a static value (string | object) OR a per-row
  // (item, index) => style function. Returns string | object | null; the dynamic
  // :style binding normalizes it per target. null / empty → attribute dropped.
  itemStyleFor = (item: any, index: any) => {
  const s = typeof this.itemStyle === 'function' ? this.itemStyle(item, index) : this.itemStyle;
  return s == null || s === '' ? null : s;
};

  // Read the display label for an item — used by the aria-live announcer.
  // Phase 16 R7 / D-08: $props.labelFor reads as `null` on all 6 targets when
  // the consumer omits it (Plan 16-01 prop-default coercion fix); the check is
  // a plain null compare — NO runtime callable-type coercion. Without
  // `labelFor` or a `label` field, the row's text (`row`), else `String(item)`
  // for a primitive, else `item {position}`.
  labelOf = (item: any, idx: any, row = null) => {
  if (this.labelFor !== null) return this.labelFor(item, idx);
  if (item !== null && typeof item === 'object' && item.label != null) return item.label;
  return fallbackLabel(item, idx, row);
};

  // The text this list's live region showed last (see the registry entry's
  // `announce`).
  lastSpoken = '';

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
  //
  // The keyboard follows the SortableJS options the mouse obeys: `disabled`
  // (the prop, `options.disabled`, or `option('disabled', v)`), `filter` and
  // `draggable` (which rows lift, see rowLiftable) and `sort: false` (no moves
  // within the list). `liveOption` reads the value SortableJS runs with: one set
  // at runtime, else `options`, else the named prop.
  KEYBOARD_OPTIONS = ['disabled', 'filter', 'draggable', 'sort'];

  liveOption = (name: any, fallback: any) => {
  const ov: any = this._optionOverrides.value;
  if (ov != null && Object.prototype.hasOwnProperty.call(ov, name)) return ov[name];
  const o: any = this.options;
  if (o != null && o[name] !== undefined) return o[name];
  return fallback;
};

  setOverride = (name: any, value: any) => {
  this._optionOverrides.value = {
    ...this._optionOverrides.value,
    [name]: value
  };
};

  keyboardEnabled = () => !this.disableKeyboard && !this.liveOption('disabled', this.disabled);

  // keyboardTrigger='handle' mode: rows are not tab stops and the keys are read
  // from the consumer's handle element instead. Any other value is 'row' mode.
  handleMode = () => this.keyboardTrigger === 'handle';

  // Rows are tab stops only in row mode (and only while keyboard is enabled).
  rowTabbable = () => this.keyboardEnabled() && !this.handleMode();

  // One-time-per-change dev warning: handle mode needs a handle selector. Without
  // one the keyboard is OFF (see the onRowKeyDown gate) — never a silent fallback
  // to row mode, which would re-introduce the tab stops the consumer opted out of.
  warnIfHandleMissing = () => {
  if (this.handleMode() && this.handle == null) {
    console.warn('[rozie-sortable-list] keyboardTrigger is "handle" but no handle selector is set, so keyboard reordering is off. Pass a handle selector (e.g. handle=".grip") or use keyboardTrigger "row".');
  }
};

  // True only when a keydown originated inside a `handle` element that belongs to
  // THIS row. Walks the COMPOSED ancestor chain from the event target up to (but
  // excluding) the row (currentTarget): assignedSlot -> parentNode -> shadow host.
  // Plain closest()/contains() stop at a shadow boundary, and Lit renders a Rozie
  // consumer's slot content inside the SortableList shadow root while plain-HTML
  // consumers project light-DOM nodes through a <slot>. composedPath() is not
  // used because React's synthetic event does not expose it. Another
  // .rozie-sortable-item met first means the key came from a NESTED list's row,
  // which must not reorder this (outer) list.
  isHandleKeyOrigin = ($event: any) => {
  const sel = this.handle;
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
};

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
  refocusRow = (item: any, idx: any) => {
  const listEl = this._refListEl;
  const sel = this.handle;
  const useHandle = this.handleMode();
  const key = String(this.keyFor(item, idx));
  // While this refocus is outstanding, a key that falls to <body> belongs to
  // the lift (see onStrayKey). Cleared once the row has focus again, or by a
  // pointer press anywhere.
  const pending = this.registry.lift;
  if (pending != null) pending.focusPending = true;
  const focusIt = (onlyIfLost: any) => {
    if (!listEl) return;
    if (useHandle && sel == null) return;
    if (onlyIfLost && document.activeElement && document.activeElement !== document.body) return;
    for (const row of Array.from(listEl.children) as any[]) {
      if (row.getAttribute('data-id') === key) {
        const target = useHandle ? row.querySelector(sel) : row;
        if (target && typeof target.focus === 'function') {
          target.focus();
          const l = this.registry.lift;
          if (l != null && l === pending && l.key === key) {
            l.focusPending = false;
            // This row is the lifted row element now (see the items watcher).
            l.liftedRowEl = row;
          }
        }
        return;
      }
    }
  };
  queueMicrotask(() => focusIt(false));
  setTimeout(() => focusIt(true), 0);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => focusIt(true));
};

  // The row element carrying `data-id === key` among a list element's direct
  // children (skips nested-list rows and header/footer slot content).
  rowByKey = (listEl: any, key: any) => {
  if (!listEl || key == null) return null;
  for (const row of Array.from(listEl.children) as any[]) {
    if (row.getAttribute('data-id') === key) return row;
  }
  return null;
};

  // After the consumer changed the items of the list holding a lift, put focus
  // on the row (or its handle) whose key is `key`, else the row nearest `index`
  // (or the list itself when it has no rows left) — but only once focus has fallen to <body> (the focused row's element went
  // away: the lift was lost, or a framework that keys rows by object identity
  // re-created the lifted row). Never steals focus from anywhere else. Same
  // three passes as refocusRow, for targets that commit late.
  focusNearRow = (index: number, key: string | null = null) => {
  const listEl = this._refListEl;
  const sel = this.handle;
  const useHandle = this.handleMode();
  const focusIt = () => {
    if (!listEl) return;
    if (useHandle && sel == null) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    const rows = Array.from(listEl.children).filter((r: any) => r.hasAttribute('data-id') && r.classList.contains('rozie-sortable-item')) as any[];
    if (rows.length === 0) {
      // The list is now empty: focus the list itself (out of the tab order)
      // so keyboard and screen-reader users stay where they were.
      if (!listEl.hasAttribute('tabindex')) listEl.setAttribute('tabindex', '-1');
      listEl.focus();
      return;
    }
    const row = rows.find((r: any) => key != null && r.getAttribute('data-id') === key) ?? rows[Math.max(0, Math.min(rows.length - 1, index))];
    const target = useHandle ? row.querySelector(sel) : row;
    if (target && typeof target.focus === 'function') target.focus();
  };
  queueMicrotask(focusIt);
  setTimeout(focusIt, 0);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusIt);
};

  // Speak `text` from `target`'s aria-live region. The region that spoke last
  // is cleared when it belongs to another list, so a message is heard once, from
  // the list the row is in now, and never from a list that just lost it.
  speak = (target: any, text: any) => {
  const prev = this.registry.speaker;
  if (prev != null && prev !== target && this.registry.has(prev)) prev.announce('');
  this.registry.speaker = target;
  target.announce(text);
};

  // Say announcement `kind` from `target`, in `target`'s words: its
  // `announcements` function for that kind, else the default text (see
  // ./internal/announcements). `index` is the row's 0-based position in
  // `target`, `row` the row element its label is read from (when there is no
  // `labelFor` or `label` field), and `total` how many rows `target` holds after
  // the change (null for the kinds without a position). A function returning
  // null or '' clears the region, so nothing is said.
  say = (target: any, kind: any, item: any, index: any, row: any, total = null, fromList = null) => {
  const ctx: any = {
    label: target.labelOf(item, index, row),
    item,
    list: this.registry.listName(target)
  };
  if (total != null) {
    ctx.position = index + 1;
    ctx.total = total;
  }
  if (fromList != null) ctx.fromList = this.registry.listName(fromList);
  this.speak(target, target.message(kind, ctx));
};

  // The lifted item is no longer in the list holding it: the consumer changed
  // that list's items (or re-keyed the item), or the list is unmounting. End the
  // lift without writing anything (the item is wherever the consumer's data put
  // it). `end` still fires once, with `item` = the lifted value and `el: null`
  // (there is no row), so keyboard `start` / `end` always pair. Lost to a consumer change (not an
  // unmount), the holder says `Lift ended` and, if focus fell to <body> with the
  // row, focuses its row nearest where the lifted row was.
  loseLift = (unmounting = false) => {
  const lift = this.registry.lift;
  if (!lift) return;
  const h = lift.holder;
  this.registry.lift = null;
  h.setLifted(null);
  if (!unmounting) {
    this.say(h, 'liftEnded', lift.item, lift.index ?? lift.origin.index, lift.liftedRowEl);
    h.focusNear(lift.index ?? lift.origin.index);
  }
  const payload = {
    interaction: 'keyboard',
    item: lift.item,
    el: null,
    from: lift.origin.list.el,
    to: h.el,
    oldIndex: lift.origin.index,
    newIndex: -1
  };
  // Like every `end`, in a task after the writes. An unmounting list emits it
  // now: a later emit from an unmounted component would not be delivered.
  if (unmounting) h.emit('end', payload);else this.registry.deferEnd(() => h.emit('end', payload));
};

  // Keyboard `start` / `end` (the same payload as every other event): `item` is
  // the item value, `el` its row element. `start` fires from the origin list
  // (`from`), `end` from the list the row ends up in (`to`). `el` is the row in
  // that list when it is rendered, else `fallbackEl` (the row element the move
  // started from, before a target re-rendered). `end` is called after
  // `registry.lift` is cleared, so a consumer `end` handler that writes the
  // items (re-keying a clone copy) is not mistaken for a lost lift, and it is
  // emitted in a task (`registry.deferEnd`), after the writes AND the re-render
  // they schedule: a consumer `end` handler reads the new state on every target
  // (React included, whose handler closure is the one from the latest render).
  keyboardStartEnd = (name: any, lift: any, from: any, to: any, oldIndex: any, newIndex: any, fallbackEl = null) => {
  const host = name === 'start' ? from : to;
  const fire = () => host.emit(name, {
    interaction: 'keyboard',
    item: lift ? lift.item : null,
    el: (lift ? this.rowByKey(host.el, lift.key) : null) ?? fallbackEl,
    from: from.el,
    to: to.el,
    oldIndex,
    newIndex
  });
  if (name === 'end') this.registry.deferEnd(fire);else fire();
};

  // Move the lifted row to `toIndex` (clamped) within the list holding it.
  // Works through the registry entry, so it acts on the current holder. `dir`
  // is the key's direction (-1 toward the start), for when the row can't move.
  moveLiftTo = (toIndex: any, dir: any) => {
  const lift = this.registry.lift;
  if (!lift) return;
  const h = lift.holder;
  const from = this.registry.indexOfLift();
  if (from < 0) {
    this.loseLift();
    return;
  }
  const items = h.items();
  const to = Math.max(0, Math.min(items.length - 1, toIndex));
  // The moved row's element, read before the write (an index key changes).
  const el = h.rowEl(from);
  if (to === from) {
    // Nowhere to go: say so (the row is already at that end).
    this.say(h, dir < 0 ? 'atStart' : 'atEnd', items[from], from, el ?? lift.liftedRowEl, items.length);
    return;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  // Index keys (primitive items without itemKey) change with the position.
  // Update the lift BEFORE writing: a target whose watchers run synchronously
  // on the write must already see where the row is going.
  lift.key = h.keyOf(moved, to);
  lift.index = to;
  h.write(next);
  h.setLifted(to);
  // Name the row that MOVED from the local `moved` item: on React/Vue/Lit the
  // items prop still holds the pre-write array here. Labels come from the
  // holder's own `labelFor`.
  this.say(h, 'moved', moved, to, el, items.length);
  h.focusRow(moved, to);
  h.emit('reorder', {
    interaction: 'keyboard',
    item: moved,
    el,
    from: h.el,
    to: h.el,
    oldIndex: from,
    newIndex: to
  });
};

  // Hop the lifted row to the next (`dir` 1) or previous (-1) list it could
  // also reach by mouse, in composed-tree source order. One hand-off: the source
  // writes its items without the row and emits `remove`, the destination writes
  // them with it and emits `add`, and the destination becomes the holder. A
  // forward hop lands first, a backward hop lands last.
  hop = (dir: any) => {
  const lift = this.registry.lift;
  if (!lift) return;
  const from = lift.holder;
  const i = this.registry.indexOfLift();
  if (i < 0) {
    this.loseLift();
    return;
  }
  const fromItems = from.items();
  const data = fromItems[i];
  const el = from.rowEl(i);
  // Keep the lifted row element current: lists nested inside it (a grid
  // widget's columns) are never hop targets. Before a target re-renders the
  // row may not exist yet, so keep the last known element then.
  lift.liftedRowEl = el ?? lift.liftedRowEl;
  const to = this.registry.findHopTarget(from, dir);
  if (to == null) {
    this.say(from, dir === 1 ? 'noListAfter' : 'noListBefore', data, i, el ?? lift.liftedRowEl);
    return;
  }
  const origin = lift.origin;
  const toItems = to.items();
  // A clone copy hopping back into the list it was cloned from merges with
  // its original there (that list never gave it up), rather than adding a
  // second row with the same key.
  if (lift.copy && to === origin.list) {
    let home = toItems.indexOf(data);
    if (home < 0) home = Math.max(0, Math.min(toItems.length - 1, origin.index));
    lift.holder = to;
    lift.copy = false;
    lift.key = to.keyOf(toItems[home], home);
    lift.item = toItems[home];
    lift.index = home;
    const rest = [...fromItems];
    rest.splice(i, 1);
    from.write(rest);
    from.emit('remove', {
      interaction: 'keyboard',
      item: data,
      el,
      from: from.el,
      to: to.el,
      oldIndex: i,
      newIndex: -1
    });
    from.setLifted(null);
    to.setLifted(home);
    this.say(to, 'movedToList', data, home, el, toItems.length, from);
    to.focusRow(toItems[home], home);
    return;
  }
  // The first hop out of a clone source (`pull: 'clone'`) leaves the source
  // untouched and carries a copy (the same item value the mouse path
  // inserts); from then on the copy moves like any row.
  const cloneOut = canHop(from.group(), to.group()).copy && from === origin.list && !lift.copy;
  const at = dir === 1 ? 0 : toItems.length;
  // Update the lift BEFORE writing, so a target whose watchers run
  // synchronously on a write already sees the new holder.
  lift.holder = to;
  lift.key = to.keyOf(data, at);
  lift.index = at;
  lift.hopped = true;
  if (cloneOut) {
    lift.copy = true;
  } else {
    const rest = [...fromItems];
    rest.splice(i, 1);
    from.write(rest);
    from.emit('remove', {
      interaction: 'keyboard',
      item: data,
      el,
      from: from.el,
      to: to.el,
      oldIndex: i,
      newIndex: -1
    });
  }
  const next = [...toItems];
  next.splice(at, 0, data);
  to.write(next);
  // The destination has not rendered its new row yet: `el` is the row the
  // move started from.
  to.emit('add', {
    interaction: 'keyboard',
    item: data,
    el,
    from: from.el,
    to: to.el,
    oldIndex: -1,
    newIndex: at
  });
  from.setLifted(null);
  to.setLifted(at);
  this.say(to, 'movedToList', data, at, el, toItems.length + 1, from);
  to.focusRow(data, at);
};

  // End the active keyboard lift. 'drop' leaves the row where it is ('off' too,
  // announced as `Lift ended`: the holder's keyboard was turned off); 'cancel'
  // returns it to the list and position it was lifted from (after hops, a
  // reverse hand-off with its own `remove` / `add`; a clone copy is removed).
  // Emits `end` once, from the list the row ends up in.
  endLift = (kind: any) => {
  const lift = this.registry.lift;
  if (!lift) return;
  const h = lift.holder;
  const origin = lift.origin;
  const at = this.registry.indexOfLift();
  if (at < 0) {
    this.loseLift();
    return;
  }
  const items = h.items();
  const item = items[at];
  // The lifted row's element, read before any write below. Right after a hop
  // the holder may not have rendered it yet: its label is read from the
  // lifted row element then.
  const el = h.rowEl(at);
  const row = el ?? lift.liftedRowEl;
  if (kind === 'drop' || kind === 'off') {
    // A row that hopped always names its list, even back in its origin. The
    // keyboard turned off mid-lift ('off') ends it where it is, too.
    if (kind === 'off') this.say(h, 'liftEnded', item, at, row);else this.say(h, lift.hopped ? 'droppedInList' : 'dropped', item, at, row, items.length);
    h.setLifted(null);
    this.registry.lift = null;
    this.keyboardStartEnd('end', lift, origin.list, h, origin.index, at, el);
    return;
  }
  if (h !== origin.list && !this.registry.has(origin.list) && lift.copy) {
    // A clone copy is removed on cancel even when its source list has
    // unmounted (the source never gave its item up). Focus moves to the
    // neighbouring row, if any. The lift ends BEFORE the write: the copy is
    // leaving on purpose, and a target whose items watcher runs synchronously
    // on the write (Solid) must not take it for a lost lift (a second `end`).
    this.registry.lift = null;
    const rest = [...items];
    rest.splice(at, 1);
    h.write(rest);
    h.emit('remove', {
      interaction: 'keyboard',
      item,
      el,
      from: h.el,
      to: h.el,
      oldIndex: at,
      newIndex: -1
    });
    h.setLifted(null);
    this.say(h, 'cancelledRemoved', item, at, row);
    if (rest.length > 0) {
      const k = Math.min(at, rest.length - 1);
      h.focusRow(rest[k], k);
    }
    // The copy is gone, so there is no row: `el: null`.
    const fromEl = origin.list.el;
    this.registry.deferEnd(() => h.emit('end', {
      interaction: 'keyboard',
      item,
      el: null,
      from: fromEl,
      to: h.el,
      oldIndex: origin.index,
      newIndex: -1
    }));
    return;
  }
  if (h !== origin.list && (!this.registry.has(origin.list) || !isRenderable(origin.list.el) || !origin.list.keyboardEnabled())) {
    // The origin list has unmounted, is hidden, or has its keyboard off:
    // there is nowhere to return to (focus would be stranded), so the row
    // stays where it is (the lift ends as a drop at its position).
    this.say(h, 'cancelledStays', item, at, row, items.length);
    h.setLifted(null);
    this.registry.lift = null;
    this.keyboardStartEnd('end', lift, origin.list, h, origin.index, at, el);
    return;
  }
  if (h === origin.list) {
    const to = Math.max(0, Math.min(items.length - 1, origin.index));
    if (to !== at) {
      const next = [...items];
      next.splice(at, 1);
      next.splice(to, 0, item);
      lift.key = h.keyOf(item, to);
      h.write(next);
      h.focusRow(item, to);
      h.emit('reorder', {
        interaction: 'keyboard',
        item,
        el,
        from: h.el,
        to: h.el,
        oldIndex: at,
        newIndex: to
      });
    }
    this.say(h, lift.hopped ? 'cancelledReturnedToList' : 'cancelledReturned', item, to, row, items.length);
    h.setLifted(null);
    this.registry.lift = null;
    this.keyboardStartEnd('end', lift, origin.list, h, origin.index, to, el);
    return;
  }
  // Reverse hand-off from the current holder back to the origin list.
  const home = origin.list;
  const homeItems = home.items();
  let back;
  if (lift.copy) {
    // The clone source never gave its item up: drop the copy, focus the
    // original.
    back = homeItems.indexOf(item);
    if (back < 0) back = Math.max(0, Math.min(homeItems.length - 1, origin.index));
  } else {
    back = Math.min(origin.index, homeItems.length);
  }
  lift.holder = home;
  lift.key = home.keyOf(item, back);
  const rest = [...items];
  rest.splice(at, 1);
  h.write(rest);
  h.emit('remove', {
    interaction: 'keyboard',
    item,
    el,
    from: h.el,
    to: home.el,
    oldIndex: at,
    newIndex: -1
  });
  if (!lift.copy) {
    const next = [...homeItems];
    next.splice(back, 0, item);
    home.write(next);
    home.emit('add', {
      interaction: 'keyboard',
      item,
      el,
      from: h.el,
      to: home.el,
      oldIndex: -1,
      newIndex: back
    });
  }
  h.setLifted(null);
  // `home` holds the lift during its write, so a target whose items watcher
  // runs synchronously on the write (Solid) highlighted the row there: clear it.
  home.setLifted(null);
  this.say(home, 'cancelledReturnedToList', item, back, row, homeItems.length + (lift.copy ? 0 : 1));
  home.focusRow(lift.copy ? homeItems[back] : item, back);
  this.registry.lift = null;
  this.keyboardStartEnd('end', lift, home, home, origin.index, back, lift.copy ? home.rowEl(back) : el);
};

  // This list's keyboard was turned off (`disabled`, `disableKeyboard`, or
  // `option('disabled', true)`): a lift it holds ends where the row is, with
  // its `end`.
  endLiftIfHeld = () => {
  const lift = this.registry.lift;
  if (lift != null && lift.holder === this.entry) this.endLift('off');
};

  // In row mode the rows leave the tab order when the keyboard turns off, and a
  // focused element that stops being focusable drops focus to <body>. If one of
  // this list's rows still has focus (a target whose watcher runs before its DOM
  // update), move it to the list itself (out of the tab order), like an emptied
  // list. Once the DOM update has run, the `focusout` listener added in $onMount
  // does it instead.
  keepFocusOffBody = () => {
  const listEl = this.entry ? this.entry.el : null;
  if (!listEl) return;
  const root: any = listEl.getRootNode();
  const a: any = root != null ? root.activeElement : null;
  if (a == null || a.parentNode !== listEl || !a.classList.contains('rozie-sortable-item')) return;
  if (!listEl.hasAttribute('tabindex')) listEl.setAttribute('tabindex', '-1');
  listEl.focus();
};

  keyboardTurnedOff = () => {
  this.endLiftIfHeld();
  this.keepFocusOffBody();
};

  // Lift the row at `index` of this list.
  startLift = (index: any) => {
  if (!this.entry) return;
  // A previous drag's or lift's `end` that is still pending fires first, so
  // every `end` comes before the next `start`.
  this.registry.flushEnds();
  const item = this.items[index];
  this.registry.lift = {
    holder: this.entry,
    key: this.entry.keyOf(item, index),
    item,
    copy: false,
    hopped: false,
    origin: {
      list: this.entry,
      index
    },
    liftedRowEl: this.entry.rowEl(index),
    index
  };
  this._liftedIndex.value = index;
  this.say(this.entry, 'lifted', item, index, this.registry.lift.liftedRowEl, this.items.length);
  this.keyboardStartEnd('start', this.registry.lift, this.entry, this.entry, index, index);
};

  onRowKeyDown = ($event: any, index: any) => {
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
  if (this.handleMode()) {
    if (this.handle == null || !this.isHandleKeyOrigin($event)) return;
  } else if ($event.target !== $event.currentTarget) {
    return;
  }
  // Defense-in-depth: when keyboard reordering is off the rows carry no
  // tabindex and can't receive focus, but a consumer-focused row (or a
  // programmatic .focus()) must still no-op here rather than reorder.
  if (!this.keyboardEnabled()) return;
  // While a lift exists, reorder keys in the list holding it act on it. A key
  // from ANOTHER list of the holder's group is routed to the holder only when
  // it comes from the lifted row element itself (its old row, still there
  // before the frameworks re-render after a hop; compared by element, so a
  // row of another list that shares the lifted row's key is not it) or while a refocus after a move is
  // outstanding (a fast burst). Any other row — and every row of an unrelated
  // list (another group, or none) — keeps single-list behaviour: Space/Enter
  // there drops the foreign lift and lifts its own row, other keys do nothing.
  const lift = this.registry.lift;
  const key = $event.key;
  if (lift != null) {
    const mine = this.groupNameOf(this.effectiveGroup());
    const sameGroup = mine != null && mine === this.groupNameOf(lift.holder.group());
    const fromLiftedRow = lift.liftedRowEl != null && $event.currentTarget === lift.liftedRowEl;
    if (lift.holder === this.entry || sameGroup && (fromLiftedRow || lift.focusPending === true)) {
      if (lift.holder.onKey(key, !!$event.shiftKey)) $event.preventDefault();
      return;
    }
  }
  // Space (' ' on browsers; KeyboardEvent.key === ' ') OR Enter — lift. A row
  // the mouse can't drag (it matches `filter`, or not `draggable`) can't be
  // lifted either: the key is left alone (not prevented).
  if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
    const rules = {
      filter: this.liveOption('filter', this.filter),
      draggable: this.liveOption('draggable', undefined),
      sortable: this.instance
    };
    if (!rowLiftable($event.currentTarget as any, rules)) return;
    $event.preventDefault();
    if (lift != null) this.endLift('drop');
    this.startLift(index);
  }
};

  // The group NAME of a SortableJS group option (string or object form).
  groupNameOf = (g: any) => g == null ? null : typeof g === 'string' ? g : g.name ?? null;

  // A reorder key for the lift THIS list holds (routed here from any list via
  // the registry entry's onKey). Returns true when the key was handled. Every
  // key except Space/Enter acts only while lifted, so it never steals keys from
  // fields inside a row.
  holderKey = (key: any, shift: any) => {
  const lift = this.registry.lift;
  if (lift == null || lift.holder !== this.entry) return false;
  if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
    this.endLift('drop');
    return true;
  }
  if (key === 'Escape') {
    this.endLift('cancel');
    return true;
  }
  const horizontal = this.orientation === 'horizontal';
  const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
  const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
  if (shift && (key === nextKey || key === prevKey)) {
    // Hopping is on wherever a group is set; an ungrouped list ignores it.
    if (this.effectiveGroup() == null) return false;
    this.hop(key === nextKey ? 1 : -1);
    return true;
  }
  const from = this.registry.indexOfLift();
  if (from < 0) {
    this.loseLift();
    return false;
  }
  // pageStep below 1 (or not a number) still moves by at least one position.
  const step = Math.max(1, Math.floor(Number(this.pageStep) || 1));
  let to: any = null;
  if (key === nextKey) to = from + 1;else if (key === prevKey) to = from - 1;else if (key === 'Home') to = 0;else if (key === 'End') to = this.entry.items().length - 1;else if (key === 'PageDown') to = from + step;else if (key === 'PageUp') to = from - step;
  if (to === null) return false;
  // `sort: false`: no moves within the list (as by mouse). The key is still
  // taken, so it does not scroll the page while a row is lifted, and says why
  // nothing moved.
  if (this.liveOption('sort', true) === false) {
    this.say(this.entry, 'notSortable', this.entry.items()[from], from, this.entry.rowEl(from) ?? lift.liftedRowEl);
    return true;
  }
  this.moveLiftTo(to, key === prevKey || key === 'Home' || key === 'PageUp' ? -1 : 1);
  return true;
};

  // A key pressed while focus has fallen to <body> during a lift. A hop removes
  // the focused row from one list and the destination may render (and take
  // focus) only after the handler returns (Angular), so the next key of a fast
  // burst can reach <body>. The list holding the lift handles it as if it had
  // landed on the lifted row, then puts focus back on that row.
  //
  // Only while a refocus of ours is outstanding (`focusPending`): focus that left
  // the lifted row for any other reason (the user clicked elsewhere or tabbed
  // away) keeps today's behaviour, and those keys are not ours. Modified keys
  // and keys someone already handled are never taken.
  onStrayKey = (ev: any) => {
  const lift = this.registry.lift;
  if (lift == null || lift.holder !== this.entry || !lift.focusPending) return;
  if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const t = ev.target;
  if (t !== document.body && t !== document.documentElement) return;
  const item = lift.item;
  const at = this.registry.indexOfLift();
  if (!this.holderKey(ev.key, !!ev.shiftKey)) return;
  ev.preventDefault();
  const now = this.registry.lift;
  if (now != null) now.holder.focusRow(now.item, this.registry.indexOfLift());else if (at >= 0) this.entry.focusRow(item, at);
};

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
  getInstance() {
    return this.instance;
  }

  // toArray()/sort() operate on SortableJS's data-id ordering — every row carries
  // :data-id="keyFor(item, index)", so toArray() returns the current key order and
  // sort(order) reorders by those keys (set itemKey for stable object-list keys).
  toArray() {
    return this.instance ? this.instance.toArray() : [];
  }

  sort(order: any, useAnimation = true) {
    this.instance?.sort(order, useAnimation);
  }

  // option(name) reads a live SortableJS option; option(name, value) sets one — the
  // runtime escape hatch for any SortableJS option beyond the curated props.
  // Setting `disabled`, `filter`, `draggable` or `sort` also applies to the
  // keyboard; `option('disabled', true)` mid-lift ends the lift this list holds.
  option(name: any, value: any) {
    if (!this.instance) return undefined;
    if (value === undefined) return this.instance.option(name);
    this.instance.option(name, value);
    if (this.KEYBOARD_OPTIONS.includes(name)) this.setOverride(name, value);
    if (name === 'disabled' && value) this.keyboardTurnedOff();
    return value;
  }

  get items(): any[] { return this._itemsControllable.read(); }
  set items(v: any[]) { this._itemsControllable.notifyPropertyWrite(v); }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   *
   * command-palette-per-level-virtual / portal-through-portal cluster —
   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping
   * attribute, never a consumer prop) so a parent-assigned `ref=` on this
   * component's own host tag can never clobber this component's OWN
   * internal `data-rozie-ref` ref markers via fallthrough re-application.
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['data-rozie-ref', 'items', 'item-key', 'itemkey', 'handle', 'group', 'animation', 'disabled', 'disable-keyboard', 'disablekeyboard', 'keyboard-trigger', 'keyboardtrigger', 'options', 'label-for', 'labelfor', 'ghost-class', 'ghostclass', 'chosen-class', 'chosenclass', 'drag-class', 'dragclass', 'filter', 'easing', 'force-fallback', 'forcefallback', 'swap-threshold', 'swapthreshold', 'cloneable', 'list-class', 'listclass', 'item-class', 'itemclass', 'list-label', 'listlabel', 'orientation', 'page-step', 'pagestep', 'keyboard-instructions', 'keyboardinstructions', 'announcements', 'item-style', 'itemstyle']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}
