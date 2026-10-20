/**
 * narrowGate — Solid target, SN-1 (quick 261019-ti9).
 *
 * Decides WHEN an r-if / r-else-if branch takes the Show function-child form
 * (`<Show when={W}>{(_rozieWhenN) => BODY}</Show>`) so TypeScript narrows the
 * tested component-level value inside the branch. See emitConditional.ts for the
 * lowering; this module is the pure classification + IR scan.
 *
 * A branch is GATED when all of these hold:
 *   (2) its test is a recognised shape — bare truthiness `E`, `!!E`, or a
 *       `!=` / `!==` comparison against `null` / `undefined` in either operand
 *       order;
 *   (3) `E` is a component-state read: `$props.p` / `$model.p` / `$data.d`, or a
 *       `$computed` name, optionally followed by a non-computed, non-optional
 *       property chain, with a `$computed` root not shadowed by an enclosing loop
 *       alias, slot scope param or keyless-For value binding;
 *   (4) the branch body re-reads `E` (same dotted path) in a position that NEEDS
 *       the narrowing: the object of a member access, the callee of a call, a call
 *       / `new` argument, a `<slot>` arg value, or a `:prop` binding on a
 *       component / self host.
 * Interpolations, HTML-host attribute bindings, logical / conditional /
 * comparison operands and `E?.x` never need narrowing and do not count. Event
 * handlers, listener spreads, two-way / `r-model` bindings and keynav plans never
 * count (they are never substituted), and neither does anything inside a function
 * expression (a callback can outlive the branch, where the narrowed accessor
 * would throw) or inside a portal slot fill body.
 *
 * Rule (1) — the EB-2 path wins for chains that read a raw keyless-For alias — is
 * enforced by the caller (emitConditional takes the EB-2 path before any gate).
 */
import type * as t from '@babel/types';
import type { IRComponent, IRTemplateNode as TemplateNode, TemplateElementIR } from '@rozie/core';
import { narrowPathOf } from '../rewrite/rewriteTemplateExpression.js';
import type { EmitNodeCtx } from './emitTemplateNode.js';

/** AST keys that carry positions / comments, never sub-expressions. */
const SKIP_AST_KEYS: ReadonlySet<string> = new Set([
  'loc',
  'start',
  'end',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

/** Function-like nodes: their bodies run later, so reads inside never count / substitute. */
const FUNCTION_TYPES: ReadonlySet<string> = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
]);

export interface NarrowGate {
  /** Normalized dotted component-state path (`$props.label`, `sel.child`). */
  path: string;
  /** The tested value `E`. */
  value: t.Expression;
  /** True for a `!=` / `!==` null-comparison gate: `when` is a `{ value }` box. */
  boxed: boolean;
  /** Boxed gates only: the source operator (`!=` | `!==`). */
  operator?: '!=' | '!==';
  /** Boxed gates only: the source nullish literal (`null` | `undefined`). */
  nullish?: 'null' | 'undefined';
}

function isNullishLiteral(n: t.Node): 'null' | 'undefined' | null {
  if (n.type === 'NullLiteral') return 'null';
  if (n.type === 'Identifier' && n.name === 'undefined') return 'undefined';
  return null;
}

/** Classify a branch test into a gate candidate (path not yet validated). */
export function classifyTest(test: t.Expression): Omit<NarrowGate, 'path'> | null {
  // `!!E`
  if (
    test.type === 'UnaryExpression' &&
    test.operator === '!' &&
    test.argument.type === 'UnaryExpression' &&
    test.argument.operator === '!'
  ) {
    return { value: test.argument.argument, boxed: false };
  }
  // `E != null`, `E !== undefined`, `null != E`, …
  if (test.type === 'BinaryExpression' && (test.operator === '!=' || test.operator === '!==')) {
    const right = isNullishLiteral(test.right);
    if (right !== null) {
      if (test.left.type === 'PrivateName') return null;
      return { value: test.left, boxed: true, operator: test.operator, nullish: right };
    }
    const left = isNullishLiteral(test.left);
    if (left !== null) {
      return { value: test.right, boxed: true, operator: test.operator, nullish: left };
    }
    return null;
  }
  // Bare truthiness `E` (anything else — `a && b`, `x === 1`, a call — is rejected by
  // the component-state-path check that follows).
  return { value: test, boxed: false };
}

