# @rozie/babel-plugin

A Babel 7+ plugin that detects `.rozie` imports and compiles them to a sibling per-target module by calling into `@rozie/core`'s `compile()`. Provides functional parity with `@rozie/unplugin` for non-Vite Babel pipelines (Babel-driven library builds, Metro / React Native, custom toolchains).

## Status

Shipped. The plugin visits each `import Foo from './Foo.rozie'`, resolves the absolute path from the importer, and writes a sibling `Foo.{ext}` (`.vue` / `.tsx` / `.svelte` / `.ts`, plus React `.d.ts` sidecars) before letting the rest of the Babel pipeline resolve the import. It is intentionally thin — the heavy lifting lives in `@rozie/core.compile()` — and its output is byte-identical to the `@rozie/unplugin` and `@rozie/cli` entrypoints (gated by the `dist-parity` suite). Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow).

## Usage

```jsonc
// babel.config.json
{
  "plugins": [
    ["@rozie/babel-plugin", { "target": "react" }]
  ]
}
```

Place it before `@babel/preset-typescript` / `@babel/preset-react` so the sibling file exists by the time they resolve `./Foo.rozie`.

## Options — `RozieBabelPluginOptions`

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `target` | `'vue' \| 'react' \| 'svelte' \| 'angular' \| 'solid' \| 'lit'` | — | **Required.** Selects the emit branch and the sibling-file extension. |
| `angular` | `{ cva?: boolean }` | `{ cva: true }` | Angular-only. `cva: false` suppresses the auto `ControlValueAccessor` emit. No-op for other targets. |

## Public exports

- `default` — the Babel plugin (a `declare(...)` factory)
- Type: `RozieBabelPluginOptions`

For the Vite/Rollup/Webpack path, see [`@rozie/unplugin`](../unplugin). For ahead-of-time codegen, see [`@rozie/cli`](../cli).

## Links

- Project orientation: [`CLAUDE.md`](../../CLAUDE.md)
- Feature reference: [`docs/guide/features.md`](../../docs/guide/features.md)
- Roadmap: [`.planning/ROADMAP.md`](../../.planning/ROADMAP.md)
