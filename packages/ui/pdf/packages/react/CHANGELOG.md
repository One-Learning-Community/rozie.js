# @rozie-ui/pdf-react

## 0.2.1

### Patch Changes

- Fix: in `render-all-pages` (continuous) mode, the internal scroll spy no longer fights the user's scroll. Scrolling a multi-page document previously snap-scrolled the view to whichever page had just become most-visible, so pages were skipped on momentum and the view could stick oscillating between two adjacent pages (with a secondary height jitter). The most-visible page still reflects into `page` / the `pagechange` event, but programmatic scroll-into-view now happens only on explicit navigation (`goToPage(n)` / setting `:page`), never from the observer — a timing-independent fix that is correct across all six framework targets.


## 0.2.0

### Minor Changes

- Fixes and additions from a consumer platform team dogfooding `@rozie-ui/pdf-vue` in production:

  **Fixes**
  - `src` given as a `Uint8Array` is now cloned before being handed to `getDocument()`. Previously the buffer was transferred to the PDF.js worker, detaching the caller's array — reusing the same reference (a remount, a re-render with the same `src`, a password retry) then loaded from an empty buffer and threw.
  - `workerSrc` / `standardFontDataUrl` no longer default to a hand-typed CDN version string that could drift from the `pdfjs-dist` actually installed. The default is now built from the installed engine's own `.version`, read at runtime, so it always matches.

  **Additions (additive, non-breaking)**
  - `autoFit: 'width' | 'page'` — opt-in resize-observed auto-refit, removing the need to hand-wire a `ResizeObserver` + `fitWidth()` / `fitPage()` yourself.
  - `pagerendered` event (per page: `{ pageNumber, viewport, scale, rotation, width, height }`) and a `getPageElement(pageNumber)` handle verb — a documented, stable mount point + reactive geometry for building your own per-page overlay (an annotation layer, a watermark) via your framework's native portal (Vue `Teleport`, React `createPortal`, etc.), without reverse-engineering PDF.js's internal `.textLayer` DOM. See the ["DOM contract" and "Overlaying content on a page"](https://github.com/One-Learning-Community/rozie.js/blob/main/docs/components/pdf.md) docs sections.
  - Container `class` / `style` passthrough (already worked via Rozie's attrs fallthrough) is now documented as the recipe for opting out of the internal scroll region — no new prop needed.

  No breaking changes; all existing props, events, and handle verbs are unchanged.
