/**
 * rewriteRozieIdentifiers — Plan 04-02 Task 1 (React target).
 *
 * Walks a CLONED Babel Program and rewrites Rozie-specific magic accessors
 * into React-idiomatic identifier shapes per RESEARCH.md Pattern 2 (lines
 * 466-501) verbatim:
 *
 *   - `$props.value` (model: true) read   → `value`              (NO .value — useState/useControllableState return T directly)
 *   - `$props.value = X` (model write)    → `setValue(X)`         (CallExpression replacing the AssignmentExpression)
 *   - `$props.value += X` (model compound) → `setValue(prev => prev + X)`  (Pitfall 6 functional updater for concurrent-safe semantics)
 *   - `$props.step` (non-model) read      → `props.step`
 *   - `$data.foo` read                    → `foo`                (bare local from useState)
 *   - `$data.foo = X`                     → `setFoo(X)`
 *   - `$data.foo += 1`                    → `setFoo(prev => prev + 1)`
 *   - `$data.foo.bar = X` nested write    → emit ROZ521, leave AST unchanged (Pitfall 7)
 *   - `$refs.foo` read                    → `foo.current`
 *   - `$slots.foo` (boolean check)        → `(props.renderFoo ?? props.slots?.['foo'])`  (Phase 07.3.2 Plan 08 — merge guard with dynamic-name fallback; mirrors rewriteTemplateExpression)
 *   - `$emit('search', q)`                → `props.onSearch?.(q)`  (camelCase + on-prefix + optional-chain)
 *
 * `$onMount`/`$onUnmount`/`$onUpdate` calls are NOT mutated by this pass —
 * they're consumed STRUCTURALLY from `ir.lifecycle` by emitScript (Task 2).
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * Per Phase 2 D-T-2-01-04 CJS-interop pattern: normalize `@babel/traverse`
 * default-export at import time.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { File } from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { portalKey } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { isInTypePosition } from '../../../../core/src/ast/typePosition.js';
import { lowerClassSelectorCall } from './lowerClassSelectorCall.js';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

/**
 * Decide whether a `$refs.X` / `$el` access should lower to a non-null
 * assertion (`foo.current!`) instead of the default nullable handle
 * (`foo.current`).
 *
 * Ported verbatim from the Angular target's `refLowersToNonNull`
 * (`packages/targets/angular/src/rewrite/rewriteScript.ts`) — quick task
 * 260520-w18 bug class 1. Each target package owns its own copy of this
 * helper per the per-package `cloneProgram.ts` convention.
 *
 * The nullable handle is the safe DEFAULT — a ref whose element is `r-if`-gated
 * (e.g. Dropdown's `panelEl`) is genuinely null before it renders, and guard
 * code like `if (!$refs.panelEl) return` depends on the handle yielding `null`.
 *
 * Two contexts prove the author has asserted the element exists:
 *
 *   1. The author wrote a NON-optional access on it — `$refs.X.method()` /
 *      `$refs.X.prop` — so each independent nullable lowering would otherwise
 *      defeat TS narrowing across an earlier `if (!$refs.X) return` (TS18047).
 *   2. It is handed to a function/constructor call — `flatpickr($refs.inputEl)`,
 *      `new SortableJS($el, …)`, `new Editor({ element: $refs.editorEl })` —
 *      the canonical engine-wrapper pattern. The host element a vanilla-JS
 *      engine mounts into is unconditional by construction; passing a
 *      possibly-`null` value into a typed engine constructor is TS18047. The
 *      walk steps out through enclosing object/array literals so
 *      `{ element: $refs.editorEl }` is recognised as "passed into `new Editor(...)`".
 */
function refLowersToNonNull(
  path: NodePath<t.MemberExpression> | NodePath<t.OptionalMemberExpression>,
): boolean {
  const parent = path.parent;
  // (1) authored non-optional member/call on the ref itself. OptionalMember /
  //     OptionalCall parents are intentionally excluded — the author opted
  //     into optionality there (`$refs.dialogEl?.focus()`).
  if (t.isMemberExpression(parent) && parent.object === path.node) return true;
  if (t.isCallExpression(parent) && parent.callee === path.node) return true;
  // (2) flows into a Call/NewExpression argument, possibly nested inside
  //     object/array literals.
  let child: t.Node = path.node;
  let p: NodePath | null = path.parentPath;
  while (p) {
    const n = p.node;
    if (
      (t.isCallExpression(n) || t.isNewExpression(n)) &&
      n.arguments.some((a) => (a as t.Node) === child)
    ) {
      return true;
    }
    if (t.isObjectProperty(n) && n.value === child) {
      child = n;
      p = p.parentPath;
      continue;
    }
    if (
      t.isObjectExpression(n) ||
      t.isArrayExpression(n) ||
      t.isSpreadElement(n)
    ) {
      child = n;
      p = p.parentPath;
      continue;
    }
    break;
  }
  return false;
}

