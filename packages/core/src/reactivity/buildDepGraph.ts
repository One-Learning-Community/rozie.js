/**
 * buildReactiveDepGraph — coordinator that visits every reactive expression
 * in a parsed RozieAST and produces a ReactiveDepGraph keyed by stable
 * IRNodeId.
 *
 * IRNodeId scheme (deterministic — Plan 05 IR lowering reuses these ids):
 *   listener.{N}.when      — N is index in ast.listeners.entries
 *   listener.{N}.handler
 *   computed.{name}        — by computed name from BindingsTable
 *   lifecycle.{N}.setup    — N is index in BindingsTable.lifecycle
 *   template.attr.{path}   — `path` is a hierarchical id (e.g., '/div-0/li-0/:disabled')
 *   template.interp.{path}
 *
 * Per D-08 collected-not-thrown: NEVER throws. Parse failures on template-
 * attribute expressions silently produce empty dep sets (the parser layer
 * already emitted the parse diagnostic — ROZ051).
 *
 * Stub for Task 1 — Task 2 lands the full implementation.
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../ast/types.js';
import type { BindingsTable } from '../semantic/types.js';
import type { SignalRef } from './signalRef.js';
import {
  type IRNodeId,
  type ReactiveDepGraph,
  ReactiveDepGraphImpl,
} from './ReactiveDepGraph.js';

/**
 * Stub for Task 1. Returns an empty graph; Task 2 replaces this with the
 * real coordinator that walks listeners, computeds, lifecycle setups, and
 * template attribute bindings + interpolations.
 *
 * @experimental — shape may change before v1.0
 */
export function buildReactiveDepGraph(
  _ast: RozieAST,
  _bindings: BindingsTable,
): ReactiveDepGraph {
  const map = new Map<IRNodeId, SignalRef[]>();
  return new ReactiveDepGraphImpl(map);
}
