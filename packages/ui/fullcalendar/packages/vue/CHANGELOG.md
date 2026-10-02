# @rozie-ui/fullcalendar-vue

## 0.2.0

### Minor Changes

- f19abdb: Fixes from the pre-release audit:
  - **`:options` no longer re-applies every key on every render.** Before, each new `options` object (an inline literal re-created by every parent render) called `setOption` for every key. That refetched `eventSources` on every render, which looped forever when the parent stored `loading`/`eventsSet` in state, and it let `options` override curated keys after mount. Now only keys whose value changed are applied (plain arrays and objects compare by content, functions by identity), and curated keys (the props, `events`, every wrapped callback and filled slot) are never taken from `options`, at mount or later. `options.height`, `options.eventClick` and `options.viewDidMount` can no longer replace the wrapper's own.
  - **`firstDay` follows the locale by default.** Its default is now `null` (it was `0`, which forced Sunday even for `locale="de"`). Set a number to override; `options.firstDay` also works while the prop is unset.
  - **`height` edge cases:** an empty string, `null`, or a non-positive number falls back to `480` on every target (React used to fall back while the others passed the value through).
  - **`events` replaces only its own events.** Changing `events` used to call `removeAllEvents`, which also removed events from `options.eventSources` and from the `addEvent` verb. The prop now owns an event source of its own. `addEvent` also normalizes like `events` (empty title, `defaultColor`).
  - **Richer payloads:** `dateClick` adds `dayEl` (the clicked day cell, an anchor for a popover) and `jsEvent`; `eventDrop` and `eventResize` add `oldEvent` and `revert()`, so a handler can reject the change.
  - **Untitled events have an accessible name:** they get `aria-label="Untitled event"` (with the time when there is one). A consumer's `options.eventDidMount` still runs.
  - **After unmount** the handle's `getApi()` returns `null` instead of the destroyed calendar.
  - **Docs:** the Svelte example used `oneventClick`, which Svelte ignores (the prop is `oneventclick`); the Solid slot examples used `event` / `dayCell` instead of `eventSlot` / `dayCellSlot`. Each README's slot table now lists the binding for its framework.

