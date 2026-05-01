// @rozie/core — public API
// @experimental — shape may change before v1.0 (per D-09)
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
export type { Diagnostic, DiagnosticSeverity } from './diagnostics/Diagnostic.js';
// parse() lands in Plan 04.
