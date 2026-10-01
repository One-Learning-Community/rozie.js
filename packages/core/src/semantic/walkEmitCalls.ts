/**
 * Shared read-only walk over every `$emit(...)` call in `<template>` and
 * `<listeners>` (quick 260929-ua4).
 *
 * Two consumers use it, so they can never disagree about which calls exist:
 *   - `collectors/collectTemplateEmits.ts` adds each string-literal event name
 *     to `bindings.emits`;
 *   - `validators/emitNameValidator.ts` runs its ROZ122 / ROZ145 / ROZ209
 *     shape checks on each call.
 *
 * Visit order: `<template>` first, in DFS pre-order (an element's attributes
 * in source order, then its children), then the `<listeners>` entries in
 * source order. `<script>` is NOT walked here; each consumer handles its own
 * script traversal.
 *
 * Coverage rules:
 *   - attributes of kind `binding`, `directive` and `event` are re-parsed and
 *     walked; directive `for` is skipped (the r-for LHS is not a JS
 *     expression) and static attributes are never walked;
 *   - `{{ }}` interpolations are walked at base offset `loc.start + 2`;
 *     interpolations flagged `recovered: true` (a half-typed `{{`, REQ-V13)
 *     are skipped, exactly as `lowerTemplate` skips them (T-85-09);
 *   - each `ListenerEntry.value` is walked at base offset 0 (its offsets are
 *     already absolute).
 *
 * Expression text is parsed the same two-pass way `lowerTemplate`'s
 * `tryParseExpression` parses it: plain first, then retried with the
 * `typescript` plugin. So a TS-cast handler (`$emit('x', v as Foo)`) is seen
 * here exactly when it is lowered.
 *
 * Per D-08 collected-not-thrown: NEVER throws. Parse failures are swallowed;
 * the parser layer already reported the malformed expression.
 *
 * @experimental — shape may change before v1.0
 */

import { parseExpression } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import type {
  TemplateAttr,
  TemplateElement,
  TemplateInterpolation,
  TemplateNode,
} from '../ast/blocks/TemplateAST.js';
import type { RozieAST, SourceLoc } from '../ast/types.js';
import { locFromBabel } from '../diagnostics/locFromBabel.js';

// Default-export interop: see validators/unknownRefValidator.ts for the same pattern.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

/**
 * Called once per `$emit(...)` CallExpression. `baseOffset` is the value to
 * add to the node's `start` / `end` to get absolute byte offsets in the
 * `.rozie` source.
 */
export type EmitCallVisitor = (call: t.CallExpression, baseOffset: number) => void;

/** Mirror of `lowerTemplate.ts`'s `tryParseExpression` (Spike-012 R4 two-pass). */
function tryParseExpression(text: string): t.Expression | null {
  try {
    return parseExpression(text, { sourceType: 'module' });
  } catch {
    try {
      return parseExpression(text, { sourceType: 'module', plugins: ['typescript'] });
    } catch {
      return null;
    }
  }
}

function walkExpression(expr: t.Expression, baseOffset: number, visit: EmitCallVisitor): void {
  const wrapped = t.file(t.program([t.expressionStatement(expr)]));
  try {
    traverse(wrapped, {
      CallExpression(path) {
        const callee = path.node.callee;
        if (t.isIdentifier(callee) && callee.name === '$emit') {
          visit(path.node, baseOffset);
        }
      },
    });
  } catch {
    // D-08 — a traversal failure must never escape the semantic stage.
  }
}

function parseAndWalk(text: string, baseOffset: number, visit: EmitCallVisitor): void {
  const expr = tryParseExpression(text);
  if (expr) walkExpression(expr, baseOffset, visit);
}

function walkTemplateAttr(attr: TemplateAttr, visit: EmitCallVisitor): void {
  if (attr.value === null || attr.valueLoc === null) return;
  if (attr.kind === 'directive' && attr.name === 'for') return;
  if (attr.kind === 'binding' || attr.kind === 'directive' || attr.kind === 'event') {
    parseAndWalk(attr.value, attr.valueLoc.start, visit);
  }
}

function walkTemplateNode(node: TemplateNode, visit: EmitCallVisitor): void {
  if (node.type === 'TemplateInterpolation') {
    const interp = node as TemplateInterpolation;
    if (interp.recovered) return;
    // {{ ... }} — baseOffset = loc.start + 2 (skipping `{{`).
    parseAndWalk(interp.rawExpr, interp.loc.start + 2, visit);
    return;
  }
  if (node.type !== 'TemplateElement') return;
  const el = node as TemplateElement;
  for (const attr of el.attributes) walkTemplateAttr(attr, visit);
  for (const child of el.children) walkTemplateNode(child, visit);
}

/**
 * Call `visit(call, baseOffset)` for every `$emit(...)` CallExpression in the
 * component's `<template>` (DFS pre-order) and then its `<listeners>` entries
 * (source order). NEVER throws.
 */
export function forEachTemplateAndListenersEmitCall(ast: RozieAST, visit: EmitCallVisitor): void {
  if (ast.template) {
    for (const child of ast.template.children) walkTemplateNode(child, visit);
  }
  if (ast.listeners) {
    for (const entry of ast.listeners.entries) walkExpression(entry.value, 0, visit);
  }
}

/**
 * One `$emit('name', …)` call with a string-literal event name, located in the
 * `.rozie` source (or a spliced `.rzts`/`.rzjs` partial — `loc.filename`).
 * `argCount` excludes the event name; `hasSpread` is true when any payload
 * argument is a spread (its arity is unknowable statically).
 *
 * @experimental — added in typed-surface P1 (final fix wave M6/M7)
 */
export interface EmitCallSite {
  name: string;
  argCount: number;
  hasSpread: boolean;
  loc: SourceLoc;
}

function siteOf(call: t.CallExpression, baseOffset: number): EmitCallSite | null {
  const first = call.arguments[0];
  if (!first || !t.isStringLiteral(first)) return null;
  const rest = call.arguments.slice(1);
  const base = locFromBabel(call);
  return {
    name: first.value,
    argCount: rest.length,
    hasSpread: rest.some((a) => t.isSpreadElement(a)),
    loc: {
      start: base.start + baseOffset,
      end: base.end + baseOffset,
      ...(base.filename !== undefined ? { filename: base.filename } : {}),
    },
  };
}

/**
 * Every string-literal `$emit` call site in `<script>` (source order), then
 * `<template>` and `<listeners>` (the shared walk above). NEVER throws.
 *
 * @experimental — added in typed-surface P1 (final fix wave M6/M7)
 */
export function collectEmitCallSites(ast: RozieAST): EmitCallSite[] {
  const out: EmitCallSite[] = [];
  if (ast.script) {
    try {
      traverse(ast.script.program, {
        CallExpression(path) {
          const callee = path.node.callee;
          if (!t.isIdentifier(callee) || callee.name !== '$emit') return;
          const site = siteOf(path.node, 0);
          if (site) out.push(site);
        },
      });
    } catch {
      // D-08 — never escape the semantic stage.
    }
  }
  forEachTemplateAndListenersEmitCall(ast, (call, baseOffset) => {
    const site = siteOf(call, baseOffset);
    if (site) out.push(site);
  });
  return out;
}
