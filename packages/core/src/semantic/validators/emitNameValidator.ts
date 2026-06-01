/**
 * SEM (Quick 260601-l2u) — Empty-`$emit`-event-name validator (ROZ122).
 *
 * Walks the three contexts where a `$emit(...)` call can appear and emits an
 * error when the FIRST argument is a string literal whose `.value.trim() === ''`
 * (empty OR whitespace-only):
 *
 *   - <script>     — full Babel program traversal (CallExpression visitor).
 *   - <template>   — for each TemplateAttr where kind === 'binding' | 'directive'
 *                    | 'event' (SKIP directive `for` — r-for LHS is not a JS
 *                    expression), and each TemplateInterpolation ({{ ... }}),
 *                    re-parse the expression text and walk it.
 *   - <listeners>  — each ListenerEntry's `value` Expression (absolute byte
 *                    offsets, baseOffset 0); the `$emit` call lives in the
 *                    handler, so traversing the full expression tree with the
 *                    CallExpression visitor is sufficient.
 *
 * An empty event name is meaningless on every target — Angular emits a class
 * field with an empty name; no consumer can bind it. ROZ122 makes the shape an
 * explicit compile error instead of broken 1-of-6-target codegen, mirroring the
 * ROZ121 collision work.
 *
 * SCOPE: only STRING-LITERAL first arguments are diagnosed. A missing first
 * argument, a non-string-literal (Identifier / template literal / member-expr —
 * dynamic names), or a non-empty string produces ZERO diagnostics (no false
 * positive). This validator has NO bindings dependency.
 *
 * Per D-08 collected-not-thrown: NEVER throws. Re-parsing user-provided
 * expression strings is wrapped in try/catch — parse errors are silently skipped
 * (the malformed expression is reported by parseTemplate / parseListeners
 * earlier in the pipeline).
 *
 * Per D-11/D-12: every emitted diagnostic carries an accurate byte-offset loc
 * from the offending node. When walking a re-parsed expression, the loc is
 * offset by the fragment's base offset so diagnostics point at absolute byte
 * positions in the .rozie source.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import { parseExpression } from '@babel/parser';
import type { RozieAST, SourceLoc } from '../../ast/types.js';
import type { ScriptAST } from '../../ast/blocks/ScriptAST.js';
import type { ListenersAST, ListenerEntry } from '../../ast/blocks/ListenersAST.js';
import type {
  TemplateAST,
  TemplateNode,
  TemplateElement,
  TemplateAttr,
} from '../../ast/blocks/TemplateAST.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

// Default-export interop: see unknownRefValidator.ts for the same pattern.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

interface ValidatorContext {
  diagnostics: Diagnostic[];
}

/**
 * Shift Babel-relative offsets (computed against the parsed expression
 * fragment) into absolute offsets in the .rozie file by adding `baseOffset`.
 */
function locFromNodeOffset(node: t.Node, baseOffset: number): SourceLoc {
  return {
    start: (node.start ?? 0) + baseOffset,
    end: (node.end ?? 0) + baseOffset,
  };
}

/**
 * The single core check. Fires ROZ122 iff the call is `$emit(...)` and its first
 * argument is a string literal whose trimmed value is empty. All other shapes
 * (missing arg, dynamic/non-literal arg, non-empty string) are out of scope.
 */
function checkCallExpression(
  node: t.CallExpression,
  ctx: ValidatorContext,
  baseOffset: number,
): void {
  if (!t.isIdentifier(node.callee) || node.callee.name !== '$emit') return;
  const first = node.arguments[0];
  if (!first || !t.isStringLiteral(first)) return; // missing or dynamic — out of scope
  if (first.value.trim() !== '') return; // non-empty name — valid
  ctx.diagnostics.push({
    code: RozieErrorCode.EMIT_EMPTY_EVENT_NAME,
    severity: 'error',
    message:
      '$emit requires a non-empty event name — an empty name cannot be bound by consumers on any target.',
    loc: locFromNodeOffset(node, baseOffset),
    hint: "Give the event a descriptive name, e.g. $emit('change', payload).",
  });
}

/**
 * Walk a Babel program with the CallExpression visitor, emitting ROZ122.
 */
