/**
 * emitTemplateAttribute.ts — P1 stub for per-attribute lit-html emission.
 *
 * P2 maps Rozie attribute kinds to Lit sigils per PATTERNS.md:
 *   - `:prop="expr"`     → `.prop=${expr}`     (property binding)
 *   - `class="card {{ x }}"` → string interpolation in attribute value
 *   - boolean attrs      → `?attr=${expr}`     (boolean attribute)
 *   - `@event="..."`     → emitTemplateEvent
 *
 * @experimental — shape may change before v1.0
 */

export function emitTemplateAttribute(): string {
  return '';
}
