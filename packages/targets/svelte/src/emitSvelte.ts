/**
 * emitSvelte — Phase 5 Plan 02a Task 3.
 *
 * Top-level Svelte 5+ SFC emitter. Mirrors emitVue's coordinator orchestration:
 *
 *   1. emitScript          → { scriptBlock, scriptInjections, diagnostics }
 *   2. emitTemplate        → { template, scriptInjections, diagnostics }
 *   3. emitListeners       → { block, scriptInjections, diagnostics }
 *   4. emitStyle           → { block, diagnostics }
 *   5. mergeScript splices template + listener scriptInjections into the
 *      script body (debounce/throttle IIFE wrappers — `top` BEFORE the
 *      residual section, `bottom` AFTER).
 *   6. buildShell composes the SFC envelope via magic-string.
 *   7. composeSourceMap produces a real SourceMap referencing the .rozie
 *      source (when filename + source provided).
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO `@rozie/runtime-svelte` imports —
 * debounce / throttle / outsideClick all inline as IIFE.
 *
 * Per RESEARCH Pitfall 4: NO `on:event` syntax in emitted output. NO
 * `|preventDefault` modifier shorthand.
 *
 * Public surface (mirrors emitVue / emitReact): `emitSvelte(ir, opts) →
 * { code, map, diagnostics }`.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { SourceMap } from 'magic-string';
import { emitScript, type SvelteScriptInjection } from './emit/emitScript.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
import { emitStyle } from './emit/emitStyle.js';
import { buildShell } from './emit/shell.js';
import { composeSourceMap } from './sourcemap/compose.js';

export interface EmitSvelteOptions {
  filename?: string;
  source?: string;
  modifierRegistry?: ModifierRegistry;
}

export interface EmitSvelteResult {
  code: string;
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

/**
 * Splice scriptInjections (debounce/throttle wrappers) into the script body.
 *
 * `position: 'top'` — splice BEFORE the residual section (so listener IIFE
 * wrappers are declared before the $effect block that attaches them).
 *
 * `position: 'bottom'` — splice AFTER the residual section (so template-event
 * debounce wrappers see the user-declared handler arrow in scope).
 *
 * Plan 02a v1: a simple top/bottom splicer is sufficient — all injections
 * have one of those two positions. Imports aren't part of the script body
 * (Svelte's $effect / $state / $derived runes are compile-time, no imports).
 */
function mergeScriptInjections(
  script: string,
  injections: SvelteScriptInjection[],
): string {
  if (injections.length === 0) return script;

  const topDecls = injections.filter((i) => i.position === 'top').map((i) => i.decl);
  const bottomDecls = injections
    .filter((i) => i.position === 'bottom')
    .map((i) => i.decl);

  const head = topDecls.length > 0 ? topDecls.join('\n\n') + '\n\n' : '';
  const tail = bottomDecls.length > 0 ? '\n\n' + bottomDecls.join('\n\n') : '';

  return head + script + tail;
}

export function emitSvelte(
  ir: IRComponent,
  opts: EmitSvelteOptions = {},
): EmitSvelteResult {
  const registry = opts.modifierRegistry ?? createDefaultRegistry();

  // 1. Script-side emission.
  const { scriptBlock, scriptInjections: scriptOwnInjections, diagnostics: scriptDiags } =
    emitScript(ir);

  // 2. Template-side emission. Returns scriptInjections for any debounce/
  //    throttle wrappers needed by template @event modifiers.
  const {
    template,
    scriptInjections: tmplInjections,
    diagnostics: tmplDiags,
  } = emitTemplate(ir, registry);

  // 3. <listeners>-block emission. Returns its own scriptInjections for
  //    debounce/throttle wrappers needed by Class C listeners.
  const {
    block: listenerBlock,
    scriptInjections: listenerInjections,
    diagnostics: listenerDiags,
  } = emitListeners(ir.listeners, ir, registry);

  // 4. Style-block emission.
  const styleResult = opts.source !== undefined
    ? emitStyle(ir.styles, opts.source)
    : { block: '', diagnostics: [] as Diagnostic[] };

  // 5. Compose the script body: scriptBlock + listenerBlock + injections.
  // Listener $effect blocks are appended AFTER the lifecycle $effect blocks
  // (which are at the end of scriptBlock from emitScript) so listener
  // attachment runs after lifecycle setup.
  const allInjections: SvelteScriptInjection[] = [
    ...scriptOwnInjections,
    ...tmplInjections,
    ...listenerInjections,
  ];

  const scriptWithListeners =
    listenerBlock.length > 0
      ? scriptBlock.trimEnd() + '\n\n' + listenerBlock
      : scriptBlock;

  const finalScript = mergeScriptInjections(scriptWithListeners, allInjections);

  // 6. Compose the SFC envelope via magic-string.
  const ms = buildShell({
    script: finalScript,
    template,
    styleBlock: styleResult.block,
  });

  const code = ms.toString();

  // 7. Source-map composition.
  const map =
    opts.filename !== undefined && opts.source !== undefined
      ? composeSourceMap(ms, { filename: opts.filename, source: opts.source })
      : null;

  return {
    code,
    map,
    diagnostics: [
      ...scriptDiags,
      ...tmplDiags,
      ...listenerDiags,
      ...styleResult.diagnostics,
    ],
  };
}
