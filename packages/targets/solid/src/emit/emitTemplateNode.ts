/**
 * emitTemplateNode — Solid target (P1 stub).
 *
 * Walks a TemplateNode IR and returns a JSX string. P1 emits a minimal
 * valid JSX representation. P2 fills directive-accurate emission (<Show>, <For>, etc.).
 *
 * @experimental — shape may change before v1.0
 */
import type { TemplateNode } from '../../../../core/src/ir/types.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';

export interface EmitNodeCtx {
  ir: IRComponent;
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector };
  registry: ModifierRegistry;
  diagnostics: Diagnostic[];
}

export function emitNode(node: TemplateNode, ctx: EmitNodeCtx): string {
  return emitNodeInner(node, ctx);
}

function emitNodeInner(node: TemplateNode, ctx: EmitNodeCtx): string {
  if (node.type === 'TemplateText' || node.type === 'TemplateStaticText') {
    // Static text node.
    return 'text' in node ? (node as { text: string }).text : '';
  }

  if (node.type === 'TemplateInterpolation') {
    // {{ expr }} → {expr}
    const expr = 'rawExpr' in node ? (node as { rawExpr: string }).rawExpr.trim() : '';
    return `{${expr}}`;
  }

  if (node.type === 'TemplateElement') {
    const tag = node.tagName;
    const children = node.children.map((c) => emitNodeInner(c, ctx)).join('');

    // Build attribute string from node.attributes.
    const attrParts: string[] = [];
    for (const attr of node.attributes) {
      if (attr.kind === 'static') {
        attrParts.push(`${attr.name}="${attr.value}"`);
      } else if (attr.kind === 'binding') {
        // Bound attribute: emit as JSX expression.
        // P1: emit the raw expression text from the binding.
        const exprText = 'expression' in attr && attr.expression
          ? (typeof attr.expression === 'string'
              ? attr.expression
              : JSON.stringify(attr.expression))
          : attr.name;
        attrParts.push(`${attr.name}={${exprText}}`);
      }
      // 'interpolated' and events: P2 handles.
    }

    const attrStr = attrParts.length > 0 ? ' ' + attrParts.join(' ') : '';
    if (node.selfClosing || children.length === 0) {
      return `<${tag}${attrStr} />`;
    }
    return `<${tag}${attrStr}>${children}</${tag}>`;
  }

  if (node.type === 'TemplateConditional') {
    // P1: emit a ternary. P2 uses <Show when={...}>.
    const condition = 'condition' in node
      ? (typeof (node as { condition: unknown }).condition === 'string'
          ? (node as { condition: string }).condition
          : 'true')
      : 'true';
    const consequent = 'consequent' in node && (node as { consequent: TemplateNode }).consequent
      ? emitNodeInner((node as { consequent: TemplateNode }).consequent, ctx)
      : 'null';
    const alternate = 'alternate' in node && (node as { alternate: TemplateNode | null }).alternate
      ? emitNodeInner((node as { alternate: TemplateNode }).alternate, ctx)
      : null;
    if (alternate !== null) {
      return `{${condition} ? (${consequent}) : (${alternate})}`;
    }
    return `{${condition} && (${consequent})}`;
  }

  if (node.type === 'TemplateLoop') {
    // P1: emit a simple map expression. P2 uses <For>.
    const items = 'items' in node
      ? (typeof (node as { items: unknown }).items === 'string'
          ? (node as { items: string }).items
          : 'items')
      : 'items';
    const item = 'item' in node ? (node as { item: string }).item : 'item';
    const body = 'children' in node && Array.isArray(node.children)
      ? node.children.map((c) => emitNodeInner(c as TemplateNode, ctx)).join('')
      : 'null';
    return `{${items}.map((${item}) => (${body}))}`;
  }

  if (node.type === 'TemplateFragment') {
    const children = 'children' in node && Array.isArray(node.children)
      ? node.children.map((c) => emitNodeInner(c as TemplateNode, ctx)).join('')
      : '';
    return `<>{${children}}</>`;
  }

  if (node.type === 'TemplateSlotInvocation') {
    const slotName = 'slotName' in node ? (node as { slotName: string }).slotName : '';
    if (slotName === '' || slotName === 'default') {
      return '{resolved()}';
    }
    return `{local.${slotName}}`;
  }

  void ctx;
  return '';
}
