/**
 * emitVue — top-level Vue 3.4+ SFC emitter.
 *
 * Plan 02 wired emitScript. Plan 03 wires emitTemplate alongside, plus the
 * scriptInjection merge logic for non-native modifier wraps (Pattern 5
 * `.debounce` / `.throttle` on template @event lower into a script-level
 * `const wrapped = debounce(orig, ms)` decl + `import { debounce } from
 * '@rozie/runtime-vue'`).
 *
 * Listeners block (Plan 04), styles (Plan 05), and unplugin source-map
 * threading (Plan 06) are still pending — the listeners and style sections
 * remain TODO placeholders and `map` stays null.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitScript } from './emit/emitScript.js';
import { emitTemplate } from './emit/emitTemplate.js';
import type { ScriptInjection } from './emit/emitTemplateEvent.js';

export interface EmitVueOptions {
  filename?: string;
  /**
   * Optional ModifierRegistry — if absent, emitVue constructs a fresh
   * createDefaultRegistry() per call. Tests / unplugin layer may pass a
   * shared registry to avoid the per-call construction cost.
   */
  modifierRegistry?: ModifierRegistry;
}

export interface EmitVueResult {
  code: string;
  map: { sources: string[]; sourcesContent?: string[]; mappings: string } | null;
  diagnostics: Diagnostic[];
}

/**
 * Splice template-side scriptInjections (debounce/throttle wrappers) into the
 * <script setup> body. The scriptInjection contract is: each entry has an
 * import descriptor (deduped here) and a one-line `decl` such as
 * `const debouncedOnSearch = debounce(onSearch, 300);`. The decl is appended
 * after the existing import line(s) and before the rest of the script body.
 *
 * If multiple injections share the same import name, we add it to the import
 * line just once. The runtime-vue import line is INSERTED as a separate line
 * adjacent to the existing `import { ... } from 'vue';` line so the script's
 * canonical-order layout (Pattern 3) is preserved.
 */
function mergeScriptInjections(
  script: string,
  injections: ScriptInjection[],
): string {
  if (injections.length === 0) return script;

  // Dedupe import names per `from`.
  const importsByFrom = new Map<string, Set<string>>();
  const decls: string[] = [];
  for (const inj of injections) {
    const set = importsByFrom.get(inj.import.from) ?? new Set<string>();
    set.add(inj.import.name);
    importsByFrom.set(inj.import.from, set);
    decls.push(inj.decl);
  }

  // Render the runtime-vue import line(s), one per `from`.
  const importLines: string[] = [];
  for (const [from, names] of importsByFrom) {
    const sorted = [...names].sort();
    importLines.push(`import { ${sorted.join(', ')} } from '${from}';`);
  }

  // Splice strategy: find the last `import { ... } from '...';` line (could
  // be the canonical Vue imports or absent altogether). Insert the new
  // import lines immediately after it. If no imports exist, prepend.
  // The decls land at the FIRST safe position above the first non-import
  // section (i.e., after all imports). Simpler: append all imports at the
  // end of the existing import block; append decls right after them.
  //
  // emitScript output starts with sections separated by blank lines; the
  // first section is the import line (if any). We split on blank-line
  // boundaries to get sections, then insert.

  // Detect imports at top of script. Match leading lines that start with
  // 'import' followed by ' { ... } from ...;' on a single line.
  const lines = script.split('\n');
  let lastImportLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith('import ')) {
      lastImportLine = i;
    } else if (trimmed.length === 0 && lastImportLine >= 0) {
      // Continue past blank lines that are still in the import section.
      continue;
    } else if (lastImportLine >= 0) {
      break;
    } else if (trimmed.length > 0) {
      // Non-import non-blank line before any import — break out.
      break;
    }
  }

  // Compose new script. If there were no existing imports (lastImportLine ===
  // -1), prepend new imports + decls to the front.
  if (lastImportLine === -1) {
    return importLines.join('\n') + '\n\n' + decls.join('\n') + '\n\n' + script;
  }

  const head = lines.slice(0, lastImportLine + 1);
  const tail = lines.slice(lastImportLine + 1);
  // Inject new imports right after the last existing import line. Then a
  // blank line, then the decls, then a blank line, then the rest.
  const newSegment = [...importLines, '', ...decls];
  const merged = [...head, ...newSegment, ...tail].join('\n');
  return merged;
}

export function emitVue(ir: IRComponent, opts: EmitVueOptions = {}): EmitVueResult {
  const registry = opts.modifierRegistry ?? createDefaultRegistry();

  const { script, diagnostics: scriptDiags } = emitScript(ir);
  const {
    template,
    scriptInjections,
    diagnostics: tmplDiags,
  } = emitTemplate(ir, registry);

  const enrichedScript = mergeScriptInjections(script, scriptInjections);

  const code =
    '<template>\n' +
    template +
    '\n</template>\n\n' +
    '<script setup lang="ts">\n' +
    enrichedScript +
    '\n</script>\n\n' +
    '<style scoped>\n' +
    '  /* TODO Plan 05 styles */\n' +
    '</style>\n';

  return {
    code,
    map: null,
    diagnostics: [...scriptDiags, ...tmplDiags],
  };
}
