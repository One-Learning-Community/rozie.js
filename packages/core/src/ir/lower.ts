/**
 * lowerToIR — public coordinator (Plan 02-05 Task 2 lands the real implementation).
 *
 * Plan 02-05 Task 1 ships this as a stub so packages/core/src/index.ts can
 * re-export the symbol and the type-level surface compiles cleanly. Task 2
 * replaces the throw with the real lowering pipeline.
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { ReactiveDepGraph } from '../reactivity/ReactiveDepGraph.js';
import type { ModifierRegistry } from '../modifiers/ModifierRegistry.js';
import type { BindingsTable } from '../semantic/types.js';
import type { IRComponent } from './types.js';

/**
 * @experimental — shape may change before v1.0
 */
export interface LowerOptions {
  modifierRegistry: ModifierRegistry;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface LowerResult {
  ir: IRComponent | null;
  diagnostics: Diagnostic[];
  depGraph: ReactiveDepGraph;
  bindings: BindingsTable;
}

/**
 * Lower a parsed RozieAST into the framework-neutral RozieIR.
 *
 * D-08 collected-not-thrown: never throws on user input. Internal-API misuse
 * (e.g., `opts.modifierRegistry === undefined`) MAY throw with a clear error.
 *
 * @experimental — shape may change before v1.0
 */
export function lowerToIR(_ast: RozieAST, _opts: LowerOptions): LowerResult {
  // STUB — Plan 02-05 Task 2 lands the real implementation.
  throw new Error('lowerToIR not yet implemented — Plan 02-05 Task 2 lands this');
}
