# PdfViewer — the cross-framework PDF viewer

`PdfViewer` is Rozie's data-bound port of [PDF.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist` v6) — Mozilla's de-facto vanilla-JS PDF renderer. One `.rozie` source file ships idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers from a single wrapper. The per-framework ecosystem is **lopsided**: [react-pdf (wojtekmaj)](https://github.com/wojtekmaj/react-pdf) is deep and maintained for React; Vue ([vue-pdf-embed](https://github.com/hrynko/vue-pdf-embed)), Angular ([ng2-pdf-viewer](https://github.com/VadimDez/ng2-pdf-viewer)) and Svelte have thinner / older options — and **Solid and Lit have effectively nothing**. Rozie collapses all six into one source, so the five underserved frameworks get a real embeddable PDF viewer — with selectable text, page navigation, zoom and rotation — for free. See the [PDF libraries comparison](/components/pdf-comparison) for the full per-framework matrix.

This page is the **show-and-tell**: the API surface, per-framework quick starts, the five lifecycle events, the two-way `page` model, the 12-verb imperative handle, the worker / standard-font / text-layer story, and the recipes for continuous scroll, binary sources, and bundling the worker.

The full source for `PdfViewer.rozie` lives in the [`@rozie-ui/pdf` package](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pdf/src/PdfViewer.rozie).

## The `@rozie-ui/pdf` packages

`PdfViewer` ships as six pre-compiled, per-framework packages generated from a single `PdfViewer.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/pdf-react` | `npm i @rozie-ui/pdf-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pdf/packages/react/README.md) |
| `@rozie-ui/pdf-vue` | `npm i @rozie-ui/pdf-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pdf/packages/vue/README.md) |
| `@rozie-ui/pdf-svelte` | `npm i @rozie-ui/pdf-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pdf/packages/svelte/README.md) |
| `@rozie-ui/pdf-angular` | `npm i @rozie-ui/pdf-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pdf/packages/angular/README.md) |
| `@rozie-ui/pdf-solid` | `npm i @rozie-ui/pdf-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pdf/packages/solid/README.md) |
| `@rozie-ui/pdf-lit` | `npm i @rozie-ui/pdf-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pdf/packages/lit/README.md) |

Each package carries the **`pdfjs-dist` engine peer** (`^6`) plus its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). Install the engine peer alongside the framework package:

```bash
npm i @rozie-ui/pdf-react pdfjs-dist
```

Unlike [MapLibre](/components/maplibre) or [Cropper](/components/cropper), **there is no separate engine-CSS import** — `PdfViewer` ships PDF.js's selectable-text-layer CSS itself (through the `:root { }` engine-DOM escape hatch). The PDF.js worker is also **auto-configured** from a version-matched jsDelivr CDN, so the component works with **zero config** out of the box — override the `workerSrc` prop only for offline / CSP / bundled-worker setups (see [Gotchas](#the-pdf-js-worker)). Anything the curated prop surface doesn't special-case (cMap URLs, HTTP headers, credentials, …) comes through the first-class `:options` passthrough — PDF.js's own `getDocument` `DocumentInitParameters`. The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `PdfViewer.rozie`, so they cannot drift from the compiled output — the package's `codegen.mjs` asserts the structural columns of this page against `ir.props` on every run.

## Quick start

The current page is two-way bound through the single `page` model prop (1-based). In single-page mode it drives which page renders (with `nextPage` / `prevPage` / `goToPage`); in `render-all-pages` mode it reflects the scrolled-to page (and scrolls when the consumer writes it). The PDF source comes through `src` — a URL string, a `data:` base64 URL, or binary data (`ArrayBuffer` / `Uint8Array`). Load / page / render lifecycle fires as native framework events.

### React

```tsx
import { useState } from 'react';
import { PdfViewer } from '@rozie-ui/pdf-react';

export function Demo() {
  const [page, setPage] = useState(1);
  return (
    <div style={{ height: 600 }}>
      <PdfViewer
        src="/document.pdf"
        page={page}
        onPageChange={(e) => setPage(e.page)}
        scale={1.2}
        render-all-pages
        onLoad={(e) => console.log(e.numPages)}
      />
    </div>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import PdfViewer from '@rozie-ui/pdf-vue';

const page = ref(1);
</script>

<template>
  <div style="height: 600px">
    <PdfViewer
      src="/document.pdf"
      v-model:page="page"
      :scale="1.2"
      render-all-pages
      @load="(e) => console.log(e.numPages)"
    />
  </div>
</template>
```

