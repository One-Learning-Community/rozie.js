/**
 * typeNeutralizeScript — make an untyped `<script>` Babel program emit
 * type-NEUTRAL TypeScript.
 *
 * ## Why this exists
 *
 * Rozie parses `<script>` as plain JavaScript — `parseScript.ts` sets
 * `plugins: []` (the `typescript` plugin is intentionally NOT enabled;
 * `<script lang="ts">` is a deferred Phase-2+ opt-in). An author therefore
 * cannot type-annotate `<script>` logic.
 *
 * That is fine for trivial components, but every emitter wraps the `<script>`
 * body in a TYPED component shell (props/emits/slots are typed by the emitter,
 * the consumer's project type-checks the emitted output). Non-trivial
 * engine-wrapper components — an engine instance held in `let editor = null`,
 * untyped callback params — then emit type-BROKEN TypeScript on ALL SIX
 * targets:
 *
 *   - `let editor = null`            → declarator/field typed `null` →
 *                                      `editor = new Editor()` is TS2322,
 *                                      every `editor.method()` is TS2339
 *                                      ("Property X does not exist on `never`").
 *   - untyped `(ch) => …`            → TS7006 ("implicitly has an 'any' type").
 *   - `for (const f of Array.from(x))` → `f` is `unknown` (`Array.from()` over
 *                                      an `any`/`unknown` widens to
 *                                      `unknown[]`) → TS18046.
 *   - `catch (err) { err.message }`  → `err` is `unknown` (strict-mode
 *                                      `useUnknownInCatchVariables`) → TS18046.
 *
 * React/Vue/Svelte/Solid/Lit only RUN because esbuild strips types — but
 * `tsc` / `vue-tsc` / `svelte-check` flag the identical errors, and Angular's
 * AOT compiler type-checks as part of the build, so a type-broken component
 * fails `ng build` outright.
 *
 * ## What this pass does
 *
 * It annotates those untyped constructs with an EXPLICIT `any`. Explicit `any`
 * is legal under every `strict` setting — only *implicit* any errors. The
 * result type-checks clean with NO author annotations:
 *
 *   - untyped function / arrow / method / catch params → `: any`
 *     (rest params → `: any[]`).
 *   - `let` / `var` declarators initialised to `null` / `undefined`
 *     → `id: any`.
 *   - `for (… of <expr>)` → `for (… of (<expr> as any))` so the loop
 *     variable is `any` rather than `unknown`.
 *
 * It deliberately leaves the component's PUBLIC surface alone — that is
 * already typed by each emitter (`defineProps<T>()`, `@Input()`, etc.). This
 * keeps TypeScript fully OPTIONAL for `<script>` authors. Implementing
 * `<script lang="ts">` (author-written internal types) remains a separate
 * Phase-2+ opt-in enhancement layered on top of this pass — NOT a substitute
 * for it, NOT a requirement.
 *
 * ## Contract
 *
 * Mutates `file` in place. The compile pipeline runs this on
 * `ir.setupBody.scriptProgram` AFTER lowering and BEFORE any emitter — every
 * per-target emitter clones from that program (or from IR nodes that are
 * references into it), so all six inherit the neutralized AST from a single
 * call site. Idempotent: every annotation is guarded on absence, so a second
 * run is a no-op.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { File } from '@babel/types';

// CJS interop normalization for @babel/traverse default export.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

/** A fresh `: any` annotation node (callers must not share node identity). */
const anyAnnotation = (): t.TSTypeAnnotation =>
  t.tsTypeAnnotation(t.tsAnyKeyword());

/** A fresh `: any[]` annotation node — used for rest params (`...args`). */
const anyArrayAnnotation = (): t.TSTypeAnnotation =>
  t.tsTypeAnnotation(t.tsArrayType(t.tsAnyKeyword()));

/**
 * Annotate a single function/method parameter so it does not trip TS7006 /
 * TS7031 (implicit-any) under `noImplicitAny`.
 *
 *   - `Identifier` / `ObjectPattern` / `ArrayPattern` → `: any`
 *   - `RestElement` (`...args`)                       → `: any[]`
 *   - `AssignmentPattern` (`x = 5`)                   → the default value
 *     supplies the type, so a plain Identifier left needs nothing; only a
 *     destructuring left (`{ a } = {}`) still needs `: any` because the
 *     default does not name element types.
 *
 * Idempotent — skips any node that already carries a `typeAnnotation`.
 */
