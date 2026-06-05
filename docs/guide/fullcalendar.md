# FullCalendar — the cross-framework calendar & scheduler

`FullCalendar` is Rozie's data-bound port of [FullCalendar](https://fullcalendar.io/) — the vanilla-JS calendar/scheduler engine. One `.rozie` source file ships idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers from a single wrapper. FullCalendar already publishes four official wrappers ([@fullcalendar/react](https://www.npmjs.com/package/@fullcalendar/react), [@fullcalendar/vue3](https://www.npmjs.com/package/@fullcalendar/vue3), [@fullcalendar/angular](https://www.npmjs.com/package/@fullcalendar/angular), [@fullcalendar/svelte](https://www.npmjs.com/package/@fullcalendar/svelte)) — each one wraps the same `Calendar` engine. Rozie collapses all of them (plus the Solid and Lit wrappers that **do not exist upstream**) into one source.

This page is the **show-and-tell**: the API surface, per-framework quick starts, the imperative handle, and the per-target recipe for custom event content (the `event` portal slot).

The full source for `FullCalendar.rozie` lives in the [`@rozie-ui/fullcalendar` package](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/fullcalendar/src/FullCalendar.rozie).

## The `@rozie-ui/fullcalendar` packages

`FullCalendar` ships as six pre-compiled, per-framework packages generated from a single `FullCalendar.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step, no `@rozie/*` runtime dependency:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/fullcalendar-react` | `npm i @rozie-ui/fullcalendar-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/fullcalendar/packages/react/README.md) |
| `@rozie-ui/fullcalendar-vue` | `npm i @rozie-ui/fullcalendar-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/fullcalendar/packages/vue/README.md) |
| `@rozie-ui/fullcalendar-svelte` | `npm i @rozie-ui/fullcalendar-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/fullcalendar/packages/svelte/README.md) |
| `@rozie-ui/fullcalendar-angular` | `npm i @rozie-ui/fullcalendar-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/fullcalendar/packages/angular/README.md) |
| `@rozie-ui/fullcalendar-solid` | `npm i @rozie-ui/fullcalendar-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/fullcalendar/packages/solid/README.md) |
| `@rozie-ui/fullcalendar-lit` | `npm i @rozie-ui/fullcalendar-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/fullcalendar/packages/lit/README.md) |

Each package carries the **four `@fullcalendar/*` engine peers** — `@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, and `@fullcalendar/interaction` (all `^6.1`) — plus its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common`, `solid-js`, or `lit`). Install the engine peers alongside the framework package:

```bash
npm i @rozie-ui/fullcalendar-react \
  @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

**No manual stylesheet import is needed.** FullCalendar v6 auto-injects its own CSS at runtime — there is no `import 'fullcalendar/...css'` line to add (unlike the date-picker port, which requires a vendor stylesheet import). The wrapper's own `<style>` block carries only its layout box; the global `.fc-*` calendar styling comes from the engine itself. The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `FullCalendar.rozie`, so they cannot drift from the compiled output — the package's `codegen.mjs` asserts the structural columns of this page against `ir.props` on every run.

## Quick start

The two-way value is `view` — the active **view name string** (`'dayGridMonth'`, `'timeGridWeek'`, `'timeGridDay'`, …). Clicking the calendar's own toolbar writes the new view name back through the two-way path, and a consumer write switches the calendar's view. Events are passed via `:events`; `@eventClick` surfaces the structured payload.

### React

```tsx
import { useState } from 'react';
import { FullCalendar } from '@rozie-ui/fullcalendar-react';

export function Demo() {
  const [view, setView] = useState('dayGridMonth');
  const [events] = useState([{ id: '1', title: 'Kickoff', start: '2026-06-04' }]);
  return (
    <FullCalendar
      view={view}
      onViewChange={setView}
      events={events}
      onEventClick={(e) => console.log(e.event, e.jsEvent)}
    />
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import FullCalendar from '@rozie-ui/fullcalendar-vue';

const view = ref('dayGridMonth');
const events = ref([{ id: '1', title: 'Kickoff', start: '2026-06-04' }]);
</script>

<template>
  <FullCalendar v-model:view="view" :events="events" @eventClick="(e) => console.log(e.event)" />
</template>
```

### Svelte

```svelte
<script lang="ts">
  import FullCalendar from '@rozie-ui/fullcalendar-svelte';

  let view = $state('dayGridMonth');
  let events = $state([{ id: '1', title: 'Kickoff', start: '2026-06-04' }]);
</script>

<FullCalendar bind:view {events} oneventClick={(e) => console.log(e.event)} />
```

### Angular

```ts
import { Component } from '@angular/core';
import { FullCalendar } from '@rozie-ui/fullcalendar-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [FullCalendar],
  template: `<FullCalendar [(view)]="view" [events]="events" (eventClick)="onEventClick($event)" />`,
})
export class DemoComponent {
  view = 'dayGridMonth';
  events = [{ id: '1', title: 'Kickoff', start: '2026-06-04' }];
  onEventClick(e: { event: unknown; jsEvent: unknown }) {
    console.log(e.event);
  }
}
```

### Solid

```tsx
import { createSignal } from 'solid-js';
import { FullCalendar } from '@rozie-ui/fullcalendar-solid';

export function Demo() {
  const [view, setView] = createSignal('dayGridMonth');
  const [events] = createSignal([{ id: '1', title: 'Kickoff', start: '2026-06-04' }]);
  return (
    <FullCalendar
      view={view()}
      onViewChange={setView}
      events={events()}
      onEventClick={(e) => console.log(e.event)}
    />
  );
}
```

### Lit

```ts
import '@rozie-ui/fullcalendar-lit';

// <rozie-full-calendar> is a custom element. Bind `view`/`events` as
// properties and listen for the `view-change` / `event-click` events.
const el = document.querySelector('rozie-full-calendar');
el.view = 'dayGridMonth';
el.events = [{ id: '1', title: 'Kickoff', start: '2026-06-04' }];
el.addEventListener('view-change', (e) => { el.view = e.detail; });
el.addEventListener('event-click', (e) => {
  console.log(e.detail.event, e.detail.jsEvent);
});
```

## API

### Props

| Name | Type | Default | Two-way (model) | Description |
| --- | --- | --- | :---: | --- |
| `events` | `Array` | `[]` | | The event objects rendered on the calendar. Each event is normalized: a missing `title` falls back to `Event <id>`, and a missing `color` inherits `defaultColor`. Runtime-updatable — changing the array reconciles the live calendar via `removeAllEvents` + `addEvent`. |
| `view` | `String` | `"dayGridMonth"` | ✓ | The two-way active view name (`'dayGridMonth'`, `'timeGridWeek'`, `'timeGridDay'`, …). The calendar's own toolbar writes back through the two-way path; a consumer write calls `changeView`. |
| `weekends` | `Boolean` | `true` | | Show Saturday/Sunday columns. Runtime-updatable via `setOption`. |
| `editable` | `Boolean` | `true` | | Allow events to be dragged and resized. Runtime-updatable. |
| `selectable` | `Boolean` | `true` | | Allow date/time-range selection by click-drag. Runtime-updatable. |
| `height` | `Number` | `480` | | Calendar height in pixels. Runtime-updatable. |
| `defaultColor` | `String` | `"#3b82f6"` | | Fallback event color stamped onto events that omit their own `color`. |
| `locale` | `String` | `"en"` | | FullCalendar locale code. Runtime-updatable. An object locale is an untyped runtime escape hatch — pass it through `setOption` via the handle if needed. |
| `firstDay` | `Number` | `0` | | First day of the week (`0` = Sunday … `1` = Monday). Runtime-updatable. |
| `slotDuration` | `String` | `"00:30:00"` | | Time-grid slot length in `HH:mm:ss`. Runtime-updatable. |
| `nowIndicator` | `Boolean` | `false` | | Render the current-time indicator line in time-grid views. Runtime-updatable. |
| `headerToolbar` | `Object` | `{…}` | | The toolbar layout (`{ left, center, right }`). A consumer-passed object **fully replaces** the built-in default. Runtime-updatable. |

### Emits

| Event | Description |
| --- | --- |
| `eventClick` | An event was clicked. Payload: `{ event: { id, title, start, end }, jsEvent }`. |
| `dateClick` | A date/cell was clicked. Payload: `{ date, dateStr, allDay }`. |
| `eventDrop` | An event was dragged to a new date. Payload: `{ event: { id, title, start, end }, delta }`. |
| `select` | A date/time range was selected. Payload: `{ start, end, startStr, endStr, allDay }`. |
| `eventResize` | An event was resized. Payload: `{ event: { id, title, start, end }, startDelta, endDelta }`. |
| `datesSet` | The visible date range changed (navigation or view switch). Payload: `{ start, end, view }`. |

### Imperative handle

Beyond props/events, the component exposes imperative methods declared once in the Rozie source via `$expose`. Grab a handle with your framework's native ref mechanism (React `useRef` / Vue template ref / Svelte `bind:this` / Angular `viewChild` / Solid callback ref / the Lit custom element itself) and call them directly:

| Method | Description |
| --- | --- |
| `getApi` | Return the underlying FullCalendar `Calendar` instance for direct API access. Returns the raw instance (null before mount). |
| `changeView` | Switch the active view — `changeView(viewName, dateOrRange?)`. |
| `addEvent` | Add an event — `addEvent(eventInput, source?)`. |
| `removeEvent` | Remove an event by id — `removeEvent(id)`. |
| `today` | Navigate to today. |
| `prev` | Navigate to the previous date range. |
| `next` | Navigate to the next date range. |
| `gotoDate` | Navigate to a specific date — `gotoDate(date)`. |

**React example:**

```tsx
import { useRef } from 'react';
import { FullCalendar, type FullCalendarHandle } from '@rozie-ui/fullcalendar-react';

const cal = useRef<FullCalendarHandle>(null);
// <FullCalendar ref={cal} ... />
cal.current?.next();
const api = cal.current?.getApi();
```

The handle method names are clear of all six event names and twelve prop names (the `$expose` collision discipline — ROZ121), so no `openPicker`-style renames are needed here.

## Slots

### Custom event content

FullCalendar's `eventContent` option lets you replace the default per-cell title text with your own markup. The wrapper surfaces it as the **`event` portal slot** — a single authoring surface that the per-target compiler routes through each framework's native imperative-render API. Consumers fill it the same way they fill any other named slot. The slot receives one scope param, `arg` (FullCalendar's event-render argument; `arg.event.title`, `arg.event.start`, etc.).

Portal slots unlock the "foreign-engine cell rendering" pattern: FullCalendar owns the cell `<div>`, but the consumer's framework-native fragment is mounted inside it and disposed when the cell is torn down. See [the portal-slot primitive](/examples/portal-list) for the underlying mechanism. (Note: portal slots are not reactive after mount in v1 — FullCalendar re-invokes `eventContent` when the event data changes, which is how the engine works anyway.)

**React** (render prop):

```tsx
<FullCalendar
  view={view}
  events={events}
  renderEvent={({ arg }) => <span className="fc-event-title">{arg.event.title}</span>}
/>
```

**Solid** (render prop):

```tsx
<FullCalendar
  view={view()}
  events={events()}
  event={({ arg }) => <span class="fc-event-title">{arg.event.title}</span>}
/>
```

**Vue** (scoped slot):

```vue
<FullCalendar v-model:view="view" :events="events">
  <template #event="{ arg }">
    <span class="fc-event-title">{{ arg.event.title }}</span>
  </template>
</FullCalendar>
```

**Svelte** (snippet):

```svelte
<FullCalendar bind:view {events}>
  {#snippet event({ arg })}
    <span class="fc-event-title">{arg.event.title}</span>
  {/snippet}
</FullCalendar>
```

**Angular** (content child `<ng-template>`):

```html
<FullCalendar [(view)]="view" [events]="events">
  <ng-template #event let-arg="arg">
    <span class="fc-event-title">{{ arg.event.title }}</span>
  </ng-template>
</FullCalendar>
```

**Lit** (slot bridge — pass the render callback as a property):

```ts
const el = document.querySelector('rozie-full-calendar');
el.event = ({ arg }) => html`<span class="fc-event-title">${arg.event.title}</span>`;
```

On every target the wrapper's `$portals.event(node, { arg })` closure mounts the consumer's fragment into the engine-owned cell container and returns a dispose handle the engine calls on cell teardown.

## Recipes

### Two-way view binding

The `view` prop is the only two-way value. Both the calendar's own toolbar buttons (`dayGridMonth` / `timeGridWeek` / `timeGridDay`) AND a consumer write update the bound state, with a round-trip guard so a programmatic `changeView` does not echo back:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import FullCalendar from '@rozie-ui/fullcalendar-vue';
const view = ref('dayGridMonth');
</script>

<template>
  <button @click="view = 'timeGridWeek'">Week</button>
  <FullCalendar v-model:view="view" :events="events" />
  <p>Current view: {{ view }}</p>
</template>
```

### Reconciling events at runtime

Changing the `:events` array reconciles the live calendar without remounting — the wrapper runs FullCalendar's supported `removeAllEvents` + `addEvent` loop, normalizing each event (title/color fallbacks) on the way in. Just bind a reactive array and push/replace it:

```vue
<FullCalendar :events="events" v-model:view="view" />
<!-- events.value = [...events.value, { id: 'new', title: 'Sync', start: '2026-06-10' }] -->
```

`weekends`, `editable`, `selectable`, `height`, `locale`, `firstDay`, `slotDuration`, `nowIndicator`, and `headerToolbar` are likewise runtime-updatable — each is wired to FullCalendar's `setOption` path, so changing the prop reconciles the live calendar with no re-key.

### Driving navigation from the handle

The eight imperative verbs cover the navigation/mutation surface that props alone can't express. Grab the handle and call `next()`/`prev()`/`today()`/`gotoDate()`/`changeView()`, or reach the raw engine via `getApi()`:

```tsx
const cal = useRef<FullCalendarHandle>(null);
// <FullCalendar ref={cal} ... />
<button onClick={() => cal.current?.next()}>Next</button>
<button onClick={() => cal.current?.today()}>Today</button>
```

## Gotchas

### Round-trip-guarded view sync

The two-way `view` prop is guarded against the cross-framework "infinite update loop" bug class: a programmatic `changeView` sets a `suppressViewSync` flag so the engine's `viewDidMount`/`datesSet` callback does not write the same value back into `$model.view`. A user toolbar click flows up normally.

### `getApi` returns the raw instance

`getApi()` returns the underlying `Calendar` instance directly (it is **not** guard-nulled away) so you can call any FullCalendar API the wrapper doesn't surface. It is `null` before mount and after destroy — callers handle the pre-mount null.

### Custom event content is not reactive after mount

Per the v1 portal-slot constraint, the `event` slot re-renders only when FullCalendar re-invokes `eventContent` (i.e. when the event data changes). This matches the engine's own behavior — it is not a limitation specific to the wrapper.

## Cross-references

- [`FullCalendar.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/fullcalendar/src/FullCalendar.rozie) — the canonical wrapper.
- [The portal-slot primitive](/examples/portal-list) — how `<slot name="X" portal />` routes a consumer fragment through each target's imperative-render API.
- [`$expose` and the imperative handle](/guide/features#expose-→-a-consumer-callable-imperative-handle-everywhere)
- [`r-model` — two-way binding everywhere](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere)
