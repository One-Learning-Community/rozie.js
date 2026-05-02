# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — single
top-level changelog for the monorepo. Per-package CHANGELOGs land alongside
changesets in Phase 6 (DIST distribution hardening).

## [Unreleased]

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
