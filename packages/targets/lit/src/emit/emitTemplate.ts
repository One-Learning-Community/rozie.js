/**
 * emitTemplate.ts — P1 stub for the Lit target template emitter.
 *
 * P2 will walk the IR template tree and emit a lit-html tagged template literal
 * `html\`<div>...</div>\`` per PATTERNS.md emission table (swap Solid JSX `{}`
 * sigils for Lit `${}` sigils; swap event listeners onto `@event` attributes).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitTemplateResult {
  /** The full `html\`...\`` body emitted inside the class's `render()` method. */
  html: string;
  /** Script-body injection lines (template-event wrap helpers). */
  scriptInjections: string[];
  diagnostics: Diagnostic[];
}

export function emitTemplate(_ir: IRComponent): EmitTemplateResult {
  return { html: '', scriptInjections: [], diagnostics: [] };
}
