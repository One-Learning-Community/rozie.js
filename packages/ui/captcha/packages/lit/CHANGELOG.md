# @rozie-ui/captcha-lit

## 0.1.16

### Patch Changes

- a46443a: Lit: a component that is removed from the page and added back works again. Its mount code (`$onMount`) runs again after a real teardown, as on the other targets, so listeners, observers and engine instances are set up again instead of staying torn down. Moving an element within the same task (remove and re-append before it has torn down) keeps the running instance, as before. Mount code and top-level script statements that run again see the element's retained property values.

  Lit: a prop typed with a `<types>` alias made only of string literals (or only of number literals) is now a plain reflected attribute, so `<my-el mode="compact">` works in HTML. It used to be an `Object` property whose attribute value was parsed as JSON, which failed and left the prop `null`.

  Lit: a plain-HTML or Lit consumer (not compiled by Rozie) can fill ANY slot that passes params through the element's `rozieSlots` property, keyed by the slot name (`default` for the default slot): ``el.rozieSlots = { default: ({ item }) => html`<span>${item.label}</span>` }``. The record was only read for dynamically named slots and names that are not identifiers, so an entry for an ordinary scoped slot was silently ignored. It is now tried first for every scoped slot (portal slots excepted), and a component's `$slots.<name>` check counts a record fill as filled, so content gated by `r-if="$slots.<name>"` (for example command-palette's `icon` / `actions` / `trailing` row slots) renders for a record-only fill. A Rozie consumer's fill and the native `<slot>` fallback work as before.

  Changed — Lit: a component's events no longer bubble or cross shadow roots, as on the other targets. `$emit('name', payload)` now dispatches `new CustomEvent('name', { detail: payload, bubbles: false, composed: false })` on the element. A listener on the element itself (`@name=${…}` in a Lit template, `el.addEventListener('name', …)`, a Rozie consumer's `@name`) works as before. A listener on an ancestor element, or outside the shadow root the element sits in, no longer hears it: listen on the element itself. This also means an outer `@rozie-ui/sortable-list` no longer hears the `start` / `add` / `remove` / `reorder` / `end` events of a list nested inside its rows, so the `e.composedPath()[0]` check is no longer needed. Model `*-change` events already behaved this way.

  Lit: a wrapper that forwards `r-on="$listeners"` to a child Rozie component re-dispatches the child's events on its host for the event types its consumer listens for (`@name=${…}`, `addEventListener`), and keeps doing so after the wrapper is moved in the DOM. More generally, an `r-on` listener object re-attaches as soon as its element reconnects, instead of at the element's next render. Listeners added before the component was defined are not seen (the DOM cannot list them); see Cross-Framework Parity.

  Lit: a component whose first render ran after it had already been removed from the page no longer runs its mount code (`$onMount`, document listeners) while detached, where nothing would tear it down; it mounts when it is added back.

  The `@rozie-ui/*-lit` packages listed here are rebuilt with one or more of these fixes; none of them has a string-union prop.

- Updated dependencies [a46443a]
  - @rozie/runtime-lit@0.10.3

## 0.1.15

### Patch Changes

- 3c4b293: README fixes: Angular examples use the `<rozie-captcha>` and `<rozie-recaptcha-v3>` selectors (the PascalCase tags they showed fail to compile with NG8001); the `verify` handler takes the `unknown` output payload, and the forms example sets the required `sitekey`.

## 0.1.14

### Patch Changes

- cf49212: Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:
  - Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
  - Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
  - React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
  - Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
  - Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.
  - @rozie/runtime-lit@0.10.0

## 0.1.13

### Patch Changes

- c362398: The npm package now includes `CHANGELOG.md`. It was written for every release but left out of the tarball, because npm no longer adds a changelog by itself, so a behaviour change recorded there (such as the 0.7.0 combobox Ctrl/Cmd/Alt+Enter change) was invisible to anyone reading the installed package.
- Updated dependencies [c362398]
  - @rozie/runtime-lit@0.9.0

## 0.1.12

### Patch Changes

- a9d67cb: Regenerated with kebab-case attributes for multi-word props: a prop such as `idBase` is now observed as `id-base` (it was the lowercased `idbase`), matching the model props and what a Rozie consumer writes. **If you set one of these from raw HTML with the lowercased or camelCase name, switch to the kebab attribute** (or set the property). Single-word props are unchanged.
- Updated dependencies [a9d67cb]
  - @rozie/runtime-lit@0.8.0

## 0.1.11

### Patch Changes

- b084200: Declare `@rozie/runtime-*` as `workspace:^` instead of `workspace:*`.

  `workspace:*` publishes as an **exact** pin on the runtime version, so every toolchain bump forced a republish of every leaf that carried one — 76 of the 92 packages in the previous release wave had no source change at all. `workspace:^` publishes as `^<version>`, which a later patch-level runtime still satisfies, so an unchanged leaf stays valid instead of being dragged along.

  This is not a new policy: it is the caret policy already documented and applied by nine family codegen scripts ("bake the caret policy now so `workspace:*` is normalized to `workspace:^`"). It was simply never applied to the leaves whose codegen does not write `package.json`. The Svelte leaves were already fully aligned; the Vue leaves were aligned apart from three. This brings the React, Solid, Lit, and Angular leaves in line, so all six targets now state the dependency the same way.

  The `@rozie/*` toolchain packages keep `workspace:*` deliberately — they are a changesets `fixed` group and always version in lockstep, so an exact pin is correct there.

  This release still republishes these leaves, because their published `package.json` genuinely changes. The benefit is on every release after it.
  - @rozie/runtime-lit@0.7.4

## 0.1.10

### Patch Changes

- @rozie/runtime-lit@0.7.3

## 0.1.9

### Patch Changes

- @rozie/runtime-lit@0.7.2

## 0.1.8

### Patch Changes

- @rozie/runtime-lit@0.7.1

## 0.1.7

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

- Updated dependencies [dcc3336]
  - @rozie/runtime-lit@0.7.0

## 0.1.6

### Patch Changes

- @rozie/runtime-lit@0.6.0

## 0.1.5

### Patch Changes

- c279a7e: Fix the `$attrs` auto-fallthrough skip-list to always exclude `data-rozie-ref` — a reserved compiler bookkeeping attribute, never a consumer prop. Previously a parent-assigned `ref=` on this component's own host tag could clobber the component's own internal `data-rozie-ref` markers via fallthrough re-application. No API change, no per-target behavior divergence.
- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.4

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
