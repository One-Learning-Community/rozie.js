/**
 * emitTemplate — Phase 5 Plan 02a Task 2.
 *
 * Top-level template emitter. Walks the IR's TemplateNode tree and produces a
 * Svelte 5-compatible template body string. Returns:
 *
 *   - `template` — the body string (no surrounding wrapper; Svelte's "top-level
 *     markup" is the bare content between `</script>` and `<style>`)
 *   - `scriptInjections` — script-level helper-decl records that emitSvelte
 *     splices into <script> (debounce/throttle wrappers from template
 *     @event modifiers).
 *   - `diagnostics` — collected diagnostics (D-08). For example, ROZ620 when
 *     r-html coexists with template children, ROZ621 when a template @event
 *     modifier returns a 'native' Svelte descriptor (Pitfall 4).
 *
 * Empty template (ir.template === null) returns the literal string
 * `<!-- empty template -->` so the SFC envelope still produces valid surface.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { emitNode, type EmitNodeCtx } from './emitTemplateNode.js';
import type { SvelteScriptInjection } from './emitScript.js';

export interface EmitTemplateResult {
  template: string;
  scriptInjections: SvelteScriptInjection[];
  diagnostics: Diagnostic[];
}

export function emitTemplate(
  ir: IRComponent,
  registry: ModifierRegistry,
): EmitTemplateResult {
  const diagnostics: Diagnostic[] = [];
  const scriptInjections: SvelteScriptInjection[] = [];

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
  };

  const template = emitNode(ir.template, ctx);

  return { template, scriptInjections, diagnostics };
}
