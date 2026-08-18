/**
 * buildSlotsMerge — Phase 80 Plan 14 (D-10).
 *
 * The single shared slot-presence resolution-chain builder for the Angular
 * target's three lowering contexts: inline template expression
 * (rewriteTemplateExpression.ts), class-body script (rewriteScript.ts), and
 * listener body (rewriteListenerExpression.ts). Before this plan there were
 * THREE near-verbatim copies of this builder — `buildSlotsMerge` in
 * rewriteTemplateExpression.ts, `buildScriptSlotsMerge` in rewriteScript.ts,
 * `buildListenerSlotsMerge` in rewriteListenerExpression.ts — all carrying
 * the identical Phase 07.3.2 Plan 10 doc comment and all missing the
 * content-collected fill-map tier D-09/D-10 require. Widening one of the
 * three without extracting a shared module would have left the codebase at
 * inconsistent gate widths — the exact structural mistake that produced
 * D-09, then D-10. THIS FILE IS NOW THE ONLY PLACE the presence-chain tier
 * ORDER is expressed for the rewrite contexts; a fourth copy must never
 * appear.
 *
 * Tier order — MUST match `emitSlotInvocation.ts`'s outlet-resolution chain
 * operand for operand (`(tplField ?? __rozieFillMap()[key] ?? templates()?.[key])`,
 * emitSlotInvocation.ts:436-438):
 *   1. static content-child           (`tplName`  — leftmost, first precedence, prohibition 4a)
 *   2. content-collected fill map     (`__rozieFillMap()[dynKey]` — new, D-10)
 *   3. `templates` input              (`templates()?.[dynKey]` — the documented escape hatch)
 *
 * The fill-map term is a NON-OPTIONAL computed member access — deliberately,
 * because `__rozieFillMap()` is a `computed()` that ALWAYS returns an object
 * (an empty one when nothing was collected), whereas `templates()` is an
 * optional `input()` that may be `undefined`. Matching this exact shape is
 * load-bearing: `tests/angular-runtime/prohibitions.test.ts`'s inverse-
 * transform gate (amended prohibition 4b) and `emitSlotInvocation.ts:438`
 * both key off this precise non-optional-access, single-quoted-key text.
 *
 * `hasFillMap` is a REAL parameter (not baked in) so this function is honest
 * and unit-testable in both states — but every production call site gates
 * on `hasKeyedFillIntake` (refineSlotTypes.ts, the SAME predicate the
 * outlet chain and the intake emission both gate on) BEFORE calling, and
 * passes `true` unconditionally: every `$slots.X` presence read this
 * function is invoked for belongs to a producer that owns the slot named
 * `X` (its own declared slot set), so the predicate is provably `true` at
 * every reachable production call site — mirrors `emitSlotInvocation.ts`'s
 * own unreachable-invariant check. No production call site passes `false`.
 *
 * Safety: the added tier is inert unless a `[rozieSlot]` marker directive is
 * actually projected into the producer — `__rozieFillMap()` folds to `{}`
 * otherwise (the fold is untouched from Plan 04), so a slot-declaring
 * producer nobody ever dynamically fills gains only a dead-but-harmless
 * read, never a rendered-output change.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';

/** Force single-quote serialization on a computed-key StringLiteral — matches
 * emitSlotInvocation.ts's template-string convention so dist-parity diffs
 * stay confined to the planned insertion. */
function singleQuotedKey(dynKey: string): t.StringLiteral {
  const lit = t.stringLiteral(dynKey);
  (lit as t.StringLiteral & { extra?: { raw?: string; rawValue?: string } }).extra = {
    raw: `'${dynKey}'`,
    rawValue: dynKey,
  };
  return lit;
}

/**
 * Build the slot-presence resolution-chain expression for `$slots.<name>`
 * (or its class-scoped equivalent), for a slot whose static content-child
 * field is `tplName` and whose computed/synthetic key is `dynKey`.
 *
 * `mkRef` is the reference-factory the caller already threads for its own
 * scope: bare `t.identifier(name)` for the template-binding context, or
 * `this.<name>` (`t.memberExpression(t.thisExpression(), ...)`) for the
 * class-body script and listener contexts. The SAME function serves both
 * shapes because every operand — including the new fill-map call — is
 * built through `mkRef`, so a class-scope caller's qualification is applied
 * uniformly rather than hand-wired per operand.
 *
 * `hasFillMap` — see the module doc comment above. Production callers must
 * gate on `hasKeyedFillIntake` before calling and always pass `true`; this
 * parameter exists so the function's two-tier legacy shape stays directly
 * unit-testable without a second exported entry point.
 */
export function buildSlotsMerge(
  mkRef: (name: string) => t.Expression,
  tplName: string,
  dynKey: string,
  hasFillMap: boolean,
): t.Expression {
  const templatesTerm = t.optionalMemberExpression(
    t.callExpression(mkRef('templates'), []),
    singleQuotedKey(dynKey),
    true,
    true,
  );

  if (!hasFillMap) {
    return t.parenthesizedExpression(
      t.logicalExpression('??', mkRef(tplName), templatesTerm),
    );
  }

  const fillMapTerm = t.memberExpression(
    t.callExpression(mkRef('__rozieFillMap'), []),
    singleQuotedKey(dynKey),
    true,
  );

  const merge = t.logicalExpression(
    '??',
    mkRef(tplName),
    t.logicalExpression('??', fillMapTerm, templatesTerm),
  );
  return t.parenthesizedExpression(merge);
}
