/**
 * `<components>` block AST. Wraps the Babel `ObjectExpression` for the entire
 * block content. Phase 06.2 P1 — mirrors PropsAST shape (D-115).
 *
 * Authors declare composed children with `{ Modal: './Modal.rozie' }`. The
 * block is parsed via `@babel/parser.parseExpression` and must be an
 * ObjectExpression at top level. Per-property validation (PascalCase keys,
 * `.rozie` string-literal values) is layered on by `parseComponents` (ROZ921)
 * + `lowerComponents` downstream.
 *
 * @experimental — shape may change before v1.0
 */
import type { ObjectExpression } from '@babel/types';
import type { SourceLoc } from '../types.js';

export interface ComponentsAST {
  type: 'ComponentsAST';
  loc: SourceLoc;
  /** Babel ObjectExpression for the entire block content (must be ObjectExpression at top level). */
  expression: ObjectExpression;
}
