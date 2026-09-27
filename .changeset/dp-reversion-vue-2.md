---
"@rozie-ui/date-picker-vue": patch
---

Packaging fixes bundled with this release:
- the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/date-picker-vue`, this package's own.
- this package declared `"sideEffects": false` while still shipping `themes/*.css` — a bundler was technically permitted to tree-shake those files away even on a direct `import '@rozie-ui/date-picker-vue/themes/<name>.css'`. `sideEffects` is now `["*.css", "**/*.css"]`, matching the React leaf.
