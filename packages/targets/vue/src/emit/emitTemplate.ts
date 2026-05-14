/**
 * emitTemplate — Phase 3 Plan 03 Task 1.
 *
 * Top-level template emitter. Walks the IR's TemplateNode tree and produces
 * a Vue 3.4-compatible <template> body string. Returns:
 *
 *   - `template` — the body string (without the surrounding <template>...</template>)
 *   - `scriptInjections` — script-level helper-decl/import records that emitVue
 *     splices into <script setup> (RESEARCH.md Pattern 5 — .debounce/.throttle
 *     on template @event)
 *   - `diagnostics` — collected diagnostics (D-08 collected-not-thrown). For
 *     example, ROZ420 raised when an .outside modifier is encountered on a
 *     template @event (D-40 listenerOnly violation).
 *
 * Empty template (ir.template === null) returns the literal string
 * `<!-- empty template -->` so emitVue's wrapper SFC still produces valid
 * surface text.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { emitNode, type EmitNodeCtx } from './emitTemplateNode.js';
import type { ScriptInjection } from './emitTemplateEvent.js';

export interface EmitTemplateResult {
  template: string;
  scriptInjections: ScriptInjection[];
  diagnostics: Diagnostic[];
}

export function emitTemplate(
  ir: IRComponent,
  registry: ModifierRegistry,
): EmitTemplateResult {
  const diagnostics: Diagnostic[] = [];
  const scriptInjections: ScriptInjection[] = [];

  if (ir.template === null) {
    return {
      template: '<!-- empty template -->',
      scriptInjections,
      diagnostics,
    };
  }

  const ctx: EmitNodeCtx = {
    ir,
    registry,
    diagnostics,
    scriptInjections,
    injectionCounter: { next: 0 },
    indent: '',
  };

  const template = emitNode(ir.template, ctx);

  return { template, scriptInjections, diagnostics };
}
