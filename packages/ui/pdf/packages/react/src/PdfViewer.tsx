import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import './PdfViewer.css';
import './PdfViewer.global.css';
import * as pdfjsLib from 'pdfjs-dist';

// null-lets so the bundled-leaf typeNeutralize pass annotates them `any`:
// `instance` is the PDFDocumentProxy (whose strict types the loosely-typed props
// don't satisfy — routing the render chain through `any` is the maplibre
// mapOptions idiom), containerEl is the scroll host, observer is the
// continuous-mode scroll spy.

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
}

const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(_props: PdfViewerProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const props: Omit<PdfViewerProps, 'src' | 'scale' | 'rotation' | 'workerSrc' | 'renderAllPages' | 'textLayer' | 'password' | 'options'> & { src: unknown; scale: number; rotation: number; workerSrc: string; renderAllPages: boolean; textLayer: boolean; password: unknown; options: Record<string, any> } = {
    ..._props,
    src: _props.src ?? undefined,
    scale: _props.scale ?? 1,
    rotation: _props.rotation ?? 0,
    workerSrc: _props.workerSrc ?? 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs',
    renderAllPages: _props.renderAllPages ?? false,
    textLayer: _props.textLayer ?? true,
    password: _props.password ?? undefined,
    options: _props.options ?? __defaultOptions,
  };
  const attrs: Record<string, unknown> = (() => {
    const { src, page, scale, rotation, workerSrc, renderAllPages, textLayer, password, options, defaultValue, onPageChange, defaultPage, ...rest } = _props as PdfViewerProps & Record<string, unknown>;
    void src; void page; void scale; void rotation; void workerSrc; void renderAllPages; void textLayer; void password; void options; void defaultValue; void onPageChange; void defaultPage;
    return rest;
  })();
  const containerEl = useRef<any>(null);
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

  function buildSource() {
    let cfg: any = null;
    cfg = {
      ...props.options
    };
    const src = props.src;
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
    if (props.password != null) cfg.password = props.password;
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
  const { onError: _rozieProp_onError, onLoad: _rozieProp_onLoad, onPasswordrequest: _rozieProp_onPasswordrequest } = props;
    const load = useCallback(async () => {
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
      loadingTask.current = pdfjsLib.getDocument(buildSource());
      loadingTask.current.onPassword = (_updatePassword: any, reason: any) => {
        _rozieProp_onPasswordrequest && _rozieProp_onPasswordrequest({
          reason
        });
      };
      const pdf = await loadingTask.current.promise;
      // stale (a newer load bumped the token + destroyed this task) — drop it.
      if (token !== renderToken.current) return;
      instance.current = pdf;
      if (current > pdf.numPages) setCurrent(pdf.numPages);
      _rozieProp_onLoad && _rozieProp_onLoad({
        numPages: pdf.numPages
      });
      await renderView();
    } catch (e: any) {
      // a destroyed task rejects its promise — suppress the abort for stale loads.
      if (token === renderToken.current) _rozieProp_onError && _rozieProp_onError(e);
    }
  }, [_rozieProp_onError, _rozieProp_onLoad, _rozieProp_onPasswordrequest, buildSource, current, props.src, renderView]);
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
  // 12 verbs. Collision-clear: NO `setPage` (React `page`-model auto-setter,
  // ROZ524 — use goToPage); none equals an emit name (load/error/pagechange/
  // pagesrendered/passwordrequest); none is a Lit reserved lifecycle. All drive
  // $data (not the props), so they work whether or not the consumer binds `page`.
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

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = _workerSrcRef.current;
    containerEl.current = viewerEl.current;
    setCurrent(Math.max(1, _pageRef.current));
    setZoom(_scaleRef.current);
    setRot(_rotationRef.current);
    load();
    return () => {
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
  }, [props.src]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    load();
  }, [props.password]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    const v = props.workerSrc;
    if (v) pdfjsLib.GlobalWorkerOptions.workerSrc = v;
  }, [props.workerSrc]);
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    const v = page;
    if (typeof v === 'number' && v >= 1 && v !== current) setCurrent(v);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    const v = props.scale;
    if (typeof v === 'number' && v > 0) setZoom(v);
  }, [props.scale]);
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
    const v = props.rotation;
    if (typeof v === 'number') setRot((v % 360 + 360) % 360);
  }, [props.rotation]);
  useEffect(() => {
    if (_watch6First.current) { _watch6First.current = false; return; }
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
    if (_watch7First.current) { _watch7First.current = false; return; }
    renderView();
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch8First.current) { _watch8First.current = false; return; }
    renderView();
  }, [rot]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch9First.current) { _watch9First.current = false; return; }
    renderView();
  }, [props.renderAllPages]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch10First.current) { _watch10First.current = false; return; }
    renderView();
  }, [props.textLayer]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({ getDocument, getPageCount, goToPage, nextPage, prevPage, setScale, zoomIn, zoomOut, fitWidth, fitPage, rotateCW, rotateCCW }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div ref={viewerEl} {...attrs} className={clsx("rozie-pdf", (attrs.className as string | undefined))} data-rozie-s-3c863364="" />
    </>
  );
});
export default PdfViewer;
