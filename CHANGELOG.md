# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — single
top-level changelog for the monorepo. Per-package CHANGELOGs land alongside
changesets in Phase 6 (DIST distribution hardening).

## [Unreleased]

### Internal — `:class` normalizer (`rozieClass`), on `main`, not yet published (2026-06-20)

A shared clsx-style `rozieClass()` normalizer is wired into the `:class` emit
path of all six targets, so `:class` now accepts `string | string[] |
Record<string, boolean> | nested` uniformly (Vue-`normalizeClass`-style),
fixing a latent bug where array / object-via-prop class bindings emitted
`"a,b"` / `"[object Object]"` / JSON on React/Solid/Svelte/Lit/Angular. Gated
on the existing `wrapForDisplay` IR flag, so provably-string, object-literal,
static, and template-literal `:class` output is byte-unchanged. Reaches
consumers when packages built after it publish (already live in
`@rozie-ui/sortable-list-vue@0.1.3`); the wave-2 react/solid/svelte/lit leaves
inherit it on their first publish.

### Tooling — pnpm monorepo workaround for `@analogjs/vite-plugin-angular` phantom deps (2026-05-15)

Workspace consumers running multiple Angular majors in one pnpm workspace
previously hit cross-version compile crashes because
`@analogjs/vite-plugin-angular@2.5.x` does `import * as ts from 'typescript'`,
`import * as compilerCli from '@angular/compiler-cli'`, and `import * as
ngCompiler from '@angular/compiler'` without declaring any of them as peer
dependencies — pnpm's flat-hoist slot would pick one major and the wrong-
versioned consumer would crash.

Patched via `pnpm.packageExtensions` in the workspace root `package.json`,
giving analogjs explicit peer-dep declarations for all three phantoms. Each
consumer's analogjs slot now resolves locally to the matching Angular major
+ TS version. Real upstream fix tracked separately; the workspace patch is
documented in `docs/guide/install.md` for consumers in mixed-Angular pnpm
monorepos.

Single-app projects with one Angular pin were not affected and need no
action.

### Compatibility — TypeScript floor bumped 5.4.5 → 5.6.0 (2026-05-15)

**Breaking change for consumers still on TypeScript ≤5.5.** Rozie's minimum
supported TypeScript is now `5.6.0`. Older versions may still work for some
targets but aren't tested and aren't supported.

Rationale:

- TypeScript 5.4 hit Microsoft's end-of-support window in 2025. The
  `current + previous` support policy means 5.4 has been past EOL for over
  a year.
- TS 5.5+ exports its CJS module flat to ESM consumers (`import * as ts from
  'typescript'`). On TS ≤5.4, the namespace wraps everything under `default`,
  which breaks upstream tooling like `@analogjs/vite-plugin-angular@2.5.x`
  whose source assumes flat names (`ts.createPrinter`).
- Angular 19's own `peerDependencies.typescript` is `>=5.5.0 <5.9.0`. Any
  consumer building Angular 19+ with Rozie was already on TS ≥5.5 in
  practice; we now match the same effective floor across all targets.
- The `examples/consumers/{svelte,vue,solid,react}-ts/` floor anchors bumped
  their pin from `~5.4.5` to `~5.6.0` to match.

What this changes for you:

- Consumers on TS 5.6+: no change required.
- Consumers on TS 5.5: bump to 5.6. No emitted-code changes between these
  two versions that affect Rozie output.
- Consumers stuck on TS ≤5.4: bump TS. If a hard blocker prevents the bump,
  open an issue describing the constraint.

### Phase 3 — Vue 3.4+ Target Emitter (first demoable artifact, 2026-05-02)

Phase 3 ships the first end-to-end demoable artifact: a `.rozie` author can
`import Counter from './Counter.rozie'` from a Vue + Vite project and get a
working idiomatic Vue SFC with `defineProps<T>()` / `defineModel()` /
`defineEmits<T>()` / `defineSlots<T>()` macros and source maps that resolve
back to the `.rozie` source.

Packages added (all `0.0.0` private until Phase 6 first publish):

