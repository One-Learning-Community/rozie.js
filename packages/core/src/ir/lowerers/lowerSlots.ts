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
 * Per D-08 collected-not-thrown: never throws.
 *
 * @experimental — shape may change before v1.0
 */
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import type {
  TemplateAST,
  TemplateNode,
  TemplateElement,
} from '../../ast/blocks/TemplateAST.js';
import type { SlotDecl, ParamDecl } from '../types.js';

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
}

function collectParamsFromSlotElement(slot: TemplateElement): ParamDecl[] {
  const params: ParamDecl[] = [];
  for (const attr of slot.attributes) {
    if (attr.kind !== 'binding') continue;
    if (attr.value === null) continue;
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

function determinePresence(
  slot: TemplateElement,
  ctx: SlotVisitContext,
): 'always' | 'conditional' {
  if (ctx.rIfStack.length === 0) return 'always';
  // Determine target slot name (default '' if no `name` attribute).
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

function getRIfAttr(el: TemplateElement): string | null {
  for (const a of el.attributes) {
    if (a.kind === 'directive' && a.name === 'if' && a.value !== null) {
      return a.value;
    }
  }
  return null;
}

function visit(
  nodes: readonly TemplateNode[],
  ctx: SlotVisitContext,
  out: SlotDecl[],
): void {
  for (const node of nodes) {
    if (!isTemplateElement(node)) continue;

    const rIf = getRIfAttr(node);
    const childCtx: SlotVisitContext = rIf
      ? { rIfStack: [...ctx.rIfStack, rIf] }
      : ctx;

    if (node.tagName === 'slot') {
      // Determine slot name
      let slotName = '';
      for (const a of node.attributes) {
        if (a.kind === 'static' && a.name === 'name' && a.value !== null) {
          slotName = a.value;
          break;
        }
      }
      const params = collectParamsFromSlotElement(node);
      const presence = determinePresence(node, childCtx);

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
      visit(node.children, childCtx, nestedSlots);

      out.push({
        type: 'SlotDecl',
        name: slotName,
        defaultContent,
        params,
        presence,
        nestedSlots,
        sourceLoc: node.loc,
      });
      continue;
    }

    // Recurse into element children.
    visit(node.children, childCtx, out);
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

export function lowerSlots(template: TemplateAST): SlotDecl[] {
  const out: SlotDecl[] = [];
  visit(template.children, { rIfStack: [] }, out);

  // D-SM-01: lift nested slots onto the flat declared slot surface. Iterate a
  // snapshot of the top-level slots (the loop appends to `out`). De-dupe by
  // name so a nested slot that shares a name with a top-level slot is not
  // declared twice.
  const topLevel = [...out];
  const seen = new Set(out.map((s) => s.name));
  for (const slot of topLevel) {
    const nestedFlat: SlotDecl[] = [];
    flattenNestedSlots(slot, nestedFlat);
    for (const nested of nestedFlat) {
      if (seen.has(nested.name)) continue;
      seen.add(nested.name);
      out.push(nested);
    }
  }

  return out;
}
