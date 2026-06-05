import type { JSX } from 'solid-js';
import { createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { render } from 'solid-js/web';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

__rozieInjectStyle('FullCalendar-5589629a', `.rozie-fullcalendar[data-rozie-s-5589629a] {
  width: 100%;
  font-size: 0.875rem;
}`);

interface EventSlotCtx { arg: any; }

interface DayCellSlotCtx { arg: any; }

interface DayHeaderSlotCtx { arg: any; }

interface SlotLabelSlotCtx { arg: any; }

interface WeekNumberSlotCtx { arg: any; }

interface NowIndicatorContentSlotCtx { arg: any; }

interface MoreLinkSlotCtx { arg: any; }

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
  eventSlot?: (ctx: EventSlotCtx) => JSX.Element;
  dayCellSlot?: (ctx: DayCellSlotCtx) => JSX.Element;
  dayHeaderSlot?: (ctx: DayHeaderSlotCtx) => JSX.Element;
  slotLabelSlot?: (ctx: SlotLabelSlotCtx) => JSX.Element;
  weekNumberSlot?: (ctx: WeekNumberSlotCtx) => JSX.Element;
  nowIndicatorContentSlot?: (ctx: NowIndicatorContentSlotCtx) => JSX.Element;
  moreLinkSlot?: (ctx: MoreLinkSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: FullCalendarHandle) => void;
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

export default function FullCalendar(_props: FullCalendarProps): JSX.Element {
  const _merged = mergeProps({ events: (() => [])(), weekends: true, editable: true, selectable: true, height: 480, defaultColor: '#3b82f6', locale: 'en', firstDay: 0, slotDuration: '00:30:00', nowIndicator: false, headerToolbar: (() => ({
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay'
}))(), options: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['events', 'view', 'weekends', 'editable', 'selectable', 'height', 'defaultColor', 'locale', 'firstDay', 'slotDuration', 'nowIndicator', 'headerToolbar', 'options', 'ref']);
  onMount(() => { local.ref?.({ getApi, changeView, addEvent, removeEvent, today, prev, next, gotoDate }); });

  const [view, setView] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'view', 'dayGridMonth');
  const portalDisposers = new Set<() => void>();
  const portals = {
    event: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    dayCell: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    dayHeader: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    slotLabel: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    weekNumber: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    nowIndicatorContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
    moreLink: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
      ...local.options,
      plugins: PLUGINS,
      initialView: view(),
      weekends: local.weekends,
      editable: local.editable,
      selectable: local.selectable,
      height: local.height,
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
          jsEvent: info.jsEvent
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
          jsEvent: info.jsEvent
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
          jsEvent: info.jsEvent
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
    // The 6 remaining *Content portal-slots — wired identically to `event`, one
    // per FullCalendar per-cell content hook that fires with the bundled plugins
    // (core + daygrid + timegrid + interaction). Each guarded by its own slot so
    // unfilled slots keep FullCalendar's default rendering.
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
    // Excluded *Content slots (documented, not gaps): noEventsContent (list-view
    // only — @fullcalendar/list is not a bundled peer), slotLaneContent (background
    // lane, no demand), allDayContent (trivial label). Consumers needing those use
    // the :options passthrough + getApi().

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
  createEffect(on(() => (() => local.height)(), (v) => untrack(() => ((v: any) => instance?.setOption('height', v))(v)), { defer: true }));
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
  function normalizeEvent(e: any) {
    // Object spread + template-literal default — common reconcile shape:
    // pass user props through, but stamp a sensible title fallback and
    // honor the wrapper's defaultColor only when the event omits one.
    return {
      ...e,
      title: e.title || `Event ${e.id ?? '(no id)'}`,
      color: e.color || local.defaultColor
    };
  }
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

  return (
    <>
    <div class={"rozie-fullcalendar"} ref={(el) => { __rozieRootRef = el as HTMLElement; }} data-rozie-s-5589629a="" />








    </>
  );
}
