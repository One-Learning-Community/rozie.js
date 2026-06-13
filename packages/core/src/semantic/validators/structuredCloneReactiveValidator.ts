/**
 * Phase 45 (D-02) — `structuredClone(<reactive binding>)` → `$clone` advisory
 * validator (ROZ135).
 *
 * `structuredClone(x)` THROWS ("could not be cloned" / DataCloneError) when `x`
 * is a framework reactivity proxy — a Vue `reactive()` object or a Svelte
 * `$state` object. This is a SILENT, target-asymmetric footgun: the same author
 * source works on React / Solid / Lit / Angular (plain values, no proxy) but
 * throws on Vue and Svelte ONLY, silently leaving snapshot/history state empty
 * (surfaced by the Phase 44 rete undo stack). The new `$clone(x)` sigil deep-
 * clones AND strips the proxy on all six targets, so this validator steers
 * authors off the raw `structuredClone(<reactive>)` pattern and onto `$clone`.
 *
 * ── FLAGGED ──────────────────────────────────────────────────────────────────
 *   A `CallExpression` where:
 *     - callee is `Identifier('structuredClone')`, AND
 *     - arguments[0] is a (Optional)MemberExpression whose ROOT object
 *       identifier ∈ { $props, $data, $model }.
 *   Examples: structuredClone($data.graph), structuredClone($props.x.y),
 *             structuredClone($model.z).
 *   Walked in <script> and <template> expression positions (binding,
 *   interpolation, r-if/r-show/r-text/r-html, r-for iterable).
 *
 * ── DO-NOT-FLAG ──────────────────────────────────────────────────────────────
 *   - structuredClone(someKnownPlainLocal) — argument is not a member rooted at
 *     a reactive accessor (D-02 conservative syntactic match → zero false
 *     positives; a legitimate clone of a plain local still compiles clean).
 *   - <listeners> handler bodies — intentionally NOT walked (mirrors
 *     refsPreMountValidator; A2 conservative default).
 *   - Aliased reactive bindings (`let g = $data.graph; structuredClone(g)`) —
 *     out of scope for v1 (D-02 / Open-Q: literal match only).
 *
 * Severity is `warning` (NOT error) — a legitimate `structuredClone(plainLocal)`
 * must still compile. Mirrors the ROZ123/127/128 target-asymmetry guard pattern.
 * Auto-rewrite is explicitly rejected (D-02 — warn, never silently rewrite).
 *
 * ── Re-parse / byte-offset discipline ────────────────────────────────────────
 * Template expression text is re-parsed via @babel/parser.parseExpression inside
 * a try/catch (D-08: never throws — the parser layer already diagnosed malformed
 * mustache/expression text). Every emitted diagnostic carries an absolute
 * byte-offset loc: re-parsed fragments add the fragment's base offset (the
 * attribute valueLoc.start, the interpolation loc.start + 2 to skip `{{`, or the
 * r-for value offset + the iterable's position within the LHS string).
 * `<script>` nodes carry absolute .rozie offsets (baseOffset 0).
 *
 * This validator has NO bindings dependency.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import { parseExpression } from '@babel/parser';
import type { RozieAST, SourceLoc } from '../../ast/types.js';
import type { ScriptAST } from '../../ast/blocks/ScriptAST.js';
import type {
  TemplateAST,
  TemplateNode,
  TemplateElement,
  TemplateAttr,
} from '../../ast/blocks/TemplateAST.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

// Default-export interop: see refsPreMountValidator.ts for the same pattern.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

/** The reactive accessor roots whose deep clone via raw `structuredClone`
 *  throws on Vue/Svelte proxies. Syntactic match only (D-02). */
const REACTIVE_ROOTS = new Set(['$props', '$data', '$model']);

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
 * Unwind a (Optional)MemberExpression `.object` chain to the root identifier
 * name. `$data.graph.nodes` → `$data`; `$props?.x.y` → `$props`. Returns null if
 * the root is not a plain identifier (e.g., a call or computed expression).
 */
function memberRoot(node: t.Node): string | null {
  let cur: t.Node = node;
  while (t.isMemberExpression(cur) || t.isOptionalMemberExpression(cur)) {
    cur = (cur as t.MemberExpression | t.OptionalMemberExpression).object;
  }
  return t.isIdentifier(cur) ? cur.name : null;
}

/** Emit ROZ135 (warning) for a `structuredClone(<reactive>)` call at `loc`. */
function pushStructuredCloneReactive(
  ctx: ValidatorContext,
  rootName: string,
  loc: SourceLoc,
): void {
  ctx.diagnostics.push({
    code: RozieErrorCode.STRUCTURED_CLONE_REACTIVE,
    severity: 'warning',
    message: `structuredClone(${rootName}.…) throws on Vue reactive()/Svelte $state proxies — use $clone(…) instead.`,
    loc,
    hint: '$clone(x) deep-clones and strips the reactive proxy on all six targets: structuredClone(toRaw(x)) on Vue, $state.snapshot(x) on Svelte, structuredClone(x) elsewhere.',
  });
}