/** `$model.p` → `$props.p`; everything else unchanged. */
function normalizePath(p: string): string {
  return p.startsWith('$model.') ? `$props.${p.slice('$model.'.length)}` : p;
}

/**
 * Rule (3): the normalized component-state path of `value`, or null when it is
 * not a component-state read (or its `$computed` root is shadowed).
 */
export function componentStatePath(
  value: t.Expression,
  ir: IRComponent,
  ctx: EmitNodeCtx,
): string | null {
  const raw = narrowPathOf(value);
  if (raw === null) return null;
  const path = normalizePath(raw);
  const segs = path.split('.');
  const root = segs[0]!;
  if (root === '$props' || root === '$model') {
    if (segs.length < 2) return null;
    const prop = ir.props.find((p) => p.name === segs[1]);
    return prop === undefined ? null : path;
  }
  if (root === '$data') {
    if (segs.length < 2) return null;
    return ir.state.some((s) => s.name === segs[1]) ? path : null;
  }
  if (ir.computed.some((c) => c.name === root)) {
    if (
      ctx.loopValueBindings?.has(root) ||
      ctx.invokeAccessors?.has(root) ||
      ctx.scopeAccessorParams?.has(root)
    ) {
      return null;
    }
    return path;
  }
  return null;
}

/** Plan the gate for one branch test, or null when the branch stays a plain Show. */
export function planNarrowGate(
  test: t.Expression,
  body: readonly TemplateNode[],
  ir: IRComponent,
  ctx: EmitNodeCtx,
): NarrowGate | null {
  const cand = classifyTest(test);
  if (cand === null) return null;
  const path = componentStatePath(cand.value, ir, ctx);
  if (path === null) return null;
  if (!bodyNeedsNarrowing(body, path)) return null;
  return { path, ...cand };
}

// ---------------------------------------------------------------------------
// Rule (4): does the branch body re-read `path` where narrowing matters?
// ---------------------------------------------------------------------------

/** True when `node` is a read of `path` (a Member/Identifier chain, `$model` normalized). */
function readsPath(node: unknown, path: string): boolean {
  if (node === null || typeof node !== 'object') return false;
  const n = node as t.Node;
  if (n.type !== 'MemberExpression' && n.type !== 'Identifier') return false;
  const p = narrowPathOf(n);
  return p !== null && normalizePath(p) === path;
}

/**
 * Walk one Babel expression for a read of `path` in a needs-narrowing position.
 * `topPos` marks the whole expression as such a position (a slot arg value, or a
 * `:prop` binding on a component host).
 */