export interface RewriteScriptResult {
  rewrittenProgram: File;
  diagnostics: Diagnostic[];
}

/** Convert an event name (`'search'` / `'value-change'`) to a `props.onX` field name (`onSearch` / `onValueChange`). */
function toReactEventPropName(eventName: string): string {
  // Hyphen / underscore split + camelCase + 'on' prefix.
  const parts = eventName.split(/[-_]/).filter(Boolean);
  if (parts.length === 0) return 'on';
  const camel = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return 'on' + camel;
}

/** Capitalize first letter of a name: `value` → `Value`, `hovering` → `Hovering`. */
function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Map of compound-assignment operator → matching binary operator. */
const COMPOUND_OP_MAP: Record<string, t.BinaryExpression['operator']> = {
  '+=': '+',
  '-=': '-',
  '*=': '*',
  '/=': '/',
  '%=': '%',
  '**=': '**',
  '<<=': '<<',
  '>>=': '>>',
  '>>>=': '>>>',
  '&=': '&',
  '|=': '|',
  '^=': '^',
};

/**
 * Detect whether `expr` reads the magic accessor `<accessor>.<name>` anywhere
 * inside it (e.g. `$data.points` inside `[...$data.points.slice(-19), next]`).
 *
 * Walks the expression's own subtree only; nested function bodies count too
 * (a stale read inside an inline callback is just as stale). Returns true on
 * the first match.
 */
function exprReadsAccessor(
  expr: t.Expression,
  accessor: '$data' | '$props',
  name: string,
): boolean {
  let found = false;
  const file = t.file(t.program([t.expressionStatement(expr)]));
  try {
    traverse(file, {
      MemberExpression(path) {
        if (path.node.computed) return;
        const o = path.node.object;
        const pr = path.node.property;
        if (
          t.isIdentifier(o) &&
          o.name === accessor &&
          t.isIdentifier(pr) &&
          pr.name === name
        ) {
          found = true;
          path.stop();
        }
      },
      OptionalMemberExpression(path) {
        if (path.node.computed) return;
        const o = path.node.object;
        const pr = path.node.property;
        if (
          t.isIdentifier(o) &&
          o.name === accessor &&
          t.isIdentifier(pr) &&
          pr.name === name
        ) {
          found = true;
          path.stop();
        }
      },
    });
  } catch {
    // Defensive (D-08) — never throw on an unusual AST shape.
  }
  return found;
}

/**
 * Rewrite every `<accessor>.<name>` SELF-REFERENCE inside `expr` to a bare
 * `Identifier(paramName)`. Used to build the React functional-updater form:
 * `$data.points = f($data.points)` → `setPoints(prev => f(prev))` so the
 * `prev` is always the latest state, never a stale closure capture.
 *
 * Only the SAME-name accessor reads are rewritten; reads of OTHER state /
 * props pass through untouched and flow into the normal MemberExpression
 * rewrite downstream. Mutates `expr` in place.
 */
function rewriteSelfReadsToParam(
  expr: t.Expression,
  accessor: '$data' | '$props',
  name: string,
  paramName: string,
): void {
  const file = t.file(t.program([t.expressionStatement(expr)]));
  try {
    traverse(file, {
      MemberExpression(path) {
        if (path.node.computed) return;
        const o = path.node.object;
        const pr = path.node.property;
        if (
          t.isIdentifier(o) &&
          o.name === accessor &&
          t.isIdentifier(pr) &&
          pr.name === name
        ) {
          path.replaceWith(t.identifier(paramName));
          path.skip();
        }
      },
      OptionalMemberExpression(path) {
        if (path.node.computed) return;
        const o = path.node.object;
        const pr = path.node.property;
        if (
          t.isIdentifier(o) &&
          o.name === accessor &&
          t.isIdentifier(pr) &&
          pr.name === name
        ) {
          path.replaceWith(t.identifier(paramName));
          path.skip();
        }
      },
    });
  } catch {
    // Defensive (D-08).
  }
}

