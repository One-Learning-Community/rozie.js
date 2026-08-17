/**
 * lowerSlots — extract SlotDecl[] from a TemplateAST.
 *
 * Plan 02-05 Task 2.
 *
 * For each `<slot>` element in the template tree:
 *   - name = static `name` attribute, or '' for the default slot (D-18 / A1).
 *   - defaultContent = the lifted body of the slot element when present.
 *   - params = each `:propName="expr"` binding attribute on the slot element.
 *   - presence = 'conditional' if any ancestor is wrapped in
 *     `r-if="$slots.<name>"` or `r-if="…$slots.<name>…"`; 'always' otherwise.
 *   - nestedSlots = recursive — slots inside the slot's defaultContent.
 *
 * Phase 79 R1/R7 — a `<slot>` may also carry a bound `:name` in place of (or,
 * erroneously, alongside) the static `name` attribute. A constant `:name`
 * (StringLiteral, or a zero-interpolation TemplateLiteral) constant-folds to
 * `name` exactly like a static attribute (AC-3); anything else sets
 * `SlotDecl.dynamicNameExpr` (and `namePrefix` when derivable) and pushes one
 * of ROZ090/ROZ091/ROZ092/ROZ094/ROZ096 as appropriate. See
 * `slotDynamicName.test.ts` for the full behavior matrix.
 *
 * Per D-08 collected-not-thrown: never throws. `lowerSlots` now takes a
 * `diagnostics` accumulator (mutated in place) for the Phase 79 checks above.
 *
 * @experimental — shape may change before v1.0
 */
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import type {
  TemplateAST,
  TemplateNode,
  TemplateElement,
  TemplateAttr,
} from '../../ast/blocks/TemplateAST.js';
import type { SlotDecl, ParamDecl } from '../types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

/**
 * Determine whether `expr` references `$slots.<targetSlotName>` anywhere
 * inside it. Used to detect r-if='$slots.header' / r-if='$slots.foo && bar'
 * style guards.
 */
function expressionReferencesSlot(exprText: string, targetSlotName: string): boolean {
  let parsed: t.Expression;
  try {
    parsed = parseExpression(exprText, { sourceType: 'module' });
  } catch {
    return false;
  }
  let found = false;
  const walk = (node: t.Node | null | undefined): void => {
    if (!node || found) return;
    if (
      t.isMemberExpression(node) &&
      !node.computed &&
      t.isIdentifier(node.object) &&
      node.object.name === '$slots' &&
      t.isIdentifier(node.property) &&
      node.property.name === targetSlotName
    ) {
      found = true;
      return;
    }
    // Recurse into children that might be nested expressions.
    for (const k of Object.keys(node)) {
      const v = (node as unknown as Record<string, unknown>)[k];
      if (v && typeof v === 'object') {
        if (Array.isArray(v)) {
          for (const it of v) walk(it as t.Node);
        } else if ('type' in v) {
          walk(v as t.Node);
        }
      }
    }
  };
  walk(parsed);
  return found;
}

function isTemplateElement(node: TemplateNode): node is TemplateElement {
  return node.type === 'TemplateElement';
}

/**
 * Result type for the recursive slot-collection visitor.
 */
interface SlotVisitContext {
  /** Conditional ancestors guarded by r-if expressions (text + ref count). */
  rIfStack: string[];
  /**
   * Quick 260808-iyh (D5) — true once the walk has passed through (or is
   * currently on) an element carrying `r-for`. Threaded down the tree the
   * same way `rIfStack` is; consumed to set `SlotDecl.inLoop`.
   */
  inLoop: boolean;
}

