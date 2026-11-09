# @rozie-ui/sortable-list-solid

## 0.3.0

### Minor Changes

- 7ae2b70: SortableList release candidate: full keyboard reordering, one event payload, and the API it will keep at 1.0. Several changes break existing code; each is under **Changed** with what to do. The [SortableList docs](https://github.com/One-Learning-Community/rozie.js/blob/main/docs/components/sortable-list.md) describe everything below in full.

  **Changed**
  - The `change` event is now `reorder`: React and Solid `onChange` → `onReorder`, Vue `@change` → `@reorder`, Svelte `onchange` → `onreorder`, Angular `(change)` → `(reorder)`, Lit `change` → `reorder`. Rename your handler. (`change` clashed with the native `change` event of inputs inside rows.)
  - Every event (`reorder`, `add`, `remove`, `start`, `end`), mouse or keyboard, now has one payload: `{ interaction, item, el, from, to, oldIndex, newIndex, originalEvent? }`. `item` is always the row's data value, and `el` is the row element (`null` when there is none). A mouse `start` / `end` used to be SortableJS's raw event, with the row element as `item`; read the element from `el` now, and SortableJS's event from `originalEvent` (mouse only). Keyboard payloads used to carry the item as `data`; it is `item` now. `add` and `remove` carry the full payload. `oldIndex` / `newIndex` count item rows only, whatever `#header` / `#footer` hold, and are `-1` on the side that has none.
  - `end` fires once per drag or keyboard lift, from the list where the row ends up (the destination of a move between lists, a clone drop included), one task after every list involved has written its array. A mouse `end` used to come from the source list, before the destination had updated. An `end` handler now sees the new order in its bound array on all six frameworks, so `save(items)` works there. A mouse drop back where the row started writes nothing and fires no `reorder` (`start` and `end` still fire). An unmounted list never emits: if the destination unmounts before its `end` runs, the origin list emits that `end` (with `to` still the destination's element), so `start` and `end` still pair; a keyboard lift whose list unmounts mid-lift ends from its origin the same way (it used to emit from the unmounting list). On a move between lists only the destination fires `end`: save the source list in its `remove` handler (see "Saving order" in the docs).
  - A move between lists emits `add` (destination) and then `remove` (source), by mouse and by keyboard. Keyboard hops and cancels used to emit `remove` first.
  - Drags between a SortableList and a plain SortableJS list (not a SortableList) are refused in both directions: the row goes back where it came from and no `add` / `remove` / `reorder` is emitted. A row dropped in from a plain list used to vanish from the page; a row dropped from a SortableList into a plain list was removed from the bound array. Dropped into a plain list, the source still fires `end`, reporting a drop in place (`to` is the source's list element, `newIndex` equals `oldIndex`).
  - `cloneable` now makes the list `{ pull: 'clone', put: false }`: a palette hands out copies and takes nothing back, by mouse or keyboard. It used to accept drops. To let a clone source receive rows, pass `options.group` yourself, e.g. `{ name: 'g', pull: 'clone', put: true }`.
  - The imperative `sort(order)` now writes the reordered array back through the bound `items` (your framework re-renders), and emits no event. It used to move the DOM behind the model.
  - The focus ring shows only for keyboard focus (`:focus-visible`), and is `#1a73e8` in every colour scheme. Set `--rozie-sortable-list-ring` to change it.
  - Event handlers are typed with the payload: `SortablePayload` is exported from every package, and React / Solid `onReorder` / `onAdd` / `onRemove` / `onStart` / `onEnd`, Svelte `onreorder` …, Vue's emits, Angular's outputs and Lit's event map all take it (they were `(...args: any[]) => void`). A handler typed with an incompatible parameter is now a type error.
  - `keyboardTrigger` is typed `SortableKeyboardTrigger` (`'row' | 'handle'`) and `orientation` `SortableOrientation` (`'vertical' | 'horizontal'`); both types are exported. Any other string is now a type error.
  - `#header` and `#footer` render just outside the `role="list"` element, no longer inside it. They are not part of the drop area and not inside the `listClass` box any more; to draw one box around header, rows and footer, wrap the component in your own element.
  - The `instructionsId` slot prop is `null` until the list has mounted, so server-rendered markup and the first browser render agree. `aria-describedby` bound to `null` renders no attribute.
  - Every default spoken announcement has new text: `Lifted {label}, position {p} of {t}`, `Moved {label} to position {p} of {t}`, `Moved {label} to {list}, position {p} of {t}`, `Dropped {label} at position {p} of {t}`, `Dropped {label} in {list} at position {p} of {t}`, `{label} is already first`, `{label} is already last`, `{label} can't be moved within {list}`, `No list before {list}`, `No list after {list}`, `Cancelled. {label} returned to {list}, position {p} of {t}`, `Cancelled. {label} returned to position {p} of {t}`, `Cancelled. {label} stays in {list}, position {p} of {t}`, `Cancelled. {label} removed from {list}` and `Lift ended`. The default instructions are "Press Space or Enter to pick up, and again to drop. Use the up and down arrow keys to move, Home and End to jump to the start or end, Page Up and Page Down to move several places, and Escape to cancel." (a horizontal list says "the left and right arrow keys"; a `sort: false` list says only "Press Space or Enter to pick up, and again to drop. Press Escape to cancel."; a list whose rows another mounted list could take adds "Hold Shift with an arrow key to move to another list."). Tests that assert the old text need updating.
  - Shift with an arrow key used to move a lifted row within its list, like the plain arrow key. Now, in a list with a `group`, it hops the row to the previous or next list, and in a list without a `group` it does nothing.
  - Only one keyboard lift exists on a page. Pressing Space or Enter on a row of another list drops the active lift and lifts that row.
  - SortableJS's own native DOM events (`choose`, `start`, `sort`, `filter`, `change` and the rest) no longer bubble out of the list element, on every framework. Listen to the component's events instead.

  **Added**
  - Keyboard moves between lists: while a row is lifted, Shift plus an arrow key hops it to the previous or next list that shares its `group`, following the same `pull` / `put` rules as a mouse drag (function-valued `pull` / `put` aren't reachable by keyboard). A forward hop lands at the top of the next list, a backward hop at the bottom of the previous one. Home, End, Page Up and Page Down also move a lifted row.
  - New props: `listLabel` (names the list for `aria-label` and announcements), `orientation`, `pageStep` (Page Up / Down distance, default 5), `keyboardInstructions` (replaces the spoken instructions), `keyboardTrigger` (`'handle'` moves keyboard reordering onto your own handle button: rows stop being tab stops and Space / Enter typed into a row's input never lifts the row; without a `handle` selector the keyboard is off and a console warning is logged) and `announcements`.
  - `announcements` rewords or translates everything the list says: an object of optional functions, one per message kind (the 15 above), each taking a context (`label`, `item`, `list`, and `position` / `total` where the message has them) and returning the text. The `Announcements`, `AnnouncementKind` and `AnnouncementContext` types are exported from every package.
  - The list element has `role="list"`, rows reference the instructions through `aria-describedby`, and the default slot receives `instructionsId` for a handle button. Every payload carries `interaction: 'pointer' | 'keyboard'`, and keyboard lifts fire `start` and `end`.
  - Changes to the `options` prop now reach SortableJS while the list is mounted (key by key, no remount), so mouse and keyboard follow the same values. `animation` is applied live too; `options.animation` and a runtime `option('animation', v)` win over the prop.

  **Fixed**
  - The keyboard now follows the same SortableJS rules as the mouse: `filter` (a matching row, or its slot root, can't be lifted; any other matching control, such as a `.js-remove` button or an `input` beside the row's text, blocks only presses on that control), `options.draggable`, `disabled` / `options.disabled` / `option('disabled', v)`, `sort: false`, and `options.handle` (in handle mode, like the `handle` prop). Turning the keyboard off while a row is lifted ends the lift where it is (`Lift ended`, and `end` fires), and focus moves to a row or the list, never to `<body>`.
  - Escape cancels a lift and returns the row to the list and position it was lifted from. It used to leave the row where the last move put it.
  - If your code takes the lifted item out of the bound array mid-lift, the lift ends: the list says `Lift ended`, fires `end` with that item and `el: null`, and moves focus to the nearest row, or to the list itself when no rows are left.
  - The spoken label falls back to the row's text when an item has no `label` field, never `[object Object]`. A `label` of `0` or `''` is used as given.
  - "Moved X to position N" named the displaced row instead of the moved one on React, Vue and Lit.
  - Focus returns to the moved row (or its handle) after every keyboard move on all six frameworks, including a burst of quick key presses on Angular.
  - Angular: the lifted-row class is applied while a row is lifted, and SortableJS's DOM events no longer reach the host element as extra component events. `@angular/forms` is now a declared peer dependency (the component, a form control, always imported it).
  - `options.group` wins over `group` and `cloneable` for the mouse after either prop changes at runtime, as it always did for the keyboard (a change used to put the prop's group back on the mouse only).
  - Lit: a list removed from the page and added back works again, and keeps the values set with `option(name, v)` for the mouse as for the keyboard. The `keyboard-trigger` and `orientation` attributes work in plain HTML (they used to be read as JSON and fall back to the default). A mouse drop into an empty list lands.
  - The README quick starts work: Svelte fills rows with the `children` snippet, Angular with `<ng-template #defaultSlot>`, Solid's row callback reads `item` as a value, and the Lit example uses the `rozie-sortable-list` tag and renders row content through `el.rozieSlots = { default: ({ item }) => … }`. Each README lists every peer dependency and the event names in its framework's form.
  - With a custom `options.draggable` that leaves some rows out, a mouse drag moved the wrong row (the one after the row grabbed) and reported indices that skipped the left-out rows. The row grabbed moves, and indices count every row, as by keyboard.
  - A mouse `end` whose destination list unmounted before it ran (it comes from the origin then) carried the detached row element as `el`; it carries `el: null`, as the keyboard does.
  - An `end` was dropped when the list it belongs to was only out of the page for a moment (Vue `<KeepAlive>` deactivated it, or it was moved in the DOM). Only a list that has unmounted loses its `end`.
  - A row dropped in from a plain SortableJS list (not a `SortableList`) that has non-draggable children, such as a header, went back one place off; it goes back exactly where it was.
  - A runtime `option('group', v)` now wins over `options.group` and the `group` / `cloneable` props for the mouse and the keyboard alike, and survives later changes of those props (it used to be overwritten by them, and the keyboard ignored it).
  - The default instructions say "Hold Shift with an arrow key to move to another list." only when another mounted list could take the list's rows, and update as lists mount, unmount or change group (a `pull: false` list, or a grouped list with no peer, used to say it anyway). On React the sentence is kept when one peer unmounts and another mounts in the same update. Many lists on one page stay cheap: an ungrouped list costs no peer check when it mounts or unmounts.
  - An inline `options` whose `group.pull` / `group.put` or `filter` is a fresh function every render (React) no longer undoes a runtime `option(name, v)` on each re-render. The newest function still reaches SortableJS when no runtime value is set for that option.
  - `sort(order)` runs in linear time on long lists.

  Known limitations: on Lit, markup in the element's light DOM can't reference `instructionsId` (an id reference doesn't cross the shadow root); rows rendered through `rozieSlots.default` can.

### Patch Changes

- @rozie/runtime-solid@0.10.3

## 0.1.21

### Patch Changes

- 3c4b293: README fixes: Angular examples use the component's `<rozie-sortable-list>` selector (the PascalCase tag they showed fails to compile with NG8001).

## 0.1.20

### Patch Changes

- cf49212: Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:
  - Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
  - Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
  - React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
  - Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
  - Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.
  - @rozie/runtime-solid@0.10.0

## 0.1.19

### Patch Changes

- 67902f8: React and Solid: slot props passed to the component are no longer part of the attribute pass-through spread onto its root element. On Solid a slot render function passed as `<name>Slot` (or a `slots` record) was written to the DOM as an attribute holding the function source; on React the slot members (`render<Name>`, `children`, `slots`) were left in the rest bucket. Regenerated with the compiler fix; no API change.
  - @rozie/runtime-solid@0.9.1

## 0.1.18

### Patch Changes

- c362398: The npm package now includes `CHANGELOG.md`. It was written for every release but left out of the tarball, because npm no longer adds a changelog by itself, so a behaviour change recorded there (such as the 0.7.0 combobox Ctrl/Cmd/Alt+Enter change) was invisible to anyone reading the installed package.
- Updated dependencies [c362398]
  - @rozie/runtime-solid@0.9.0

## 0.1.17

### Patch Changes

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

- a9d67cb: Props types now accept the root element's HTML attributes when a component passes attributes through to a single root element (typed public surface, phase 3).
  - React: `interface XProps extends Omit<React.ComponentPropsWithoutRef<'<tag>'>, …>` — `className`, `style`, `id`, `aria-*`, `data-*`, element-specific attributes (`disabled` on a `<button>` root, …) and DOM listeners typecheck without a cast.
  - Solid: the same with `ComponentProps<'<tag>'>`.
  - Svelte: `interface Props extends Omit<SvelteHTMLElements['<tag>'], …>` replaces `[key: string]: unknown`. **This is stricter:** an attribute the root element does not support, which the old index signature accepted, is now a type error.
  - The component's own props win on a name collision. `children` stays rejected when the component has no default slot, as do the content-replacing `dangerouslySetInnerHTML` (React) and `innerHTML` / `innerText` / `textContent` (Solid).
  - An `<svg>` root gets the SVG element's attributes (`fill`, `stroke`, `viewBox`, …). Any other non-HTML root (a custom element) gets the generic `HTMLAttributes<HTMLElement>` on React and Solid, and Svelte's permissive custom-element entry.
  - Components with `inherit-attrs="false"`, an `r-if` root or a component root are unchanged. Vue, Angular and Lit are unchanged; they already accepted pass-through attributes.

  The `.d.rozie.ts` sidecars (React, Solid, Svelte) carry the same types. Types only — no runtime change.
  - @rozie/runtime-solid@0.8.0

## 0.1.16

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

## 0.1.15

### Patch Changes

- b084200: Solid: slot scope values are now passed as lazy getters instead of eager reads.

  A scoped slot invocation used to build its param object as `{ open: open() }`. Because that object is constructed inside the JSX insert that invokes the slot, Solid subscribed the **insert itself** to every signal read while building it — so any change re-ran the insert, re-invoked the consumer's slot function, and replaced the rendered subtree. Emitting `{ get open() { return open(); } }` defers the read into the consumer's own reactive scope, which is Solid's own convention for passing reactive props.

  Observable fix: opening the data-table column menu no longer tears the just-focused trigger out of the DOM, so the documented "Escape returns focus to the trigger" guarantee now holds on Solid as it already did on the other five targets.

  Literals and function-valued expressions are deliberately left as plain properties — neither can read a signal, and wrapping a function would hand the consumer a new identity on every property access.

  Note for consumers: destructuring a slot scope (`({ option, index }) => …`) and spreading it behave exactly as before. The one behavior change is that **assigning** to a scope property now throws `TypeError: Cannot set property x of #<Object> which has only a getter`, where it previously succeeded silently. Writing to a slot scope was never a supported pattern.

  `@rozie/core` is named here even though no file under `packages/core/` changed: the emitter lives in the private `@rozie/target-solid` package, which is bundled into core's published dist (and into `unplugin`, `babel-plugin`, and `cli`). A changeset derived from changed paths alone would ship a toolchain that still emits the bug.
  - @rozie/runtime-solid@0.7.4

## 0.1.14

### Patch Changes

- @rozie/runtime-solid@0.7.3

## 0.1.13

### Patch Changes

- @rozie/runtime-solid@0.7.2

## 0.1.12

### Patch Changes

- @rozie/runtime-solid@0.7.1

## 0.1.11

### Patch Changes

- @rozie/runtime-solid@0.7.0

## 0.1.10

### Patch Changes

- @rozie/runtime-solid@0.6.0

## 0.1.9

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The `splitProps` skip-list now correctly excludes emit-handler props from the root DOM fallthrough spread — previously a consumer's handler fired twice per emit. No API surface change.

## 0.1.8

### Patch Changes

- @rozie/runtime-solid@0.2.1

## 0.1.7

### Patch Changes

- ac09c50: Fix a keyboard hijack when an interactive element (a `<input>`, `<button>`, etc.) is rendered into a sortable row's default slot — the row's `onRowKeyDown` handler previously ran on any keydown that bubbled up to it, hijacking Space/Enter/Escape/Arrow keystrokes typed into the slotted child for lift/drop/move/cancel before the child ever saw them. Reorder keys now apply only when the row element ITSELF is focused; keystrokes originating from a slotted interactive child fall through untouched to that child. No API change, no per-target behavior divergence — the "editable row" pattern (a text input alongside drag-to-reorder) now works as expected.

## 0.1.6

### Patch Changes

- @rozie/runtime-solid@0.2.0
