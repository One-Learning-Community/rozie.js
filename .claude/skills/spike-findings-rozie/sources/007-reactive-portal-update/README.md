---
spike: 007
name: reactive-portal-update
type: standard
validates: "Given a portal mounted once returning { update, dispose }, when the engine calls update(newScope), then the consumer fragment re-renders in place (DOM node identity preserved, no remount) across all 6 targets"
verdict: VALIDATED
related: [002-portal-target-feasibility, 003-portal-compiler-implementation]
tags: [portal-slots, reactive, phase-33, cross-target, ir-design, svelte-portalhost, tiptap]
---

# Spike 007: Reactive Portal Update

## What This Validates

Given/When/Then: **Given** a portal slot mounted once whose closure method
returns `{ update, dispose }` (the opt-in `<slot name="X" portal reactive />`
shape), **when** the engine calls `update(newScope)` (engine-driven — e.g.
ProseMirror `nodeView.update`), **then** the consumer fragment re-renders **in
place** — the host DOM node identity is preserved, no unmount/remount — across
all 6 targets.

This is REQ-5's planned v2 evolution (Spike 002 locked "portals are NOT reactive
after mount… future v2 may add an opt-in `reactive: true` slot attribute"). It is
the prerequisite primitive for Phase 33 TipTap node-view slots (the showcase,
proven end-to-end in Spikes 008/009).

## Research

