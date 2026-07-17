/**
 * expandMemo — core source-to-source expansion of the `$memo(fn, keyFn)`
 * language primitive (Quick 260717-8zb).
 *
 * `$memo(fn, keyFn)` gives component-library authors a uniform, Vue-natural
 * reference-keyed memoization primitive — the same "read every reactive input
 * up front, compare by reference, return the cached value on a hit" pattern
 * engine-wrapper authors were already hand-rolling (the Combobox `foCache`
 * motivating case).
 *
 * A well-formed top-level declaration:
 *
 *   const X = $memo(() => { ...compute... }, () => [a, b, c]);
 *
 * is REPLACED (in place, on the SAME `Program` node every emitter clones —
 * IR-04 referential preservation) with two top-level declarations:
 *
 *   const XCache = { keys: null as any[] | null, val: null as any };
 *   const X = () => {
 *     const __rozieMemoKey = [a, b, c];           // keyFn body, inlined
 *     const __rozieMemoPrev = XCache.keys;
 *     if (
 *       __rozieMemoPrev !== null &&
 *       __rozieMemoPrev.length === __rozieMemoKey.length &&
 *       __rozieMemoKey.every((v, i) => v === __rozieMemoPrev[i])
 *     ) {
 *       return XCache.val;
 *     }
 *     const __rozieMemoVal = (...compute...);     // fn body, inlined
 *     XCache.keys = __rozieMemoKey;
 *     XCache.val = __rozieMemoVal;
 *     return __rozieMemoVal;
 *   };
 *
 * DESIGN — strict-null-check safety (the listbox-solid/lit lesson). keys-null
 * IS the miss sentinel: there is deliberately NO separate `has` boolean —
 * `has && XCache.keys.length` leaves `.keys` possibly-null to strict tsc, and
 * member-expression narrowing does not survive into the `.every` callback
 * (TS18047 on every strict-enforced leaf). Instead the cached key is captured
 * to a LOCAL (`__rozieMemoPrev`) and the guard is `!== null` on that local —
 * a `const` narrows once and stays narrowed inside the closure. The two null
 * initializers carry `as`-casts (`null as any[] | null`, `null as any`) so the
 * inferred property types admit the miss-path assignments — unconditionally,
 * since every emitted leaf is TS-flavored whatever the source `lang` (vue/svelte
 * leaves emit `lang="ts"`; the other four are .ts/.tsx files) and strict-enforced
 * leaf tsconfigs need them. The casts sit on the PROPERTY VALUES — never a
 * TSTypeAnnotation on the declarator id — so every downstream id-shape-matching
 * pass (React's mutated-instance useMemo stabilizer above all) keeps seeing a
 * bare `const XCache = {…}` ObjectExpression init.
 *
 * DESIGN — subscribe-first discipline (load-bearing): `keyFn` is evaluated
 * UNCONDITIONALLY at the top of the wrapper, BEFORE the cache-hit check. Its
 * reads are therefore the fine-grained reactive SUBSCRIPTION surface on
 * Solid/Svelte/Vue (a signal/rune/ref read only counts if it actually
 * executes) — this is exactly the "read every reactive input at the top
 * before the early return" discipline the hand-rolled Combobox `foCache`
 * already relied on, just relocated out of the MISS-path fn body into keyFn.
 *
 * DESIGN — React needs NO per-target `$memo` code. The emitted `XCache` is a
 * top-level `const` initialized to an ObjectExpression that is then
 * MEMBER-MUTATED (`XCache.keys = …`, `XCache.val = …`) —
 * exactly the shape `collectMutatedInstanceBinders` /
 * `tryWrapMutatedInstanceUseMemo` (packages/targets/react/src/emit/emitScript.ts,
 * feedback_react_const_mutinstance_not_stabilized) already detects and wraps
 * in `useMemo(() => ({...}), [])` — the EXISTING machinery picks it up for
 * free. The wrapper `X` is left as a plain function, called `()` from
 * anywhere it's read (template or script) — same shape as today's
 * `filteredOptions()` idiom. The 5 setup-once targets keep both `XCache` and
 * `X` as ordinary top-level consts (setup runs once; the closure persists).
 *
 * DESIGN — byte-level no-op guarantee. This pass performs a SINGLE shallow
 * scan of `program.program.body` for well-formed top-level `$memo` const
 * declarators. When none are found, `program` is NOT touched in any way
 * (no clone, no re-serialization, zero mutation) — a script with no `$memo`
 * call is provably byte-identical before/after this pass runs.
 *
 * DESIGN — misuse is left ENTIRELY alone. Only the exact well-formed shape
 * (top-level `const`, single declarator, `$memo(arrowFn, arrowFn)` with
 * EXACTLY two arrow-function arguments) is recognized and expanded. Any other
 * shape — `let`-bound, multi-declarator, wrong arity, non-arrow args, or a
 * `$memo` call nested inside a function body — is left as a literal `$memo`
 * CallExpression in the AST. `memoValidator.ts` runs AFTER this pass (from
 * `analyzeAST`, later in the `lowerToIR` pipeline) and treats ANY remaining
 * `$memo` identifier callee as, by construction, a misuse — emitting ROZ146.
 * This two-pass split means expandMemo never needs its own diagnostics path;
 * it is a pure, collected-not-thrown (D-08) AST transform.
 *
 * Runs in `lowerToIR`, immediately after `inlineScriptPartials` and BEFORE
 * `analyzeAST` — mirroring where `inlineScriptPartials` is wired — so every
 * entrypoint that shares the `lowerToIR` chokepoint (`compile()` AND
 * `@rozie/unplugin`, which bypasses `compile()`) inherits the expansion, and
 * the dep-graph/binder/all six target emitters observe the ALREADY-EXPANDED
 * shape (two ordinary top-level consts) rather than a `$memo` call they'd
 * otherwise have no per-target lowering for.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { File } from '@babel/types';

/** The reserved sigil name recognized as the `$memo` primitive. */
const MEMO_SIGIL = '$memo';

