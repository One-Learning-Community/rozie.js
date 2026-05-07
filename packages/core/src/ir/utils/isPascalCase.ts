/**
 * Shared PascalCase predicate (Phase 06.2 P1 D-116 promotion).
 *
 * Promoted from `packages/targets/react/src/emit/emitRModel.ts:90` to a single
 * source of truth so IR lowering rules and per-target emit rules cannot drift.
 *
 * Used at:
 *   - IR lowering — annotate TemplateElementIR.tagKind for component / self
 *     detection (Phase 06.2 P1 Task 3).
 *   - Per-target emit — identify component tags vs HTML tags / custom elements
 *     (e.g., React's emitRModel custom-component branch).
 *
 * Behavior is byte-identical to the previous emitRModel `isCustomComponent` —
 * a single uppercase-first-letter check (NOT a regex). Empty string returns
 * false. Non-letter first chars (digits, '-', ':', etc.) return false.
 *
 * @experimental — shape may change before v1.0
 */
export function isPascalCase(tag: string): boolean {
  if (tag.length === 0) return false;
  const c = tag.charAt(0);
  return c >= 'A' && c <= 'Z';
}