### Svelte

```svelte
<script lang="ts">
  import PdfViewer from '@rozie-ui/pdf-svelte';

  let page = $state(1);
</script>

<div style="height: 600px">
  <PdfViewer
    src="/document.pdf"
    bind:page
    scale={1.2}
    render-all-pages
    onload={(e) => console.log(e.numPages)}
  />
</div>
```

### Angular

```ts
import { Component } from '@angular/core';
import { PdfViewer } from '@rozie-ui/pdf-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [PdfViewer],
  template: `
    <div style="height: 600px">
      <PdfViewer
        src="/document.pdf"
        [(page)]="page"
        [scale]="1.2"
        render-all-pages
        (load)="onLoad($event)"
      />
    </div>
  `,
})
export class DemoComponent {
  page = 1;
  onLoad(e: any) { console.log(e.numPages); }
}
```

Because `page` is the lone two-way model, the Angular component is a real `ControlValueAccessor` — `[(ngModel)]="page"` and reactive `formControl` bindings work out of the box.

### Solid

```tsx
import { createSignal } from 'solid-js';
import { PdfViewer } from '@rozie-ui/pdf-solid';

export function Demo() {
  const [page, setPage] = createSignal(1);
  return (
    <div style={{ height: '600px' }}>
      <PdfViewer
        src="/document.pdf"
        page={page()}
        onPageChange={(e) => setPage(e.page)}
        scale={1.2}
        render-all-pages
        onLoad={(e) => console.log(e.numPages)}
      />
    </div>
  );
}
```

### Lit

```ts
import '@rozie-ui/pdf-lit';

// <rozie-pdf-viewer> is a custom element. Bind `src`/`page` as properties and
// listen for `page-change` (the two-way change channel) + `load`.
const el = document.querySelector('rozie-pdf-viewer');
el.src = '/document.pdf';
el.scale = 1.2;
el.addEventListener('page-change', (e) => { el.page = e.detail.page; });
el.addEventListener('load', (e) => console.log(e.detail.numPages));
```

## API

### Props

`page` is the lone **two-way** model prop (bind with `r-model` / `v-model` / `bind:` / `[(…)]` / `onPageChange`). `scale` and `rotation` are **one-way** props the imperative handle verbs override (the live render is driven by internal state seeded from the props, so `zoomIn()` / `rotateCW()` work whether or not the consumer binds them). All render-affecting props reconcile into the live view on change — no remount.

