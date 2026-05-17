/**
 * emitTemplateAttribute — Lit target attribute emission (Plan 06.4-02 Task 1).
 *
 * Per PATTERNS.md emission table:
 *   - `class="static"`               → `class="static"`
 *   - `:class="expr"`                → `class=${expr}`
 *   - `:disabled="cond"` (boolean)   → `?disabled=${cond}`
 *   - `:value="expr"` on form input  → `.value=${expr}`
 *   - `@click="fn"`                  → handled by emitTemplateEvent
 *
 * Real attribute emission lives inside emitTemplate.ts (per-element walk needs
 * context). This module exposes a typed wrapper for unit tests + external
 * consumers.
 *
 * @experimental — shape may change before v1.0
 */
import type { AttributeBinding, IRComponent } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { kebabize, resolveLitSetterText } from './resolveLitSetterText.js';

const BOOLEAN_ATTRS = new Set([
  'disabled',
  'checked',
  'readonly',
  'required',
  'autofocus',
  'hidden',
  'open',
  'multiple',
  'selected',
]);

const FORM_INPUT_TAGS = new Set(['input', 'textarea', 'select']);

export function emitTemplateAttribute(
  attr: AttributeBinding,
  ir: IRComponent,
  tagName = 'div',
): string {
  if (attr.kind === 'static') {
    return `${attr.name}="${attr.value}"`;
  }
  // Phase 07.3 Plan 07.3-08 (TWO-WAY-03) — consumer-side `r-model:propName=`
  // two-way binding. Producer side (createLitControllableProperty +
  // dispatchEvent('<kebab(propName)>-change', { detail })) is already locked
  // by Phase 06.4 (see Modal.lit.ts:155-162); this branch emits the
  // consumer-side pair that wires INTO that contract.
  //
  // Landmine guard (RESEARCH §Landmines): the listener arg MUST be annotated
  // `(e: CustomEvent)` — Lit's default @event arg type is `Event`, which
  // does not expose `.detail`. Untyped `(e)` would emit but fail TS.
  if (attr.kind === 'twoWayBinding') {
    const valueExpr = rewriteTemplateExpression(attr.expression, ir);
    const setterText = resolveLitSetterText(attr.expression, ir);
    const eventName = `${kebabize(attr.name)}-change`;
    return `.${attr.name}=\${${valueExpr}} @${eventName}=\${(e: CustomEvent) => { ${setterText} = e.detail; }}`;
  }
  if (attr.kind === 'binding') {
    const expr = rewriteTemplateExpression(attr.expression, ir);
    if (BOOLEAN_ATTRS.has(attr.name)) {
      return `?${attr.name}=\${${expr}}`;
    }
    if (
      (attr.name === 'value' || attr.name === 'checked') &&
      FORM_INPUT_TAGS.has(tagName)
    ) {
      return `.${attr.name}=\${${expr}}`;
    }
    return `${attr.name}=\${${expr}}`;
  }
  if (attr.kind === 'interpolated') {
    const parts = attr.segments.map((seg) => {
      if (seg.kind === 'static') return seg.text;
      return `\${${rewriteTemplateExpression(seg.expression, ir)}}`;
    });
    return `${attr.name}="${parts.join('')}"`;
  }
  return '';
}
