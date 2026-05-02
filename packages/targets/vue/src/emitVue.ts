/**
 * emitVue — top-level Vue 3.4+ SFC emitter (Phase 3 Plan 02 Task 2 stub).
 *
 * This is the public entrypoint @rozie/target-vue exports. Plan 02 implements
 * the script-side body only — template (Plan 03), listeners (Plan 04), and
 * styles (Plan 05) populate as they land. Plan 06 wires the magic-string SFC
 * shell composition with real source maps.
 *
 * Plan 02 returns:
 *   - `code` — provisional SFC text with TODO comments for template/style.
 *   - `map` — null (Plan 06 replaces with magic-string output).
 *   - `diagnostics` — collected from emitScript (Pitfall 4 collisions, etc.).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import { emitScript } from './emit/emitScript.js';

export interface EmitVueOptions {
  filename?: string;
}

export interface EmitVueResult {
  code: string;
  map: { sources: string[]; sourcesContent?: string[]; mappings: string } | null;
  diagnostics: Diagnostic[];
}

export function emitVue(ir: IRComponent, _opts: EmitVueOptions = {}): EmitVueResult {
  const { script, diagnostics } = emitScript(ir);

  const code =
    '<template>\n' +
    '  <!-- TODO Plan 03 templates -->\n' +
    '</template>\n\n' +
    '<script setup lang="ts">\n' +
    script +
    '\n</script>\n\n' +
    '<style scoped>\n' +
    '  /* TODO Plan 05 styles */\n' +
    '</style>\n';

  return { code, map: null, diagnostics };
}
