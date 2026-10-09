import { LitElement, css, html, nothing, render } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, untracked } from '@lit-labs/preact-signals';
import { adoptDocumentStyles, createLitControllableProperty, rozieNumberOrStringAttr } from '@rozie/runtime-lit';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

// The typed public surface (always TypeScript, whatever the script lang).
// Payload interfaces describe what the wrapper ACTUALLY emits (normalized
// `{ id, title, start, end, allDay }` event refs, the view TYPE string, `{ isLoading }`),
// not FullCalendar's raw callback args. Engine types come from the
// `@fullcalendar/core` peer and are re-exported so consumers can name them.
import type { DateInput, DateRangeInput, DateSpanInput, DurationInput, Duration, EventApi, EventInput, EventSourceApi, ViewApi, EventContentArg, DayCellContentArg, DayHeaderContentArg, SlotLabelContentArg, WeekNumberContentArg, NowIndicatorContentArg, MoreLinkContentArg, AllDayContentArg, SlotLaneContentArg } from '@fullcalendar/core';
/** The normalized event ref every event payload carries; `allDay` mirrors FullCalendar's `EventApi.allDay` (`true` for an all-day event, `false` for a timed one). */
export interface FullCalendarEventRef {
  id: string;
  title: string;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
}
/** `eventClick` payload — `jsEvent` is a `KeyboardEvent` when the event is activated with Enter/Space. */
export interface FullCalendarEventClick {
  event: FullCalendarEventRef;
  jsEvent: MouseEvent | KeyboardEvent;
  el: HTMLElement;
}
/** `eventMouseEnter` / `eventMouseLeave` payload. */
export interface FullCalendarEventPointer {
  event: FullCalendarEventRef;
  jsEvent: MouseEvent;
  el: HTMLElement;
}
/** `dateClick` payload — `dayEl` is the clicked day cell (an anchor for a popover). */
export interface FullCalendarDateClick {
  date: Date;
  dateStr: string;
  allDay: boolean;
  dayEl: HTMLElement;
  jsEvent: MouseEvent;
}
/** `eventDrop` payload — call `revert()` to reject the move; `oldEvent` is the event before it. */
export interface FullCalendarEventDrop {
  event: FullCalendarEventRef;
  oldEvent: FullCalendarEventRef;
  delta: Duration;
  revert: () => void;
}
export interface FullCalendarSelection {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  allDay: boolean;
}
/** `eventResize` payload — call `revert()` to reject the resize; `oldEvent` is the event before it. */
export interface FullCalendarEventResize {
  event: FullCalendarEventRef;
  oldEvent: FullCalendarEventRef;
  startDelta: Duration;
  endDelta: Duration;
  revert: () => void;
}
export interface FullCalendarDatesSet {
  start: Date;
  end: Date;
  view: string;
}
/** `jsEvent` is the pointer/touch `UIEvent` that cleared the selection, or `null` when it was cleared programmatically (e.g. the `clearSelection` verb). */
export interface FullCalendarUnselect {
  jsEvent: UIEvent | null;
}
export interface FullCalendarLoading {
  isLoading: boolean;
}
export interface FullCalendarEventsSet {
  events: FullCalendarEventRef[];
}
/** `noEventsContent` arg — `@fullcalendar/list`'s NoEventsContentArg, restated so the core-only peer set suffices. */
export interface FullCalendarNoEventsContentArg {
  text: string;
  view: ViewApi;
}
export type { DateInput, EventApi, EventInput, EventContentArg, DayCellContentArg, DayHeaderContentArg, SlotLabelContentArg, WeekNumberContentArg, NowIndicatorContentArg, MoreLinkContentArg, AllDayContentArg, SlotLaneContentArg };
export type { Calendar } from '@fullcalendar/core';

export interface RozieFullCalendarEventMap extends Omit<HTMLElementEventMap, 'event-click' | 'date-click' | 'event-drop' | 'select' | 'event-resize' | 'dates-set' | 'event-mouse-enter' | 'event-mouse-leave' | 'unselect' | 'loading' | 'events-set' | 'view-change'> {
  'event-click': CustomEvent<FullCalendarEventClick>;
  'date-click': CustomEvent<FullCalendarDateClick>;
  'event-drop': CustomEvent<FullCalendarEventDrop>;
  'select': CustomEvent<FullCalendarSelection>;
  'event-resize': CustomEvent<FullCalendarEventResize>;
  'dates-set': CustomEvent<FullCalendarDatesSet>;
  'event-mouse-enter': CustomEvent<FullCalendarEventPointer>;
  'event-mouse-leave': CustomEvent<FullCalendarEventPointer>;
  'unselect': CustomEvent<FullCalendarUnselect>;
  'loading': CustomEvent<FullCalendarLoading>;
  'events-set': CustomEvent<FullCalendarEventsSet>;
  'view-change': CustomEvent<string>;
}

