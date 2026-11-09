# @rozie-ui/sortable-list-angular

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

- 54962c5: Angular: an object or nested array inside a `:class` list is now applied, matching the other targets. `:class="['card', { active: isActive }]"`, or a list holding a prop whose value is an object or array, used to lose those classes on Angular, because Angular's own `[class]` binding only takes plain strings inside a list (and `[ngClass]` rejected them). Such values are now flattened to one class string by the new `rozieClass` helper in `@rozie/runtime-angular`. Plain strings, plain `{ ... }` objects and lists of plain strings bind as before.

  `@rozie-ui/sortable-list-angular`: an object or array `itemClass` / `listClass` (for example `{ 'is-flagged': true }`) now lands on the rows and the list.

- Updated dependencies [54962c5]
- Updated dependencies [983dd15]
  - @rozie/runtime-angular@0.10.3

## 0.1.16

### Patch Changes

- 3c4b293: README fixes: Angular examples use the component's `<rozie-sortable-list>` selector (the PascalCase tag they showed fails to compile with NG8001).

## 0.1.15

### Patch Changes

- cf49212: Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:
  - Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
  - Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
  - React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
  - Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
  - Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.
  - @rozie/runtime-angular@0.10.0

## 0.1.14

### Patch Changes

- c362398: The npm package now includes `CHANGELOG.md`. It was written for every release but left out of the tarball, because npm no longer adds a changelog by itself, so a behaviour change recorded there (such as the 0.7.0 combobox Ctrl/Cmd/Alt+Enter change) was invisible to anyone reading the installed package.
- Updated dependencies [c362398]
  - @rozie/runtime-angular@0.9.0

## 0.1.13

### Patch Changes

- @rozie/runtime-angular@0.8.0

## 0.1.12

### Patch Changes

- b084200: Declare `@rozie/runtime-*` as `workspace:^` instead of `workspace:*`.

  `workspace:*` publishes as an **exact** pin on the runtime version, so every toolchain bump forced a republish of every leaf that carried one — 76 of the 92 packages in the previous release wave had no source change at all. `workspace:^` publishes as `^<version>`, which a later patch-level runtime still satisfies, so an unchanged leaf stays valid instead of being dragged along.

  This is not a new policy: it is the caret policy already documented and applied by nine family codegen scripts ("bake the caret policy now so `workspace:*` is normalized to `workspace:^`"). It was simply never applied to the leaves whose codegen does not write `package.json`. The Svelte leaves were already fully aligned; the Vue leaves were aligned apart from three. This brings the React, Solid, Lit, and Angular leaves in line, so all six targets now state the dependency the same way.

  The `@rozie/*` toolchain packages keep `workspace:*` deliberately — they are a changesets `fixed` group and always version in lockstep, so an exact pin is correct there.

  This release still republishes these leaves, because their published `package.json` genuinely changes. The benefit is on every release after it.
  - @rozie/runtime-angular@0.7.4

## 0.1.11

### Patch Changes

- @rozie/runtime-angular@0.7.3

## 0.1.10

### Patch Changes

- @rozie/runtime-angular@0.7.2

## 0.1.9

### Patch Changes

- @rozie/runtime-angular@0.7.1

## 0.1.8

### Patch Changes

- 6943820: Lit and Angular dropped every leading comment on a top-level declaration promoted into
  the component class — 1370 apiece across the shipped corpus. Both emitters build each
  class member as a hand-built string (`generate(decl)` / `renderExpression` / a rebuilt
  arrow or `t.classMethod`), and none of those carries the STATEMENT's own comments, so an
  author's documentation simply vanished from the emitted component.

  Both now run a printed-comment ledger keyed on comment OBJECT IDENTITY. Identity rather
  than source offsets is load-bearing: a `.rzts` script partial is parsed as its own file,
  so its comment offsets collide with unrelated host comments. A per-branch rule cannot
  work here at all, because @babel/parser attaches a comment sitting BETWEEN two statements
  to BOTH neighbours at once — whichever side a local rule picks, the other side either
  double-prints it or drops it.

  Three properties this needed, each found by measuring the corpus rather than by reading
  code:

  **It looks back, not just down.** Each statement claims the PREVIOUS statement's
  still-unclaimed trailing comments as well as its own leading ones, rendering both above
  its member. Inline, one parse hands the same comment object to both sides, so it prints
  once. Across a `.rzts` splice boundary the successor comes from a different parse with
  nothing attached, and the previous statement's trailing side is the only place the
  comment exists. Without this the inline host printed a comment the partial-inlined host
  could not, and the partial-vs-inline byte-identity guards went red.

  **The ledger spans the import block.** A comment between the last import and the first
  promoted declaration is printed by the module-scope import generation — a separate
  printer with its own dedup set. Unseeded, 132 comments printed twice on Lit and 155 on
  Angular. Seeding from every comment merely ATTACHED to an import node over-corrected and
  lost 16, since a comment can hang off a node the block never prints; the seed is taken
  from what the block actually emitted.

  **It unclaims.** A statement can be consumed by another pass — a `$computed`, a lifecycle
  hook, a `$provide` directive — and produce no class member at all. When the flush finds
  no target it releases the claim so whichever printer does emit that statement still
  renders its comments. Claiming without emitting is how a ledger silently drops comments,
  which is strictly worse than double-printing, and this is why both targets report zero
  lost despite several statement kinds never reaching a ledger-owned array.

  Net effect: 5311 comments restored across 53 Lit leaves and 5266 across the Angular
  leaves, with ZERO comments dropped and ZERO non-comment bytes changed, plus 16
  pre-existing double-prints fixed on each target (a comment that had been emitted both at
  module scope and again inside the mount hook). Verified by parsing every file before and
  after, comparing the parser's own comment list as a multiset, and comparing
  `generate(ast, { comments: false })` on both sides — never by reading the diff.

  Emitted code is unchanged in every case; this is documentation fidelity only.

  Eighteen further Lit/Angular leaves drifted the same comment-only way but are
  deliberately absent from the front matter — dialog, lexical, listbox, maplibre,
  number-field, pagination, resizable, slider and switch (both targets) are all in
  `.changeset/config.json`'s `ignore` list, and listing an ignored package beside a
  non-ignored one makes `changeset status` fail outright.
  - @rozie/runtime-angular@0.7.0

