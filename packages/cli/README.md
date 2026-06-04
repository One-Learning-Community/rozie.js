# @rozie/cli

The Rozie codegen CLI. Compiles `.rozie` files to per-framework source artifacts (plus `.d.ts` sidecars and optional `.map` files) for libraries that prefer to ship pre-compiled per-framework npm packages rather than rely on a consumer-side build plugin.

## Status

Shipped. The `rozie` binary exposes `build` and `watch` commands across all six targets (`vue`, `react`, `svelte`, `angular`, `solid`, `lit`). Output is byte-identical to the `@rozie/unplugin` and `@rozie/babel-plugin` entrypoints (gated by the `dist-parity` suite). Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). Inside the monorepo it is available as the `rozie` bin.

## Usage

```bash
# Compile a directory to React + Vue, emitting to dist/
rozie build src/components/ \
  --target react,vue \
  --out dist/

# Single file, single target (stdout when --out is omitted and only one of each)
rozie build src/Counter.rozie --target svelte

# Watch mode (long-running; --out is required)
rozie watch src/components/ --target react --out dist/
```

### Flags (`build` and `watch`)

| Flag | Notes |
| --- | --- |
| `-t, --target <names>` | Comma-separated list of `vue\|react\|svelte\|angular\|solid\|lit` (default `vue`). |
| `-o, --out <path>` | Output directory. Required when compiling multiple files or multiple targets (`ROZ852`); required for `target=react` because it emits sidecars (`ROZ855`); always required for `watch` (`ROZ856`). |
| `--source-map` | Emit `.map` sidecars (off by default). |
| `--no-types` | Skip `.d.ts` emission (React-only — inline-typed for Vue/Svelte/Angular). |
| `--pretty` | Format emitted artefacts with Prettier before write (off by default). |
| `--no-cva` | Angular-only: suppress the auto `ControlValueAccessor` emit on single-`model` components. No-op for other targets. |
| `--no-safe-interpolation` | Suppress the safe-interpolation `rozieDisplay` wrap (raw per-target emit; re-exposes the React object-child crash on non-primitive interpolation). No-op for Vue. |

## Public exports

- `rozie` binary (`build`, `watch`)
- Programmatic entry from the package root for embedding the CLI in another tool.

For the build-plugin path (HMR, no pre-compile step), see [`@rozie/unplugin`](../unplugin). For Babel pipelines, see [`@rozie/babel-plugin`](../babel-plugin).

## Links

- Project orientation: [`CLAUDE.md`](../../CLAUDE.md)
- Feature reference: [`docs/guide/features.md`](../../docs/guide/features.md)
- Roadmap: [`.planning/ROADMAP.md`](../../.planning/ROADMAP.md)
