---
"@rozie-ui/tiptap-angular": patch
---

**Fixed: a stale pre-unmount async construction could double-construct the Editor
under React StrictMode** (`maxLength`/`uploadImage`/`floatingMenu` lazy-extension path
only). React's dev-mode StrictMode double-invoke (mount → cleanup → mount, against the
SAME component instance) could let a stale first invocation's async extension-load
`.then()` construct a SECOND Editor onto the same DOM node and fire `ready` twice,
because the internal `disposed` guard was reset by the second invocation before the
first's `.then()` ever settled. Fixed with a per-mount-invocation guard; no API change.

**Fixed: `setContent()`/`clearContent()` no longer drop a write made during the async
construction gap** (`maxLength`/`uploadImage`/`floatingMenu` lazy-extension path only).
Calling either before `ready` now updates the bound `html` model immediately, and the
editor constructs with that value once it exists, instead of the write silently vanishing.

**New event: `error`.** Fired when an optional extension (`floatingMenu`/`image`/`count`)
fails to load via its dynamic `import()` — payload is `{ extension, error }`. Previously
an unhandled rejection on the internal `Promise.all` left the editor permanently
uncreated, silently, on ANY chunk-load failure (a real-world CDN/network blip). The
editor now still constructs WITHOUT the failed extension (degrade) instead of never
constructing at all; the failure is also reported via `console.error`.

**Docs: the `ready` event's README table row is no longer empty.** Its description was
missing from the generator's event-description map since `ready` shipped last release;
now documented, alongside the new `error` event above.
