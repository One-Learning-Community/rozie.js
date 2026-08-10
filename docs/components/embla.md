# Embla — the cross-framework carousel

`Carousel` wraps [Embla Carousel](https://www.embla-carousel.com), the dependency-free, library-agnostic carousel engine: its core is pure vanilla JS that attaches to a viewport element, reads the consumer's slide DOM, and drives `transform: translate3d(...)` for buttery drag/scroll. It ships as idiomatic React, Vue, Svelte, Angular, Solid, and Lit packages with the same props, events, two-way `selectedIndex`, and imperative handle in each.

The full source for `Carousel.rozie` lives in the [`@rozie-ui/embla` package](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/src/Carousel.rozie). See it running in the [live demo](/components/embla-demo), and how it stacks up against the per-framework wrappers in the [libraries comparison](/components/embla-comparison).

## The `@rozie-ui/embla` packages

Install the pre-compiled package for your framework; no build step is required:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/embla-react` | `npm i @rozie-ui/embla-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/packages/react/README.md) |
| `@rozie-ui/embla-vue` | `npm i @rozie-ui/embla-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/packages/vue/README.md) |
| `@rozie-ui/embla-svelte` | `npm i @rozie-ui/embla-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/packages/svelte/README.md) |
| `@rozie-ui/embla-angular` | `npm i @rozie-ui/embla-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/packages/angular/README.md) |
| `@rozie-ui/embla-solid` | `npm i @rozie-ui/embla-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/packages/solid/README.md) |
| `@rozie-ui/embla-lit` | `npm i @rozie-ui/embla-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/packages/lit/README.md) |

All six wrap **Embla Carousel v8** (`embla-carousel@^8.6`) plus the **Autoplay plugin** (`embla-carousel-autoplay@^8.6`), both declared as peer dependencies, alongside each package's framework peer (React 18+, Vue 3.4+, Svelte 5+, Angular 19+, Solid 1.8+, Lit 3+; React also needs `react-dom`). Install the two engine peers alongside the framework package:

```bash
# React
npm i @rozie-ui/embla-react embla-carousel embla-carousel-autoplay
# Vue / Svelte / Angular / Solid / Lit — swap the framework package
npm i @rozie-ui/embla-vue embla-carousel embla-carousel-autoplay
```

(Embla v9 is RC-only and renames the whole API surface; it is deliberately not targeted yet.)

Each package ships its framework's native shape: compiled `.tsx` + types for React and Solid, `.vue` SFC source for Vue, `.svelte` source for Svelte, standalone component source for Angular, and a compiled custom element + types for Lit.

::: tip No engine CSS to import
Unlike most engine wrappers, Embla ships **no** stylesheet you must import. The carousel skeleton styles — an `overflow: hidden` viewport, a `display: flex` container, and slide sizing — ship **scoped inside the component**. Slides are plain light-DOM framework children, so the scoped styles reach them (including through Lit's shadow root).
:::

## Quick start

There are **two slide-source modes** from one component:

- **Config array** — pass `:slides="[...]"` and Rozie renders one slide per item (optionally via the scoped `slide` slot for custom markup).
- **Declarative** — drop `<div class="rozie-embla__slide">…</div>` children into the default slot; Embla's native `watchSlides` reacts to adds/removes.

The `rozie-embla__slide` class is **required**, not decorative, in both modes: the component measures slides by an explicit element list (the [`$slotted.<name>` sigil](/guide/engine-wrappers#slotted-name-—-resolve-slotted-elements-across-the-lit-shadow-boundary) resolves the default slot's content even across Lit's shadow boundary), so unclassed children are never measured as slides.

Both modes work identically, including on Lit.

The current snap is **two-way bound** through the single `selectedIndex` model prop. Dragging or scrolling writes the new index back through the model path (echo-guarded so a programmatic `scrollTo` doesn't ping-pong); a consumer write scrolls the carousel. Snap/settle/reInit/pointer lifecycle fires as native framework events. Note the model is `selectedIndex` while the snap-change event is `select` — distinct identifiers (a model prop must not share a name with an emit).

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Carousel from '@rozie-ui/embla-vue';

const index = ref(0);
</script>

<template>
  <Carousel
    :slides="['A', 'B', 'C']"
    v-model:selectedIndex="index"
    :loop="true"
    @select="(i) => console.log('snap', i)"
  />
</template>
```

### React

