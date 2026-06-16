import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { attachOutsideClickListener, createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

interface RozieSelectedSlotCtx {
  selected: unknown;
  value: unknown;
}

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

@customElement('rozie-listbox')
export default class Listbox extends SignalWatcher(LitElement) {
  static styles = css`
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
`;

  @property({ type: Array }) options: any[] = [];
  @property({ type: Object, attribute: 'value' }) _value_attr: unknown = null;
  private _valueControllable = createLitControllableProperty<unknown>({ host: this, eventName: 'value-change', defaultValue: null, initialControlledValue: undefined });
  @property({ type: Boolean, reflect: true }) multiple: boolean = false;
  @property({ type: Boolean, reflect: true }) combobox: boolean = false;
  @property({ type: Boolean, reflect: true }) filterable: boolean = true;
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  @property({ type: String, reflect: true }) placeholder: string = '';
  @property({ type: Boolean, reflect: true }) closeOnSelect: boolean = true;
  @property({ type: Function }) optionLabel: ((...args: unknown[]) => unknown) | null = null;
  @property({ type: Function }) optionValue: ((...args: unknown[]) => unknown) | null = null;
  @property({ type: Function }) optionDisabled: ((...args: unknown[]) => unknown) | null = null;
  @property({ type: String, reflect: true }) id: string = 'rozie-listbox';
  @property({ type: String, reflect: true }) ariaLabel: string = null;
  private _expanded = signal(false);
  private _activeIndex = signal(-1);
  private _query = signal('');
  @query('[data-rozie-ref="controlEl"]') private _refControlEl!: HTMLElement;
  @query('[data-rozie-ref="inputEl"]') private _refInputEl!: HTMLElement;
  @query('[data-rozie-ref="triggerEl"]') private _refTriggerEl!: HTMLElement;
  @query('[data-rozie-ref="listEl"]') private _refListEl!: HTMLElement;

  @state() private _hasSlotSelected = false;
  @queryAssignedElements({ slot: 'selected', flatten: true }) private _slotSelectedElements!: Element[];
  @property({ attribute: false }) selected?: (scope: { selected: unknown; value: unknown }) => unknown;
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
    const _u0 = attachOutsideClickListener([() => this._refControlEl, () => this._refListEl], ($event) => {  ((this.close) as (...args: any[]) => any)($event); }, () => (this._expanded.value));
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
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      () => {
        if (this.typeTimer !== null) clearTimeout(this.typeTimer);
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
<div class="${Object.entries({ "rozie-listbox": true, 'rozie-listbox-open': this._expanded.value, 'rozie-listbox-disabled': this.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-b576227a>

  
  <div class="rozie-listbox-control" data-rozie-ref="controlEl" data-rozie-s-b576227a>
    ${this.combobox ? html`<input class="rozie-listbox-input" type="text" role="combobox" autocomplete="off" aria-autocomplete="list" aria-expanded=${this._expanded.value} aria-controls=${rozieAttr(this.id + '-list')} aria-activedescendant=${rozieAttr(this.activeDescendant)} aria-label=${this.ariaLabel} ?disabled=${this.disabled} placeholder=${this.placeholder} .value=${this._query.value} @input=${($event: Event) => { this.onInput($event); }} @keydown=${($event: Event) => { this.onControlKeyDown($event); }} @focus=${this.open} data-rozie-ref="inputEl" data-rozie-s-b576227a />` : html`<button class="rozie-listbox-trigger" type="button" role="combobox" aria-haspopup="listbox" aria-expanded=${this._expanded.value} aria-controls=${rozieAttr(this.id + '-list')} aria-activedescendant=${rozieAttr(this.activeDescendant)} aria-label=${this.ariaLabel} ?disabled=${this.disabled} @click=${this.toggle} @keydown=${($event: Event) => { this.onControlKeyDown($event); }} data-rozie-ref="triggerEl" data-rozie-s-b576227a>
      ${this.selected !== undefined ? this.selected({selected: this.selectedLabel, value: this.value}) : html`<slot name="selected" data-rozie-params=${(() => { try { return JSON.stringify({selected: this.selectedLabel, value: this.value}); } catch { return '{}'; } })()}>
        ${this.selectedLabel ? html`<span class="rozie-listbox-selected" data-rozie-s-b576227a>${rozieDisplay(this.selectedLabel)}</span>` : html`<span class="rozie-listbox-placeholder" data-rozie-s-b576227a>${this.placeholder}</span>`}</slot>`}
      <span class="rozie-listbox-arrow" aria-hidden="true" data-rozie-s-b576227a>▾</span>
    </button>`}</div>

  
  ${this._expanded.value ? html`<div class="rozie-listbox-list" role="listbox" id=${rozieAttr(this.id + '-list')} aria-label=${this.ariaLabel} aria-multiselectable=${this.multiple} data-rozie-ref="listEl" data-rozie-s-b576227a>
    ${repeat<any>(this.visibleOptions(), (opt, index) => this.optionId(index), (opt, index) => html`<div class="${Object.entries({ "rozie-listbox-option": true, 'is-active': this._activeIndex.value === index, 'is-selected': this.isSelected(opt), 'is-disabled': this.disabledOf(opt) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(this.optionId(index))} id=${rozieAttr(this.optionId(index))} role="option" aria-selected=${!!this.isSelected(opt)} aria-disabled=${!!this.disabledOf(opt)} @click=${($event: Event) => { this.select(opt); }} @mousemove=${($event: Event) => { this.onOptionPointerMove(index); }} data-rozie-s-b576227a>
      ${this.option !== undefined ? this.option({option: opt, index: index, active: this._activeIndex.value === index, selected: this.isSelected(opt), disabled: this.disabledOf(opt)}) : html`<slot name="option" data-rozie-params=${(() => { try { return JSON.stringify({option: opt, index: index, active: this._activeIndex.value === index, selected: this.isSelected(opt), disabled: this.disabledOf(opt)}); } catch { return '{}'; } })()}>
        ${rozieDisplay(this.labelOf(opt))}
      </slot>`}
    </div>`)}

    ${this.visibleOptions().length === 0 ? html`<div class="rozie-listbox-empty" role="presentation" data-rozie-s-b576227a>
      ${this.empty !== undefined ? this.empty({query: this._query.value}) : html`<slot name="empty" data-rozie-params=${(() => { try { return JSON.stringify({query: this._query.value}); } catch { return '{}'; } })()}>No options</slot>`}
    </div>` : nothing}</div>` : nothing}</div>
`;
  }

  typeBuffer = '';

  typeTimer: any = null;

  labelOf = (opt: any) => {
  if (this.optionLabel !== null) return this.optionLabel(opt);
  if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
  return String(opt);
};

  readValue = (opt: any) => {
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

  visibleOptions = () => {
  if (!this.combobox || !this.filterable) return this.options;
  const q = this._query.value.trim().toLowerCase();
  if (q === '') return this.options;
  return this.options.filter((opt: any) => this.labelOf(opt).toLowerCase().includes(q));
};

  get selectedLabel() {
    const cur = this.value;
    if (this.multiple) {
      // Read the model value into a local before narrowing: `$props.value` lowers
      // to a `value()` accessor on Solid, and Array.isArray() can't narrow two
      // separate calls — narrowing one stable local works on every target.
      const arr = Array.isArray(cur) ? cur : [];
      if (arr.length === 0) return '';
      return this.options.filter((o: any) => arr.includes(this.readValue(o))).map(this.labelOf).join(', ');
    }
    const match = this.options.find((o: any) => this.readValue(o) === cur);
    return match === undefined ? '' : this.labelOf(match);
  }

  get activeDescendant() {
    if (!this._expanded.value || this._activeIndex.value < 0) return null;
    return this.optionId(this._activeIndex.value);
  }

  isSelected = (opt: any) => {
  const v = this.readValue(opt);
  const cur = this.value;
  if (this.multiple) return Array.isArray(cur) && cur.includes(v);
  return cur === v;
};

  resolveInitialActive = () => {
  const opts = this.visibleOptions();
  const sel = opts.findIndex((o: any) => this.isSelected(o) && !this.disabledOf(o));
  if (sel !== -1) return sel;
  return opts.findIndex((o: any) => !this.disabledOf(o));
};

  focusControl = () => {
  if (this.combobox) this._refInputEl?.focus();else this._refTriggerEl?.focus();
};

  scrollActiveIntoView = () => {
  if (!this._refListEl || this._activeIndex.value < 0) return;
  const el = this._refListEl.querySelector('#' + CSS.escape(this.optionId(this._activeIndex.value)));
  el?.scrollIntoView({
    block: 'nearest'
  });
};

  applyExpanded = (next: any) => {
  if (next && this.disabled) return;
  if (this._expanded.value === next) return;
  this._expanded.value = next;
  this._activeIndex.value = next ? this.resolveInitialActive() : -1;
  this.dispatchEvent(new CustomEvent("open-change", {
    detail: {
      open: next
    },
    bubbles: true,
    composed: true
  }));
};

  open = () => this.applyExpanded(true);

  close = () => this.applyExpanded(false);

  toggle = () => this.applyExpanded(!this._expanded.value);

  fireChange = (value: any, option: any) => this.dispatchEvent(new CustomEvent("change", {
  detail: {
    value,
    option
  },
  bubbles: true,
  composed: true
}));

  select = (opt: any) => {
  if (this.disabledOf(opt)) return;
  const v = this.readValue(opt);
  if (this.multiple) {
    const cur = this.value;
    const arr = Array.isArray(cur) ? cur : [];
    // Fresh array on every commit — in-place mutation is dropped by the
    // React/Solid/Lit/Angular change detectors.
    const next = arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v];
    this._valueControllable.write(next);
    this.fireChange(next, opt);
  } else {
    this._valueControllable.write(v);
    this.fireChange(v, opt);
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
  this.fireChange(empty, null);
};

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
  if (!this._expanded.value) {
    this.open();
    return;
  }
  const start = this._activeIndex.value < 0 ? dir > 0 ? -1 : 0 : this._activeIndex.value;
  this._activeIndex.value = this.nextEnabled(start, dir);
  this.scrollActiveIntoView();
};

  moveEdge = (toEnd: any) => {
  if (!this._expanded.value) this.open();
  this._activeIndex.value = toEnd ? this.nextEnabled(-1, -1) : this.nextEnabled(-1, 1);
  this.scrollActiveIntoView();
};

  commitActive = () => {
  const opts = this.visibleOptions();
  if (this._activeIndex.value >= 0 && this._activeIndex.value < opts.length) this.select(opts[this._activeIndex.value]);
};

  onTypeahead = (ch: any) => {
  if (this.typeTimer !== null) clearTimeout(this.typeTimer);
  this.typeBuffer += ch.toLowerCase();
  this.typeTimer = setTimeout(() => {
    this.typeBuffer = '';
  }, 600);
  const opts = this.visibleOptions();
  const idx = opts.findIndex((o: any) => !this.disabledOf(o) && this.labelOf(o).toLowerCase().startsWith(this.typeBuffer));
  if (idx !== -1) {
    if (!this._expanded.value) this.open();
    this._activeIndex.value = idx;
    this.scrollActiveIntoView();
  }
};

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
    if (this._expanded.value) {
      $event.preventDefault();
      this.commitActive();
    }
  } else if (key === 'Escape') {
    if (this._expanded.value) {
      $event.preventDefault();
      this.close();
      this.focusControl();
    }
  } else if (key === ' ' || key === 'Spacebar') {
    // Space toggles / commits in select-only mode; a combobox input needs the
    // literal space, so do nothing there.
    if (!this.combobox) {
      $event.preventDefault();
      if (!this._expanded.value) this.open();else this.commitActive();
    }
  } else if (key === 'Tab') {
    if (this._expanded.value) this.close();
  } else if (!this.combobox && key.length === 1 && !$event.metaKey && !$event.ctrlKey && !$event.altKey) {
    this.onTypeahead(key);
  }
};

  fireSearch = (query: any) => this.dispatchEvent(new CustomEvent("search", {
  detail: {
    query
  },
  bubbles: true,
  composed: true
}));

  onInput = ($event: any) => {
  this._query.value = $event.target.value;
  if (!this._expanded.value) this.open();
  this._activeIndex.value = this.nextEnabled(-1, 1);
  this.fireSearch(this._query.value);
};

  onOptionPointerMove = (index: any) => {
  if (this._activeIndex.value !== index) this._activeIndex.value = index;
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
    const __skip = new Set<string>(['options', 'value', 'multiple', 'combobox', 'filterable', 'disabled', 'placeholder', 'close-on-select', 'closeonselect', 'option-label', 'optionlabel', 'option-value', 'optionvalue', 'option-disabled', 'optiondisabled', 'id', 'aria-label', 'arialabel']);
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
