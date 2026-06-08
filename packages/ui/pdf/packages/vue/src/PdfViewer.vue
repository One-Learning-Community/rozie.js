<template>

<div class="rozie-pdf" ref="viewerElRef" v-bind="$attrs"></div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{ src?: unknown; scale?: number; rotation?: number; workerSrc?: string; standardFontDataUrl?: string; renderAllPages?: boolean; textLayer?: boolean; password?: unknown; options?: Record<string, any> }>(),
  { src: undefined, scale: 1, rotation: 0, workerSrc: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs', standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/standard_fonts/', renderAllPages: false, textLayer: true, password: undefined, options: () => ({}) }
);

const page = defineModel<number>('page', { default: 1 });

const emit = defineEmits<{
  error: [...args: any[]];
  pagesrendered: [...args: any[]];
  passwordrequest: [...args: any[]];
  load: [...args: any[]];
  pagechange: [...args: any[]];
}>();

const current = ref(1);
const zoom = ref(1);
const rot = ref(0);
const engineReady = ref(0);

const viewerElRef = ref<HTMLElement>();

// pdfjs is DYNAMICALLY imported in $onMount, NOT a top-level import: pdfjs's main
// build evaluates browser globals (DOMMatrix, …) at module-load time, which
// crashes SSR (Next / Nuxt / SvelteKit / Analog / VitePress). Lazy-importing it on
// mount makes the component SSR-safe for ALL consumers AND code-splits the ~1MB
// engine out of the initial bundle. `pdfjsLib` is a null-let → typeNeutralize
// `any` (so pdfjsLib.getDocument / .TextLayer / .GlobalWorkerOptions are unchecked).
let pdfjsLib: any = null;

// more null-lets (→ `any`): `instance` is the PDFDocumentProxy (whose strict types
// the loosely-typed props don't satisfy — the maplibre mapOptions idiom),
// containerEl is the scroll host, observer is the continuous-mode scroll spy.
// more null-lets (→ `any`): `instance` is the PDFDocumentProxy (whose strict types
// the loosely-typed props don't satisfy — the maplibre mapOptions idiom),
// containerEl is the scroll host, observer is the continuous-mode scroll spy.
let instance: any = null;
let containerEl: any = null;
let observer: any = null;
// the PDFDocumentLoadingTask — it (NOT the PDFDocumentProxy, which has no
// destroy() in pdfjs v6) owns teardown of the worker + document. Held so a
// src/password change or unmount can tear the previous load down.
// the PDFDocumentLoadingTask — it (NOT the PDFDocumentProxy, which has no
// destroy() in pdfjs v6) owns teardown of the worker + document. Held so a
// src/password change or unmount can tear the previous load down.
let loadingTask: any = null;
// monotonic token cancels stale async loads/renders (src can change mid-render,
// pages render async — the SortableList rebuild-cancel discipline).
// monotonic token cancels stale async loads/renders (src can change mid-render,
// pages render async — the SortableList rebuild-cancel discipline).
let renderToken = 0;
// guards the scroll-spy → $data.current → scroll-to feedback loop.
// guards the scroll-spy → $data.current → scroll-to feedback loop.
let suppressScroll = false;
// set in the $onMount teardown so a late-resolving dynamic import() bails. A
// TOP-LEVEL let (not $onMount-local): the Solid emitter hoists the $onMount
// teardown into a sibling onCleanup() OUTSIDE the mount closure, so a mount-local
// would be out of scope there.
// set in the $onMount teardown so a late-resolving dynamic import() bails. A
// TOP-LEVEL let (not $onMount-local): the Solid emitter hoists the $onMount
// teardown into a sibling onCleanup() OUTSIDE the mount closure, so a mount-local
// would be out of scope there.
let cancelled = false;

// ─── build the getDocument() source (no sigils beyond $props/$snapshot) ──────
// ─── build the getDocument() source (no sigils beyond $props/$snapshot) ──────
const buildSource = () => {
  let cfg: any = null;
  cfg = {
    ...props.options
  };
  // NOTE: the local must NOT be named `src` — a local `const src = $props.src`
  // (same name as the `src` prop) hits a Svelte-emitter scope bug where the
  // renamed local's initializer mis-resolves to itself (`const src2 = src2`, a
  // TDZ ReferenceError) instead of the prop accessor. Naming it `srcInput`
  // sidesteps the shadow on every target.
  const srcInput = props.src;
  if (typeof srcInput === 'string') {
    if (srcInput.startsWith('data:')) {
      // decode a `data:` base64 URL to bytes — pdfjs `url` doesn't fetch data URLs.
      const base64 = srcInput.substring(srcInput.indexOf(',') + 1);
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      cfg.data = bytes;
    } else {
      cfg.url = srcInput;
    }
  } else if (srcInput) {
    cfg.data = srcInput;
  }
  if (props.password != null) cfg.password = props.password;
  if (props.standardFontDataUrl) cfg.standardFontDataUrl = props.standardFontDataUrl;
  return cfg;
};

