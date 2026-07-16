import { LitElement, css, html } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { __rozieReconcileAfterDomMutation, createLitControllableProperty, rozieAttr, rozieClass, rozieListeners, rozieSpread, rozieStyle } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';
import { keyed } from 'lit/directives/keyed.js';
import { useSortableJS } from './internal/useSortableJS';

interface RozieDefaultSlotCtx {
  item: unknown;
  index: unknown;
}

@customElement('rozie-sortable-list')
export default class SortableList extends SignalWatcher(LitElement) {
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
   * <SortableList r-model:items="$data.todos" itemKey="id" />
   */
  @property({ type: Array, attribute: 'items' }) _items_attr: any[] = [];
  private _itemsControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'items-change', defaultValue: [], initialControlledValue: undefined });
  /**
   * The per-row key the framework reconciler tracks each item by across a reorder — either a property name (e.g. `itemKey="id"` reads `item.id`) or an `(item, index) => key` function. With neither, id-less object items get a stable synthetic key via an internal `WeakMap` (survives reorder by object identity); primitive items fall back to index — pass a function for reorderable duplicate primitives.
   */
  @property({ type: String }) itemKey: string | (((...args: any[]) => any) | null) = null;
  /**
   * CSS selector identifying the per-row drag handle, so a drag starts only from that element rather than anywhere in the row. Authored class names render literally on every target (React included), so a plain `.grip` works; `$classSelector('grip')` is an optional, typo-checked way to author it.
   */
  @property({ type: String, reflect: true }) handle: string | null = null;
  /**
   * SortableJS group name enabling cross-list drag — two lists sharing a `group` accept items between each other (the source fires `remove`, the destination fires `add`). Set `cloneable: true` to flip a string group into clone-mode.
   */
  @property({ type: String, reflect: true }) group: string | null = null;
  /**
   * Reorder animation duration in milliseconds. `0` disables the animation. Runtime-updatable.
   */
  @property({ type: Number, reflect: true }) animation: number = 150;
  /**
   * Temporarily disable dragging without unmounting — reapplied live via `instance.option('disabled', v)` (no remount). Also suppresses keyboard reordering: a disabled list is not sortable by any input, so rows lose their `tabindex` and the keydown handler no-ops.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Opt out of keyboard reordering (Space lift / Arrow move / Esc cancel / Enter drop) while leaving pointer drag enabled. Rows drop out of the tab order (no `tabindex`) and the keydown handler no-ops. Keyboard access is gated on `!disabled && !disableKeyboard`.
   */
  @property({ type: Boolean, reflect: true }) disableKeyboard: boolean = false;
  /**
   * Verbatim SortableJS options pass-through for anything not covered by the named props. The named props win on key conflict but `options` lands AFTER them in the merge so consumers can override defaults; handler keys (`onStart`, `onEnd`, `onUpdate`, `onAdd`, `onRemove`, `onClone`) are stripped — the helper owns those paths.
   */
  @property({ type: Object }) options: any = {};
  /**
   * Optional `(item, idx) => string` returning the screen-reader label for the aria-live announcer during keyboard drag. Defaults to `item.label` (or `String(item)` when no `label` field exists).
   */
  @property({ type: Function }) labelFor: ((...args: any[]) => any) | null = null;
  /**
   * Class name applied to the drop-placeholder (ghost) element while dragging. Forwarded live via `instance.option`, so toggling it at runtime takes effect without a remount.
   */
  @property({ type: String, reflect: true }) ghostClass: string | null = null;
  /**
   * Class name applied to the currently-chosen item while dragging. Forwarded live via `instance.option` (no remount needed to change it).
   */
  @property({ type: String, reflect: true }) chosenClass: string | null = null;
  /**
   * Class name applied to the dragging element. Only takes effect in fallback mode (`forceFallback: true`). Forwarded live via `instance.option`.
   */
  @property({ type: String, reflect: true }) dragClass: string | null = null;
  /**
   * CSS selector that prevents drag initiation on matching rows (locked items). SortableJS checks it at `mousedown`/`touchstart` and aborts the drag if it matches. A `data-*` attribute selector (e.g. `[data-locked]`) is the most robust choice across all targets.
   */
  @property({ type: String, reflect: true }) filter: string | null = null;
  /**
   * CSS easing function for the reorder animation (e.g. `'ease-in'`, `'cubic-bezier(0.4, 0, 0.2, 1)'`). Runtime-updatable.
   */
  @property({ type: String, reflect: true }) easing: string | null = null;
  /**
   * Force SortableJS's mouse-event drag path over HTML5 DnD — useful for touch devices, consistent cross-browser behavior, and synthetic test drivers (and `dragClass` only applies in this mode). **Construction-time only**: SortableJS reads it once at construction, so re-key the `<SortableList>` to toggle it at runtime.
   */
  @property({ type: Boolean, reflect: true }) forceFallback: boolean = false;
  /**
   * SortableJS swap threshold (0..1) — a lower value makes rows swap earlier as the dragged item overlaps a neighbor. Reapplied live via `instance.option('swapThreshold', v)` — SortableJS reads it on every dragover, so no remount is needed.
   */
  @property({ type: Number, reflect: true }) swapThreshold: number = 1;
  /**
   * High-level prop that REPLACES a string `group` with SortableJS's `{ name, pull: 'clone', put: true }` clone-mode object form — the source deposits a COPY onto the destination and keeps its own array unchanged (the palette → canvas pattern). With `group: null` it is a no-op (a clone-mode list with no group name has no peer to clone into). Reapplied live — toggling `cloneable` (or changing `group`) recomputes the clone-mode shape and reapplies it via `instance.option('group', …)`, no remount.
   */
  @property({ type: Boolean, reflect: true }) cloneable: boolean = false;
  /**
   * Extra class(es) merged onto the list container (the SortableJS root) alongside the base `rozie-sortable-list` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding), normalized identically across all six targets — the hook for bridging a CSS framework (`.list-group`) or a flex/grid parent onto the component.
   */
  @property({ type: String }) listClass: string | any[] | any = '';
  /**
   * Extra class(es) merged onto every item row alongside the base `rozie-sortable-item` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding) applied uniformly, OR an `(item, index) => class` function for per-row classes evaluated at render time. Normalized identically across all six targets.
   */
  @property({ type: String }) itemClass: string | any[] | any | (((...args: any[]) => any) | null) = '';
  /**
   * Per-row inline style applied to the `.rozie-sortable-item` wrapper. Accepts a CSS `String`, a flat style object (`Record<string, string | number>`), or an `(item, index) => string | object` function for per-row styling. Because it lands on the wrapper — the direct child of the list container — it can drive CSS-grid placement (`grid-column` / `grid-row` / `align-self`) when `listClass` sets `display: grid`. Normalized per target; `null` / empty drops the attribute.
   */
  @property({ type: String }) itemStyle: string | any | (((...args: any[]) => any) | null) = null;
  private _liftedIndex = signal<any>(null);
  private _ariaLiveText = signal('');
  @query('[data-rozie-ref="listEl"]') private _refListEl!: HTMLElement;
  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;
