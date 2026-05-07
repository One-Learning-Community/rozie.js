/**
 * emitTemplateEvent — Solid target (P1 stub).
 * P2 fills: @event.modifier → Solid on:event or native event binding.
 *
 * @experimental — shape may change before v1.0
 */
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitEventResult {
  attrString: string;
  diagnostics: Diagnostic[];
}

export function emitTemplateEvent(
  eventName: string,
  handlerExpression: string,
): EmitEventResult {
  // P1 minimal: emit a standard JSX event handler attribute.
  const jsxEventName = 'on' + eventName.charAt(0).toUpperCase() + eventName.slice(1);
  return {
    attrString: `${jsxEventName}={${handlerExpression}}`,
    diagnostics: [],
  };
}
