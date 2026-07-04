/**
 * SEM-01 — Unknown-reference validator (ROZ100..ROZ106).
 *
 * Walks the three contexts where magic accessors (`$props`, `$data`,
 * `$refs`, `$slots`) can appear and emits a diagnostic when the referenced
 * member is not declared in the BindingsTable:
 *
 *   - <script> — full Babel program traversal
 *   - <listeners> — each ListenerEntry's RHS object (the ObjectExpression
 *     containing `when` and `handler`); `when` may be a string literal that
 *     we re-parse via @babel/parser.parseExpression to walk as an expression.
 *   - <template> — for each TemplateAttr where kind === 'binding' (e.g.
 *     :disabled="..."), kind === 'directive' (e.g. r-if=...), or
 *     a TemplateInterpolation ({{ ... }}) — parse the expression text and
 *     traverse it.
 *
 * Emits ROZ104 when a lifecycle hook ($onMount/$onUnmount/$onUpdate) is
 * called inside ANY function (i.e. not at script Program top level).
 *
 * Emits ROZ105 (warning) when $onMount(async () => …) returns a function-
 * looking value as its trailing statement — Promise return cannot be a
 * cleanup (D-19 edge case).
 *
 * Emits ROZ106 when computed access ($props['foo']) is used on any of the
 * four magic accessors. Computed access is rejected by Rozie's reactivity
 * model (static keys only).
 *
 * Per D-08 collected-not-thrown: NEVER throws. Re-parsing user-provided
 * expression strings is wrapped in try/catch — parse errors are silently
 * skipped (the malformed expression is reported by parseTemplate /
 * parseListeners earlier in the pipeline).
 *
 * Per D-11/D-12: every emitted diagnostic carries an accurate byte-offset
 * loc from the offending node. When walking a re-parsed expression, the
 * loc is offset by the attribute valueLoc.start so diagnostics point at
 * absolute byte positions in the .rozie source.
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
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
import { locFromBabel } from '../../diagnostics/locFromBabel.js';
import type { BindingsTable } from '../types.js';
import { detectMagicAccess } from '../visitors.js';

// Default-export interop: see collectScriptDecls.ts for the same pattern.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

const MAGIC_ACCESSORS = new Set(['$props', '$data', '$refs', '$slots', '$model']);
// `$watch` is also handled by checkLifecycleSiting (must be at Program top
// level) but uses ROZ109 for argument-shape errors instead of ROZ104.
// Quick plan 260515-u2b.
const LIFECYCLE_NAMES = new Set(['$onMount', '$onUnmount', '$onUpdate', '$watch']);

interface ValidatorContext {
  bindings: BindingsTable;
  diagnostics: Diagnostic[];
}

function locFromNode(node: t.Node): SourceLoc {
  return locFromBabel(node);
}

/**
 * Shift Babel-relative offsets (computed against the parsed expression
 * fragment) into absolute offsets in the .rozie file by adding `baseOffset`.
 *
 * Quick plan 260703-vk4: delegates to `locFromBabel` so a script-origin node
 * (baseOffset 0 — traversed directly off `script.program`, which may be a
 * spliced `.rzts`/`.rzjs` partial per inlineScriptPartials R7) still carries
 * `loc.filename`. Re-parsed template-attribute/listener fragment expressions
 * (non-zero baseOffset) are parsed with no `sourceFilename`, so their nodes
 * never carry a `loc.filename` — this is a no-op for that path.
 */
function locFromNodeOffset(node: t.Node, baseOffset: number): SourceLoc {
  const base = locFromBabel(node);
  return {
    start: base.start + baseOffset,
    end: base.end + baseOffset,
    ...(base.filename !== undefined ? { filename: base.filename } : {}),
  };
}

/**
 * Phase 18 (D-08): emit the right `$model.<x>` diagnostic.
 *
 * `$model`'s valid keys are exactly the `model: true` subset of <props>:
 *   - declared prop but NOT model: true  → ROZ205 (MODEL_ACCESS_NON_MODEL_PROP)
 *   - not a declared prop at all         → ROZ113 (UNKNOWN_MODEL_REF)
 *
 * Handled in its OWN branch (before the generic props/data/refs/slots
 * codeMap path) so the union-widen of `detectMagicAccess` does not break the
 * `Record<scope,…>` exhaustiveness there — and so each `$model` ref is owned by
 * exactly one validator/code (D-09 / Pitfall 6). Never throws.
 */
