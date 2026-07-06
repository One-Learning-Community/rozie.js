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
 * ## Item 5 (emitter-hardening backlog) — trailing `$expose` verb params
 *
 * A `$expose`'d verb's public contract commonly has a genuinely-optional
 * TRAILING refinement arg (`execute(action)` where most internal callers omit
 * `action`; `scrollNext(jump)` where the built-in nav buttons never pass
 * `jump`). Before this pass filled such a param `: any` — REQUIRED — so an
 * internal call with fewer args than declared (`execute()`, `scrollNext()`)
 * fails `TS2554` on whichever target actually body-typechecks the emitted
 * output (empirically: all six — every target clones this SAME neutralized
 * function node, they just differ in how strictly their own typecheck/lint
 * harness exercises it). The two shipped author-side workarounds this closes
 * (`packages/ui/captcha/src/RecaptchaV3.rozie`'s `action = null` default,
 * `packages/ui/embla/src/Carousel.rozie`'s raw-engine `navPrev`/`navNext`/
 * `navTo` bypass) both existed ONLY to dodge this.
 *
 * The optional `ir` parameter lets this pass see `ir.expose` + the exposed
 * function's OWN param list. For each exposed verb, `minInternalCallArity`
 * scans the whole script for internal `CallExpression`s naming that verb and
 * records the MINIMUM argument count observed. When that minimum is less
 * than the verb's declared param count, the params from that index onward
 * are eligible to lower `?: any` instead of `: any` (still residue-only — an
 * author-typed param in that range is left untouched, same as every other
 * guard in this file).
 *
 * Public-contract guard: this NEVER touches the verb's NAME (still resolved
 * by `ir.expose`), only its param optionality. A verb with NO internal call
 * evidence (never called internally — e.g. rete's `FlowCanvas.rozie`
 * `autoArrange`/`selectNode`/`centerOnNode`, exposed for CONSUMER use only)
 * or one called at full arity EVERYWHERE gets no mark — byte-identical to
 * the pre-item-5 pass (verified: rete needed no fix here, only captcha +
 * embla did — the backlog's premise named "rete" but the actual second
 * occurrence is embla; see 73-08-SUMMARY.md).
 *
 * `ir` is optional (omitted by pre-existing unit tests that construct a bare
 * `Program`/`File` with no `IRComponent` context) — when absent, this pass is
 * byte-identical to its pre-item-5 behavior.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { File } from '@babel/types';
import type { IRComponent } from '../ir/types.js';
import { collectExposedFunctionsByName } from './collectExposedFunctions.js';

// CJS interop normalization for @babel/traverse default export.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

/**
 * Fold `n` into `min` (the running minimum), returning the updated value.
 * `null` means "no evidence yet" — distinct from "called with 0 args".
 */
function foldMin(min: number | null, n: number): number {
  return min === null || n < min ? n : min;
}

/**
 * The minimum argument count observed across every internal `CallExpression`
 * naming `fnName` (a bare-identifier callee) anywhere in `file`'s `<script>`
 * AST. `null` when there is no such call.
 *
 * CR-02 fix (73-REVIEW.md, 73-10 gap-closure): a call only counts as
 * evidence when `fnName` resolves — via real scope/binding resolution — to
 * the SAME top-level declaration `collectExposedFunctionsByName` reads the
 * exposed verb's own param list off. Before this fix, a call was matched by
 * bare callee NAME alone, so an unrelated, differently-scoped local (e.g. a
 * same-named function PARAMETER belonging to a totally unrelated helper)
 * was indistinguishable from a genuine internal call to the exposed verb,
 * polluting the observed minimum arity.
 */
function minScriptCallArity(file: File, fnName: string): number | null {
  let min: number | null = null;
  traverse(file, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee) && callee.name === fnName) {
        const binding = path.scope.getBinding(fnName);
        // Only count this call if `fnName` resolves (in the call's own
        // scope chain) to a binding registered directly on the Program's
        // own scope — i.e. the SAME top-level declaration as the exposed
        // verb, not a shadowing local (function param, nested const, etc.).
        if (binding && binding.scope === path.scope.getProgramParent()) {
          min = foldMin(min, path.node.arguments.length);
        }
      }
    },
  });
  return min;
}

