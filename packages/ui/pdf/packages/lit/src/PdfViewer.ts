import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty, injectGlobalStyles, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-pdf-viewer')
export default class PdfViewer extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-pdf[data-rozie-s-3c863364] {
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
  }
`;

  /**
   * The PDF source — a URL string, a `data:` base64 URL, or binary data (`ArrayBuffer` / `Uint8Array`). Changing it tears down the previous document (via its loading task) and loads the new one; `undefined` renders an empty viewer.
   * @example
   * <PdfViewer :src="pdfUrl" r-model:page="page" />
   */
  @property({ type: Object }) src: unknown = undefined;
  /**
   * The 1-based current page. The sole `model: true` prop — **two-way** (`r-model:page` / `v-model:page` / `bind:page` / `[(page)]`), so `page` also drives the Angular `ControlValueAccessor`. In single-page mode it drives which page renders; in `render-all-pages` mode it reflects the scrolled-to page (and scrolls the container when the consumer writes it). Clamped to `[1, pageCount]`.
   */
  @property({ type: Number, attribute: 'page' }) _page_attr: number = 1;
  private _pageControllable = createLitControllableProperty<number>({ host: this, eventName: 'page-change', defaultValue: 1, initialControlledValue: undefined });
  /**
   * The zoom scale (`1` = 100%). One-way: the `setScale` / `zoomIn` / `zoomOut` / `fitWidth` / `fitPage` handle verbs override it imperatively, while a consumer write reconciles the live render.
   */
  @property({ type: Number, reflect: true }) scale: number = 1;
  /**
   * Rotation in degrees (`0` / `90` / `180` / `270`). One-way: the `rotateCW` / `rotateCCW` verbs override it. Normalized into `[0, 360)`.
   */
  @property({ type: Number, reflect: true }) rotation: number = 0;
  /**
   * The PDF.js worker URL, set on `GlobalWorkerOptions.workerSrc` before loading. Defaults to the jsDelivr CDN copy matching the installed `pdfjs-dist`'s own `.version` (read at runtime, not a hand-typed string), so the component works with zero config and the default can't drift from the engine version your app resolves. Override for offline / a strict CSP / a bundled worker.
   */
  @property({ type: String, reflect: true }) workerSrc: string = undefined;
  /**
   * The directory of PDF.js's standard-font data so the base-14 fonts (Helvetica / Times / Courier / …) render with correct glyphs. Defaults to the jsDelivr CDN dir matching the installed `pdfjs-dist`'s own `.version` (same runtime-version rationale as `workerSrc`). Override (or pass a bundled dir) for offline / a strict CSP.
   */
  @property({ type: String, reflect: true }) standardFontDataUrl: string = undefined;
  /**
   * `false` (default) renders a single page with nav (the two-way `page` drives it). `true` renders a continuous scroll of every page; the most-visible page reflects back into `page` and the `pagechange` event via an `IntersectionObserver`.
   */
  @property({ type: Boolean, reflect: true }) renderAllPages: boolean = false;
  /**
   * Render PDF.js's selectable / copyable text-layer spans over each page canvas (the differentiator vs a dumb canvas image). On by default; the required `.textLayer` CSS + `--scale-factor` var ship with the component, so no extra import is needed.
   */
  @property({ type: Boolean, reflect: true }) textLayer: boolean = true;
  /**
   * Password for an encrypted PDF. If the document is encrypted and no (or a wrong) password is set, the `passwordrequest` event fires with `{ reason }`. Changing it reloads the document.
   */
  @property({ type: Object }) password: unknown = undefined;
  /**
   * A reactive search query — the **controlled** alternative to the imperative `find()` handle. Setting it to a non-empty string scans every page, navigates to + coarse-highlights the first match, and emits `findresult` with the total occurrence count; clearing it (empty string / `null`) clears the highlight. Reactive so it works uniformly across all six targets (an Angular child-component `ref` cannot reach the `$expose` handle from a template event handler — the same reason `page` is a two-way model rather than a handle call).
   */
  @property({ type: Object }) query: unknown = undefined;
  /**
   * Opt-in resize-observed auto-refit: `'width'` calls the equivalent of `fitWidth()` whenever the container resizes; `'page'` calls the equivalent of `fitPage()`. Unset (default) leaves today's behavior unchanged — no automatic refit; wire your own resize sensor if you need one. **Not recommended combined with a content-driven container height** (see the no-scroll container recipe): `'page'` mode measures both width and height, and a `height: auto` container can feedback-loop with the refit. `'width'` mode has no such risk — its measurement stays layout-driven either way.
   */
  @property({ type: Object }) autoFit: unknown = undefined;
  /**
   * Raw `getDocument` `DocumentInitParameters` passthrough — spread **before** the curated keys (explicit `src` / `password` win). For `cMapUrl`, `httpHeaders`, `withCredentials`, etc.
   */
  @property({ type: Object }) options: any = {};
  private _current = signal(1);
  private _zoom = signal(1);
  private _rot = signal(0);
  private _engineReady = signal(0);
  @query('[data-rozie-ref="viewerEl"]') private _refViewerEl!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieWatchInitial_4 = true;
private __rozieWatchInitial_7 = true;
private __rozieWatchInitial_8 = true;
private __rozieWatchInitial_9 = true;
private __rozieFirstUpdateDone = false;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this._disconnectCleanups.push((() => {
      this.cancelled = true;
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
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._engineReady.value)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => this.load())(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.page)(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((v: any) => {
      if (typeof v === 'number' && v >= 1 && v !== this._current.value) {
        this._current.value = v;
        if (this.renderAllPages) this.scrollToPage(v);
      }
    })(__watchVal); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._current.value)(); untracked(() => { if (this.__rozieWatchInitial_7) { this.__rozieWatchInitial_7 = false; return; } ((v: any) => {
      this._pageControllable.write(v);
      this.dispatchEvent(new CustomEvent("pagechange", {
        detail: {
          page: v
        },
        bubbles: true,
        composed: true
      }));
      if (!this.renderAllPages) this.renderView();
    })(__watchVal); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._zoom.value)(); untracked(() => { if (this.__rozieWatchInitial_8) { this.__rozieWatchInitial_8 = false; return; } (() => this.renderView())(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._rot.value)(); untracked(() => { if (this.__rozieWatchInitial_9) { this.__rozieWatchInitial_9 = false; return; } (() => this.renderView())(); }); }));

    this.cancelled = false;
    this.containerEl = this._refViewerEl;
    this._current.value = Math.max(1, this.page);
    this._zoom.value = this.scale;
    this._rot.value = this.rotation;
    // autoFit resize sensor — always observing (cheap when idle); the callback
    // itself gates on the current $props.autoFit so toggling it at runtime needs
    // no observer teardown/recreation. No-ops via applyFit's own instance/
    // containerEl guard before a document has loaded.
    // autoFit resize sensor — always observing (cheap when idle); the callback
    // itself gates on the current $props.autoFit so toggling it at runtime needs
    // no observer teardown/recreation. No-ops via applyFit's own instance/
    // containerEl guard before a document has loaded.
    this.resizeObserver = new ResizeObserver(() => {
      if (this.autoFit) this.applyFit(this.autoFit === 'width' ? 'width' : 'page');
    });
    this.resizeObserver.observe(this.containerEl);
    // lazy-load the engine (SSR-safe + code-split), then configure the worker and
    // load the document.
    // lazy-load the engine (SSR-safe + code-split), then configure the worker and
    // load the document.
    import('pdfjs-dist').then((mod: any) => {
      if (this.cancelled) return;
      this.pdfjsLib = mod;
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = this.workerSrc || this.cdnBase() + '/build/pdf.worker.min.mjs';
      // hand off to the lazy $watch below rather than calling load() from this
      // (React: mount-frozen) closure — see the $data.engineReady note above.
      this._engineReady.value++;
    });
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('src'))) { const __watchVal = (() => this.src)(); (() => this.load())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('password'))) { const __watchVal = (() => this.password)(); (() => this.load())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('workerSrc'))) { const __watchVal = (() => this.workerSrc)(); ((v: any) => {
      if (this.pdfjsLib && v) this.pdfjsLib.GlobalWorkerOptions.workerSrc = v;
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('scale'))) { const __watchVal = (() => this.scale)(); ((v: any) => {
      if (typeof v === 'number' && v > 0) this._zoom.value = v;
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('rotation'))) { const __watchVal = (() => this.rotation)(); ((v: any) => {
      if (typeof v === 'number') this._rot.value = (v % 360 + 360) % 360;
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('renderAllPages'))) { const __watchVal = (() => this.renderAllPages)(); (() => this.renderView())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('textLayer'))) { const __watchVal = (() => this.textLayer)(); (() => this.renderView())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('query'))) { const __watchVal = (() => this.query)(); ((v: any) => {
      if (v == null) return;
      const q = String(v);
      if (q) this.find(q);else this.clearFind();
    })(__watchVal); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'page') this._pageControllable.notifyAttributeChange(value === null ? 1 : Number(value));
  }

  render() {
    return html`
