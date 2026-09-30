import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

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
  onEventClick?: (...args: any[]) => void;
  onDateClick?: (...args: any[]) => void;
  onEventDrop?: (...args: any[]) => void;
  onSelect?: (...args: any[]) => void;
  onEventResize?: (...args: any[]) => void;
  onDatesSet?: (...args: any[]) => void;
  onEventMouseEnter?: (...args: any[]) => void;
  onEventMouseLeave?: (...args: any[]) => void;
  onUnselect?: (...args: any[]) => void;
  onLoading?: (...args: any[]) => void;
  onEventsSet?: (...args: any[]) => void;
  renderEvent?: (params: { arg: unknown }) => ReactNode;
  renderDayCell?: (params: { arg: unknown }) => ReactNode;
  renderDayHeader?: (params: { arg: unknown }) => ReactNode;
  renderSlotLabel?: (params: { arg: unknown }) => ReactNode;
  renderWeekNumber?: (params: { arg: unknown }) => ReactNode;
  renderNowIndicatorContent?: (params: { arg: unknown }) => ReactNode;
  renderMoreLink?: (params: { arg: unknown }) => ReactNode;
  renderAllDayContent?: (params: { arg: unknown }) => ReactNode;
  renderSlotLaneContent?: (params: { arg: unknown }) => ReactNode;
  renderNoEventsContent?: (params: { arg: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface FullCalendarHandle {
  getApi: (...args: any[]) => any;
  changeView: (...args: any[]) => any;
  addEvent: (...args: any[]) => any;
  removeEvent: (...args: any[]) => any;
  today: (...args: any[]) => any;
  prev: (...args: any[]) => any;
  next: (...args: any[]) => any;
  gotoDate: (...args: any[]) => any;
  getDate: (...args: any[]) => any;
  getEvents: (...args: any[]) => any;
  scrollToTime: (...args: any[]) => any;
  updateSize: (...args: any[]) => any;
  prevYear: (...args: any[]) => any;
  nextYear: (...args: any[]) => any;
  selectRange: (...args: any[]) => any;
  clearSelection: (...args: any[]) => any;
}

declare const FullCalendar: React.ForwardRefExoticComponent<FullCalendarProps & React.RefAttributes<FullCalendarHandle>>;
export default FullCalendar;
