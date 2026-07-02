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
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { emitNode, type EmitNodeCtx } from './emitTemplateNode.js';
import type { SvelteScriptInjection } from './emitScript.js';
// Phase 71 (r-keynav) — Svelte target-pair (Plan 71-06), modeled on the
// React/Vue references (see emitKeynav.ts's module doc comment).
import { resolveKeynavPlan, buildKeynavScriptInjections } from './emitKeynav.js';

export interface EmitTemplateResult {
  template: string;
  scriptInjections: SvelteScriptInjection[];
  diagnostics: Diagnostic[];
  /**
   * Phase 15 — runtime-helper import names collected from the template
   * walk. Currently only `'applyListeners'` (D-11 — emitted for every
   * dynamic `r-on="<expr>"` listener spread + the D-19 bare `$listeners`
   * exempt). The SFC shell threads
   * `import { applyListeners } from '@rozie/runtime-svelte';` when this
   * set is non-empty.
   */
  runtimeImports: Set<string>;
}

export function emitTemplate(
  ir: IRComponent,
  registry: ModifierRegistry,
  scopeAttr: string = '',
): EmitTemplateResult {
  const diagnostics: Diagnostic[] = [];
  const scriptInjections: SvelteScriptInjection[] = [];
  const runtimeImports = new Set<string>();

  if (ir.template === null) {
    return {
      template: '<!-- empty template -->',
      scriptInjections,
      diagnostics,
      runtimeImports,
    };
  }

  // Phase 71 (r-keynav) — resolve the per-component keynav emission plan
  // ONCE (mirrors the React/Vue references' identical "resolve once, thread
  // through ctx" discipline). `null` for the overwhelming majority of
  // components (no `r-keynav` root) — every downstream call site
  // short-circuits on `null`, so a non-keynav component's emit is
  // completely untouched (SPEC §11: "no corpus rebless").
  const keynavPlan = resolveKeynavPlan(ir);
  if (keynavPlan !== null) {
    runtimeImports.add('keynav');
    scriptInjections.push(...buildKeynavScriptInjections(keynavPlan));
  }

  const ctx: EmitNodeCtx = {
    ir,
    registry,
    diagnostics,
    scriptInjections,
    injectionCounter: { next: 0 },
    runtimeImports,
    scopeAttr,
    keynav: keynavPlan,
  };

  const template = emitNode(ir.template, ctx);

  return { template, scriptInjections, diagnostics, runtimeImports };
}
