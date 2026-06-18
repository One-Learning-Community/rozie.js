import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import './PdfViewer.css';
import './PdfViewer.global.css';

interface PdfViewerProps {
  src?: unknown;
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  scale?: number;
  rotation?: number;
  workerSrc?: string;
  standardFontDataUrl?: string;
  renderAllPages?: boolean;
  textLayer?: boolean;
  password?: unknown;
  options?: Record<string, any>;
  onError?: (...args: any[]) => void;
  onPagesrendered?: (...args: any[]) => void;
  onPasswordrequest?: (...args: any[]) => void;
  onLoad?: (...args: any[]) => void;
  onPagechange?: (...args: any[]) => void;
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
}

const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(_props: PdfViewerProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const props: Omit<PdfViewerProps, 'src' | 'scale' | 'rotation' | 'workerSrc' | 'standardFontDataUrl' | 'renderAllPages' | 'textLayer' | 'password' | 'options'> & { src: unknown; scale: number; rotation: number; workerSrc: string; standardFontDataUrl: string; renderAllPages: boolean; textLayer: boolean; password: unknown; options: Record<string, any> } = {
    ..._props,
    src: _props.src ?? undefined,
    scale: _props.scale ?? 1,
    rotation: _props.rotation ?? 0,
    workerSrc: _props.workerSrc ?? 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs',
    standardFontDataUrl: _props.standardFontDataUrl ?? 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/standard_fonts/',
    renderAllPages: _props.renderAllPages ?? false,
    textLayer: _props.textLayer ?? true,
    password: _props.password ?? undefined,
    options: _props.options ?? __defaultOptions,
  };
  const attrs: Record<string, unknown> = (() => {
    const { src, page, scale, rotation, workerSrc, standardFontDataUrl, renderAllPages, textLayer, password, options, defaultValue, onPageChange, defaultPage, ...rest } = _props as PdfViewerProps & Record<string, unknown>;
    void src; void page; void scale; void rotation; void workerSrc; void standardFontDataUrl; void renderAllPages; void textLayer; void password; void options; void defaultValue; void onPageChange; void defaultPage;
    return rest;
  })();
  const cancelled = useRef(false);
  const containerEl = useRef<any>(null);
  const pdfjsLib = useRef<any>(null);
  const renderToken = useRef(0);
  const observer = useRef<any>(null);
  const loadingTask = useRef<any>(null);
  const instance = useRef<any>(null);
  const suppressScroll = useRef(false);
  const [page, setPage] = useControllableState({
    value: props.page,
    defaultValue: props.defaultPage ?? 1,
    onValueChange: props.onPageChange,
  });
  const _rotationRef = useRef(props.rotation);
  _rotationRef.current = props.rotation;
  const _scaleRef = useRef(props.scale);
  _scaleRef.current = props.scale;
  const _workerSrcRef = useRef(props.workerSrc);
  _workerSrcRef.current = props.workerSrc;
  const _pageRef = useRef(page);
  _pageRef.current = page;
  const [current, setCurrent] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [engineReady, setEngineReady] = useState(0);
  const viewerEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);
  const _watch5First = useRef(true);
  const _watch6First = useRef(true);
  const _watch7First = useRef(true);
  const _watch8First = useRef(true);
  const _watch9First = useRef(true);
  const _watch10First = useRef(true);
  const _watch11First = useRef(true);

  function buildSource() {
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
  }
  async function renderPage(pdf: any, pageNum: any, container: any) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({
      scale: zoom,
      rotation: rot
    });
    const pageDiv = document.createElement('div');
    pageDiv.className = 'rozie-pdf-page';
    pageDiv.setAttribute('data-page', String(pageNum));
    pageDiv.style.width = Math.floor(viewport.width) + 'px';
    pageDiv.style.height = Math.floor(viewport.height) + 'px';
    // the text layer positions its spans with calc(var(--scale-factor) * …px).
    pageDiv.style.setProperty('--scale-factor', String(zoom));
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
      const layer = new pdfjsLib.current.TextLayer({
        textContentSource: page.streamTextContent(),
        container: tl,
        viewport
      });
      await layer.render();
    }
    container.appendChild(pageDiv);
    return pageDiv;
  }
  function setupScrollSpy() {
    if (observer.current) {
      observer.current.disconnect();
      observer.current = null;
    }
    if (!containerEl.current) return;
    observer.current = new IntersectionObserver((entries: any) => {
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
        if (n && n !== current) {
          suppressScroll.current = true;
          setCurrent(n);
          suppressScroll.current = false;
        }
      }
    }, {
      root: containerEl.current,
      threshold: [0.25, 0.5, 0.75]
    });
    for (const child of containerEl.current.children as any) observer.current.observe(child);
  }
  function scrollToPage(n: any) {
    if (!containerEl.current) return;
    const el = containerEl.current.querySelector('[data-page="' + n + '"]');
    if (el) el.scrollIntoView({
      block: 'start',
      behavior: 'auto'
    });
  }
  async function renderView() {
    if (!instance.current || !containerEl.current) return;
    const token = ++renderToken.current;
    if (observer.current) {
      observer.current.disconnect();
      observer.current = null;
    }
    containerEl.current.innerHTML = '';
    const total = instance.current.numPages;
    const pages = props.renderAllPages ? Array.from({
      length: total
    }, (_: any, i: any) => i + 1) : [Math.min(Math.max(current, 1), total)];
    for (const n of pages as any) {
      if (token !== renderToken.current) return;
      try {
        await renderPage(instance.current, n, containerEl.current);
      } catch (e: any) {
        if (token === renderToken.current) props.onError && props.onError(e);
      }
    }
    if (token !== renderToken.current) return;
    if (props.renderAllPages) setupScrollSpy();
    props.onPagesrendered && props.onPagesrendered();
  }
  async function load() {
    if (!pdfjsLib.current) return;
    const token = ++renderToken.current;
    if (observer.current) {
      observer.current.disconnect();
      observer.current = null;
    }
    // tear down the previous load via the loading task (PDFDocumentProxy has no
    // destroy() in pdfjs v6).
    if (loadingTask.current) {
      loadingTask.current.destroy();
      loadingTask.current = null;
    }
    instance.current = null;
    if (containerEl.current) containerEl.current.innerHTML = '';
    if (!props.src) return;
    try {
      loadingTask.current = pdfjsLib.current.getDocument(buildSource());
      loadingTask.current.onPassword = (_updatePassword: any, reason: any) => {
        props.onPasswordrequest && props.onPasswordrequest({
          reason
        });
      };
      const pdf = await loadingTask.current.promise;
      // stale (a newer load bumped the token + destroyed this task) — drop it.
      if (token !== renderToken.current) return;
      instance.current = pdf;
      if (current > pdf.numPages) setCurrent(pdf.numPages);
      props.onLoad && props.onLoad({
        numPages: pdf.numPages
      });
      await renderView();
    } catch (e: any) {
      // a destroyed task rejects its promise — suppress the abort for stale loads.
      if (token === renderToken.current) props.onError && props.onError(e);
    }
  }
  async function applyFit(mode: any) {
    if (!instance.current || !containerEl.current) return;
    const n = Math.min(Math.max(current, 1), instance.current.numPages);
    const page = await instance.current.getPage(n);
    const vp = page.getViewport({
      scale: 1,
      rotation: rot
    });
    const cw = containerEl.current.clientWidth - 24;
    const ch = containerEl.current.clientHeight - 24;
    if (mode === 'width') setZoom(cw / vp.width);else setZoom(Math.min(cw / vp.width, ch / vp.height));
  }
  // ─── imperative handle (Phase 21 $expose) ────────────────────────────────────
  // 15 verbs. Collision-clear: NO `setPage` (React `page`-model auto-setter,
  // ROZ524 — use goToPage); none equals an emit name (load/error/pagechange/
  // pagesrendered/passwordrequest); none is a Lit reserved lifecycle. The
  // navigation/zoom/rotate verbs drive $data (not the props), so they work whether
  // or not the consumer binds `page`. The document-level verbs below are cheap
  // passthroughs over the held PDFDocumentProxy (`instance`) that a consumer can't
  // reach otherwise without `getDocument()` + pdf.js knowledge:
  //   - download(filename?): save the original PDF bytes (instance.getData() ->
  //     Blob -> anchor click) — the single most-expected viewer affordance.
  //   - getMetadata(): document title/author/page-labels (tab title / info panel).
  //   - getOutline(): the bookmark/TOC tree (powers a navigation sidebar; outline
  //     dests map onto goToPage).
  // (Text search/find is intentionally DEFERRED — it's a real find-controller
  // build over the text layer, not a passthrough; tracked as a follow-up.)
  function getDocument() {
    return instance.current;
  }
  function getPageCount() {
    return instance.current ? instance.current.numPages : 0;
  }
  function goToPage(n: any) {
    if (!instance.current) return;
    setCurrent(Math.min(Math.max(n, 1), instance.current.numPages));
  }
  function nextPage() {
    goToPage(current + 1);
  }
  function prevPage() {
    goToPage(current - 1);
  }
  function setScale(s: any) {
    if (typeof s === 'number' && s > 0) setZoom(s);
  }
  function zoomIn() {
    setZoom(prev => Math.min(prev * 1.25, 10));
  }
  function zoomOut() {
    setZoom(prev => Math.max(prev / 1.25, 0.1));
  }
  function fitWidth() {
    applyFit('width');
  }
  function fitPage() {
    applyFit('page');
  }
  function rotateCW() {
    setRot(prev => (prev + 90) % 360);
  }
  function rotateCCW() {
    setRot(prev => (prev + 270) % 360);
  }
  // Save the original PDF bytes. getData() resolves the raw Uint8Array; wrap in a
  // Blob and trigger a download via a transient anchor. Resolves false before mount.
  // Save the original PDF bytes. getData() resolves the raw Uint8Array; wrap in a
  // Blob and trigger a download via a transient anchor. Resolves false before mount.
  async function download(filename: any) {
    if (!instance.current) return false;
    const bytes = await instance.current.getData();
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
  // Document info (title/author/page labels) — resolves null before mount.
  function getMetadata() {
    return instance.current ? instance.current.getMetadata() : null;
  }
  // Bookmark / table-of-contents tree — resolves null when absent or before mount.
  // Bookmark / table-of-contents tree — resolves null when absent or before mount.
  function getOutline() {
    return instance.current ? instance.current.getOutline() : null;
  }

  useEffect(() => {
    cancelled.current = false;
    containerEl.current = viewerEl.current;
    setCurrent(Math.max(1, _pageRef.current));
    setZoom(_scaleRef.current);
    setRot(_rotationRef.current);
    // lazy-load the engine (SSR-safe + code-split), then configure the worker and
    // load the document.
    import('pdfjs-dist').then((mod: any) => {
      if (cancelled.current) return;
      pdfjsLib.current = mod;
      pdfjsLib.current.GlobalWorkerOptions.workerSrc = _workerSrcRef.current;
      // hand off to the lazy $watch below rather than calling load() from this
      // (React: mount-frozen) closure — see the $data.engineReady note above.
      setEngineReady(prev => prev + 1);
    });
    return () => {
      cancelled.current = true;
      renderToken.current++;
      if (observer.current) {
        observer.current.disconnect();
        observer.current = null;
      }
      if (loadingTask.current) {
        loadingTask.current.destroy();
        loadingTask.current = null;
      }
      instance.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    load();
  }, [engineReady]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    load();
  }, [props.src]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    load();
  }, [props.password]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    const v = props.workerSrc;
    if (pdfjsLib.current && v) pdfjsLib.current.GlobalWorkerOptions.workerSrc = v;
  }, [props.workerSrc]);
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    const v = page;
    if (typeof v === 'number' && v >= 1 && v !== current) setCurrent(v);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
    const v = props.scale;
    if (typeof v === 'number' && v > 0) setZoom(v);
  }, [props.scale]);
  useEffect(() => {
    if (_watch6First.current) { _watch6First.current = false; return; }
    const v = props.rotation;
    if (typeof v === 'number') setRot((v % 360 + 360) % 360);
  }, [props.rotation]);
  useEffect(() => {
    if (_watch7First.current) { _watch7First.current = false; return; }
    const v = current;
    setPage(v);
    props.onPagechange && props.onPagechange({
      page: v
    });
    if (props.renderAllPages) {
      if (!suppressScroll.current) scrollToPage(v);
    } else renderView();
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch8First.current) { _watch8First.current = false; return; }
    renderView();
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch9First.current) { _watch9First.current = false; return; }
    renderView();
  }, [rot]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch10First.current) { _watch10First.current = false; return; }
    renderView();
  }, [props.renderAllPages]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch11First.current) { _watch11First.current = false; return; }
    renderView();
  }, [props.textLayer]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ getDocument, getPageCount, goToPage, nextPage, prevPage, setScale, zoomIn, zoomOut, fitWidth, fitPage, rotateCW, rotateCCW, download, getMetadata, getOutline });
  _rozieExposeRef.current = { getDocument, getPageCount, goToPage, nextPage, prevPage, setScale, zoomIn, zoomOut, fitWidth, fitPage, rotateCW, rotateCCW, download, getMetadata, getOutline };
  useImperativeHandle(ref, () => ({ getDocument: (...args: Parameters<typeof getDocument>): ReturnType<typeof getDocument> => _rozieExposeRef.current.getDocument(...args), getPageCount: (...args: Parameters<typeof getPageCount>): ReturnType<typeof getPageCount> => _rozieExposeRef.current.getPageCount(...args), goToPage: (...args: Parameters<typeof goToPage>): ReturnType<typeof goToPage> => _rozieExposeRef.current.goToPage(...args), nextPage: (...args: Parameters<typeof nextPage>): ReturnType<typeof nextPage> => _rozieExposeRef.current.nextPage(...args), prevPage: (...args: Parameters<typeof prevPage>): ReturnType<typeof prevPage> => _rozieExposeRef.current.prevPage(...args), setScale: (...args: Parameters<typeof setScale>): ReturnType<typeof setScale> => _rozieExposeRef.current.setScale(...args), zoomIn: (...args: Parameters<typeof zoomIn>): ReturnType<typeof zoomIn> => _rozieExposeRef.current.zoomIn(...args), zoomOut: (...args: Parameters<typeof zoomOut>): ReturnType<typeof zoomOut> => _rozieExposeRef.current.zoomOut(...args), fitWidth: (...args: Parameters<typeof fitWidth>): ReturnType<typeof fitWidth> => _rozieExposeRef.current.fitWidth(...args), fitPage: (...args: Parameters<typeof fitPage>): ReturnType<typeof fitPage> => _rozieExposeRef.current.fitPage(...args), rotateCW: (...args: Parameters<typeof rotateCW>): ReturnType<typeof rotateCW> => _rozieExposeRef.current.rotateCW(...args), rotateCCW: (...args: Parameters<typeof rotateCCW>): ReturnType<typeof rotateCCW> => _rozieExposeRef.current.rotateCCW(...args), download: (...args: Parameters<typeof download>): ReturnType<typeof download> => _rozieExposeRef.current.download(...args), getMetadata: (...args: Parameters<typeof getMetadata>): ReturnType<typeof getMetadata> => _rozieExposeRef.current.getMetadata(...args), getOutline: (...args: Parameters<typeof getOutline>): ReturnType<typeof getOutline> => _rozieExposeRef.current.getOutline(...args) }), []);

  return (
    <>
    <div ref={viewerEl} {...attrs} className={clsx("rozie-pdf", (attrs.className as string | undefined))} data-rozie-s-3c863364="" />
    </>
  );
});
export default PdfViewer;
