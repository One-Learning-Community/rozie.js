# @rozie-ui/flatpickr-react

## 0.1.5

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  This leaf has the broadest prop surface reaching into `$onMount`, so it takes the largest prop ripple in the wave — 29 synced refs:
  - **Prop reads** (21) — `allowInput`, `altFormat`, `altInput`, `appendTo`, `commitOn`, `enableSeconds`, `enableTime`, `formatDate`, `inline`, `monthSelectorType`, `nextArrow`, `noCalendar`, `options`, `parseDate`, `plugins`, `position`, `prevArrow`, `showMonths`, `staticPosition`, `time24hr`, `weekNumbers`. The flatpickr instance is constructed inside `$onMount`; these now read their current values at construction time rather than the first render's.
  - **`$emit` handler props** (8) — `onChange`, `onClose`, `onDayCreate`, `onMonthChange`, `onOpen`, `onReady`, `onValueUpdate`, `onYearChange`. flatpickr's hooks are registered once at construction, so a consumer that swapped a handler after mount previously kept getting the original called.
- The mount effect's dependency array is now honest, so the `react-hooks/exhaustive-deps` suppression is no longer emitted.
- No API surface change.
- @rozie/runtime-react@0.2.3

## 0.1.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. Declared emit handlers were also landing in the root DOM fallthrough spread and firing twice per emit — the emitter now keeps them out of it. No API surface change.

## 0.1.3

### Patch Changes

- @rozie/runtime-react@0.2.1

## 0.1.2

### Patch Changes

- @rozie/runtime-react@0.2.0
