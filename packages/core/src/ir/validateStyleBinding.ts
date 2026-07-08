/**
 * validateStyleBinding — Spike-012 R7-3.
 *
 * Post-IR pass that flags an ARRAY-form `:style` binding (`:style="[a, b]"`),
 * which is not yet supported uniformly across targets:
 *
 *   - Vue lowers it NATIVELY (`:style="[a, b]"` — Vue merges the array) ✓
 *   - React/Solid/Lit route a non-string, non-object-literal `:style` value
 *     through the STRING-only `parseInlineStyle` runtime helper. An array reaches
 *     `style-to-js` (a CSS-declaration-STRING parser), which the crash-safety
 *     wrapper degrades to `{}` — every style is SILENTLY dropped.
 *   - Angular emits `[style]="[…]"`, and Angular's `[style]` binding does not
 *     merge an array of objects either.
 *
 * So the array form silently miscompiles on 5 of 6 targets. Rather than ship a
 * silent no-op, this pass emits `ROZ144` (STYLE_BINDING_ARRAY_UNSUPPORTED) so the
 * author fails loud and reaches for a form that works everywhere TODAY — a single
 * object binding `:style="{ … }"`, or a `$computed` that returns the already-
 * merged style object. A real cross-target array-merge (a `mergeStyles` runtime
 * helper + array lowering, mirroring Vue's `normalizeStyle`) is BACKLOGGED; when
 * it lands this pass is removed and array-`:style` becomes uniformly supported.
 *
 * The diagnostic is UNIFORM (fires regardless of target) on purpose: it is wired
 * into `lowerToIR` — the single chokepoint both `compile()` and `@rozie/unplugin`
 * share (Pitfall 1) — which is target-agnostic. It intentionally trades Vue's
 * currently-working array form for a consistent, honest restriction until the
 * merge feature lands. The object / computed workaround it points to works on
 * Vue too, so no author is left without a path.
 *
 * Scope: ONLY a statically-unambiguous `ArrayExpression` `:style` value is
 * flagged. A bare identifier / member / ternary `:style` may legitimately resolve
 * to a STRING at runtime (which `parseInlineStyle` handles correctly), so those
 * are NOT flagged — flagging them would be a false positive without type info.
 *
 * Per D-08 collected-not-thrown: NEVER throws. Pushes a diagnostic and continues.
 * Mutates `diagnostics` in place; NEVER mutates `ir`.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { IRComponent, TemplateNode } from './types.js';

/**
 * Recursive template walker — mirrors `validateClassSelector.walkTemplate` so
 * the two IR passes traverse exactly the same node set (slot-filler bodies and
 * conditional / loop / match / fragment / slot-invocation bodies included).
 */
function walkTemplate(
  node: TemplateNode | null,
  visit: (n: TemplateNode) => void,
): void {
  if (node === null) return;
  visit(node);
  switch (node.type) {
    case 'TemplateElement':
      for (const child of node.children) walkTemplate(child, visit);
      if (node.slotFillers) {
        for (const filler of node.slotFillers) {
          for (const child of filler.body) walkTemplate(child, visit);
        }
      }
      break;
    case 'TemplateConditional':
    case 'TemplateMatch':
      for (const branch of node.branches) {
        for (const child of branch.body) walkTemplate(child, visit);
      }
      break;
    case 'TemplateLoop':
      for (const child of node.body) walkTemplate(child, visit);
      break;
    case 'TemplateSlotInvocation':
      for (const child of node.fallback) walkTemplate(child, visit);
      break;
    case 'TemplateFragment':
      for (const child of node.children) walkTemplate(child, visit);
      break;
    case 'TemplateInterpolation':
    case 'TemplateStaticText':
      break;
  }
}

export function validateStyleBinding(ir: IRComponent, diagnostics: Diagnostic[]): void {
  walkTemplate(ir.template, (node) => {
    if (node.type !== 'TemplateElement') return;
    for (const attr of node.attributes) {
      if (attr.kind !== 'binding') continue;
      if (attr.name !== 'style') continue;
      if (!t.isArrayExpression(attr.expression)) continue;
      diagnostics.push({
        code: RozieErrorCode.STYLE_BINDING_ARRAY_UNSUPPORTED,
        severity: 'error',
        message:
          'An array-form `:style="[a, b]"` binding is not yet supported across targets — only Vue merges it natively; the other targets silently drop every style.',
        loc: attr.sourceLoc,
        hint: 'Use a single object binding `:style="{ … }"`, or a `$computed` that returns the already-merged style object. Cross-target array-style merging is backlogged.',
      });
    }
  });
}