function annotateParam(param: t.Node): void {
  if (
    t.isIdentifier(param) ||
    t.isObjectPattern(param) ||
    t.isArrayPattern(param)
  ) {
    if (!param.typeAnnotation) param.typeAnnotation = anyAnnotation();
    return;
  }
  if (t.isRestElement(param)) {
    if (!param.typeAnnotation) param.typeAnnotation = anyArrayAnnotation();
    return;
  }
  if (t.isAssignmentPattern(param)) {
    const left = param.left;
    if (
      (t.isObjectPattern(left) || t.isArrayPattern(left)) &&
      !left.typeAnnotation
    ) {
      left.typeAnnotation = anyAnnotation();
    }
  }
  // TSParameterProperty and any other shape: plain JS `<script>` cannot
  // produce them, so there is nothing to do.
}

/**
 * Annotate every untyped `<script>` construct in `file` with explicit `any`.
 * See the file header for the rationale and the exact set of transforms.
 *
 * @param file - a Babel `File` the caller owns and may mutate (the compile
 *   pipeline passes `ir.setupBody.scriptProgram`).
 */
export function typeNeutralizeScript(file: File): void {
  traverse(file, {
    // `Function` is the Babel alias covering ArrowFunctionExpression,
    // FunctionExpression, FunctionDeclaration, ObjectMethod, ClassMethod,
    // and ClassPrivateMethod — i.e. every params-bearing node.
    Function(path) {
      for (const param of path.node.params) annotateParam(param);
    },

    // `catch (err)` binds `err` as `unknown` under strict-mode
    // `useUnknownInCatchVariables`; `catch (err: any)` is legal TS.
    CatchClause(path) {
      const param = path.node.param;
      if (
        param &&
        (t.isIdentifier(param) ||
          t.isObjectPattern(param) ||
          t.isArrayPattern(param)) &&
        !param.typeAnnotation
      ) {
        param.typeAnnotation = anyAnnotation();
      }
    },

    // `let editor = null` / `let x = undefined` infer the too-narrow type
    // `null` / `undefined`; the engine-wrapper pattern then reassigns the
    // binding to a real object. `const` cannot be reassigned (no widening
    // bug); a no-init `let x;` is already an evolving-`any` in TS — both are
    // left alone. Declarator ids inside a `for (… of …)` head have no init,
    // so they are naturally skipped (and could not be annotated anyway —
    // `for (const x: any of …)` is a syntax error; see ForOfStatement below).
    VariableDeclaration(path) {
      if (path.node.kind === 'const') return;
      for (const decl of path.node.declarations) {
        if (!t.isIdentifier(decl.id)) continue;
        if (decl.id.typeAnnotation) continue;
        const init = decl.init;
        const isNullish =
          init != null &&
          (t.isNullLiteral(init) ||
            (t.isIdentifier(init) && init.name === 'undefined'));
        if (isNullish) decl.id.typeAnnotation = anyAnnotation();
      }
    },

    // `for (const f of Array.from(x))` — `Array.from()` over an `any`/`unknown`
    // widens to `unknown[]`, so `f` is `unknown` → TS18046 on every member
    // access. A for-of loop variable cannot carry a type annotation, so we
    // neutralize the iterable instead: `for (const f of (<expr> as any))`
    // makes `f` an `any`. `as any` is the universally-legal assertion (unlike
    // `as any[]`, which TS rejects when the source is a typed non-array).
    ForOfStatement(path) {
      // Only when the head DECLARES the loop variable — `for (existing of …)`
      // reuses an outer binding whose type is already settled.
      if (!t.isVariableDeclaration(path.node.left)) return;
      const right = path.node.right;
      // Idempotent — leave an already-asserted iterable alone.
      if (t.isTSAsExpression(right) || t.isTSTypeAssertion(right)) return;
      path.node.right = t.tsAsExpression(right, t.tsAnyKeyword());
    },
  });
}
