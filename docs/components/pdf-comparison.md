---
surface_hash: 5bd73417be9b
---

# PDF libraries comparison

How `@rozie-ui/pdf` compares to the existing per-framework [PDF.js](https://mozilla.github.io/pdf.js/) wrappers. PDF.js (mozilla/pdf.js, shipped as `pdfjs-dist`) is the de-facto vanilla-JS PDF rendering engine, and it is framework-agnostic: every wrapper exists only to glue reactive state to PDF.js's imperative `getDocument()` / `page.render()` flow, configure the Web Worker, render the page canvas (and, for the good ones, the selectable text layer), and forward the page / load events. The result is a **lopsided ecosystem**: a deep, maintained React wrapper; decent Vue and Angular options; a **thin Svelte story; and effectively nothing for Solid or Lit**. Rozie ships one source to all six.

> Research snapshot: 2026-06-08. Versions and the wrapper landscape move; treat them as of that date. Note `@react-pdf/renderer` is a different library — it *generates* PDFs from React components; it is **not** a viewer, so it's out of scope here.

## The wrappers at a glance

| Framework | PDF.js wrapper | Engine | Depth | Notes |
| --- | --- | --- | :---: | --- |
| **React** | `react-pdf` (wojtekmaj) | `pdfjs-dist` | **deep** | Mature, actively maintained, the obvious React pick. |
| **Vue** | `vue-pdf-embed` (+ `@tato30/vue-pdf`) | `pdfjs-dist` | **moderate** | Maintained, reasonable surface; less deep than `react-pdf`. |
| **Angular** | `ng2-pdf-viewer` | `pdfjs-dist` | **moderate** | Popular, widely used; maintenance has slowed (last publish 2024). |
| **Svelte** | `svelte-pdf` / community wrappers | `pdfjs-dist` | **thin** | Sparse surface, lower adoption, no text-layer story. |
| **Solid** | *(none)* | — | — | No dedicated PDF.js (or comparable) viewer wrapper. |
| **Lit** | *(none)* | — | — | No web-component viewer; PDF.js's own prebuilt viewer is an iframe-embedded *app*, not a component. |
| **Rozie** | `@rozie-ui/pdf-*` | `pdfjs-dist` v6 | **deep** | One source → all six, same props / two-way `page` / events / handle / text layer. |

`react-pdf` is an **excellent, mature library** — for a single-React app it's the obvious pick, and Rozie does not claim to out-feature it on React. `vue-pdf-embed` and `ng2-pdf-viewer` are likewise **solid choices on their home framework**. The wedge is the underserved targets: Svelte's options are **thin** (`svelte-pdf` is sparse, low-adoption, with no selectable-text-layer story), and **Solid and Lit have nothing at all** — a Lit dev's only "option" is embedding PDF.js's prebuilt viewer-app in an iframe, which is a whole application, not a component. Rozie gives all three underserved targets a real, *consistent* embeddable PDF viewer — the same one it produces for React — from a single definition, with one uniform API across all six.

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
| Imperative handle | ⚠️ via refs | ⚠️ partial | ⚠️ via methods | ❌ | hand-roll | hand-roll | ✅ uniform 12-verb `$expose` |
| Password-protected PDFs | ✅ | ✅ | ✅ | ⚠️ | — | — | ✅ `:password` + `passwordrequest` event |
| TypeScript | ✅ | ✅ | ✅ | ⚠️ | — | — | ✅ |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including the three frameworks the ecosystem underserves: **Svelte (thin `svelte-pdf`, no text layer), Solid (nothing), and Lit (nothing but an iframe-embedded viewer-app)**. A Svelte dev today fights a sparse, low-adoption wrapper; a Solid or Lit dev hand-rolls the whole worker / `getDocument` / canvas / text-layer flow. Rozie hands all three a first-class PDF viewer with selectable text, page nav, zoom and rotation.
- **A real two-way current page on all six** — `r-model:page` (1-based) reads *and* drives which page renders in single mode, and in `render-all-pages` mode it reflects the scrolled-to page back via an `IntersectionObserver` (and the `pagechange` event), with an echo-guard so a consumer write and the scroll-spy don't fight. The incumbents surface the page via a one-way prop plus a separate change event; you wire the round-trip yourself.
- **A selectable text layer that just works** — `text-layer` is on by default and renders PDF.js's text spans over each page canvas so text is copyable / searchable. The required `.textLayer` CSS and the `--scale-factor` var ship *with the component* (via the `:root {}` engine-DOM escape hatch), so there's **no extra CSS import**. This is exactly what `svelte-pdf` lacks and what a hand-rolled Solid / Lit viewer rarely gets right.
- **A uniform 12-verb imperative handle** (`getDocument` / `getPageCount` / `goToPage` / `nextPage` / `prevPage` / `setScale` / `zoomIn` / `zoomOut` / `fitWidth` / `fitPage` / `rotateCW` / `rotateCCW`) grabbed with each framework's native ref — identical on every target, versus "however this wrapper happens to expose things." The verbs drive the internal render state, so they work whether or not the consumer two-way-binds `page`.
- **Zero-config worker** — the #1 PDF.js integration friction is `GlobalWorkerOptions.workerSrc`. The `worker-src` prop defaults to the version-matched CDN copy, so the component renders with no setup; override it (`:worker-src`) for offline / CSP / bundled-worker builds. Standard-font data is wired the same way (`:standard-font-data-url`).
- **`getDocument()` is always one hop from the raw engine**, so the full `pdfjs-dist` API (annotation extraction, outline, metadata, custom render flows) is reachable on any target when the curated surface doesn't cover something.

## What Rozie defers {#what-rozie-defers}

This page concedes where the standalone wrappers and PDF.js's own viewer are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **Annotation layer / form fields (AcroForm).** `react-pdf` and PDF.js's full prebuilt viewer render the **annotation layer** — links, widget annotations, and interactive AcroForm form fields. Rozie v1 renders the **page canvas + the selectable text layer**, not the annotation layer, so links aren't clickable and form fields aren't fillable inside the component. This is a meaningful piece of PDF.js (`AnnotationLayer` + the annotation storage / form value plumbing), deliberately deferred rather than half-shipped. Until then, `getDocument()` hands you the raw `PDFDocumentProxy` so you can drive the annotation layer yourself.
- **Search UI, thumbnails sidebar, print / download chrome.** PDF.js's full prebuilt **viewer application** ships find-in-document, a thumbnail sidebar, print and download toolbars, and presentation mode. Rozie ships the **embeddable viewer component**, not the full viewer-app chrome. The underlying data is all reachable — `getDocument()` exposes the raw pdfjs document for custom search / thumbnail / print UI — but Rozie doesn't bundle that chrome.
- **Big-framework depth on the home framework.** `react-pdf` is a mature, multi-year library with deep React-idiomatic ergonomics, broad edge-case handling, and a large user base; `vue-pdf-embed` and `ng2-pdf-viewer` are likewise well-worn on their own frameworks. On their home framework each exposes more accumulated polish than Rozie's curated prop set. Rozie's value is **not** "more than `react-pdf` on React" — it's the **same idiomatic component on all six frameworks from one source**, with the underserved **Svelte / Solid / Lit** getting a viewer they otherwise lack. For anything outside the curated surface, `getDocument()` hands you the raw engine on every target.
- **`@rozie-ui/pdf` is `0.1.0`.** The surface (10 props / 5 events / 12-verb handle / two-way `page` model / selectable text layer / single + continuous render modes) is stable and gate-verified, but it is younger than the multi-year incumbents.

## Try it

The [`@rozie-ui/pdf` showcase + API reference](/components/pdf) documents the `@rozie-ui/pdf-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/pdf-react pdfjs-dist`, etc.). The PDF.js Web Worker **auto-configures** from the version-matched CDN, so there's nothing extra to import to render a PDF (override `:worker-src` for offline / CSP / bundled-worker builds). The showcase walks the two-way `page` binding, single vs `render-all-pages` modes, the selectable text layer, zoom / rotation, password-protected PDFs, and the 12-verb imperative handle. The [live demo](/components/pdf-demo) runs the component across all six targets.

## Cross-references

- [PDF — showcase & API](/components/pdf) — the full `@rozie-ui/pdf` surface, quick starts, and recipes.
- [PDF — live demo](/components/pdf-demo) — the viewer running across all six targets.
- [`PdfViewer.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pdf/src/PdfViewer.rozie)
- [Cropper libraries comparison](/components/cropper-comparison) — the sibling engine-wrapper port.