## 0.1.7

### Patch Changes

- f3266db: `@rozie/runtime-angular` now exports `rozieDisplay`, `rozieAttr`, and `rozieToken`
  alongside the existing `RozieSlot` marker directive. The Angular target used to
  inline a copy of these three helpers (and, for `rozieToken`, its
  `globalThis`-backed cross-package registry) as module-scope declarations in
  _every_ emitted component that wrapped an interpolation or used the
  `$provide`/`$inject` context primitive — duplicating the same ~40 lines across 21
  `@rozie-ui/*-angular` leaves. The emitter now imports the helpers from
  `@rozie/runtime-angular` instead.

  Behavior is unchanged: the delegating `rozieDisplay`/`rozieAttr` class methods
  Angular templates call are untouched, `rozieToken`'s `globalThis`-backed identity
  guarantee is preserved verbatim, and a component using none of the three continues
  to carry no reference to `@rozie/runtime-angular` at all. `number-field` and `otp`
  (previously the only two Angular leaves with no existing `@rozie/runtime-angular`
  dependency) now declare it in both `package.json` and `ng-package.json`'s
  `allowedNonPeerDependencies`.

- 78d5b5b: `@rozie/runtime-angular` now exports `createRozieAttrApplier` and
  `createRozieHostAttrsReader` alongside the existing `RozieSlot`,
  `rozieDisplay`, `rozieAttr`, and `rozieToken` exports. The Angular target
  used to inline a copy of the `r-bind`/`$attrs` spread attribute applier and
  host-attribute reader (~85 lines: three `WeakMap` prev-state caches, the
  class/style merge logic, and the host-attribute fold) as a private-field
  IIFE pair in _every_ emitted component that used `r-bind` spread or read
  `$attrs` — 158 tracked emitted files, of which 23 are shipped
  `@rozie-ui/*-angular` leaf sources across 21 leaves.

  The emitted component keeps performing both `inject(Renderer2)` /
  `inject(ElementRef)` calls itself, in the same class-field initializer
  position; it now passes the resolved instance into the runtime factory
  (`createRozieAttrApplier(inject(Renderer2))`) instead of resolving it
  internally. Neither factory ever calls `inject()` or names an Angular
  type — both accept a structural interface (`RozieAttrRenderer`,
  `RozieHostRef`) — so this package still never resolves an Angular DI token
  itself, and the peer-keyed cross-package instance-identity hazard
  (`71dff1d5`) is structurally unreachable rather than merely tested against.

  Merge semantics, applied DOM output, and evaluation order are unchanged: a
  wrapper's own static `class` survives a spread that also sets `class`; a
  dropped `class`/`style` key removes only the tokens/properties this applier
  previously applied; an applied style still lands with `!important` priority,
  winning the last-write race against Angular's own `[ngClass]`/`ɵɵstyleMap`
  re-apply.

  A component using neither `r-bind` spread nor `$attrs` carries no new
  reference to `@rozie/runtime-angular` — the import gate is keyed on whether
  the emitter actually pushed the corresponding field declaration, independent
  of the two Tier-1 gates (`rozieDisplay`/`rozieAttr`/`rozieToken`,
  `RozieSlot`).

- Updated dependencies [f3266db]
- Updated dependencies [78d5b5b]
- Updated dependencies [ae824bd]
  - @rozie/runtime-angular@0.6.0

## 0.1.6

### Patch Changes

- ac09c50: Fix a keyboard hijack when an interactive element (a `<input>`, `<button>`, etc.) is rendered into a sortable row's default slot — the row's `onRowKeyDown` handler previously ran on any keydown that bubbled up to it, hijacking Space/Enter/Escape/Arrow keystrokes typed into the slotted child for lift/drop/move/cancel before the child ever saw them. Reorder keys now apply only when the row element ITSELF is focused; keystrokes originating from a slotted interactive child fall through untouched to that child. No API change, no per-target behavior divergence — the "editable row" pattern (a text input alongside drag-to-reorder) now works as expected.
