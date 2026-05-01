/**
 * buildReactiveDepGraph — coordinator that visits every reactive expression
 * in a parsed RozieAST and produces a ReactiveDepGraph keyed by stable
 * IRNodeId.
 *
 * IRNodeId scheme (deterministic — Plan 05 IR lowering reuses these ids):
 *   listener.{N}.when         — N is index in ast.listeners.entries
 *   listener.{N}.handler
 *   computed.{name}           — by computed name from BindingsTable
 *   lifecycle.{N}.setup       — N is index in BindingsTable.lifecycle
 *   template.attr.{path}      — `path` is a hierarchical id (e.g., '/div-0/li-0/:disabled')
 *   template.interp.{path}
 *
 * Per D-08 collected-not-thrown: NEVER throws. Parse failures on template-
 * attribute expressions silently produce empty dep sets (the parser layer
 * already emitted the parse diagnostic — ROZ051).
 *
 * @experimental — shape may change before v1.0
 */
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import type { RozieAST } from '../ast/types.js';
import type { BindingsTable } from '../semantic/types.js';
import type { ListenerEntry } from '../ast/blocks/ListenersAST.js';
import type {
  TemplateAST,
  TemplateNode,
  TemplateAttr,
} from '../ast/blocks/TemplateAST.js';
import { computeExpressionDeps } from './computeDeps.js';
import type { SignalRef } from './signalRef.js';
import {
  type IRNodeId,
  type ReactiveDepGraph,
  ReactiveDepGraphImpl,
} from './ReactiveDepGraph.js';

/**
 * Visit every reactive expression in a parsed RozieAST and produce a
 * ReactiveDepGraph keyed by stable IRNodeId. Plan 05 IR lowering reuses these
 * ids; Phase 4 React emitter reads `forNode(id)` to populate `useEffect` dep
 * arrays.
 *
 * @param ast - the parsed RozieAST
 * @param bindings - the BindingsTable from `collectAllDeclarations(ast)`
 * @returns a ReactiveDepGraph (read-only API; all entries deterministic)
 */
export function buildReactiveDepGraph(
  ast: RozieAST,
  bindings: BindingsTable,
): ReactiveDepGraph {
  const map = new Map<IRNodeId, SignalRef[]>();

  // <listeners> — each entry's RHS is an ObjectExpression with `when` (string
  // literal containing a JS expression) and `handler` (Expression).
  if (ast.listeners) {
    ast.listeners.entries.forEach((entry, idx) => {
      const whenExpr = extractObjectPropertyExpression(entry, 'when');
      const handlerExpr = extractObjectPropertyExpression(entry, 'handler');
      map.set(`listener.${idx}.when`, computeExpressionDeps(whenExpr, bindings));
      map.set(`listener.${idx}.handler`, computeExpressionDeps(handlerExpr, bindings));
    });
  }

  // <script> — $computed callbacks; lifecycle setup bodies (cleanup pairing
  // happens in Plan 05 lowerScript; we treat the raw callback as the setup
  // expression here — its body still surfaces every reactive read needed for
  // the React emitter's useEffect dep array).
  for (const [name, computedEntry] of bindings.computeds) {
    map.set(`computed.${name}`, computeExpressionDeps(computedEntry.callback.body, bindings));
  }
  bindings.lifecycle.forEach((hook, idx) => {
    map.set(`lifecycle.${idx}.setup`, computeExpressionDeps(hook.callback, bindings));
  });

  // <template> — attribute bindings + interpolations.
  if (ast.template) {
    walkTemplateForDeps(ast.template, bindings, map);
  }

  return new ReactiveDepGraphImpl(map);
}

/**
 * Extract a named property's expression from a ListenerEntry's RHS object.
 *
 * The Phase 1 ListenerEntry.value is a Babel `Expression` — typically an
 * ObjectExpression `{ when: '...', handler: ref }`. The `when` property is a
 * StringLiteral whose contents are themselves a JS expression — we re-parse it
 * via @babel/parser.parseExpression. The `handler` property is already an
 * Expression (Identifier or ArrowFunction); we return it as-is.
 *
 * Returns null if the RHS is not an ObjectExpression, the named property is
 * absent, or the StringLiteral re-parse fails (D-08 — diagnostic already
 * emitted by parseListeners).
 */
