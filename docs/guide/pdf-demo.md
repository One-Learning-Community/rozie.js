---
title: PdfViewer — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import PdfViewer from '@rozie-ui/pdf-vue';

// Bundle the PDF.js worker locally via Vite's `new URL(...)` so the demo needs no
// CDN for the worker (the recommended override for bundler setups — the prop
// otherwise defaults to a CDN copy).
const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// A self-contained 3-page PDF (base64 data URL) — network-free, so the demo works
// offline / in CI.
const SAMPLE =
  'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbNCAwIFIgNSAwIFIgNiAwIFJdL0NvdW50IDM+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKNCAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXS9SZXNvdXJjZXM8PC9Gb250PDwvRjEgMyAwIFI+Pj4+L0NvbnRlbnRzIDcgMCBSPj4KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0vUmVzb3VyY2VzPDwvRm9udDw8L0YxIDMgMCBSPj4+Pi9Db250ZW50cyA4IDAgUj4+CmVuZG9iago2IDAgb2JqCjw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSAzIDAgUj4+Pj4vQ29udGVudHMgOSAwIFI+PgplbmRvYmoKNyAwIG9iago8PC9MZW5ndGggMTI3Pj4Kc3RyZWFtCkJUIC9GMSAyOCBUZiA2MCA3MDAgVGQgKFJvemllIFBERiB2aWV3ZXIgIC0gIHBhZ2UgMSkgVGogMCAtNDAgVGQgL0YxIDE0IFRmIChUaGUgcXVpY2sgYnJvd24gZm94IGp1bXBzIG92ZXIgdGhlIGxhenkgZG9nLikgVGogRVQKZW5kc3RyZWFtCmVuZG9iago4IDAgb2JqCjw8L0xlbmd0aCAxMzc+PgpzdHJlYW0KQlQgL0YxIDI4IFRmIDYwIDcwMCBUZCAoT25lIHNvdXJjZSwgc2l4IGZyYW1ld29ya3MgIC0gIHBhZ2UgMikgVGogMCAtNDAgVGQgL0YxIDE0IFRmIChUaGUgcXVpY2sgYnJvd24gZm94IGp1bXBzIG92ZXIgdGhlIGxhenkgZG9nLikgVGogRVQKZW5kc3RyZWFtCmVuZG9iago5IDAgb2JqCjw8L0xlbmd0aCAxNDU+PgpzdHJlYW0KQlQgL0YxIDI4IFRmIDYwIDcwMCBUZCAoU2VsZWN0YWJsZSB0ZXh0IHZpYSB0aGUgdGV4dCBsYXllciAgLSAgcGFnZSAzKSBUaiAwIC00MCBUZCAvRjEgMTQgVGYgKFRoZSBxdWljayBicm93biBmb3gganVtcHMgb3ZlciB0aGUgbGF6eSBkb2cuKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCAxMAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1NCAwMDAwMCBuIAowMDAwMDAwMTE3IDAwMDAwIG4gCjAwMDAwMDAxODAgMDAwMDAgbiAKMDAwMDAwMDI5MiAwMDAwMCBuIAowMDAwMDAwNDA0IDAwMDAwIG4gCjAwMDAwMDA1MTYgMDAwMDAgbiAKMDAwMDAwMDY5MiAwMDAwMCBuIAowMDAwMDAwODc4IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSAxMC9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjEwNzIKJSVFT0Y=';

const viewer = ref();
const page = ref(1);
const total = ref(0);
const allPages = ref(false);
</script>

# PdfViewer — live demo

This is the **real `@rozie-ui/pdf-vue` package** running on this page (VitePress is itself a Vue app), rendering a 3-page PDF via PDF.js. Page through it, zoom, rotate, toggle continuous scroll — and **select the text** (it's a real text layer, not an image). All of it is driven by the one `PdfViewer.rozie` source that compiles to six frameworks.

<ClientOnly>
<div class="pdf-live">
  <div class="pdf-live__controls">
    <button @click="viewer?.prevPage()" :disabled="page <= 1">‹ Prev</button>
    <span class="pdf-live__readout">page {{ page }} / {{ total || '…' }}</span>
    <button @click="viewer?.nextPage()" :disabled="page >= total">Next ›</button>
    <span class="pdf-live__sep" />
    <button @click="viewer?.zoomOut()">Zoom −</button>
    <button @click="viewer?.zoomIn()">Zoom +</button>
    <button @click="viewer?.fitWidth()">Fit width</button>
    <button @click="viewer?.rotateCW()">Rotate ⟳</button>
    <span class="pdf-live__sep" />
    <button :class="{ 'pdf-live__primary': allPages }" @click="allPages = !allPages">
      {{ allPages ? 'Continuous ✓' : 'Continuous' }}
    </button>
  </div>

  <div class="pdf-live__stage">
    <PdfViewer
      ref="viewer"
      :src="SAMPLE"
      :worker-src="workerSrc"
      v-model:page="page"
      :render-all-pages="allPages"
      @load="(e) => (total = e.numPages)"
    />
  </div>

  <p class="pdf-live__hint">Tip: drag-select the text on a page — it's copyable.</p>
</div>
</ClientOnly>

The current page is two-way bound with `v-model:page` (the readout tracks it as you scroll in continuous mode), and the buttons drive the imperative handle (`prevPage` / `nextPage` / `zoomIn` / `zoomOut` / `fitWidth` / `rotateCW`). The worker is bundled locally here via `new URL(...)`; left unset it defaults to a CDN copy. See the [full API](/guide/pdf) for every prop, event, and handle verb.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/pdf/src/PdfViewer.rozie{html}[PdfViewer.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/pdf-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/pdf/packages/react/src/PdfViewer.tsx[React]
<<< ../../packages/ui/pdf/packages/vue/src/PdfViewer.vue[Vue]
<<< ../../packages/ui/pdf/packages/svelte/src/PdfViewer.svelte[Svelte]
<<< ../../packages/ui/pdf/packages/angular/src/PdfViewer.ts[Angular]
<<< ../../packages/ui/pdf/packages/solid/src/PdfViewer.tsx[Solid]
<<< ../../packages/ui/pdf/packages/lit/src/PdfViewer.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element — with the same props, events, and 12-verb imperative handle, all from the one source above.

## See also

- [PdfViewer — showcase & API](/guide/pdf) — install, quick starts for all six frameworks, the worker setup, and the full reference.
- [PDF libraries comparison](/guide/pdf-comparison) — how `@rozie-ui/pdf` stacks up against react-pdf, vue-pdf-embed, ng2-pdf-viewer, and the underserved frameworks.

<style scoped>
.pdf-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.pdf-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.pdf-live__controls button {
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
.pdf-live__controls button:hover:not(:disabled) {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.pdf-live__controls button:disabled {
  opacity: 0.45;
  cursor: default;
}
.pdf-live__controls button.pdf-live__primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
}
.pdf-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.pdf-live__readout {
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-2);
}
.pdf-live__stage {
  height: 480px;
  border-radius: 8px;
  overflow: hidden;
}
.pdf-live__hint {
  margin: 0.6rem 0 0;
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
}
</style>
