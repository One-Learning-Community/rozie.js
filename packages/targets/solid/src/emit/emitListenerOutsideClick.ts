/**
 * emitListenerOutsideClick — Solid target (P2 complete implementation).
 *
 * Collapses a `<listeners>`-block entry whose modifier pipeline contains a
 * `wrap` entry for `.outside(...refs)` into a `createOutsideClick(...)` call.
 *
 * KEY SOLID DIFFERENCES from React emitListenerOutsideClick:
 *   - Refs are passed as ACCESSOR FUNCTIONS: `() => fooRef` (not the ref object itself,
 *     since Solid doesn't use useRef objects — we have plain `let fooRef` variables).
 *   - createOutsideClick is from @rozie/runtime-solid — signature:
 *     `createOutsideClick(refAccessors: Array<() => Element | null>, handler, when?)`
 *   - NOT wrapped in createEffect — createOutsideClick manages its own lifecycle.
 *   - `when` is passed as `() => <expr>` (accessor function) for Solid reactive evaluation.
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
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';

export interface EmitListenerOutsideClickResult {
  code: string;
  diagnostics: Diagnostic[];
}

/**
 * Convert a refExpr ModifierArg to its Solid-side accessor function `() => refRef`.
 * The Solid ref variable is named `${refName}Ref` (plain `let` variable, not useRef object).
 */
function refArgToAccessor(
  arg: ModifierArg,
  ir: IRComponent,
  diagnostics: Diagnostic[],
): string | null {
  if (arg.kind !== 'refExpr') {
    diagnostics.push({
      code: RozieErrorCode.TARGET_SOLID_RESERVED,
      severity: 'error',
      message: `'.outside' expected a $refs.X arg, got ${arg.kind}`,
      loc: arg.loc,
    });
    return null;
  }
  const refName = arg.ref;
  if (!ir.refs.some((r) => r.name === refName)) {
    diagnostics.push({
      code: RozieErrorCode.TARGET_SOLID_RESERVED,
      severity: 'error',
      message: `'.outside($refs.${refName})' references unknown ref — declare via ref="${refName}" in <template>`,
      loc: arg.loc,
    });
    return null;
  }
  // Solid ref accessor: () => fooRef (plain let variable)
  return `() => ${refName}Ref`;
}

/**
 * Emit a Class B listener (`.outside(...refs)`) as a createOutsideClick call.
 */
export function emitListenerOutsideClick(
  listener: Listener,
  outsideArgs: ModifierArg[],
  ir: IRComponent,
  collectors: { solid?: SolidImportCollector; runtime: RuntimeSolidImportCollector },
): EmitListenerOutsideClickResult {
  const diagnostics: Diagnostic[] = [];
  collectors.runtime.add('createOutsideClick');

  const refAccessors = outsideArgs
    .map((arg) => refArgToAccessor(arg, ir, diagnostics))
    .filter((x): x is string => x !== null);

  if (refAccessors.length === 0) {
    diagnostics.push({
      code: RozieErrorCode.TARGET_SOLID_RESERVED,
      severity: 'error',
      message: `'.outside()' (no-arg form) requires at least one ref: '.outside($refs.X)'.`,
      loc: listener.sourceLoc,
    });
    return { code: '', diagnostics };
  }

  const refsArrayLiteral = `[${refAccessors.join(', ')}]`;

  // Render handler. For Identifier handlers pass by identity; for complex
  // expressions wrap in arrow (Solid createOutsideClick expects (e: MouseEvent) => void).
  const handlerCode = rewriteTemplateExpression(listener.handler, ir);
  const handlerExpr = /^[A-Za-z_$][\w$]*$/.test(handlerCode)
    ? handlerCode
    : `(e) => { ${handlerCode}; }`;

  // Render `when` as `() => when` arrow — createOutsideClick re-evaluates reactively.
  const whenCode = listener.when
    ? `() => ${rewriteTemplateExpression(listener.when, ir)}`
    : 'undefined';

  const code = listener.when
    ? `createOutsideClick(\n  ${refsArrayLiteral},\n  ${handlerExpr},\n  ${whenCode},\n);`
    : `createOutsideClick(${refsArrayLiteral}, ${handlerExpr});`;

  return { code, diagnostics };
}
