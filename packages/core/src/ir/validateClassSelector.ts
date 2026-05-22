/**
 * validateClassSelector — Phase 13 Plan 13-02.
 *
 * Post-IR pass that walks every `$classSelector('<class>')` CallExpression in
 * the component's lowered IR and enforces the three SPEC validation rules
 * (R3/R4/R5):
 *
 *   - ROZ965 CLASS_SELECTOR_ARG_NOT_LITERAL (R3) — the single argument is not a
 *     string literal (`$classSelector($data.cls)`, `$classSelector('a' + 'b')`,
 *     wrong arity, …). A non-literal class name cannot be resolved at compile
 *     time on the five literal-class targets nor mapped to a CSS-Modules
 *     `styles.x` key on React.
 *
 *   - ROZ967 CLASS_SELECTOR_INVALID_TOKEN (R5) — the string-literal value is not
 *     a single bare CSS class identifier: it fails `/^[A-Za-z_-][A-Za-z0-9_-]*$/`
 *     (multi-token `'a b'`, leading-dot `'.grip'`, combinator `'a>b'`, id `'#x'`,
 *     …). `$classSelector` returns a full selector itself — the author passes
 *     just the class token.
 *
 *   - ROZ966 CLASS_SELECTOR_UNKNOWN_CLASS (R4) — the class token is well-formed
 *     but is not declared in the component's own `<style>` scope. The `hint`
 *     carries a `didYouMean` near-match suggestion when one exists, else
 *     guidance to declare an (even-empty) `.<class> {}` rule. D-06: an empty
 *     `.foo {}` rule IS present in `ir.styles.scopedRules` and registers the
 *     class.
 *
 * Per-call diagnostic priority — at most ONE diagnostic per `$classSelector`
 * call, most-specific-failure-first: arity / literal shape (ROZ965) → token
 * shape (ROZ967) → unknown class (ROZ966).
 *
 * Per D-08 collected-not-thrown: NEVER throws. All failures push a diagnostic
 * and continue. Mutates `diagnostics` in place; NEVER mutates `ir`.
 *
 * Wired into `lowerToIR` (`packages/core/src/ir/lower.ts`) — the single
 * chokepoint both `compile()` and `@rozie/unplugin` share — so a bad
 * `$classSelector` call is caught regardless of entrypoint (Pitfall 1).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import { RozieErrorCode } from '../diagnostics/codes.js';
import { didYouMean } from '../diagnostics/didYouMean.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { SourceLoc } from '../ast/types.js';
import type {
  IRComponent,
  StyleSection,
  TemplateNode,
  Listener,
} from './types.js';

// Default-export interop: @babel/traverse ships a CJS default export that some
// bundlers (incl. Vitest's ESM resolver) wrap into { default: fn }. Normalize
// at module load. Same pattern as semantic/collectors/collectScriptDecls.ts and
// reactivity/computeDeps.ts.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

/** The Phase 13 helper callee name. */
const CLASS_SELECTOR_CALLEE = '$classSelector';

/** A single bare CSS class identifier — no `.`, `#`, whitespace, or combinator. */
const VALID_CLASS_TOKEN = /^[A-Za-z_-][A-Za-z0-9_-]*$/;

/** Class-token extractor over a raw postcss selector string. */
const CLASS_TOKEN_IN_SELECTOR = /\.([A-Za-z_-][A-Za-z0-9_-]*)/g;

/**
 * Extract the set of class names declared in the component's `<style>` scope.
 *
 * `ir.styles.scopedRules` is `unknown[]` of `StyleRule`; each rule's `selector`
 * is the RAW postcss selector text verbatim — there is no pre-extracted class
 * list, so class tokens are pulled out with a regex. D-06: an even-empty
 * `.foo {}` rule IS in `scopedRules`, so a marker class declared with an empty
 * body still registers here.
 */
function declaredScopedClasses(styles: StyleSection): Set<string> {
  const out = new Set<string>();
  for (const rule of styles.scopedRules as Array<{ selector?: unknown }>) {
    const selector = rule?.selector;
    if (typeof selector !== 'string') continue;
    for (const m of selector.matchAll(CLASS_TOKEN_IN_SELECTOR)) {
      if (m[1]) out.add(m[1]);
    }
  }
  return out;
}

