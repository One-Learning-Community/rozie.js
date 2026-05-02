# @rozie/target-vue

Vue 3.4+ SFC emitter for Rozie.js. Takes a framework-neutral `RozieIR` from `@rozie/core` and produces a `<script setup>` SFC string (plus source map) using `defineProps`/`defineEmits`/`defineSlots`/`defineModel`, `ref`/`computed`/`watchEffect`, scoped `<style>` with a `:root { ... }` global escape hatch, and `<listeners>` lowered to `watchEffect` with cleanup.

## Status

Phase 3: shipped (2026-05-02). All five reference examples — Counter, SearchInput, Dropdown, TodoList, Modal — compile correctly to Vue and pass the Phase 3 Playwright e2e suite. Marked `@experimental` until v1.0.

## Install

Internal-only, not yet published (version `0.0.0`). Most consumers should not depend on this package directly — install [`@rozie/unplugin`](../../unplugin) instead, which wires the Vite/Rollup/Webpack/etc. transform that calls `emitVue` for you.

```jsonc
// package.json (only if you are calling emitVue directly)
{
  "dependencies": {
    "@rozie/target-vue": "workspace:*"
  }
}
```

## Usage

Most consumers do **not** call this package directly — `@rozie/unplugin` handles the parse → lower → emit chain transparently when you `import Foo from './Foo.rozie'`. Use `emitVue` directly only if you are building a custom build pipeline or a CLI codegen tool.

```ts
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitVue } from '@rozie/target-vue';

const { ast } = parse(source, { filename: 'Counter.rozie' });
const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });

const { code, map, diagnostics } = emitVue(ir!, {
  filename: 'Counter.rozie',
  source,
});
// `code` is a Vue SFC string ready to feed into @vitejs/plugin-vue.
// `map` is a magic-string SourceMap referencing the original .rozie file.
```

## Reference examples (Phase 3 success criteria)

All five compile to idiomatic Vue and ship with snapshot + Playwright coverage:

- **Counter** — `defineProps` / `defineModel` / `computed`
- **SearchInput** — `r-model`, `@input.debounce(300)`
- **Dropdown** — `<listeners>` block + `.outside($refs.triggerEl, $refs.panelEl)` + scoped slots with params
- **TodoList** — `r-for` with `:key`, `$emit`, scoped slots
- **Modal** — multiple `$onMount` lifecycle hooks with paired cleanup, `$slots.x` presence check

## Public exports

- `emitVue(ir, opts?) => { code, map, diagnostics }`
- Types: `EmitVueOptions`, `EmitVueResult`

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Project value + audience: [`.planning/PROJECT.md`](../../../.planning/PROJECT.md)
- Roadmap (Phase 3 details): [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