/**
 * Build the per-state setter call.
 *
 *   - plain `=` with NO self-read of the same state  → `setName(rhs)`
 *   - plain `=` whose RHS reads the SAME state        → `setName(prev => rhs')`
 *     (functional updater; `rhs'` has the self-reads rewritten to `prev`)
 *   - compound `+=` etc.                              → `setName(prev => prev OP rhs)`
 *
 * The functional-updater form for plain `=` (Pitfall 6, extended) is what
 * keeps `$data.points = [...$data.points.slice(-19), next]` correct: React's
 * `setX(value)` form captures the rendered-time `points`, so a setter pinned
 * by `setInterval` rebuilds from a stale array forever. `setX(prev => ...)`
 * always receives the current state. `accessor` selects which magic accessor
 * counts as the self-reference ($data for state writes, $props for model
 * writes).
 */
function buildSetterCall(
  stateName: string,
  operator: string,
  rhs: t.Expression,
  accessor: '$data' | '$props',
): t.CallExpression {
  const setterName = 'set' + capitalize(stateName);
  if (operator === '=') {
    if (exprReadsAccessor(rhs, accessor, stateName)) {
      // Functional updater — rewrite the self-reads to the `prev` param so the
      // updater is concurrent-safe and free of stale-closure capture.
      rewriteSelfReadsToParam(rhs, accessor, stateName, 'prev');
      const arrow = t.arrowFunctionExpression([t.identifier('prev')], rhs);
      return t.callExpression(t.identifier(setterName), [arrow]);
    }
    return t.callExpression(t.identifier(setterName), [rhs]);
  }
  const binOp = COMPOUND_OP_MAP[operator];
  if (!binOp) {
    return t.callExpression(t.identifier(setterName), [rhs]);
  }
  const arrow = t.arrowFunctionExpression(
    [t.identifier('prev')],
    t.binaryExpression(binOp, t.identifier('prev'), rhs),
  );
  return t.callExpression(t.identifier(setterName), [arrow]);
}

/**
 * Phase 18 (Req 2) — normalize the producer-side two-way-write sigil `$model`
 * to `$props` across the cloned Program, in place.
 *
 * `$model.X` is the producer-side sigil for writing a `model: true` prop. By
 * contract it is model-only: Wave 1's core semantic pass already emitted
 * ROZ205 / ROZ113 for `$model.<nonModelProp>` / `$model.<nonExistent>` BEFORE
 * lowering, so every `$model.X` reaching the emitter is a declared model prop.
 * `$model` is ALWAYS a member-expression object (it is deliberately NOT in
 * STABLE_IDENTIFIERS, D-03), so renaming the object Identifier of every
 * non-computed Member/OptionalMember expression from `$model` → `$props` routes
 * the read/write through the IDENTICAL `$props.<modelProp>` lowering and yields
 * byte-identical emit. Reuse, not reimplement.
 */
function normalizeModelAccessor(program: File): void {
  traverse(program, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
  });
}

/**
 * Returns true if a binding-pattern node introduces a binding for `name`.
 *
 * Shared shape with the Svelte target's `patternIntroducesBinding` (the
 * destructuring-aware form ported from React's `hoistModuleLet`). Handles the
 * simple Identifier case plus ObjectPattern / ArrayPattern / AssignmentPattern /
 * RestElement destructured forms.
 */
function patternIntroducesBinding(pattern: t.Node, name: string): boolean {
  if (t.isIdentifier(pattern)) return pattern.name === name;
  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isObjectProperty(prop)) {
        if (patternIntroducesBinding(prop.value as t.Node, name)) return true;
      } else if (t.isRestElement(prop)) {
        if (patternIntroducesBinding(prop.argument, name)) return true;
      }
    }
    return false;
  }
  if (t.isArrayPattern(pattern)) {
    for (const el of pattern.elements) {
      if (el && patternIntroducesBinding(el, name)) return true;
    }
    return false;
  }
  if (t.isAssignmentPattern(pattern)) {
    return patternIntroducesBinding(pattern.left, name);
  }
  if (t.isRestElement(pattern)) {
    return patternIntroducesBinding(pattern.argument, name);
  }
  return false;
}

