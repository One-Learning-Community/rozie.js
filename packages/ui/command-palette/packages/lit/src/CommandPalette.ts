import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { adoptConsumerStyles, createLitControllableProperty, rozieDisplay } from '@rozie/runtime-lit';
import { ref } from 'lit/directives/ref.js';
import './Listbox';
import { filterCommands } from './internal/filterCommands';

// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list fed to the vendored <Listbox> as its `:options`.
// command-palette KEEPS its own label+keywords filter (filterCommands, A1) and
// runs <Listbox :filterable="false"> — listbox's built-in filter is label-only
// substring and would drop the keyword matching + source-order grouping. A plain
// function (called from the template binding AND handlers) — never $computed (the
// listbox value-vs-accessor split). Each item is passed through verbatim; listbox
// resolves its value via `optionValue` (below) and its label via `.label`.

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

@customElement('rozie-command-palette')
export default class CommandPalette extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-command-palette[data-rozie-s-768cad96] {
  position: fixed;
  inset: 0;
  z-index: var(--rozie-command-palette-z, 1000);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--rozie-command-palette-overlay-padding, 12vh 1rem 1rem);
  background: var(--rozie-command-palette-backdrop-bg, rgba(0, 0, 0, 0.5));
  backdrop-filter: var(--rozie-command-palette-backdrop-filter, none);
}
.rozie-command-palette-panel[data-rozie-s-768cad96] {
  display: flex;
  flex-direction: column;
  width: var(--rozie-command-palette-width, min(40rem, 100%));
  max-height: var(--rozie-command-palette-max-height, 70vh);
  overflow: hidden;
  font: var(--rozie-command-palette-font, inherit);
  color: var(--rozie-command-palette-color, inherit);
  background: var(--rozie-command-palette-bg, #fff);
  border: var(--rozie-command-palette-border, none);
  border-radius: var(--rozie-command-palette-radius, 0.75rem);
  box-shadow: var(--rozie-command-palette-shadow, 0 10px 38px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.25));
}
.rozie-command-palette-search[data-rozie-s-768cad96] {
  padding: var(--rozie-command-palette-search-padding, 0.75rem);
  border-bottom: var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1));
}
.rozie-command-palette-input[data-rozie-s-768cad96] {
  box-sizing: border-box;
  width: 100%;
  padding: var(--rozie-command-palette-input-padding, 0.5rem 0.75rem);
  font: inherit;
  font-size: var(--rozie-command-palette-input-font-size, 1.05rem);
  color: inherit;
  background: var(--rozie-command-palette-input-bg, transparent);
  border: var(--rozie-command-palette-input-border, none);
  border-radius: var(--rozie-command-palette-input-radius, 0.5rem);
  outline: none;
}
.rozie-command-palette-list[data-rozie-s-768cad96] {
  margin: 0;
  padding: var(--rozie-command-palette-list-padding, 0.5rem);
  list-style: none;
  overflow-y: auto;
}
.rozie-command-palette-option[data-rozie-s-768cad96] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-command-palette-option-gap, 0.75rem);
  padding: var(--rozie-command-palette-option-padding, 0.5rem 0.625rem);
  border-radius: var(--rozie-command-palette-option-radius, 0.5rem);
  cursor: pointer;
  color: var(--rozie-command-palette-option-color, inherit);
}
.rozie-command-palette-option--active[data-rozie-s-768cad96] {
  background: var(--rozie-command-palette-option-active-bg, rgba(0, 102, 204, 0.12));
  color: var(--rozie-command-palette-option-active-color, inherit);
}
.rozie-command-palette-option--disabled[data-rozie-s-768cad96] {
  cursor: not-allowed;
  opacity: var(--rozie-command-palette-option-disabled-opacity, 0.45);
}
.rozie-command-palette-option-group[data-rozie-s-768cad96] {
  font-size: var(--rozie-command-palette-group-font-size, 0.75rem);
  color: var(--rozie-command-palette-group-color, rgba(0, 0, 0, 0.5));
  text-transform: var(--rozie-command-palette-group-transform, uppercase);
  letter-spacing: 0.04em;
}
.rozie-command-palette-empty[data-rozie-s-768cad96] {
  padding: var(--rozie-command-palette-empty-padding, 1.5rem);
  text-align: center;
  color: var(--rozie-command-palette-empty-color, rgba(0, 0, 0, 0.5));
}
.rozie-command-palette-footer[data-rozie-s-768cad96] {
  padding: var(--rozie-command-palette-footer-padding, 0.5rem 0.75rem);
  border-top: var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1));
  font-size: var(--rozie-command-palette-footer-font-size, 0.8125rem);
  color: var(--rozie-command-palette-footer-color, rgba(0, 0, 0, 0.55));
}
`;

  /**
   * Whether the palette overlay is shown (two-way `r-model`). Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`); every close path (backdrop click, Escape, selecting an item when `closeOnSelect`, the imperative `close()`) writes `open = false`. As one of two `model: true` props the component does not generate an Angular `ControlValueAccessor`.
   * @example
   * <CommandPalette r-model:open="paletteOpen" :items="commands" />
   */
  @property({ type: Boolean, attribute: 'open' }) _open_attr: boolean = false;
  private _openControllable = createLitControllableProperty<boolean>({ host: this, eventName: 'open-change', defaultValue: false, initialControlledValue: undefined });
  /**
   * The current search text (two-way `r-model`). Two-way bind it to read or pre-seed the query; the component filters `items` by this string over each item `label` plus its `keywords`. Cleared to `""` whenever the palette opens.
   */
  @property({ type: String, attribute: 'query' }) _query_attr: string = '';
  private _queryControllable = createLitControllableProperty<string>({ host: this, eventName: 'query-change', defaultValue: '', initialControlledValue: undefined });
  /**
   * The command list — `[{ id, label, group?, keywords?, disabled? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; optional `group` buckets items under a heading; optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation.
   */
  @property({ type: Array }) items: any[] = [];
  /**
   * Placeholder text shown in the search input while the query is empty.
   */
  @property({ type: String, reflect: true }) placeholder: string = 'Type a command…';
  /**
   * Text shown when the query matches no items. Override the whole empty state with the `empty` slot when you need richer markup.
   */
  @property({ type: String, reflect: true }) emptyText: string = 'No results.';
  /**
   * Whether choosing an item closes the palette. Defaults to `true` (the cmdk convention); set to `false` to keep the palette open after a selection — e.g. for a multi-action menu where the user runs several commands in a row.
   */
  @property({ type: Boolean, reflect: true }) closeOnSelect: boolean = true;
  /**
   * Accessible name for the dialog surface (`aria-label` on the `role="dialog"` panel). Override it to match the palette's purpose (e.g. "Search commands").
   */
  @property({ type: String, reflect: true }) ariaLabel: string = 'Command palette';
  /**
   * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  @property({ type: String, reflect: true }) idBase: string = 'rozie-command-palette';
  private _activeValue = signal(null);
  @query('[data-rozie-ref="panel"]') private _refPanel!: HTMLElement;
private __rozieWatchInitial_0 = true;

  @state() private _hasSlotOption = false;
  @queryAssignedElements({ slot: 'option', flatten: true }) private _slotOptionElements!: Element[];
  @property({ attribute: false }) option?: (scope: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown }) => unknown;
  @state() private _hasSlotEmpty = false;
  @queryAssignedElements({ slot: 'empty', flatten: true }) private _slotEmptyElements!: Element[];
  @property({ attribute: false }) empty?: (scope: { query: unknown }) => unknown;
  @state() private _hasSlotFooter = false;
  @queryAssignedElements({ slot: 'footer', flatten: true }) private _slotFooterElements!: Element[];

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
    this._hasSlotOption = Array.from(this.children).some((el) => el.getAttribute('slot') === 'option');
    this._hasSlotEmpty = Array.from(this.children).some((el) => el.getAttribute('slot') === 'empty');
    this._hasSlotFooter = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.open)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      if (isOpen) this.onOpen();
    })(__watchVal); }); }));

    if (this.open) this.onOpen();
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
    if (name === 'open') this._openControllable.notifyAttributeChange(value !== null);
    if (name === 'query') this._queryControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
${this.open ? html`<div class="rozie-command-palette" @click=${($event: Event) => { this.onBackdropClick($event); }} data-rozie-s-768cad96>
  <div class="rozie-command-palette-panel" role="dialog" aria-modal="true" aria-label=${this.ariaLabel} @keydown=${($event: Event) => { this.onPanelKeydown($event); }} data-rozie-ref="panel" data-rozie-s-768cad96>
    
    <rozie-listbox .combobox=${true} .inline=${true} .filterable=${false} .closeOnSelect=${false} .options=${this.filteredItems()} .optionValue=${this.commandValue} .optionDisabled=${this.commandDisabled} .placeholder=${this.placeholder} .ariaLabel=${this.ariaLabel} .id=${this.idBase} .value=${this._activeValue.value} @value-change=${($event: CustomEvent) => { this._activeValue.value = $event.detail; }} @change=${($event: Event) => { this.onListboxChange($event); }} @search=${(__rozieEv: CustomEvent) => { const $event = __rozieEv.detail; this.onListboxSearch($event); }} data-rozie-s-768cad96 .option=${(scope: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown }) => html`
        ${this.option !== undefined ? this.option({option: scope.option, index: scope.index, active: scope.active, selected: scope.selected, disabled: scope.disabled}) : html`<slot name="option" data-rozie-params=${(() => { try { return JSON.stringify({option: scope.option, index: scope.index, active: scope.active, selected: scope.selected, disabled: scope.disabled}); } catch { return '{}'; } })()}>
          <span class="rozie-command-palette-option-label" data-rozie-s-768cad96>${rozieDisplay(this.labelText(scope.option))}</span>
          ${this.groupText(scope.option) ? html`<span class="rozie-command-palette-option-group" data-rozie-s-768cad96>${rozieDisplay(this.groupText(scope.option))}</span>` : nothing}</slot>`}
      `} .empty=${(scope: { query: unknown }) => html`
        ${this.empty !== undefined ? this.empty({query: scope.query}) : html`<slot name="empty" data-rozie-params=${(() => { try { return JSON.stringify({query: scope.query}); } catch { return '{}'; } })()}>${this.emptyText}</slot>`}
      `} ${ref((el: Element | undefined) => el && adoptConsumerStyles(el, (this.constructor as { styles?: unknown }).styles))}></rozie-listbox>

    
    ${this._hasSlotFooter ? html`<div class="rozie-command-palette-footer" data-rozie-s-768cad96>
      <slot name="footer"></slot>
    </div>` : nothing}</div>
</div>` : nothing}`;
  }

  filteredItems = () => {
  const src = Array.isArray(this.items) ? this.items : [];
  return filterCommands(src, this.query);
};

  commandValue = (it: any) => it && it.id !== undefined ? it.id : it;

  commandDisabled = (it: any) => !!(it && it.disabled);

  labelText = (o: any) => o && o.label !== undefined ? o.label : '';

  groupText = (o: any) => o && o.group !== undefined ? o.group : '';

  closePalette = () => {
  this._openControllable.write(false);
};

  onListboxChange = (e: any) => {
  const item = e ? e.option : null;
  if (!item || item.disabled) return;
  this.dispatchEvent(new CustomEvent("select", {
    detail: {
      id: item.id,
      label: item.label,
      group: item.group
    },
    bubbles: true,
    composed: true
  }));
  // Clear the internal selection so re-selecting the same command re-fires.
  this._activeValue.value = null;
  if (this.closeOnSelect) this.closePalette();
};

  onListboxSearch = (e: any) => {
  this._queryControllable.write(e && e.query !== undefined ? e.query : '');
};

  onBackdropClick = (e: any) => {
  if (e && e.target === e.currentTarget) this.closePalette();
};

  focusInput = () => {
  const panel = this._refPanel;
  if (!panel) return;
  const input = panel.querySelector('input') || panel.querySelector('rozie-listbox')?.shadowRoot?.querySelector('input');
  if (input && input.focus) input.focus();
};

  onOpen = () => {
  this._queryControllable.write('');
  this._activeValue.value = null;
  // Defer a tick so the overlay + <Listbox> are mounted before focusing.
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      this.focusInput();
    });
  } else {
    this.focusInput();
  }
};

  onPanelKeydown = (e: any) => {
  if (e && e.key === 'Escape') {
    e.preventDefault();
    this.closePalette();
  }
};

  show = () => {
  this._openControllable.write(true);
};

  close = () => {
  this.closePalette();
};

  toggle = () => {
  this._openControllable.write(!this.open);
};

  focus = () => this.focusInput();

  get open(): boolean { return this._openControllable.read(); }
  set open(v: boolean) { this._openControllable.notifyPropertyWrite(v); }
  get query(): string { return this._queryControllable.read(); }
  set query(v: string) { this._queryControllable.notifyPropertyWrite(v); }
}
