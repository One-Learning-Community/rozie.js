---
"@rozie-ui/rete-vue": patch
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-angular": patch
"@rozie-ui/rete-lit": patch
---

`--rozie-flow-socket-size`'s default changes from `12px` to `16px`, and its meaning changes with
it: the socket is now `box-sizing: border-box`, so the token means the socket's rendered diameter
with the 2px border sitting inside it, not added on top. At the default, the socket renders
exactly as before — the outer box was already 16px (12px content + 2×2px border), only a ~2px
centring error against the node edge is corrected, verified by live-DOM measurement before and
after (see `83-04-SUMMARY.md`). **A consumer who copied `12px` out of `base.css` and set it
explicitly will now get a genuinely 12px socket — smaller than what that override used to
produce.** This is the one breaking-ish change in this release.

Nothing in this release adds, removes, or renames a prop, model prop, emit, slot or `$expose`
verb, so the public API surface is unchanged and every package here bumps `patch`.

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
