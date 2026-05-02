/**
 * emitVue — top-level Vue 3.4+ SFC emitter.
 *
 * Plan 02 wired emitScript. Plan 03 wires emitTemplate alongside, plus the
 * scriptInjection merge logic for non-native modifier wraps (Pattern 5
 * `.debounce` / `.throttle` on template @event lower into a script-level
 * `const wrapped = debounce(orig, ms)` decl + `import { debounce } from
 * '@rozie/runtime-vue'`). Plan 04 (this file) wires emitListeners — the
 * `<listeners>`-block lowering — appending its emitted block code AFTER the
 * lifecycle section but BEFORE the residual script body, and merging its
 * vue + runtime-vue imports into the script's canonical import lines.
 *
 * Styles (Plan 05) and unplugin source-map threading (Plan 06) are still
 * pending — the style section remains a TODO placeholder and `map` stays
 * null.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitScript } from './emit/emitScript.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
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

  // Dedupe import names per `from`. Skip empty-decl injections — these come
  // from emitListeners (Plan 04) which emits its OWN listener-block code
  // separately and only borrows the import-dedupe path.
  const importsByFrom = new Map<string, Set<string>>();
  const decls: string[] = [];
  for (const inj of injections) {
    const set = importsByFrom.get(inj.import.from) ?? new Set<string>();
    set.add(inj.import.name);
    importsByFrom.set(inj.import.from, set);
    if (inj.decl.length > 0) {
      decls.push(inj.decl);
    }
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

/**
 * Splice <listeners>-block emission output into the script. The listener
 * code is emitted by emitListeners after the lifecycle section but before
 * the residual body; in the current single-string emitScript output we
 * append the listener blocks to the end of the script body and let the
 * runtime-vue import lines flow through mergeScriptInjections (which
 * dedupes import lines per `from`).
 *
 * Plan 04 emits Vue imports (e.g., `watchEffect`) into a SEPARATE
 * VueImportCollector. We splice these into the EXISTING `import { ... }
 * from 'vue';` line if one already exists; otherwise we prepend a fresh one.
 */
function mergeVueImportsAndListeners(
  script: string,
  listenerCode: string,
  extraVueNames: readonly string[],
): string {
  // 1. Splice extra Vue imports into the existing `import { ... } from 'vue';` line.
  let merged = script;
  if (extraVueNames.length > 0) {
    const lines = merged.split('\n');
    const vueImportIdx = lines.findIndex((line) =>
      /^import \{ [^}]+ \} from 'vue';$/.test(line.trim()),
    );
    if (vueImportIdx >= 0) {
      // Parse the existing import line, merge the new names, re-render sorted.
      const existing = lines[vueImportIdx]!;
      const match = existing.match(/^import \{ ([^}]+) \} from 'vue';$/);
      if (match && match[1]) {
        const existingNames = new Set(match[1].split(',').map((n) => n.trim()));
        for (const n of extraVueNames) existingNames.add(n);
        const sorted = [...existingNames].sort();
        lines[vueImportIdx] = `import { ${sorted.join(', ')} } from 'vue';`;
        merged = lines.join('\n');
      }
    } else {
      // No existing vue import — prepend one.
      const sorted = [...new Set(extraVueNames)].sort();
      const newImport = `import { ${sorted.join(', ')} } from 'vue';`;
      merged = newImport + '\n\n' + merged;
    }
  }

  // 2. Append the listener block code to the end of the script (before any
  //    residual trailing whitespace).
  if (listenerCode.length > 0) {
    merged = merged.trimEnd() + '\n\n' + listenerCode;
  }

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
  const {
    code: listenerCode,
    vueImports: listenerVueImports,
    runtimeImports: listenerRuntimeImports,
    diagnostics: listenerDiags,
  } = emitListeners(ir.listeners, ir, registry);

  // Convert listenerRuntimeImports into ScriptInjection-shaped records so
  // they flow through the same dedupe path as Plan 03's debounce/throttle
  // template-event injections. Each listener-runtime helper imports from
  // '@rozie/runtime-vue' but has NO decl (the listener's emitted block IS
  // the user-side decl). We synthesize one ScriptInjection per import name
  // with an empty decl placeholder; mergeScriptInjections dedupes on `from`
  // and renders one consolidated import line.
  const listenerImportInjections: ScriptInjection[] = listenerRuntimeImports
    .names()
    .map((name) => ({
      wrapName: name,
      import: { from: '@rozie/runtime-vue', name: name as 'useOutsideClick' | 'debounce' | 'throttle' },
      decl: '', // No decl — emitListeners renders its own block.
    }));

  const allInjections = [...scriptInjections, ...listenerImportInjections];

  // Splice runtime-vue imports first (mergeScriptInjections handles imports
  // + decls).
  let enrichedScript = mergeScriptInjections(script, allInjections);
  // Then splice extra vue imports (e.g., watchEffect) and append listener block.
  const extraVueNames = listenerVueImports.has('watchEffect')
    ? Array.from(['watchEffect']) // currently only watchEffect is added by emitListeners
    : [];
  enrichedScript = mergeVueImportsAndListeners(
    enrichedScript,
    listenerCode,
    extraVueNames,
  );

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
    diagnostics: [...scriptDiags, ...tmplDiags, ...listenerDiags],
  };
}
