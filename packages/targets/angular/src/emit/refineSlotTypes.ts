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
 * below is this file's gate, `renderRecordKey` (re-exported here from core —
 * see WR-05, 79-REVIEW-FIX) its escaped-key text (T-79-07), and
 * `buildEligibleSlotDecls` is the filtered
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
import { lowerSlotParamType } from '../../../../core/src/codegen/slotParamTypeLowering.js';
import { renderRecordKey } from '../../../../core/src/codegen/escapeSingleQuotedKey.js';

// WR-05 fix (79-REVIEW-FIX): re-export so existing `import { renderRecordKey }
// from './refineSlotTypes.js'` call sites (emitSlotFiller.ts,
// emitSlotInvocation.ts) keep working unchanged. `escapeSingleQuotedKey` and
// `renderRecordKey` now live in core — see that module's doc comment.
export { renderRecordKey };

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
 * Phase 79 Plan 11 (R3/D-09) — whether `slot` routes through the
 * `templates()` signal-map lookup ONLY, extending `isRecordOnlySlotName`
 * with a SECOND trigger: `dynamicNameExpr !== undefined` (a producer
 * `<slot :name="expr">` whose bound name does NOT constant-fold). Such a
 * slot keeps `name === ''` — the SAME sentinel the genuine default slot
 * uses (79-06 Assumption A1) — so `isRecordOnlySlotName('')` alone would
 * return `false` and this slot would wrongly mint a `@ContentChild('defaultSlot',
 * ...)` field colliding with the real default slot's own field/interface.
 * Mirrors Lit's identical `slot.dynamicNameExpr === undefined` gate on its
 * per-slot property predicate (`emitSlotDecl.ts:268`, 79-08/79-09).
 */
export function isRecordOnlySlotDecl(slot: SlotDecl): boolean {
  return isRecordOnlySlotName(slot.name) || slot.dynamicNameExpr !== undefined;
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

  // $implicit aggregate. Phase 79 Plan 12 (D-13) — each param type flows
  // through the shared `lowerSlotParamType` helper instead of a hardcoded
  // `any`.
  const implicitProps = slot.params
    .map((p, i) => `${p.name}: ${lowerSlotParamType(slot.paramTypes?.[i])}`)
    .join('; ');
  paramFields.push(`  $implicit: { ${implicitProps} };`);
  for (const [i, p] of slot.params.entries()) {
    paramFields.push(`  ${p.name}: ${lowerSlotParamType(slot.paramTypes?.[i])};`);
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
    // Phase 79 Plan 11 — the record-only check MUST run BEFORE the `seen`
    // dedup add. A dynamicNameExpr slot shares the '' default-slot sentinel
    // (79-06 Assumption A1); if it were marked `seen` first, a LATER genuine
    // default slot (`<slot>` with no name) in the same component would be
    // silently skipped by the dedup, losing its real `@ContentChild` field.
    // Record-only slots never claim a `seen` key at all, so a real default
    // slot's '' key stays available regardless of declaration order.
    if (isRecordOnlySlotDecl(slot)) continue;
    if (seen.has(slot.name)) continue;
    seen.add(slot.name);
    out.push(buildSlotCtx(slot));
  }
  return out;
}

/**
 * PascalCase a raw prefix fragment for use as a ctx interface name —
 * `'cell-'` -> `'Cell'`, `'user-row-'` -> `'UserRow'`. Mirrors Lit's
 * `pascalCaseFragment` (`slotIdentityKey.ts`, 79-08) so every target derives
 * a family identifier the same way.
 */
function pascalCaseFragment(raw: string): string {
  return raw
    .split(/[^a-zA-Z0-9]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

/** Family ctx interface name: `'cell-'` -> `'CellCtx'`. */
function familyCtxName(namePrefix: string): string {
  return `${pascalCaseFragment(namePrefix)}Ctx`;
}

/**
 * Phase 79 Plan 12 (R6) — build a synthesized ctx interface for each
 * DISTINCT `namePrefix` family among `slots`' dynamic-name slots. A
 * dynamic-name slot with NO derivable prefix (R6's "degrades to a plain
 * string index signature" case) contributes no interface — Angular's record
 * path (`templates()?.[expr]`) has no compile-time hook for such a slot at
 * all, prefixed or not; only a PREFIXED family gets a synthesized name to
 * hang an interface on. `buildEligibleSlotDecls` (above) is UNCHANGED — a
 * family slot still mints no `@ContentChild` field, since `@ContentChild`'s
 * selector argument cannot represent a runtime-only name either way; this
 * function ONLY adds the ctx interface DECLARATION (consumed by
 * `buildNgTemplateContextGuard`'s union below), not a field.
 */
export function buildFamilyCtxDecls(slots: SlotDecl[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const slot of slots) {
    if (slot.dynamicNameExpr === undefined) continue;
    if (slot.namePrefix === undefined || slot.namePrefix.length === 0) continue;
    const ctxName = familyCtxName(slot.namePrefix);
    if (seen.has(ctxName)) continue;
    seen.add(ctxName);
    if (slot.params.length === 0) {
      out.push(`interface ${ctxName} {}`);
      continue;
    }
    const paramFields: string[] = [];
    const implicitProps = slot.params
      .map((p, i) => `${p.name}: ${lowerSlotParamType(slot.paramTypes?.[i])}`)
      .join('; ');
    paramFields.push(`  $implicit: { ${implicitProps} };`);
    for (const [i, p] of slot.params.entries()) {
      paramFields.push(`  ${p.name}: ${lowerSlotParamType(slot.paramTypes?.[i])};`);
    }
    out.push(`interface ${ctxName} {\n${paramFields.join('\n')}\n}`);
  }
  return out;
}

/** Distinct family ctx names among `slots`' prefixed dynamic-name slots, in declaration order. */
function collectFamilyCtxNames(slots: SlotDecl[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const slot of slots) {
    if (slot.dynamicNameExpr === undefined) continue;
    if (slot.namePrefix === undefined || slot.namePrefix.length === 0) continue;
    const ctxName = familyCtxName(slot.namePrefix);
    if (seen.has(ctxName)) continue;
    seen.add(ctxName);
    out.push(ctxName);
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
  //
  // Phase 79 Plan 11 (R3/D-09) — a dynamicNameExpr slot (shares the ''
  // default-slot sentinel per 79-06 Assumption A1) is excluded the SAME way
  // via `isRecordOnlySlotDecl` — it has no ctx interface either, and would
  // otherwise silently stand in for (or duplicate) the genuine default slot's
  // `DefaultCtx` union member.
  const eligible = slots.filter((s) => !isRecordOnlySlotDecl(s));
  // Phase 79 Plan 12 (R6) — a PREFIXED dynamic-name family DOES get its own
  // synthesized ctx interface (`buildFamilyCtxDecls` above), so it belongs
  // in this union too — "the template context guard covers the family
  // members" (this plan's own acceptance criterion).
  const familyCtxNames = collectFamilyCtxNames(slots);
  if (eligible.length === 0 && familyCtxNames.length === 0) return null;
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
  for (const ctxName of familyCtxNames) {
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
