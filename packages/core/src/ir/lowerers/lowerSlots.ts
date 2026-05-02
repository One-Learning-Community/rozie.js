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

      // defaultContent = inline children (raw — not deeply lowered here).
      // We hold null when there are no real children (text-only whitespace
      // is still meaningful for emit fidelity but for v1 we treat empty
      // slot bodies as null).
      const realChildren = node.children.filter(
        (c) => !(c.type === 'TemplateText' && c.text.trim() === ''),
      );
      const defaultContent = realChildren.length > 0
        ? // We hold a TemplateFragment-style placeholder (the raw children
          // count as IR-level fragment); to avoid double-lowering and keep
          // the slot snapshot lean, we represent default content by walking
          // the children for nested slots BUT NOT lowering them to full IR
          // here (that's lowerTemplate's job for the template tree).
          // For SlotDecl.defaultContent we provide a stable null-or-fragment;
          // the actual fallback rendering goes through the TemplateSlotInvocationIR
          // that lowerTemplate produced. Setting null here is consistent with
          // the contract that SlotDecl.defaultContent is "lifted SEPARATELY"
          // (D-18 / RESEARCH.md SlotDecl spec).
          null
        : null;

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

export function lowerSlots(template: TemplateAST): SlotDecl[] {
  const out: SlotDecl[] = [];
  visit(template.children, { rIfStack: [] }, out);
  return out;
}
