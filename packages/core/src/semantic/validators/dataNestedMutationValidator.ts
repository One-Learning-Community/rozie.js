/**
 * Spike-012 R8 / ROZ207 — Nested-`$data`-mutation reactivity validator.
 *
 * Detects an IN-PLACE mutation of NESTED `$data` state, which is SILENTLY
 * non-reactive on React/Solid/Angular/Lit (the mutation persists but no re-render
 * fires) while working on Vue/Svelte (deep reactivity):
 *
 *   - React lowers `$data.obj.field = 5` to `obj.field = 5` — mutates the
 *     `useState` value WITHOUT calling `setObj`, so React never re-renders.
 *   - Solid → `obj().field = 5`, Angular → `this.obj().field = 5` — read the
 *     signal, then mutate its object; the signal's `.set()` is never called.
 *   - Lit → `this._obj.value.field = 5` — no `requestUpdate`.
 *
 * The shallow `$data.x = y` write DOES lower to a reactive setter; only nested /
 * method mutation one level deeper escapes. The portable fix is a whole-object-
 * replace of the TOP-LEVEL key (`$data.obj = { ...$data.obj, field: … }`), which
 * lowers to a reactive setter on all six targets — the exact pattern DataTable,
 * MapLibre, and rete already adopted (and documented) to dodge this. Uniform (the
 * source is target-agnostic and the goal is one-source-six-working-targets): a Vue-
 * authored deep mutation silently breaks when compiled to React, so flagging it
 * everywhere upholds Rozie's cross-target promise.
 *
 * quick 260718-uvq — PARTIAL make-it-work: a statically-analyzable COVERED subset
 * now LOWERS reactively on React/Solid/Angular/Lit (each target emits an
 * immutable single-key replace), so ROZ207 EXEMPTS exactly that subset while
 * still failing loud on everything else. The exemption predicate here MUST match
 * the four targets' `detectCoveredNestedAssign` / `detectCoveredArrayMutation`
 * EXACTLY (coherence invariant): no shape is exempted in core that any target
 * leaves non-reactive.
 *
 * quick 260830-m30 — the DYNAMIC-KEY REGISTRY PAIR. `$data.reg[id] = spec` and
 * `delete $data.reg[id]` — the id-keyed register/unregister idiom — now lower
 * reactively on all four targets, and a `UnaryExpression` (`delete`) visitor was
 * added here. Until then this validator had NO delete visitor at all, so every
 * nested `delete` produced ZERO diagnostics while being silently non-reactive on
 * four targets — precisely the divergence ROZ207 exists to prevent.
 *
 * THE INITIALIZER GATE (D2). A computed depth-2 write is ambiguous between an
 * array index and an object dynamic key. Resolve it from the DECLARED `<data>`
 * initializer rather than from the key's literal type:
 *
 *   | init kind | `$data.k[E] = rhs`                    | `delete $data.k[E]` |
 *   |-----------|---------------------------------------|---------------------|
 *   | object    | `{ ...prev, [E]: rhs }`               | clone-then-delete   |
 *   | array     | `prev.map(…)`, non-string key only    | FLAGGED (hole)      |
 *   | other     | FLAGGED                               | FLAGGED             |
 *
 * The gate RESOLVES the "ambiguous array vs object" objection this header used
 * to cite as the reason dynamic keys were excluded: the ambiguity was never in
 * the key, it was in the container, and the container's declared initializer
 * answers it statically.
 *
 * CW-INDEX RETROFIT. The old CW-INDEX path exempted ANY numeric-literal index,
 * so `$data.obj[0] = x` with `obj: {}` emitted `{}.map(...)` — a runtime
 * TypeError, i.e. silently-wrong emitted code INSIDE the exempt subset, which is
 * strictly worse than a loud error. It now takes the object lowering, and a
 * numeric index on a non-literal initializer is newly FLAGGED.
 *
 * COVERED (EXEMPT — statement-context only, `<key>` a declared `<data>` key):
 *   - CW-MEMBER   `$data.<key>.<field> = <rhs>` — both non-computed identifiers,
 *     depth-2, plain `=`. NOT gated on the initializer kind (out of scope).
 *   - CW-DYNKEY   `$data.<key>[<k>] = <rhs>` on an OBJECT-initialized key —
 *     `<k>` an Identifier, StringLiteral or NumericLiteral (D1: side-effect-free,
 *     load-bearing because the array lowering re-evaluates `<k>` per element).
 *   - CW-INDEX    `$data.<key>[<k>] = <rhs>` on an ARRAY-initialized key —
 *     `<k>` an Identifier or NumericLiteral (a StringLiteral is never an index).
 *   - CW-DYNDELETE `delete $data.<key>[<k>]` on an OBJECT-initialized key —
 *     lowers to clone-then-delete, the shape five live corpus sites already
 *     hand-write.
 *   - CW-ARRAY    `$data.<key>.<m>(<args>)` as an ExpressionStatement — depth-1,
 *     `<m>` ∈ push/pop/shift/unshift/splice, every arg a plain expression, and
 *     splice with ≥ 2 args (matches where the target lowering bails).
 *
 * FLAGGED (in `<script>`, matching `propWriteValidator`'s scope):
 *   - `$data.a.b.c = …`      (depth ≥ 3 — not single-key-replaceable)
 *   - `$data.reg[k()] = …`   (impure key expression — D1)
 *   - `$data.k[0] = …` where `k`'s declared initializer is neither a literal
 *     object nor a literal array (the CW-INDEX retrofit narrowing)
 *   - `delete $data.arr[i]`  (ARRAY-initialized: a delete leaves a HOLE, a
 *     genuinely different semantic from an immutable replace — never lowered)
 *   - `delete $data.obj.field` (non-computed nested delete — D6)
 *   - `delete $data.a.b[k]`  (depth ≥ 3 delete)
 *   - `$data.obj.field += 1` (any compound / logical-assign operator)
 *   - `$data.obj.field++`    (UpdateExpression on a nested member)
 *   - `$data.arr.sort()` / `.reverse()` / `.fill()` / `.copyWithin()` (in-place)
 *   - `$data.m.set(…)` / `$data.s.add()/.delete()/.clear()` (Map/Set mutators)
 *   - a covered mutator in EXPRESSION context (`const x = $data.arr.pop()`,
 *     `const ok = delete $data.reg[id]` — D4 statement-context only)
 *   - a covered array mutator at depth ≥ 2 (`$data.obj.items.push(…)`)
 *
 * SETTLED — PERMANENTLY DIAGNOSTIC-ONLY (quick 260830-m30, in the manner ROZ145
 * was settled). The shapes below are CLOSED to re-litigation. They are not
 * "deferred"; the project has decided they stay loud errors, and a future audit
 * pass should not reopen them without new evidence of a real corpus need:
 *   - depth ≥ 3 nested writes and deletes
 *   - Map/Set mutators (`set`/`add`/`delete`/`clear`)
 *   - in-place `sort`/`reverse`/`fill`/`copyWithin`
 *   - compound (`+=`, `&&=`, …) and update (`++`, `--`) operators
 *   - ANY covered mutator used in EXPRESSION context
 *   - covered array mutators at depth ≥ 2
 *   - `delete` on an array-initialized key (hole semantics)
 *
 * ALSO SETTLED — Solid `createStore` for `$data` object state is CLOSED AS NO,
 * not deferred. It is Solid-ONLY leverage: adopting it would convert a uniform
 * loud error into a per-target divergence (the exact failure mode the coherence
 * invariant exists to prevent), and it risks the reference-identity contract
 * MapLibre's parent watcher depends on, since a store proxy does not produce the
 * fresh top-level reference an immutable replace does.
 *
 * COHERENCE INVARIANT (restated): a shape is ROZ207-exempt here IF AND ONLY IF
 * it is reactively lowered by ALL FOUR target emitters. This is machine-checked
 * by `tests/regressions/roz207-coherence.test.ts`, which drives one shared table
 * through both core's diagnostics and all four emitters' real output.
 *
 * NOT FLAGGED:
 *   - `$data.x = …`          (shallow reassignment — lowers to a reactive setter)
 *   - the COVERED subset above (now lowers reactively — quick 260718-uvq)
 *   - `$data.obj.field`      (a READ — assignment/method only)
 *   - `$data.arr.map(…)` / `.filter(…)` / `.find(…)` (non-mutating methods)
 *   - `const o = $data.obj; o.field = 5` (mutation through a local alias — the
 *     same conservative false-negative `propWriteValidator` accepts for
 *     destructured props; the root is no longer `$data`)
 *   - a nested write whose first-level key is NOT a declared `<data>` key
 *     (deferred to ROZ106 unknownRefValidator)
 *
 * Scope: `<script>` only, mirroring `propWriteValidator`. Template-inline handlers
 * (`@click="$data.obj.field = 5"`) are parsed later (lowerTemplate) and not in
 * `ast.script`; covering them is a follow-up (backlogged with the real fix).
 *
 * Per D-08 collected-not-thrown: NEVER throws. Mutates `diagnostics` in place;
 * NEVER mutates the AST.
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { RozieAST } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { locFromBabel } from '../../diagnostics/locFromBabel.js';
import type { BindingsTable } from '../types.js';

// Default-export interop (see collectScriptDecls.ts).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

// Array / Map / Set in-place mutators. A user object with a same-named method is a
// rare false positive — and if it holds `$data` state, the whole-object-replace
// guidance still applies. `sort`/`reverse`/`fill`/`copyWithin` mutate arrays in
// place; `set`/`add`/`delete`/`clear` cover Map/Set.
const MUTATING_METHODS = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
  'set', 'add', 'delete', 'clear',
]);

// quick 260718-uvq — the depth-1 array mutators the four targets lower to an
// immutable single-key replace. A subset of MUTATING_METHODS; the rest
// (sort/reverse/fill/copyWithin, set/add/delete/clear) STAY flagged everywhere.
const COVERED_ARRAY_MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice']);

/**
 * quick 260830-m30 — the D1 pure-key guard and the D2 initializer gate. BOTH
 * mirror the four targets' `isPureKeyExpr` / `collectDataInitKinds` EXACTLY
 * (coherence invariant). The targets classify from `ir.state[].initializer`
 * (StateDecl) and core from `bindings.data.get(k).initializer` (DataDeclEntry) —
 * the SAME classification computed off two different carriers; both must agree.
 */
