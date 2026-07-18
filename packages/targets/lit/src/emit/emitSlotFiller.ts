/**
 * emitSlotFiller — Phase 07.2 Plan 03 Task 2 (Lit target).
 *
 * Consumer-side mirror of emitSlot (producer side). Where the producer emits
 * `<slot name="header" data-rozie-params=…></slot>` and the consumer of the
 * producer needs to project content into that slot, this module emits the
 * matching child elements with `slot="<name>"` attribute (shadow-DOM native
 * projection).
 *
 * Lit's shadow-DOM model is the most divergent of the 6 targets (RESEARCH
 * §"Pattern 3.e Lit"): there is NO prop-assignment / render-function
 * equivalent of Vue's scoped slots. Content projection happens via the
 * browser's native `<slot>` element + matching `slot="<name>"` attribute on
 * child elements. The scoped-params (slot-args) story is the documented
 * compromise — the producer encodes args as JSON in `data-rozie-params` and
 * the consumer reads them via `observeRozieSlotCtx` from `@rozie/runtime-lit`.
 *
 * This module returns a 3-tuple per filler:
 *
 *   - `childTemplate`: lit-html string the consumer emits inside the
 *     component tag. For named fills: an element with `slot="<name>"`
 *     attribute. For default-shorthand: bare children (no slot=).
 *   - `firstUpdatedLines`: lines spliced into the consumer's `firstUpdated()`
 *     to wire `observeRozieSlotCtx` for scoped fills. Empty for non-scoped.
 *   - `classFields`: class-field declarations storing the captured
 *     ctx object (e.g. `private _headerCtx?: { close: () => void }`).
 *     Empty for non-scoped fills.
 *
 * Output shapes:
 *
 *   { name: 'header', params: [] }
 *     → childTemplate: `<div slot="header">…body…</div>`
 *       (or single-root passthrough — `<h2 slot="header">Custom Header</h2>`)
 *     → firstUpdatedLines: [] (no scoped wiring)
 *     → classFields: []
 *
 *   { name: 'header', params: [{name:'close'}] }
 *     → childTemplate: `<div slot="header">…body that references this._headerCtx…</div>`
 *     → firstUpdatedLines: ['observeRozieSlotCtx(this.shadowRoot!.querySelector("slot[name=\"header\"]"), (c) => { this._headerCtx = c; this.requestUpdate(); });']
 *     → classFields: ['private _headerCtx?: { close: unknown };']
 *
 *   { name: '', params: [] }   (default-shorthand)
 *     → childTemplate: `…body…` (no wrapper; default-slot natively projects)
 *     → firstUpdatedLines: []
 *     → classFields: []
 *
 * Single-root passthrough: when the fill body resolves to a single
 * TemplateElement child, attach `slot="<name>"` directly to it instead of
 * adding a synthetic `<div>` wrapper. Keeps consumer-authored markup
 * structurally faithful.
 *
 * Multi-root spread (Phase 07.3.1 D-LIT-18): when the fill body has
 * multiple top-level elements separated only by whitespace, inject
 * `slot="<name>"` into each opening tag instead of div-wrapping. The
 * producer's named slot then receives each child directly, preserving
 * consumer DOM structure.
 *
 * Mixed bodies (top-level text, top-level `${…}` interpolations, top-level
 * comments, or any element already carrying `slot=`) fall back to the
 * `<div slot="…">` wrapper — those cases are structurally ambiguous and
 * the wrap keeps semantics conservative.
 *
 * Phase 07.1 self-reference pattern: SlotFillerDecl + IRComponent + the IR
 * TemplateNode alias come via the `@rozie/core` package specifier, NOT the
 * deep `../../../core/src/ir/types.js` relative path that would reintroduce
 * the cross-package `.d.ts` identity bug Phase 07.1 fixed.
 *
 * @experimental — shape may change before v1.0
 */
import type {
  SlotFillerDecl,
  IRComponent,
  IRTemplateNode as TemplateNode,
} from '@rozie/core';
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { slotScopeTypeObject } from './slotScopeParamType.js';
// @babel/traverse ships CJS default-export; unwrap for ESM consumers.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

/**
 * Per-filler emission tuple. See module docs.
 *
 * Phase 07.3.1 Blocker #3 (D-03) — adds `updatedBodyLines` (re-attempt
 * fragment for the producer-upgrade race) and `disconnectResetLines`
 * (per-filler `_slotCtxWired_<name>` flag reset on disconnect, Landmine
 * 2). Empty for non-scoped fills.
 */
export interface LitFillerEmission {
  childTemplate: string;
  firstUpdatedLines: string[];
  classFields: string[];
  /**
   * Phase 07.3.1 Blocker #3 (D-03) — re-attempt wiring inside `updated()`
   * while the per-filler `_slotCtxWired_<name>` flag is false. Closes
   * Race B (producer-upgrade vs consumer-firstUpdated ordering).
   */
  updatedBodyLines: string[];
  /**
   * Phase 07.3.1 Blocker #3 (D-03) — per-filler flag reset lines emitted
   * into `disconnectedCallback()` after `_disconnectCleanups` drain.
   * Required by Landmine 2 so a reconnect cycle re-attempts wiring
   * (without this, a re-mounted consumer would skip retry forever).
   */
  disconnectResetLines: string[];
  /**
   * Phase 07.5 — when populated, the parent component's open tag splices
   * `${propertyAttr}` before the final `>`; emitTemplate.emitElement handles
   * the splice. Mutually exclusive with `childTemplate` — when propertyAttr
   * is set, childTemplate is empty and the light-DOM `<element slot="X">`
   * path is bypassed in favor of a `.<slotName>=${(scope) => html\`...\`}`
   * function-prop property assignment on the producer's open tag.
   *
   * Triggered when `filler.isPortal === true` OR (`filler.params.length > 0`
   * AND the producer declares scope params i.e. `filler.producerSlotParamCount > 0`).
   * Paramless static slots continue to use the light-DOM `childTemplate` path
   * (SC2 no-regression invariant).
   */
  propertyAttr?: string;
}

