import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useControllableState } from '@rozie/runtime-react';
import './FullCalendar.css';
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

interface EventCtx { arg: EventContentArg; }

interface DayCellCtx { arg: DayCellContentArg; }

interface DayHeaderCtx { arg: DayHeaderContentArg; }

interface SlotLabelCtx { arg: SlotLabelContentArg; }

interface WeekNumberCtx { arg: WeekNumberContentArg; }

interface NowIndicatorContentCtx { arg: NowIndicatorContentArg; }

interface MoreLinkCtx { arg: MoreLinkContentArg; }

interface AllDayContentCtx { arg: AllDayContentArg; }

interface SlotLaneContentCtx { arg: SlotLaneContentArg; }

interface NoEventsContentCtx { arg: FullCalendarNoEventsContentArg; }

interface FullCalendarProps {
  /**
   * The event objects rendered on the calendar. Each event is normalized: a missing `title` renders as an empty title (the wrapper never invents one from the event id; an untitled event gets an `aria-label` so it still has an accessible name), and a missing `color` inherits `defaultColor`. Runtime-updatable — changing the array replaces only the events this prop supplied; events from `options.eventSources` or added through the `addEvent` verb are kept.
   */
  events?: any[];
  /**
   * The two-way active view name (`'dayGridMonth'`, `'timeGridWeek'`, `'timeGridDay'`, …) — the sole `model: true` prop. The calendar's own toolbar writes the new view name back through the two-way path, and a consumer write switches the view via `changeView`.
   * @example
   * <FullCalendar view={view} onViewChange={setView} events={events} />
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
   * The calendar height: a pixel number (`480`) or any CSS height FullCalendar accepts (`'auto'`, `'100%'`, `'32rem'`, …). A purely numeric string (`'600'`, e.g. from a static attribute) is treated as pixels. An empty string, `null`, or a number that is not positive falls back to the default `480`. This curated prop wins over `options.height` at mount and after it (`:options` never applies a curated key), so size the calendar through `height` itself. Runtime-updatable via `setOption`.
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
   * First day of the week (`0` = Sunday … `1` = Monday). Leave it unset (`null`, the default) to use the `locale`'s first day, e.g. Monday for `de`. Runtime-updatable via `setOption`; setting it back to `null` after mount keeps the last applied day until remount.
   */
  firstDay?: (number) | null;
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
   * Long-tail passthrough — an arbitrary bag of FullCalendar options/callbacks the curated surface does not special-case (`businessHours`, `dayMaxEvents`, `*DidMount` hooks, locale objects, …). Curated keys (the props above, `events`, every wrapped callback and filled `*Content` slot) always win: `:options` never overrides them, at mount or later. Runtime-updatable per key via `setOption`, and only for keys whose value actually changed — plain arrays and objects compare by content, so an inline literal re-created on every parent render (an inline `eventSources` list, say) does not refetch. Functions compare by identity. A removed key keeps its last applied value until remount; use `getApi()` for full imperative control. The `plugins` key is the one exception that **merges** with the baked-in defaults instead of overriding them, making the wrapper consumer-extensible.
   */
  options?: Record<string, any>;
  onEventClick?: (payload: FullCalendarEventClick) => void;
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
  renderEvent?: (ctx: EventCtx) => ReactNode;
  renderDayCell?: (ctx: DayCellCtx) => ReactNode;
  renderDayHeader?: (ctx: DayHeaderCtx) => ReactNode;
  renderSlotLabel?: (ctx: SlotLabelCtx) => ReactNode;
  renderWeekNumber?: (ctx: WeekNumberCtx) => ReactNode;
  renderNowIndicatorContent?: (ctx: NowIndicatorContentCtx) => ReactNode;
  renderMoreLink?: (ctx: MoreLinkCtx) => ReactNode;
  renderAllDayContent?: (ctx: AllDayContentCtx) => ReactNode;
  renderSlotLaneContent?: (ctx: SlotLaneContentCtx) => ReactNode;
  renderNoEventsContent?: (ctx: NoEventsContentCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface FullCalendarHandle {
  getApi: () => Calendar | null;
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

const FullCalendar = forwardRef<FullCalendarHandle, FullCalendarProps>(function FullCalendar(_props: FullCalendarProps, ref): JSX.Element {
  const portalRoots = useRef<Set<Root>>(new Set());
  const __defaultEvents = useState(() => (() => [])())[0];
  const __defaultHeaderToolbar = useState(() => (() => ({
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  }))())[0];
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const props: Omit<FullCalendarProps, 'events' | 'weekends' | 'editable' | 'selectable' | 'height' | 'defaultColor' | 'locale' | 'firstDay' | 'slotDuration' | 'nowIndicator' | 'headerToolbar' | 'options'> & { events: any[]; weekends: boolean; editable: boolean; selectable: boolean; height: string | number; defaultColor: string; locale: string; firstDay: (number) | null; slotDuration: string; nowIndicator: boolean; headerToolbar: Record<string, any>; options: Record<string, any> } = {
    ..._props,
    events: _props.events ?? __defaultEvents,
    weekends: _props.weekends ?? true,
    editable: _props.editable ?? true,
    selectable: _props.selectable ?? true,
    height: _props.height ?? 480,
    defaultColor: _props.defaultColor ?? '#3b82f6',
    locale: _props.locale ?? 'en',
    firstDay: _props.firstDay ?? null,
    slotDuration: _props.slotDuration ?? '00:30:00',
    nowIndicator: _props.nowIndicator ?? false,
    headerToolbar: _props.headerToolbar ?? __defaultHeaderToolbar,
    options: _props.options ?? __defaultOptions,
  };
  const _renderEventRef = useRef(props.renderEvent);
  _renderEventRef.current = props.renderEvent;
  const _renderDayCellRef = useRef(props.renderDayCell);
  _renderDayCellRef.current = props.renderDayCell;
  const _renderDayHeaderRef = useRef(props.renderDayHeader);
  _renderDayHeaderRef.current = props.renderDayHeader;
  const _renderSlotLabelRef = useRef(props.renderSlotLabel);
  _renderSlotLabelRef.current = props.renderSlotLabel;
  const _renderWeekNumberRef = useRef(props.renderWeekNumber);
  _renderWeekNumberRef.current = props.renderWeekNumber;
  const _renderNowIndicatorContentRef = useRef(props.renderNowIndicatorContent);
  _renderNowIndicatorContentRef.current = props.renderNowIndicatorContent;
  const _renderMoreLinkRef = useRef(props.renderMoreLink);
  _renderMoreLinkRef.current = props.renderMoreLink;
  const _renderAllDayContentRef = useRef(props.renderAllDayContent);
  _renderAllDayContentRef.current = props.renderAllDayContent;
  const _renderSlotLaneContentRef = useRef(props.renderSlotLaneContent);
  _renderSlotLaneContentRef.current = props.renderSlotLaneContent;
  const _renderNoEventsContentRef = useRef(props.renderNoEventsContent);
  _renderNoEventsContentRef.current = props.renderNoEventsContent;
  const portals = {
    event: (container: HTMLElement, scope: { arg: EventContentArg }): (() => void) => {
      const slot = _renderEventRef.current ?? props.slots?.['event'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal event { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-event', '5589629a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    dayCell: (container: HTMLElement, scope: { arg: DayCellContentArg }): (() => void) => {
      const slot = _renderDayCellRef.current ?? props.slots?.['dayCell'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal dayCell { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-dayCell', '5589629a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    dayHeader: (container: HTMLElement, scope: { arg: DayHeaderContentArg }): (() => void) => {
      const slot = _renderDayHeaderRef.current ?? props.slots?.['dayHeader'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal dayHeader { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-dayHeader', '5589629a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    slotLabel: (container: HTMLElement, scope: { arg: SlotLabelContentArg }): (() => void) => {
      const slot = _renderSlotLabelRef.current ?? props.slots?.['slotLabel'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal slotLabel { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-slotLabel', '5589629a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    weekNumber: (container: HTMLElement, scope: { arg: WeekNumberContentArg }): (() => void) => {
      const slot = _renderWeekNumberRef.current ?? props.slots?.['weekNumber'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal weekNumber { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-weekNumber', '5589629a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    nowIndicatorContent: (container: HTMLElement, scope: { arg: NowIndicatorContentArg }): (() => void) => {
      const slot = _renderNowIndicatorContentRef.current ?? props.slots?.['nowIndicatorContent'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal nowIndicatorContent { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-nowIndicatorContent', '5589629a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    moreLink: (container: HTMLElement, scope: { arg: MoreLinkContentArg }): (() => void) => {
      const slot = _renderMoreLinkRef.current ?? props.slots?.['moreLink'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal moreLink { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-moreLink', '5589629a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    allDayContent: (container: HTMLElement, scope: { arg: AllDayContentArg }): (() => void) => {
      const slot = _renderAllDayContentRef.current ?? props.slots?.['allDayContent'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal allDayContent { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-allDayContent', '5589629a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    slotLaneContent: (container: HTMLElement, scope: { arg: SlotLaneContentArg }): (() => void) => {
      const slot = _renderSlotLaneContentRef.current ?? props.slots?.['slotLaneContent'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal slotLaneContent { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-slotLaneContent', '5589629a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    noEventsContent: (container: HTMLElement, scope: { arg: FullCalendarNoEventsContentArg }): (() => void) => {
      const slot = _renderNoEventsContentRef.current ?? props.slots?.['noEventsContent'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal noEventsContent { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-noEventsContent', '5589629a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
  };
  const suppressViewSync = useRef(false);
  const curatedKeys = useRef(new Set());
  const appliedOptions = useRef(new Map());
  const instance = useRef<any>(null);
  const eventsSource = useRef<any>(null);
  const [view, setView] = useControllableState({
    value: props.view,
    defaultValue: props.defaultView ?? 'dayGridMonth',
    onValueChange: props.onViewChange,
  });
  const _editableRef = useRef(props.editable);
  _editableRef.current = props.editable;
  const _eventsRef = useRef(props.events);
  _eventsRef.current = props.events;
  const _firstDayRef = useRef(props.firstDay);
  _firstDayRef.current = props.firstDay;
  const _headerToolbarRef = useRef(props.headerToolbar);
  _headerToolbarRef.current = props.headerToolbar;
  const _heightRef = useRef(props.height);
  _heightRef.current = props.height;
  const _localeRef = useRef(props.locale);
  _localeRef.current = props.locale;
  const _nowIndicatorRef = useRef(props.nowIndicator);
  _nowIndicatorRef.current = props.nowIndicator;
  const _onDateClickRef = useRef(props.onDateClick);
  _onDateClickRef.current = props.onDateClick;
  const _onDatesSetRef = useRef(props.onDatesSet);
  _onDatesSetRef.current = props.onDatesSet;
  const _onEventClickRef = useRef(props.onEventClick);
  _onEventClickRef.current = props.onEventClick;
  const _onEventDropRef = useRef(props.onEventDrop);
  _onEventDropRef.current = props.onEventDrop;
  const _onEventMouseEnterRef = useRef(props.onEventMouseEnter);
  _onEventMouseEnterRef.current = props.onEventMouseEnter;
  const _onEventMouseLeaveRef = useRef(props.onEventMouseLeave);
  _onEventMouseLeaveRef.current = props.onEventMouseLeave;
  const _onEventResizeRef = useRef(props.onEventResize);
  _onEventResizeRef.current = props.onEventResize;
  const _onEventsSetRef = useRef(props.onEventsSet);
  _onEventsSetRef.current = props.onEventsSet;
  const _onLoadingRef = useRef(props.onLoading);
  _onLoadingRef.current = props.onLoading;
  const _onSelectRef = useRef(props.onSelect);
  _onSelectRef.current = props.onSelect;
  const _onUnselectRef = useRef(props.onUnselect);
  _onUnselectRef.current = props.onUnselect;
  const _optionsRef = useRef(props.options);
  _optionsRef.current = props.options;
  const _selectableRef = useRef(props.selectable);
  _selectableRef.current = props.selectable;
  const _slotDurationRef = useRef(props.slotDuration);
  _slotDurationRef.current = props.slotDuration;
  const _weekendsRef = useRef(props.weekends);
  _weekendsRef.current = props.weekends;
  const _viewRef = useRef(view);
  _viewRef.current = view;
  const __rozieRoot = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);
  const _watch5First = useRef(true);
  const _watch6First = useRef(true);
  const _watch7First = useRef(true);
  const _watch8First = useRef(true);
  const _watch9First = useRef(true);
  const _watch10First = useRef(true);
  const _watch11First = useRef(true);

  // The `:options` values last handed to FullCalendar, per key, so the runtime
  // reconcile only calls setOption for keys whose value actually changed.
  // Keys the wrapper itself sets (curated props, wrapped callbacks, filled
  // *Content slots). `:options` never overrides them, at mount or at runtime.
  // The event source the `events` prop owns. Reconciling replaces only this
  // source, so events from `options.eventSources` or the `addEvent` verb survive.
  const PLUGINS = useMemo(() => [dayGridPlugin, timeGridPlugin, interactionPlugin], []);
  // Mirrors the `height` prop default.
  const DEFAULT_HEIGHT = useMemo(() => 480, []);
  // A purely numeric string height ('600') means pixels. Needed because a static
  // Vue/Angular/Lit attribute arrives as a string, and Lit's String converter (see
  // the height prop) would otherwise regress `height="600"`, which the old Number
  // converter turned into 600. Any other CSS height ('auto', '100%', '32rem')
  // passes through. An empty string, null/undefined, or a non-positive number
  // falls back to the default so every target sizes the calendar the same way.
  const normalizeHeight = useCallback((h: any) => {
    let v = h;
    if (typeof v === 'string') {
      const t = v.trim();
      if (t === '') return DEFAULT_HEIGHT;
      if (/^\d+(\.\d+)?$/.test(t)) v = Number(t);else return t;
    }
    if (typeof v !== 'number' || !(v > 0)) return DEFAULT_HEIGHT;
    return v;
  }, []);
  const normalizeEvent = useCallback((e: any) => {
    // Object spread — common reconcile shape: pass user props through, normalize
    // the title to a string WITHOUT inventing text (internal ids must never
    // render), and honor the wrapper's defaultColor only when the event omits one.
    return {
      ...e,
      title: e.title || '',
      color: e.color || props.defaultColor
    };
  }, [props.defaultColor]);
  // The normalized event ref every payload carries.
  const eventRef = useCallback((e: any) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay
  }), []);
  // Structural equality for plain option values (arrays and plain objects by
  // content, everything else — functions included — by identity). Lets an inline
  // `:options` literal re-created on every parent render stay a no-op.
  function sameOptionValue(a: any, b: any) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!sameOptionValue(a[i], b[i])) return false;
      return true;
    }
    const isPlain = (o: any) => o !== null && typeof o === 'object' && (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);
    if (isPlain(a) && isPlain(b)) {
      const ka = Object.keys(a);
      if (ka.length !== Object.keys(b).length) return false;
      for (const k of ka as any) if (!(k in b) || !sameOptionValue(a[k], b[k])) return false;
      return true;
    }
    return false;
  }
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
  function getApi() {
    return instance.current;
  }
  function changeView(...a: any[]) {
    return instance.current?.changeView(...a);
  }
  // Normalized like the `events` prop (title, defaultColor).
  function addEvent(event: any, source: any) {
    return instance.current?.addEvent(normalizeEvent(event), source);
  }
  function removeEvent(id: any) {
    instance.current?.getEventById(id)?.remove();
  }
  function today() {
    instance.current?.today();
  }
  function prev() {
    instance.current?.prev();
  }
  function next() {
    instance.current?.next();
  }
  function gotoDate(...a: any[]) {
    instance.current?.gotoDate(...a);
  }
  function getDate() {
    return instance.current ? instance.current.getDate() : null;
  }
  function getEvents() {
    return instance.current ? instance.current.getEvents() : [];
  }
  function scrollToTime(...a: any[]) {
    instance.current?.scrollToTime(...a);
  }
  function updateSize() {
    instance.current?.updateSize();
  }
  function prevYear() {
    instance.current?.prevYear();
  }
  function nextYear() {
    instance.current?.nextYear();
  }
  function selectRange(...a: any[]) {
    instance.current?.select(...a);
  }
  function clearSelection() {
    instance.current?.unselect();
  }

  useEffect(() => {
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
      plugins: [...PLUGINS, ...(_optionsRef.current?.plugins ?? [])],
      initialView: _viewRef.current,
      weekends: _weekendsRef.current,
      editable: _editableRef.current,
      selectable: _selectableRef.current,
      height: normalizeHeight(_heightRef.current),
      locale: _localeRef.current,
      slotDuration: _slotDurationRef.current,
      nowIndicator: _nowIndicatorRef.current,
      // D-02: a consumer-passed headerToolbar fully REPLACES the built-in
      // toolbar; the built-in default lives in the `headerToolbar` prop default.
      headerToolbar: _headerToolbarRef.current,
      eventClick: (info: any) => {
        _onEventClickRef.current && _onEventClickRef.current({
          event: eventRef(info.event),
          jsEvent: info.jsEvent,
          el: info.el
        });
      },
      dateClick: (info: any) => {
        _onDateClickRef.current && _onDateClickRef.current({
          date: info.date,
          dateStr: info.dateStr,
          allDay: info.allDay,
          dayEl: info.dayEl,
          jsEvent: info.jsEvent
        });
      },
      eventDrop: (info: any) => {
        _onEventDropRef.current && _onEventDropRef.current({
          event: eventRef(info.event),
          oldEvent: eventRef(info.oldEvent),
          delta: info.delta,
          revert: info.revert
        });
      },
      select: (info: any) => {
        _onSelectRef.current && _onSelectRef.current({
          start: info.start,
          end: info.end,
          startStr: info.startStr,
          endStr: info.endStr,
          allDay: info.allDay
        });
      },
      eventResize: (info: any) => {
        _onEventResizeRef.current && _onEventResizeRef.current({
          event: eventRef(info.event),
          oldEvent: eventRef(info.oldEvent),
          startDelta: info.startDelta,
          endDelta: info.endDelta,
          revert: info.revert
        });
      },
      datesSet: (info: any) => {
        _onDatesSetRef.current && _onDatesSetRef.current({
          start: info.start,
          end: info.end,
          view: info.view.type
        });
      },
      eventMouseEnter: (info: any) => {
        _onEventMouseEnterRef.current && _onEventMouseEnterRef.current({
          event: eventRef(info.event),
          jsEvent: info.jsEvent,
          el: info.el
        });
      },
      eventMouseLeave: (info: any) => {
        _onEventMouseLeaveRef.current && _onEventMouseLeaveRef.current({
          event: eventRef(info.event),
          jsEvent: info.jsEvent,
          el: info.el
        });
      },
      unselect: (info: any) => {
        _onUnselectRef.current && _onUnselectRef.current({
          jsEvent: info.jsEvent
        });
      },
      loading: (isLoading: any) => {
        // FullCalendar's `loading` callback receives a bare boolean (not an info
        // object) — normalize to the structured `{ isLoading }` payload shape.
        _onLoadingRef.current && _onLoadingRef.current({
          isLoading
        });
      },
      eventsSet: (events: any) => {
        // `eventsSet` receives the array of current EventApi objects — map each to
        // the normalized floor shape for persistence/sync consumers.
        _onEventsSetRef.current && _onEventsSetRef.current({
          events: events.map(eventRef)
        });
      },
      viewDidMount: (info: any) => {
        // viewDidMount fires both on initial mount AND on changeView calls.
        // Same round-trip guard pattern as Flatpickr / LeafletMap.
        if (suppressViewSync.current) {
          suppressViewSync.current = false;
          return;
        }
        if (info.view.type !== _viewRef.current) setView(info.view.type);
      },
      eventDidMount: (info: any) => {
        // Every event is focusable (the wrapper always handles eventClick), so an
        // untitled one needs an accessible name. A consumer's own
        // `options.eventDidMount` still runs, read live so updates apply.
        if (!info.event.title && info.el && !info.el.hasAttribute('aria-label')) {
          info.el.setAttribute('aria-label', info.timeText ? `Untitled event, ${info.timeText}` : 'Untitled event');
        }
        const own = _optionsRef.current?.eventDidMount;
        if (typeof own === 'function') own(info);
      }
    };
    // Unset (null) keeps the locale's own first day. Never pass the key empty:
    // FullCalendar's Number refiner would turn `undefined` into NaN.
    if (typeof _firstDayRef.current === 'number') curated.firstDay = _firstDayRef.current;

    // Portal-slot primitive (Spike 003) — when a consumer supplies an `event`
    // slot, route every cell render through it. The portal helper mounts the
    // consumer's framework-native fragment (React JSX, Vue VNodes, Svelte
    // Snippet, etc.) into a DOM container that FullCalendar owns; the dispose
    // handle is returned to FullCalendar so it cleans up the mounted tree when
    // the cell is removed. Consumers that don't fill the slot get FullCalendar's
    // default rendering (title text) — guarded by `$slots.event`.
    if ((props.renderEvent ?? props.slots?.["event"])) {
      curated.eventContent = (arg: any) => {
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
    if ((props.renderDayCell ?? props.slots?.["dayCell"])) {
      curated.dayCellContent = (arg: any) => {
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
    if ((props.renderDayHeader ?? props.slots?.["dayHeader"])) {
      curated.dayHeaderContent = (arg: any) => {
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
    if ((props.renderSlotLabel ?? props.slots?.["slotLabel"])) {
      curated.slotLabelContent = (arg: any) => {
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
    if ((props.renderWeekNumber ?? props.slots?.["weekNumber"])) {
      curated.weekNumberContent = (arg: any) => {
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
    if ((props.renderNowIndicatorContent ?? props.slots?.["nowIndicatorContent"])) {
      curated.nowIndicatorContent = (arg: any) => {
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
    if ((props.renderMoreLink ?? props.slots?.["moreLink"])) {
      curated.moreLinkContent = (arg: any) => {
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
    if ((props.renderAllDayContent ?? props.slots?.["allDayContent"])) {
      curated.allDayContent = (arg: any) => {
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
    if ((props.renderSlotLaneContent ?? props.slots?.["slotLaneContent"])) {
      curated.slotLaneContent = (arg: any) => {
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
    if ((props.renderNoEventsContent ?? props.slots?.["noEventsContent"])) {
      curated.noEventsContent = (arg: any) => {
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

    // `events` is curated too: the prop owns its own event source (below), so an
    // `options.events` is ignored, exactly as before.
    curatedKeys.current = new Set([...Object.keys(curated), 'events']);
    const passthrough = Object.fromEntries(Object.entries(_optionsRef.current ?? {}).filter(([k]: any) => !curatedKeys.current.has(k)));
    appliedOptions.current = new Map(Object.entries(passthrough));
    instance.current = new Calendar(__rozieRoot.current!, {
      ...passthrough,
      ...curated
    });
    eventsSource.current = instance.current.addEventSource(_eventsRef.current.map(normalizeEvent));
    instance.current.render();
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      instance.current?.destroy();
      instance.current = null;
      eventsSource.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = props.events;
    if (!instance.current) return;
    eventsSource.current?.remove();
    eventsSource.current = instance.current.addEventSource((v ?? []).map(normalizeEvent));
  }, [props.events]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    const v = view;
    if (!instance.current || !v) return;
    if (v === instance.current.view.type) return;
    suppressViewSync.current = true;
    instance.current.changeView(v);
  }, [view]);
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    const v = props.weekends;
    instance.current?.setOption('weekends', v);
  }, [props.weekends]);
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    const v = props.editable;
    instance.current?.setOption('editable', v);
  }, [props.editable]);
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    const v = props.selectable;
    instance.current?.setOption('selectable', v);
  }, [props.selectable]);
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
    const v = props.height;
    instance.current?.setOption('height', normalizeHeight(v));
  }, [props.height]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch6First.current) { _watch6First.current = false; return; }
    const v = props.locale;
    instance.current?.setOption('locale', v);
  }, [props.locale]);
  useEffect(() => {
    if (_watch7First.current) { _watch7First.current = false; return; }
    const v = props.firstDay;
    if (!instance.current || typeof v !== 'number') return;
    curatedKeys.current.add('firstDay');
    instance.current.setOption('firstDay', v);
  }, [props.firstDay]);
  useEffect(() => {
    if (_watch8First.current) { _watch8First.current = false; return; }
    const v = props.slotDuration;
    instance.current?.setOption('slotDuration', v);
  }, [props.slotDuration]);
  useEffect(() => {
    if (_watch9First.current) { _watch9First.current = false; return; }
    const v = props.nowIndicator;
    instance.current?.setOption('nowIndicator', v);
  }, [props.nowIndicator]);
  useEffect(() => {
    if (_watch10First.current) { _watch10First.current = false; return; }
    const v = props.headerToolbar;
    instance.current?.setOption('headerToolbar', v);
  }, [props.headerToolbar]);
  useEffect(() => {
    if (_watch11First.current) { _watch11First.current = false; return; }
    const v = props.options;
    if (!instance.current || !v) return;
    for (const k in v) {
      if (curatedKeys.current.has(k)) continue;
      if (sameOptionValue(appliedOptions.current.get(k), v[k])) continue;
      appliedOptions.current.set(k, v[k]);
      instance.current.setOption(k, v[k]);
    }
  }, [props.options]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ getApi, changeView, addEvent, removeEvent, today, prev, next, gotoDate, getDate, getEvents, scrollToTime, updateSize, prevYear, nextYear, selectRange, clearSelection });
  _rozieExposeRef.current = { getApi, changeView, addEvent, removeEvent, today, prev, next, gotoDate, getDate, getEvents, scrollToTime, updateSize, prevYear, nextYear, selectRange, clearSelection };
  useImperativeHandle(ref, () => ({ getApi: (...args: Parameters<typeof getApi>): ReturnType<typeof getApi> => _rozieExposeRef.current.getApi(...args), changeView: (...args: Parameters<typeof changeView>): ReturnType<typeof changeView> => _rozieExposeRef.current.changeView(...args), addEvent: (...args: Parameters<typeof addEvent>): ReturnType<typeof addEvent> => _rozieExposeRef.current.addEvent(...args), removeEvent: (...args: Parameters<typeof removeEvent>): ReturnType<typeof removeEvent> => _rozieExposeRef.current.removeEvent(...args), today: (...args: Parameters<typeof today>): ReturnType<typeof today> => _rozieExposeRef.current.today(...args), prev: (...args: Parameters<typeof prev>): ReturnType<typeof prev> => _rozieExposeRef.current.prev(...args), next: (...args: Parameters<typeof next>): ReturnType<typeof next> => _rozieExposeRef.current.next(...args), gotoDate: (...args: Parameters<typeof gotoDate>): ReturnType<typeof gotoDate> => _rozieExposeRef.current.gotoDate(...args), getDate: (...args: Parameters<typeof getDate>): ReturnType<typeof getDate> => _rozieExposeRef.current.getDate(...args), getEvents: (...args: Parameters<typeof getEvents>): ReturnType<typeof getEvents> => _rozieExposeRef.current.getEvents(...args), scrollToTime: (...args: Parameters<typeof scrollToTime>): ReturnType<typeof scrollToTime> => _rozieExposeRef.current.scrollToTime(...args), updateSize: (...args: Parameters<typeof updateSize>): ReturnType<typeof updateSize> => _rozieExposeRef.current.updateSize(...args), prevYear: (...args: Parameters<typeof prevYear>): ReturnType<typeof prevYear> => _rozieExposeRef.current.prevYear(...args), nextYear: (...args: Parameters<typeof nextYear>): ReturnType<typeof nextYear> => _rozieExposeRef.current.nextYear(...args), selectRange: (...args: Parameters<typeof selectRange>): ReturnType<typeof selectRange> => _rozieExposeRef.current.selectRange(...args), clearSelection: (...args: Parameters<typeof clearSelection>): ReturnType<typeof clearSelection> => _rozieExposeRef.current.clearSelection(...args) }), []);

  return (
    <>
    <div className={"rozie-fullcalendar"} ref={__rozieRoot} data-rozie-s-5589629a="" />











    </>
  );
});
export default FullCalendar;
