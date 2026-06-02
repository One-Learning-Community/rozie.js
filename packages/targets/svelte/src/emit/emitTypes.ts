/**
 * emitTypes (Svelte) — Phase 22 Plan 22-03 (typed `.rozie` imports).
 *
 * Emits a sibling Svelte `.d.rozie.ts` from an `IRComponent`. Mirrors React's
 * `emitTypes.ts` structure but:
 *   - consumes the Plan-02 core-shared `renderPropsInterface` for the
 *     framework-AGNOSTIC props-interface body (single source of truth — see the
 *     LOCKED CONTRACT in 22-02-SUMMARY.md),
 *   - swaps ONLY the framework default-export idiom to Svelte's inline
 *     `import('svelte').Component<<Name>Props>` form (PATTERNS Pattern 2 table;
 *     this is exactly the shape the SPIKE-FINDINGS validated for the Svelte
 *     arm — `Component<SpikeProps>`).
 *
 * Output shape (canonical):
 *
 *   import type { Snippet } from 'svelte';   // only when ir.slots is non-empty
 *   export interface CounterProps {
 *     value?: number;
 *     defaultValue?: number;
 *     onValueChange?: (next: number) => void;
 *     step?: number;
 *   }
 *   declare const Counter: import('svelte').Component<CounterProps>;
 *   export default Counter;
 *
 * Handle interface (Phase 21 $expose, REQ-2): when `ir.expose` is non-empty the
 * `<Name>Handle` interface is synthesized via the core-shared
 * `synthesizeHandleType` and exported alongside the default export. When empty,
 * NO handle interface is emitted.
 *
 * Slot idiom decision (Svelte): the compiled `.svelte` types slot props as
 * Svelte 5 `Snippet`s (emitScript: `import type { Snippet } from 'svelte';` +
 * `header?: Snippet<...>`). The sidecar mirrors that idiom by passing `'Snippet'`
 * as the slot-children token, and adds the `import type { Snippet } from
 * 'svelte';` header ONLY when `ir.slots` is non-empty (matching the compiled
 * file, which omits the import when there are no slots — see emitScript Test 9).
 * The default-export idiom intentionally uses the inline `import('svelte')`
 * form (NOT a top `import type { Component }`) per PATTERNS Pattern 2.
 *
 * NO do-not-edit header / source-hash is prepended here — the Wave-3 sidecar
 * WRITER owns that.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
// `synthesizeHandleType` is not yet in the `@rozie/core` barrel — import it
// relatively as React's emitTypes.ts does.
import { synthesizeHandleType } from '../../../../core/src/codegen/synthesizeHandleType.js';
import { renderPropsInterface } from '@rozie/core';

/**
 * Options controlling Svelte `.d.rozie.ts` emission.
 *
 * @experimental — shape may change before v1.0
 */
export interface EmitSvelteTypesOptions {
  /**
   * D-85 generic preservation: when set, emits
   * `export interface FooProps<T, ...>` and the inline
   * `import('svelte').Component<FooProps<T, ...>>` default export.
   */
  genericParams?: string[];
}

/**
 * Build a Svelte `.d.rozie.ts` source string from an IRComponent.
 *
 * @public — consumed by the Wave-3 unplugin sidecar emit + CLI fallback.
 */
export function emitSvelteTypes(
  ir: IRComponent,
  opts: EmitSvelteTypesOptions = {},
): string {
  const exposed = (ir.expose ?? []).length > 0;
  const handleInterface = exposed
    ? synthesizeHandleType(ir, `${ir.name}Handle`)
    : null;

  const generics =
    opts.genericParams && opts.genericParams.length > 0
      ? `<${opts.genericParams.join(', ')}>`
      : '';

  const lines: string[] = [];
  // Mirror the compiled `.svelte`: the Snippet import appears ONLY when slots
  // exist (emitScript Test 9 — Counter has no Snippet import).
  if (ir.slots.length > 0) {
    lines.push(`import type { Snippet } from 'svelte';`);
    lines.push('');
  }

  lines.push(
    renderPropsInterface(ir, {
      ...(opts.genericParams ? { genericParams: opts.genericParams } : {}),
      slotChildrenType: 'Snippet',
    }),
  );
  lines.push('');

  if (exposed && handleInterface) {
    lines.push(`export ${handleInterface}`);
    lines.push('');
  }

  lines.push(
    `declare const ${ir.name}: import('svelte').Component<${ir.name}Props${generics}>;`,
  );
  lines.push(`export default ${ir.name};`);
  lines.push('');
  return lines.join('\n');
}
