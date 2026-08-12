# @rozie-ui/fullcalendar-lit

## 0.2.0

### Minor Changes

- Fixed: a multi-word `$emit()` event was dispatched in its raw camelCase source
  casing instead of being kebab-cased, so a consumer's kebab-cased
  `@event-click`/etc. template listener never fired on the Lit target —
  `addEventListener` is case-sensitive, and the two names never matched. The
  dispatch side now kebab-cases the event name to match the listener, the same
  convention the two-way model event path (`<prop>-change`) already used.

  **This changes the DOM event name string a Lit consumer must pass to
  `addEventListener`.** If you discovered the camelCase name empirically — the
  only form that worked before this fix — you must update your listener names:

  | Old (broken, never fired) | New (correct)       |
  | ------------------------- | ------------------- |
  | `eventClick`              | `event-click`       |
  | `dateClick`               | `date-click`        |
  | `eventDrop`               | `event-drop`        |
  | `eventResize`             | `event-resize`      |
  | `datesSet`                | `dates-set`         |
  | `eventMouseEnter`         | `event-mouse-enter` |
  | `eventMouseLeave`         | `event-mouse-leave` |
  | `eventsSet`               | `events-set`        |

  Single-word events (`loading`, `select`, `unselect`) are unaffected —
  kebab-casing a single lowercase word is a no-op. The package's own README
  already documented the correct kebab form (`event-click`), so this fix makes
  the previously-published example actually work.

## 0.1.2

### Patch Changes

- First all-targets release line debut publish. `@rozie-ui/fullcalendar-lit` graduates from "deliberately out of release scope" (vue-only dogfooding) to a verified publish, aligned with `-vue`/`-react`/`-solid`/`-svelte`/`-angular`. Build/typecheck/codegen-idempotency/family-test/VR gates all pass clean for the Lit target — no emitter changes were needed.
- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
