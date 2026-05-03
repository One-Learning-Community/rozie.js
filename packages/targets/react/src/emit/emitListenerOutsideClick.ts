/**
 * emitListenerOutsideClick — Plan 04-04 Task 2 / Class B emitter.
 *
 * Collapses a `<listeners>`-block entry whose modifier pipeline contains a
 * `wrap` entry for `.outside(...refs)` into a single `useOutsideClick(...)`
 * call. No `useEffect` wrapper at the emission site — the runtime helper
 * manages its own lifecycle internally (mount/unmount document listener).
 *
 * Mirrors Phase 3's `emitListenerCollapsedOutsideClick` (Vue D-42) with
 * React substitution.
 *
 * Refs are passed by IDENTITY (e.g. `triggerEl`), NOT `triggerEl.current` —
 * `useOutsideClick` accepts `RefObject[]` and reads `.current` internally.
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  Listener,
} from '../../../../core/src/ir/types.js';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { RuntimeReactImportCollector } from '../rewrite/collectReactImports.js';

export interface EmitListenerOutsideClickResult {
  code: string;
  diagnostics: Diagnostic[];
}

/**
 * Convert a refExpr ModifierArg (`{kind:'refExpr', ref:'triggerEl'}`) to its
 * React-side identifier (`triggerEl`). Per IR-04 the modifier-grammar parser
 * already strips the `$refs.` prefix; we just validate against the IR's
 * declared refs and emit a diagnostic if the user passed a non-ref.
 */
function refArgToIdentifier(
  arg: ModifierArg,
  ir: IRComponent,
  diagnostics: Diagnostic[],
): string | null {
  if (arg.kind !== 'refExpr') {
    diagnostics.push({
      code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
      severity: 'error',
      message: `'.outside' expected a $refs.X arg, got ${arg.kind}`,
      loc: arg.loc,
    });
    return null;
  }
  const refName = arg.ref;
  if (!ir.refs.some((r) => r.name === refName)) {
    diagnostics.push({
      code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
      severity: 'error',
      message: `'.outside($refs.${refName})' references unknown ref — declare via ref="${refName}" in <template>`,
      loc: arg.loc,
    });
    return null;
  }
  return refName;
}

/**
 * Emit a Class B listener (`<listeners>` entry with `.outside(...refs)`) as
 * a single `useOutsideClick(...)` call. Caller is responsible for funneling
 * the runtime import via the collector.
 */
export function emitListenerOutsideClick(
  listener: Listener,
  outsideArgs: ModifierArg[],
  ir: IRComponent,
  collectors: { runtime: RuntimeReactImportCollector },
): EmitListenerOutsideClickResult {
  const diagnostics: Diagnostic[] = [];
  collectors.runtime.add('useOutsideClick');

  // Resolve refs[].
  const refIdents = outsideArgs
    .map((arg) => refArgToIdentifier(arg, ir, diagnostics))
    .filter((x): x is string => x !== null);
  // If MOD-04 zero-arg form (`.outside()`) — no v1 fixture exercises this
  // shape, but the builtin grammar permits it. Emit ROZ520 for now (defer
  // $el-default handling to a follow-up plan).
  if (refIdents.length === 0) {
    diagnostics.push({
      code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
      severity: 'error',
      message: `'.outside()' (no-arg form) requires the $el default — not yet supported in React target. Pass at least one ref: '.outside($refs.X)'.`,
      loc: listener.sourceLoc,
    });
    return { code: '', diagnostics };
  }

  const refsArrayLiteral = `[${refIdents.join(', ')}]`;

  // Render handler. For Identifier handlers we pass by identity; for arrow /
  // call expressions we wrap them in `(e) => { ... }` (Pitfall 5: useOutsideClick
  // signature expects `(e: MouseEvent) => void`).
  const handlerCode = rewriteTemplateExpression(listener.handler, ir);
  const handlerExpr = /^[A-Za-z_$][\w$]*$/.test(handlerCode)
    ? handlerCode
    : `(e) => { ${handlerCode}; }`;

  // Render `when` predicate as `() => when` arrow (or undefined).
  // Per RESEARCH Pattern 10 Class B + D-42 Vue analog, the helper re-evaluates
  // the predicate on every event so the closure always sees the latest props.
  const whenCode = listener.when
    ? `() => ${rewriteTemplateExpression(listener.when, ir)}`
    : 'undefined';

  // Multi-line layout with trailing comma — matches the canonical
  // RESEARCH Code Example 2 lines 1080-1095.
  const code = listener.when
    ? `useOutsideClick(\n  ${refsArrayLiteral},\n  ${handlerExpr},\n  ${whenCode},\n);`
    : `useOutsideClick(${refsArrayLiteral}, ${handlerExpr});`;

  return { code, diagnostics };
}
