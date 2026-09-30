import type * as t from '@babel/types';
import type { SourceLoc } from '../types.js';

/** `<types>` block — always TypeScript, type-only statements (spec §3.1). @experimental */
export interface TypesAST {
  type: 'TypesAST';
  loc: SourceLoc;
  program: t.Program;
}