function collectParamsFromSlotElement(slot: TemplateElement, isPortal: boolean): ParamDecl[] {
  const params: ParamDecl[] = [];
  for (const attr of slot.attributes) {
    if (attr.kind !== 'binding') continue;
    if (attr.value === null) continue;
    // Phase 79 R1 — `:name` is reserved as the producer-side dynamic
    // slot-name binding (see the main visit() branch below); it must never
    // reach the scope-param surface as ParamDecl.name === 'name'. Skipping
    // it here — unconditionally, portal or not — is also what makes ROZ091
    // (a scope param literally named 'name' on a dynamic slot) unreachable
    // through normal authoring; see slotDynamicName.test.ts for the
    // reachability proof this task's Task 2 companion requires.
    if (attr.name === 'name') continue;
    // Portal slots use `:params="['arg', ...]"` as a TYPE DECLARATION for
    // the scope-key names, not as a normal scoped-slot binding source —
    // strip it here so it doesn't reach the consumer-facing scoped-slot
    // surface (it lowers separately into SlotDecl.portalParamNames).
    if (isPortal && attr.name === 'params') continue;
    let expr: t.Expression;
    try {
      expr = parseExpression(attr.value, { sourceType: 'module' });
    } catch {
      // Defensive — keep an Identifier placeholder so emitters don't crash.
      expr = t.identifier('undefined');
    }
    params.push({
      type: 'ParamDecl',
      name: attr.name,
      valueExpression: expr,
      sourceLoc: attr.loc,
    });
  }
  return params;
}

/**
 * Detect the bare `portal` static attribute on a `<slot>` element. The parser
 * emits boolean attrs as `kind: 'static', value: null`.
 */
function detectPortal(slot: TemplateElement): boolean {
  for (const a of slot.attributes) {
    if (a.kind === 'static' && a.name === 'portal' && a.value === null) return true;
  }
  return false;
}

/**
 * Detect the bare `reactive` static attribute on a `<slot>` element. The parser
 * emits boolean attrs as `kind: 'static', value: null`. Phase 33 / REQ-22: only
 * meaningful when the slot is ALSO a portal — the call site gates the resulting
 * `decl.isReactive` assignment on `isPortal`, so a bare `reactive` with no
 * `portal` is inert (never sets the flag).
 */
function detectReactive(slot: TemplateElement): boolean {
  for (const a of slot.attributes) {
    if (a.kind === 'static' && a.name === 'reactive' && a.value === null) return true;
  }
  return false;
}

/**
 * Extract the scope-key names from a portal slot's `:params="['a', 'b']"`
 * attribute. Returns [] when omitted or unparseable — emitters degrade to
 * an `unknown` scope.
 */
function extractPortalParamNames(slot: TemplateElement): string[] {
  for (const attr of slot.attributes) {
    if (attr.kind !== 'binding') continue;
    if (attr.name !== 'params' || attr.value === null) continue;
    let expr: t.Expression;
    try {
      expr = parseExpression(attr.value, { sourceType: 'module' });
    } catch {
      return [];
    }
    if (!t.isArrayExpression(expr)) return [];
    const names: string[] = [];
    for (const el of expr.elements) {
      if (el && t.isStringLiteral(el)) names.push(el.value);
    }
    return names;
  }
  return [];
}

function determinePresence(
  slot: TemplateElement,
  ctx: SlotVisitContext,
): 'always' | 'conditional' {
  if (ctx.rIfStack.length === 0) return 'always';
  // Determine target slot name (default '' if no static `name` attribute).
  //
  // Phase 79 R1 — this scan is intentionally STATIC-ONLY and left untouched.
  // A slot whose name comes from a bound `:name` (dynamic, or constant-
  // folded — the fold happens later, in visit()) falls through to the ''
  // default here. `expressionReferencesSlot` below can only match a
  // `$slots.<identifier>` member access, and '' is not a valid identifier
  // name, so a guard can never reference it — the loop below always returns
  // 'always' for such a slot. That is exactly the correct result: a runtime
  // slot name has no compile-time `$slots.<key>` guard-reference to test
  // against, so presence can never be narrowed to 'conditional'.
  let slotName = '';
  for (const a of slot.attributes) {
    if (a.kind === 'static' && a.name === 'name' && a.value !== null) {
      slotName = a.value;
      break;
    }
  }
  // Conditional if any wrapping r-if references $slots.<slotName>.
  for (const guard of ctx.rIfStack) {
    if (expressionReferencesSlot(guard, slotName)) return 'conditional';
  }
  return 'always';
}

/**
 * Find the FIRST `binding`-kind attribute on `slot` whose name is exactly
 * `attrName` (with a non-null value). Used to locate the `:name` binding
 * separately from `collectParamsFromSlotElement`'s param-collection pass,
 * which now skips it entirely (Phase 79 R1).
 */
function findBindingAttr(slot: TemplateElement, attrName: string): TemplateAttr | null {
  for (const a of slot.attributes) {
    if (a.kind === 'binding' && a.name === attrName && a.value !== null) return a;
  }
  return null;
}

