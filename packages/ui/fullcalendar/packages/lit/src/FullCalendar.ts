import { LitElement, css, html, nothing, render } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty } from '@rozie/runtime-lit';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

interface RozieEventSlotCtx {
  arg: unknown;
}

interface RozieDayCellSlotCtx {
  arg: unknown;
}

interface RozieDayHeaderSlotCtx {
  arg: unknown;
}

interface RozieSlotLabelSlotCtx {
  arg: unknown;
}

interface RozieWeekNumberSlotCtx {
  arg: unknown;
}

interface RozieNowIndicatorSlotCtx {
  arg: unknown;
}

interface RozieMoreLinkSlotCtx {
  arg: unknown;
}

@customElement('rozie-full-calendar')
export default class FullCalendar extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-fullcalendar[data-rozie-s-5589629a] {
  width: 100%;
  font-size: 0.875rem;
}
`;

  @property({ type: Array }) events: any[] = [];
  @property({ type: String, attribute: 'view' }) _view_attr: string = 'dayGridMonth';
  private _viewControllable = createLitControllableProperty<string>({ host: this, eventName: 'view-change', defaultValue: 'dayGridMonth', initialControlledValue: undefined });
  @property({ type: Boolean, reflect: true }) weekends: boolean = true;
  @property({ type: Boolean, reflect: true }) editable: boolean = true;
  @property({ type: Boolean, reflect: true }) selectable: boolean = true;
  @property({ type: Number, reflect: true }) height: number = 480;
  @property({ type: String, reflect: true }) defaultColor: string = '#3b82f6';
  @property({ type: String, reflect: true }) locale: string = 'en';
  @property({ type: Number, reflect: true }) firstDay: number = 0;
  @property({ type: String, reflect: true }) slotDuration: string = '00:30:00';
  @property({ type: Boolean, reflect: true }) nowIndicator: boolean = false;
  @property({ type: Object }) headerToolbar: any = {
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay'
};
  @property({ type: Object }) options: any = {};
  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;
private __rozieWatchInitial_1 = true;
private __rozieFirstUpdateDone = false;
private _portalContainers = new Set<HTMLElement>();

  @state() private _hasSlotEvent = false;
  @queryAssignedElements({ slot: 'event', flatten: true }) private _slotEventElements!: Element[];
  @property({ attribute: false }) event?: (scope: { arg: unknown }) => unknown;
  @state() private _hasSlotDayCell = false;
  @queryAssignedElements({ slot: 'dayCell', flatten: true }) private _slotDayCellElements!: Element[];
  @property({ attribute: false }) dayCell?: (scope: { arg: unknown }) => unknown;
  @state() private _hasSlotDayHeader = false;
  @queryAssignedElements({ slot: 'dayHeader', flatten: true }) private _slotDayHeaderElements!: Element[];
  @property({ attribute: false }) dayHeader?: (scope: { arg: unknown }) => unknown;
  @state() private _hasSlotSlotLabel = false;
  @queryAssignedElements({ slot: 'slotLabel', flatten: true }) private _slotSlotLabelElements!: Element[];
  @property({ attribute: false }) slotLabel?: (scope: { arg: unknown }) => unknown;
  @state() private _hasSlotWeekNumber = false;
  @queryAssignedElements({ slot: 'weekNumber', flatten: true }) private _slotWeekNumberElements!: Element[];
  @property({ attribute: false }) weekNumber?: (scope: { arg: unknown }) => unknown;
  @state() private _hasSlotNowIndicator = false;
  @queryAssignedElements({ slot: 'nowIndicator', flatten: true }) private _slotNowIndicatorElements!: Element[];
  @property({ attribute: false }) nowIndicatorSlot?: (scope: { arg: unknown }) => unknown;
  @state() private _hasSlotMoreLink = false;
  @queryAssignedElements({ slot: 'moreLink', flatten: true }) private _slotMoreLinkElements!: Element[];
  @property({ attribute: false }) moreLink?: (scope: { arg: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="event"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotEvent = this._slotEventElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="dayCell"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDayCell = this._slotDayCellElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="dayHeader"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDayHeader = this._slotDayHeaderElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="slotLabel"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotSlotLabel = this._slotSlotLabelElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="weekNumber"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotWeekNumber = this._slotWeekNumberElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="nowIndicator"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotNowIndicator = this._slotNowIndicatorElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="moreLink"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotMoreLink = this._slotMoreLinkElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotEvent = Array.from(this.children).some((el) => el.getAttribute('slot') === 'event');
    this._hasSlotDayCell = Array.from(this.children).some((el) => el.getAttribute('slot') === 'dayCell');
    this._hasSlotDayHeader = Array.from(this.children).some((el) => el.getAttribute('slot') === 'dayHeader');
    this._hasSlotSlotLabel = Array.from(this.children).some((el) => el.getAttribute('slot') === 'slotLabel');
    this._hasSlotWeekNumber = Array.from(this.children).some((el) => el.getAttribute('slot') === 'weekNumber');
    this._hasSlotNowIndicator = Array.from(this.children).some((el) => el.getAttribute('slot') === 'nowIndicator');
    this._hasSlotMoreLink = Array.from(this.children).some((el) => el.getAttribute('slot') === 'moreLink');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    const portals = {
      event: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this.event;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-event', '5589629a');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
      dayCell: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this.dayCell;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-dayCell', '5589629a');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
      dayHeader: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this.dayHeader;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-dayHeader', '5589629a');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
      slotLabel: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this.slotLabel;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-slotLabel', '5589629a');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
      weekNumber: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this.weekNumber;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-weekNumber', '5589629a');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
      nowIndicator: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this.nowIndicatorSlot;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-nowIndicator', '5589629a');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
      moreLink: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
        const tpl = this.moreLink;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-moreLink', '5589629a');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
    };

    this._disconnectCleanups.push((() => this.instance?.destroy()));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.view)(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } ((v: any) => {
      if (!this.instance || !v) return;
      if (v === this.instance.view.type) return;
      this.suppressViewSync = true;
      this.instance.changeView(v);
    })(__watchVal); }); }));

    const opts: Record<string, any> = {
      // :options passthrough spread FIRST — the curated keys below + the portal
      // *Content handlers added after this object override any colliding key, so
      // an explicitly-bound prop (e.g. :height) wins over options.height.
      ...this.options,
      plugins: this.PLUGINS,
      initialView: this.view,
      weekends: this.weekends,
      editable: this.editable,
      selectable: this.selectable,
      height: this.height,
      locale: this.locale,
      firstDay: this.firstDay,
      slotDuration: this.slotDuration,
      nowIndicator: this.nowIndicator,
      events: this.events.map(this.normalizeEvent),
      // D-02: a consumer-passed headerToolbar fully REPLACES the built-in
      // toolbar; the built-in default lives in the `headerToolbar` prop default.
      headerToolbar: this.headerToolbar,
      eventClick: (info: any) => {
        this.dispatchEvent(new CustomEvent("eventClick", {
          detail: {
            event: {
              id: info.event.id,
              title: info.event.title,
              start: info.event.start,
              end: info.event.end
            },
            jsEvent: info.jsEvent
          },
          bubbles: true,
          composed: true
        }));
      },
      dateClick: (info: any) => {
        this.dispatchEvent(new CustomEvent("dateClick", {
          detail: {
            date: info.date,
            dateStr: info.dateStr,
            allDay: info.allDay
          },
          bubbles: true,
          composed: true
        }));
      },
      eventDrop: (info: any) => {
        this.dispatchEvent(new CustomEvent("eventDrop", {
          detail: {
            event: {
              id: info.event.id,
              title: info.event.title,
              start: info.event.start,
              end: info.event.end
            },
            delta: info.delta
          },
          bubbles: true,
          composed: true
        }));
      },
      select: (info: any) => {
        this.dispatchEvent(new CustomEvent("select", {
          detail: {
            start: info.start,
            end: info.end,
            startStr: info.startStr,
            endStr: info.endStr,
            allDay: info.allDay
          },
          bubbles: true,
          composed: true
        }));
      },
      eventResize: (info: any) => {
        this.dispatchEvent(new CustomEvent("eventResize", {
          detail: {
            event: {
              id: info.event.id,
              title: info.event.title,
              start: info.event.start,
              end: info.event.end
            },
            startDelta: info.startDelta,
            endDelta: info.endDelta
          },
          bubbles: true,
          composed: true
        }));
      },
      datesSet: (info: any) => {
        this.dispatchEvent(new CustomEvent("datesSet", {
          detail: {
            start: info.start,
            end: info.end,
            view: info.view.type
          },
          bubbles: true,
          composed: true
        }));
      },
      eventMouseEnter: (info: any) => {
        this.dispatchEvent(new CustomEvent("eventMouseEnter", {
          detail: {
            event: {
              id: info.event.id,
              title: info.event.title,
              start: info.event.start,
              end: info.event.end
            },
            jsEvent: info.jsEvent
          },
          bubbles: true,
          composed: true
        }));
      },
      eventMouseLeave: (info: any) => {
        this.dispatchEvent(new CustomEvent("eventMouseLeave", {
          detail: {
            event: {
              id: info.event.id,
              title: info.event.title,
              start: info.event.start,
              end: info.event.end
            },
            jsEvent: info.jsEvent
          },
          bubbles: true,
          composed: true
        }));
      },
      unselect: (info: any) => {
        this.dispatchEvent(new CustomEvent("unselect", {
          detail: {
            jsEvent: info.jsEvent
          },
          bubbles: true,
          composed: true
        }));
      },
      loading: (isLoading: any) => {
        // FullCalendar's `loading` callback receives a bare boolean (not an info
        // object) — normalize to the structured `{ isLoading }` payload shape.
        this.dispatchEvent(new CustomEvent("loading", {
          detail: {
            isLoading
          },
          bubbles: true,
          composed: true
        }));
      },
      eventsSet: (events: any) => {
        // `eventsSet` receives the array of current EventApi objects — map each to
        // the normalized floor shape for persistence/sync consumers.
        this.dispatchEvent(new CustomEvent("eventsSet", {
          detail: {
            events: events.map((e: any) => ({
              id: e.id,
              title: e.title,
              start: e.start,
              end: e.end
            }))
          },
          bubbles: true,
          composed: true
        }));
      },
      viewDidMount: (info: any) => {
        // viewDidMount fires both on initial mount AND on changeView calls.
        // Same round-trip guard pattern as Flatpickr / LeafletMap.
        if (this.suppressViewSync) {
          this.suppressViewSync = false;
          return;
        }
        if (info.view.type !== this.view) this._viewControllable.write(info.view.type);
      }
    };

    // Portal-slot primitive (Spike 003) — when a consumer supplies an `event`
    // slot, route every cell render through it. The portal helper mounts the
    // consumer's framework-native fragment (React JSX, Vue VNodes, Svelte
    // Snippet, etc.) into a DOM container that FullCalendar owns; the dispose
    // handle is returned to FullCalendar so it cleans up the mounted tree when
    // the cell is removed. Consumers that don't fill the slot get FullCalendar's
    // default rendering (title text) — guarded by `$slots.event`.
    // Portal-slot primitive (Spike 003) — when a consumer supplies an `event`
    // slot, route every cell render through it. The portal helper mounts the
    // consumer's framework-native fragment (React JSX, Vue VNodes, Svelte
    // Snippet, etc.) into a DOM container that FullCalendar owns; the dispose
    // handle is returned to FullCalendar so it cleans up the mounted tree when
    // the cell is removed. Consumers that don't fill the slot get FullCalendar's
    // default rendering (title text) — guarded by `$slots.event`.
    if (this.event !== undefined) {
      opts.eventContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.event(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    // The 6 remaining *Content portal-slots — wired identically to `event`, one
    // per FullCalendar per-cell content hook that fires with the bundled plugins
    // (core + daygrid + timegrid + interaction). Each guarded by its own slot so
    // unfilled slots keep FullCalendar's default rendering.
    //
    // NOTE the `nowIndicator` slot SET name ($slots.nowIndicator) shares a string
    // with the boolean `nowIndicator` PROP — they live in different namespaces
    // ($slots vs $props); the slot emits the `nowIndicatorContent` option while
    // the prop reconciles the `nowIndicator` option. No ROZ collision.
    // The 6 remaining *Content portal-slots — wired identically to `event`, one
    // per FullCalendar per-cell content hook that fires with the bundled plugins
    // (core + daygrid + timegrid + interaction). Each guarded by its own slot so
    // unfilled slots keep FullCalendar's default rendering.
    //
    // NOTE the `nowIndicator` slot SET name ($slots.nowIndicator) shares a string
    // with the boolean `nowIndicator` PROP — they live in different namespaces
    // ($slots vs $props); the slot emits the `nowIndicatorContent` option while
    // the prop reconciles the `nowIndicator` option. No ROZ collision.
    if (this.dayCell !== undefined) {
      opts.dayCellContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.dayCell(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.dayHeader !== undefined) {
      opts.dayHeaderContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.dayHeader(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.slotLabel !== undefined) {
      opts.slotLabelContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.slotLabel(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.weekNumber !== undefined) {
      opts.weekNumberContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.weekNumber(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.nowIndicator !== undefined) {
      opts.nowIndicatorContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.nowIndicator(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.moreLink !== undefined) {
      opts.moreLinkContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.moreLink(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    // Excluded *Content slots (documented, not gaps): noEventsContent (list-view
    // only — @fullcalendar/list is not a bundled peer), slotLaneContent (background
    // lane, no demand), allDayContent (trivial label). Consumers needing those use
    // the :options passthrough + getApi().
    // Excluded *Content slots (documented, not gaps): noEventsContent (list-view
    // only — @fullcalendar/list is not a bundled peer), slotLaneContent (background
    // lane, no demand), allDayContent (trivial label). Consumers needing those use
    // the :options passthrough + getApi().

    this.instance = new Calendar(this._ref__rozieRoot, opts);
    this.instance.render();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('events'))) { const __watchVal = (() => this.events)(); ((v: any) => {
      if (!this.instance) return;
      this.instance.removeAllEvents();
      for (const e of v as any) this.instance.addEvent(this.normalizeEvent(e));
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('weekends'))) { const __watchVal = (() => this.weekends)(); ((v: any) => this.instance?.setOption('weekends', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('editable'))) { const __watchVal = (() => this.editable)(); ((v: any) => this.instance?.setOption('editable', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('selectable'))) { const __watchVal = (() => this.selectable)(); ((v: any) => this.instance?.setOption('selectable', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('height'))) { const __watchVal = (() => this.height)(); ((v: any) => this.instance?.setOption('height', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('locale'))) { const __watchVal = (() => this.locale)(); ((v: any) => this.instance?.setOption('locale', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('firstDay'))) { const __watchVal = (() => this.firstDay)(); ((v: any) => this.instance?.setOption('firstDay', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('slotDuration'))) { const __watchVal = (() => this.slotDuration)(); ((v: any) => this.instance?.setOption('slotDuration', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('nowIndicator'))) { const __watchVal = (() => this.nowIndicator)(); ((v: any) => this.instance?.setOption('nowIndicator', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('headerToolbar'))) { const __watchVal = (() => this.headerToolbar)(); ((v: any) => this.instance?.setOption('headerToolbar', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('options'))) { const __watchVal = (() => this.options)(); ((v: any) => {
      if (!this.instance) return;
      for (const k in v) this.instance.setOption(k, v[k]);
    })(__watchVal); }
    this.__rozieFirstUpdateDone = true;
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

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'view') this._viewControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
<div class="rozie-fullcalendar" data-rozie-ref="__rozieRoot" data-rozie-s-5589629a></div>

<slot name="event"></slot>
<slot name="dayCell"></slot>
<slot name="dayHeader"></slot>
<slot name="slotLabel"></slot>
<slot name="weekNumber"></slot>
<slot name="nowIndicator"></slot>
<slot name="moreLink"></slot>
`;
  }

  instance: any = null;

  suppressViewSync = false;

  PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin];

  normalizeEvent = (e: any) => {
  // Object spread + template-literal default — common reconcile shape:
  // pass user props through, but stamp a sensible title fallback and
  // honor the wrapper's defaultColor only when the event omits one.
  return {
    ...e,
    title: e.title || `Event ${e.id ?? '(no id)'}`,
    color: e.color || this.defaultColor
  };
};

  getApi() {
    return this.instance;
  }

  changeView(...a: any[]) {
    return this.instance?.changeView(...a);
  }

  addEvent(...a: any[]) {
    return this.instance?.addEvent(...a);
  }

  removeEvent(id: any) {
    this.instance?.getEventById(id)?.remove();
  }

  today() {
    this.instance?.today();
  }

  prev() {
    this.instance?.prev();
  }

  next() {
    this.instance?.next();
  }

  gotoDate(...a: any[]) {
    this.instance?.gotoDate(...a);
  }

  get view(): string { return this._viewControllable.read(); }
  set view(v: string) { this._viewControllable.notifyPropertyWrite(v); }
}
