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
import { buildKeynavScriptInjections, resolveKeynavPlan } from './emitKeynav.js';

export interface EmitTemplateResult {
  template: string;
  scriptInjections: ScriptInjection[];
  diagnostics: Diagnostic[];
  /**
   * Phase 71 (r-keynav) — extra `'vue'` import names required by this
   * template's script injections (currently only `'ref'`, when keynav
   * mints a fresh root ref). MUST be routed through `mergeVueImportsAndListeners`'s
   * existing collapse-into-one-line merge (emitVue.ts), NOT re-emitted as a
   * second literal `import { ref } from 'vue';` statement — a component
   * that ALSO has `<data>`/template refs already imports `ref` via
   * emitScript.ts's own collector, and TWO `import { ref } from 'vue'`
   * statements naming the same binding is a TS2300 duplicate-identifier
   * error. Empty array for every non-keynav component (byte-identical,
   * SPEC §11).
   */
  extraVueImportNames: string[];
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
      extraVueImportNames: [],
    };
  }

  // Phase 71 (r-keynav) — resolved ONCE per component (not per element; see
  // emitKeynav.ts's module doc comment). `null` for the overwhelming
  // majority of components (no r-keynav root) — every downstream keynav
  // call site short-circuits on `null`, so this stays a cheap no-op for
  // every existing fixture (SPEC §11: "no corpus rebless").
  const keynav = resolveKeynavPlan(ir);

  const ctx: EmitNodeCtx = {
    ir,
    registry,
    diagnostics,
    scriptInjections,
    injectionCounter: { next: 0 },
    indent: '',
    keynav,
  };

  const template = emitNode(ir.template, ctx);

  const extraVueImportNames: string[] = [];
  if (keynav !== null) {
    scriptInjections.push(...buildKeynavScriptInjections(keynav, ir));
    if (keynav.mintedRootRef) {
      extraVueImportNames.push('ref');
    }
  }

  return { template, scriptInjections, diagnostics, extraVueImportNames };
}
