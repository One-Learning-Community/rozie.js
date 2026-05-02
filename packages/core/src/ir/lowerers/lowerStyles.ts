/**
 * lowerStyles — pass-through wrapper around StyleAST → StyleSection.
 *
 * Plan 02-05 Task 2.
 *
 * Phase 1 parseStyle produced StyleRule[] with `isRootEscape` flagging — this
 * lowerer simply partitions them into scopedRules vs rootRules for IR
 * consumers. The actual postcss Rule AST is held internally by parseStyle
 * (per StyleAST commentary) and not exposed in v1; we re-encode our scoped/
 * root partition over the StyleRule shape we DO have.
 *
 * @experimental — shape may change before v1.0
 */
import type { StyleAST } from '../../ast/blocks/StyleAST.js';
import type { StyleSection } from '../types.js';

export function lowerStyles(style: StyleAST): StyleSection {
  const scopedRules: unknown[] = [];
  const rootRules: unknown[] = [];
  for (const rule of style.rules) {
    (rule.isRootEscape ? rootRules : scopedRules).push(rule);
  }
  return {
    type: 'StyleSection',
    scopedRules,
    rootRules,
    sourceLoc: style.loc,
  };
}
