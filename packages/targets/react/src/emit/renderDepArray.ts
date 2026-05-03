/**
 * renderDepArray — Plan 04-04 Task 2 utility.
 *
 * Convert a `SignalRef[]` (from Phase 2's `ReactiveDepGraph`) into a
 * deterministic, alphabetized React-side dep-array literal for `useEffect` /
 * `useMemo` / `useCallback`.
 *
 * Per RESEARCH Pattern 3 lines 502-521 + D-21 + D-21b:
 *   - props (non-model)        → `props.foo`
 *   - props (model:true)       → `value`         (bare local from useControllableState)
 *   - data                     → `foo`           (bare local from useState)
 *   - computed                 → `name`          (bare local from useMemo)
 *   - slots (named)            → `props.renderHeader`
 *   - slots (default '')       → `props.children`
 *   - closure                  → `helperFn`     (literal identifier)
 *
 * Refs are EXCLUDED at the SignalRef level — Phase 2 D-21b lock — so this
 * function never receives ref dependencies. Renderer trusts that invariant.
 *
 * Output is sorted lexically for snapshot stability per RESEARCH line 521.
 *
 * **Why alphabetize?** Snapshot tests compare dep-array literals byte-for-byte.
 * The order in `Listener.deps` reflects source-order of expression evaluation —
 * useful for diagnostics, undesirable for stable snapshots. ESLint
 * `react-hooks/exhaustive-deps` does NOT care about order, only set membership.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { SignalRef } from '../../../../core/src/reactivity/signalRef.js';

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Render one SignalRef as the React-side identifier expression that should
 * appear in a useEffect / useMemo dep array. Pure function — no IR mutation.
 */
export function renderSignalRef(dep: SignalRef, ir: IRComponent): string {
  switch (dep.scope) {
    case 'props': {
      const root = dep.path[0]!;
      const isModel = ir.props.some((p) => p.isModel && p.name === root);
      if (isModel) {
        // model:true prop reads the bare local from useControllableState.
        // Path-narrowing: only the root identifier is the React-level dep
        // (downstream member accesses are auto-tracked when the root changes).
        return root;
      }
      return `props.${root}`;
    }
    case 'data':
      return dep.path[0]!;
    case 'computed':
      return dep.path[0]!;
    case 'slots': {
      const slotName = dep.path[0]!;
      // Default-slot sentinel ('') maps to `props.children`.
      if (slotName === '') return 'props.children';
      return `props.render${capitalize(slotName)}`;
    }
    case 'closure':
      return dep.identifier;
  }
}

/**
 * Render `SignalRef[]` as a deterministic dep-array string (`'[a, b, c]'`).
 *
 * Empty input renders `'[]'`. De-duplicates after rendering so two SignalRefs
 * that lower to the same identifier (e.g., `props.foo.bar` and `props.foo.baz`
 * both narrow to root `props.foo`) appear once.
 */
export function renderDepArray(deps: SignalRef[], ir: IRComponent): string {
  const expressions = deps.map((d) => renderSignalRef(d, ir));
  // Dedupe + alphabetize.
  const unique = [...new Set(expressions)].sort();
  if (unique.length === 0) return '[]';
  return `[${unique.join(', ')}]`;
}
