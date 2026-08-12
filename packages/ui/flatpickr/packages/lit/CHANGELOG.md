# @rozie-ui/flatpickr-lit

## 0.1.4

### Patch Changes

- Fixed: a multi-word `$emit()` event was dispatched in its raw camelCase source
  casing instead of being kebab-cased, so a consumer's kebab-cased template
  listener never fired on the Lit target — `addEventListener` is case-sensitive,
  and the two names never matched. The dispatch side now kebab-cases the event
  name to match the listener, the same convention the two-way model event path
  (`<prop>-change`) already used.

  **This changes the DOM event name string a Lit consumer must pass to
  `addEventListener`.** If you discovered the camelCase name empirically — the
  only form that worked before this fix — you must update your listener names:

  | Old (broken, never fired) | New (correct)  |
  | ------------------------- | -------------- |
  | `dayCreate`               | `day-create`   |
  | `monthChange`             | `month-change` |
  | `valueUpdate`             | `value-update` |
  | `yearChange`              | `year-change`  |

  Single-word events (`change`, `close`, `open`, `ready`) are unaffected —
  kebab-casing a single lowercase word is a no-op.

## 0.1.3

### Patch Changes

- c279a7e: Fix the `$attrs` auto-fallthrough skip-list to always exclude `data-rozie-ref` — a reserved compiler bookkeeping attribute, never a consumer prop. Previously a parent-assigned `ref=` on this component's own host tag could clobber the component's own internal `data-rozie-ref` markers via fallthrough re-application. No API change, no per-target behavior divergence.
- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.2

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
