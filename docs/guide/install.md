# Install

## Requirements

- Node 20 or newer
- TypeScript 5.6 or newer (if your project uses TypeScript)
- A package manager (pnpm, npm, or yarn — examples below use pnpm)

## Inside a Vite project (recommended)

Rozie ships as an `unplugin` so it works with Vite, Rollup, Webpack, esbuild, Rolldown, and Rspack from one package.

```bash
pnpm add -D @rozie/unplugin
```

Then in `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import Rozie from '@rozie/unplugin/vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    Rozie({ target: 'vue' }), // or 'react' | 'svelte' | 'angular' | 'solid' | 'lit'
    vue(),
  ],
});
```

Import `.rozie` files as normal components:

```ts
import Counter from './Counter.rozie';
```

### Per-target options: `angular: { cva }`

On the Angular target, components with exactly one `model: true` prop automatically implement `ControlValueAccessor` so they bind to `[(ngModel)]` / `formControlName` like native form controls (see [the forms-integration contract](/guide/features#angular-a-single-model-component-is-a-real-form-control)). This is **on by default**. To turn it off:

```ts
Rozie({ target: 'angular', angular: { cva: false } }),
```

A malformed `angular` option (non-object, or non-boolean `cva`) fails fast at plugin-construction time with **ROZ405** — before any build hook runs. The option is a no-op for the other five targets.

## Typed `.rozie` imports (per-framework setup)

Rozie gives your `.rozie` imports **real, per-module TypeScript types** — the props interface, event callbacks, and the `$expose` handle — so `import Counter from './Counter.rozie'` is as type-safe as importing a hand-written component. There is no `.rozie`-aware language plugin to install: the types come from a generated **sidecar declaration file**.

### How it works

When the unplugin builds your project, its `buildStart` hook writes a per-module `<Name>.d.rozie.ts` sidecar next to each `<Name>.rozie` source — for example `Counter.rozie` → `Counter.d.rozie.ts`. TypeScript resolves `import Counter from './Counter.rozie'` to that sidecar (the `.d.<ext>.ts` declaration-for-an-arbitrary-extension form), so your editor and `tsc` see the component's true props and handle types. **You never write or edit the sidecar** — it carries a `do-not-edit` header and is regenerated on every build.

Generation is automatic: any `vite build` / `vite dev` (or any other unplugin host — Rollup, Webpack, esbuild, Rolldown, Rspack) emits the sidecars. You do not run a separate codegen command.

### The one tsconfig flag: `allowArbitraryExtensions`

TypeScript only resolves a `.d.<ext>.ts` sidecar for a non-standard extension (like `.rozie`) when `allowArbitraryExtensions` is enabled. **Whether you need to set it explicitly depends on your target framework's typecheck tool:**

| Target | Typecheck tool | `allowArbitraryExtensions` |
| --- | --- | --- |
| Vue | `vue-tsc` | Not needed — honored under the `moduleResolution: bundler` default |
| React | `tsc` | **Required** — add `"allowArbitraryExtensions": true` |
| Svelte | `tsc` + `svelte-check` | **Required** |
| Solid | `tsc` | **Required** |
| Lit | `tsc` | **Required** |
| Angular | `tsc` | **N/A — Angular does not use sidecars** (see [The Angular exception](#the-angular-exception-no-sidecars) below) |

So for every target except Vue and Angular, add the flag to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowArbitraryExtensions": true
  }
}
```

Plain `tsc` (and `vue-tsc`) 5.x does **not** auto-enable `allowArbitraryExtensions` under `moduleResolution: bundler` — Vue is the only target whose toolchain honors the sidecar without the flag. Without the flag on the other sidecar targets, `tsc` reports `TS6263: … but '--allowArbitraryExtensions' is not set` (or silently falls back to a broad `*.rozie` wildcard that types every prop as `unknown` — see migration below).

### The Angular exception: no sidecars

Angular is the one target where Rozie **never** writes a `.d.rozie.ts` sidecar next to a `.rozie` source — and you must not add one by hand.

Angular's build runs a real TypeScript program *inside* the bundler: ngtsc (via `@analogjs/vite-plugin-angular`) resolves every `.rozie` import to validate it as a standalone-component `imports: [...]` entry. TypeScript's module resolution prefers an arbitrary-extension declaration file (`Counter.d.rozie.ts`) over the compiled implementation (`Counter.rozie.ts`) — regardless of `allowArbitraryExtensions`. A type-only `declare class` carries no `ɵcmp` metadata, so ngtsc silently **skips AOT compilation** for every class that imports a `.rozie` module, and the app throws `JIT compiler unavailable` at runtime.

Instead, the Angular target's typed import surface is the **disk-cache** `<Name>.rozie.ts` that the unplugin writes next to each `.rozie` source (the same file ngtsc AOT-compiles). It is a real, fully-typed standalone component class:

- `import Counter from './Counter.rozie'` resolves to the disk-cache class — props are typed signal inputs/models.
- `$expose` methods are **public class methods**, so an `@ViewChild(Counter) counter!: Counter` handle is fully typed with no named handle-type import needed.
- Keep a `declare module '*.rozie'` wildcard shim as a fresh-checkout fallback (the disk-cache is generated by the first build); once the disk-cache exists, file resolution wins over the wildcard.

The trade-off: Angular consumers have no named `<Name>Props` type export to import (the other five targets get one from the sidecar).

### Named handle imports

If a component declares `$expose({ ... })`, the sidecar also exports a typed handle interface you can import **by name** alongside the default component import:

```ts
import Dropdown, { type DropdownHandle } from './Dropdown.rozie';

const ref = useRef<DropdownHandle>(null);
// <Dropdown ref={ref} />  →  ref.current?.open()
```

The handle methods are typed from your `<script>` function signatures. See [`$expose` → Getting the handle from the consumer side](/guide/features#getting-the-handle-from-the-consumer-side) for the per-framework ref idiom.

### Migrating from the `declare module '*.rozie'` wildcard

Earlier setups used a broad ambient shim:

```ts
// rozie-shim.d.ts — the OLD wildcard fallback (now deprecated)
declare module '*.rozie' {
  const component: unknown;
  export default component;
}
```

A broad active wildcard **shadows** the per-module sidecars: every prop resolves to `unknown` and you lose all type safety (this is the exact silent type-lie the typed-import work removes). Migrate by **deleting** the wildcard for any project whose `.rozie` files are all sidecar-generated (i.e. live where the build emits sidecars), then add `allowArbitraryExtensions: true` if your target isn't Vue. The recommendation is **deprecate-don't-delete** only when you genuinely have `.rozie` imports that get no sidecar (e.g. files outside the build's emit roots) — keep a narrow, `@deprecated`-commented fallback for those; with the flag set, a present per-module sidecar always takes precedence over the wildcard.

### The sidecars are gitignored (REQ-7)

Generated `*.d.rozie.ts` sidecars are **build artefacts** — they are matched by the repo-wide `*.rozie.ts` gitignore rule and should **not** be committed. They are regenerated on every build, so a fresh checkout produces them as soon as you run `vite build` / `vite dev` (or `rozie build` / `rozie watch`). In CI, run your build step **before** your typecheck step so `tsc` never resolves a `.rozie` import before its sidecar exists.

If a `.rozie` file ever lacks a sidecar at typecheck time, run the build first — do **not** re-add a broad wildcard fallback, which reintroduces the shadowing.

### Sidecar generation stops at nested-package boundaries

The sidecar walk **does not descend into nested workspace packages**. When it encounters a directory containing its own `package.json`, it stops — it treats that directory as a separate package that owns its own build. A parent-root build will therefore **not** emit sidecars for `.rozie` files living inside a nested package under the build root.

This is intentional: the model is **one plugin instance per package**, so each package generates the sidecars for its own `.rozie` files during its own build. If your project nests packages, make sure each nested package runs the unplugin (or `rozie build`) so its `.rozie` files get sidecars — a single parent build will not cover them. In CI, pass `--require-complete` to the staleness gate (`node scripts/check-sidecar-staleness.mjs --require-complete`) after each package's build to turn a missing sidecar into a hard failure instead of a silent gap.

### CLI fallback (no bundler)

If you compile ahead-of-time with the standalone CLI instead of a bundler, `rozie build` and `rozie watch` emit the same `<Name>.d.rozie.ts` sidecars (the CLI and the unplugin share one renderer, so the bytes are identical):

```bash
pnpm rozie build src/Counter.rozie --target react   # writes Counter.d.rozie.ts alongside
pnpm rozie watch src/                                # refreshes sidecars on change
```

## Standalone CLI

For one-shot codegen (CI, doc builds, ahead-of-time emit):

```bash
pnpm add -D @rozie/cli
pnpm rozie build src/Counter.rozie --target vue --out dist/Counter.vue
```

The CLI accepts `--target vue | react | svelte | angular | solid | lit` and supports `--source-map` for emitting sourcemaps alongside the output file.

`--no-cva` (Angular target only) turns off the automatic `ControlValueAccessor` emit for single-`model: true` components — the same switch as the plugin's `angular: { cva: false }` option. Both `rozie build` and `rozie watch` accept it.

`--pretty` (off by default) pipes each emitted artefact through prettier before write. Prettier core covers `.tsx` / `.ts` / `.d.ts` / `.vue` / `.css` natively — you don't need any extra dependency. To pretty-format `.svelte` output, install `prettier-plugin-svelte` alongside `@rozie/cli`:

```bash
pnpm add -D prettier-plugin-svelte
```

It's declared as an optional peer of `@rozie/cli`, so React/Vue/Angular/Solid/Lit users don't pay for the install. Without the plugin, `rozie build --pretty --target svelte` falls back to the raw (correct) compile output and prints a `[warning] --pretty failed for ...svelte: prettier-plugin-svelte is not installed ...` line.

## Versions

| Target | Supported version |
| --- | --- |
| React | 18+ |
| Vue | 3.4+ |
| Svelte | 5+ (runes mode) |
| Angular | 19+ (signals era) |
| Solid | 1.8+ |
| Lit | 3.2+ |
| TypeScript (consumer) | 5.6+ |

The Solid target additionally requires [`vite-plugin-solid`](https://www.npmjs.com/package/vite-plugin-solid) `^2.0` installed in your project — Rozie's unplugin asserts the peer dep at runtime when `target: 'solid'` is selected.

The Lit target has **no host Vite plugin** — Lit components are plain ES modules that self-register via `customElements.define()`, so Rozie's unplugin handles the `.rozie` → custom-element transform directly and Vite's standard `.ts` pipeline takes it from there. Emitted components depend on [`lit`](https://www.npmjs.com/package/lit) `^3.2`, [`@lit-labs/preact-signals`](https://www.npmjs.com/package/@lit-labs/preact-signals), and `@rozie/runtime-lit`.

The Angular target additionally requires [`@analogjs/vite-plugin-angular`](https://www.npmjs.com/package/@analogjs/vite-plugin-angular) `^2.5` installed in your project — Rozie's unplugin asserts the peer dep at runtime when `target: 'angular'` is selected. Angular 19's own `peerDependencies.typescript` is `>=5.5.0 <5.9.0`, which sits comfortably within our TS 5.6+ floor.

### TypeScript floor

Rozie's emitted code (`.tsx`, `.svelte`, `.vue` with `<script lang="ts">`, Angular standalone components, Solid `.tsx`, Lit class fields) resolves cleanly under TypeScript 5.6+. The floor is set by the lowest TS version we actively type-check our emitted output against. Older versions may work for some targets but aren't tested — in particular, TS ≤5.4 ships its CJS-to-ESM namespace shape (`default`-wrapped only, no flat names) that breaks upstream tooling we depend on (notably `@analogjs/vite-plugin-angular`'s phantom `import * as ts from 'typescript'`). If you're stuck on an older TS for legacy reasons, file an issue; we'll consider a deliberate compatibility bump if a real need emerges.

### pnpm monorepo: workaround for `@analogjs/vite-plugin-angular` phantom deps

`@analogjs/vite-plugin-angular@2.5.x` does `import * as ts from 'typescript'`, `import * as compilerCli from '@angular/compiler-cli'`, and `import * as ngCompiler from '@angular/compiler'` — none declared as peer dependencies. In a single-app project this is harmless: there's only one version of each in your tree and pnpm's flat-hoist slot resolves correctly.

It bites in **pnpm monorepos that coexist multiple Angular majors** (e.g. an Angular 19 app and an Angular 21 app in the same workspace). The hoist slot picks one version of each phantom — usually the highest — and consumers on the other major see crashes like `Cannot read properties of undefined (reading 'kind')` (cross-version SyntaxKind) or `ts.createPrinter is not a function` (CJS namespace shape mismatch).

The fix is a `pnpm.packageExtensions` patch in your workspace root `package.json`:

```json
{
  "pnpm": {
    "packageExtensions": {
      "@analogjs/vite-plugin-angular": {
        "peerDependencies": {
          "typescript": ">=5.5",
          "@angular/compiler": "^17 || ^18 || ^19 || ^20 || ^21",
          "@angular/compiler-cli": "^17 || ^18 || ^19 || ^20 || ^21"
        }
      }
    }
  }
}
```

After re-running `pnpm install`, each consumer's analogjs gets its own slot-local `typescript`/`@angular/compiler`/`@angular/compiler-cli` resolved against that consumer's pin — bypassing the workspace-wide flat-hoist gamble. Real upstream fix is to add these as declared peer dependencies; until that lands, the workspace patch is the recommended workaround. npm and yarn classic users don't hit this because their resolution model doesn't have the shared-hoist failure mode.
