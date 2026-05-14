/**
 * emitListeners — Plan 04-04 Task 2 orchestrator.
 *
 * Lowers `<listeners>`-block entries (`Listener[]` with `source: 'listeners-block'`)
 * into React function-body code. Per RESEARCH Pattern 10 + CONTEXT D-61 + D-65,
 * four classes are produced:
 *
 *   - **A: pure native** — listenerOption flags + filter inlineGuards →
 *     single `useEffect((onCleanup) => { addEventListener; return removeListener; }, [...deps])`
 *
 *   - **B: outside collapse** (D-65 / D-42 React analog) — `wrap` outside →
 *     `useOutsideClick([refs], handler, () => when);` no useEffect at site
 *
 *   - **C: debounce/throttle wrap** — `wrap` debounce/throttle → wrapper at
 *     script-body level via `useDebouncedCallback`/`useThrottledCallback`,
 *     then attached via Class A's useEffect block referencing the wrapper
 *
 *   - **D: pure inlineGuard, no native** — only filter modifiers, no
 *     listenerOptions → same as Class A but no options-object on
 *     addEventListener
 *
 * **Marquee technical claim** (REACT-T-02 / D-61): `Listener.deps` from
 * Phase 2's `ReactiveDepGraph` spreads DIRECTLY into the useEffect deps[]
 * arrays — verified by `eslint-plugin-react-hooks/exhaustive-deps` lint
 * passing on every emitted fixture WITH NO compiler-emitted eslint-disable
 * (D-62 floor).
 *
 * Refs are EXCLUDED from `Listener.deps` at the SignalRef level (D-21b lock).
 *
 * Per D-08 collected-not-thrown: never throws; pushes diagnostics.
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
} from '@rozie/core';
import type { ModifierArg } from '../../../../core/src/modifier-grammar/parseModifierChain.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { emitListenerOutsideClick } from './emitListenerOutsideClick.js';
import { emitListenerNative } from './emitListenerNative.js';
import { emitListenerWrap } from './emitListenerWrap.js';

export interface EmitListenersResult {
  /**
   * useEffect blocks + useOutsideClick calls — placed in function body
   * AFTER user-authored arrows (so wrapper consts can reference handlers
   * like `reposition` declared in userArrowsSection).
   */
  code: string;
  /**
   * Script-body injections — debounce/throttle wrapper consts. Emitted
   * BEFORE `code` (and after user arrows) so wrappers are in scope when
   * the useEffect attaches them.
   */
  scriptInjections: string[];
  diagnostics: Diagnostic[];
}

/**
 * Classify a listener's pipeline so the orchestrator routes to the right
 * sub-emitter. Per Plan 04-04 4-class map.
 */
type ListenerClass =
  | { kind: 'A'; pipeline: ModifierPipelineEntry[] }
  | { kind: 'B'; outsideArgs: ModifierArg[]; pipeline: ModifierPipelineEntry[] }
  | {
      kind: 'C';
      helperName: 'useDebouncedCallback' | 'useThrottledCallback';
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
    if (desc.helperName === 'useOutsideClick') {
      return { kind: 'B', outsideArgs: desc.args, pipeline };
    }
    if (desc.helperName === 'useDebouncedCallback' || desc.helperName === 'useThrottledCallback') {
      return {
        kind: 'C',
        helperName: desc.helperName,
        helperArgs: desc.args,
        pipeline,
      };
    }
  }
  // No wrap-helper → Class A or D depending on whether listenerOption present.
  const hasNative = pipeline.some((e) => e.kind === 'listenerOption');
  return hasNative
    ? { kind: 'A', pipeline }
    : { kind: 'D', pipeline };
}

/**
 * Render all `<listeners>`-block entries from `ir.listeners` into React code.
 *
 * Filters OUT template-event listeners (those have `source: 'template-event'`
 * and are owned by emitTemplateEvent, called from emitTemplateNode).
 *
 * Output ordering: Class B (outside) calls and Class A/D useEffects appear
 * in source order (matches user expectations); Class C wrapper consts are
 * collected in `scriptInjections` and placed AFTER user arrows by shell.ts.
 */
export function emitListeners(
  ir: IRComponent,
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector },
  registry: ModifierRegistry,
): EmitListenersResult {
  const diagnostics: Diagnostic[] = [];
  const codeChunks: string[] = [];
  const scriptInjections: string[] = [];
  const wrapCounter = { next: 0 };

  // Filter to <listeners>-block entries only.
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
        codeChunks.push(result.useEffectCode);
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
