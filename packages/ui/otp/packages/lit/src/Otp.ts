import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-otp')
export default class Otp extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-otp[data-rozie-s-8267d52a] {
  display: inline-flex;
  gap: var(--rozie-otp-gap, 0.5rem);
  font: var(--rozie-otp-font, inherit);
}
.rozie-otp-cell[data-rozie-s-8267d52a] {
  box-sizing: border-box;
  width: var(--rozie-otp-cell-size, 2.75rem);
  height: var(--rozie-otp-cell-size, 2.75rem);
  padding: 0;
  text-align: center;
  font-size: var(--rozie-otp-font-size, 1.25rem);
  font-weight: var(--rozie-otp-font-weight, 600);
  color: var(--rozie-otp-color, inherit);
  background: var(--rozie-otp-bg, #fff);
  border: var(--rozie-otp-border-width, 1px) solid var(--rozie-otp-border-color, rgba(0, 0, 0, 0.25));
  border-radius: var(--rozie-otp-radius, 0.5rem);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  caret-color: var(--rozie-otp-accent, #0066cc);
}
.rozie-otp-cell[data-rozie-s-8267d52a]::placeholder {
  color: var(--rozie-otp-placeholder-color, rgba(0, 0, 0, 0.3));
}
.rozie-otp-cell[data-filled='true'][data-rozie-s-8267d52a] {
  border-color: var(--rozie-otp-filled-border-color, var(--rozie-otp-accent, #0066cc));
}
.rozie-otp-cell[data-rozie-s-8267d52a]:focus {
  border-color: var(--rozie-otp-accent, #0066cc);
  box-shadow: 0 0 0 var(--rozie-otp-focus-ring-width, 3px) var(--rozie-otp-focus-ring-color, rgba(0, 102, 204, 0.25));
}
.rozie-otp--disabled[data-rozie-s-8267d52a] .rozie-otp-cell[data-rozie-s-8267d52a] {
  cursor: not-allowed;
  opacity: var(--rozie-otp-disabled-opacity, 0.55);
  background: var(--rozie-otp-disabled-bg, rgba(0, 0, 0, 0.04));
}
`;

  /**
   * The assembled one-time code (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so an Otp **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Always a contiguous string of `0..length` characters; Otp writes the new code back on every edit (type, paste, backspace).
   * @example
   * <Otp r-model:value="code" :length="6" type="numeric" ariaLabel="Verification code" />
   */
  @property({ type: String, attribute: 'value' }) _value_attr: string = '';
  private _valueControllable = createLitControllableProperty<string>({ host: this, eventName: 'value-change', defaultValue: '', initialControlledValue: undefined });
  /**
   * Number of input cells to render.
   */
  @property({ type: Number, reflect: true }) length: number = 6;
  /**
   * Allowed-character class plus the mobile keyboard hint: `'numeric'` permits digits only and sets `inputmode="numeric"`; `'alphanumeric'` permits `[A-Za-z0-9]` with `inputmode="text"`; `'text'` permits any non-space character with `inputmode="text"`. Characters that fail the test are rejected on type and filtered on paste.
   */
  @property({ type: String, reflect: true }) type: string = 'numeric';
  /**
   * Render the cells as masked dots (`type="password"`) for sensitive codes, while keeping the same keyboard and ARIA behavior.
   */
  @property({ type: Boolean, reflect: true }) mask: boolean = false;
  /**
   * Focus the first empty cell on mount.
   */
  @property({ type: Boolean, reflect: true }) autoFocus: boolean = false;
  /**
   * Disable every cell. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Per-cell placeholder character shown in empty cells (e.g. `'•'` or `'0'`).
   */
  @property({ type: String, reflect: true }) placeholder: string = '';
  /**
   * Accessible name for the whole group (`role="group"`, applied as `aria-label`). Each cell additionally gets an ordinal `aria-label` (`"Digit 1 of 6"`).
   */
  @property({ type: String, reflect: true }) ariaLabel: string | null = null;
  @query('[data-rozie-ref="root"]') private _refRoot!: HTMLElement;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    if (this.autoFocus) this.focusIndex(this.firstEmptyIndex());
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
    if (name === 'value') this._valueControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-otp": true, 'rozie-otp--disabled': this.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="group" aria-label=${this.ariaLabel} ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="root" data-rozie-s-8267d52a>
  ${repeat<any>(this.cells(), (cell, _idx) => cell.i, (cell, _idx) => html`<input class="rozie-otp-cell" key=${rozieAttr(cell.i)} type=${rozieAttr(this.cellType())} inputmode=${rozieAttr(this.cellInputMode())} maxlength="1" autocapitalize="off" autocomplete=${rozieAttr(this.cellAutocomplete(cell.i))} .value=${cell.ch} placeholder=${this.placeholder} ?disabled=${!!this.disabled} aria-label=${rozieAttr(this.cellAriaLabel(cell.i))} data-filled=${rozieAttr(cell.ch ? 'true' : null)} @input=${($event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onInput(cell.i, $event); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onKeydown(cell.i, $event); }} @paste=${($event: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onPaste(cell.i, $event); }} @focus=${($event: FocusEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement }) => { this.onFocus($event); }} data-rozie-s-8267d52a />`)}
</div>
`;
  }

  code = () => typeof this.value === 'string' ? this.value : '';

  cells = () => {
  const v = this.code();
  const out = [];
  for (let i = 0; i < this.length; i++) out.push({
    i,
    ch: v[i] || ''
  });
  return out;
};

  allowChar = (ch: any) => {
  if (!ch) return false;
  if (this.type === 'numeric') return /[0-9]/.test(ch);
  if (this.type === 'alphanumeric') return /[a-zA-Z0-9]/.test(ch);
  return /\S/.test(ch);
};

  firstEmptyIndex = () => {
  const len = this.code().length;
  return len >= this.length ? this.length - 1 : len;
};

  focusIndex = (idx: any) => {
  let i = idx;
  if (i < 0) i = 0;
  if (i >= this.length) i = this.length - 1;
  const root = this._refRoot;
  if (!root) return;
  const inputs = root.querySelectorAll('input');
  const el = inputs[i];
  if (el) {
    el.focus();
    if (el.select) el.select();
  }
};

  commitValue = (raw: any) => {
  const next = String(raw).slice(0, this.length);
  this._valueControllable.write(next);
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      value: next
    },
    bubbles: true,
    composed: true
  }));
  if (next.length === this.length) this.dispatchEvent(new CustomEvent("complete", {
    detail: {
      value: next
    },
    bubbles: true,
    composed: true
  }));
};

  onInput = (i: any, e: any) => {
  const raw = e && e.target ? e.target.value : '';
  if (raw === '') {
    const cur = this.code();
    this.commitValue(cur.slice(0, i) + cur.slice(i + 1));
    return;
  }
  const ch = raw.slice(-1);
  if (!this.allowChar(ch)) {
    if (e && e.target) e.target.value = this.code()[i] || '';
    return;
  }
  const cur = this.code();
  this.commitValue(cur.slice(0, i) + ch + cur.slice(i + 1));
  this.focusIndex(i + 1);
};

  onKeydown = (i: any, e: any) => {
  const key = e ? e.key : '';
  const cur = this.code();
  if (key === 'Backspace') {
    if (e) e.preventDefault();
    if (cur[i]) {
      this.commitValue(cur.slice(0, i) + cur.slice(i + 1));
    } else if (i > 0) {
      this.commitValue(cur.slice(0, i - 1) + cur.slice(i));
      this.focusIndex(i - 1);
    }
  } else if (key === 'ArrowLeft') {
    if (e) e.preventDefault();
    this.focusIndex(i - 1);
  } else if (key === 'ArrowRight') {
    if (e) e.preventDefault();
    this.focusIndex(i + 1);
  } else if (key === 'Home') {
    if (e) e.preventDefault();
    this.focusIndex(0);
  } else if (key === 'End') {
    if (e) e.preventDefault();
    this.focusIndex(this.length - 1);
  }
};

  onPaste = (i: any, e: any) => {
  if (e) e.preventDefault();
  const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
  const chars = text.split('').filter(this.allowChar);
  if (!chars.length) return;
  const arr = this.code().split('');
  for (let k = 0; k < chars.length && i + k < this.length; k++) arr[i + k] = chars[k];
  this.commitValue(arr.join(''));
  const landed = i + chars.length;
  this.focusIndex(landed >= this.length ? this.length - 1 : landed);
};

  onFocus = (e: any) => {
  if (e && e.target && e.target.select) e.target.select();
};

  cellType = () => this.mask ? 'password' : 'text';

  cellInputMode = () => this.type === 'numeric' ? 'numeric' : 'text';

  cellAriaLabel = (i: any) => 'Digit ' + (i + 1) + ' of ' + this.length;

  cellAutocomplete = (i: any) => i === 0 ? 'one-time-code' : 'off';

  focus = () => this.focusIndex(this.firstEmptyIndex());

  clear = () => {
  this.commitValue('');
  this.focusIndex(0);
};

  get value(): string { return this._valueControllable.read(); }
  set value(v: string) { this._valueControllable.notifyPropertyWrite(v); }

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
    const __skip = new Set<string>(['data-rozie-ref', 'value', 'length', 'type', 'mask', 'auto-focus', 'autofocus', 'disabled', 'placeholder', 'aria-label', 'arialabel']);
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
