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
 * Phase 79 Plan 05 (R12/D-03): a slot name that is NOT a valid JS identifier
 * (e.g. `cell-status`) mints NO `@ContentChild` field / ctx interface —
 * `@ContentChild`'s string argument is a template-reference-variable
 * selector, which does not resolve for a hyphenated name. `isRecordOnlySlotName`
 * below is this file's gate, `renderRecordKey` its escaped-key single source
 * of truth (T-79-07), and `buildEligibleSlotDecls` is the filtered
 * producer-decl builder every caller should use in place of a raw
 * `slots.map(buildSlotCtx)`. The identifier SHAPE check itself is
 * `isSlotNameIdentifier`, imported from core — every R12 routing site
 * imports it directly (never redeclares it) so a future edit that forgets
 * the check in one module is grep-detectable (T-79-08).
 *
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';
import { isSlotNameIdentifier } from '../../../../core/src/codegen/slotNameIdentifier.js';

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
 * Phase 79 Plan 05 (R12/D-03) — whether `name` routes through the
 * `templates()` signal-map lookup ONLY (no `@ContentChild` field, no ctx
 * interface). Mirrors the identical helper on every other R12 target. The
 * default slot (`''`) is excluded explicitly — `isSlotNameIdentifier` does
 * not special-case the empty string, and the default slot always keeps its
 * `@ContentChild('defaultSlot', ...)` path regardless of shape.
 */
export function isRecordOnlySlotName(name: string): boolean {
  return name !== '' && !isSlotNameIdentifier(name);
}

/**
 * Escape a single-quoted string-literal key body: backslash first (so a
 * backslash inserted by the quote-escape step is not itself re-escaped), then
 * single quotes. Mirrors the identical helper in every other R12 target's
 * `refineSlotTypes.ts` (T-79-07).
 */
function escapeSingleQuotedKey(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Render the bracket-lookup key for a record-only slot name: single-quoted
 * and escaped, so a quote/backslash in the author's slot name cannot break
 * out of the emitted string literal (T-79-07).
 */
export function renderRecordKey(name: string): string {
  return `'${escapeSingleQuotedKey(name)}'`;
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
 * Build the per-slot ctx interface + `@ContentChild` field declarations for
 * every DISTINCT, IDENTIFIER-shaped slot name in `slots`. A record-only
 * (non-identifier) slot name is silently excluded — see `isRecordOnlySlotName`
 * above. Dedupe-by-distinct-name lives here too (a template may reference the
 * same named slot in multiple locations; each distinct name backs exactly one
 * field/interface pair).
 */
export function buildEligibleSlotDecls(slots: SlotDecl[]): SlotCtxRendered[] {
  const seen = new Set<string>();
  const out: SlotCtxRendered[] = [];
  for (const slot of slots) {
    if (seen.has(slot.name)) continue;
    seen.add(slot.name);
    if (isRecordOnlySlotName(slot.name)) continue;
    out.push(buildSlotCtx(slot));
  }
  return out;
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
  // Phase 79 Plan 05 (R12/D-03) — a record-only (non-identifier) slot has no
  // ctx interface (see `buildEligibleSlotDecls`), so it must not enter this
  // union either — `slotCtxName('cell-status')` would produce the invalid
  // TS identifier `Cell-statusCtx`.
  const eligible = slots.filter((s) => !isRecordOnlySlotName(s.name));
  if (eligible.length === 0) return null;
  // Dedupe by distinct slot name — a slot referenced in multiple template
  // locations appears multiple times in `slots`, but each distinct name has a
  // single ctx type. Without this the union repeats members (`FooCtx | FooCtx`).
  const seenCtxNames = new Set<string>();
  const ctxNames: string[] = [];
  for (const s of eligible) {
    const ctxName = slotCtxName(s.name);
    if (seenCtxNames.has(ctxName)) continue;
    seenCtxNames.add(ctxName);
    ctxNames.push(ctxName);
  }
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
