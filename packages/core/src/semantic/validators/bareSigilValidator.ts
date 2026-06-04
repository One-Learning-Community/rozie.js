/**
 * SEM (Phase 26 Plan 02) — bare whole-object sigil validator (ROZ978).
 *
 * A bare `$props` / `$data` / `$refs` / `$slots` identifier used as a
 * WHOLE-OBJECT value (not a member access) has no portable representation in
 * v1. Today the six targets diverge inconsistently — Svelte hard build-error,
 * React/Solid/Lit runtime "not defined", Angular empty render, Vue renders the
 * raw object. This validator replaces all six with ONE uniform compile error
 * plus a member-access hint, emitting no target output on failure.
 *
 * ── FLAGGED set (D-04) ───────────────────────────────────────────────────────
 *   { $props, $data, $refs, $slots } — the whole-object forms with no portable
 *   shape. `$attrs` / `$listeners` are deliberately NOT flagged: their
 *   whole-object use is legitimate attr/listener fallthrough (ROZ969–974).
 *
 * ── A bare Identifier is FLAGGED unless it is ────────────────────────────────
 *   - the `.object` or `.property` of a (Optional)MemberExpression
 *       (`$data.columns`, `$refs?.el` — member access is unaffected); OR
 *   - a non-computed `ObjectProperty` key (`{ $data: x }` — the key is not a
 *       sigil reference).
 *   A computed member/property (`obj[$data]`) or a computed object-property key
 *   (`{ [$data]: x }`) is still a bare value use → FLAGGED.
 *
 * ── SCOPE (D-05) — BROADER than refsPreMount ─────────────────────────────────
 *   Fires for any bare sigil in a TEMPLATE interpolation/attribute-binding/
 *   directive expression OR a `<script>`/`<listeners>` expression. Implemented
 *   as one shared pre-IR validator (fires once for all six targets), NOT
 *   duplicated in each target's rewriteTemplateExpression.
 *
 * ── ALWAYS-ON (D-14) ─────────────────────────────────────────────────────────
 *   Independent of the `safeInterpolation` compiler option — this is a
 *   correctness guard, not part of the wrap. The flag never disables it.
 *
 * ── Re-parse / byte-offset discipline ────────────────────────────────────────
 *   Template-expression text is re-parsed via @babel/parser.parseExpression
 *   inside a try/catch (D-08: never throws — the parser layer already diagnosed
 *   malformed mustache/expression text). Every emitted diagnostic carries an
 *   absolute byte-offset loc: re-parsed fragments add the fragment base offset
 *   (the attribute valueLoc.start, or the interpolation loc.start + 2 to skip
 *   `{{`). `<script>` / `<listeners>` nodes carry absolute offsets (baseOffset 0).
 *
 * This validator has NO bindings dependency.
 *
 * @experimental — shape may change before v1.0
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

// Default-export interop: see refsPreMountValidator.ts for the same pattern.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

/** The whole-object sigils with no portable representation (D-04). */
const BARE_SIGILS = new Set(['$props', '$data', '$refs', '$slots']);

/** Verbatim member-access hint (D-05). */
const BARE_SIGIL_HINT =
  'reference a specific member (e.g. `{{ $data.columns }}`, which now renders as JSON automatically)';

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
 * Decide whether an Identifier node at `path` is a bare whole-object sigil use.
 * Returns false when the identifier is a non-bare position (member access or an
 * object-property key) — those carry no whole-object value and must NOT flag.
 */
