/**
 * emitSlotFiller — Phase 07.2 Plan 02 Task 3 (React target).
 *
 * Consumer-side mirror of emitSlotInvocation (producer side). Where the
 * producer emits `props.renderHeader?.({ close })` reads, the consumer emits
 * the matching `renderHeader={({ close }) => …body…}` JSX prop ASSIGNMENT on
 * the component tag.
 *
 * The producer's field-name convention is the source-of-truth — slot 'header'
 * lands on the producer's props as `renderHeader`, so the consumer MUST use
 * the same field name here. Default slot (`name === ''`) maps to React's
 * built-in `children` prop (no `renderDefault`).
 *
 * Output shapes (per RESEARCH §"Pattern 3.b React"):
 *
 *   { name: 'header', params: [] }
 *     → `renderHeader={() => (<>…body…</>)}`
 *
 *   { name: 'header', params: [{name:'close'},{name:'open'}] }
 *     → `renderHeader={({ close, open }) => (<>…body…</>)}`
 *
 *   { name: '', params: [] }                            (default-shorthand)
 *     → `children={(<>…body…</>)}`
 *
 *   { name: '', params: [{name:'item'}] }              (scoped default fill)
 *     → `children={({ item }) => (<>…body…</>)}`
 *     ↑ dual-shape per producer-side emit (emitSlotInvocation.ts L22-32):
 *       producer-side uses `typeof children === 'function'` discriminator,
 *       so the consumer's function-form is the matching half of that dual.
 *
 *   { isDynamic: true, dynamicNameExpr } — R5 dynamic name
 *     → emit a `slots={{ [expr]: ({…}) => (<>…</>) }}` prop fragment.
 *       Multiple dynamic fillers on the same tag merge into one `slots={…}`.
 *       For Wave 1 the consumer-named-fill fixture has no dynamic names —
 *       the dynamic branch ships now so emitTemplateNode can dispatch on it
 *       symmetrically with vue/svelte; Wave 2 fixtures exercise the full
 *       round-trip.
 *
 * Body recursion uses the same emitNode pipeline as the rest of the React
 * emitter — magic-identifier rewrites (`$props.x` → `props.x`, `$data.x` →
 * `x`, etc.) apply naturally via `rewriteTemplateExpression` on any
 * `TemplateInterpolation` / attribute binding nested inside the fill body.
 * No separate rewrite pass needed.
 *
 * Phase 07.1 self-reference pattern: SlotFillerDecl type imported via the
 * `@rozie/core` package specifier, NOT the deep ../../../core/src/ir/types.js
 * relative path that would reintroduce the cross-package `.d.ts` identity bug
 * Phase 07.1 fixed.
 *
 * @experimental — shape may change before v1.0
 */
import type { SlotFillerDecl } from '@rozie/core';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { EmitNodeCtx } from './emitTemplateNode.js';
// Late-import to avoid a circular module-init dependency — emitTemplateNode
// imports this file via emitElement's component-tag branch; this file needs
// emitNode to recurse the body. The cycle is benign at runtime because both
// modules complete top-level evaluation before any export is called.
import * as _emitTemplateNodeModule from './emitTemplateNode.js';

/**
 * Producer-mirrored field-name convention.
 *   - '' (default) → 'children'  (React's magic-prop)
 *   - 'header'      → 'renderHeader'  (capitalize-first + 'render' prefix)
 *
 * MUST match refineSlotTypes.propFieldName so consumer-fill prop names align
 * with producer-side props interface fields byte-for-byte.
 */
function propFieldName(slotName: string): string {
  if (slotName === '') return 'children';
  return 'render' + slotName.charAt(0).toUpperCase() + slotName.slice(1);
}

/**
 * Render the destructure-args list for a scoped fill.
 *   - []                → ''             (function takes no args)
 *   - [{name:'close'}]  → '{ close }'
 *   - [{name:'a'},{name:'b'}]
 *                       → '{ a, b }'
 */
function paramsDestructure(filler: SlotFillerDecl): string {
  if (filler.params.length === 0) return '';
  return `{ ${filler.params.map((p) => p.name).join(', ')} }`;
}

/**
 * Render the body of one filler as a JSX fragment string. Wraps multi-node
 * bodies in `<>…</>`; single nodes pass through verbatim.
 *
 * The body is the SlotFillerDecl.body — already-lowered TemplateNode[].
 */
function renderFillerBody(filler: SlotFillerDecl, ctx: EmitNodeCtx): string {
  const emitNodeFn = _emitTemplateNodeModule.emitNode;
  const parts = filler.body.map((c) => emitNodeFn(c, ctx));
  const inner = parts.join('');
  // Wrap in a fragment so the arrow returns a single JSX expression.
  return `<>${inner}</>`;
}

/**
 * Format ONE static-named filler (or default-shorthand) as a single JSX prop
 * assignment for the parent component tag.
 *
 * Returns text of the form `propName={...}` suitable for inclusion in the
 * component tag's attribute list. Caller is responsible for joining with
 * spaces.
 */
export function emitSlotFiller(
  filler: SlotFillerDecl,
  ctx: EmitNodeCtx,
): string {
  const fieldName = propFieldName(filler.name);
  const bodyJsx = renderFillerBody(filler, ctx);
  const destructure = paramsDestructure(filler);

  // Default-shorthand `children` with no scoped params: pass the JSX
  // fragment as the prop value directly (no arrow wrapping). This matches
  // the producer-side dual-shape's "raw ReactNode" branch.
  if (filler.name === '' && filler.params.length === 0) {
    return `${fieldName}={${bodyJsx}}`;
  }

  // Scoped default OR named fill: arrow wrapper that destructures scoped
  // params (or `()` when no params) and returns the JSX body.
  const argList = destructure === '' ? '()' : `(${destructure})`;
  return `${fieldName}={${argList} => (${bodyJsx})}`;
}

/**
 * R5 dynamic-name path — collect ALL dynamic fillers on a single component
 * tag into one `slots={{ [expr1]: fn1, [expr2]: fn2 }}` prop.
 *
 * Returns null when no dynamic fillers are present (caller skips the slots
 * attribute entirely). When non-null, returns the full JSX attribute text
 * `slots={...}`. The producer-side React shell must declare a matching
 * `slots?: Record<string, (ctx) => ReactNode>` prop for this to wire end-to-
 * end (RESEARCH §3.b "Dynamic name D-04 React"); Wave 1 doesn't exercise
 * this, but the symmetry is in place for Wave 2 fixtures.
 */
export function emitDynamicSlotsProp(
  fillers: readonly SlotFillerDecl[],
  ctx: EmitNodeCtx,
): string | null {
  const dynamics = fillers.filter((f) => f.isDynamic);
  if (dynamics.length === 0) return null;

  const entries: string[] = [];
  for (const filler of dynamics) {
    if (!filler.dynamicNameExpr) continue; // ROZ946 was already emitted upstream
    const keyExpr = rewriteTemplateExpression(filler.dynamicNameExpr, ctx.ir);
    const destructure = paramsDestructure(filler);
    const argList = destructure === '' ? '()' : `(${destructure})`;
    const bodyJsx = renderFillerBody(filler, ctx);
    entries.push(`[${keyExpr}]: ${argList} => (${bodyJsx})`);
  }
  if (entries.length === 0) return null;
  return `slots={{ ${entries.join(', ')} }}`;
}
