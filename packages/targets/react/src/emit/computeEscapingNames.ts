/**
 * computeEscapingNames — quick 260829-j18.
 *
 * Single computation of the "escaping" top-level binding name set: every
 * top-level binding React must give a STABLE identity because a mount-phase
 * effect / listener reaches it — directly, or transitively through one or
 * more top-level helper bodies.
 *
 * Before quick 260829-j18 this set was a ONE-LEVEL, NON-TRANSITIVE scan of
 * `Listener.deps` / `LifecycleHook.setupDeps` (`closure`-scoped entries
 * only) — a direct mirror of Phase 2's `computeExpressionDeps` /
 * `ReactiveDepGraph` contract (`packages/core/src/reactivity/computeDeps.ts`,
 * D-21: "record the identifier as a closure dep but do NOT recurse into the
 * referenced declaration's body"). That non-transitivity is a DELIBERATE
 * core contract for the IR — it stays untouched. But the React emitter's own
 * identity-stability concern is NOT satisfied by a one-level scan: a
 * `new Compartment()` a mount effect reaches only THROUGH a top-level helper
 * (`buildState() -> gutterCompartment.of(...)`) was invisible to the old
 * scan and never got `useMemo` — a fresh instance every render, which
 * silently no-ops any imperative API keyed on that instance's identity
 * (CodeMirror's `scheduleReconfigure(compartment, ...)` is the corpus shape
 * that exposed this — quick 260829-j18's objective).
 *
 * As of Task 3, the expansion is TRANSITIVE, to a fixpoint, through helper
 * bodies — bounded by construction to two disjoint sets:
 *
 *   - the FRONTIER (helper names) — the traversal MEDIUM. A frontier name is
 *     walked (its body inspected for further references) but is NEVER
 *     itself added to the result as a side effect of that walk.
 *   - the RESULT — every directly-seeded name (unchanged pre-Task-3
 *     behaviour: a helper OR a const referenced straight from
 *     `Listener.deps` / `LifecycleHook.setupDeps` lands here, exactly as
 *     before) PLUS every `stabilizableConstNames` member reached at any
 *     depth through the frontier walk.
 *
 * Why this bound is load-bearing (F-06): `tryWrapEscapingHelperUseCallback`
 * only accepts a `VariableDeclaration` whose init is an arrow/function
 * expression. The plain-hoist branch converts a NON-escaping arrow const
 * into a `function H() {}` declaration SPECIFICALLY to get hoisting (const
 * arrows don't hoist — TDZ `ReferenceError` at render time otherwise). If a
 * helper's NAME were promoted into the result set merely because the walk
 * passed through its body, that helper would newly qualify for the
 * `useCallback` wrap and FLIP from a hoisted `function` declaration back to
 * a non-hoisted `const H = useCallback(...)` — reopening the exact TDZ class
 * the hoist branch exists to close, across a shipped corpus of 860+
 * `function` declarations. So: helper bodies are read, but only a
 * NON-function top-level `const` binder — a member of `stabilizableConstNames`
 * — may ever be ADDED to the result by the expansion.
 *
 * The dep-array a stabilized const RECEIVES is computed separately, by the
 * SAME `computeHelperBodyDeps` walk a directly-escaping const already uses
 * (see `tryWrapEscapingConstUseMemo`'s own call, over the const's own
 * initializer) — this module only decides WHICH names are escaping, never
 * what they depend on.
 *
 * Precedence facts a future reader needs (F-05 — no double-wrap is
 * structurally possible): the four wrap passes in `emitScript.ts`'s
 * userArrowsLines loop each `continue` on success, so a statement is claimed
 * by exactly ONE pass. Growing this result set can only MOVE a statement to
 * an EARLIER branch in that loop, never claim it twice — a member-mutated
 * fresh instance is claimed by `tryWrapMutatedInstanceUseMemo`, which runs
 * FIRST, so its deliberately stable `[]` identity is preserved even when the
 * same const is ALSO transitively escaping (Task 1 CONTROL F pins this).
 *
 * Two consumers read this ONE result (previously two independently — and
 * driftably — maintained copies, quick 260803-w7b's `useCallbackHelperNames`
 * and section 6a's `escapingHelperNames`; collapsed by Task 2): the
 * `useCallback` / `useMemo` wrap decision in section 6a, and the seam-3
 * staleness classification `useCallbackHelperNames` feeds.
 *
 * Seed sources today: `Listener.deps` and `LifecycleHook.setupDeps`
 * (`closure`-scoped entries). `WatchHook.getterDeps` is a real, documented
 * gap (`tryWrapEscapingConstUseMemo`'s own doc comment names it as a source
 * this function reads, which is not yet true) — quick 260829-j18 Task 4
 * closes it as a droppable follow-up seed, GETTER body only, never the
 * `$watch` callback body (a helper reachable only from a watch callback is
 * already handled by that watcher-effect's own targeted
 * `react-hooks/exhaustive-deps` disable directive; feeding callback bodies
 * into this set would collide with that machinery).
 *
 * @experimental — shape may change before v1.0
 */
