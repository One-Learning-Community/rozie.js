/**
 * `<props>` block AST. Wraps the Babel `ObjectExpression` for the entire
 * block content. Plan 03 lands this concrete shape (replacing the Plan 01
 * placeholder marker).
 *
 * @experimental — shape may change before v1.0
 */
import type { ObjectExpression } from '@babel/types';
import type { SourceLoc } from '../types.js';

export interface PropsAST {
  type: 'PropsAST';
  loc: SourceLoc;
  /** Babel ObjectExpression for the entire block content (must be ObjectExpression at top level). */
  expression: ObjectExpression;
}
