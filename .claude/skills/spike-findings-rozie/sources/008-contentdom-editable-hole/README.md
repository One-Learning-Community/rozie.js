---
spike: 008
name: contentdom-editable-hole
type: standard
validates: "Given a real TipTap node view with a contentDOM ProseMirror manages, when the consumer fragment renders chrome wrapping the hole, then the editable child stays TipTap-owned and the framework never clobbers it — across all 6 targets, esp Lit/Solid"
verdict: VALIDATED
related: [007-reactive-portal-update, 002-portal-target-feasibility]
tags: [portal-slots, contentdom, node-view, phase-33, tiptap, prosemirror, lit, solid]
---

# Spike 008: contentDOM Editable Hole

## What This Validates

Given/When/Then: **Given** a real `@tiptap/core` node view with a `contentDOM`
ProseMirror manages, **when** the consumer framework fragment renders chrome that
WRAPS the hole (the official `NodeViewContent` shape — chrome renders a
placeholder, contentDOM is grafted into it), **then** the editable child stays
TipTap-owned and the framework never clobbers it — across all 6 targets,
especially the ecosystem-thin **Lit (no existing wrapper)** and **Solid (no
node-view support)**.

This was the **most-unproven sub-problem** and the reason the owner upgraded
Phase 33 scope to include editable contentDOM (not just the non-editable chip).

## Research

contentDOM is a ProseMirror NodeView concept: a node view returns
`{ dom, contentDOM }`; ProseMirror renders the node's editable children INTO
`contentDOM` and manages that subtree. The cross-framework challenge: the
consumer fragment is rendered by React/Vue/etc. which own + re-render their DOM,
but `contentDOM` is engine-owned. The fragment must render a placeholder and
graft `contentDOM` in (ref / appendChild) WITHOUT the framework reconciling it
away — exactly what the official `@tiptap/react` / `@tiptap/vue-3`
`NodeViewContent`, `ngx-tiptap`, and `svelte-tiptap` do. **Lit and Solid have no
such wrapper** → they were the genuine unknowns.

TipTap v3 bundles ProseMirror under `@tiptap/pm/*`; `addNodeView` can return a
raw `{ dom, contentDOM, destroy }` object, so no direct prosemirror-view import
is needed.

## How to Run

```bash
# React / Vue / Lit (no framework build — runtime APIs)
cd .planning/spikes/008-contentdom-editable-hole/harness
ln -sfn ../../../../tests/visual-regression/node_modules node_modules
./node_modules/.bin/vite build && ./node_modules/.bin/playwright test --config playwright.config.ts

# Solid / Svelte (compiled)
cd ../harness-compiled
ln -sfn ../../../../tests/visual-regression/node_modules node_modules
./node_modules/.bin/vite build && ./node_modules/.bin/playwright test --config playwright.config.ts
```

Angular: compile-checked bridge reference (`refs/angular.contentdom-bridge.ts`),
runtime-proven by prior art (`ngx-tiptap` `AngularNodeViewRenderer`).

## What to Expect

For each runtime-proven target: the framework chrome label renders, the callout
body shows `edit me`, typing appends ` EDITED` into the hole, and
`editor.getHTML()` SERIALIZES `edit me EDITED` inside the `data-callout` node —
proving the hole is genuinely ProseMirror-owned (round-trips through the
serializer), not just a contenteditable div the framework rendered.

## Investigation Trail

1. **React + Vue + Lit (no-build harness):** real TipTap + a custom `callout`
   block node (`content: 'inline*'` → has contentDOM). React/Lit grafted via
   their native `ref` idiom and PASSED first try — **Lit, the #1 unknown, works**
   (lit-html `ref()` directive on a hole div with no child `${}` binding; lit
   never manages the hole's children). **Vue FAILED first run** — its standalone
   `render()` invokes function-`ref`s ASYNCHRONOUSLY (post-flush scheduler), so
   contentDOM wasn't grafted before `addNodeView` returned. Switched Vue to
   **query-after-render** (`dom.querySelector('.callout-hole')` post `render()` —
   mount is synchronous) → PASS.
2. **Solid + Svelte (compiled harness):** Solid grafted via its `ref` (runs
   synchronously during render) → PASS. **Solid, the #2 unknown, works.** Svelte
   used query-after-mount (Svelte actions/effects run post-mount microtask, same
   timing class as Vue) → PASS.
3. **Angular:** not stood up as a live app (analogjs cost) — but the contentDOM
   pattern is production-proven by ngx-tiptap's `AngularNodeViewRenderer` +
   `NodeViewContent`. Captured a compile-checked bridge reference that slots onto
   Rozie's existing Angular `createEmbeddedView` + appendChild portal mechanism,
   with the same query-after-render graft. tsc-clean.

## Results

**Verdict: VALIDATED — the contentDOM editable-hole bridge works across all 6
targets. Both genuine unknowns (Lit, Solid) are RUNTIME-PROVEN; Angular is
prior-art-proven + compile-checked.**

| Target | Proof | Graft idiom |
|---|---|---|
| React | runtime ✓ | `ref` inside `flushSync(root.render(...))` |
| Vue | runtime ✓ | **query-after-render** (function-ref is async) |
| Lit | runtime ✓ (the #1 unknown) | `ref()` directive on hole div, no child binding |
| Solid | runtime ✓ (the #2 unknown) | `ref` (synchronous during render) |
| Svelte | runtime ✓ | **query-after-mount** (action/effect is post-mount) |
| Angular | prior-art (ngx-tiptap) + compile ✓ | **query-after-render** (refs resolve post-detectChanges) |

### Surprises / findings

1. **Ref-timing splits the 6 into two graft strategies.** React/Solid/Lit graft
   via native `ref` (synchronous-within-render). Vue/Svelte/Angular need
   **query-after-render** because their ref/action/query timing is
   post-mount/async — a `ref:`/action graft misses the window before ProseMirror
   validates `contentDOM`. **→ REQ-23:** the node-view bridge emits
   query-after-render for Vue/Svelte/Angular, native-ref for React/Solid/Lit.
2. **Lit needs no shadow DOM for contentDOM.** The portal renders via lit-html
   `render()` into the engine-owned LIGHT-DOM container; a hole div carrying ONLY
   the `ref()` directive (no child `${}`) is never managed by lit-html, so the
   grafted contentDOM is safe. No `LitElement`/shadow boundary involved.
3. **React needs `flushSync`** (same as the mount-once portal + the 007 reactive
   path) so the hole + grafted contentDOM exist synchronously before
   `addNodeView` returns.
4. **008 proves the editable hole with mount-once chrome; 007 proves reactive
   in-place update.** The full Phase-33 node view = the COMPOSITION of the two
   (reactive chrome around an editable hole). Each primitive is proven
   independently; 009 exercises the reactive path inside real TipTap (non-editable
   chip). The reactive-chrome-AROUND-editable-hole combination should be smoke-
   tested once in the implementation phase as the integration point. **→ REQ-24.**
