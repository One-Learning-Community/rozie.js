---
title: Cropper — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import Cropper from '@rozie-ui/cropper-vue';
import 'cropperjs/dist/cropper.css';

// A self-contained SVG data URL — network-free (so the demo works offline and in
// CI) AND same-origin/untainted, so `getCroppedCanvas().toDataURL()` (the Export
// button) works without cross-origin canvas taint.
const SAMPLE =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0ODAnIGhlaWdodD0nMzYwJz48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9J3NreScgeDE9JzAnIHkxPScwJyB4Mj0nMCcgeTI9JzEnPjxzdG9wIG9mZnNldD0nMCcgc3RvcC1jb2xvcj0nIzRhOTBkOScvPjxzdG9wIG9mZnNldD0nMScgc3RvcC1jb2xvcj0nI2JmZTBmNScvPjwvbGluZWFyR3JhZGllbnQ+PGxpbmVhckdyYWRpZW50IGlkPSdoaWxsJyB4MT0nMCcgeTE9JzAnIHgyPScwJyB5Mj0nMSc+PHN0b3Agb2Zmc2V0PScwJyBzdG9wLWNvbG9yPScjNWFhNDY5Jy8+PHN0b3Agb2Zmc2V0PScxJyBzdG9wLWNvbG9yPScjMmY2YjQwJy8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9JzQ4MCcgaGVpZ2h0PSczNjAnIGZpbGw9J3VybCgjc2t5KScvPjxjaXJjbGUgY3g9JzM4MCcgY3k9JzgwJyByPSc0MicgZmlsbD0nI2ZmZDI0YScvPjxwYXRoIGQ9J00wIDI1MCBRMTIwIDE4MCAyNDAgMjQwIFQ0ODAgMjMwIFYzNjAgSDAgWicgZmlsbD0ndXJsKCNoaWxsKScvPjxwYXRoIGQ9J00wIDMwMCBRMTYwIDI1MCAzMjAgMzAwIFQ0ODAgMjkwIFYzNjAgSDAgWicgZmlsbD0nIzI2NGYzMCcgb3BhY2l0eT0nMC44NScvPjxwb2x5Z29uIHBvaW50cz0nMTEwLDI1MCAxNTAsMTcwIDE5MCwyNTAnIGZpbGw9JyM2YjdkOGMnLz48cG9seWdvbiBwb2ludHM9JzE1MCwxNzAgMTY1LDIwMCAxMzUsMjAwJyBmaWxsPScjZWVmM2Y3Jy8+PC9zdmc+';

const cropper = ref();
const box = ref<any>(null);
const out = ref('');

const exportCrop = () => { out.value = cropper.value?.getCroppedDataURL() ?? ''; };
</script>

# Cropper — live demo

This is the **real `@rozie-ui/cropper-vue` package** running on this page (VitePress is itself a Vue app). Drag the crop box, resize it, use the controls — then **Export** to see the cropped result. Everything below is driven by the same `Cropper.rozie` source that compiles to all six frameworks.

<ClientOnly>
<div class="cropper-live">
  <div class="cropper-live__controls">
    <button @click="cropper?.setAspectRatio(NaN)">Free</button>
    <button @click="cropper?.setAspectRatio(1)">1:1</button>
    <button @click="cropper?.setAspectRatio(16/9)">16:9</button>
    <button @click="cropper?.setAspectRatio(4/3)">4:3</button>
    <span class="cropper-live__sep" />
    <button @click="cropper?.rotateBy(-90)">⟲ Rotate</button>
    <button @click="cropper?.rotateBy(90)">Rotate ⟳</button>
    <button @click="cropper?.scaleX(cropper.getData().scaleX === 1 ? -1 : 1)">Flip H</button>
    <button @click="cropper?.scaleY(cropper.getData().scaleY === 1 ? -1 : 1)">Flip V</button>
    <span class="cropper-live__sep" />
    <button @click="cropper?.reset()">Reset</button>
    <button class="cropper-live__primary" @click="exportCrop">Export ▸</button>
  </div>

  <div class="cropper-live__stage">
    <Cropper
      ref="cropper"
      :src="SAMPLE"
      v-model:data="box"
      :view-mode="1"
      :aspect-ratio="16/9"
      style="width: 100%; height: 340px;"
    />
  </div>

  <div class="cropper-live__readout">
    <code v-if="box">x {{ Math.round(box.x) }} · y {{ Math.round(box.y) }} · {{ Math.round(box.width) }}×{{ Math.round(box.height) }} · rotate {{ box.rotate }}°</code>
  </div>

  <div v-if="out" class="cropper-live__output">
    <strong>Cropped output</strong>
    <img :src="out" alt="cropped result" />
  </div>
</div>
</ClientOnly>

The crop box is two-way bound with `v-model:data` — the readout above updates live as you drag, and the buttons drive the imperative handle (`setAspectRatio`, `rotateBy`, `scaleX`/`scaleY`, `reset`, `getCroppedDataURL`). See the [full API](/guide/cropper) for the complete prop/event/handle surface.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/cropper/src/Cropper.rozie{html}[Cropper.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/cropper-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/cropper/packages/react/src/Cropper.tsx[React]
<<< ../../packages/ui/cropper/packages/vue/src/Cropper.vue[Vue]
<<< ../../packages/ui/cropper/packages/svelte/src/Cropper.svelte[Svelte]
<<< ../../packages/ui/cropper/packages/angular/src/Cropper.ts[Angular]
<<< ../../packages/ui/cropper/packages/solid/src/Cropper.tsx[Solid]
<<< ../../packages/ui/cropper/packages/lit/src/Cropper.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component with a `ControlValueAccessor`, a Solid component, and a Lit custom element. Same props, same events, same imperative handle, all from the one source above.

## See also

- [Cropper — showcase & API](/guide/cropper) — install, quick starts for all six frameworks, and the full reference.
- [Cropper libraries comparison](/guide/cropper-comparison) — how `@rozie-ui/cropper` stacks up against the per-framework wrappers.

<style scoped>
.cropper-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.cropper-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.cropper-live__controls button {
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
.cropper-live__controls button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.cropper-live__controls button.cropper-live__primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
}
.cropper-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.cropper-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  overflow: hidden;
}
.cropper-live__readout {
  min-height: 1.4rem;
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
.cropper-live__output {
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--vp-c-divider);
}
.cropper-live__output img {
  display: block;
  margin-top: 0.5rem;
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
}
</style>
