# Rozie.js

A cross-framework component definition language and compiler. Authors write components once in a Vue/Alpine-flavored block-based syntax (`.rozie` files), and Rozie compiles them to idiomatic React, Vue, Svelte, Angular, Solid, and Lit components. The name derives from the Rosetta Stone — one source, many target languages.

Rozie is **not** a runtime framework. It does not own the rendering pipeline; the heavy lifting still happens in whichever target framework the consumer chose. Rozie owns the **author-side API** so a single component definition can drop into any of the six supported frameworks without per-framework wrapper boilerplate.

**📖 [Documentation](https://one-learning-community.github.io/rozie.js/)** — install, quick start, features tour, and live examples (the docs site dogfoods the compiler — every example is the actual `.rozie` source compiled by `@rozie/unplugin/vite` and rendered inline).

## Who it's for

Component-library and design-system authors who today maintain manual bindings/wrappers across React, Vue, Svelte, Angular, Solid, and Lit for libraries that ultimately do their real work in vanilla JS. Write one `.rozie` file, ship working idiomatic consumers in every framework from it.

## Status

Pre-v1.0, internal monorepo. All six target emitters are shipped and gated by a byte-identical dist-parity suite — every reference component compiled across all six targets and every entrypoint (compile API / CLI / Babel plugin / unplugin) must match byte-for-byte. Each target ships with a consumer demo plus Playwright e2e coverage.

| Package | Status |
|---|---|
| [`@rozie/core`](packages/core) | Shipped — SFC parser, IR, lowering pipeline |
| [`@rozie/target-vue`](packages/targets/vue) | Shipped — Vue 3.4+ SFC emitter |
| [`@rozie/target-react`](packages/targets/react) | Shipped — React 18+ function-component emitter |
| [`@rozie/target-svelte`](packages/targets/svelte) | Shipped — Svelte 5+ runes-mode emitter |
| [`@rozie/target-angular`](packages/targets/angular) | Shipped — Angular 19+ standalone-component emitter |
| [`@rozie/target-solid`](packages/targets/solid) | Shipped — Solid 1.8+ signals-native emitter |
| [`@rozie/target-lit`](packages/targets/lit) | Shipped — Lit web-component emitter |
| [`@rozie/runtime-vue`](packages/runtime/vue) | Shipped — runtime helpers (`useOutsideClick`, `debounce`, `throttle`, key filters) |
| [`@rozie/runtime-react`](packages/runtime/react) | Shipped — runtime helpers + `useControllableState` |
| [`@rozie/runtime-svelte`](packages/runtime/svelte) | Shipped — runtime helpers |
| [`@rozie/runtime-solid`](packages/runtime/solid) | Shipped — runtime helpers + `createControllableSignal` |
| [`@rozie/runtime-lit`](packages/runtime/lit) | Shipped — runtime helpers |
| [`@rozie/unplugin`](packages/unplugin) | Shipped — Vite + Rollup + Webpack + esbuild + Rolldown + Rspack |
| [`@rozie/cli`](packages/cli) | Shipped — `rozie build` CLI across all six targets |
| [`@rozie/babel-plugin`](packages/babel-plugin) | Shipped — Babel-plugin path for non-Vite consumers |
| [`@rozie/docs`](docs) | Shipped — VitePress documentation site |
| [`tools/intellij-plugin`](tools/intellij-plugin) | Shipped — JetBrains IDE syntax + injection plugin |
| [`tools/textmate`](tools/textmate) | Shipped — TextMate grammar (VS Code, IDEA Community, docs-site Shiki) |

All six target emitters and the toolchain (CLI, Babel plugin, unplugin, editor tooling) are shipped and feature-complete internally. Public npm release under MIT (v1.0) is the remaining milestone before public availability.

## Quick look

A minimal Counter component in `.rozie`:

```rozie
<rozie name="Counter">
<props>{ value: { type: Number, default: 0, model: true }, step: { type: Number, default: 1 } }</props>
<script>
const canIncrement = $computed(() => $props.value + $props.step <= Infinity)
// Read a prop with $props; write a two-way (model) prop with $model.
const increment = () => { if (canIncrement) $model.value += $props.step }
</script>
<template>
  <button @click="increment">{{ $props.value }}</button>
</template>
<style>.counter { display: inline-flex; }</style>
</rozie>
```

In any Vite project today — pick a target and drop the unplugin in:

```ts
// vite.config.ts
import Rozie from '@rozie/unplugin/vite';
import vue from '@vitejs/plugin-vue'; // or @vitejs/plugin-react, @sveltejs/vite-plugin-svelte, etc.

export default { plugins: [Rozie({ target: 'vue' }), vue()] };
//                                  ^^^^^ swap for 'react' | 'svelte' | 'angular' | 'solid' | 'lit'
```

```vue
<script setup>
import Counter from './Counter.rozie';
</script>
<template><Counter v-model:value="n" /></template>
```

See the [docs site](https://one-learning-community.github.io/rozie.js/examples/) for the same `.rozie` source compiled side-by-side into all six targets, plus live demos for each example.

## Repo layout

```
packages/
  core/                                SFC parser, IR, lowering pipeline
  targets/{vue,react,svelte,angular,solid,lit}/  Per-framework emitters
  runtime/{vue,react,svelte,solid,lit}/  Runtime helpers consumed by emitted code
  unplugin/                            Vite/Rollup/Webpack/esbuild/Rolldown/Rspack plugin
  cli/                                 Standalone `rozie build` CLI
  babel-plugin/                        Babel-plugin path for non-Vite consumers
examples/
  *.rozie                              Reference components (Counter, SearchInput,
                                       Modal, Dropdown, TreeNode, Card/CardHeader, TodoList)
  consumers/                           Live Vite demos + Playwright e2e per target
docs/                                  VitePress documentation site
tools/
  intellij-plugin/                     JetBrains IDE plugin (syntax + injection)
  textmate/                            TextMate grammar (VSCode, IDEA Community)
tests/
  dist-parity/                         Byte-identical fixtures across all targets
  ...                                  Per-feature integration suites
.planning/                             Phase artifacts (gitignored — internal)
```

## Getting started

The shortest path to working output:

```bash
pnpm install
pnpm -r --filter '@rozie/core' --filter '@rozie/unplugin' --filter '@rozie/target-*' --filter '@rozie/runtime-*' build
```

Then either run one of the consumer demos:

```bash
cd examples/consumers/vue-vite      # or react-vite, svelte-vite, angular-analogjs, solid-vite, lit-vanilla-demo
pnpm dev                            # dev server with HMR
pnpm test:e2e                       # Playwright suite for this target
```

Or use the CLI directly for one-shot codegen:

```bash
pnpm rozie build examples/Counter.rozie --target solid --out Counter.tsx
```

For the full walkthrough — install, three different compile paths (Vite plugin, Babel plugin, CLI), per-feature tour, and live examples — see the [docs site](https://one-learning-community.github.io/rozie.js/guide/quick-start).

## Tech stack rationale

- `@babel/parser` + `@babel/traverse` + `@babel/types` + `@babel/generator` — `<script>` AST round-trip
- `htmlparser2` — SFC block splitter and `<template>` tokenizer
- `peggy` — modifier micro-grammar (`@click.outside($refs.x).stop`, `.debounce(300)`, `.throttle(100)`)
- `magic-string` — source-map-preserving string mutation in `<script>` and CSS
- `postcss` — `<style>` AST + scope-attribute selector rewriting
- `unplugin` v3 — author once, ship to Vite + Rollup + Webpack + esbuild + Rolldown + Rspack

Full rationale and alternatives considered in [`CLAUDE.md`](CLAUDE.md).

## IDE Tooling

A JetBrains IntelliJ Platform plugin (Rozie.js) provides syntax highlighting and JS/HTML/CSS language injection for `.rozie` files in IDEA Ultimate / WebStorm / PhpStorm / RubyMine / GoLand 2024.2+, with first-class support for the `<components>` block.

See [`tools/intellij-plugin/README.md`](tools/intellij-plugin/README.md) for installation, supported IDEs, dev loop, and dogfood feedback workflow.

For lightweight color-only support (no JS plugin required), the [TextMate grammar](tools/textmate/) at `tools/textmate/` works in IDEA Community, PyCharm CE, and VSCode. The same grammar powers Shiki syntax highlighting on the docs site.

## Contributing

This is a planned, phase-driven build under the [GSD workflow](https://github.com/anthropics/gsd) (`/gsd-execute-phase`, `/gsd-plan-phase`, etc.). Phase artifacts live in `.planning/phases/` (gitignored). Read [`CLAUDE.md`](CLAUDE.md) and `.planning/PROJECT.md` before opening a substantive PR.

## License

[MIT](LICENSE) © 2026 Dan Krieger and Rozie.js contributors.
