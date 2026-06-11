---
title: FullCalendar — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import FullCalendar from '@rozie-ui/fullcalendar-vue';

// In-memory events with FIXED dates — network-free (so the demo works offline
// and in CI) and deterministic. Paired with a fixed `initialDate` (June 2026)
// below so the events are always in view on first paint.
const events = ref([
  { id: '1', title: 'Kickoff', start: '2026-06-03' },
  { id: '2', title: 'Design review', start: '2026-06-09', color: '#8b5cf6' },
  { id: '3', title: 'Sprint planning', start: '2026-06-15', color: '#10b981' },
  { id: '4', title: 'Release', start: '2026-06-22', color: '#ef4444' },
  { id: '5', title: 'Retro', start: '2026-06-26' },
]);

const view = ref('dayGridMonth');
const cal = ref();
const title = ref('');

// Pull the current toolbar title (the month/week label) off the raw Calendar
// instance via the `getApi` handle verb.
const syncTitle = () => { title.value = cal.value?.getApi()?.view?.title ?? ''; };
const go = (verb: 'prev' | 'next' | 'today') => { cal.value?.[verb](); syncTitle(); };
const setView = (v: string) => { view.value = v; cal.value?.changeView(v); syncTitle(); };
</script>

# FullCalendar — live demo

This is the **real `@rozie-ui/fullcalendar-vue` package** running on this page (VitePress is itself a Vue app). Click the events, drag the toolbar, switch views — then use the controls below to drive the imperative handle. Everything here is driven by the same `FullCalendar.rozie` source that compiles to all six frameworks.

<ClientOnly>
<div class="fc-live">
  <div class="fc-live__controls">
    <button @click="go('prev')">‹ Prev</button>
    <button @click="go('today')">Today</button>
    <button @click="go('next')">Next ›</button>
    <span class="fc-live__sep" />
    <button :class="{ 'fc-live__primary': view === 'dayGridMonth' }" @click="setView('dayGridMonth')">Month</button>
    <button :class="{ 'fc-live__primary': view === 'timeGridWeek' }" @click="setView('timeGridWeek')">Week</button>
  </div>

  <div class="fc-live__stage">
    <FullCalendar
      ref="cal"
      v-model:view="view"
      :events="events"
      :height="480"
      :options="{ initialDate: '2026-06-15' }"
      @datesSet="syncTitle"
    />
  </div>

  <div class="fc-live__readout">
    <code>view <strong>{{ view }}</strong><template v-if="title"> · {{ title }}</template></code>
  </div>
</div>
</ClientOnly>

The active `view` is two-way bound with `v-model:view` — the readout updates whether you click the calendar's own toolbar or the **Month / Week** buttons above, which drive the imperative handle (`changeView`). The **Prev / Today / Next** buttons call the `prev`, `today`, and `next` handle verbs, and the current month/week label is read back off the raw `Calendar` instance via `getApi()`. See the [full API](/components/fullcalendar) for the complete prop/event/handle surface.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/fullcalendar/src/FullCalendar.rozie{html}[FullCalendar.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/fullcalendar-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/fullcalendar/packages/react/src/FullCalendar.tsx[React]
<<< ../../packages/ui/fullcalendar/packages/vue/src/FullCalendar.vue[Vue]
<<< ../../packages/ui/fullcalendar/packages/svelte/src/FullCalendar.svelte[Svelte]
<<< ../../packages/ui/fullcalendar/packages/angular/src/FullCalendar.ts[Angular]
<<< ../../packages/ui/fullcalendar/packages/solid/src/FullCalendar.tsx[Solid]
<<< ../../packages/ui/fullcalendar/packages/lit/src/FullCalendar.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Same props, same events, same imperative handle, all from the one source above.

## See also

- [FullCalendar — showcase & API](/components/fullcalendar) — install, quick starts for all six frameworks, the `:options` passthrough, the opt-in plugin model, and the full reference.
- [The portal-slot primitive](/examples/portal-list) — how the ten `*Content` render hooks route a consumer fragment through each target's imperative-render API.

<style scoped>
.fc-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.fc-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.fc-live__controls button {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.fc-live__controls button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.fc-live__controls button.fc-live__primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
}
.fc-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.fc-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  overflow: hidden;
  padding: 0.5rem;
}
.fc-live__readout {
  min-height: 1.4rem;
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
</style>
