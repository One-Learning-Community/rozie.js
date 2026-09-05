# @rozie-ui/rete-angular

## 0.3.3

### Patch Changes

- @rozie/runtime-angular@0.7.2

## 0.3.2

### Patch Changes

- @rozie/runtime-angular@0.7.1

## 0.3.1

### Patch Changes

- 5e2e697: A `graph.connections` edge that cannot be placed — an unknown node id, a port
  key the node does not have, or one a connection rule rejects — now logs a
  one-time developer warning naming that edge, instead of vanishing silently.
  The warning is deferred until the graph settles, so an edge that lands on a
  later reconcile pass (for example, one whose target node or port registers
  just after the edge itself) stays silent.

  The imperative `addConnection()` handle verb now returns `null` and logs a
  warning when the connection is rejected by connection validation or names a
  port key that does not exist on the endpoint node, instead of returning an
  id for an edge the canvas never actually took — which previously left a
  phantom entry in the canvas's internal connection map that desynchronised
  the next graph reconcile. A bad port key no longer surfaces as a raw,
  unhandled rete exception.

  `connection-rejected` now also fires when an explicit `addConnection()` handle
  call is rejected by a connection rule, carrying the same `reason` discriminator
  (`'type-mismatch'` / `'can-connect'`) the drag path already carried. Previously
  that path was suppressed by the same echo-guard that silences props-driven
  reconcile, which conflated a deliberate consumer call with the canvas echoing
  its own pass. Reconcile stays suppressed and is unchanged. A consumer already
  handling `connection-rejected` may therefore see events from imperative calls
  that were previously swallowed — the payload shape is unchanged.

  The warnings themselves are a console-only diagnostic channel.

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

- eb280c9: No API change. Internal helpers that read `$portals.<name>` now live at component scope
  instead of inside the mount-phase lifecycle hook, now that quick 260829-cd4 hoists the
  emitter-synthesized `$portals` closure to component scope on all six targets.

  This unwinds the `$portals` mount-scope workarounds in three shipped `@rozie-ui`
  components (of the five originally targeted — see the CodeMirror note below) carried
  before that emitter fix landed:
  - **`@rozie-ui/tiptap`** — `makeNodeView`/`makeNodeViewExtensions` read `$portals.nodeView`
    directly instead of taking it as an injected parameter.
  - **`@rozie-ui/rete`** (`NodeType`) — the `#body` portal-mount closure is a top-level
    function instead of a null-let bridge assigned inside `$onMount`.
  - **`@rozie-ui/chartjs`** (and its 8 per-type variants, generated from the same source) —
    `buildConfig` and its click/hover/tooltip helpers are top-level; `$onMount` now only
    captures the canvas ref, constructs the `Chart` instance, and tears it down.

  `@rozie-ui/maplibre`'s per-framework leaves are changesets-ignored (deliberately
  unpublished) even though the marker/popup/interactive-layer reconcile unwind landed and
  is included in the source diff — no leaf version bump applies.

  `@rozie-ui/rete`'s sibling `FlowCanvas` component was investigated and found
  correct-by-design (its reconcilers are rooted in a `$refs` read that must stay
  `$onMount`-scoped under ROZ123) — only its stale comment was corrected, no behavior change.

  **`@rozie-ui/codemirror` REVERTED, not shipped.** The relocation was implemented, gated
  green (build/test/typecheck), and committed, but the full Docker VR union caught a
  React-only regression it introduced: the CM6 `Compartment` instances (`themeCompartment`
  et al.) lost their `useMemo(() => new Compartment(), [])` wrapping and became a
  per-render `new Compartment()` once `buildState` (which reads them) moved out of
  `$onMount` to a top-level `useCallback` — an emitter memoization-heuristic gap, not a
  `.rozie`-source-fixable issue (SCOPE FENCE: no emitter code changed in this quick). Two
  React `code-mirror.spec.ts` tests failed (theme-toggle class never changing; an
  extensions-toggle readOnly reconfigure never taking effect) while all five other targets
  stayed green. The commit was reverted; CodeMirror.rozie and its six leaves are unchanged
  from `main` before this quick. Recorded as a follow-up for the emitter team, not
  worked around here.

  Several stale comments across the touched files claimed `$emit` and/or `$slots` also
  forced mount scope. Neither ever did, on any target — those comments are corrected too.

  No emitter code changed in this patch. `@rozie/core` is not bumped.

  **Why no `@rozie-ui/<family>` umbrella entries.** Those six packages are `private: true`, so changesets treats them as ignored; a changeset that mixes ignored and non-ignored packages is rejected outright (`Mixed changesets that contain both ignored and not ignored packages are not allowed`), failing `changeset status` and any release run. Only the published, consumer-installed per-framework leaves are listed.

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

