/**
 * Quick 260829-cd4 — `$portals`-called-before-mount validator (ROZ149).
 *
 * Modeled directly on `refsPreMountValidator.ts` (ROZ123), which solves the
 * identical class of problem for `$refs`. `.planning/notes/class-a-sigil-
 * scoping.md` proved that on EVERY target the synthesized `portals` closure
 * degrades an early call to an inert `{ update(){}, dispose(){} }` handle
 * rather than crashing — a SILENT wrong result, not a throw, so nothing ever
 * warned about it. Quick 260829-cd4's companion emitter fix hoists the
 * closure to component scope on react/angular/lit, closing the "dropped
 * entirely" / "declared in the wrong scope" failure shapes — but the anchor
 * genuinely does not exist yet at the positions below, on EVERY target, even
 * after that fix, because those positions run during setup/render, before
 * the anchor has mounted. Both the `$watch`-getter and setup-time-invocation
 * shapes survive the emitter fix for exactly this reason, and — since Task 5
 * is independently droppable — a top-level invocation is ADDITIONALLY a hard
 * TDZ crash on Vue/Svelte if that task did not land.
 *
 * ── FLAGGED (evaluated during setup/render) ──────────────────────────────────
 *   <script>:
 *     - `<script>` Program TOP LEVEL — no enclosing function at all (unlike
 *       ROZ123, which deliberately excludes this position for `$refs`; a
 *       `$portals` call has no analogous "may already exist by then" escape
 *       hatch, so top-level is flagged here);
 *     - inside a `$computed(...)` argument body;
 *     - inside the `$watch(getter, cb)` GETTER (argument[0]).
 *   <template>:
 *     - kind === 'binding'   (`:x="$portals.body(...)"`);
 *     - kind === 'directive' for `if` / `show` / `text` / `html`;
 *     - the ITERABLE (right-hand side) of an `r-for` (render-time);
 *     - a `{{ ... }}` TemplateInterpolation.
 *
 * ── DO-NOT-FLAG (all resolve post-mount) ─────────────────────────────────────
 *     - ANY ordinary function/arrow/method body (a top-level helper — this is
 *       the ENTIRE POINT of the Quick 260829-cd4 emitter fix: these are
 *       correct on all six targets post-fix. Re-flagging them here would
 *       re-teach the tax that fix removes);
 *     - `$onMount` / `$onUnmount` / `$onUpdate` callback bodies;
 *     - the `$watch` CALLBACK (argument[1]);
 *     - `@event` handler expressions (`<listeners>` handlers are never
 *       walked by this validator — same posture as ROZ123);
 *     - `r-model` targets (not applicable to `$portals`, included for parity
 *       with the shared template-walk shape);
 *     - computed access `$portals['x']` — ROZ106's concern (detectMagicAccess
 *       precedent, same exclusion ROZ123 documents for `$refs['x']`).
 *
 * ── Program-top-level discriminator ──────────────────────────────────────────
 * Implemented via `path.getFunctionParent()`: a `$portals.<x>` read has NO
 * enclosing function when `getFunctionParent()` returns null — that is
 * PRECISELY "Program top level, not deferred by any function boundary",
 * whether the read sits in a bare statement or nested inside an `if`/block at
 * top level. This single check subsumes the whole DO-NOT-FLAG "ordinary
 * function body" rule for free: any read inside `$onMount(...)`, a plain
 * helper, or ANY other function has a non-null function parent and is
 * skipped by this pass. The `$computed`/`$watch`-getter positions are
 * FUNCTION bodies too (so this pass does not double-flag them) and are
 * handled by a separate, explicitly-scoped pass mirroring ROZ123's
 * `flagRefsInRegion`.
 *
 * ── Re-parse / byte-offset discipline ────────────────────────────────────────
 * Same as ROZ123: template expression text is re-parsed via
 * `@babel/parser.parseExpression` inside a try/catch (D-08: never throws).
 * Every emitted diagnostic carries an absolute byte-offset loc.
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

/** Callees whose callback argument runs post-mount — a `$portals` read inside
 *  one is deferred and must NOT be flagged, even when nested inside a
 *  flagged region (e.g. `$computed(() => { $onMount(() => use($portals.x)); })`). */
