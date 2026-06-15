import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface FullCalendarProps {
  events?: unknown[];
  view?: string;
  defaultView?: string;
  onViewChange?: (next: string) => void;
  weekends?: boolean;
  editable?: boolean;
  selectable?: boolean;
  height?: number;
  defaultColor?: string;
  locale?: string;
  firstDay?: number;
  slotDuration?: string;
  nowIndicator?: boolean;
  headerToolbar?: Record<string, unknown>;
  options?: Record<string, unknown>;
  onEventClick?: (...args: unknown[]) => void;
  onDateClick?: (...args: unknown[]) => void;
  onEventDrop?: (...args: unknown[]) => void;
  onSelect?: (...args: unknown[]) => void;
  onEventResize?: (...args: unknown[]) => void;
  onDatesSet?: (...args: unknown[]) => void;
  onEventMouseEnter?: (...args: unknown[]) => void;
  onEventMouseLeave?: (...args: unknown[]) => void;
  onUnselect?: (...args: unknown[]) => void;
  onLoading?: (...args: unknown[]) => void;
  onEventsSet?: (...args: unknown[]) => void;
  renderEvent?: (params: { arg: () => void }) => ReactNode;
  renderDayCell?: (params: { arg: () => void }) => ReactNode;
  renderDayHeader?: (params: { arg: () => void }) => ReactNode;
  renderSlotLabel?: (params: { arg: () => void }) => ReactNode;
  renderWeekNumber?: (params: { arg: () => void }) => ReactNode;
  renderNowIndicatorContent?: (params: { arg: () => void }) => ReactNode;
  renderMoreLink?: (params: { arg: () => void }) => ReactNode;
  renderAllDayContent?: (params: { arg: () => void }) => ReactNode;
  renderSlotLaneContent?: (params: { arg: () => void }) => ReactNode;
  renderNoEventsContent?: (params: { arg: () => void }) => ReactNode;
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
