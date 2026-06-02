/**
 * SEM (Quick 260602-dv1) — `$refs`-read-before-mount validator (ROZ123).
 *
 * `$refs` are only populated AFTER the component mounts. Reading a `$refs.<x>`
 * in a position that is evaluated DURING setup/render is a silent cross-target
 * divergence — on solid the eager memo / `$watch` effect reads `$refs` at setup
 * (before the ref callback assigns the element) → TDZ crash / null; on lit and
 * the other targets it simply yields null. The debug session
 * lit-rangeplugin-shadow-dom falsified the exact shape
 * `$computed(() => [rangePlugin({ input: $refs.rangeEnd })])` (it crashed solid
 * and silently no-op'd lit) and Dan blessed turning the divergence into a LOUD
 * compile error.
 *
 * ── FLAGGED (the two pre-mount evaluation contexts) ──────────────────────────
 *   <script>:
 *     - inside a `$computed(...)` argument body;
 *     - inside the `$watch(getter, cb)` GETTER (argument[0]).
 *   <template>:
 *     - kind === 'binding'   (`:plugins="…"`, `:disabled="…"`);
 *     - kind === 'directive' for `if` / `show` / `text` / `html`;
 *     - the ITERABLE (right-hand side) of an `r-for` (render-time);
 *     - a `{{ ... }}` TemplateInterpolation.
 *
 * ── DO-NOT-FLAG (all run post-mount when invoked) ────────────────────────────
 *     - `$onMount` / `$onUnmount` / `$onUpdate` callback bodies;
 *     - the `$watch` CALLBACK (argument[1]);
 *     - `@event` handler expressions (`@click="$refs.x.focus()"`);
 *     - `<listeners>` handlers (this validator never walks <listeners>);
 *     - `r-model` targets;
 *     - the `r-for` LHS alias clause (`item in …` — not a JS expression);
 *     - plain function / method bodies (called later, post-mount);
 *     - a `$refs` read at <script> Program top level (a separate concern).
 *
 * ── $watch-GETTER VERDICT: EAGER → FLAGGED ───────────────────────────────────
 * Empirically confirmed (260602-dv1 probe, compile(..., { target: 'solid' })):
 * `$watch(() => $refs.el?.offsetWidth, cb)` lowers to
 *   `createEffect(on(() => (() => elRef?.offsetWidth)(), …, { defer: true }));`
 *   `let elRef: HTMLElement | null = null;`            // declared AFTER the effect
 * `on`'s deps-function runs the getter at the effect's first run (setup time),
 * BEFORE the ref callback assigns `elRef` — the same eager-read hazard as a
 * `$computed` body (and a literal read-before-declaration of `elRef`). So the
 * getter is FLAGGED. The CALLBACK (argument[1]) fires in response to a change
 * (post-mount) and is ALWAYS do-not-flag.
 *
 * ── OUT OF SCOPE ─────────────────────────────────────────────────────────────
 * Computed `$refs['x']` is ROZ106's concern (detectMagicAccess returns null for
 * computed access). Non-`$refs` magic accessors are unaffected.
 *
 * ── Re-parse / byte-offset discipline ────────────────────────────────────────
 * Template expression text is re-parsed via @babel/parser.parseExpression inside
 * a try/catch (D-08: never throws — the parser layer already diagnosed malformed
 * mustache/expression text). Every emitted diagnostic carries an absolute
 * byte-offset loc: re-parsed fragments add the fragment's base offset (the
 * attribute valueLoc.start, the interpolation loc.start + 2 to skip `{{`, or the
 * r-for value offset + the iterable's position within the LHS string).
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
import { detectMagicAccess } from '../visitors.js';

// Default-export interop: see unknownRefValidator.ts for the same pattern.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

/** Callees whose callback argument runs post-mount — a `$refs` read inside one
 *  is deferred and must NOT be flagged, even when nested inside a flagged
 *  region (e.g. `$computed(() => { $onMount(() => use($refs.el)); … })`). */
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

/** A `$refs.<member>` static read (computed `$refs['x']` returns null → ROZ106). */
function refsMember(node: t.Node): string | null {
  if (!t.isMemberExpression(node)) return null;
  const access = detectMagicAccess(node);
  return access && access.scope === 'refs' ? access.member : null;
}

/** Emit ROZ123 for a `$refs.<refName>` read at `loc`. */
function pushRefsPreMount(
  ctx: ValidatorContext,
  refName: string,
  loc: SourceLoc,
): void {
  ctx.diagnostics.push({
    code: RozieErrorCode.REFS_READ_BEFORE_MOUNT,
    severity: 'error',
    message: `$refs.${refName} is read before mount — $refs are only populated after the component mounts, but this position is evaluated during setup/render.`,
    loc,
    hint: 'Read $refs only inside $onMount (or another callback that runs after mount). $computed bodies, $watch getters, and template/binding expressions evaluate too early.',
  });
}

// ── <script> walk ────────────────────────────────────────────────────────────

