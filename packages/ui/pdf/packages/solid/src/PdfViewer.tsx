import type { JSX } from 'solid-js';
import { createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';
import * as pdfjsLib from 'pdfjs-dist';

// null-lets so the bundled-leaf typeNeutralize pass annotates them `any`:
// `instance` is the PDFDocumentProxy (whose strict types the loosely-typed props
// don't satisfy — routing the render chain through `any` is the maplibre
// mapOptions idiom), containerEl is the scroll host, observer is the
// continuous-mode scroll spy.

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
  }`);

interface PdfViewerProps {
  src?: unknown;
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  scale?: number;
  rotation?: number;
  workerSrc?: string;
  renderAllPages?: boolean;
  textLayer?: boolean;
  password?: unknown;
  options?: Record<string, any>;
  onError?: (...args: unknown[]) => void;
  onPagesrendered?: (...args: unknown[]) => void;
  onPasswordrequest?: (...args: unknown[]) => void;
  onLoad?: (...args: unknown[]) => void;
  onPagechange?: (...args: unknown[]) => void;
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
}

export default function PdfViewer(_props: PdfViewerProps): JSX.Element {
  const _merged = mergeProps({ src: undefined, scale: 1, rotation: 0, workerSrc: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs', renderAllPages: false, textLayer: true, password: undefined, options: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['src', 'page', 'scale', 'rotation', 'workerSrc', 'renderAllPages', 'textLayer', 'password', 'options', 'ref']);
  onMount(() => { local.ref?.({ getDocument, getPageCount, goToPage, nextPage, prevPage, setScale, zoomIn, zoomOut, fitWidth, fitPage, rotateCW, rotateCCW }); });

  const [page, setPage] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'page', 1);
  const [current, setCurrent] = createSignal(1);
  const [zoom, setZoom] = createSignal(1);
  const [rot, setRot] = createSignal(0);
  onMount(() => {
    const _cleanup = (() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = local.workerSrc;
    containerEl = viewerElRef;
    setCurrent(Math.max(1, page()));
    setZoom(local.scale);
    setRot(local.rotation);
    load();
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
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
  createEffect(on(() => (() => local.src)(), (v) => untrack(() => (() => load())()), { defer: true }));
  createEffect(on(() => (() => local.password)(), (v) => untrack(() => (() => load())()), { defer: true }));
  createEffect(on(() => (() => local.workerSrc)(), (v) => untrack(() => ((v: any) => {
    if (v) pdfjsLib.GlobalWorkerOptions.workerSrc = v;
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
  let viewerElRef: HTMLElement | null = null;

  // null-lets so the bundled-leaf typeNeutralize pass annotates them `any`:
  // `instance` is the PDFDocumentProxy (whose strict types the loosely-typed props
  // don't satisfy — routing the render chain through `any` is the maplibre
  // mapOptions idiom), containerEl is the scroll host, observer is the
  // continuous-mode scroll spy.
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

  // ─── build the getDocument() source (no sigils beyond $props/$snapshot) ──────
  function buildSource() {
    let cfg: any = null;
    cfg = {
      ...local.options
    };
    const src = local.src;
    if (typeof src === 'string') {
      if (src.startsWith('data:')) {
        // decode a `data:` base64 URL to bytes — pdfjs `url` doesn't fetch data URLs.
        const base64 = src.substring(src.indexOf(',') + 1);
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        cfg.data = bytes;
      } else {
        cfg.url = src;
      }
    } else if (src) {
      cfg.data = src;
    }
    if (local.password != null) cfg.password = local.password;
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

  return (
    <>
    <div ref={(el) => { viewerElRef = el as HTMLElement; }} {...attrs} class={"rozie-pdf" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-3c863364="" />
    </>
  );
}
