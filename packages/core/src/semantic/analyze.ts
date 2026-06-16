/**
 * Phase 2 semantic-analysis coordinator (Plan 02-02 Task 1).
 *
 * `analyzeAST(ast)` runs the collectors substage (Plan 02-01) followed by
 * the three validator passes (Plan 02-02). It is the single semantic-
 * analysis entrypoint Plan 02-05 lowerToIR will wrap.
 *
 * Pipeline:
 *   1. collectAllDeclarations — populate the BindingsTable from
 *      <props>, <data>, <template>, and <script>. Silent (no diagnostics).
 *   2. runUnknownRefValidator — ROZ100..ROZ106 (SEM-01).
 *   3. runPropWriteValidator — ROZ200 (SEM-02). Stubbed in Task 1; Task 2
 *      replaces with the live implementation.
 *   4. runUpdateExpressionValidator — ROZ203 (260530). Expression-context
 *      `++`/`--`/compound/plain mutation of reactive state ($data.<key> or a
 *      model:true $props.<key>) where the value is consumed — unlowerable.
 *   5. runRForKeyValidator — ROZ300/ROZ301/ROZ302 (SEM-03). Stubbed in
 *      Task 1; Task 3 replaces.
 *   6. runReservedIdentifierValidator — ROZ202. Flags <data> fields and
 *      r-for loop variables that shadow a reserved `$`-sigil.
 *
 * Per D-08 collected-not-thrown: NEVER throws. A malformed AST (e.g., empty
 * RozieAST wrapper) returns a non-null bindings table and an empty/
 * populated diagnostics array; callers decide what to do with the results.
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../ast/types.js';
import type { BindingsTable } from './types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { collectAllDeclarations } from './bindings.js';
import { runUnknownRefValidator } from './validators/unknownRefValidator.js';
import { runPropWriteValidator } from './validators/propWriteValidator.js';
import { runUpdateExpressionValidator } from './validators/updateExpressionValidator.js';
import { runRForKeyValidator } from './validators/rForKeyValidator.js';
import { runReservedIdentifierValidator } from './validators/reservedIdentifierValidator.js';
import { runListenerElementValidator } from './validators/listenerElementValidator.js';
import { runExposeValidator } from './validators/exposeValidator.js';
import { runContextValidator } from './validators/contextValidator.js';
import { runEmitNameValidator } from './validators/emitNameValidator.js';
import { runRefsPreMountValidator } from './validators/refsPreMountValidator.js';
import { runStructuredCloneReactiveValidator } from './validators/structuredCloneReactiveValidator.js';
import { runExposeReservedMemberValidator } from './validators/exposeReservedMemberValidator.js';
import { runReactStaleReadValidator } from './validators/reactStaleReadValidator.js';
import { runBareSigilValidator } from './validators/bareSigilValidator.js';

export interface AnalyzeResult {
  bindings: BindingsTable;
  diagnostics: Diagnostic[];
}

/**
 * Analyze a parsed RozieAST. Returns the BindingsTable and a list of
 * semantic diagnostics. NEVER throws (D-08).
 *
 * @param ast — non-null RozieAST from `parse()`.
 * @returns `{ bindings, diagnostics }` with diagnostics in the ROZ100..ROZ399 range.
 *
 * @experimental — shape may change before v1.0
 */
export function analyzeAST(ast: RozieAST): AnalyzeResult {
  const bindings = collectAllDeclarations(ast);
  const diagnostics: Diagnostic[] = [];
  runUnknownRefValidator(ast, bindings, diagnostics);
  runPropWriteValidator(ast, bindings, diagnostics);
  runUpdateExpressionValidator(ast, bindings, diagnostics);
  runRForKeyValidator(ast, diagnostics);
  runReservedIdentifierValidator(ast, bindings, diagnostics);
  // Phase 21 — $expose methods-only validation (ROZ115–ROZ120). Reads
  // bindings.exposeCalls; emits at most one diagnostic per offending site.
  runExposeValidator(ast, bindings, diagnostics);
  // Phase 36 — $provide/$inject context validation (ROZ129–ROZ132). Reads
  // bindings.provideCalls/injectCalls (collected-not-thrown, D-08). NEVER throws.
  runContextValidator(bindings, diagnostics);
  // Quick 260601-l2u — ROZ122: reject empty/whitespace-only $emit event names (script + template + listeners). No binding dependency.
  runEmitNameValidator(ast, diagnostics);
  // Quick 260602-dv1 — ROZ123: $refs read in a pre-mount eval position ($computed body / $watch getter / template binding/interpolation/r-if/r-show/r-for-iterable expr). No binding dependency.
  runRefsPreMountValidator(ast, diagnostics);
  // Phase 45 (D-02) — ROZ135 (warning): structuredClone($data.x/$props.x/$model.x)
  // throws on Vue reactive()/Svelte $state proxies — steer authors to $clone(x).
  // No binding dependency.
  runStructuredCloneReactiveValidator(ast, diagnostics);
  // Phase 46 (ITEM-3, D-02/D-03b) — ROZ137 (warning): an $expose verb whose name
  // shadows an inherited Object.prototype member (Angular+Lit) or HTMLElement/
  // Element/Node member (Lit) — the exposed method becomes a colliding class
  // member on the class-based targets. Reads bindings.expose.
  runExposeReservedMemberValidator(ast, bindings, diagnostics);
  // Phase 46 (ITEM-4, D-03b/A3) — ROZ138 (warning): within one <script> function
  // body, a read of $data/$model/$props.x dominated by an earlier write to the
  // same key (React setState is async → the read binds the pre-write value).
  // Conservative same-body write-before-read scan; no binding dependency.
  runReactStaleReadValidator(ast, diagnostics);
  // Phase 26 (SPEC-5, D-04/D-05/D-14) — ROZ978: a bare whole-object
  // $props/$data/$refs/$slots identifier (not a member access; $attrs/$listeners
  // exempt) used across template/script/listeners expressions. Always-on,
  // independent of safeInterpolation. No binding dependency.
  runBareSigilValidator(ast, diagnostics);
  // Phase 19 (D-08) — final pass: a <listener> placed inside <template> is a
  // misplaced element (ROZ206). No binding dependency.
  runListenerElementValidator(ast, diagnostics);
  return { bindings, diagnostics };
}
