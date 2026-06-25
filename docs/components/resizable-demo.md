---
title: Resizable — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import Resizable from '@rozie-ui/resizable-vue';

const split = ref(35);
const vsplit = ref(40);
const lastResize = ref<number | null>(null);

const box = ref();

function onResize(e: { size: number }) {
  lastResize.value = Math.round(e.size);
}
</script>

# Resizable — live demo

This is the **real `@rozie-ui/resizable-vue` package** running on this page (VitePress is itself a Vue app). Drag the handle between the panels, or focus it (`Tab`) and use the Arrow keys / `Home` / `End` — then watch the two-way bound `size` percent update and the `@resize` readout fire. Everything below is driven by the same `Resizable.rozie` source that compiles to all six frameworks, built on native Pointer Events with **no engine and no required CSS** — the drag behaviour and a tokenised skin all ship inside the component.

<ClientOnly>
<div class="rz-live">

  <div class="rz-live__cell">
    <div class="rz-live__head">
      <strong>Horizontal</strong>
      <span class="rz-live__sep" />
      <button @click="box?.reset()">reset()</button>
      <button @click="box?.applySize(25)">applySize(25)</button>
    </div>
    <div class="rz-live__stage">
      <Resizable ref="box" v-model:size="split" :min="15" :max="85" direction="horizontal" @resize="onResize">
        <template #start><div class="rz-pane rz-pane--a">start ({{ Math.round(split) }}%)</div></template>
        <template #end><div class="rz-pane rz-pane--b">end</div></template>
      </Resizable>
    </div>
    <code class="rz-live__readout">size: {{ Math.round(split) }}% · last @resize: {{ lastResize === null ? '—' : lastResize + '%' }}</code>
  </div>

  <div class="rz-live__cell">
    <div class="rz-live__head"><strong>Vertical</strong> <span class="rz-live__muted">— stacked, Arrow ↑/↓</span></div>
    <div class="rz-live__stage">
      <Resizable v-model:size="vsplit" :min="20" :max="80" direction="vertical">
        <template #start><div class="rz-pane rz-pane--a">top ({{ Math.round(vsplit) }}%)</div></template>
        <template #end><div class="rz-pane rz-pane--b">bottom</div></template>
      </Resizable>
    </div>
    <code class="rz-live__readout">size: {{ Math.round(vsplit) }}%</code>
  </div>

</div>
</ClientOnly>

`size` is two-way bound with `v-model:size` — the readout updates the instant you drag, and a consumer write (the `reset()` / `applySize()` buttons, grabbed through Vue's `ref`) flows back in. Set `direction` to `'horizontal'` / `'vertical'`, clamp the range with `:min` / `:max`, and listen to `@resize` for every committed change. See the [full API](/components/resizable-api) for every prop, event, handle verb, and slot, plus theming and keyboard reference.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/resizable/src/Resizable.rozie{html}[Resizable.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/resizable-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/resizable/packages/react/src/Resizable.tsx[React]
<<< ../../packages/ui/resizable/packages/vue/src/Resizable.vue[Vue]
<<< ../../packages/ui/resizable/packages/svelte/src/Resizable.svelte[Svelte]
<<< ../../packages/ui/resizable/packages/angular/src/Resizable.ts[Angular]
<<< ../../packages/ui/resizable/packages/solid/src/Resizable.tsx[Solid]
<<< ../../packages/ui/resizable/packages/lit/src/Resizable.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component (with `ControlValueAccessor`), a Solid component, and a Lit custom element. Same props, same `resize` event, same two-way `size`, same imperative handle, same slots — all from the one source above, built on native Pointer Events with no third-party engine behind it.

## See also

- [Resizable — showcase & API](/components/resizable) — install, quick start, theming, keyboard, and the full reference.
- [Headless split-pane comparison](/components/resizable-comparison) — how `@rozie-ui/resizable` stacks up against react-resizable-panels, splitpanes, and the per-framework split-pane libraries.

<style scoped>
.rz-live {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
  padding: 1.25rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.rz-live__cell {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.rz-live__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.rz-live__muted {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.rz-live__head button {
  font: inherit;
  font-size: 0.78rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.rz-live__head button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.rz-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.2rem;
  background: var(--vp-c-divider);
}
.rz-live__stage {
  height: 200px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}
.rz-pane {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
.rz-pane--a { background: var(--vp-c-bg); }
.rz-pane--b { background: var(--vp-c-bg-alt); }
.rz-live__readout {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  word-break: break-all;
}
</style>
