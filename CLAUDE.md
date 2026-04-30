<!-- GSD:project-start source:PROJECT.md -->
## Project

**Rozie.js**

Rozie.js is a cross-framework component definition language and compiler. Authors write components once in a Vue/Alpine-flavored block-based syntax (`.rozie` files), and Rozie compiles them to idiomatic React, Vue, Svelte, and Angular components. The name derives from the Rosetta Stone — one source, many target languages.

It is **not** a runtime framework. Rozie deliberately does not try to be a "better React" or own the rendering pipeline; the heavy lifting still happens in whichever target framework the consumer chose. Rozie owns the **author-side API** so a single component definition can drop into any of the four major frameworks without per-framework wrapper boilerplate.

The audience is **component-library and design-system authors** who today maintain manual bindings/wrappers across React, Vue, Svelte, and Angular for libraries that ultimately do their real work in vanilla JS.

**Core Value:** A component-library author can write one `.rozie` file and ship working, idiomatic React + Vue + Svelte + Angular consumers from it — eliminating the manual cross-framework wrapper work that today dominates the maintenance budget of cross-framework UI libraries.

### Constraints

- **Language:** Project source is JavaScript (Node) for the toolchain; emitted code is JS/TS for each target framework.
- **Tech stack:** Vite plugin must support Vite 5+. Babel plugin must support Babel 7+. CLI must work on Node 20+.
- **Compatibility:** Target framework versions are React 18+, Vue 3.4+, Svelte 5+, Angular 17+ (signals era). Older versions are out of scope.
- **Compatibility bar:** "High percentage" cross-framework parity, not 100%. Documented edge cases (notably React's render-prop-flavored slot consumer experience) are acceptable.
- **Audience constraint:** Every feature must answer "does a component-library author actually need this?" — if not, defer.
- **Aesthetic constraint:** When designing new features, default to "what would feel natural to a Vue developer?" Push back on JSX-isms or React-isms.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## TL;DR — The Recommended Stack
| Layer | Choice | Rationale (one line) |
|---|---|---|
| SFC block splitter | Hand-rolled lightweight scanner over `htmlparser2` tokenizer | `@vue/compiler-sfc` is too Vue-coupled to subclass; htmlparser2 is what Vue itself forked from |
| Template parser | Hand-rolled AST building on `htmlparser2` Tokenizer + `@babel/parser` for embedded expressions | Need full control of `r-*`, `@event.modifier(args)`, `:prop`, `{{ }}` semantics; htmlparser2 handles HTML, Babel handles expressions |
| Modifier-grammar parser | `peggy` (PEG) for the `event.modifier(args).modifier2` micro-grammar | Tiny grammar, declarative, faster to maintain than hand-rolled |
| `<props>` / `<data>` parser | Custom Babel-driven object-literal parser (NOT plain `json5`) | Examples use functions (`default: () => []`), `Infinity`, ES type tokens (`Number`) — JSON5 cannot parse these; Babel's `parseExpression` can |
| `<script>` AST | `@babel/parser` + `@babel/traverse` + `@babel/types` + `@babel/generator` | The only mature pure-JS AST toolkit with stable public traversal/builder APIs; SWC/OXC bindings are speed-optimized but ergonomically harder for source-to-source emission |
| Code emission | `@babel/generator` per-target + `magic-string` for surgical script-block patches | AST-based emit is correct by construction; magic-string handles "rewrite this prop assignment" without a full reparse |
| Plugin distribution | **`unplugin` v3** (Vite + Rollup + Webpack + esbuild + Rolldown + Rspack) | Author once, ship to Vite plugin AND Rollup plugin AND Webpack loader AND esbuild plugin from one factory; meets the "Vite plugin + Babel plugin parity" requirement at the build-tool layer |
| Babel-plugin path | Hand-authored `@babel/plugin` thin wrapper that calls into core compiler | Babel plugins are NOT covered by `unplugin` — that's a separate compiler-level integration |
| CLI | `commander` + `fast-glob` + the core compiler API | Standard, boring, well-trodden; no need for clipanion/citty exotics |
| TS declaration emission | `dts-buddy` + per-target hand-emitted `.d.ts` shim where types diverge | `tsc --emitDeclarationOnly` cannot type the *generated* output across four frameworks; hand-emit is unavoidable for cross-framework prop/slot signatures |
| Monorepo | **pnpm workspaces** + **Turborepo** | Right-sized for ~6 packages; Turborepo's caching pays off as soon as the test matrix grows |
| Build (per-package) | **`tsdown`** (Rolldown-backed) | tsup successor, ESM-first, dual ESM/CJS + d.ts in one shot, 10-100x faster type emission via Oxc isolated-decl |
| Lint + format | **Biome** (single tool) | Monorepo simplicity, zero plugin coordination, 10-25x faster than ESLint+Prettier; we have no exotic ESLint rule needs |
| Test runner | **Vitest** with `toMatchFileSnapshot` for compiler fixtures | Standard 2025 choice; file-snapshot mode is purpose-built for "fixture in, generated source out" testing |
| Source maps | `magic-string` everywhere we mutate strings | Industry standard; ECMA-426 standardised at end of 2024 |
| CSS scoping | Custom `postcss` pass (NOT lightningcss) | We need to walk an AST to apply scope-attribute selectors and detect the `:root { }` escape hatch; PostCSS plugin ecosystem makes this trivially extensible |
## Core Technologies
| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| `@babel/parser` | ^7.29 | Parse `<script>` block and inline expressions in `<template>` / `<listeners>` | The de facto JS AST. Stable public API, supports every JS proposal, handles JSX/TS/Flow as parser plugins, and Vue itself uses `@babel/parser` for expression parsing (`compiler-core` switched to it years ago). Pure JS — no native binary, frictionless install. |
| `@babel/traverse` | ^7.29 | Walk + mutate `<script>` AST | Pairs with `@babel/parser`. Visitor pattern is well-documented. Required for transformations like rewriting `$props.x = y` into `emit('update:x', y)` for Vue or `setX(y)` for React. |
| `@babel/types` | ^7.29 | Build new AST nodes for emission | Builder functions (`t.callExpression`, `t.memberExpression`) are how you generate target-framework code via AST rather than string concatenation. Source of truth for node shapes. |
| `@babel/generator` | ^7.29 | Emit JS source from AST per target | Stable, predictable output. Preserves source maps. The new (7.25+) experimental format-preserving mode is interesting but NOT needed — we're emitting fresh code per target, not codemodding. |
| `htmlparser2` | ^12 | Tokenize SFC top-level blocks and `<template>` markup | The fastest streaming HTML tokenizer (≈4x parse5). Vue's new SFC parser is forked from htmlparser2 specifically because they wanted custom-block tolerance and forgiving syntax handling. Gives us the same advantage. |
| `peggy` | ^5 | Parse modifier micro-grammar (`@click.outside($refs.x).stop`) | Modifier grammar is small, regular, and lives separately from the rest of the template — a textbook PEG use case. Hand-rolling this is wasted effort; Chevrotain is over-spec'd for a sub-100-line grammar. |
| `magic-string` | ^0.30 | Source-map-preserving string mutation in `<script>` and CSS scoping pass | Industry standard. Used by Rollup, Vite, Svelte, Vue, Astro. ECMA-426 source-map-aware. Faster than reparse-and-regenerate when only a handful of edits are needed. |
| `postcss` | ^8.5 | Parse `<style>` block, apply scoping attribute, detect `:root { }` escape hatch | We need an AST pass to selector-rewrite, not just a tokenizer. PostCSS is the universal CSS AST library — Vue, Svelte, Vite, Tailwind, every modern build tool already depends on it. Lightningcss is faster but we don't have a perf bottleneck here, and PostCSS's plugin ecosystem (autoprefixer, nested-rule support, etc.) is cheap to opt into for consumers. |
| `unplugin` | ^3 | Author the build-tool plugin once; emit Vite/Rollup/Webpack/esbuild/Rolldown/Rspack adapters | The whole point of the project is "drop a `.rozie` file in any pipeline." unplugin is the *only* sane way to ship that without four separate plugin packages diverging over time. v3 added Rolldown + improved Vite hooks. |
| `vite` | ^8 | Primary supported host for the Vite plugin path | Constraints state "Vite 5+." Vite 8 is current; we should support 5/6/7/8. unplugin handles the API differences. |
| `@babel/core` | ^7.29 | Babel-plugin host (separate from the build-tool plugin) | The `<babel-plugin>` requirement is *not* satisfied by unplugin — Babel plugins are AST visitors, not build hooks. We author a thin `babel-plugin-rozie` that detects `.rozie` imports, calls into the core compiler, and replaces the import with the compiled module. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `fast-glob` | ^3 | Resolve `src/components/**/*.rozie` in CLI | CLI input expansion. Standard. |
| `commander` | ^14 | CLI flag parsing for `rozie build` | Boring, ubiquitous, well-typed. Alternative `citty` (UnJS) is fine but adds an opinionation tax. |
| `picocolors` | ^1 | Terminal output coloring in CLI + diagnostics | Smaller than `chalk`, zero deps, used by Vite/PostCSS internally. |
| `@babel/code-frame` | ^7 | Render compile-error code frames pointing to `.rozie` source | Same lib Babel/Vite/Vue use. Free for us. |
| `dts-buddy` | ^0.7 | Bundle `.d.ts` files for the toolchain itself | For the toolchain's *own* TypeScript types when published. Svelte uses this internally — battle-tested in a similar single-file-component compiler context. |
| `prettier` | ^3.8 | Optional: pretty-print emitted output before write (CLI mode only) | Opt-in, off by default. v1 is "just has to work" — not "pretty output." Per the PROJECT.md "Output prettiness is a v2 concern." Available behind `--pretty` for CLI codegen. |
### Development Tools
| Tool | Purpose | Notes |
|---|---|---|
| `pnpm` (^10) | Package manager + workspaces | Required. The npm/yarn alternatives don't have content-addressable storage and are wasteful for monorepos this size. `packageManager` field in root `package.json` should pin a version. |
| `turbo` (^2.9) | Task orchestration with caching across packages | Use it from day one. Cache `build`, `test`, `typecheck` — that's the whole config. Free tier remote-cache via Vercel is fine for OSS. |
| `tsdown` (^0.21) | Per-package bundle to dual ESM/CJS + d.ts | Swap in tsup if tsdown causes friction (it's young — 0.x). Migration is a one-line config change either way. |
| `vitest` (^4) | Test runner | Use `toMatchFileSnapshot` for compiler-output fixtures: every `examples/*.rozie` produces 4 expected outputs (`.expected.react.tsx`, `.expected.vue`, `.expected.svelte`, `.expected.ts` for Angular). File snapshots get syntax highlighting in PRs. |
| `@biomejs/biome` (^2.4) | Lint + format in one tool, one config | Replaces ESLint+Prettier. v2 is stable and the toolchain has no need for niche ESLint plugins. |
| `tsc` (TypeScript ^5.7+) | Type-checking only (`--noEmit`) | We do not use `tsc` for emission; `tsdown` handles that. `tsc` runs in CI via `turbo run typecheck` for cross-package checking. |
| `changesets` | Version + release workflow for monorepo packages | Standard for OSS monorepos; Turborepo and pnpm both have first-class support. |
## Installation
# Workspace bootstrap
# Core compiler package (packages/core)
# Vite/Rollup/Webpack plugin (packages/unplugin)
# Babel plugin (packages/babel-plugin)
# CLI (packages/cli)
# Type emission helper (packages/types)
## The Five Big Decisions, with Rationale
### 1. Parser — Hand-rolled over `@vue/compiler-sfc`, `htmlparser2`-backed
| Approach | Verdict |
|---|---|
| `@vue/compiler-sfc.parse()` — reuse Vue's SFC splitter | **Rejected.** It's tightly coupled to Vue's `SFCDescriptor` shape (`script`, `scriptSetup`, `template`, `styles`, `customBlocks`). We have first-class blocks (`<props>`, `<data>`, `<listeners>`) that would all bucket into `customBlocks: SFCBlock[]` as opaque text. We'd be re-doing every block-content parse anyway, and we'd inherit Vue's parser semantics (e.g., it specifically forbids `{{ }}` in plain attribute values — a Rozie feature). It would be wagging the dog. |
| `htmlparser2` directly | **Accepted.** This is what Vue's *own* new SFC parser is forked from (PR #9674). It's ~10× the speed of parse5, handles malformed/custom syntax gracefully, and has a streaming/SAX interface that maps cleanly onto a finite-state SFC scanner. We use its low-level Tokenizer for SFC block-splitting and a slim DOM builder over it for `<template>`. |
| `parse5` | Rejected. Overkill (full WHATWG HTML5 spec compliance), ~2× slower, and *less* tolerant of our custom syntax (`r-for="item in items"`, `@click.outside($refs.x)` in attribute values) than htmlparser2. |
| Chevrotain / Peggy / Ohm for the *whole* template language | Rejected for the template at large — too much grammar to maintain, and HTML's whitespace/comment/CDATA rules are full of WHATWG-spec subtleties that no parser combinator describes succinctly. **Accepted for the modifier sub-grammar** (`@click.outside($refs.x).stop`) because that grammar is tiny and regular. |
- `r-*` directives (not `v-*`)
- `{{ }}` permitted inside plain attribute values (Vue forbids)
- Parameterized dotted modifiers with arguments (`.debounce(300)`, `.outside($refs.x)`) — Vue's modifier grammar has no concept of args
- Inline JS expressions in handlers (`@click="$props.closeOnBackdrop && close()"`) — we want richer expression handling than Vue's simple-expression-or-method-name form
### 2. AST manipulation — `@babel/*` over SWC/OXC
- Detect writes to `$props.foo` where `foo` is *not* `model: true` (compile error)
- Rewrite writes to `$props.foo` (where `foo` IS `model: true`) into the per-target two-way path: React `onValueChange?.(x)`, Vue `emit('update:foo', x)`, Svelte `bind:foo` rune assignment, Angular `valueChange.emit(x)`
- Identify free reads of `$data.x`, `$props.y`, `$refs.z` to compute the React `useEffect` dep array statically
- Rewrite `$computed(() => …)`, `$onMount(…)`, `$emit(…)` into per-target equivalents
- Preserve user-authored type annotations in TS
| Need | Babel | SWC | OXC |
|---|---|---|---|
| Mature visitor traversal API | ✅ | ⚠️ Rust-side, JS surface less ergonomic | ⚠️ Transformer is alpha (Sept 2024 announcement); JS API limited |
| Programmatic AST builders (`t.callExpression(...)`) | ✅ `@babel/types` | ⚠️ Limited from JS | ❌ Not exposed |
| Stable public API for source-to-source emit | ✅ | ⚠️ Internal-shape, can change between versions | ❌ Pre-1.0 |
| Pure JS, no native binary friction | ✅ | ❌ Native, install-time toolchain hop | ❌ Native |
| Used by Vue/Astro/Svelte for similar work | ✅ Vue compiler-core, Astro, MDX | (none) | (none) |
### 3. Plugin system — `unplugin` v3, with a separately-authored Babel plugin
- The Vite plugin operates at the **build-tool layer** (file-resolution + transform hooks). Rollup, Webpack, esbuild, Rolldown, Rspack are siblings.
- The Babel plugin operates at the **AST layer** (visit `import` declarations whose source ends in `.rozie`).
- `@rozie/vite-plugin` (re-export of `unplugin.vite`)
- `@rozie/rollup-plugin` (`unplugin.rollup`)
- `@rozie/webpack-loader` (`unplugin.webpack`)
- `@rozie/esbuild-plugin` (`unplugin.esbuild`)
- `@rozie/rspack-plugin` (`unplugin.rspack`)
### 4. TypeScript declaration emission — hand-emit per target, `dts-buddy` only for the toolchain itself
- React target emits `.tsx`. `tsc` can declaration-emit `.tsx`, but the resulting types are React-specific (`React.FC<Props>`, etc.). Useful for React consumers — but they only want the React types.
- Vue target emits `.vue` SFCs. `tsc` cannot declaration-emit `.vue` files at all without `vue-tsc`. Adds a dependency.
- Svelte target emits `.svelte`. Needs `svelte2tsx` + `svelte-check`.
- Angular target emits standalone components. Needs `ng-packagr` or hand-typed declarations to be ergonomic.
- **React `.d.ts`:** synthesise `interface FooProps { … }` from `<props>` AST + `slots` from template + `Slots` render-prop signatures. Emit alongside `.tsx`.
- **Vue:** Vue 3.4+ has `defineProps<T>()` macro support; emit `defineProps<FooProps>()` directly inside the SFC. `vue-tsc` handles the rest at consumer-side.
- **Svelte 5:** runes-mode `$props` accepts a generic `$props<{…}>()`. Same trick.
- **Angular:** `@Input()` decorators are typed by their TS types. Emit `@Input() value!: number;` directly.
- `@microsoft/api-extractor` — heavyweight, designed for large-org Microsoft-shaped APIs with `@public/@beta/@alpha` tagging. Overkill.
- `tsc --declaration` direct — fine for `@rozie/cli` (small, self-contained) but breaks down for `@rozie/core` due to internal-package re-exports.
### 5. JSON5 inside `<props>` and `<data>` — actually a custom JS-expression parser
- Returns a real Babel AST we can traverse
- Handles arrow functions, identifiers, unary/binary expressions, spreads, you name it
- Errors with proper code-frames pointing into the source
- Same library we're already using for `<script>`
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| `unplugin` | Native `vite-plugin` only + native `rollup-plugin` only | If we ever decide to drop Webpack/Rspack/esbuild support — single-target plugins are simpler. We do not anticipate this. |
| `@babel/parser` (script) | SWC's JS bindings | If parsing/transform throughput becomes the dominant compile cost (unlikely — IO and per-target emission dominate). |
| `htmlparser2` | `parse5` | If we ever need to round-trip valid HTML5 into-and-out-of an external tool that requires WHATWG-compliant trees. Not a Rozie use case. |
| Hand-rolled template parser | `@vue/compiler-sfc` | If we narrow scope to "Rozie is a Vue dialect." We are not — see PROJECT.md "deliberately uses `r-*` to be visually distinct from real Vue." |
| `peggy` for modifier grammar | Hand-rolled scanner | If the modifier grammar grows beyond ~200 LOC and starts to need backtracking we don't want to write. |
| Babel toolkit | Hand-rolled string templates per target | If the team is allergic to Babel and wants quick-and-dirty emission. Trades correctness for speed-of-prototype. Acceptable for a 1-week spike, dangerous for v1. |
| `tsdown` | `tsup` | If `tsdown` (0.x) hits stability issues. Migration is a one-line config change. |
| `tsdown` | `unbuild` | If the project gravitates to the UnJS ecosystem. unbuild's `stub` mode (no-build dev) is genuinely nice. Comparable performance. |
| `pnpm + Turborepo` | `pnpm` alone | If the project never grows past 3 packages. Caching pays off ~5+ packages. |
| `pnpm + Turborepo` | `Nx` | If we add a complete dev platform with code generators, dep graphs, distributed caching. Overkill for v1. |
| `Biome` | `ESLint + Prettier` | If we adopt an ESLint plugin that has no Biome equivalent (e.g., a hypothetical `eslint-plugin-rozie` for `.rozie` files — but at that point we'd be dogfooding our own tooling, not using ESLint). |
| `Vitest` | `Node:test` | If we want zero test-runner deps. Loss: snapshot ergonomics, watch mode, parallel workers, UI. Not worth it. |
| `dts-buddy` | `tsc --declaration` per package | For small leaf packages (cli, babel-plugin) that have flat exports. Use both: `tsc` for leaves, `dts-buddy` for `@rozie/core`. |
| `PostCSS` for `<style>` | `lightningcss` | If we hit a CSS perf bottleneck. Lightningcss is faster but has a smaller plugin ecosystem and a less-flexible custom-pass API. |
## What NOT to Use
| Avoid | Why | Use Instead |
|---|---|---|
| `@vue/compiler-sfc` as the SFC parser | Coupled to Vue's `SFCDescriptor`; treats our first-class blocks as opaque `customBlocks` text; semantics conflict with Rozie (e.g., Vue forbids `{{ }}` in attribute values) | Hand-rolled scanner over `htmlparser2` |
| `json5` package | Cannot parse the JS expressions actually used in `<props>`/`<data>` (arrow factories, type identifiers like `Number`) | `@babel/parser.parseExpression` |
| `recast` for `<script>` regen | Optimised for codemod-style "minimal edit" — we emit fresh per-target output, not edited input | `@babel/generator` |
| `ts-morph` | Project-level TS API wrapper; we operate on script fragments, not whole TS programs | `@babel/parser` + `@babel/traverse` |
| `parse5` | 2x slower than htmlparser2; full WHATWG-spec compliance hurts us when our syntax is non-spec (`r-for`, modifier args in attributes) | `htmlparser2` |
| SWC or OXC for the `<script>` AST | Native binaries, immature JS-side traversal/builder APIs, install-friction across platforms; performance gain doesn't matter for source-to-source emission | `@babel/*` |
| Ohm | 72 weekly downloads in 2025 — abandoned-grade adoption | `peggy` (231k weekly) for the modifier grammar |
| Chevrotain for the modifier grammar | Over-spec'd: explicit lexer + parser definition for a sub-100-line grammar | `peggy` |
| Native Vite plugin + native Rollup plugin + native Webpack loader (separate authoring) | 4-5x the maintenance surface for behaviorally identical code | `unplugin` |
| `tsc --declaration` for `@rozie/core` types | Breaks on `paths` aliases; doesn't tree-shake private types out of the public surface | `dts-buddy` (or `api-extractor` if dts-buddy hits issues) |
| `Lerna` for monorepo | Stagnant, replaced by pnpm workspaces + Turborepo for new projects | `pnpm` workspaces + Turborepo |
| `Jest` | Slower than Vitest in 2025; weaker ESM story; `toMatchFileSnapshot` ergonomics worse | `Vitest` |
| `@microsoft/api-extractor` for types | Designed for Microsoft-scale APIs with release-tag trimming; heavy ceremony for a 4-package OSS lib | `dts-buddy` |
| Hand-emit `.d.ts` strings in target output | Lossy — re-implementing TS type printing badly. We have the AST already; build typed nodes in. | Per-target `.d.ts` synthesis from compiler AST + tsdown for the toolchain types |
| `Bun` workspaces | Less mature than pnpm; ecosystem still weighted toward Node-first tooling; CI surface immature | `pnpm` workspaces |
## Stack Patterns by Variant
- Adopt a **template-engine + AST hybrid**: skeleton-as-template (e.g., a small string-builder for `import` headers and component scaffolding) + AST emission for component body.
- Because pure-AST emission of long `import` lists is verbose and hard to maintain.
- Use it for **block-splitting only**, then re-parse each block ourselves. Trade-off: dependency on Vue, gain ~200 LOC saved.
- Only worth it if the parser spike runs over budget.
- Ship a **native Vite plugin escape hatch** (`@rozie/vite-plugin-native`) that talks directly to `@rozie/core`, bypassing the unplugin adapter.
- Defer until evidence emerges.
- Skip Turborepo until the second package lands.
- Pure `pnpm` workspaces are fine for `core` + `tests`.
## Version Compatibility
| Package A | Compatible With | Notes |
|---|---|---|
| `unplugin@3.x` | Vite 5/6/7/8, Rollup 3/4, Webpack 5, esbuild 0.20+, Rolldown alpha+, Rspack 1.x | unplugin abstracts over the API differences. Test matrix should hit one version per build tool. |
| `@babel/parser@7.29` | `@babel/traverse@7.29`, `@babel/types@7.29`, `@babel/generator@7.29` | Always upgrade Babel packages in lockstep. They're released together. |
| `tsdown@0.21` | Rolldown alpha, Oxc 0.40+ | Pin minor version until tsdown hits 1.0. Watch CHANGELOG. |
| `Vue 3.4+` (target output) | Our compiler emits `<script setup>` + `defineProps<T>()` macros | Vue 3.5 (current 3.5.33) brings further improvements; we should test 3.4 floor. |
| `Svelte 5+` (target output) | Runes mode (`$state`, `$derived`, `$effect`) | Svelte 4 is NOT supported — runes are a v5+ feature. Confirmed in PROJECT.md constraints. |
| `Angular 17+` (target output) | Standalone components, signals (`signal()`, `computed()`, `effect()`) | Signals are stable in 17+. We compile to `signal()` not `BehaviorSubject`. Confirmed in PROJECT.md. |
| `React 18+` (target output) | `useState`, `useEffect`, `useSyncExternalStore`. React Compiler optional. | `useEvent`/`useEventCallback` not used (still unstable). React 19 adds `use()` — opt-in. |
| `htmlparser2@12` | Node 18+ | Pure JS, no native deps. |
| `Vitest@4` | Node 20+, Vite 5+ | Vitest 4 dropped Node 18. Project constraint is Node 20+, so we're fine. |
| `Biome@2.4` | Node 20+ | Same. |
## Where to Start
## Sources
### Verified — Context7 / Official Docs (HIGH confidence)
- [@vue/compiler-sfc on npm](https://www.npmjs.com/package/@vue/compiler-sfc) — verified API surface, custom-block handling, current 3.5.33
- [Vue compiler perf PR #9674](https://github.com/vuejs/core/pull/9674) — confirmed Vue's new SFC parser is forked from htmlparser2, confirmed `@babel/parser` is used for expression parsing
- [Unplugin official guide](https://unplugin.unjs.io/guide/) — verified `createUnplugin`, `transformInclude`, framework-specific hooks, `meta.framework` detection, v3 status
- [Unplugin GitHub](https://github.com/unjs/unplugin) — verified Vite/Rollup/Webpack/esbuild/Rolldown/Rspack support
- [Vite 8 plugin API](https://vite.dev/guide/api-plugin) — verified plugin authoring conventions, naming
- [Babel parser docs](https://babeljs.io/docs/babel-parser) — verified API stability, `parseExpression` for fragments, plugin support
- [@babel/generator docs](https://babeljs.io/docs/babel-generator) — verified output guarantees and source-map support
- [htmlparser2 GitHub](https://github.com/fb55/htmlparser2) — verified streaming Tokenizer API, custom-syntax tolerance, perf benchmarks
- [magic-string GitHub](https://github.com/Rich-Harris/magic-string) — verified source-map preservation
- [Vitest snapshot guide](https://vitest.dev/guide/snapshot) — verified `toMatchFileSnapshot` API for compiler fixtures
- [tsdown docs](https://tsdown.dev/guide/) — verified Rolldown backend, dual ESM/CJS + d.ts emission via Oxc isolated-decl
- [Biome migrate guide](https://biomejs.dev/guides/migrate-eslint-prettier/) — verified single-tool linter + formatter, monorepo support, v2 stability
### Verified — Cross-source agreement (MEDIUM-HIGH confidence)
- [pnpm Workspace docs](https://pnpm.io/workspaces) + [Turborepo docs](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) — pnpm + Turborepo recommended for small library monorepos
- [JSON5 npm](https://www.npmjs.com/package/json5) + [JSON5 spec](https://json5.org/) — verified that JSON5 cannot parse arrow-function values or arbitrary identifiers as values; supports the "use Babel parseExpression instead" decision
- [Mitosis architecture docs](https://github.com/BuilderIO/mitosis) — confirmed Mitosis's JSX-input + per-target plugin architecture; informs our distinct positioning
- [Oxc transformer alpha announcement (Sept 2024)](https://oxc.rs/blog/2024-09-29-transformer-alpha) — verified OXC transformer is alpha; reinforces "not yet for source-to-source emission"
- [npm-compare: Chevrotain vs Peggy vs Ohm](https://npm-compare.com/chevrotain,jison,nearley,peggy) — verified Ohm has 72 weekly downloads (de facto abandoned for new prod use)
### MEDIUM confidence
- [PkgPulse: tsup vs tsdown vs unbuild 2026](https://www.pkgpulse.com/guides/tsup-vs-tsdown-vs-unbuild-typescript-library-bundling-2026) — third-party comparison; cross-checked against tsdown.dev official docs
- [PkgPulse: Oxc vs SWC 2026](https://www.pkgpulse.com/guides/oxc-vs-swc-rust-javascript-toolchain-2026) — third-party benchmarks; informational, not load-bearing for our recommendation
- [Tan Li Hau: Babel transformations](https://lihautan.com/step-by-step-guide-for-writing-a-babel-transformation) — community guide; reinforces standard Babel patterns
### Versions verified via `npm view` (HIGH confidence — current as of 2026-04-30)
| Package | Current Version |
|---|---|
| `@vue/compiler-sfc` | 3.5.33 |
| `unplugin` | 3.0.0 |
| `magic-string` | 0.30.21 |
| `@babel/parser` / `traverse` / `generator` / `core` | 7.29.x |
| `vitest` | 4.1.5 |
| `tsdown` | 0.21.10 |
| `tsup` | 8.5.1 |
| `unbuild` | 3.6.1 |
| `htmlparser2` | 12.0.0 |
| `peggy` | 5.1.0 |
| `chevrotain` | 12.0.0 |
| `dts-buddy` | 0.7.0 |
| `@microsoft/api-extractor` | 7.58.7 |
| `@biomejs/biome` | 2.4.13 |
| `vite` | 8.0.10 |
| `pnpm` | 10.33.2 |
| `turbo` | 2.9.6 |
| `postcss` | 8.5.13 |
| `lightningcss` | 1.32.0 |
| `recast` | 0.23.11 |
| `prettier` | 3.8.3 |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
