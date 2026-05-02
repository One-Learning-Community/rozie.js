/**
 * emitVue — top-level Vue 3.4+ SFC emitter.
 *
 * Plan 02 wired emitScript. Plan 03 wires emitTemplate alongside, plus the
 * scriptInjection merge logic for non-native modifier wraps (Pattern 5
 * `.debounce` / `.throttle` on template @event lower into a script-level
 * `const wrapped = debounce(orig, ms)` decl + `import { debounce } from
 * '@rozie/runtime-vue'`). Plan 04 wires emitListeners — the
 * `<listeners>`-block lowering — appending its emitted block code AFTER the
 * lifecycle section but BEFORE the residual script body, and merging its
 * vue + runtime-vue imports into the script's canonical import lines.
 *
 * Plan 05 (this file) finalizes the SFC envelope:
 *   - emitStyle re-stringifies the IR's StyleSection (Phase 1's `:root`
 *     extraction is preserved) — replaces the Plan 02-04 placeholder.
 *   - shell.ts composes the SFC envelope via `magic-string.MagicString` so
 *     `composeSourceMap` can produce a real `SourceMap` referencing the
 *     `.rozie` source (Pitfall 2 / DX-01).
 *   - When `opts.filename` and `opts.source` are provided, emitVue returns
 *     a real SourceMap; otherwise (back-compat with Plan 02-04 callers) it
 *     returns null — Plan 06 unplugin will always pass both.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { SourceMap } from 'magic-string';
import { emitScript } from './emit/emitScript.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
import { emitStyle } from './emit/emitStyle.js';
import { buildShell } from './emit/shell.js';
import { composeSourceMap } from './sourcemap/compose.js';
import type { ScriptInjection } from './emit/emitTemplateEvent.js';

export interface EmitVueOptions {
  /**
   * Absolute or relative path to the .rozie source — when provided alongside
   * `source`, emitVue returns a real source map referencing this filename.
   * Required for emitStyle to slice rule bodies from the original CSS source
   * (per Wave 0 finding: StyleSection carries StyleRule.loc but not cssText).
   * If omitted, emitStyle still runs but returns empty scoped/global; map=null.
   */
  filename?: string;
  /**
   * Original .rozie source text — required by emitStyle to slice rule bodies
   * by absolute byte offsets, and by composeSourceMap for sourcesContent.
   * If omitted, the style section is empty (no scoped or global block).
   */
  source?: string;
  /**
   * Optional ModifierRegistry — if absent, emitVue constructs a fresh
   * createDefaultRegistry() per call. Tests / unplugin layer may pass a
   * shared registry to avoid the per-call construction cost.
   */
  modifierRegistry?: ModifierRegistry;
}