/**
 * Returns true if the subtree rooted at `node` contains a NON-computed
 * `$refs.<name>` read (Member/OptionalMember) — the exact shape the downstream
 * rewrite lowers to `<name>.current`. The trigger condition for the
 * ref-shadow bug: a colliding local/param only mis-captures the rewrite when
 * such a read actually exists within its scope. `$refs['x']` (computed) is
 * excluded (the rewrite skips computed access).
 */
function subtreeReadsRef(node: t.Node | null | undefined, refName: string): boolean {
  if (!node) return false;
  let found = false;
  // Hand-rolled recursive walk (no Program-rooted Babel traverse required).
  function walk(n: t.Node | null | undefined): void {
    if (found || !n || typeof n !== 'object' || !('type' in n)) return;
    if (t.isMemberExpression(n) || t.isOptionalMemberExpression(n)) {
      const obj = n.object;
      const prop = n.property;
      if (
        !n.computed &&
        t.isIdentifier(obj) &&
        obj.name === '$refs' &&
        t.isIdentifier(prop) &&
        prop.name === refName
      ) {
        found = true;
        return;
      }
    }
    for (const key of Object.keys(n)) {
      if (
        key === 'loc' ||
        key === 'start' ||
        key === 'end' ||
        key === 'leadingComments' ||
        key === 'trailingComments' ||
        key === 'innerComments'
      ) {
        continue;
      }
      const v = (n as unknown as Record<string, unknown>)[key];
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item && typeof item === 'object' && 'type' in item) walk(item as t.Node);
        }
      } else if (v && typeof v === 'object' && 'type' in v) {
        walk(v as t.Node);
      }
    }
  }
  walk(node);
  return found;
}

/**
 * SCOPE-AWARE PRE-PASS (debug `refs-self-shadow-tdz`).
 *
 * The downstream `$refs.X` → `X.current` rewrite is scope-BLIND: it relies on
 * the bare `X` binding to the `useRef` binding `const X = useRef(...)` that
 * emitScript synthesizes. When a local `const`/`let`/`var` declarator OR a
 * function PARAMETER shadows a ref name, the rewritten `X.current` is captured
 * by that shadow instead of the useRef. The canonical failure is the
 * SELF-REFERENCE runtime TDZ crash: `const flow = $refs.flow` →
 * `const flow = flow.current` (`flow` shadows itself in its own initializer →
 * `ReferenceError: Cannot access 'flow' before initialization`).
 *
 * This is the `$refs` analog of the Svelte target's `deconflictAccessorShadows`
 * prop/param pass (the `$props.X` self-shadow fixed in b4842c44). React keeps
 * non-model props as `props.step` member access (no bare lowering), so React's
 * exposure is narrower than Svelte's — only `$refs.X` bare-`.current` reads
 * collide; this pass covers exactly that.
 *
 * SURGICAL TRIGGER (zero-drift discipline): a name collision alone is NOT
 * enough — we rename only when the binding's scope ACTUALLY contains a
 * non-computed `$refs.<name>` read (`subtreeReadsRef`). A param/local that
 * merely shares a ref name but never reads `$refs.X` is left untouched (it was
 * never buggy), keeping the pass byte-identical on the existing corpus.
 *
 * Runs on the freshly-cloned, not-yet-mutated Program (after the
 * `$model`→`$props` normalization, which renames only `$model` object
 * identifiers — not bindings — so the scope cache is valid). `scope.rename`
 * atomically updates the declaration/param + every reference within its scope.
 */
function deconflictRefShadows(program: File, refNames: ReadonlySet<string>): void {
  if (refNames.size === 0) return;
  const alias = (name: string): string => `${name}$local`;
  traverse(program, {
    Function(path) {
      const body = path.node.body;
      for (const param of path.node.params) {
        for (const refName of refNames) {
          if (
            patternIntroducesBinding(param, refName) &&
            subtreeReadsRef(body, refName)
          ) {
            path.scope.rename(refName, alias(refName));
          }
        }
      }
    },
    VariableDeclarator(path) {
      const id = path.node.id;
      for (const refName of refNames) {
        if (!patternIntroducesBinding(id, refName)) continue;
        const binding = path.scope.getBinding(refName);
        const ownerScope = binding ? binding.scope : path.scope;
        if (subtreeReadsRef(ownerScope.block, refName)) {
          ownerScope.rename(refName, alias(refName));
        }
      }
    },
  });
}

/**
 * Detect whether a MemberExpression LHS represents a NESTED write
 * (e.g., `$data.todo.title = X`). Returns the root `$data`/`$props`
 * Identifier name when so; null otherwise.
 */