/** Convert a Babel `SourceLocation` (line/column) into the IR `SourceLoc`
 *  shape. The Babel `start`/`end` byte offsets are what the IR carries; if a
 *  synthesized node lacks them, fall back to a zero-span loc rather than
 *  throwing (D-08). */
function babelLoc(node: t.Node): SourceLoc {
  const start = typeof node.start === 'number' ? node.start : 0;
  const end = typeof node.end === 'number' ? node.end : start;
  return { start, end };
}

/**
 * Recursive template walker — mirrors `validateTwoWayBindings.walkTemplate` so
 * the two IR passes traverse exactly the same node set (slot-filler bodies and
 * conditional / loop / match / fragment / slot-invocation bodies included).
 */
function walkTemplate(
  node: TemplateNode | null,
  visit: (n: TemplateNode) => void,
): void {
  if (node === null) return;
  visit(node);
  switch (node.type) {
    case 'TemplateElement':
      for (const child of node.children) walkTemplate(child, visit);
      if (node.slotFillers) {
        for (const filler of node.slotFillers) {
          for (const child of filler.body) walkTemplate(child, visit);
        }
      }
      break;
    case 'TemplateConditional':
    case 'TemplateMatch':
      for (const branch of node.branches) {
        for (const child of branch.body) walkTemplate(child, visit);
      }
      break;
    case 'TemplateLoop':
      for (const child of node.body) walkTemplate(child, visit);
      break;
    case 'TemplateSlotInvocation':
      for (const child of node.fallback) walkTemplate(child, visit);
      break;
    case 'TemplateFragment':
      for (const child of node.children) walkTemplate(child, visit);
      break;
    case 'TemplateInterpolation':
    case 'TemplateStaticText':
      break;
  }
}

/**
 * Validate one `$classSelector` CallExpression. Pushes at most one diagnostic
 * (most-specific-failure-first). Never mutates the call node.
 */
function validateCall(
  call: t.CallExpression,
  declared: Set<string>,
  diagnostics: Diagnostic[],
): void {
  const loc = babelLoc(call);

  // ----- Priority 1: ROZ965 — argument is not a single string literal. -----
  //
  // Covers wrong arity (zero / multiple args) AND a non-StringLiteral single
  // arg (identifier, member access, string concatenation, template literal).
  const args = call.arguments;
  const arg = args.length === 1 ? args[0] : undefined;
  if (!arg || !t.isStringLiteral(arg)) {
    diagnostics.push({
      code: RozieErrorCode.CLASS_SELECTOR_ARG_NOT_LITERAL,
      severity: 'error',
      message:
        '$classSelector() requires a single string-literal class name — a variable, member access, or computed expression cannot be resolved to a CSS selector at compile time.',
      loc,
      hint: "Pass a string literal, e.g. $classSelector('grip').",
    });
    return;
  }

  const value = arg.value;

  // ----- Priority 2: ROZ967 — the literal is not a bare class token. -----
  //
  // `$classSelector` already returns a full selector — the author passes only
  // the class identifier. Anything with whitespace, a leading `.`/`#`, or a
  // combinator (`>`, `+`, `~`, space) fails here.
  if (!VALID_CLASS_TOKEN.test(value)) {
    diagnostics.push({
      code: RozieErrorCode.CLASS_SELECTOR_INVALID_TOKEN,
      severity: 'error',
      message: `$classSelector('${value}') must be a single bare class name — leading '.'/'#', whitespace, and combinators are not allowed (the helper returns the full selector itself).`,
      loc,
      hint: "Pass just the class token, e.g. $classSelector('grip') — not '.grip', 'a b', or 'a>b'.",
    });
    return;
  }

  // ----- Priority 3: ROZ966 — well-formed token, but not a declared class. ----
  if (!declared.has(value)) {
    const suggestion = didYouMean(value, [...declared]);
    diagnostics.push({
      code: RozieErrorCode.CLASS_SELECTOR_UNKNOWN_CLASS,
      severity: 'error',
      message: `$classSelector('${value}') references a class that is not declared in this component's <style> scope.`,
      loc,
      hint: suggestion
        ? `Did you mean '${suggestion}'?`
        : `Declare .${value} {} in your <style> block (an even-empty rule registers the class).`,
    });
    return;
  }
}