/**
 * Constant-fold a parsed `:name` expression to a static string when
 * possible (AC-3): a bare StringLiteral, or a TemplateLiteral with ZERO
 * interpolations (`` `cell` `` — no `${...}` segments at all).
 *
 * Returns `{ folded: false }` for anything else — including a
 * TemplateLiteral WITH interpolations, a bare identifier/member expression,
 * and a call expression — all of which set `SlotDecl.dynamicNameExpr`
 * instead.
 */
function foldConstantSlotName(
  expr: t.Expression,
): { folded: true; value: string } | { folded: false } {
  if (t.isStringLiteral(expr)) {
    return { folded: true, value: expr.value };
  }
  if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
    return { folded: true, value: expr.quasis.map((q) => q.value.cooked ?? '').join('') };
  }
  return { folded: false };
}

function getRIfAttr(el: TemplateElement): string | null {
  for (const a of el.attributes) {
    if (a.kind === 'directive' && a.name === 'if' && a.value !== null) {
      return a.value;
    }
  }
  return null;
}

/**
 * Quick 260808-iyh (D5) — mirrors `getRIfAttr`, detecting `r-for` instead of
 * `r-if`. `r-for` is the same directive attribute shape with `name === 'for'`.
 */
function hasRForAttr(el: TemplateElement): boolean {
  for (const a of el.attributes) {
    if (a.kind === 'directive' && a.name === 'for' && a.value !== null) {
      return true;
    }
  }
  return false;
}

