# @rozie-ui/rete-svelte

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

- @rozie/runtime-svelte@0.6.0

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/rete` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps.

  **The FlowCanvas family** — a controlled node-graph canvas over the `rete` engine:
  - `<FlowCanvas>` — 21 props, 12 events and a 27-verb imperative handle, with `graph`, `zoom` and `mode` as two-way models. Built-in Controls and MiniMap, labeled + styled edges, undo/redo, auto-arrange (elkjs), marquee select, a node toolbar slot, and the `background` pattern variants (`dots` / `lines` / `cross` / `none`).
  - `<NodeType>` — render-by-type node bodies through a reactive `body` portal slot, with per-type `resizable` plus min/max width and height.
  - `<Port>` — the typed directional port schema (`output` / `input`, `type`, `label`, `multiple`, `position`), declared against the enclosing `<NodeType>`.
  - Four `themes/*.css` token presets ship in the tarball (`base`, `shadcn`, `material`, `bootstrap`).

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-svelte@0.2.0
