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

## Standalone CLI

For one-shot codegen (CI, doc builds, ahead-of-time emit):

```bash
pnpm add -D @rozie/cli
pnpm rozie build src/Counter.rozie --target vue --out dist/Counter.vue
```

The CLI accepts `--target vue | react | svelte | angular | solid | lit` and supports `--source-map` for emitting sourcemaps alongside the output file.

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