function nestedWriteRoot(left: t.LVal | t.OptionalMemberExpression): string | null {
  if (!t.isMemberExpression(left)) return null;
  // SHALLOW write would be MemberExpression{object: Identifier('$data'), property: Identifier('field')}.
  // NESTED write would be MemberExpression{object: MemberExpression{...$data.X}, property: Identifier('subField')}.
  if (!t.isMemberExpression(left.object) && !t.isOptionalMemberExpression(left.object)) {
    return null;
  }
  // Walk to root.
  let node: t.Node = left.object;
  while (
    (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
    (t.isMemberExpression(node.object) || t.isOptionalMemberExpression(node.object))
  ) {
    node = node.object;
  }
  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) return null;
  const root = node.object;
  if (!t.isIdentifier(root)) return null;
  if (root.name !== '$data' && root.name !== '$props') return null;
  return root.name;
}

/**
 * Rewrite Rozie magic-accessor identifiers in-place on a cloned Program.
 *
 * Strategy: single-pass @babel/traverse with multiple visitors. Replacements
 * use `path.replaceWith` and DO NOT call `path.skip()` — letting traversal
 * descend into the replacement node ensures nested rewrites apply (e.g., the
 * `node.right` of a setter-replaced AssignmentExpression still gets walked
 * so `$props.step` references inside it are rewritten to `props.step`).
 */