type DataInitKind = 'object' | 'array' | 'other';

function isPureKeyExpr(node: t.Node): node is t.Identifier | t.StringLiteral | t.NumericLiteral {
  return t.isIdentifier(node) || t.isStringLiteral(node) || t.isNumericLiteral(node);
}

function dataInitKind(bindings: BindingsTable, key: string): DataInitKind {
  const init: t.Node | undefined = bindings.data.get(key)?.initializer;
  if (t.isObjectExpression(init)) return 'object';
  if (t.isArrayExpression(init)) return 'array';
  return 'other';
}

/**
 * quick 260718-uvq / 260830-m30 — is this AssignmentExpression a COVERED
 * nested-`$data` write (CW-MEMBER / CW-INDEX / CW-DYNKEY) that lowers reactively
 * on all four targets? Mirrors the per-target `detectCoveredNestedAssign`
 * EXACTLY (coherence invariant): statement-context, plain `=`, LHS
 * `$data.<key>.<field>` (both non-computed) or `$data.<key>[<k>]` with `<k>`
 * pure and the declared initializer resolving the container kind.
 */
function isCoveredNestedAssign(
  path: NodePath<t.AssignmentExpression>,
  bindings: BindingsTable,
): boolean {
  const node = path.node;
  if (node.operator !== '=') return false;
  if (!path.parentPath?.isExpressionStatement()) return false;
  const left = node.left;
  if (!t.isMemberExpression(left)) return false;
  const base = left.object;
  if (!t.isMemberExpression(base) || base.computed) return false;
  if (!t.isIdentifier(base.object) || base.object.name !== '$data') return false;
  if (!t.isIdentifier(base.property)) return false;
  const key = base.property.name;
  if (!bindings.data.has(key)) return false;
  if (!left.computed) return t.isIdentifier(left.property); // CW-MEMBER (ungated)
  // Computed depth-2 — the D2 gate.
  if (!isPureKeyExpr(left.property)) return false;
  const kind = dataInitKind(bindings, key);
  if (kind === 'object') return true; // CW-DYNKEY (absorbs the numeric-literal case)
  if (kind === 'array') return !t.isStringLiteral(left.property); // CW-INDEX
  return false; // 'other' — no sound single-key replace exists
}

