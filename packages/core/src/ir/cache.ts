/**
 * IRCache — Phase 07.2 Plan 01 Task 3 (D-01).
 *
 * Per-compiler-instance `Map<resolvedPath, IRComponent>` with synchronous lazy
 * fill + cycle detection + reverse-dep tracking.
 *
 * When a consumer references a producer via `<components>`, the lowerer looks
 * up the producer by resolved importPath. On cache miss → synchronously
 * read+parse+lower the producer, cache the result, then read its `SlotDecl[]`.
 *
 * Cycle detection uses a visited-set during recursive lookup. Reverse-dep
 * tracking (D-11) enables precise HMR invalidation in unplugin — when a
 * producer changes, `invalidate(producerPath)` returns the transitive set of
 * all consumers that touched it.
 *
 * Per-compiler-instance — each entrypoint (CLI / unplugin / babel-plugin /
 * Vite-runtime) constructs its own `IRCache` per compile-session. Output is a
 * pure function of `(consumerSource, producerSource)`, not of cache-fill
 * order (RESEARCH Pitfall 2 — cache iteration order MUST NEVER drive output).
 *
 * Source-map contract (RESEARCH Pitfall 3): producer `SlotDecl.sourceLoc`
 * values are informational only — consumer-side `SlotFillerDecl.sourceLoc` is
 * always computed from the consumer's own source. The cache reads producer
 * source via `readFileSync` and parses it; the resulting `sourceLoc` offsets
 * are valid only relative to that producer file (not the consumer).
 * `threadParamTypes` consumes only `SlotDecl.paramTypes` (a `TSType[]`),
 * never `SlotDecl.sourceLoc`, so cross-file sourcemap composition is
 * deliberately out of scope for this phase.
 *
 * @experimental — shape may change before v1.0
 */
import { readFileSync } from 'node:fs';
import type { IRComponent } from './types.js';
import type { ModifierRegistry } from '../modifiers/ModifierRegistry.js';
import { parse } from '../parse.js';
import { lowerToIR } from './lower.js';

/**
 * Options for `IRCache`.
 */
export interface IRCacheOptions {
  /**
   * Per-instance modifier registry — MUST be the same instance used for the
   * parent compile, or the producer's modifier resolution would diverge from
   * the consumer's, breaking parity. Pass `opts.modifierRegistry` from the
   * outer `compile()` call.
   */
  modifierRegistry: ModifierRegistry;
}

/**
 * Per-compiler-instance IR cache + reverse-dep index.
 */
export class IRCache {
  private readonly store = new Map<string, IRComponent>();
  /** D-11 reverse-dep: producerPath → Set of consumerPaths that touched it. */
  private readonly reverseDeps = new Map<string, Set<string>>();
  /** Cycle detection during recursive lookup. */
  private readonly visiting = new Set<string>();

  constructor(private readonly opts: IRCacheOptions) {}

  /**
   * Resolve a producer `.rozie` path to its `IRComponent`. Lazy: reads + parses
   * + lowers on first request, then caches. Cycle-safe: if `resolvedPath` is
   * currently in the recursive lookup chain, returns `null` (consumer lowerer
   * treats this as "producer unavailable — type-flow degrades gracefully").
   *
   * `consumerPath` is recorded as a reverse-dep edge for D-11 HMR
   * invalidation — even on cache hit, so every consumer that ever asked is
   * tracked. Self-edges (`consumerPath === resolvedPath`) are skipped to
   * avoid spurious "self-invalidation" on HMR.
   */
  getIRComponent(resolvedPath: string, consumerPath: string): IRComponent | null {
    // Record reverse-dep edge first — both for cache hits and misses, so the
    // D-11 invalidation set is complete.
    if (consumerPath !== resolvedPath) {
      let consumers = this.reverseDeps.get(resolvedPath);
      if (!consumers) {
        consumers = new Set();
        this.reverseDeps.set(resolvedPath, consumers);
      }
      consumers.add(consumerPath);
    }

    const cached = this.store.get(resolvedPath);
    if (cached !== undefined) return cached;

    // Cycle — return null; consumer lowerer falls back to "no type-flow".
    if (this.visiting.has(resolvedPath)) return null;

    this.visiting.add(resolvedPath);
    try {
      let source: string;
      try {
        source = readFileSync(resolvedPath, 'utf8');
      } catch {
        return null;
      }
      const { ast, diagnostics: parseDiags } = parse(source, {
        filename: resolvedPath,
      });
      if (!ast || parseDiags.some((d) => d.severity === 'error')) return null;
      const { ir } = lowerToIR(ast, {
        modifierRegistry: this.opts.modifierRegistry,
      });
      if (!ir) return null;
      this.store.set(resolvedPath, ir);
      return ir;
    } catch {
      // Defensive — parse/lower are collected-not-thrown internally, but guard
      // any unexpected runtime surface.
      return null;
    } finally {
      this.visiting.delete(resolvedPath);
    }
  }

  /**
   * D-11 — Invalidate one producer and walk the transitive consumer set.
   * Returns the union of all affected paths (the producer itself plus every
   * consumer that touched it, recursively). Cache entries for every path in
   * the returned set are deleted; reverse-dep edges are pruned.
   *
   * Unplugin's `handleHotUpdate` calls this when a `.rozie` file changes; the
   * returned set drives Vite's module-graph invalidation so only the relevant
   * subset of the graph re-walks.
   */
  invalidate(changedPath: string): Set<string> {
    const affected = new Set<string>();
    const queue: string[] = [changedPath];
    while (queue.length > 0) {
      const path = queue.shift() as string;
      if (affected.has(path)) continue;
      affected.add(path);
      this.store.delete(path);
      const consumers = this.reverseDeps.get(path);
      if (consumers) {
        for (const c of consumers) queue.push(c);
      }
      this.reverseDeps.delete(path);
    }
    return affected;
  }

  /**
   * Test/diagnostic helper: peek at the cached entry for `resolvedPath`
   * without recording a reverse-dep edge or triggering a fill.
   */
  peek(resolvedPath: string): IRComponent | null {
    return this.store.get(resolvedPath) ?? null;
  }

  /**
   * Test/diagnostic helper: read the reverse-dep edge set for `producerPath`.
   * Returns a fresh `Set` copy so callers can't mutate the internal index.
   */
  getReverseDeps(producerPath: string): Set<string> {
    const deps = this.reverseDeps.get(producerPath);
    return new Set(deps ?? []);
  }
}