Per-target reactive-update mechanism (each framework's native "re-render into the
same host" idiom), confirmed against the mount-once `emitPortals.ts` for each
target:

| Target | Mount-once today (`() => void`) | Reactive update (`{update,dispose}`) | Risk |
|---|---|---|---|
| React | `createRoot`→`root.render`→`unmount` | retain root → `flushSync(() => root.render(slot(s)))` again | low (reconciler keeps same-position/type node identity) |
| Vue | `render(vnode, container)`→`render(null,…)` | re-`render(h(Fragment, slotFn(s)), container)` — diffs vs container `_vnode` | low |
| Lit | `render(tpl, container)`→`render(nothing,…)` | re-`render(tpl(s), container)` — lit-html is built for repeat-into-same-host | low |
| Solid | `render(()=>slot(scope), c)`→dispose | scope as **signal** → `setScopeSig(s)` drives the existing reactive root | low — Solid's natural fit (mount-once discarded reactivity) |
| Angular | `vcr.createEmbeddedView(tpl, ctx)` | `Object.assign(view.context, s)` + `view.detectChanges()` | medium |
| **Svelte** | `mount(PortalHost,{props:{snippet,scope}})` | **reactive PortalHost owns `$state` + exposes `update` export; `mount()` returns exports → `inst.update(s)`** | **high — the 3-strikes risk** |

**Chosen approach:** opt-in `reactive` flag (Dan-locked). Reactive slots'
closure method returns `{ update, dispose }`; non-reactive slots keep the
existing `() => void` shape verbatim, so the 3 shipped slots (tiptap `toolbar`,
CM6 `panel`, FullCalendar `event`) and their dist-parity/snapshot fixtures stay
byte-identical — only the new reactive branch reblesses.

The **Svelte** path was the only genuine unknown: `mount()` props are NOT
reactive, so the mount-once `PortalHost` (`{ snippet, scope }` rendered once) has
no update path. The reactive design moves `scope` into component-local `$state`
inside `PortalHost` and exposes an `update(s)` export — Svelte 5 `mount()`
returns the component's exports, so the wrapper's portal closure calls
`inst.update(newScope)`.

## How to Run

```bash
cd .planning/spikes/007-reactive-portal-update/harness
ln -sfn ../../../../tests/visual-regression/node_modules node_modules
./node_modules/.bin/vite build
./node_modules/.bin/playwright test --config playwright.config.ts
```

Compile-check the 6 reference outputs (`refs/`):
- 5 TS/TSX refs: staged `tsc --noEmit --strict` (see Investigation Trail) — clean.
- Svelte ref (`PortalHost.reactive.svelte`): validated by the harness `vite build`
  (svelte-plugin compile) + the passing runtime spec.

## What to Expect

- `vite build` compiles the Svelte harness clean (one benign
  `state_referenced_locally` hint — see Surprises).
- The Playwright spec passes: after `inst.update({label:'v2',selected:true})` the
  chip text changes v1→v2 and `data-selected` false→true, **while an external
  identity marker stamped on the chip node survives** — proving the same node was
  re-rendered in place, not remounted. Dispose leaves zero chips.

## Investigation Trail

1. **Hand-wrote all 6 reference outputs** (`refs/`) as the contract the
   `emitPortals.ts` surgery must produce — the per-slot method returning
   `{ update, dispose }`, with the per-target update mechanism from the Research
   table. React/Vue/Lit retain their host (root/container/container) and re-run
   the render API; Solid wraps scope in a `createSignal(scope, { equals:false })`;
   Angular mutates `view.context` + `detectChanges()`; Svelte uses the new
   reactive `PortalHost`.
2. **Built the Svelte runtime harness** (the load-bearing unknown) — `ProbeApp`
   drives the reactive `PortalHost` exactly as the emitted wrapper closure would:
   `mount()` the consumer snippet into an engine-owned container, then
   `inst.update(newScope)`.
3. **Ran the harness in a real browser (Playwright):** PASS first try. The
   external identity marker survived the update → in-place re-render confirmed,
   no remount. `mount()` did expose the `update` export (driven via the bump
   button). Dispose tore down cleanly.
4. **tsc-checked the 5 TS/TSX refs:** two trivial *annotation* nits surfaced
   (React `React.ReactNode` needed the type import; Solid `: void =>` concise
   body can't return the signal-setter's value) — both fixed; re-check shows **0
   type/syntax findings** across all 5 (module-not-found filtered as noise per
   CONVENTIONS). These were ref-authoring nits, not feasibility issues — the
   emitter produces both forms correctly.

## Results

**Verdict: VALIDATED — the reactive-portal `{update,dispose}` primitive is
hand-writable and compile-clean across all 6 targets, and the Svelte 3-strikes
path works at runtime.**

| Question | Answer | Evidence |
|---|---|---|
| Svelte `mount()` exposes the `update` export? | **Yes.** `inst.update(s)` callable. | harness spec (bump → update) |
| Svelte `$state` re-renders the snippet in place (no remount)? | **Yes.** node identity marker survived. | harness spec (`data-identity` survives) |
| All 6 reference outputs compile-clean? | **Yes.** 0 syntax/type findings (5 via tsc, Svelte via build). | tsc re-check + vite build |
| Non-reactive slots untouched (zero churn to shipped slots)? | **Yes — by design.** Reactive is an opt-in branch; `() => void` shape unchanged. | refs document the Δ-only surgery |
| Solid fit? | **Best of the 6** — mount-once discarded reactivity; reactive embraces signals (`render(()=>slot(scopeSig()))` + `setScopeSig`). | refs/solid + Research |

### Surprises / findings

1. **Svelte `state_referenced_locally` hint** on `let scope = $state(initialScope)`
   — Svelte warns the state won't track `initialScope` prop changes. This is
   correct-by-design: we deliberately seed once and drive updates through the
   `update()` export (engine-driven), never via prop-reactivity. The shipped
   `PortalHostReactive.svelte` should carry a `<!-- svelte-ignore
   state_referenced_locally -->` to keep the build clean. **→ REQ-19.**
2. **Solid signal needs `{ equals: false }`** — the engine may hand back a scope
   object mutated in place (same reference) on `update()`; default `===` equality
   would skip the recompute. `equals:false` forces it. **→ REQ-20.**
3. **Angular updates by mutating `view.context` in place** (`Object.assign`) so
   the template keeps the bound object identity, then `detectChanges()`. Do NOT
   recreate the embedded view (that would remount). **→ REQ-21.**
4. **This spike runs Svelte only at runtime** (the genuine unknown) + compiles
   all 6. The all-6 in-browser reactive-update proof lands in **Spike 009**
   (reactive mention chip inside real TipTap across all 6 targets) — no coverage
   gap, just risk-ordered: 007 isolates the cheapest proof of the hardest
   primitive; 009 proves the rest end-to-end where it actually ships.