/**
 * quick 260830-m30 — is this `delete` a COVERED dynamic-key delete
 * (CW-DYNDELETE)? Mirrors the per-target `detectCoveredDynDelete` EXACTLY:
 * statement-context (D4), `delete $data.<key>[<pure-key>]`, `<key>` a declared
 * `<data>` key whose declared initializer is a literal OBJECT. An
 * array-initialized key is NOT covered — `delete arr[i]` leaves a hole.
 */
function isCoveredDynDelete(
  path: NodePath<t.UnaryExpression>,
  bindings: BindingsTable,
): boolean {
  if (path.node.operator !== 'delete') return false;
  if (!path.parentPath?.isExpressionStatement()) return false;
  const arg = path.node.argument;
  if (!t.isMemberExpression(arg) || !arg.computed) return false;
  const base = arg.object;
  if (!t.isMemberExpression(base) || base.computed) return false;
  if (!t.isIdentifier(base.object) || base.object.name !== '$data') return false;
  if (!t.isIdentifier(base.property)) return false;
  const key = base.property.name;
  if (!bindings.data.has(key)) return false;
  if (!isPureKeyExpr(arg.property)) return false;
  return dataInitKind(bindings, key) === 'object';
}

/**
 * quick 260718-uvq — is this CallExpression a COVERED depth-1 array mutator
 * (CW-ARRAY) that lowers reactively on all four targets? Mirrors the per-target
 * `detectCoveredArrayMutation` EXACTLY (coherence invariant): statement-context,
 * `<m>` ∈ push/pop/shift/unshift/splice, container `$data.<key>` at depth-1,
 * every argument a plain expression, and splice with ≥ 2 args (the point where
 * the target lowering can rebuild the array immutably — below that it bails, so
 * the validator must keep flagging or the result would be silently non-reactive).
 */
