# Rozie + Astro — Multi-Target Island Matrix

Proves Rozie's cross-framework value proposition holds inside **Astro's island
architecture at runtime**: one `Counter.rozie`, compiled to every target Rozie
supports, mounted as an interactive island on a single page — each starting at
`Count: 0` and incrementing on click (real hydration, not just tag presence).

Builds on the [adopt-incrementally guide § Astro](../../../docs/guide/adopt-incrementally.md)
and [for-astro-and-html-first-shops](../../../docs/guide/for-astro-and-html-first-shops.md)
walkthroughs.

## Coverage matrix

| Target  | Integration                         | Directive     | Status      | Notes / exception reason |
| ------- | ----------------------------------- | ------------- | ----------- | ------------------------ |
| React   | `@astrojs/react`                    | `client:load` | ✓ covered   | Island hydrates; click increments. |
| Vue     | `@astrojs/vue`                      | `client:load` | ✓ covered   | Island hydrates; also SSR-renders `Count: 0` in static markup. |
| Svelte  | `@astrojs/svelte`                   | `client:load` | ✓ covered   | Island hydrates; also SSR-renders `Count: 0` in static markup. |
| Solid   | `@astrojs/solid-js`                 | `client:load` | ✓ covered   | Island hydrates under Solid's babel/jsx-dom-expressions pipeline; click increments. |
| Lit     | native Web Component (no integration)| none         | ✓ covered   | `<rozie-counter>` self-registers via a client `<script>` import; shadow-DOM button hydrates. |
| Angular | —                                   | N/A           | ✗ exception | **No first-party `@astrojs/angular`** — only the community `@analogjs/astro-angular`. Intentionally not wired. |

All five island/web-component targets genuinely hydrate (verified by the
Playwright runtime spec). Angular is the single documented coverage exception.

## The target-selection mechanism (Mechanism B)

`@rozie/unplugin`'s factory is **target-locked per instance** — `Rozie({ target })`
captures the target and its `resolveId` is **path-blind** (it rewrites *any*
bare `.rozie` import to that target's synthetic id by extension only; there is
no `include`/`exclude` knob). And Astro does **not** isolate per-renderer Vite
pipelines — every `@astrojs/*` integration injects its renderer plugin into one
**shared** Vite config. So a single shared plugin array cannot host five targets
against one `.rozie` file (the first instance's `resolveId` captures everything).

This rules out **Mechanism A** (per-renderer pipeline isolation). The demo uses
**Mechanism B**: each island framework gets its own byte-identical copy of
`Counter.rozie` under `src/components/{react,vue,svelte,solid}/`, and each Rozie
instance is wrapped by a small `scopeRozie()` helper in `astro.config.mjs` that
gates the path-blind hooks on the import's directory. Lit keeps the root copy
(`src/components/Counter.rozie`) via a global-but-subdir-excluding instance and
ships as a native custom element. React + Solid both emit `.tsx`, so each JSX
renderer is additionally `include:`-scoped to its subdir to resolve Astro's
"more than one JSX renderer" ambiguity.

> A future `@rozie/unplugin` `include`/`exclude` option would let this collapse
> to a single shared copy of `Counter.rozie` per target without the subdir trick.

## Shape

- `astro.config.mjs` — the four island integrations + the five path-scoped Rozie
  instances (Mechanism B), plus `esbuild.experimentalDecorators` so the Lit emit's
  `@customElement`/`@property` decorators are lowered (Astro's default transform
  leaves them raw, which crashes the browser).
- `src/components/Counter.rozie` (root, Lit) + `src/components/{react,vue,svelte,solid}/Counter.rozie`
  — byte-identical copies, one per target.
- `src/pages/index.astro` — one island per covered target with stable
  `data-target="…"` hooks; Lit via client `<script>` + `<rozie-counter>`.
- `tests/build.test.ts` — build smoke (vitest): `astro build` then assert the
  rendered HTML has `<rozie-counter>` and the JS bundle has Rozie markers.
- `tests/hydrate.spec.ts` — runtime hydration spec (Playwright): every covered
  island starts at `Count: 0` and shows `Count: 2` after one click.

Each island passes only `step={2}` and lets `value` use its `<props>` default
(0). `value` is a `model: true` prop; passing it explicitly would make the
island a *controlled* component bound to a parent that doesn't exist, freezing
the count. Omitting it keeps each island uncontrolled and self-interactive.

## Run

```bash
pnpm install
pnpm build              # astro build — multi-target island matrix

pnpm test:smoke         # build smoke (vitest: astro build + tag/marker asserts)

pnpm test:e2e:install   # one-time: playwright install chromium
pnpm test:e2e           # runtime hydration: every covered island 0 → 2 on click
```

`test:smoke` (vitest, `*.test.ts`) and `test:e2e` (Playwright, `*.spec.ts`) are
kept disjoint by `vitest.config.ts` (include `*.test.ts`) and
`playwright.config.ts` (`testMatch` `hydrate.spec.ts`), so neither runner picks
up the other's files. `test:smoke` is intentionally **not** named `test` so the
repo-wide `turbo run test` gate doesn't trigger this build in parallel with the
rest of the suite.

## What this proves

A single Rozie component definition mounts as a working, **interactive** island
across React, Vue, Svelte, and Solid (via `@astrojs/*` integrations) plus Lit
(native web component) on one Astro page — runtime hydration verified, not just
build/tag presence. Angular is the documented exception pending a first-party
`@astrojs/angular`.
