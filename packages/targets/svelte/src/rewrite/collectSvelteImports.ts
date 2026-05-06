/**
 * SvelteImportCollector — accumulates the set of `'svelte'` named imports
 * needed by an emitted `<script lang="ts">` block (Phase 5 Plan 02a).
 *
 * Symbols collected dynamically as emitScript runs:
 *   - `Snippet`  — type-only import; collected when ir.slots is non-empty
 *
 * Compile-time runes (`$props`/`$state`/`$derived`/`$effect`/`$bindable`)
 * need NO import — Svelte's compiler handles them at compile time.
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO `@rozie/runtime-svelte` runtime imports
 * collected in v1 — debounce/throttle/outsideClick all inline in the emitted
 * SFC body.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';

export interface SvelteImportSet {
  /** Type-only imports from `'svelte'` (rendered as `import type { ... }`). */
  typeImports: Set<string>;
}

export class SvelteImportCollector {
  private typeSymbols = new Set<string>();

  useType(name: string): void {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
      throw new Error(`[rozie] Invalid Svelte type-import name: '${name}'`);
    }
    this.typeSymbols.add(name);
  }

  hasType(name: string): boolean {
    return this.typeSymbols.has(name);
  }

  /**
   * Render a single `import type { ... } from 'svelte';` line with sorted
   * symbols, or an empty string when nothing was used.
   */
  render(): string {
    if (this.typeSymbols.size === 0) return '';
    const sorted = [...this.typeSymbols].sort();
    return `import type { ${sorted.join(', ')} } from 'svelte';`;
  }

  snapshot(): SvelteImportSet {
    return { typeImports: new Set(this.typeSymbols) };
  }
}

/**
 * Inspect the IR and pre-compute which Svelte imports the emitter will need.
 *
 * Svelte's compiler exports `Snippet` as a TypeScript type used to type slot
 * props (`header?: Snippet<[Ctx]>`). When ir.slots is non-empty we add it.
 *
 * Per A8/A9: NO runtime imports — debounce/throttle/outsideClick inline.
 */
export function collectSvelteImports(ir: IRComponent): SvelteImportSet {
  const collector = new SvelteImportCollector();
  if (ir.slots.length > 0) {
    collector.useType('Snippet');
  }
  return collector.snapshot();
}
