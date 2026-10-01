# @rozie-ui/fullcalendar-vue

Idiomatic **vue** `FullCalendar` — a cross-framework calendar/scheduler compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [FullCalendar](https://fullcalendar.io/). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/fullcalendar-vue
```

Peer dependencies: the four `@fullcalendar/*` engine packages (`@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, all `^6.1`) + `vue`. Install them alongside this package. FullCalendar v6 auto-injects its own stylesheet — there is **no manual CSS import** to add.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import FullCalendar from '@rozie-ui/fullcalendar-vue';

const view = ref('dayGridMonth');
const events = ref([{ id: '1', title: 'Kickoff', start: '2026-06-04' }]);
</script>

<template>
  <FullCalendar v-model:view="view" :events="events" @eventClick="(e) => console.log(e.event, e.el)" />
</template>
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `events` | `Array` | `[]` |  |  |
| `view` | `String` | `"dayGridMonth"` | ✓ |  |
| `weekends` | `Boolean` | `true` |  |  |
| `editable` | `Boolean` | `true` |  |  |
| `selectable` | `Boolean` | `true` |  |  |
| `height` | `String \| Number` | `480` |  |  |
| `defaultColor` | `String` | `"#3b82f6"` |  |  |
| `locale` | `String` | `"en"` |  |  |
| `firstDay` | `Number` | `0` |  |  |
| `slotDuration` | `String` | `"00:30:00"` |  |  |
| `nowIndicator` | `Boolean` | `false` |  |  |
| `headerToolbar` | `Object` | `{…}` |  |  |
| `options` | `Object` | `{}` |  |  |

## Events

| Event | Payload | Description |
| --- | --- | --- |
| `eventClick` | `FullCalendarEventClick` | Fired when a calendar event is clicked, or activated with Enter/Space (then `jsEvent` is a `KeyboardEvent`). `el` is the clicked event's DOM element (use it as the anchor for a popover or tooltip). |
| `dateClick` | `FullCalendarDateClick` | Fired when an empty date/time cell is clicked. |
| `eventDrop` | `FullCalendarEventDrop` | Fired after an event is dragged to a new date/time. |
| `select` | `FullCalendarSelection` | Fired when a date/time range is selected by drag (requires `selectable`). |
| `eventResize` | `FullCalendarEventResize` | Fired after an event is resized by dragging its edge (requires `editable`). |
| `datesSet` | `FullCalendarDatesSet` | Fired whenever the visible date range changes (navigation or view switch). `view` is the active view type string. |
| `eventMouseEnter` | `FullCalendarEventPointer` | Fired when the pointer enters a calendar event (payload mirrors `eventClick`, with `jsEvent` always a `MouseEvent`). |
| `eventMouseLeave` | `FullCalendarEventPointer` | Fired when the pointer leaves a calendar event (payload mirrors `eventMouseEnter`). |
| `unselect` | `FullCalendarUnselect` | Fired when a previously selected date/time range is cleared. `jsEvent` is the pointer/touch `UIEvent`, or `null` when it was cleared programmatically (e.g. `clearSelection`). |
| `loading` | `FullCalendarLoading` | Fired when the calendar begins or finishes loading events. It fires only while FullCalendar fetches an event source itself (a URL/JSON feed or a function source); with only the `events` array bound it never fires (see Gotchas). |
| `eventsSet` | `FullCalendarEventsSet` | Fired after the set of rendered events changes — the normalized current event set, for persistence/sync consumers. |

## Imperative handle

Beyond props/events, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```vue
<script setup>
import { ref } from 'vue';
const cal = ref();          // template ref
</script>

<template>
  <FullCalendar ref="cal" />
  <button @click="cal.next()">Next</button>
</template>
```

| Method | Description |
| --- | --- |
| `getApi` | Return the underlying FullCalendar `Calendar` instance for direct API access. |
| `changeView` | Switch the active view — `changeView(viewName, dateOrRange?)`. |
| `addEvent` | Add an event — `addEvent(eventInput, source?)`. |
| `removeEvent` | Remove an event by id — `removeEvent(id)`. |
| `today` | Navigate to today. |
| `prev` | Navigate to the previous date range. |
| `next` | Navigate to the next date range. |
| `gotoDate` | Navigate to a specific date — `gotoDate(date)`. |
| `getDate` | Return the calendar’s current anchor `Date` (the `view` model carries only the view type). null before mount. |
| `getEvents` | Return all current events as an `EventApi[]` (synchronous read; `eventsSet` is push-only). `[]` before mount. |
| `scrollToTime` | Scroll a timeGrid view to a time of day — `scrollToTime(duration)` (e.g. `"09:00"`). |
| `updateSize` | Force a relayout after the container resized outside FullCalendar’s knowledge (tab reveal, sidebar collapse). |
| `prevYear` | Navigate to the previous year. |
| `nextYear` | Navigate to the next year. |
| `selectRange` | Programmatically select a date/time range — `selectRange(dateOrObj, endDate?)` (CalendarApi.select). |
| `clearSelection` | Clear the current selection (CalendarApi.unselect). |

## Slots

| Slot | Params |
| --- | --- |
| event | arg |
| dayCell | arg |
| dayHeader | arg |
| slotLabel | arg |
| weekNumber | arg |
| nowIndicatorContent | arg |
| moreLink | arg |
| allDayContent | arg |
| slotLaneContent | arg |
| noEventsContent | arg |

## Gotchas

**Events are keyboard-focusable.** Whenever an `eventClick` handler is registered, FullCalendar makes every event interactive (`tabindex="0"`, Enter/Space activation). This wrapper always registers one, because it powers the `eventClick` event. FullCalendar checks the `eventInteractive` option before it checks for handlers, so opt out with `:options="{ eventInteractive: false }"`. A per-event `interactive: false` also works when the global option is unset.

**`loading` fires only for fetched sources.** It reflects event sources FullCalendar fetches itself (a URL/JSON feed or a function source). The `events` prop is always an in-memory array reconciled synchronously, so with `events` alone `loading` never fires; track your own fetch state instead. For FullCalendar-managed fetching, pass sources through `options` as `eventSources`: `:options="{ eventSources: [{ url: '/api/events' }] }"`.

**`noEventsContent` needs a list view.** The slot renders only in list views, and the baked-in daygrid/timegrid/interaction plugins provide none. Recipe: `npm i @fullcalendar/list`, `import listPlugin from '@fullcalendar/list'`, pass `:options="{ plugins: [listPlugin] }"` (the `plugins` key merges with the baked-in defaults), and set `view` to `listWeek`, `listDay` or `listMonth`. The slot then renders when the list is empty.
