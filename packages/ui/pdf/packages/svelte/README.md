# @rozie-ui/pdf-svelte

Idiomatic **svelte** `PdfViewer` — a cross-framework PDF viewer compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [PDF.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`). The current page is two-way bound via `page` (1-based), with selectable text, zoom and rotation. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/pdf-svelte
```

Peer dependencies: the `pdfjs-dist` engine (`^6`) + `svelte`. Install them alongside this package.

No separate engine-CSS import is needed — `PdfViewer` ships the selectable text-layer CSS itself. The PDF.js worker is auto-configured from a version-matched CDN, so the component works with zero config; override the `workerSrc` prop for offline / CSP / bundled-worker setups.

## Usage

```svelte
<script lang="ts">
  import PdfViewer from '@rozie-ui/pdf-svelte';

  let page = $state(1);
</script>

<PdfViewer
  src="/document.pdf"
  bind:page
  scale={1.2}
  render-all-pages
  onload={(e) => console.log(e.numPages)}
/>
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `src` | `unknown` | `undefined` |  |  |
| `page` | `Number` | `1` | ✓ |  |
| `scale` | `Number` | `1` |  |  |
| `rotation` | `Number` | `0` |  |  |
| `workerSrc` | `String` | `"https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs"` |  |  |
| `renderAllPages` | `Boolean` | `false` |  |  |
| `textLayer` | `Boolean` | `true` |  |  |
| `password` | `unknown` | `undefined` |  |  |
| `options` | `Object` | `{}` |  |  |

## Events

| Event | Description |
| --- | --- |
| `error` | |
| `pagesrendered` | |
| `passwordrequest` | |
| `load` | |
| `pagechange` | |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```svelte
<script>
  let viewer;              // component instance via bind:this
</script>

<PdfViewer bind:this={viewer} ... />
<button onclick={() => viewer.nextPage()}>Next</button>
```

| Method | Description |
| --- | --- |
| `getDocument` | Return the underlying pdfjs `PDFDocumentProxy` for direct API access (the engine escape hatch), or null before the document loads. |
| `getPageCount` | Return the total number of pages in the loaded document, or 0 before it loads. |
| `goToPage` | Navigate to a 1-based page (clamped to `[1, pageCount]`) — `goToPage(n)`. |
| `nextPage` | Advance to the next page (clamped at the last page). |
| `prevPage` | Go back to the previous page (clamped at the first page). |
| `setScale` | Set the zoom scale to an absolute value (1 = 100%) — `setScale(s)`. |
| `zoomIn` | Zoom in by one step (×1.25, capped at 10×). |
| `zoomOut` | Zoom out by one step (÷1.25, floored at 0.1×). |
| `fitWidth` | Fit the current page to the container width. |
| `fitPage` | Fit the current page entirely within the container (width and height). |
| `rotateCW` | Rotate the view 90° clockwise. |
| `rotateCCW` | Rotate the view 90° counter-clockwise. |
