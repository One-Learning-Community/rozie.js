/**
 * typeNeutralizeScript — make a `<script>` Babel program emit type-correct
 * TypeScript by filling ONLY the untyped residue, preserving author types.
 *
 * ## Why this exists
 *
 * Every emitter wraps the `<script>` body in a TYPED component shell
 * (props/emits/slots are typed by the emitter, the consumer's project
 * type-checks the emitted output). A `<script>` whose logic is not fully typed
 * — an engine instance held in `let editor = null`, untyped callback params —
 * emits type-BROKEN TypeScript on ALL SIX targets:
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
 * ## What this pass does — residue-only contract
 *
 * It annotates only the UNTYPED residue with an EXPLICIT `any`. Explicit `any`
 * is legal under every `strict` setting — only *implicit* any errors. The four
 * per-node visitors each guard on `typeAnnotation` presence, so an
 * author-written annotation is ALWAYS preserved verbatim:
 *
 *   - untyped function / arrow / method / catch params → `: any`
 *     (rest params → `: any[]`); a param the author typed is left alone.
 *   - `let` / `var` declarators initialised to `null` / `undefined`
 *     → `id: any`; a declarator the author typed (`let editor: Editor | null`)
 *     is left alone via the `if (decl.id.typeAnnotation) continue;` guard.
 *   - `for (… of <expr>)` → `for (… of (<expr> as any))` so the loop variable
 *     is `any` rather than `unknown` — but ONLY for non-TypeScript scripts (see
 *     the `isTypeScript` parameter below).
 *
 * It deliberately leaves the component's PUBLIC surface alone — that is
 * already typed by each emitter (`defineProps<T>()`, `@Input()`, etc.). This
 * keeps TypeScript OPTIONAL for `<script>` authors while letting a
 * `<script lang="ts">` author own as much of the internal typing as they like.
 *
 * ## The `ForOfStatement` wrap is per-statement, not lang-gated (WR-05)
 *
 * `for (const f of <iterable>)` over an `any`/`unknown`-producing iterable
 * (`Array.from(someAny)`) widens `f` to `unknown` → TS18046 on every member
 * access. A for-of loop variable cannot carry a type annotation, so the pass
 * neutralizes the ITERABLE instead: `for (const f of (<expr> as any))`.
 *
 * The decision is PER-`ForOfStatement`. An earlier design lang-gated the wrap
 * — skipping it wholesale for `<script lang="ts">` — but that was too coarse: a
 * typed script can still contain a genuinely-untyped iterable, and suppressing
 * the wrap there reintroduces the TS18046 hazard. The pass has NO type
 * information, so it cannot distinguish a typed iterable from an untyped one;
 * the one signal it can read syntactically is whether the author already
 * asserted the iterable's type (`as T` / `<T>expr`). The wrap is therefore
 * applied to EVERY for-of iterable — typed and untyped scripts alike — and
 * skipped ONLY when `right` is already an author assertion (wrapping it `as
 * any` would downgrade an author-owned type, and the skip also makes the pass
 * idempotent). For the untyped DEFAULT / FALLBACK path this is byte-identical
 * to the pre-Phase-9 pass — the 264-cell dist-parity gate depends on it.
 *
 * The four `typeAnnotation`-guarded visitors run identically for typed and
 * untyped scripts — they already fill only the residue.
 *
 * ## Contract
 *
 * Mutates `file` in place. `lowerToIR` runs this on `ir.setupBody.scriptProgram`
 * for BOTH typed and untyped scripts, AFTER lowering and BEFORE any emitter —
 * every per-target emitter clones from that program (or from IR nodes that are
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

/**
 * True when `fn` (an arrow or function expression) is CONTEXTUALLY typed by
 * the annotation on the `id` of its enclosing `VariableDeclarator` — i.e. the
 * declaration is `const f: (a: A) => R = (a) => {…}`. In that shape the
 * declarator's function-type annotation supplies the types of `a` (and the
 * return), so the arrow's params are NOT untyped residue — stamping `: any` on
 * them would *override* the contextual typing and silently discard the
 * author's `A`.
 *
 * Precision: this is true ONLY when the declarator's `id.typeAnnotation` is a
 * genuine function type (`TSFunctionType`). A non-function declarator
 * annotation — `const f: SomeObject = (a) => {…}` (a type error the author
 * owns) — does NOT contextually type the params, so it must NOT suppress the
 * `: any` fill. Constructor types (`TSConstructorType`) are deliberately out of
 * scope: a `new`-able type does not contextually type a plain arrow.
 */
