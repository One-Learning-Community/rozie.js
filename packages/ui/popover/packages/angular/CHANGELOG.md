# @rozie-ui/popover-angular

## 0.3.1

### Patch Changes

- 36d4469: `onChange` is now typed `never` with a @deprecated note pointing at `onOpenChange`; it used to type-check as the native change handler and never fire. The `change` event was removed in 0.3.0, but `PopoverProps` extends the root `<div>`'s HTML attributes, so `<Popover onChange={…}>` still compiled as the DOM `change` handler. React and Solid now reject it with the note, and so does Svelte for `onchange` (use `bind:open`). Vue, Angular and Lit are unchanged; they get a version bump only.
- 36d4469: `idBase` now defaults to `''`, and each popover generates a unique id base after mount (`rozie-popover-<n>`). Every popover left at the default used to get the panel id `rozie-popover-panel`, so two open popovers shared an id and the anchor's `aria-controls` / `aria-describedby` could point at the wrong panel. An explicit `idBase` is used as before, and the `anchor` slot's `panelId` follows the generated id.

  The README and docs now explain that the root is `display: contents`: a `class` or `style` you pass reaches it, but only inherited properties (color, font, the `--rozie-popover-*` tokens) take effect there. To place a popover in a flex row or grid, wrap it in your own element.

  Lit: a popover that re-rendered before its first open (for example after a prop change) could open unpositioned, in normal flow instead of floating at the anchor, because positioning started before the panel had rendered. Positioning now waits for the panel.

- c362398: The npm package now includes `CHANGELOG.md`. It was written for every release but left out of the tarball, because npm no longer adds a changelog by itself, so a behaviour change recorded there (such as the 0.7.0 combobox Ctrl/Cmd/Alt+Enter change) was invisible to anyone reading the installed package.
- Updated dependencies [c362398]
  - @rozie/runtime-angular@0.9.0

## 0.3.0

### Minor Changes