import type { Expression, BlockStatement } from '@babel/types';
import type { IRComponent } from '@rozie/core';
import { computeHelperBodyDeps } from './computeHelperDeps.js';

export interface ComputeEscapingNamesInput {
  ir: IRComponent;
  /** Every top-level helper name (function decl OR arrow/fn-expression const). */
  allHelperNames: Set<string>;
  /** helper name -> its body, for the transitive walk. */
  helperBodyByName: Map<string, Expression | BlockStatement>;
  /**
   * Every top-level `const` name whose init is present and is NOT an
   * arrow/function expression — the only class the transitive expansion may
   * ADD to the result (F-06).
   */
  stabilizableConstNames: Set<string>;
}

export function computeEscapingNames({
  ir,
  allHelperNames,
  helperBodyByName,
  stabilizableConstNames,
}: ComputeEscapingNamesInput): Set<string> {
  const result = new Set<string>();
  const frontier: string[] = [];
  const visited = new Set<string>();

  const seed = (name: string): void => {
    // Unchanged pre-Task-3 behaviour: EVERY direct seed lands in the result,
    // whether it names a helper or (rarely — an effect/listener reading a
    // const directly, no helper indirection) a const.
    result.add(name);
    if (allHelperNames.has(name) && !visited.has(name)) frontier.push(name);
  };

  for (const listener of ir.listeners) {
    for (const dep of listener.deps) {
      if (dep.scope === 'closure') seed(dep.identifier);
    }
  }
  for (const lh of ir.lifecycle) {
    for (const dep of lh.setupDeps) {
      if (dep.scope === 'closure') seed(dep.identifier);
    }
  }

  // Union built ONCE, outside the loop. Never mutate `allHelperNames` itself
  // — it is also the lookup every OTHER rendered dep array consults, and
  // widening it there would change emitted deps (F-08).
  const lookup = new Set<string>([...allHelperNames, ...stabilizableConstNames]);

  while (frontier.length > 0) {
    const helperName = frontier.pop()!;
    if (visited.has(helperName)) continue;
    visited.add(helperName);
    const body = helperBodyByName.get(helperName);
    if (!body) continue;
    const refs = computeHelperBodyDeps(body, ir, lookup, helperName);
    for (const ref of refs) {
      if (ref.scope !== 'closure') continue;
      const refName = ref.identifier;
      if (allHelperNames.has(refName)) {
        // Frontier ONLY — continues the walk, never promoted into the
        // result (F-06). A helper name reaches the result set only via a
        // DIRECT seed above, exactly as before Task 3.
        if (!visited.has(refName)) frontier.push(refName);
        continue;
      }
      if (stabilizableConstNames.has(refName)) {
        result.add(refName);
      }
      // Otherwise: an import binding or a genuine global — discarded.
    }
  }

  return result;
}
