/**
 * `<data>` block AST. Wraps the Babel `ObjectExpression` for the entire
 * block content (same parser as `<props>`). Plan 03 lands this concrete
 * shape (replacing the Plan 01 placeholder marker).
 *
 * @experimental — shape may change before v1.0
 */
import type { ObjectExpression } from '@babel/types';
import type { SourceLoc } from '../types.js';

export interface DataAST {
  type: 'DataAST';
  loc: SourceLoc;
  /** Babel ObjectExpression for the entire block content. */
  expression: ObjectExpression;
}
