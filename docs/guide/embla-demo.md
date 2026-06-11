---
title: Embla — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import Carousel from '@rozie-ui/embla-vue';

const carousel = ref();
const index = ref(0);

const SLIDES = [
  { label: 'One',   color: '#0a84ff' },
  { label: 'Two',   color: '#34a853' },
  { label: 'Three', color: '#e8714a' },
  { label: 'Four',  color: '#a142f4' },
  { label: 'Five',  color: '#fbbc05' },
];
</script>

# Embla — live demo

This is the **real `@rozie-ui/embla-vue` package** running on this page (VitePress is itself a Vue app). Drag the carousel, use the prev/next buttons, jump to a dot — then watch the bound index update. Everything below is driven by the same `Carousel.rozie` source that compiles to all six frameworks.

<ClientOnly>
<div class="embla-live">
  <div class="embla-live__controls">
    <button @click="carousel?.scrollPrev()">‹ Prev</button>
    <button @click="carousel?.scrollNext()">Next ›</button>
    <span class="embla-live__sep" />
    <button v-for="(s, i) in SLIDES" :key="i" :class="{ 'embla-live__dot--active': index === i }" class="embla-live__dot" @click="carousel?.scrollToIndex(i)">{{ i + 1 }}</button>
    <span class="embla-live__sep" />
    <code class="embla-live__readout">selectedIndex: {{ index }}</code>
  </div>

  <div class="embla-live__stage">
    <Carousel
      ref="carousel"
      v-model:selectedIndex="index"
      :slides="SLIDES"
      :loop="true"
    >
      <template #slide="{ slide }">
        <div class="embla-live__slide" :style="{ background: slide.color }">{{ slide.label }}</div>
      </template>
    </Carousel>
  </div>
</div>
</ClientOnly>

The snap index is two-way bound with `v-model:selectedIndex` — the readout updates live as you drag or scroll, and the buttons drive the imperative handle (`scrollPrev`, `scrollNext`, `scrollToIndex`). Dragging the carousel writes the new index back through the model; clicking a dot writes the index in and scrolls the carousel — round-trip, echo-guarded. See the [full API](/guide/embla) for the complete prop/event/handle surface.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/embla/src/Carousel.rozie{html}[Carousel.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/embla-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/embla/packages/react/src/Carousel.tsx[React]
<<< ../../packages/ui/embla/packages/vue/src/Carousel.vue[Vue]
<<< ../../packages/ui/embla/packages/svelte/src/Carousel.svelte[Svelte]
<<< ../../packages/ui/embla/packages/angular/src/Carousel.ts[Angular]
<<< ../../packages/ui/embla/packages/solid/src/Carousel.tsx[Solid]
<<< ../../packages/ui/embla/packages/lit/src/Carousel.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Same props, same events, same two-way `selectedIndex`, same imperative handle, all from the one source above.

## See also

- [Embla — showcase & API](/guide/embla) — install, quick starts for all six frameworks, and the full reference.
- [Embla libraries comparison](/guide/embla-comparison) — how `@rozie-ui/embla` stacks up against the per-framework wrappers.

<style scoped>
.embla-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.embla-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.embla-live__controls button {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.embla-live__controls button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.embla-live__dot {
  min-width: 2rem;
}
.embla-live__dot--active {
  background: var(--vp-c-brand-1) !important;
  border-color: var(--vp-c-brand-1) !important;
  color: #fff !important;
}
.embla-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.embla-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  overflow: hidden;
}
.embla-live__readout {
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
.embla-live__slide {
  flex: 0 0 100%;
  min-width: 0;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
}
</style>