function traverseProgram(file: t.File, ctx: ValidatorContext): void {
  traverse(file, {
    CallExpression(path) {
      checkCallExpression(path.node, ctx, 0);
    },
  });
}

/**
 * Walk a stand-alone Babel Expression (re-parsed from a template attribute
 * value/interpolation, or a listener handler). The expression's offsets are
 * relative to the parsed-fragment start, so `baseOffset` is added to all
 * emitted diagnostic locs.
 */
function traverseFragmentExpression(
  expr: t.Expression,
  baseOffset: number,
  ctx: ValidatorContext,
): void {
  const wrapped = t.file(t.program([t.expressionStatement(expr)]));
  traverse(wrapped, {
    CallExpression(path) {
      checkCallExpression(path.node, ctx, baseOffset);
    },
  });
}

/**
 * Re-parse a template-attribute or interpolation expression text and walk it.
 * Returns silently on parse failure — the parser layer already emitted a
 * diagnostic for malformed expression text. NEVER throws (D-08).
 */
function parseAndTraverse(
  text: string,
  baseOffset: number,
  ctx: ValidatorContext,
): void {
  try {
    const expr = parseExpression(text, { sourceType: 'module' });
    traverseFragmentExpression(expr, baseOffset, ctx);
  } catch {
    // Parser-layer diagnostics already cover this; stay silent here.
  }
}

function isElement(node: TemplateNode): node is TemplateElement {
  return node.type === 'TemplateElement';
}

function isInterpolation(
  node: TemplateNode,
): node is { type: 'TemplateInterpolation'; rawExpr: string; loc: SourceLoc } {
  return node.type === 'TemplateInterpolation';
}

/**
 * Walk a TemplateAttr's expression value if the attr's kind is a known
 * expression-bearing kind (binding, directive, event). SKIP directive `for`
 * (r-for LHS is not a JS expression).
 */
function validateTemplateAttr(attr: TemplateAttr, ctx: ValidatorContext): void {
  if (attr.value === null || attr.valueLoc === null) return;
  if (attr.kind === 'directive' && attr.name === 'for') return;
  if (
    attr.kind === 'binding' ||
    attr.kind === 'directive' ||
    attr.kind === 'event'
  ) {
    parseAndTraverse(attr.value, attr.valueLoc.start, ctx);
  }
}

function visitTemplateNode(node: TemplateNode, ctx: ValidatorContext): void {
  if (isInterpolation(node)) {
    // {{ ... }} — baseOffset = loc.start + 2 (skipping `{{`).
    parseAndTraverse(node.rawExpr, node.loc.start + 2, ctx);
    return;
  }
  if (!isElement(node)) return;
  for (const attr of node.attributes) {
    validateTemplateAttr(attr, ctx);
  }
  for (const child of node.children) {
    visitTemplateNode(child, ctx);
  }
}

function validateListenerEntry(entry: ListenerEntry, ctx: ValidatorContext): void {
  // entry.value carries ABSOLUTE byte offsets (baseOffset 0). The `$emit` call
  // lives in the handler; walking the full expression tree covers it.
  traverseFragmentExpression(entry.value, 0, ctx);
}

function validateScript(script: ScriptAST, ctx: ValidatorContext): void {
  traverseProgram(script.program, ctx);
}

function validateListeners(listeners: ListenersAST, ctx: ValidatorContext): void {
  for (const entry of listeners.entries) {
    validateListenerEntry(entry, ctx);
  }
}

function validateTemplate(template: TemplateAST, ctx: ValidatorContext): void {
  for (const child of template.children) {
    visitTemplateNode(child, ctx);
  }
}

/**
 * Run the empty-`$emit`-event-name validator over the given AST. Emits ROZ122
 * into `diagnostics`. NEVER throws (D-08). No bindings dependency.
 */
export function runEmitNameValidator(
  ast: RozieAST,
  diagnostics: Diagnostic[],
): void {
  const ctx: ValidatorContext = { diagnostics };
  if (ast.script) validateScript(ast.script, ctx);
  if (ast.template) validateTemplate(ast.template, ctx);
  if (ast.listeners) validateListeners(ast.listeners, ctx);
}
