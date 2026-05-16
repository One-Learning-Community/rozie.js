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
 * structurally faithful. Multi-element bodies (and any non-element root)
 * fall back to the `<div slot="…">` wrapper.
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
// @babel/traverse ships CJS default-export; unwrap for ESM consumers.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

/**
 * Per-filler emission tuple. See module docs.
 */
export interface LitFillerEmission {
  childTemplate: string;
  firstUpdatedLines: string[];
  classFields: string[];
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
 * `this.<ctxField>?.<name>` MemberExpressions. The recursive emit then
 * passes those MemberExpressions through verbatim — rewriteTemplateExpression
 * has no special handling for `this.foo.bar`, so no double-rewrite.
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
  params: ReadonlySet<string>,
): void {
  if (params.size === 0) return;
  for (const node of nodes) {
    rewriteScopedParamRefsInNode(node, ctxField, params);
  }
}

function rewriteScopedParamRefsInNode(
  node: TemplateNode,
  ctxField: string,
  params: ReadonlySet<string>,
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
 * `this.<ctxField>?.<name>`. Returns the (possibly-replaced) expression.
 * Handles the root-identifier case explicitly because @babel/traverse's
 * `replaceWith` mutates the wrapper tree but doesn't propagate back to
 * the caller's reference.
 */
function rewriteExpr(
  expr: t.Expression,
  ctxField: string,
  params: ReadonlySet<string>,
): t.Expression {
  // Root-identifier shortcut: when the entire expression is a bare
  // Identifier matching a param, return the MemberExpression directly.
  if (t.isIdentifier(expr) && params.has(expr.name)) {
    return t.optionalMemberExpression(
      t.memberExpression(t.thisExpression(), t.identifier(ctxField)),
      t.identifier(expr.name),
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
          t.identifier(name),
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
  if (filler.isDynamic) {
    return { childTemplate: '', firstUpdatedLines: [], classFields: [] };
  }

  // Phase 07.2 Plan 03 — scoped-param IR pre-transform.
  // Inside a `<template #header="{ close }">…<button @click="close">×</button></template>`
  // fill body, bare `close` rewrites to `this._headerCtx?.close` so the
  // emitted lit-html template references the captured ctx field. Done as an
  // IR pre-transform (vs an opt threaded through every rewriteTemplateExpression
  // call site) so the change is isolated to this module — no per-call-site
  // plumbing through emitTemplate.ts.
  if (filler.params.length > 0 && filler.name !== '') {
    const ctxField = `_${filler.name}Ctx`;
    const paramSet = new Set(filler.params.map((p) => p.name));
    rewriteScopedParamRefs(filler.body, ctxField, paramSet);
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
    return { childTemplate: body, firstUpdatedLines: [], classFields: [] };
  }

  // Named fill. Inject `slot="<name>"` on a single-root element, OR wrap
  // the body in a synthetic `<div slot="<name>">…</div>`.
  const childTemplate = wrapWithSlotAttribute(body, filler.name, filler);
  const isScoped = filler.params.length > 0;
  if (!isScoped) {
    return { childTemplate, firstUpdatedLines: [], classFields: [] };
  }

  // Scoped fill — wire observeRozieSlotCtx in firstUpdated() and declare
  // a ctx-storing class field. The fill body's lit-html template references
  // captured params via `this._<name>Ctx?.<param>` — that rewrite lives in
  // the lit rewriteTemplateExpression machinery (extended in a follow-up
  // when consumer-scoped-fill exercises it in Task 3).
  const ctxFieldName = `_${filler.name}Ctx`;
  const ctxTypeFields = filler.params.map((p) => `${p.name}: unknown`).join('; ');
  const classFields = [
    `private ${ctxFieldName}?: { ${ctxTypeFields} };`,
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
  const firstUpdatedLines = [
    `// Phase 07.2: wire ctx capture for scoped slot fill "${filler.name}".`,
    `(() => {`,
    `  const producer = this.shadowRoot?.querySelector('[slot="${filler.name}"]')?.parentElement;`,
    `  const slotEl = producer?.shadowRoot?.querySelector('slot[name="${filler.name}"]');`,
    `  if (slotEl) {`,
    `    const unsubscribe = observeRozieSlotCtx(slotEl as HTMLSlotElement, (c) => { this.${ctxFieldName} = c as { ${ctxTypeFields} }; this.requestUpdate(); });`,
    `    this._disconnectCleanups.push(unsubscribe);`,
    `  }`,
    `})();`,
  ];

  return { childTemplate, firstUpdatedLines, classFields };
}

/**
 * Attach `slot="<name>"` to the body. If the body is a single root HTML
 * element, attach the attribute to that element directly. Otherwise wrap
 * the body in a synthetic `<div slot="<name>">`.
 *
 * The detection heuristic is conservative — looks for the shape
 * `[whitespace]<tag …>…</tag>[whitespace]` with no sibling content. The
 * body string was produced by the recursive emitChildren callback, so its
 * outermost shape is predictable. For mixed/text/multi-element bodies we
 * fall back to the wrapper.
 */
function wrapWithSlotAttribute(
  body: string,
  slotName: string,
  _filler: SlotFillerDecl,
): string {
  const trimmed = body.trim();
  // Match a single top-level <tag …>…</tag> with no sibling content.
  const singleRootMatch = trimmed.match(
    /^<([a-zA-Z][\w-]*)\b([^>]*)>([\s\S]*)<\/\1\s*>$/,
  );
  if (singleRootMatch) {
    const tag = singleRootMatch[1]!;
    const attrs = singleRootMatch[2]!;
    const inner = singleRootMatch[3]!;
    // Confirm no nested-tag-of-same-name dangling. The regex above is
    // greedy on inner content — the closing </tag> matches the FINAL one.
    // For balanced single-root markup this works; for adversarial
    // multi-root we fall back via the wrapping branch below.
    if (!hasSiblingAtTopLevel(trimmed, tag)) {
      return `<${tag}${attrs} slot="${slotName}">${inner}</${tag}>`;
    }
  }
  return `<div slot="${slotName}">${body}</div>`;
}

/**
 * Conservative sibling-detection: does the trimmed body have any
 * top-level node ALONGSIDE the matched single root? When yes, the
 * single-root passthrough is unsafe — fall back to the wrapper.
 *
 * We test by counting top-level tag opens. A truly single-root body has
 * exactly one top-level opening tag. Whitespace doesn't count.
 */
function hasSiblingAtTopLevel(body: string, _rootTag: string): boolean {
  // Depth-track tags; count top-level (depth 0 → 1) entries.
  let depth = 0;
  let topLevelEntries = 0;
  let i = 0;
  while (i < body.length) {
    const ch = body[i]!;
    if (ch === '<') {
      // Identify open/close/self-close.
      if (body[i + 1] === '/') {
        // Closing tag: skip to '>'.
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
      const close = body.indexOf('>', i);
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
