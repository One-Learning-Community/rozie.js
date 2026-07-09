import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';
import { paginationItems } from './internal/paginationItems';

// ---- derived view (ONE plain function, uniform x6) ---------------------
// The whole render model in a single call: { totalPages, page, pages,
// hasPrev, hasNext }. A PLAIN function (not $computed) so it reads uniformly
// on all six targets and can be aliased in handlers without the Solid
// accessor divergence. Returns a FRESH object each call — never feed it to a
// reference-equality $watch getter.

interface RoziePrevControlSlotCtx {
  disabled: unknown;
  goto: unknown;
  page: unknown;
}

interface RozieEllipsisSlotCtx {
  index: unknown;
}

interface RozieItemSlotCtx {
  page: unknown;
  selected: unknown;
  goto: unknown;
}

interface RozieNextControlSlotCtx {
  disabled: unknown;
  goto: unknown;
  page: unknown;
}

@customElement('rozie-pagination')
export default class Pagination extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-pagination[data-rozie-s-de247ae2] {
  display: inline-flex;
  align-items: center;
  gap: var(--rozie-pagination-gap, 0.25rem);
  font: var(--rozie-pagination-font, inherit);
}
.rozie-pagination-page[data-rozie-s-de247ae2],
.rozie-pagination-control[data-rozie-s-de247ae2] {
  box-sizing: border-box;
  min-width: var(--rozie-pagination-size, 2.25rem);
  height: var(--rozie-pagination-size, 2.25rem);
  padding: 0 var(--rozie-pagination-padding-x, 0.5rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-weight: var(--rozie-pagination-font-weight, 500);
  color: var(--rozie-pagination-fg, #1a1a1a);
  background: var(--rozie-pagination-bg, transparent);
  border: var(--rozie-pagination-border-width, 1px) solid var(--rozie-pagination-border, rgba(0, 0, 0, 0.18));
  border-radius: var(--rozie-pagination-radius, 6px);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.rozie-pagination-page[data-rozie-s-de247ae2]:hover,
.rozie-pagination-control[data-rozie-s-de247ae2]:hover {
  background: var(--rozie-pagination-hover-bg, rgba(0, 0, 0, 0.05));
  border-color: var(--rozie-pagination-hover-border, rgba(0, 0, 0, 0.28));
}
.rozie-pagination-page[data-rozie-s-de247ae2]:focus-visible,
.rozie-pagination-control[data-rozie-s-de247ae2]:focus-visible {
  outline: var(--rozie-pagination-ring-width, 2px) solid var(--rozie-pagination-ring, var(--rozie-pagination-accent, #0066cc));
  outline-offset: var(--rozie-pagination-ring-offset, 1px);
}
.rozie-pagination-page.is-active[data-rozie-s-de247ae2] {
  color: var(--rozie-pagination-active-fg, #fff);
  background: var(--rozie-pagination-active-bg, var(--rozie-pagination-accent, #0066cc));
  border-color: var(--rozie-pagination-active-border, var(--rozie-pagination-accent, #0066cc));
}
.rozie-pagination-page[data-rozie-s-de247ae2]:disabled,
.rozie-pagination-control[data-rozie-s-de247ae2]:disabled {
  cursor: not-allowed;
  opacity: var(--rozie-pagination-disabled-opacity, 0.5);
  pointer-events: none;
}
.rozie-pagination--disabled[data-rozie-s-de247ae2] {
  opacity: var(--rozie-pagination-disabled-opacity, 0.5);
  pointer-events: none;
}
.rozie-pagination-ellipsis[data-rozie-s-de247ae2] {
  min-width: var(--rozie-pagination-size, 2.25rem);
  height: var(--rozie-pagination-size, 2.25rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--rozie-pagination-ellipsis-fg, rgba(0, 0, 0, 0.5));
  user-select: none;
}
`;

  /**
   * The 1-based current page (two-way model). Clamped into `[1, totalPages]`. Bind it with `r-model:modelValue` / `v-model:modelValue` / `modelValue` + `onModelValueChange`; it is also the Angular ControlValueAccessor control value.
   */
  @property({ type: Number, attribute: 'model-value' }) _modelValue_attr: number = 1;
  private _modelValueControllable = createLitControllableProperty<number>({ host: this, eventName: 'model-value-change', defaultValue: 1, initialControlledValue: undefined });
  /**
   * Explicit total page count. When provided (> 0) it takes precedence over `total` + `pageSize`. Use it when the backend already reports the page count.
   */
  @property({ type: Number, reflect: true }) totalPages: number | null = null;
  /**
   * Total item count. Combined with `pageSize` to derive the page count (`ceil(total / pageSize)`) when `totalPages` is not given.
   */
  @property({ type: Number, reflect: true }) total: number | null = null;
  /**
   * Items per page. Combined with `total` to derive the page count when `totalPages` is not given.
   */
  @property({ type: Number, reflect: true }) pageSize: number | null = null;
  /**
   * Number of page buttons shown on each side of the current page (the sibling window). Larger values show more context around the current page.
   */
  @property({ type: Number, reflect: true }) siblingCount: number = 1;
  /**
   * Number of page buttons always shown at each boundary (the first and last `boundaryCount` pages), regardless of the current page.
   */
  @property({ type: Number, reflect: true }) boundaryCount: number = 1;
  /**
   * Disable the entire control — every page button and the prev/next controls become non-interactive and are marked `aria-disabled`.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Accessible name for the surrounding `<nav>` landmark (its `aria-label`). Defaults to `"Pagination"`.
   */
  @property({ type: String, reflect: true }) ariaLabel: string = 'Pagination';
  @query('[data-rozie-ref="nav"]') private _refNav!: HTMLElement;

  @state() private _hasSlotPrevControl = false;
  @queryAssignedElements({ slot: 'prevControl', flatten: true }) private _slotPrevControlElements!: Element[];
  @property({ attribute: false }) prevControl?: (scope: { disabled: unknown; goto: unknown; page: unknown }) => unknown;
  @state() private _hasSlotEllipsis = false;
  @queryAssignedElements({ slot: 'ellipsis', flatten: true }) private _slotEllipsisElements!: Element[];
  @property({ attribute: false }) ellipsis?: (scope: { index: unknown }) => unknown;
  @state() private _hasSlotItem = false;
  @queryAssignedElements({ slot: 'item', flatten: true }) private _slotItemElements!: Element[];
  @property({ attribute: false }) item?: (scope: { page: unknown; selected: unknown; goto: unknown }) => unknown;
  @state() private _hasSlotNextControl = false;
  @queryAssignedElements({ slot: 'nextControl', flatten: true }) private _slotNextControlElements!: Element[];
  @property({ attribute: false }) nextControl?: (scope: { disabled: unknown; goto: unknown; page: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="prevControl"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotPrevControl = this._slotPrevControlElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="ellipsis"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotEllipsis = this._slotEllipsisElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="item"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotItem = this._slotItemElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="nextControl"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotNextControl = this._slotNextControlElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotPrevControl = Array.from(this.children).some((el) => el.getAttribute('slot') === 'prevControl');
    this._hasSlotEllipsis = Array.from(this.children).some((el) => el.getAttribute('slot') === 'ellipsis');
    this._hasSlotItem = Array.from(this.children).some((el) => el.getAttribute('slot') === 'item');
    this._hasSlotNextControl = Array.from(this.children).some((el) => el.getAttribute('slot') === 'nextControl');
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
    if (name === 'model-value') this._modelValueControllable.notifyAttributeChange(value === null ? 1 : Number(value));
  }

  render() {
    return html`
<nav class="${Object.entries({ "rozie-pagination": true, 'rozie-pagination--disabled': this.disabled }).filter(([, v]) => v).map(([k]) => k).join(' ')}" aria-label=${this.ariaLabel} ${rozieSpread(this.$attrs)} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLElement; target: HTMLElement }) => { this.onControlKeydown($event); }} ${rozieListeners(this.$listeners)} data-rozie-ref="nav" data-rozie-s-de247ae2>
  
  ${this.prevControl !== undefined ? this.prevControl({disabled: !this.canPrev() || this.disabled, goto: this.goPrev, page: this.currentPage() - 1}) : html`<slot name="prevControl" data-rozie-params=${(() => { try { return JSON.stringify({disabled: !this.canPrev() || this.disabled, page: this.currentPage() - 1}); } catch { return '{}'; } })()} @rozie-prev-control-goto=${($event: CustomEvent) => ((this.goPrev) as (...args: any[]) => any)($event.detail)}>
    <button class="rozie-pagination-control rozie-pagination-prev" type="button" data-page-control="" tabindex=${rozieAttr(this.tabIndexFor(true))} ?disabled=${!this.canPrev() || this.disabled} aria-disabled=${!!(!this.canPrev() || this.disabled)} aria-label="Previous page" @click=${this.goPrev} data-rozie-s-de247ae2>‹</button>
  </slot>`}

  
  ${repeat<any>(this.model().pages, (item, index) => item + '-' + index, (item, index) => html`
    ${item === 'ellipsis' ? html`<span class="rozie-pagination-ellipsis" aria-hidden="true" data-rozie-s-de247ae2>
      ${this.ellipsis !== undefined ? this.ellipsis({index: index}) : html`<slot name="ellipsis" data-rozie-params=${(() => { try { return JSON.stringify({index: index}); } catch { return '{}'; } })()}>…</slot>`}
    </span>` : nothing}${item !== 'ellipsis' ? html`<span class="rozie-pagination-item" data-rozie-s-de247ae2>
      ${this.item !== undefined ? this.item({page: item, selected: this.isActive(item), goto: () => this.goToPage(item)}) : html`<slot name="item" data-rozie-params=${(() => { try { return JSON.stringify({page: item, selected: this.isActive(item)}); } catch { return '{}'; } })()} @rozie-item-goto=${($event: CustomEvent) => ((() => this.goToPage(item)) as (...args: any[]) => any)($event.detail)}>
        <button class="${Object.entries({ "rozie-pagination-page": true, 'is-active': this.isActive(item) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" data-page-control="" tabindex=${rozieAttr(this.tabIndexFor(this.isActive(item)))} ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} aria-current=${rozieAttr(this.isActive(item) ? 'page' : null)} aria-label=${rozieAttr('Go to page ' + item)} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.goToPage(item); }} data-rozie-s-de247ae2>${rozieDisplay(item)}</button>
      </slot>`}
    </span>` : nothing}`)}

  
  ${this.nextControl !== undefined ? this.nextControl({disabled: !this.canNext() || this.disabled, goto: this.goNext, page: this.currentPage() + 1}) : html`<slot name="nextControl" data-rozie-params=${(() => { try { return JSON.stringify({disabled: !this.canNext() || this.disabled, page: this.currentPage() + 1}); } catch { return '{}'; } })()} @rozie-next-control-goto=${($event: CustomEvent) => ((this.goNext) as (...args: any[]) => any)($event.detail)}>
    <button class="rozie-pagination-control rozie-pagination-next" type="button" data-page-control="" tabindex=${rozieAttr(this.tabIndexFor(true))} ?disabled=${!this.canNext() || this.disabled} aria-disabled=${!!(!this.canNext() || this.disabled)} aria-label="Next page" @click=${this.goNext} data-rozie-s-de247ae2>›</button>
  </slot>`}
</nav>
`;
  }

  model = () => paginationItems({
  page: this.modelValue,
  totalPages: this.totalPages,
  total: this.total,
  pageSize: this.pageSize,
  siblingCount: this.siblingCount,
  boundaryCount: this.boundaryCount
});

  effectivePages = () => this.model().totalPages;

  currentPage = () => this.model().page;

  canPrev = () => this.model().hasPrev;

  canNext = () => this.model().hasNext;

  isActive = (page: any) => page === this.currentPage();

  tabIndexFor = (active: any): number | undefined => active ? 0 : -1;

  goToPage = (page: any) => {
  if (this.disabled) return;
  const tp = this.effectivePages();
  let target = typeof page === 'number' ? Math.floor(page) : 1;
  if (target < 1) target = 1;
  if (target > tp) target = tp;
  if (target === this.currentPage()) return;
  this._modelValueControllable.write(target);
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      page: target
    },
    bubbles: true,
    composed: true
  }));
};

  goNext = () => {
  if (this.canNext()) this.goToPage(this.currentPage() + 1);
};

  goPrev = () => {
  if (this.canPrev()) this.goToPage(this.currentPage() - 1);
};

  goFirst = () => this.goToPage(1);

  goLast = () => this.goToPage(this.effectivePages());

  controls = () => {
  const nav = this._refNav;
  if (!nav) return [];
  return Array.from(nav.querySelectorAll('[data-page-control]')) as HTMLElement[];
};

  focusControlAt = (idx: any) => {
  const els = this.controls();
  if (els.length === 0) return;
  let i = idx;
  if (i < 0) i = 0;
  if (i >= els.length) i = els.length - 1;
  const el = els[i];
  if (el && el.focus) el.focus();
};

  focusedIndex = () => {
  const els = this.controls();
  const nav = this._refNav;
  const active = nav ? nav.ownerDocument.activeElement : null;
  return els.indexOf(active as HTMLElement);
};

  onControlKeydown = ($event: any) => {
  if (this.disabled) return;
  const key = $event.key;
  const cur = this.focusedIndex();
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    $event.preventDefault();
    this.focusControlAt(cur + 1);
  } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
    $event.preventDefault();
    this.focusControlAt(cur - 1);
  } else if (key === 'Home') {
    $event.preventDefault();
    this.focusControlAt(0);
  } else if (key === 'End') {
    $event.preventDefault();
    this.focusControlAt(this.controls().length - 1);
  }
};

  goto = (page: any) => this.goToPage(page);

  next = () => this.goNext();

  prev = () => this.goPrev();

  first = () => this.goFirst();

  last = () => this.goLast();

  get modelValue(): number { return this._modelValueControllable.read(); }
  set modelValue(v: number) { this._modelValueControllable.notifyPropertyWrite(v); }

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
    const __skip = new Set<string>(['model-value', 'modelvalue', 'total-pages', 'totalpages', 'total', 'page-size', 'pagesize', 'sibling-count', 'siblingcount', 'boundary-count', 'boundarycount', 'disabled', 'aria-label', 'arialabel']);
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