/**
 * The minimum argument count observed across every internal `CallExpression`
 * naming `fnName` anywhere in a single (possibly bare, non-Program)
 * Expression node — used for `ir.listeners[].handler`/`.when` (template
 * `@event` bindings + `<listeners>` entries lower to the SAME `Listener`
 * shape, D-20). This Expression is never part of a real `Program` (no
 * `File`/module-level scope exists for it), so `@babel/traverse`'s
 * scope/binding resolution — used by `minScriptCallArity` above — is not
 * available here. `null` when there is no such call.
 *
 * CR-02 fix (73-REVIEW.md, 73-10 gap-closure): a nested function's own
 * parameter (or a block-level `const`/`let`/`var`/function declaration) that
 * shares `fnName` SHADOWS the top-level exposed verb for that function's
 * entire subtree — a call to that shadowed local must never be folded into
 * the exposed verb's arity evidence. Since there is no real scope API to
 * consult, shadowing is tracked manually while walking: entering a
 * function or block adds every name it directly binds to the active shadow
 * set for its ENTIRE subtree. This is a conservative OVER-approximation
 * (mirrors the same discipline already used elsewhere in this codebase,
 * e.g. Solid's `collectReferencedNames` in emitScript.ts): at worst it
 * misses some genuine internal-call evidence — leaving a trailing param
 * required rather than optional, the SAFE direction — never the reverse.
 */
function minExpressionCallArity(
  expr: t.Node | null | undefined,
  fnName: string,
): number | null {
  if (!expr) return null;
  let min: number | null = null;

  const VISITOR_KEYS = (t as unknown as { VISITOR_KEYS: Record<string, string[]> })
    .VISITOR_KEYS;

  /** Names directly bound by `node` itself (not recursing into children). */
  const declaredNames = (node: t.Node): string[] => {
    const names: string[] = [];
    const collectPattern = (p: t.Node): void => {
      if (t.isIdentifier(p)) {
        names.push(p.name);
      } else if (t.isAssignmentPattern(p)) {
        collectPattern(p.left);
      } else if (t.isRestElement(p)) {
        collectPattern(p.argument);
      } else if (t.isObjectPattern(p)) {
        for (const prop of p.properties) {
          if (t.isObjectProperty(prop)) collectPattern(prop.value as t.Node);
          else if (t.isRestElement(prop)) collectPattern(prop.argument);
        }
      } else if (t.isArrayPattern(p)) {
        for (const el of p.elements) if (el) collectPattern(el);
      }
    };
    if (
      t.isFunctionExpression(node) ||
      t.isArrowFunctionExpression(node) ||
      t.isFunctionDeclaration(node)
    ) {
      for (const p of node.params) collectPattern(p);
      if (t.isFunctionDeclaration(node) && node.id) names.push(node.id.name);
    }
    if (t.isBlockStatement(node)) {
      for (const stmt of node.body) {
        if (t.isVariableDeclaration(stmt)) {
          for (const decl of stmt.declarations) collectPattern(decl.id);
        } else if (t.isFunctionDeclaration(stmt) && stmt.id) {
          names.push(stmt.id.name);
        }
      }
    }
    return names;
  };

  const walk = (node: unknown, shadowed: Set<string>): void => {
    if (!node || typeof node !== 'object' || typeof (node as t.Node).type !== 'string') return;
    const current = node as t.Node;

    let active = shadowed;
    const introduced = declaredNames(current);
    if (introduced.length > 0) {
      active = new Set(shadowed);
      for (const n of introduced) active.add(n);
    }

    if (
      t.isCallExpression(current) &&
      t.isIdentifier(current.callee) &&
      current.callee.name === fnName &&
      !active.has(fnName)
    ) {
      min = foldMin(min, current.arguments.length);
    }

    const keys = VISITOR_KEYS[current.type] ?? [];
    for (const key of keys) {
      const child = (current as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const c of child) walk(c, active);
      } else {
        walk(child, active);
      }
    }
  };

  walk(expr, new Set());
  return min;
}

