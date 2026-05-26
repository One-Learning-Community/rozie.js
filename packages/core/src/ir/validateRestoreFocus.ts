/**
 * validateRestoreFocus — Phase 16 Plan 16-03.
 *
 * Post-IR pass that walks every `$restoreFocus(selector, idx)` CallExpression in
 * the component's lowered IR and enforces the two SPEC validation rules
 * (R9/R10):
 *
 *   - ROZ976 RESTORE_FOCUS_BAD_ARITY (R9) — the call has anything other than
 *     exactly two arguments (`$restoreFocus()`, `$restoreFocus('.row')`,
 *     `$restoreFocus('.row', 0, 'extra')`, …). The sigil's per-target lowering
 *     hard-codes the (selector, idx) shape; a wrong arity cannot be
 *     mechanically interpreted at compile time.
 *
 *   - ROZ975 RESTORE_FOCUS_NON_LITERAL_SELECTOR (R9) — the first argument is
 *     not a string literal (`$restoreFocus($data.cls, 0)`,
 *     `$restoreFocus(this.sel, 0)`, …). A non-literal selector cannot be
 *     audited at compile time and would be embedded verbatim into the
 *     per-target lowering's `querySelectorAll(...)` call where it becomes a
 *     potential runtime injection surface.
 *
 * Per-call diagnostic priority — at most ONE diagnostic per `$restoreFocus`
 * call, most-specific-failure-first: arity (ROZ976) → non-literal selector
 * (ROZ975).
 *
 * Per D-08 collected-not-thrown: NEVER throws. All failures push a diagnostic
 * and continue. Mutates `diagnostics` in place; NEVER mutates `ir`.
 *
 * Wired into `lowerToIR` (`packages/core/src/ir/lower.ts`) — the single
 * chokepoint both `compile()` and `@rozie/unplugin` share — so a bad
 * `$restoreFocus` call is caught regardless of entrypoint.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { SourceLoc } from '../ast/types.js';
import type { IRComponent, TemplateNode, Listener } from './types.js';

// Default-export interop: @babel/traverse ships a CJS default export that some
// bundlers (incl. Vitest's ESM resolver) wrap into { default: fn }. Normalize
// at module load. Same pattern as validateClassSelector.ts.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

/** The Phase 16 helper callee name. */
const RESTORE_FOCUS_CALLEE = '$restoreFocus';

/** Convert a Babel `SourceLocation` (byte offsets) into the IR `SourceLoc`
 *  shape. If a synthesized node lacks them, fall back to a zero-span loc rather
 *  than throwing (D-08). Mirrors validateClassSelector.babelLoc. */
function babelLoc(node: t.Node): SourceLoc {
  const start = typeof node.start === 'number' ? node.start : 0;
  const end = typeof node.end === 'number' ? node.end : start;
  return { start, end };
}

/**
 * Recursive template walker — mirrors `validateClassSelector.walkTemplate` so
 * the two IR passes traverse exactly the same node set (slot-filler bodies and
 * conditional / loop / match / fragment / slot-invocation bodies included).
 */
function walkTemplate(
  node: TemplateNode | null,
  visit: (n: TemplateNode) => void,
): void {
  if (node === null) return;
  visit(node);
  switch (node.type) {
    case 'TemplateElement':
      for (const child of node.children) walkTemplate(child, visit);
      if (node.slotFillers) {
        for (const filler of node.slotFillers) {
          for (const child of filler.body) walkTemplate(child, visit);
        }
      }
      break;
    case 'TemplateConditional':
    case 'TemplateMatch':
      for (const branch of node.branches) {
        for (const child of branch.body) walkTemplate(child, visit);
      }
      break;
    case 'TemplateLoop':
      for (const child of node.body) walkTemplate(child, visit);
      break;
    case 'TemplateSlotInvocation':
      for (const child of node.fallback) walkTemplate(child, visit);
      break;
    case 'TemplateFragment':
      for (const child of node.children) walkTemplate(child, visit);
      break;
    case 'TemplateInterpolation':
    case 'TemplateStaticText':
      break;
  }
}

/**
 * Validate one `$restoreFocus` CallExpression. Pushes at most one diagnostic
 * (most-specific-failure-first). Never mutates the call node.
 */