| Name | Type | Default | Two-way (model) | Runtime-updatable? | Description |
| --- | --- | --- | :---: | :---: | --- |
| `src` | `unknown` | `undefined` | | ✓ | The PDF source — a URL string, a `data:` base64 URL, or binary data (`ArrayBuffer` / `Uint8Array`). Changing it tears down the previous document (via its loading task) and loads the new one. `undefined` renders an empty viewer. |
| `page` | `Number` | `1` | ✓ | ✓ | The 1-based current page. **Two-way.** In single-page mode it drives which page renders; in `render-all-pages` mode it reflects the scrolled-to page (and scrolls the container when the consumer writes it). Clamped to `[1, pageCount]`. |
| `scale` | `Number` | `1` | | ✓ | The zoom scale (`1` = 100%). One-way: the `setScale` / `zoomIn` / `zoomOut` / `fitWidth` / `fitPage` handle verbs override it imperatively. A consumer write reconciles the live render. |
| `rotation` | `Number` | `0` | | ✓ | Rotation in degrees (`0` / `90` / `180` / `270`). One-way: the `rotateCW` / `rotateCCW` verbs override it. Normalized into `[0, 360)`. |
| `workerSrc` | `String` | `"https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs"` | | ✓ | The PDF.js worker URL. Set on `GlobalWorkerOptions.workerSrc` before loading. Defaults to the **version-matched jsDelivr CDN** so the component works with zero config; override for offline / CSP / a bundled worker (see [Gotchas](#the-pdf-js-worker)). |
| `standardFontDataUrl` | `String` | `"https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/standard_fonts/"` | | ✓ | The directory of PDF.js's standard-font data so the base-14 fonts (Helvetica / Times / Courier / …) render with correct glyphs. Version-matched CDN default; override (or pass a bundled dir) for offline / CSP. |
| `renderAllPages` | `Boolean` | `false` | | ✓ | `false` = single page with nav (the two-way `page` drives it). `true` = continuous scroll of every page; the most-visible page reflects back into `page` and the `pagechange` event via an `IntersectionObserver`. |
| `textLayer` | `Boolean` | `true` | | ✓ | Render PDF.js's selectable / copyable text-layer spans over each page canvas (the differentiator vs a dumb canvas image). The required `.textLayer` CSS + `--scale-factor` var ship with the component — no extra import. |
| `password` | `unknown` | `undefined` | | ✓ | Password for an encrypted PDF. If the document is encrypted and no (or a wrong) password is set, the `passwordrequest` event fires with `{ reason }`. Changing it reloads the document. |
| `query` | `unknown` | `undefined` | | ✓ | A reactive search query — the **controlled** alternative to the imperative `find()` handle. Setting it to a non-empty string scans every page, navigates to + coarse-highlights the first match, and emits `findresult` with the total occurrence count; clearing it (empty string / `null`) clears the highlight. Reactive so it works uniformly across all six targets (an Angular child-component `ref` cannot reach the `$expose` handle from a template event handler — the same reason `page` is a two-way model rather than a handle call). |
| `options` | `Object` | `{}` | | ✓ | Raw [`getDocument` `DocumentInitParameters`](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html) passthrough — spread **before** the curated keys (explicit `src` / `password` win). For `cMapUrl`, `httpHeaders`, `withCredentials`, etc. |

### Events

PDF.js's load / page / render / find lifecycle is forwarded as **seven** structured events:

| Event | Payload | Fires when |
| --- | --- | --- |
| `load` | `{ numPages }` | The document finished loading (after `getDocument(...).promise` resolves). Carries the total page count. |
| `progress` | `{ loaded, total }` | The document download advanced — `loaded` / `total` are bytes (PDF.js's `onProgress`). `total` may be `0` (or `undefined`) when the server omits a `Content-Length` header — passed through as-is. |
| `error` | the engine `Error` | A load or page-render failed (bad source, network error, corrupt PDF). Stale-load aborts are suppressed (a `src` change mid-load doesn't fire a spurious error). |
| `pagechange` | `{ page }` | The current page changed — driven by `goToPage` / `nextPage` / `prevPage`, a `page`-prop write, or (in `render-all-pages`) the scroll spy. Also drives the two-way `page` model. |
| `pagesrendered` | — | The visible page(s) finished rendering (canvas + optional text layer) into the container. |
| `passwordrequest` | `{ reason }` | The document is encrypted and the supplied `password` is missing or wrong. `reason` is PDF.js's `PasswordResponses` code (need vs. incorrect). |
| `findresult` | `{ query, matches, current }` | A find ran (`find` / `findNext` / `findPrev` / `clearFind`). `query` is the active lowercased query (`''` when cleared), `matches` is the total occurrence count across all pages, and `current` is the 1-based index of the active match (`0` when none). |

### Imperative handle

Beyond props, the component exposes **19** imperative methods declared once in the Rozie source via `$expose`. Grab a handle with your framework's native ref mechanism (React `useRef` / Vue template ref / Svelte `bind:this` / Angular `viewChild` / Solid callback ref / the Lit custom element itself) and call them directly:

| Method | Description |
| --- | --- |
| `getDocument` | Return the underlying pdfjs `PDFDocumentProxy` for direct API access (the engine escape hatch), or `null` before the document loads. |
| `getPageCount` | Return the total number of pages in the loaded document, or `0` before it loads. |
| `goToPage` | Navigate to a 1-based page (clamped to `[1, pageCount]`) — `goToPage(n)`. |
| `nextPage` | Advance to the next page (clamped at the last page). |
| `prevPage` | Go back to the previous page (clamped at the first page). |
| `setScale` | Set the zoom scale to an absolute value (`1` = 100%) — `setScale(s)`. |
| `zoomIn` | Zoom in by one step (×1.25, capped at 10×). |
| `zoomOut` | Zoom out by one step (÷1.25, floored at 0.1×). |
| `fitWidth` | Fit the current page to the container width. |
| `fitPage` | Fit the current page entirely within the container (width and height). |
| `rotateCW` | Rotate the view 90° clockwise. |
| `rotateCCW` | Rotate the view 90° counter-clockwise. |
| `download` | Download the original PDF bytes — `download(filename?)` (defaults to `document.pdf`). Resolves `true` on success, `false` before the document loads. |
| `getMetadata` | Resolve the document metadata (title, author, page labels, …) — pdfjs `PDFDocumentProxy.getMetadata()`. `null` before load. |
| `getOutline` | Resolve the document outline (bookmark / table-of-contents tree) for a navigation sidebar — pdfjs `getOutline()`. `null` when absent or before load. |
| `find` | Search the whole document for a query — `find(query)`. Scans every page's text, navigates to + highlights the first match, returns a `Promise` resolving to the match count, and emits `findresult`. The highlight is **coarse / span-level**: it highlights whole text-layer spans that *contain* the query — a query that straddles two spans won't highlight. |
| `findNext` | Advance to the next match (wraps around), navigating its page + re-emitting `findresult` with the new `current`. No-op before a `find`. |
| `findPrev` | Go back to the previous match (wraps around), navigating its page + re-emitting `findresult`. No-op before a `find`. |
| `clearFind` | Clear the active query + highlights, re-render, and emit `findresult` with `{ query: '', matches: 0, current: 0 }`. |

::: tip Why navigation is `goToPage`, not `setPage`
The handle navigates with **`goToPage(n)`** — there is deliberately **no** `setPage` verb. `page` is the two-way model prop, so React auto-generates an internal `setPage` setter; a `setPage` handle verb would collide with it (ROZ524). None of the 19 verbs collides with an emitted event name either (no bare `load` / `error` / `pagechange` / `pagesrendered` / `passwordrequest` / `progress` / `findresult` — ROZ121), and none shadows a LitElement lifecycle method. Every verb drives the component's **internal render state** (not the props), so it works whether or not the consumer two-way-binds `page` — only `page` mirrors back through the model; `scale` / `rotation` are one-way props the verbs override imperatively.
:::

**React example:**

```tsx
import { useRef } from 'react';
import { PdfViewer, type PdfViewerHandle } from '@rozie-ui/pdf-react';

const viewer = useRef<PdfViewerHandle>(null);
// <PdfViewer ref={viewer} ... />
viewer.current?.nextPage();
const total = viewer.current?.getPageCount();
viewer.current?.fitWidth();
const pdf = viewer.current?.getDocument();   // the raw pdfjs PDFDocumentProxy
```

## Recipes

### Page navigation with the handle + two-way `page`

Drive the page two ways at once: bind `page` to your component state, **and** call the handle's `nextPage` / `prevPage` / `goToPage`. They stay in sync — the verbs write the internal page, which echoes back into the bound `page` and fires `pagechange`:

```tsx
import { useRef, useState } from 'react';
import { PdfViewer, type PdfViewerHandle } from '@rozie-ui/pdf-react';

export function Demo() {
  const viewer = useRef<PdfViewerHandle>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  return (
    <div>
      <button onClick={() => viewer.current?.prevPage()} disabled={page <= 1}>Prev</button>
      <span>{page} / {total}</span>
      <button onClick={() => viewer.current?.nextPage()} disabled={page >= total}>Next</button>
      <div style={{ height: 600 }}>
        <PdfViewer
          ref={viewer}
          src="/document.pdf"
          page={page}
          onPageChange={(e) => setPage(e.page)}
          onLoad={(e) => setTotal(e.numPages)}
        />
      </div>
    </div>
  );
}
```

### Zoom & rotate via the handle

`scale` and `rotation` are one-way props, so drive them imperatively. The zoom verbs step relative to the current scale (`zoomIn` ×1.25 capped at 10×, `zoomOut` ÷1.25 floored at 0.1×); `setScale(s)` sets an absolute value; `fitWidth` / `fitPage` measure the container:

```ts
viewer.zoomIn();
viewer.zoomOut();
viewer.setScale(1.5);     // 150%
viewer.fitWidth();        // fit the page to the container width
viewer.fitPage();         // fit the whole page in view
viewer.rotateCW();        // 90° clockwise
viewer.rotateCCW();       // 90° counter-clockwise
```

### Continuous-scroll mode

Set `render-all-pages` to render every page in one scrollable column. The most-visible page reflects back into the two-way `page` (and the `pagechange` event) via an `IntersectionObserver`, and a consumer write to `page` scrolls that page into view:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import PdfViewer from '@rozie-ui/pdf-vue';

const page = ref(1);
</script>

<template>
  <p>On page {{ page }}</p>
  <div style="height: 80vh">
    <PdfViewer src="/document.pdf" v-model:page="page" render-all-pages />
  </div>
</template>
```

### Selectable text

The text layer is **on by default** — `textLayer` renders PDF.js's selectable / copyable text spans over each page canvas, so users can select, copy, and (with the browser's find) search the rendered text. No extra CSS import is needed; the component ships the `.textLayer` styles itself. Disable it for a pure-image render (faster, no selection):

```svelte
<PdfViewer src="/document.pdf" textLayer={false} />
```

### Loading a `Uint8Array` / `ArrayBuffer`

`src` accepts binary data, not just a URL — pass an `ArrayBuffer` or `Uint8Array` (e.g. from a `fetch`, a `File` drop, or an upload). The wrapper feeds it straight into PDF.js's `getDocument({ data })`:

```tsx
import { useEffect, useState } from 'react';
import { PdfViewer } from '@rozie-ui/pdf-react';

export function Demo({ file }: { file: File }) {
  const [bytes, setBytes] = useState<ArrayBuffer>();
  useEffect(() => { file.arrayBuffer().then(setBytes); }, [file]);
  return (
    <div style={{ height: 600 }}>
      {bytes && <PdfViewer src={bytes} />}
    </div>
  );
}
```

A `data:application/pdf;base64,…` URL string also works — the wrapper decodes it to bytes for you (PDF.js's `url` path doesn't fetch data URLs).

### Overriding the worker for a bundler

The default `workerSrc` is the version-matched CDN. To bundle the worker with your app (offline, CSP, or to avoid the CDN round-trip), point `workerSrc` at the worker resolved by your bundler. With Vite:

```vue
<script setup lang="ts">
import PdfViewer from '@rozie-ui/pdf-vue';

// Vite resolves the worker asset URL at build time.
const workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
</script>

<template>
  <PdfViewer src="/document.pdf" :worker-src="workerSrc" />
</template>
```

For fully-offline rendering, also bundle the standard fonts and point `standardFontDataUrl` at the bundled directory (otherwise the base-14 fonts still hit the CDN).

## Gotchas

### The PDF.js worker {#the-pdf-js-worker}

PDF.js parses documents in a **Web Worker**, so `GlobalWorkerOptions.workerSrc` **must** be set before `getDocument`. The `workerSrc` prop defaults to the version-matched jsDelivr CDN copy, so the component works with **zero config** — but that default makes a network request to the CDN on first load. For **offline** apps, a strict **CSP** (the CDN URL must be in `worker-src` / `script-src`), or to avoid the round-trip, override `workerSrc` with a bundled worker (see the Vite recipe above). The worker version must match the `pdfjs-dist` version your app resolves — the default URL is pinned to the engine version this package was built against; if you upgrade `pdfjs-dist`, override `workerSrc` to the matching version.

### `standardFontDataUrl` for correct glyphs

PDF.js doesn't embed the base-14 standard fonts (Helvetica / Times / Courier / Symbol / ZapfDingbats). Without `standardFontDataUrl`, documents that rely on them render with substituted glyphs and console warnings. The prop defaults to the version-matched CDN so the fonts "just work" online; for offline / CSP, bundle the `pdfjs-dist/standard_fonts/` directory and point `standardFontDataUrl` at it.

### The container needs a height

PDF.js renders into the component's `.rozie-pdf` host, which is `width: 100%; height: 100%; min-height: 320px; overflow: auto`. Give the **parent** an explicit height (the quick-start examples wrap the viewer in a `600px`-tall `<div>`) — especially in `render-all-pages` mode, where the scroll spy and `scrollIntoView` need a scrollable, sized container. A zero-height parent collapses to the 320px minimum.

### CORS for cross-origin PDF URLs

When `src` is a URL on another origin, the fetch is subject to **CORS** — the PDF server must send permissive `Access-Control-Allow-Origin` headers, or the load fails and the `error` event fires. Same-origin URLs, `data:` URLs, and binary `ArrayBuffer` / `Uint8Array` sources have no CORS constraint. For authenticated cross-origin fetches, pass `withCredentials` / `httpHeaders` through the `:options` bag.

## Cross-references

- [PDF libraries comparison](/components/pdf-comparison) — the per-framework wrapper matrix, the Solid / Lit gap, and the honest "what Rozie defers" row.
- [`PdfViewer.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/pdf/src/PdfViewer.rozie) — the canonical wrapper.
- [PdfViewer live demo](/components/pdf-demo) — the rendered viewer across all six targets.
- [Cropper — showcase & API](/components/cropper) — the sibling no-slots engine-wrapper port.
- [MapLibre — showcase & API](/components/maplibre) — the sibling engine-wrapper port (the two-way model + imperative-handle pattern).
- [Features](/guide/features) — the full Rozie author-side API (`$expose`, `r-model`, the prop / event / slot surface).