/**
 * Context shape this module needs. Mirrors the producer-side EmitSlotCtx
 * pattern — accepts a recursive emitChildren callback so we don't have to
 * import emitNode here (which would create a static cycle with emitTemplate
 * that imports this module).
 */
export interface EmitSlotFillerCtx {
  ir: IRComponent;
  /** Recursive call back into emitNode for fill bodies. */
  emitChildren: (children: TemplateNode[]) => string;
}

/**
 * Pre-transform: walk every Expression inside the SlotFillerDecl.body and
 * rewrite bare Identifier references to scoped-fill params into
 * `this.<ctxField>?.<slotKey>` MemberExpressions. The recursive emit then
 * passes those MemberExpressions through verbatim — rewriteTemplateExpression
 * has no special handling for `this.foo.bar`, so no double-rewrite.
 *
 * Param map shape (quick 260526-ljo): `Map<localBinding, slotKey>`. For the
 * common shorthand `{ key }` form, localBinding === slotKey === `key`. For
 * the rename form `{ key: localName }`, localBinding === `localName` and
 * slotKey === `key`. The identifier scan matches on `localBinding` (the name
 * the body actually references) and rewrites to `this.<ctxField>?.<slotKey>`
 * (the field under which the ctx object stores the value).
 *
 * Mutates the IR nodes in place — callers MUST clone the body subtree first
 * if they need to preserve the original (the consumer-side emit consumes the
 * body exactly once per filler, so in-place mutation is safe here).
 *
 * Skip-conditions (mirrors rewriteTemplateExpression's Identifier visitor):
 *   - identifier is a MemberExpression property key (non-computed)
 *   - identifier is an ObjectProperty key (non-computed)
 *   - identifier is a function parameter binding
 *
 * The traversal handles every TemplateNode shape that carries Expressions:
 *   - TemplateElement: attributes (binding expressions), events (handler
 *     expressions)
 *   - TemplateInterpolation: expression
 *   - TemplateConditional: branch test expressions + recurse body
 *   - TemplateLoop: iterableExpression + recurse body
 *   - TemplateSlotInvocation: args expressions + recurse fallback
 *   - TemplateFragment: recurse children
 *   - TemplateStaticText: no expressions
 */
function rewriteScopedParamRefs(
  nodes: TemplateNode[],
  ctxField: string,
  paramMap: ReadonlyMap<string, string>,
): void {
  if (paramMap.size === 0) return;
  for (const node of nodes) {
    rewriteScopedParamRefsInNode(node, ctxField, paramMap);
  }
}

function rewriteScopedParamRefsInNode(
  node: TemplateNode,
  ctxField: string,
  params: ReadonlyMap<string, string>,
): void {
  switch (node.type) {
    case 'TemplateStaticText':
      return;
    case 'TemplateInterpolation':
      node.expression = rewriteExpr(node.expression, ctxField, params);
      return;
    case 'TemplateFragment':
      for (const c of node.children) rewriteScopedParamRefsInNode(c, ctxField, params);
      return;
    case 'TemplateConditional':
      for (const b of node.branches) {
        if (b.test) b.test = rewriteExpr(b.test, ctxField, params);
        for (const c of b.body) rewriteScopedParamRefsInNode(c, ctxField, params);
      }
      return;
    case 'TemplateMatch':
      // Phase 11 r-match — see the sibling case in
      // `rewriteScopedParamRefsInNodeToScope` for the rationale.
      node.discriminant = rewriteExpr(node.discriminant, ctxField, params);
      for (const b of node.branches) {
        if (b.test) b.test = rewriteExpr(b.test, ctxField, params);
        for (const c of b.body) rewriteScopedParamRefsInNode(c, ctxField, params);
      }
      if (node.hostElement) {
        rewriteScopedParamRefsInNode(node.hostElement, ctxField, params);
      }
      return;
    case 'TemplateLoop':
      node.iterableExpression = rewriteExpr(node.iterableExpression, ctxField, params);
      if (node.keyExpression) node.keyExpression = rewriteExpr(node.keyExpression, ctxField, params);
      for (const c of node.body) rewriteScopedParamRefsInNode(c, ctxField, params);
      return;
    case 'TemplateSlotInvocation':
      for (const a of node.args) a.expression = rewriteExpr(a.expression, ctxField, params);
      for (const c of node.fallback) rewriteScopedParamRefsInNode(c, ctxField, params);
      return;
    case 'TemplateElement':
      for (const a of node.attributes) {
        if (a.kind === 'binding') {
          a.expression = rewriteExpr(a.expression, ctxField, params);
        } else if (a.kind === 'interpolated') {
          for (const seg of a.segments) {
            if (seg.kind === 'binding') {
              seg.expression = rewriteExpr(seg.expression, ctxField, params);
            }
          }
        }
      }
      for (const ev of node.events) {
        if (ev !== null && ev !== undefined) {
          ev.handler = rewriteExpr(ev.handler, ctxField, params);
        }
      }
      for (const c of node.children) rewriteScopedParamRefsInNode(c, ctxField, params);
      return;
  }
}

/**
 * Walk one Expression and rewrite Identifier-matches-param into
 * `this.<ctxField>?.<slotKey>`. Returns the (possibly-replaced) expression.
 * Handles the root-identifier case explicitly because @babel/traverse's
 * `replaceWith` mutates the wrapper tree but doesn't propagate back to
 * the caller's reference.
 *
 * `params` is `Map<localBinding, slotKey>`. The matcher checks
 * `params.has(name)` against the LOCAL binding (what the body wrote);
 * the rewrite target uses the SLOT KEY (what the ctx field stores).
 * For shorthand fills, local === slotKey; for rename fills, they differ.
 */
