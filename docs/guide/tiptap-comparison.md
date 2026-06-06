# TipTap libraries comparison

How `@rozie-ui/tiptap` compares to the existing per-framework TipTap wrappers. TipTap's editor core (`@tiptap/core` + ProseMirror) is framework-agnostic and mounts anywhere — every wrapper exists only to glue reactive state, forward extensions, and bridge node views. The result is an **uneven ecosystem**: first-party React/Vue, healthy community Svelte/Angular, a thin-and-stalling Solid story, and **nothing for Lit**. Rozie ships one source to all six.

> Research snapshot: 2026-06-06. Versions and download counts move; treat them as of that date.

## The wrappers at a glance

| Wrapper | Package | Latest | Weekly downloads | Maintainer | Node-view renderer |
| --- | --- | --- | --- | --- | :---: |
| **React** (official) | `@tiptap/react` | 3.26.0 | ~9.3M | ueberdosis (first-party) | ✅ `ReactNodeViewRenderer` |
| **Vue** (official) | `@tiptap/vue-3` | 3.26.0 | ~1.1M | ueberdosis (first-party) | ✅ `VueNodeViewRenderer` |
| **Angular** (community) | `ngx-tiptap` | 14.0.1 | ~46k | sibiraj-s | ✅ `AngularNodeViewRenderer` |
| **Svelte** (community) | `svelte-tiptap` | 3.0.1 | ~20.5k | sibiraj-s | ✅ `SvelteNodeViewRenderer` |
| **Solid** (community) | `solid-tiptap` | 0.8.0 | ~3.9k | lxsmnsyc | ❌ none |
| **Lit** | — | — | — | — | ❌ no wrapper exists |
| **Rozie** | `@rozie-ui/tiptap-*` | 0.1.0 | — | One Learning Community | ⏳ deferred (Phase 33) |

The wedge is real and strongest for **Lit (no wrapper at all)** and **Solid (thin, no node views, three fragmented forks, the most-used one ~10 months stale)**. Svelte is the partial exception — `svelte-tiptap` is genuinely capable — but it's a single-maintainer package TipTap's own docs don't endorse (the official Svelte guide just says "hand-instantiate the `Editor` class").

## Feature matrix

| Capability | `@tiptap/react` | `@tiptap/vue-3` | `ngx-tiptap` | `svelte-tiptap` | `solid-tiptap` | Lit (none) | **`@rozie-ui/tiptap`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Mount editor | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| **Controlled two-way content** | ❌¹ | ❌¹ | ✅ (CVA / `ngModel`) | ❌¹ | ❌¹ | hand-roll | ✅ `r-model:html` |
| Imperative command handle | ✅ (the `Editor`) | ✅ (the `Editor`) | ✅ (you own `Editor`) | ✅ (store) | ✅ (read hooks) | hand-roll | ✅ 14-verb `$expose` |
| Batteries-included toolbar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ internal toolbar |
| Consumer toolbar slot (bound to editor) | build it yourself | build it yourself | build it yourself | build it yourself | build it yourself | hand-roll | ✅ `toolbar` portal slot |
| `extensions` passthrough | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| `editorProps` passthrough | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| **Node-view component renderer** | ✅ | ✅ | ✅ | ✅ | ❌ | hand-roll | ⏳ Phase 33 |
| Bubble / floating menu | ✅ `/menus` | ✅ `/menus` | ✅ directives | ✅ | ❌ | hand-roll | ⏳ Phase 33 |
| Placeholder (empty-state) | via core ext | via core ext | via core ext | via core ext | via core ext | hand-roll | via `:extensions` (bundling = Phase 33) |
| SSR | ✅² | ✅² | ⚠️ client-only | ✅² | ✅² | — | ✅ by construction³ |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

¹ **No controlled/`v-model` content contract.** Neither official wrapper ships two-way content binding — you get `content` in + an `onUpdate` callback out, and must hand-roll the `setContent` loop (the Vue `v-model` story is a documented manual `modelValue` + `watch`→`setContent` pattern, the single most-asked Vue question). `ngx-tiptap` is the exception: it implements `ControlValueAccessor`, so `[(ngModel)]` and reactive forms work. **Rozie gives every target a controlled `html` two-way binding with a built-in echo-guard.**

² SSR supported but requires the `immediatelyRender: false` ritual (+ `'use client'` on Next.js / the Nuxt guide). ³ Rozie's wrapper instantiates the engine inside the mount hook only (no top-level DOM), so it is SSR-safe by construction.

## Where Rozie wins today

- **One definition, six idiomatic packages** — including the two frameworks the ecosystem underserves: **Lit (zero existing wrapper)** and **Solid (thin, no node views, stalling)**. A Solid dev today hand-rolls node views and all menu UI; a Lit dev hand-rolls *everything*.
- **Controlled two-way `html`** out of the box on all six, with a shared echo-guard — the thing every React/Vue/Svelte consumer reimplements by hand.
- **A batteries-included toolbar** (Bold/Italic/H1/H2/Bullet with live active-state) *and* a **`toolbar` portal slot** that hands the consumer the live editor — neither official wrapper ships any toolbar.
- **A uniform 14-verb imperative command handle** (`$expose`) with the same shape on every target — versus "hold the `Editor` you happened to construct" (which differs per framework: hook return, ref, store, or a directive input).

## Where the official wrappers still win — the gap table