```tsx
import { useState } from 'react';
import { Carousel } from '@rozie-ui/embla-react';

export function Demo() {
  const [index, setIndex] = useState(0);
  return (
    <Carousel
      slides={['A', 'B', 'C']}
      selectedIndex={index}
      onSelectedIndexChange={setIndex}
      loop
      onSelect={(i) => console.log('snap', i)}
    />
  );
}
```

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `slides` | `Array` | `[]` | ✓ | Config-array slide data (mode a). Optional — the default slot is mode b. |
| `loop` | `Boolean` | `false` | ✓ | Wrap from the last snap back to the first. |
| `align` | `String` | `"center"` | ✓ | Snap alignment — `'start' \| 'center' \| 'end'`. |
| `axis` | `String` | `"x"` | ✓ | Scroll axis — `'x'` (horizontal) or `'y'` (vertical). |
| `slidesToScroll` | `Number` | `1` | ✓ | Number of slides advanced per snap. |
| `dragFree` | `Boolean` | `false` | ✓ | Momentum/free-scroll drag (no hard snapping). |
| `draggable` | `Boolean` | `true` | ✓ | Enable pointer drag (Embla `watchDrag`). |
| `containScroll` | `String` | `"trimSnaps"` | ✓ | Edge-snap containment — `'' \| 'trimSnaps' \| 'keepSnaps'`. |
| `startIndex` | `Number` | `0` | | Initial snap index. **Init-only, by design** — Embla's `reActivate` preserves the live position by merging `{ startIndex: selectedScrollSnap() }` with the reInit payload, and the payload wins. A `startIndex` left in every reInit would teleport the carousel back to this prop's value on every option flip. To move programmatically after mount, use the `scrollToIndex()` handle verb, or write the two-way `selectedIndex` model. |
| `skipSnaps` | `Boolean` | `false` | ✓ | Allow a fast flick to skip intermediate snaps. |
| `duration` | `Number` | `25` | ✓ | Scroll transition duration (Embla's relative unit). |
| `direction` | `String` | `"ltr"` | ✓ | Text/scroll direction — `'ltr' \| 'rtl'`. |
| `autoplay` | `Boolean` | `false` | ✓ | Toggle the `embla-carousel-autoplay` plugin. |
| `autoplayDelay` | `Number` | `4000` | ✓ | Autoplay delay between snaps (ms). |
| `dots` | `Boolean` | `false` | ✓ | Show built-in dot pagination (one dot per scroll snap). |
| `arrows` | `Boolean` | `false` | ✓ | Show built-in prev/next arrow buttons overlaid on the viewport. |
| `thumbnails` | `Boolean` | `false` | ✓ | Show a synced thumbnail strip (its own Embla instance); fill the `thumb` slot for custom thumbs. Runtime-updatable — toggling it live builds/tears down the strip's own Embla instance. |
| `plugins` | `Array` | `[]` | | Escape hatch — extra Embla plugins appended verbatim. **Init-only** — the plugin set is rebuilt only when `autoplay` or `autoplayDelay` changes, not when this array's contents change. |
| `options` | `Object` | `{}` | | Escape hatch — raw `EmblaOptionsType` spread last. **Init-only** — read when a reInit is triggered by one of the watched props above, not when this object itself changes. |
| `selectedIndex` | `Number` | `0` | ✓ | **Two-way** — the current scroll-snap index. Distinct from the `select` emit. |

**17 of the 20 props above are runtime-updatable** — changing one `$watch`-triggers `embla.reInit()` (Embla has no per-option setter; reInit is the only update path). The three exceptions are **init-only**: `startIndex` (structural — see its row; watching it would defeat the position-preservation fix), `plugins`, and `options`. Neither `plugins` nor `options` is watched **by design**: both are reference-typed escape hatches, so an identity watch would fire on every fresh literal a consumer passes (a full `reInit` per render), and Solid's/Angular's declarative-reactivity limits would make the failure target-asymmetric on top of that. If you need either to change after mount, remount the component (a `:key` change) or drive the equivalent curated prop instead.

### Events

| Event | Payload | Description |
| --- | --- | --- |
| `select` | `index: number` | Fires on every snap change (drag, scroll, or programmatic). |
| `settle` | — | Fires when carousel motion stops. |
| `reInit` | — | Fires when the engine re-initialises (option/slide change). |
| `pointer-down` | — | Fires when a pointer drag begins. |

### Imperative handle

Build prev/next/dots controls off the `$expose` handle (there is no `#controls` slot — the imperative surface exposes everything). Grab the handle with your framework's native ref mechanism:

| Method | Description |
| --- | --- |
| `scrollNext(jump?)` | Scroll to the next snap. |
| `scrollPrev(jump?)` | Scroll to the previous snap. |
| `scrollToIndex(index, jump?)` | Scroll to a specific snap index. Named to avoid the inherited DOM `HTMLElement.scrollTo`. |
| `reInitCarousel(opts?)` | Re-initialise the engine, **preserving the current snap** — call with no args to recompute snaps (e.g. after a layout change) without losing position. Pass raw `EmblaOptionsType` to override the prop-derived options instead. Named to avoid the `reInit` emit. |
| `canScrollNext()` | Whether a next snap is reachable. |
| `canScrollPrev()` | Whether a previous snap is reachable. |
| `getSelectedIndex()` | The current snap index. Named to avoid the `selectedIndex` model prop. |
| `scrollSnapList()` | The snap-point progress array. |
| `scrollProgress()` | The overall scroll progress in `[0, 1]`, for a custom progress bar or scrollbar thumb. |
| `slidesInView()` | Indices of slides currently in view — for lazy-loading or highlighting in-view dots. |
| `slidesNotInView()` | Indices of slides currently out of view — to unload heavy off-screen content. |
| `previousScrollSnap()` | The previously selected snap index, to compute transition direction. |
| `getPlugins()` | The live plugin API map (e.g. `getPlugins().autoplay?.play()/.stop()`) for imperative autoplay control. Named to avoid the `plugins` prop. |
| `getInstance()` | The underlying `EmblaCarouselType` instance (engine escape hatch). |

```vue
<script setup>
import { ref } from 'vue';
const carousel = ref();
</script>

<template>
  <Carousel ref="carousel" :slides="['A', 'B', 'C']" />
  <button @click="carousel.scrollPrev()">Prev</button>
  <button @click="carousel.scrollNext()">Next</button>
</template>
```

## Slots

Three slots: a scoped `slide` slot (config-array mode custom markup), a scoped `thumb` slot (custom thumbnail content), and the default slot (declarative mode — see [Quick start](#quick-start)). Both scoped slots receive `{ slide, index }`. Per-framework consumer syntax, read off the emitted leaves rather than assumed:

| Framework | `slide` (scoped) | default |
| --- | --- | --- |
| React | `renderSlide={({ slide, index }) => …}` (also `renderThumb` for the `thumb` slot) | `children` |
| Vue | `<template #slide="{ slide, index }">…</template>` | default slot |
| Svelte | `{#snippet slide({ slide, index })}…{/snippet}` passed as the `slide` prop | children snippet |
| Angular | `<ng-template #slide let-slide="slide" let-index="index">…</ng-template>` | content projection |
| Solid | `slideSlot={({ slide, index }) => …}` (also `thumbSlot` for the `thumb` slot) | `children` |
| Lit | set the `.slide` property to a render function: ``el.slide = ({ slide, index }) => html`…`;`` | default slot (native `<slot>`) |

::: tip Lit: how raw `slot="slide"` children distribute
`Carousel.rozie` renders `<slot name="slide">` **inside an `r-for`**, so Lit's shadow root ends up with N same-named `<slot name="slide">` elements (one per config-array slide). Native web-components slot assignment has no per-iteration identity — the browser would send **all** matching `slot="slide"` children to the **first** slot in tree order. The Lit leaf therefore ships with manual slot distribution (`slotAssignment: 'manual'` + a `RozieSlotDistributor` controller): light-DOM children carrying `slot="slide"` are assigned **one per iteration in document order** (the i-th child to the i-th slide, extras to the last), and redistribution tracks child adds/removes and `slot`-attribute changes automatically. Note that statically slotted children still cannot receive the scoped `{ slide, index }` params — that is inherent to web-components slots — so for content derived from per-slide data, use the **property function** (``el.slide = (ctx) => html`…`;``) shown above, which is what the live demo does.
:::

## Autoplay

Set `autoplay` to mount the Autoplay plugin; `autoplayDelay` controls the interval. Toggling either at runtime rebuilds the plugin set via `reInit(options, plugins)`. For any other Embla plugin (Fade, Class Names, Wheel Gestures, …), pass it through the `:plugins` escape-hatch array.

## Theming

Every value the component renders is a `--rozie-embla-*` CSS custom property with a built-in inline `var(token, fallback)` default, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope. As a shortcut, overriding just `--rozie-embla-accent` shifts every "selected/active" affordance at once — the arrow foreground, the selected dot background, and the selected thumb border color all fall back to it.

```css
.rozie-embla {
  --rozie-embla-accent: #16a34a;
  --rozie-embla-arrow-bg: #0b1220;
  --rozie-embla-arrow-radius: 8px;
  --rozie-embla-dot-selected-scale: 1.4;
  --rozie-embla-thumb-selected-border-color: #16a34a;
}
```

### Design-system bridges

Each package ships token presets that map the embla tokens onto a known design system's published CSS variables — so the carousel automatically follows that system's light/dark theme and accent:

```ts
import '@rozie-ui/embla-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --background/--primary/--ring…
import '@rozie-ui/embla-react/themes/material.css';  // Material 3 — reads --md-sys-color-*
import '@rozie-ui/embla-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-*
import '@rozie-ui/embla-react/themes/base.css';      // the documented default token set
```

Swap `-react` for your target framework's package. The embla presets are **colors-only** — they remap the color/accent tokens onto each design system's variables and leave the arrow/dot/thumb *sizing* tokens at their component defaults.

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/src/themes/base.css).

## See also

- [Embla — live demo](/components/embla-demo) — the real `@rozie-ui/embla-vue` package running in the page, plus the generated output for each target.
- [Embla libraries comparison](/components/embla-comparison) — how `@rozie-ui/embla` stacks up against `embla-carousel-{react,vue,svelte,solid}`, the Angular community wrapper, and the (absent) Lit story.
- [`Carousel.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/src/Carousel.rozie)
