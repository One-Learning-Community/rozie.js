/**
 * emitTemplateAttribute — Solid target (P1 stub).
 * P2 fills: bound prop syntax, event bindings, r-model → value/onInput.
 *
 * @experimental — shape may change before v1.0
 */
import type { AttributeBinding } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitAttrResult {
  attrString: string;
  diagnostics: Diagnostic[];
}

export function emitTemplateAttribute(attr: AttributeBinding): EmitAttrResult {
  if (attr.kind === 'static') {
    return { attrString: `${attr.name}="${attr.value}"`, diagnostics: [] };
  }
  if (attr.kind === 'binding') {
    // P1: emit expression as string.
    const expr = typeof attr.expression === 'string'
      ? attr.expression
      : JSON.stringify(attr.expression);
    return { attrString: `${attr.name}={${expr}}`, diagnostics: [] };
  }
  // 'interpolated': P2 handles.
  return { attrString: '', diagnostics: [] };
}
