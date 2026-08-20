# @rozie-ui/pdf-react

## 0.2.6

### Patch Changes

- @rozie/runtime-react@0.6.0

## 0.2.5

### Patch Changes

- Mount-time staleness fix. Values read inside `$onMount` are now mirrored through synced refs, so a callback registered once at mount no longer reads the first render's values for the lifetime of the component. A consumer that changes a prop — or passes a new handler identity — after mount is now observed by the mount-registered callback instead of being silently ignored.

  Two read kinds landed here:
  - **Prop read** — `autoFit`. Changing the fit mode after mount is now seen by the mount-registered fit pass.
  - **Helper call** — `applyFit()`, so the fit is applied against the current viewport/zoom state.

- The mount effect's dependency array is now honest, so the `react-hooks/exhaustive-deps` suppression is no longer emitted.
- No `$emit` handler prop was affected. No API surface change.
- @rozie/runtime-react@0.2.3

## 0.2.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. Declared emit handlers were also landing in the root DOM fallthrough spread and firing twice per emit — the emitter now keeps them out of it. No API surface change.

## 0.2.3

### Patch Changes

- @rozie/runtime-react@0.2.1

## 0.2.2

### Patch Changes

- @rozie/runtime-react@0.2.0

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