function extractObjectPropertyExpression(
  entry: ListenerEntry,
  key: string,
): t.Expression | null {
  const obj = entry.value;
  if (!t.isObjectExpression(obj)) return null;
  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const propKey = prop.key;
    const keyName =
      t.isIdentifier(propKey) ? propKey.name :
      t.isStringLiteral(propKey) ? propKey.value :
      null;
    if (keyName !== key) continue;

    const value = prop.value;
    // when: '$props.open && $props.foo' — re-parse the StringLiteral contents.
    if (t.isStringLiteral(value)) {
      try {
        return parseExpression(value.value, { sourceType: 'module' });
      } catch {
        return null;
      }
    }
    // handler: someFn / handler: () => ... — value is already a Babel Expression.
    if (t.isExpression(value)) return value;
  }
  return null;
}

/**
 * Recursively walk a TemplateAST, registering dep sets for every binding/
 * directive/event/interpolation. Static attributes are NOT walked — they
 * carry plain strings, not expressions.
 *
 * Per D-08: parse failures on attribute values silently produce empty deps;
 * parseTemplate already emitted ROZ051 for the same malformed expression.
 */
function walkTemplateForDeps(
  template: TemplateAST,
  bindings: BindingsTable,
  map: Map<IRNodeId, SignalRef[]>,
): void {
  const visit = (nodes: readonly TemplateNode[], pathPrefix: string): void => {
    nodes.forEach((node, idx) => {
      if (node.type === 'TemplateElement') {
        const elPath = `${pathPrefix}/${node.tagName}-${idx}`;
        for (const attr of node.attributes) {
          processTemplateAttr(attr, elPath, bindings, map);
        }
        visit(node.children, elPath);
      } else if (node.type === 'TemplateInterpolation') {
        const id: IRNodeId = `template.interp.${pathPrefix}/${idx}`;
        map.set(id, parseAndCompute(node.rawExpr, bindings));
      }
    });
  };
  visit(template.children, '');
}

/**
 * Compute deps for a single TemplateAttr.
 *
 * - kind 'static': skip (no expression).
 * - kind 'binding': `:foo="$props.x"` — parse value, compute deps.
 * - kind 'directive': `r-if="..."` / `r-for="item in $props.items"` /
 *   `r-model="$data.x"`. r-for's LHS isn't a JS expression; we extract the
 *   RHS (after `in`) and parse THAT.
 * - kind 'event': `@click="handler"` — parse value, compute deps. Modifier
 *   chain text doesn't carry expressions (Plan 04 walks it separately).
 */
function processTemplateAttr(
  attr: TemplateAttr,
  elPath: string,
  bindings: BindingsTable,
  map: Map<IRNodeId, SignalRef[]>,
): void {
  if (attr.kind === 'static') return;
  if (attr.value === null) return; // boolean attribute (e.g., `disabled`)

  let exprText = attr.value;

  // r-for has a special "item in $props.items" LHS-in-RHS shape — extract the
  // iterable RHS so we can compute deps on that. Keys against r-for itself are
  // namespaced as template.attr.{elPath}/r-for to remain unique even if
  // sibling attributes share names.
  if (attr.kind === 'directive' && attr.name === 'for') {
    exprText = extractRForIterable(attr.value);
  }

  const id: IRNodeId = `template.attr.${elPath}/${attr.rawName}`;
  map.set(id, parseAndCompute(exprText, bindings));
}

/**
 * Extract the iterable RHS from an r-for attribute value. Examples:
 *   "item in $props.items"          → "$props.items"
 *   "(item, idx) in $props.items"   → "$props.items"
 *   "item of $data.list"            → "$data.list"
 *
 * If the LHS-in-RHS shape isn't recognized, returns the original text — the
 * caller's parseExpression will then fail and we return [] (D-08).
 *
 * Linear-time anchored regex (T-2-02-01-style ReDoS-safe).
 */
function extractRForIterable(rawValue: string): string {
  // Look for ' in ' or ' of ' separator — match the FIRST occurrence at the
  // top level. We don't try to be clever about nested parens; the canonical
  // r-for shapes are simple LHS shapes.
  const inMatch = rawValue.match(/\s+in\s+(.+)$/);
  if (inMatch?.[1]) return inMatch[1].trim();
  const ofMatch = rawValue.match(/\s+of\s+(.+)$/);
  if (ofMatch?.[1]) return ofMatch[1].trim();
  return rawValue;
}

/**
 * Parse `text` as a JS expression and compute its deps. On parse failure
 * (D-08), returns []. Fronts the common pattern used in three places.
 */
function parseAndCompute(text: string, bindings: BindingsTable): SignalRef[] {
  let expr: t.Expression | null = null;
  try {
    expr = parseExpression(text, { sourceType: 'module' });
  } catch {
    return [];
  }
  return computeExpressionDeps(expr, bindings);
}
