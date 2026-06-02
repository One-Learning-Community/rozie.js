/**
 * emitTypes (Solid) — Phase 22 Plan 22-03 (typed `.rozie` imports).
 *
 * Emits a sibling Solid `.d.rozie.ts` from an `IRComponent`. Mirrors React's
 * `emitTypes.ts` structure but:
 *   - consumes the Plan-02 core-shared `renderPropsInterface` for the
 *     framework-AGNOSTIC props-interface body (single source of truth — see the
 *     LOCKED CONTRACT in 22-02-SUMMARY.md),
 *   - swaps ONLY the framework default-export idiom to Solid's inline
 *     `import('solid-js').Component<<Name>Props>` form (PATTERNS Pattern 2
 *     table).
 *
 * Output shape (canonical):
 *
 *   export interface CounterProps {
 *     value?: number;
 *     defaultValue?: number;
 *     onValueChange?: (next: number) => void;
 *     step?: number;
 *   }
 *   declare const Counter: import('solid-js').Component<CounterProps>;
 *   export default Counter;
 *
 * Handle interface (Phase 21 $expose, REQ-2): when `ir.expose` is non-empty the
 * `<Name>Handle` interface is synthesized via the core-shared
 * `synthesizeHandleType` and exported alongside the default export. When empty,
 * NO handle interface is emitted. (Solid already consumes `synthesizeHandleType`
 * for its inline `ref?: (h: <Name>Handle) => void` prop — see the helper's own
 * docstring.)
 *
 * Slot idiom decision (Solid): Solid slot props are children-returning thunks
 * whose return type is `JSX.Element`. The slot-children token is `'JSX.Element'`
 * (the example token in the LOCKED CONTRACT). The inline `import('solid-js')`
 * default-export form keeps the sidecar header import-free; `JSX` resolves from
 * the consumer's Solid JSX namespace (ambient) at typecheck time.
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
 * Options controlling Solid `.d.rozie.ts` emission.
 *
 * @experimental — shape may change before v1.0
 */
export interface EmitSolidTypesOptions {
  /**
   * D-85 generic preservation: when set, emits
   * `export interface FooProps<T, ...>` and the inline
   * `import('solid-js').Component<FooProps<T, ...>>` default export.
   */
  genericParams?: string[];
}

/**
 * Build a Solid `.d.rozie.ts` source string from an IRComponent.
 *
 * @public — consumed by the Wave-3 unplugin sidecar emit + CLI fallback.
 */
export function emitSolidTypes(
  ir: IRComponent,
  opts: EmitSolidTypesOptions = {},
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

  lines.push(
    renderPropsInterface(ir, {
      ...(opts.genericParams ? { genericParams: opts.genericParams } : {}),
      slotChildrenType: 'JSX.Element',
    }),
  );
  lines.push('');

  if (exposed && handleInterface) {
    lines.push(`export ${handleInterface}`);
    lines.push('');
  }

  lines.push(
    `declare const ${ir.name}: import('solid-js').Component<${ir.name}Props${generics}>;`,
  );
  lines.push(`export default ${ir.name};`);
  lines.push('');
  return lines.join('\n');
}
