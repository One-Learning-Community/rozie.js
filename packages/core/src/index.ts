// @rozie/core — public API
// @experimental — shape may change before v1.0 (per D-09)

// The public parse() entrypoint and result type — Plan 04 Task 4 / D-09 / D-10.
export { parse } from './parse.js';
export type { ParseResult } from './parse.js';

// Phase 6 — public compile() entrypoint (DIST-01 / D-80).
// Single source of truth for `.rozie` → per-target compilation. Consumed by
// @rozie/unplugin, @rozie/babel-plugin, and @rozie/cli. Per D-81: never throws.
export { compile } from './compile.js';
export type { CompileOptions, CompileResult, CompileTarget } from './compile.js';

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
  // Phase 07.2 Plan 01 — consumer-side slot-fill IR shape (R2 acceptance).
  // Re-exported via the @rozie/core barrel per Phase 07.1 / MODX-01 self-reference
  // pattern so target packages import via the package specifier, NOT a relative
  // ../../core/src/ir/types.js path. Failing this re-creates the .d.ts divergence
  // bug 07.1 fixed.
  SlotFillerDecl,
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
  VueEmissionDescriptor,
  ReactEmissionDescriptor,
  // Phase 07.1 — Solid/Lit descriptors added; Svelte/Angular backfilled.
  // Open Question 1: the barrel was inconsistent — Phase 5 added the
  // Svelte/Angular descriptor types to ModifierRegistry.ts but never
  // re-exported them, so a third-party author could not
  // `import { SvelteEmissionDescriptor } from '@rozie/core'`. Backfilled here
  // alongside the new Solid/Lit types so the 6-target surface is consistent.
  SvelteEmissionDescriptor,
  AngularEmissionDescriptor,
  SolidEmissionDescriptor,
  LitEmissionDescriptor,
} from './modifiers/ModifierRegistry.js';
export { registerModifier } from './modifiers/registerModifier.js';
export { registerBuiltins, createDefaultRegistry } from './modifiers/registerBuiltins.js';

// lowerToIR — Phase 2 Plan 02-05 coordinator.
// @experimental — shape may change before v1.0
export { lowerToIR } from './ir/lower.js';
export type { LowerOptions, LowerResult } from './ir/lower.js';