- 543759b: Typed public surface, phase 1: a component can now declare real TypeScript types for its events, slot parameters and imperative handle, and a consumer on any target sees them instead of `any`. See the new guide, "Typed public surface".

  Four opt-in authoring features (a component that uses none of them compiles exactly as before; all are types-only, with no runtime change on any target):
  - `<types>` block: type-only statements (`import type`, `interface`, `type`, and `export` of those) hoisted into every target and re-exported from the package entry. Anything else is an error (ROZ019, ROZ020). A `<types>` import that clashes with a `<script>` import is ROZ024; an identical duplicate is dropped silently. A `<types>` name that collides with a generated name (`<Name>Props`, `<Name>Handle`, `Rozie<Name>EventMap`, slot context interfaces, …), with a name the compiled module imports (a `<components>` key, its `<Local>Handle`, or a framework / `@rozie/runtime-*` import such as `ReactNode` or `TemplateRef`, reserved on every target), or with a top-level `<script>` declaration is ROZ025.
  - `<emits>` block: `{ name: { payload?: '<type>', docs?: {...} } }`. When present it is the complete list: an undeclared `$emit` is an error (ROZ151), reported at the `$emit` call, and a declared event that is never emitted is a warning (ROZ152), reported at its `<emits>` entry. A `$emit` whose argument count does not match the declared payload is a warning (ROZ157), reported at the call. Invalid entries (including a repeated event name or `payload`/`docs` key), types and docs are ROZ021, ROZ022 and ROZ023. React and Solid get `onX?: (payload: P) => void`, Vue a typed `defineEmits`, Svelte a lowercase `onx` callback, Angular `output<P>()`, and Lit a `CustomEvent<P>` with a generated `Rozie<Name>EventMap` and typed `addEventListener`/`removeEventListener` overloads.
  - `<slot :param-types="{ row: 'Row' }">` types a slot parameter (unknown key ROZ153, malformed value ROZ154).
  - `$expose(verbs, signatures)`: a compile-time-only second argument typing the handle (unknown verb ROZ155, malformed ROZ156). The signature strings are stripped from every emitted module. A verb without a signature keeps its implementation's own types when it has them (a return-type annotation or an annotated `const`, in `<script lang="ts">`) on every target; only a fully untyped verb is `(...args: any[]) => any`.

  Also in this release:
  - The component manifest (`rozie-manifest.json`) is schema v2 and carries emit payloads, expose signatures, the `<types>` text and slot `:param-types`. The reader still accepts v1, so composing an already-published v1 package keeps working. Composing a package whose leaves ship a v2 manifest (`@rozie-ui/popover`, `@rozie-ui/combobox`, …) from your own `.rozie` requires `@rozie/*` at or above this release; a compiler that is too old now says so in ROZ988 (upgrade the toolchain) instead of advising a reinstall of the primitive.
  - `.d.rozie.ts` sidecars now carry `<types>` and type slots and events exactly as each compiled module does. Apart from `<types>`, these changes apply to every component, not only to ones that use the new features: Solid `<slot>Slot` props and JSX.Element shapes; Svelte Snippet shapes and lowercase handler names; no spurious `render<X>` props on Vue, Angular and Lit (Lit declares its slot receivers on the element class instead); no `on<X>` props on Lit; and on Angular, every component with events loses its spurious `on<Event>` props, and the declared class gets typed `OutputEmitterRef<T>` outputs from the same derivation as the compiled `output()` fields (`T` is the declared payload, otherwise `void`, or `unknown` when an untyped `$emit` passes a payload). The `<Name>Handle` of an `$expose` component now keeps the type of a verb declared as an annotated `const` (`const add: AddFn = …`) instead of `(...args: any[]) => any` (or the implementation's own signature). A Solid scoped default slot now accepts a function child.
  - Text such as `<script`, `<style`, `<title` or `<textarea` inside a `<types>`, `<emits>`, `<props>`, `<data>`, `<listeners>` or `<components>` body (in a comment, a docs string, or a generic like `Array<Style>`) no longer desynchronises the block splitter. Those bodies are now opaque to the HTML tokenizer.

  Untyped-handler convergence (the one planned typing change for components that do not opt in; the sidecar fixes above reach them too): an untyped event handler is now `(...args: any[]) => void` on every target. The shared `.d.ts` sidecar, Solid and Svelte used to emit `unknown[]`, which rejected handlers written with a concrete parameter type; React already used `any[]`. The generated sources of the Solid and Svelte leaves (and the React `.d.ts`) change accordingly, hence the patch bumps. `@rozie-ui/sortable-list-solid` and `@rozie-ui/switch-solid` also pick up the scoped-default-slot function-child fix.

  `@rozie-ui/popover-*` and `@rozie-ui/fullcalendar-*` adopt the features and are bumped minor, because typed events can reject a previously accepted wrong-typed handler:
  - popover: the `anchor` slot context is typed (including the new `panelId: string`) and the handle (`show`, `hide`, `toggle`, `reposition`) is typed. Its open state's change event is the `open` model's (Lit: `open-change`, now in `RoziePopoverEventMap` as `CustomEvent<boolean>`).
  - fullcalendar: 11 typed events (for example `eventClick` with `jsEvent: MouseEvent | KeyboardEvent`, and `unselect` with `jsEvent: UIEvent | null`), 10 typed portal slot arguments and 16 typed handle verbs. The `<types>` names are re-exported from every package entry, and the package barrels re-export the handle types and Lit event maps.
  - Both families generate their README event tables from `<emits>` and no longer ship `scripts/event-manifest.mjs`.

### Patch Changes

- 54e28a1: FullCalendar now accepts CSS heights, forwards the event DOM element on hover/click payloads, and stops leaking event ids into untitled events (external consumer feedback).

  `height` now accepts a CSS height string (`'auto'`, `'100%'`, any CSS length) as well as a pixel number, and a purely numeric string such as `'600'` is treated as pixels. Set the height through this prop: the curated `height` wins over `options.height`, so `options.height` can never supply it.

  The `eventClick`, `eventMouseEnter` and `eventMouseLeave` payloads now include `el`, the event's DOM element, so a popover or tooltip can anchor on it.

  BEHAVIOR CHANGE: an event without a `title` now renders an empty title instead of text derived from its `id` (`Event <id>`), which leaked internal server ids into the calendar. Consumers who relied on that fallback must supply titles. The `defaultColor` fallback is unchanged.

  The README now documents the keyboard-focusability opt-out (`options.eventInteractive: false`), that `loading` fires only for event sources FullCalendar fetches itself, and the `noEventsContent` list-view recipe. It also no longer claims a `view` key on the `eventClick` / `dateClick` payloads, which was never emitted.

## 0.1.5

### Patch Changes

- 4f2148d: **BEHAVIOUR CHANGE.** These components now emit `defineOptions({ inheritAttrs: false })` for
  their `inherit-attrs`/`inherit-listeners` opt-out, closing a Vue-target emitter bug fixed in
  `@rozie/core` in this same release (see that changeset for the full description): the opt-out
  was previously silently inert on Vue specifically, so undeclared attributes and listeners kept
  falling through onto the component's wrapper element regardless of the opt-out being declared.

  If your usage of one of these components relied on that fallthrough happening on Vue despite the
  opt-out (for example, `<DataTable class="x">` — a `@rozie-ui/data-table` example, not one of
  these four — putting `x` on `.rozie-data-table-wrap`), you will see a difference: the wrapper
  element no longer receives it, matching the behaviour every other target has always had.
  `@rozie-ui/chartjs-{react,solid,lit,svelte,angular}`, `@rozie-ui/codemirror-*` (non-Vue),
  `@rozie-ui/fullcalendar-*` (non-Vue), and `@rozie-ui/rete-*` (non-Vue) are unaffected — they
  never had the fallthrough bug.

  No other change; only the components regenerated for this fix ship in this release.

## 0.1.4

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

## 0.1.3

### Patch Changes

- Regenerated with the toolchain's Vue `$watch` flush:'post' fix: all `$watch`-driven prop/data reconcilers now run post-flush (after the DOM update, matching the React/Solid/Svelte/Angular/Lit leaves' timing) instead of Vue's default pre-flush. This closes the portal re-entrancy class (a portal fill mounting from inside an engine update can no longer synchronously flush a pending sibling watcher into the same engine mid-update) and the pre-flush `$refs`-read-too-early class (e.g. the embla runtime `thumbnails` toggle previously failed to build its thumb engine on Vue). No API surface change.

## 0.1.2

### Patch Changes

- A genuine patch roll since the published `0.1.1`, not a bookkeeping alignment: self-documenting prop descriptions from the codegen type-prop guard widening (`c3c748e7`) and the license/copyright header refresh (`a7733874`). No API change, no breaking change — the props/emits/slots/expose surface is unchanged, verified by the `tests/surface.test.ts` gate.
- This release also marks the debut of `@rozie-ui/fullcalendar` as a complete all-six-targets release line: `-react`/`-solid`/`-lit`/`-svelte`/`-angular` now publish alongside `-vue` for the first time, all aligned at `0.1.2`.
