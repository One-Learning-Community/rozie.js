<template>

<div class="rozie-fullcalendar" ref="__rozieRootRef"></div>












</template>

<script lang="ts">
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
</script>

<script setup lang="ts">
import { Fragment, h, onBeforeUnmount, onMounted, ref, render, useSlots, watch } from 'vue';

import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    /**
     * The event objects rendered on the calendar. Each event is normalized: a missing `title` renders as an empty title (the wrapper never invents one from the event id), and a missing `color` inherits `defaultColor`. Runtime-updatable — changing the array reconciles the live calendar via `removeAllEvents` + `addEvent`.
     */
    events?: any[];
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
  }>(),
  { events: () => [], weekends: true, editable: true, selectable: true, height: 480, defaultColor: '#3b82f6', locale: 'en', firstDay: 0, slotDuration: '00:30:00', nowIndicator: false, headerToolbar: () => ({
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay'
}), options: () => ({}) }
);

/**
 * The two-way active view name (`'dayGridMonth'`, `'timeGridWeek'`, `'timeGridDay'`, …) — the sole `model: true` prop. The calendar's own toolbar writes the new view name back through the two-way path, and a consumer write switches the view via `changeView`.
 * @example
 * <FullCalendar v-model:view="view" :events="events" />
 */
const view = defineModel<string>('view', { default: 'dayGridMonth' });

const emit = defineEmits<{
  eventClick: [payload: FullCalendarEventPointer];
  dateClick: [payload: FullCalendarDateClick];
  eventDrop: [payload: FullCalendarEventDrop];
  select: [payload: FullCalendarSelection];
  eventResize: [payload: FullCalendarEventResize];
  datesSet: [payload: FullCalendarDatesSet];
  eventMouseEnter: [payload: FullCalendarEventPointer];
  eventMouseLeave: [payload: FullCalendarEventPointer];
  unselect: [payload: FullCalendarUnselect];
  loading: [payload: FullCalendarLoading];
  eventsSet: [payload: FullCalendarEventsSet];
}>();

defineSlots<{
  event(props: { arg: EventContentArg }): any;
  dayCell(props: { arg: DayCellContentArg }): any;
  dayHeader(props: { arg: DayHeaderContentArg }): any;
  slotLabel(props: { arg: SlotLabelContentArg }): any;
  weekNumber(props: { arg: WeekNumberContentArg }): any;
  nowIndicatorContent(props: { arg: NowIndicatorContentArg }): any;
  moreLink(props: { arg: MoreLinkContentArg }): any;
  allDayContent(props: { arg: AllDayContentArg }): any;
  slotLaneContent(props: { arg: SlotLaneContentArg }): any;
  noEventsContent(props: { arg: FullCalendarNoEventsContentArg }): any;
}>();

const slots = useSlots();

const __rozieRootRef = ref<HTMLElement>();

