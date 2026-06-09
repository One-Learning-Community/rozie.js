import { LitElement, css, html } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

interface RozieHeaderSlotCtx {
  remaining: unknown;
  total: unknown;
}

interface RozieDefaultSlotCtx {
  item: unknown;
  toggle: unknown;
  remove: unknown;
}

@customElement('rozie-todo-list')
export default class TodoList extends SignalWatcher(LitElement) {
  static styles = css`
.todo-list[data-rozie-s-52bec3de] { font-family: system-ui, sans-serif; }
ul[data-rozie-s-52bec3de] { list-style: none; padding: 0; }
li[data-rozie-s-52bec3de] { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
li.done[data-rozie-s-52bec3de] span[data-rozie-s-52bec3de] { text-decoration: line-through; opacity: 0.5; }
.empty[data-rozie-s-52bec3de] { color: rgba(0, 0, 0, 0.4); font-style: italic; }
form[data-rozie-s-52bec3de] { display: flex; gap: 0.25rem; margin-block: 0.5rem; }
`;

  @property({ type: Array, attribute: 'items' }) _items_attr: any[] = [];
  private _itemsControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'items-change', defaultValue: [], initialControlledValue: undefined });
  @property({ type: String, reflect: true }) title: string = 'Todo';
  private _draft = signal('');

  @state() private _hasSlotHeader = false;
  @queryAssignedElements({ slot: 'header', flatten: true }) private _slotHeaderElements!: Element[];
  @property({ attribute: false }) header?: (scope: { remaining: unknown; total: unknown }) => unknown;
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @property({ attribute: false }) __rozieDefaultSlot__?: (scope: { item: unknown; toggle: unknown; remove: unknown }) => unknown;
  @state() private _hasSlotEmpty = false;
  @queryAssignedElements({ slot: 'empty', flatten: true }) private _slotEmptyElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

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
    this._hasSlotHeader = Array.from(this.children).some((el) => el.getAttribute('slot') === 'header');
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
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
<div class="todo-list" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-52bec3de>
  <header data-rozie-s-52bec3de>
    ${this.header !== undefined ? this.header({remaining: this.remaining, total: this.items.length}) : html`<slot name="header" data-rozie-params=${(() => { try { return JSON.stringify({remaining: this.remaining, total: this.items.length}); } catch { return '{}'; } })()}>
      
      <h3 data-rozie-s-52bec3de>${this.title} (${rozieDisplay(this.remaining)} remaining)</h3>
    </slot>`}
  </header>

  <form @submit=${($event: SubmitEvent) => { $event.preventDefault(); ((this.add) as (...args: any[]) => any)($event); }} data-rozie-s-52bec3de>
    <input placeholder="What needs doing?" .value=${this._draft.value} @input=${($event) => this._draft.value = ($event.target as HTMLInputElement).value} data-rozie-s-52bec3de />
    <button type="submit" ?disabled=${!this._draft.value.trim()} data-rozie-s-52bec3de>Add</button>
  </form>

  ${this.items.length > 0 ? html`<ul data-rozie-s-52bec3de>
    ${repeat<any>(this.items, (item, _idx) => item.id, (item, _idx) => html`<li class="${Object.entries({ done: item.done }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(item.id)} data-rozie-s-52bec3de>
      
      ${this.__rozieDefaultSlot__ !== undefined ? this.__rozieDefaultSlot__({item: item, toggle: () => this.toggle(item.id), remove: () => this.removeItem(item.id)}) : html`<slot data-rozie-params=${(() => { try { return JSON.stringify({item: item}); } catch { return '{}'; } })()} @rozie-default-toggle=${($event: CustomEvent) => ((() => this.toggle(item.id)) as (...args: any[]) => any)($event.detail)} @rozie-default-remove=${($event: CustomEvent) => ((() => this.removeItem(item.id)) as (...args: any[]) => any)($event.detail)}>
        <label data-rozie-s-52bec3de><input type="checkbox" ?checked=${item.done} @change=${($event: Event) => { this.toggle(item.id); }} data-rozie-s-52bec3de /><span data-rozie-s-52bec3de>${rozieDisplay(item.text)}</span></label>
        <button aria-label="Remove" @click=${($event: Event) => { this.removeItem(item.id); }} data-rozie-s-52bec3de>×</button>
      </slot>`}
    </li>`)}
  </ul>` : html`<p class="empty" data-rozie-s-52bec3de>
    <slot name="empty">Nothing to do. ✨</slot>
  </p>`}</div>
`;
  }

  get remaining() { return this.items.filter((i: any) => !i.done).length; }

  add = () => {
  const text = this._draft.value.trim();
  if (!text) return;
  this._itemsControllable.write([...this.items, {
    id: crypto.randomUUID(),
    text,
    done: false
  }]);
  this._draft.value = '';
  this.dispatchEvent(new CustomEvent("add", {
    detail: text,
    bubbles: true,
    composed: true
  }));
};

  toggle = (id: any) => {
  this._itemsControllable.write(this.items.map((i: any) => i.id === id ? {
    ...i,
    done: !i.done
  } : i));
  this.dispatchEvent(new CustomEvent("toggle", {
    detail: id,
    bubbles: true,
    composed: true
  }));
};

  removeItem = (id: any) => {
  this._itemsControllable.write(this.items.filter((i: any) => i.id !== id));
  this.dispatchEvent(new CustomEvent("remove", {
    detail: id,
    bubbles: true,
    composed: true
  }));
};

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
    const __skip = new Set<string>(['items', 'title']);
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
