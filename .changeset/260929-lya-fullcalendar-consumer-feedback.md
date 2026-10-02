---
"@rozie-ui/fullcalendar-react": patch
"@rozie-ui/fullcalendar-vue": patch
"@rozie-ui/fullcalendar-svelte": patch
"@rozie-ui/fullcalendar-angular": patch
"@rozie-ui/fullcalendar-solid": patch
"@rozie-ui/fullcalendar-lit": patch
---

FullCalendar now accepts CSS heights, forwards the event DOM element on hover/click payloads, and stops leaking event ids into untitled events (external consumer feedback).

`height` now accepts a CSS height string (`'auto'`, `'100%'`, any CSS length) as well as a pixel number, and a purely numeric string such as `'600'` is treated as pixels. Set the height through this prop: the curated `height` wins over `options.height`, so `options.height` can never supply it.

The `eventClick`, `eventMouseEnter` and `eventMouseLeave` payloads now include `el`, the event's DOM element, so a popover or tooltip can anchor on it.

BEHAVIOR CHANGE: an event without a `title` now renders an empty title instead of text derived from its `id` (`Event <id>`), which leaked internal server ids into the calendar. Consumers who relied on that fallback must supply titles. The `defaultColor` fallback is unchanged.

The README now documents the keyboard-focusability opt-out (`options.eventInteractive: false`), that `loading` fires only for event sources FullCalendar fetches itself, and the `noEventsContent` list-view recipe. It also no longer claims a `view` key on the `eventClick` / `dateClick` payloads, which was never emitted.