private __rozieFirstUpdateDone = false;

  @state() private _hasSlotHeader = false;
  @queryAssignedElements({ slot: 'header', flatten: true }) private _slotHeaderElements!: Element[];
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @property({ attribute: false }) __rozieDefaultSlot__?: (scope: { item: unknown; index: unknown }) => unknown;
  @state() private _hasSlotFooter = false;
  @queryAssignedElements({ slot: 'footer', flatten: true }) private _slotFooterElements!: Element[];

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

    this._disconnectCleanups.push((() => this.instance?.destroy()));

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
      onChange: ({
        kind,
        oldIndex,
        newIndex,
        item
      }: any) => {
        if (kind === 'reorder') this.dispatchEvent(new CustomEvent("change", {
          detail: {
            oldIndex,
            newIndex,
            item
          },
          bubbles: true,
          composed: true
        }));else if (kind === 'add') this.dispatchEvent(new CustomEvent("add", {
          detail: {
            newIndex,
            item
          },
          bubbles: true,
          composed: true
        }));else if (kind === 'remove') this.dispatchEvent(new CustomEvent("remove", {
          detail: {
            oldIndex,
            item
          },
          bubbles: true,
          composed: true
        }));
      },
      onStart: (e: any) => this.dispatchEvent(new CustomEvent("start", {
        detail: e,
        bubbles: true,
        composed: true
      })),
      onEnd: (e: any) => this.dispatchEvent(new CustomEvent("end", {
        detail: e,
        bubbles: true,
        composed: true
      }))
    });
    this.instance = sortable.instance;
    // $onMount's cleanup-return: closing over a setup-local (`sortable`) does
    // not survive the Solid emitter's setup/cleanup split — it scopes cleanup
    // outside the setup IIFE. Closing over `instance` (a module-scope `let`)
    // works on every target.
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('disabled'))) { const __watchVal = (() => this.disabled)(); ((v: any) => this.instance?.option('disabled', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('group'))) { const __watchVal = (() => this.group)(); (() => this.instance?.option('group', this.resolveGroup()))(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('cloneable'))) { const __watchVal = (() => this.cloneable)(); (() => this.instance?.option('group', this.resolveGroup()))(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('swapThreshold'))) { const __watchVal = (() => this.swapThreshold)(); ((v: any) => this.instance?.option('swapThreshold', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('handle'))) { const __watchVal = (() => this.handle)(); ((v: any) => this.instance?.option('handle', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('ghostClass'))) { const __watchVal = (() => this.ghostClass)(); ((v: any) => this.instance?.option('ghostClass', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('chosenClass'))) { const __watchVal = (() => this.chosenClass)(); ((v: any) => this.instance?.option('chosenClass', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('dragClass'))) { const __watchVal = (() => this.dragClass)(); ((v: any) => this.instance?.option('dragClass', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('filter'))) { const __watchVal = (() => this.filter)(); ((v: any) => this.instance?.option('filter', v))(__watchVal); }
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
<div class="rozie-sortable-wrap" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="__rozieRoot" data-rozie-s-0af24eae>
  <div class="${(rozieClass(['rozie-sortable-list', this.listClass]))}" part="list" data-rozie-ref="listEl" data-rozie-s-0af24eae>${keyed(this._rozieReconcileSeq ?? 0, html`
    <slot name="header"></slot>
    ${repeat<any>(this.items, (item, index) => this.keyFor(item, index), (item, index) => html`<div class="${(rozieClass(['rozie-sortable-item', this.itemClassFor(item, index), { 'rozie-sortable-item-lifted': this._liftedIndex.value === index }]))}" key=${rozieAttr(this.keyFor(item, index))} style=${rozieStyle(this.itemStyleFor(item, index))} data-id=${rozieAttr(this.keyFor(item, index))} role="listitem" tabindex=${rozieAttr(this.keyboardEnabled() ? 0 : null)} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onRowKeyDown($event, index); }} data-rozie-s-0af24eae>
      ${this.__rozieDefaultSlot__ !== undefined ? this.__rozieDefaultSlot__({item: item, index: index}) : html`<slot data-rozie-params=${(() => { try { return JSON.stringify({item: item, index: index}); } catch { return '{}'; } })()}></slot>`}
    </div>`)}
    <slot name="footer"></slot>
  `)}</div>
  <div class="rozie-sortable-aria-live" data-rozie-sortable-aria-live="" aria-live="polite" aria-atomic="true" data-rozie-s-0af24eae>${this._ariaLiveText.value}</div>
</div>
`;
  }

  instance: any = null;

  __rowKeyMap = new WeakMap();

  __rowKeySeq = 0;

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

  resolveGroup = () => this.cloneable && typeof this.group === 'string' ? {
  name: this.group,
  pull: 'clone' as const,
  put: true as const
} : this.group ?? undefined;

  itemClassFor = (item: any, index: any) => {
  const v = this.itemClass;
  return typeof v === 'function' ? v(item, index) : v;
};

  itemStyleFor = (item: any, index: any) => {
  const s = typeof this.itemStyle === 'function' ? this.itemStyle(item, index) : this.itemStyle;
  return s == null || s === '' ? null : s;
};

  getLabel = (idx: any) => {
  const item = this.items[idx];
  if (this.labelFor !== null) return this.labelFor(item, idx);
  if (item !== null && typeof item === 'object' && 'label' in item) return item.label;
  return String(item);
};

  keyboardEnabled = () => !this.disabled && !this.disableKeyboard;

  onRowKeyDown = ($event: any, index: any) => {
  // Origin guard (quick 260716-ggq): reorder keys apply ONLY when the row
  // element ITSELF is focused. A slotted interactive child (an <input>,
  // <button>, etc. rendered into the row's default slot) bubbles its own
  // keydown up to this handler — without this guard, Space/Enter typed into
  // that child would be hijacked for lift/drop instead of reaching the
  // child. Must run FIRST, before the keyboardEnabled() check.
  if ($event.target !== $event.currentTarget) return;
  // Defense-in-depth: when keyboard reordering is off the rows carry no
  // tabindex and can't receive focus, but a consumer-focused row (or a
  // programmatic .focus()) must still no-op here rather than reorder.
  if (!this.keyboardEnabled()) return;
  const key = $event.key;
  // Space (' ' on browsers; KeyboardEvent.key === ' ') OR Enter — lift/drop.
  if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
    $event.preventDefault();
    if (this._liftedIndex.value === null) {
      // LIFT
      this._liftedIndex.value = index;
      this._ariaLiveText.value = 'Lifted ' + this.getLabel(index);
      return;
    }
    // DROP
    const dropped = this.getLabel(this._liftedIndex.value);
    const at = this._liftedIndex.value;
    this._liftedIndex.value = null;
    this._ariaLiveText.value = 'Dropped ' + dropped + ' at position ' + (at + 1);
    return;
  }
  if (key === 'Escape') {
    if (this._liftedIndex.value === null) return;
    $event.preventDefault();
    const cancelled = this.getLabel(this._liftedIndex.value);
    this._liftedIndex.value = null;
    this._ariaLiveText.value = 'Cancelled lift of ' + cancelled;
    return;
  }
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    if (this._liftedIndex.value === null) return;
    $event.preventDefault();
    const dir = key === 'ArrowDown' ? 1 : -1;
    const from = this._liftedIndex.value;
    const to = from + dir;
    if (to < 0 || to >= this.items.length) return;
    const next = [...this.items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    this._itemsControllable.write(next);
    this._liftedIndex.value = to;
    this._ariaLiveText.value = 'Moved ' + this.getLabel(to) + ' to position ' + (to + 1);
    // After the keyed reorder write, restore focus to the moved row. No-op
    // on React/Vue/Angular (DOM identity preserved); queueMicrotask +
    // querySelectorAll + .focus() on Svelte/Solid/Lit (DOM re-created).
    queueMicrotask(() => (this.renderRoot.querySelectorAll('[role="listitem"]')?.[to] as HTMLElement | undefined)?.focus?.());
    this.dispatchEvent(new CustomEvent("change", {
      detail: {
        oldIndex: from,
        newIndex: to,
        item: moved
      },
      bubbles: true,
      composed: true
    }));
  }
};

  getInstance() {
    return this.instance;
  }

  toArray() {
    return this.instance ? this.instance.toArray() : [];
  }

  sort(order: any, useAnimation = true) {
    this.instance?.sort(order, useAnimation);
  }

  option(name: any, value: any) {
    if (!this.instance) return undefined;
    if (value === undefined) return this.instance.option(name);
    this.instance.option(name, value);
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
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['items', 'item-key', 'itemkey', 'handle', 'group', 'animation', 'disabled', 'disable-keyboard', 'disablekeyboard', 'options', 'label-for', 'labelfor', 'ghost-class', 'ghostclass', 'chosen-class', 'chosenclass', 'drag-class', 'dragclass', 'filter', 'easing', 'force-fallback', 'forcefallback', 'swap-threshold', 'swapthreshold', 'cloneable', 'list-class', 'listclass', 'item-class', 'itemclass', 'item-style', 'itemstyle']);
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
