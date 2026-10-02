---
"@rozie-ui/fullcalendar-react": minor
"@rozie-ui/fullcalendar-vue": minor
"@rozie-ui/fullcalendar-svelte": minor
"@rozie-ui/fullcalendar-angular": minor
"@rozie-ui/fullcalendar-solid": minor
"@rozie-ui/fullcalendar-lit": minor
---

Fixes from the pre-release audit:

- **`:options` no longer re-applies every key on every render.** Before, each new `options` object (an inline literal re-created by every parent render) called `setOption` for every key. That refetched `eventSources` on every render, which looped forever when the parent stored `loading`/`eventsSet` in state, and it let `options` override curated keys after mount. Now only keys whose value changed are applied (plain arrays and objects compare by content, functions by identity), and curated keys (the props, `events`, every wrapped callback and filled slot) are never taken from `options`, at mount or later. `options.height`, `options.eventClick` and `options.viewDidMount` can no longer replace the wrapper's own.
- **`firstDay` follows the locale by default.** Its default is now `null` (it was `0`, which forced Sunday even for `locale="de"`). Set a number to override; `options.firstDay` also works while the prop is unset.
- **`height` edge cases:** an empty string, `null`, or a non-positive number falls back to `480` on every target (React used to fall back while the others passed the value through).
- **`events` replaces only its own events.** Changing `events` used to call `removeAllEvents`, which also removed events from `options.eventSources` and from the `addEvent` verb. The prop now owns an event source of its own. `addEvent` also normalizes like `events` (empty title, `defaultColor`).
- **Richer payloads:** `dateClick` adds `dayEl` (the clicked day cell, an anchor for a popover) and `jsEvent`; `eventDrop` and `eventResize` add `oldEvent` and `revert()`, so a handler can reject the change.
- **Untitled events have an accessible name:** they get `aria-label="Untitled event"` (with the time when there is one). A consumer's `options.eventDidMount` still runs.
- **After unmount** the handle's `getApi()` returns `null` instead of the destroyed calendar.
- **Docs:** the Svelte example used `oneventClick`, which Svelte ignores (the prop is `oneventclick`); the Solid slot examples used `event` / `dayCell` instead of `eventSlot` / `dayCellSlot`. Each README's slot table now lists the binding for its framework.
