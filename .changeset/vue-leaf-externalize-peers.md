---
"@rozie-ui/command-palette-vue": patch
"@rozie-ui/popover-vue": patch
---

Fix the Vue leaf bundles to externalize their workspace peers instead of inlining them.

Both packages build in Vite lib mode, and their `rollupOptions.external` lists
omitted workspace dependencies, so Rollup bundled those deps into the shipped
`dist/index.mjs`:

- **`@rozie-ui/command-palette-vue`** inlined the entire `@rozie-ui/combobox-vue`
  component even though it is declared a non-optional runtime `peerDependency`.
  Consumers were shipped a duplicate combobox (frozen at build time, ignoring the
  peer version they installed) on top of the peer they were already required to
  install. The bundle now imports `@rozie-ui/combobox-vue` as an external, dropping
  `dist/index.mjs` from ~50 KB to ~11 KB. No API or runtime-behavior change —
  combobox self-injects its own scoped styles on import, so rendering is identical.

- **`@rozie-ui/popover-vue`** inlined `@rozie/runtime-vue`'s stateless helpers; it
  now imports them externally (dedup only).
