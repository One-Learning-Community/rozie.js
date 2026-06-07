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
| **Rozie** | `@rozie-ui/tiptap-*` | 0.1.0 | — | One Learning Community | ✅ `nodeView` reactive portal slot (all 6) |

The wedge is real and strongest for **Lit (no wrapper at all)** and **Solid (thin, no node views, three fragmented forks, the most-used one ~10 months stale)**. Svelte is the partial exception — `svelte-tiptap` is genuinely capable — but it's a single-maintainer package TipTap's own docs don't endorse (the official Svelte guide just says "hand-instantiate the `Editor` class").

## Feature matrix

| Capability | `@tiptap/react` | `@tiptap/vue-3` | `ngx-tiptap` | `svelte-tiptap` | `solid-tiptap` | Lit (none) | **`@rozie-ui/tiptap`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Mount editor | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| **Controlled two-way content** | ❌¹ | ❌¹ | ✅ (CVA / `ngModel`) | ❌¹ | ❌¹ | hand-roll | ✅ `r-model:html` (+ Angular CVA) |
| Imperative command handle | ✅ (the `Editor`) | ✅ (the `Editor`) | ✅ (you own `Editor`) | ✅ (store) | ✅ (read hooks) | hand-roll | ✅ 14-verb `$expose` |
| Batteries-included toolbar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ internal toolbar |
| Consumer toolbar slot (bound to editor) | build it yourself | build it yourself | build it yourself | build it yourself | build it yourself | hand-roll | ✅ `toolbar` portal slot |
| `extensions` passthrough | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| `editorProps` passthrough | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| **Node-view component renderer** | ✅ | ✅ | ✅ | ✅ | ❌ | hand-roll | ✅ `nodeView` reactive slot (all 6) |
| Bubble / floating menu | ✅ `/menus` | ✅ `/menus` | ✅ directives | ✅ | ❌ | hand-roll | ⏳ deferred (follow-up) |
| Placeholder (empty-state) | via core ext | via core ext | via core ext | via core ext | via core ext | hand-roll | via `:extensions` (bundling = Phase 33) |
| SSR | ✅² | ✅² | ⚠️ client-only | ✅² | ✅² | — | ✅ by construction³ |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

¹ **No controlled/`v-model` content contract.** Neither official wrapper ships two-way content binding — you get `content` in + an `onUpdate` callback out, and must hand-roll the `setContent` loop (the Vue `v-model` story is a documented manual `modelValue` + `watch`→`setContent` pattern, the single most-asked Vue question). `ngx-tiptap` is the exception: it implements `ControlValueAccessor`, so `[(ngModel)]` and reactive forms work. **Rozie gives every target a controlled `html` two-way binding with a built-in echo-guard — and because `html` is the single `model` prop, the Angular target *also* auto-implements `ControlValueAccessor` (provider + the four accessor methods + focusout-touched), so `[(ngModel)]`, `[formControl]`, and `formControlName` all bind directly — matching `ngx-tiptap`'s forms story with no extra wiring.**

² SSR supported but requires the `immediatelyRender: false` ritual (+ `'use client'` on Next.js / the Nuxt guide). ³ Rozie's wrapper instantiates the engine inside the mount hook only (no top-level DOM), so it is SSR-safe by construction.

## Where Rozie wins today

- **One definition, six idiomatic packages** — including the two frameworks the ecosystem underserves: **Lit (zero existing wrapper)** and **Solid (thin, no node views, stalling)**. A Solid dev today hand-rolls node views and all menu UI; a Lit dev hand-rolls *everything*.
- **Controlled two-way `html`** out of the box on all six, with a shared echo-guard — the thing every React/Vue/Svelte consumer reimplements by hand.
- **A batteries-included toolbar** (Bold/Italic/H1/H2/Bullet with live active-state) *and* a **`toolbar` portal slot** that hands the consumer the live editor — neither official wrapper ships any toolbar.
- **A uniform 14-verb imperative command handle** (`$expose`) with the same shape on every target — versus "hold the `Editor` you happened to construct" (which differs per framework: hook return, ref, store, or a directive input).
- **Node views on all six** — a single `nodeView` **reactive** portal slot renders a framework fragment as a custom ProseMirror node (mention chips, embeds, editable callouts) and re-renders it **in place** on each transaction. This is the marquee TipTap feature, and Rozie ships it where the ecosystem has gaps: **Solid (`solid-tiptap` has no node-view renderer)** and **Lit (no wrapper at all)** get it for free from the same source.

