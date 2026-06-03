# Rozie + Astro — Multi-Target Island Matrix

Proves Rozie's cross-framework value proposition holds inside **Astro's island
architecture at runtime**: one canonical rich `Counter.rozie`, compiled to every
target Rozie supports, mounted as an interactive island on a single page. The
Counter has **plus / minus** buttons bounded to `min=0, max=10`, a
`$computed`-driven `:disabled` on each button at its bound, and a `:class` hover
background effect. Each island starts at `0` — so Decrement is **disabled at
load** (a visible bounds proof) and only enables after a click, a transition
that can only happen if the reactive `$computed` re-ran in the browser (real
hydration + reactivity, not just static tag presence).

Builds on the [adopt-incrementally guide § Astro](../../../docs/guide/adopt-incrementally.md)
and [for-astro-and-html-first-shops](../../../docs/guide/for-astro-and-html-first-shops.md)
walkthroughs.

## Coverage matrix

| Target  | Integration                         | Directive     | Status      | Notes / exception reason |
| ------- | ----------------------------------- | ------------- | ----------- | ------------------------ |
| Vue     | `@astrojs/vue`                      | `client:load` | ✓ covered   | Full rich behavior verified: bounds, `$computed`-driven `:disabled` at min/max, hover background. SSR-renders the static markup too. |
| Svelte  | `@astrojs/svelte`                   | `client:load` | ✓ covered   | Full rich behavior verified: bounds, `$computed`-driven `:disabled`, hover background. SSR-renders the static markup too. |
| Solid   | `@astrojs/solid-js`                 | `client:load` | ✓ covered   | Full rich behavior verified under Solid's babel/jsx-dom-expressions pipeline. |
| React   | `@astrojs/react`                    | `client:load` | ✓ covered   | Full rich behavior verified. The React emit CSS-Modules-hashes author class names (`counter`→`_counter_1d11t_1`, `value`→`_value_1d11t_3`), so the spec locates elements by **role / structure / effect** (button `aria-label`, the lone `<span>`, the nearest `<div>` ancestor, the rendered hover background) — never by class name. See `project_react_classhash_breaks_selectors`. |
| Lit     | native Web Component (no integration)| none         | ✓ covered   | `<rozie-counter>` self-registers via a client `<script>` import; shadow-DOM controls hydrate (open shadow root, so Playwright's role/structural locators pierce it). Full rich behavior verified. |
| Angular | —                                   | N/A           | ✗ exception | **No first-party `@astrojs/angular`** — only the community `@analogjs/astro-angular`. Intentionally not wired. |

All five island/web-component targets (React, Vue, Svelte, Solid, Lit) genuinely
hydrate **and** pass the full rich-behavior runtime spec (bounds + `$computed`-driven
`:disabled` reactivity + hover effect), verified by Playwright. The spec tests by
role / structure / effect rather than by author class name, so React's class
hashing is a non-issue (it would only break class-selector locators, not the
island). Angular is the sole exception — the wiring gap (no first-party
integration), not a Rozie-emit failure.

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
  island asserts the full rich behavior — initial `0`, Decrement disabled at
  the `min=0` floor / Increment enabled, click→`1` re-enables Decrement
  (proving `$computed` re-ran in the browser), climb to `max=10` disables
  Increment, step back re-enables it, and the hover background resolves to
  `rgba(0, 0, 0, 0.04)` (asserted as the rendered effect, hashing-agnostic).

Each island passes `step={1} min={0} max={10}` but OMITS `value`, letting it use
its `<props>` default (0). `value` is a `model: true` prop; passing it
explicitly would make the island a *controlled* component bound to a parent that
doesn't exist, freezing the count. Omitting it keeps each island uncontrolled
and self-interactive. With `value=0` and `min=0`, Decrement is disabled at load
(`canDecrement = 0 - 1 >= 0 → false`) — a visible bounds proof on every island.

## Run

```bash
pnpm install
pnpm build              # astro build — multi-target island matrix

pnpm test:smoke         # build smoke (vitest: astro build + tag/marker asserts)

pnpm test:e2e:install   # one-time: playwright install chromium
pnpm test:e2e           # runtime hydration: rich Counter behavior per covered island
```

`test:smoke` (vitest, `*.test.ts`) and `test:e2e` (Playwright, `*.spec.ts`) are
kept disjoint by `vitest.config.ts` (include `*.test.ts`) and
`playwright.config.ts` (`testMatch` `hydrate.spec.ts`), so neither runner picks
up the other's files. `test:smoke` is intentionally **not** named `test` so the
repo-wide `turbo run test` gate doesn't trigger this build in parallel with the
rest of the suite.

## What this proves

A single canonical rich Rozie component definition — plus/minus buttons,
`min`/`max` bounds, a `$computed`-driven `:disabled` at each bound, and a hover
effect — mounts as a working, **interactive** island across React, Vue, Svelte,
and Solid (via `@astrojs/*` integrations) plus Lit (native web component) on one
Astro page, with the full reactive behavior verified at runtime (not just
build/tag presence). One documented exception:

- **Angular** — no first-party `@astrojs/angular` (only the community
  `@analogjs/astro-angular`); intentionally not wired.

> Note on React: its emit CSS-Modules-hashes author class names, so the runtime
> spec deliberately locates elements by role / structure / effect (button
> `aria-label`, the lone `<span>`, the nearest `<div>` ancestor, the rendered
> hover background) rather than by class name. That's standard resilient-locator
> practice and makes React's hashing a non-issue — the island hydrates and
> reacts identically to the others.