const portalContainers = new Set<HTMLElement>();
const portals = {
  event: (container: HTMLElement, scope: { arg: EventContentArg }): (() => void) => {
    const slotFn = slots.event;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // event { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-event', '5589629a');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
  dayCell: (container: HTMLElement, scope: { arg: DayCellContentArg }): (() => void) => {
    const slotFn = slots.dayCell;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // dayCell { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-dayCell', '5589629a');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
  dayHeader: (container: HTMLElement, scope: { arg: DayHeaderContentArg }): (() => void) => {
    const slotFn = slots.dayHeader;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // dayHeader { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-dayHeader', '5589629a');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
  slotLabel: (container: HTMLElement, scope: { arg: SlotLabelContentArg }): (() => void) => {
    const slotFn = slots.slotLabel;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // slotLabel { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-slotLabel', '5589629a');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
  weekNumber: (container: HTMLElement, scope: { arg: WeekNumberContentArg }): (() => void) => {
    const slotFn = slots.weekNumber;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // weekNumber { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-weekNumber', '5589629a');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
  nowIndicatorContent: (container: HTMLElement, scope: { arg: NowIndicatorContentArg }): (() => void) => {
    const slotFn = slots.nowIndicatorContent;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // nowIndicatorContent { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-nowIndicatorContent', '5589629a');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
  moreLink: (container: HTMLElement, scope: { arg: MoreLinkContentArg }): (() => void) => {
    const slotFn = slots.moreLink;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // moreLink { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-moreLink', '5589629a');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
  allDayContent: (container: HTMLElement, scope: { arg: AllDayContentArg }): (() => void) => {
    const slotFn = slots.allDayContent;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // allDayContent { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-allDayContent', '5589629a');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
  slotLaneContent: (container: HTMLElement, scope: { arg: SlotLaneContentArg }): (() => void) => {
    const slotFn = slots.slotLaneContent;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // slotLaneContent { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-slotLaneContent', '5589629a');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
  noEventsContent: (container: HTMLElement, scope: { arg: FullCalendarNoEventsContentArg }): (() => void) => {
    const slotFn = slots.noEventsContent;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // noEventsContent { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-noEventsContent', '5589629a');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
};
onBeforeUnmount(() => {
  for (const container of portalContainers) render(null, container);
  portalContainers.clear();
});

let instance: any = null;
let suppressViewSync = false;
const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin];
// A purely numeric string height ('600') means pixels. Needed because a static
// Vue/Angular/Lit attribute arrives as a string, and Lit's String converter (see
// the height prop) would otherwise regress `height="600"`, which the old Number
// converter turned into 600. Anything else ('auto', '100%', '32rem', a number)
// passes through unchanged.
const normalizeHeight = (h: any) => {
  if (typeof h === 'string' && /^\d+(\.\d+)?$/.test(h.trim())) return Number(h);
  return h;
};
const normalizeEvent = (e: any) => {
  // Object spread — common reconcile shape: pass user props through, normalize
  // the title to a string WITHOUT inventing text (internal ids must never
  // render), and honor the wrapper's defaultColor only when the event omits one.
  return {
    ...e,
    title: e.title || '',
    color: e.color || props.defaultColor
  };
};
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

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
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
    ...props.options,
    plugins: [...PLUGINS, ...(props.options?.plugins ?? [])],
    initialView: view.value,
    weekends: props.weekends,
    editable: props.editable,
    selectable: props.selectable,
    height: normalizeHeight(props.height),
    locale: props.locale,
    firstDay: props.firstDay,
    slotDuration: props.slotDuration,
    nowIndicator: props.nowIndicator,
    events: props.events.map(normalizeEvent),
    // D-02: a consumer-passed headerToolbar fully REPLACES the built-in
    // toolbar; the built-in default lives in the `headerToolbar` prop default.
    headerToolbar: props.headerToolbar,
    eventClick: (info: any) => {
      emit('eventClick', {
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
      emit('dateClick', {
        date: info.date,
        dateStr: info.dateStr,
        allDay: info.allDay
      });
    },
    eventDrop: (info: any) => {
      emit('eventDrop', {
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
      emit('select', {
        start: info.start,
        end: info.end,
        startStr: info.startStr,
        endStr: info.endStr,
        allDay: info.allDay
      });
    },
    eventResize: (info: any) => {
      emit('eventResize', {
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
      emit('datesSet', {
        start: info.start,
        end: info.end,
        view: info.view.type
      });
    },
    eventMouseEnter: (info: any) => {
      emit('eventMouseEnter', {
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
      emit('eventMouseLeave', {
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
      emit('unselect', {
        jsEvent: info.jsEvent
      });
    },
    loading: (isLoading: any) => {
      // FullCalendar's `loading` callback receives a bare boolean (not an info
      // object) — normalize to the structured `{ isLoading }` payload shape.
      emit('loading', {
        isLoading
      });
    },
    eventsSet: (events: any) => {
      // `eventsSet` receives the array of current EventApi objects — map each to
      // the normalized floor shape for persistence/sync consumers.
      emit('eventsSet', {
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
      if (info.view.type !== view.value) view.value = info.view.type;
    }
  };

  // Portal-slot primitive (Spike 003) — when a consumer supplies an `event`
  // slot, route every cell render through it. The portal helper mounts the
  // consumer's framework-native fragment (React JSX, Vue VNodes, Svelte
  // Snippet, etc.) into a DOM container that FullCalendar owns; the dispose
  // handle is returned to FullCalendar so it cleans up the mounted tree when
  // the cell is removed. Consumers that don't fill the slot get FullCalendar's
  // default rendering (title text) — guarded by `$slots.event`.
  if (slots.event) {
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
  if (slots.dayCell) {
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
  if (slots.dayHeader) {
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
  if (slots.slotLabel) {
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
  if (slots.weekNumber) {
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
  if (slots.nowIndicatorContent) {
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
  if (slots.moreLink) {
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
  if (slots.allDayContent) {
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
  if (slots.slotLaneContent) {
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
  if (slots.noEventsContent) {
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
  instance = new Calendar(__rozieRootRef.value!, opts);
  instance.render();
  _cleanup_0 = () => instance?.destroy();
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => props.events, (v: any) => {
  if (!instance) return;
  instance.removeAllEvents();
  for (const e of v as any) instance.addEvent(normalizeEvent(e));
}, { flush: 'post' });
watch(() => view.value, (v: any) => {
  if (!instance || !v) return;
  if (v === instance.view.type) return;
  suppressViewSync = true;
  instance.changeView(v);
}, { flush: 'post' });
watch(() => props.weekends, (v: any) => instance?.setOption('weekends', v), { flush: 'post' });
watch(() => props.editable, (v: any) => instance?.setOption('editable', v), { flush: 'post' });
watch(() => props.selectable, (v: any) => instance?.setOption('selectable', v), { flush: 'post' });
watch(() => props.height, (v: any) => instance?.setOption('height', normalizeHeight(v)), { flush: 'post' });
watch(() => props.locale, (v: any) => instance?.setOption('locale', v), { flush: 'post' });
watch(() => props.firstDay, (v: any) => instance?.setOption('firstDay', v), { flush: 'post' });
watch(() => props.slotDuration, (v: any) => instance?.setOption('slotDuration', v), { flush: 'post' });
watch(() => props.nowIndicator, (v: any) => instance?.setOption('nowIndicator', v), { flush: 'post' });
watch(() => props.headerToolbar, (v: any) => instance?.setOption('headerToolbar', v), { flush: 'post' });
watch(() => props.options, (v: any) => {
  if (!instance) return;
  for (const k in v) instance.setOption(k, v[k]);
}, { flush: 'post' });

defineExpose({ getApi, changeView, addEvent, removeEvent, today, prev, next, gotoDate, getDate, getEvents, scrollToTime, updateSize, prevYear, nextYear, selectRange, clearSelection } as FullCalendarHandle);
</script>

<style scoped>
.rozie-fullcalendar {
  width: 100%;
  font-size: 0.875rem;
}
</style>