// ─── render one page (canvas + optional text layer) into the container ───────
// ─── render one page (canvas + optional text layer) into the container ───────
const renderPage = async (pdf: any, pageNum: any, container: any) => {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({
    scale: zoom.value,
    rotation: rot.value
  });
  const pageDiv = document.createElement('div');
  pageDiv.className = 'rozie-pdf-page';
  pageDiv.setAttribute('data-page', String(pageNum));
  pageDiv.style.width = Math.floor(viewport.width) + 'px';
  pageDiv.style.height = Math.floor(viewport.height) + 'px';
  // the text layer positions its spans with calc(var(--scale-factor) * …px).
  pageDiv.style.setProperty('--scale-factor', String(zoom.value));
  const outputScale = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = Math.floor(viewport.width) + 'px';
  canvas.style.height = Math.floor(viewport.height) + 'px';
  pageDiv.appendChild(canvas);
  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
  await page.render({
    canvas,
    viewport,
    transform
  }).promise;
  if (props.textLayer) {
    const tl = document.createElement('div');
    tl.className = 'textLayer';
    pageDiv.appendChild(tl);
    const layer = new pdfjsLib.TextLayer({
      textContentSource: page.streamTextContent(),
      container: tl,
      viewport
    });
    await layer.render();
  }
  container.appendChild(pageDiv);
  return pageDiv;
};

// continuous-mode scroll spy — reflect the most-visible page into $data.current.
// continuous-mode scroll spy — reflect the most-visible page into $data.current.
const setupScrollSpy = () => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (!containerEl) return;
  observer = new IntersectionObserver((entries: any) => {
    let best: any = null;
    let bestRatio = 0;
    for (const e of entries as any) {
      if (e.intersectionRatio > bestRatio) {
        bestRatio = e.intersectionRatio;
        best = e.target;
      }
    }
    if (best) {
      const n = Number(best.getAttribute('data-page'));
      if (n && n !== current.value) {
        suppressScroll = true;
        current.value = n;
        suppressScroll = false;
      }
    }
  }, {
    root: containerEl,
    threshold: [0.25, 0.5, 0.75]
  });
  for (const child of containerEl.children as any) observer.observe(child);
};
const scrollToPage = (n: any) => {
  if (!containerEl) return;
  const el = containerEl.querySelector('[data-page="' + n + '"]');
  if (el) el.scrollIntoView({
    block: 'start',
    behavior: 'auto'
  });
};

// ─── render the current view (single page, or all pages) ─────────────────────
// ─── render the current view (single page, or all pages) ─────────────────────
const renderView = async () => {
  if (!instance || !containerEl) return;
  const token = ++renderToken;
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  containerEl.innerHTML = '';
  const total = instance.numPages;
  const pages = props.renderAllPages ? Array.from({
    length: total
  }, (_: any, i: any) => i + 1) : [Math.min(Math.max(current.value, 1), total)];
  for (const n of pages as any) {
    if (token !== renderToken) return;
    try {
      await renderPage(instance, n, containerEl);
    } catch (e: any) {
      if (token === renderToken) emit('error', e);
    }
  }
  if (token !== renderToken) return;
  if (props.renderAllPages) setupScrollSpy();
  emit('pagesrendered');
};

