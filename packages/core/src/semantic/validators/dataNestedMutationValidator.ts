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
 * everywhere upholds Rozie's cross-target promise. A real per-target nested-
 * mutation lowering is backlogged; until then, ROZ207 fails loud.
 *
 * FLAGGED (in `<script>`, matching `propWriteValidator`'s scope):
 *   - `$data.obj.field = …`  (nested member assignment, depth ≥ 2)
 *   - `$data.arr[i] = …`     (indexed assignment, depth ≥ 2)
 *   - `$data.obj.field += 1` (any compound / logical-assign operator)
 *   - `$data.obj.field++`    (UpdateExpression on a nested member)
 *   - `$data.arr.push(…)`    (a mutating array/Map/Set method on a `$data` member)
 *
 * NOT FLAGGED:
 *   - `$data.x = …`          (shallow reassignment — lowers to a reactive setter)
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

function makeRoz207(offendingNode: t.Node, member: string, detail: string): Diagnostic {
  return {
    code: RozieErrorCode.DATA_NESTED_MUTATION_NOT_REACTIVE,
    severity: 'error',
    message: `In-place mutation of nested '$data.${member}' (${detail}) is not reactive on React/Solid/Angular/Lit — the change persists but no re-render fires.`,
    loc: locFromBabel(offendingNode),
    hint: `Replace the whole top-level value instead, e.g. \`$data.${member} = { ...$data.${member}, <key>: … }\` (or a new array), which lowers to a reactive setter on all six targets.`,
  };
}

export function runDataNestedMutationValidator(
  ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  if (!ast.script) return;

  function checkWriteTarget(target: t.Node, offending: t.Node, detail: string): void {
    const info = analyzeDataAccess(target);
    if (!info || info.key === null) return;
    if (info.depth < 2) return; // shallow `$data.x = …` is reactive — allowed
    if (!bindings.data.has(info.key)) return; // unknown key → ROZ106, not ours
    diagnostics.push(makeRoz207(offending, info.key, detail));
  }

  traverse(ast.script.program, {
    AssignmentExpression(path) {
      checkWriteTarget(path.node.left, path.node, 'nested assignment');
    },
    UpdateExpression(path) {
      checkWriteTarget(path.node.argument, path.node, `${path.node.operator} on a nested member`);
    },
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isMemberExpression(callee) || callee.computed) return;
      if (!t.isIdentifier(callee.property)) return;
      if (!MUTATING_METHODS.has(callee.property.name)) return;
      // The mutated container is `callee.object` — flag when it is a `$data`
      // member (depth ≥ 1: `$data.arr.push()` mutates the top-level array `arr`,
      // which is itself non-reactive under a direct method mutation).
      const info = analyzeDataAccess(callee.object);
      if (!info || info.key === null || info.depth < 1) return;
      if (!bindings.data.has(info.key)) return;
      diagnostics.push(
        makeRoz207(path.node, info.key, `.${callee.property.name}() mutates in place`),
      );
    },
  });
}
