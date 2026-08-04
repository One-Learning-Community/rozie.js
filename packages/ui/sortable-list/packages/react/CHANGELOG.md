# @rozie-ui/sortable-list-react

## 0.1.10

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  All three read kinds landed here:
  - **`$emit` handler props** (5) — `onAdd`, `onChange`, `onEnd`, `onRemove`, `onStart`. SortableJS callbacks are registered once at mount, so a consumer swapping a drag handler after mount previously kept getting the original called.
  - **Prop reads** (3) — `animation`, `forceFallback`, `options`. The SortableJS instance is constructed inside `$onMount`; these now read current values at construction time.
  - **Helper call** — `resolveGroup()`, so cross-list group resolution runs against current group configuration.
- No API surface change.
- @rozie/runtime-react@0.2.3

## 0.1.9

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. Declared emit handlers were also landing in the root DOM fallthrough spread and firing twice per emit — the emitter now keeps them out of it. The public `.d.ts` no longer types unresolved `r-for` slot-context params as callable (`() => void`) — they're now `unknown`, matching what the runtime actually hands the caller. No API surface change.

## 0.1.8

### Patch Changes

- @rozie/runtime-react@0.2.1

## 0.1.7

### Patch Changes

- ac09c50: Fix a keyboard hijack when an interactive element (a `<input>`, `<button>`, etc.) is rendered into a sortable row's default slot — the row's `onRowKeyDown` handler previously ran on any keydown that bubbled up to it, hijacking Space/Enter/Escape/Arrow keystrokes typed into the slotted child for lift/drop/move/cancel before the child ever saw them. Reorder keys now apply only when the row element ITSELF is focused; keystrokes originating from a slotted interactive child fall through untouched to that child. No API change, no per-target behavior divergence — the "editable row" pattern (a text input alongside drag-to-reorder) now works as expected.

## 0.1.6

### Patch Changes

- @rozie/runtime-react@0.2.0
