/**
 * ReactiveDepGraph — per-IRNode dependency-set lookup.
 *
 * Plan 05 (lowerToIR) consumes this to embed deps onto IR nodes; Phase 4 (React
 * emitter) reads dep sets to populate `useEffect` arrays. Phases 3 (Vue) and 5
 * (Svelte/Angular) also read deps for their respective reactive primitives.
 *
 * @experimental — shape may change before v1.0
 */
import type { SignalRef } from './signalRef.js';

/**
 * Stable string id assigned during semantic analysis / IR lowering.
 *
 * Using a string (rather than `WeakMap<Node>`) keeps deps lookable across
 * deep-clone of the AST (Plan 05 IR lowering may clone subtrees). The id
 * scheme is deterministic — see `buildReactiveDepGraph` for the conventions.
 *
 * @experimental — shape may change before v1.0
 */
export type IRNodeId = string;

/**
 * @experimental — shape may change before v1.0
 */
export interface ReactiveDepGraph {
  /** Returns deps for the given id, throwing if the id was not registered. */
  forNode(id: IRNodeId): readonly SignalRef[];
  /** Returns deps for the given id, or empty array if the id was not registered. */
  forNodeOrEmpty(id: IRNodeId): readonly SignalRef[];
  /** Iterate registered ids (deterministic order — insertion order). */
  nodeIds(): IterableIterator<IRNodeId>;
}

/**
 * Concrete impl backed by Map<IRNodeId, SignalRef[]>. Plan 05 lowerToIR
 * consumes this; Phase 4 React emitter reads dep sets for useEffect arrays.
 *
 * NOTE: `forNode` may throw — that's a programmer-error path (asking for an id
 * that wasn't registered). It is NOT a user-input path; D-08 collected-not-
 * thrown applies to user-input handling, not internal API misuse.
 */
export class ReactiveDepGraphImpl implements ReactiveDepGraph {
  constructor(private readonly map: Map<IRNodeId, SignalRef[]>) {}

  forNode(id: IRNodeId): readonly SignalRef[] {
    const deps = this.map.get(id);
    if (!deps) throw new Error(`No deps registered for IRNodeId ${id}`);
    return deps;
  }

  forNodeOrEmpty(id: IRNodeId): readonly SignalRef[] {
    return this.map.get(id) ?? [];
  }

  nodeIds(): IterableIterator<IRNodeId> {
    return this.map.keys();
  }
}
