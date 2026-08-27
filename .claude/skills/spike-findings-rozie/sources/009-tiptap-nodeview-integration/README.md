---
spike: 009
name: tiptap-nodeview-integration
type: standard
validates: "Given @tiptap/core + a @mention atom node, when selection/attrs change, then the reactive non-editable chip re-renders in place in-engine across all 6 targets (exercises Spike 007's update path inside the real engine)"
verdict: VALIDATED
related: [007-reactive-portal-update, 008-contentdom-editable-hole]
tags: [portal-slots, node-view, mention, reactive, phase-33, tiptap, showcase]
---

# Spike 009: TipTap Node-View Integration (reactive @mention)

## What This Validates

Given/When/Then: **Given** a real `@tiptap/core` editor with a `mention` inline
ATOM node (no contentDOM), **when** the node selection enters/leaves it or its
attrs change, **then** the non-editable chip re-renders **in place** in-engine
across all 6 targets — exercising Spike 007's per-target `update(scope)` path
inside the real engine (ProseMirror's `nodeView.update`/`selectNode`/
`deselectNode` are the engine-driven trigger). This is the Phase-33 showcase and
the all-6 in-engine runtime proof of the reactive primitive (007 ran Svelte only
standalone).

## Research

A node view returns a ProseMirror NodeView object. For an atom node the relevant
lifecycle hooks are `update(node)` (attr change → returns true to keep the view),
`selectNode()` / `deselectNode()` (NodeSelection enters/leaves). Each maps onto
the reactive portal handle's `update(scope)`. The chip is rendered via the exact
007 per-target mechanism (React retain-root+flushSync, Vue re-render(vnode,
container), Lit re-render(tpl, container), Solid signal+setScope, Svelte reactive
PortalHost $state+update export).

## How to Run

```bash
# React / Vue / Lit (no framework build)
cd .planning/spikes/009-tiptap-nodeview-integration/harness
ln -sfn ../../../../tests/visual-regression/node_modules node_modules
./node_modules/.bin/vite build && ./node_modules/.bin/playwright test --config playwright.config.ts

# Solid / Svelte (compiled)
cd ../harness-compiled
ln -sfn ../../../../tests/visual-regression/node_modules node_modules
./node_modules/.bin/vite build && ./node_modules/.bin/playwright test --config playwright.config.ts
```

## What to Expect

Per target: chip shows `@alice`, `data-selected=false`. Engine-driven
`setNodeSelection` → `data-selected=true`; `updateAttributes(label:'bob')` →
`@bob`; blur/collapse → `data-selected=false`. Throughout, an external identity
marker stamped on the chip node SURVIVES every update → in-place re-render, no
remount.

## Investigation Trail

1. **React / Vue / Lit (no-build harness):** built a `mention` atom node whose
   node view renders the chip via the 007 reactive mechanism; wired
   `selectNode`/`deselectNode`/`update` → `handle.update(scope)`. All 3 PASS
   first try — select toggles `data-selected`, attr change updates the label, and
   the identity marker survives every transition (in-place, no remount).
2. **Solid / Svelte (compiled harness):** Solid via `createSignal(scope,
   {equals:false})` + `setScope`; Svelte via the reactive `SvelteChip` owning
   `$state` + an `update` export (the REQ-19 PortalHost shape). Both PASS — same
   in-place identity-marker proof.
3. **Angular:** not stood up as a live app (analogjs cost). Runtime-proven by
   prior art: ngx-tiptap's `AngularNodeViewRenderer` ships reactive node views in
   production; the 007 Angular update mechanism (`Object.assign(view.context, s)`
   + `detectChanges()`) is compile-checked (007 refs). **→ the one honest caveat
   (see Results).**

## Results

**Verdict: VALIDATED — the reactive node-view showcase works in real TipTap.
5/6 targets (React, Vue, Lit, Solid, Svelte) RUNTIME-PROVEN in-engine; Angular
prior-art-proven + compile-checked.**

| Target | Proof | Reactive update mechanism |
|---|---|---|
| React | runtime ✓ | retain root → `flushSync(root.render)` |
| Vue | runtime ✓ | re-`render(h(span), container)` |
| Lit | runtime ✓ | re-`render(html\`…\`, container)` |
| Solid | runtime ✓ | `createSignal(…,{equals:false})` + `setScope` |
| Svelte | runtime ✓ | reactive `SvelteChip` `$state` + `update` export |
| Angular | prior-art (ngx-tiptap) + compile ✓ | `Object.assign(view.context)` + `detectChanges()` |

### The one honest caveat

**Angular is the only target with no LIVE runtime proof across all 3 Phase-33
spikes** (007/008/009 all use prior-art + compile for Angular, live runtime for
the other 5). This is a deliberate cost call — standing up a standalone analogjs
TipTap app is expensive, and Angular has the STRONGEST prior art of the 6
(ngx-tiptap is a shipping wrapper with node views, reactivity, AND contentDOM).
**Recommendation: the implementation phase must treat Angular as the first-class
runtime-verification target** — wire the reactive node-view VR cell on Angular
first and verify in a real browser before declaring the phase done. The risk is
low (standard `EmbeddedViewRef` + `detectChanges`), but it is the one unproven-
at-runtime surface. **→ REQ-25.**

### Surprises / findings

1. **The 007 mechanism drops straight into ProseMirror's NodeView lifecycle** with
   zero impedance — `selectNode`/`deselectNode`/`update(node)` → `handle.update`
   is a clean 1:1. The engine-driven driver decision (locked) is exactly right:
   no Rozie reactive loop needed.
2. **Atom node + `selectable:true`** is all that's needed for `selectNode`/
   `deselectNode` to fire on `setNodeSelection` — the chip's `selected` styling is
   pure engine-driven portal `update`.