/**
 * Traverse a Babel AST node for `$classSelector` CallExpressions, validating
 * each. Wraps a bare Expression in a synthetic File so `@babel/traverse`
 * accepts it (the ExpressionStatement preserves the original node references);
 * a Program/File is traversed directly.
 *
 * Per D-08 every step is defensive — a malformed node silently yields no
 * diagnostics rather than throwing.
 */
function scanNode(
  node: t.Node | null | undefined,
  declared: Set<string>,
  diagnostics: Diagnostic[],
): void {
  if (!node) return;

  let root: t.File;
  try {
    if (t.isFile(node)) {
      root = node;
    } else if (t.isProgram(node)) {
      root = t.file(node);
    } else if (t.isExpression(node)) {
      // ExpressionStatement preserves the original Expression node references.
      root = t.file(t.program([t.expressionStatement(node)]));
    } else if (t.isStatement(node)) {
      // A BlockStatement (e.g. a $computed callback body) — wrap as an arrow
      // function body so it is reachable from a Program root.
      root = t.isBlockStatement(node)
        ? t.file(
            t.program([
              t.expressionStatement(t.arrowFunctionExpression([], node)),
            ]),
          )
        : t.file(t.program([node]));
    } else {
      return;
    }
  } catch {
    // Defensive — if a builder rejects the node, walk nothing.
    return;
  }

  try {
    traverse(root, {
      CallExpression(path) {
        const callee = path.node.callee;
        if (t.isIdentifier(callee) && callee.name === CLASS_SELECTOR_CALLEE) {
          validateCall(path.node, declared, diagnostics);
        }
      },
    });
  } catch {
    // Defensive — traverse failure must not abort lowering (D-08).
  }
}

/**
 * Validate every `$classSelector('<class>')` call in the component's IR.
 *
 * Scans three IR regions where a `$classSelector` call can appear:
 *   1. `ir.setupBody.scriptProgram`        — the `<script>` Babel Program. This
 *      ALSO covers every `$computed(() => …)` initializer body: `lowerScript`
 *      classifies declarators but does not splice the `$computed` variable
 *      declarator out of the Program, and `ComputedDecl.body` is a *reference*
 *      into `scriptProgram` (not a copy). A separate `ir.computed[].body` scan
 *      would re-visit the same nodes and push a byte-identical duplicate
 *      diagnostic for every `$classSelector` call inside a `$computed` body.
 *   2. `ir.template` `AttributeBinding`s   — `:attr="$classSelector('x')"`. The
 *      `AttributeBinding` kinds scanned are `binding` (`:attr="…"`),
 *      `twoWayBinding` (`r-model:prop="…"` RHS), and the `binding` segments of
 *      an `interpolated` attribute; `static` segments are literal text.
 *   3. `ir.listeners` `when` / `handler`   — `<listeners>` block + template @event.
 *
 * @param ir          - the lowered IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ965/966/967 pushed)
 */
export function validateClassSelector(
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  const declared = declaredScopedClasses(ir.styles);

  // (1) <script> Program.
  scanNode(ir.setupBody?.scriptProgram, declared, diagnostics);

  // (2) Template attribute expressions.
  walkTemplate(ir.template, (node) => {
    if (node.type === 'TemplateInterpolation') {
      scanNode(node.expression, declared, diagnostics);
      return;
    }
    if (node.type !== 'TemplateElement') return;
    for (const attr of node.attributes) {
      switch (attr.kind) {
        case 'binding':
        case 'twoWayBinding':
          scanNode(attr.expression, declared, diagnostics);
          break;
        case 'interpolated':
          for (const seg of attr.segments) {
            if (seg.kind === 'binding') {
              scanNode(seg.expression, declared, diagnostics);
            }
          }
          break;
        case 'static':
          break;
      }
    }
  });

  // (3) Listener when / handler expressions (<listeners> block + template @event).
  const scanListener = (listener: Listener): void => {
    scanNode(listener.when, declared, diagnostics);
    scanNode(listener.handler, declared, diagnostics);
  };
  for (const listener of ir.listeners) scanListener(listener);

  // (4) $computed initializer bodies — REMOVED: `ComputedDecl.body` is a
  // reference into `ir.setupBody.scriptProgram` (the `$computed` declarator is
  // never spliced out of the Program), so it is already scanned by region (1).
  // Scanning it again double-reported every `$classSelector` call inside a
  // `$computed` body with a byte-identical diagnostic (WR-01).
}
