# @rozie/core

The framework-neutral core of Rozie.js: parses `.rozie` source files into a typed `RozieAST`, runs semantic analysis + reactivity dep-graph + modifier registry, and lowers everything to a framework-neutral `RozieIR` consumed by per-target emitters (`@rozie/target-vue`, `@rozie/target-react`, etc.).

## Status

Phase 2: shipped. The parse pipeline (Phase 1) and IR lowering pipeline (Phase 2) are complete. The shape is marked `@experimental` until v1.0 — public surface may evolve while target emitters mature in Phases 4-5.

## Install

Internal-only, not yet published (version `0.0.0`). Inside the monorepo:

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

- **Pipeline:** `parse`, `lowerToIR`
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