function rewriteExpr(
  expr: t.Expression,
  ctxField: string,
  params: ReadonlyMap<string, string>,
): t.Expression {
  // Root-identifier shortcut: when the entire expression is a bare
  // Identifier matching a param, return the MemberExpression directly.
  if (t.isIdentifier(expr) && params.has(expr.name)) {
    return t.optionalMemberExpression(
      t.memberExpression(t.thisExpression(), t.identifier(ctxField)),
      t.identifier(params.get(expr.name)!),
      false,
      true,
    );
  }
  // Nested-identifier path: traverse and replace in-place. Replacements
  // happen on the wrapper's tree (e.g., `foo(close)` → `foo(this._ctx?.close)`);
  // the caller's reference still points to the same `CallExpression`, so
  // the mutation is visible after traverse returns.
  const wrapper = t.file(t.program([t.expressionStatement(expr)]));
  traverse(wrapper, {
    Identifier(path) {
      const name = path.node.name;
      if (!params.has(name)) return;
      const parentPath = path.parentPath;
      if (parentPath) {
        if (
          parentPath.isMemberExpression() &&
          parentPath.node.property === path.node &&
          !parentPath.node.computed
        )
          return;
        if (
          parentPath.isOptionalMemberExpression() &&
          parentPath.node.property === path.node &&
          !parentPath.node.computed
        )
          return;
        if (
          parentPath.isObjectProperty() &&
          parentPath.node.key === path.node &&
          !parentPath.node.computed
        )
          return;
        if (
          (parentPath.isFunctionExpression() ||
            parentPath.isArrowFunctionExpression() ||
            parentPath.isFunctionDeclaration()) &&
          (parentPath.node as t.Function).params.some((p) => p === path.node)
        ) {
          return;
        }
      }
      path.replaceWith(
        t.optionalMemberExpression(
          t.memberExpression(t.thisExpression(), t.identifier(ctxField)),
          t.identifier(params.get(name)!),
          false,
          true,
        ),
      );
      path.skip();
    },
  });
  return expr;
}

/**
 * Phase 07.5 — sibling of `rewriteScopedParamRefs` but the rewriting target
 * is `scope.<slotKey>` (plain MemberExpression on a `scope` identifier) instead
 * of `this.<ctxField>?.<slotKey>` (OptionalMemberExpression). Used by the new
 * function-prop emit path where the consumer's destructured fill body runs
 * inside an arrow function whose first parameter (`scope`) is guaranteed
 * defined by the consumer's destructure — so no optional chaining is needed.
 *
 * `params` is `Map<localBinding, slotKey>` (quick 260526-ljo). Matcher
 * compares against local binding (body wrote it); rewrite target uses slot
 * key (producer supplied `scope[slotKey]`).
 *
 * Same skip-conditions as the original helper (MemberExpression property keys,
 * ObjectProperty keys, function param bindings).
 */
function rewriteScopedParamRefsToScope(
  nodes: TemplateNode[],
  paramMap: ReadonlyMap<string, string>,
): void {
  if (paramMap.size === 0) return;
  for (const node of nodes) {
    rewriteScopedParamRefsInNodeToScope(node, paramMap);
  }
}

function rewriteScopedParamRefsInNodeToScope(
  node: TemplateNode,
  params: ReadonlyMap<string, string>,
): void {
  switch (node.type) {
    case 'TemplateStaticText':
      return;
    case 'TemplateInterpolation':
      node.expression = rewriteExprToScope(node.expression, params);
      return;
    case 'TemplateFragment':
      for (const c of node.children) rewriteScopedParamRefsInNodeToScope(c, params);
      return;
    case 'TemplateConditional':
      for (const b of node.branches) {
        if (b.test) b.test = rewriteExprToScope(b.test, params);
        for (const c of b.body) rewriteScopedParamRefsInNodeToScope(c, params);
      }
      return;
    case 'TemplateMatch':
      // Phase 11 r-match — structurally parallels TemplateConditional but
      // also carries a `discriminant` (emitted only in `hoist` mode; in
      // `inline` mode it is already folded into each branch `test`). Rewrite
      // the discriminant, every branch test + body, and the optional
      // `<div r-match>` host element so scope-param refs inside an
      // r-match-bodied slot filler reach `scope.<name>`. Without this case
      // the branch bodies keep bare param identifiers (`column`, `value`)
      // and throw ReferenceError at runtime — the whole component fails to
      // render. The switch has no `default`, so a missing case is silent.
      node.discriminant = rewriteExprToScope(node.discriminant, params);
      for (const b of node.branches) {
        if (b.test) b.test = rewriteExprToScope(b.test, params);
        for (const c of b.body) rewriteScopedParamRefsInNodeToScope(c, params);
      }
      if (node.hostElement) {
        rewriteScopedParamRefsInNodeToScope(node.hostElement, params);
      }
      return;
    case 'TemplateLoop':
      node.iterableExpression = rewriteExprToScope(node.iterableExpression, params);
      if (node.keyExpression) node.keyExpression = rewriteExprToScope(node.keyExpression, params);
      for (const c of node.body) rewriteScopedParamRefsInNodeToScope(c, params);
      return;
    case 'TemplateSlotInvocation':
      for (const a of node.args) a.expression = rewriteExprToScope(a.expression, params);
      for (const c of node.fallback) rewriteScopedParamRefsInNodeToScope(c, params);
      return;
    case 'TemplateElement':
      for (const a of node.attributes) {
        if (a.kind === 'binding') {
          a.expression = rewriteExprToScope(a.expression, params);
        } else if (a.kind === 'interpolated') {
          for (const seg of a.segments) {
            if (seg.kind === 'binding') {
              seg.expression = rewriteExprToScope(seg.expression, params);
            }
          }
        }
      }
      for (const ev of node.events) {
        if (ev !== null && ev !== undefined) {
          ev.handler = rewriteExprToScope(ev.handler, params);
        }
      }
      for (const c of node.children) rewriteScopedParamRefsInNodeToScope(c, params);
      return;
  }
}