/**
 * The minimum argument count observed across every internal call to
 * `fnName` — the `<script>` body AND every `ir.listeners[].handler`/`.when`
 * expression (template `@event="…"` bindings lower to `Listener.handler`,
 * D-20 — this is how embla's `Carousel.rozie` built-in nav buttons
 * (`@click="scrollNext()"`) are resolved; that call site is NOT part of
 * `ir.setupBody.scriptProgram` at all). `null` when there is no such call
 * anywhere — "no evidence" is deliberately distinct from "called with 0
 * args" (a zero-arg call site still counts as evidence; the absence of ANY
 * call does not).
 */
function minInternalCallArity(
  file: File,
  ir: IRComponent,
  fnName: string,
): number | null {
  let min = minScriptCallArity(file, fnName);
  for (const listener of ir.listeners) {
    const handlerMin = minExpressionCallArity(listener.handler, fnName);
    if (handlerMin !== null) min = foldMin(min, handlerMin);
    const whenMin = minExpressionCallArity(listener.when, fnName);
    if (whenMin !== null) min = foldMin(min, whenMin);
  }
  return min;
}

/**
 * For every `$expose`'d verb resolvable to a `<script>` function node,
 * compute the param INDEX from which trailing params are eligible for the
 * optional lowering (item 5) — the verb's own minimum internal call arity.
 * Absent from the returned Map when there is no internal-call evidence, or
 * when the verb is already called at full arity everywhere (no lowering
 * needed — byte-identical).
 */
function computeOptionalFromIndex(
  file: File,
  ir: IRComponent | undefined,
): Map<t.Node, number> {
  const out = new Map<t.Node, number>();
  if (!ir) return out;
  const fnsByName = collectExposedFunctionsByName(ir);
  for (const [name, fn] of fnsByName) {
    const minArity = minInternalCallArity(file, ir, name);
    if (minArity !== null && minArity < fn.params.length) {
      out.set(fn, minArity);
    }
  }
  return out;
}

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
 *
 * @param param - the param node to fill.
 * @param markOptional - item 5: also stamp `.optional = true` (`?: any`)
 *   instead of `: any`. Applied ONLY when this call is about to fill the
 *   annotation itself (residue-only — an already-typed param is never
 *   touched, matching every other guard in this file). A no-op for
 *   `RestElement` (already variadic; `?` on a rest param is a syntax error)
 *   and for `AssignmentPattern` (a default value is already optional for
 *   arity purposes — no `?` needed, and TS does not allow one there).
 */
function annotateParam(param: t.Node, markOptional = false): void {
  if (
    t.isIdentifier(param) ||
    t.isObjectPattern(param) ||
    t.isArrayPattern(param)
  ) {
    const wasUntyped = !param.typeAnnotation;
    if (wasUntyped) param.typeAnnotation = anyAnnotation();
    if (markOptional && wasUntyped && !param.optional) param.optional = true;
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
 * @param ir - item 5 (emitter-hardening backlog): the lowered component, used
 *   ONLY to resolve which top-level functions are `$expose`'d verbs and their
 *   internal call arities (see the file header). Optional — omitted by
 *   pre-existing unit tests that construct a bare `Program`/`File`; the pass
 *   is byte-identical to its pre-item-5 behavior when absent.
 */
export function typeNeutralizeScript(file: File, ir?: IRComponent): void {
  // Item 5 pre-pass (read-only, no mutation yet): for each `$expose`'d verb
  // with genuine fewer-arg internal-call evidence, the param index from which
  // trailing params should lower optional. Empty when `ir` is omitted or no
  // verb qualifies — the main traversal below then behaves exactly as before.
  const optionalFromIndex = computeOptionalFromIndex(file, ir);

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
      // Item 5 — is this Function node one of the exposed verbs qualifying
      // for trailing-optional lowering? `optionalFromIndex` is keyed by AST
      // node identity (the SAME nodes `collectExposedFunctionsByName` reads
      // off this very `file`/`ir.setupBody.scriptProgram`), so a direct Map
      // lookup on `path.node` is exact — no name re-matching needed.
      const fromIndex = optionalFromIndex.get(path.node);
      path.node.params.forEach((param, i) => {
        annotateParam(param, fromIndex !== undefined && i >= fromIndex);
      });
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
