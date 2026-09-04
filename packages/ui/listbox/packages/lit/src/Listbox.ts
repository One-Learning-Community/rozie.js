import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { RozieSlotDistributor, attachOutsideClickListener, createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread, rozieStyle } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';
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

interface RozieSelectedSlotCtx {
  selected: any;
  value: any;
}

interface RozieOptionSlotCtx {
  option: any;
  index: any;
  active: any;
  selected: any;
  disabled: any;
}

interface RozieEmptySlotCtx {
  query: any;
}

@customElement('rozie-listbox')
export default class Listbox extends SignalWatcher(LitElement) {
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' };

  static styles = css`
:host{display:contents}
.rozie-listbox[data-rozie-s-b576227a] {
  position: relative;
  display: inline-block;
  min-width: var(--rozie-listbox-min-width, 12rem);
  font: var(--rozie-listbox-font, inherit);
}
.rozie-listbox-control[data-rozie-s-b576227a] { display: block; }
.rozie-listbox-input[data-rozie-s-b576227a],
.rozie-listbox-trigger[data-rozie-s-b576227a] {
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-listbox-gap, 0.5rem);
  padding: var(--rozie-listbox-control-padding, 0.5rem 0.75rem);
  font: inherit;
  text-align: left;
  background: var(--rozie-listbox-bg, #fff);
  color: var(--rozie-listbox-fg, #1a1a1a);
  border: var(--rozie-listbox-border-width, 1px) solid var(--rozie-listbox-border, rgba(0, 0, 0, 0.2));
  border-radius: var(--rozie-listbox-radius, 6px);
  cursor: pointer;
}
.rozie-listbox-input[data-rozie-s-b576227a] { cursor: text; }
.rozie-listbox-input[data-rozie-s-b576227a]:focus-visible,
.rozie-listbox-input[data-rozie-s-b576227a]:focus,
.rozie-listbox-trigger[data-rozie-s-b576227a]:focus-visible,
.rozie-listbox-trigger[data-rozie-s-b576227a]:focus {
  outline: var(--rozie-listbox-ring-width, 2px) solid var(--rozie-listbox-ring, var(--rozie-listbox-accent, #0066cc));
  outline-offset: var(--rozie-listbox-ring-offset, 1px);
}
.rozie-listbox-disabled[data-rozie-s-b576227a] { opacity: var(--rozie-listbox-disabled-opacity, 0.6); pointer-events: none; }
.rozie-listbox-placeholder[data-rozie-s-b576227a] { color: var(--rozie-listbox-placeholder, rgba(0, 0, 0, 0.45)); }
.rozie-listbox-arrow[data-rozie-s-b576227a] {
  font-size: 0.75em;
  color: var(--rozie-listbox-arrow-color, currentColor);
  opacity: var(--rozie-listbox-arrow-opacity, 0.7);
}
.rozie-listbox-list[data-rozie-s-b576227a] {
  position: absolute;
  z-index: var(--rozie-listbox-z, 1000);
  top: calc(100% + var(--rozie-listbox-popup-offset, 4px));
  left: 0;
  right: 0;
  margin: 0;
  padding: var(--rozie-listbox-popup-padding, 0.25rem);
  max-height: var(--rozie-listbox-max-height, 16rem);
  overflow-y: auto;
  list-style: none;
  background: var(--rozie-listbox-popup-bg, var(--rozie-listbox-bg, #fff));
  color: var(--rozie-listbox-fg, #1a1a1a);
  border: var(--rozie-listbox-border-width, 1px) solid var(--rozie-listbox-popup-border, var(--rozie-listbox-border, rgba(0, 0, 0, 0.15)));
  border-radius: var(--rozie-listbox-popup-radius, var(--rozie-listbox-radius, 6px));
  box-shadow: var(--rozie-listbox-shadow, 0 6px 24px rgba(0, 0, 0, 0.12));
}
.rozie-listbox-inline[data-rozie-s-b576227a] {
  display: block;
  width: 100%;
}
.rozie-listbox-inline[data-rozie-s-b576227a] .rozie-listbox-list[data-rozie-s-b576227a] {
  position: static;
  margin-top: var(--rozie-listbox-popup-offset, 4px);
  border: none;
  border-radius: 0;
  box-shadow: none;
}
.rozie-listbox-option[data-rozie-s-b576227a] {
  padding: var(--rozie-listbox-option-padding, 0.4rem 0.6rem);
  border-radius: var(--rozie-listbox-option-radius, 4px);
  color: var(--rozie-listbox-option-fg, inherit);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-listbox-gap, 0.5rem);
}
.rozie-listbox-option.is-active[data-rozie-s-b576227a] {
  background: var(--rozie-listbox-active-bg, rgba(0, 102, 204, 0.12));
  color: var(--rozie-listbox-active-fg, inherit);
}
.rozie-listbox-option.is-selected[data-rozie-s-b576227a] {
  background: var(--rozie-listbox-selected-bg, transparent);
  color: var(--rozie-listbox-selected-fg, inherit);
  font-weight: var(--rozie-listbox-selected-weight, 600);
}
.rozie-listbox-option.is-selected[data-rozie-s-b576227a]::after {
  content: var(--rozie-listbox-check, '✓');
  color: var(--rozie-listbox-check-color, var(--rozie-listbox-accent, #0066cc));
}
.rozie-listbox-option.is-disabled[data-rozie-s-b576227a] { opacity: var(--rozie-listbox-disabled-opacity, 0.45); cursor: not-allowed; }
.rozie-listbox-empty[data-rozie-s-b576227a] { padding: var(--rozie-listbox-option-padding, 0.5rem 0.6rem); color: var(--rozie-listbox-empty-fg, rgba(0, 0, 0, 0.5)); }
.rozie-listbox-spacer[data-rozie-s-b576227a] { margin: 0; padding: 0; border: 0; flex: none; }
`;

