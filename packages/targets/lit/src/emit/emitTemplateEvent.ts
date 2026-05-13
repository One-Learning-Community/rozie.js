/**
 * emitTemplateEvent — Lit target template-event emission (Plan 06.4-02 Task 1).
 *
 * Renders a single template `@event` listener as a Lit `@event=${...}` binding.
 * The real per-element walk happens inside emitTemplate.ts; this thin helper
 * is provided for unit-test reach.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, Listener } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export function emitTemplateEvent(listener: Listener, ir: IRComponent): string {
  const handler = rewriteTemplateExpression(listener.handler, ir);
  const guards: string[] = [];
  let capture = false;
  let passive = false;
  let once = false;

  for (const entry of listener.modifierPipeline) {
    if (entry.kind === 'listenerOption') {
      if (entry.option === 'capture') capture = true;
      if (entry.option === 'passive') passive = true;
      if (entry.option === 'once') once = true;
    } else if (entry.kind === 'filter' || entry.kind === 'wrap') {
      if (entry.modifier === 'stop') guards.push('e.stopPropagation();');
      else if (entry.modifier === 'prevent') guards.push('e.preventDefault();');
      else if (entry.modifier === 'self')
        guards.push('if (e.target !== e.currentTarget) return;');
      else if (entry.modifier === 'enter')
        guards.push("if ((e as KeyboardEvent).key !== 'Enter') return;");
      else if (entry.modifier === 'escape' || entry.modifier === 'esc')
        guards.push("if ((e as KeyboardEvent).key !== 'Escape') return;");
    }
  }

  const body =
    guards.length > 0
      ? `(e: Event) => { ${guards.join(' ')} (${handler})(e); }`
      : `(${handler})`;

  const optionParts: string[] = [];
  if (capture) optionParts.push('capture: true');
  if (passive) optionParts.push('passive: true');
  if (once) optionParts.push('once: true');

  if (optionParts.length > 0) {
    return `@${listener.event}=\${{ handleEvent: ${body}, ${optionParts.join(', ')} }}`;
  }
  return `@${listener.event}=\${${body}}`;
}
