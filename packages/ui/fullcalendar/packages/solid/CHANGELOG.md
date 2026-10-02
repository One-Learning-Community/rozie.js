# @rozie-ui/fullcalendar-solid

## 0.2.0

### Minor Changes

- a9d67cb: Fixes from the pre-release audit:
  - **`:options` no longer re-applies every key on every render.** Before, each new `options` object (an inline literal re-created by every parent render) called `setOption` for every key. That refetched `eventSources` on every render, which looped forever when the parent stored `loading`/`eventsSet` in state, and it let `options` override curated keys after mount. Now only keys whose value changed are applied (plain arrays and objects compare by content, functions by identity), and curated keys (the props, `events`, every wrapped callback and filled slot) are never taken from `options`, at mount or later. `options.height`, `options.eventClick` and `options.viewDidMount` can no longer replace the wrapper's own.
  - **`firstDay` follows the locale by default.** Its default is now `null` (it was `0`, which forced Sunday even for `locale="de"`). Set a number to override; `options.firstDay` also works while the prop is unset.
  - **`height` edge cases:** an empty string, `null`, or a non-positive number falls back to `480` on every target (React used to fall back while the others passed the value through).
  - **`events` replaces only its own events.** Changing `events` used to call `removeAllEvents`, which also removed events from `options.eventSources` and from the `addEvent` verb. The prop now owns an event source of its own. `addEvent` also normalizes like `events` (empty title, `defaultColor`).
  - **Richer payloads:** `dateClick` adds `dayEl` (the clicked day cell, an anchor for a popover) and `jsEvent`; `eventDrop` and `eventResize` add `oldEvent` and `revert()`, so a handler can reject the change.
  - **Untitled events have an accessible name:** they get `aria-label="Untitled event"` (with the time when there is one). A consumer's `options.eventDidMount` still runs.
  - **After unmount** the handle's `getApi()` returns `null` instead of the destroyed calendar.
  - **Docs:** the Svelte example used `oneventClick`, which Svelte ignores (the prop is `oneventclick`); the Solid slot examples used `event` / `dayCell` instead of `eventSlot` / `dayCellSlot`. Each README's slot table now lists the binding for its framework.

- a9d67cb: Typed public surface, phase 1: a component can now declare real TypeScript types for its events, slot parameters and imperative handle, and a consumer on any target sees them instead of `any`. See the new guide, "Typed public surface".

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

- a9d67cb: FullCalendar now accepts CSS heights, forwards the event DOM element on hover/click payloads, and stops leaking event ids into untitled events (external consumer feedback).

  `height` now accepts a CSS height string (`'auto'`, `'100%'`, any CSS length) as well as a pixel number, and a purely numeric string such as `'600'` is treated as pixels. Set the height through this prop: the curated `height` wins over `options.height`, so `options.height` can never supply it.

  The `eventClick`, `eventMouseEnter` and `eventMouseLeave` payloads now include `el`, the event's DOM element, so a popover or tooltip can anchor on it.

  BEHAVIOR CHANGE: an event without a `title` now renders an empty title instead of text derived from its `id` (`Event <id>`), which leaked internal server ids into the calendar. Consumers who relied on that fallback must supply titles. The `defaultColor` fallback is unchanged.

  The README now documents the keyboard-focusability opt-out (`options.eventInteractive: false`), that `loading` fires only for event sources FullCalendar fetches itself, and the `noEventsContent` list-view recipe. It also no longer claims a `view` key on the `eventClick` / `dateClick` payloads, which was never emitted.
  - @rozie/runtime-solid@0.8.0

## 0.1.10

### Patch Changes

- 4f2148d: **Fixed: published Solid leaves now ship compiled JavaScript for `import`/`require`, with JSX
  kept only under the `solid` export condition.**

  Every `@rozie-ui/*-solid` leaf with markup previously shipped Solid JSX inside
  `dist/index.{mjs,cjs}` under a plain `import`/`require` (`chartjs-solid` renders no markup of its
  own, but ships the same corrected export shape for consistency with its siblings). That is not
  valid JavaScript on its own — a default `vite-plugin-solid` setup
  fails with "JSX syntax is disabled" (the plugin only transforms `.[mc]?[jt]sx` files), and any
  bundler without a Solid plugin fails outright. The only way to consume these packages was to
  manually point `vite-plugin-solid` at the package's `.mjs` files inside `node_modules` — a
  workaround, not a supported shape.

  New export shape (the standard one for a published Solid library):
  - `import` / `require` → `dist/<entry>.{mjs,cjs}`, compiled to plain DOM output by
    `babel-preset-solid`. Any bundler consumes this with no Solid plugin at all.
  - `solid` (export condition) → `dist/source/<entry>.jsx`, JSX kept intact. `vite-plugin-solid`
    and SolidStart resolve this condition first and compile it themselves for their own mode (DOM /
    SSR / hydration).

  **If you were using the `extensions: ['.mjs']` / `node_modules` `include` workaround with
  `vite-plugin-solid` to consume one of these packages, remove it — it is no longer needed** and a
  default `vite-plugin-solid` setup now resolves the `solid` condition correctly on its own. No
  public API change on any of these leaves.

- Updated dependencies [4f2148d]
  - @rozie/runtime-solid@0.7.5

## 0.1.9

### Patch Changes

- b084200: Declare `@rozie/runtime-*` as `workspace:^` instead of `workspace:*`.

  `workspace:*` publishes as an **exact** pin on the runtime version, so every toolchain bump forced a republish of every leaf that carried one — 76 of the 92 packages in the previous release wave had no source change at all. `workspace:^` publishes as `^<version>`, which a later patch-level runtime still satisfies, so an unchanged leaf stays valid instead of being dragged along.

  This is not a new policy: it is the caret policy already documented and applied by nine family codegen scripts ("bake the caret policy now so `workspace:*` is normalized to `workspace:^`"). It was simply never applied to the leaves whose codegen does not write `package.json`. The Svelte leaves were already fully aligned; the Vue leaves were aligned apart from three. This brings the React, Solid, Lit, and Angular leaves in line, so all six targets now state the dependency the same way.

  The `@rozie/*` toolchain packages keep `workspace:*` deliberately — they are a changesets `fixed` group and always version in lockstep, so an exact pin is correct there.

  This release still republishes these leaves, because their published `package.json` genuinely changes. The benefit is on every release after it.
  - @rozie/runtime-solid@0.7.4

## 0.1.8

### Patch Changes

- @rozie/runtime-solid@0.7.3

## 0.1.7

### Patch Changes

- @rozie/runtime-solid@0.7.2

## 0.1.6

### Patch Changes

- @rozie/runtime-solid@0.7.1

## 0.1.5

### Patch Changes

- @rozie/runtime-solid@0.7.0

## 0.1.4

### Patch Changes

- @rozie/runtime-solid@0.6.0

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The `splitProps` skip-list now correctly excludes emit-handler props from the root DOM fallthrough spread — previously a consumer's handler fired twice per emit. No API surface change.

## 0.1.2

### Patch Changes

- First all-targets release line debut publish. `@rozie-ui/fullcalendar-solid` graduates from "deliberately out of release scope" (vue-only dogfooding) to a verified publish, aligned with `-vue`/`-react`/`-lit`/`-svelte`/`-angular`. Build/typecheck/codegen-idempotency/family-test/VR gates all pass clean for the Solid target — no emitter changes were needed.
- @rozie/runtime-solid@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-solid@0.2.0