  /**
   * The option set. Each entry is either a primitive (`string`/`number`) or an object; objects resolve their label, value, and disabled state via the `option*` resolver props, falling back to `.label` / `.value` / `.disabled`.
   */
  @property({ type: Array }) options: any[] = [];
  /**
   * The selected value (two-way `r-model`) — a scalar in single-select, an array of values in multi-select. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Listbox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <rozie-listbox .value=${fruit} @value-change=${…} .options=${fruits}></rozie-listbox>
   */
  @property({ type: Object, attribute: 'value' }) _value_attr: unknown = null;
  private _valueControllable = createLitControllableProperty<unknown>({ host: this, eventName: 'value-change', defaultValue: null, initialControlledValue: undefined });
  /**
   * Enable multi-select: `value` becomes an array, selecting an option toggles its membership, and the popup stays open after each commit.
   */
  @property({ type: Boolean, reflect: true }) multiple: boolean = false;
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the listbox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
   */
  @property({ type: Boolean, reflect: true }) inline: boolean = false;
  /**
   * Disable the control entirely. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Placeholder text shown in the empty control.
   */
  @property({ type: String, reflect: true }) placeholder: string = '';
  /**
   * Close the popup after a single-select commit. Defaults `true`; multi-select keeps the popup open regardless of this setting.
   */
  @property({ type: Boolean, reflect: true }) closeOnSelect: boolean = true;
  /**
   * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
   */
  @property({ type: Function }) optionLabel: ((...args: any[]) => any) | null = null;
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  @property({ type: Function }) optionValue: ((...args: any[]) => any) | null = null;
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  @property({ type: Function }) optionDisabled: ((...args: any[]) => any) | null = null;
  /**
   * Stable id base for the ARIA wiring (the listbox id, per-option ids, and `aria-activedescendant`). Give each instance on a page a distinct id so these references stay unique.
   */
  @property({ type: String, reflect: true }) id: string = 'rozie-listbox';
  /**
   * Accessible name for the control when there is no visible `<label for>` pointing at its `id` (`aria-label`).
   */
  @property({ type: String, reflect: true }) ariaLabel: string | null = null;
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling list (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed listbox. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded.
   */
  @property({ type: Boolean, reflect: true }) virtual: boolean = false;
  /**
   * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  @property({ type: Number, reflect: true }) estimateRowHeight: number = 36;
  /**
   * A CSS length string bounding the list scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-listbox-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
   */
  @property({ type: String, reflect: true }) maxHeight: string = '';
  private _open$local = signal(false);
  private _activeIndex = signal(-1);
  private _query = signal('');
  private _rows = signal<any[]>([]);
  private _windowVer = signal(0);
  private _editVer = signal(0);
  @query('[data-rozie-ref="controlEl"]') private _refControlEl!: HTMLElement;
  @query('[data-rozie-ref="triggerEl"]') private _refTriggerEl!: HTMLElement;
  @query('[data-rozie-ref="listEl"]') private _refListEl!: HTMLElement;
  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;
private __rozieWatchInitial_0 = true;

  private _rozieSlotDistributor = new RozieSlotDistributor(this);

  @state() private _hasSlotSelected = false;
  @queryAssignedElements({ slot: 'selected', flatten: true }) private _slotSelectedElements!: Element[];
  @property({ attribute: false }) selected?: (scope: { selected: any; value: any }) => unknown;
  @state() private _hasSlotOption = false;
  @queryAssignedElements({ slot: 'option', flatten: true }) private _slotOptionElements!: Element[];
  @property({ attribute: false }) option?: (scope: { option: any; index: any; active: any; selected: any; disabled: any }) => unknown;
  @state() private _hasSlotEmpty = false;
  @queryAssignedElements({ slot: 'empty', flatten: true }) private _slotEmptyElements!: Element[];
  @property({ attribute: false }) empty?: (scope: { query: any }) => unknown;
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

  private _armListeners(): void {
    const _u0 = attachOutsideClickListener([() => this._refControlEl, () => this._refListEl], ($event) => {  ((this.close) as (...args: any[]) => any)($event); }, () => (this._open$local.value));
    this._disconnectCleanups.push(_u0);

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="selected"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotSelected = this._slotSelectedElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

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
    this._hasSlotSelected = Array.from(this.children).some((el) => el.getAttribute('slot') === 'selected');
    this._hasSlotOption = Array.from(this.children).some((el) => el.getAttribute('slot') === 'option');
    this._hasSlotEmpty = Array.from(this.children).some((el) => el.getAttribute('slot') === 'empty');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => (this.options ? this.options.length : 0) + '|' + this._query.value)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.syncRows();
      if (this.virtual && this.virtualizer) {
        this.gridScrollEl = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector('.rozie-listbox-list') : this.gridScrollEl;
        this.virtualizer.setOptions(this.virtualizerOptions());
        this.virtualizer._willUpdate();
        this._windowVer.value = this._windowVer.value + 1;
        this.scheduleRemeasure();
      }
    })(); }); }));

    this.syncRows();
    if (this.virtual) {
      // The list renders at mount when virtual, so the .rozie-listbox-list scroll container
      // exists here. Capture it via $el.querySelector (the data-table gridScrollEl precedent,
      // proven ×6 incl Lit shadow + Solid) — $refs on a conditionally-rendered node is null on
      // Solid/Lit, which leaves the virtualizer with no scroll element.
      this.gridScrollEl = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector('.rozie-listbox-list') : null;
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
        if (this.typeTimer !== null) clearTimeout(this.typeTimer);
        // Tear down the virtualizer's scroll-element ResizeObserver (no-op when virtual off).
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
<div class="${Object.entries({ "rozie-listbox": true, 'rozie-listbox-open': this._open$local.value, 'rozie-listbox-disabled': this.disabled, 'rozie-listbox-inline': this.inline }).filter(([, v]) => v).map(([k]) => k).join(' ')}" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="__rozieRoot" data-rozie-s-b576227a>

  
  <div class="rozie-listbox-control" data-rozie-ref="controlEl" data-rozie-s-b576227a>
    <button class="rozie-listbox-trigger" type="button" role="combobox" aria-haspopup="listbox" aria-expanded=${this._open$local.value} aria-controls=${rozieAttr(this.id + '-list')} aria-activedescendant=${rozieAttr(this.activeDescendant)} aria-label=${rozieAttr(this.ariaLabel)} ?disabled=${this.disabled} @click=${this.toggle} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onControlKeyDown($event); }} data-rozie-ref="triggerEl" data-rozie-s-b576227a>
      ${this.selected !== undefined ? this.selected({selected: this.selectedLabel, value: this.value}) : html`<slot name="selected" data-rozie-params=${(() => { try { return JSON.stringify({selected: this.selectedLabel, value: this.value}); } catch { return '{}'; } })()}>
        ${this.selectedLabel ? html`<span class="rozie-listbox-selected" data-rozie-s-b576227a>${rozieDisplay(this.selectedLabel)}</span>` : html`<span class="rozie-listbox-placeholder" data-rozie-s-b576227a>${this.placeholder}</span>`}</slot>`}
      <span class="rozie-listbox-arrow" aria-hidden="true" data-rozie-s-b576227a>▾</span>
    </button>
  </div>

  
  ${this._open$local.value && !this.virtual ? html`<div class="rozie-listbox-list" role="listbox" id=${rozieAttr(this.id + '-list')} aria-label=${rozieAttr(this.ariaLabel)} aria-multiselectable=${this.multiple} data-rozie-ref="listEl" data-rozie-s-b576227a>
    ${repeat<any>(this.visibleOptions(), (opt, index) => this.optionId(index), (opt, index) => html`<div class="${Object.entries({ "rozie-listbox-option": true, 'is-active': this._activeIndex.value === index, 'is-selected': this.isSelected(opt), 'is-disabled': this.disabledOf(opt) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" id=${rozieAttr(this.optionId(index))} role="option" aria-selected=${!!this.isSelected(opt)} aria-disabled=${!!this.disabledOf(opt)} @click=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.select(opt); }} @mousemove=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onOptionPointerMove(index); }} data-rozie-s-b576227a>
      ${this.option !== undefined ? this.option({option: opt, index: index, active: this._activeIndex.value === index, selected: this.isSelected(opt), disabled: this.disabledOf(opt)}) : html`<slot name="option" data-rozie-params=${(() => { try { return JSON.stringify({option: opt, index: index, active: this._activeIndex.value === index, selected: this.isSelected(opt), disabled: this.disabledOf(opt)}); } catch { return '{}'; } })()}>
        ${rozieDisplay(this.labelOf(opt))}
      </slot>`}
    </div>`)}

    ${this.visibleOptions().length === 0 ? html`<div class="rozie-listbox-empty" role="presentation" data-rozie-s-b576227a>
      ${this.empty !== undefined ? this.empty({query: this._query.value}) : html`<slot name="empty" data-rozie-params=${(() => { try { return JSON.stringify({query: this._query.value}); } catch { return '{}'; } })()}>No options</slot>`}
    </div>` : nothing}</div>` : nothing}${this.virtual ? html`<div class="rozie-listbox-list rozie-listbox-list--virtual" role="listbox" id=${rozieAttr(this.id + '-list')} aria-label=${rozieAttr(this.ariaLabel)} aria-multiselectable=${this.multiple} style=${rozieStyle((this._open$local.value ? '' : 'display:none;') + (this.maxHeight ? 'height:' + this.maxHeight + ';max-height:' + this.maxHeight + ';overflow-y:auto;--rozie-listbox-max-height:' + this.maxHeight : 'overflow-y:auto'))} data-rozie-ref="listEl" data-rozie-s-b576227a>
    <div class="rozie-listbox-spacer" aria-hidden="true" style=${rozieStyle('height:' + this.padTop() + 'px')} data-rozie-s-b576227a></div>

    ${repeat<any>(this.windowedRows(), (wr, _idx) => wr.row.id, (wr, _idx) => html`<div class="${Object.entries({ "rozie-listbox-option": true, 'is-active': this._activeIndex.value === wr.vi.index, 'is-selected': this.isSelected(wr.row._opt), 'is-disabled': this.disabledOf(wr.row._opt) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" id=${rozieAttr(this.optionId(wr.vi.index))} data-index=${rozieAttr(wr.vi.index)} role="option" aria-selected=${!!this.isSelected(wr.row._opt)} aria-disabled=${!!this.disabledOf(wr.row._opt)} @click=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.select(wr.row._opt); }} @mousemove=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.onOptionPointerMove(wr.vi.index); }} data-rozie-s-b576227a>
      ${this.option !== undefined ? this.option({option: wr.row._opt, index: wr.vi.index, active: this._activeIndex.value === wr.vi.index, selected: this.isSelected(wr.row._opt), disabled: this.disabledOf(wr.row._opt)}) : html`<slot name="option" data-rozie-params=${(() => { try { return JSON.stringify({option: wr.row._opt, index: wr.vi.index, active: this._activeIndex.value === wr.vi.index, selected: this.isSelected(wr.row._opt), disabled: this.disabledOf(wr.row._opt)}); } catch { return '{}'; } })()}>
        ${rozieDisplay(this.labelOf(wr.row._opt))}
      </slot>`}
    </div>`)}

    <div class="rozie-listbox-spacer" aria-hidden="true" style=${rozieStyle('height:' + this.padBottom() + 'px')} data-rozie-s-b576227a></div>

    ${this.windowSource().length === 0 ? html`<div class="rozie-listbox-empty" role="presentation" data-rozie-s-b576227a>
      ${this.empty !== undefined ? this.empty({query: this._query.value}) : html`<slot name="empty" data-rozie-params=${(() => { try { return JSON.stringify({query: this._query.value}); } catch { return '{}'; } })()}>No options</slot>`}
    </div>` : nothing}</div>` : nothing}</div>
