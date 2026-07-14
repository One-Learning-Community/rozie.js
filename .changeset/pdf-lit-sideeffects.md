---
"@rozie-ui/pdf-lit": patch
---

Fix: scope `sideEffects` so a bare side-effect import preserves the custom-element registration.

`@rozie-ui/pdf-lit` shipped `sideEffects: false`, which let production bundlers (Vite build / Rollup / webpack prod) tree-shake the bare `import '@rozie-ui/pdf-lit'` — dropping the `customElements.define(...)` call so `<rozie-pdf-*>` rendered as an inert unknown element. Dev (esbuild eager-eval) masked it. `sideEffects` is now scoped to `["./dist/index.mjs", "./dist/index.cjs"]` so the registering entry is preserved while unrelated modules still tree-shake. Consumers who bare-import for the element registration in a production build are affected; those importing a used binding were not.