/**
 * Walk one Expression and rewrite Identifier-matches-param into
 * `scope.<slotKey>`. Returns the (possibly-replaced) expression. Mirrors
 * rewriteExpr's structure (same skip-conditions, same root-identifier
 * shortcut, same `@babel/traverse` wrapper pattern), but the rewriting
 * target is a plain MemberExpression on a `scope` identifier rather than
 * an OptionalMemberExpression on `this.<ctxField>`.
 *
 * `params` is `Map<localBinding, slotKey>`. Matcher compares against local
 * binding (body wrote it); rewrite target uses slot key.
 */
function rewriteExprToScope(
  expr: t.Expression,
  params: ReadonlyMap<string, string>,
): t.Expression {
  if (t.isIdentifier(expr) && params.has(expr.name)) {
    return t.memberExpression(
      t.identifier('scope'),
      t.identifier(params.get(expr.name)!),
      false,
      false,
    );
  }
  const wrapper = t.file(t.program([t.expressionStatement(expr)]));
  traverse(wrapper, {
    Identifier(path) {
      const name = path.node.name;
      if (!params.has(name)) return;
      const parentPath = path.parentPath;
      if (parentPath) {
        if (
          parentPath.isMemberExpression() &&
          parentPath.node.property === path.node &&
          !parentPath.node.computed
        )
          return;
        if (
          parentPath.isOptionalMemberExpression() &&
          parentPath.node.property === path.node &&
          !parentPath.node.computed
        )
          return;
        if (
          parentPath.isObjectProperty() &&
          parentPath.node.key === path.node &&
          !parentPath.node.computed
        )
          return;
        if (
          (parentPath.isFunctionExpression() ||
            parentPath.isArrowFunctionExpression() ||
            parentPath.isFunctionDeclaration()) &&
          (parentPath.node as t.Function).params.some((p) => p === path.node)
        ) {
          return;
        }
      }
      path.replaceWith(
        t.memberExpression(
          t.identifier('scope'),
          t.identifier(params.get(name)!),
          false,
          false,
        ),
      );
      path.skip();
    },
  });
  return expr;
}

/**
 * Format ONE static-named filler (or default-shorthand) as a Lit
 * consumer-side emission tuple.
 *
 * Dynamic-name (R5) is reserved for Wave 2 — emits an empty tuple (skipped)
 * so the static-name path continues to ship clean output.
 */
