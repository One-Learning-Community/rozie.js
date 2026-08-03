# @rozie-ui/popover-react

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