function pushModelDiagnostic(
  ctx: ValidatorContext,
  member: string,
  loc: SourceLoc,
): void {
  const decl = ctx.bindings.props.get(member);
  if (decl && !decl.isModel) {
    // Declared prop, but not model: true — ROZ205.
    ctx.diagnostics.push({
      code: RozieErrorCode.MODEL_ACCESS_NON_MODEL_PROP,
      severity: 'error',
      message: `'$model.${member}' is invalid — '${member}' is a prop but is not declared with model: true. '$model' only addresses model props.`,
      loc,
      hint: `Add 'model: true' to the '${member}' prop declaration if two-way binding is intended, or use $data for component-local state.`,
      related: [{ message: 'Prop declared here', loc: decl.sourceLoc }],
    });
    return;
  }
  if (!decl) {
    // Not a declared prop at all — ROZ113.
    ctx.diagnostics.push({
      code: RozieErrorCode.UNKNOWN_MODEL_REF,
      severity: 'error',
      message: `Unknown reference '$model.${member}' — '${member}' is not a declared prop.`,
      loc,
      hint: `Declare '${member}' in <props> with 'model: true' if a model prop is intended.`,
    });
    return;
  }
  // decl exists AND is a model prop — valid $model ref, no diagnostic.
}

function pushUnknownMagicDiagnostic(
  ctx: ValidatorContext,
  scope: 'props' | 'data' | 'refs' | 'slots',
  member: string,
  loc: SourceLoc,
): void {
  const codeMap: Record<typeof scope, string> = {
    props: RozieErrorCode.UNKNOWN_PROPS_REF,
    data: RozieErrorCode.UNKNOWN_DATA_REF,
    refs: RozieErrorCode.UNKNOWN_REFS_REF,
    slots: RozieErrorCode.UNKNOWN_SLOTS_REF,
  };
  const accessorName = `$${scope}`;
  const hint = scope === 'slots'
    ? `Add <slot name="${member}" /> to <template> if a named slot is intended.`
    : `Add ${member} to <${scope}> if intended.`;
  ctx.diagnostics.push({
    code: codeMap[scope],
    severity: 'error',
    message: `Unknown reference '${accessorName}.${member}' — '${member}' is not declared in <${scope}>.`,
    loc,
    hint,
  });
}

/**
 * For a MemberExpression node, check whether it's a magic-accessor read whose
 * member is not present in the BindingsTable, and emit the right ROZ1xx code.
 *
 * Also handles the ROZ106 computed-access case (e.g., $props['foo']).
 *
 * `baseOffset` shifts loc fields when re-parsing a template-attribute or
 * listener `when` expression fragment whose offsets are relative to the
 * fragment start, not the .rozie source start.
 */
function checkMemberExpression(
  node: t.MemberExpression,
  ctx: ValidatorContext,
  baseOffset: number,
): void {
  // Only fire on magic accessors. Skip plain `someObj.foo`.
  if (!t.isIdentifier(node.object) || !MAGIC_ACCESSORS.has(node.object.name)) return;

  // Computed access on a magic accessor — ROZ106.
  if (node.computed) {
    ctx.diagnostics.push({
      code: RozieErrorCode.COMPUTED_MAGIC_ACCESS,
      severity: 'error',
      message: `Computed access on '${node.object.name}' is not supported — magic accessors require static keys.`,
      loc: locFromNodeOffset(node, baseOffset),
      hint: 'Use static dot access (e.g. $props.foo) so the compiler can statically resolve the binding.',
    });
    return;
  }

  // Use detectMagicAccess to validate static-identifier shape.
  const access = detectMagicAccess(node);
  if (!access) return; // shape mismatch (e.g., $props.<something-not-ident>) — skip

  const { scope, member } = access;

  // Phase 18 (D-08): `$model.<x>` is owned by its own branch — ROZ205 (declared
  // non-model prop) / ROZ113 (undeclared) / valid (model prop). Handled BEFORE
  // the props/data/refs/slots chain so the narrow 4-scope union flows into
  // pushUnknownMagicDiagnostic unchanged (no codeMap exhaustiveness break).
  if (scope === 'model') {
    pushModelDiagnostic(ctx, member, locFromNodeOffset(node, baseOffset));
    return;
  }

  let known = false;
  if (scope === 'props') known = ctx.bindings.props.has(member);
  else if (scope === 'data') known = ctx.bindings.data.has(member);
  else if (scope === 'refs') known = ctx.bindings.refs.has(member);
  else if (scope === 'slots') {
    // Empty-string default-slot is always valid (cannot appear via dot syntax,
    // only via $slots[''] which is computed access — already filtered above).
    if (member === '') return;
    known = ctx.bindings.slots.has(member);
  }
  if (!known) {
    pushUnknownMagicDiagnostic(ctx, scope, member, locFromNodeOffset(node, baseOffset));
  }
}