export function emitSlotFiller(
  filler: SlotFillerDecl,
  ctx: EmitSlotFillerCtx,
): LitFillerEmission {
  // R5 — dynamic slot name. Per D-04 Lit row: shadow-DOM projection routes
  // child elements to the matching `<slot name="…">` based on the runtime
  // value of the child's `slot=` attribute. lit-html supports attribute
  // interpolation directly via `slot=${expr}`, so we emit the body wrapped
  // in `<div slot="${rewrittenExpr}">…</div>`. Single-root passthrough
  // (the static-name optimization) is NOT applied here because the slot
  // attribute is an interpolated binding rather than a literal — we always
  // emit a synthetic `<div>` wrapper to carry the dynamic attribute.
  //
  // Silent fallback on runtime miss (D-05) is the native shadow-DOM
  // behavior: when the slot attribute value doesn't match any of the
  // producer's `<slot name="…">` elements, the projection silently no-ops
  // and the producer's `<slot>` defaultContent renders.
  //
  // Scoped + dynamic combination is deferred: the IR pre-transform (used
  // for static-name scoped) requires a stable `_<name>Ctx` field that we
  // can't synthesise from a dynamic expression at compile time. Most
  // consumer libraries don't mix scoped + dynamic in practice; documented
  // in SUMMARY as a known limitation.
  if (filler.isDynamic) {
    if (!filler.dynamicNameExpr) {
      // ROZ946 was already emitted at lower time — emit nothing.
      return {
        childTemplate: '',
        firstUpdatedLines: [],
        classFields: [],
        updatedBodyLines: [],
        disconnectResetLines: [],
      };
    }
    const body = ctx.emitChildren(filler.body);
    const rewritten = rewriteTemplateExpression(filler.dynamicNameExpr, ctx.ir);
    // The emitted lit-html template is wrapped in `html\`…\`` by emitTemplate;
    // we emit the literal characters `${<rewritten>}` so the runtime tag
    // function interpolates the value into the `slot` attribute. Using
    // double-quotes around the binding to match Lit's idiomatic
    // `slot="${expr}"` form (as used by the wrapWithSlotAttribute helper
    // for static names).
    const childTemplate = '<div slot="${' + rewritten + '}">' + body + '</div>';
    return {
      childTemplate,
      firstUpdatedLines: [],
      classFields: [],
      updatedBodyLines: [],
      disconnectResetLines: [],
    };
  }

  // Phase 07.5 — function-prop branch: portal slots, OR scoped slots where
  // the consumer destructures producer-declared scope params. Routes through
  // a `.<slotName>=${(scope) => html\`…\`}` property assignment on the parent
  // component's open tag (instead of `<element slot="X">` light-DOM projection).
  //
  // Branch condition per ROADMAP SC1: filler.isPortal === true OR
  // (filler.params.length > 0 AND producer declares scope params i.e.
  //  filler.producerSlotParamCount > 0). The second conjunct guards against
  // consumer-side destructure on a slot the producer never declared with
  // scope params (which would have already emitted ROZ947 SCOPED_PARAM_MISMATCH
  // in threadParamTypes line 277-302; emit defensively here).
  const useFunctionPropPath =
    filler.isPortal === true ||
    (filler.params.length > 0 &&
      (filler.producerSlotParamCount ?? 0) > 0);

  if (useFunctionPropPath) {
    // Rewrite param Identifiers in body → `scope.<slotKey>` MemberExpressions
    // BEFORE rendering, so the recursive emitChildren passes them through
    // verbatim. Quick 260526-ljo: Map<localBinding, slotKey> handles rename.
    const paramMap = new Map<string, string>(
      filler.params.map((p) => [p.bindAs ?? p.name, p.name] as const),
    );
    rewriteScopedParamRefsToScope(filler.body, paramMap);

    const body = ctx.emitChildren(filler.body);

    // Scope-type TS annotation: `{ p1: any; p2: any; ... }` (or the serialized
    // TSType per param when the IR carries real paramTypes — quick 260717-uvm).
    // Uses filler.params.name (producer slot keys) — the scope object is keyed
    // by slot key, NOT consumer-local rename. threadParamTypes validates the
    // names against producer.SlotDecl.params for ROZ947.
    const scopeTypeStr =
      filler.params.length > 0
        ? slotScopeTypeObject(filler.params, filler.paramTypes)
        : 'unknown';

    // Single-parameter form: `(scope: { close: unknown }) => html\`…body refs scope.close…\``.
    // `rewriteScopedParamRefsToScope` has already rewritten body param refs
    // to `scope.<name>` MemberExpressions, so we use a bare `scope` parameter
    // (NOT a destructure pattern) to keep the body's references valid. Using
    // a destructure here would shadow `scope` and break the rewritten body.
    const paramSig = `scope: ${scopeTypeStr}`;

    // Property field name on producer: default slot ('') maps to
    // '__rozieDefaultSlot__' per the producer-side mapping in emitSlotDecl.ts
    // (WR-02 (Phase 07.5 review): double-underscore + rozie-infix to dodge
    // user-slot-name collision). Named slots use the bare slot name. Both
    // sides MUST agree — keep the mapping in lockstep.
    // Collision-gated `Slot` suffix (lockstep with producer-side emitSlotDecl /
    // portalSlotMemberName): when the producer declares a same-named prop, its
    // portal-slot @property member was suffixed with `Slot` to dodge a
    // duplicate-identifier error. The consumer must target that same member.
    // `producerPropCollision` is threaded from the producer's prop list by
    // threadParamTypes. Default slot ('') uses the sentinel and never collides.
    const propertyFieldName =
      filler.name === ''
        ? '__rozieDefaultSlot__'
        : filler.producerPropCollision === true
          ? filler.name + 'Slot'
          : filler.name;

    const propertyAttr =
      '.' + propertyFieldName + '=${(' + paramSig + ') => html`' + body + '`}';

    return {
      // IN-03 (Phase 07.5 review): the four arrays below are intentionally
      // empty — the function-prop emit path needs zero observer-callback
      // wiring (no observeRozieSlotCtx, no _<X>Ctx class field, no
      // tryWire/updated() retry, no disconnectReset). emitTemplate iterates
      // them and pushes nothing per filler; the loop is correct, the empties
      // are by design.
      childTemplate: '',
      firstUpdatedLines: [],
      classFields: [],
      updatedBodyLines: [],
      disconnectResetLines: [],
      propertyAttr,
    };
  }

  // Phase 07.2 Plan 03 — scoped-param IR pre-transform.
  // Inside a `<template #header="{ close }">…<button @click="close">×</button></template>`
  // fill body, bare `close` rewrites to `this._headerCtx?.close` so the
  // emitted lit-html template references the captured ctx field. Done as an
  // IR pre-transform (vs an opt threaded through every rewriteTemplateExpression
  // call site) so the change is isolated to this module — no per-call-site
  // plumbing through emitTemplate.ts.
  //
  // Note (Phase 07.5): with the new function-prop branch above, this path is
  // unreachable for scoped fills with destructure when the IR is fully
  // threaded (filler.producerSlotParamCount > 0). It remains as a safety net
  // for malformed/unthreaded IRs.
  if (filler.params.length > 0 && filler.name !== '') {
    const ctxField = `_${filler.name}Ctx`;
    // Map<localBinding, slotKey>. Shorthand fills: local === slotKey === name.
    // Rename fills `{ key: localName }`: local === bindAs, slotKey === name.
    const paramMap = new Map<string, string>(
      filler.params.map((p) => [p.bindAs ?? p.name, p.name] as const),
    );
    rewriteScopedParamRefs(filler.body, ctxField, paramMap);
  }

  const body = ctx.emitChildren(filler.body);

  // Default-shorthand: bare children (no slot= attribute). The producer's
  // unnamed `<slot></slot>` natively projects them.
  if (filler.name === '') {
    // Scoped default-shorthand on Lit is degenerate — Lit has no
    // ergonomic way to attach a ctx to "default-slot bare children" since
    // there's no wrapper element to mount the observer on. We emit the
    // body verbatim; consumer authors who need scoped default-fill should
    // use a wrapper element with an explicit `slot=""` attribute (Lit's
    // unnamed-slot convention). Documented edge case.
    return {
      childTemplate: body,
      firstUpdatedLines: [],
      classFields: [],
      updatedBodyLines: [],
      disconnectResetLines: [],
    };
  }

  // Named fill. Inject `slot="<name>"` on a single-root element, OR wrap
  // the body in a synthetic `<div slot="<name>">…</div>`.
  const childTemplate = wrapWithSlotAttribute(body, filler.name, filler);
  const isScoped = filler.params.length > 0;
  if (!isScoped) {
    return {
      childTemplate,
      firstUpdatedLines: [],
      classFields: [],
      updatedBodyLines: [],
      disconnectResetLines: [],
    };
  }

  // Scoped fill — wire observeRozieSlotCtx in firstUpdated() and declare
  // a ctx-storing class field. The fill body's lit-html template references
  // captured params via `this._<name>Ctx?.<param>` — that rewrite lives in
  // the lit rewriteTemplateExpression machinery (extended in a follow-up
  // when consumer-scoped-fill exercises it in Task 3).
  const ctxFieldName = `_${filler.name}Ctx`;
  const wiredFieldName = `_slotCtxWired_${filler.name}`;
  const ctxTypeFields = filler.params.map((p) => `${p.name}: unknown`).join('; ');
  const classFields = [
    `private ${ctxFieldName}?: { ${ctxTypeFields} };`,
    // Phase 07.3.1 Blocker #3 (D-03) — per-filler wired flag gates the
    // microtask retry + updated() re-attempt so we don't double-wire and
    // don't leak observers on every render. Reset on disconnect (Landmine 2).
    `private ${wiredFieldName} = false;`,
  ];
  // The querySelector reads the consumer's *shadow* root for the named
  // slot. The slot element is on the producer (the child custom element),
  // accessed via `this.querySelector('[slot="<name>"]')` (light DOM) on
  // the consumer — but the producer's `<slot>` element holds the
  // `data-rozie-params` attribute, so we need to walk to the producer's
  // shadowRoot. For Wave 1 the simplest correct path is: the consumer
  // queries the producer custom element it just emitted, then accesses
  // its `shadowRoot.querySelector('slot[name="<name>"]')`. This wiring
  // assumes the producer is the direct child custom element of the fill
  // element — true for the consumer-scoped-fill fixture shape (Task 3).
  // The Playwright spec (this task) verifies first-paint behavior.
  //
  // KNOWN LIMITATIONS (WR-03 — documented for future resolution):
  //
  //  1. Conditional rendering: if the consumer wraps the producer in an
  //     `r-if` block and the condition is false at `firstUpdated()` time,
  //     the fill element with `slot="<name>"` is not yet in the DOM, so
  //     `querySelector` returns null and the ctx observer is never wired.
  //     The consumer then renders with undefined ctx fields for the lifetime
  //     of the component, even after the condition becomes true.
  //     Robust fix: use a MutationObserver on the shadow root to rewire the
  //     observer whenever the fill element appears (deferred to a future
  //     phase — this requires generating a MutationObserver cleanup entry).
  //
  //  2. Multiple producer instances: if two producer custom elements of the
  //     same type appear in the same consumer template (each with a `#<name>`
  //     fill), `querySelector('[slot="<name>"]')` returns only the FIRST
  //     fill element. The second instance's ctx observer is never wired.
  //     Robust fix: `querySelectorAll` + index-matching via element identity
  //     or a `WeakMap<Element, Ctx>` pattern (deferred — requires emitting
  //     per-instance observer wiring at render time rather than firstUpdated).
  //
  //  Both limitations are acceptable for Wave 1 / Phase 07.2 (single producer
  //  instance, always-rendered fills is the documented supported shape).
  //  Consumer authors who hit these edge cases should use the vanilla Lit
  //  approach (MutationObserver or slotchange event) directly in their
  //  component's `firstUpdated` override.
  // Phase 07.3.1 Blocker #3 (D-03) — wrap the lookup in `tryWire` so a
  // microtask-scheduled retry can recover from the producer-upgrade race
  // (Race B). The flag-set on success gates the `updated()` re-attempt
  // body (also emitted below) so we don't double-wire.
  const firstUpdatedLines = [
    `// Phase 07.2: wire ctx capture for scoped slot fill "${filler.name}".`,
    `// Phase 07.3.1 Blocker #3 (D-03) — tryWire + microtask retry for producer-upgrade race.`,
    `{`,
    `  const tryWire = () => {`,
    `    const producer = this.shadowRoot?.querySelector('[slot="${filler.name}"]')?.parentElement;`,
    `    const slotEl = producer?.shadowRoot?.querySelector('slot[name="${filler.name}"]');`,
    `    if (slotEl) {`,
    `      const unsubscribe = observeRozieSlotCtx(slotEl as HTMLSlotElement, (c) => { this.${ctxFieldName} = c as { ${ctxTypeFields} }; this.requestUpdate(); });`,
    `      this._disconnectCleanups.push(unsubscribe);`,
    `      this.${wiredFieldName} = true;`,
    `    }`,
    `  };`,
    `  tryWire();`,
    `  queueMicrotask(() => { if (!this.${wiredFieldName}) tryWire(); });`,
    `}`,
  ];

  // Phase 07.3.1 Blocker #3 (D-03) — re-attempt wiring inside updated()
  // while the wired flag is false. Inlined (no class-method lift) so the
  // emit shape stays additive — every update gates on the flag, which
  // early-returns the block once wiring succeeds.
  const updatedBodyLines = [
    `// Phase 07.3.1 Blocker #3 (D-03) — re-attempt wiring for "${filler.name}" on each update until producer's slot appears.`,
    `if (!this.${wiredFieldName}) {`,
    `  const producer = this.shadowRoot?.querySelector('[slot="${filler.name}"]')?.parentElement;`,
    `  const slotEl = producer?.shadowRoot?.querySelector('slot[name="${filler.name}"]');`,
    `  if (slotEl) {`,
    `    const unsubscribe = observeRozieSlotCtx(slotEl as HTMLSlotElement, (c) => { this.${ctxFieldName} = c as { ${ctxTypeFields} }; this.requestUpdate(); });`,
    `    this._disconnectCleanups.push(unsubscribe);`,
    `    this.${wiredFieldName} = true;`,
    `  }`,
    `}`,
  ];

  // Phase 07.3.1 Blocker #3 (D-03, Landmine 2) — reset the wired flag on
  // disconnect so a re-mount cycle re-attempts wiring cleanly. Without
  // this, a re-mounted consumer would have a stale `true` flag and skip
  // the retry forever.
  const disconnectResetLines = [
    `this.${wiredFieldName} = false;`,
  ];

  return {
    childTemplate,
    firstUpdatedLines,
    classFields,
    updatedBodyLines,
    disconnectResetLines,
  };
}

