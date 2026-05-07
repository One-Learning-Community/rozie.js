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
import * as t from '@babel/types';
import type {
  IRComponent,
  PropTypeAnnotation,
  ParamDecl,
} from '../../../../core/src/ir/types.js';

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
  const lines: string[] = [];
  lines.push(`import type { ReactNode } from 'react';`);
  lines.push('');

  const generics =
    opts.genericParams && opts.genericParams.length > 0
      ? `<${opts.genericParams.join(', ')}>`
      : '';

  // Props interface (parameterized when generics present per D-85).
  lines.push(`export interface ${ir.name}Props${generics} {`);

  for (const prop of ir.props) {
    const tsType = renderPropType(prop.typeAnnotation);
    if (prop.isModel) {
      // D-84 model:true triplet, named after the actual prop identifier.
      const baseName = prop.name;
      const Pascal = capitalize(baseName);
      lines.push(`  ${baseName}?: ${tsType};`);
      lines.push(`  default${Pascal}?: ${tsType};`);
      lines.push(`  on${Pascal}Change?: (next: ${tsType}) => void;`);
    } else {
      // Required when defaultValue === null; optional when default present.
      const optional = prop.defaultValue !== null ? '?' : '';
      lines.push(`  ${prop.name}${optional}: ${tsType};`);
    }
  }

  // Emits → optional `on<EventPascal>` props.
  // Dedupe handler names to avoid PascalCase collisions (WR-01): two distinct
  // emit identifiers that PascalCase to the same key (e.g. `add` + `Add`, or
  // `value-change` + `valueChange`) would otherwise produce duplicate property
  // declarations on the props interface — invalid TypeScript or silently
  // last-write-wins. The IR validator should already reject empty emit names;
  // the empty-string guard here is defense-in-depth.
  const emittedHandlers = new Set<string>();
  for (const e of ir.emits) {
    const eventPascal = toPascalCase(e);
    if (eventPascal.length === 0) continue;
    const handlerName = `on${eventPascal}`;
    if (emittedHandlers.has(handlerName)) continue;
    emittedHandlers.add(handlerName);
    lines.push(`  ${handlerName}?: (...args: unknown[]) => void;`);
  }

  // Slots per D-84 + D-86.
  for (const slot of ir.slots) {
    const isDefault = slot.name === ''; // D-18 default-slot sentinel
    const renderName = isDefault ? 'children' : `render${capitalize(slot.name)}`;
    if (slot.params.length === 0) {
      if (isDefault) {
        lines.push(`  children?: ReactNode;`);
      } else {
        lines.push(`  ${renderName}?: () => ReactNode;`);
      }
    } else {
      const paramFields = slot.params
        .map((p) => `${p.name}: ${inferParamType(p, ir)}`)
        .join('; ');
      const sig = `(params: { ${paramFields} }) => ReactNode`;
      if (isDefault) {
        // TS1385: function-type notation in a union MUST be parenthesised.
        // `ReactNode | (params: …) => ReactNode` is a parse error; wrap the
        // arrow form in parens to disambiguate the union member.
        lines.push(`  children?: ReactNode | (${sig});`);
      } else {
        lines.push(`  ${renderName}?: ${sig};`);
      }
    }
  }

  lines.push(`}`);
  lines.push('');
  lines.push(
    `declare function ${ir.name}${generics}(props: ${ir.name}Props${generics}): JSX.Element;`,
  );
  lines.push(`export default ${ir.name};`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Map a `PropTypeAnnotation` to its TypeScript surface string.
 *
 * Mirrors the rules used by `emitPropsInterface.ts` (Plan 04-02) so the
 * inline interface in the `.tsx` body and the published `.d.ts` agree.
 */
function renderPropType(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'Array':
        return 'unknown[]';
      case 'Object':
        return 'Record<string, unknown>';
      case 'Function':
        return '(...args: unknown[]) => unknown';
      default:
        // Pass through user-defined identifiers verbatim — covers generic
        // type-parameter names (e.g., 'T') and consumer-declared interfaces.
        return ann.name;
    }
  }
  if (ann.kind === 'literal') {
    switch (ann.value) {
      case 'function':
        return '(...args: unknown[]) => unknown';
      case 'object':
        return 'Record<string, unknown>';
      case 'array':
        return 'unknown[]';
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      default:
        return 'unknown';
    }
  }
  if (ann.kind === 'union') {
    return ann.members.map(renderPropType).join(' | ');
  }
  return 'unknown';
}

/**
 * D-86 best-effort param-type inference.
 *
 *   1. Bare Identifier (`<slot :open="open">`) — look up in ir.props by name.
 *      (Note: Phase 2 IR's StateDecl does NOT carry a typeAnnotation field,
 *      so $data identifiers fall through to the function-fallback below;
 *      v2 may extend StateDecl with inferred types.)
 *   2. MemberExpression (`<slot :open="$props.open">` / `$data.open`) — resolve
 *      the property name and look up in `ir.props` (and reach state-decl
 *      existence-check for callable-vs-value disambiguation).
 *   3. Bare Identifier that doesn't resolve to a prop and isn't in ir.state →
 *      treat as a residual-script function reference, emit `() => void` as
 *      the canonical-Dropdown `toggle: () => void` shape (documented v1
 *      heuristic per plan §<action> Note on D-86 inference scope).
 *   4. Genuine fallback: `'unknown'` per CONTEXT.md D-86.
 */
function inferParamType(param: ParamDecl, ir: IRComponent): string {
  const expr = param.valueExpression;

  // Case 1 — bare Identifier; look up in props by name. State decls have no
  // typeAnnotation in v1 IR, so they cannot be resolved beyond existence.
  if (t.isIdentifier(expr)) {
    const name = expr.name;
    const propDecl = ir.props.find((p) => p.name === name);
    if (propDecl) return renderPropType(propDecl.typeAnnotation);

    // Case 3 — identifier present in ir.state is a known reactive value but
    // we have no v1 type info — fall through to the callable fallback below.
    // Identifier NOT in state OR props is treated as a residual-script
    // function reference per the canonical Dropdown `toggle` shape.
    return '() => void';
  }

  // Case 2 — MemberExpression (`$props.foo`, `$data.bar`, etc.).
  if (t.isMemberExpression(expr) && t.isIdentifier(expr.property)) {
    const propName = expr.property.name;
    if (t.isIdentifier(expr.object)) {
      const objName = expr.object.name;
      if (objName === '$props' || objName === '_props') {
        const propDecl = ir.props.find((p) => p.name === propName);
        if (propDecl) return renderPropType(propDecl.typeAnnotation);
      }
      // `$data.x` / `_data.x` — StateDecl carries no typeAnnotation in v1
      // IR. Fall through to ultimate `'unknown'` fallback below; v2 IR
      // expansion would resolve this branch.
    }
  }

  // Case 4 — genuine fallback per D-86.
  return 'unknown';
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toPascalCase(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}
