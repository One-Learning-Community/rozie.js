import type { JSX } from 'solid-js';
import { createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { render } from 'solid-js/web';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

// The typed public surface (always TypeScript, whatever the script lang).
// Payload interfaces describe what the wrapper ACTUALLY emits (normalized
// `{ id, title, start, end }` event refs, the view TYPE string, `{ isLoading }`),
// not FullCalendar's raw callback args. Engine types come from the
// `@fullcalendar/core` peer and are re-exported so consumers can name them.
// `Calendar` is NOT imported here: the script's value import of the same name
// shares the emitted module scope on every target, so it is re-exported
// straight from the peer and the `getApi` signature names it via `import()`.
import type { DateInput, DateRangeInput, DateSpanInput, DurationInput, Duration, EventApi, EventInput, EventSourceApi, ViewApi, EventContentArg, DayCellContentArg, DayHeaderContentArg, SlotLabelContentArg, WeekNumberContentArg, NowIndicatorContentArg, MoreLinkContentArg, AllDayContentArg, SlotLaneContentArg } from '@fullcalendar/core';
export interface FullCalendarEventRef {
  id: string;
  title: string;
  start: Date | null;
  end: Date | null;
}
export interface FullCalendarEventPointer {
  event: FullCalendarEventRef;
  jsEvent: MouseEvent;
  el: HTMLElement;
}
export interface FullCalendarDateClick {
  date: Date;
  dateStr: string;
  allDay: boolean;
}
export interface FullCalendarEventDrop {
  event: FullCalendarEventRef;
  delta: Duration;
}
export interface FullCalendarSelection {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  allDay: boolean;
}
export interface FullCalendarEventResize {
  event: FullCalendarEventRef;
  startDelta: Duration;
  endDelta: Duration;
}
export interface FullCalendarDatesSet {
  start: Date;
  end: Date;
  view: string;
}
/** `jsEvent` is `null` when the selection is cleared programmatically (e.g. the `clearSelection` verb). */
export interface FullCalendarUnselect {
  jsEvent: MouseEvent | null;
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
export type { Calendar } from '@fullcalendar/core';
export type { DateInput, EventApi, EventInput, EventContentArg, DayCellContentArg, DayHeaderContentArg, SlotLabelContentArg, WeekNumberContentArg, NowIndicatorContentArg, MoreLinkContentArg, AllDayContentArg, SlotLaneContentArg };

__rozieInjectStyle('FullCalendar-5589629a', `.rozie-fullcalendar[data-rozie-s-5589629a] {
  width: 100%;
  font-size: 0.875rem;
}`);

interface EventSlotCtx { arg: EventContentArg; }

interface DayCellSlotCtx { arg: DayCellContentArg; }

interface DayHeaderSlotCtx { arg: DayHeaderContentArg; }

interface SlotLabelSlotCtx { arg: SlotLabelContentArg; }

interface WeekNumberSlotCtx { arg: WeekNumberContentArg; }

interface NowIndicatorContentSlotCtx { arg: NowIndicatorContentArg; }

interface MoreLinkSlotCtx { arg: MoreLinkContentArg; }

interface AllDayContentSlotCtx { arg: AllDayContentArg; }

interface SlotLaneContentSlotCtx { arg: SlotLaneContentArg; }

interface NoEventsContentSlotCtx { arg: FullCalendarNoEventsContentArg; }

interface FullCalendarProps {
  /**
   * The event objects rendered on the calendar. Each event is normalized: a missing `title` renders as an empty title (the wrapper never invents one from the event id), and a missing `color` inherits `defaultColor`. Runtime-updatable — changing the array reconciles the live calendar via `removeAllEvents` + `addEvent`.
   */
  events?: any[];
  /**
   * The two-way active view name (`'dayGridMonth'`, `'timeGridWeek'`, `'timeGridDay'`, …) — the sole `model: true` prop. The calendar's own toolbar writes the new view name back through the two-way path, and a consumer write switches the view via `changeView`.
   * @example
   * <FullCalendar view={view()} onViewChange={setView} events={events} />
   */
  view?: string;
  defaultView?: string;
  onViewChange?: (view: string) => void;
  /**
   * Show the Saturday/Sunday columns. Runtime-updatable via `setOption`.
   */
  weekends?: boolean;
  /**
   * Allow events to be dragged and resized. Runtime-updatable via `setOption`.
   */
  editable?: boolean;
  /**
   * Allow date/time-range selection by click-drag. Runtime-updatable via `setOption`.
   */
  selectable?: boolean;
  /**
   * The calendar height: a pixel number (`480`) or any CSS height FullCalendar accepts (`'auto'`, `'100%'`, `'32rem'`, …). A purely numeric string (`'600'`, e.g. from a static attribute) is treated as pixels. This curated prop wins over `options.height` because curated keys are applied after the `:options` spread, so size the calendar through `height` itself. Runtime-updatable via `setOption`.
   */
  height?: string | number;
  /**
   * Fallback event color stamped onto events that omit their own `color`.
   */
  defaultColor?: string;
  /**
   * FullCalendar locale code. Runtime-updatable. An object locale is an untyped runtime escape hatch — pass it through `setOption` via the imperative handle if needed.
   */
  locale?: string;
  /**
   * First day of the week (`0` = Sunday … `1` = Monday). Runtime-updatable via `setOption`.
   */
  firstDay?: number;
  /**
   * Time-grid slot length in `HH:mm:ss`. Runtime-updatable via `setOption`.
   */
  slotDuration?: string;
  /**
   * Render the current-time indicator line in time-grid views. Runtime-updatable via `setOption`.
   */
  nowIndicator?: boolean;
  /**
   * The toolbar layout (`{ left, center, right }`). A consumer-passed object **fully replaces** the built-in default rather than merging with it. Runtime-updatable via `setOption`.
   */
  headerToolbar?: Record<string, any>;
  /**
   * Long-tail passthrough — an arbitrary bag of FullCalendar options/callbacks the curated surface does not special-case (`businessHours`, `dayMaxEvents`, `*DidMount` hooks, locale objects, …). Spread **first** into the engine config so the curated props/events/slots win on key collision; `:options` only fills gaps. Runtime-updatable per key via `setOption` (no key-removal reset — a removed key keeps its last applied value until remount; use `getApi()` for full imperative control). The `plugins` key is the one exception that **merges** with the baked-in defaults instead of overriding them, making the wrapper consumer-extensible.
   */
  options?: Record<string, any>;
  onEventClick?: (payload: FullCalendarEventPointer) => void;
  onDateClick?: (payload: FullCalendarDateClick) => void;
  onEventDrop?: (payload: FullCalendarEventDrop) => void;
  onSelect?: (payload: FullCalendarSelection) => void;
  onEventResize?: (payload: FullCalendarEventResize) => void;
  onDatesSet?: (payload: FullCalendarDatesSet) => void;
  onEventMouseEnter?: (payload: FullCalendarEventPointer) => void;
  onEventMouseLeave?: (payload: FullCalendarEventPointer) => void;
  onUnselect?: (payload: FullCalendarUnselect) => void;
  onLoading?: (payload: FullCalendarLoading) => void;
  onEventsSet?: (payload: FullCalendarEventsSet) => void;
  eventSlot?: (ctx: EventSlotCtx) => JSX.Element;
  dayCellSlot?: (ctx: DayCellSlotCtx) => JSX.Element;
  dayHeaderSlot?: (ctx: DayHeaderSlotCtx) => JSX.Element;
  slotLabelSlot?: (ctx: SlotLabelSlotCtx) => JSX.Element;
  weekNumberSlot?: (ctx: WeekNumberSlotCtx) => JSX.Element;
  nowIndicatorContentSlot?: (ctx: NowIndicatorContentSlotCtx) => JSX.Element;
  moreLinkSlot?: (ctx: MoreLinkSlotCtx) => JSX.Element;
  allDayContentSlot?: (ctx: AllDayContentSlotCtx) => JSX.Element;
  slotLaneContentSlot?: (ctx: SlotLaneContentSlotCtx) => JSX.Element;
  noEventsContentSlot?: (ctx: NoEventsContentSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: FullCalendarHandle) => void;
}

export interface FullCalendarHandle {
  getApi: () => import('@fullcalendar/core').Calendar | null;
  changeView: (viewType: string, dateOrRange?: DateRangeInput | DateInput) => void;
  addEvent: (event: EventInput, source?: EventSourceApi | string | boolean) => EventApi | null | undefined;
  removeEvent: (id: string) => void;
  today: () => void;
  prev: () => void;
  next: () => void;
  gotoDate: (date: DateInput) => void;
  getDate: () => Date | null;
  getEvents: () => EventApi[];
  scrollToTime: (time: DurationInput) => void;
  updateSize: () => void;
  prevYear: () => void;
  nextYear: () => void;
  selectRange: (dateOrSpan: DateInput | DateSpanInput, end?: DateInput) => void;
  clearSelection: () => void;
}

export default function FullCalendar(_props: FullCalendarProps): JSX.Element {
  const _merged = mergeProps({ events: (() => [])() as any[], weekends: true, editable: true, selectable: true, height: 480, defaultColor: '#3b82f6', locale: 'en', firstDay: 0, slotDuration: '00:30:00', nowIndicator: false, headerToolbar: (() => ({
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay'
}))() as Record<string, any>, options: (() => ({}))() as Record<string, any> }, _props);
  const [local, attrs] = splitProps(_merged, ['events', 'view', 'weekends', 'editable', 'selectable', 'height', 'defaultColor', 'locale', 'firstDay', 'slotDuration', 'nowIndicator', 'headerToolbar', 'options', 'ref', 'onEventClick', 'onDateClick', 'onEventDrop', 'onSelect', 'onEventResize', 'onDatesSet', 'onEventMouseEnter', 'onEventMouseLeave', 'onUnselect', 'onLoading', 'onEventsSet']);
  onMount(() => { local.ref?.({ getApi, changeView, addEvent, removeEvent, today, prev, next, gotoDate, getDate, getEvents, scrollToTime, updateSize, prevYear, nextYear, selectRange, clearSelection }); });

  const [view, setView] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'view', 'dayGridMonth');
  const portalDisposers = new Set<() => void>();
  const portals = {
    event: (container: HTMLElement, scope: { arg: EventContentArg }): (() => void) => {
      const slot = _props.eventSlot ?? _props.slots?.['event'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-event', '5589629a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    dayCell: (container: HTMLElement, scope: { arg: DayCellContentArg }): (() => void) => {
      const slot = _props.dayCellSlot ?? _props.slots?.['dayCell'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-dayCell', '5589629a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    dayHeader: (container: HTMLElement, scope: { arg: DayHeaderContentArg }): (() => void) => {
      const slot = _props.dayHeaderSlot ?? _props.slots?.['dayHeader'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-dayHeader', '5589629a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    slotLabel: (container: HTMLElement, scope: { arg: SlotLabelContentArg }): (() => void) => {
      const slot = _props.slotLabelSlot ?? _props.slots?.['slotLabel'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-slotLabel', '5589629a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    weekNumber: (container: HTMLElement, scope: { arg: WeekNumberContentArg }): (() => void) => {
      const slot = _props.weekNumberSlot ?? _props.slots?.['weekNumber'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-weekNumber', '5589629a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    nowIndicatorContent: (container: HTMLElement, scope: { arg: NowIndicatorContentArg }): (() => void) => {
      const slot = _props.nowIndicatorContentSlot ?? _props.slots?.['nowIndicatorContent'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-nowIndicatorContent', '5589629a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    moreLink: (container: HTMLElement, scope: { arg: MoreLinkContentArg }): (() => void) => {
      const slot = _props.moreLinkSlot ?? _props.slots?.['moreLink'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-moreLink', '5589629a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    allDayContent: (container: HTMLElement, scope: { arg: AllDayContentArg }): (() => void) => {
      const slot = _props.allDayContentSlot ?? _props.slots?.['allDayContent'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-allDayContent', '5589629a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    slotLaneContent: (container: HTMLElement, scope: { arg: SlotLaneContentArg }): (() => void) => {
      const slot = _props.slotLaneContentSlot ?? _props.slots?.['slotLaneContent'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-slotLaneContent', '5589629a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    noEventsContent: (container: HTMLElement, scope: { arg: FullCalendarNoEventsContentArg }): (() => void) => {
      const slot = _props.noEventsContentSlot ?? _props.slots?.['noEventsContent'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-noEventsContent', '5589629a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
  };
  onCleanup(() => {
    for (const dispose of portalDisposers) dispose();
    portalDisposers.clear();
  });
  onMount(() => {
    const _cleanup = (() => {
    const opts: Record<string, any> = {
      // :options passthrough spread FIRST — the curated keys below + the portal
      // *Content handlers added after this object override any colliding key, so
      // an explicitly-bound prop (e.g. :height) wins over options.height.
      //
      // EXCEPTION — `plugins` is the one curated key that AUGMENTS rather than
      // overrides: instead of clobbering a consumer-supplied `:options.plugins`,
      // it MERGES the always-on baked-in defaults (dayGrid + timeGrid +
      // interaction) with any consumer-added plugins. This makes the wrapper
      // consumer-extensible (opt-in) — a consumer can engage list/rrule/premium/
      // etc. via `:options="{ plugins: [listPlugin] }"` with NO bundle cost and NO
      // per-plugin wrapper code. FullCalendar dedupes plugins by identity, so a
      // consumer re-passing a default is harmless.
      ...local.options,
      plugins: [...PLUGINS, ...(local.options?.plugins ?? [])],
      initialView: view(),
      weekends: local.weekends,
      editable: local.editable,
      selectable: local.selectable,
      height: normalizeHeight(local.height),
      locale: local.locale,
      firstDay: local.firstDay,
      slotDuration: local.slotDuration,
      nowIndicator: local.nowIndicator,
      events: local.events.map(normalizeEvent),
      // D-02: a consumer-passed headerToolbar fully REPLACES the built-in
      // toolbar; the built-in default lives in the `headerToolbar` prop default.
      headerToolbar: local.headerToolbar,
      eventClick: (info: any) => {
        _props.onEventClick?.({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          jsEvent: info.jsEvent,
          el: info.el
        });
      },
      dateClick: (info: any) => {
        _props.onDateClick?.({
          date: info.date,
          dateStr: info.dateStr,
          allDay: info.allDay
        });
      },
      eventDrop: (info: any) => {
        _props.onEventDrop?.({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          delta: info.delta
        });
      },
      select: (info: any) => {
        _props.onSelect?.({
          start: info.start,
          end: info.end,
          startStr: info.startStr,
          endStr: info.endStr,
          allDay: info.allDay
        });
      },
      eventResize: (info: any) => {
        _props.onEventResize?.({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          startDelta: info.startDelta,
          endDelta: info.endDelta
        });
      },
      datesSet: (info: any) => {
        _props.onDatesSet?.({
          start: info.start,
          end: info.end,
          view: info.view.type
        });
      },
      eventMouseEnter: (info: any) => {
        _props.onEventMouseEnter?.({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          jsEvent: info.jsEvent,
          el: info.el
        });
      },
      eventMouseLeave: (info: any) => {
        _props.onEventMouseLeave?.({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          jsEvent: info.jsEvent,
          el: info.el
        });
      },
      unselect: (info: any) => {
        _props.onUnselect?.({
          jsEvent: info.jsEvent
        });
      },
      loading: (isLoading: any) => {
        // FullCalendar's `loading` callback receives a bare boolean (not an info
        // object) — normalize to the structured `{ isLoading }` payload shape.
        _props.onLoading?.({
          isLoading
        });
      },
      eventsSet: (events: any) => {
        // `eventsSet` receives the array of current EventApi objects — map each to
        // the normalized floor shape for persistence/sync consumers.
        _props.onEventsSet?.({
          events: events.map((e: any) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end
          }))
        });
      },
      viewDidMount: (info: any) => {
        // viewDidMount fires both on initial mount AND on changeView calls.
        // Same round-trip guard pattern as Flatpickr / LeafletMap.
        if (suppressViewSync) {
          suppressViewSync = false;
          return;
        }
        if (info.view.type !== view()) setView(info.view.type);
      }
    };

    // Portal-slot primitive (Spike 003) — when a consumer supplies an `event`
    // slot, route every cell render through it. The portal helper mounts the
    // consumer's framework-native fragment (React JSX, Vue VNodes, Svelte
    // Snippet, etc.) into a DOM container that FullCalendar owns; the dispose
    // handle is returned to FullCalendar so it cleans up the mounted tree when
    // the cell is removed. Consumers that don't fill the slot get FullCalendar's
    // default rendering (title text) — guarded by `$slots.event`.
    if ((_props.eventSlot ?? _props.slots?.["event"])) {
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
    // The 9 remaining *Content portal-slots — wired identically to `event`, one
    // per FullCalendar per-cell content hook. Each guarded by its own slot so
    // unfilled slots keep FullCalendar's default rendering. (10 portal-slots total
    // counting `event` above; allDayContent + slotLaneContent are the two timeGrid
    // axis/lane hooks, and noEventsContent is the list-view "no events" hook —
    // inert unless the consumer engages @fullcalendar/list via :options.plugins.)
    //
    // NOTE the `nowIndicatorContent` slot is named for its FullCalendar engine
    // hook (`nowIndicatorContent`) so it does NOT clash with the boolean
    // `nowIndicator` PROP — a slot name that equals a declared prop name is now a
    // hard compile error (ROZ127 SLOT_PROP_NAME_COLLISION), because Svelte 5
    // unifies snippets and props into one `$props` namespace.
    if ((_props.dayCellSlot ?? _props.slots?.["dayCell"])) {
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
    if ((_props.dayHeaderSlot ?? _props.slots?.["dayHeader"])) {
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
    if ((_props.slotLabelSlot ?? _props.slots?.["slotLabel"])) {
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
    if ((_props.weekNumberSlot ?? _props.slots?.["weekNumber"])) {
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
    if ((_props.nowIndicatorContentSlot ?? _props.slots?.["nowIndicatorContent"])) {
      opts.nowIndicatorContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.nowIndicatorContent(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if ((_props.moreLinkSlot ?? _props.slots?.["moreLink"])) {
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
    if ((_props.allDayContentSlot ?? _props.slots?.["allDayContent"])) {
      opts.allDayContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.allDayContent(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    if ((_props.slotLaneContentSlot ?? _props.slots?.["slotLaneContent"])) {
      opts.slotLaneContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.slotLaneContent(node, {
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
    if ((_props.noEventsContentSlot ?? _props.slots?.["noEventsContent"])) {
      opts.noEventsContent = (arg: any) => {
        const node = document.createElement('div');
        const dispose = portals.noEventsContent(node, {
          arg
        });
        return {
          domNodes: [node],
          dispose
        };
      };
    }
    instance = new Calendar(__rozieRootRef!, opts);
    instance.render();
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => instance?.destroy());
  });
  createEffect(on(() => (() => local.events)(), (v) => untrack(() => ((v: any) => {
    if (!instance) return;
    instance.removeAllEvents();
    for (const e of v as any) instance.addEvent(normalizeEvent(e));
  })(v)), { defer: true }));
  createEffect(on(() => (() => view())(), (v) => untrack(() => ((v: any) => {
    if (!instance || !v) return;
    if (v === instance.view.type) return;
    suppressViewSync = true;
    instance.changeView(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.weekends)(), (v) => untrack(() => ((v: any) => instance?.setOption('weekends', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.editable)(), (v) => untrack(() => ((v: any) => instance?.setOption('editable', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.selectable)(), (v) => untrack(() => ((v: any) => instance?.setOption('selectable', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.height)(), (v) => untrack(() => ((v: any) => instance?.setOption('height', normalizeHeight(v)))(v)), { defer: true }));
  createEffect(on(() => (() => local.locale)(), (v) => untrack(() => ((v: any) => instance?.setOption('locale', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.firstDay)(), (v) => untrack(() => ((v: any) => instance?.setOption('firstDay', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.slotDuration)(), (v) => untrack(() => ((v: any) => instance?.setOption('slotDuration', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.nowIndicator)(), (v) => untrack(() => ((v: any) => instance?.setOption('nowIndicator', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.headerToolbar)(), (v) => untrack(() => ((v: any) => instance?.setOption('headerToolbar', v))(v)), { defer: true }));
  createEffect(on(() => (() => local.options)(), (v) => untrack(() => ((v: any) => {
    if (!instance) return;
    for (const k in v) instance.setOption(k, v[k]);
  })(v)), { defer: true }));
  let __rozieRootRef: HTMLElement | null = null;

  let instance: any = null;
  let suppressViewSync = false;
  const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin];

  // A purely numeric string height ('600') means pixels. Needed because a static
  // Vue/Angular/Lit attribute arrives as a string, and Lit's String converter (see
  // the height prop) would otherwise regress `height="600"`, which the old Number
  // converter turned into 600. Anything else ('auto', '100%', '32rem', a number)
  // passes through unchanged.
  function normalizeHeight(h: any) {
    if (typeof h === 'string' && /^\d+(\.\d+)?$/.test(h.trim())) return Number(h);
    return h;
  }
  function normalizeEvent(e: any) {
    // Object spread — common reconcile shape: pass user props through, normalize
    // the title to a string WITHOUT inventing text (internal ids must never
    // render), and honor the wrapper's defaultColor only when the event omits one.
    return {
      ...e,
      title: e.title || '',
      color: e.color || local.defaultColor
    };
  }
  // Imperative handle (Phase 21 $expose). The 16 calendar verbs a consumer can't
  // drive through props alone — exposed uniformly to all 6 targets
  // (Vue defineExpose / React useImperativeHandle / Svelte instance export /
  // Angular+Lit public method / Solid callback ref). Each delegates to the
  // underlying Calendar instance, which is null before $onMount and after
  // destroy — callers handle the pre-mount null.
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
  function getApi() {
    return instance;
  }
  function changeView(...a: any[]) {
    return instance?.changeView(...a);
  }
  function addEvent(...a: any[]) {
    return instance?.addEvent(...a);
  }
  function removeEvent(id: any) {
    instance?.getEventById(id)?.remove();
  }
  function today() {
    instance?.today();
  }
  function prev() {
    instance?.prev();
  }
  function next() {
    instance?.next();
  }
  function gotoDate(...a: any[]) {
    instance?.gotoDate(...a);
  }
  function getDate() {
    return instance ? instance.getDate() : null;
  }
  function getEvents() {
    return instance ? instance.getEvents() : [];
  }
  function scrollToTime(...a: any[]) {
    instance?.scrollToTime(...a);
  }
  function updateSize() {
    instance?.updateSize();
  }
  function prevYear() {
    instance?.prevYear();
  }
  function nextYear() {
    instance?.nextYear();
  }
  function selectRange(...a: any[]) {
    instance?.select(...a);
  }
  function clearSelection() {
    instance?.unselect();
  }

  return (
    <>
    <div class={"rozie-fullcalendar"} ref={(el) => { __rozieRootRef = el as HTMLElement; }} data-rozie-s-5589629a="" />











    </>
  );
}