/**
 * Attach `slot="<name>"` to the body. Three-stage cascade:
 *
 *   1. Single-root passthrough — body is exactly one top-level element.
 *      Attach `slot="<name>"` directly to that element.
 *   2. Multi-root spread (Phase 07.3.1 D-LIT-18) — body has multiple
 *      top-level elements with only whitespace between/around them.
 *      Inject `slot="<name>"` into each top-level element's opening tag
 *      instead of wrapping in a synthetic `<div>`. This preserves the
 *      consumer-authored DOM structure: the producer's named slot
 *      receives each child directly rather than receiving one wrapper
 *      whose contents are then re-projected.
 *   3. Fallback wrap — body has non-whitespace text at depth 0, or
 *      contains a top-level `${...}` interpolation, or is otherwise
 *      structurally ambiguous. Wrap in `<div slot="<name>">…</div>`.
 *
 * The detection heuristic is conservative — looks for the shape
 * `[whitespace]<tag …>…</tag>[whitespace]` with no sibling content. The
 * body string was produced by the recursive emitChildren callback, so its
 * outermost shape is predictable. For mixed/text bodies we fall back to
 * the wrapper.
 */
function wrapWithSlotAttribute(
  body: string,
  slotName: string,
  _filler: SlotFillerDecl,
): string {
  const trimmed = body.trim();
  // Identify a single top-level <tag …>…</tag> via a quote+interpolation-
  // aware scanner. Replaces the previous `[^>]*` regex which falsely
  // terminated the attribute scan at `>` characters inside template-literal
  // interpolations (e.g., `@click=${($event) => ...}` introduced by the Phase
  // 07.3.1 Blocker #3 D-03 late-binding wrap). The scanner uses
  // `findTagClose` which is now `${...}`-aware (Phase 07.3.1 Rule 1 fix).
  const tagOpenMatch = trimmed.match(/^<([a-zA-Z][\w-]*)\b/);
  if (tagOpenMatch) {
    const tag = tagOpenMatch[1]!;
    const tagOpenLen = tagOpenMatch[0].length;
    const openClose = findTagClose(trimmed, tagOpenLen);
    if (openClose !== -1) {
      const isSelfClose = trimmed[openClose - 1] === '/';
      // Self-closing single root — no inner content, attach slot= and return.
      if (isSelfClose && openClose === trimmed.length - 1) {
        const attrs = trimmed.slice(tagOpenLen, openClose - 1);
        return `<${tag}${attrs} slot="${slotName}"/>`;
      }
      // Non-self-closing single root. Verify the trimmed ends with </tag>
      // (final closing tag matches the opener) and the body is structurally
      // single-root (no siblings at depth 0).
      const closingTagRe = new RegExp(`</${tag}\\s*>$`);
      if (closingTagRe.test(trimmed) && !hasSiblingAtTopLevel(trimmed, tag)) {
        const attrs = trimmed.slice(tagOpenLen, openClose);
        const closeStart = trimmed.lastIndexOf(`</${tag}`);
        const inner = trimmed.slice(openClose + 1, closeStart);
        return `<${tag}${attrs} slot="${slotName}">${inner}</${tag}>`;
      }
    }
  }

  // Phase 07.3.1 D-LIT-18 — multi-root spread. If the body has multiple
  // top-level elements separated only by whitespace (no text content, no
  // top-level interpolations), inject `slot="<name>"` into each opening
  // tag instead of wrapping in a div. Preserves consumer-authored DOM
  // structure so the producer's named slot receives each child directly.
  const spread = spreadSlotAttrAcrossTopLevelElements(trimmed, slotName);
  if (spread !== null) {
    return spread;
  }

  return `<div slot="${slotName}">${body}</div>`;
}