export function rewriteRozieIdentifiers(
  program: File,
  ir: IRComponent,
): RewriteScriptResult {
  const diagnostics: Diagnostic[] = [];

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => s.name));
  const portalSlotNames = new Set(
    ir.slots.filter((s) => s.isPortal === true).map((s) => portalKey(s)),
  );

  // Phase 06.1 P2 (D-104/D-106): name → IR-primitive lookups so synthesized
  // identifier nodes can inherit the IR's sourceLoc. The .loc cast is `as any`
  // because @babel/types' SourceLocation expects {line, column} while our
  // SourceLoc is {start, end} byte offsets — runtime shape diverges; the
  // metadata is present for v2 to refine into proper line/column.
  const stateByName = new Map(ir.state.map((s) => [s.name, s]));
  const refByName = new Map(ir.refs.map((r) => [r.name, r]));
  const propByName = new Map(ir.props.map((p) => [p.name, p]));

  // Phase 18 (Req 2) — producer-side two-way-write sigil `$model.X`.
  // `$model` is model-only by contract: Wave 1's core semantic pass already
  // rejected `$model.<nonModelProp>` (ROZ205) and `$model.<nonExistent>`
  // (ROZ113) BEFORE lowering, so every `$model.X` that survives to here is a
  // declared model prop. We normalize the accessor identifier `$model` → `$props`
  // in a single pre-pass over the cloned Program so EVERY downstream write/read
  // site (AssignmentExpression, UpdateExpression, MemberExpression,
  // OptionalMemberExpression — AND the RHS self-read detection inside
  // buildSetterCall) routes through the IDENTICAL `$props.<modelProp>` path.
  // This is "reuse, not reimplement" (SPEC Req 2) in its purest form: the emit
  // is byte-identical to the prior `$props.X` model form, proven in Wave 3.
  normalizeModelAccessor(program);

  // SCOPE-AWARE PRE-PASS (debug `refs-self-shadow-tdz`): rename any local
  // binding that shadows a REF name to `<name>$local` BEFORE the scope-blind
  // `$refs.X` → `X.current` rewrite below. Prevents the
  // `const X = $refs.X` → `const X = X.current` self-reference TDZ crash. The
  // `$refs` analog of Svelte's prop/param deconflict pass. Surgically gated on
  // an actual `$refs.<name>` read so it stays byte-identical on the existing
  // corpus. See deconflictRefShadows for the full rationale.
  deconflictRefShadows(program, refNames);

  traverse(program, {
    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;

      // Detect nested writes BEFORE we attempt any rewrite. Emit ROZ521 +
      // leave AST unchanged (Pitfall 7).
      const nested = nestedWriteRoot(left);
      if (nested !== null) {
        const startLoc = node.loc?.start;
        const endLoc = node.loc?.end;
        diagnostics.push({
          code: RozieErrorCode.TARGET_REACT_NESTED_STATE_MUTATION,
          severity: 'warning',
          message: `Nested member write \`${nested}.<deep-path> = …\` is not auto-rewritten in v1 (Pitfall 7). Use \`set${nested === '$data' ? 'Field' : 'Field'}(prev => ({ ...prev, ... }))\` or accept the leftover \`${nested}.\` reference in emitted output. AST left unchanged.`,
          loc: {
            start: startLoc?.index ?? 0,
            end: endLoc?.index ?? 0,
          },
        });
        return;
      }

      // SHALLOW writes: `$data.X = ...` or `$props.X = ...` (model only).
      if (!t.isMemberExpression(left)) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj)) return;
      if (left.computed) return;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$data') {
        if (!dataNames.has(prop.name)) return;
        const setterCall = buildSetterCall(
          prop.name,
          node.operator,
          node.right,
          '$data',
        );
        path.replaceWith(setterCall);
        // No path.skip() — let traversal descend into the new arrow body so
        // `$props.step` references inside `prev + $props.step` get rewritten,
        // and so other-name `$data.Y` reads in a functional updater body still
        // lower to their bare locals. Same-name `$data.X` reads were already
        // replaced with the `prev` param by buildSetterCall.
        return;
      }

      if (obj.name === '$props') {
        if (!modelProps.has(prop.name)) return;
        const setterCall = buildSetterCall(
          prop.name,
          node.operator,
          node.right,
          '$props',
        );
        path.replaceWith(setterCall);
        return;
      }
    },

    /**
     * `$data.x++` / `$data.x--` (and the `$props.x` model forms) — the
     * UpdateExpression mutation. `count` is `const [count, setCount] =
     * useState(...)`, so the bare `count++` that would otherwise pass through
     * is an assignment-to-const and will not compile. Route through the SAME
     * `buildSetterCall` path the compound-assignment case uses: `++` becomes
     * `+= 1`, `--` becomes `-= 1`, yielding `setCount(prev => prev + 1)`.
     *
     * Statement-context only: in `arr[i++]` / `const y = x++` the postfix
     * pre-increment VALUE matters, and a functional-updater setter call returns
     * the SETTER's result, not the prior value — semantically different. We
     * only rewrite when the UpdateExpression sits directly under an
     * ExpressionStatement (the `inc = () => { $data.count++ }` common case);
     * any expression-context `$data.x++` is left unchanged (it would already
     * be broken on a bare local, but we do not silently mis-lower it).
     */
    UpdateExpression(path) {
      const node = path.node;
      const arg = node.argument;
      if (!t.isMemberExpression(arg) || arg.computed) return;
      const obj = arg.object;
      const prop = arg.property;
      if (!t.isIdentifier(obj) || !t.isIdentifier(prop)) return;
      if (obj.name !== '$data' && obj.name !== '$props') return;

      const isData = obj.name === '$data';
      if (isData && !dataNames.has(prop.name)) return;
      if (!isData && !modelProps.has(prop.name)) return;

      // Only rewrite in statement context, where prefix/postfix are equivalent
      // and the returned value is discarded.
      if (!path.parentPath?.isExpressionStatement()) return;

      const op = node.operator === '++' ? '+=' : '-=';
      const setterCall = buildSetterCall(
        prop.name,
        op,
        t.numericLiteral(1),
        isData ? '$data' : '$props',
      );
      path.replaceWith(setterCall);
    },

    Identifier(path) {
      // Spike 001 B2 — script-context `$el` lowers to
      // `MemberExpression($refs, __rozieRoot)`. The IR pass `lowerRootElementRef`
      // already appended `RefDecl { name: '__rozieRoot' }` to `ir.refs` when a
      // free `$el` read was detected and the root template qualifies, so the
      // synthesised MemberExpression naturally flows into the existing
      // `$refs.X` handler below and lowers to `__rozieRoot.current` (React's
      // useRef accessor). When the IR pass declined to synthesise (root is
      // conditional/loop/fragment, OR user already has root ref), `$el`
      // remains a free identifier — v1 limitation, surfaced in spike docs.
      // WR-02 (Phase 9) — skip identifiers in TS type position. `$el` is a
      // Rozie sigil that should never appear in a type annotation, but the
      // guard keeps this visitor uniform with the other targets.
      if (isInTypePosition(path)) return;
      if (path.node.name !== '$el') return;
      const parentPath = path.parentPath;
      if (!parentPath) return;
      // Skip binding/declaration positions — same gating as Lit's existing
      // pattern at rewriteScript.ts:234.
      if (parentPath.isVariableDeclarator() && parentPath.node.id === path.node) return;
      if (
        parentPath.isMemberExpression() &&
        parentPath.node.property === path.node &&
        !parentPath.node.computed
      ) {
        return;
      }
      if (
        parentPath.isObjectProperty() &&
        parentPath.node.key === path.node &&
        !parentPath.node.computed
      ) {
        return;
      }
      if (parentPath.isFunction()) {
        const params = (parentPath.node as { params: t.Node[] }).params;
        if (params.includes(path.node)) return;
      }
      path.replaceWith(
        t.memberExpression(t.identifier('$refs'), t.identifier('__rozieRoot')),
      );
      // Do NOT path.skip() — let the visitor re-visit the synthesised
      // MemberExpression so the `$refs.X` handler downstream lowers it to
      // the target-native ref.
      return;
    },

    MemberExpression(path) {
      // WR-02 (Phase 9) — skip member expressions in TS type position
      // (`let x: typeof $data.foo`). Without this the `$data.foo` rewrite
      // would mangle a `typeof`-query inside a type annotation.
      if (isInTypePosition(path)) return;
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          // $props.value (model) → value
          // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR PropDecl.
          const propDecl = propByName.get(prop.name);
          const synthId = t.identifier(prop.name);
          if (propDecl) synthId.loc = propDecl.sourceLoc as any;
          path.replaceWith(synthId);
          return;
        }
        if (nonModelProps.has(prop.name)) {
          // $props.step → props.step (mutate object, retain property)
          path.node.object = t.identifier('props');
          return;
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.hovering → hovering (bare)
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR StateDecl.
        const stateDecl = stateByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (stateDecl) synthId.loc = stateDecl.sourceLoc as any;
        path.replaceWith(synthId);
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.dialogEl → dialogEl.current  (default, nullable)
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR RefDecl.
        const refDecl = refByName.get(prop.name);
        const newObj = t.identifier(prop.name);
        if (refDecl) newObj.loc = refDecl.sourceLoc as any;
        // Lower to `dialogEl.current!` (non-null) vs `dialogEl.current`
        // (nullable) per refLowersToNonNull — authored non-optional access
        // (TS18047 narrowing) OR passed into an engine constructor/function
        // call (TS18047 on a `HTMLElement | null` argument). Quick task
        // 260520-w18 bug class 1. See refLowersToNonNull's doc comment.
        if (refLowersToNonNull(path)) {
          path.replaceWith(
            t.tsNonNullExpression(
              t.memberExpression(newObj, t.identifier('current')),
            ),
          );
          return;
        }
        path.node.object = newObj;
        path.node.property = t.identifier('current');
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // Phase 07.3.2 Plan 08 (F-07.3.2-05-A) — script-context mirror of the
        // template rewriter. $slots.foo lowers to:
        //   (props.renderFoo ?? props.slots?.['foo'])
        // so listener `when:` conditions, computed bodies, and any other
        // $slots.X check site agree with the template-side guard and the
        // canonical invocation-site merge at emitSlotInvocation.ts:231.
        // See rewriteTemplateExpression.ts for the full rationale.
        const renderName = 'render' + capitalize(prop.name);
        const fieldKey = prop.name;
        const merged = t.parenthesizedExpression(
          t.logicalExpression(
            '??',
            t.memberExpression(t.identifier('props'), t.identifier(renderName)),
            t.optionalMemberExpression(
              t.memberExpression(t.identifier('props'), t.identifier('slots')),
              t.stringLiteral(fieldKey),
              true, // computed
              true, // optional
            ),
          ),
        );
        path.replaceWith(merged);
        path.skip();
        return;
      }
      if (obj.name === '$portals' && portalSlotNames.has(prop.name)) {
        // Portal-slot primitive (Spike 003). $portals.<name> resolves to the
        // synthesized local `portals` closure that emitScript injects at the
        // top of the mount-phase useEffect body. Just rename the object —
        // member traversal continues into the call args.
        path.node.object = t.identifier('portals');
        return;
      }
    },

    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR PropDecl.
          const propDecl = propByName.get(prop.name);
          const synthId = t.identifier(prop.name);
          if (propDecl) synthId.loc = propDecl.sourceLoc as any;
          path.replaceWith(synthId);
          return;
        }
        if (nonModelProps.has(prop.name)) {
          path.node.object = t.identifier('props');
          return;
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR StateDecl.
        const stateDecl = stateByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (stateDecl) synthId.loc = stateDecl.sourceLoc as any;
        path.replaceWith(synthId);
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR RefDecl.
        const refDecl = refByName.get(prop.name);
        const newObj = t.identifier(prop.name);
        if (refDecl) newObj.loc = refDecl.sourceLoc as any;
        // refLowersToNonNull non-null lowering (260520-w18 bug class 1) —
        // mirrors the MemberExpression branch above for `$refs.foo?.bar`.
        if (refLowersToNonNull(path)) {
          path.replaceWith(
            t.tsNonNullExpression(
              t.memberExpression(newObj, t.identifier('current')),
            ),
          );
          return;
        }
        path.node.object = newObj;
        path.node.property = t.identifier('current');
        return;
      }
    },

    /**
     * `$emit('event', ...args)` → `props.onEvent?.(...args)` optional-chain.
     *
     * Leave $onMount/$onUnmount/$onUpdate untouched (consumed structurally
     * by emitScript). Leave console.log untouched (DX-03 floor).
     */
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;

      // $snapshot(x) → x — React props are plain JS values (no reactive
      // proxies), so the engine library already receives a non-reactive
      // value. Identity lowering keeps wrapper authors' `$snapshot()`
      // calls cross-target safe (the Svelte target uses
      // `$state.snapshot(x)`).
      if (callee.name === '$snapshot') {
        const args = path.node.arguments;
        if (args.length === 1) {
          const arg = args[0]!;
          if (t.isExpression(arg)) path.replaceWith(arg);
        }
        return;
      }

      // $reconcileAfterDomMutation() → `void 0` (no-op). Pre-Phase-16 Item 3:
      // the sigil exists for the Lit target only — React's keyed reconciler
      // diffs against live DOM at patch time, so the in-source DOM-restore
      // dance the engine wrappers all implement is sufficient.
      if (callee.name === '$reconcileAfterDomMutation') {
        path.replaceWith(t.unaryExpression('void', t.numericLiteral(0)));
        return;
      }

      // Phase 16 — $restoreFocus(sel, idx) → `void 0` (no-op). React's keyed
      // reconciler MOVES the existing DOM element on reorder; focus survives
      // natively. SPEC R4 lowering table.
      if (callee.name === '$restoreFocus') {
        path.replaceWith(t.unaryExpression('void', t.numericLiteral(0)));
        return;
      }

      // $classSelector('grip') → "." + styles.grip — React runs class names
      // through CSS Modules, so a literal ".grip" never matches the hashed
      // DOM. Shared with rewriteTemplateExpression.ts via lowerClassSelectorCall
      // so the two hooks cannot drift (Pitfall 4).
      if (callee.name === '$classSelector') {
        lowerClassSelectorCall(path);
        return;
      }

      if (callee.name !== '$emit') return;

      const args = path.node.arguments;
      if (args.length === 0) return;
      const firstArg = args[0]!;
      if (!t.isStringLiteral(firstArg)) {
        // Non-literal event name — emit cannot be statically rewritten.
        return;
      }
      const eventName = firstArg.value;
      const propName = toReactEventPropName(eventName);
      // Filter out JSXNamespacedName which can never appear here (TS narrowing).
      const restArgs = args
        .slice(1)
        .filter((a) => !t.isJSXNamespacedName(a)) as Array<
        t.Expression | t.SpreadElement | t.ArgumentPlaceholder
      >;
      // Plan 04-04 lint-clean fix — `props.onClose?.()` (OptionalCallExpression
      // of OptionalMemberExpression) confuses eslint-plugin-react-hooks v5's
      // exhaustive-deps narrowing: the deps array entry `props.onClose` is a
      // plain MemberExpression but the body's optional chain doesn't structurally
      // match, so the lint rule warns "missing dependency: props". Workaround:
      // emit a logical-AND guard `props.onClose && props.onClose(...)` which
      // uses MemberExpression on both sides — matches deps[] entry exactly.
      const memberExpr = t.memberExpression(
        t.identifier('props'),
        t.identifier(propName),
      );
      const replacement = t.logicalExpression(
        '&&',
        memberExpr,
        t.callExpression(t.cloneNode(memberExpr), restArgs),
      );
      path.replaceWith(replacement);
    },
  });

  return { rewrittenProgram: program, diagnostics };
}
