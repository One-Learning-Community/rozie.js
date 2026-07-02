import type { JSX } from 'solid-js';
import { createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';

__rozieInjectStyle('PdfViewer-3c863364', `.rozie-pdf[data-rozie-s-3c863364] {
  width: 100%;
  height: 100%;
  min-height: 320px;
  overflow: auto;
  background: #525659;
  padding: 12px 0;
}
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
.rozie-pdf .textLayer span.rozie-pdf-find {
    background: rgba(255, 196, 0, 0.45);
    border-radius: 2px;
  }`);

interface PdfViewerProps {
  /**
   * The PDF source — a URL string, a `data:` base64 URL, or binary data (`ArrayBuffer` / `Uint8Array`). Changing it tears down the previous document (via its loading task) and loads the new one; `undefined` renders an empty viewer.
   * @example
   * <PdfViewer :src="pdfUrl" r-model:page="page" />
   */
  src?: unknown;
  /**
   * The 1-based current page. The sole `model: true` prop — **two-way** (`r-model:page` / `v-model:page` / `bind:page` / `[(page)]`), so `page` also drives the Angular `ControlValueAccessor`. In single-page mode it drives which page renders; in `render-all-pages` mode it reflects the scrolled-to page (and scrolls the container when the consumer writes it). Clamped to `[1, pageCount]`.
   */
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  /**
   * The zoom scale (`1` = 100%). One-way: the `setScale` / `zoomIn` / `zoomOut` / `fitWidth` / `fitPage` handle verbs override it imperatively, while a consumer write reconciles the live render.
   */
  scale?: number;
  /**
   * Rotation in degrees (`0` / `90` / `180` / `270`). One-way: the `rotateCW` / `rotateCCW` verbs override it. Normalized into `[0, 360)`.
   */
  rotation?: number;
  /**
   * The PDF.js worker URL, set on `GlobalWorkerOptions.workerSrc` before loading. Defaults to the version-matched jsDelivr CDN copy so the component works with zero config; override for offline / CSP / a bundled worker (e.g. Vite's `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`).
   */
  workerSrc?: string;
  /**
   * The directory of PDF.js's standard-font data so the base-14 fonts (Helvetica / Times / Courier / …) render with correct glyphs. Version-matched CDN default; override (or pass a bundled dir) for offline / CSP.
   */
  standardFontDataUrl?: string;
  /**
   * `false` (default) renders a single page with nav (the two-way `page` drives it). `true` renders a continuous scroll of every page; the most-visible page reflects back into `page` and the `pagechange` event via an `IntersectionObserver`.
   */
  renderAllPages?: boolean;
  /**
   * Render PDF.js's selectable / copyable text-layer spans over each page canvas (the differentiator vs a dumb canvas image). On by default; the required `.textLayer` CSS + `--scale-factor` var ship with the component, so no extra import is needed.
   */
  textLayer?: boolean;
  /**
   * Password for an encrypted PDF. If the document is encrypted and no (or a wrong) password is set, the `passwordrequest` event fires with `{ reason }`. Changing it reloads the document.
   */
  password?: unknown;
  /**
   * A reactive search query — the **controlled** alternative to the imperative `find()` handle. Setting it to a non-empty string scans every page, navigates to + coarse-highlights the first match, and emits `findresult` with the total occurrence count; clearing it (empty string / `null`) clears the highlight. Reactive so it works uniformly across all six targets (an Angular child-component `ref` cannot reach the `$expose` handle from a template event handler — the same reason `page` is a two-way model rather than a handle call).
   */
  query?: unknown;
  /**
   * Raw `getDocument` `DocumentInitParameters` passthrough — spread **before** the curated keys (explicit `src` / `password` win). For `cMapUrl`, `httpHeaders`, `withCredentials`, etc.
   */
  options?: Record<string, any>;
  onError?: (...args: unknown[]) => void;
  onPagesrendered?: (...args: unknown[]) => void;
  onPasswordrequest?: (...args: unknown[]) => void;
  onProgress?: (...args: unknown[]) => void;
  onLoad?: (...args: unknown[]) => void;
  onPagechange?: (...args: unknown[]) => void;
  onFindresult?: (...args: unknown[]) => void;
  ref?: (h: PdfViewerHandle) => void;
}

export interface PdfViewerHandle {
  getDocument: (...args: any[]) => any;
  getPageCount: (...args: any[]) => any;
  goToPage: (...args: any[]) => any;
  nextPage: (...args: any[]) => any;
  prevPage: (...args: any[]) => any;
  setScale: (...args: any[]) => any;
  zoomIn: (...args: any[]) => any;
  zoomOut: (...args: any[]) => any;
  fitWidth: (...args: any[]) => any;
  fitPage: (...args: any[]) => any;
  rotateCW: (...args: any[]) => any;
  rotateCCW: (...args: any[]) => any;
  download: (...args: any[]) => any;
  getMetadata: (...args: any[]) => any;
  getOutline: (...args: any[]) => any;
  find: (...args: any[]) => any;
  findNext: (...args: any[]) => any;
  findPrev: (...args: any[]) => any;
  clearFind: (...args: any[]) => any;
}

export default function PdfViewer(_props: PdfViewerProps): JSX.Element {
  const _merged = mergeProps({ src: undefined, scale: 1, rotation: 0, workerSrc: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs', standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/standard_fonts/', renderAllPages: false, textLayer: true, password: undefined, query: undefined, options: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['src', 'page', 'scale', 'rotation', 'workerSrc', 'standardFontDataUrl', 'renderAllPages', 'textLayer', 'password', 'query', 'options', 'ref']);
  onMount(() => { local.ref?.({ getDocument, getPageCount, goToPage, nextPage, prevPage, setScale, zoomIn, zoomOut, fitWidth, fitPage, rotateCW, rotateCCW, download, getMetadata, getOutline, find, findNext, findPrev, clearFind }); });

  const [page, setPage] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'page', 1);
  const [current, setCurrent] = createSignal(1);
  const [zoom, setZoom] = createSignal(1);
  const [rot, setRot] = createSignal(0);
  const [engineReady, setEngineReady] = createSignal(0);
  onMount(() => {
    const _cleanup = (() => {
    cancelled = false;
    containerEl = viewerElRef;
    setCurrent(Math.max(1, page()));
    setZoom(local.scale);
    setRot(local.rotation);
    // lazy-load the engine (SSR-safe + code-split), then configure the worker and
    // load the document.
    import('pdfjs-dist').then((mod: any) => {
      if (cancelled) return;
      pdfjsLib = mod;
      pdfjsLib.GlobalWorkerOptions.workerSrc = local.workerSrc;
      // hand off to the lazy $watch below rather than calling load() from this
      // (React: mount-frozen) closure — see the $data.engineReady note above.
      setEngineReady(engineReady() + 1);
    });
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
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
  });
  });
  createEffect(on(() => (() => engineReady())(), (v) => untrack(() => (() => load())()), { defer: true }));
  createEffect(on(() => (() => local.src)(), (v) => untrack(() => (() => load())()), { defer: true }));
  createEffect(on(() => (() => local.password)(), (v) => untrack(() => (() => load())()), { defer: true }));
  createEffect(on(() => (() => local.workerSrc)(), (v) => untrack(() => ((v: any) => {
    if (pdfjsLib && v) pdfjsLib.GlobalWorkerOptions.workerSrc = v;
  })(v)), { defer: true }));
  createEffect(on(() => (() => page())(), (v) => untrack(() => ((v: any) => {
    if (typeof v === 'number' && v >= 1 && v !== current()) setCurrent(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.scale)(), (v) => untrack(() => ((v: any) => {
    if (typeof v === 'number' && v > 0) setZoom(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.rotation)(), (v) => untrack(() => ((v: any) => {
    if (typeof v === 'number') setRot((v % 360 + 360) % 360);
  })(v)), { defer: true }));
  createEffect(on(() => (() => current())(), (v) => untrack(() => ((v: any) => {
    setPage(v);
    _props.onPagechange?.({
      page: v
    });
    if (local.renderAllPages) {
      if (!suppressScroll) scrollToPage(v);
    } else renderView();
  })(v)), { defer: true }));
  createEffect(on(() => (() => zoom())(), (v) => untrack(() => (() => renderView())()), { defer: true }));
  createEffect(on(() => (() => rot())(), (v) => untrack(() => (() => renderView())()), { defer: true }));
  createEffect(on(() => (() => local.renderAllPages)(), (v) => untrack(() => (() => renderView())()), { defer: true }));
  createEffect(on(() => (() => local.textLayer)(), (v) => untrack(() => (() => renderView())()), { defer: true }));
  createEffect(on(() => (() => local.query)(), (v) => untrack(() => ((v: any) => {
    if (v == null) return;
    const q = String(v);
    if (q) find(q);else clearFind();
  })(v)), { defer: true }));
  let viewerElRef: HTMLElement | null = null;

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
  let instance: any = null;
  let containerEl: any = null;
  let observer: any = null;
  // the PDFDocumentLoadingTask — it (NOT the PDFDocumentProxy, which has no
  // destroy() in pdfjs v6) owns teardown of the worker + document. Held so a
  // src/password change or unmount can tear the previous load down.
  let loadingTask: any = null;
  // monotonic token cancels stale async loads/renders (src can change mid-render,
  // pages render async — the SortableList rebuild-cancel discipline).
  let renderToken = 0;
  // guards the scroll-spy → $data.current → scroll-to feedback loop.
  let suppressScroll = false;
  // find/search state. findQuery is the active lowercased query (''=inactive);
  // findMatches is a flat per-OCCURRENCE list [{ page }] (drives the count + the
  // next/prev cycle); findIndex is the current match (-1=none). TOP-LEVEL lets (not
  // $onMount-local) so renderPage's coarse highlight pass + the find verbs can read
  // them across renders.
  let findQuery = '';
  let findMatches = [];
  let findIndex = -1;
  // set in the $onMount teardown so a late-resolving dynamic import() bails. A
  // TOP-LEVEL let (not $onMount-local): the Solid emitter hoists the $onMount
  // teardown into a sibling onCleanup() OUTSIDE the mount closure, so a mount-local
  // would be out of scope there.
  let cancelled = false;

  // ─── build the getDocument() source (no sigils beyond $props/$snapshot) ──────
  function buildSource() {
    let cfg: any = null;
    cfg = {
      ...local.options
    };
    // NOTE: the local must NOT be named `src` — a local `const src = $props.src`
    // (same name as the `src` prop) hits a Svelte-emitter scope bug where the
    // renamed local's initializer mis-resolves to itself (`const src2 = src2`, a
    // TDZ ReferenceError) instead of the prop accessor. Naming it `srcInput`
    // sidesteps the shadow on every target.
    const srcInput = local.src;
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
    if (local.password != null) cfg.password = local.password;
    if (local.standardFontDataUrl) cfg.standardFontDataUrl = local.standardFontDataUrl;
    return cfg;
  }

  // ─── render one page (canvas + optional text layer) into the container ───────
  async function renderPage(pdf: any, pageNum: any, container: any) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({
      scale: zoom(),
      rotation: rot()
    });
    const pageDiv = document.createElement('div');
    pageDiv.className = 'rozie-pdf-page';
    pageDiv.setAttribute('data-page', String(pageNum));
    pageDiv.style.width = Math.floor(viewport.width) + 'px';
    pageDiv.style.height = Math.floor(viewport.height) + 'px';
    // the text layer positions its spans with calc(var(--scale-factor) * …px).
    pageDiv.style.setProperty('--scale-factor', String(zoom()));
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
    if (local.textLayer) {
      const tl = document.createElement('div');
      tl.className = 'textLayer';
      pageDiv.appendChild(tl);
      const layer = new pdfjsLib.TextLayer({
        textContentSource: page.streamTextContent(),
        container: tl,
        viewport
      });
      await layer.render();
      // coarse find-highlight: add .rozie-pdf-find to text-layer spans whose text
      // CONTAINS the active query. Span-level / COARSE — a query straddling two
      // adjacent spans won't highlight (documented). Runs only while a find is active.
      if (findQuery) {
        const spans = tl.querySelectorAll('span');
        for (const sp of spans as any) {
          const t = sp.textContent;
          if (t && t.toLowerCase().indexOf(findQuery) !== -1) sp.classList.add('rozie-pdf-find');
        }
      }
    }
    container.appendChild(pageDiv);
    return pageDiv;
  }

  // continuous-mode scroll spy — reflect the most-visible page into $data.current.
  function setupScrollSpy() {
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
        if (n && n !== current()) {
          suppressScroll = true;
          setCurrent(n);
          suppressScroll = false;
        }
      }
    }, {
      root: containerEl,
      threshold: [0.25, 0.5, 0.75]
    });
    for (const child of containerEl.children as any) observer.observe(child);
  }
  function scrollToPage(n: any) {
    if (!containerEl) return;
    const el = containerEl.querySelector('[data-page="' + n + '"]');
    if (el) el.scrollIntoView({
      block: 'start',
      behavior: 'auto'
    });
  }

  // ─── render the current view (single page, or all pages) ─────────────────────
  async function renderView() {
    if (!instance || !containerEl) return;
    const token = ++renderToken;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    containerEl.innerHTML = '';
    const total = instance.numPages;
    const pages = local.renderAllPages ? Array.from({
      length: total
    }, (_: any, i: any) => i + 1) : [Math.min(Math.max(current(), 1), total)];
    for (const n of pages as any) {
      if (token !== renderToken) return;
      try {
        await renderPage(instance, n, containerEl);
      } catch (e: any) {
        if (token === renderToken) _props.onError?.(e);
      }
    }
    if (token !== renderToken) return;
    if (local.renderAllPages) setupScrollSpy();
    _props.onPagesrendered?.();
  }

  // ─── load the document ───────────────────────────────────────────────────────
  async function load() {
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
    if (!local.src) return;
    try {
      loadingTask = pdfjsLib.getDocument(buildSource());
      loadingTask.onPassword = (_updatePassword: any, reason: any) => {
        _props.onPasswordrequest?.({
          reason
        });
      };
      // download progress in bytes; `total` may be 0/undefined when the server sends
      // no Content-Length header — pass the raw pdfjs onProgress payload through as-is.
      loadingTask.onProgress = (p: any) => _props.onProgress?.({
        loaded: p && p.loaded,
        total: p && p.total
      });
      const pdf = await loadingTask.promise;
      // stale (a newer load bumped the token + destroyed this task) — drop it.
      if (token !== renderToken) return;
      instance = pdf;
      if (current() > pdf.numPages) setCurrent(pdf.numPages);
      _props.onLoad?.({
        numPages: pdf.numPages
      });
      await renderView();
    } catch (e: any) {
      // a destroyed task rejects its promise — suppress the abort for stale loads.
      if (token === renderToken) _props.onError?.(e);
    }
  }
  async function applyFit(mode: any) {
    if (!instance || !containerEl) return;
    const n = Math.min(Math.max(current(), 1), instance.numPages);
    const page = await instance.getPage(n);
    const vp = page.getViewport({
      scale: 1,
      rotation: rot()
    });
    const cw = containerEl.clientWidth - 24;
    const ch = containerEl.clientHeight - 24;
    if (mode === 'width') setZoom(cw / vp.width);else setZoom(Math.min(cw / vp.width, ch / vp.height));
  }
  // ─── imperative handle (Phase 21 $expose) ────────────────────────────────────
  // 19 verbs. Collision-clear: NO `setPage` (React `page`-model auto-setter,
  // ROZ524 — use goToPage); none equals an emit name (load/error/pagechange/
  // pagesrendered/passwordrequest/progress/findresult); none is a Lit reserved
  // lifecycle. The navigation/zoom/rotate verbs drive $data (not the props), so they
  // work whether or not the consumer binds `page`. The document-level verbs below
  // are cheap passthroughs over the held PDFDocumentProxy (`instance`) that a
  // consumer can't reach otherwise without `getDocument()` + pdf.js knowledge:
  //   - download(filename?): save the original PDF bytes (instance.getData() ->
  //     Blob -> anchor click) — the single most-expected viewer affordance.
  //   - getMetadata(): document title/author/page-labels (tab title / info panel).
  //   - getOutline(): the bookmark/TOC tree (powers a navigation sidebar; outline
  //     dests map onto goToPage).
  // The four find verbs (find/findNext/findPrev/clearFind) drive the coarse
  // span-level highlight pass + emit `findresult`. `find/findNext/findPrev/clearFind`
  // are collision-vetted (no Lit reserved lifecycle, no `page`-model auto-setter clash).
  function getDocument() {
    return instance;
  }
  function getPageCount() {
    return instance ? instance.numPages : 0;
  }
  function goToPage(n: any) {
    if (!instance) return;
    setCurrent(Math.min(Math.max(n, 1), instance.numPages));
  }
  function nextPage() {
    goToPage(current() + 1);
  }
  function prevPage() {
    goToPage(current() - 1);
  }
  function setScale(s: any) {
    if (typeof s === 'number' && s > 0) setZoom(s);
  }
  function zoomIn() {
    setZoom(Math.min(zoom() * 1.25, 10));
  }
  function zoomOut() {
    setZoom(Math.max(zoom() / 1.25, 0.1));
  }
  function fitWidth() {
    applyFit('width');
  }
  function fitPage() {
    applyFit('page');
  }
  function rotateCW() {
    setRot((rot() + 90) % 360);
  }
  function rotateCCW() {
    setRot((rot() + 270) % 360);
  }
  // Save the original PDF bytes. getData() resolves the raw Uint8Array; wrap in a
  // Blob and trigger a download via a transient anchor. Resolves false before mount.
  async function download(filename: any) {
    if (!instance) return false;
    const bytes = await instance.getData();
    const url = URL.createObjectURL(new Blob([bytes], {
      type: 'application/pdf'
    }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  }
  // Document info (title/author/page labels) — resolves null before mount.
  function getMetadata() {
    return instance ? instance.getMetadata() : null;
  }
  // Bookmark / table-of-contents tree — resolves null when absent or before mount.
  function getOutline() {
    return instance ? instance.getOutline() : null;
  }

  // ─── text find/search (coarse span-level highlight) ──────────────────────────
  // find(query) scans EVERY page's extracted text for occurrences, navigates to +
  // highlights the first match, returns the match count, and emits `findresult`. The
  // highlight is COARSE / span-level: renderPage adds .rozie-pdf-find to whole
  // text-layer spans that CONTAIN the query (a query straddling two spans won't
  // highlight). findNext/findPrev cycle (wrap) through the per-occurrence match list;
  // clearFind resets the query + highlights. All async-safe over the `any`
  // PDFDocumentProxy (`instance`); no-op / return 0 before the document loads.
  async function find(query: any) {
    const q = (query == null ? '' : String(query)).trim().toLowerCase();
    findQuery = q;
    findMatches = [];
    findIndex = -1;
    if (!instance || !q) {
      renderView();
      _props.onFindresult?.({
        query: q,
        matches: 0,
        current: 0
      });
      return 0;
    }
    const total = instance.numPages;
    for (let p = 1; p <= total; p++) {
      const page = await instance.getPage(p);
      const tc = await page.getTextContent();
      const text = tc.items.map((it: any) => it && it.str != null ? it.str : '').join('').toLowerCase();
      let from = 0;
      while (true) {
        const at = text.indexOf(q, from);
        if (at === -1) break;
        findMatches.push({
          page: p
        });
        from = at + q.length;
      }
    }
    if (findMatches.length) {
      findIndex = 0;
      const target = findMatches[0].page;
      // navigate if needed; if already on the target page, force a re-render so the
      // highlight pass runs (a no-op goToPage wouldn't trip the $data.current $watch).
      if (target !== current()) goToPage(target);else renderView();
    } else {
      renderView();
    }
    _props.onFindresult?.({
      query: q,
      matches: findMatches.length,
      current: findMatches.length ? 1 : 0
    });
    return findMatches.length;
  }
  function findNext() {
    if (!findMatches.length) return;
    findIndex = (findIndex + 1) % findMatches.length;
    const target = findMatches[findIndex].page;
    if (target !== current()) goToPage(target);
    _props.onFindresult?.({
      query: findQuery,
      matches: findMatches.length,
      current: findIndex + 1
    });
  }
  function findPrev() {
    if (!findMatches.length) return;
    findIndex = (findIndex - 1 + findMatches.length) % findMatches.length;
    const target = findMatches[findIndex].page;
    if (target !== current()) goToPage(target);
    _props.onFindresult?.({
      query: findQuery,
      matches: findMatches.length,
      current: findIndex + 1
    });
  }
  function clearFind() {
    findQuery = '';
    findMatches = [];
    findIndex = -1;
    renderView();
    _props.onFindresult?.({
      query: '',
      matches: 0,
      current: 0
    });
  }

  return (
    <>
    <div ref={(el) => { viewerElRef = el as HTMLElement; }} {...attrs} class={"rozie-pdf" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-3c863364="" />
    </>
  );
}