function isCoveredArrayMutation(
  path: NodePath<t.CallExpression>,
  method: string,
  depth: number,
): boolean {
  if (!COVERED_ARRAY_MUTATORS.has(method)) return false;
  if (depth !== 1) return false;
  if (!path.parentPath?.isExpressionStatement()) return false;
  for (const a of path.node.arguments) {
    if (!t.isExpression(a)) return false; // spread / placeholder → target bails
  }
  if (method === 'splice' && path.node.arguments.length < 2) return false;
  return true;
}

/**
 * If `node` is a `$data`-rooted MemberExpression, return the first-level key and
 * the member-hop depth from `$data` (`$data.x` → depth 1, `$data.x.y` /
 * `$data.x[i]` → depth 2). Otherwise null. A computed first-level access
 * (`$data[k].y`) yields a null `key` and is not flagged (deferred to ROZ106).
 */
function analyzeDataAccess(node: t.Node): { key: string | null; depth: number } | null {
  let cur: t.Node = node;
  let depth = 0;
  while (t.isMemberExpression(cur)) {
    depth++;
    const obj = cur.object;
    if (t.isIdentifier(obj) && obj.name === '$data') {
      const key = !cur.computed && t.isIdentifier(cur.property) ? cur.property.name : null;
      return { key, depth };
    }
    cur = obj;
  }
  return null;
}

