# Embla — the cross-framework carousel

[Embla Carousel](https://www.embla-carousel.com) is a dependency-free, library-agnostic carousel engine: its core is pure vanilla JS that attaches to a viewport element, reads the consumer's slide DOM, and drives `transform: translate3d(...)` for buttery drag/scroll. But its framework wrappers are **uneven**: React, Vue, Svelte and Solid have official wrappers — but they are **four divergent APIs** (a hook vs a composable vs an action vs a Solid primitive); Angular has only a **single-maintainer community** package version-pinned to Angular majors; and **Lit / web components have nothing at all**.

One `Carousel.rozie` source compiles to six idiomatic packages — so all six frameworks get the *same* props, events, two-way `selectedIndex`, and imperative handle. Lit consumers get a category-leading Embla wrapper for free; Angular gets a first-party-quality signals wrapper from the same source as the other five.

The full source for `Carousel.rozie` lives in the [`@rozie-ui/embla` package](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/src/Carousel.rozie). See it running in the [live demo](/components/embla-demo), and how it stacks up against the per-framework wrappers in the [libraries comparison](/components/embla-comparison).

## The `@rozie-ui/embla` packages

| Package | Framework | Ships |
| --- | --- | --- |
| `@rozie-ui/embla-react` | React 18+ | compiled `.tsx` + types |
| `@rozie-ui/embla-vue` | Vue 3.4+ | `.vue` SFC source |
| `@rozie-ui/embla-svelte` | Svelte 5+ | `.svelte` source |
| `@rozie-ui/embla-angular` | Angular 19+ | standalone component source |
| `@rozie-ui/embla-solid` | Solid 1.8+ | compiled `.tsx` + types |
| `@rozie-ui/embla-lit` | Lit 3+ | compiled custom element + types |

All six wrap **Embla Carousel v8** (`embla-carousel@^8.6`) plus the **Autoplay plugin** (`embla-carousel-autoplay@^8.6`), both declared as peer dependencies. (Embla v9 is RC-only and renames the whole API surface — it is deliberately not targeted yet.)

## Install

Install the one package for your framework plus the two Embla peer dependencies — no Rozie toolchain, no build-time compile step:

```bash
# React (also: react-dom)
npm i @rozie-ui/embla-react embla-carousel embla-carousel-autoplay
# Vue
npm i @rozie-ui/embla-vue embla-carousel embla-carousel-autoplay
# Svelte / Angular / Solid / Lit — swap the framework package
npm i @rozie-ui/embla-svelte embla-carousel embla-carousel-autoplay
```

There is **no engine CSS to import** — Embla's carousel skeleton ships scoped inside the component (see the tip above).

::: tip No engine CSS to import
Unlike most engine wrappers, Embla ships **no** stylesheet you must import. The carousel skeleton styles — an `overflow: hidden` viewport, a `display: flex` container, and slide sizing — ship **scoped inside the component**. Slides are plain light-DOM framework children, so the scoped styles reach them on all six targets (including through Lit's shadow root).
:::

## Quick start

There are **two slide-source modes** from one component:

- **Config array** — pass `:slides="[...]"` and Rozie renders one slide per item (optionally via the scoped `slide` slot for custom markup).
- **Declarative** — drop `<div class="rozie-embla__slide">…</div>` children into the default slot; Embla's native `watchSlides` reacts to adds/removes.

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
| `startIndex` | `Number` | `0` | ✓ | Initial snap index. |
| `skipSnaps` | `Boolean` | `false` | ✓ | Allow a fast flick to skip intermediate snaps. |
| `duration` | `Number` | `25` | ✓ | Scroll transition duration (Embla's relative unit). |
| `direction` | `String` | `"ltr"` | ✓ | Text/scroll direction — `'ltr' \| 'rtl'`. |
| `autoplay` | `Boolean` | `false` | ✓ | Toggle the `embla-carousel-autoplay` plugin. |
| `autoplayDelay` | `Number` | `4000` | ✓ | Autoplay delay between snaps (ms). |
| `dots` | `Boolean` | `false` | ✓ | Show built-in dot pagination (one dot per scroll snap). |
| `arrows` | `Boolean` | `false` | ✓ | Show built-in prev/next arrow buttons overlaid on the viewport. |
| `thumbnails` | `Boolean` | `false` | ✓ | Show a synced thumbnail strip (its own Embla instance); fill the `thumb` slot for custom thumbs. |
| `plugins` | `Array` | `[]` | ✓ | Escape hatch — extra Embla plugins appended verbatim. |
| `options` | `Object` | `{}` | ✓ | Escape hatch — raw `EmblaOptionsType` spread last. |
| `selectedIndex` | `Number` | `0` | ✓ | **Two-way** — the current scroll-snap index. Distinct from the `select` emit. |

Every option prop is runtime-updatable: changing it `$watch`-triggers `embla.reInit()` (Embla has no per-option setter; reInit is the only update path).

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
| `reInitCarousel(opts?)` | Re-initialise the engine (recompute snaps). Named to avoid the `reInit` emit. |
| `canScrollNext()` | Whether a next snap is reachable. |
| `canScrollPrev()` | Whether a previous snap is reachable. |
| `getSelectedIndex()` | The current snap index. Named to avoid the `selectedIndex` model prop. |
| `scrollSnapList()` | The snap-point progress array. |
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

- [Embla — live demo](/components/embla-demo) — the real `@rozie-ui/embla-vue` package running in the page, plus the generated output for all six targets.
- [Embla libraries comparison](/components/embla-comparison) — how `@rozie-ui/embla` stacks up against `embla-carousel-{react,vue,svelte,solid}`, the Angular community wrapper, and the (absent) Lit story.
- [`Carousel.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/embla/src/Carousel.rozie)
