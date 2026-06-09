/**
 * Phase 36 ($provide / $inject) — thin context lowerer.
 *
 * Detection of the `$provide('key', value)` statements and the
 * `const x = $inject('key', fallback?)` binders happens in the COLLECTOR
 * (`semantic/collectors/collectScriptDecls.ts`), mirroring the `$expose`
 * precedent (there is NO `lowerExpose.ts` — detection lives in the collector,
 * RESEARCH Open-Q1 / PATTERNS "No Analog Found"). This module is deliberately
 * THIN: it READS the already-collected `bindings.provides` / `bindings.injects`
 * entries and produces the IR `ProvideDecl[]` / `InjectDecl[]` nodes. It MUST
 * NOT re-walk the AST.
 *
 * Source order is preserved (the collector pushed in source order). Multiple
 * distinct `$provide` keys are all carried (unlike single-`$expose`). The
 * `[]`-when-empty discipline (D-5) is inherited from the collector arrays —
 * when no `$provide`/`$inject` call exists the bindings arrays are `[]`, so
 * both IR fields lower to `[]` and every emitter's empty-gate stays byte-
 * identical.
 *
 * @experimental — shape may change before v1.0
 */
import type { BindingsTable } from '../../semantic/types.js';
import type { ProvideDecl, InjectDecl } from '../types.js';

export interface LowerContextResult {
  provides: ProvideDecl[];
  injects: InjectDecl[];
}

/**
 * Lower the collected `$provide` / `$inject` bindings into IR nodes. Reads
 * `bindings.provides` / `bindings.injects` (populated by `collectScriptDecls`)
 * — never re-walks the AST. Never throws (D-08).
 */
export function lowerContext(bindings: BindingsTable): LowerContextResult {
  const provides: ProvideDecl[] = bindings.provides.map((p) => ({
    type: 'ProvideDecl',
    key: p.key,
    valueExpr: p.valueExpr,
    sourceLoc: p.sourceLoc,
  }));

  const injects: InjectDecl[] = bindings.injects.map((i) => {
    const node: InjectDecl = {
      type: 'InjectDecl',
      key: i.key,
      localBinding: i.localBinding,
      sourceLoc: i.sourceLoc,
    };
    if (i.fallbackExpr !== undefined) {
      node.fallbackExpr = i.fallbackExpr;
    }
    return node;
  });

  return { provides, injects };
}
