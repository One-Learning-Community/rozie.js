# @rozie-ui/pdf-vue

Idiomatic **vue** `PdfViewer` — a cross-framework PDF viewer compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [PDF.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`). The current page is two-way bound via `page` (1-based), with selectable text, zoom and rotation. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/pdf-vue
```

Peer dependencies: the `pdfjs-dist` engine (`^6`) + `vue`. Install them alongside this package.

No separate engine-CSS import is needed — `PdfViewer` ships the selectable text-layer CSS itself. The PDF.js worker is auto-configured from a version-matched CDN, so the component works with zero config; override the `workerSrc` prop for offline / CSP / bundled-worker setups.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import PdfViewer from '@rozie-ui/pdf-vue';

const page = ref(1);
</script>

<template>
  <PdfViewer
    src="/document.pdf"
    v-model:page="page"
    :scale="1.2"
    render-all-pages
    @load="(e) => console.log(e.numPages)"
  />
</template>
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `src` | `unknown` | `undefined` |  |  |
| `page` | `Number` | `1` | ✓ |  |
| `scale` | `Number` | `1` |  |  |
| `rotation` | `Number` | `0` |  |  |
| `workerSrc` | `String` | `"https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs"` |  |  |
| `standardFontDataUrl` | `String` | `"https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/standard_fonts/"` |  |  |
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
| `progress` | |
| `load` | |
| `pagechange` | |
| `findresult` | |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```vue
<script setup>
import { ref } from 'vue';
const viewer = ref();      // template ref
</script>

<template>
  <PdfViewer ref="viewer" ... />
  <button @click="viewer.nextPage()">Next</button>
</template>
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
| `download` | Download the original PDF bytes — `download(filename?)` (defaults to `document.pdf`). Resolves `true` on success, `false` before the document loads. |
| `getMetadata` | Resolve the document metadata (title, author, page labels, …) — pdfjs `PDFDocumentProxy.getMetadata()`. null before load. |
| `getOutline` | Resolve the document outline (bookmark / table-of-contents tree) for a navigation sidebar — pdfjs `getOutline()`. null when absent or before load. |
| `find` | Search the whole document for a query — `find(query)`. Scans every page's text, navigates to + highlights the first match, returns a `Promise` resolving to the match count, and emits `findresult`. The highlight is **coarse / span-level**: it highlights whole text-layer spans that *contain* the query — a query straddling two spans won't highlight. |
| `findNext` | Advance to the next match (wraps around), navigating its page + re-emitting `findresult` with the new `current`. No-op before a `find`. |
| `findPrev` | Go back to the previous match (wraps around), navigating its page + re-emitting `findresult`. No-op before a `find`. |
| `clearFind` | Clear the active query + highlights, re-render, and emit `findresult` with `{ query: '', matches: 0, current: 0 }`. |
