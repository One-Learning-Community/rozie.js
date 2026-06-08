import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'rozie-pdf-viewer',
  standalone: true,
  template: `

    <div class="rozie-pdf" #viewerEl #rozieSpread_0 #rozieListenersTarget_1></div>

  `,
  styles: [`
    .rozie-pdf {
      width: 100%;
      height: 100%;
      min-height: 320px;
      overflow: auto;
      background: #525659;
      padding: 12px 0;
    }

    ::ng-deep .rozie-pdf .rozie-pdf-page {
        position: relative;
        margin: 0 auto 12px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
        background: #fff;
      }
    ::ng-deep .rozie-pdf .rozie-pdf-page canvas {
        display: block;
      }
    ::ng-deep .rozie-pdf .textLayer {
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
    ::ng-deep .rozie-pdf .textLayer span,
    ::ng-deep .rozie-pdf .textLayer br {
        color: transparent;
        position: absolute;
        white-space: pre;
        cursor: text;
        transform-origin: 0% 0%;
      }
    ::ng-deep .rozie-pdf .textLayer span.markedContent {
        top: 0;
        height: 0;
      }
    ::ng-deep .rozie-pdf .textLayer ::selection {
        background: rgba(0, 100, 255, 0.3);
      }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PdfViewer),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class PdfViewer {
  src = input<unknown>(undefined);
  page = model<number>(1);
  scale = input<number>(1);
  rotation = input<number>(0);
  workerSrc = input<string>('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs');
  standardFontDataUrl = input<string>('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/standard_fonts/');
  renderAllPages = input<boolean>(false);
  textLayer = input<boolean>(true);
  password = input<unknown>(undefined);
  options = input<Record<string, any>>((() => ({}))());
  current = signal(1);
  zoom = signal(1);
  rot = signal(0);
  viewerEl = viewChild<ElementRef<HTMLDivElement>>('viewerEl');
  error = output<unknown>();
  pagesrendered = output<void>();
  passwordrequest = output<unknown>();
  load = output<unknown>();
  pagechange = output<unknown>();
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;
  private __rozieWatchInitial_5 = true;
  private __rozieWatchInitial_6 = true;
  private __rozieWatchInitial_7 = true;
  private __rozieWatchInitial_8 = true;
  private __rozieWatchInitial_9 = true;
  private __rozieWatchInitial_10 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.src())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => this._load())(); }); });
    effect(() => { const __watchVal = (() => this.password())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => this._load())(); }); });
    effect(() => { const __watchVal = (() => this.workerSrc())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } ((v: any) => {
      if (this.pdfjsLib && v) this.pdfjsLib.GlobalWorkerOptions.workerSrc = v;
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.page())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => {
      if (typeof v === 'number' && v >= 1 && v !== this.current()) this.current.set(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.scale())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((v: any) => {
      if (typeof v === 'number' && v > 0) this.zoom.set(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.rotation())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((v: any) => {
      if (typeof v === 'number') this.rot.set((v % 360 + 360) % 360);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.current())(); untracked(() => { if (this.__rozieWatchInitial_6) { this.__rozieWatchInitial_6 = false; return; } ((v: any) => {
      this.page.set(v), this.__rozieCvaOnChange(v);
      this.pagechange.emit({
        page: v
      });
      if (this.renderAllPages()) {
        if (!this.suppressScroll) this.scrollToPage(v);
      } else this.renderView();
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.zoom())(); untracked(() => { if (this.__rozieWatchInitial_7) { this.__rozieWatchInitial_7 = false; return; } (() => this.renderView())(); }); });
    effect(() => { const __watchVal = (() => this.rot())(); untracked(() => { if (this.__rozieWatchInitial_8) { this.__rozieWatchInitial_8 = false; return; } (() => this.renderView())(); }); });
    effect(() => { const __watchVal = (() => this.renderAllPages())(); untracked(() => { if (this.__rozieWatchInitial_9) { this.__rozieWatchInitial_9 = false; return; } (() => this.renderView())(); }); });
    effect(() => { const __watchVal = (() => this.textLayer())(); untracked(() => { if (this.__rozieWatchInitial_10) { this.__rozieWatchInitial_10 = false; return; } (() => this.renderView())(); }); });
  }

  ngAfterViewInit() {
    this.cancelled = false;
    this.containerEl = this.viewerEl()?.nativeElement;
    this.current.set(Math.max(1, this.page()));
    this.zoom.set(this.scale());
    this.rot.set(this.rotation());
    // lazy-load the engine (SSR-safe + code-split), then configure the worker and
    // load the document.
    // lazy-load the engine (SSR-safe + code-split), then configure the worker and
    // load the document.
    import('pdfjs-dist').then((mod: any) => {
      if (this.cancelled) return;
      this.pdfjsLib = mod;
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = this.workerSrc();
      this._load();
    });
    this.__rozieDestroyRef.onDestroy(() => {
      this.cancelled = true;
      this.renderToken++;
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.loadingTask) {
        this.loadingTask.destroy();
        this.loadingTask = null;
      }
      this.instance = null;
    });
  }

  pdfjsLib: any = null;
  instance: any = null;
  containerEl: any = null;
  observer: any = null;
  loadingTask: any = null;
  renderToken = 0;
  suppressScroll = false;
  cancelled = false;
  buildSource = () => {
    const __password = this.password();
    const __standardFontDataUrl = this.standardFontDataUrl();
    let cfg: any = null;
    cfg = {
      ...this.options()
    };
    const src = this.src();
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
    if (__password != null) cfg.password = __password;
    if (__standardFontDataUrl) cfg.standardFontDataUrl = __standardFontDataUrl;
    return cfg;
  };
  renderPage = async (pdf: any, pageNum: any, container: any) => {
    const __zoom = this.zoom();
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({
      scale: __zoom,
      rotation: this.rot()
    });
    const pageDiv = document.createElement('div');
    pageDiv.className = 'rozie-pdf-page';
    pageDiv.setAttribute('data-page', String(pageNum));
    pageDiv.style.width = Math.floor(viewport.width) + 'px';
    pageDiv.style.height = Math.floor(viewport.height) + 'px';
    // the text layer positions its spans with calc(var(--scale-factor) * …px).
    pageDiv.style.setProperty('--scale-factor', String(__zoom));
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
    if (this.textLayer()) {
      const tl = document.createElement('div');
      tl.className = 'textLayer';
      pageDiv.appendChild(tl);
      const layer = new this.pdfjsLib.TextLayer({
        textContentSource: page.streamTextContent(),
        container: tl,
        viewport
      });
      await layer.render();
    }
    container.appendChild(pageDiv);
    return pageDiv;
  };
  setupScrollSpy = () => {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (!this.containerEl) return;
    this.observer = new IntersectionObserver((entries: any) => {
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
        if (n && n !== this.current()) {
          this.suppressScroll = true;
          this.current.set(n);
          this.suppressScroll = false;
        }
      }
    }, {
      root: this.containerEl,
      threshold: [0.25, 0.5, 0.75]
    });
    for (const child of this.containerEl.children as any) this.observer.observe(child);
  };
  scrollToPage = (n: any) => {
    if (!this.containerEl) return;
    const el = this.containerEl.querySelector('[data-page="' + n + '"]');
    if (el) el.scrollIntoView({
      block: 'start',
      behavior: 'auto'
    });
  };
  renderView = async () => {
    const __renderAllPages = this.renderAllPages();
    if (!this.instance || !this.containerEl) return;
    const token = ++this.renderToken;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.containerEl.innerHTML = '';
    const total = this.instance.numPages;
    const pages = __renderAllPages ? Array.from({
      length: total
    }, (_: any, i: any) => i + 1) : [Math.min(Math.max(this.current(), 1), total)];
    for (const n of pages as any) {
      if (token !== this.renderToken) return;
      try {
        await this.renderPage(this.instance, n, this.containerEl);
      } catch (e: any) {
        if (token === this.renderToken) this.error.emit(e);
      }
    }
    if (token !== this.renderToken) return;
    if (__renderAllPages) this.setupScrollSpy();
    this.pagesrendered.emit();
  };
  _load = async () => {
    if (!this.pdfjsLib) return;
    const token = ++this.renderToken;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    // tear down the previous load via the loading task (PDFDocumentProxy has no
    // destroy() in pdfjs v6).
    if (this.loadingTask) {
      this.loadingTask.destroy();
      this.loadingTask = null;
    }
    this.instance = null;
    if (this.containerEl) this.containerEl.innerHTML = '';
    if (!this.src()) return;
    try {
      this.loadingTask = this.pdfjsLib.getDocument(this.buildSource());
      this.loadingTask.onPassword = (_updatePassword: any, reason: any) => {
        this.passwordrequest.emit({
          reason
        });
      };
      const pdf = await this.loadingTask.promise;
      // stale (a newer load bumped the token + destroyed this task) — drop it.
      if (token !== this.renderToken) return;
      this.instance = pdf;
      if (this.current() > pdf.numPages) this.current.set(pdf.numPages);
      this.load.emit({
        numPages: pdf.numPages
      });
      await this.renderView();
    } catch (e: any) {
      // a destroyed task rejects its promise — suppress the abort for stale loads.
      if (token === this.renderToken) this.error.emit(e);
    }
  };
  applyFit = async (mode: any) => {
    if (!this.instance || !this.containerEl) return;
    const n = Math.min(Math.max(this.current(), 1), this.instance.numPages);
    const page = await this.instance.getPage(n);
    const vp = page.getViewport({
      scale: 1,
      rotation: this.rot()
    });
    const cw = this.containerEl.clientWidth - 24;
    const ch = this.containerEl.clientHeight - 24;
    if (mode === 'width') this.zoom.set(cw / vp.width);else this.zoom.set(Math.min(cw / vp.width, ch / vp.height));
  };
  getDocument = () => {
    return this.instance;
  };
  getPageCount = () => {
    return this.instance ? this.instance.numPages : 0;
  };
  goToPage = (n: any) => {
    if (!this.instance) return;
    this.current.set(Math.min(Math.max(n, 1), this.instance.numPages));
  };
  nextPage = () => {
    this.goToPage(this.current() + 1);
  };
  prevPage = () => {
    this.goToPage(this.current() - 1);
  };
  setScale = (s: any) => {
    if (typeof s === 'number' && s > 0) this.zoom.set(s);
  };
  zoomIn = () => {
    this.zoom.set(Math.min(this.zoom() * 1.25, 10));
  };
  zoomOut = () => {
    this.zoom.set(Math.max(this.zoom() / 1.25, 0.1));
  };
  fitWidth = () => {
    this.applyFit('width');
  };
  fitPage = () => {
    this.applyFit('page');
  };
  rotateCW = () => {
    this.rot.set((this.rot() + 90) % 360);
  };
  rotateCCW = () => {
    this.rot.set((this.rot() + 270) % 360);
  };

  private __rozieCvaOnChange: (v: number) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  private __rozieCvaDisabled = signal(false);

  writeValue(v: number | null): void {
    this.page.set(v ?? 1);
  }
  registerOnChange(fn: (v: number) => void): void {
    this.__rozieCvaOnChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.__rozieCvaOnTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.__rozieCvaDisabled.set(isDisabled);
  }
  __rozieCvaOnTouched(): void {
    this.__rozieCvaOnTouchedFn();
  }

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    const prevClassTokensByElement = new WeakMap<HTMLElement, string[]>();
    const prevStylePropsByElement = new WeakMap<HTMLElement, string[]>();
    const parseClassTokens = (value: unknown): string[] => {
      if (typeof value !== 'string') return [];
      const out: string[] = [];
      for (const tok of value.split(/\s+/)) {
        if (tok.length > 0) out.push(tok);
      }
      return out;
    };
    const parseStyleDecls = (value: unknown): Array<[string, string]> => {
      if (typeof value !== 'string') return [];
      const out: Array<[string, string]> = [];
      for (const decl of value.split(';')) {
        const colon = decl.indexOf(':');
        if (colon < 0) continue;
        const prop = decl.slice(0, colon).trim();
        const val = decl.slice(colon + 1).trim();
        if (prop.length > 0) out.push([prop, val]);
      }
      return out;
    };
    const applyClassMerge = (el: HTMLElement, value: unknown) => {
      const next = parseClassTokens(value);
      const prev = prevClassTokensByElement.get(el) ?? [];
      const nextSet = new Set(next);
      for (const tok of prev) {
        if (!nextSet.has(tok)) el.classList.remove(tok);
      }
      for (const tok of next) el.classList.add(tok);
      prevClassTokensByElement.set(el, next);
    };
    const applyStyleMerge = (el: HTMLElement, value: unknown) => {
      const next = parseStyleDecls(value);
      const prev = prevStylePropsByElement.get(el) ?? [];
      const nextProps = next.map(([p]) => p);
      const nextSet = new Set(nextProps);
      for (const prop of prev) {
        if (!nextSet.has(prop)) el.style.removeProperty(prop);
      }
      for (const [prop, val] of next) el.style.setProperty(prop, val, 'important');
      prevStylePropsByElement.set(el, nextProps);
    };
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (k === 'class' || k === 'style') continue;
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      if (!('class' in safeObj) && prevClassTokensByElement.has(el)) {
        applyClassMerge(el, '');
      }
      if (!('style' in safeObj) && prevStylePropsByElement.has(el)) {
        applyStyleMerge(el, '');
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (k === 'class') {
          applyClassMerge(el, v);
        } else if (k === 'style') {
          applyStyleMerge(el, v);
        } else if (v === null || v === false) {
          renderer.removeAttribute(el, k);
        } else {
          renderer.setAttribute(el, k, String(v));
        }
      }
      prevKeysByElement.set(el, Object.keys(safeObj));
    };
  })();

  private __rozieGetHostAttrs = (() => {
    const host = inject(ElementRef);
    return () => {
      const el = host.nativeElement as HTMLElement;
      const out: Record<string, unknown> = {};
      for (const a of Array.from(el.attributes)) out[a.name] = a.value;
      return out;
    };
  })();

  private __rozieSpread_0_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  private rozieListenersTarget_1 = viewChild<ElementRef>('rozieListenersTarget_1');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_1: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_1 = false;

  private __rozieListenersEffect_1 = effect(() => {
    const el = this.rozieListenersTarget_1()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_1) off();
    this.__rozieListenersDisposers_1 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_1.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_1) {
      this.__rozieListenersDestroyRegistered_1 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_1) off();
        this.__rozieListenersDisposers_1 = [];
      });
    }
  });
}

export default PdfViewer;
