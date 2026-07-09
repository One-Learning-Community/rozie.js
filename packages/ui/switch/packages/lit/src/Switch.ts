import { LitElement, css, html } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

interface RozieDefaultSlotCtx {
  checked: unknown;
  toggle: unknown;
}

@customElement('rozie-switch')
export default class Switch extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-switch[data-rozie-s-5a76e232] {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  cursor: pointer;
  font: inherit;
  -webkit-tap-highlight-color: transparent;
}
.rozie-switch[data-rozie-s-5a76e232]:focus-visible {
  outline: var(--rozie-switch-focus-ring-width, 2px) solid var(--rozie-switch-focus-ring-color, rgba(0, 102, 204, 0.5));
  outline-offset: var(--rozie-switch-focus-ring-offset, 2px);
  border-radius: var(--rozie-switch-radius, 999px);
}
.rozie-switch--disabled[data-rozie-s-5a76e232] {
  cursor: not-allowed;
  opacity: var(--rozie-switch-disabled-opacity, 0.55);
}
.rozie-switch-track[data-rozie-s-5a76e232] {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  width: var(--rozie-switch-width, 2.75rem);
  height: var(--rozie-switch-height, 1.5rem);
  padding: var(--rozie-switch-track-padding, 0.125rem);
  background: var(--rozie-switch-off-bg, rgba(0, 0, 0, 0.25));
  border-radius: var(--rozie-switch-radius, 999px);
  transition: background-color 0.18s ease;
}
.rozie-switch--checked[data-rozie-s-5a76e232] .rozie-switch-track[data-rozie-s-5a76e232] {
  background: var(--rozie-switch-on-bg, #0066cc);
}
.rozie-switch-thumb[data-rozie-s-5a76e232] {
  box-sizing: border-box;
  width: var(--rozie-switch-thumb-size, 1.25rem);
  height: var(--rozie-switch-thumb-size, 1.25rem);
  background: var(--rozie-switch-thumb-bg, #fff);
  border-radius: 50%;
  box-shadow: var(--rozie-switch-thumb-shadow, 0 1px 2px rgba(0, 0, 0, 0.3));
  transition: transform 0.18s ease;
  transform: translateX(0);
}
.rozie-switch--checked[data-rozie-s-5a76e232] .rozie-switch-thumb[data-rozie-s-5a76e232] {
  transform: translateX(var(--rozie-switch-thumb-travel, calc(2.75rem - 1.5rem)));
}
`;

  /**
   * The on/off state of the switch (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a switch **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `true` is the checked/on state; reflected as `aria-checked`.
   * @example
   * <Switch r-model:modelValue="on" ariaLabel="Wi-Fi" />
   */
  @property({ type: Boolean, attribute: 'model-value' }) _modelValue_attr: boolean = false;
  private _modelValueControllable = createLitControllableProperty<boolean>({ host: this, eventName: 'model-value-change', defaultValue: false, initialControlledValue: undefined });
  /**
   * Disable the control entirely — it becomes non-focusable (`tabindex` is dropped), non-toggleable (click and keyboard are ignored), and `aria-disabled` is set. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Make the switch read-only — its state is shown and the control stays focusable, but the user cannot toggle it (click and keyboard are ignored). Reflected as `aria-readonly`.
   */
  @property({ type: Boolean, reflect: true }) readonly: boolean = false;
  /**
   * Accessible name applied to the `role="switch"` control (`aria-label`). Provide this (or an external `<label>`) so the switch is announced.
   */
  @property({ type: String, reflect: true }) ariaLabel: string | null = null;
  @query('[data-rozie-ref="control"]') private _refControl!: HTMLElement;

  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @property({ attribute: false }) __rozieDefaultSlot__?: (scope: { checked: unknown; toggle: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
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
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
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
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'model-value') this._modelValueControllable.notifyAttributeChange(value !== null);
  }

  render() {
    return html`
<button class="${Object.entries({ "rozie-switch": true, 'rozie-switch--checked': this.isChecked(), 'rozie-switch--disabled': this.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" role="switch" tabindex=${rozieAttr(this.controlTabindex())} ?disabled=${!!this.disabled} aria-checked=${!!this.modelValue} aria-disabled=${!!this.disabled} aria-readonly=${!!this.readonly} aria-label=${this.ariaLabel} ${rozieSpread(this.$attrs)} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onClick(); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onKeydown($event); }} ${rozieListeners(this.$listeners)} data-rozie-ref="control" data-rozie-s-5a76e232>
  ${this.__rozieDefaultSlot__ !== undefined ? this.__rozieDefaultSlot__({checked: this.isChecked(), toggle: this.toggle}) : html`<slot data-rozie-params=${(() => { try { return JSON.stringify({checked: this.isChecked()}); } catch { return '{}'; } })()} @rozie-default-toggle=${($event: CustomEvent) => ((this.toggle) as (...args: any[]) => any)($event.detail)}>
    <span class="rozie-switch-track" data-rozie-s-5a76e232>
      <span class="rozie-switch-thumb" data-rozie-s-5a76e232></span>
    </span>
  </slot>`}
</button>
`;
  }

  isChecked = () => this.modelValue === true;

  commitValue = (next: any) => {
  const v = next === true;
  this._modelValueControllable.write(v);
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      checked: v
    },
    bubbles: true,
    composed: true
  }));
};

  toggle = () => {
  if (this.disabled || this.readonly) return;
  this.commitValue(!this.isChecked());
};

  onClick = () => {
  this.toggle();
};

  onKeydown = (e: any) => {
  if (this.disabled || this.readonly) return;
  const key = e ? e.key : '';
  if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
    if (e) e.preventDefault();
    this.toggle();
  }
};

  controlTabindex = () => this.disabled ? null : 0;

  focus = () => {
  const el = this._refControl;
  if (el && el.focus) el.focus();
};

  get modelValue(): boolean { return this._modelValueControllable.read(); }
  set modelValue(v: boolean) { this._modelValueControllable.notifyPropertyWrite(v); }

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
    const __skip = new Set<string>(['model-value', 'modelvalue', 'disabled', 'readonly', 'aria-label', 'arialabel']);
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
