---
surface_hash: ad041055bdfa
---

# PDF libraries comparison

How `@rozie-ui/pdf` compares to the existing per-framework [PDF.js](https://mozilla.github.io/pdf.js/) wrappers. PDF.js (mozilla/pdf.js, shipped as `pdfjs-dist`) is the de-facto vanilla-JS PDF rendering engine, and it is framework-agnostic: every wrapper exists only to glue reactive state to PDF.js's imperative `getDocument()` / `page.render()` flow, configure the Web Worker, render the page canvas (and, for the good ones, the selectable text layer), and forward the page / load events. The result is a lopsided ecosystem: a deep, maintained React wrapper; decent Vue and Angular options; a thin Svelte story; and effectively nothing for Solid or Lit. Rozie ships the same viewer — same props, two-way `page`, events, handle, and text layer — to all six.

> Research snapshot: 2026-08-10. Versions and the wrapper landscape move; treat them as of that date. Note `@react-pdf/renderer` is a different library — it *generates* PDFs from React components; it is not a viewer, so it's out of scope here.

## The wrappers at a glance

| Framework | PDF.js wrapper | Engine | Depth | Notes |
| --- | --- | --- | :---: | --- |
| **React** | `react-pdf` (wojtekmaj) | `pdfjs-dist` | **deep** | Mature, actively maintained, the obvious React pick. |
| **Vue** | `vue-pdf-embed` (+ `@tato30/vue-pdf`) | `pdfjs-dist` | **moderate** | Maintained, reasonable surface; less deep than `react-pdf`. |
| **Angular** | `ng2-pdf-viewer` | `pdfjs-dist` | **moderate** | Popular, widely used; maintenance has slowed (last publish 2024). |
| **Svelte** | `svelte-pdf` / community wrappers | `pdfjs-dist` | **thin** | Sparse surface, lower adoption, no text-layer story. |
| **Solid** | *(none)* | — | — | No dedicated PDF.js (or comparable) viewer wrapper. |
| **Lit** | *(none)* | — | — | No web-component viewer; PDF.js's own prebuilt viewer is an iframe-embedded *app*, not a component. |
| **Rozie** | `@rozie-ui/pdf-*` | `pdfjs-dist` v6 | **deep** | Same API on all six: props, two-way `page`, events, handle, text layer. |

`react-pdf` is a mature library and the obvious pick for a single-React app; `vue-pdf-embed` and `ng2-pdf-viewer` are likewise solid choices on their home frameworks, and Rozie does not claim to out-feature them there. The case for Rozie is the underserved targets. Svelte's options are thin (`svelte-pdf` is sparse, low-adoption, with no selectable-text-layer story), and Solid and Lit have nothing at all: a Lit dev's only "option" is embedding PDF.js's prebuilt viewer-app in an iframe, which is a whole application, not a component. Rozie gives all three underserved targets a real, consistent embeddable PDF viewer, the same one it produces for React, with one uniform API.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-glue-required / thin.

| Capability | `react-pdf` | `vue-pdf-embed` | `ng2-pdf-viewer` | `svelte-pdf` | Solid (none) | Lit (none) | **`@rozie-ui/pdf`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Mount from URL | ✅ | ✅ | ✅ | ✅ | hand-roll | hand-roll | ✅ `:src` |
| Mount from data (`Uint8Array` / `ArrayBuffer`) | ✅ | ✅ | ✅ | ⚠️ | hand-roll | hand-roll | ✅ `:src` (+ `data:` URL decode) |
| **Two-way current page** | ⚠️ via state | ⚠️ via prop | ⚠️ `[page]` + `(pageChange)` | ⚠️ | — | — | ✅ `r-model:page` (echo-guarded) |
| Continuous scroll (all pages) | ✅ | ✅ | ✅ | ⚠️ | — | — | ✅ `render-all-pages` |
| Single-page mode | ✅ | ✅ | ✅ | ✅ | — | — | ✅ (default) |
| Zoom | ✅ | ✅ | ✅ | ⚠️ | — | — | ✅ `:scale` + zoom verbs |
| Rotation | ✅ | ✅ | ✅ | ⚠️ | — | — | ✅ `:rotation` + rotate verbs |
| **Selectable text layer** | ✅ | ✅ | ✅ | ❌ | — | — | ✅ `text-layer` (default on, CSS shipped) |
| **Text find / search** | ⚠️ consumer-glue | ⚠️ consumer-glue | ⚠️ consumer-glue | ❌ | — | — | ✅ `find()` / `findNext` / `findPrev` + coarse highlight + `findresult` event |
| Imperative handle | ⚠️ via refs | ⚠️ partial | ⚠️ via methods | ❌ | hand-roll | hand-roll | ✅ uniform 20-verb `$expose` |
| Per-page overlay mount point | ⚠️ consumer-glue | ⚠️ consumer-glue | ⚠️ consumer-glue | ❌ | — | — | ✅ `pagerendered` event + `getPageElement()` (documented DOM contract) |
| Password-protected PDFs | ✅ | ✅ | ✅ | ⚠️ | — | — | ✅ `:password` + `passwordrequest` event |
| TypeScript | ✅ | ✅ | ✅ | ⚠️ | — | — | ✅ |
| Same API on all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **First-class packages everywhere**, including the three the ecosystem underserves: Svelte (thin `svelte-pdf`, no text layer), Solid (nothing), and Lit (nothing but an iframe-embedded viewer-app). A Svelte dev today fights a sparse, low-adoption wrapper; a Solid or Lit dev hand-rolls the whole worker / `getDocument` / canvas / text-layer flow. Rozie hands all three a first-class PDF viewer with selectable text, page nav, zoom and rotation.
- **A real two-way current page.** `r-model:page` (1-based) reads *and* drives which page renders in single mode, and in `render-all-pages` mode it reflects the scrolled-to page back via an `IntersectionObserver` (and the `pagechange` event), with an echo-guard so a consumer write and the scroll-spy don't fight. The incumbents surface the page via a one-way prop plus a separate change event; you wire the round-trip yourself.
- **A selectable text layer that just works.** `text-layer` is on by default and renders PDF.js's text spans over each page canvas so text is copyable and searchable. The required `.textLayer` CSS and the `--scale-factor` var ship with the component (via the `:root {}` engine-DOM escape hatch), so there is no extra CSS import. This is exactly what `svelte-pdf` lacks.
- **A uniform 20-verb imperative handle** (`getDocument` / `getPageCount` / `goToPage` / `nextPage` / `prevPage` / `setScale` / `zoomIn` / `zoomOut` / `fitWidth` / `fitPage` / `rotateCW` / `rotateCCW` / `getMetadata` / `getOutline` / `getPageElement` / `download` / `find` / `findNext` / `findPrev` / `clearFind`) grabbed with each framework's native ref. It is identical on every target, versus "however this wrapper happens to expose things", and the verbs drive the internal render state, so they work whether or not the consumer two-way-binds `page`.
- **A documented per-page overlay contract.** The `pagerendered` event (reactive `{ pageNumber, viewport, scale, rotation, width, height }`) paired with `getPageElement(pageNumber)` gives a stable, versioned DOM/CSS contract for mounting your own content on a page (an annotation layer, a watermark, a highlight) via your framework's native portal (React `createPortal`, Vue `Teleport`, Solid `<Portal>`, …), with no re-deriving geometry from PDF.js's internal `.textLayer` DOM.
- **Built-in text find.** `find(query)` scans every page's text, navigates to and coarse-highlights (span-level) the first match, returns the occurrence count, and emits a `findresult` event; `findNext` / `findPrev` cycle the matches and `clearFind` resets. It is the embeddable-component slice of PDF.js's viewer-app find, where the standalone wrappers leave document search as consumer glue over `getTextContent()`.
- **Zero-config worker.** The #1 PDF.js integration friction is `GlobalWorkerOptions.workerSrc`. The `worker-src` prop defaults to the version-matched CDN copy, so the component renders with no setup; override it (`:worker-src`) for offline / CSP / bundled-worker builds. Standard-font data is wired the same way (`:standard-font-data-url`).
- **`getDocument()` is always one hop from the raw engine**, so the full `pdfjs-dist` API (annotation extraction, outline, metadata, custom render flows) is reachable on any target when the curated surface doesn't cover something.

## What Rozie defers {#what-rozie-defers}

- **Annotation layer / form fields (AcroForm).** `react-pdf` and PDF.js's full prebuilt viewer render the annotation layer: links, widget annotations, and interactive AcroForm form fields. Rozie v1 renders the page canvas plus the selectable text layer, not the annotation layer, so links aren't clickable and form fields aren't fillable inside the component. This is a meaningful piece of PDF.js (`AnnotationLayer` + the annotation storage / form value plumbing), deliberately deferred rather than half-shipped. Until then, `getDocument()` hands you the raw `PDFDocumentProxy` so you can drive the annotation layer yourself, and the `pagerendered` / `getPageElement` overlay contract (above) gives a supported mount point for a consumer-built annotation UI in the meantime.
- **Full search-UI chrome, thumbnails sidebar, print / presentation mode.** Rozie ships coarse find-in-document as a first-class handle (`find` / `findNext` / `findPrev` / `clearFind` + the `findresult` event + span-level highlight), but PDF.js's full prebuilt viewer *application* goes further: a search panel with match-case / whole-word / highlight-all options and precise sub-span match ranges, plus a thumbnail sidebar, print / download toolbars, and presentation mode. Rozie ships the embeddable viewer component, not the full viewer-app chrome. The underlying data is all reachable (`getDocument()` exposes the raw pdfjs document for a richer custom search / thumbnail / print UI), but Rozie doesn't bundle that chrome.
- **Big-framework depth on the home framework.** `react-pdf` is a mature, multi-year library with deep React-idiomatic ergonomics, broad edge-case handling, and a large user base; `vue-pdf-embed` and `ng2-pdf-viewer` are likewise well-worn on their own frameworks. On their home framework each exposes more accumulated polish than Rozie's curated prop set. Rozie's value is the same component everywhere, with the underserved Svelte / Solid / Lit getting a viewer they otherwise lack. For anything outside the curated surface, `getDocument()` hands you the raw engine on every target.
- **`@rozie-ui/pdf` is pre-1.0** and younger than the multi-year incumbents. The full prop / event / handle surface is documented in the [showcase + API reference](/components/pdf).

## Try it

The [`@rozie-ui/pdf` showcase + API reference](/components/pdf) documents the `@rozie-ui/pdf-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/pdf-react pdfjs-dist`, etc.). The PDF.js Web Worker auto-configures from the version-matched CDN, so there's nothing extra to import to render a PDF (override `:worker-src` for offline / CSP / bundled-worker builds). The showcase walks the two-way `page` binding, single vs `render-all-pages` modes, the selectable text layer, text find / search, zoom / rotation, password-protected PDFs, and the 20-verb imperative handle. The [live demo](/components/pdf-demo) runs the component on every target.

## Cross-references

- [PDF — showcase & API](/components/pdf) — the full `@rozie-ui/pdf` surface, quick starts, and recipes.
- [PDF — live demo](/components/pdf-demo) — the viewer running across the six targets.
- [`PdfViewer.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pdf/src/PdfViewer.rozie)
- [Cropper libraries comparison](/components/cropper-comparison) — the sibling engine-wrapper port.
