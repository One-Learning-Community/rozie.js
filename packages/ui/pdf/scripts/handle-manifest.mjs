/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/pdf.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (the Phase 21 `$expose({ ... })` call in PdfViewer.rozie), but their
 * human-readable descriptions have no first-class IR source — so the prose lives
 * here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline (ROZ121/ROZ524/Lit-lifecycle): none of these 20 verbs
 * collides with an emitted event name (NO bare `load`/`error`/`pagechange`/
 * `pagesrendered`/`pagerendered`/`passwordrequest`/`progress`/`findresult`), the
 * React `page`-model auto-setter (NO `setPage` — navigate via `goToPage(n)`; the
 * two-way `page` binding reads it), or a Lit reserved lifecycle name. Every verb
 * drives `$data` (or reads the loaded document), so it works whether or not the
 * consumer two-way-binds `page`.
 */
export const handleManifest = {
  getDocument:
    'Return the underlying pdfjs `PDFDocumentProxy` for direct API access (the engine escape hatch), or null before the document loads.',
  getPageCount: 'Return the total number of pages in the loaded document, or 0 before it loads.',
  goToPage: 'Navigate to a 1-based page (clamped to `[1, pageCount]`) — `goToPage(n)`.',
  nextPage: 'Advance to the next page (clamped at the last page).',
  prevPage: 'Go back to the previous page (clamped at the first page).',
  setScale: 'Set the zoom scale to an absolute value (1 = 100%) — `setScale(s)`.',
  zoomIn: 'Zoom in by one step (×1.25, capped at 10×).',
  zoomOut: 'Zoom out by one step (÷1.25, floored at 0.1×).',
  fitWidth: 'Fit the current page to the container width.',
  fitPage: 'Fit the current page entirely within the container (width and height).',
  rotateCW: 'Rotate the view 90° clockwise.',
  rotateCCW: 'Rotate the view 90° counter-clockwise.',
  download:
    'Download the original PDF bytes — `download(filename?)` (defaults to `document.pdf`). Resolves `true` on success, `false` before the document loads.',
  getMetadata:
    'Resolve the document metadata (title, author, page labels, …) — pdfjs `PDFDocumentProxy.getMetadata()`. null before load.',
  getOutline:
    'Resolve the document outline (bookmark / table-of-contents tree) for a navigation sidebar — pdfjs `getOutline()`. null when absent or before load.',
  getPageElement:
    'Return the rendered page\'s DOM node (`.rozie-pdf-page[data-page]`) — `getPageElement(pageNumber)` — the documented mount point for a consumer overlay, or null if that page isn\'t currently rendered. Paired with the `pagerendered` event for reactive per-page geometry; NOT stable across zoom/rotation/mode changes, so re-acquire it on every `pagerendered` firing rather than caching the node.',
  find:
    'Search the whole document for a query — `find(query)`. Scans every page\'s text, navigates to + highlights the first match, returns a `Promise` resolving to the match count, and emits `findresult`. The highlight is **coarse / span-level**: it highlights whole text-layer spans that *contain* the query — a query straddling two spans won\'t highlight.',
  findNext:
    'Advance to the next match (wraps around), navigating its page + re-emitting `findresult` with the new `current`. No-op before a `find`.',
  findPrev:
    'Go back to the previous match (wraps around), navigating its page + re-emitting `findresult`. No-op before a `find`.',
  clearFind:
    'Clear the active query + highlights, re-render, and emit `findresult` with `{ query: \'\', matches: 0, current: 0 }`.',
};

export default handleManifest;
