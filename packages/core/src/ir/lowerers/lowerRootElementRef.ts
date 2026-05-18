/**
 * lowerRootElementRef — Spike 001 B2 fix.
 *
 * IR-level pass that detects script-context use of `$el` and synthesises a
 * `RefDecl { name: '__rozieRoot' }` plus a matching `ref="__rozieRoot"`
 * AttributeBinding on the root template element. After this pass runs, each
 * per-target `rewriteScript.ts` lowers a free `$el` Identifier to
 * `MemberExpression($refs, __rozieRoot)`, which then flows through the
 * existing `$refs.X` MemberExpression handler and produces the target-native
 * root-element accessor (Vue templateRef.value / React .current /
 * Svelte bind:this / Solid callback-ref / Angular viewChild()?.nativeElement /
 * Lit this._ref__rozieRoot).
 *
 * Per .planning/spikes/001-sortablejs-port/README.md Iteration 1:
 * `examples/Modal.rozie` documents `$el` as "root element access for
 * vanilla-JS lib integration" but only Lit's emitter previously rewrote it
 * (→ `this`); the other 5 targets emitted it as a literal free identifier
 * producing runtime `ReferenceError`. This pass closes that gap at the IR
 * layer so a single Identifier-case in each per-target rewriteScript suffices.
 *
 * v1 limitations (documented inline at the bail-out sites):
 *   - User already declared `ref="X"` on the root element → no synthesis;
 *     synthesising a second ref on the same element produces two refs which
 *     no renderer handles cleanly. Workaround: use `$refs.<X>` directly.
 *   - Root template is NOT a single `TemplateElement` (conditional, loop,
 *     fragment, null) → no synthesis. v1 punt — the root-element accessor
 *     model assumes a single mountable element.
 *
 * Per IR-04: this pass does NOT mutate any AST nodes. The Babel script
 * program stays untouched in the IR. Per-target `rewriteScript.ts` handles
 * the Identifier-side rewrite at clone-time.
 *
 * Per D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type {
  IRComponent,
  RefDecl,
  AttributeBinding,
  TemplateNode,
  TemplateElementIR,
} from '../types.js';

// CJS interop normalization for @babel/traverse default export.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

/**
 * Walk the given Babel Node (BlockStatement / Expression / Statement) and
 * return true if a free read of the `$el` Identifier is found.
 *
 * "Free read" = `t.isIdentifier(node) && node.name === '$el'` AND its parent
 * path is NOT a binding/declaration position. Mirrors the per-target Lit
 * gating in `packages/targets/lit/src/rewrite/rewriteScript.ts:234-242`.
 */
function nodeContainsFreeEl(node: t.Node): boolean {
  // Wrap the input node in a synthetic File + Program so @babel/traverse
  // can walk it. Wrapping an Expression in an ExpressionStatement keeps the
  // node positions consistent. Wrapping a BlockStatement works directly.
  let stmts: t.Statement[];
  if (t.isBlockStatement(node)) {
    stmts = [node];
  } else if (t.isStatement(node)) {
    stmts = [node];
  } else if (t.isExpression(node)) {
    stmts = [t.expressionStatement(node)];
  } else {
    return false;
  }

  // Clone to avoid mutating the input (traverse may mark nodes internally).
  // Note: the AST nodes ARE shared with the IR — we never mutate them here,
  // just walk read-only. Re-using the original nodes (no clone) avoids the
  // perf hit of a deep clone per-pass on large script bodies.
  const file = t.file(t.program(stmts));

  let found = false;
  traverse(file, {
    Identifier(path) {
      if (found) return;
      if (path.node.name !== '$el') return;

      const parentPath = path.parentPath;
      if (!parentPath) return;

      // Skip binding positions — these aren't reads of the value $el.
      // VariableDeclarator id position (`let $el = ...` — unusual but possible).
      if (parentPath.isVariableDeclarator() && parentPath.node.id === path.node) return;
      // Property key of a non-computed MemberExpression (`x.$el` — different name).
      if (
        parentPath.isMemberExpression() &&
        parentPath.node.property === path.node &&
        !parentPath.node.computed
      ) {
        return;
      }
      // ObjectProperty key (non-computed) — `{ $el: ... }` is a property name.
      if (
        parentPath.isObjectProperty() &&
        parentPath.node.key === path.node &&
        !parentPath.node.computed
      ) {
        return;
      }
      // Function parameter binding (`($el) => ...`).
      if (parentPath.isFunction()) {
        const params = (parentPath.node as { params: t.Node[] }).params;
        if (params.includes(path.node)) return;
      }

      found = true;
      path.stop();
    },
  });

  return found;
}

/**
 * Scan every script/lifecycle/watcher/listener body in the IR for a free
 * `$el` read. Listeners' `target` field (the "this listener is bound to the
 * root element" sentinel) is unrelated — `lowerListeners.ts` already handles
 * that. Here we only care about `$el` as a value Identifier inside expressions.
 */
