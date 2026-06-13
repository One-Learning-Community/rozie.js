/**
 * validateClone — Phase 45 Plan 45-06 (gap-closure WR-01).
 *
 * Post-IR pass that walks every `$clone(...)` CallExpression in the component's
 * lowered IR and enforces the single SPEC validation rule (D-01):
 *
 *   - ROZ136 CLONE_BAD_ARITY — the call has anything other than exactly one
 *     plain (non-spread) argument (`$clone()`, `$clone(a, b)`, `$clone(...x)`,
 *     …). The sigil's per-target lowering hard-codes the single-argument
 *     `structuredClone(toRaw(x))` (Vue) / `$state.snapshot(x)` (Svelte) /
 *     `structuredClone(x)` (React/Solid/Angular/Lit) shape; a wrong arity (or a
 *     spread) cannot be mechanically interpreted at compile time and would
 *     otherwise fall through the per-target unary lowering guard, emitting a
 *     DANGLING `$clone` identifier (runtime ReferenceError, no compile signal —
 *     the ROZ977 anti-pattern). Error severity: a malformed `$clone` is an
 *     unrecoverable footgun.
 *
 * At most ONE diagnostic per `$clone` call.
 *
 * Per D-08 collected-not-thrown: NEVER throws. All failures push a diagnostic
 * and continue. Mutates `diagnostics` in place; NEVER mutates `ir`.
 *
 * Wired into `lowerToIR` (`packages/core/src/ir/lower.ts`) — the single
 * chokepoint both `compile()` and `@rozie/unplugin` share — so a bad `$clone`
 * call is caught regardless of entrypoint, on every target, BEFORE per-target
 * lowering runs.
 *
 * This pass adds ONLY diagnostics on malformed arity — it never touches the
 * lowering of valid unary `$clone(x)`, so the CloneProbe dist-parity fixtures
 * and FlowCanvas dogfood stay byte-identical (no emitter change, no rebless).
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
// at module load. Same pattern as validateRestoreFocus.ts.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

/** The Phase 45 clone-sigil callee name. */
const CLONE_CALLEE = '$clone';

/** Convert a Babel `SourceLocation` (byte offsets) into the IR `SourceLoc`
 *  shape. If a synthesized node lacks them, fall back to a zero-span loc rather
 *  than throwing (D-08). Mirrors validateRestoreFocus.babelLoc. */
function babelLoc(node: t.Node): SourceLoc {
  const start = typeof node.start === 'number' ? node.start : 0;
  const end = typeof node.end === 'number' ? node.end : start;
  return { start, end };
}

/**
 * Recursive template walker — mirrors `validateRestoreFocus.walkTemplate` so
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
 * Validate one `$clone` CallExpression. Pushes at most one diagnostic. Never
 * mutates the call node.
 */
function validateCall(
  call: t.CallExpression,
  diagnostics: Diagnostic[],
): void {
  // ----- ROZ136 — arity check. -----
  //
  // The per-target lowering hard-codes the single-argument shape; anything
  // else (wrong count OR a SpreadElement) cannot be mechanically interpreted at
  // compile time and would emit a dangling `$clone` identifier.
  const isSpread =
    call.arguments.length === 1 && t.isSpreadElement(call.arguments[0]!);
  if (call.arguments.length !== 1 || isSpread) {
    const arity = isSpread ? 'a spread argument' : `${call.arguments.length} arguments`;
    diagnostics.push({
      code: RozieErrorCode.CLONE_BAD_ARITY,
      severity: 'error',
      message: `$clone(value) requires exactly one non-spread argument — got ${arity}. The per-target lowering (structuredClone(toRaw(x)) / $state.snapshot(x) / structuredClone(x)) cannot interpret any other arity.`,
      loc: babelLoc(call),
      hint: 'Call as $clone(value) — a single reactive object/array to deep-clone, e.g. $clone($data.graph).',
    });
  }
}

/**
 * Traverse a Babel AST node for `$clone` CallExpressions, validating each.
 * Wraps a bare Expression in a synthetic File so `@babel/traverse` accepts it
 * (the ExpressionStatement preserves the original node references); a
 * Program/File is traversed directly.
 *
 * Per D-08 every step is defensive — a malformed node silently yields no
 * diagnostics rather than throwing. Mirrors validateRestoreFocus.scanNode.
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
        if (t.isIdentifier(callee) && callee.name === CLONE_CALLEE) {
          validateCall(path.node, diagnostics);
        }
      },
    });
  } catch {
    // Defensive — traverse failure must not abort lowering (D-08).
  }
}

/**
 * Validate every `$clone(value)` call in the component's IR.
 *
 * Scans three IR regions where a `$clone` call can appear (mirrors
 * validateRestoreFocus):
 *   1. `ir.setupBody.scriptProgram`        — the `<script>` Babel Program. This
 *      ALSO covers every `$computed(() => …)` initializer body (ComputedDecl.body
 *      is a *reference* into `scriptProgram`, not a copy).
 *   2. `ir.template` `AttributeBinding`s + interpolations — `:attr="$clone(x)"`
 *      and `{{ $clone(x) }}`.
 *   3. `ir.listeners` `when` / `handler`   — `<listeners>` block + template @event.
 *
 * @param ir          - the lowered IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ136 pushed)
 */
export function validateClone(
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  // (1) <script> Program — covers $computed bodies; never re-scan ir.computed[].body
  // (duplicate diagnostics).
  scanNode(ir.setupBody?.scriptProgram, diagnostics);

  // (2) Template attribute expressions + interpolations — same `binding` /
  // `twoWayBinding` / `interpolated` shape as validateRestoreFocus.
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