## 0.3.0

### Minor Changes

- 7847537: The auto-layout verb now keeps the route the layout engine computed for an edge and draws
  the edge along it, instead of discarding that route and drawing a straight curve directly
  between the two sockets. Previously, an edge that had to route around an in-between node
  (for example, a "skip" connection spanning several nodes in a flow) would still be drawn as
  a straight line cutting through whatever sat between its endpoints, even though the
  underlying layout engine had already computed a path around it.

  A connection may now carry an optional route on the bound graph model. Because the route
  lives in the model the consumer owns and persists, it survives a page reload instead of
  reverting to a straight line the next time the graph is loaded.

  The layout engine's edge-routing mode has changed as part of this fix, and that change
  affects more than edge rendering: it also affects where the auto-layout verb places nodes.
  An edge the engine had to route around something now renders as a segmented
  (elbow-cornered) path after auto-layout, where it previously rendered as a straight or
  gently curved line. But the same mode change also feeds into the engine's own node
  placement, so calling the auto-layout verb on an existing graph can shift computed node
  positions too, not only add edge routes — if your app persists an auto-layout result or has
  a snapshot test pinned to specific node coordinates, expect those positions to move after
  upgrading. An edge the engine left straight is unchanged, and a graph that never calls the
  auto-layout verb is unchanged. If you need the previous edge-routing AND node-placement
  behavior for any reason, pass `elk.edgeRouting: 'POLYLINE'` in the auto-layout verb's own
  options to restore it for that call.

  Moving, resizing, or resetting a node's size back to automatic now drops the stored route
  of every connection attached to that node, so those edges fall back to the plain
  straight-line style rather than continuing to point at where the node used to be. A route
  is only ever dropped for a connection whose endpoint actually moved, resized, or reset;
  every other connection's route is left untouched.

### Patch Changes

- bcb40dd: Fixed `autoArrange()` producing a fixed per-hop y offset (a "staircase") on a
  source→target chain, which also dragged intermediate nodes into a skip
  edge's reserved lane so that edge visually cut through them. `autoArrange()`
  now reports each socket's real measured geometry to elk instead of the
  built-in preset's engine-default offsets (which matched rete's own default
  node view, not FlowCanvas's, and could not be corrected via layout options
  once elk pinned the port positions). A node whose sockets are not yet
  measurable still arranges via a symmetric, vertically-centred fallback port
  instead of throwing or collapsing.

  `opts.options` passed to `autoArrange(opts)` now overrides the component's
  tuned elk layout defaults (spacing / node placement strategy) key-by-key,
  rather than replacing them outright — a caller-supplied key wins, and every
  other tuned default still applies.

