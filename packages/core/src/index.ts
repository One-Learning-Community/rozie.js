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
