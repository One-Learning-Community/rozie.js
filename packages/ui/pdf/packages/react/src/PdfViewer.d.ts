import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface PdfViewerProps {
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
  onPageChange?: (next: number) => void;
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
   * Raw `getDocument` `DocumentInitParameters` passthrough — spread **before** the curated keys (explicit `src` / `password` win). For `cMapUrl`, `httpHeaders`, `withCredentials`, etc.
   */
  options?: Record<string, unknown>;
  onError?: (...args: unknown[]) => void;
  onPagesrendered?: (...args: unknown[]) => void;
  onPasswordrequest?: (...args: unknown[]) => void;
  onLoad?: (...args: unknown[]) => void;
  onPagechange?: (...args: unknown[]) => void;
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

declare const PdfViewer: React.ForwardRefExoticComponent<PdfViewerProps & React.RefAttributes<PdfViewerHandle>>;
export default PdfViewer;
