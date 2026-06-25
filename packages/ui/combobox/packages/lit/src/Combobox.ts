import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

interface RozieOptionSlotCtx {
  option: unknown;
  active: unknown;
  selected: unknown;
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
  private _query = signal('');
  private _isOpen = signal(false);
  private _activeIndex = signal(-1);
  @query('[data-rozie-ref="inputEl"]') private _refInputEl!: HTMLElement;
private __rozieWatchInitial_0 = true;

  @state() private _hasSlotOption = false;
  @queryAssignedElements({ slot: 'option', flatten: true }) private _slotOptionElements!: Element[];
  @property({ attribute: false }) option?: (scope: { option: unknown; active: unknown; selected: unknown }) => unknown;

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
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotOption = Array.from(this.children).some((el) => el.getAttribute('slot') === 'option');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.value)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.syncQueryToValue();
    })(); }); }));

    this.syncQueryToValue();
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
    if (name === 'value') this._valueControllable.notifyAttributeChange(value as unknown as unknown);
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-combobox": true, 'rozie-combobox--open': this._isOpen.value, 'rozie-combobox--disabled': this.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-9546115a>
  <input class="rozie-combobox-input" type="text" role="combobox" aria-autocomplete="list" aria-expanded=${!!this._isOpen.value} aria-controls=${rozieAttr(this.listId())} aria-activedescendant=${rozieAttr(this.activeId())} aria-label=${this.ariaLabel} .value=${this._query.value} placeholder=${this.placeholder} ?disabled=${!!this.disabled} autocomplete="off" @input=${($event: Event) => { this.onInput($event); }} @focus=${($event: Event) => { this.onFocus($event); }} @blur=${($event: Event) => { this.onBlur(); }} @keydown=${($event: Event) => { this.onKeydown($event); }} data-rozie-ref="inputEl" data-rozie-s-9546115a />

  ${this._isOpen.value && this.filteredOptions().length > 0 ? html`<ul class="rozie-combobox-list" id=${rozieAttr(this.listId())} role="listbox" data-rozie-s-9546115a>
    ${repeat<any>(this.filteredOptions(), (opt, _idx) => opt.value, (opt, _idx) => html`<li class="${Object.entries({ "rozie-combobox-option": true, 'rozie-combobox-option--active': opt._i === this._activeIndex.value, 'rozie-combobox-option--selected': opt.value === this.value, 'rozie-combobox-option--disabled': opt.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(opt.value)} id=${rozieAttr(this.optId(opt._i))} role="option" aria-selected=${opt.value === this.value} aria-disabled=${!!opt.disabled} @mousedown=${($event: MouseEvent) => { $event.preventDefault(); this.selectOption(opt); }} @mouseenter=${($event: Event) => { this._activeIndex.value = opt._i; }} data-rozie-s-9546115a>
      ${this.option !== undefined ? this.option({option: opt, active: opt._i === this._activeIndex.value, selected: opt.value === this.value}) : html`<slot name="option" data-rozie-params=${(() => { try { return JSON.stringify({option: opt, active: opt._i === this._activeIndex.value, selected: opt.value === this.value}); } catch { return '{}'; } })()}>${rozieDisplay(opt.label)}</slot>`}
    </li>`)}
  </ul>` : nothing}</div>
`;
  }

  filteredOptions = () => {
  const opts = Array.isArray(this.options) ? this.options : [];
  let list = opts;
  if (!this.disableFilter) {
    const q = this._query.value.toLowerCase();
    if (q) list = opts.filter((o: any) => String(o.label).toLowerCase().indexOf(q) !== -1);
  }
  return list.map((o: any, i: any) => ({
    value: o.value,
    label: o.label,
    disabled: !!o.disabled,
    _i: i
  }));
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
  this._isOpen.value = false;
  this._activeIndex.value = -1;
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      value: opt.value
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
    const __skip = new Set<string>(['value', 'options', 'placeholder', 'disabled', 'disable-filter', 'disablefilter', 'aria-label', 'arialabel', 'id-base', 'idbase']);
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