function isBareSigilUse(path: NodePath<t.Identifier>): boolean {
  if (!BARE_SIGILS.has(path.node.name)) return false;
  const parent = path.parent;

  // `$data.columns` / `$refs?.el` — member access is unaffected. Both the
  // `.object` and a non-computed `.property` (e.g. `obj.$data`) are exempt; a
  // COMPUTED member/property (`obj[$data]`) is a bare value use → flag.
  if (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) {
    if (parent.object === path.node) return false; // `$data.x` — object position
    if (parent.property === path.node && !parent.computed) return false; // `obj.$data`
    return true; // `obj[$data]` — computed value use → flag
  }

  // `{ $data: x }` — a non-computed ObjectProperty key is not a sigil reference.
  // `{ [$data]: x }` (computed) IS a value use → flag.
  if (
    t.isObjectProperty(parent) &&
    parent.key === path.node &&
    !parent.computed
  ) {
    return false;
  }

  return true;
}

/** Emit ROZ978 for a bare whole-object sigil at `loc`. */
function pushBareSigil(
  ctx: ValidatorContext,
  name: string,
  loc: SourceLoc,
): void {
  ctx.diagnostics.push({
    code: RozieErrorCode.BARE_OBJECT_SIGIL,
    severity: 'error',
    message: `${name} cannot be used as a whole-object value — there is no portable cross-target representation for the entire ${name} object in v1.`,
    loc,
    hint: BARE_SIGIL_HINT,
  });
}

/**
 * Walk a Babel root node (File or Program) with the Identifier visitor, emitting
 * ROZ978 for every bare whole-object sigil use. `baseOffset` shifts re-parsed-
 * fragment offsets to absolute .rozie positions (0 for `<script>`/`<listeners>`
 * program nodes, which already carry absolute offsets).
 */
function traverseRoot(
  root: t.File | t.Program,
  baseOffset: number,
  ctx: ValidatorContext,
): void {
  traverse(root, {
    Identifier(path) {
      if (isBareSigilUse(path)) {
        pushBareSigil(ctx, path.node.name, locFromNodeOffset(path.node, baseOffset));
      }
    },
  });
}

/**
 * Re-parse a template-expression fragment and flag bare sigils. Returns
 * silently on parse failure (parser layer already diagnosed it). NEVER throws.
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
  traverseRoot(wrapped, baseOffset, ctx);
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
 * Walk a TemplateAttr's expression value for any expression-bearing kind
 * (binding, directive, event). SKIP directive `for` (the r-for LHS alias clause
 * is binding syntax, not a JS expression — the iterable RHS is covered by the
 * binding/directive paths the parser splits it into upstream; a bare sigil in
 * the alias clause is impossible).
 */
function validateTemplateAttr(attr: TemplateAttr, ctx: ValidatorContext): void {
  if (attr.value === null || attr.valueLoc === null) return;
  if (attr.kind === 'directive' && attr.name === 'for') return;
  if (
    attr.kind === 'binding' ||
    attr.kind === 'directive' ||
    attr.kind === 'event'
  ) {
    parseAndFlag(attr.value, attr.valueLoc.start, ctx);
  }
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

function validateScript(script: ScriptAST, ctx: ValidatorContext): void {
  // <script> Program nodes carry absolute .rozie byte offsets (baseOffset 0).
  traverseRoot(script.program, 0, ctx);
}

function validateListenerEntry(entry: ListenerEntry, ctx: ValidatorContext): void {
  // entry.value carries ABSOLUTE byte offsets (baseOffset 0).
  const wrapped = t.file(t.program([t.expressionStatement(entry.value)]));
  traverseRoot(wrapped, 0, ctx);
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
 * Run the bare-sigil validator over the given AST. Emits ROZ978 into
 * `diagnostics` for every bare whole-object `$props`/`$data`/`$refs`/`$slots`
 * use across `<template>`, `<script>`, and `<listeners>` expressions. NEVER
 * throws (D-08). No bindings dependency. Always-on (independent of
 * `safeInterpolation`, D-14).
 */
export function runBareSigilValidator(
  ast: RozieAST,
  diagnostics: Diagnostic[],
): void {
  const ctx: ValidatorContext = { diagnostics };
  if (ast.script) validateScript(ast.script, ctx);
  if (ast.template) validateTemplate(ast.template, ctx);
  if (ast.listeners) validateListeners(ast.listeners, ctx);
}