<div class="rozie-pdf" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="viewerEl" data-rozie-s-3c863364></div>
`;
  }

  pdfjsLib: any = null;

  cdnBase() {
    return 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + this.pdfjsLib.version;
  }

  instance: any = null;

  containerEl: any = null;

  observer: any = null;

  resizeObserver: any = null;

  loadingTask: any = null;

  renderToken = 0;

  findQuery = '';

  findMatches = [];

  findIndex = -1;

  cancelled = false;

  buildSource = () => {
  let cfg: any = null;
  cfg = {
    ...this.options
  };
  // NOTE: the local must NOT be named `src` — a local `const src = $props.src`
  // (same name as the `src` prop) hits a Svelte-emitter scope bug where the
  // renamed local's initializer mis-resolves to itself (`const src2 = src2`, a
  // TDZ ReferenceError) instead of the prop accessor. Naming it `srcInput`
  // sidesteps the shadow on every target.
  const srcInput = this.src;
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
  if (this.password != null) cfg.password = this.password;
  cfg.standardFontDataUrl = this.standardFontDataUrl || this.cdnBase() + '/standard_fonts/';
  return cfg;
};

  renderPage = async (pdf: any, pageNum: any, container: any) => {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({
    scale: this._zoom.value,
    rotation: this._rot.value
  });
  const pageDiv = document.createElement('div');
  pageDiv.className = 'rozie-pdf-page';
  pageDiv.setAttribute('data-page', String(pageNum));
  pageDiv.style.width = Math.floor(viewport.width) + 'px';
  pageDiv.style.height = Math.floor(viewport.height) + 'px';
  // the text layer positions its spans with calc(var(--scale-factor) * …px).
  pageDiv.style.setProperty('--scale-factor', String(this._zoom.value));
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
  if (this.textLayer) {
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
  this.dispatchEvent(new CustomEvent("pagerendered", {
    detail: {
      pageNumber: pageNum,
      viewport,
      scale: this._zoom.value,
      rotation: this._rot.value,
      width: Math.floor(viewport.width),
      height: Math.floor(viewport.height)
    },
    bubbles: true,
    composed: true
  }));
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
      if (n && n !== this._current.value) this._current.value = n;
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
  if (!this.instance || !this.containerEl) return;
  const token = ++this.renderToken;
  if (this.observer) {
    this.observer.disconnect();
    this.observer = null;
  }
  this.containerEl.innerHTML = '';
  const total = this.instance.numPages;
  const pages = this.renderAllPages ? Array.from({
    length: total
  }, (_: any, i: any) => i + 1) : [Math.min(Math.max(this._current.value, 1), total)];
  for (const n of pages as any) {
    if (token !== this.renderToken) return;
    try {
      await this.renderPage(this.instance, n, this.containerEl);
    } catch (e: any) {
      if (token === this.renderToken) this.dispatchEvent(new CustomEvent("error", {
        detail: e,
        bubbles: true,
        composed: true
      }));
    }
  }
  if (token !== this.renderToken) return;
  if (this.renderAllPages) this.setupScrollSpy();
  this.dispatchEvent(new CustomEvent("pagesrendered", {
    detail: undefined,
    bubbles: true,
    composed: true
  }));
};

  load = async () => {
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
  if (!this.src) return;
  try {
    this.loadingTask = this.pdfjsLib.getDocument(this.buildSource());
    this.loadingTask.onPassword = (_updatePassword: any, reason: any) => {
      this.dispatchEvent(new CustomEvent("passwordrequest", {
        detail: {
          reason
        },
        bubbles: true,
        composed: true
      }));
    };
    // download progress in bytes; `total` may be 0/undefined when the server sends
    // no Content-Length header — pass the raw pdfjs onProgress payload through as-is.
    this.loadingTask.onProgress = (p: any) => this.dispatchEvent(new CustomEvent("progress", {
      detail: {
        loaded: p && p.loaded,
        total: p && p.total
      },
      bubbles: true,
      composed: true
    }));
    const pdf = await this.loadingTask.promise;
    // stale (a newer load bumped the token + destroyed this task) — drop it.
    if (token !== this.renderToken) return;
    this.instance = pdf;
    if (this._current.value > pdf.numPages) this._current.value = pdf.numPages;
    this.dispatchEvent(new CustomEvent("load", {
      detail: {
        numPages: pdf.numPages
      },
      bubbles: true,
      composed: true
    }));
    await this.renderView();
  } catch (e: any) {
    // a destroyed task rejects its promise — suppress the abort for stale loads.
    if (token === this.renderToken) this.dispatchEvent(new CustomEvent("error", {
      detail: e,
      bubbles: true,
      composed: true
    }));
  }
};

  applyFit = async (mode: any) => {
  if (!this.instance || !this.containerEl) return;
  const n = Math.min(Math.max(this._current.value, 1), this.instance.numPages);
  const page = await this.instance.getPage(n);
  const vp = page.getViewport({
    scale: 1,
    rotation: this._rot.value
  });
  const cw = this.containerEl.clientWidth - 24;
  const ch = this.containerEl.clientHeight - 24;
  if (mode === 'width') this._zoom.value = cw / vp.width;else this._zoom.value = Math.min(cw / vp.width, ch / vp.height);
};

  getDocument() {
    return this.instance;
  }

  getPageCount() {
    return this.instance ? this.instance.numPages : 0;
  }

  goToPage(n: any) {
    if (!this.instance) return;
    const clamped = Math.min(Math.max(n, 1), this.instance.numPages);
    this._current.value = clamped;
    // programmatic navigation origin — scroll the target into view in continuous
    // mode (single-page mode re-renders that page via the $data.current $watch).
    // Called unconditionally (not gated on a change) so an explicit re-navigation
    // to the page the user has scrolled partly out of view re-centers it.
    if (this.renderAllPages) this.scrollToPage(clamped);
  }

  nextPage() {
    this.goToPage(this._current.value + 1);
  }

  prevPage() {
    this.goToPage(this._current.value - 1);
  }

  setScale(s: any) {
    if (typeof s === 'number' && s > 0) this._zoom.value = s;
  }

  zoomIn() {
    this._zoom.value = Math.min(this._zoom.value * 1.25, 10);
  }

  zoomOut() {
    this._zoom.value = Math.max(this._zoom.value / 1.25, 0.1);
  }

  fitWidth() {
    this.applyFit('width');
  }

  fitPage() {
    this.applyFit('page');
  }

  rotateCW() {
    this._rot.value = (this._rot.value + 90) % 360;
  }

  rotateCCW() {
    this._rot.value = (this._rot.value + 270) % 360;
  }

  async download(filename: any) {
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
  }

  getMetadata() {
    return this.instance ? this.instance.getMetadata() : null;
  }

  getOutline() {
    return this.instance ? this.instance.getOutline() : null;
  }

  getPageElement(n: any) {
    return this.containerEl ? this.containerEl.querySelector('[data-page="' + n + '"]') : null;
  }

  async find(query: any) {
    const q = (query == null ? '' : String(query)).trim().toLowerCase();
    this.findQuery = q;
    this.findMatches = [];
    this.findIndex = -1;
    if (!this.instance || !q) {
      this.renderView();
      this.dispatchEvent(new CustomEvent("findresult", {
        detail: {
          query: q,
          matches: 0,
          current: 0
        },
        bubbles: true,
        composed: true
      }));
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
      if (target !== this._current.value) this.goToPage(target);else this.renderView();
    } else {
      this.renderView();
    }
    this.dispatchEvent(new CustomEvent("findresult", {
      detail: {
        query: q,
        matches: this.findMatches.length,
        current: this.findMatches.length ? 1 : 0
      },
      bubbles: true,
      composed: true
    }));
    return this.findMatches.length;
  }

  findNext() {
    if (!this.findMatches.length) return;
    this.findIndex = (this.findIndex + 1) % this.findMatches.length;
    const target = this.findMatches[this.findIndex].page;
    if (target !== this._current.value) this.goToPage(target);
    this.dispatchEvent(new CustomEvent("findresult", {
      detail: {
        query: this.findQuery,
        matches: this.findMatches.length,
        current: this.findIndex + 1
      },
      bubbles: true,
      composed: true
    }));
  }

  findPrev() {
    if (!this.findMatches.length) return;
    this.findIndex = (this.findIndex - 1 + this.findMatches.length) % this.findMatches.length;
    const target = this.findMatches[this.findIndex].page;
    if (target !== this._current.value) this.goToPage(target);
    this.dispatchEvent(new CustomEvent("findresult", {
      detail: {
        query: this.findQuery,
        matches: this.findMatches.length,
        current: this.findIndex + 1
      },
      bubbles: true,
      composed: true
    }));
  }

  clearFind() {
    this.findQuery = '';
    this.findMatches = [];
    this.findIndex = -1;
    this.renderView();
    this.dispatchEvent(new CustomEvent("findresult", {
      detail: {
        query: '',
        matches: 0,
        current: 0
      },
      bubbles: true,
      composed: true
    }));
  }

  get page(): number { return this._pageControllable.read(); }
  set page(v: number) { this._pageControllable.notifyPropertyWrite(v); }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['src', 'page', 'scale', 'rotation', 'worker-src', 'workersrc', 'standard-font-data-url', 'standardfontdataurl', 'render-all-pages', 'renderallpages', 'text-layer', 'textlayer', 'password', 'query', 'auto-fit', 'autofit', 'options']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}

injectGlobalStyles('rozie-pdf-viewer-global', `
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
  }
`);
