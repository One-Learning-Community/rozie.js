/**
 * ReactImportCollector — accumulates the set of `'react'` named imports
 * needed by an emitted `.tsx` file (Plan 04-02 Task 1).
 *
 * Symbols collected dynamically as emitScript runs:
 *   - `useState`     — for each StateDecl
 *   - `useMemo`      — for each ComputedDecl
 *   - `useEffect`    — for each LifecycleHook OR Listener (Plan 04-04)
 *   - `useRef`       — for each RefDecl AND for each module-let auto-hoist
 *   - `useCallback`  — Plan 04-04 may need for handler stability
 *
 * Critically: NO `import React from 'react'` is ever generated here per
 * D-68 (automatic JSX runtime). Consumers' tsconfig.json must have
 * `"jsx": "react-jsx"` (Plan 04-01 sets this on examples/consumers/react-vite/).
 *
 * @experimental — shape may change before v1.0
 */
export type ReactImport =
  | 'useState'
  | 'useMemo'
  | 'useEffect'
  | 'useRef'
  | 'useCallback';

export class ReactImportCollector {
  private symbols = new Set<ReactImport>();

  add(name: ReactImport): void {
    this.symbols.add(name);
  }

  has(name: ReactImport): boolean {
    return this.symbols.has(name);
  }

  /** Snapshot for tests / set-membership assertions. */
  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  /**
   * Render a single `import { ... } from 'react';` line with sorted symbols
   * (alphabetized for snapshot stability), or empty string when nothing was used.
   */
  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from 'react';\n`;
  }
}

/**
 * RuntimeReactImportCollector — Plan 04-02 Task 1 sibling of ReactImportCollector
 * for `@rozie/runtime-react` named imports (D-65 / D-56).
 *
 * Collected helper names — only what's actually emitted:
 *   - `useControllableState` — D-56 controlled/uncontrolled hybrid
 *   - `useOutsideClick`      — D-65 .outside collapse for <listeners>
 *   - `useDebouncedCallback` — D-65 .debounce(ms) wrap
 *   - `useThrottledCallback` — D-65 .throttle(ms) wrap
 *   - `clsx`                 — Plan 04-03 dynamic class composition
 *   - `isEnter`/`isEscape`/...— key-filter predicates
 *
 * Sorted alphabetically on render so snapshot output is deterministic.
 *
 * @experimental — shape may change before v1.0
 */
export type RuntimeReactImport =
  | 'useControllableState'
  | 'useOutsideClick'
  | 'useDebouncedCallback'
  | 'useThrottledCallback'
  | 'clsx'
  | 'isEnter'
  | 'isEscape'
  | 'isTab'
  | 'isSpace'
  | 'isUp'
  | 'isDown'
  | 'isLeft'
  | 'isRight'
  | 'isCtrl'
  | 'isAlt'
  | 'isShift'
  | 'isMeta';

export class RuntimeReactImportCollector {
  private symbols = new Set<RuntimeReactImport>();

  add(name: RuntimeReactImport): void {
    this.symbols.add(name);
  }

  has(name: RuntimeReactImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from '@rozie/runtime-react';\n`;
  }
}