/** Cache-object field names — kept as named constants so the shape below reads clearly. */
const KEYS_FIELD = 'keys';
const VAL_FIELD = 'val';

/** Internal wrapper-local names for the inlined keyFn/fn results. Namespaced
 *  `__rozieMemo*` to avoid colliding with author locals inside fn/keyFn
 *  bodies (mirrors the project's `__rozie`-prefixed generated-name convention
 *  — `__rozieRoot`, `__rozieCtx*`, etc.). */
const KEY_LOCAL = '__rozieMemoKey';
const VAL_LOCAL = '__rozieMemoVal';
const PREV_LOCAL = '__rozieMemoPrev';

export interface ExpandMemoResult {
  /** Author-facing names of every `$memo` declarator that was expanded, in
   *  source order. Empty when the script contained no well-formed `$memo`
   *  call — the byte-no-op case. */
  expandedNames: string[];
}

/** Is `init` a call to the `$memo` sigil (any arity/arg-shape)? */
function isMemoCall(init: t.Expression | null | undefined): init is t.CallExpression {
  return (
    !!init &&
    t.isCallExpression(init) &&
    t.isIdentifier(init.callee) &&
    init.callee.name === MEMO_SIGIL
  );
}

/**
 * Is `stmt` a WELL-FORMED top-level `$memo` declaration: a single-declarator
 * `const X = $memo(fnArrow, keyFnArrow)` with EXACTLY two arrow-function
 * arguments? Anything else (wrong `kind`, multi-declarator, wrong arity,
 * non-arrow args) returns false — left untouched for `memoValidator` to flag.
 */
function isWellFormedMemoDecl(stmt: t.Statement): stmt is t.VariableDeclaration {
  if (!t.isVariableDeclaration(stmt)) return false;
  if (stmt.kind !== 'const') return false;
  if (stmt.declarations.length !== 1) return false;
  const decl = stmt.declarations[0]!;
  if (!t.isIdentifier(decl.id)) return false;
  if (!isMemoCall(decl.init)) return false;
  const call = decl.init;
  if (call.arguments.length !== 2) return false;
  return call.arguments.every((a) => t.isArrowFunctionExpression(a));
}

