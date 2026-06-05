# @rozie-ui/fullcalendar-svelte

Idiomatic **svelte** `FullCalendar` — a cross-framework calendar/scheduler compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [FullCalendar](https://fullcalendar.io/). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/fullcalendar-svelte
```

Peer dependencies: the four `@fullcalendar/*` engine packages (`@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, all `^6.1`) + `svelte`. Install them alongside this package. FullCalendar v6 auto-injects its own stylesheet — there is **no manual CSS import** to add.

## Usage

```svelte
<script lang="ts">
  import FullCalendar from '@rozie-ui/fullcalendar-svelte';

  let view = $state('dayGridMonth');
  let events = $state([{ id: '1', title: 'Kickoff', start: '2026-06-04' }]);
</script>

<FullCalendar bind:view {events} oneventClick={(e) => console.log(e.event, e.view)} />
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `events` | `Array` | `[]` |  |  |
| `view` | `String` | `"dayGridMonth"` | ✓ |  |
| `weekends` | `Boolean` | `true` |  |  |
| `editable` | `Boolean` | `true` |  |  |
| `selectable` | `Boolean` | `true` |  |  |
| `height` | `Number` | `480` |  |  |
| `defaultColor` | `String` | `"#3b82f6"` |  |  |
| `locale` | `String` | `"en"` |  |  |
| `firstDay` | `Number` | `0` |  |  |
| `slotDuration` | `String` | `"00:30:00"` |  |  |
| `nowIndicator` | `Boolean` | `false` |  |  |
| `headerToolbar` | `Object` | `{…}` |  |  |
| `options` | `Object` | `{}` |  |  |

## Events

| Event | Description |
| --- | --- |
| `eventClick` | Fired when a calendar event is clicked. Payload `{ event: { id, title, start, end }, jsEvent, view }`. |
| `dateClick` | Fired when an empty date/time cell is clicked. Payload `{ date, dateStr, allDay, view }`. |
| `eventDrop` | Fired after an event is dragged to a new date/time. Payload `{ event: { id, title, start, end }, delta }`. |
| `select` | Fired when a date/time range is selected by drag (requires `selectable`). Payload `{ start, end, startStr, endStr, allDay }`. |
| `eventResize` | Fired after an event is resized by dragging its edge (requires `editable`). Payload `{ event: { id, title, start, end }, startDelta, endDelta }`. |
| `datesSet` | Fired whenever the visible date range changes (navigation or view switch). Payload `{ start, end, view }` where `view` is the active view type string. |
| `eventMouseEnter` | Fired when the pointer enters a calendar event. Payload `{ event: { id, title, start, end }, jsEvent }` (mirrors `eventClick`). |
| `eventMouseLeave` | Fired when the pointer leaves a calendar event. Payload `{ event: { id, title, start, end }, jsEvent }` (mirrors `eventMouseEnter`). |
| `unselect` | Fired when a previously selected date/time range is cleared. Payload `{ jsEvent }`. |
| `loading` | Fired when the calendar begins or finishes loading events (e.g. from an event source). Payload `{ isLoading }` boolean. |
| `eventsSet` | Fired after the set of rendered events changes. Payload `{ events: [{ id, title, start, end }, …] }` — the normalized current event set, for persistence/sync consumers. |

## Imperative handle

Beyond props/events, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```svelte
<script>
  let cal;                  // component instance via bind:this
</script>

<FullCalendar bind:this={cal} />
<button onclick={() => cal.next()}>Next</button>
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