function visit(
  nodes: readonly TemplateNode[],
  ctx: SlotVisitContext,
  out: SlotDecl[],
  diagnostics: Diagnostic[],
): void {
  for (const node of nodes) {
    if (!isTemplateElement(node)) continue;

    const rIf = getRIfAttr(node);
    const childInLoop = ctx.inLoop || hasRForAttr(node);
    const childCtx: SlotVisitContext =
      rIf || childInLoop !== ctx.inLoop
        ? { rIfStack: rIf ? [...ctx.rIfStack, rIf] : ctx.rIfStack, inLoop: childInLoop }
        : ctx;

    if (node.tagName === 'slot') {
      // Determine the STATIC slot name (name="..." attribute), if any.
      let staticSlotName = '';
      let hasStaticNameAttr = false;
      for (const a of node.attributes) {
        if (a.kind === 'static' && a.name === 'name' && a.value !== null) {
          staticSlotName = a.value;
          hasStaticNameAttr = true;
          break;
        }
      }
      // Phase 79 R1 — the bound `:name` binding, read separately from the
      // static scan above (key_links: this is the SECOND static-only read
      // site the phase's own research flagged; both must move together).
      const dynamicNameAttr = findBindingAttr(node, 'name');

      const isPortal = detectPortal(node);
      const params = collectParamsFromSlotElement(node, isPortal);
      const presence = determinePresence(node, childCtx);
      const portalParamNames = isPortal ? extractPortalParamNames(node) : [];
      // Portal slots are never invoked from the template, but the per-target
      // slot-type emitters (refineSlotTypes etc.) build the ctx type from
      // `params`. Synthesize one ParamDecl per portal scope-key name so
      // downstream type emission produces `interface EventCtx { arg: any }`
      // without per-target portal-branch refactors. The valueExpression is
      // an `undefined` placeholder — never evaluated because lowerTemplate
      // skips emitting the portal slot's invocation.
      if (isPortal) {
        for (const pname of portalParamNames) {
          params.push({
            type: 'ParamDecl',
            name: pname,
            valueExpression: t.identifier('undefined'),
            sourceLoc: node.loc,
          });
        }
      }

      // defaultContent is always `null` here. To avoid double-lowering and
      // keep the slot snapshot lean, lowerSlots does NOT lower a slot's inline
      // children into IR — that's lowerTemplate's job for the template tree,
      // and the actual fallback rendering goes through the
      // TemplateSlotInvocationIR that lowerTemplate produced. Holding `null`
      // here is consistent with the contract that SlotDecl.defaultContent is
      // "lifted SEPARATELY" (D-18 / RESEARCH.md SlotDecl spec).
      const defaultContent = null;

      // Recurse for nested slots inside default content.
      const nestedSlots: SlotDecl[] = [];
      visit(node.children, childCtx, nestedSlots, diagnostics);

      // Phase 79 R1/R7 — resolve the effective slot name plus the two new
      // additive fields, and fire the four per-slot `:name` diagnostics.
      // Defaults match pre-phase behavior exactly when no `:name` is present
      // (slotName stays the static name / '' default; dynamicNameExpr and
      // namePrefix stay unset) — that is the AC-1 byte-identity guarantee.
      let slotName = staticSlotName;
      let dynamicNameExpr: t.Expression | undefined;
      let namePrefix: string | undefined;

      if (dynamicNameAttr) {
        // ROZ090 — a <slot> cannot declare BOTH a static name= and a bound
        // :name; the two would define conflicting identities.
        if (hasStaticNameAttr) {
          diagnostics.push({
            code: RozieErrorCode.SLOT_NAME_STATIC_AND_BOUND,
            severity: 'error',
            message: `<slot name="${staticSlotName}"> also declares a bound :name — a slot's name cannot be defined twice. Remove the static name="${staticSlotName}" attribute or the bound :name binding.`,
            loc: node.loc,
            hint: `Keep exactly one of name="..." or :name="..." on this <slot>.`,
          });
        }
        // ROZ092 — :name on a portal slot. portalKey() (types.ts) needs a
        // compile-time string for the $portals.<key> closure key; a bound
        // :name has no compile-time value to give it.
        if (isPortal) {
          diagnostics.push({
            code: RozieErrorCode.SLOT_DYNAMIC_NAME_ON_PORTAL,
            severity: 'error',
            message: `<slot portal :name="..."> is not supported — portal slots are addressed by a compile-time $portals.<key> closure key, and a bound :name has no value until runtime.`,
            loc: node.loc,
            hint: `Give the portal slot a static name="..." attribute instead of a bound :name.`,
          });
        }
        // ROZ091 — a scope param literally named 'name' on a dynamic slot.
        // `params` was built by collectParamsFromSlotElement ABOVE, which
        // (as of Task 1) unconditionally skips every binding attr named
        // 'name' before it can become a ParamDecl — so this condition is
        // UNREACHABLE through normal authoring; see slotDynamicName.test.ts
        // for the explicit reachability proof. Kept as a defensive check
        // (never deleted, never renumbered) in case a future authoring form
        // reintroduces a 'name'-keyed ParamDecl.
        if (params.some((p) => p.name === 'name')) {
          diagnostics.push({
            code: RozieErrorCode.SLOT_NAME_PARAM_ON_DYNAMIC_SLOT,
            severity: 'error',
            message: `<slot :name="..."> also declares a scope param named 'name' — 'name' is reserved on <slot> as of Phase 79 and can no longer be used as a scope-param key.`,
            loc: node.loc,
            hint: `Rename the scope param to something other than 'name'.`,
          });
        }

        let parsedNameExpr: t.Expression | null = null;
        try {
          parsedNameExpr = parseExpression(dynamicNameAttr.value as string, {
            sourceType: 'module',
          });
        } catch {
          // T-79-12 — never silently fall back to an `undefined` identifier
          // (that would resolve to the DEFAULT slot at runtime with zero
          // compile-time signal). Emit a diagnostic instead and leave the
          // slot's name at its pre-fallback default ('' or the static name).
          diagnostics.push({
            code: RozieErrorCode.SLOT_DYNAMIC_NAME_PARSE_ERROR,
            severity: 'error',
            message: `<slot :name="${dynamicNameAttr.value}"> failed to parse as a JavaScript expression — the slot's effective name cannot be determined.`,
            loc: dynamicNameAttr.valueLoc ?? dynamicNameAttr.loc,
            hint: 'Fix the :name expression syntax — it must be a valid JavaScript expression, e.g. :name="col.key" or a template literal.',
          });
        }

        if (parsedNameExpr) {
          const fold = foldConstantSlotName(parsedNameExpr);
          if (fold.folded) {
            // AC-3 — a constant :name is indistinguishable from an
            // equivalent static name="..." attribute: no dynamicNameExpr,
            // no namePrefix, byte-identical downstream emit.
            slotName = fold.value;
          } else {
            dynamicNameExpr = parsedNameExpr;
            if (t.isTemplateLiteral(parsedNameExpr)) {
              const firstQuasi = parsedNameExpr.quasis[0]?.value.cooked ?? '';
              if (firstQuasi !== '') {
                namePrefix = firstQuasi;
              }
            }
            // ROZ094 — no static leading prefix could be derived: a bare
            // identifier / member expression / call expression (no
            // TemplateLiteral at all), or a TemplateLiteral whose leading
            // quasi is empty. Legal — lowering continues normally — but
            // consumer param typing degrades and family matching (79-07)
            // has nothing to key on for this slot.
            if (namePrefix === undefined) {
              diagnostics.push({
                code: RozieErrorCode.SLOT_DYNAMIC_NAME_NO_PREFIX,
                severity: 'warning',
                message: `<slot :name="${dynamicNameAttr.value}"> has no static leading prefix, so consumer fills for it cannot be typed by family matching (ROZ947 cannot fire).`,
                loc: node.loc,
                hint: `Bind :name to a template literal with a non-empty leading segment (e.g. \`cell-\${k}\`) to enable typed family matching.`,
              });
            }
          }
        }
      }

      const decl: SlotDecl = {
        type: 'SlotDecl',
        name: slotName,
        defaultContent,
        params,
        presence,
        nestedSlots,
        sourceLoc: node.loc,
      };
      // Additive-field discipline (matches inLoop/isPortal/isReactive below):
      // assigned only when set, never as explicit `undefined`, so a
      // static-only-name component's SlotDecl carries no new keys (AC-1).
      if (dynamicNameExpr !== undefined) {
        decl.dynamicNameExpr = dynamicNameExpr;
      }
      if (namePrefix !== undefined) {
        decl.namePrefix = namePrefix;
      }
      if (isPortal) {
        decl.isPortal = true;
        decl.portalParamNames = portalParamNames;
        // Phase 33 / REQ-22: reactive is gated on isPortal — only set it for a
        // `portal reactive` slot; a bare `reactive` with no `portal` is inert.
        if (detectReactive(node)) {
          decl.isReactive = true;
        }
      }
      // Quick 260808-iyh (D5) — set ONLY when true so non-loop slots carry no
      // key at all (undefined === false back-compat, no IR snapshot churn).
      if (childInLoop) {
        decl.inLoop = true;
      }
      out.push(decl);
      continue;
    }

    // Recurse into element children.
    visit(node.children, childCtx, out, diagnostics);
  }
}