// ─── load the document ───────────────────────────────────────────────────────
// ─── load the document ───────────────────────────────────────────────────────
const load = async () => {
  if (!pdfjsLib) return;
  const token = ++renderToken;
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  // tear down the previous load via the loading task (PDFDocumentProxy has no
  // destroy() in pdfjs v6).
  if (loadingTask) {
    loadingTask.destroy();
    loadingTask = null;
  }
  instance = null;
  if (containerEl) containerEl.innerHTML = '';
  if (!props.src) return;
  try {
    loadingTask = pdfjsLib.getDocument(buildSource());
    loadingTask.onPassword = (_updatePassword: any, reason: any) => {
      emit('passwordrequest', {
        reason
      });
    };
    const pdf = await loadingTask.promise;
    // stale (a newer load bumped the token + destroyed this task) — drop it.
    if (token !== renderToken) return;
    instance = pdf;
    if (current.value > pdf.numPages) current.value = pdf.numPages;
    emit('load', {
      numPages: pdf.numPages
    });
    await renderView();
  } catch (e: any) {
    // a destroyed task rejects its promise — suppress the abort for stale loads.
    if (token === renderToken) emit('error', e);
  }
};
const applyFit = async (mode: any) => {
  if (!instance || !containerEl) return;
  const n = Math.min(Math.max(current.value, 1), instance.numPages);
  const page = await instance.getPage(n);
  const vp = page.getViewport({
    scale: 1,
    rotation: rot.value
  });
  const cw = containerEl.clientWidth - 24;
  const ch = containerEl.clientHeight - 24;
  if (mode === 'width') zoom.value = cw / vp.width;else zoom.value = Math.min(cw / vp.width, ch / vp.height);
};
// ─── imperative handle (Phase 21 $expose) ────────────────────────────────────
// 12 verbs. Collision-clear: NO `setPage` (React `page`-model auto-setter,
// ROZ524 — use goToPage); none equals an emit name (load/error/pagechange/
// pagesrendered/passwordrequest); none is a Lit reserved lifecycle. All drive
// $data (not the props), so they work whether or not the consumer binds `page`.
function getDocument() {
  return instance;
}
function getPageCount() {
  return instance ? instance.numPages : 0;
}
function goToPage(n: any) {
  if (!instance) return;
  current.value = Math.min(Math.max(n, 1), instance.numPages);
}
function nextPage() {
  goToPage(current.value + 1);
}
function prevPage() {
  goToPage(current.value - 1);
}
function setScale(s: any) {
  if (typeof s === 'number' && s > 0) zoom.value = s;
}
function zoomIn() {
  zoom.value = Math.min(zoom.value * 1.25, 10);
}
function zoomOut() {
  zoom.value = Math.max(zoom.value / 1.25, 0.1);
}
function fitWidth() {
  applyFit('width');
}
function fitPage() {
  applyFit('page');
}
function rotateCW() {
  rot.value = (rot.value + 90) % 360;
}
function rotateCCW() {
  rot.value = (rot.value + 270) % 360;
}

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  cancelled = false;
  containerEl = viewerElRef.value;
  current.value = Math.max(1, page.value);
  zoom.value = props.scale;
  rot.value = props.rotation;
  // lazy-load the engine (SSR-safe + code-split), then configure the worker and
  // load the document.
  import('pdfjs-dist').then((mod: any) => {
    if (cancelled) return;
    pdfjsLib = mod;
    pdfjsLib.GlobalWorkerOptions.workerSrc = props.workerSrc;
    // hand off to the lazy $watch below rather than calling load() from this
    // (React: mount-frozen) closure — see the $data.engineReady note above.
    engineReady.value++;
  });
  _cleanup_0 = () => {
    cancelled = true;
    renderToken++;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (loadingTask) {
      loadingTask.destroy();
      loadingTask = null;
    }
    instance = null;
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => engineReady.value, () => load());
watch(() => props.src, () => load());
watch(() => props.password, () => load());
watch(() => props.workerSrc, (v: any) => {
  if (pdfjsLib && v) pdfjsLib.GlobalWorkerOptions.workerSrc = v;
});
watch(() => page.value, (v: any) => {
  if (typeof v === 'number' && v >= 1 && v !== current.value) current.value = v;
});
watch(() => props.scale, (v: any) => {
  if (typeof v === 'number' && v > 0) zoom.value = v;
});
watch(() => props.rotation, (v: any) => {
  if (typeof v === 'number') rot.value = (v % 360 + 360) % 360;
});
watch(() => current.value, (v: any) => {
  page.value = v;
  emit('pagechange', {
    page: v
  });
  if (props.renderAllPages) {
    if (!suppressScroll) scrollToPage(v);
  } else renderView();
});
watch(() => zoom.value, () => renderView());
watch(() => rot.value, () => renderView());
watch(() => props.renderAllPages, () => renderView());
watch(() => props.textLayer, () => renderView());

defineExpose({ getDocument, getPageCount, goToPage, nextPage, prevPage, setScale, zoomIn, zoomOut, fitWidth, fitPage, rotateCW, rotateCCW });
</script>

<style scoped>
.rozie-pdf {
  width: 100%;
  height: 100%;
  min-height: 320px;
  overflow: auto;
  background: #525659;
  padding: 12px 0;
}
</style>

<style>
.rozie-pdf .rozie-pdf-page {
    position: relative;
    margin: 0 auto 12px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    background: #fff;
  }
.rozie-pdf .rozie-pdf-page canvas {
    display: block;
  }
.rozie-pdf .textLayer {
    position: absolute;
    text-align: initial;
    inset: 0;
    overflow: clip;
    opacity: 1;
    line-height: 1;
    text-size-adjust: none;
    forced-color-adjust: none;
    transform-origin: 0 0;
    caret-color: CanvasText;
    z-index: 1;
  }
.rozie-pdf .textLayer span,
  .rozie-pdf .textLayer br {
    color: transparent;
    position: absolute;
    white-space: pre;
    cursor: text;
    transform-origin: 0% 0%;
  }
.rozie-pdf .textLayer span.markedContent {
    top: 0;
    height: 0;
  }
.rozie-pdf .textLayer ::selection {
    background: rgba(0, 100, 255, 0.3);
  }
</style>
