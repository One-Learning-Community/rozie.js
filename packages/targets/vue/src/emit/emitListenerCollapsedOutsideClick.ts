/**
 * emitListenerCollapsedOutsideClick — Phase 3 Plan 04 Task 2 Class B helper.
 *
 * Per CONTEXT D-42 + RESEARCH.md Pattern 5 (lines 505-520) + Code Example 2
 * (lines 950-955): when a `<listeners>`-block entry has a single
 * `.outside(...refs)` modifier, the emitter COLLAPSES the listener's `when:`
 * predicate into a `whenSignal` getter passed as the third arg of
 * `useOutsideClick(refs, callback, () => when)`. This eliminates the
 * watchEffect+document.addEventListener boilerplate Vue would otherwise need
 * for outside-click — and gives the helper a single re-entrant code path
 * with cleanup auto-registered via onMounted/onBeforeUnmount.
 *
 * The `.outside` args carry `refExpr` ModifierArg entries with `.ref` text
 * like `$refs.triggerEl`. We strip the `$refs.` prefix and append Vue's
 * `Ref` suffix (Pitfall 4 collision-avoidance) — `triggerElRef`. No-arg
 * `.outside()` defaults to `[$elRef]` (placeholder for $el handling — none of
 * the v1 reference examples exercise this; emitter still produces a stable
 * call shape).
 *
 * Per D-22 / D-08 collected-not-thrown — never throws; no diagnostics emitted
 * here (the modifier registry's resolve() already validated the args at
 * IR-lowering time per Phase 2).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, Listener } from '../../../../core/src/ir/types.js';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import { rewriteScriptExpression } from '../rewrite/rewriteListenerExpression.js';

/**
 * Map a `refExpr` ModifierArg to its Vue script-side identifier
 * (`$refs.triggerEl` in source → `triggerElRef` in emitted code).
 *
 * Note: the peggy modifier grammar strips the `$refs.` prefix already —
 * `arg.ref` is just the bare identifier (e.g. `triggerEl`). We append the
 * `Ref` suffix per Pitfall 4 collision-avoidance to match Plan 02's
 * emitTemplateRefs (which emits `const triggerElRef = ref<HTMLElement>()`).
 */
function refArgToIdentifier(arg: ModifierArg): string {
  if (arg.kind === 'refExpr') {
    if (!arg.ref) {
      // Should never happen — Phase 2 validates $refs.name format.
      // Emit a comment rather than a broken empty identifier or 'Ref' collision.
      return '/* malformed $refs arg */';
    }
    return arg.ref + 'Ref';
  }
  // Literal args here would be a Phase 2 validation bug — outside.ts already
  // emitted ROZ112 if a literal arg was passed. Render conservatively.
  if (arg.kind === 'literal') return JSON.stringify(arg.value);
  // Unknown arg kind — emit a comment to avoid a sparse-array hole that
  // would cause r.value to throw inside useOutsideClick.
  return '/* unknown arg kind */';
}

/**
 * Render the D-42 collapsed `useOutsideClick(...)` call for a single Listener.
 * Caller is responsible for calling `runtimeImports.use('useOutsideClick')`.
 *
 * Returns a single-line code string ending with `;`.
 */
export function emitOutsideClickCall(
  listener: Listener,
  outsideArgs: ModifierArg[],
  ir: IRComponent,
): string {
  // Build the refs array. No-arg .outside() defaults to [$elRef] — emit a
  // commented placeholder for v1 since no reference example exercises it.
  let refsArrayCode: string;
  if (outsideArgs.length === 0) {
    // MOD-04 default: $el. Emit a comment — Vue setup() doesn't directly
    // expose $el; users would need a template-root ref. v1 acceptable.
    refsArrayCode = '[/* $el — v1: declare a template-root ref to use no-arg .outside */]';
  } else {
    const idents = outsideArgs.map(refArgToIdentifier);
    refsArrayCode = `[${idents.join(', ')}]`;
  }

  // Wrap the handler. If the handler is an Identifier, render `() => name()`
  // for a stable closure that matches RESEARCH Code Example 2 exactly. For
  // arrow / fn / other Expression handlers, render the rewritten expression
  // verbatim — Vue accepts any callable.
  const handlerCode = rewriteScriptExpression(listener.handler, ir);

  // Build the whenSignal arg. listener.when is Expression | null.
  let whenArgCode: string;
  if (listener.when === null) {
    // Omit when arg entirely — useOutsideClick treats undefined as "always fire".
    return `useOutsideClick(\n  ${refsArrayCode},\n  () => ${handlerCode}(),\n);`;
  } else {
    const whenCode = rewriteScriptExpression(listener.when, ir);
    whenArgCode = `() => ${whenCode}`;
  }

  return `useOutsideClick(\n  ${refsArrayCode},\n  () => ${handlerCode}(),\n  ${whenArgCode},\n);`;
}
