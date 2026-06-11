# @rozie-ui/embla-vue

Idiomatic **vue** `Carousel` — a cross-framework carousel compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [Embla Carousel](https://www.embla-carousel.com) (v8). The current snap is two-way bound via `selectedIndex`; slides come as a `slides` config array or as default-slot DOM. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/embla-vue
```

Peer dependencies: the `embla-carousel` (`^8.6`) + `embla-carousel-autoplay` (`^8.6`) engine packages + `vue`. Install them alongside this package.

No engine CSS to import — the carousel skeleton styles (`overflow: hidden` viewport, flex container, slide sizing) ship scoped inside the component.

## Usage

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

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `slides` | `Array` | `[]` |  |  |
| `loop` | `Boolean` | `false` |  |  |
| `align` | `String` | `"center"` |  |  |
| `axis` | `String` | `"x"` |  |  |
| `slidesToScroll` | `Number` | `1` |  |  |
| `dragFree` | `Boolean` | `false` |  |  |
| `draggable` | `Boolean` | `true` |  |  |
| `containScroll` | `String` | `"trimSnaps"` |  |  |
| `startIndex` | `Number` | `0` |  |  |
| `skipSnaps` | `Boolean` | `false` |  |  |
| `duration` | `Number` | `25` |  |  |
| `direction` | `String` | `"ltr"` |  |  |
| `autoplay` | `Boolean` | `false` |  |  |
| `autoplayDelay` | `Number` | `4000` |  |  |
| `plugins` | `Array` | `[]` |  |  |
| `options` | `Object` | `{}` |  |  |
| `selectedIndex` | `Number` | `0` | ✓ |  |

## Events

| Event | Description |
| --- | --- |
| `select` | |
| `settle` | |
| `reInit` | |
| `pointer-down` | |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```vue
<script setup>
import { ref } from 'vue';
const carousel = ref();      // template ref
</script>

<template>
  <Carousel ref="carousel" ... />
  <button @click="carousel.scrollNext()">Next</button>
</template>
```

| Method | Description |
| --- | --- |
| `scrollNext` | Scroll to the next snap — `scrollNext(jump?)` (jump skips the transition). No-op before mount. |
| `scrollPrev` | Scroll to the previous snap — `scrollPrev(jump?)`. No-op before mount. |
| `scrollToIndex` | Scroll to a specific snap index — `scrollToIndex(index, jump?)` (Embla `scrollTo`). Named to avoid the inherited DOM `HTMLElement.scrollTo(x, y)`. No-op before mount. |
| `reInitCarousel` | Re-initialise the Embla engine (recompute snaps) — `reInitCarousel(opts?)`. Pass raw EmblaOptionsType to override; omit to re-apply the current prop-derived options. (NOT `reInit`, which is the emitted event.) |
| `canScrollNext` | Return whether a next snap is reachable — `canScrollNext()`. False before mount. |
| `canScrollPrev` | Return whether a previous snap is reachable — `canScrollPrev()`. False before mount. |
| `getSelectedIndex` | Return the current scroll-snap index — `getSelectedIndex()` (Embla `selectedScrollSnap()`). 0 before mount. (NOT `selectedIndex`, which is the two-way model prop.) |
| `scrollSnapList` | Return the snap-point progress array — `scrollSnapList()` (numbers in [0, 1]). Empty before mount. |
| `getInstance` | Return the underlying EmblaCarouselType instance for direct API access (the engine escape hatch). Null before mount. |

## Slots

| Slot | Params |
| --- | --- |
| slide | slide, index |
| (default) |  |
