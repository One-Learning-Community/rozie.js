---
surface_hash: 3858339832a2
---

# TipTap libraries comparison

How `@rozie-ui/tiptap` compares to the existing per-framework TipTap wrappers. TipTap's editor core (`@tiptap/core` + ProseMirror) is framework-agnostic and mounts anywhere; every wrapper exists only to glue reactive state, forward extensions, and bridge node views. The ecosystem is uneven: first-party React/Vue, healthy community Svelte/Angular, a thin and stalling Solid story, and nothing for Lit. `@rozie-ui/tiptap` ships the same `<TipTap>` to all six frameworks: same props, same events, same two-way `html` binding, same command handle, installed as a pre-compiled package for your framework with no Rozie toolchain required.

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
| **Rozie** | `@rozie-ui/tiptap-*` | pre-1.0 | — | One Learning Community | ✅ `nodeView` reactive portal slot (all 6) |

The gap is widest for Lit, which has no wrapper at all, and Solid, whose wrappers are thin, fork-fragmented, and ship no node views. Svelte is the partial exception: `svelte-tiptap` is genuinely capable, but it is a single-maintainer package that TipTap's own docs don't endorse (the official Svelte guide says to hand-instantiate the `Editor` class).

## Feature matrix

| Capability | `@tiptap/react` | `@tiptap/vue-3` | `ngx-tiptap` | `svelte-tiptap` | `solid-tiptap` | Lit (none) | **`@rozie-ui/tiptap`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Mount editor | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| **Controlled two-way content** | ❌¹ | ❌¹ | ✅ (CVA / `ngModel`) | ❌¹ | ❌¹ | hand-roll | ✅ `r-model:html` (+ Angular CVA) |
| Imperative command handle | ✅ (the `Editor`) | ✅ (the `Editor`) | ✅ (you own `Editor`) | ✅ (store) | ✅ (read hooks) | hand-roll | ✅ uniform `$expose` handle |
| Batteries-included toolbar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ internal toolbar |
| Consumer toolbar slot (bound to editor) | build it yourself | build it yourself | build it yourself | build it yourself | build it yourself | hand-roll | ✅ `toolbar` portal slot |
| Link-editing UI in the wrapper | ⚠️ separate UI-components package | ❌ | ❌ | ❌ | hand-roll | hand-roll | ✅ built-in link editor + `linkEditor` reactive slot |
| `extensions` passthrough | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| `editorProps` passthrough | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| **Node-view component renderer** | ✅ | ✅ | ✅ | ✅ | ❌ | hand-roll | ✅ `nodeView` reactive slot (all 6) |
| Bubble / floating menu | ✅ `/menus` | ✅ `/menus` | ✅ directives | ✅ | ❌ | hand-roll | ✅ `bubbleMenu` + `floatingMenu` portal slots (all 6) |
| Placeholder (empty-state) | via core ext | via core ext | via core ext | via core ext | via core ext | hand-roll | ✅ bundled (`placeholder` prop) |
| SSR | ✅² | ✅² | ⚠️ client-only | ✅² | ✅² | — | ✅ by construction³ |
| Same API on all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

¹ **No controlled/`v-model` content contract.** Neither official wrapper ships two-way content binding. You get `content` in plus an `onUpdate` callback out, and must hand-roll the `setContent` loop (the Vue `v-model` story is a documented manual `modelValue` + `watch`→`setContent` pattern, the single most-asked Vue question). `ngx-tiptap` is the exception: it implements `ControlValueAccessor`, so `[(ngModel)]` and reactive forms work. Rozie gives every target a controlled `html` two-way binding with a built-in echo-guard. Because `html` is the single `model` prop, the Angular target also auto-implements `ControlValueAccessor`, so `[(ngModel)]`, `[formControl]`, and `formControlName` all bind directly, matching `ngx-tiptap`'s forms story with no extra wiring.