| Gap | Who has it | Severity | Rozie plan |
| --- | --- | --- | --- |
| **G1 — Node-view component renderer** | React, Vue, Angular, Svelte | **High** (TipTap's marquee feature) | **Phase 33** — uniform `<slot name="nodeView" portal>` driven by `addNodeView`. Design sketch below. |
| G2 — Bubble / Floating menu | React, Vue, Angular, Svelte | Medium | **Phase 33** — a `bubbleMenu` / `floatingMenu` portal slot over `@tiptap/extension-bubble-menu` (Floating UI). |
| G3 — Bundled Placeholder | all (via core ext) | Low | **Phase 33 (cheap)** — bundle `@tiptap/extension-placeholder` + wire the `placeholder` prop to it. Deferred only to avoid a mid-port dependency add; works today via `:extensions`. |
| G4 — `outputFormat: 'json'` two-way | `ngx-tiptap` | Low | **Phase 33** — a `format` prop (`'html' | 'json'`) switching the two-way payload; `getJSON()` already exists on the handle. |
| G5 — Reactive-forms / CVA | `ngx-tiptap` (Angular) | Low | Angular-only; Rozie's `[(html)]` covers template-driven forms. CVA is a niche Angular add. |

## Phase 33 gap-closure proposal

Recommended order (highest value first). Each is **codegen/source/config only — no emitter touch** unless a genuine compiler gap surfaces, matching the Chart.js Phase 31 discipline.

### 1. Node-view portal slots (G1 — the marquee wedge)

The strongest differentiator: render a **framework component as a custom ProseMirror node** uniformly across all six targets — where React/Vue/Angular/Svelte each ship their own renderer, Solid has none, and Lit has nothing.

**Design sketch.** A custom TipTap Node whose `addNodeView()` returns a ProseMirror `NodeView` that:
1. creates a host `dom` (and optionally a `contentDOM` for editable holes),
2. on construction calls `$portals.nodeView(dom, { node, updateAttributes, getPos, selected, editor })` — mounting the consumer's framework fragment into the engine-owned node DOM,
3. implements `update(node)` to re-invoke the portal with fresh scope (the reactive-portal-slot variant — today's `$portals` is mount-once, so this needs the post-v1 reactive-portal evolution already noted in the portal-slot spike), and
4. `destroy()` calls the portal dispose handle.

**Why it's deferred, not shipped now.** This is the **3-strikes-risk primitive** (per the port brief). Two hard parts: (a) `$portals` is mount-once today — node views need per-transaction re-render, so this rides on the planned reactive-portal-slot upgrade; (b) the `contentDOM` editable-hole bridge across the weaker Lit/Solid emitters is unproven. It is a multi-wave spike, not a single wave — shipping the editor + `toolbar` slot now and deferring node views (with this design recorded) is the disciplined call.

**Decision needed from the owner:** confirm the reactive-portal-slot upgrade is in scope for Phase 33 (it's the prerequisite), or scope node views to a **static** (mount-once) variant first (renders once, no per-transaction attribute reactivity — useful for non-interactive embeds, ships sooner).

### 2. Bubble / Floating menu slots (G2)

A `bubbleMenu` and `floatingMenu` portal slot over `@tiptap/extension-bubble-menu` / `@tiptap/extension-floating-menu` (both Floating-UI-based in v3). Lower risk than node views — the menu's DOM is a single positioned element, a natural portal host (the same shape as the shipped `toolbar` slot, plus a selection-driven `shouldShow`). Adds the two extension peers.

### 3. Bundle Placeholder (G3 — cheap, high-value)

Add `@tiptap/extension-placeholder` (or `@tiptap/extensions`, which ships Placeholder in v3) as a peer, and wire the existing `placeholder` prop to `Placeholder.configure({ placeholder })` so empty-state placeholder rendering works without the consumer adding it via `:extensions`. **Recommended to do first** — it's a one-extension add that closes a paper-cut every consumer hits.

### 4. JSON content format (G4)

A `format` prop (`'html'` default | `'json'`) that switches the two-way `html`/`json` model payload and the `update` event shape — matching `ngx-tiptap`'s `outputFormat`. `getJSON()` already exists on the handle, so this is a small source change.

## Honest caveats

- **Node views and menus are not shipped yet** — if your use case centres on custom node views (mentions, embeds, interactive widgets), the official React/Vue wrappers (or `ngx-tiptap` / `svelte-tiptap`) are more complete *today*. Rozie's wedge is the **uniform cross-framework editor + toolbar + command handle + two-way binding**, and especially **reach into Solid and Lit** where the ecosystem is thin-to-absent.
- **`@rozie-ui/tiptap` is `0.1.0`** — the surface (8 props / 4 events / 14-verb handle / `toolbar` slot) is stable and gate-verified, but it is younger than the multi-year official wrappers.
- **Single StarterKit baseline** — the bundled extension set is StarterKit; everything else comes through `:extensions`. That is by design (the consumer-extensibility passthrough), but it means richer setups carry more consumer wiring than a batteries-everything wrapper would.

## Cross-references

- [TipTap — showcase & API](/guide/tiptap) — the full `@rozie-ui/tiptap` surface, quick starts, and recipes.
- [`TipTap.rozie` source](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tiptap/src/TipTap.rozie)
- [The portal-slot primitive](/examples/portal-list) — the mechanism node-view slots will build on.