`;
  }

  // Type-ahead buffer for the select-only listbox trigger. Module-scope
  // `let`s reassigned from handlers → the React emitter hoists them to `useRef`
  // so they persist across renders (the setup-once guarantee); no-op elsewhere.
  // They STAY in this host (not the shared spine) per the A==B rule: reassigned
  // module-`let`s + sigils live in the host; the partial only closes over them.
  typeBuffer = '';

  typeTimer: any = null;

  // ---- shared list spine (P2: @rozie-ui/headless-core/listCore.rzts) ------
  // The option resolvers, client filter, enabled-index navigation, the keyboard
  // reducer, type-ahead, single+multi selection, open/close state, and
  // activeDescendant derivation now live in the shared, focus-/input-mode
  // parameterized list spine. It is a compile-time `.rzts` script-partial: it
  // dissolves into this leaf via inlineScriptPartials() before IR lowering (zero
  // runtime dep). Listbox consumes it in focus-model `activedescendant` +
  // input-mode `select-only` + multi + type-ahead. The spine closes over this
  // host's pieces by convention: the reassigned module-`let`s typeBuffer/typeTimer
  // (above) and the impure ref fns focusControl/scrollActiveIntoView (below).
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
  //     (Combobox — a text <input> that filters by the typed query). The mode is by HOST CONVENTION,
  //     NOT a discriminant prop (P3 retired the Listbox `combobox`/`filterable` props): a select-only
  //     host never writes `$data.query`, so `visibleOptions` is the identity path for it and the
  //     printable-char branch of the reducer feeds type-ahead; a filter-input host writes `$data.query`
  //     from its <input>, so `visibleOptions` substring-filters and `onInput` drives the query.
  //
  // ── HOST CONTRACT (symbols the consuming host MUST define before importing) ────────────────────
  //   - the reassigned module-`let`s `typeBuffer` / `typeTimer` — type-ahead scratch state. They are
  //     reassigned from handlers → the React emitter hoists them to `useRef` (the setup-once
  //     guarantee), so per the A==B playbook rule they STAY IN THE HOST; this partial only closes
  //     over them (in `onTypeahead`).
  //   - `focusControl()` / `scrollActiveIntoView()` — impure ref-reading functions (they touch the
  //     control / list ref elements, which are post-mount-only per ROZ123), so they are per-consumer
  //     HOST functions; this partial only closes over them (it reads NO refs itself).
  //   - the option set + form surface (`$props.options` / `$props.value` (model) / `$props.multiple` /
  //     `$props.id` / `$props.optionLabel` / `$props.optionValue` / `$props.optionDisabled` /
  //     `$props.closeOnSelect` / `$props.disabled`) and the reactive state (`$data.open` /
  //     `$data.activeIndex` / `$data.query`). Input-mode is by convention (the host's <input> writing
  //     `$data.query`), NOT a discriminant prop.
  // ---- option resolvers --------------------------------------------------
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

  optionId = (index: any) => this.id + '-opt-' + index;

  // ---- derived state -----------------------------------------------------
  // The visible option list: identity in select-only / non-filtering mode,
  // a case-insensitive substring filter when a combobox query is present.
  // A plain function (not `$computed`) so it reads uniformly across all six
  // targets — a `$computed` is a value on React but an accessor on Solid, so
  // aliasing it to a local (`const opts = visibleOptions()`) diverges; calling a
  // plain function is identical everywhere.
  visibleOptions = () => {
  const q = (this._query.value || '').trim().toLowerCase();
  if (q === '') return this.options;
  return this.options.filter((opt: any) => this.labelOf(opt).toLowerCase().includes(q));
};

  // The label shown in the (select-only) trigger when closed. A real `$computed`
  // — read bare in the template, never aliased in script, so the per-target
  // accessor form stays uniform.
  get selectedLabel() {
    const cur = this.value;
    if (this.multiple) {
      // Read the model value into a local before narrowing: `$props.value` lowers
      // to a `value()` accessor on Solid, and Array.isArray() can't narrow two
      // separate calls — narrowing one stable local works on every target.
      const arr = Array.isArray(cur) ? cur : [];
      if (arr.length === 0) return '';
      return this.options.filter((o: any) => arr.includes(this.valueOf$local(o))).map(this.labelOf).join(', ');
    }
    const match = this.options.find((o: any) => this.valueOf$local(o) === cur);
    return match === undefined ? '' : this.labelOf(match);
  }

  // The id of the active option, for aria-activedescendant. null when none.
  get activeDescendant() {
    if (!this._open$local.value || this._activeIndex.value < 0) return null;
    return this.optionId(this._activeIndex.value);
  }

  // Is a given option currently selected? Multi compares array membership.
  isSelected = (opt: any) => {
  const v = this.valueOf$local(opt);
  const cur = this.value;
  if (this.multiple) return Array.isArray(cur) && cur.includes(v);
  return cur === v;
};

  // First enabled visible index, preferring the currently-selected option.
  resolveInitialActive = () => {
  const opts = this.visibleOptions();
  const sel = opts.findIndex((o: any) => this.isSelected(o) && !this.disabledOf(o));
  if (sel !== -1) return sel;
  return opts.findIndex((o: any) => !this.disabledOf(o));
};

  // ---- open / close ------------------------------------------------------
  // Phase 73 item #8 (emitter-hardening batch): each of `open`/`close`/`toggle`
  // $emit's directly — no longer funneled through a single wrapper. The
  // former "route every emit through ONE wrapper fn" workaround guarded
  // against a React duplicate `const {onOpenChange}=props` per emit-site
  // (TS2451); verified against the current emitter (target-react
  // `emitScript-multiEmitDedupe.test.ts`) that the shipped ITEM-1 (Phase 46)
  // hoist-once dedupe already collapses N ESCAPING helpers sharing an emit
  // target into exactly one destructure, and a non-escaping function (e.g.
  // `open`, reachable here only via `$expose`) never destructures at all — so
  // no combination of these three functions can produce the duplicate-const
  // shape. See project_next_port_listbox / project_emitter_hardening_backlog.
  open = () => {
  if (this.disabled) return;
  if (this._open$local.value) return;
  this._open$local.value = true;
  this._activeIndex.value = this.resolveInitialActive();
  this.dispatchEvent(new CustomEvent("open-change", {
    detail: {
      open: true
    },
    bubbles: true,
    composed: true
  }));
};

  close = () => {
  if (!this._open$local.value) return;
  this._open$local.value = false;
  this._activeIndex.value = -1;
  this.dispatchEvent(new CustomEvent("open-change", {
    detail: {
      open: false
    },
    bubbles: true,
    composed: true
  }));
};

  toggle = () => {
  if (this._open$local.value) this.close();else this.open();
};

  // ---- selection ---------------------------------------------------------
  select = (opt: any) => {
  if (this.disabledOf(opt)) return;
  const v = this.valueOf$local(opt);
  if (this.multiple) {
    const cur = this.value;
    const arr = Array.isArray(cur) ? cur : [];
    // Fresh array on every commit — in-place mutation is dropped by the
    // React/Solid/Lit/Angular change detectors.
    const next = arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v];
    this._valueControllable.write(next);
    this.dispatchEvent(new CustomEvent("change", {
      detail: {
        value: next,
        option: opt
      },
      bubbles: true,
      composed: true
    }));
  } else {
    this._valueControllable.write(v);
    this.dispatchEvent(new CustomEvent("change", {
      detail: {
        value: v,
        option: opt
      },
      bubbles: true,
      composed: true
    }));
    if (this.closeOnSelect) {
      this.close();
      this.focusControl();
    }
  }
};

  clear = () => {
  const empty = this.multiple ? [] : null;
  this._valueControllable.write(empty);
  this._query.value = '';
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      value: empty,
      option: null
    },
    bubbles: true,
    composed: true
  }));
};

  // ---- keyboard navigation over the VISIBLE list -------------------------
  nextEnabled = (from: any, dir: any) => {
  const opts = this.visibleOptions();
  if (opts.length === 0) return -1;
  let i = from;
  for (let step = 0; step < opts.length; step++) {
    i += dir;
    if (i < 0) i = opts.length - 1;else if (i >= opts.length) i = 0;
    if (!this.disabledOf(opts[i])) return i;
  }
  return from;
};

  move = (dir: any) => {
  if (!this._open$local.value) {
    this.open();
    return;
  }
  const start = this._activeIndex.value < 0 ? dir > 0 ? -1 : 0 : this._activeIndex.value;
  this._activeIndex.value = this.nextEnabled(start, dir);
  this.scrollActiveIntoView();
};

  moveEdge = (toEnd: any) => {
  if (!this._open$local.value) this.open();
  this._activeIndex.value = toEnd ? this.nextEnabled(-1, -1) : this.nextEnabled(-1, 1);
  this.scrollActiveIntoView();
};

  commitActive = () => {
  const opts = this.visibleOptions();
  if (this._activeIndex.value >= 0 && this._activeIndex.value < opts.length) this.select(opts[this._activeIndex.value]);
};

  // Type-ahead for select-only listboxes: accumulate keystrokes and jump to the
  // first option whose label starts with the buffer.
  onTypeahead = (ch: any) => {
  if (this.typeTimer !== null) clearTimeout(this.typeTimer);
  this.typeBuffer += ch.toLowerCase();
  this.typeTimer = setTimeout(() => {
    this.typeBuffer = '';
  }, 600);
  const opts = this.visibleOptions();
  const idx = opts.findIndex((o: any) => !this.disabledOf(o) && this.labelOf(o).toLowerCase().startsWith(this.typeBuffer));
  if (idx !== -1) {
    if (!this._open$local.value) this.open();
    this._activeIndex.value = idx;
    this.scrollActiveIntoView();
  }
};

  // Key handler shared by the trigger and the combobox input. The printable-
  // character branch is reached only in select-only mode (the combobox input
  // types through @input).
  onControlKeyDown = ($event: any) => {
  const key = $event.key;
  if (key === 'ArrowDown') {
    $event.preventDefault();
    this.move(1);
  } else if (key === 'ArrowUp') {
    $event.preventDefault();
    this.move(-1);
  } else if (key === 'Home') {
    $event.preventDefault();
    this.moveEdge(false);
  } else if (key === 'End') {
    $event.preventDefault();
    this.moveEdge(true);
  } else if (key === 'Enter') {
    if (this._open$local.value) {
      $event.preventDefault();
      this.commitActive();
    }
  } else if (key === 'Escape') {
    if (this._open$local.value) {
      $event.preventDefault();
      this.close();
      this.focusControl();
    }
  } else if (key === ' ' || key === 'Spacebar') {
    // Space toggles / commits in a select-only host (a button trigger). A
    // filter-input host types the literal space into its <input> and does NOT
    // route Space through this reducer, so this branch is select-only by use.
    $event.preventDefault();
    if (!this._open$local.value) this.open();else this.commitActive();
  } else if (key === 'Tab') {
    if (this._open$local.value) this.close();
  } else if (key.length === 1 && !$event.metaKey && !$event.ctrlKey && !$event.altKey) {
    this.onTypeahead(key);
  }
};

  // Combobox input handler: keep the popup open while typing, reset the active
  // highlight to the first match, and surface the query for remote filtering.
  // Pointer hover sets the virtual highlight (matches native <select> feel).
  onOptionPointerMove = (index: any) => {
  if (this._activeIndex.value !== index) this._activeIndex.value = index;
};

  // ══ Generic vertical windowing math (Phase 64, D-04) — the target-agnostic virtual-core bridge ══
  // Lifted verbatim from the DataTable virtualization.rzts (the Phase 53/63 B13 baseline). This partial
  // holds ONLY the PURE windowing math; every DOM/refs/virtualizer-instance impurity stays per-consumer
  // in the host (ROZ123). It is a compile-time `.rzts` script-partial: it dissolves into each consumer's
  // compiled leaf via inlineScriptPartials() before IR lowering — leaving zero runtime dependency.
  //
  // HOST CONTRACT (symbols the consuming host MUST define before importing — the same implicit
  // by-convention mixin contract the DataTable host's other partials already use for `$data.windowVer`):
  //   - windowSource(): T[]   — the full list to window (the KEY generalization; the DataTable host
  //                             returns its pre-pagination row model, listbox/combobox return the
  //                             filtered options). This partial MUST NOT reach into the host data engine
  //                             directly — rows arrive ONLY through windowSource().
  //   - $props.estimateRowHeight — per-item size estimate (kept aliased for DataTable back-compat).
  //   - $data.windowVer / $data.editVer — window/edit-version reactivity bumps.
  //   - gridScrollEl              — the scroll-container element handle.
  //   - virtualizer               — the host virtual-core instance (built in $onMount from the ref).
  //   - observeElementRect / observeElementOffset / elementScroll / measureElement — virtual-core fns.
  //   - scheduleRemeasure()       — the host's rAF/microtask remeasure defer.
  //   - pinnedEditIndex() / pinnedMeasurement(pin) — the D-05 OPTIONAL pin-extension hook (host-provided,
  //                             defaulting to no-op): the DataTable host passes its edit-pinning hooks;
  //                             listbox passes nothing. Routing pinning through this host hook (NOT
  //                             inlining it) keeps DataTable's B13 edit-pinning behavior byte-identical.
  //   - rowsWindowed(): boolean  — is the ROW axis windowed. REQUIRED, no default — replaces every bare
  //                             truthiness read of the host's windowing prop (D-05); `windowedRows()` /
  //                             `padTop()` / `padBottom()` / `rowIsOutsideWindow()` below call it by
  //                             convention exactly as they already call `pinnedEditIndex()`.
  //   - colsWindowed(): boolean  — is the COLUMN axis windowed. REQUIRED, no default. `false` for every
  //                             host until it defines the real column-axis mechanism (87-04+).
  //   - columnCount(): number    — the leaf-column count the column virtualizer windows over. REQUIRED,
  //                             no default.
  //   - columnSize(i: number): number — the authoritative width of absolute leaf column `i`, sourced
  //                             from table-core's `getSize()` under D-06. REQUIRED, no default.
  //   - forcedColumns(): number[] — the D-10 OPTIONAL column-axis mirror of `pinnedEditIndex()`: the
  //                             DataTable host unions pinned + active-cell + editing column indices into
  //                             the column-window slice; listbox/combobox pass an empty array (host-
  //                             provided, defaulting to `[]`).
  //   - colVirtualizer           — the host's SECOND virtual-core instance, windowing the COLUMN axis
  //                             (see the AXIS MECHANISM note below). Host-provided, defaulting to `null`.
  //
  // AXIS MECHANISM (OQ1 / Assumption A1 — resolved from the installed source this session, NOT
  // implemented yet; this plan documents the contract only, the second instance lands starting 87-04):
  // `horizontal` is a PER-INSTANCE field of `VirtualizerOptions`
  // (`node_modules/@tanstack/virtual-core/dist/esm/index.d.ts:67`, installed version 3.17.1 per
  // `package.json`), and every axis-sensitive internal read consults `instance.options.horizontal` —
  // `measureElement`'s inlineSize/blockSize + offsetWidth/offsetHeight branch
  // (`dist/esm/index.js:137,150`), `observeElementOffset`'s scrollLeft/scrollTop branch
  // (`dist/esm/index.js:118-121`), `getMaxScrollOffset`'s scrollWidth/scrollHeight branch
  // (`dist/esm/index.js:907-915`), and `scrollWithAdjustments`'s left/top branch
  // (`dist/esm/index.js:152-161`). So ONE `Virtualizer` instance windows exactly ONE axis: the column
  // axis needs its own SECOND, independent `Virtualizer` instance constructed with `horizontal: true`,
  // sharing the SAME `getScrollElement()` (the `rdt-scroll` wrapper) the row instance already uses.
  // Two options the row axis does not set that the column instance will need: `isRtl?: boolean`
  // (data-table ships an RTL grid path) and `overscan?: number` (D-07 gives the column axis its own
  // hardcoded constant, separate from the row axis's `overscan: 8` below).
  // getItemKey reads the LIVE source (never a frozen mount-render $data.rows closure — the F6
  // React stale-closure lesson) so virtual-core's measurement cache keys by stable full-model row
  // id across recycling, aligned with the windowed <tr> :key="row.id" (Pitfall 3 / req-10).
  virtualItemKey = (i: any) => {
  const src = this.windowSource();
  return src && src[i] ? src[i].id : undefined;
};

  // COL_OVERSCAN (D-07): the column axis's own hardcoded overscan constant, separate from the
  // row axis's `overscan: 8` below. Columns are far wider than rows are tall, so one number
  // cannot serve both axes; no prop is exposed because no consumer has asked to tune the row
  // overscan across the four phases it has shipped. Unused until 87-04 constructs the second,
  // horizontal Virtualizer instance (see the AXIS MECHANISM note above).
  // The FULL virtualizer options. virtual-core's setOptions REPLACES options with
  // `{ ...defaults, ...opts }` (it does NOT merge with prior options — verified in the 3.17.1
  // source), so the re-feed MUST pass the complete set, exactly like every TanStack adapter.
  // Returned `any` (the currentState() precedent) so the strict bundled-leaf tsc does not choke
  // on virtual-core's generic option inference. onChange uses the `$data.x = $data.x + 1`
  // increment the React emitter lowers to functional setState — correct even from a mount closure.
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

  // pinMeasurement(pin): the D-05 pin-hook read, RE-TYPED at the windowing layer so the
  // shared math is strict-clean across every host. The host-provided pinnedMeasurement() has
  // two shapes: the DataTable host returns a real virtual-core measurement; the listbox/combobox
  // no-op host returns bare `null` (inferred `(pin) => null`). Calling it directly makes
  // `const pm = pinnedMeasurement(pin)` flow-narrow to `null`, so the downstream `pm && pm.start`
  // guard collapses the object branch to `never` (TS2339, Class 3). Reading the hook through this
  // thin wrapper with an EXPLICIT return type (a return-type annotation is NOT flow-narrowed)
  // gives the measurement a real object-or-null shape, so `pm && pm.start` keeps the object branch.
  // Typing-only: the runtime value (a measurement or null) is unchanged.
  pinMeasurement = (pin: number): {
  start: number;
  size: number;
  index: number;
  end: number;
} | null => this.pinnedMeasurement(pin);

  // windowedRows(): the rendered slice. Off / pre-mount → the full $data.rows mapped to
  // { vi:null, row } (the r-else path never calls this, but the guard keeps it total). On → read
  // $data.windowVer to SUBSCRIBE (the rowIndexOf tick discipline) then map each VirtualItem to its
  // full-model row. NB the local is `rowList` (NOT `rows` — React lowers $data.rows to a bare
  // `rows` binding → TS2448 self-shadow, line ~1149 lesson).
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
    // Rows OFF (Phase 87 D-04: this now includes the colsWindowed()-only path, since the
    // wrapper template is entered whenever isWindowed(), not just rowsWindowed() — the row
    // virtualizer is never constructed when only the column axis is windowed, D-04) → the FULL
    // set, with a SYNTHETIC `vi.index` set to each row's array position (matching rowIndexOf's
    // own `$data.rows.indexOf(row)` semantics exactly, since $data.rows IS windowSource()'s
    // output here). Every windowed body binding reads wr.vi.index (data-row, aria-rowindex,
    // colIndexOf, isEditing, the fill handle) — a bare `null` there is a hard crash the moment
    // this branch is reached with the wrapper mounted, which colsWindowed()-only now does.
    // Row-virtual ON but the virtualizer is not yet constructed (pre-$onMount first paint) →
    // render NOTHING so the template never dereferences a not-yet-real `vi`; the rows appear on
    // the first onChange after _didMount.
    if (!this.rowsWindowed()) {
      const rowList = this._rows.value || [];
      return rowList.map((r: any, i: any) => ({
        vi: {
          index: i
        },
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
      const pm = this.pinMeasurement(pin);
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

  // Spacer-<tr> heights (D-03): the leading spacer occupies items[0].start; the trailing spacer
  // the gap between the last rendered item's end and getTotalSize(). Both windowVer-gated reads
  // (the `$data.windowVer` touch re-derives them as the window/measurements change). 0 when off.
  padTop = () => {
  // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
  // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
  // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
  void this._windowVer.value;
  void this._editVer.value;
  if (!this.rowsWindowed() || !this.virtualizer) return 0;
  const items = this.virtualizer.getVirtualItems();
  let pad = items.length ? items[0].start : 0;
  // D-02 spacer subtraction: when the pinned editing row sits ABOVE the window it is rendered
  // in-flow as the slice's LEADING <tr> (its measured height is now a real <tr>), so subtract
  // that height from the leading spacer to keep padTop + Σ rendered <tr> + padBottom = total.
  const pin = this.pinnedEditIndex();
  if (pin >= 0) {
    const pm = this.pinMeasurement(pin);
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
  if (!this.rowsWindowed() || !this.virtualizer) return 0;
  const items = this.virtualizer.getVirtualItems();
  if (!items.length) return 0;
  let pad = this.virtualizer.getTotalSize() - items[items.length - 1].end;
  // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
  // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
  const pin = this.pinnedEditIndex();
  if (pin >= 0) {
    const pm = this.pinMeasurement(pin);
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

  // pmIndexInWindow: is full-model index `idx` present in the rendered virtual window?
  pmIndexInWindow = (items: any, idx: any) => {
  for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
  return false;
};

  // rowIsOutsideWindow(r): is the full-model row index r absent from the currently rendered
  // window? Used by the scroll-then-focus seam (req-5 — scroll a far row in before focusing).
  rowIsOutsideWindow = (r: any) => {
  if (!this.rowsWindowed() || !this.virtualizer) return false;
  const items = this.virtualizer.getVirtualItems();
  for (const it of items as any) if (it.index === r) return false;
  return true;
};

  virtualizer: any = null;

  virtualizerCleanup: any = null;

  gridScrollEl: any = null;

  remeasurePending = false;

  // D-05/D-10/D-18 host-contract COLUMN-axis instance state (Phase 87 87-02) — INERT: Listbox has
  // no column axis (colsWindowed() below is constantly false), so this is never constructed. Exists
  // only so the windowing.rzts host contract's `colVirtualizer` symbol resolves, mirroring `let
  // virtualizer = null` above.
  colVirtualizer: any = null;

  // windowSource(): the windowing.rzts host-contract row source — the FILTERED option
  // set. CR-02: the shared windowing contract requires each row to carry a STABLE `.id`
  // (windowing.rzts virtualItemKey reads src[i].id, and the windowed template keys on
  // wr.row.id). A raw Listbox option is a primitive or a bare { label, value, disabled }
  // — NOT guaranteed to have `.id` — so an unwrapped raw set keyed on wr.row.id collapses
  // every framework :key (and every virtual-core measurement key) to `undefined`, which
  // recycles the wrong DOM node as the window scrolls. Wrap each option into an id-bearing
  // row the way the sibling Combobox's filteredOptions() does — `id` is the resolved
  // value, `_opt` the original option (read via wr.row._opt in the windowed template),
  // `_i` the source index. Kept === $data.rows so the math's rowList[vi.index] resolves to
  // the same wrapped row the count windows over.
  //
  // $memo, keyed on the TRUE inputs — NOT on visibleOptions() itself, which returns a
  // FRESH filtered array whenever a query is active (a visibleOptions()-keyed cache
  // would never hit while filtering). The key covers everything the map reads:
  // options ref + query (visibleOptions' inputs) and the optionValue/optionLabel
  // resolvers (valueOf in the map body; labelOf inside visibleOptions' filter path).
  // Same reference-stability contract the sibling Combobox's filteredOptions carries —
  // virtual-core's getItemKey/getMeasurements walk this O(count) per pass, so an
  // unmemoized per-call re-map made every scroll tick O(N²) in wrapper allocations.
  windowSourceCache = {
  keys: null as any[] | null,
  val: null as any
};

  windowSource = () => {
  const __rozieMemoKey = [this.options, this._query.value, this.optionValue, this.optionLabel];
  const __rozieMemoPrev = this.windowSourceCache.keys;
  if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
    return this.windowSourceCache.val;
  }
  const __rozieMemoVal = this.visibleOptions().map((o: any, i: any) => ({
    id: this.valueOf$local(o),
    _opt: o,
    _i: i
  }));
  this.windowSourceCache.keys = __rozieMemoKey;
  this.windowSourceCache.val = __rozieMemoVal;
  return __rozieMemoVal;
};

  // D-05 NO-OP PIN HOOK (defined in THIS host, NOT the shared partial — keeps data-table
  // A==B intact). The shared windowedRows/padTop/padBottom call pinnedEditIndex()/
  // pinnedMeasurement() UNGUARDED by convention; a listbox has no edit-pinning, so these
  // reduce the pin union (-1 → never unioned) and the spacer subtraction (null → identity)
  // to a no-op. They MUST exist or the by-convention call ReferenceErrors at mount.
  pinnedEditIndex = () => -1;

  pinnedMeasurement = (pin: any) => null;

  // D-05/D-10/D-18 windowing.rzts host-contract one-liners (Phase 87 87-02). rowsWindowed()
  // preserves today's EXACT truthiness (byte-behavior-identical) — it is the new REQUIRED symbol
  // windowing.rzts now calls in place of a bare `$props.virtual` read. The column-axis symbols are
  // INERT no-ops: Listbox never lights the column branch (D-20). NOT type-annotated — this
  // `<script>` block has no `lang="ts"` (unlike windowing.rzts / Combobox.rozie), so the
  // pinMeasurement() explicit-return-type trick (windowing.rzts:65-74) does not apply here; nothing
  // in this plan calls these through a type-narrowing wrapper.
  rowsWindowed = () => !!this.virtual;

  colsWindowed = () => false;

  columnCount = () => 0;

  columnSize = (i: any) => 0;

  forcedColumns = () => [];

  // Keep $data.rows === windowSource() so the windowing math indexes the live option set.
  syncRows = () => {
  this._rows.value = this.windowSource();
};

  // Defer remeasureWindow() until AFTER the framework commits the recycled window
  // (onChange fires BEFORE React/Solid commit). TWO deferred passes (microtask THEN rAF)
  // behind one in-flight flag (the data-table virtualization.rzts:46-56 pattern, copied
  // per-consumer per D-04/D-09): the microtask catches Solid's <For> / Svelte's {#each}
  // SYNCHRONOUS commit (the Phase 63 Solid under-convergence hazard — D-09 rAF-defer
  // budget), the rAF catches React's async commit. measureElement is idempotent on an
  // already-observed node, so running both is cheap and loop-free.
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

  // measureElement sweep: hand every rendered windowed option to the virtualizer so its
  // true (variable) height is observed (virtual-core measures ONLY nodes passed to
  // measureElement, keyed by the data-index attribute). Bails during a programmatic
  // scroll (scrollToIndex) so a measure can't starve the scroll target.
  remeasureWindow = () => {
  if (!this.virtualizer || !this.gridScrollEl) return;
  if (this.virtualizer.scrollState) return;
  const els = this.gridScrollEl.querySelectorAll('.rozie-listbox-option[data-index]');
  for (const el of els as any) this.virtualizer.measureElement(el);
};

  // ---- focus / scroll helpers (post-mount $refs only) --------------------
  // Impure ($refs) → per the ROZ123 + A==B rules they stay in the host (the spine
  // only closes over them). Named `focusControl` (not `focus`): a `focus` $expose
  // verb would override the inherited HTMLElement.focus method on the Lit element.
  focusControl = () => {
  this._refTriggerEl?.focus();
};

  // Keep the active option visible inside the scrolling listbox. Reads $refs in
  // a post-mount callback only (never eagerly — ROZ123). When windowing, route through
  // the virtualizer (scrollToIndex) so an active option OUTSIDE the rendered window is
  // scrolled into view (the windowed-arrow-nav seam); else the native scrollIntoView.
  scrollActiveIntoView = () => {
  if (this._activeIndex.value < 0) return;
  if (this.virtual && this.virtualizer) {
    // 'center' (not 'auto'): keep the active option well inside the rendered slice as the
    // window scrolls — 'auto' lands it at the viewport edge where the overscan band can
    // leave it just-unrendered for a frame on the fine-grained targets (Solid).
    this.virtualizer.scrollToIndex(this._activeIndex.value, {
      align: 'center'
    });
    this.scheduleRemeasure();
    return;
  }
  if (!this._refListEl) return;
  const el = this._refListEl.querySelector('#' + CSS.escape(this.optionId(this._activeIndex.value)));
  el?.scrollIntoView({
    block: 'nearest'
  });
};

  // ---- windowing lifecycle (post-mount; ONLY when virtual) ----------------
  // kickWindow: the cross-target first-paint settle. Re-captures the LIVE scroll element,
  // re-feeds the CURRENT option count into the virtualizer, re-attaches its rect observer
  // (_willUpdate), and bumps the windowVer signal so the windowed <For>/{#each}/repeat
  // re-derives. Retried over a few frames because (a) virtual-core measures the scroll rect
  // asynchronously (D-09 Solid rAF-defer — a synchronous kick sees rectH 0 → empty window),
  // (b) Solid/Lit recreate the list node between mount and first commit (leaving virtual-core's
  // scrollElement stale), and (c) the consumer often seeds options AFTER the listbox mounts
  // (Lit/React), so the count must be re-read once the prop propagates. Stops once the window
  // paints (or attempts run out) — idempotent + loop-free.
  kickWindow = (attempts: any) => {
  if (!this.virtualizer) return;
  this.gridScrollEl = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector('.rozie-listbox-list') : this.gridScrollEl;
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
   *
   * command-palette-per-level-virtual / portal-through-portal cluster —
   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping
   * attribute, never a consumer prop) so a parent-assigned `ref=` on this
   * component's own host tag can never clobber this component's OWN
   * internal `data-rozie-ref` ref markers via fallthrough re-application.
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['data-rozie-ref', 'options', 'value', 'multiple', 'inline', 'disabled', 'placeholder', 'close-on-select', 'closeonselect', 'option-label', 'optionlabel', 'option-value', 'optionvalue', 'option-disabled', 'optiondisabled', 'id', 'aria-label', 'arialabel', 'virtual', 'estimate-row-height', 'estimaterowheight', 'max-height', 'maxheight']);
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
