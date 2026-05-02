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
 *
 * Compile-time macros (`defineProps` / `defineEmits` / `defineSlots` /
 * `defineModel` / `withDefaults`) need NO import — Vue's SFC compiler
 * transforms them at compile time. The collector ignores them.
 *
 * `watchEffect` is Plan 04's responsibility (listeners block lowering).
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
