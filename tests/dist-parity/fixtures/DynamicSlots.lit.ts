import { LitElement, css, html } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { RozieSlotDistributor, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

interface RozieCellTotalSlotCtx {
  value: any;
}

interface RozieDynamicCellSlotCtx {
  row: any;
  value: any;
}

interface RozieDynamic2SlotCtx {
  label: any;
}

interface RozieHeaderCellSlotCtx {
  title: any;
}

@customElement('rozie-dynamic-slots')
export default class DynamicSlots extends SignalWatcher(LitElement) {
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' };

  static styles = css`
:host{display:contents}
`;

  @property({ type: Array }) columns: any[] = [];
  @property({ type: Object }) row: any = {};
  @property({ type: Number, reflect: true }) total: number = 0;
  @property({ type: String, reflect: true }) heading: string = 'Header';
  private _freeSlotName = signal('freeform');

  private _rozieSlotDistributor = new RozieSlotDistributor(this);

  @state() private _hasSlotCellTotal = false;
  @queryAssignedElements({ slot: 'cell-total', flatten: true }) private _slotCellTotalElements!: Element[];
  @state() private _hasSlotDynamicCell = false;
  @queryAssignedElements({ flatten: true }) private _slotDynamicCellElements!: Element[];
  @state() private _hasSlotDynamic2 = false;
  @queryAssignedElements({ flatten: true }) private _slotDynamic2Elements!: Element[];
  @state() private _hasSlotHeaderCell = false;
  @queryAssignedElements({ slot: 'headerCell', flatten: true }) private _slotHeaderCellElements!: Element[];
  @property({ attribute: false }) headerCell?: (scope: { title: any }) => unknown;
  // Phase 79 Plan 08 (R4) contract for 79-09: the record intake for
  // record-routed slot fills. 79-09's consumer-side emitSlotFiller
  // accumulates an object literal onto the SAME `.rozieSlots=${{ ... }}`
  // open-tag binding; the KEY is the fill's authored (possibly
  // non-identifier) name and the VALUE is a scope-taking render
  // function. `rozieSlots?.[name]` must be checked BEFORE the legacy
  // named function-prop / <slot> fallback (AC-9). Attribute
  // deserialization is disabled — this is a function-valued record,
  // never reflected to/from an HTML attribute.
  @property({ attribute: false }) rozieSlots?: { 'cell-total'?: (scope: { value: any }) => unknown; [key: `cell-${string}`]: (scope: { row: any; value: any }) => unknown; } & Record<string, (scope: any) => unknown>;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="cell-total"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotCellTotal = this._slotCellTotalElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDynamicCell = this._slotDynamicCellElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDynamic2 = this._slotDynamic2Elements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="headerCell"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotHeaderCell = this._slotHeaderCellElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotCellTotal = Array.from(this.children).some((el) => el.getAttribute('slot') === 'cell-total');
    this._hasSlotDynamicCell = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    this._hasSlotDynamic2 = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    this._hasSlotHeaderCell = Array.from(this.children).some((el) => el.getAttribute('slot') === 'headerCell');
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

  render() {
    return html`
<div class="dynamic-slots" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-96693586>

  
  ${this.rozieSlots?.['cell-total'] !== undefined ? this.rozieSlots?.['cell-total']!({value: this.total}) : html`<slot name="cell-total" data-rozie-params=${(() => { try { return JSON.stringify({value: this.total}); } catch { return '{}'; } })()}>
    <strong data-rozie-s-96693586>${this.total}</strong>
  </slot>`}

  
  ${repeat<any>(this.columns, (col, _idx) => col.key, (col, _idx) => html`<div data-rozie-s-96693586>
    ${this.rozieSlots?.[`cell-${col.key}`] !== undefined ? this.rozieSlots?.[`cell-${col.key}`]!({row: this.row, value: this.row[col.key]}) : html`<slot name="${`cell-${col.key}`}" data-rozie-params=${(() => { try { return JSON.stringify({row: this.row, value: this.row[col.key]}); } catch { return '{}'; } })()}>
      <span data-rozie-s-96693586>${rozieDisplay(this.row[col.key])}</span>
    </slot>`}
  </div>`)}

  
  ${this.rozieSlots?.[this._freeSlotName.value] !== undefined ? this.rozieSlots?.[this._freeSlotName.value]!({label: this._freeSlotName.value}) : html`<slot name="${this._freeSlotName.value}" data-rozie-params=${(() => { try { return JSON.stringify({label: this._freeSlotName.value}); } catch { return '{}'; } })()}>
    <em data-rozie-s-96693586>fallback</em>
  </slot>`}

  
  ${this.headerCell !== undefined ? this.headerCell({title: this.heading}) : html`<slot name="headerCell" data-rozie-params=${(() => { try { return JSON.stringify({title: this.heading}); } catch { return '{}'; } })()}>
    <h2 data-rozie-s-96693586>${this.heading}</h2>
  </slot>`}

</div>
`;
  }

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
    const __skip = new Set<string>(['data-rozie-ref', 'columns', 'row', 'total', 'heading']);
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
