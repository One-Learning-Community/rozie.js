/**
 * refineSlotTypes — Phase 5 Plan 05-04a Task 1.
 *
 * Builds per-slot context interface declarations + `@ContentChild` field
 * declarations for the Angular target. Each SlotDecl emits:
 *
 *   - `interface XCtx { $implicit: ...; ...spreadParams }` — TS interface
 *     declaring the slot's bound context shape.
 *   - `@ContentChild('slotName', { read: TemplateRef }) slotNameTpl?:
 *     TemplateRef<XCtx>;` — the projected `<ng-template #slotName>` ref.
 *
 * Default slot uses synthetic name `defaultSlot` per OQ A5 RESOLVED — `default`
 * is reserved by Angular's `@switch`/`@default` block syntax.
 *
 * Per RESEARCH Pattern 8 + OQ-typing-guards: ngTemplateContextGuard static
 * method shipped in v1.
 *
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';

/** Convert default-slot empty string to synthetic ref name `defaultSlot`. */
export function slotRefName(slotName: string): string {
  return slotName === '' ? 'defaultSlot' : slotName;
}

/** Field name for the @ContentChild TemplateRef binding. */
export function slotFieldName(slotName: string): string {
  return slotName === '' ? 'defaultTpl' : `${slotName}Tpl`;
}

/** Capitalize first letter — `header` → `HeaderCtx`. */
function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Context interface name for a SlotDecl — `header` → `HeaderCtx`, default → `DefaultCtx`. */
export function slotCtxName(slotName: string): string {
  return slotName === '' ? 'DefaultCtx' : `${capitalize(slotName)}Ctx`;
}

export interface SlotCtxRendered {
  /** Interface declaration text (e.g., `interface HeaderCtx { ... }`). */
  interfaceDecl: string;
  /** Field declaration text (e.g., `@ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;`). */
  fieldDecl: string;
}

/**
 * Build the per-slot interface + @ContentChild field declarations.
 *
 * For v1: each param name is typed `any` (TYPES-01 Phase 6 refinement).
 * Spread the params into the interface body alongside the `$implicit` field
 * (which carries an aggregated record of all params for `let-x` consumption
 * on the parent side).
 */
export function buildSlotCtx(slot: SlotDecl): SlotCtxRendered {
  const ctxName = slotCtxName(slot.name);
  const fieldName = slotFieldName(slot.name);
  const refName = slotRefName(slot.name);

  // Each param emits as `name: any;` for v1. The $implicit field aggregates
  // all params so consumers can use `let-implicit` on the parent side.
  const paramFields: string[] = [];
  if (slot.params.length === 0) {
    // No params — context is empty record.
    return {
      interfaceDecl: `interface ${ctxName} {}`,
      fieldDecl: `@ContentChild('${refName}', { read: TemplateRef }) ${fieldName}?: TemplateRef<${ctxName}>;`,
    };
  }

  // $implicit aggregate.
  const implicitProps = slot.params
    .map((p) => `${p.name}: any`)
    .join('; ');
  paramFields.push(`  $implicit: { ${implicitProps} };`);
  for (const p of slot.params) {
    paramFields.push(`  ${p.name}: any;`);
  }

  const interfaceDecl = `interface ${ctxName} {\n${paramFields.join('\n')}\n}`;
  const fieldDecl = `@ContentChild('${refName}', { read: TemplateRef }) ${fieldName}?: TemplateRef<${ctxName}>;`;

  return { interfaceDecl, fieldDecl };
}

/**
 * Build the static ngTemplateContextGuard method for a class with multiple
 * slot context types. Returns the method body string, or null when there are
 * no slots.
 *
 * Per RESEARCH Pattern 8 lines 401-407: the static method enables compile-time
 * context typing on the consumer side.
 */
export function buildNgTemplateContextGuard(
  componentName: string,
  slots: SlotDecl[],
): string | null {
  if (slots.length === 0) return null;
  const ctxNames = slots.map((s) => slotCtxName(s.name));
  const unionType = ctxNames.join(' | ');
  return [
    `static ngTemplateContextGuard(`,
    `  _dir: ${componentName},`,
    `  _ctx: unknown,`,
    `): _ctx is ${unionType} {`,
    `  return true;`,
    `}`,
  ].join('\n');
}