/**
 * Traverse a FLAGGED region (a `$computed` body or a `$watch` getter), pushing
 * ROZ123 for every `$refs.<x>` read. Nested do-not-flag callbacks re-defer: when
 * we hit a `$onMount`/`$onUnmount`/`$onUpdate(...)` call OR a `$watch(...)`
 * callback (argument[1]), we `path.skip()` so its subtree is not flagged (a
 * `$refs` read in there runs post-mount). Nested `$computed`/`$watch`-getter
 * regions remain flagged (they re-enter via the same eager-eval contract). The
 * base offset is 0 — `<script>` nodes carry absolute .rozie offsets.
 */
function flagRefsInRegion(region: t.Node, ctx: ValidatorContext): void {
  const wrapped = t.file(
    t.program([t.expressionStatement(region as t.Expression)]),
  );
  traverse(wrapped, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      if (DEFER_CALLEES.has(callee.name)) {
        // The whole call (its callback body) is deferred — do not flag inside.
        path.skip();
      } else if (callee.name === '$watch') {
        // A nested $watch: its CALLBACK (arg[1]) is deferred, but its GETTER
        // (arg[0]) is still eager and must remain flagged. Descend into the
        // getter explicitly, then skip the rest of this call subtree.
        const getter = path.node.arguments[0];
        if (
          getter &&
          (t.isArrowFunctionExpression(getter) || t.isFunctionExpression(getter))
        ) {
          flagRefsInRegion(getter, ctx);
        }
        path.skip();
      }
    },
    MemberExpression(path) {
      const refName = refsMember(path.node);
      if (refName !== null) {
        pushRefsPreMount(ctx, refName, locFromNodeOffset(path.node, 0));
      }
    },
  });
}

/**
 * Walk the `<script>` Program for the pre-mount eval contexts. We scope the flag
 * precisely with a CallExpression visitor: for each `$computed(fn)` descend into
 * `fn` (arg[0]); for each `$watch(getterFn, cb)` descend into `getterFn`
 * (arg[0]) ONLY (the getter is eager on solid — see the $watch-getter verdict
 * above; the callback is deferred). Anything outside these regions — top-level
 * reads, plain functions, lifecycle bodies — is never flagged.
 */
function validateScript(script: ScriptAST, ctx: ValidatorContext): void {
  traverse(script.program, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;
      if (callee.name === '$computed') {
        const body = path.node.arguments[0];
        if (
          body &&
          (t.isArrowFunctionExpression(body) || t.isFunctionExpression(body))
        ) {
          flagRefsInRegion(body, ctx);
        }
      } else if (callee.name === '$watch') {
        const getter = path.node.arguments[0];
        if (
          getter &&
          (t.isArrowFunctionExpression(getter) || t.isFunctionExpression(getter))
        ) {
          flagRefsInRegion(getter, ctx);
        }
      }
    },
  });
}

// ── <template> walk ──────────────────────────────────────────────────────────

/**
 * Re-parse a template-expression fragment and flag `$refs` reads. Returns
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
      const refName = refsMember(path.node);
      if (refName !== null) {
        pushRefsPreMount(ctx, refName, locFromNodeOffset(path.node, baseOffset));
      }
    },
  });
}

// `(item, idx) in iterable` / `item of iterable` — find the keyword split so we
// can re-parse ONLY the iterable RHS (render-time) and skip the alias LHS (not a
// JS expression). Linear-time, bounded; mirrors extractRForAliases's posture.
const R_FOR_KEYWORD = /\s+(?:in|of)\s+/;

/**
 * Flag `$refs` reads inside an `r-for` ITERABLE (the RHS of `… in iterable`).
 * The LHS alias clause is intentionally NOT parsed (it is `item` / `(item, idx)`
 * binding syntax, not a JS expression). baseOffset is the attribute
 * valueLoc.start plus the byte offset of the iterable within the raw value.
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
 * SKIP `event` (handlers run on user action, post-mount), `r-model` (binding
 * target), and `static`. FLAG `binding` and `directive` `if`/`show`/`text`/
 * `html`; the `r-for` iterable RHS is flagged via validateRForIterable.
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
    if (attr.name === 'model') return; // r-model target — do-not-flag.
    if (
      attr.name === 'if' ||
      attr.name === 'show' ||
      attr.name === 'text' ||
      attr.name === 'html'
    ) {
      parseAndFlag(attr.value, attr.valueLoc.start, ctx);
    }
    // Other directives (e.g. r-key) are not pre-mount eval positions for $refs.
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
 * Run the `$refs`-read-before-mount validator over the given AST. Emits ROZ123
 * into `diagnostics`. NEVER throws (D-08). No bindings dependency.
 *
 * Note: <listeners> is intentionally NOT walked — listener handlers run
 * post-mount (do-not-flag).
 */
export function runRefsPreMountValidator(
  ast: RozieAST,
  diagnostics: Diagnostic[],
): void {
  const ctx: ValidatorContext = { diagnostics };
  if (ast.script) validateScript(ast.script, ctx);
  if (ast.template) validateTemplate(ast.template, ctx);
}
