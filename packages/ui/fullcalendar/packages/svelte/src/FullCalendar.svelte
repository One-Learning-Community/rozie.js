<script lang="ts">
import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';
import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';
import { onMount, untrack } from 'svelte';

interface Props {
  events?: any[];
  view?: string;
  weekends?: boolean;
  editable?: boolean;
  selectable?: boolean;
  height?: number;
  defaultColor?: string;
  locale?: string;
  firstDay?: number;
  slotDuration?: string;
  nowIndicator?: boolean;
  headerToolbar?: any;
  options?: any;
  event?: Snippet<[{ arg: any }]>;
  dayCell?: Snippet<[{ arg: any }]>;
  dayHeader?: Snippet<[{ arg: any }]>;
  slotLabel?: Snippet<[{ arg: any }]>;
  weekNumber?: Snippet<[{ arg: any }]>;
  nowIndicatorContent?: Snippet<[{ arg: any }]>;
  moreLink?: Snippet<[{ arg: any }]>;
  allDayContent?: Snippet<[{ arg: any }]>;
  slotLaneContent?: Snippet<[{ arg: any }]>;
  snippets?: Record<string, any>;
  oneventclick?: (...args: unknown[]) => void;
  ondateclick?: (...args: unknown[]) => void;
  oneventdrop?: (...args: unknown[]) => void;
  onselect?: (...args: unknown[]) => void;
  oneventresize?: (...args: unknown[]) => void;
  ondatesset?: (...args: unknown[]) => void;
  oneventmouseenter?: (...args: unknown[]) => void;
  oneventmouseleave?: (...args: unknown[]) => void;
  onunselect?: (...args: unknown[]) => void;
  onloading?: (...args: unknown[]) => void;
  oneventsset?: (...args: unknown[]) => void;
}

let __defaultEvents = (() => [])();
let __defaultHeaderToolbar = (() => ({
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay'
}))();
let __defaultOptions = (() => ({}))();

let {
  events = __defaultEvents,
  view = $bindable('dayGridMonth'),
  weekends = true,
  editable = true,
  selectable = true,
  height = 480,
  defaultColor = '#3b82f6',
  locale = 'en',
  firstDay = 0,
  slotDuration = '00:30:00',
  nowIndicator = false,
  headerToolbar = __defaultHeaderToolbar,
  options = __defaultOptions,
  event: __eventProp,
  dayCell: __dayCellProp,
  dayHeader: __dayHeaderProp,
  slotLabel: __slotLabelProp,
  weekNumber: __weekNumberProp,
  nowIndicatorContent: __nowIndicatorContentProp,
  moreLink: __moreLinkProp,
  allDayContent: __allDayContentProp,
  slotLaneContent: __slotLaneContentProp,
  snippets,
  oneventclick,
  ondateclick,
  oneventdrop,
  onselect,
  oneventresize,
  ondatesset,
  oneventmouseenter,
  oneventmouseleave,
  onunselect,
  onloading,
  oneventsset
}: Props = $props();

const event = $derived(__eventProp ?? snippets?.event);
const dayCell = $derived(__dayCellProp ?? snippets?.dayCell);
const dayHeader = $derived(__dayHeaderProp ?? snippets?.dayHeader);
const slotLabel = $derived(__slotLabelProp ?? snippets?.slotLabel);
const weekNumber = $derived(__weekNumberProp ?? snippets?.weekNumber);
const nowIndicatorContent = $derived(__nowIndicatorContentProp ?? snippets?.nowIndicatorContent);
const moreLink = $derived(__moreLinkProp ?? snippets?.moreLink);
const allDayContent = $derived(__allDayContentProp ?? snippets?.allDayContent);
const slotLaneContent = $derived(__slotLaneContentProp ?? snippets?.slotLaneContent);

let __rozieRoot = $state<HTMLElement | undefined>(undefined);

import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
let instance: any = null;
let suppressViewSync = false;
const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin];
const normalizeEvent = (e: any) => {
  // Object spread + template-literal default — common reconcile shape:
  // pass user props through, but stamp a sensible title fallback and
  // honor the wrapper's defaultColor only when the event omits one.
  return {
    ...e,
    title: e.title || `Event ${e.id ?? '(no id)'}`,
    color: e.color || defaultColor
  };
};
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
export function getApi() {
  return instance;
}
export function changeView(...a: any[]) {
  return instance?.changeView(...a);
}
export function addEvent(...a: any[]) {
  return instance?.addEvent(...a);
}
export function removeEvent(id: any) {
  instance?.getEventById(id)?.remove();
}
export function today() {
  instance?.today();
}
export function prev() {
  instance?.prev();
}
export function next() {
  instance?.next();
}
export function gotoDate(...a: any[]) {
  instance?.gotoDate(...a);
}

