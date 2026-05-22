/**
 * emitTemplateAttribute — Lit target attribute emission (Plan 06.4-02 Task 1).
 *
 * Per PATTERNS.md emission table:
 *   - `class="static"`               → `class="static"`
 *   - `:class="expr"`                → `class=${expr}`
 *   - `:disabled="cond"` (boolean)   → `?disabled=${cond}`
 *   - `:value="expr"` on form input  → `.value=${expr}`
 *   - `@click="fn"`                  → handled inline in emitTemplate.ts (buildEventParts)
 *
 * Real attribute emission lives inside emitTemplate.ts (per-element walk needs
 * context). This module exposes a typed wrapper for unit tests + external
 * consumers.
 *
 * @experimental — shape may change before v1.0
 */
import * as bt from '@babel/types';
import type { AttributeBinding, IRComponent } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { kebabize, resolveLitSetterText } from './resolveLitSetterText.js';

/**
 * Test-wrapper context for emitTemplateAttribute. The real emit path
 * (emitTemplate.ts:emitAttribute) threads a richer `_state` channel so it
 * can mark `styleMapUsed` / `rozieSpreadUsed` for the import wiring; the
 * standalone wrapper exposes a minimal version of the same signals so unit
 * tests can observe whether a given attribute would trigger the styleMap
 * import or the `rozieSpread` (Plan 14-05) directive import.
 *
 * Quick-task 260518-e2t (Spike 004 Lit subset); Plan 14-05 adds
 * `rozieSpreadUsed` for the D-02 directive (14-RESEARCH Pattern 4).
 */
export interface EmitTemplateAttributeState {
  styleMapUsed: boolean;
  /**
   * Plan 14-05 / D-02 — set true whenever a `spreadBinding` is emitted via
   * `${rozieSpread(<expr>)}`. The emitLit shell reads this off the
   * `EmitTemplateResult` and conditionally adds
   * `import { rozieSpread } from '@rozie/runtime-lit';` to the shell imports
   * block, mirroring the existing `styleMapUsed` → `lit/directives/style-map.js`
   * plumbing.
   */
  rozieSpreadUsed: boolean;
}

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
  state?: EmitTemplateAttributeState,
): string {
  if (attr.kind === 'static') {
    return `${attr.name}="${attr.value}"`;
  }
  // Phase 14 R2 / D-07 / D-02 / Plan 14-05 — the bare-spread `r-bind="<expr>"`
  // form (and the synthesized `$attrs` auto-fallthrough spread). Lit has no
  // native attribute-object spread; D-02 / 14-RESEARCH Pattern 4 specifies a
  // lit-html element-position `rozieSpread` directive shipped from
  // `@rozie/runtime-lit`. Emit `${rozieSpread(<expr>)}` in element position;
  // the directive does cross-render diffing (removes keys dropped between
  // renders, null/false → removeAttribute). The `_state.rozieSpreadUsed` flag
  // tells the emitLit shell to add the `import { rozieSpread } …` line.
  //
  // No key normalization is applied (D-03 is React/Solid-only). HTML attribute
  // names flow through verbatim.
  //
  // AUTO-FALLTHROUGH TARGET (resolves CONTEXT.md A1 for Lit): the synthesized
  // `$attrs` `spreadBinding` from Plan 14-02 lands on the template-root element
  // INSIDE the component's shadow tree (the `<button>` the author wrote),
  // NEVER the host custom element. The emitter places the directive on the
  // inner element it sees in the author's template; the host element receives
  // consumer attributes natively via lit-element's reflection layer.
  if (attr.kind === 'spreadBinding') {
    const expr = rewriteTemplateExpression(attr.expression, ir);
    if (state) state.rozieSpreadUsed = true;
    return `\${rozieSpread(${expr})}`;
  }
  // Phase 07.3 Plan 07.3-08 (TWO-WAY-03) — consumer-side `r-model:propName=`
  // two-way binding. Producer side (createLitControllableProperty +
  // dispatchEvent('<kebab(propName)>-change', { detail })) is already locked
  // by Phase 06.4 (see Modal.lit.ts:155-162); this branch emits the
  // consumer-side pair that wires INTO that contract.
  //
  // Landmine guard (RESEARCH §Landmines): the listener arg MUST be annotated
  // `(e: CustomEvent)` — Lit's default @event arg type is `Event`, which
  // does not expose `.detail`. Untyped `($event)` would emit but fail TS.
  if (attr.kind === 'twoWayBinding') {
    const valueExpr = rewriteTemplateExpression(attr.expression, ir);
    const setterText = resolveLitSetterText(attr.expression, ir);
    const eventName = `${kebabize(attr.name)}-change`;
    return `.${attr.name}=\${${valueExpr}} @${eventName}=\${($event: CustomEvent) => { ${setterText} = $event.detail; }}`;
  }
  if (attr.kind === 'binding') {
    // Quick-task 260518-e2t (Spike 004 Lit subset) — literal-object `:style`
    // lowers through Lit's styleMap directive. Bails to passthrough on
    // spread/method/computed-key props (caller falls through to existing
    // `[object Object]` toString path — known broken, documented gap).
    if (
      attr.name === 'style' &&
      bt.isObjectExpression(attr.expression) &&
      attr.expression.properties.every(
        (p) => bt.isObjectProperty(p) && !p.computed,
      )
    ) {
      const expr = rewriteTemplateExpression(attr.expression, ir);
      if (state) state.styleMapUsed = true;
      return `style=\${styleMap(${expr})}`;
    }
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
