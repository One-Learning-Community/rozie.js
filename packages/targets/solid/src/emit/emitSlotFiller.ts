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
 *   - []                                 → ''
 *   - [{name:'close'}]                   → '{ close }'
 *   - [{name:'a'},{name:'b'}]            → '{ a, b }'
 *   - [{name:'item', bindAs:'column'}]   → '{ item: column }'  (rename)
 */
function paramsDestructure(filler: SlotFillerDecl): string {
  if (filler.params.length === 0) return '';
  return `{ ${filler.params.map((p) => (p.bindAs ? `${p.name}: ${p.bindAs}` : p.name)).join(', ')} }`;
}

/**
 * Phase 33 / REQ-26 — internal accessor identifier the reactive-portal fill
 * arrow binds the scope to. Chosen to never collide with author param names
 * (the leading `_rozie` prefix is reserved emitter namespace).
 */
const REACTIVE_SCOPE_ACCESSOR_IDENT = '_rozieScope';

/**
 * Is this filler a REACTIVE portal slot fill with scope params? Only then does
 * the Solid consumer switch to the accessor-scope arrow form (the producer's
 * reactive portal passes scope as a `() => scope` accessor, not a value).
 */
function isReactivePortalFill(filler: SlotFillerDecl): boolean {
  return (
    filler.isPortal === true &&
    filler.isReactive === true &&
    filler.params.length > 0
  );
}

/**
 * Build the scope-accessor rewrite map for a reactive portal fill: each local
 * binding name (bindAs when renamed, else the param name) → the scope PROPERTY
 * it resolves to (always the param's declared `name`). Threaded onto the body
 * emit ctx so bare param reads become `_rozieScope().<prop>` (in-place re-render).
 */
function buildScopeAccessorParams(
  filler: SlotFillerDecl,
): { accessorIdent: string; params: ReadonlyMap<string, string> } {
  const params = new Map<string, string>();
  for (const p of filler.params) {
    const localName = p.bindAs ?? p.name;
    params.set(localName, p.name);
  }
  return { accessorIdent: REACTIVE_SCOPE_ACCESSOR_IDENT, params };
}

/**
 * Render the body of one filler as a JSX fragment string. Wraps multi-node
 * bodies in `<>…</>`; single nodes pass through verbatim.
 *
 * The body is the SlotFillerDecl.body — already-lowered TemplateNode[].
 *
 * For a REACTIVE portal fill, the body emit ctx carries `scopeAccessorParams`
 * so scope-param reads lower to `_rozieScope().<prop>` (lazy, tracked) instead
 * of bare destructured-value reads (statically captured) — the in-place
 * re-render fix (REQ-26). Every other fill renders with the unchanged ctx.
 */
function renderFillerBody(filler: SlotFillerDecl, ctx: EmitNodeCtx): string {
  const emitNodeFn = _emitTemplateNodeModule.emitNode;
  const bodyCtx: EmitNodeCtx = isReactivePortalFill(filler)
    ? { ...ctx, scopeAccessorParams: buildScopeAccessorParams(filler) }
    : ctx;
  const parts = filler.body.map((c) => emitNodeFn(c, bodyCtx));
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

  // Phase 33 / REQ-26 — REACTIVE portal fill: the producer passes scope as a
  // Solid Accessor (`() => scope`), so the arrow takes ONE accessor param and
  // the body reads `_rozieScope().<param>` (rewritten via scopeAccessorParams in
  // renderFillerBody). This is the in-place re-render fix — every scope read
  // re-tracks on `setScopeSig`, so the consumer fragment updates without remount
  // (matches Spike 009's proven `scope().label` chip). Mount-once portal fills
  // and every non-reactive scoped slot keep the destructured-value shape below.
  if (isReactivePortalFill(filler)) {
    return {
      kind: 'prop',
      text: `${fieldName}={${REACTIVE_SCOPE_ACCESSOR_IDENT} => (${bodyJsx})}`,
    };
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
    const keyExpr = rewriteTemplateExpression(filler.dynamicNameExpr, ctx.ir, { invokeAccessors: ctx.invokeAccessors, loopValueBindings: ctx.loopValueBindings });
    const destructure = paramsDestructure(filler);
    const argList = destructure === '' ? '()' : `(${destructure})`;
    const bodyJsx = renderFillerBody(filler, ctx);
    entries.push(`[${keyExpr}]: ${argList} => (${bodyJsx})`);
  }
  if (entries.length === 0) return null;
  return `slots={{ ${entries.join(', ')} }}`;
}