- The `@example` blocks in the types you import now show markup for **your** framework, not the
  `.rozie` authoring notation the component was written in.

  Before this release, every target read the exact same example, in `.rozie`'s own dialect. A React
  consumer of `@rozie-ui/combobox` saw:

  ```
  @example
  <Combobox r-model:value="country" :options="countries" />
  ```

  which doesn't typecheck as React and isn't how you'd actually write it. That same prop's example
  now reads, per package:

  ```
  // React
  <Combobox value={country} onValueChange={setCountry} options={countries} />

  // Vue — unchanged, this IS Vue's own v-model: form
  <Combobox v-model:value="country" :options="countries" />

  // Svelte
  <Combobox bind:value={country} options={countries} />

  // Solid
  <Combobox value={country()} onValueChange={setCountry} options={countries} />

  // Angular
  <rozie-combobox [(value)]="country" [options]="countries" />

  // Lit
  <rozie-combobox .value=${country} @value-change=${(e) => country = e.detail} .options=${countries}></rozie-combobox>
  ```

  Two things worth calling out:
  - **Angular and Lit also rewrite the tag itself.** Both compile to a custom element under the
    hood, and their examples now show the actual tag you'd write in a template —
    `<rozie-combobox>`, not `<Combobox>`.
  - **The Lit example deliberately shows the in-template property/event binding form**
    (`.value=${…}` / `@value-change=${…}`), even though the generated usage page for the same
    component teaches the imperative `el.value = …` / `el.addEventListener(...)` form. Both are
    correct Lit; the JSDoc example favors the form that reads closest to the original `.rozie`
    markup, and the usage page favors the form most Lit consumers reach for first. This divergence
    is intentional, not a drift bug.

  **Nothing else changed.** No runtime behavior moved, no prop/event/slot signature changed, no
  export was added or removed — every changed line in every regenerated file is a documentation
  comment. If you were reading a `docs.description` (the free-text prose above the `@example`
  block), that text is byte-identical to before; only the code sample beneath it changed.

## 0.2.2

### Patch Changes

- 8d75726: `<NodeType>` can now set the box size for every node of a type, and its min/max props
  actually constrain what renders.

  Two new props, `width` and `height`. A type that declares them renders every one of its
  nodes at that size, so a node no longer changes shape as its `#body` content changes —
  the design-consistency knob for graphs where node data varies in length.

  And `minWidth` / `maxWidth` / `minHeight` / `maxHeight` now clamp the **rendered** box
  whatever its size came from. They previously bounded only a resize drag: a
  `<NodeType maxWidth="240">` whose body rendered 600px of content still rendered 600px
  wide, and on a type without `resizable` they did nothing at all. If you set them expecting
  them to hold, they now do.

  How the three sizes resolve, most specific first:

  ```
  instance node.width  →  type width  →  auto
  ```

  …and the min/max clamp applies to whichever won. A node's own `width` in the bound graph —
  what a `resizable` corner-drag persists — still beats the type's. An explicit width also
  lowers the default 140px node floor, so `:width="120"` renders 120.

  Two consequences worth knowing:
  - **Double-clicking a resize handle now resets to the type's width**, not to auto, when the
    type declares one. "Reset" means back to the type default; with no type width it resets
    to auto exactly as before.
  - **Nodes sitting at the minimum width render 2px narrower.** Node boxes are now
    `box-sizing: border-box`, so `:width="240"` means 240px rendered rather than 240 plus the
    borders — and the same correction applies to the built-in 140px floor, which used to
    render as 142. Cosmetic, but visible if you have pixel-tuned around it.

  Nothing here is opt-out and no existing prop was removed; a `<NodeType>` that declares no
  sizing props behaves exactly as before.

- f300891: Connections now follow a node whose box changes size. They used to stay pinned to wherever
  the sockets were at first paint.

  A node auto-sizes to its `#body`, so body content that changes width changes the node box,
  and the sockets move with it. But a socket's position was measured exactly once — on the
  render path that builds a node from scratch. Nothing re-measured when an existing node's
  box changed, so the stored coordinates went stale and every attached edge kept pointing at
  the old spot. On a graph where five of seven nodes narrowed, not one of eight connection
  paths moved.

  The same defect hit the `resizable` corner handles: dragging a node bigger or smaller left
  its edges behind. That half was never reachable through `#body` content before, so it is
  not new in 0.2.1 — it has been there since resizing shipped.

  `<FlowCanvas>` now watches each node's box and re-measures that node's sockets whenever it
  changes size, which pushes fresh coordinates into the connections and redraws them.
  Watching the box rather than hooking one specific trigger means this covers every way a
  node changes size, including ones the library never sees directly:
  - `#body` content that grows or shrinks — a badge, a status line, a count
  - a `resizable` node dragged by its corner handles
  - an image or webfont that lands after first paint
  - a component you put in the `#body` slot that resizes itself later

  There is no API change and nothing to opt into.

  If you worked around this by pinning your nodes to a fixed width so the box could never
  resize, you can stop. That workaround is what it looks like — uniform-width nodes adopted
  to dodge a rendering bug — and it is no longer needed.

  One thing worth knowing, unchanged by this release: the `#body` slot scope is
  `{ node, selected, emit }`. Content driven from your own component state, read from
  outside that scope, is still snapshot when the body is first projected. Route it through
  the node's own `data` and it stays live.

