# @rozie-ui/fullcalendar-react

## 0.1.4

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  Only the **`$emit` handler prop** read kind landed here, but it landed on the entire event surface — all 11: `onDateClick`, `onDatesSet`, `onEventClick`, `onEventDrop`, `onEventMouseEnter`, `onEventMouseLeave`, `onEventResize`, `onEventsSet`, `onLoading`, `onSelect`, `onUnselect`.

  FullCalendar's callbacks are handed to the engine once at mount, so before this fix every one of these events was permanently bound to the handler identity present on the first render. A consumer using inline arrow handlers, or swapping handlers on state change, was silently calling stale closures for the life of the calendar. This is the single most consequential leaf in the wave for that pattern.
- No prop read or helper call in this component was affected. No API surface change.
- @rozie/runtime-react@0.2.3

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The public `.d.ts` no longer types unresolved `r-for` slot-context params as callable (`() => void`) — they're now `unknown`, matching what the runtime actually hands the caller. No API surface change.

## 0.1.2

### Patch Changes

- First all-targets release line debut publish. `@rozie-ui/fullcalendar-react` graduates from "deliberately out of release scope" (vue-only dogfooding) to a verified publish, aligned with `-vue`/`-solid`/`-lit`/`-svelte`/`-angular`. Build/typecheck/codegen-idempotency/family-test/VR gates all pass clean for the React target — no emitter changes were needed.
- @rozie/runtime-react@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-react@0.2.0
