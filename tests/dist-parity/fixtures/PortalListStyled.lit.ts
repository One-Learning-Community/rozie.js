import { LitElement, css, html, nothing, render } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieListeners, rozieSpread } from '@rozie/runtime-lit';

interface RozieItemSlotCtx {
  item: unknown;
}

@customElement('rozie-portal-list-styled')
export default class PortalListStyled extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-portal-list[data-rozie-s-18e5aac6] {
  display: block;
  font-family: system-ui, -apple-system, sans-serif;
}
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] ul {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  overflow: hidden;
}
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] li {
  padding: 0.5rem 0.75rem;
}
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] li + li {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
[data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] div {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
`;

  @property({ type: Array }) items: any[] = [];
  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;
private _portalContainers = new Set<HTMLElement>();

  @state() private _hasSlotItem = false;
  @queryAssignedElements({ slot: 'item', flatten: true }) private _slotItemElements!: Element[];
  @property({ attribute: false }) item?: (scope: { item: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
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
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotItem = Array.from(this.children).some((el) => el.getAttribute('slot') === 'item');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    const portals = {
      item: (container: HTMLElement, scope: { item: unknown }): (() => void) => {
        const tpl = this.item;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-item', '18e5aac6');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
    };

    // Tiny inline "engine" — same shape as examples/PortalList.rozie but
    // with the inline-style ceremony removed. The engine now just creates
    // structural DOM; cosmetic styling is the wrapper's <style> block's job.
    //
    // Destruction order still matters: dispose all cells BEFORE removing
    // the structural container (same constraint as FullCalendar / AG-Grid).
    class MiniListEngine {
      constructor(rootEl: any, opts: any) {
        this.rootEl = rootEl;
        this.items = opts.items;
        this.cellRenderer = opts.cellRenderer;
        this.disposers = [];
        this._mount();
      }
      _mount() {
        const ul = document.createElement('ul');
        for (const item of this.items as any) {
          const li = document.createElement('li');
          const cell = this.cellRenderer(item);
          li.appendChild(cell.node);
          this.disposers.push(cell.dispose);
          ul.appendChild(li);
        }
        this.rootEl.appendChild(ul);
      }
      destroy() {
        for (const dispose of this.disposers as any) dispose();
        this.disposers = [];
        while (this.rootEl.firstChild) this.rootEl.removeChild(this.rootEl.firstChild);
      }
    }

    this._disconnectCleanups.push((() => this.instance?.destroy()));

    this.instance = new MiniListEngine(this._ref__rozieRoot, {
      items: this.items,
      cellRenderer: (item: any) => {
        const node = document.createElement('div');
        const dispose = portals.item(node, {
          item
        });
        return {
          node,
          dispose
        };
      }
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const container of this._portalContainers) render(nothing, container);
      this._portalContainers.clear();
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  render() {
    return html`
<div class="rozie-portal-list" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="__rozieRoot" data-rozie-s-18e5aac6>
  <slot name="item"></slot>
</div>
`;
  }

  instance: any = null;

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
    const __skip = new Set<string>(['items']);
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