## Gap status — what shipped, what's still deferred

| Gap | Who has it | Severity | Rozie status |
| --- | --- | --- | --- |
| **G1 — Node-view component renderer** | React, Vue, Angular, Svelte | **High** (TipTap's marquee feature) | **✅ SHIPPED (Phase 33)** — a uniform `nodeView` **reactive** portal slot driven by `addNodeView`, proven 6/6. See the [shipped design below](#node-view-portal-slots-g1-shipped). |
| G2 — Bubble / Floating menu | React, Vue, Angular, Svelte | Medium | **⏳ Deferred (follow-up)** — a `bubbleMenu` / `floatingMenu` portal slot over `@tiptap/extension-bubble-menu` (Floating UI). Out of Phase 33 scope. |
| **G3 — Bundled Placeholder** | all (via core ext) | Low | **✅ SHIPPED** — bundles `@tiptap/extensions` (ships `Placeholder` in v3) and wires the `placeholder` prop to `Placeholder.configure({ placeholder })`; ghost-text renders on the empty editor across all six targets via the `:root { }` engine-DOM escape hatch (Phase 34). See [shipped below](#bundle-placeholder-g3-shipped). |
| G4 — `outputFormat: 'json'` two-way | `ngx-tiptap` | Low | **⏳ Deferred (follow-up)** — a `format` prop (`'html' | 'json'`) switching the two-way payload; `getJSON()` already exists on the handle. |
| G5 — Reactive-forms / CVA | `ngx-tiptap` (Angular) | Low | **✅ SHIPPED** — `html` is the single `model` prop, so the Angular target auto-emits `ControlValueAccessor` (Phase 23). `[(ngModel)]`, `[formControl]`, and `formControlName` bind directly, no wrapper directive. |

## Node-view portal slots (G1 — shipped) {#node-view-portal-slots-g1-shipped}

The strongest differentiator now ships: render a **framework component as a custom ProseMirror node** uniformly across all six targets — where React/Vue/Angular/Svelte each ship their own renderer, Solid has none, and Lit has nothing. Phase 33 delivered it as the **first reactive portal slot**, proven 6/6 (behavioral + pixel).

**How it works.** A custom TipTap Node whose `addNodeView()` returns a ProseMirror `NodeView` that:

1. creates a host `dom` (and, for editable nodes, a `contentDOM` editable hole),
2. on construction calls `$portals.nodeView(dom, { node, selected, updateAttributes, getPos, editor, contentDOM })` — mounting the consumer's framework fragment into the engine-owned node DOM,
3. implements `update(node)` to re-invoke the portal's **reactive** handle (`{ update(scope), dispose() }`) with fresh scope — re-rendering the fragment **in place, no remount**, and
4. `destroy()` calls the portal dispose handle.

**The reactive primitive.** Node views need per-transaction re-render (selection / attribute changes), so they ride on the **reactive portal-slot primitive** shipped in this phase: `<slot name="nodeView" portal reactive />` whose closure returns `{ update(scope), dispose() }`. The driver is **engine-driven** — ProseMirror's `NodeView.update`/`selectNode`/`deselectNode` lifecycle maps 1:1 onto `update(scope)`; Rozie owns no reactive loop. The 3 pre-existing mount-once slots (CM6 `panel`, Chart `tooltip`, TipTap `toolbar`) keep the verbatim `() => void` shape — zero churn.

**The contentDOM editable-hole bridge (REQ-23).** An editable node exposes both a chrome `dom` and a ProseMirror-managed `contentDOM`. The consumer fragment renders chrome wrapping a `[data-rozie-hole]` placeholder; the per-target bridge grafts `contentDOM` into that hole, after which ProseMirror owns that subtree. The graft splits the six targets by **ref-timing**:

- **React / Solid / Lit** — graft via the native `ref` idiom (synchronous-within-render).
- **Vue / Svelte / Angular** — graft via **query-after-render** (`dom.querySelector('[data-rozie-hole]')` after the synchronous mount), because their function-ref / action / template-query timing is post-mount.

**Cross-framework reach.** The same `TipTap.rozie` source ships node views into **Solid** (where `solid-tiptap` has none) and **Lit** (where no wrapper exists) — the two frameworks the official ecosystem leaves to hand-rolling. The reactive-chrome-around-editable-hole composition was verified once in a real TipTap document (REQ-24), with **Angular as the first-class live-browser proof target (REQ-25)**.

See the [TipTap guide's Node-view slots section](/guide/tiptap#node-view-slots) for the per-target consumer shapes and the editable-hole recipe.

## Bundle Placeholder (G3 — shipped) {#bundle-placeholder-g3-shipped}

The `placeholder` prop now renders empty-state ghost text out of the box — no consumer `:extensions` wiring. `@rozie-ui/tiptap` bundles **`@tiptap/extensions`** (version-matched to `@tiptap/core` / `@tiptap/starter-kit`; ships `Placeholder` in TipTap v3), and the source wires the prop conditionally at editor construction:

```js
const placeholderExtensions = $props.placeholder
  ? [Placeholder.configure({ placeholder: $props.placeholder })]
  : []
// consumer $props.extensions stay LAST so they still win
extensions: [StarterKit, ...placeholderExtensions, ...nodeViewExtensions, ...$props.extensions]
```

The Placeholder extension adds the class `is-editor-empty` and a `data-placeholder` attribute to the first empty ProseMirror node — an **engine-rendered node that never carries Rozie's `[data-rozie-s-*]` scope attribute**, so a plain scoped CSS rule would silently fail to match on React/Solid/Lit. The ghost-text `::before` rule is therefore emitted through the **`:root { … }` engine-DOM escape hatch** (Phase 34): bare/unscoped on every target — React `.global.css` sidecar, Vue unscoped second `<style>`, Svelte `:global { }`, Angular `::ng-deep`, Solid `__rozieInjectStyle`, Lit dual-sink (`static styles` + `injectGlobalStyles`). (Not `:global()` — that is a ROZ128 hard error; the `:root { nested }` form is canonical.) The ghost text renders **only** while the editor is empty, so it has zero effect on non-empty documents.

## Deferred follow-ups (G2 / G4)

These remain out of scope and are tracked for a follow-up phase.

### Bubble / Floating menu slots (G2)

A `bubbleMenu` and `floatingMenu` portal slot over `@tiptap/extension-bubble-menu` / `@tiptap/extension-floating-menu` (both Floating-UI-based in v3). Lower risk than node views — the menu's DOM is a single positioned element, a natural portal host (the same shape as the shipped `toolbar` slot, plus a selection-driven `shouldShow`). Adds the two extension peers.

### JSON content format (G4)

A `format` prop (`'html'` default | `'json'`) that switches the two-way `html`/`json` model payload and the `update` event shape — matching `ngx-tiptap`'s `outputFormat`. `getJSON()` already exists on the handle, so this is a small source change.

## Honest caveats

- **Node views ship; bubble/floating menus do not yet** — as of Phase 33 the `nodeView` reactive portal slot is shipped 6/6 (mention chips, embeds, editable callouts). The remaining gap is **bubble / floating menus** (G2): if your use case needs selection-anchored menu UI, the official React/Vue wrappers (or `ngx-tiptap` / `svelte-tiptap`) are more complete *today*. Rozie's wedge is the **uniform cross-framework editor + toolbar + node views + command handle + two-way binding**, and especially **reach into Solid and Lit** where the ecosystem is thin-to-absent.
- **`@rozie-ui/tiptap` is `0.1.0`** — the surface (8 props / 4 events / 14-verb handle / `toolbar` slot + `nodeView` reactive slot) is stable and gate-verified, but it is younger than the multi-year official wrappers.
- **Single StarterKit baseline** — the bundled extension set is StarterKit; everything else comes through `:extensions`. That is by design (the consumer-extensibility passthrough), but it means richer setups carry more consumer wiring than a batteries-everything wrapper would.

## Cross-references

- [TipTap — showcase & API](/guide/tiptap) — the full `@rozie-ui/tiptap` surface, quick starts, and recipes.
- [`TipTap.rozie` source](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tiptap/src/TipTap.rozie)
- [The portal-slot primitive](/examples/portal-list) — the mechanism the `nodeView` reactive slot builds on.