## 0.2.1

### Patch Changes

- 67149a3: A `<NodeType>` `#body` now repaints when the bound graph changes. It used to render once
  and freeze for the life of the node.

  `<FlowCanvas>` projects each node's `#body` through the type's registered renderer and
  keeps the resulting handle so the projection can be re-rendered with a fresh scope. Its
  in-place re-render path refreshed the low-level `#node` portal handle and the default
  title chrome — but never the render-by-type body handle. Since a `<NodeType>`-templated
  node has neither of the other two, that path refreshed nothing at all: the graph
  reconciled, the engine re-rendered the node, and the body kept whatever it painted first.

  So a node whose `data` changed kept showing its old `data`. Re-binding the graph with a
  new label, a new status, a new count — all correctly reconciled everywhere except inside
  the one template that was supposed to display them. `selected` travels in the same scope,
  so a body that styled itself on selection never saw the selection change either.

  What changes for you:
  - Re-binding `graph` with changed node `data` now updates the rendered `#body`, on all six
    targets. This is the supported way to change node data — `<FlowCanvas>` watches the bound
    `graph` by reference, so a fresh object is what drives a reconcile.
  - The `{ node, selected, emit }` slot scope is re-delivered on every re-render, so `selected`
    is live in the body too.
  - If you worked around this by putting a component in the `#body` slot and mutating a
    reactive object in place, that keeps working — nothing about it was wrong, it is just no
    longer necessary.

  Note on scope: a `#body` re-renders when it is handed a new scope, which is the reactive
  portal contract on every target. Reactive values read inside the slot from OUTSIDE that
  scope are still snapshot at projection time.

## 0.2.0

### Minor Changes

