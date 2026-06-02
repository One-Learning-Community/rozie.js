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
 *   export declare class Counter {
 *     value?: number;
 *     step?: number;
 *   }
 *   export default Counter;
 *
 * ── SPIKE-FINDINGS Angular verdict — REVISED 2026-06-02 (regression fix) ─────
 * Angular is the one target that ALSO writes a compiled `<Name>.rozie.ts`
 * disk-cache (unplugin's `emitRozieTsToDisk`). The Wave-0 spike (22-01,
 * SPIKE-FINDINGS.md) claimed the sidecar `<Name>.d.rozie.ts` and the disk-cache
 * `<Name>.rozie.ts` coexist with "zero module-resolution ambiguity" — that
 * verdict was validated under PLAIN tsc only and is WRONG for ngtsc:
 *
 * TS module resolution prefers the arbitrary-extension declaration
 * `<Name>.d.rozie.ts` over extension-appending to `<Name>.rozie.ts` when
 * resolving `./<Name>.rozie` (regardless of `allowArbitraryExtensions`). ngtsc
 * (inside @analogjs/vite-plugin-angular) uses that same resolution to validate
 * standalone `imports: [...]` entries; a type-only `declare class` carries no
 * ɵcmp metadata, so ngtsc silently skips AOT for every class importing a
 * `.rozie` module → runtime "JIT compiler unavailable" (the 2026-06-02 Angular
 * matrix + VR matrix regression).
 *
 * ⇒ REVISED DECISION: no `.d.rozie.ts` is ever placed next to a `.rozie` source
 * for the Angular target (the unplugin heals/deletes them — see
 * packages/unplugin/src/emitSidecar.ts ANGULAR EXCEPTION). The disk-cache
 * `.rozie.ts` class IS the Angular typed-import surface. This renderer is kept
 * for the CLI path only (sidecars next to compiled OUTPUT files, where no
 * `.rozie` sibling exists). A future ngtsc-valid sidecar must declare
 * `static ɵcmp: ɵɵComponentDeclaration<...>` the way compiled Angular libraries
 * do.
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

  // Angular default-export idiom: the component class is BOTH the default
  // export AND a NAMED export. The class declares the typed prop members +
  // PUBLIC ir.expose methods.
  //
  // Phase 22 (cross-rozie shim shadowing fix): the class is emitted as
  // `export declare class <Name>` — a NAMED export — not a bare
  // `declare class`. The Angular target writes a `<Name>.ts` cross-rozie
  // re-export shim (`export * from './<Name>.rozie'`) for `<components>`
  // composition. Once this sidecar exists, TS resolves the shim's
  // `./<Name>.rozie` specifier to THIS sidecar (over the disk-cache
  // `<Name>.rozie.ts`), so the consumer's `import { <Name> }` (the named class)
  // is satisfied by `export *` ONLY if the class is a named export here. A bare
  // `declare class` (default-only) made `export *` re-export nothing → TS2614
  // on every cross-rozie composition cell (the Plan-05 known-red entry
  // condition). The named `export declare class` closes it WITHOUT touching the
  // runtime AOT path (the shim still resolves `./<Name>.rozie` → the disk-cache
  // VALUE class at bundle time; the sidecar is type-only). `export default`
  // remains so direct `import <Name> from './<Name>.rozie'` keeps working.
  lines.push(`export declare class ${ir.name} {`);
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
