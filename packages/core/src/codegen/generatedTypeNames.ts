/**
 * generatedTypeNames — the ONE home of every TYPE-LEVEL identifier the six
 * emitters mint into a component module or sidecar (`<Name>Props`,
 * `<Name>Handle`, `Rozie<Name>EventMap`, slot ctx interfaces, …).
 *
 * Every emitter builds these names through the functions below, and
 * `reservedGeneratedTypeNames` derives the reserved-name list (typed public
 * surface P1, final wave I3) from the SAME functions — so a `<types>`
 * declaration that would collide with a generated declaration is caught at
 * lowering (ROZ025) and the reserved list can never drift from what the
 * emitters actually print.
 *
 * @experimental — added in typed-surface P1
 */
import type { IRComponent, SlotDecl } from '../ir/types.js';
import { isSlotNameIdentifier } from './slotNameIdentifier.js';

/** `<Name>Props` — the props interface (React/Solid/Vue modules, every sidecar). */
export function propsInterfaceName(componentName: string): string {
  return `${componentName}Props`;
}

/** `<Name>Handle` — the `$expose` handle interface. */
export function handleInterfaceName(componentName: string): string {
  return `${componentName}Handle`;
}

/** `Rozie<Name>EventMap` — Lit's exported typed event map. */
export function litEventMapName(componentName: string): string {
  return `Rozie${componentName}EventMap`;
}

/** Svelte's instance-script props interface (`interface Props …`). */
export const SVELTE_PROPS_INTERFACE_NAME = 'Props';

/** Solid modules (and slot-bearing sidecars) `import type { JSX } from 'solid-js'`. */
export const SOLID_JSX_TYPE_NAME = 'JSX';

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * PascalCase a slot name for React/Solid generated identifiers — hyphen and
 * underscore are segment boundaries (`row-open` → `RowOpen`).
 */
export function slotPascalName(name: string): string {
  const parts = name.split(/[-_]/).filter(Boolean);
  return parts.map((p) => capitalize(p)).join('');
}

/**
 * PascalCase a raw authored fragment — every run of non-alphanumeric
 * characters is a segment boundary (`'cell-'` → `'Cell'`,
 * `'user-row-'` → `'UserRow'`). Angular family ctx names + Lit slot suffixes.
 */
export function pascalCaseFragment(raw: string): string {
  return raw
    .split(/[^a-zA-Z0-9]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

/** React slot ctx interface: default → `ChildrenCtx`, named → `<Pascal>Ctx`. */
export function reactSlotCtxName(slotName: string): string {
  return slotName === '' ? 'ChildrenCtx' : `${slotPascalName(slotName)}Ctx`;
}

/** Solid slot ctx interface: default → `DefaultSlotCtx`, named → `<Pascal>SlotCtx`. */
export function solidSlotCtxName(slotName: string): string {
  return slotName === '' ? 'DefaultSlotCtx' : `${slotPascalName(slotName)}SlotCtx`;
}

/** Angular slot ctx interface: default → `DefaultCtx`, named → `<Capitalized>Ctx`. */
export function angularSlotCtxName(slotName: string): string {
  return slotName === '' ? 'DefaultCtx' : `${capitalize(slotName)}Ctx`;
}

/** Angular dynamic-name family ctx interface: `'cell-'` → `'CellCtx'`. */
export function angularFamilyCtxName(namePrefix: string): string {
  return `${pascalCaseFragment(namePrefix)}Ctx`;
}

/**
 * Lit's PascalCase per-slot class-member suffix (`_hasSlot<suffix>`,
 * `Rozie<suffix>SlotCtx`) for `slot` at position `index` of `ir.slots`.
 */
export function litSlotFieldSuffix(slot: SlotDecl, index: number): string {
  if (slot.dynamicNameExpr !== undefined) {
    if (slot.namePrefix !== undefined && slot.namePrefix.length > 0) {
      return `Dynamic${pascalCaseFragment(slot.namePrefix)}`;
    }
    return `Dynamic${index}`;
  }
  // Default slot: name === ''. Use 'Default' as the field suffix.
  if (slot.name === '') return 'Default';
  return pascalCaseFragment(slot.name);
}

/** Lit slot ctx interface: `Rozie<suffix>SlotCtx`. */
export function litSlotCtxName(suffix: string): string {
  return `Rozie${suffix}SlotCtx`;
}

/**
 * Every type-level name some target generates for `ir`, mapped to a short
 * description of what generates it. Slot ctx names are reserved for every
 * slot that passes params (a target may skip the interface in narrower
 * cases; reserving the superset keeps the rule target-independent).
 *
 * @experimental — added in typed-surface P1
 */
export function reservedGeneratedTypeNames(ir: Pick<IRComponent, 'name' | 'slots'>): Map<string, string> {
  const out = new Map<string, string>();
  const add = (name: string, what: string): void => {
    if (!out.has(name)) out.set(name, what);
  };
  add(ir.name, 'the component itself (React/Solid function, Angular/Lit class, every sidecar)');
  add(propsInterfaceName(ir.name), 'the generated props interface');
  add(handleInterfaceName(ir.name), 'the generated $expose handle interface');
  add(litEventMapName(ir.name), "Lit's generated event map");
  add(SVELTE_PROPS_INTERFACE_NAME, "Svelte's generated instance props interface");
  add(SOLID_JSX_TYPE_NAME, "Solid's `import type { JSX } from 'solid-js'`");
  ir.slots.forEach((slot, index) => {
    if (slot.params.length === 0) return;
    if (slot.dynamicNameExpr !== undefined) {
      if (slot.namePrefix !== undefined && slot.namePrefix.length > 0) {
        add(angularFamilyCtxName(slot.namePrefix), "Angular's slot-family context interface");
      }
    } else if (slot.name === '' || isSlotNameIdentifier(slot.name)) {
      const label = slot.name === '' ? 'the default slot' : `slot \`${slot.name}\``;
      add(reactSlotCtxName(slot.name), `React's context interface for ${label}`);
      add(solidSlotCtxName(slot.name), `Solid's context interface for ${label}`);
      add(angularSlotCtxName(slot.name), `Angular's context interface for ${label}`);
    }
    add(litSlotCtxName(litSlotFieldSuffix(slot, index)), "Lit's slot context interface");
  });
  return out;
}