/**
 * Detect lifecycle calls inside nested functions (ROZ104) within the script's
 * Program.
 *
 * NOTE: ROZ105 (async $onMount cleanup-return) is intentionally NOT emitted
 * here. `lowerScript.pairLifecycleHooks` is the single authoritative emitter
 * for ROZ105 because it has access to `extractCleanupReturn`'s result and can
 * correctly distinguish async-with-return from async-without-return.
 * Emitting from both sites would produce duplicate diagnostics for the same
 * source node.
 */
function checkLifecycleSiting(
  callee: t.Identifier,
  path: NodePath<t.CallExpression>,
  ctx: ValidatorContext,
): void {
  if (!LIFECYCLE_NAMES.has(callee.name)) return;
  // Walk up the path looking for a Function ancestor (anything that creates a
  // new function scope). If found, this lifecycle call is nested.
  const fnParent = path.findParent((p) => p.isFunction());
  if (fnParent) {
    ctx.diagnostics.push({
      code: RozieErrorCode.LIFECYCLE_OUTSIDE_SCRIPT,
      severity: 'error',
      message: `Lifecycle hook '${callee.name}' must be called at the top level of <script>, not inside a function.`,
      loc: locFromNode(path.node),
      hint: 'Move the lifecycle call to <script> Program top level. Lifecycle hooks register effects at component-setup time.',
    });
    return;
  }
  // Quick plan 260515-u2b: argument-shape validation for `$watch`. Both args
  // MUST be ArrowFunctionExpression | FunctionExpression. Malformed calls
  // emit ROZ109 (warning) and are skipped by the collector — execution
  // continues so we still catch other issues in the rest of <script>.
  if (callee.name === '$watch') {
    const args = path.node.arguments;
    let bad: string | null = null;
    if (args.length === 0) {
      bad = '$watch requires (getterFn, callbackFn); skipping malformed call.';
    } else if (args.length === 1) {
      bad = '$watch requires (getterFn, callbackFn); missing callback argument.';
    } else {
      const getter = args[0];
      const callback = args[1];
      const isFn = (n: t.Node | undefined): boolean =>
        !!n && (t.isArrowFunctionExpression(n) || t.isFunctionExpression(n));
      if (!isFn(getter as t.Node | undefined)) {
        bad = '$watch first argument must be an arrow or function expression (the getter).';
      } else if (!isFn(callback as t.Node | undefined)) {
        bad = '$watch second argument must be an arrow or function expression (the callback).';
      }
    }
    if (bad) {
      ctx.diagnostics.push({
        code: RozieErrorCode.WATCH_INVALID_ARGS,
        severity: 'warning',
        message: bad,
        loc: locFromNode(path.node),
        hint: 'Use the shape `$watch(() => $props.x, () => { /* body */ })` — single-getter form only in v1.',
      });
    }
  }
}

/**
 * Walk a Babel program with the validator visitor, emitting ROZ100..ROZ106
 * diagnostics for unknown references and lifecycle siting.
 */
function traverseProgram(file: t.File, ctx: ValidatorContext): void {
  traverse(file, {
    MemberExpression(path) {
      checkMemberExpression(path.node, ctx, 0);
    },
    CallExpression(path) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee)) {
        checkLifecycleSiting(callee, path, ctx);
      }
    },
  });
}

