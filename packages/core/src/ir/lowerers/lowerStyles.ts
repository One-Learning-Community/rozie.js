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
 * Spike 004 — a third bucket, `portalRules`, holds `@portal NAME { ... }`
 * blocks (StyleRule with `kind: 'portal-block'`). The `portalName` + `children`
 * payload is preserved verbatim so target emitters can rewrite each inner
 * selector with the `[data-rozie-portal-<NAME>]` scope.
 *
 * Phase 34 — a fourth bucket, `engineRules`, holds the engine-DOM escape hatch
 * (`:root { .sel { ... } }`) — StyleRule with `kind: 'root-block'`. Its bare
 * (un-prefixed) `children` are routed unscoped/global by the Wave 2 emitters so
 * they reach runtime engine-rendered DOM across all six targets. The
 * `root-block` arm is checked BEFORE `isRootEscape` so a co-present flat
 * `:root { --custom-prop }` rule still lands in `rootRules` unchanged (D-03).
 *
 * @experimental — shape may change before v1.0
 */
import type { StyleAST } from '../../ast/blocks/StyleAST.js';
import type { StyleSection } from '../types.js';

export function lowerStyles(style: StyleAST): StyleSection {
  const scopedRules: unknown[] = [];
  const rootRules: unknown[] = [];
  const portalRules: unknown[] = [];
  const engineRules: unknown[] = [];
  for (const rule of style.rules) {
    if (rule.kind === 'portal-block') {
      portalRules.push(rule);
    } else if (rule.kind === 'root-block') {
      engineRules.push(rule);
    } else if (rule.isRootEscape) {
      rootRules.push(rule);
    } else {
      scopedRules.push(rule);
    }
  }
  return {
    type: 'StyleSection',
    scopedRules,
    rootRules,
    portalRules,
    engineRules,
    sourceLoc: style.loc,
  };
}
