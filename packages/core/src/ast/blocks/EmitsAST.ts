import type * as t from '@babel/types';
import type { SourceLoc } from '../types.js';

/** `<emits>` block — `{ name: { payload?: '<TS type>', docs?: {...} } }` (spec §3.2). @experimental */
export interface EmitsAST {
  type: 'EmitsAST';
  loc: SourceLoc;
  expression: t.ObjectExpression;
}