function exprNeedsNarrowing(expr: unknown, path: string, topPos: boolean): boolean {
  const walk = (
    value: unknown,
    parent: Record<string, unknown> | null,
    key: string | null,
  ): boolean => {
    if (Array.isArray(value)) return value.some((v) => walk(v, parent, key));
    if (value === null || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    const type = obj['type'];
    if (typeof type === 'string' && FUNCTION_TYPES.has(type)) return false;
    if (readsPath(obj, path)) {
      if (parent === null) return topPos;
      const ptype = parent['type'];
      if (ptype === 'MemberExpression' && key === 'object') return true;
      if (ptype === 'OptionalMemberExpression' && key === 'object' && parent['optional'] !== true) {
        return true;
      }
      if (
        (ptype === 'CallExpression' || ptype === 'OptionalCallExpression' || ptype === 'NewExpression') &&
        (key === 'callee' || key === 'arguments')
      ) {
        return true;
      }
      return false;
    }
    return Object.entries(obj).some(([k, v]) => !SKIP_AST_KEYS.has(k) && walk(v, obj, k));
  };
  return walk(expr, null, null);
}

function elementNeedsNarrowing(el: TemplateElementIR, path: string): boolean {
  const isComp = el.tagKind === 'component' || el.tagKind === 'self';
  for (const a of el.attributes) {
    if (a.kind === 'twoWayBinding') continue;
    if (a.kind === 'binding') {
      if (a.name === 'r-model' || a.name.startsWith('r-model:')) continue;
      if (exprNeedsNarrowing(a.expression, path, isComp)) return true;
    } else if (a.kind === 'spreadBinding') {
      if (exprNeedsNarrowing(a.expression, path, false)) return true;
    } else if (a.kind === 'interpolated') {
      for (const seg of a.segments) {
        if (seg.kind === 'binding' && exprNeedsNarrowing(seg.expression, path, false)) return true;
      }
    }
  }
  // `events` / `listenerSpreads` / `keynavRoot` / `keynavItem` are never substituted.
  if (el.remountKeyExpression && exprNeedsNarrowing(el.remountKeyExpression, path, false)) return true;
  if (el.portalTo && exprNeedsNarrowing(el.portalTo.expression, path, false)) return true;
  if (bodyNeedsNarrowing(el.children, path)) return true;
  for (const f of el.slotFillers ?? []) {
    if (f.isPortal === true) continue;
    if (f.isDynamic && f.dynamicNameExpr && exprNeedsNarrowing(f.dynamicNameExpr, path, false)) {
      return true;
    }
    if (!fillShadowsRoot(f.params.map((p) => p.bindAs ?? p.name), path)) {
      if (bodyNeedsNarrowing(f.body, path)) return true;
    }
  }
  return false;
}

/** Only a `$computed`-rooted path (no sigil) can be shadowed by a binding name. */
function fillShadowsRoot(names: readonly string[], path: string): boolean {
  const root = path.split('.')[0]!;
  return names.includes(root);
}

/** Rule (4) over a node list. */
export function bodyNeedsNarrowing(nodes: readonly TemplateNode[], path: string): boolean {
  for (const node of nodes) {
    switch (node.type) {
      case 'TemplateStaticText':
        break;
      case 'TemplateInterpolation':
        if (exprNeedsNarrowing(node.expression, path, false)) return true;
        break;
      case 'TemplateFragment':
        if (bodyNeedsNarrowing(node.children, path)) return true;
        break;
      case 'TemplateElement':
        if (elementNeedsNarrowing(node, path)) return true;
        break;
      case 'TemplateSlotInvocation':
        if (node.isPortal === true) break;
        for (const a of node.args) {
          if (exprNeedsNarrowing(a.expression, path, true)) return true;
        }
        if (node.dynamicNameExpr && exprNeedsNarrowing(node.dynamicNameExpr, path, false)) return true;
        if (bodyNeedsNarrowing(node.fallback, path)) return true;
        break;
      case 'TemplateConditional':
      case 'TemplateMatch': {
        if (node.type === 'TemplateMatch') {
          if (exprNeedsNarrowing(node.discriminant, path, false)) return true;
          if (node.hostElement && elementNeedsNarrowing(node.hostElement, path)) return true;
        }
        for (const br of node.branches) {
          if (br.test && exprNeedsNarrowing(br.test, path, false)) return true;
          if (bodyNeedsNarrowing(br.body, path)) return true;
        }
        break;
      }
      case 'TemplateLoop': {
        if (exprNeedsNarrowing(node.iterableExpression, path, false)) return true;
        // The loop alias / index re-binds a `$computed` root for key + body.
        if (fillShadowsRoot([node.itemAlias, ...(node.indexAlias ? [node.indexAlias] : [])], path)) {
          break;
        }
        if (node.keyExpression && exprNeedsNarrowing(node.keyExpression, path, false)) return true;
        if (bodyNeedsNarrowing(node.body, path)) return true;
        break;
      }
      default: {
        const _exhaustive: never = node;
        void _exhaustive;
      }
    }
  }
  return false;
}