function irHasScriptContextEl(ir: IRComponent): boolean {
  // 1. Top-level script body.
  for (const stmt of ir.setupBody.scriptProgram.program.body) {
    if (nodeContainsFreeEl(stmt)) return true;
  }
  // 2. Lifecycle hooks — setup + cleanup bodies.
  for (const hook of ir.lifecycle) {
    if (nodeContainsFreeEl(hook.setup)) return true;
    if (hook.cleanup && nodeContainsFreeEl(hook.cleanup)) return true;
  }
  // 3. Watcher hooks — getter + callback bodies.
  for (const wh of ir.watchers) {
    if (nodeContainsFreeEl(wh.getter)) return true;
    if (nodeContainsFreeEl(wh.callback)) return true;
  }
  // 4. Listener bodies — `handler` and `when` (the value-position reads inside
  //    expressions, NOT the listener's `target` field which is a sentinel).
  for (const listener of ir.listeners) {
    if (nodeContainsFreeEl(listener.handler)) return true;
    if (listener.when && nodeContainsFreeEl(listener.when)) return true;
  }
  return false;
}

/**
 * Resolve the "effective" root element when `ir.template` is a TemplateFragment
 * (a common shape — leading/trailing whitespace text nodes around a single
 * structural element produce a fragment wrapper at lower time). Returns the
 * single TemplateElement child when:
 *   - ir.template is itself a TemplateElement (direct hit), OR
 *   - ir.template is a TemplateFragment whose children contain EXACTLY one
 *     TemplateElement and zero other structural nodes (text-only siblings
 *     are skipped as cosmetic whitespace).
 * Returns null otherwise — conditional, loop, multi-element fragment, etc.
 */
function resolveRootElement(node: TemplateNode | null): TemplateElementIR | null {
  if (!node) return null;
  if (node.type === 'TemplateElement') return node;
  if (node.type !== 'TemplateFragment') return null;

  let only: TemplateElementIR | null = null;
  for (const child of node.children) {
    if (child.type === 'TemplateStaticText') continue; // cosmetic whitespace
    // Portal-slot primitive (Spike 003) — portal slots are declared in the
    // template tree but NEVER render. They exist only to surface a
    // consumer-facing prop in the per-target slot-decl machinery. Skipping
    // them here lets a wrapper that uses `$el` AND a portal slot still
    // qualify as single-root, which is what lowerRootElementRef cares about
    // (does the template have exactly one mountable element?).
    if (child.type === 'TemplateSlotInvocation' && child.isPortal === true) continue;
    if (child.type === 'TemplateElement') {
      if (only !== null) return null; // multiple structural elements — not a single root
      only = child;
      continue;
    }
    // Any non-element/non-text structural sibling disqualifies — conditional,
    // loop, non-portal slot invocation, interpolation are not single-root shapes.
    return null;
  }
  return only;
}

/**
 * Mutate the IR in place to add a synthesised `__rozieRoot` RefDecl and a
 * matching `ref="__rozieRoot"` static AttributeBinding on the root template
 * element, IF AND ONLY IF:
 *   1. A free `$el` read is found in any script/lifecycle/watcher/listener body, AND
 *   2. The template resolves to a single root `TemplateElement` (directly OR
 *      wrapped in a TemplateFragment of whitespace + one element), AND
 *   3. The root element does NOT already have a `ref` attribute.
 *
 * Otherwise the IR is left untouched (v1 limitations documented in the
 * file-level comment).
 */
export function lowerRootElementRef(ir: IRComponent): void {
  // Gate 1 — only synthesise when $el is actually used in script context.
  if (!irHasScriptContextEl(ir)) return;

  // Gate 2 — root template must resolve to a single TemplateElement.
  // Multi-element fragments / conditional / loop roots are v1 limitations:
  // the root-element accessor model assumes a single mountable element.
  const rootEl = resolveRootElement(ir.template);
  if (!rootEl) return;

  // Gate 3 — bail if user already declared `ref="X"` on the root element.
  // v1 limitation: when user already declared ref=... on root, $el remains a
  // free identifier — workaround: use $refs.<userRefName> directly. The
  // alternative (synthesise __rozieRoot alongside the user-authored root ref)
  // produces two refs on the same element which neither Vue's templateRef nor
  // Lit's @query handles cleanly.
  const hasUserRootRef = rootEl.attributes.some(
    (attr) => attr.kind === 'static' && attr.name === 'ref',
  );
  if (hasUserRootRef) return;

  // Synthesise the RefDecl. Anchor sourceLoc to the root element so devtools
  // resolves __rozieRoot back to the template element that mounts it.
  const synthRef: RefDecl = {
    type: 'RefDecl',
    name: '__rozieRoot',
    elementTag: rootEl.tagName,
    sourceLoc: rootEl.sourceLoc,
  };
  ir.refs.push(synthRef);

  // Synthesise the matching `ref="__rozieRoot"` attribute on the root element.
  const synthAttr: AttributeBinding = {
    kind: 'static',
    name: 'ref',
    value: '__rozieRoot',
    sourceLoc: rootEl.sourceLoc,
  };
  rootEl.attributes.push(synthAttr);
}