/**
 * Recursively collect a slot's nested slots into a flat list.
 *
 * D-SM-01: a nested slot (a `<slot>` inside another slot's defaultContent) is a
 * real, consumer-fillable slot — it must appear on the component's declared
 * slot surface, not only inside `SlotDecl.nestedSlots`. The native-`<slot>`
 * targets (Vue, Lit) render it from the template tree regardless; the
 * render-function targets (React, Svelte, Angular, Solid) build their
 * prop/slot surface from the flat `ir.slots` list, so without flattening they
 * emitted a *reference* to the nested slot that was never *declared*
 * (`renderInner` / `inner` / `innerTpl` / `innerSlot` undeclared).
 *
 * `nestedSlots` is left populated on each SlotDecl — flattening is additive.
 */
function flattenNestedSlots(slot: SlotDecl, out: SlotDecl[]): void {
  for (const nested of slot.nestedSlots) {
    out.push(nested);
    flattenNestedSlots(nested, out);
  }
}

export function lowerSlots(template: TemplateAST, diagnostics: Diagnostic[]): SlotDecl[] {
  const out: SlotDecl[] = [];
  visit(template.children, { rIfStack: [], inLoop: false }, out, diagnostics);

  // D-SM-01: lift nested slots onto the flat declared slot surface. Iterate a
  // snapshot of the top-level slots (the loop appends to `out`). De-dupe by
  // name so a nested slot that shares a name with a top-level slot is not
  // declared twice — but the empty-string default-slot name (`''`, the D-18
  // sentinel) is the *absence* of a name, NOT a shared identity. Two distinct
  // default-slot sites are distinct, consumer-fillable slots, so they are
  // never collapsed against each other or against a top-level default slot.
  const topLevel = [...out];
  const seen = new Set(out.filter((s) => s.name !== '').map((s) => s.name));
  for (const slot of topLevel) {
    const nestedFlat: SlotDecl[] = [];
    flattenNestedSlots(slot, nestedFlat);
    for (const nested of nestedFlat) {
      if (nested.name !== '' && seen.has(nested.name)) continue;
      if (nested.name !== '') seen.add(nested.name);
      out.push(nested);
    }
  }

  return out;
}