/**
 * Phase 07.3.1 D-LIT-18 — inject `slot="<name>"` into the opening tag of
 * every top-level element in `body`, returning the rewritten body. Returns
 * `null` when the body is structurally unsafe to spread across:
 *
 *   - Top-level text content (anything non-whitespace outside an element)
 *   - Top-level `${...}` interpolation (could expand to text at runtime)
 *   - Top-level HTML comment or processing instruction (semantic surface)
 *   - Fewer than 2 top-level elements (single-root passthrough handles 1;
 *     0 means the body is empty/whitespace, where the wrap is innocuous)
 *   - An existing `slot=` attribute on any top-level element (avoid
 *     clobbering consumer-authored slot routing)
 *   - A malformed opening tag (no matching `>` found before EOF)
 *
 * The scanner mirrors `hasSiblingAtTopLevel`'s walk so the same
 * quote-and-interpolation-aware tokenization governs which elements are
 * "top level."
 *
 * Whitespace and existing line structure between elements is preserved
 * verbatim so emitted output stays readable.
 */
function spreadSlotAttrAcrossTopLevelElements(
  body: string,
  slotName: string,
): string | null {
  type OpenTag = { openIdx: number; closeIdx: number; isSelfClose: boolean };
  const openTags: OpenTag[] = [];

  let depth = 0;
  let i = 0;
  while (i < body.length) {
    const ch = body[i]!;

    // Top-level `${...}` interpolation = unsafe (could expand to text).
    if (ch === '$' && body[i + 1] === '{') {
      if (depth === 0) return null;
      const end = skipInterpolation(body, i + 2);
      if (end === -1) return null;
      i = end + 1;
      continue;
    }

    if (ch === '<') {
      // Closing tag — decrement depth.
      if (body[i + 1] === '/') {
        const close = body.indexOf('>', i);
        if (close === -1) return null;
        depth = Math.max(0, depth - 1);
        i = close + 1;
        continue;
      }
      // Comment / processing instruction at depth 0 — unsafe.
      if (body[i + 1] === '!' || body[i + 1] === '?') {
        if (depth === 0) return null;
        const close = body.indexOf('>', i);
        if (close === -1) return null;
        i = close + 1;
        continue;
      }
      // Opening tag.
      const close = findTagClose(body, i + 1);
      if (close === -1) return null;
      const isSelfClose = body[close - 1] === '/';
      if (depth === 0) {
        // Refuse if the opening tag already carries a `slot=` attribute —
        // injecting a second one would clobber the consumer's routing.
        const openTagText = body.slice(i, close + 1);
        if (/\sslot\s*=/.test(openTagText)) return null;
        openTags.push({ openIdx: i, closeIdx: close, isSelfClose });
      }
      if (!isSelfClose) depth++;
      i = close + 1;
      continue;
    }

    // Text at depth 0 with non-whitespace = unsafe.
    if (depth === 0 && ch.trim() !== '') {
      return null;
    }
    i++;
  }

  // Single-root (1 top-level element) is handled by the passthrough path;
  // 0 top-level elements means whitespace-only body. Either way, defer.
  if (openTags.length < 2) return null;

  // Inject `slot="<name>"` into each top-level opening tag. Walk in
  // reverse so earlier index positions stay stable during string surgery.
  let out = body;
  const attr = ` slot="${slotName}"`;
  for (let k = openTags.length - 1; k >= 0; k--) {
    const t = openTags[k]!;
    // Inject BEFORE the `/>` for self-close, BEFORE the `>` for normal.
    let insertAt = t.isSelfClose ? t.closeIdx - 1 : t.closeIdx;
    // For self-close, the emitter often produces `<img src="x" />` with a
    // space before the `/`. Walk insertAt back past that whitespace so
    // the injected attribute lands flush with the previous attribute:
    // `<img src="x" slot="brand"/>` rather than `<img src="x"  slot="brand"/>`.
    if (t.isSelfClose) {
      while (insertAt > t.openIdx && out[insertAt - 1] === ' ') {
        insertAt--;
      }
    }
    out = out.slice(0, insertAt) + attr + out.slice(insertAt);
  }
  return out;
}