- a9d67cb: Add a `reference` prop for positioning the popover against an external or virtual element.

  Before this, `Popover` could only measure its own anchor wrapper, which holds whatever you project into the `anchor` slot. It could not open next to an element that another component renders, such as a calendar event element. The workaround was a `position: fixed` wrapper sized to that element's rect. Now you can pass the element directly:
  - **`reference`** (`Element | Object`, default `null`) takes either a DOM Element or a Floating UI [virtual element](https://floating-ui.com/docs/virtual-elements), which is any object with `getBoundingClientRect()` plus an optional `contextElement`. Use a virtual element to open at a pointer position.
  - **Positioning:** the panel is positioned and tracked against the reference with Floating UI's `autoUpdate`. Changing `reference` while the popover is open repositions it against the new reference.
  - **Dismissal:** a click on (or inside) a referenced Element does not count as an outside click, so a toggle on that element closes the panel instead of dismissing it and reopening it. A virtual element adds no inside region. Escape dismissal is unchanged.
  - **ARIA:** with `reference`, you own the trigger ARIA (`aria-haspopup` / `aria-expanded` / `aria-controls`) on your own element. Pair it with `trigger="manual"` and a two-way-bound `open`.
  - **Stable value:** pass the same element or object across renders. A new object on every render restarts tracking.

  The click-outside listener now receives the DOM event on every framework.

  `reference` is additive: it defaults to `null`, which keeps the built-in anchor and behaves exactly as before. (This popover release does carry one breaking change, the removal of the `change` event; see its own entry.)

- a9d67cb: **Breaking: the `change` event is removed.** Use the `open` model's own change event, which carries the same boolean and fires at the same moments:

  | Target        | Before     | Now                                |
  | ------------- | ---------- | ---------------------------------- |
  | Vue           | `@change`  | `@update:open` (or `v-model:open`) |
  | React / Solid | `onChange` | `onOpenChange`                     |
  | Svelte        | `onchange` | `bind:open`                        |
  | Angular       | `(change)` | `(openChange)` (or `[(open)]`)     |
  | Lit           | `change`   | `open-change`                      |

  On Angular and Lit, `change` collided with the native `change` event that bubbles out of any input inside the panel. Angular `(change)` handlers also received those DOM events, and Lit `change` listeners got plain `Event`s where the type promised `CustomEvent<boolean>`.

  Fixes and additions from the pre-release audit:
  - **Panel id:** the panel id is no longer the fixed `rozie-popover-floating`, which every popover on a page shared. It is `idBase + '-panel'`, with a new `idBase` prop (default `'rozie-popover'`; give each instance its own). The `anchor` slot now also passes `panelId`, so your trigger can set `aria-controls` / `aria-describedby`.
  - **ARIA:** a click popover's anchor wrapper also sets `aria-controls` while open. Hover/focus tooltips no longer claim `aria-haspopup="dialog"` / `aria-expanded`; they keep `aria-describedby`.
  - **Detached reference:** if a referenced Element is removed from the document while open, the popover closes. It used to be positioned against a zero rect at the top-left corner.
  - **Placement changes stick (React):** a change to `placement`, `offset`, `disableFlip`, `disableShift` or `strategy` while open was reverted by the next scroll or resize update on React. Tracking now restarts with the new values on every target.
  - **`matchWidth` and `arrow` reconcile:** toggling them while open now applies. Turning `matchWidth` off clears the width it set, and a zero-width reference (a point virtual element) no longer sets `width: 0px`.
  - **Focus return:** focus now returns to where it was when the popover opened for `manual` popovers too (e.g. with `reference`), and for opens through the handle or a controlled `open`. It is restored only when focus would otherwise be lost (inside the closing panel, or on `<body>`), so clicking into another input no longer pulls focus back to the trigger.
  - **Outside clicks are decided after your handlers:** the click-outside close is decided after the click's own handlers have run, against the `reference` as it is then. A handler that repoints `reference` at the element it was clicked on (keeping `open` true) now moves the panel there on every target. On Angular this used to close the panel while the parent still held `open = true`: the close and the parent's re-open landed in the same tick, and Angular does not re-push an unchanged binding.

- 5abc36f: Add a `popupRole` prop for a popover that hosts a menu (or a listbox, tree or grid), from oinbox dogfooding.
  - **`popupRole`** (`'dialog'` by default, or `'menu'`, `'listbox'`, `'tree'`, `'grid'`; any other value is treated as `'dialog'`) is the `aria-haspopup` a `click` popover's anchor wrapper announces. It was hardcoded to `"dialog"`, so a menu button had to switch to `trigger="manual"` with its own ARIA and lost the click trigger's focus return.
  - **The `anchor` slot passes `popupRole`** alongside `open` and `panelId`, so your own focusable trigger can carry `aria-haspopup` / `aria-expanded` / `aria-controls`. It is `null` for the tooltip triggers (`'hover'` / `'focus'`), which claim no popup. It is typed `PopoverPopupRole | null`, and the new `PopoverPopupRole` union is exported from every package entry, so it binds straight to `aria-haspopup` under strict React and Solid types.

  Default popovers are unchanged.

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

- @rozie/runtime-angular@0.8.0

## 0.2.4

### Patch Changes

- 4f2148d: Packaging fixes bundled with this release:
  - the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/popover-angular`, this package's own.
  - this package declared `"sideEffects": false` while still shipping `themes/*.css` — a bundler was technically permitted to tree-shake those files away even on a direct `import '@rozie-ui/popover-angular/themes/<name>.css'`. `sideEffects` is now `["*.css", "**/*.css"]`, matching the React leaf.
- 4f2148d: Design-system bridges now yield to a token set on any ancestor, and apply correctly on Lit.

  Each family's `bootstrap`/`material`/`shadcn` theme bridge previously assigned the tokens it
  maps directly on the component's own class. In CSS, a value an element declares for itself
  always beats one it would inherit — so with a bridge imported, a public
  `--rozie-<family>-*` token set on an ancestor (`:root`, `.dark`, a themed wrapper) had no effect;
  only setting it on the component element itself worked. On Lit specifically, where the
  component's class lives inside a shadow root that a document-level bridge selector can never
  match, every bridge was completely inert.

  Every read site that base.css gives a default, or a bridge maps, is now public-token-first, then
  a private wiring name, then the inline default — e.g.
  `var(--rozie-switch-on-bg, var(--rsw-on-bg, #0066cc))` — so a value set on any ancestor always
  wins over a bridge's own mapping, and a public accent set on an ancestor now also recolours the
  bridge-mapped tokens that default to it (ring colour, check colour, etc). Each bridge now
  redeclares only the wiring for the tokens it maps, with the design system's own variable as the
  fallback, resolved on the component itself — so it follows the nearest theme scope rather than
  only ever reading `:root`, and a Lit host in the document's light DOM is matched directly by its
  tag. Zero-import rendering is unchanged in every case: with nothing imported, every chain still
  resolves to the same built-in default it always has.

  **Behaviour changes a consumer can see:** with a bridge imported, a `--rozie-<family>-*` token
  set on any ancestor now wins over the bridge's mapping (previously it only won when set directly
  on the component element). On Lit, the bridges now actually apply (previously inert); a Lit
  component nested inside another shadow root reads the design system's variables at the document
  root.

  **`@rozie-ui/rete`** additionally fixes its dark palette specifically: `FlowCanvas`'s
  OS-dark palette was declared directly on the canvas element (competing with base.css's own
  `.dark`/OS-dark declarations on the same element), so any ancestor override of a
  `--rozie-flow-*` token was dead in OS-dark mode even with nothing else imported. The palette now
  lives at the document root at zero specificity, so an ancestor override reaches it in every mode.

  No component source behaviour changes beyond the CSS cascade described above; this is a pure
  theming/cascade fix in every family listed.
  - @rozie/runtime-angular@0.7.5

