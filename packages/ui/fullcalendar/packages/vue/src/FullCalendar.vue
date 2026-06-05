<template>

<div class="rozie-fullcalendar" ref="__rozieRootRef"></div>



</template>

<script setup lang="ts">
import { Fragment, h, onBeforeUnmount, onMounted, ref, render, useSlots, watch } from 'vue';

const props = withDefaults(
  defineProps<{ events?: any[]; weekends?: boolean; editable?: boolean; selectable?: boolean; height?: number; defaultColor?: string; locale?: string; firstDay?: number; slotDuration?: string; nowIndicator?: boolean; headerToolbar?: Record<string, any> }>(),
  { events: () => [], weekends: true, editable: true, selectable: true, height: 480, defaultColor: '#3b82f6', locale: 'en', firstDay: 0, slotDuration: '00:30:00', nowIndicator: false, headerToolbar: () => ({
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay'
}) }
);

const view = defineModel<string>('view', { default: 'dayGridMonth' });

const emit = defineEmits<{
  eventClick: [...args: any[]];
  dateClick: [...args: any[]];
  eventDrop: [...args: any[]];
  select: [...args: any[]];
  eventResize: [...args: any[]];
  datesSet: [...args: any[]];
}>();

defineSlots<{
  event(props: { arg: any }): any;
}>();

const slots = useSlots();

const __rozieRootRef = ref<HTMLElement>();

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
    color: e.color || props.defaultColor
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

const portalContainers = new Set<HTMLElement>();
const portals = {
  event: (container: HTMLElement, scope: { arg: unknown }): (() => void) => {
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
};
onBeforeUnmount(() => {
  for (const container of portalContainers) render(null, container);
  portalContainers.clear();
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  const opts = {
    plugins: PLUGINS,
    initialView: view.value,
    weekends: props.weekends,
    editable: props.editable,
    selectable: props.selectable,
    height: props.height,
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
        jsEvent: info.jsEvent
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
  instance = new Calendar(__rozieRootRef.value!, opts);
  instance.render();
  _cleanup_0 = () => instance?.destroy();
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => props.events, (v: any) => {
  if (!instance) return;
  instance.removeAllEvents();
  for (const e of v as any) instance.addEvent(normalizeEvent(e));
});
watch(() => view.value, (v: any) => {
  if (!instance || !v) return;
  if (v === instance.view.type) return;
  suppressViewSync = true;
  instance.changeView(v);
});
watch(() => props.weekends, (v: any) => instance?.setOption('weekends', v));
watch(() => props.editable, (v: any) => instance?.setOption('editable', v));
watch(() => props.selectable, (v: any) => instance?.setOption('selectable', v));
watch(() => props.height, (v: any) => instance?.setOption('height', v));
watch(() => props.locale, (v: any) => instance?.setOption('locale', v));
watch(() => props.firstDay, (v: any) => instance?.setOption('firstDay', v));
watch(() => props.slotDuration, (v: any) => instance?.setOption('slotDuration', v));
watch(() => props.nowIndicator, (v: any) => instance?.setOption('nowIndicator', v));
watch(() => props.headerToolbar, (v: any) => instance?.setOption('headerToolbar', v));

defineExpose({ getApi, changeView, addEvent, removeEvent, today, prev, next, gotoDate });
</script>

<style scoped>
.rozie-fullcalendar {
  width: 100%;
  font-size: 0.875rem;
}
</style>