interface RozieEventSlotCtx {
  arg: EventContentArg;
}

interface RozieDayCellSlotCtx {
  arg: DayCellContentArg;
}

interface RozieDayHeaderSlotCtx {
  arg: DayHeaderContentArg;
}

interface RozieSlotLabelSlotCtx {
  arg: SlotLabelContentArg;
}

interface RozieWeekNumberSlotCtx {
  arg: WeekNumberContentArg;
}

interface RozieNowIndicatorContentSlotCtx {
  arg: NowIndicatorContentArg;
}

interface RozieMoreLinkSlotCtx {
  arg: MoreLinkContentArg;
}

interface RozieAllDayContentSlotCtx {
  arg: AllDayContentArg;
}

interface RozieSlotLaneContentSlotCtx {
  arg: SlotLaneContentArg;
}

interface RozieNoEventsContentSlotCtx {
  arg: FullCalendarNoEventsContentArg;
}

@customElement('rozie-full-calendar')
export default class FullCalendar extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-fullcalendar[data-rozie-s-5589629a] {
  width: 100%;
  font-size: 0.875rem;
}
`;

  /**
   * The event objects rendered on the calendar. Each event is normalized: a missing `title` renders as an empty title (the wrapper never invents one from the event id; an untitled event gets an `aria-label` so it still has an accessible name), and a missing `color` inherits `defaultColor`. Runtime-updatable — changing the array replaces only the events this prop supplied; events from `options.eventSources` or added through the `addEvent` verb are kept.
   */
  @property({ type: Array }) events: any[] = [];
  /**
   * The two-way active view name (`'dayGridMonth'`, `'timeGridWeek'`, `'timeGridDay'`, …) — the sole `model: true` prop. The calendar's own toolbar writes the new view name back through the two-way path, and a consumer write switches the view via `changeView`.
   * @example
   * <rozie-full-calendar .view=${view} @view-change=${…} .events=${events}></rozie-full-calendar>
   */
  @property({ type: String, attribute: 'view' }) _view_attr: string = 'dayGridMonth';
  private _viewControllable = createLitControllableProperty<string>({ host: this, eventName: 'view-change', defaultValue: 'dayGridMonth', initialControlledValue: undefined });
  /**
   * Show the Saturday/Sunday columns. Runtime-updatable via `setOption`.
   */
  @property({ type: Boolean, reflect: true }) weekends: boolean = true;
  /**
   * Allow events to be dragged and resized. Runtime-updatable via `setOption`.
   */
  @property({ type: Boolean, reflect: true }) editable: boolean = true;
  /**
   * Allow date/time-range selection by click-drag. Runtime-updatable via `setOption`.
   */
  @property({ type: Boolean, reflect: true }) selectable: boolean = true;
  /**
   * The calendar height: a pixel number (`480`) or any CSS height FullCalendar accepts (`'auto'`, `'100%'`, `'32rem'`, …). A purely numeric string (`'600'`, e.g. from a static attribute) is treated as pixels. An empty string, `null`, or a number that is not positive falls back to the default `480`. This curated prop wins over `options.height` at mount and after it (`:options` never applies a curated key), so size the calendar through `height` itself. Runtime-updatable via `setOption`.
   */
  @property({ converter: { fromAttribute: rozieNumberOrStringAttr } }) height: string | number = 480;
  /**
   * Fallback event color stamped onto events that omit their own `color`.
   */
  @property({ type: String, reflect: true, attribute: 'default-color' }) defaultColor: string = '#3b82f6';
  /**
   * FullCalendar locale code. Runtime-updatable. An object locale is an untyped runtime escape hatch — pass it through `setOption` via the imperative handle if needed.
   */
  @property({ type: String, reflect: true }) locale: string = 'en';
  /**
   * First day of the week (`0` = Sunday … `1` = Monday). Leave it unset (`null`, the default) to use the `locale`'s first day, e.g. Monday for `de`. Runtime-updatable via `setOption`; setting it back to `null` after mount keeps the last applied day until remount.
   */
  @property({ type: Number, reflect: true, attribute: 'first-day' }) firstDay: number | null = null;
  /**
   * Time-grid slot length in `HH:mm:ss`. Runtime-updatable via `setOption`.
   */
  @property({ type: String, reflect: true, attribute: 'slot-duration' }) slotDuration: string = '00:30:00';
  /**
   * Render the current-time indicator line in time-grid views. Runtime-updatable via `setOption`.
   */
  @property({ type: Boolean, reflect: true, attribute: 'now-indicator' }) nowIndicator: boolean = false;
  /**
   * The toolbar layout (`{ left, center, right }`). A consumer-passed object **fully replaces** the built-in default rather than merging with it. Runtime-updatable via `setOption`.
   */
  @property({ type: Object, attribute: 'header-toolbar' }) headerToolbar: any = {
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay'
};
  /**
   * Long-tail passthrough — an arbitrary bag of FullCalendar options/callbacks the curated surface does not special-case (`businessHours`, `dayMaxEvents`, `*DidMount` hooks, locale objects, …). Curated keys (the props above, `events`, every wrapped callback and filled `*Content` slot) always win: `:options` never overrides them, at mount or later. Runtime-updatable per key via `setOption`, and only for keys whose value actually changed — plain arrays and objects compare by content, so an inline literal re-created on every parent render (an inline `eventSources` list, say) does not refetch. Functions compare by identity. A removed key keeps its last applied value until remount; use `getApi()` for full imperative control. The `plugins` key is the one exception that **merges** with the baked-in defaults instead of overriding them, making the wrapper consumer-extensible.
   */
  @property({ type: Object }) options: any = {};
  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;
private __rozieWatchInitial_1 = true;
private __rozieFirstUpdateDone = false;
private _portalContainers = new Set<HTMLElement>();
private portals = {
  event: (container: HTMLElement, scope: { arg: EventContentArg }): (() => void) => {
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
  dayCell: (container: HTMLElement, scope: { arg: DayCellContentArg }): (() => void) => {
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
  dayHeader: (container: HTMLElement, scope: { arg: DayHeaderContentArg }): (() => void) => {
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
  slotLabel: (container: HTMLElement, scope: { arg: SlotLabelContentArg }): (() => void) => {
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
  weekNumber: (container: HTMLElement, scope: { arg: WeekNumberContentArg }): (() => void) => {
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
  nowIndicatorContent: (container: HTMLElement, scope: { arg: NowIndicatorContentArg }): (() => void) => {
    const tpl = this.nowIndicatorContent;
    if (typeof tpl !== 'function') return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-nowIndicatorContent', '5589629a');
    render(tpl(scope), container);
    this._portalContainers.add(container);
    return () => {
      render(nothing, container);
      this._portalContainers.delete(container);
    };
  },
  moreLink: (container: HTMLElement, scope: { arg: MoreLinkContentArg }): (() => void) => {
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
  allDayContent: (container: HTMLElement, scope: { arg: AllDayContentArg }): (() => void) => {
    const tpl = this.allDayContent;
    if (typeof tpl !== 'function') return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-allDayContent', '5589629a');
    render(tpl(scope), container);
    this._portalContainers.add(container);
    return () => {
      render(nothing, container);
      this._portalContainers.delete(container);
    };
  },
  slotLaneContent: (container: HTMLElement, scope: { arg: SlotLaneContentArg }): (() => void) => {
    const tpl = this.slotLaneContent;
    if (typeof tpl !== 'function') return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-slotLaneContent', '5589629a');
    render(tpl(scope), container);
    this._portalContainers.add(container);
    return () => {
      render(nothing, container);
      this._portalContainers.delete(container);
    };
  },
  noEventsContent: (container: HTMLElement, scope: { arg: FullCalendarNoEventsContentArg }): (() => void) => {
    const tpl = this.noEventsContent;
    if (typeof tpl !== 'function') return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-noEventsContent', '5589629a');
    render(tpl(scope), container);
    this._portalContainers.add(container);
    return () => {
      render(nothing, container);
      this._portalContainers.delete(container);
    };
  },
};

  @state() private _hasSlotEvent = false;
  @queryAssignedElements({ slot: 'event', flatten: true }) private _slotEventElements!: Element[];
  @property({ attribute: false }) event?: (scope: { arg: EventContentArg }) => unknown;
  @state() private _hasSlotDayCell = false;
  @queryAssignedElements({ slot: 'dayCell', flatten: true }) private _slotDayCellElements!: Element[];
  @property({ attribute: false }) dayCell?: (scope: { arg: DayCellContentArg }) => unknown;
  @state() private _hasSlotDayHeader = false;
  @queryAssignedElements({ slot: 'dayHeader', flatten: true }) private _slotDayHeaderElements!: Element[];
  @property({ attribute: false }) dayHeader?: (scope: { arg: DayHeaderContentArg }) => unknown;
  @state() private _hasSlotSlotLabel = false;
  @queryAssignedElements({ slot: 'slotLabel', flatten: true }) private _slotSlotLabelElements!: Element[];
  @property({ attribute: false }) slotLabel?: (scope: { arg: SlotLabelContentArg }) => unknown;
  @state() private _hasSlotWeekNumber = false;
  @queryAssignedElements({ slot: 'weekNumber', flatten: true }) private _slotWeekNumberElements!: Element[];
  @property({ attribute: false }) weekNumber?: (scope: { arg: WeekNumberContentArg }) => unknown;
  @state() private _hasSlotNowIndicatorContent = false;
  @queryAssignedElements({ slot: 'nowIndicatorContent', flatten: true }) private _slotNowIndicatorContentElements!: Element[];
  @property({ attribute: false }) nowIndicatorContent?: (scope: { arg: NowIndicatorContentArg }) => unknown;
  @state() private _hasSlotMoreLink = false;
  @queryAssignedElements({ slot: 'moreLink', flatten: true }) private _slotMoreLinkElements!: Element[];
  @property({ attribute: false }) moreLink?: (scope: { arg: MoreLinkContentArg }) => unknown;
  @state() private _hasSlotAllDayContent = false;
  @queryAssignedElements({ slot: 'allDayContent', flatten: true }) private _slotAllDayContentElements!: Element[];
  @property({ attribute: false }) allDayContent?: (scope: { arg: AllDayContentArg }) => unknown;
  @state() private _hasSlotSlotLaneContent = false;
  @queryAssignedElements({ slot: 'slotLaneContent', flatten: true }) private _slotSlotLaneContentElements!: Element[];
  @property({ attribute: false }) slotLaneContent?: (scope: { arg: SlotLaneContentArg }) => unknown;
  @state() private _hasSlotNoEventsContent = false;
  @queryAssignedElements({ slot: 'noEventsContent', flatten: true }) private _slotNoEventsContentElements!: Element[];
  @property({ attribute: false }) noEventsContent?: (scope: { arg: FullCalendarNoEventsContentArg }) => unknown;
  // Phase 79 Plan 08 (R4) contract for 79-09: the record intake for
  // record-routed slot fills. 79-09's consumer-side emitSlotFiller
  // accumulates an object literal onto the SAME `.rozieSlots=${{ ... }}`
  // open-tag binding; the KEY is the fill's authored (possibly
  // non-identifier) name and the VALUE is a scope-taking render
  // function. `rozieSlots?.[name]` must be checked BEFORE the legacy
  // named function-prop / <slot> fallback (AC-9). Attribute
  // deserialization is disabled — this is a function-valued record,
  // never reflected to/from an HTML attribute.
  @property({ attribute: false }) rozieSlots?: Record<string, (scope: any) => unknown>;

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
      const slotEl = this.shadowRoot?.querySelector('slot[name="nowIndicatorContent"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotNowIndicatorContent = this._slotNowIndicatorContentElements.length > 0; };
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

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="allDayContent"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotAllDayContent = this._slotAllDayContentElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="slotLaneContent"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotSlotLaneContent = this._slotSlotLaneContentElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="noEventsContent"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotNoEventsContent = this._slotNoEventsContentElements.length > 0; };
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
    this._hasSlotNowIndicatorContent = Array.from(this.children).some((el) => el.getAttribute('slot') === 'nowIndicatorContent');
    this._hasSlotMoreLink = Array.from(this.children).some((el) => el.getAttribute('slot') === 'moreLink');
    this._hasSlotAllDayContent = Array.from(this.children).some((el) => el.getAttribute('slot') === 'allDayContent');
    this._hasSlotSlotLaneContent = Array.from(this.children).some((el) => el.getAttribute('slot') === 'slotLaneContent');
    this._hasSlotNoEventsContent = Array.from(this.children).some((el) => el.getAttribute('slot') === 'noEventsContent');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    adoptDocumentStyles(this);

    this._armListeners();

    this._disconnectCleanups.push((() => {
      this.instance?.destroy();
      this.instance = null;
      this.eventsSource = null;
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.view)(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } ((v: any) => {
      if (!this.instance || !v) return;
      if (v === this.instance.view.type) return;
      this.suppressViewSync = true;
      this.instance.changeView(v);
    })(__watchVal); }); }));

    // The curated config — every key the wrapper owns. The `:options`
    // passthrough below fills only the gaps (curated keys always win).
    //
    // EXCEPTION — `plugins` is the one curated key that AUGMENTS rather than
    // overrides: instead of clobbering a consumer-supplied `:options.plugins`,
    // it MERGES the always-on baked-in defaults (dayGrid + timeGrid +
    // interaction) with any consumer-added plugins. This makes the wrapper
    // consumer-extensible (opt-in) — a consumer can engage list/rrule/premium/
    // etc. via `:options="{ plugins: [listPlugin] }"` with NO bundle cost and NO
    // per-plugin wrapper code. FullCalendar dedupes plugins by identity, so a
    // consumer re-passing a default is harmless.
    // A null-let (typeNeutralize → `any` in every leaf): keys are added below
    // (`firstDay`, the filled *Content slots), which a strict object-literal type
    // would reject (TS2339).
    let curated: any = null;
    curated = {
      plugins: [...this.PLUGINS, ...(this.options?.plugins ?? [])],
      initialView: this.view,
      weekends: this.weekends,
      editable: this.editable,
      selectable: this.selectable,
      height: this.normalizeHeight(this.height),
      locale: this.locale,
      slotDuration: this.slotDuration,
      nowIndicator: this.nowIndicator,
      // D-02: a consumer-passed headerToolbar fully REPLACES the built-in
      // toolbar; the built-in default lives in the `headerToolbar` prop default.
      headerToolbar: this.headerToolbar,
      eventClick: (info: any) => {
        this.dispatchEvent(new CustomEvent<FullCalendarEventClick>("event-click", {
          detail: {
            event: this.eventRef(info.event),
            jsEvent: info.jsEvent,
            el: info.el
          },
          bubbles: true,
          composed: true
        }));
      },
      dateClick: (info: any) => {
        this.dispatchEvent(new CustomEvent<FullCalendarDateClick>("date-click", {
          detail: {
            date: info.date,
            dateStr: info.dateStr,
            allDay: info.allDay,
            dayEl: info.dayEl,
            jsEvent: info.jsEvent
          },
          bubbles: true,
          composed: true
        }));
      },
      eventDrop: (info: any) => {
        this.dispatchEvent(new CustomEvent<FullCalendarEventDrop>("event-drop", {
          detail: {
            event: this.eventRef(info.event),
            oldEvent: this.eventRef(info.oldEvent),
            delta: info.delta,
            revert: info.revert
          },
          bubbles: true,
          composed: true
        }));
      },
      select: (info: any) => {
        this.dispatchEvent(new CustomEvent<FullCalendarSelection>("select", {
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
        this.dispatchEvent(new CustomEvent<FullCalendarEventResize>("event-resize", {
          detail: {
            event: this.eventRef(info.event),
            oldEvent: this.eventRef(info.oldEvent),
            startDelta: info.startDelta,
            endDelta: info.endDelta,
            revert: info.revert
          },
          bubbles: true,
          composed: true
        }));
      },
      datesSet: (info: any) => {
        this.dispatchEvent(new CustomEvent<FullCalendarDatesSet>("dates-set", {
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
        this.dispatchEvent(new CustomEvent<FullCalendarEventPointer>("event-mouse-enter", {
          detail: {
            event: this.eventRef(info.event),
            jsEvent: info.jsEvent,
            el: info.el
          },
          bubbles: true,
          composed: true
        }));
      },
      eventMouseLeave: (info: any) => {
        this.dispatchEvent(new CustomEvent<FullCalendarEventPointer>("event-mouse-leave", {
          detail: {
            event: this.eventRef(info.event),
            jsEvent: info.jsEvent,
            el: info.el
          },
          bubbles: true,
          composed: true
        }));
      },
      unselect: (info: any) => {
        this.dispatchEvent(new CustomEvent<FullCalendarUnselect>("unselect", {
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
        this.dispatchEvent(new CustomEvent<FullCalendarLoading>("loading", {
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
        this.dispatchEvent(new CustomEvent<FullCalendarEventsSet>("events-set", {
          detail: {
            events: events.map(this.eventRef)
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
      },
      eventDidMount: (info: any) => {
        // Every event is focusable (the wrapper always handles eventClick), so an
        // untitled one needs an accessible name. A consumer's own
        // `options.eventDidMount` still runs, read live so updates apply.
        if (!info.event.title && info.el && !info.el.hasAttribute('aria-label')) {
          info.el.setAttribute('aria-label', info.timeText ? `Untitled event, ${info.timeText}` : 'Untitled event');
        }
        const own = this.options?.eventDidMount;
        if (typeof own === 'function') own(info);
      }
    };
    // Unset (null) keeps the locale's own first day. Never pass the key empty:
    // FullCalendar's Number refiner would turn `undefined` into NaN.
    // Unset (null) keeps the locale's own first day. Never pass the key empty:
    // FullCalendar's Number refiner would turn `undefined` into NaN.
    if (typeof this.firstDay === 'number') curated.firstDay = this.firstDay;

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
      curated.eventContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = this.portals.event(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    // The 9 remaining *Content portal-slots — wired identically to `event`, one
    // per FullCalendar per-cell content hook. Each guarded by its own slot so
    // unfilled slots keep FullCalendar's default rendering (or an
    // `options.*Content` passthrough). (10 portal-slots total counting `event`
    // above; allDayContent + slotLaneContent are the two timeGrid axis/lane
    // hooks, and noEventsContent is the list-view "no events" hook — inert
    // unless the consumer engages @fullcalendar/list via :options.plugins.)
    //
    // NOTE the `nowIndicatorContent` slot is named for its FullCalendar engine
    // hook (`nowIndicatorContent`) so it does NOT clash with the boolean
    // `nowIndicator` PROP — a slot name that equals a declared prop name is now a
    // hard compile error (ROZ127 SLOT_PROP_NAME_COLLISION), because Svelte 5
    // unifies snippets and props into one `$props` namespace.
    // The 9 remaining *Content portal-slots — wired identically to `event`, one
    // per FullCalendar per-cell content hook. Each guarded by its own slot so
    // unfilled slots keep FullCalendar's default rendering (or an
    // `options.*Content` passthrough). (10 portal-slots total counting `event`
    // above; allDayContent + slotLaneContent are the two timeGrid axis/lane
    // hooks, and noEventsContent is the list-view "no events" hook — inert
    // unless the consumer engages @fullcalendar/list via :options.plugins.)
    //
    // NOTE the `nowIndicatorContent` slot is named for its FullCalendar engine
    // hook (`nowIndicatorContent`) so it does NOT clash with the boolean
    // `nowIndicator` PROP — a slot name that equals a declared prop name is now a
    // hard compile error (ROZ127 SLOT_PROP_NAME_COLLISION), because Svelte 5
    // unifies snippets and props into one `$props` namespace.
    if (this.dayCell !== undefined) {
      curated.dayCellContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = this.portals.dayCell(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.dayHeader !== undefined) {
      curated.dayHeaderContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = this.portals.dayHeader(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.slotLabel !== undefined) {
      curated.slotLabelContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = this.portals.slotLabel(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.weekNumber !== undefined) {
      curated.weekNumberContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = this.portals.weekNumber(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.nowIndicatorContent !== undefined) {
      curated.nowIndicatorContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = this.portals.nowIndicatorContent(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.moreLink !== undefined) {
      curated.moreLinkContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = this.portals.moreLink(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.allDayContent !== undefined) {
      curated.allDayContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = this.portals.allDayContent(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if (this.slotLaneContent !== undefined) {
      curated.slotLaneContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = this.portals.slotLaneContent(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    // noEventsContent — the list-view "no events to display" hook. Pre-declared
    // and wired like the other 9 *Content slots, but INERT unless the consumer
    // (a) engages @fullcalendar/list via the now-merged :options.plugins AND
    // (b) shows a list view (listWeek/listDay/listMonth) with ZERO events. With
    // the bundled-only plugin set there is no list view, so this hook never fires
    // — by design, documented, zero bundle cost.
    // noEventsContent — the list-view "no events to display" hook. Pre-declared
    // and wired like the other 9 *Content slots, but INERT unless the consumer
    // (a) engages @fullcalendar/list via the now-merged :options.plugins AND
    // (b) shows a list view (listWeek/listDay/listMonth) with ZERO events. With
    // the bundled-only plugin set there is no list view, so this hook never fires
    // — by design, documented, zero bundle cost.
    if (this.noEventsContent !== undefined) {
      curated.noEventsContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = this.portals.noEventsContent(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }

    // `events` is curated too: the prop owns its own event source (below), so an
    // `options.events` is ignored, exactly as before.
    // `events` is curated too: the prop owns its own event source (below), so an
    // `options.events` is ignored, exactly as before.
    this.curatedKeys = new Set([...Object.keys(curated), 'events']);
    const passthrough = Object.fromEntries(Object.entries(this.options ?? {}).filter(([k]: any) => !this.curatedKeys.has(k)));
    this.appliedOptions = new Map(Object.entries(passthrough));
    this.instance = new Calendar(this._ref__rozieRoot, {
      ...passthrough,
      ...curated
    });
    this.eventsSource = this.instance.addEventSource(this.events.map(this.normalizeEvent));
    this.instance.render();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('events'))) { const __watchVal = (() => this.events)(); ((v: any) => {
      if (!this.instance) return;
      this.eventsSource?.remove();
      this.eventsSource = this.instance.addEventSource((v ?? []).map(this.normalizeEvent));
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('weekends'))) { const __watchVal = (() => this.weekends)(); ((v: any) => this.instance?.setOption('weekends', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('editable'))) { const __watchVal = (() => this.editable)(); ((v: any) => this.instance?.setOption('editable', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('selectable'))) { const __watchVal = (() => this.selectable)(); ((v: any) => this.instance?.setOption('selectable', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('height'))) { const __watchVal = (() => this.height)(); ((v: any) => this.instance?.setOption('height', this.normalizeHeight(v)))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('locale'))) { const __watchVal = (() => this.locale)(); ((v: any) => this.instance?.setOption('locale', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('firstDay'))) { const __watchVal = (() => this.firstDay)(); ((v: any) => {
      if (!this.instance || typeof v !== 'number') return;
      this.curatedKeys.add('firstDay');
      this.instance.setOption('firstDay', v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('slotDuration'))) { const __watchVal = (() => this.slotDuration)(); ((v: any) => this.instance?.setOption('slotDuration', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('nowIndicator'))) { const __watchVal = (() => this.nowIndicator)(); ((v: any) => this.instance?.setOption('nowIndicator', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('headerToolbar'))) { const __watchVal = (() => this.headerToolbar)(); ((v: any) => this.instance?.setOption('headerToolbar', v))(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('options'))) { const __watchVal = (() => this.options)(); ((v: any) => {
      if (!this.instance || !v) return;
      for (const k in v) {
        if (this.curatedKeys.has(k)) continue;
        if (this.sameOptionValue(this.appliedOptions.get(k), v[k])) continue;
        this.appliedOptions.set(k, v[k]);
        this.instance.setOption(k, v[k]);
      }
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
<slot name="nowIndicatorContent"></slot>
<slot name="moreLink"></slot>
<slot name="allDayContent"></slot>
<slot name="slotLaneContent"></slot>
<slot name="noEventsContent"></slot>
`;
  }

  instance: any = null;

  suppressViewSync = false;

  // The event source the `events` prop owns. Reconciling replaces only this
  // source, so events from `options.eventSources` or the `addEvent` verb survive.
  eventsSource: any = null;

  // Keys the wrapper itself sets (curated props, wrapped callbacks, filled
  // *Content slots). `:options` never overrides them, at mount or at runtime.
  curatedKeys = new Set();

  // The `:options` values last handed to FullCalendar, per key, so the runtime
  // reconcile only calls setOption for keys whose value actually changed.
  appliedOptions = new Map();

  PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin];

  // Mirrors the `height` prop default.
  DEFAULT_HEIGHT = 480;

  // A purely numeric string height ('600') means pixels. Needed because a static
  // Vue/Angular/Lit attribute arrives as a string, and Lit's String converter (see
  // the height prop) would otherwise regress `height="600"`, which the old Number
  // converter turned into 600. Any other CSS height ('auto', '100%', '32rem')
  // passes through. An empty string, null/undefined, or a non-positive number
  // falls back to the default so every target sizes the calendar the same way.
  normalizeHeight = (h: any) => {
  let v = h;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return this.DEFAULT_HEIGHT;
    if (/^\d+(\.\d+)?$/.test(t)) v = Number(t);else return t;
  }
  if (typeof v !== 'number' || !(v > 0)) return this.DEFAULT_HEIGHT;
  return v;
};

  normalizeEvent = (e: any) => {
  // Object spread — common reconcile shape: pass user props through, normalize
  // the title to a string WITHOUT inventing text (internal ids must never
  // render), and honor the wrapper's defaultColor only when the event omits one.
  return {
    ...e,
    title: e.title || '',
    color: e.color || this.defaultColor
  };
};

  // The normalized event ref every payload carries.
  eventRef = (e: any) => ({
  id: e.id,
  title: e.title,
  start: e.start,
  end: e.end,
  allDay: e.allDay
});

  // Structural equality for plain option values (arrays and plain objects by
  // content, everything else — functions included — by identity). Lets an inline
  // `:options` literal re-created on every parent render stay a no-op.
  sameOptionValue = (a: any, b: any) => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!this.sameOptionValue(a[i], b[i])) return false;
    return true;
  }
  const isPlain = (o: any) => o !== null && typeof o === 'object' && (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);
  if (isPlain(a) && isPlain(b)) {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    for (const k of ka as any) if (!(k in b) || !this.sameOptionValue(a[k], b[k])) return false;
    return true;
  }
  return false;
};

  // Imperative handle (Phase 21 $expose). The 16 calendar verbs a consumer can't
  // drive through props alone — exposed uniformly to all 6 targets
  // (Vue defineExpose / React useImperativeHandle / Svelte instance export /
  // Angular+Lit public method / Solid callback ref). Each delegates to the
  // underlying Calendar instance, which is null before $onMount and again after
  // unmount (destroyed and cleared) — callers handle the null.
  //
  // Collision discipline (the load-bearing flatpickr lesson): no exposed name may
  // collide with an emitted event (eventClick/dateClick/eventDrop/eventResize/
  // datesSet/eventMouseEnter/eventMouseLeave/eventsSet/loading/select/unselect) or
  // a declared prop. This is why the selection verbs are NAMED `selectRange`
  // (CalendarApi.select) and `clearSelection` (CalendarApi.unselect) — bare
  // `select`/`unselect` collide with the same-named emits (ROZ121), and `select`
  // is also Lit-risky. getApi returns the raw Calendar instance (NOT guard-nulled).
  //
  // Read-back gap closed: getDate (current anchor — the `view` model only carries
  // the view TYPE, datesSet only the visible RANGE) and getEvents (synchronous
  // event read — eventsSet is push-only). scrollToTime/updateSize cover timeGrid
  // scroll + container-resize relayout; prevYear/nextYear mirror prev/next.
  getApi(): Calendar | null;
  getApi() {
    return this.instance;
  }

  changeView(viewType: string, dateOrRange?: DateRangeInput | DateInput): void;
  changeView(...a: any[]) {
    return this.instance?.changeView(...a);
  }

  // Normalized like the `events` prop (title, defaultColor).
  addEvent(event: EventInput, source?: EventSourceApi | string | boolean): EventApi | null | undefined;
  addEvent(event: any, source: any) {
    return this.instance?.addEvent(this.normalizeEvent(event), source);
  }

  removeEvent(id: string): void;
  removeEvent(id: any) {
    this.instance?.getEventById(id)?.remove();
  }

  today(): void;
  today() {
    this.instance?.today();
  }

  prev(): void;
  prev() {
    this.instance?.prev();
  }

  next(): void;
  next() {
    this.instance?.next();
  }

  gotoDate(date: DateInput): void;
  gotoDate(...a: any[]) {
    this.instance?.gotoDate(...a);
  }

  getDate(): Date | null;
  getDate() {
    return this.instance ? this.instance.getDate() : null;
  }

  getEvents(): EventApi[];
  getEvents() {
    return this.instance ? this.instance.getEvents() : [];
  }

  scrollToTime(time: DurationInput): void;
  scrollToTime(...a: any[]) {
    this.instance?.scrollToTime(...a);
  }

  updateSize(): void;
  updateSize() {
    this.instance?.updateSize();
  }

  prevYear(): void;
  prevYear() {
    this.instance?.prevYear();
  }

  nextYear(): void;
  nextYear() {
    this.instance?.nextYear();
  }

  selectRange(dateOrSpan: DateInput | DateSpanInput, end?: DateInput): void;
  selectRange(...a: any[]) {
    this.instance?.select(...a);
  }

  clearSelection(): void;
  clearSelection() {
    this.instance?.unselect();
  }

  get view(): string { return this._viewControllable.read(); }
  set view(v: string) { this._viewControllable.notifyPropertyWrite(v); }

  addEventListener<K extends keyof RozieFullCalendarEventMap>(type: K, listener: (this: FullCalendar, ev: RozieFullCalendarEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
    super.addEventListener(type, listener, options);
  }
  removeEventListener<K extends keyof RozieFullCalendarEventMap>(type: K, listener: (this: FullCalendar, ev: RozieFullCalendarEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
    super.removeEventListener(type, listener, options);
  }
}