/**
 * Scan forward from `start` to find the `>` that closes the current HTML tag,
 * skipping over (a) quoted attribute values so that `>` characters inside
 * strings (e.g., `<button title="score > 0">`) are not treated as tag-end
 * markers, and (b) `${...}` template-literal interpolations (e.g.
 * `<button @click=${($event) => fn($event)}>` — the `>` in `=>` MUST be ignored).
 * The interpolation skip is brace-balanced so nested `${...}` inside the
 * inner expression are handled. Phase 07.3.1 Blocker #3 (D-03) added the
 * `${...}` skip — the late-binding event-handler wrap introduces `>`
 * characters inside template-literal interpolations on consumer-side
 * slot-filler bodies.
 *
 * Returns the index of the closing `>`, or -1 if not found before end-of-string.
 */
export function findTagClose(body: string, start: number): number {
  let inQuote: '"' | "'" | null = null;
  for (let i = start; i < body.length; i++) {
    const ch = body[i]!;
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch as '"' | "'";
      continue;
    }
    // Phase 07.3.1 Blocker #3 (D-03) — skip balanced `${...}` blocks.
    // Late-binding handler wrap produces `@click=${($event) => fn($event)}` whose
    // `>` in the arrow MUST NOT terminate the tag-attribute scan.
    if (ch === '$' && body[i + 1] === '{') {
      i = skipInterpolation(body, i + 2);
      if (i === -1) return -1;
      continue;
    }
    if (ch === '>') {
      return i;
    }
  }
  return -1;
}

/**
 * Skip past a balanced `${...}` block starting at `start` (which points to
 * the character AFTER the `${`). Tracks nested `{` / `}` so inner block
 * expressions (object literals, arrow function bodies) are handled. Also
 * tracks string quotes inside the interpolation so `}` inside a string
 * literal does not prematurely close the block.
 *
 * Returns the index of the closing `}`, or -1 if not found.
 */
function skipInterpolation(body: string, start: number): number {
  let depth = 1;
  let inQuote: '"' | "'" | '`' | null = null;
  for (let i = start; i < body.length; i++) {
    const ch = body[i]!;
    if (inQuote) {
      if (ch === '\\') {
        i++; // skip escaped char
        continue;
      }
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inQuote = ch as '"' | "'" | '`';
      continue;
    }
    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Conservative sibling-detection: does the trimmed body have any
 * top-level node ALONGSIDE the matched single root? When yes, the
 * single-root passthrough is unsafe — fall back to the wrapper.
 *
 * We test by counting top-level tag opens. A truly single-root body has
 * exactly one top-level opening tag. Whitespace doesn't count.
 *
 * Uses `findTagClose` (quote-aware) instead of `indexOf('>')` to avoid
 * misidentifying `>` inside attribute values (e.g., `title="a > b"`) as
 * tag-end markers, which would produce an incorrect depth count.
 */
function hasSiblingAtTopLevel(body: string, _rootTag: string): boolean {
  // Depth-track tags; count top-level (depth 0 → 1) entries.
  let depth = 0;
  let topLevelEntries = 0;
  let i = 0;
  while (i < body.length) {
    const ch = body[i]!;
    // Phase 07.3.1 Blocker #3 (D-03) — skip balanced `${...}` blocks at
    // the text level so handler-wrap content (`($event) => fn(e)`) inside
    // attribute interpolations does not perturb the depth counter.
    if (ch === '$' && body[i + 1] === '{') {
      const end = skipInterpolation(body, i + 2);
      if (end === -1) break;
      i = end + 1;
      continue;
    }
    if (ch === '<') {
      // Identify open/close/self-close.
      if (body[i + 1] === '/') {
        // Closing tag: skip to '>'. Closing tags have no attribute values,
        // so a plain indexOf is safe here.
        const close = body.indexOf('>', i);
        if (close === -1) break;
        depth = Math.max(0, depth - 1);
        i = close + 1;
        continue;
      }
      if (body[i + 1] === '!' || body[i + 1] === '?') {
        // Comment / processing instruction — skip.
        const close = body.indexOf('>', i);
        if (close === -1) break;
        i = close + 1;
        continue;
      }
      // Opening tag: use quote+interpolation-aware scan so `>` inside
      // attribute values OR `${...}` interpolations does not prematurely
      // end the tag scan.
      const close = findTagClose(body, i + 1);
      if (close === -1) break;
      const isSelfClose = body[close - 1] === '/';
      if (depth === 0) topLevelEntries++;
      if (!isSelfClose) depth++;
      i = close + 1;
      continue;
    }
    // Text at depth 0 with non-whitespace = sibling content.
    if (depth === 0 && ch.trim() !== '') {
      return true;
    }
    i++;
  }
  return topLevelEntries > 1;
}
