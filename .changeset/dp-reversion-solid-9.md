---
"@rozie-ui/date-picker-solid": patch
---

**Fixed: published Solid leaves now ship compiled JavaScript for `import`/`require`, with JSX
kept only under the `solid` export condition.**

Every `@rozie-ui/*-solid` leaf with markup previously shipped Solid JSX inside
`dist/index.{mjs,cjs}` under a plain `import`/`require` (`chartjs-solid` renders no markup of its
own, but ships the same corrected export shape for consistency with its siblings). That is not
valid JavaScript on its own — a default `vite-plugin-solid` setup
fails with "JSX syntax is disabled" (the plugin only transforms `.[mc]?[jt]sx` files), and any
bundler without a Solid plugin fails outright. The only way to consume these packages was to
manually point `vite-plugin-solid` at the package's `.mjs` files inside `node_modules` — a
workaround, not a supported shape.

New export shape (the standard one for a published Solid library):
- `import` / `require` → `dist/<entry>.{mjs,cjs}`, compiled to plain DOM output by
  `babel-preset-solid`. Any bundler consumes this with no Solid plugin at all.
- `solid` (export condition) → `dist/source/<entry>.jsx`, JSX kept intact. `vite-plugin-solid`
  and SolidStart resolve this condition first and compile it themselves for their own mode (DOM /
  SSR / hydration).

**If you were using the `extensions: ['.mjs']` / `node_modules` `include` workaround with
`vite-plugin-solid` to consume one of these packages, remove it — it is no longer needed** and a
default `vite-plugin-solid` setup now resolves the `solid` condition correctly on its own. No
public API change on any of these leaves.
