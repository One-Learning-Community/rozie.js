# @rozie-ui/fullcalendar-lit

Idiomatic **lit** `FullCalendar` — a cross-framework calendar/scheduler compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [FullCalendar](https://fullcalendar.io/). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/fullcalendar-lit
```

Peer dependencies: the four `@fullcalendar/*` engine packages (`@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, all `^6.1`) + `lit`. Install them alongside this package. FullCalendar v6 auto-injects its own stylesheet — there is **no manual CSS import** to add.

Also installed: `@rozie/runtime-lit` — Rozie's small, tree-shaken runtime helper package (controllable state, keyboard navigation, event modifiers, and safe interpolation). It arrives as a regular dependency, so npm pulls it for you. Your bundler keeps only the helpers this component actually uses — typically a few hundred bytes to a few KB, minified and gzipped. [What's in it and what it costs](https://github.com/One-Learning-Community/rozie.js/blob/main/docs/guide/output-and-runtime.md).

## Usage

```ts
import '@rozie-ui/fullcalendar-lit';

// <rozie-full-calendar> is a custom element. Bind `view`/`events` as
// properties and listen for the `event-click` event.
const el = document.querySelector('rozie-full-calendar');
el.view = 'dayGridMonth';
el.events = [{ id: '1', title: 'Kickoff', start: '2026-06-04' }];
el.addEventListener('view-change', (e) => {
  el.view = e.detail;
});
el.addEventListener('event-click', (e) => {
  console.log(e.detail.event, e.detail.el);
});
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
| `firstDay` | `Number` | `null` |  |  |
| `slotDuration` | `String` | `"00:30:00"` |  |  |
| `nowIndicator` | `Boolean` | `false` |  |  |
| `headerToolbar` | `Object` | `{…}` |  |  |
| `options` | `Object` | `{}` |  |  |

## Events

`addEventListener` name — the Lit target dispatches multi-word event names kebab-cased.

| Event | Payload | Description |
| --- | --- | --- |
| `event-click` | `FullCalendarEventClick` | Fired when a calendar event is clicked, or activated with Enter/Space (then `jsEvent` is a `KeyboardEvent`). `el` is the clicked event's DOM element (use it as the anchor for a popover or tooltip). |
| `date-click` | `FullCalendarDateClick` | Fired when an empty date/time cell is clicked. `dayEl` is the clicked day cell (an anchor for a popover) and `jsEvent` the click. |
| `event-drop` | `FullCalendarEventDrop` | Fired after an event is dragged to a new date/time. Call `revert()` to reject the move; `oldEvent` is the event before it. `event` and `oldEvent` both carry `allDay`, so a drop onto or off the all-day row shows as `event.allDay !== oldEvent.allDay`. |
| `select` | `FullCalendarSelection` | Fired when a date/time range is selected by drag (requires `selectable`). |
| `event-resize` | `FullCalendarEventResize` | Fired after an event is resized by dragging its edge (requires `editable`). Call `revert()` to reject the resize; `oldEvent` is the event before it. `event` and `oldEvent` both carry `allDay`. |
| `dates-set` | `FullCalendarDatesSet` | Fired whenever the visible date range changes (navigation or view switch). `view` is the active view type string. |
| `event-mouse-enter` | `FullCalendarEventPointer` | Fired when the pointer enters a calendar event (payload mirrors `eventClick`, with `jsEvent` always a `MouseEvent`). |
| `event-mouse-leave` | `FullCalendarEventPointer` | Fired when the pointer leaves a calendar event (payload mirrors `eventMouseEnter`). |
| `unselect` | `FullCalendarUnselect` | Fired when a previously selected date/time range is cleared. `jsEvent` is the pointer/touch `UIEvent`, or `null` when it was cleared programmatically (e.g. `clearSelection`). |
| `loading` | `FullCalendarLoading` | Fired when the calendar begins or finishes loading events. It fires only while FullCalendar fetches an event source itself (a URL/JSON feed or a function source); with only the `events` array bound it never fires (see Gotchas). |
| `events-set` | `FullCalendarEventsSet` | Fired after the set of rendered events changes — the normalized current event set, for persistence/sync consumers. |

## Imperative handle

Beyond props/events, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```ts
// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-full-calendar');
el.next();
const api = el.getApi();
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

| Slot | Params | Bind as |
| --- | --- | --- |
| event | arg | `` el.event = ({ arg }) => html`…` `` |
| dayCell | arg | `` el.dayCell = ({ arg }) => html`…` `` |
| dayHeader | arg | `` el.dayHeader = ({ arg }) => html`…` `` |
| slotLabel | arg | `` el.slotLabel = ({ arg }) => html`…` `` |
| weekNumber | arg | `` el.weekNumber = ({ arg }) => html`…` `` |
| nowIndicatorContent | arg | `` el.nowIndicatorContent = ({ arg }) => html`…` `` |
| moreLink | arg | `` el.moreLink = ({ arg }) => html`…` `` |
| allDayContent | arg | `` el.allDayContent = ({ arg }) => html`…` `` |
| slotLaneContent | arg | `` el.slotLaneContent = ({ arg }) => html`…` `` |
| noEventsContent | arg | `` el.noEventsContent = ({ arg }) => html`…` `` |

## Gotchas

**Events are keyboard-focusable.** Whenever an `eventClick` handler is registered, FullCalendar makes every event interactive (`tabindex="0"`, Enter/Space activation). This wrapper always registers one, because it powers the `eventClick` event. FullCalendar checks the `eventInteractive` option before it checks for handlers, so opt out with `el.options = { eventInteractive: false };`. A per-event `interactive: false` also works when the global option is unset.

**`loading` fires only for fetched sources.** It reflects event sources FullCalendar fetches itself (a URL/JSON feed or a function source). The `events` prop is always an in-memory array reconciled synchronously, so with `events` alone `loading` never fires; track your own fetch state instead. For FullCalendar-managed fetching, pass sources through `options` as `eventSources`: `el.options = { eventSources: [{ url: '/api/events' }] };`.

**`noEventsContent` needs a list view.** The slot renders only in list views, and the baked-in daygrid/timegrid/interaction plugins provide none. Recipe: `npm i @fullcalendar/list`, `import listPlugin from '@fullcalendar/list'`, pass `el.options = { plugins: [listPlugin] };` (the `plugins` key merges with the baked-in defaults), and set `view` to `listWeek`, `listDay` or `listMonth`. The slot then renders when the list is empty.
