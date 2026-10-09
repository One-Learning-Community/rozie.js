---
"@rozie-ui/fullcalendar-react": patch
"@rozie-ui/fullcalendar-vue": patch
"@rozie-ui/fullcalendar-svelte": patch
"@rozie-ui/fullcalendar-angular": patch
"@rozie-ui/fullcalendar-solid": patch
"@rozie-ui/fullcalendar-lit": patch
---

Every event ref now carries `allDay`: `FullCalendarEventRef` is `{ id, title, start, end, allDay }`. It is on `eventDrop` and `eventResize` (both `event` and `oldEvent`), and on `eventClick`, `eventMouseEnter`, `eventMouseLeave` and each `eventsSet` entry. In an `eventDrop` handler `event.allDay !== oldEvent.allDay` tells a drop onto or off the all-day row from a plain move, with no `getApi().getEventById(id)` lookup.

The field is additive. TypeScript code that builds a `FullCalendarEventRef` by hand (a test double, for instance) must now include `allDay`.
