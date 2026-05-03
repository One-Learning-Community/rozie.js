/**
 * lowerListeners — convert ListenersAST entries to Listener[] IR nodes.
 *
 * Plan 02-05 Task 2.
 *
 * For each ListenerEntry:
 *   - Decode `target` from entry.target ('document'/'window' → global; '$el' →
 *     self; '$refs.x' → ref).
 *   - Resolve modifierPipeline by calling ModifierRegistry.get(name).resolve(args, ctx)
 *     for each chain entry. D-20 invariant: lowerTemplate makes the SAME call.
 *   - Extract `when` (re-parse string-literal contents) and `handler` from
 *     the RHS ObjectExpression.
 *   - Attach `deps` from depGraph (listener.{N}.handler).
 *
 * Per D-08 collected-not-thrown: never throws. Modifier resolution failures
 * push diagnostics; missing modifiers emit ROZ110.
 *
 * @experimental — shape may change before v1.0
 */
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import type { ListenersAST, ListenerEntry } from '../../ast/blocks/ListenersAST.js';
import type { BindingsTable } from '../../semantic/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { ReactiveDepGraph } from '../../reactivity/ReactiveDepGraph.js';
import type {
  ModifierRegistry,
  ModifierContext,
  ModifierPipelineEntry,
} from '../../modifiers/ModifierRegistry.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { Listener, ListenerTarget } from '../types.js';

function decodeTarget(targetText: string): ListenerTarget {
  if (targetText === 'document' || targetText === 'window') {
    return { kind: 'global', name: targetText };
  }
  if (targetText === '$el') {
    return { kind: 'self', el: '$el' };
  }
  // $refs.foo target form — strip prefix and produce ref kind.
  if (targetText.startsWith('$refs.')) {
    return { kind: 'ref', refName: targetText.slice('$refs.'.length) };
  }
  // Default: bind on $el (self).
  return { kind: 'self', el: '$el' };
}

/**
 * Resolve a single ListenerEntry's modifierChain[] into a flat
 * ModifierPipelineEntry[] by calling registry.get(name).resolve(args, ctx) for
 * each chain entry. Diagnostics are aggregated.
 *
 * Exported so lowerTemplate can call THIS exact helper to satisfy D-20
 * byte-identical pipeline guarantee.
 */
export function resolveModifierPipeline(
  chain: ReadonlyArray<{
    name: string;
    args: ReadonlyArray<{ kind: string; loc: { start: number; end: number } }>;
    loc: { start: number; end: number };
  }>,
  ctx: ModifierContext,
  registry: ModifierRegistry,
  diagnostics: Diagnostic[],
): ModifierPipelineEntry[] {
  const out: ModifierPipelineEntry[] = [];
  for (const c of chain) {
    const impl = registry.get(c.name);
    if (!impl) {
      diagnostics.push({
        code: RozieErrorCode.UNKNOWN_MODIFIER,
        severity: 'error',
        message: `Unknown modifier '.${c.name}' — not registered in ModifierRegistry`,
        loc: c.loc,
        hint: 'Check the spelling, or register a custom modifier via registerModifier(registry, name, impl).',
      });
      continue;
    }
    // Adjust ctx so each chain entry's sourceLoc anchors the pipeline entry.
    const entryCtx: ModifierContext = {
      source: ctx.source,
      event: ctx.event,
      sourceLoc: c.loc,
    };
    // The cast is safe — chain.args is ModifierArg[] from the modifier-grammar
    // module; we declared the helper's parameter type structurally to keep this
    // file independent of parseModifierChain's internal types.
    const result = impl.resolve(c.args as never, entryCtx);
    out.push(...result.entries);
    diagnostics.push(...result.diagnostics);
  }
  return out;
}

/**
 * Find a named property (`when` / `handler`) in a ListenerEntry's RHS object
 * and return its Expression value, or null. For `when`, the literal value is
 * itself a JS expression in a StringLiteral — re-parse it.
 */
function extractObjectPropertyExpression(
  entry: ListenerEntry,
  key: string,
): t.Expression | null {
  const obj = entry.value;
  if (!t.isObjectExpression(obj)) return null;
  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const propKey = prop.key;
    const keyName =
      t.isIdentifier(propKey) ? propKey.name :
      t.isStringLiteral(propKey) ? propKey.value :
      null;
    if (keyName !== key) continue;

    const value = prop.value;
    if (t.isStringLiteral(value)) {
      try {
        return parseExpression(value.value, { sourceType: 'module' });
      } catch {
        return null;
      }
    }
    if (t.isExpression(value)) return value;
  }
  return null;
}

export function lowerListeners(
  listenersAst: ListenersAST,
  _bindings: BindingsTable,
  depGraph: ReactiveDepGraph,
  registry: ModifierRegistry,
  diagnostics: Diagnostic[],
): Listener[] {
  const out: Listener[] = [];
  listenersAst.entries.forEach((entry, idx) => {
    const target = decodeTarget(entry.target);
    const ctx: ModifierContext = {
      source: 'listeners-block',
      event: entry.event,
      sourceLoc: { start: entry.modifierChainBaseOffset, end: entry.modifierChainBaseOffset },
    };
    const modifierPipeline = resolveModifierPipeline(
      entry.chain,
      ctx,
      registry,
      diagnostics,
    );

    const whenExpr = extractObjectPropertyExpression(entry, 'when');
    const handlerExpr = extractObjectPropertyExpression(entry, 'handler');

    // If handler is missing, emit a missing-handler skip-friendly default; the
    // parser already rejected truly malformed listener entries (ROZ013).
    const handler = handlerExpr ?? t.identifier('undefined');

    // Plan 04-04 Rule 2 (Bug fix): merge `when` deps into `Listener.deps`.
    // Phase 2's buildDepGraph already computes `listener.{idx}.when` deps but
    // lowerListeners previously only consumed the handler set. The React
    // emitter needs the union — both `when` and the handler appear inside the
    // useEffect closure, so exhaustive-deps requires both sets in deps[].
    // De-dupe via a Set of stringified SignalRefs (preserves the first
    // occurrence of structurally identical deps).
    const handlerDeps = [...depGraph.forNodeOrEmpty(`listener.${idx}.handler`)];
    const whenDeps = [...depGraph.forNodeOrEmpty(`listener.${idx}.when`)];
    const seen = new Set<string>();
    const deps = [];
    for (const d of [...whenDeps, ...handlerDeps]) {
      const key = JSON.stringify(d);
      if (seen.has(key)) continue;
      seen.add(key);
      deps.push(d);
    }

    out.push({
      type: 'Listener',
      target,
      event: entry.event,
      modifierPipeline,
      when: whenExpr,
      handler,
      deps,
      source: 'listeners-block',
      sourceLoc: entry.loc,
    });
  });
  return out;
}
