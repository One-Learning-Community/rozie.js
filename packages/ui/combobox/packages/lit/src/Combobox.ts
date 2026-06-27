import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread, rozieStyle } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';
// virtual-core: the framework-agnostic windowing state machine (the data-table
// precedent — NO per-framework adapter). The static import is emitted unconditionally;
// every RUNTIME reference sits behind `if ($props.virtual)` / a `virtualizer` guard so
// the non-virtual emitted path executes none of it (byte-identical-off).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// Windowing instance state (reassigned module-`let`s → React hoists to useRef; do NOT
// const). NULL until $onMount, ONLY constructed when $props.virtual. gridScrollEl is the
// captured .rozie-combobox-list scroll div; remeasurePending dedupes the deferred sweep.

interface RozieOptionSlotCtx {
  option: unknown;
  index: unknown;
  active: unknown;
  selected: unknown;
  disabled: unknown;
}

interface RozieEmptySlotCtx {
  query: unknown;
}

@customElement('rozie-combobox')
export default class Combobox extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-combobox[data-rozie-s-9546115a] {
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
.rozie-combobox-spacer[data-rozie-s-9546115a] { margin: 0; padding: 0; border: 0; list-style: none; }
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
}
`;

  /**
   * The selected option's value (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a combobox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `null` when nothing is selected.
   * @example
   * <Combobox r-model:value="country" :options="countries" />
   */
  @property({ type: Object, attribute: 'value' }) _value_attr: unknown = null;
  private _valueControllable = createLitControllableProperty<unknown>({ host: this, eventName: 'value-change', defaultValue: null, initialControlledValue: undefined });
  /**
   * The option list — `[{ value, label, disabled? }]`. `label` is the displayed text (and what client filtering matches against), `value` is what `r-model:value` reads and writes, and an optional `disabled` flag makes an option non-selectable.
   */
  @property({ type: Array }) options: any[] = [];
  /**
   * Placeholder text shown in the input while it is empty.
   */
  @property({ type: String, reflect: true }) placeholder: string = '';
  /**
   * Disable the control — the input becomes non-interactive and the popup cannot be opened. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Opt **out** of built-in client filtering (async / server-side mode): render `options` exactly as supplied and rely on the `search` event to refetch. By default the component filters `options` by `label`, case-insensitively, against the typed query.
   */
  @property({ type: Boolean, reflect: true }) disableFilter: boolean = false;
  /**
   * Accessible name for the input (`aria-label`), used when there is no visible `<label for>` pointing at it. Provide this (or an external label) so the combobox is announced.
   */
  @property({ type: String, reflect: true }) ariaLabel: string = null;
  /**
   * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one combobox shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  @property({ type: String, reflect: true }) idBase: string = 'rozie-combobox';
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the combobox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
   */
  @property({ type: Boolean, reflect: true }) inline: boolean = false;
  /**
   * Close the popup after a selection commits. Defaults `true` (standard autocomplete behavior); set to `false` to keep the popup open after a selection — e.g. when the combobox is embedded in a multi-action surface like a command palette.
   */
  @property({ type: Boolean, reflect: true }) closeOnSelect: boolean = true;
  /**
   * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
   */
  @property({ type: Function }) optionLabel: ((...args: unknown[]) => unknown) | null = null;
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  @property({ type: Function }) optionValue: ((...args: unknown[]) => unknown) | null = null;
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  @property({ type: Function }) optionDisabled: ((...args: unknown[]) => unknown) | null = null;
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling popup (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed combobox. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded.
   */
  @property({ type: Boolean, reflect: true }) virtual: boolean = false;
  /**
   * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  @property({ type: Number, reflect: true }) estimateRowHeight: number = 36;
  /**
   * A CSS length string bounding the popup scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-combobox-list-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
   */
  @property({ type: String, reflect: true }) maxHeight: string = '';
  private _query = signal('');
  private _isOpen = signal(false);
  private _activeIndex = signal(-1);
  private _rows = signal([]);
  private _windowVer = signal(0);
  private _editVer = signal(0);
  @query('[data-rozie-ref="inputEl"]') private _refInputEl!: HTMLElement;
  @query('[data-rozie-ref="listEl"]') private _refListEl!: HTMLElement;
  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieWatchInitial_1 = true;

  @state() private _hasSlotOption = false;
  @queryAssignedElements({ slot: 'option', flatten: true }) private _slotOptionElements!: Element[];
  @property({ attribute: false }) option?: (scope: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown }) => unknown;
  @state() private _hasSlotEmpty = false;
  @queryAssignedElements({ slot: 'empty', flatten: true }) private _slotEmptyElements!: Element[];
  @property({ attribute: false }) empty?: (scope: { query: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="option"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotOption = this._slotOptionElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="empty"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotEmpty = this._slotEmptyElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotOption = Array.from(this.children).some((el) => el.getAttribute('slot') === 'option');
    this._hasSlotEmpty = Array.from(this.children).some((el) => el.getAttribute('slot') === 'empty');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.value)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.syncQueryToValue();
    })(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => (this.options ? this.options.length : 0) + '|' + this._query.value)(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      this.syncRows();
      if (this.virtual && this.virtualizer) {
        this.virtualizer.setOptions(this.virtualizerOptions());
        this.virtualizer._willUpdate();
        this._windowVer.value = this._windowVer.value + 1;
        this.scheduleRemeasure();
      }
    })(); }); }));

    this.syncQueryToValue();
    this.syncRows();
    // ── Windowing: construct the virtualizer (ONLY when virtual) ──────────────
    // The popup renders at mount when virtual (r-if="$data.isOpen || $props.virtual"), so
    // the .rozie-combobox-list scroll container exists here.
    // ── Windowing: construct the virtualizer (ONLY when virtual) ──────────────
    // The popup renders at mount when virtual (r-if="$data.isOpen || $props.virtual"), so
    // the .rozie-combobox-list scroll container exists here.
    if (this.virtual) {
      // Capture the scroll container via $el.querySelector (the data-table gridScrollEl
      // precedent, proven ×6 incl Lit shadow + Solid) — $refs on a conditionally-rendered
      // node is null on Solid/Lit, leaving the virtualizer with no scroll element.
      this.gridScrollEl = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector('.rozie-combobox-list') : null;
      this.virtualizer = new Virtualizer(this.virtualizerOptions());
      this.virtualizerCleanup = this.virtualizer._didMount();
      this._windowVer.value = this._windowVer.value + 1;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.kickWindow(8));else setTimeout(() => this.kickWindow(8), 0);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      () => {
        if (this.virtualizerCleanup) this.virtualizerCleanup();
      };
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'value') this._valueControllable.notifyAttributeChange(value as unknown as unknown);
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-combobox": true, 'rozie-combobox--open': this._isOpen.value, 'rozie-combobox--disabled': this.disabled, 'rozie-combobox--inline': this.inline }).filter(([, v]) => v).map(([k]) => k).join(' ')}" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="__rozieRoot" data-rozie-s-9546115a>
  <input class="rozie-combobox-input" type="text" role="combobox" aria-autocomplete="list" aria-expanded=${!!this._isOpen.value} aria-controls=${rozieAttr(this.listId())} aria-activedescendant=${rozieAttr(this.activeId())} aria-label=${this.ariaLabel} .value=${this._query.value} placeholder=${this.placeholder} ?disabled=${!!this.disabled} autocomplete="off" @input=${($event: Event) => { this.onInput($event); }} @focus=${($event: Event) => { this.onFocus($event); }} @blur=${($event: Event) => { this.onBlur(); }} @keydown=${($event: Event) => { this.onKeydown($event); }} data-rozie-ref="inputEl" data-rozie-s-9546115a />

  
  ${this._isOpen.value && !this.virtual ? html`<ul class="rozie-combobox-list" id=${rozieAttr(this.listId())} role="listbox" data-rozie-s-9546115a>
    ${repeat<any>(this.filteredOptions(), (opt, _idx) => opt.value, (opt, _idx) => html`<li class="${Object.entries({ "rozie-combobox-option": true, 'rozie-combobox-option--active': opt._i === this._activeIndex.value, 'rozie-combobox-option--selected': opt.value === this.value, 'rozie-combobox-option--disabled': opt.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(opt.value)} id=${rozieAttr(this.optId(opt._i))} role="option" aria-selected=${opt.value === this.value} aria-disabled=${!!opt.disabled} @mousedown=${($event: MouseEvent) => { $event.preventDefault(); this.selectOption(opt); }} @mouseenter=${($event: Event) => { this._activeIndex.value = opt._i; }} data-rozie-s-9546115a>
      ${this.option !== undefined ? this.option({option: opt.option, index: opt._i, active: opt._i === this._activeIndex.value, selected: opt.value === this.value, disabled: opt.disabled}) : html`<slot name="option" data-rozie-params=${(() => { try { return JSON.stringify({option: opt.option, index: opt._i, active: opt._i === this._activeIndex.value, selected: opt.value === this.value, disabled: opt.disabled}); } catch { return '{}'; } })()}>${rozieDisplay(opt.label)}</slot>`}
    </li>`)}

    ${this.filteredOptions().length === 0 ? html`<li class="rozie-combobox-empty" role="presentation" data-rozie-s-9546115a>
      ${this.empty !== undefined ? this.empty({query: this._query.value}) : html`<slot name="empty" data-rozie-params=${(() => { try { return JSON.stringify({query: this._query.value}); } catch { return '{}'; } })()}>No results</slot>`}
    </li>` : nothing}</ul>` : nothing}${this.virtual ? html`<ul class="rozie-combobox-list rozie-combobox-list--virtual" id=${rozieAttr(this.listId())} role="listbox" style=${rozieStyle(this.maxHeight ? 'height:' + this.maxHeight + ';max-height:' + this.maxHeight + ';overflow-y:auto;--rozie-combobox-list-max-height:' + this.maxHeight : 'overflow-y:auto')} data-rozie-ref="listEl" data-rozie-s-9546115a>
    <li class="rozie-combobox-spacer" aria-hidden="true" style=${rozieStyle('height:' + this.padTop() + 'px')} data-rozie-s-9546115a></li>

    ${repeat<any>(this.windowedRows(), (wr, _idx) => wr.row.id, (wr, _idx) => html`<li class="${Object.entries({ "rozie-combobox-option": true, 'rozie-combobox-option--active': wr.vi.index === this._activeIndex.value, 'rozie-combobox-option--selected': wr.row.value === this.value, 'rozie-combobox-option--disabled': wr.row.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(wr.row.id)} id=${rozieAttr(this.optId(wr.vi.index))} data-index=${rozieAttr(wr.vi.index)} role="option" aria-selected=${wr.row.value === this.value} aria-disabled=${!!wr.row.disabled} @mousedown=${($event: MouseEvent) => { $event.preventDefault(); this.selectOption(wr.row); }} @mouseenter=${($event: Event) => { this._activeIndex.value = wr.vi.index; }} data-rozie-s-9546115a>
      ${this.option !== undefined ? this.option({option: wr.row.option, index: wr.vi.index, active: wr.vi.index === this._activeIndex.value, selected: wr.row.value === this.value, disabled: wr.row.disabled}) : html`<slot name="option" data-rozie-params=${(() => { try { return JSON.stringify({option: wr.row.option, index: wr.vi.index, active: wr.vi.index === this._activeIndex.value, selected: wr.row.value === this.value, disabled: wr.row.disabled}); } catch { return '{}'; } })()}>${rozieDisplay(wr.row.label)}</slot>`}
    </li>`)}

    <li class="rozie-combobox-spacer" aria-hidden="true" style=${rozieStyle('height:' + this.padBottom() + 'px')} data-rozie-s-9546115a></li>

    ${this.windowSource().length === 0 ? html`<li class="rozie-combobox-empty" role="presentation" data-rozie-s-9546115a>
      ${this.empty !== undefined ? this.empty({query: this._query.value}) : html`<slot name="empty" data-rozie-params=${(() => { try { return JSON.stringify({query: this._query.value}); } catch { return '{}'; } })()}>No results</slot>`}
    </li>` : nothing}</ul>` : nothing}</div>
`;
  }

  labelOf = (opt: any) => {
  if (this.optionLabel !== null) return this.optionLabel(opt);
  if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
  return String(opt);
};

  valueOf$local = (opt: any) => {
  if (this.optionValue !== null) return this.optionValue(opt);
  if (opt !== null && typeof opt === 'object' && 'value' in opt) return opt.value;
  return opt;
};

  disabledOf = (opt: any) => {
  if (this.optionDisabled !== null) return !!this.optionDisabled(opt);
  if (opt !== null && typeof opt === 'object' && 'disabled' in opt) return !!opt.disabled;
  return false;
};

  virtualItemKey = (i: any) => {
  const src = this.windowSource();
  return src && src[i] ? src[i].id : undefined;
};

  virtualizerOptions = (): any => ({
  count: this.windowSource().length,
  getScrollElement: () => this.gridScrollEl,
  estimateSize: () => this.estimateRowHeight,
  observeElementRect,
  observeElementOffset,
  scrollToFn: elementScroll,
  measureElement,
  overscan: 8,
  getItemKey: this.virtualItemKey,
  onChange: () => {
    this._windowVer.value = this._windowVer.value + 1;
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
    this.scheduleRemeasure();
  }
});

  windowedRows = () => {
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
  void this._windowVer.value;
  void this._editVer.value;
  if (!this.virtualizer) {
    // Virtual OFF → full set (the r-else table never calls this, but keep it total). Virtual ON
    // but the virtualizer is not yet constructed (pre-$onMount first paint) → render NOTHING so
    // the template never dereferences a null `vi` (the windowed bindings read wr.vi.index); the
    // rows appear on the first onChange after _didMount.
    if (!this.virtual) {
      const rowList = this._rows.value || [];
      return rowList.map((r: any) => ({
        vi: null,
        row: r
      }));
    }
    return [];
  }
  const items = this.virtualizer.getVirtualItems();
  const rowList = this._rows.value || [];
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
  const pin = this.pinnedEditIndex();
  if (pin >= 0 && rowList[pin]) {
    let inWindow = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].index === pin) {
        inWindow = true;
        break;
      }
    }
    if (!inWindow) {
      const pm = this.pinnedMeasurement(pin);
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
};

  padTop = () => {
  // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
  // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
  // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
  void this._windowVer.value;
  void this._editVer.value;
  if (!this.virtual || !this.virtualizer) return 0;
  const items = this.virtualizer.getVirtualItems();
  let pad = items.length ? items[0].start : 0;
  // D-02 spacer subtraction: when the pinned editing row sits ABOVE the window it is rendered
  // in-flow as the slice's LEADING <tr> (its measured height is now a real <tr>), so subtract
  // that height from the leading spacer to keep padTop + Σ rendered <tr> + padBottom = total.
  const pin = this.pinnedEditIndex();
  if (pin >= 0) {
    const pm = this.pinnedMeasurement(pin);
    const inWindow = this.pmIndexInWindow(items, pin);
    if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
  }
  return pad < 0 ? 0 : pad;
};

  padBottom = () => {
  // subscribe-first, see windowedRows() (IN-04): touch windowVer + editVer before the early
  // return so the fine-grained spacer :style binding subscribes on its first eval + re-derives
  // on pin/unpin.
  void this._windowVer.value;
  void this._editVer.value;
  if (!this.virtual || !this.virtualizer) return 0;
  const items = this.virtualizer.getVirtualItems();
  if (!items.length) return 0;
  let pad = this.virtualizer.getTotalSize() - items[items.length - 1].end;
  // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
  // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
  const pin = this.pinnedEditIndex();
  if (pin >= 0) {
    const pm = this.pinnedMeasurement(pin);
    const inWindow = this.pmIndexInWindow(items, pin);
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
};

  pmIndexInWindow = (items: any, idx: any) => {
  for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
  return false;
};

  rowIsOutsideWindow = (r: any) => {
  if (!this.virtual || !this.virtualizer) return false;
  const items = this.virtualizer.getVirtualItems();
  for (const it of items as any) if (it.index === r) return false;
  return true;
};

  virtualizer: any = null;

  virtualizerCleanup: any = null;

  gridScrollEl: any = null;

  remeasurePending = false;

  filteredOptions = () => {
  const opts = Array.isArray(this.options) ? this.options : [];
  let list = opts;
  if (!this.disableFilter) {
    const q = this._query.value.toLowerCase();
    if (q) list = opts.filter((o: any) => String(this.labelOf(o)).toLowerCase().indexOf(q) !== -1);
  }
  return list.map((o: any, i: any) => ({
    value: this.valueOf$local(o),
    label: this.labelOf(o),
    disabled: this.disabledOf(o),
    _i: i,
    id: this.valueOf$local(o),
    option: o
  }));
};

  windowSource = () => this.filteredOptions();

  pinnedEditIndex = () => -1;

  pinnedMeasurement = (pin: any) => null;

  syncRows = () => {
  this._rows.value = this.windowSource();
};

  scheduleRemeasure = () => {
  if (this.remeasurePending) return;
  this.remeasurePending = true;
  let ranMicro = false;
  const microPass = () => {
    this.remeasureWindow();
  };
  const rafPass = () => {
    this.remeasurePending = false;
    this.remeasureWindow();
  };
  if (typeof queueMicrotask !== 'undefined') {
    ranMicro = true;
    queueMicrotask(microPass);
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) this.remeasurePending = false;else setTimeout(rafPass, 0);
};

  remeasureWindow = () => {
  if (!this.virtualizer || !this.gridScrollEl) return;
  if (this.virtualizer.scrollState) return;
  const els = this.gridScrollEl.querySelectorAll('.rozie-combobox-option[data-index]');
  for (const el of els as any) this.virtualizer.measureElement(el);
};

  scrollActiveIntoView = () => {
  if (!this.virtual || !this.virtualizer || this._activeIndex.value < 0) return;
  // 'center' (not 'auto'): keep the active option well inside the rendered slice — 'auto'
  // lands it at the viewport edge where the overscan band can leave it just-unrendered for
  // a frame on the fine-grained targets (Solid).
  this.virtualizer.scrollToIndex(this._activeIndex.value, {
    align: 'center'
  });
  this.scheduleRemeasure();
};

  optId = (i: any) => this.idBase + '-opt-' + i;

  listId = () => this.idBase + '-list';

  activeId = () => {
  const list = this.filteredOptions();
  if (this._isOpen.value && this._activeIndex.value >= 0 && list[this._activeIndex.value]) return this.optId(this._activeIndex.value);
  return null;
};

  nextEnabled = (list: any, from: any, dir: any) => {
  let i = from;
  for (let step = 0; step < list.length; step++) {
    i = i + dir;
    if (i < 0) i = 0;
    if (i >= list.length) i = list.length - 1;
    if (list[i] && !list[i].disabled) return i;
    if (dir < 0 && i === 0 || dir > 0 && i === list.length - 1) break;
  }
  return from;
};

  selectOption = (opt: any) => {
  if (!opt || opt.disabled) return;
  this._valueControllable.write(opt.value);
  this._query.value = String(opt.label);
  if (this.closeOnSelect) this._isOpen.value = false;
  this._activeIndex.value = -1;
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      value: opt.value,
      option: opt.option
    },
    bubbles: true,
    composed: true
  }));
};

  syncQueryToValue = () => {
  const opts = Array.isArray(this.options) ? this.options : [];
  const opt = opts.find((o: any) => o.value === this.value);
  this._query.value = opt ? String(opt.label) : '';
};

  onInput = (e: any) => {
  const q = e && e.target ? e.target.value : '';
  this._query.value = q;
  this._isOpen.value = true;
  this._activeIndex.value = 0;
  this.dispatchEvent(new CustomEvent("search", {
    detail: {
      query: q
    },
    bubbles: true,
    composed: true
  }));
};

  onFocus = (e: any) => {
  this._isOpen.value = true;
  if (e && e.target && e.target.select) e.target.select();
};

  onBlur = () => {
  this._isOpen.value = false;
};

  onKeydown = (e: any) => {
  const key = e ? e.key : '';
  const list = this.filteredOptions();
  // Capture the reactive reads into locals BEFORE any write so React never binds
  // a pre-write value (ROZ138; the read-then-write-same-key idiom). Each branch
  // is mutually exclusive, but a flow-insensitive analysis can't see that.
  const wasOpen = this._isOpen.value;
  const ai = this._activeIndex.value;
  if (key === 'ArrowDown') {
    if (e) e.preventDefault();
    if (!wasOpen) {
      this._isOpen.value = true;
      this._activeIndex.value = 0;
      return;
    }
    this._activeIndex.value = this.nextEnabled(list, ai, 1);
  } else if (key === 'ArrowUp') {
    if (e) e.preventDefault();
    if (!wasOpen) {
      this._isOpen.value = true;
      return;
    }
    this._activeIndex.value = this.nextEnabled(list, ai, -1);
  } else if (key === 'Enter') {
    if (wasOpen && ai >= 0 && list[ai]) {
      if (e) e.preventDefault();
      this.selectOption(list[ai]);
    }
  } else if (key === 'Escape') {
    if (wasOpen) {
      if (e) e.preventDefault();
      this._isOpen.value = false;
    }
  } else if (key === 'Home') {
    if (wasOpen) {
      if (e) e.preventDefault();
      this._activeIndex.value = this.nextEnabled(list, -1, 1);
    }
  } else if (key === 'End') {
    if (wasOpen) {
      if (e) e.preventDefault();
      this._activeIndex.value = this.nextEnabled(list, list.length, -1);
    }
  }
  // Keep the (new) active option in view when windowing — no-op when not virtual.
  this.scrollActiveIntoView();
};

  kickWindow = (attempts: any) => {
  if (!this.virtualizer) return;
  this.gridScrollEl = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector('.rozie-combobox-list') : this.gridScrollEl;
  // Only re-feed the count from a NON-EMPTY source: on React these rAF closures capture
  // stale (mount-time, empty) props, so feeding here would CLOBBER the $watch's correct
  // count back to 0. The $watch (fresh useEffect props) owns React's count; the kick owns
  // the Solid/Lit scroll-element re-attach + the deferred windowVer re-derive.
  if (this.windowSource().length > 0) {
    this.syncRows();
    this.virtualizer.setOptions(this.virtualizerOptions());
  }
  this.virtualizer._willUpdate();
  this._windowVer.value = this._windowVer.value + 1;
  this.remeasureWindow();
  if (this.windowedRows().length === 0 && attempts > 0) {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.kickWindow(attempts - 1));else setTimeout(() => this.kickWindow(attempts - 1), 16);
  }
};

  focus = () => this._refInputEl?.focus();

  clear = () => {
  this._valueControllable.write(null);
  this._query.value = '';
  this._activeIndex.value = -1;
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      value: null
    },
    bubbles: true,
    composed: true
  }));
};

  get value(): unknown { return this._valueControllable.read(); }
  set value(v: unknown) { this._valueControllable.notifyPropertyWrite(v); }

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
    const __skip = new Set<string>(['value', 'options', 'placeholder', 'disabled', 'disable-filter', 'disablefilter', 'aria-label', 'arialabel', 'id-base', 'idbase', 'inline', 'close-on-select', 'closeonselect', 'option-label', 'optionlabel', 'option-value', 'optionvalue', 'option-disabled', 'optiondisabled', 'virtual', 'estimate-row-height', 'estimaterowheight', 'max-height', 'maxheight']);
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
