/**
 * SEM — `$emit`-call shape validator (ROZ122 + ROZ145 + ROZ209).
 *
 * Walks the three contexts where a `$emit(...)` call can appear (script /
 * template handler / listeners) and emits, per call:
 *   - ROZ122 (Quick 260601-l2u) — the FIRST argument is a string literal whose
 *     `.value.trim() === ''` (empty OR whitespace-only event name);
 *   - ROZ145 (Spike-012 R9) — 2+ POSITIONAL payload args (`$emit('name', a, b)`),
 *     which Lit (CustomEvent single `detail`) and Angular (output single value)
 *     silently drop past the first. Pack into one object/array payload.
 *   - ROZ209 (Quick 260803-ibt WR-03) — a NON-EMPTY event name that still
 *     cannot lower to a valid JS identifier (colon, dot, leading digit,
 *     whitespace, etc.). The name flows into a per-target destructure
 *     pattern and a `void` fallthrough-skip statement; a charset violation
 *     is either a SyntaxError or — worse — valid JS that silently renames.
 *
 * ROZ122 detail — fires when the first argument is an empty/whitespace-only
 * string literal:
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

// Quick 260803-ibt WR-03 (ROZ209) — the charset an $emit event name must
// stay within to safely lower to a JS identifier on every consuming path.
const EMIT_NAME_VALID_IDENTIFIER_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

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
  // Spike-012 R9 (ROZ145) — 2+ POSITIONAL payload args (`$emit('name', a, b)`).
  // Independent of the event-name shape (fires on a dynamic name too), so it runs
  // BEFORE the ROZ122 first-arg early-returns. `arguments[0]` is the event name;
  // `arguments[1..]` are the payload. Lit's CustomEvent (single `detail`) and
  // Angular's output (single value) silently drop everything past the first
  // payload arg. A spread in the payload makes the count dynamic — out of scope.
  const payload = node.arguments.slice(1);
  if (payload.length >= 2 && payload.every((a) => !t.isSpreadElement(a))) {
    ctx.diagnostics.push({
      code: RozieErrorCode.EMIT_MULTIPLE_POSITIONAL_ARGS,
      severity: 'error',
      message:
        '$emit with 2+ positional payload args is not portable — Lit (CustomEvent single `detail`) and Angular (output single value) silently drop every arg past the first.',
      loc: locFromNodeOffset(node, baseOffset),
      hint: "Pack the payload into a single object or array, e.g. $emit('change', { a, b }).",
    });
  }
  const first = node.arguments[0];
  if (!first || !t.isStringLiteral(first)) return; // missing or dynamic — out of scope
  if (first.value.trim() === '') {
    ctx.diagnostics.push({
      code: RozieErrorCode.EMIT_EMPTY_EVENT_NAME,
      severity: 'error',
      message:
        '$emit requires a non-empty event name — an empty name cannot be bound by consumers on any target.',
      loc: locFromNodeOffset(node, baseOffset),
      hint: "Give the event a descriptive name, e.g. $emit('change', payload).",
    });
    return; // ROZ122 already covers this shape — ROZ209's charset check is
    // meaningless on an empty string (would report a confusing SECOND
    // diagnostic for the same underlying "no usable name" problem).
  }
  // Quick 260803-ibt WR-03 (ROZ209) — the event name must lower to a valid
  // JS identifier everywhere it is used: a per-target destructure pattern
  // (`const { on<Name>: handler, ...rest } = $props`) and a `void
  // on<Name>;` fallthrough-skip statement. A colon (`update:foo`, Vue's
  // two-way-binding convention — NOT a lowering Rozie recognizes; two-way
  // binding is `model: true` props) produces valid-but-SILENTLY-RENAMING JS
  // (`{ onUpdate:foo }` destructures `onUpdate` into local `foo`); a dot
  // (`a.b`) produces a SyntaxError. Charset: leading letter, then
  // letters/digits/hyphen/underscore — kebab-case and snake_case both legal
  // (the charset every existing `packages/ui/*` family emit name uses).
  if (!EMIT_NAME_VALID_IDENTIFIER_RE.test(first.value)) {
    ctx.diagnostics.push({
      code: RozieErrorCode.EMIT_NAME_INVALID_IDENTIFIER,
      severity: 'error',
      message: `$emit event name "${first.value}" cannot lower to a valid JS identifier — it flows into a destructure pattern and a void statement on every emit-consuming code path.`,
      loc: locFromNodeOffset(node, baseOffset),
      hint: 'Use letters, digits, hyphens, or underscores, starting with a letter (e.g. "item-selected"). For two-way binding, use a `model: true` prop instead of a Vue-style `update:x` emit name.',
    });
  }
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
