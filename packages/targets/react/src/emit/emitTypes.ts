/**
 * emitTypes — Phase 6 Plan 06-02 Task 1.
 *
 * Emits a sibling React `.d.ts` from an `IRComponent` per CONTEXT D-84
 * (hand-rolled string builder; NO `tsc --emitDeclarationOnly` round-trip).
 *
 * Output shape (canonical):
 *
 *   import type { ReactNode } from 'react';
 *   export interface CounterProps {
 *     value?: number;
 *     defaultValue?: number;
 *     onValueChange?: (next: number) => void;
 *     step?: number;
 *     renderTrigger?: (params: { open: boolean; toggle: () => void }) => ReactNode;
 *     children?: ReactNode;
 *   }
 *   declare function Counter(props: CounterProps): JSX.Element;
 *   export default Counter;
 *
 * Decisions implemented:
 *   - D-84 model:true triplet — `value? / defaultValue? / onValueChange?` named
 *     after the prop's actual identifier (not always `value`).
 *   - D-85 React full generic preservation — when `opts.genericParams` is set,
 *     the interface AND the function signature both carry the type-parameter list.
 *   - D-86 best-effort param-type inference — slot-param `valueExpression` is
 *     resolved against `ir.props` (member-expressions like `$props.open` and
 *     bare identifiers) with `'unknown'` as the genuine fallback. Callable-
 *     looking unresolved identifiers (e.g., Dropdown's `toggle`) emit `() => void`
 *     as a best-effort hint per the canonical Dropdown shape.
 *
 * Per Pitfall 2 (Oxc isolated-decl): every exported function carries an
 * explicit return-type annotation so tsdown's isolated-decl typegen succeeds
 * without a full type-check.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { synthesizeHandleType } from '../../../../core/src/codegen/synthesizeHandleType.js';
// Phase 22 Plan 22-02 — the framework-agnostic props-interface body is now
// rendered by a single core-shared function so the five Wave-2 per-target
// renderers cannot drift from the React prop→TS-type mapping. React passes its
// own slot-children token (`ReactNode`); the per-target default-export
// declaration below stays React-specific.
import { renderPropsInterface } from '../../../../core/src/codegen/renderPropsInterface.js';

/**
 * Options controlling .d.ts emission.
 *
 * @experimental — shape may change before v1.0
 */
export interface EmitReactTypesOptions {
  /**
   * D-85 React full: when set, emits `interface FooProps<T, ...>` and
   * `declare function Foo<T, ...>(props: FooProps<T, ...>): JSX.Element;`.
   *
   * Validation note (T-06-02-03 in threat register): each entry MUST be a
   * valid TypeScript identifier. The Phase 1 parser does NOT yet accept
   * user-authored generic syntax, so this option is currently set ONLY by
   * tests and direct callers — no consumer-controlled path exists in v1.
   */
  genericParams?: string[];
  /**
   * Phase 06.2 P3 D-121: RESERVED — accepted-but-ignored in v1.0. Reserved
   * for future cross-rozie type-graph features (forward-referencing prop /
   * event types from composed `.rozie` files, e.g. emitting
   * `import type { CardHeaderProps } from './CardHeader';` in `Card.d.ts`
   * when CardHeader is in `<components>`). Pass an empty `Map` to be
   * explicit; v1.0 simply discards the value.
   *
   * @experimental — semantics subject to change pre-1.0; see
   * `.planning/notes/phase-6-composition-foresight.md`.
   */
  linkedComponents?: Map<string, IRComponent>;
}

/**
 * Build an `.d.ts` source string from an IRComponent.
 *
 * @public — consumed by `compile()` for the React target and by
 * Plan 06-05's bootstrap script for consumer-ts fixture refresh.
 */
export function emitReactTypes(
  ir: IRComponent,
  opts: EmitReactTypesOptions = {},
): string {
  // Phase 06.2 P3 D-121: linkedComponents is RESERVED in v1.0 — accepted
  // but unused. The body below stays unchanged; opts.linkedComponents will
  // drive future cross-rozie type imports (e.g. `import type { ChildProps }
  // from './Child';`) once the type-graph resolver lands. void-ing the field
  // suppresses unused-locals warnings without consuming it.
  void opts.linkedComponents;

  // Phase 21 ($expose, REQ-10, D-03) — synthesize the `<Name>Handle` interface
  // and switch the component declaration to a forwardRef-typed `declare const`
  // ONLY when ir.expose is non-empty. When empty, the import line + the
  // `declare function` form below stay BYTE-FOR-BYTE unchanged.
  // Defensive `?? []` guards pre-Phase-21 hand-rolled IRs (legacy emitTypes
  // tests construct minimal IRs without the `expose` field; real lowered IRs
  // always carry `expose: []`). Mirrors the `ir.components ?? []` guard in
  // emitReact.ts.
  const exposed = (ir.expose ?? []).length > 0;
  const handleInterface = exposed
    ? synthesizeHandleType(ir, `${ir.name}Handle`)
    : null;

  const lines: string[] = [];
  lines.push(`import type { ReactNode } from 'react';`);
  if (exposed) {
    // `ForwardRefExoticComponent` / `RefAttributes` are referenced via the
    // `React.` namespace in the declaration below (matching the SPEC Req 10
    // shape); import them as named types AND bring the `React` namespace into
    // scope so both `React.ForwardRefExoticComponent` and the named forms
    // resolve regardless of how downstream tooling reads the declaration.
    lines.push(`import type { ForwardRefExoticComponent, RefAttributes } from 'react';`);
    lines.push(`import type * as React from 'react';`);
  }
  lines.push('');

  const generics =
    opts.genericParams && opts.genericParams.length > 0
      ? `<${opts.genericParams.join(', ')}>`
      : '';

  // Phase 22 Plan 22-02 — the entire `export interface ${ir.name}Props { … }`
  // body (model-triplet, required/optional gating, ir.emits→on<Event>, slot
  // params, the slots?: mirror field) is now rendered by the core-shared
  // `renderPropsInterface`. React passes its own slot-children token
  // (`ReactNode`). The output is BYTE-IDENTICAL to the prior inline loop — the
  // existing emitTypes snapshot suite is the byte-identity guard (NO rebless).
  lines.push(
    renderPropsInterface(ir, {
      // Spread the optional generics only when present — the core option type
      // is `exactOptionalPropertyTypes`-clean (an explicit `undefined` is
      // rejected; omit the key instead).
      ...(opts.genericParams ? { genericParams: opts.genericParams } : {}),
      slotChildrenType: 'ReactNode',
    }),
  );
  lines.push('');

  // Phase 21 ($expose, REQ-10) — the exported handle interface + the
  // forwardRef-typed component declaration. When NOT exposed, emit the
  // unchanged `declare function` form (D-03 byte-identity).
  if (exposed && handleInterface) {
    // synthesizeHandleType returns the interface WITHOUT `export`; prepend it
    // for the `.d.ts` surface.
    lines.push(`export ${handleInterface}`);
    lines.push('');
    lines.push(
      `declare const ${ir.name}: React.ForwardRefExoticComponent<${ir.name}Props${generics} & React.RefAttributes<${ir.name}Handle>>;`,
    );
  } else {
    lines.push(
      `declare function ${ir.name}${generics}(props: ${ir.name}Props${generics}): JSX.Element;`,
    );
  }
  lines.push(`export default ${ir.name};`);
  lines.push('');
  return lines.join('\n');
}