export interface EmitVueResult {
  code: string;
  /** Real SourceMap when filename+source provided, otherwise null. */
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

/**
 * Splice template-side scriptInjections (debounce/throttle wrappers) into the
 * <script setup> body. The scriptInjection contract is: each entry has an
 * import descriptor (deduped here) and a one-line `decl` such as
 * `const debouncedOnSearch = debounce(onSearch, 300);`.
 *
 * Placement:
 *   - Imports go with the other imports at the top.
 *   - Decls go at the BOTTOM of the script — they reference helper functions
 *     declared in the residual body (e.g. `const onSearch = ...`), so wrapping
 *     them earlier produces a TDZ error (`Cannot access 'onSearch' before
 *     initialization`).
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

  const declTail = decls.length > 0 ? '\n\n' + decls.join('\n') : '';

  // No existing imports: prepend new imports, append decls to the bottom.
  if (lastImportLine === -1) {
    return importLines.join('\n') + '\n\n' + script + declTail;
  }

  // Splice imports in with the existing ones; decls go at the bottom of the
  // script body so they observe all helper-function decls in the residual body.
  const head = lines.slice(0, lastImportLine + 1);
  const tail = lines.slice(lastImportLine + 1);
  const merged = [...head, ...importLines, ...tail].join('\n') + declTail;
  return merged;
}

/**
 * Splice <listeners>-block emission output into the script. The listener
 * code is emitted by emitListeners after the lifecycle section but before
 * the residual body; in the current single-string emitScript output we
 * append the listener blocks to the end of the script body and let the
 * runtime-vue import lines flow through mergeScriptInjections.
 */
function mergeVueImportsAndListeners(
  script: string,
  listenerCode: string,
  extraVueNames: readonly string[],
): string {
  // 1. Splice extra Vue imports into any existing `import { ... } from 'vue'` lines.
  // Collects ALL lines that import from 'vue' (handles multi-line imports and
  // duplicate import lines that emitScript or babel/generator may produce),
  // merges the names, emits a single canonical line, and removes the originals.
  let merged = script;
  if (extraVueNames.length > 0) {
    const lines = merged.split('\n');
    const collectedNames = new Set<string>(extraVueNames);
    const vueImportIndices: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      // Match both single-line `import { ... } from 'vue';` and
      // multi-line forms that start with `import {` and end with `} from 'vue';`
      // on the same line (most common case from @babel/generator).
      if (/from ['"]vue['"]/.test(trimmed)) {
        vueImportIndices.push(i);
        // Extract names: grab everything between `{` and `}` on this line.
        const match = trimmed.match(/\{([^}]+)\}/);
        if (match && match[1]) {
          for (const n of match[1].split(',').map((s) => s.trim()).filter(Boolean)) {
            collectedNames.add(n);
          }
        }
      }
    }

    if (vueImportIndices.length > 0) {
      // Replace the FIRST matched line with the merged import; blank out the rest.
      const sorted = [...collectedNames].sort();
      lines[vueImportIndices[0]!] = `import { ${sorted.join(', ')} } from 'vue';`;
      for (let k = 1; k < vueImportIndices.length; k++) {
        lines[vueImportIndices[k]!] = '';
      }
      merged = lines.join('\n');
    } else {
      // No existing Vue import — prepend a new one.
      const sorted = [...collectedNames].sort();
      merged = `import { ${sorted.join(', ')} } from 'vue';\n\n` + merged;
    }
  }

  // 2. Append the listener block code to the end of the script.
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
  // template-event injections.
  const listenerImportInjections: ScriptInjection[] = listenerRuntimeImports
    .names()
    .map((name) => ({
      wrapName: name,
      import: { from: '@rozie/runtime-vue', name: name as 'useOutsideClick' | 'debounce' | 'throttle' },
      decl: '', // No decl — emitListeners renders its own block.
    }));

  const allInjections = [...scriptInjections, ...listenerImportInjections];

  let enrichedScript = mergeScriptInjections(script, allInjections);
  const extraVueNames = listenerVueImports.has('watchEffect')
    ? Array.from(['watchEffect'])
    : [];
  enrichedScript = mergeVueImportsAndListeners(
    enrichedScript,
    listenerCode,
    extraVueNames,
  );

  // Plan 05 — emit styles. emitStyle requires the original .rozie source
  // (Wave 0 finding: StyleSection has StyleRule.loc but no cssText). When
  // opts.source is missing, skip the style emission entirely so the SFC
  // shell has no `<style>` blocks (back-compat with Plan 02-04 callers that
  // never invoked emitStyle).
  const styleResult = opts.source !== undefined
    ? emitStyle(ir.styles, opts.source)
    : { scoped: '', global: null as string | null, diagnostics: [] };
  const styleScoped = styleResult.scoped;
  const styleGlobal = styleResult.global;
  const styleDiags = styleResult.diagnostics;

  // Plan 05 — compose the SFC envelope via magic-string for source-map plumbing.
  const ms = buildShell({
    template,
    script: enrichedScript,
    styleScoped,
    styleGlobal,
  });

  const code = ms.toString();

  // Plan 05 — produce a real source map when filename + source are provided.
  // Pitfall 2 mitigation in composeSourceMap.
  const map =
    opts.filename !== undefined && opts.source !== undefined
      ? composeSourceMap(ms, { filename: opts.filename, source: opts.source })
      : null;

  return {
    code,
    map,
    diagnostics: [...scriptDiags, ...tmplDiags, ...listenerDiags, ...styleDiags],
  };
}