## 0.2.3

### Patch Changes

- b084200: Declare `@rozie/runtime-*` as `workspace:^` instead of `workspace:*`.

  `workspace:*` publishes as an **exact** pin on the runtime version, so every toolchain bump forced a republish of every leaf that carried one — 76 of the 92 packages in the previous release wave had no source change at all. `workspace:^` publishes as `^<version>`, which a later patch-level runtime still satisfies, so an unchanged leaf stays valid instead of being dragged along.

  This is not a new policy: it is the caret policy already documented and applied by nine family codegen scripts ("bake the caret policy now so `workspace:*` is normalized to `workspace:^`"). It was simply never applied to the leaves whose codegen does not write `package.json`. The Svelte leaves were already fully aligned; the Vue leaves were aligned apart from three. This brings the React, Solid, Lit, and Angular leaves in line, so all six targets now state the dependency the same way.

  The `@rozie/*` toolchain packages keep `workspace:*` deliberately — they are a changesets `fixed` group and always version in lockstep, so an exact pin is correct there.

  This release still republishes these leaves, because their published `package.json` genuinely changes. The benefit is on every release after it.
  - @rozie/runtime-angular@0.7.4

## 0.2.2

### Patch Changes

- @rozie/runtime-angular@0.7.3

## 0.2.1

### Patch Changes

- @rozie/runtime-angular@0.7.2

## 0.2.0

### Minor Changes