function isContextuallyTypedByDeclarator(path: { parent: t.Node }): boolean {
  const parent = path.parent;
  if (!t.isVariableDeclarator(parent)) return false;
  if (!t.isIdentifier(parent.id)) return false;
  const ann = parent.id.typeAnnotation;
  if (!ann || !t.isTSTypeAnnotation(ann)) return false;
  return t.isTSFunctionType(ann.typeAnnotation);
}

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
 * Annotate the untyped residue of a `<script>` `file` with explicit `any`,
 * preserving any author-written annotations. See the file header for the
 * rationale, the residue-only contract, and the exact set of transforms.
 *
 * Identical for typed (`<script lang="ts">`) and untyped scripts: every
 * per-node visitor — including the `ForOfStatement` `as any` wrap (WR-05) — is
 * residue-only and the residue is detected syntactically, so the source
 * block's `lang` does not change behavior.
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
      // ROOT CAUSE 1 (WR-01 adjacent): when an arrow / function expression is
      // the `init` of a `VariableDeclarator` whose `id` carries a function-type
      // annotation — `const f: (e: MouseEvent) => void = (e) => {…}` — the
      // arrow's params are CONTEXTUALLY typed by that declarator annotation.
      // They are not untyped residue; stamping `: any` would override the
      // author's `MouseEvent` and silently drop it. Leave such params bare so
      // the contextual typing survives. (A param the author typed DIRECTLY —
      // `const f = (e: MouseEvent) => {…}` — is already left alone by
      // `annotateParam`'s `typeAnnotation` guard; that path is unaffected.)
      if (
        (t.isArrowFunctionExpression(path.node) ||
          t.isFunctionExpression(path.node)) &&
        isContextuallyTypedByDeclarator(path)
      ) {
        return;
      }
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
    //
    // Phase 9 WR-05 — the decision is PER-`ForOfStatement`, not whole-script.
    // The earlier `if (isTypeScript) return;` whole-script bailout was too
    // coarse: a `<script lang="ts">` script can contain a genuinely-untyped
    // iterable (`for (const f of Array.from(someAny))`) that still widens `f`
    // to `unknown` (TS18046) — the `unknown`-defeating wrap is just as needed
    // there as in an untyped script. The pass has NO type information, so it
    // cannot tell a typed iterable from an untyped one; the one signal it CAN
    // read syntactically is whether the author already asserted the iterable's
    // type themselves. So: skip the wrap ONLY when `right` is already an `as`
    // / `<T>` assertion the author wrote — in that case the author owns the
    // element type and wrapping it `as any` would *downgrade* it. Every other
    // iterable is wrapped, in typed and untyped scripts alike.
    ForOfStatement(path) {
      // Only when the head DECLARES the loop variable — `for (existing of …)`
      // reuses an outer binding whose type is already settled.
      if (!t.isVariableDeclaration(path.node.left)) return;
      const right = path.node.right;
      // Skip when the author already asserted the iterable's type
      // (`as T` / `<T>expr`) — the author owns it; wrapping `as any` would
      // downgrade it. This also makes the pass idempotent (a second run sees
      // its own `as any` wrap and leaves it alone).
      if (t.isTSAsExpression(right) || t.isTSTypeAssertion(right)) return;
      path.node.right = t.tsAsExpression(right, t.tsAnyKeyword());
    },
  });
}
