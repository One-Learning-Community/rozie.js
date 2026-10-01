import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

// The typed public surface (always TypeScript, whatever the script lang).
// Payload interfaces describe what the wrapper ACTUALLY emits (normalized
// `{ id, title, start, end }` event refs, the view TYPE string, `{ isLoading }`),
// not FullCalendar's raw callback args. Engine types come from the
// `@fullcalendar/core` peer and are re-exported so consumers can name them.
import type { Calendar, DateInput, DateRangeInput, DateSpanInput, DurationInput, Duration, EventApi, EventInput, EventSourceApi, ViewApi, EventContentArg, DayCellContentArg, DayHeaderContentArg, SlotLabelContentArg, WeekNumberContentArg, NowIndicatorContentArg, MoreLinkContentArg, AllDayContentArg, SlotLaneContentArg } from '@fullcalendar/core';
export interface FullCalendarEventRef {
  id: string;
  title: string;
  start: Date | null;
  end: Date | null;
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
export type { Calendar, DateInput, EventApi, EventInput, EventContentArg, DayCellContentArg, DayHeaderContentArg, SlotLabelContentArg, WeekNumberContentArg, NowIndicatorContentArg, MoreLinkContentArg, AllDayContentArg, SlotLaneContentArg };

export interface FullCalendarProps {
  /**
   * The event objects rendered on the calendar. Each event is normalized: a missing `title` renders as an empty title (the wrapper never invents one from the event id), and a missing `color` inherits `defaultColor`. Runtime-updatable — changing the array reconciles the live calendar via `removeAllEvents` + `addEvent`.
   */
  events?: unknown[];
  /**
   * The two-way active view name (`'dayGridMonth'`, `'timeGridWeek'`, `'timeGridDay'`, …) — the sole `model: true` prop. The calendar's own toolbar writes the new view name back through the two-way path, and a consumer write switches the view via `changeView`.
   * @example
   * <FullCalendar view={view} onViewChange={setView} events={events} />
   */
  view?: string;
  defaultView?: string;
  onViewChange?: (next: string) => void;
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
  headerToolbar?: Record<string, unknown>;
  /**
   * Long-tail passthrough — an arbitrary bag of FullCalendar options/callbacks the curated surface does not special-case (`businessHours`, `dayMaxEvents`, `*DidMount` hooks, locale objects, …). Spread **first** into the engine config so the curated props/events/slots win on key collision; `:options` only fills gaps. Runtime-updatable per key via `setOption` (no key-removal reset — a removed key keeps its last applied value until remount; use `getApi()` for full imperative control). The `plugins` key is the one exception that **merges** with the baked-in defaults instead of overriding them, making the wrapper consumer-extensible.
   */
  options?: Record<string, unknown>;
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
  renderEvent?: (params: { arg: EventContentArg }) => ReactNode;
  renderDayCell?: (params: { arg: DayCellContentArg }) => ReactNode;
  renderDayHeader?: (params: { arg: DayHeaderContentArg }) => ReactNode;
  renderSlotLabel?: (params: { arg: SlotLabelContentArg }) => ReactNode;
  renderWeekNumber?: (params: { arg: WeekNumberContentArg }) => ReactNode;
  renderNowIndicatorContent?: (params: { arg: NowIndicatorContentArg }) => ReactNode;
  renderMoreLink?: (params: { arg: MoreLinkContentArg }) => ReactNode;
  renderAllDayContent?: (params: { arg: AllDayContentArg }) => ReactNode;
  renderSlotLaneContent?: (params: { arg: SlotLaneContentArg }) => ReactNode;
  renderNoEventsContent?: (params: { arg: FullCalendarNoEventsContentArg }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
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

declare const FullCalendar: React.ForwardRefExoticComponent<FullCalendarProps & React.RefAttributes<FullCalendarHandle>>;
export default FullCalendar;