- cf1d6a7: `--rozie-flow-socket-size`'s default changes from `12px` to `16px`, and its meaning changes with
  it: the socket is now `box-sizing: border-box`, so the token means the socket's rendered diameter
  with the 2px border sitting inside it, not added on top. At the default, the socket renders
  exactly as before — the outer box was already 16px (12px content + 2×2px border), only a ~2px
  centring error against the node edge is corrected, verified by live-DOM measurement before and
  after. **A consumer who copied `12px` out of `base.css` and set it
  explicitly will now get a genuinely 12px socket — smaller than what that override used to
  produce.** This is the one breaking-ish change in this release.

  Nothing in this release adds, removes, or renames a prop, model prop, emit, slot or `$expose`
  verb, so the typed public API surface is unchanged. These bump `minor` rather than `patch`
  because the `--rozie-flow-socket-size` default above is a behavioural change a consumer can be
  caught by, and 15 new theme tokens plus the `rozie-flow-socket--incompatible` class hook are
  additive surface — both are minor-shaped, not patch-shaped.

  **The zero-import dark contract is corrected.** The OS-dark default (`@media
(prefers-color-scheme: dark)`, zero-import) now honors a `.light` / `[data-theme="light"]`
  opt-out at the document root on React, Vue, Svelte, Angular and Solid — previously it did not, so
  an app that opted into light at the root still got the OS-dark palette on this canvas. The
  mechanical consequence a consumer might notice: the OS-dark rule now ships as an
  unscoped/document-global rule rather than a component-scoped one (its terminal selector is still
  `.rozie-flow-canvas`). **Lit is the one documented exception**: its canvas lives inside a
  shadow root, where a document-root ancestor selector cannot be observed, so the light
  opt-out above is not honored there — Lit keeps following the OS scheme regardless.
  `:host-context()` was considered and rejected (Chromium-only, a silent no-op in
  Firefox/Safari). Lit consumers who need app-controlled theming should use the `.dark` /
  `[data-theme="dark"]` class strategy in `base.css` instead — custom properties inherit
  across the shadow boundary, so it reaches this component even though a plain ancestor
  selector cannot.

  **A dark-palette omission is fixed.** `--rozie-flow-resize-handle-bg` was missing from both
  `base.css` dark blocks (the `.dark`/`[data-theme="dark"]` class strategy and the OS-dark
  `@media` block), so a consumer on a light OS using the class strategy got white NodeResizer
  handles on an otherwise-dark node. Fixed in both copies, and all three dark-palette copies
  (the component's own OS-dark block plus `base.css`'s two) are now guarded by a drift test that
  compares them against each other. Also newly dark-remapped: `--rozie-flow-control-shadow`,
  `--rozie-flow-minimap-shadow`, `--rozie-flow-toolbar-shadow`, and `--rozie-flow-socket-ring`; and
  the selected-node shadow is now tokenised (`--rozie-flow-node-selected-shadow`) so it, too,
  remaps in dark. The marquee fill now derives from `color-mix(in srgb, var(--rozie-flow-accent)
12%, transparent)` instead of a fixed literal, so overriding `--rozie-flow-accent` alone finally
  recolors every selection cue, including the marquee.

  **New feature: incompatible-port drag feedback.** Dragging a connection from a typed port now
  dims type-mismatched target ports on other nodes for the duration of the gesture, with `cursor:
not-allowed` (`--rozie-flow-socket-incompatible-opacity`, default `0.3`, opacity-only —
  deliberately no new color token, so it adds nothing to the three dark-palette copies). Scope is
  precise: only the opposite-side socket, only on other nodes, only when the resolved port types
  mismatch. The hint is resolved from port **types only** — it does **not** invoke a consumer's
  `canConnect` predicate per-socket per-pick (side effects and cost); `canConnect` still runs once,
  as the override, at actual connection time. Suppressed entirely when `:validate-types="false"`,
  since nothing would be rejected then. The marking clears on drop, plus three independent abort
  paths (`pointercancel`, `Escape`, window `blur`) so no aborted gesture can leave a socket
  permanently dimmed.

  **Accessibility fix: focus-visible ring.** The canvas, the Controls buttons, the NodeToolbar
  buttons, and the resize handles now draw a `:focus-visible` ring — tokenised via
  `--rozie-flow-focus-ring` (defaults off `--rozie-flow-accent`) and
  `--rozie-flow-focus-ring-width` (default `2px`) — drawn with a negative `outline-offset` so it
  renders inside the border box and can't be clipped by the canvas's `overflow: hidden`. Previously
  there were no focus rules at all on any of these four surfaces.

  **Token surface: 53 → 68 (net +15), including two new groups: typography and focus ring.**
  New typography tokens —
  `--rozie-flow-font-family` plus four per-role size tokens
  (`--rozie-flow-node-font-size`/`-control-font-size`/`-toolbar-font-size`/
  `-connection-label-font-size`) — let a consumer rebrand the whole family with one override while
  keeping each role's size independently tunable. Four chrome tokens
  (`--rozie-flow-control-inset`, `--rozie-flow-control-btn-size`, `--rozie-flow-marquee-radius`,
  `--rozie-flow-resize-handle-radius`) make previously-hardcoded values overridable — notably the
  two radii, which previously ignored `--rozie-flow-radius` entirely on a sharp-corner theme.
  `--rozie-flow-socket-border-width` (default `2px`) completes the socket's token set. The full
  vocabulary lives on the theming page.

  Worth calling out specifically: **`--rozie-flow-node-body-padding`** (default `0.5rem 0.75rem`,
  matching the built-in title's padding) changes the default rendering of any node with `#body`
  slot content — bodies are now inset to match the title instead of running flush to the node's
  edge. A consumer who wants the previous full-bleed body behavior sets the token to `0`.

  **Not included in this changeset:** `NodeType` and `Port` are byte-identical to the previous
  release — neither source was touched by this phase — and no `@rozie-ui` family other than `rete`
  is affected.

### Patch Changes

- 18aa7c5: `FlowCanvas` now forwards a consumer-passed `class` and `style` (and any other consumer attribute
  or listener) onto its own root element, merged alongside the component's own class — not replacing
  it. Before this release, `FlowCanvas` carried the documented `inherit-attrs="false"
inherit-listeners="false"` opt-out with no hand-written spread behind it, so a consumer `class` or
  `style` reached nothing. Verified via a live-DOM render across all six targets: the consumer class
  appears alongside `rozie-flow-canvas` on the root div, and a consumer CSS custom property resolves
  there too.

  **`NodeType` is unchanged — its shipped output is byte-identical to the previous release.** It
  briefly gained the same fallthrough behavior mid-phase, but its only real element is a
  `.rozie-node-type-children` container that is permanently `display:none` / 0×0 (it exists solely so
  nested renderless `<Port>` children mount, never paints, and never receives interaction) — so
  forwarding attrs onto it would be a silent no-op. `NodeType` kept its opt-out for the same reason
  `Port` already documents its own.

  Not included in this changeset: `@rozie-ui/maplibre-*` also gains the same `class`/`style`
  forwarding on its root, but every `@rozie-ui/maplibre-*` package is listed in
  `.changeset/config.json`'s `ignore` array — none has ever been published (each is a 404 on the
  npm registry today), matching the other unreleased-family entries already in that list. No version
  bump is expected or needed for an unreleased package; this is the pre-existing convention working
  as intended, not a gap introduced by this phase.

