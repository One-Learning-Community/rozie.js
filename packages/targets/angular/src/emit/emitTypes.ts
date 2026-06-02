/**
 * emitTypes (Angular) — Phase 22 Plan 22-04 (typed `.rozie` imports).
 *
 * Emits a sibling Angular `.d.rozie.ts` from an `IRComponent`. Like the Wave-2
 * sibling renderers it consumes the Plan-02 core-shared `renderPropsInterface`
 * for the framework-AGNOSTIC props body, swapping ONLY the default-export idiom
 * to Angular's shape (PATTERNS Pattern 2 + the SPIKE-FINDINGS-validated shape):
 *
 *   - `export interface <Name>Props { … }` (shared body),
 *   - `declare class <Name> { … }` carrying the typed prop members + the PUBLIC
 *     `ir.expose` methods (Phase 21 21-06 Angular public-method guarantee),
 *     exported as the default. A TS `class` is BOTH a value and a type, so the
 *     default-export class is the component DI token AND its instance type — no
 *     separate `declare const … : Type<…>` is emitted (that would be a
 *     duplicate-identifier conflict with the class binding, TS2451).
 *
 * Output shape (canonical, Counter):
 *
 *   export interface CounterProps {
 *     value?: number;
 *     defaultValue?: number;
 *     onValueChange?: (next: number) => void;
 *     step?: number;
 *   }
 *
 *   declare class Counter {
 *     value?: number;
 *     step?: number;
 *   }
 *   export default Counter;
 *
 * ── SPIKE-FINDINGS Angular disk-cache verdict (BINDING for Plan 05) ──────────
 * Angular is the one target that ALSO writes a compiled `<Name>.rozie.ts`
 * disk-cache (unplugin's `emitRozieTsToDisk`). The Wave-0 spike (22-01,
 * SPIKE-FINDINGS.md) empirically proved the sidecar `<Name>.d.rozie.ts` and the
 * disk-cache `<Name>.rozie.ts` COEXIST under `include: src/**\/*.ts` with ZERO
 * duplicate-identifier / module-resolution ambiguity — they are DISTINCT
 * modules (the sidecar declares the `./Foo.rozie` specifier; the disk-cache is
 * the separate `./Foo.rozie.ts` / `./Foo` module). The sidecar is NOT redundant
 * with the disk-cache: the disk-cache exposes only the DEFAULT-export class
 * type, while the sidecar adds the named `<Name>Props` / handle exports.
 *
 * ⇒ DECISION (recorded for Plan 05): Wave-3 WRITES the Angular sidecar to disk
 * like every other target (the demo additionally needs
 * `allowArbitraryExtensions: true` in its tsconfig, per SPIKE-FINDINGS); the
 * existing disk-cache `.rozie.ts` is KEPT (complementary, non-conflicting).
 *
 * Slot idiom (Angular): slots are projected via `<ng-template>`; the slot-props
 * surface is not part of the typed-class consumer contract, so the shared props
 * body uses `'unknown'` as the slot-children token (import-free; matches the
 * conservative Vue/Lit choice).
 *
 * NO do-not-edit header / source-hash is prepended here — the Wave-3 sidecar
 * WRITER owns that.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
// `synthesizeHandleType` is not yet in the `@rozie/core` barrel (22-02-SUMMARY
// "Next Phase Readiness") — import it relatively as React/Vue's emitTypes.ts do.
import { synthesizeHandleType } from '../../../../core/src/codegen/synthesizeHandleType.js';
// The framework-agnostic props body + the single-source prop→TS-type mapping
// come from `@rozie/core` (Plan 22-02 LOCKED CONTRACT).
import { renderPropsInterface, renderPropType } from '@rozie/core';

/**
 * Options controlling Angular `.d.rozie.ts` emission.
 *
 * @experimental — shape may change before v1.0
 */
export interface EmitAngularTypesOptions {
  /**
   * D-85 generic preservation: when set, emits
   * `export interface FooProps<T, ...>`.
   */
  genericParams?: string[];
}

/**
 * Extract the already-public member lines from a `synthesizeHandleType`
 * interface body for splicing into the `declare class` body (no
 * `private`/`protected`/`#` — public by default).
 */
function exposeMemberLines(handleInterface: string): string[] {
  const lines = handleInterface.split('\n');
  return lines.slice(1, -1).filter((l) => l.trim().length > 0);
}

/**
 * Render the typed prop members for the `declare class` body. Mirrors the
 * shared props-interface fields (via the single-source `renderPropType`) so the
 * class surface and the `<Name>Props` interface cannot drift. Model props emit
 * the input identifier only (the `default*` / `on*Change` triplet stays on the
 * Props interface, which is the consumer-facing prop bag).
 */
function classPropMembers(ir: IRComponent): string[] {
  const out: string[] = [];
  for (const prop of ir.props) {
    const tsType = renderPropType(prop.typeAnnotation);
    // Required when no default; optional when a default is set (mirrors the
    // shared renderer's gating).
    const hasDefault =
      prop.defaultValue !== null && prop.defaultValue !== undefined;
    const optional = hasDefault || prop.isModel ? '?' : '';
    out.push(`  ${prop.name}${optional}: ${tsType};`);
  }
  return out;
}

/**
 * Build an Angular `.d.rozie.ts` source string from an IRComponent.
 *
 * @public — consumed by the Wave-3 unplugin sidecar emit + CLI fallback.
 */
export function emitAngularTypes(
  ir: IRComponent,
  opts: EmitAngularTypesOptions = {},
): string {
  const exposed = (ir.expose ?? []).length > 0;
  const handleInterface = exposed
    ? synthesizeHandleType(ir, `${ir.name}Handle`)
    : null;

  const lines: string[] = [];

  lines.push(
    renderPropsInterface(ir, {
      ...(opts.genericParams ? { genericParams: opts.genericParams } : {}),
      slotChildrenType: 'unknown',
    }),
  );
  lines.push('');

  // Angular default-export idiom: the component class + its DI-token const.
  // The class declares the typed prop members + PUBLIC ir.expose methods.
  lines.push(`declare class ${ir.name} {`);
  for (const member of classPropMembers(ir)) {
    lines.push(member);
  }
  if (exposed && handleInterface) {
    for (const member of exposeMemberLines(handleInterface)) {
      lines.push(member);
    }
  }
  lines.push(`}`);
  lines.push(`export default ${ir.name};`);
  lines.push('');
  return lines.join('\n');
}
