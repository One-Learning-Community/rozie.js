# @rozie-ui/fullcalendar-react

## 0.1.9

### Patch Changes

- @rozie/runtime-react@0.7.2

## 0.1.8

### Patch Changes

- @rozie/runtime-react@0.7.1

## 0.1.7

### Patch Changes

- ba42bc2: On React, Angular, and Lit, the synthesized `$portals` closure now lives at COMPONENT scope
  (React: the hook section; Angular/Lit: a private class field) instead of being declared
  inside the mount-phase lifecycle hook body. Vue, Svelte, and Solid already did the right
  thing and are unaffected in shape (Vue/Svelte additionally now declare the closure BEFORE
  the user script, matching Solid, closing a secondary TDZ hazard for a top-level invocation).

  This closes a silent parity bug: a `<script>` top-level helper reading `$portals.<name>`
  previously compiled on three targets and failed on the other three — `TS2304 Cannot find
name 'portals'` on the bundled-leaf strict typecheck, `ReferenceError: portals is not
defined` at runtime, with zero diagnostics. Three failure shapes are fixed:
  1. A top-level helper reading `$portals.<name>`, called from `$onMount`.
  2. A top-level helper reading `$portals.<name>`, with NO `$onMount` at all — previously
     the whole closure was emitted NOWHERE on React (it was attached unconditionally to the
     first mount-phase hook; no hook meant it was silently dropped).
  3. A `$portals.<name>` read from a `$watch` body — broken on all three targets, and the
     shape driving most of the corpus workarounds this closes the door on.

  React additionally synthesizes a dispose-only effect (`[]` deps) for a component that has
  portals but no mount-phase lifecycle hook at all, so portal roots still bulk-dispose on
  unmount in that shape. Angular and Lit now lower `$portals.<name>` to a `this.`-qualified
  member read (the closure is a class field, not a same-method-only `const`); the
  reactive-handle `interface ReactivePortalHandle` moved to module scope on both (a TS
  `interface` cannot live inside a class body).

  A new diagnostic, ROZ149, now flags a `$portals.<name>` reference genuinely evaluated
  during setup/render — `<script>` Program top level, a `$computed` body, a `$watch` GETTER,
  or a template binding/directive/`r-for`-iterable/interpolation — since the portal anchor
  does not exist yet at those positions on any target, even after this fix. It does NOT fire
  on an ordinary function/arrow body (the shape this fix makes correct), `$onMount` /
  `$onUnmount` / `$onUpdate` bodies, a `$watch` CALLBACK, or event handlers.

  `.rozie` authors do not need to change anything for code that already calls `$portals` from
  inside `$onMount` — a hook-scope const / class field is visible from the method that used to
  declare it, so nothing that compiled before stops compiling. Emitted output is NOT
  byte-identical for any component with a portal slot — the closure text moves and, on
  Angular/Lit, gains a `this.` qualifier — so `@rozie-ui/chartjs`, `@rozie-ui/codemirror`,
  `@rozie-ui/fullcalendar`, `@rozie-ui/maplibre`, and `@rozie-ui/rete` (the shipped leaf
  packages whose `.rozie` sources declare a portal slot) take a patch bump alongside
  `@rozie/core`.

  The workaround bridges those five packages carry to route `$portals` calls into mount scope
  (null-let bridges, a "must not be called before mount" invariant, a relocated code block)
  are now unnecessary and can be unwound at leisure as an independent, opt-in follow-up — not
  part of this change.

  **Changeset scope note.** The six `@rozie-ui/<family>` umbrella packages are `private: true` and the repo sets `privatePackages.version: false`, so listing them alone versions nothing. The published, consumer-installed artifacts are the per-framework pre-compiled leaves (`@rozie-ui/<family>-<target>`), and they carry no dependency on `@rozie/core` — a core bump does not cascade to them. Since this change rewrites their emitted source, they are bumped explicitly. `@rozie-ui/maplibre-*` is omitted deliberately: those leaves are in the changeset config's `ignore` list. `-solid` leaves are omitted because Solid already emitted the closure at component scope and its output is unchanged.

  **Why no `@rozie-ui/<family>` umbrella entries.** Those six packages are `private: true`, so changesets treats them as ignored; a changeset that mixes ignored and non-ignored packages is rejected outright (`Mixed changesets that contain both ignored and not ignored packages are not allowed`), failing `changeset status` and any release run. Only the published, consumer-installed per-framework leaves are listed.
  - @rozie/runtime-react@0.7.0

## 0.1.6

### Patch Changes

- @rozie/runtime-react@0.6.0

## 0.1.5

### Patch Changes

- Stale-publish reconciliation. The published `0.1.4` tarball predates commit `1b0e5254`'s value-position stale-closure fix and never carried it — `pnpm publish` silently skips an already-published version, so the registry has been serving the pre-fix bytes at `0.1.4` since 2026-08-06.
  - **Fix: the calendar's initial event set could normalize against a stale closure.** `normalizeEvent` (which stamps a title fallback and applies `defaultColor`) is memoized on `props.defaultColor` and is called once, at the calendar's one-time construction, to build the initial `events` array. It was previously passed by identity into that construction; it is now ref-indirected, so the initial event set is always normalized through the current `normalizeEvent` rather than whichever closure existed when the once-only setup effect ran. The separate `events`-prop watcher that re-normalizes on every subsequent event-list change was unaffected by this gap and is unchanged.
  - No prop / event / slot / handle surface change.

- Updated dependencies
  - @rozie/runtime-react@0.5.1

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
