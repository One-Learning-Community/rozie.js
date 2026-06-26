---
surface_hash: 882fa245fb67
---

# Embla libraries comparison

How `@rozie-ui/embla` compares to the existing per-framework [Embla Carousel](https://www.embla-carousel.com) wrappers. Embla is the de-facto dependency-free, library-agnostic carousel engine: its core is pure vanilla JS that attaches to a viewport, reads the consumer's slide DOM, and drives `transform: translate3d(...)`. Every framework wrapper exists only to glue reactive state to that imperative engine, surface its options as props, and forward the event set. The result is a **lopsided ecosystem**: four official wrappers that are **four divergent APIs**; a single-maintainer Angular community package; and **nothing at all for Lit / web components**. Rozie ships one source to all six.

> Research snapshot: 2026-06-10. Versions and the wrapper landscape move; treat them as of that date. All six Rozie packages wrap **Embla v8** (`embla-carousel@^8.6`); Embla v9 is RC-only and renames the API surface, so it is deliberately not targeted yet.

## The wrappers at a glance

| Framework | Embla wrapper | Shape | Depth | Notes |
| --- | --- | --- | :---: | --- |
| **React** | `embla-carousel-react` | a **hook** (`useEmblaCarousel`) | **deep** | Official, maintained. Returns a `[ref, api]` tuple — you wire the ref onto the viewport and call the api yourself. |
| **Vue** | `embla-carousel-vue` | a **composable** | **deep** | Official. Returns a `[ref, api]` composable — Vue-idiomatic but a *different* surface from the React hook. |
| **Svelte** | `embla-carousel-svelte` | an **action** (`use:emblaCarousel`) | **deep** | Official. A Svelte `action` directive — again a *different* shape from hook/composable. |
| **Solid** | `embla-carousel-solid` | a **Solid primitive** | **moderate** | Official. A `createEmblaCarousel` primitive — a fourth divergent API. |
| **Angular** | `embla-carousel-angular` *(community)* | a directive | **shallow** | A **single-maintainer community** package, version-pinned to Angular majors — not first-party. |
| **Lit / web components** | *(none)* | — | — | **No wrapper exists.** You hand-roll the engine attach + lifecycle yourself. |
| **Rozie** | `@rozie-ui/embla-*` | a **component** | **deep** | One source → all six, same props / events / two-way `selectedIndex` / handle. |

The four official wrappers are **excellent libraries** — for a single-framework app each is the obvious pick, and Rozie does not claim to out-feature them on their home turf. The wedge is **consistency and coverage**: the four official surfaces are a hook, a composable, an action, and a primitive — *four different mental models* for the *same* engine; **Angular has only a community package**; and **Lit has nothing**. A team shipping a cross-framework design system today maintains four divergent bindings plus a hand-rolled Angular/Lit story. Rozie gives all six the *same* idiomatic `<Carousel>` component — the same props, events, two-way binding, and imperative handle — from a single definition.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-glue-required.

| Capability | `…-react` | `…-vue` | `…-svelte` | `…-solid` | Angular (community) | Lit (none) | **`@rozie-ui/embla`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Embla v8 engine | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Idiomatic **component** surface | ⚠️ hook | ⚠️ composable | ⚠️ action | ⚠️ primitive | ⚠️ directive | hand-roll | ✅ `<Carousel>` |
| Option surface as props | ⚠️ via options object | ⚠️ via options object | ⚠️ via options object | ⚠️ via options object | ⚠️ | — | ✅ 20 props |
| **Two-way snap index** | ⚠️ via `select` listener | ⚠️ via `select` listener | ⚠️ via `select` listener | ⚠️ via `select` listener | ⚠️ | — | ✅ `selectedIndex` model (echo-guarded) |
| Runtime option reconcile | ⚠️ manual `reInit` | ⚠️ manual `reInit` | ⚠️ manual `reInit` | ⚠️ manual `reInit` | ⚠️ | — | ✅ each option `$watch`→`reInit` |
| Autoplay plugin toggle | ⚠️ wire the plugin yourself | ⚠️ | ⚠️ | ⚠️ | ⚠️ | — | ✅ `autoplay` prop |
| Imperative handle | ✅ via the api object | ✅ via the api object | ✅ via the api object | ✅ via the api accessor | ⚠️ | hand-roll | ✅ uniform 14-verb `$expose` |
| Plugin / options escape hatch | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ `:plugins` + `:options` |
| Config-array **and** declarative slides | ❌ (slot only) | ❌ | ❌ | ❌ | ❌ | — | ✅ `:slides` array OR default slot |
| TypeScript | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including Lit, which has **no Embla wrapper at all**, and Angular, which has only a single-maintainer community package. Lit consumers get a category-leading Embla custom element for free; Angular gets a first-party-quality signals component from the same source as the other five.
- **The same component surface everywhere.** The four official wrappers are a hook, a composable, an action, and a primitive — four mental models for the same engine. `@rozie-ui/embla` is one `<Carousel>` component with the same props/events/handle on all six.
- **A real two-way snap index on all six** — the `selectedIndex` model reads *and* drives the carousel: dragging echoes the new index out (via Embla's `select` event), and a consumer write scrolls the carousel (echo-guarded so a programmatic `scrollTo` doesn't ping-pong). The official wrappers surface the index via a one-way `select` listener; you wire the write-back yourself.
- **A uniform 14-verb imperative handle** (`scrollNext` / `scrollPrev` / `scrollToIndex` / `reInitCarousel` / `canScrollNext` / `canScrollPrev` / `getSelectedIndex` / `scrollSnapList` / `scrollProgress` / `slidesInView` / `slidesNotInView` / `previousScrollSnap` / `getPlugins` / `getInstance`) grabbed with each framework's native ref — identical on every target.
- **Two slide-source modes from one component** — pass a `:slides` config array, or drop declarative `.rozie-embla__slide` children into the default slot. The official wrappers only support consumer-authored slide DOM.
- **`getInstance()` is always one hop from the raw engine**, so the full Embla v8 API is reachable on any target when the curated surface doesn't cover something.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **React/Vue/Svelte/Solid depth on their home framework.** The four official wrappers are mature, maintained, and idiomatic for their framework's own conventions (a React dev expects a hook; a Svelte dev expects an action). On its home framework each is a perfectly good pick. Rozie's value is **not** "more than `embla-carousel-react` on React" — it's the **same idiomatic component on all six frameworks from one source**, with Lit and Angular getting an Embla component they otherwise lack. For anything outside the curated surface, `getInstance()` hands you the raw engine on every target.
- **Per-option setters.** Embla itself ships **no** per-option setters — `reInit(options)` is the only update path. So `@rozie-ui/embla` `$watch`es each runtime option and calls `reInit`, exactly as you would by hand with the official wrappers. A consumer rapidly mutating options can thrash `reInit`; debounce on the consumer side if needed (Embla's native `watchSlides` is incremental for slide changes).
- **`@rozie-ui/embla` is `0.1.0`.** The surface (20 props / 4 events / 14-verb handle / two-way `selectedIndex` model) is stable and gate-verified, but it is younger than the official wrappers.
- **Embla v8, not v9.** These packages wrap the mature v8. Embla v9 (RC at time of writing) renames the API surface; teams that want v9 are better served by it directly once it ships stable.

## Try it

The [`@rozie-ui/embla` showcase + API reference](/components/embla) documents the `@rozie-ui/embla-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/embla-react embla-carousel embla-carousel-autoplay`, etc.). There is **no engine CSS to import** — Embla's carousel skeleton ships scoped inside the component. The showcase walks the two-way `selectedIndex` binding, the 4-event surface, the 14-verb imperative handle, and the prev/next/dots recipe.

## Cross-references

- [Embla — showcase & API](/components/embla) — the full `@rozie-ui/embla` surface, quick starts, and recipes.
- [Embla — live demo](/components/embla-demo) — the real Vue package running in the page.
- [`Carousel.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/src/Carousel.rozie)
- [Cropper libraries comparison](/components/cropper-comparison) — a sibling engine-wrapper port.
