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

interface EventCtx { arg: any; }

interface DayCellCtx { arg: any; }

interface DayHeaderCtx { arg: any; }

interface SlotLabelCtx { arg: any; }

interface WeekNumberCtx { arg: any; }

interface NowIndicatorContentCtx { arg: any; }

interface MoreLinkCtx { arg: any; }

interface AllDayContentCtx { arg: any; }

interface SlotLaneContentCtx { arg: any; }

interface NoEventsContentCtx { arg: any; }

interface FullCalendarProps {
  events?: any[];
  view?: string;
  defaultView?: string;
  onViewChange?: (view: string) => void;
  weekends?: boolean;
  editable?: boolean;
  selectable?: boolean;
  height?: number;
  defaultColor?: string;
  locale?: string;
  firstDay?: number;
  slotDuration?: string;
  nowIndicator?: boolean;
  headerToolbar?: Record<string, any>;
  options?: Record<string, any>;
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
  getApi: (...args: any[]) => any;
  changeView: (...args: any[]) => any;
  addEvent: (...args: any[]) => any;
  removeEvent: (...args: any[]) => any;
  today: (...args: any[]) => any;
  prev: (...args: any[]) => any;
  next: (...args: any[]) => any;
  gotoDate: (...args: any[]) => any;
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
  const props: Omit<FullCalendarProps, 'events' | 'weekends' | 'editable' | 'selectable' | 'height' | 'defaultColor' | 'locale' | 'firstDay' | 'slotDuration' | 'nowIndicator' | 'headerToolbar' | 'options'> & { events: any[]; weekends: boolean; editable: boolean; selectable: boolean; height: number; defaultColor: string; locale: string; firstDay: number; slotDuration: string; nowIndicator: boolean; headerToolbar: Record<string, any>; options: Record<string, any> } = {
    ..._props,
    events: _props.events ?? __defaultEvents,
    weekends: _props.weekends ?? true,
    editable: _props.editable ?? true,
    selectable: _props.selectable ?? true,
    height: _props.height ?? 480,
    defaultColor: _props.defaultColor ?? '#3b82f6',
    locale: _props.locale ?? 'en',
    firstDay: _props.firstDay ?? 0,
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
  const suppressViewSync = useRef(false);
  const instance = useRef<any>(null);
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

  const PLUGINS = useMemo(() => [dayGridPlugin, timeGridPlugin, interactionPlugin], []);
  const normalizeEvent = useCallback((e: any) => {
    // Object spread + template-literal default — common reconcile shape:
    // pass user props through, but stamp a sensible title fallback and
    // honor the wrapper's defaultColor only when the event omits one.
    return {
      ...e,
      title: e.title || `Event ${e.id ?? '(no id)'}`,
      color: e.color || props.defaultColor
    };
  }, [props.defaultColor]);
  // Imperative handle (Phase 21 $expose). The 8 calendar verbs a consumer can't
  // drive through props alone — exposed uniformly to all 6 targets
  // (Vue defineExpose / React useImperativeHandle / Svelte instance export /
  // Angular+Lit public method / Solid callback ref). Each delegates to the
  // underlying Calendar instance, which is null before $onMount and after
  // destroy — callers handle the pre-mount null.
  //
  // Collision discipline (the load-bearing flatpickr lesson): no exposed name may
  // collide with an emitted event (eventClick/dateClick/eventDrop/select/
  // eventResize/datesSet) or a declared prop. The 8 verbs below are clear on both
  // axes — getApi/changeView/addEvent/removeEvent/today/prev/next/gotoDate are
  // none of the 6 events nor the 12 props. getApi returns the raw Calendar
  // instance per REQ-27-4 (NOT guard-nulled).
  function getApi() {
    return instance.current;
  }
  function changeView(...a: any[]) {
    return instance.current?.changeView(...a);
  }
  function addEvent(...a: any[]) {
    return instance.current?.addEvent(...a);
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

  useEffect(() => {
    const portals = {
    event: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    dayCell: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    dayHeader: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    slotLabel: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    weekNumber: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    nowIndicatorContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    moreLink: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    allDayContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    slotLaneContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    noEventsContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
      ..._optionsRef.current,
      plugins: [...PLUGINS, ...(_optionsRef.current?.plugins ?? [])],
      initialView: _viewRef.current,
      weekends: _weekendsRef.current,
      editable: _editableRef.current,
      selectable: _selectableRef.current,
      height: _heightRef.current,
      locale: _localeRef.current,
      firstDay: _firstDayRef.current,
      slotDuration: _slotDurationRef.current,
      nowIndicator: _nowIndicatorRef.current,
      events: _eventsRef.current.map(normalizeEvent),
      // D-02: a consumer-passed headerToolbar fully REPLACES the built-in
      // toolbar; the built-in default lives in the `headerToolbar` prop default.
      headerToolbar: _headerToolbarRef.current,
      eventClick: (info: any) => {
        props.onEventClick && props.onEventClick({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          jsEvent: info.jsEvent
        });
      },
      dateClick: (info: any) => {
        props.onDateClick && props.onDateClick({
          date: info.date,
          dateStr: info.dateStr,
          allDay: info.allDay
        });
      },
      eventDrop: (info: any) => {
        props.onEventDrop && props.onEventDrop({
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
        props.onSelect && props.onSelect({
          start: info.start,
          end: info.end,
          startStr: info.startStr,
          endStr: info.endStr,
          allDay: info.allDay
        });
      },
      eventResize: (info: any) => {
        props.onEventResize && props.onEventResize({
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
        props.onDatesSet && props.onDatesSet({
          start: info.start,
          end: info.end,
          view: info.view.type
        });
      },
      eventMouseEnter: (info: any) => {
        props.onEventMouseEnter && props.onEventMouseEnter({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          jsEvent: info.jsEvent
        });
      },
      eventMouseLeave: (info: any) => {
        props.onEventMouseLeave && props.onEventMouseLeave({
          event: {
            id: info.event.id,
            title: info.event.title,
            start: info.event.start,
            end: info.event.end
          },
          jsEvent: info.jsEvent
        });
      },
      unselect: (info: any) => {
        props.onUnselect && props.onUnselect({
          jsEvent: info.jsEvent
        });
      },
      loading: (isLoading: any) => {
        // FullCalendar's `loading` callback receives a bare boolean (not an info
        // object) — normalize to the structured `{ isLoading }` payload shape.
        props.onLoading && props.onLoading({
          isLoading
        });
      },
      eventsSet: (events: any) => {
        // `eventsSet` receives the array of current EventApi objects — map each to
        // the normalized floor shape for persistence/sync consumers.
        props.onEventsSet && props.onEventsSet({
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
        if (suppressViewSync.current) {
          suppressViewSync.current = false;
          return;
        }
        if (info.view.type !== _viewRef.current) setView(info.view.type);
      }
    };

    // Portal-slot primitive (Spike 003) — when a consumer supplies an `event`
    // slot, route every cell render through it. The portal helper mounts the
    // consumer's framework-native fragment (React JSX, Vue VNodes, Svelte
    // Snippet, etc.) into a DOM container that FullCalendar owns; the dispose
    // handle is returned to FullCalendar so it cleans up the mounted tree when
    // the cell is removed. Consumers that don't fill the slot get FullCalendar's
    // default rendering (title text) — guarded by `$slots.event`.
    if ((props.renderEvent ?? props.slots?.["event"])) {
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
    if ((props.renderDayCell ?? props.slots?.["dayCell"])) {
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
    if ((props.renderDayHeader ?? props.slots?.["dayHeader"])) {
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
    if ((props.renderSlotLabel ?? props.slots?.["slotLabel"])) {
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
    if ((props.renderWeekNumber ?? props.slots?.["weekNumber"])) {
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
    if ((props.renderNowIndicatorContent ?? props.slots?.["nowIndicatorContent"])) {
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
    if ((props.renderMoreLink ?? props.slots?.["moreLink"])) {
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
    if ((props.renderAllDayContent ?? props.slots?.["allDayContent"])) {
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
    if ((props.renderSlotLaneContent ?? props.slots?.["slotLaneContent"])) {
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
    if ((props.renderNoEventsContent ?? props.slots?.["noEventsContent"])) {
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
    instance.current = new Calendar(__rozieRoot.current!, opts);
    instance.current.render();
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      instance.current?.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = props.events;
    if (!instance.current) return;
    instance.current.removeAllEvents();
    for (const e of v as any) instance.current.addEvent(normalizeEvent(e));
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
    instance.current?.setOption('height', v);
  }, [props.height]);
  useEffect(() => {
    if (_watch6First.current) { _watch6First.current = false; return; }
    const v = props.locale;
    instance.current?.setOption('locale', v);
  }, [props.locale]);
  useEffect(() => {
    if (_watch7First.current) { _watch7First.current = false; return; }
    const v = props.firstDay;
    instance.current?.setOption('firstDay', v);
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
    if (!instance.current) return;
    for (const k in v) instance.current.setOption(k, v[k]);
  }, [props.options]);

  useImperativeHandle(ref, () => ({ getApi, changeView, addEvent, removeEvent, today, prev, next, gotoDate }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div className={"rozie-fullcalendar"} ref={__rozieRoot} data-rozie-s-5589629a="" />











    </>
  );
});
export default FullCalendar;
