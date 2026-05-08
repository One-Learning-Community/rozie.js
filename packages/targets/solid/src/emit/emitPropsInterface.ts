/**
 * emitPropsInterface — Solid target (port of react/emit/emitPropsInterface.ts).
 *
 * Emits `interface FooProps { ... }` inline above the function declaration.
 * Model:true props synthesize 3 fields per D-135 Solid analog:
 *   - `value?: T`         (controlled-input current value)
 *   - `defaultValue?: T`  (uncontrolled-mode initial value)
 *   - `onValueChange?: (value: T) => void`  (parent notification)
 *
 * Slot fields use `JSX.Element` (Solid) instead of `ReactNode` (React).
 * Default slot maps to `children?: JSX.Element`.
 * Named slots WITHOUT context → `slotName?: JSX.Element`.
 * Named slots WITH context → `slotName?: (ctx: SlotCtx) => JSX.Element`.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, PropTypeAnnotation } from '../../../../core/src/ir/types.js';

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
        // Use `any` (not `unknown`) so consumers can access arbitrary properties
        // on Object-typed props without explicit casts in emitted template code.
        // `unknown` requires cast at every access site which the emitter doesn't produce.
        return 'Record<string, any>';
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
    if (ann.value === 'object') return 'Record<string, any>';
    if (ann.value === 'function') return '(...args: unknown[]) => unknown';
    return ann.value;
  }
  return 'unknown';
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function toPascalCase(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

export function emitPropsInterface(ir: IRComponent, slotPropFields?: string[]): string {
  const fields: string[] = [];

  // Props (split by isModel).
  for (const p of ir.props) {
    const tsType = renderType(p.typeAnnotation);
    if (p.isModel) {
      // 3-field synthesis per D-135 Solid analog.
      fields.push(`  ${p.name}?: ${tsType};`);
      fields.push(`  defaultValue?: ${tsType};`);
      fields.push(`  on${capitalize(p.name)}Change?: (${p.name}: ${tsType}) => void;`);
    } else {
      fields.push(`  ${p.name}?: ${tsType};`);
    }
  }

  // Emits → optional `on<EventPascal>` props.
  for (const e of ir.emits) {
    const eventPascal = toPascalCase(e);
    if (eventPascal.length === 0) continue;
    fields.push(`  on${eventPascal}?: (...args: unknown[]) => void;`);
  }

  // Slots — use slotPropFields when provided (P2 filled by emitSlotDecl).
  if (slotPropFields !== undefined) {
    for (const line of slotPropFields) {
      fields.push(line);
    }
  } else {
    // P1 fallback: basic JSX.Element slot shapes.
    for (const s of ir.slots) {
      if (s.name === '') {
        // default slot → children
        fields.push(`  children?: JSX.Element;`);
      } else {
        fields.push(`  ${s.name}?: JSX.Element;`);
      }
    }
  }

  if (fields.length === 0) {
    return `interface ${ir.name}Props {}`;
  }

  return `interface ${ir.name}Props {\n${fields.join('\n')}\n}`;
}
