---
title: Waveform — live demo
---

<script setup lang="ts">
import { ref, computed } from 'vue';
import Waveform from '@rozie-ui/wavesurfer-vue';

// A self-contained tone WAV generated at load — network-free (works offline and
// in CI) and same-origin, so playback needs no external asset. Deterministic:
// no Date.now()/Math.random().
function makeToneWav(seconds: number, sampleRate: number): string {
  const n = Math.floor(seconds * sampleRate);
  const dataLen = n * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(buf);
  const w = (off: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); w(8, 'WAVE');
  w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = 0.4 + 0.3 * Math.sin(t * 2.7) + 0.2 * Math.sin(t * 0.6);
    const s = (env * (Math.sin(2 * Math.PI * 220 * t) + 0.5 * Math.sin(2 * Math.PI * 440 * t))) / 1.6;
    const v = Math.max(-1, Math.min(1, s));
    dv.setInt16(44 + i * 2, v * 32767, true);
  }
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

const SAMPLE = makeToneWav(6, 8000);

const wave = ref<any>();
const time = ref(0);
const duration = ref(0);
const rate = ref(1);
const zoom = ref(1);
const regions = ref<any[]>([
  { id: 'intro', start: 0.5, end: 1.8, color: 'rgba(138,43,226,0.22)' },
  { id: 'hook', start: 3, end: 4.2, color: 'rgba(90,24,154,0.28)' },
]);
let regionSeq = 0;
const addRegion = () => {
  const start = 1 + (regionSeq % 4);
  regionSeq++;
  wave.value?.addRegion({ start, end: start + 0.8, color: 'rgba(45,212,191,0.28)' });
};
const clearRegions = () => wave.value?.clearRegions();

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pct = computed(() => (duration.value ? Math.round((time.value / duration.value) * 100) : 0));

const setRate = (r: number) => { rate.value = r; wave.value?.setPlaybackRate(r); };
const onZoom = (e: Event) => { const v = Number((e.target as HTMLInputElement).value); zoom.value = v; wave.value?.setZoom(v); };
</script>

# Waveform — live demo

This is the **real `@rozie-ui/wavesurfer-vue` package** running on this page (VitePress is itself a Vue app). The audio is a tone synthesized in-browser — no network needed. Press play, drag to seek, zoom, change speed. Everything below is driven by the same `Waveform.rozie` source that compiles to all six frameworks.

<ClientOnly>
<div class="wave-live">
  <div class="wave-live__controls">
    <button class="wave-live__primary" @click="wave?.playPause()">Play / Pause</button>
    <button @click="wave?.stop()">Stop</button>
    <span class="wave-live__sep" />
    <button :class="{ 'wave-live__on': rate === 0.5 }" @click="setRate(0.5)">0.5×</button>
    <button :class="{ 'wave-live__on': rate === 1 }" @click="setRate(1)">1×</button>
    <button :class="{ 'wave-live__on': rate === 2 }" @click="setRate(2)">2×</button>
    <span class="wave-live__sep" />
    <label class="wave-live__zoom">Zoom <input type="range" min="1" max="120" :value="zoom" @input="onZoom" /></label>
    <span class="wave-live__sep" />
    <button @click="addRegion">+ Region</button>
    <button @click="clearRegions">Clear regions</button>
  </div>

  <div class="wave-live__stage">
    <Waveform
      ref="wave"
      :src="SAMPLE"
      v-model:currentTime="time"
      v-model:regions="regions"
      :timeline="true"
      :hover="true"
      :drag-to-create-regions="true"
      region-color="rgba(138,43,226,0.2)"
      wave-color="#8a2be2"
      progress-color="#5a189a"
      :bar-width="2"
      :bar-gap="1"
      :bar-radius="2"
      @ready="(d) => (duration = d)"
    />
  </div>

  <div class="wave-live__readout">
    <code>{{ fmt(time) }} / {{ fmt(duration) }} · {{ pct }}% · {{ regions.length }} region(s)</code>
  </div>
  <div class="wave-live__hint">Drag on empty waveform space to draw a region · drag/resize to adjust · they stay in sync with the two-way <code>v-model:regions</code>.</div>
</div>
</ClientOnly>

The playback position is two-way bound with `v-model:currentTime` — the readout updates live as it plays, and the buttons drive the imperative handle (`playPause`, `stop`, `setPlaybackRate`, `setZoom`). See the [full API](/components/wavesurfer) for the complete prop/event/handle surface.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/wavesurfer/src/Waveform.rozie{html}[Waveform.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (exactly what ships in `@rozie-ui/wavesurfer-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/wavesurfer/packages/react/src/Waveform.tsx[React]
<<< ../../packages/ui/wavesurfer/packages/vue/src/Waveform.vue[Vue]
<<< ../../packages/ui/wavesurfer/packages/svelte/src/Waveform.svelte[Svelte]
<<< ../../packages/ui/wavesurfer/packages/angular/src/Waveform.ts[Angular]
<<< ../../packages/ui/wavesurfer/packages/solid/src/Waveform.tsx[Solid]
<<< ../../packages/ui/wavesurfer/packages/lit/src/Waveform.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Same props, same events, same imperative handle, all from the one source above.

## See also

- [Waveform — showcase & API](/components/wavesurfer) — install, quick starts for all six frameworks, and the full reference.
- [wavesurfer libraries comparison](/components/wavesurfer-comparison) — how `@rozie-ui/wavesurfer` stacks up against the per-framework wrappers.

<style scoped>
.wave-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.wave-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.wave-live__controls button {
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
.wave-live__controls button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.wave-live__controls button.wave-live__primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
}
.wave-live__controls button.wave-live__on {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.wave-live__zoom {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
.wave-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.wave-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  padding: 0.75rem;
}
.wave-live__readout {
  min-height: 1.4rem;
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
.wave-live__hint {
  margin-top: 0.3rem;
  font-size: 0.76rem;
  color: var(--vp-c-text-3);
}
</style>