² SSR supported but requires the `immediatelyRender: false` ritual (+ `'use client'` on Next.js / the Nuxt guide). ³ Rozie's wrapper instantiates the engine inside the mount hook only (no top-level DOM), so it is SSR-safe by construction.

## Where Rozie wins today

- **First-class packages for all six frameworks** — including the two the ecosystem underserves: Lit (zero existing wrapper) and Solid (thin, no node views, stalling). A Solid dev today hand-rolls node views and all menu UI; a Lit dev hand-rolls everything.
- **The same editor everywhere.** One `<TipTap>` to learn, document, and migrate across your stack: the same props, the same `update`/`selectionUpdate`/`focus`/`blur` events, the same slots, the same command handle on every target, versus a different wrapper API (hook return, ref, store, directive input) per framework.
- **Controlled two-way `html`** out of the box on all six, with a shared echo-guard: the thing every React/Vue/Svelte consumer reimplements by hand. On Angular it doubles as a `ControlValueAccessor`, so reactive forms bind directly.
- **A batteries-included toolbar** (Bold / Italic / H1 / H2 / Bullet / Underline / Ordered list / Link with live active-state, plus Undo/Redo) and a `toolbar` portal slot that hands your replacement UI the live editor. Neither official wrapper ships any toolbar.
- **A built-in link editor.** Clicking a link (or the toolbar Link button, or calling `openLinkEditor()`) surfaces an edit/create form in a bubble-menu surface; the reactive `linkEditor` slot swaps in your own form with `{ editor, href, attrs, setLink, unsetLink, close }` in scope. Every other wrapper leaves link UI entirely to you.
- **Node views on all six.** A single `nodeView` reactive portal slot renders a framework fragment as a custom ProseMirror node (mention chips, embeds, editable callouts) and re-renders it in place on each transaction. This is TipTap's marquee feature, and Rozie ships it where the ecosystem has gaps: Solid and Lit get it too.
- **Selection-anchored `bubbleMenu` / `floatingMenu` portal slots** over the Floating-UI menu extensions: bring your own menu fragment, handed the live editor, uniform across all six targets.
- **Bundled Placeholder and a live character/word counter** with zero setup: set `placeholder` for empty-state ghost text, `:max-length` for a live counter with an overridable `count` scoped slot and `getCharacterCount()` / `getWordCount()` handle reads.

The showcase documents each of these in depth: [node-view slots](/components/tiptap#node-view-slots), [the link editor](/components/tiptap#link-editor), [bubble & floating menus](/components/tiptap#bubble-floating-menu-slots), and the [full API surface](/components/tiptap#api).

## What Rozie defers

- **JSON as the two-way model payload.** `ngx-tiptap` can make its binding carry JSON (`outputFormat`). Rozie's two-way channel is `html` only, by design: a second JSON model channel would race it. JSON is still available whenever you need it via `getJSON()` on the handle.
- **A single StarterKit baseline.** The bundled extension set is StarterKit; everything else comes through `:extensions`. A `starterKit` config passthrough plus a collision-aware auto-disable scan mean a consumer swapping in a custom same-named extension (e.g. a custom `Link`) wins with no duplicate-extension warning. Richer setups still carry more consumer wiring than a batteries-everything wrapper would; that remains by design.
- **`@rozie-ui/tiptap` is pre-1.0** and younger than the multi-year official wrappers. The full prop/event/slot/handle surface is documented on the [API reference](/components/tiptap#api).

## Try it

The [`@rozie-ui/tiptap` showcase + API reference](/components/tiptap) documents the packages: one pre-compiled, per-framework install (`npm i @rozie-ui/tiptap-react`, etc.). The [live demo](/components/tiptap-demo) runs the real Vue package in the page.

## Cross-references

- [TipTap — showcase & API](/components/tiptap) — the full `@rozie-ui/tiptap` surface, quick starts, and recipes.
- [`TipTap.rozie` source](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tiptap/src/TipTap.rozie)
- [The portal-slot primitive](/examples/portal-list) — the mechanism the `nodeView` reactive slot builds on.
