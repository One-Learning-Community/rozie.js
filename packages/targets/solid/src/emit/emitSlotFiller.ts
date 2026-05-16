/**
 * emitSlotFiller — Phase 07.2 Plan 03 Task 1 (Solid target).
 *
 * Consumer-side mirror of emitSlotInvocation (producer side). Where the
 * producer reads `{_props.headerSlot?.({ close })}` / `{resolved()}`, the
 * consumer emits the matching `headerSlot={({ close }) => …body…}` JSX prop
 * ASSIGNMENT (or bare children for default-shorthand) on the component tag.
 *
 * The producer's field-name convention is the source-of-truth — slot 'header'
 * lands on the producer's props as `headerSlot` (see emitSlotInvocation.ts
 * L105: `slotName + 'Slot'`). Default slot (`name === ''`) is consumed via
 * `children(() => local.children)` on the producer's `local.children` accessor
 * (shell.ts L169) — so the consumer just writes bare JSX children, no
 * `defaultSlot=` or similar prop. Mirrors React's `children` magic-prop.
 *
 * Output shapes (per RESEARCH §"Pattern 3.d Solid"):
 *
 *   { name: 'header', params: [] }
 *     → `headerSlot={() => (<>…body…</>)}`
 *
 *   { name: 'header', params: [{name:'close'},{name:'open'}] }
 *     → `headerSlot={({ close, open }) => (<>…body…</>)}`
 *
 *   { name: '', params: [] }                            (default-shorthand)
 *     → bare children inside the component tag — Solid's `children(() =>
 *       local.children)` accessor handles them on the producer side. No prop
 *       assignment.
 *
 *   { name: '', params: [{name:'item'}] }              (scoped default fill)
 *     → `children={({ item }) => (<>…body…</>)}`
 *       ↑ scoped default needs an explicit function form because bare JSX
 *         children can't accept ctx — symmetric with React's dual-shape
 *         (emitSlotInvocation.ts L97-102) and Solid's `_props.children?.(ctx)`
 *         producer-side pattern.
 *
 *   { isDynamic: true, dynamicNameExpr } — R5 dynamic name
 *     → emit a `slots={{ [expr]: ({…}) => (<>…</>) }}` prop fragment.
 *       Multiple dynamic fillers on the same tag merge into one `slots={…}`.
 *       Wave 1 has no dynamic fixture exercising this; the symmetry is in
 *       place so Wave 2's consumer-dynamic-name fixture can fill it without
 *       re-engineering emitTemplateNode.
 *
 * Body recursion uses the same emitNode pipeline as the rest of the Solid
 * emitter — magic-identifier rewrites (`$props.x` → `local.x` / `_props.x`
 * via rewriteTemplateExpression's Solid mode) apply naturally inside any
 * `TemplateInterpolation` / attribute binding nested in the fill body. No
 * separate rewrite pass needed.
 *
 * Phase 07.1 self-reference pattern: SlotFillerDecl is imported via the
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
 *   - '' (default) → 'children'  (handled separately — bare-children path)
 *   - 'header'      → 'headerSlot'  (mirrors emitSlotInvocation.ts L105)
 *
 * MUST match the Solid producer-side `slotName + 'Slot'` formula so consumer-
 * fill prop names align with producer props interface fields byte-for-byte.
 */
function propFieldName(slotName: string): string {
  if (slotName === '') return 'children';
  return slotName + 'Slot';
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
 * Result of emitting a single filler. Two-shape return lets the caller
 * distinguish between filler-as-prop-assignment and filler-as-bare-children:
 *
 *   - `kind: 'prop'`: emit `text` as an additional JSX prop on the component
 *     tag (e.g. `headerSlot={() => (<>...</>)}`).
 *   - `kind: 'children'`: emit `text` as bare children inside the component
 *     tag body (e.g. `<Producer>...text...</Producer>`). Used only for
 *     default-shorthand WITHOUT scoped params.
 */
export type SolidFillerEmission =
  | { kind: 'prop'; text: string }
  | { kind: 'children'; text: string };

/**
 * Format ONE static-named filler (or default-shorthand) as either a JSX prop
 * assignment OR bare children for the parent component tag.
 *
 * - default-shorthand without scope → bare children (Solid's `children(() =>
 *   local.children)` accessor handles them on the producer side)
 * - default with scope, named, named-scoped → JSX prop assignment with arrow
 */
export function emitSlotFiller(
  filler: SlotFillerDecl,
  ctx: EmitNodeCtx,
): SolidFillerEmission {
  const fieldName = propFieldName(filler.name);
  const bodyJsx = renderFillerBody(filler, ctx);

  // Default-shorthand WITHOUT scoped params: emit as bare children of the
  // component tag. The producer's `children(() => local.children)` accessor
  // (shell.ts L169) reads them via `local.children`.
  if (filler.name === '' && filler.params.length === 0) {
    // bodyJsx is wrapped in <> … </>; for the bare-children path we want to
    // emit just the inner content (the component tag itself is the wrapper).
    // Strip the outermost fragment wrap so the inner content sits naturally
    // between <Producer> … </Producer>.
    const inner = bodyJsx.slice(2, -3); // strip leading `<>` and trailing `</>`
    return { kind: 'children', text: inner };
  }

  // Scoped default OR named fill: arrow wrapper that destructures scoped
  // params (or `()` when no params) and returns the JSX body. The producer's
  // refineSlotTypes treats `_props.headerSlot` / scoped `_props.children` as
  // `(ctx) => JSX.Element`, so the consumer's function-form lines up byte-for-
  // byte.
  const destructure = paramsDestructure(filler);
  const argList = destructure === '' ? '()' : `(${destructure})`;
  return { kind: 'prop', text: `${fieldName}={${argList} => (${bodyJsx})}` };
}

/**
 * R5 dynamic-name path — collect ALL dynamic fillers on a single component
 * tag into one `slots={{ [expr1]: fn1, [expr2]: fn2 }}` prop.
 *
 * Returns null when no dynamic fillers are present (caller skips the slots
 * attribute entirely). When non-null, returns the full JSX attribute text
 * `slots={...}`. The producer-side Solid shell must declare a matching
 * `slots?: Record<string, (ctx) => JSX.Element>` prop for this to wire end-to-
 * end (RESEARCH §3.d "D-04 Solid"). Wave 1 doesn't exercise this; the
 * symmetry is in place for Wave 2's consumer-dynamic-name fixture.
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