- f1fd891: Combobox gains multi-select, a floating-positioned popup, and creatable mode; popover gains two opt-in composition primitives; command-palette's combobox peer moves to admit the new minor.

  **`@rozie-ui/combobox` — multi-select via a widened model, not a second one.** A new `multiple: Boolean` prop (default `false`) turns the existing sole `value` model into an array of selected values — there is still only one `model: true` prop, so `[formControl]` / `[(ngModel)]` binding on Angular is unaffected. Re-selecting a selected option toggles it off; selected values render as chips in selection order through a new `#chip` scoped slot (`{ option, remove, index }`); duplicate values dedupe to one chip; a chip whose option later disappears from `options` persists, labelled by its raw value; Backspace on an empty query removes the last chip. `aria-multiselectable="true"` and per-option `aria-selected` are present on the listbox when `multiple` is on. Works across all four render branches (plain, `groups`, `groups`+`groupCap`, `virtual`).

  The `change` event payload gains a `selected` field — the direction of the toggle (`true` when a value was added, `false` when removed or after `clear()`). This is purely additive for existing single-select consumers destructuring `{ value, option }`: `selected` is simply a new property, always `true` for a single-select pick.

  **Consumer-visible DOM change under `multiple`:** selected chips render as a `<ul class="rozie-combobox-chips">` inside the composed popover's anchor content, immediately before the `<input>`, guarded solely on `multiple` — so the chip rail plus the input together become what the floating popup's `matchWidth` measures. Consumer CSS that targets `.rozie-combobox`'s direct children may need attention when opting into `multiple`; the non-`multiple` DOM shape is unchanged.

  **`@rozie-ui/combobox` — floating-positioned popup, composed rather than reimplemented.** The popup is now positioned by Floating UI through the published `@rozie-ui/popover` leaf (a new `@rozie-ui/popover-<target>` peer on all six leaves) rather than static CSS: it flips and shifts to stay on screen near a viewport edge. `placement`, `offset`, `disableFlip`, and `disableShift` forward to the composed popover. Under `inline`, a Popover is still mounted — what `inline` switches off is positioning and dismissal, via `disablePositioning` and `disableDismiss`; the list continues to render through the same composed popover as the floating mode.

  **`@rozie-ui/combobox` — creatable mode.** A new `creatable: Boolean` prop (default `false`). When committed text matches no existing option (case-insensitive, trimmed, exact label match), combobox emits a new `create` event with the query string and writes nothing to `value` — the consumer owns adding the option and updating the model. The create affordance renders last, through a new `#create` scoped slot, after all options and group sections. Composes with `multiple`.

  **`@rozie-ui/popover` — five new opt-in, gated capabilities, shipping as a MINOR.** All six leaves land on `0.2.0` in this wave. `bare: Boolean` strips Popover's own positioning wrapper output down to a minimal unstyled surface — for a composing component (like combobox's floating mode) that wants Popover's mount/dismiss lifecycle without its default chrome. `disablePositioning: Boolean` takes the panel out of Floating UI's positioning path entirely, so it participates in ordinary document flow instead of being absolutely positioned — this is what `inline` mode now relies on, and it previously had no release note at all. `keepMounted: Boolean` hides the floating panel instead of unmounting it (a one-shot position on mount, `autoUpdate` still strictly open-gated) — useful for a composed virtualizer whose scroll container must survive close/open. `matchWidth: Boolean` matches the panel's width exactly to its anchor via Floating UI's `size` middleware, width-only. `disableDismiss: Boolean` suppresses Popover's own Escape-key and click-outside dismissal listeners — for a composing component that drives `open` itself and needs to veto Popover's independent dismissal while a host sub-surface anchored to (but not nested inside) the composed control legitimately holds focus. All five default to `false`; existing click/hover/focus, non-`bare`, non-`disablePositioning`, non-`keepMounted`, non-`matchWidth`, non-`disableDismiss` consumers see no behavioral or visual change to the pre-wave 12-prop surface — verified via an additive-only `.d.ts` diff and Docker VR runs with zero unexplained baseline diffs. Three CSS rules were ADDED to support these capabilities (`--static`, `--bare`, `--hidden`); the pre-existing rule set is itself unchanged, but a reader should not infer that no rules were added at all.

  Two caveats existing consumers should know before adopting either capability: **`matchWidth` is not reversible** — there is no `$watch` and no code path that ever clears the inline `style.width` the `size` middleware writes once applied, so a consumer that toggles `matchWidth` off at runtime will see the stale width persist. And **existing `trigger="manual"` consumers DO see an emitted-DOM change**: `aria-haspopup`/`aria-expanded` were unconditional pre-wave and are now gated on a new `hasGestureTrigger()` check (`trigger === 'click' || 'hover' || 'focus'`), so a `trigger="manual"` popover no longer emits those two attributes.

  **`@rozie-ui/command-palette` — combobox peer range widens; the FILES and the COMPONENT tell two different stories.** All six leaves widen their `@rozie-ui/combobox-<target>` peer from `^0.4.0` to `^0.5.0`. A caret range on a 0.x version pins the minor, so the previous range does not admit combobox's incoming `0.5.0` — every leaf moves in this same wave or the published command-palette leaves become uninstallable against the combobox version they actually need.

  **File-truth:** zero source drift. The complete diff across all six `@rozie-ui/command-palette-<target>` leaves is six `package.json` peer lines, independently confirmed by a published-tarball audit showing all six leaves drifting on `package.json:manifest` only.

  **Component-truth:** the rendered component is not unchanged, because it composes combobox and inherits combobox's own popover composition. It now unconditionally mounts a Popover, adding `.rozie-popover-anchor` / `.rozie-popover-floating` wrapper elements to the DOM; it gains an unconditional `queueMicrotask` focus re-assertion routed through combobox's `onFocus` on all six targets; and `pinned` moves from a module-scope `let` to reactive `$data`. `command-palette` itself still uses `inline` (never floats). The command-palette audit traced all three of these and found no defect follows from any of them — noted here so a reader relying on "peer range only" does not miss real, if inert, DOM and behavior changes.

### Patch Changes

- @rozie/runtime-angular@0.7.1

## 0.1.2

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

## 0.1.1

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