function validateCall(
  call: t.CallExpression,
  diagnostics: Diagnostic[],
): void {
  const loc = babelLoc(call);

  // ----- Priority 1: ROZ976 — arity check. -----
  //
  // The per-target lowering hard-codes the two-arg (selector, idx) shape;
  // anything else cannot be mechanically interpreted at compile time.
  if (call.arguments.length !== 2) {
    diagnostics.push({
      code: RozieErrorCode.RESTORE_FOCUS_BAD_ARITY,
      severity: 'error',
      message:
        '$restoreFocus(selector, idx) requires exactly two arguments — a string-literal CSS selector and a numeric index expression.',
      loc,
      hint: "Call as $restoreFocus('.row', idx) — selector string then numeric index.",
    });
    return;
  }

  // ----- Priority 2: ROZ975 — first arg must be a string literal. -----
  const first = call.arguments[0]!;
  if (!t.isStringLiteral(first)) {
    diagnostics.push({
      code: RozieErrorCode.RESTORE_FOCUS_NON_LITERAL_SELECTOR,
      severity: 'error',
      message:
        '$restoreFocus first argument must be a string literal selector — a variable, member access, or computed expression cannot be audited at compile time.',
      loc,
      hint: "Pass a string literal, e.g. $restoreFocus('[role=\"listitem\"]', newIdx).",
    });
    return;
  }

  // Second arg type-check is best-effort (per SPEC R9) — skipped.
}

/**
 * Traverse a Babel AST node for `$restoreFocus` CallExpressions, validating
 * each. Wraps a bare Expression in a synthetic File so `@babel/traverse`
 * accepts it (the ExpressionStatement preserves the original node references);
 * a Program/File is traversed directly.
 *
 * Per D-08 every step is defensive — a malformed node silently yields no
 * diagnostics rather than throwing. Mirrors validateClassSelector.scanNode.
 */
function scanNode(
  node: t.Node | null | undefined,
  diagnostics: Diagnostic[],
): void {
  if (!node) return;

  let root: t.File;
  try {
    if (t.isFile(node)) {
      root = node;
    } else if (t.isProgram(node)) {
      root = t.file(node);
    } else if (t.isExpression(node)) {
      // ExpressionStatement preserves the original Expression node references.
      root = t.file(t.program([t.expressionStatement(node)]));
    } else if (t.isStatement(node)) {
      // A BlockStatement (e.g. a $computed callback body) — wrap as an arrow
      // function body so it is reachable from a Program root.
      root = t.isBlockStatement(node)
        ? t.file(
            t.program([
              t.expressionStatement(t.arrowFunctionExpression([], node)),
            ]),
          )
        : t.file(t.program([node]));
    } else {
      return;
    }
  } catch {
    // Defensive — if a builder rejects the node, walk nothing.
    return;
  }

  try {
    traverse(root, {
      CallExpression(path) {
        const callee = path.node.callee;
        if (t.isIdentifier(callee) && callee.name === RESTORE_FOCUS_CALLEE) {
          validateCall(path.node, diagnostics);
        }
      },
    });
  } catch {
    // Defensive — traverse failure must not abort lowering (D-08).
  }
}

/**
 * Validate every `$restoreFocus('<selector>', idx)` call in the component's IR.
 *
 * Scans three IR regions where a `$restoreFocus` call can appear:
 *   1. `ir.setupBody.scriptProgram`        — the `<script>` Babel Program. This
 *      ALSO covers every `$computed(() => …)` initializer body: `lowerScript`
 *      classifies declarators but does not splice the `$computed` variable
 *      declarator out of the Program, and `ComputedDecl.body` is a *reference*
 *      into `scriptProgram` (not a copy).
 *   2. `ir.template` `AttributeBinding`s   — `:attr="$restoreFocus('x', 0)"`.
 *      The `AttributeBinding` kinds scanned are `binding` (`:attr="…"`),
 *      `twoWayBinding` (`r-model:prop="…"` RHS), and the `binding` segments of
 *      an `interpolated` attribute; `static` segments are literal text.
 *   3. `ir.listeners` `when` / `handler`   — `<listeners>` block + template @event.
 *
 * @param ir          - the lowered IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ975/ROZ976 pushed)
 */
export function validateRestoreFocus(
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  // (1) <script> Program — covers $computed bodies; never re-scan ir.computed[].body
  // (WR-01 — duplicate diagnostics).
  scanNode(ir.setupBody?.scriptProgram, diagnostics);

  // (2) Template attribute expressions — same `binding` / `twoWayBinding` /
  // `interpolated` shape as validateClassSelector.
  walkTemplate(ir.template, (node) => {
    if (node.type === 'TemplateInterpolation') {
      scanNode(node.expression, diagnostics);
      return;
    }
    if (node.type !== 'TemplateElement') return;
    for (const attr of node.attributes) {
      switch (attr.kind) {
        case 'binding':
        case 'twoWayBinding':
          scanNode(attr.expression, diagnostics);
          break;
        case 'interpolated':
          for (const seg of attr.segments) {
            if (seg.kind === 'binding') {
              scanNode(seg.expression, diagnostics);
            }
          }
          break;
        case 'static':
          break;
      }
    }
  });

  // (3) Listener when / handler expressions (<listeners> block + template @event).
  const scanListener = (listener: Listener): void => {
    scanNode(listener.when, diagnostics);
    scanNode(listener.handler, diagnostics);
  };
  for (const listener of ir.listeners) scanListener(listener);
}