/**
 * Visit a parsed expression subtree, flagging every
 * `structuredClone(<member rooted at a reactive accessor>)` call.
 */
function flagStructuredCloneInTree(
  root: t.Node,
  baseOffset: number,
  ctx: ValidatorContext,
): void {
  traverse(root, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee) || callee.name !== 'structuredClone') return;
      const args = path.node.arguments;
      if (args.length < 1) return;
      const arg = args[0]!;
      if (!t.isMemberExpression(arg) && !t.isOptionalMemberExpression(arg)) {
        return;
      }
      const rootName = memberRoot(arg);
      if (rootName === null || !REACTIVE_ROOTS.has(rootName)) return;
      pushStructuredCloneReactive(
        ctx,
        rootName,
        locFromNodeOffset(path.node, baseOffset),
      );
    },
  });
}

// ── <script> walk ────────────────────────────────────────────────────────────

function validateScript(script: ScriptAST, ctx: ValidatorContext): void {
  // <script> nodes carry absolute .rozie offsets — baseOffset 0.
  flagStructuredCloneInTree(script.program, 0, ctx);
}

// ── <template> walk ──────────────────────────────────────────────────────────

/**
 * Re-parse a template-expression fragment and flag reactive structuredClone
 * calls. Returns silently on parse failure (parser layer already diagnosed it).
 * NEVER throws (D-08).
 */
function parseAndFlag(
  text: string,
  baseOffset: number,
  ctx: ValidatorContext,
): void {
  let expr: t.Expression;
  try {
    expr = parseExpression(text, { sourceType: 'module' });
  } catch {
    return; // malformed — parser-layer diagnostics cover it; stay silent (D-08).
  }
  const wrapped = t.file(t.program([t.expressionStatement(expr)]));
  flagStructuredCloneInTree(wrapped, baseOffset, ctx);
}

// `(item, idx) in iterable` / `item of iterable` — find the keyword split so we
// can re-parse ONLY the iterable RHS and skip the alias LHS (not a JS
// expression). Mirrors refsPreMountValidator's posture.
const R_FOR_KEYWORD = /\s+(?:in|of)\s+/;

function validateRForIterable(attr: TemplateAttr, ctx: ValidatorContext): void {
  if (attr.value === null || attr.valueLoc === null) return;
  const m = R_FOR_KEYWORD.exec(attr.value);
  if (!m || m.index === undefined) return; // malformed r-for — rForKeyValidator owns it.
  const iterableStart = m.index + m[0].length;
  const iterable = attr.value.slice(iterableStart);
  parseAndFlag(iterable, attr.valueLoc.start + iterableStart, ctx);
}

/**
 * Walk a TemplateAttr's expression value. SKIP `static`. FLAG `binding`,
 * `event`, `r-model`, and the directive expression positions — `structuredClone`
 * of a reactive binding throws regardless of WHERE it is evaluated (unlike the
 * pre-mount $refs concern, the proxy-throw is position-independent), so this
 * validator flags every expression-bearing attribute value.
 */
function validateTemplateAttr(attr: TemplateAttr, ctx: ValidatorContext): void {
  if (attr.value === null || attr.valueLoc === null) return;
  if (attr.kind === 'static') return; // not a JS expression.
  if (attr.kind === 'directive' && attr.name === 'for') {
    validateRForIterable(attr, ctx);
    return;
  }
  parseAndFlag(attr.value, attr.valueLoc.start, ctx);
}

function isElement(node: TemplateNode): node is TemplateElement {
  return node.type === 'TemplateElement';
}

function isInterpolation(
  node: TemplateNode,
): node is { type: 'TemplateInterpolation'; rawExpr: string; loc: SourceLoc } {
  return node.type === 'TemplateInterpolation';
}

function visitTemplateNode(node: TemplateNode, ctx: ValidatorContext): void {
  if (isInterpolation(node)) {
    // {{ ... }} — baseOffset = loc.start + 2 (skipping `{{`).
    parseAndFlag(node.rawExpr, node.loc.start + 2, ctx);
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

function validateTemplate(template: TemplateAST, ctx: ValidatorContext): void {
  for (const child of template.children) {
    visitTemplateNode(child, ctx);
  }
}

/**
 * Run the `structuredClone(<reactive binding>)` → `$clone` validator over the
 * given AST. Emits ROZ135 (warning) into `diagnostics`. NEVER throws (D-08). No
 * bindings dependency.
 *
 * Note: <listeners> is intentionally NOT walked (A2 conservative default,
 * mirroring refsPreMountValidator).
 */
export function runStructuredCloneReactiveValidator(
  ast: RozieAST,
  diagnostics: Diagnostic[],
): void {
  const ctx: ValidatorContext = { diagnostics };
  if (ast.script) validateScript(ast.script, ctx);
  if (ast.template) validateTemplate(ast.template, ctx);
}