const DEFER_CALLEES = new Set(['$onMount', '$onUnmount', '$onUpdate']);

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
 * A `$portals.<member>` static read. `$portals` is not in the shared
 * `detectMagicAccess` scope map (props/data/refs/slots/model), so this
 * validator matches it directly. Computed access (`$portals['x']`) returns
 * null — ROZ106's concern, same exclusion ROZ123 documents for `$refs`.
 */
function portalsMember(node: t.Node): string | null {
  if (!t.isMemberExpression(node)) return null;
  if (node.computed) return null;
  const obj = node.object;
  if (!t.isIdentifier(obj) || obj.name !== '$portals') return null;
  const prop = node.property;
  if (!t.isIdentifier(prop)) return null;
  return prop.name;
}

/** Emit ROZ149 for a `$portals.<name>` read at `loc`. */
function pushPortalPreMount(ctx: ValidatorContext, portalName: string, loc: SourceLoc): void {
  ctx.diagnostics.push({
    code: RozieErrorCode.PORTAL_CALL_BEFORE_MOUNT,
    severity: 'error',
    message: `$portals.${portalName} is called before mount — the portal anchor does not exist yet, but this position is evaluated during setup/render, so the call can only ever return an inert no-op handle.`,
    loc,
    hint: 'Call $portals only from $onMount (or another callback that runs after mount, including a $watch CALLBACK). Top-level <script> statements, $computed bodies, $watch getters, and template/binding expressions evaluate too early.',
  });
}

// ── <script> walk, pass 1 — $computed body / $watch getter regions ─────────

/**
 * Traverse a FLAGGED region (a `$computed` body or a `$watch` getter),
 * pushing ROZ149 for every `$portals.<x>` read. Nested do-not-flag callbacks
 * re-defer: when we hit a `$onMount`/`$onUnmount`/`$onUpdate(...)` call OR a
 * `$watch(...)` callback (argument[1]), we `path.skip()` so its subtree is
 * not flagged. Nested `$computed`/`$watch`-getter regions remain flagged.
 * The base offset is 0 — `<script>` nodes carry absolute .rozie offsets.
 * Mirrors `refsPreMountValidator.ts`'s `flagRefsInRegion` verbatim, swapped
 * to `$portals`.
 */
function flagPortalsInRegion(region: t.Node, ctx: ValidatorContext): void {
  const wrapped = t.file(t.program([t.expressionStatement(region as t.Expression)]));
  traverse(wrapped, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      if (DEFER_CALLEES.has(callee.name)) {
        path.skip();
      } else if (callee.name === '$watch') {
        const getter = path.node.arguments[0];
        if (getter && (t.isArrowFunctionExpression(getter) || t.isFunctionExpression(getter))) {
          flagPortalsInRegion(getter, ctx);
        }
        path.skip();
      }
    },
    MemberExpression(path) {
      const portalName = portalsMember(path.node);
      if (portalName !== null) {
        pushPortalPreMount(ctx, portalName, locFromNodeOffset(path.node, 0));
      }
    },
  });
}

/**
 * Walk the `<script>` Program for `$computed`/`$watch`-getter regions,
 * mirroring `refsPreMountValidator.ts`'s `validateScript` verbatim.
 */
function validateComputedAndWatchGetterRegions(script: ScriptAST, ctx: ValidatorContext): void {
  traverse(script.program, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      if (callee.name === '$computed') {
        const body = path.node.arguments[0];
        if (body && (t.isArrowFunctionExpression(body) || t.isFunctionExpression(body))) {
          flagPortalsInRegion(body, ctx);
        }
      } else if (callee.name === '$watch') {
        const getter = path.node.arguments[0];
        if (getter && (t.isArrowFunctionExpression(getter) || t.isFunctionExpression(getter))) {
          flagPortalsInRegion(getter, ctx);
        }
      }
    },
  });
}

// ── <script> walk, pass 2 — Program top level (no enclosing function) ──────

/**
 * Walk the `<script>` Program for `$portals` reads that are NOT deferred by
 * any enclosing function — i.e. genuinely evaluated at setup time. Unlike
 * ROZ123 (which deliberately excludes bare top-level `$refs` reads),
 * `$portals` has no "may already exist by then" escape hatch at Program top
 * level, so this position IS flagged.
 *
 * `path.getFunctionParent()` is the whole discriminator: null means the read
 * has no enclosing function (Program top level, including nested inside a
 * top-level `if`/block — still eager); non-null means it is inside SOME
 * function — an ordinary helper, `$onMount`, `$computed`, a `$watch` getter
 * or callback, all alike. This pass therefore only ever adds the Program-
 * top-level case; the `$computed`/`$watch`-getter cases are handled
 * separately by `validateComputedAndWatchGetterRegions` above (which is
 * scoped to exactly those two function bodies, not "any function").
 */
