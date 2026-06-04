# @rozie/target-angular

Angular 19+ emitter for Rozie.js. Turns a framework-neutral `RozieIR` from `@rozie/core` into a standalone Angular component using signals (`signal()`, `computed()`, `effect()`), `model()` inputs, `@for`/`@if` control flow, `<ng-template>` + `*ngTemplateOutlet` for slots (with `ngTemplateContextGuard`), and `DestroyRef`-paired cleanup for `<listeners>`. A single-`model` component additionally auto-implements `ControlValueAccessor`, so it binds with `[(ngModel)]` / `formControlName` like a native form control.

## Status

Shipped. `$onMount` lowers to `ngAfterViewInit()`; the auto-`ControlValueAccessor` emit (Phase 23) is default-on and opt-out via `angular.cva: false` / `--no-cva`. Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). Most consumers should depend on [`@rozie/unplugin`](../../unplugin) (or [`@rozie/cli`](../../cli)) instead of calling this package directly. The Vite host integrates via `@analogjs/vite-plugin-angular`.

## Usage

`@rozie/unplugin` handles the parse → lower → emit chain transparently when you `import Foo from './Foo.rozie'`. Call `emitAngular` directly only if you are building a custom pipeline:

```ts
import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';
import { emitAngular } from '@rozie/target-angular';

const { ast } = parse(source, { filename: 'Counter.rozie' });
const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });

const { code, map, diagnostics } = emitAngular(ir!, { filename: 'Counter.rozie', source });
```

## Public exports

- `emitAngular(ir, opts?) => { code, map, diagnostics }`
- `emitAngularTypes(...)` — declaration synthesis for the emitted component
- Types: `EmitAngularOptions`, `EmitAngularResult`, `EmitAngularTypesOptions`

## Links

- Project orientation: [`CLAUDE.md`](../../../CLAUDE.md)
- Angular-shops guide: [`docs/guide/for-angular-shops.md`](../../../docs/guide/for-angular-shops.md)
- Roadmap: [`.planning/ROADMAP.md`](../../../.planning/ROADMAP.md)
