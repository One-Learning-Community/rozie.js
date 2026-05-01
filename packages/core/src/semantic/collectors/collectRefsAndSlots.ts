/**
 * Collect template ref="name" attributes into BindingsTable.refs and
 * <slot> elements into BindingsTable.slots.
 *
 * Walk strategy: recursive DFS over template.children. Per element:
 *   - If it has a `kind: 'static'` attribute named 'ref', register the
 *     ref under bindings.refs.
 *   - If element.tagName === 'slot', register a SlotDeclEntry under
 *     bindings.slots keyed by the static `name` attribute (default ''
 *     sentinel per RESEARCH.md A1). Slot params are collected from
 *     `kind: 'binding'` attributes (e.g., :open="$props.open").
 *   - Recurse into children.
 *
 * Wave 0 baseline: presence is set to 'always'. Plan 05 lowerSlots refines
 * to 'conditional' when the <slot> sits under r-if="$slots.<name>".
 *
 * Per D-08 collected-not-thrown: this function NEVER throws.
 */
import type {
  TemplateAST,
  TemplateNode,
  TemplateElement,
  TemplateAttr,
} from '../../ast/blocks/TemplateAST.js';
import type {
  BindingsTable,
  RefDeclEntry,
  SlotDeclEntry,
  SlotParamDecl,
} from '../types.js';

function isElement(node: TemplateNode): node is TemplateElement {
  return node.type === 'TemplateElement';
}

function findStaticAttr(el: TemplateElement, name: string): TemplateAttr | undefined {
  return el.attributes.find((a) => a.kind === 'static' && a.name === name);
}

function collectSlotParams(el: TemplateElement): SlotParamDecl[] {
  const params: SlotParamDecl[] = [];
  for (const attr of el.attributes) {
    if (attr.kind !== 'binding') continue;
    if (attr.value === null) continue;
    params.push({
      name: attr.name,
      valueExpressionRaw: attr.value,
      sourceLoc: attr.loc,
    });
  }
  return params;
}

function visit(node: TemplateNode, bindings: BindingsTable): void {
  if (!isElement(node)) return;

  // Refs: ref="name"
  const refAttr = findStaticAttr(node, 'ref');
  if (refAttr && refAttr.value !== null) {
    const entry: RefDeclEntry = {
      name: refAttr.value,
      elementTag: node.tagName,
      sourceLoc: refAttr.loc,
    };
    bindings.refs.set(refAttr.value, entry);
  }

  // Slots: <slot> elements
  if (node.tagName === 'slot') {
    const nameAttr = findStaticAttr(node, 'name');
    const slotName = nameAttr && nameAttr.value !== null ? nameAttr.value : '';
    const entry: SlotDeclEntry = {
      name: slotName,
      presence: 'always', // Wave 0 baseline; Plan 05 lowerSlots refines.
      params: collectSlotParams(node),
      sourceLoc: node.loc,
    };
    bindings.slots.set(slotName, entry);
  }

  for (const child of node.children) {
    visit(child, bindings);
  }
}

export function collectRefsAndSlots(template: TemplateAST, bindings: BindingsTable): void {
  for (const child of template.children) {
    visit(child, bindings);
  }
}
