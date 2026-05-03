/**
 * emitPropsInterface — Plan 04-02 Task 2.
 *
 * Emits `interface FooProps { ... }` inline above the function declaration.
 * REACT-T-07 — Phase 4 v1 ships inline interfaces; consumer-side tsc reads
 * them as the source-of-truth for prop types. Phase 6 (TYPES-01) emits
 * separate .d.ts via dts-buddy.
 *
 * Model:true props synthesize 3 fields per D-31/D-56 React analog:
 *   - `value?: T`         (controlled-input current value)
 *   - `defaultValue?: T`  (uncontrolled-mode initial value)
 *   - `onValueChange?: (value: T) => void`  (parent notification)
 *
 * Slot decls produce render-prop signatures (`renderX?: (ctx: XCtx) => ReactNode`)
 * — Plan 04-03 implements the slot-side; this plan stubs to never emit slots.
 *
 * Each entry in ir.emits synthesizes an additional optional field on the
 * interface: `on<PascalCase>?: (...args: unknown[]) => void`.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, PropTypeAnnotation } from '../../../../core/src/ir/types.js';

/**
 * Render a PropTypeAnnotation as a TypeScript type string.
 *
 *   - { kind: 'identifier', name: 'Number' }   → 'number'
 *   - { kind: 'identifier', name: 'String' }   → 'string'
 *   - { kind: 'identifier', name: 'Boolean' }  → 'boolean'
 *   - { kind: 'identifier', name: 'Array' }    → 'unknown[]'
 *   - { kind: 'identifier', name: 'Object' }   → 'Record<string, unknown>'
 *   - { kind: 'identifier', name: 'Function' } → '(...args: unknown[]) => unknown'
 *   - { kind: 'union', members }               → join with ' | '
 *   - { kind: 'literal', value }               → 'string'/'number'/etc.
 */
function renderType(ann: PropTypeAnnotation): string {
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
        return ann.name;
    }
  }
  if (ann.kind === 'union') {
    return ann.members.map(renderType).join(' | ');
  }
  if (ann.kind === 'literal') {
    if (ann.value === 'array') return 'unknown[]';
    if (ann.value === 'object') return 'Record<string, unknown>';
    if (ann.value === 'function') return '(...args: unknown[]) => unknown';
    return ann.value;
  }
  return 'unknown';
}

/** Capitalize first letter. */
function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** PascalCase from hyphenated/snake_case event name. */
function toPascalCase(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

export function emitPropsInterface(ir: IRComponent): string {
  const fields: string[] = [];

  // Props (split by isModel)
  for (const p of ir.props) {
    const tsType = renderType(p.typeAnnotation);
    if (p.isModel) {
      // 3-field synthesis per D-31/D-56 React analog
      fields.push(`  ${p.name}?: ${tsType};`);
      fields.push(`  defaultValue?: ${tsType};`);
      fields.push(`  on${capitalize(p.name)}Change?: (${p.name}: ${tsType}) => void;`);
    } else {
      fields.push(`  ${p.name}?: ${tsType};`);
    }
  }

  // Emits → optional `on<EventPascal>` props.
  // v1: ship `(...args: unknown[]) => void` since IR doesn't carry per-emit arg types.
  for (const e of ir.emits) {
    const eventPascal = toPascalCase(e);
    if (eventPascal.length === 0) continue;
    fields.push(`  on${eventPascal}?: (...args: unknown[]) => void;`);
  }

  // Slots — Plan 04-03 fills in. v1 stubs as `renderX?: (ctx: unknown) => ReactNode`.
  for (const s of ir.slots) {
    if (s.name === '') {
      // default slot → children
      fields.push(`  children?: import('react').ReactNode | ((ctx: unknown) => import('react').ReactNode);`);
    } else {
      fields.push(`  render${capitalize(s.name)}?: (ctx: unknown) => import('react').ReactNode;`);
    }
  }

  if (fields.length === 0) {
    return `interface ${ir.name}Props {}`;
  }

  return `interface ${ir.name}Props {\n${fields.join('\n')}\n}`;
}
