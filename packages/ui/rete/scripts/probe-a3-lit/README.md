# Phase 37 Wave-0 A3 render probe (Lit) — RESULT: **FAIL**

Throwaway de-risk probe for **D-04 FlowNode body teleport on Lit** (RESEARCH
Assumption A2 / Pitfall 2 — the shadow-boundary risk target).

## What it tests

`FlowNode.rozie` (committed `b2802c85`) renders its default-slot body into an
`r-external` wrapper `<div data-rozie-ref="bodyEl"><slot></slot></div>` inside its
own shadow root, then in `firstUpdated()` (Lit `$onMount`) relocates that wrapper
into the engine-created node body element via
`canvas.bodyHostFor(id).appendChild($refs.bodyEl)` + `$reconcileAfterDomMutation()`.

The probe compiles `FlowNode.rozie` → Lit (`FlowNode.lit.ts`), stands up a minimal
`$provide('rete:canvas', …)` stub (`harness.ts`) that exposes a placeholder engine
node element through `bodyHostFor(id)`, mounts
`<rozie-flow-node id="n1"><button>BODY</button></rozie-flow-node>`, and asserts in
headless Chromium that the body renders inside the engine element and the button
still clicks (`run-probe.mjs`).

## Result — FAIL on Lit (architectural, NOT an emitter bug)

DOM evidence (`RESULT-FAIL.txt`, `a3-lit-evidence.png`):

- The `r-external` wrapper **does** physically relocate into the engine node body
  (`bodyElInEngine: true`).
- **But** once the `<slot>` is moved out of FlowNode's shadow root into the
  provider's shadow tree, the slot is re-scoped to the **provider** host and
  projects the wrong children (`assignedButtonText: null`; it re-projects the
  `<rozie-flow-node>` host element itself).
- The real body content (`<button>BODY</button>`) is orphaned in
  `rozie-flow-node`'s light DOM with no slot to project it → renders at 0×0,
  not hittable. Post-move click never fires.

Root cause: a Shadow-DOM `<slot>` projects **only** the light-DOM children of the
host whose shadow root owns it. Relocating a slot-containing subtree across a
shadow boundary breaks projection. `r-external` + `$reconcileAfterDomMutation()`
handle engine-mutated DOM **within one shadow root** (Sortable/TipTap) but cannot
re-home a `<slot>` to a different host. This is a Web Components spec property —
`git status` confirms **zero** `packages/targets/*` / `packages/core/*` drift.

The other 5 targets (React/Vue/Svelte/Solid/Angular) are light-DOM and have no
shadow boundary, so `appendChild` of the rendered subtree is a benign DOM move
(not probed here — Lit was the sole flagged risk).

## Recommended branch (per PLAN A3 + RESEARCH §Pattern 3 fallback)

Take the **RESEARCH fallback**: render the FlowNode body via the existing
`$portals.node` registry-render-callback path (the parent mounts the body into the
engine host from the *parent's own* shadow/render scope — the shipped reactive
multi-instance portal that already renders on Lit 6/6). FlowNode registers a
render callback into the registry instead of relocating a slot. This keeps
zero-emitter-change and is known-good on Lit, at the cost of the "inline markup,
no scope-param" ergonomic D-04 wanted. **Surface the tradeoff to the user before
Wave-1 replication.** Do NOT edit an emitter.

## Reproduce

```sh
# (regenerate FlowNode.lit.ts if FlowNode.rozie changed)
cd packages/ui/rete && node -e "import('@rozie/core').then(({compile})=>{const fs=require('fs');fs.writeFileSync('scripts/probe-a3-lit/FlowNode.lit.ts',compile(fs.readFileSync('src/FlowNode.rozie','utf8'),{target:'lit',filename:'FlowNode.rozie'}).code)})"
# copy harness + runner + FlowNode.lit.ts into a dir where vite+@playwright/test+lit resolve
# (e.g. a temp dir under tests/visual-regression), then:
node run-probe.mjs   # exit 1 = FAIL (current verdict)
```