/**
 * Inline an arrow function's body as a single Expression. An expression-body
 * arrow (`() => [a, b]`) inlines its body directly. A block-body arrow
 * (`() => { ...; return x }`) is wrapped as an IIFE (`(() => { ... })()`) so
 * arbitrary statement logic (loops, intermediate `const`s, early returns) is
 * preserved verbatim — the same "inline verbatim from author AST, no eval, no
 * string interpolation" contract as every other Rozie sigil lowering.
 */
function inlineArrowAsExpression(fn: t.ArrowFunctionExpression): t.Expression {
  if (t.isBlockStatement(fn.body)) {
    const iife = t.callExpression(
      t.arrowFunctionExpression([], t.cloneNode(fn.body, true)),
      [],
    );
    if (fn.loc) iife.loc = fn.loc;
    return iife;
  }
  return t.cloneNode(fn.body, true);
}

/** Copy `loc`/`start`/`end` from `from` onto `to` (best-effort source-map preservation). */
function copyLoc<T extends t.Node>(to: T, from: t.Node): T {
  if (from.loc) to.loc = from.loc;
  if (from.start != null) to.start = from.start;
  if (from.end != null) to.end = from.end;
  return to;
}

/**
 * Build the two replacement declarations for one well-formed `$memo` decl.
 * Returns `[cacheDecl, wrapperDecl]` in emit order.
 */
function buildMemoExpansion(
  name: string,
  fnArrow: t.ArrowFunctionExpression,
  keyFnArrow: t.ArrowFunctionExpression,
  sourceStmt: t.VariableDeclaration,
): [t.VariableDeclaration, t.VariableDeclaration] {
  const cacheName = `${name}Cache`;

  // const XCache = { keys: null as any[] | null, val: null as any };
  // `as`-casts on the PROPERTY VALUES only (see the strict-null-check DESIGN
  // note above). Unconditional — EVERY emitted leaf is TS-flavored regardless
  // of the source script's lang (vue emits `<script setup lang="ts">`, svelte
  // `<script lang="ts">`, react/solid `.tsx`, angular/lit `.ts`), so the casts
  // are always valid and always required by strict-null-checked leaf tsconfigs.
  const keysInit: t.Expression = t.tsAsExpression(
    t.nullLiteral(),
    t.tsUnionType([t.tsArrayType(t.tsAnyKeyword()), t.tsNullKeyword()]),
  );
  const valInitNull: t.Expression = t.tsAsExpression(t.nullLiteral(), t.tsAnyKeyword());
  const cacheObject = t.objectExpression([
    t.objectProperty(t.identifier(KEYS_FIELD), keysInit),
    t.objectProperty(t.identifier(VAL_FIELD), valInitNull),
  ]);
  const cacheDecl = t.variableDeclaration('const', [
    t.variableDeclarator(t.identifier(cacheName), cacheObject),
  ]);
  copyLoc(cacheDecl, sourceStmt);

  // const __rozieMemoKey = <keyFn body inlined>;
  const keyInit = inlineArrowAsExpression(keyFnArrow);
  const keyDecl = t.variableDeclaration('const', [
    t.variableDeclarator(t.identifier(KEY_LOCAL), keyInit),
  ]);

  // const __rozieMemoPrev = XCache.keys;
  // Local capture — the ONLY read of `.keys` on the hit path. Strict tsc
  // narrows a `const` once via the `!== null` guard and the narrowing survives
  // into the `.every` closure; a member-expression read there would not.
  const prevDecl = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(PREV_LOCAL),
      t.memberExpression(t.identifier(cacheName), t.identifier(KEYS_FIELD)),
    ),
  ]);

  // Cache-hit test: __rozieMemoPrev !== null && __rozieMemoPrev.length ===
  //   __rozieMemoKey.length && __rozieMemoKey.every((v, i) => v === __rozieMemoPrev[i])
  const prevNotNullExpr = t.binaryExpression('!==', t.identifier(PREV_LOCAL), t.nullLiteral());
  const lengthMatchExpr = t.binaryExpression(
    '===',
    t.memberExpression(t.identifier(PREV_LOCAL), t.identifier('length')),
    t.memberExpression(t.identifier(KEY_LOCAL), t.identifier('length')),
  );
  const everyCallback = t.arrowFunctionExpression(
    [t.identifier('v'), t.identifier('i')],
    t.binaryExpression(
      '===',
      t.identifier('v'),
      t.memberExpression(t.identifier(PREV_LOCAL), t.identifier('i'), true),
    ),
  );
  const everyExpr = t.callExpression(
    t.memberExpression(t.identifier(KEY_LOCAL), t.identifier('every')),
    [everyCallback],
  );
  const hitTest = t.logicalExpression(
    '&&',
    t.logicalExpression('&&', prevNotNullExpr, lengthMatchExpr),
    everyExpr,
  );
  const hitReturn = t.ifStatement(
    hitTest,
    t.blockStatement([
      t.returnStatement(
        t.memberExpression(t.identifier(cacheName), t.identifier(VAL_FIELD)),
      ),
    ]),
  );

  // const __rozieMemoVal = <fn body inlined>;
  const valInit = inlineArrowAsExpression(fnArrow);
  const valDecl = t.variableDeclaration('const', [
    t.variableDeclarator(t.identifier(VAL_LOCAL), valInit),
  ]);

  // XCache.keys = __rozieMemoKey; XCache.val = __rozieMemoVal; XCache.has = true;
  const assignKeys = t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier(cacheName), t.identifier(KEYS_FIELD)),
      t.identifier(KEY_LOCAL),
    ),
  );
  const assignVal = t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier(cacheName), t.identifier(VAL_FIELD)),
      t.identifier(VAL_LOCAL),
    ),
  );
  const finalReturn = t.returnStatement(t.identifier(VAL_LOCAL));

  const wrapperBody = t.blockStatement([
    keyDecl,
    prevDecl,
    hitReturn,
    valDecl,
    assignKeys,
    assignVal,
    finalReturn,
  ]);
  const wrapperArrow = t.arrowFunctionExpression([], wrapperBody);
  const wrapperDecl = t.variableDeclaration('const', [
    t.variableDeclarator(t.identifier(name), wrapperArrow),
  ]);
  copyLoc(wrapperDecl, sourceStmt);

  return [cacheDecl, wrapperDecl];
}