function validateProgramTopLevel(script: ScriptAST, ctx: ValidatorContext): void {
  traverse(script.program, {
    MemberExpression(path: NodePath<t.MemberExpression>) {
      const portalName = portalsMember(path.node);
      if (portalName === null) return;
      if (path.getFunctionParent() !== null) return; // deferred by some enclosing function.
      pushPortalPreMount(ctx, portalName, locFromNodeOffset(path.node, 0));
    },
  });
}

// ── <template> walk ──────────────────────────────────────────────────────────

/**
 * Re-parse a template-expression fragment and flag `$portals` reads. Returns
 * silently on parse failure (parser layer already diagnosed it). NEVER throws.
 */
function parseAndFlag(text: string, baseOffset: number, ctx: ValidatorContext): void {
  let expr: t.Expression;
  try {
    expr = parseExpression(text, { sourceType: 'module' });
  } catch {
    return; // malformed — parser-layer diagnostics cover it; stay silent (D-08).
  }
  const wrapped = t.file(t.program([t.expressionStatement(expr)]));
  traverse(wrapped, {
    MemberExpression(path) {
      const portalName = portalsMember(path.node);
      if (portalName !== null) {
        pushPortalPreMount(ctx, portalName, locFromNodeOffset(path.node, baseOffset));
      }
    },
  });
}

// `(item, idx) in iterable` / `item of iterable` — find the keyword split so
// we can re-parse ONLY the iterable RHS (render-time). Mirrors
// refsPreMountValidator.ts's rForKeyword posture.
const R_FOR_KEYWORD = /\s+(?:in|of)\s+/;

/**
 * Flag `$portals` reads inside an `r-for` ITERABLE (the RHS of `… in
 * iterable`). The LHS alias clause is intentionally NOT parsed.
 */
function validateRForIterable(attr: TemplateAttr, ctx: ValidatorContext): void {
  if (attr.value === null || attr.valueLoc === null) return;
  const m = R_FOR_KEYWORD.exec(attr.value);
  if (!m || m.index === undefined) return; // malformed r-for — rForKeyValidator owns it.
  const iterableStart = m.index + m[0].length;
  const iterable = attr.value.slice(iterableStart);
  parseAndFlag(iterable, attr.valueLoc.start + iterableStart, ctx);
}

/**
 * Walk a TemplateAttr's expression value for the render-time positions only.
 * SKIP `event` (post-mount) and `static`. FLAG `binding` and `directive`
 * `if`/`show`/`text`/`html`; the `r-for` iterable RHS is flagged via
 * `validateRForIterable`.
 */
function validateTemplateAttr(attr: TemplateAttr, ctx: ValidatorContext): void {
  if (attr.value === null || attr.valueLoc === null) return;
  if (attr.kind === 'event') return; // @click etc. — post-mount.
  if (attr.kind === 'binding') {
    parseAndFlag(attr.value, attr.valueLoc.start, ctx);
    return;
  }
  if (attr.kind === 'directive') {
    if (attr.name === 'for') {
      validateRForIterable(attr, ctx);
      return;
    }
    if (attr.name === 'model') return; // not applicable to $portals; parity with the shared shape.
    if (
      attr.name === 'if' ||
      attr.name === 'show' ||
      attr.name === 'text' ||
      attr.name === 'html'
    ) {
      parseAndFlag(attr.value, attr.valueLoc.start, ctx);
    }
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
 * Run the `$portals`-called-before-mount validator over the given AST. Emits
 * ROZ149 into `diagnostics`. NEVER throws (D-08). No bindings dependency.
 *
 * Note: `<listeners>` is intentionally NOT walked — listener handlers run
 * post-mount (do-not-flag), same posture as ROZ123.
 */
export function runPortalsPreMountValidator(ast: RozieAST, diagnostics: Diagnostic[]): void {
  const ctx: ValidatorContext = { diagnostics };
  if (ast.script) {
    validateComputedAndWatchGetterRegions(ast.script, ctx);
    validateProgramTopLevel(ast.script, ctx);
  }
  if (ast.template) validateTemplate(ast.template, ctx);
}
