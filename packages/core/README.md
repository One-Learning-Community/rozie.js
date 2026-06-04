# @rozie/core

The framework-neutral core of Rozie.js: parses `.rozie` source files into a typed `RozieAST`, runs semantic analysis + reactivity dep-graph + modifier registry, and lowers everything to a framework-neutral `RozieIR` consumed by per-target emitters (`@rozie/target-vue`, `@rozie/target-react`, etc.).

## Status

Shipped. The full parse → semantic-analysis → reactivity → IR-lowering pipeline is complete and feeds all six target emitters (Vue, React, Svelte, Angular, Solid, Lit). The high-level one-shot `compile(source, { target })` API (used by `@rozie/unplugin`, `@rozie/cli`, and `@rozie/babel-plugin`) is also exported. Marked `@experimental` until v1.0.

## Install

Not yet published to npm (current version `0.1.0`; publishing is gated on the public release workflow). Inside the monorepo:

```jsonc
// package.json
{
  "dependencies": {
    "@rozie/core": "workspace:*"
  }
}
```

## Usage

```ts
import { readFileSync } from 'node:fs';
import {
  parse,
  lowerToIR,
  createDefaultRegistry,
  renderDiagnostic,
} from '@rozie/core';

const source = readFileSync('Counter.rozie', 'utf8');

// 1. Parse into a typed RozieAST
const { ast, diagnostics: parseDiags } = parse(source, { filename: 'Counter.rozie' });
if (!ast) {
  for (const d of parseDiags) console.error(renderDiagnostic(d, source));
  process.exit(1);
}

// 2. Lower to framework-neutral IR
const registry = createDefaultRegistry();
const { ir, diagnostics: irDiags, depGraph, bindings } = lowerToIR(ast, {
  modifierRegistry: registry,
});
```

## Public exports

- **Pipeline:** `parse`, `lowerToIR`, and the high-level `compile` (one-shot source → target output); types `CompileOptions`, `CompileResult`, `CompileTarget`
- **Modifier registry:** `ModifierRegistry`, `registerModifier`, `registerBuiltins`, `createDefaultRegistry`
- **Diagnostics:** `RozieErrorCode`, `renderDiagnostic`, types `Diagnostic`, `DiagnosticSeverity`
- **AST types:** `RozieAST`, `PropsAST`, `DataAST`, `ScriptAST`, `ListenersAST`, `ListenerEntry`, `TemplateAST`, `TemplateNode`, `TemplateElement`, `TemplateAttr`, `TemplateText`, `TemplateInterpolation`, `StyleAST`, `StyleRule`, `BlockMap`, `BlockEntry`, `SourceLoc`, `ParseResult`
- **IR types:** `IRComponent`, `PropDecl`, `PropTypeAnnotation`, `StateDecl`, `ComputedDecl`, `RefDecl`, `SlotDecl`, `ParamDecl`, `LifecycleHook`, `Listener`, `ListenerTarget`, `SetupBody`, `SetupAnnotation`, `IRTemplateNode`, `TemplateElementIR`, `AttributeBinding`, `TemplateConditionalIR`, `TemplateLoopIR`, `TemplateSlotInvocationIR`, `TemplateFragmentIR`, `TemplateInterpolationIR`, `TemplateStaticTextIR`, `StyleSection`, `IRNodeId`, `LowerOptions`, `LowerResult`
- **Modifier types:** `ModifierImpl`, `ModifierPipelineEntry`, `ModifierContext`, `ModifierChain`, `ModifierArg`
- **Reactivity types:** `SignalRef`, `ReactiveDepGraph`

## Links

- Project orientation: [`CLAUDE.md`](../../CLAUDE.md)
- Project value + audience: [`.planning/PROJECT.md`](../../.planning/PROJECT.md)
- Roadmap: [`.planning/ROADMAP.md`](../../.planning/ROADMAP.md)
