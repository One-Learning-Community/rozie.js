/**
 * emitTypes (Vue) — Phase 22 Plan 22-03 (typed `.rozie` imports).
 *
 * Emits a sibling Vue `.d.rozie.ts` from an `IRComponent`. Mirrors React's
 * `emitTypes.ts` structure but:
 *   - consumes the Plan-02 core-shared `renderPropsInterface` for the
 *     framework-AGNOSTIC props-interface body (the prop/event/slot mapping is
 *     a single source of truth — see the LOCKED CONTRACT in 22-02-SUMMARY.md),
 *   - swaps ONLY the framework default-export idiom to Vue's
 *     `DefineComponent<<Name>Props>` (PATTERNS Pattern 2 table).
 *
 * Output shape (canonical):
 *
 *   import type { DefineComponent } from 'vue';
 *   export interface CounterProps {
 *     value?: number;
 *     defaultValue?: number;
 *     onValueChange?: (next: number) => void;
 *     step?: number;
 *   }
 *   declare const Counter: DefineComponent<CounterProps>;
 *   export default Counter;
 *
 * Handle interface (Phase 21 $expose, REQ-2): when `ir.expose` is non-empty the
 * `<Name>Handle` interface is synthesized via the core-shared
 * `synthesizeHandleType` and exported alongside the default export. When empty,
 * NO handle interface is emitted.
 *
 * Slot idiom decision (Vue): Vue render-slot functions return VNodes, but the
 * slot-props surface is NOT part of the validated `DefineComponent<Props>`
 * consumer contract (SPIKE-FINDINGS validated the no-slot props surface; the
 * Wave-3 consumer typecheck is the authoritative gate). We pass `'unknown'` as
 * the slot-children token so the sidecar stays import-free and never widens a
 * consumer's `DefineComponent` binding to a shape that fights vue-tsc. This is
 * the conservative, idiomatic-Vue choice (a Vue dev does not hand-type slot
 * render-function return values in a declaration sidecar).
 *
 * NO do-not-edit header / source-hash is prepended here — the Wave-3 sidecar
 * WRITER owns that.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
// `synthesizeHandleType` is not yet in the `@rozie/core` barrel (22-02-SUMMARY
// "Next Phase Readiness") — import it relatively as React's emitTypes.ts does.
import { synthesizeHandleType } from '../../../../core/src/codegen/synthesizeHandleType.js';
// The framework-agnostic props-interface body is rendered by the core-shared
// `renderPropsInterface` (Plan 22-02 LOCKED CONTRACT) so the per-target type
// renderers cannot drift from the prop→TS-type mapping. Imported from the
// `@rozie/core` barrel.
import { renderPropsInterface } from '@rozie/core';

/**
 * Options controlling Vue `.d.rozie.ts` emission.
 *
 * @experimental — shape may change before v1.0
 */
export interface EmitVueTypesOptions {
  /**
   * D-85 generic preservation: when set, emits
   * `export interface FooProps<T, ...>` and
   * `declare const Foo: DefineComponent<FooProps<T, ...>>;`.
   */
  genericParams?: string[];
}

/**
 * Build a Vue `.d.rozie.ts` source string from an IRComponent.
 *
 * @public — consumed by the Wave-3 unplugin sidecar emit + CLI fallback.
 */
export function emitVueTypes(
  ir: IRComponent,
  opts: EmitVueTypesOptions = {},
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
  lines.push(`import type { DefineComponent } from 'vue';`);
  lines.push('');

  lines.push(
    renderPropsInterface(ir, {
      ...(opts.genericParams ? { genericParams: opts.genericParams } : {}),
      slotChildrenType: 'unknown',
    }),
  );
  lines.push('');

  if (exposed && handleInterface) {
    lines.push(`export ${handleInterface}`);
    lines.push('');
  }

  lines.push(
    `declare const ${ir.name}: DefineComponent<${ir.name}Props${generics}>;`,
  );
  lines.push(`export default ${ir.name};`);
  lines.push('');
  return lines.join('\n');
}
