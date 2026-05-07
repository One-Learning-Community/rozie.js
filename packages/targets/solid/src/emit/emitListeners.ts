/**
 * emitListeners — Solid target (P2 complete implementation).
 *
 * Lowers `<listeners>`-block entries (`Listener[]` with `source: 'listeners-block'`)
 * into Solid component body code. Four classes:
 *
 *   - A: pure native (no .outside, no debounce/throttle) →
 *     `createEffect(() => { const h = (...) => ...; target.addEventListener(...); onCleanup(...); })`
 *
 *   - B: .outside collapse → `createOutsideClick([() => ref1, ...], handler, () => when)`
 *     NOT wrapped in createEffect — createOutsideClick manages its own lifecycle.
 *
 *   - C: debounced/throttled → `const _wrap = createDebouncedHandler(fn, ms);` near top,
 *     then Class A's createEffect attaches `_wrap`.
 *
 *   - D: pure inlineGuard (no listenerOption flags) → same as A without options object.
 *
 * KEY SOLID DIFFERENCE from React:
 *   - No dep arrays on createEffect (Solid tracks reactivity automatically).
 *   - onCleanup() called INSIDE the createEffect callback (not returned).
 *   - createOutsideClick takes ref ACCESSOR FUNCTIONS: `() => fooRef` — not the ref itself.
 *   - Class C wrapper uses createDebouncedHandler/createThrottledHandler (NOT useDebouncedCallback).
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  Listener,
} from '../../../../core/src/ir/types.js';
import type {
  ModifierRegistry,
  ModifierPipelineEntry,
  ReactEmissionDescriptor,
} from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { emitListenerOutsideClick } from './emitListenerOutsideClick.js';
import { emitListenerNative } from './emitListenerNative.js';
import { emitListenerWrap } from './emitListenerWrap.js';

export interface EmitListenersResult {
  /**
   * createEffect blocks + createOutsideClick calls — placed in function body
   * AFTER user-authored arrows.
   */
  code: string;
  /**
   * Script-body injections — debounce/throttle wrapper consts. Emitted
   * BEFORE the createEffect blocks (so wrappers are in scope).
   */
  scriptInjections: string[];
  diagnostics: Diagnostic[];
}

type ListenerClass =
  | { kind: 'A'; pipeline: ModifierPipelineEntry[] }
  | { kind: 'B'; outsideArgs: ModifierArg[]; pipeline: ModifierPipelineEntry[] }
  | {
      kind: 'C';
      helperName: 'createDebouncedHandler' | 'createThrottledHandler';
      helperArgs: ModifierArg[];
      pipeline: ModifierPipelineEntry[];
    }
  | { kind: 'D'; pipeline: ModifierPipelineEntry[] };

function classifyListener(
  listener: Listener,
  registry: ModifierRegistry,
): ListenerClass {
  const pipeline = listener.modifierPipeline;
  for (const entry of pipeline) {
    if (entry.kind !== 'wrap') continue;
    const impl = registry.get(entry.modifier);
    if (!impl?.react) continue;
    const desc: ReactEmissionDescriptor = impl.react(entry.args, {
      source: 'listeners-block',
      event: listener.event,
      sourceLoc: entry.sourceLoc,
    });
    if (desc.kind !== 'helper') continue;

    // Map React helper names to Solid equivalents.
    if (desc.helperName === 'useOutsideClick') {
      return { kind: 'B', outsideArgs: desc.args, pipeline };
    }
    if (desc.helperName === 'useDebouncedCallback') {
      return {
        kind: 'C',
        helperName: 'createDebouncedHandler',
        helperArgs: desc.args,
        pipeline,
      };
    }
    if (desc.helperName === 'useThrottledCallback') {
      return {
        kind: 'C',
        helperName: 'createThrottledHandler',
        helperArgs: desc.args,
        pipeline,
      };
    }
  }
  const hasNative = pipeline.some((e) => e.kind === 'listenerOption');
  return hasNative
    ? { kind: 'A', pipeline }
    : { kind: 'D', pipeline };
}

/**
 * Render all `<listeners>`-block entries into Solid createEffect / createOutsideClick code.
 *
 * Filters OUT template-event listeners (source: 'template-event').
 */
export function emitListeners(
  ir: IRComponent,
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector },
  registry: ModifierRegistry,
): EmitListenersResult {
  const diagnostics: Diagnostic[] = [];
  const codeChunks: string[] = [];
  const scriptInjections: string[] = [];
  const wrapCounter = { next: 0 };

  const blockListeners = ir.listeners.filter((l) => l.source === 'listeners-block');
  if (blockListeners.length === 0) {
    return { code: '', scriptInjections, diagnostics };
  }

  for (const listener of blockListeners) {
    const cls = classifyListener(listener, registry);
    switch (cls.kind) {
      case 'A':
      case 'D': {
        const result = emitListenerNative(listener, ir, collectors, registry);
        diagnostics.push(...result.diagnostics);
        codeChunks.push(result.code);
        break;
      }
      case 'B': {
        const result = emitListenerOutsideClick(listener, cls.outsideArgs, ir, collectors);
        diagnostics.push(...result.diagnostics);
        if (result.code.length > 0) codeChunks.push(result.code);
        break;
      }
      case 'C': {
        const result = emitListenerWrap(
          listener,
          cls.helperName,
          cls.helperArgs,
          ir,
          collectors,
          registry,
          wrapCounter,
        );
        diagnostics.push(...result.diagnostics);
        scriptInjections.push(result.scriptInjection);
        codeChunks.push(result.createEffectCode);
        break;
      }
    }
  }

  return {
    code: codeChunks.join('\n\n'),
    scriptInjections,
    diagnostics,
  };
}
