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
    ::ng-deep .rozie-pdf .textLayer span.rozie-pdf-find {
        background: rgba(255, 196, 0, 0.45);
        border-radius: 2px;
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
  /**
   * The PDF source — a URL string, a `data:` base64 URL, or binary data (`ArrayBuffer` / `Uint8Array`). Changing it tears down the previous document (via its loading task) and loads the new one; `undefined` renders an empty viewer.
   * @example
   * <PdfViewer :src="pdfUrl" r-model:page="page" />
   */
  src = input<unknown>(undefined);
  /**
   * The 1-based current page. The sole `model: true` prop — **two-way** (`r-model:page` / `v-model:page` / `bind:page` / `[(page)]`), so `page` also drives the Angular `ControlValueAccessor`. In single-page mode it drives which page renders; in `render-all-pages` mode it reflects the scrolled-to page (and scrolls the container when the consumer writes it). Clamped to `[1, pageCount]`.
   */
  page = model<number>(1);
  /**
   * The zoom scale (`1` = 100%). One-way: the `setScale` / `zoomIn` / `zoomOut` / `fitWidth` / `fitPage` handle verbs override it imperatively, while a consumer write reconciles the live render.
   */
  scale = input<number>(1);
  /**
   * Rotation in degrees (`0` / `90` / `180` / `270`). One-way: the `rotateCW` / `rotateCCW` verbs override it. Normalized into `[0, 360)`.
   */
  rotation = input<number>(0);
  /**
   * The PDF.js worker URL, set on `GlobalWorkerOptions.workerSrc` before loading. Defaults to the jsDelivr CDN copy matching the installed `pdfjs-dist`'s own `.version` (read at runtime, not a hand-typed string), so the component works with zero config and the default can't drift from the engine version your app resolves. Override for offline / a strict CSP / a bundled worker.
   */
  workerSrc = input<string>(undefined);
  /**
   * The directory of PDF.js's standard-font data so the base-14 fonts (Helvetica / Times / Courier / …) render with correct glyphs. Defaults to the jsDelivr CDN dir matching the installed `pdfjs-dist`'s own `.version` (same runtime-version rationale as `workerSrc`). Override (or pass a bundled dir) for offline / a strict CSP.
   */
  standardFontDataUrl = input<string>(undefined);
  /**
   * `false` (default) renders a single page with nav (the two-way `page` drives it). `true` renders a continuous scroll of every page; the most-visible page reflects back into `page` and the `pagechange` event via an `IntersectionObserver`.
   */
  renderAllPages = input<boolean>(false);
  /**
   * Render PDF.js's selectable / copyable text-layer spans over each page canvas (the differentiator vs a dumb canvas image). On by default; the required `.textLayer` CSS + `--scale-factor` var ship with the component, so no extra import is needed.
   */
  textLayer = input<boolean>(true);
  /**
   * Password for an encrypted PDF. If the document is encrypted and no (or a wrong) password is set, the `passwordrequest` event fires with `{ reason }`. Changing it reloads the document.
   */
  password = input<unknown>(undefined);
  /**
   * A reactive search query — the **controlled** alternative to the imperative `find()` handle. Setting it to a non-empty string scans every page, navigates to + coarse-highlights the first match, and emits `findresult` with the total occurrence count; clearing it (empty string / `null`) clears the highlight. Reactive so it works uniformly across all six targets (an Angular child-component `ref` cannot reach the `$expose` handle from a template event handler — the same reason `page` is a two-way model rather than a handle call).
   */
  query = input<unknown>(undefined);
  /**
   * Opt-in resize-observed auto-refit: `'width'` calls the equivalent of `fitWidth()` whenever the container resizes; `'page'` calls the equivalent of `fitPage()`. Unset (default) leaves today's behavior unchanged — no automatic refit; wire your own resize sensor if you need one. **Not recommended combined with a content-driven container height** (see the no-scroll container recipe): `'page'` mode measures both width and height, and a `height: auto` container can feedback-loop with the refit. `'width'` mode has no such risk — its measurement stays layout-driven either way.
   */
  autoFit = input<unknown>(undefined);
  /**
   * Raw `getDocument` `DocumentInitParameters` passthrough — spread **before** the curated keys (explicit `src` / `password` win). For `cMapUrl`, `httpHeaders`, `withCredentials`, etc.
   */
  options = input<Record<string, any>>((() => ({}))());
  current = signal(1);
  zoom = signal(1);
  rot = signal(0);
  engineReady = signal(0);
  viewerEl = viewChild<ElementRef<HTMLDivElement>>('viewerEl');
  pagerendered = output<unknown>();
  error = output<unknown>();
  pagesrendered = output<void>();
  passwordrequest = output<unknown>();
  progress = output<unknown>();
  load = output<unknown>();
  pagechange = output<unknown>();
  findresult = output<unknown>();
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
  private __rozieWatchInitial_11 = true;
  private __rozieWatchInitial_12 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.engineReady())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => this._load())(); }); });
    effect(() => { const __watchVal = (() => this.src())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => this._load())(); }); });
    effect(() => { const __watchVal = (() => this.password())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => this._load())(); }); });
    effect(() => { const __watchVal = (() => this.workerSrc())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => {
      if (this.pdfjsLib && v) this.pdfjsLib.GlobalWorkerOptions.workerSrc = v;
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.page())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((v: any) => {
      if (typeof v === 'number' && v >= 1 && v !== this.current()) {
        this.current.set(v);
        if (this.renderAllPages()) this.scrollToPage(v);
      }
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.scale())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((v: any) => {
      if (typeof v === 'number' && v > 0) this.zoom.set(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.rotation())(); untracked(() => { if (this.__rozieWatchInitial_6) { this.__rozieWatchInitial_6 = false; return; } ((v: any) => {
      if (typeof v === 'number') this.rot.set((v % 360 + 360) % 360);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.current())(); untracked(() => { if (this.__rozieWatchInitial_7) { this.__rozieWatchInitial_7 = false; return; } ((v: any) => {
      this.page.set(v), this.__rozieCvaOnChange(v);
      this.pagechange.emit({
        page: v
      });
      if (!this.renderAllPages()) this.renderView();
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.zoom())(); untracked(() => { if (this.__rozieWatchInitial_8) { this.__rozieWatchInitial_8 = false; return; } (() => this.renderView())(); }); });
    effect(() => { const __watchVal = (() => this.rot())(); untracked(() => { if (this.__rozieWatchInitial_9) { this.__rozieWatchInitial_9 = false; return; } (() => this.renderView())(); }); });
    effect(() => { const __watchVal = (() => this.renderAllPages())(); untracked(() => { if (this.__rozieWatchInitial_10) { this.__rozieWatchInitial_10 = false; return; } (() => this.renderView())(); }); });
    effect(() => { const __watchVal = (() => this.textLayer())(); untracked(() => { if (this.__rozieWatchInitial_11) { this.__rozieWatchInitial_11 = false; return; } (() => this.renderView())(); }); });
    effect(() => { const __watchVal = (() => this.query())(); untracked(() => { if (this.__rozieWatchInitial_12) { this.__rozieWatchInitial_12 = false; return; } ((v: any) => {
      if (v == null) return;
      const q = String(v);
      if (q) this.find(q);else this.clearFind();
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    // mount-local (not a top-level script `let`) — set here so a late-resolving
    // dynamic import() below bails, and read by the returned teardown. Emitter-
    // hardening backlog item #2 (project_emitter_hardening_backlog): every
    // target keeps a $onMount setup-local in scope for its own returned
    // teardown, so this no longer needs the prior TOP-LEVEL-`let` workaround.
    let cancelled = false;
    this.containerEl = this.viewerEl()?.nativeElement;
    this.current.set(Math.max(1, this.page()));
    this.zoom.set(this.scale());
    this.rot.set(this.rotation());
    // autoFit resize sensor — always observing (cheap when idle); the callback
    // itself gates on the current $props.autoFit so toggling it at runtime needs
    // no observer teardown/recreation. No-ops via applyFit's own instance/
    // containerEl guard before a document has loaded.
    // autoFit resize sensor — always observing (cheap when idle); the callback
    // itself gates on the current $props.autoFit so toggling it at runtime needs
    // no observer teardown/recreation. No-ops via applyFit's own instance/
    // containerEl guard before a document has loaded.
    this.resizeObserver = new ResizeObserver(() => {
      const __autoFit = this.autoFit();
      if (__autoFit) this.applyFit(__autoFit === 'width' ? 'width' : 'page');
    });
    this.resizeObserver.observe(this.containerEl);
    // lazy-load the engine (SSR-safe + code-split), then configure the worker and
    // load the document.
    // lazy-load the engine (SSR-safe + code-split), then configure the worker and
    // load the document.
    import('pdfjs-dist').then((mod: any) => {
      if (cancelled) return;
      this.pdfjsLib = mod;
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = this.workerSrc() || this.cdnBase() + '/build/pdf.worker.min.mjs';
      // hand off to the lazy $watch below rather than calling load() from this
      // (React: mount-frozen) closure — see the $data.engineReady note above.
      this.engineReady.set(this.engineReady() + 1);
    });
    this.__rozieDestroyRef.onDestroy(() => {
      cancelled = true;
      this.renderToken++;
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      if (this.loadingTask) {
        this.loadingTask.destroy();
        this.loadingTask = null;
      }
      this.instance = null;
    });
  }

  pdfjsLib: any = null;
  cdnBase = () => {
    return 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + this.pdfjsLib.version;
  };
  instance: any = null;
  containerEl: any = null;
  observer: any = null;
  resizeObserver: any = null;
  loadingTask: any = null;
  renderToken = 0;
  findQuery = '';
  findMatches = [];
  findIndex = -1;
  buildSource = () => {
    const __password = this.password();
    let cfg: any = null;
    cfg = {
      ...this.options()
    };
    // NOTE: the local must NOT be named `src` — a local `const src = $props.src`
    // (same name as the `src` prop) hits a Svelte-emitter scope bug where the
    // renamed local's initializer mis-resolves to itself (`const src2 = src2`, a
    // TDZ ReferenceError) instead of the prop accessor. Naming it `srcInput`
    // sidesteps the shadow on every target.
    const srcInput = this.src();
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
      // clone before handing to pdfjs — getDocument() transfers cfg.data.buffer to
      // the worker, which DETACHES the source ArrayBuffer (byteLength -> 0). A
      // consumer that reuses the same reference (remount, re-render with the same
      // src, password retry) would then load from an empty buffer and throw. The
      // clone is the throwaway that gets transferred; the caller's array survives.
      cfg.data = srcInput instanceof Uint8Array ? srcInput.slice() : srcInput;
    }
    if (__password != null) cfg.password = __password;
    cfg.standardFontDataUrl = this.standardFontDataUrl() || this.cdnBase() + '/standard_fonts/';
    return cfg;
  };
  renderPage = async (pdf: any, pageNum: any, container: any) => {
    const __zoom = this.zoom();
    const __rot = this.rot();
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({
      scale: __zoom,
      rotation: __rot
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
      // coarse find-highlight: add .rozie-pdf-find to text-layer spans whose text
      // CONTAINS the active query. Span-level / COARSE — a query straddling two
      // adjacent spans won't highlight (documented). Runs only while a find is active.
      if (this.findQuery) {
        const spans = tl.querySelectorAll('span');
        for (const sp of spans as any) {
          const t = sp.textContent;
          if (t && t.toLowerCase().indexOf(this.findQuery) !== -1) sp.classList.add('rozie-pdf-find');
        }
      }
    }
    container.appendChild(pageDiv);
    // reactive per-page geometry for a consumer overlay — see the DOM contract
    // docs. Fired once the page is in the document (appendChild above), so
    // getBoundingClientRect() etc. are valid immediately. pageDiv itself is NOT
    // stable across zoom/rotation/mode changes (renderView() rebuilds every page
    // from scratch on those) — re-acquire via getPageElement() each time this
    // fires for a given pageNumber, don't cache the node.
    this.pagerendered.emit({
      pageNumber: pageNum,
      viewport,
      scale: __zoom,
      rotation: __rot,
      width: Math.floor(viewport.width),
      height: Math.floor(viewport.height)
    });
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
        if (n && n !== this.current()) this.current.set(n);
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
      // download progress in bytes; `total` may be 0/undefined when the server sends
      // no Content-Length header — pass the raw pdfjs onProgress payload through as-is.
      this.loadingTask.onProgress = (p: any) => this.progress.emit({
        loaded: p && p.loaded,
        total: p && p.total
      });
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
    const clamped = Math.min(Math.max(n, 1), this.instance.numPages);
    this.current.set(clamped);
    // programmatic navigation origin — scroll the target into view in continuous
    // mode (single-page mode re-renders that page via the $data.current $watch).
    // Called unconditionally (not gated on a change) so an explicit re-navigation
    // to the page the user has scrolled partly out of view re-centers it.
    if (this.renderAllPages()) this.scrollToPage(clamped);
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
  download = async (filename: any) => {
    if (!this.instance) return false;
    const bytes = await this.instance.getData();
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
  };
  getMetadata = () => {
    return this.instance ? this.instance.getMetadata() : null;
  };
  getOutline = () => {
    return this.instance ? this.instance.getOutline() : null;
  };
  getPageElement = (n: any) => {
    return this.containerEl ? this.containerEl.querySelector('[data-page="' + n + '"]') : null;
  };
  find = async (query: any) => {
    const q = (query == null ? '' : String(query)).trim().toLowerCase();
    this.findQuery = q;
    this.findMatches = [];
    this.findIndex = -1;
    if (!this.instance || !q) {
      this.renderView();
      this.findresult.emit({
        query: q,
        matches: 0,
        current: 0
      });
      return 0;
    }
    const total = this.instance.numPages;
    for (let p = 1; p <= total; p++) {
      const page = await this.instance.getPage(p);
      const tc = await page.getTextContent();
      const text = tc.items.map((it: any) => it && it.str != null ? it.str : '').join('').toLowerCase();
      let from = 0;
      while (true) {
        const at = text.indexOf(q, from);
        if (at === -1) break;
        this.findMatches.push({
          page: p
        });
        from = at + q.length;
      }
    }
    if (this.findMatches.length) {
      this.findIndex = 0;
      const target = this.findMatches[0].page;
      // navigate if needed; if already on the target page, force a re-render so the
      // highlight pass runs (a no-op goToPage wouldn't trip the $data.current $watch).
      if (target !== this.current()) this.goToPage(target);else this.renderView();
    } else {
      this.renderView();
    }
    this.findresult.emit({
      query: q,
      matches: this.findMatches.length,
      current: this.findMatches.length ? 1 : 0
    });
    return this.findMatches.length;
  };
  findNext = () => {
    if (!this.findMatches.length) return;
    this.findIndex = (this.findIndex + 1) % this.findMatches.length;
    const target = this.findMatches[this.findIndex].page;
    if (target !== this.current()) this.goToPage(target);
    this.findresult.emit({
      query: this.findQuery,
      matches: this.findMatches.length,
      current: this.findIndex + 1
    });
  };
  findPrev = () => {
    if (!this.findMatches.length) return;
    this.findIndex = (this.findIndex - 1 + this.findMatches.length) % this.findMatches.length;
    const target = this.findMatches[this.findIndex].page;
    if (target !== this.current()) this.goToPage(target);
    this.findresult.emit({
      query: this.findQuery,
      matches: this.findMatches.length,
      current: this.findIndex + 1
    });
  };
  clearFind = () => {
    this.findQuery = '';
    this.findMatches = [];
    this.findIndex = -1;
    this.renderView();
    this.findresult.emit({
      query: '',
      matches: 0,
      current: 0
    });
  };

  private __rozieCvaOnChange: (v: number) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

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