function makeRoz207(
  offendingNode: t.Node,
  member: string,
  detail: string,
  // quick 260830-m30 — a deletion needs its own guidance: the generic
  // whole-object-REPLACE suggestion does not express removing a key.
  kind: 'assign' | 'delete' = 'assign',
): Diagnostic {
  const hint =
    kind === 'delete'
      ? `Clone the whole top-level value, delete the key off the clone, then reassign it, e.g. \`const next = { ...$data.${member} }; delete next[<key>]; $data.${member} = next;\` — that lowers to a reactive setter on all six targets.`
      : `Replace the whole top-level value instead, e.g. \`$data.${member} = { ...$data.${member}, <key>: … }\` (or a new array), which lowers to a reactive setter on all six targets.`;
  return {
    code: RozieErrorCode.DATA_NESTED_MUTATION_NOT_REACTIVE,
    severity: 'error',
    message: `In-place mutation of nested '$data.${member}' (${detail}) is not reactive on React/Solid/Angular/Lit — the change persists but no re-render fires.`,
    loc: locFromBabel(offendingNode),
    hint,
  };
}

export function runDataNestedMutationValidator(
  ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  if (!ast.script) return;

  function checkWriteTarget(
    target: t.Node,
    offending: t.Node,
    detail: string,
    kind: 'assign' | 'delete' = 'assign',
  ): void {
    const info = analyzeDataAccess(target);
    if (!info || info.key === null) return;
    if (info.depth < 2) return; // shallow `$data.x = …` is reactive — allowed
    if (!bindings.data.has(info.key)) return; // unknown key → ROZ106, not ours
    diagnostics.push(makeRoz207(offending, info.key, detail, kind));
  }

  traverse(ast.script.program, {
    AssignmentExpression(path) {
      // quick 260718-uvq — exempt the COVERED CW-MEMBER / CW-INDEX subset; it
      // lowers reactively on all four targets. Everything else still flags.
      if (isCoveredNestedAssign(path, bindings)) return;
      checkWriteTarget(path.node.left, path.node, 'nested assignment');
    },
    UpdateExpression(path) {
      // UpdateExpression (`$data.obj.n++`) is NEVER covered — stays flagged.
      checkWriteTarget(path.node.argument, path.node, `${path.node.operator} on a nested member`);
    },
    /**
     * quick 260830-m30 — THE SOUNDNESS FIX. There was no `UnaryExpression`
     * visitor here at all, so `delete $data.reg[id]` produced ZERO diagnostics
     * while emitting a bare, silently non-reactive `delete` on four targets.
     * Now every nested `delete` on a declared `<data>` key is either COVERED by
     * CW-DYNDELETE or LOUD. None is silent.
     */
    UnaryExpression(path) {
      if (path.node.operator !== 'delete') return;
      if (isCoveredDynDelete(path, bindings)) return;
      checkWriteTarget(path.node.argument, path.node, 'delete of a nested key', 'delete');
    },
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isMemberExpression(callee) || callee.computed) return;
      if (!t.isIdentifier(callee.property)) return;
      const method = callee.property.name;
      if (!MUTATING_METHODS.has(method)) return;
      // The mutated container is `callee.object` — flag when it is a `$data`
      // member (depth ≥ 1: `$data.arr.push()` mutates the top-level array `arr`,
      // which is itself non-reactive under a direct method mutation).
      const info = analyzeDataAccess(callee.object);
      if (!info || info.key === null || info.depth < 1) return;
      if (!bindings.data.has(info.key)) return;
      // quick 260718-uvq — exempt the COVERED CW-ARRAY subset (depth-1 push/pop/
      // shift/unshift/splice in statement-context with plain-expression args);
      // it lowers reactively on all four targets. sort/reverse/fill/copyWithin,
      // Map/Set mutators, depth ≥ 2 and expression-context calls STAY flagged.
      if (isCoveredArrayMutation(path, method, info.depth)) return;
      diagnostics.push(
        makeRoz207(path.node, info.key, `.${method}() mutates in place`),
      );
    },
  });
}