/**
 * Expand every well-formed top-level `$memo(fn, keyFn)` declaration in
 * `program`'s top-level body IN PLACE. Mutates `program.program.body` only
 * when at least one well-formed `$memo` declarator is found — otherwise the
 * program is left byte-identically untouched (no clone, no walk beyond the
 * initial top-level scan).
 *
 * Never throws (D-08 collected-not-thrown) — a malformed shape is simply
 * left alone for `memoValidator` to flag downstream.
 */
export function expandMemo(program: File): ExpandMemoResult {
  const body = program.program.body;

  // Fast, cheap top-level scan — no full-program traverse needed since $memo
  // is only ever recognized at top-level const position.
  const targets: Array<{ index: number; name: string; stmt: t.VariableDeclaration }> = [];
  for (let i = 0; i < body.length; i++) {
    const stmt = body[i]!;
    if (!isWellFormedMemoDecl(stmt)) continue;
    const decl = stmt.declarations[0]!;
    const name = (decl.id as t.Identifier).name;
    targets.push({ index: i, name, stmt });
  }

  if (targets.length === 0) return { expandedNames: [] };

  const expandedNames: string[] = [];
  // Build the replacement body by walking the original statements in order,
  // splicing in the two-declaration expansion wherever a target sits.
  const newBody: t.Statement[] = [];
  const targetByIndex = new Map(targets.map((t2) => [t2.index, t2]));
  for (let i = 0; i < body.length; i++) {
    const target = targetByIndex.get(i);
    if (!target) {
      newBody.push(body[i]!);
      continue;
    }
    const call = (target.stmt.declarations[0]!.init as t.CallExpression);
    const fnArrow = call.arguments[0] as t.ArrowFunctionExpression;
    const keyFnArrow = call.arguments[1] as t.ArrowFunctionExpression;
    const [cacheDecl, wrapperDecl] = buildMemoExpansion(
      target.name,
      fnArrow,
      keyFnArrow,
      target.stmt,
    );
    newBody.push(cacheDecl, wrapperDecl);
    expandedNames.push(target.name);
  }
  program.program.body = newBody;

  return { expandedNames };
}
