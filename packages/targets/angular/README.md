# @rozie/target-angular

Angular 17+ emitter for Rozie.js. Will turn a framework-neutral `RozieIR` from `@rozie/core` into a standalone Angular component using signals (`signal()`, `computed()`, `effect()`), `<ng-template>` + `*ngTemplateOutlet` for slots (with `ngTemplateContextGuard`), and `Renderer2.listen` + `DestroyRef` for `<listeners>` cleanup.

## Status

Phase 1: placeholder, no implementation yet. The package is scaffolded so the workspace topology is stable; the real emitter lands in **Phase 5** of the roadmap (in parallel with `@rozie/target-svelte`). Phase 5 begins with a 1-2 day spike on Angular's Vite virtual-filesystem integration (open question OQ3) before any Angular emitter code is written.

The current `src/index.ts` exports only a placeholder symbol (`__rozieTargetAngularPlaceholder`).

## Install

Internal-only, not yet published (version `0.0.0`). There is nothing useful to install yet.

## Usage

Not yet implemented. Once Phase 5 ships, the public surface will mirror `@rozie/target-vue`:

```ts
// Anticipated Phase 5 shape — not yet available.
import { emitAngular } from '@rozie/target-angular';
const { code, map, diagnostics } = emitAngular(ir, { filename, source });
```

Consumers will typically use `@rozie/unplugin` rather than calling this package directly.

## Public exports

- `__rozieTargetAngularPlaceholder` (placeholder constant; will be replaced in Phase 5)

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Project value + audience: [`.planning/PROJECT.md`](../../../.planning/PROJECT.md)
- Roadmap (Phase 5 plan for this package): [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