- **`@rozie/target-vue`** — pure IR-to-Vue lowering. `emitVue(ir, { filename, source }) → { code, map, diagnostics }`. Zero bundler dependencies.
- **`@rozie/runtime-vue`** — peer-dep helper package with tree-shakable named exports for non-native Vue modifiers: `useOutsideClick`, `debounce`, `throttle`, key-filter helpers (`isEnter`, `isEscape`, etc.).
- **`@rozie/unplugin`** — `unplugin v3 createUnplugin()` factory. Phase 3 wires + tests the Vite entry only (`@rozie/unplugin/vite`); other entry points (`/rollup`, `/webpack`, `/esbuild`, `/rolldown`, `/rspack`) export the same factory but are not actively tested until Phase 6.

Reference examples (`Counter`, `SearchInput`, `Dropdown`, `TodoList`, `Modal`)
all compile + render correctly to Vue 3.4 + 3.5. Verified by 6 Playwright
e2e tests covering all 5 phase success criteria + the Modal OQ4 anchor.

Decisions logged:

- D-25 amended 2026-05-02: path-virtual scheme adopted. The transform-only path failed because `@vitejs/plugin-vue`'s `transformInclude` defaults to `/\.vue$/` — our `.rozie` ids never reached vite-plugin-vue's parser. resolveId now rewrites `Foo.rozie` → `<abs>/Foo.rozie.vue` (synthetic non-`\0` suffix; `\0`-bearing ids are filtered out by Vite's `createFilter`). Documented in `.planning/phases/03-vue-3-4-target-emitter-first-demoable-artifact/03-CONTEXT.md`.
- OQ4 RESOLVED — Modal compiles + works via prop binding alone, no `$expose()` / `defineExpose` needed. Disposition: defer to v2. Phase 4 (React) re-monitors.

---

# Published to npm

All published with provenance (SLSA, via GitHub Actions OIDC) from the
`Release (early subset)` workflow. Auth is the npm token bootstrap for now;
migration to token-free Trusted Publishing is pending. Versions are
per-package.

## `@rozie-ui/sortable-list-vue` 0.1.3 — 2026-06-21

Consumer-reported data-integrity fix.

- **Object-identity keying.** `itemKey` now accepts `string | ((item, index) => key)`, and lists with no stable id get a built-in WeakMap object-identity default. Reordering no longer rebinds a component instance to a different item — fixing corruption where row components seed local state on mount and write it back to the wrong item. Index-keying is no longer the fallback for object items.
- **Rich class props.** `listClass` / `itemClass` now accept `string | string[] | Record<string, boolean>` (was string only).

## `@rozie-ui/sortable-list-vue` 0.1.2 — 2026-06-20

vuedraggable-parity additions (consumer feedback).

- `#header` / `#footer` slots rendered inside the list container, around the items.
- `listClass` / `itemClass` class hooks — style the list and item elements directly (Bootstrap `.list-group > .list-group-item`, flex/grid parent, `:nth-child`).
- Drag scoped to item rows (`draggable: '.rozie-sortable-item'`) so header/footer aren't draggable and reorder math stays correct.

## `@rozie-ui/*-vue` 0.1.1 — 2026-06-20

Compiled dual packaging for all five Vue leaves (`flatpickr`, `sortable-list`,
`cropper`, `fullcalendar`, `pdf`).

- `"."` now resolves to a compiled `dist/index.mjs` (SFC compiled via Vite lib mode + `vue-tsc` declarations; CSS injected at import; `vue` + the engine externalized as peers) plus `dist/index.d.ts`. Consumers no longer need a `.vue`/TypeScript toolchain to drop these in.
- Raw SFC source remains available under the `"./source"` subpath for consumers who prefer to compile it themselves.

## First publish — 0.1.0 — 2026-06-20

The first Rozie.js release to npm. 14 packages, all with provenance.

- **Toolchain (`@rozie/*`):** `core`, `cli`, `unplugin`, `babel-plugin`, `runtime-react`, `runtime-vue`, `runtime-svelte`, `runtime-solid`, `runtime-lit`.
- **UI Vue leaves (`@rozie-ui/*-vue`):** `flatpickr`, `sortable-list`, `cropper`, `fullcalendar`, `pdf` (initially shipped as raw `.vue` source; replaced by the compiled dual packaging in 0.1.1).

Not yet published: the react/solid/svelte/lit/angular `@rozie-ui` leaves
(wave 2) and `data-table`.
