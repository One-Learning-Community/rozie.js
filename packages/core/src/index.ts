// @rozie/core — public API
// @experimental — shape may change before v1.0 (per D-09)

// The public parse() entrypoint and result type — Plan 04 Task 4 / D-09 / D-10.
export { parse } from './parse.js';
export type { ParseResult } from './parse.js';

// AST contract types (Plan 01 + Plan 03 + Plan 04 — concrete shapes).
export type {
  SourceLoc,
  BlockMap,
  BlockEntry,
  RozieAST,
  PropsAST,
  DataAST,
  ScriptAST,
  ListenersAST,
  ListenerEntry,
  TemplateAST,
  TemplateNode,
  TemplateElement,
  TemplateAttr,
  TemplateText,
  TemplateInterpolation,
  StyleAST,
  StyleRule,
} from './ast/types.js';

// Diagnostics surface — locked Diagnostic shape, central code registry, renderer.
export type { Diagnostic, DiagnosticSeverity } from './diagnostics/Diagnostic.js';
export { RozieErrorCode } from './diagnostics/codes.js';
export { renderDiagnostic } from './diagnostics/frame.js';

// Modifier chain types (populated on listener entries + template event attrs).
export type {
  ModifierChain,
  ModifierArg,
} from './modifier-grammar/parseModifierChain.js';

// IR types — Phase 2 Plan 02-05 (D-18 SlotDecl, D-19 LifecycleHook, D-20 Listener LOCKED).
// @experimental — shape may change before v1.0
export type {
  IRComponent,
  PropDecl,
  PropTypeAnnotation,
  StateDecl,
  ComputedDecl,
  RefDecl,
  SlotDecl,
  ParamDecl,
  LifecycleHook,
  Listener,
  ListenerTarget,
  SetupBody,
  SetupAnnotation,
  TemplateNode as IRTemplateNode,
  TemplateElementIR,
  AttributeBinding,
  TemplateConditionalIR,
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateFragmentIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  StyleSection,
  IRNodeId,
} from './ir/types.js';

// Reactivity types — Phase 2 Plan 02-03.
// @experimental — shape may change before v1.0
export type { SignalRef } from './reactivity/signalRef.js';
export type { ReactiveDepGraph } from './reactivity/ReactiveDepGraph.js';

// Modifier registry public surface — Phase 2 Plan 02-04.
// SemVer-stable per D-22b — Phase 4 React emitter is the dogfooding consumer.
export { ModifierRegistry } from './modifiers/ModifierRegistry.js';
export type {
  ModifierImpl,
  ModifierPipelineEntry,
  ModifierContext,
} from './modifiers/ModifierRegistry.js';
export { registerModifier } from './modifiers/registerModifier.js';
export { registerBuiltins, createDefaultRegistry } from './modifiers/registerBuiltins.js';

// lowerToIR — Phase 2 Plan 02-05 coordinator.
// @experimental — shape may change before v1.0
export { lowerToIR } from './ir/lower.js';
export type { LowerOptions, LowerResult } from './ir/lower.js';