/**
 * Walk a stand-alone Babel Expression (re-parsed from a template attribute
 * value or listener `when` string). The expression's offsets are relative
 * to the parsed-fragment start, so `baseOffset` is added to all emitted
 * diagnostic locs.
 *
 * @param expr — already-parsed Babel Expression
 * @param baseOffset — absolute byte offset where the fragment starts in the .rozie source
 */
function traverseFragmentExpression(
  expr: t.Expression,
  baseOffset: number,
  ctx: ValidatorContext,
): void {
  // Wrap in a File so @babel/traverse can walk it. ExpressionStatement
  // wrapping preserves the original Expression node with intact offsets.
  const wrapped = t.file(t.program([t.expressionStatement(expr)]));
  traverse(wrapped, {
    MemberExpression(path) {
      checkMemberExpression(path.node, ctx, baseOffset);
    },
  });
}

/**
 * Re-parse a template-attribute or listener `when` expression text and
 * walk it. Returns silently on parse failure — the parser layer already
 * emitted a diagnostic for malformed mustache / expression text (ROZ051).
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

/**
 * Listener RHS objects look like `{ when: "...", handler: someFn }`. We need
 * to walk the handler expression (any reads to magic accessors are validated)
 * AND the `when` string-literal value (re-parse + walk).
 */
function validateListenerEntry(entry: ListenerEntry, ctx: ValidatorContext): void {
  const value = entry.value;
  if (!t.isObjectExpression(value)) {
    // Validate as an arbitrary expression anyway — covers shorthand cases
    // like a bare function reference.
    traverseFragmentExpression(value, 0, ctx);
    return;
  }
  for (const member of value.properties) {
    if (!t.isObjectProperty(member)) continue;
    const keyName =
      t.isIdentifier(member.key) ? member.key.name :
      t.isStringLiteral(member.key) ? member.key.value :
      null;
    if (keyName === 'when') {
      // `when` is typically a string literal (per Dropdown.rozie shape).
      // Re-parse it to walk for unknown refs.
      if (t.isStringLiteral(member.value)) {
        // The byte offset of the string contents = StringLiteral start + 1
        // (skipping the opening quote).
        const baseOffset = (member.value.start ?? 0) + 1;
        parseAndTraverse(member.value.value, baseOffset, ctx);
      } else if (t.isExpression(member.value)) {
        traverseFragmentExpression(member.value, 0, ctx);
      }
    } else if (t.isExpression(member.value)) {
      // handler: someFn — walk the handler expression for any magic-accessor reads.
      traverseFragmentExpression(member.value, 0, ctx);
    }
  }
}

function isElement(node: TemplateNode): node is TemplateElement {
  return node.type === 'TemplateElement';
}

function isInterpolation(node: TemplateNode): node is { type: 'TemplateInterpolation'; rawExpr: string; loc: SourceLoc } {
  return node.type === 'TemplateInterpolation';
}

/**
 * Walk a TemplateAttr's expression value if the attr's kind is a known
 * expression-bearing kind (binding, directive, event with a handler
 * expression, mustache).
 */
function validateTemplateAttr(attr: TemplateAttr, ctx: ValidatorContext): void {
  if (attr.value === null || attr.valueLoc === null) return;
  // r-for has special LHS syntax (`item in items` / `(item, idx) in items`)
  // which is NOT a JS expression — skip it; rForKeyValidator handles its
  // own parsing.
  if (attr.kind === 'directive' && attr.name === 'for') return;
  // Validate binding (:foo), directive (r-if, r-model, etc.), and event
  // (@click="handler") values. Static attrs are skipped — they're plain
  // strings, not expressions.
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
    // {{ ... }} — re-parse rawExpr; baseOffset = loc.start + 2 (skipping `{{`).
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
 * Run the unknown-reference validator over the given AST. Emits ROZ100..ROZ106
 * diagnostics into `diagnostics`. NEVER throws (D-08).
 */
export function runUnknownRefValidator(
  ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  const ctx: ValidatorContext = { bindings, diagnostics };
  if (ast.script) validateScript(ast.script, ctx);
  if (ast.listeners) validateListeners(ast.listeners, ctx);
  if (ast.template) validateTemplate(ast.template, ctx);
}