const portalInstances = new Set<Record<string, unknown>>();
const portals = {
  event: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
    if (!event) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-event', '5589629a');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: event, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
  dayCell: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
    if (!dayCell) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-dayCell', '5589629a');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: dayCell, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
  dayHeader: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
    if (!dayHeader) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-dayHeader', '5589629a');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: dayHeader, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
  slotLabel: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
    if (!slotLabel) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-slotLabel', '5589629a');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: slotLabel, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
  weekNumber: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
    if (!weekNumber) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-weekNumber', '5589629a');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: weekNumber, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
  nowIndicatorContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
    if (!nowIndicatorContent) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-nowIndicatorContent', '5589629a');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: nowIndicatorContent, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
  moreLink: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
    if (!moreLink) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-moreLink', '5589629a');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: moreLink, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
  allDayContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
    if (!allDayContent) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-allDayContent', '5589629a');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: allDayContent, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
  slotLaneContent: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
    if (!slotLaneContent) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-slotLaneContent', '5589629a');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: slotLaneContent, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
};
$effect(() => () => {
  for (const inst of portalInstances) unmount(inst as Parameters<typeof unmount>[0]);
  portalInstances.clear();
});

onMount(() => {
  const opts = {
    // :options passthrough spread FIRST — the curated keys below + the portal
    // *Content handlers added after this object override any colliding key, so
    // an explicitly-bound prop (e.g. :height) wins over options.height.
    ...options,
    plugins: PLUGINS,
    initialView: view,
    weekends: weekends,
    editable: editable,
    selectable: selectable,
    height: height,
    locale: locale,
    firstDay: firstDay,
    slotDuration: slotDuration,
    nowIndicator: nowIndicator,
    events: events.map(normalizeEvent),
    // D-02: a consumer-passed headerToolbar fully REPLACES the built-in
    // toolbar; the built-in default lives in the `headerToolbar` prop default.
    headerToolbar: headerToolbar,
    eventClick: (info: any) => {
      oneventclick?.({
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
      ondateclick?.({
        date: info.date,
        dateStr: info.dateStr,
        allDay: info.allDay
      });
    },
    eventDrop: (info: any) => {
      oneventdrop?.({
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
      onselect?.({
        start: info.start,
        end: info.end,
        startStr: info.startStr,
        endStr: info.endStr,
        allDay: info.allDay
      });
    },
    eventResize: (info: any) => {
      oneventresize?.({
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
      ondatesset?.({
        start: info.start,
        end: info.end,
        view: info.view.type
      });
    },
    eventMouseEnter: (info: any) => {
      oneventmouseenter?.({
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
      oneventmouseleave?.({
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
      onunselect?.({
        jsEvent: info.jsEvent
      });
    },
    loading: (isLoading: any) => {
      // FullCalendar's `loading` callback receives a bare boolean (not an info
      // object) — normalize to the structured `{ isLoading }` payload shape.
      onloading?.({
        isLoading
      });
    },
    eventsSet: (events: any) => {
      // `eventsSet` receives the array of current EventApi objects — map each to
      // the normalized floor shape for persistence/sync consumers.
      oneventsset?.({
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
      if (info.view.type !== view) view = info.view.type;
    }
  };

  // Portal-slot primitive (Spike 003) — when a consumer supplies an `event`
  // slot, route every cell render through it. The portal helper mounts the
  // consumer's framework-native fragment (React JSX, Vue VNodes, Svelte
  // Snippet, etc.) into a DOM container that FullCalendar owns; the dispose
  // handle is returned to FullCalendar so it cleans up the mounted tree when
  // the cell is removed. Consumers that don't fill the slot get FullCalendar's
  // default rendering (title text) — guarded by `$slots.event`.
  if (event) {
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
  // The 8 remaining *Content portal-slots — wired identically to `event`, one
  // per FullCalendar per-cell content hook that fires with the bundled plugins
  // (core + daygrid + timegrid + interaction). Each guarded by its own slot so
  // unfilled slots keep FullCalendar's default rendering. (9 portal-slots total
  // counting `event` above; allDayContent + slotLaneContent are the two timeGrid
  // axis/lane hooks added last.)
  //
  // NOTE the `nowIndicatorContent` slot is named for its FullCalendar engine
  // hook (`nowIndicatorContent`) so it does NOT clash with the boolean
  // `nowIndicator` PROP — a slot name that equals a declared prop name is now a
  // hard compile error (ROZ127 SLOT_PROP_NAME_COLLISION), because Svelte 5
  // unifies snippets and props into one `$props` namespace.
  if (dayCell) {
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
  if (dayHeader) {
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
  if (slotLabel) {
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
  if (weekNumber) {
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
  if (nowIndicatorContent) {
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
  if (moreLink) {
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
  if (allDayContent) {
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
  if (slotLaneContent) {
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
  // The one still-excluded *Content slot (documented, not a gap): noEventsContent
  // — list-view only, and @fullcalendar/list is not a bundled engine peer. A
  // consumer needing it uses the :options passthrough + getApi().

  instance = new Calendar(__rozieRoot!, opts);
  instance.render();
  return () => instance?.destroy();
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => events)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((v: any) => {
  if (!instance) return;
  instance.removeAllEvents();
  for (const e of v as any) instance.addEvent(normalizeEvent(e));
})(__watchVal); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { const __watchVal = (() => view)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } ((v: any) => {
  if (!instance || !v) return;
  if (v === instance.view.type) return;
  suppressViewSync = true;
  instance.changeView(v);
})(__watchVal); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { const __watchVal = (() => weekends)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } ((v: any) => instance?.setOption('weekends', v))(__watchVal); }); });
let __rozieWatchInitial_3 = true;
$effect(() => { const __watchVal = (() => editable)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } ((v: any) => instance?.setOption('editable', v))(__watchVal); }); });
let __rozieWatchInitial_4 = true;
$effect(() => { const __watchVal = (() => selectable)(); untrack(() => { if (__rozieWatchInitial_4) { __rozieWatchInitial_4 = false; return; } ((v: any) => instance?.setOption('selectable', v))(__watchVal); }); });
let __rozieWatchInitial_5 = true;
$effect(() => { const __watchVal = (() => height)(); untrack(() => { if (__rozieWatchInitial_5) { __rozieWatchInitial_5 = false; return; } ((v: any) => instance?.setOption('height', v))(__watchVal); }); });
let __rozieWatchInitial_6 = true;
$effect(() => { const __watchVal = (() => locale)(); untrack(() => { if (__rozieWatchInitial_6) { __rozieWatchInitial_6 = false; return; } ((v: any) => instance?.setOption('locale', v))(__watchVal); }); });
let __rozieWatchInitial_7 = true;
$effect(() => { const __watchVal = (() => firstDay)(); untrack(() => { if (__rozieWatchInitial_7) { __rozieWatchInitial_7 = false; return; } ((v: any) => instance?.setOption('firstDay', v))(__watchVal); }); });
let __rozieWatchInitial_8 = true;
$effect(() => { const __watchVal = (() => slotDuration)(); untrack(() => { if (__rozieWatchInitial_8) { __rozieWatchInitial_8 = false; return; } ((v: any) => instance?.setOption('slotDuration', v))(__watchVal); }); });
let __rozieWatchInitial_9 = true;
$effect(() => { const __watchVal = (() => nowIndicator)(); untrack(() => { if (__rozieWatchInitial_9) { __rozieWatchInitial_9 = false; return; } ((v: any) => instance?.setOption('nowIndicator', v))(__watchVal); }); });
let __rozieWatchInitial_10 = true;
$effect(() => { const __watchVal = (() => headerToolbar)(); untrack(() => { if (__rozieWatchInitial_10) { __rozieWatchInitial_10 = false; return; } ((v: any) => instance?.setOption('headerToolbar', v))(__watchVal); }); });
let __rozieWatchInitial_11 = true;
$effect(() => { const __watchVal = (() => options)(); untrack(() => { if (__rozieWatchInitial_11) { __rozieWatchInitial_11 = false; return; } ((v: any) => {
  if (!instance) return;
  for (const k in v) instance.setOption(k, v[k]);
})(__watchVal); }); });
</script>


<div class="rozie-fullcalendar" bind:this={__rozieRoot} data-rozie-s-5589629a></div>












<style>
:global {
  .rozie-fullcalendar[data-rozie-s-5589629a] {
    width: 100%;
    font-size: 0.875rem;
  }
}
</style>
