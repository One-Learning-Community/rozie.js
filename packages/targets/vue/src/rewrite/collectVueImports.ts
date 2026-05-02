/**
 * VueImportCollector — accumulates the set of `'vue'` named imports needed
 * by an emitted `<script setup>` block (Phase 3 Plan 02 Task 2).
 *
 * Symbols collected dynamically as emitScript runs:
 *   - `ref`              — for each StateDecl + RefDecl
 *   - `computed`         — for each ComputedDecl (D-34)
 *   - `onMounted`        — for each LifecycleHook with phase: 'mount'
 *   - `onBeforeUnmount`  — for each LifecycleHook cleanup OR phase: 'unmount'
 *   - `onUpdated`        — for each LifecycleHook with phase: 'update'
 *   - `watchEffect`      — Plan 04: per Class A native + Class C
 *                          .debounce/.throttle <listeners>-block entries
 *
 * Compile-time macros (`defineProps` / `defineEmits` / `defineSlots` /
 * `defineModel` / `withDefaults`) need NO import — Vue's SFC compiler
 * transforms them at compile time. The collector ignores them.
 *
 * @experimental — shape may change before v1.0
 */

export class VueImportCollector {
  private symbols = new Set<string>();

  use(name: string): void {
    this.symbols.add(name);
  }

  has(name: string): boolean {
    return this.symbols.has(name);
  }

  /**
   * Render a single `import { ... } from 'vue';` line with sorted symbols,
   * or an empty string when nothing was used.
   *
   * Sorted alphabetically for deterministic snapshot output.
   */
  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from 'vue';`;
  }
}

/**
 * RuntimeVueImportCollector — Phase 3 Plan 04 sibling of VueImportCollector
 * for `@rozie/runtime-vue` named imports (D-40 / D-41).
 *
 * Collected helper names — only what's actually emitted:
 *   - `useOutsideClick` — D-42 collapse for `<listeners>` `.outside`
 *   - `debounce`        — script-level wrap for `.debounce(ms)`
 *   - `throttle`        — script-level wrap for `.throttle(ms)`
 *   - `isEnter`/`isEscape`/...  — key-filter predicates (Plan 04 may also
 *     emit inline `e.key !== 'Escape'` checks; predicate imports collected
 *     when the emitter chose that path)
 *
 * Sorted alphabetically on render so snapshot output is deterministic.
 *
 * @experimental — shape may change before v1.0
 */
export class RuntimeVueImportCollector {
  private symbols = new Set<string>();

  use(name: string): void {
    this.symbols.add(name);
  }

  has(name: string): boolean {
    return this.symbols.has(name);
  }

  /**
   * Snapshot of collected names — sorted, used by tests for set-membership
   * assertions without relying on the rendered string format.
   */
  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from '@rozie/runtime-vue';`;
  }
}
