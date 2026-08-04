# @rozie-ui/popover-react

## 0.1.5

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  Two read kinds landed here:
  - **Prop read** — `disabled`. Disabling the popover after mount is now observed by the mount-registered tracking setup instead of being pinned to the first render's value.
  - **Helper call** — `startTracking()`, so Floating UI tracking starts against current anchor/placement state.
- No `$emit` handler prop was affected. No API surface change.
- @rozie/runtime-react@0.2.3

## 0.1.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.1`. The public `.d.ts` no longer types `toggle`/`show`/`hide` (on `renderAnchor`) as `unknown` — all three resolve to top-level script functions and now type callable (`(...args: any[]) => any`), reversing the 0.3.0 regression that broke the documented `renderAnchor={({ toggle }) => <button onClick={toggle}>…</button>}` quick-start pattern under strict TS. No runtime behavior change; type surface only.

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. Declared emit handlers were also landing in the root DOM fallthrough spread and firing twice per emit — the emitter now keeps them out of it. The public `.d.ts` no longer types unresolved `r-for` slot-context params as callable (`() => void`) — they're now `unknown`, matching what the runtime actually hands the caller. No API surface change.

## 0.1.2

### Patch Changes

- @rozie/runtime-react@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-react@0.2.0
