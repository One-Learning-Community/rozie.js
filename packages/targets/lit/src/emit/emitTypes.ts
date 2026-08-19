/**
 * emitTypes (Lit) — Phase 22 Plan 22-04 (typed `.rozie` imports).
 *
 * Emits a sibling Lit `.d.rozie.ts` from an `IRComponent`. Like the Wave-2
 * sibling renderers (vue/svelte/solid in Plan 22-03) it consumes the Plan-02
 * core-shared `renderPropsInterface` for the framework-AGNOSTIC props body, but
 * swaps the default-export idiom to Lit's NOVEL shape (PATTERNS Pattern 2):
 *
 *   - `export declare class <Name> extends LitElement { … }` + a separate
 *     `export default <Name>;` (WR-07: mirrors Angular's `declare` form so the
 *     declaration never relies on declaration-file ambient-context leniency) —
 *     Lit consumers `import './Foo.rozie'` for side-effect (the module registers
 *     the custom element); the value they care about typing is the ELEMENT
 *     class, not a `Component<Props>` prop bag.
 *   - the exposed methods (`ir.expose`) declared as PUBLIC class members
 *     (mirroring the Phase 21 21-06 public-element-method guarantee), and
 *   - a `declare global { interface HTMLElementTagNameMap { 'rozie-<kebab>':
 *     <Name> } }` entry so `document.querySelector('rozie-foo')` is typed.
 *
 * Output shape (canonical, Counter):
 *
 *   import type { LitElement } from 'lit';
 *
 *   export interface CounterProps {
 *     value?: number;
 *     defaultValue?: number;
 *     onValueChange?: (next: number) => void;
 *     step?: number;
 *   }
 *
 *   export declare class Counter extends LitElement {
 *   }
 *   export default Counter;
 *
 *   declare global {
 *     interface HTMLElementTagNameMap {
 *       'rozie-counter': Counter;
 *     }
 *   }
 *
 * The kebab tag name is derived with the SAME `emitTagName` helper that
 * `@customElement` uses at runtime (emitDecorator.ts) so the map entry CANNOT
 * drift from the registered element (T-22-04-01).
 *
 * Slot idiom (Lit): Lit slots are projected as light-DOM children; the
 * slot-props surface is not part of the element-class consumer contract, so the
 * shared props body uses `'unknown'` as the slot-children token (import-free,
 * mirrors the conservative Vue choice in 22-03).
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
import { renderPropsInterface } from '@rozie/core';
// Reuse the SAME tag-deriving helper the runtime `@customElement` decorator
// uses so the HTMLElementTagNameMap key cannot drift from the registration.
import { emitTagName } from './emitDecorator.js';

/**
 * Options controlling Lit `.d.rozie.ts` emission.
 *
 * @experimental — shape may change before v1.0
 */
export interface EmitLitTypesOptions {
  /**
   * D-85 generic preservation: when set, emits
   * `export interface FooProps<T, ...>`.
   */
  genericParams?: string[];
}

/**
 * Extract the `name(...): ret;` / `name: (...) => ...;` member lines from a
 * `synthesizeHandleType` interface body, re-indented for an element-class body.
 *
 * `synthesizeHandleType` returns `interface <Name> {\n  member;\n  ...\n}` — we
 * want the inner member lines only, declared as PUBLIC class members (no
 * `private`/`protected`/`#`). The members are already access-modifier-free, so
 * splicing the interface-body lines verbatim into the class body yields public
 * members.
 */
function exposeMemberLines(handleInterface: string): string[] {
  const lines = handleInterface.split('\n');
  // Drop the opening `interface X {` line and the closing `}` line; keep the
  // already-2-space-indented member lines verbatim (public by default).
  return lines.slice(1, -1).filter((l) => l.trim().length > 0);
}

/**
 * Build a Lit `.d.rozie.ts` source string from an IRComponent.
 *
 * @public — consumed by the Wave-3 unplugin sidecar emit + CLI fallback.
 */
export function emitLitTypes(
  ir: IRComponent,
  opts: EmitLitTypesOptions = {},
): string {
  const exposed = (ir.expose ?? []).length > 0;
  const handleInterface = exposed
    ? synthesizeHandleType(ir, `${ir.name}Handle`)
    : null;

  const lines: string[] = [];
  // Type-only LitElement import — the element class extends it in the .d.ts.
  lines.push(`import type { LitElement } from 'lit';`);
  lines.push('');

  lines.push(
    renderPropsInterface(ir, {
      ...(opts.genericParams ? { genericParams: opts.genericParams } : {}),
      slotChildrenType: 'unknown',
    }),
  );
  lines.push('');

  // Lit default-export idiom: the element class. Exposed methods become PUBLIC
  // class members (Phase 21 21-06 public-element-method guarantee).
  //
  // WR-07 (Phase 22 review): emit `export declare class` (mirroring Angular's
  // emitTypes.ts), NOT a non-`declare` `export default class`. The file is a
  // `.d.rozie.ts` declaration file, so a value-bearing class with a runtime
  // `extends LitElement` heritage clause and no `declare` keyword relied on the
  // ambient-context leniency of declaration files — a brittle posture that
  // risks TS1183 ("An implementation cannot be declared in ambient contexts")
  // and was only ever validated by a substring assertion, never by `tsc` over
  // the emitted sidecar. The `declare` form is the safe, explicit shape and
  // still carries the `extends LitElement` heritage so the HTMLElementTagNameMap
  // entry types correctly. A separate `export default <Name>;` keeps the
  // side-effect `import './Foo.rozie'` default-import working (matching Angular).
  lines.push(`export declare class ${ir.name} extends LitElement {`);
  if (exposed && handleInterface) {
    for (const member of exposeMemberLines(handleInterface)) {
      lines.push(member);
    }
  }
  lines.push(`}`);
  lines.push(`export default ${ir.name};`);
  lines.push('');

  // The novel Lit value-add: typed `document.querySelector('rozie-<kebab>')`.
  // The tag is derived with the SAME helper the runtime @customElement uses.
  const tag = emitTagName(ir.name);
  lines.push(`declare global {`);
  lines.push(`  interface HTMLElementTagNameMap {`);
  lines.push(`    '${tag}': ${ir.name};`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push('');
  return lines.join('\n');
}