## 0.1.4

### Patch Changes

- 5fe5876: `<FlowCanvas>` no longer ships the auto-arrange engine to consumers who never arrange.

  `rete-auto-arrange-plugin` and `elkjs` have always been declared optional peers, but the
  import was static and the plugin was constructed at mount, so `elk.bundled.js` — 1.5 MB of
  GWT-transpiled Java in one opaque non-tree-shakeable blob — was resolved into the main chunk
  of every `<FlowCanvas>` consumer. Optional to install is not the same as optional to ship.

  `autoArrange()` now loads the engine with a dynamic import on its first call and reuses it
  afterwards. No API change: the verb was already `async` and already a no-op before mount.

  What changes for you:
  - If you never call `autoArrange()`, the engine and its elkjs payload never enter your bundle.
  - If you do, the first call additionally pays a chunk fetch; later calls are as before.
  - If the optional peers are not installed, the returned promise now rejects instead of silently
    doing nothing — you asked to arrange, so a rejection is the honest answer.

  Also fixed alongside it: the teardown now nulls the area handle after destroying it. Every
  imperative verb already opened with an `if (!area) return` guard, but that only ever caught
  the before-mount window — after unmount the handle stayed truthy and pointed at a destroyed
  scope. Calling a verb on an unmounted canvas is now the no-op the guards always implied.

## 0.1.3

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

- Updated dependencies [f3266db]
- Updated dependencies [78d5b5b]
- Updated dependencies [ae824bd]
  - @rozie/runtime-angular@0.6.0

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/rete` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps. Carries `tslib` only, no `@rozie` runtime dependency.

  **The FlowCanvas family** — a controlled node-graph canvas over the `rete` engine:
  - `<FlowCanvas>` — 21 props, 12 events and a 27-verb imperative handle, with `graph`, `zoom` and `mode` as two-way models. Built-in Controls and MiniMap, labeled + styled edges, undo/redo, auto-arrange (elkjs), marquee select, a node toolbar slot, and the `background` pattern variants (`dots` / `lines` / `cross` / `none`).
  - `<NodeType>` — render-by-type node bodies through a reactive `body` portal slot, with per-type `resizable` plus min/max width and height.
  - `<Port>` — the typed directional port schema (`output` / `input`, `type`, `label`, `multiple`, `position`), declared against the enclosing `<NodeType>`.
  - Four `themes/*.css` token presets ship in the tarball (`base`, `shadcn`, `material`, `bootstrap`).
