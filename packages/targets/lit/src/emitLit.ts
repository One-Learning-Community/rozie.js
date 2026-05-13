/**
 * @rozie/target-lit — top-level emitter orchestrator.
 *
 * Plan 06.4-01 P1 stub: returns `{ code: 'export default class STUB {}\n',
 * map: null, diagnostics: [] }` for any input. Sufficient for the "non-empty
 * .ts string for all 8 reference examples" P1 success bar; per-example
 * fixture lock + real class emission happens in Plan 06.4-02 (P2).
 *
 * Public shape mirrors `emitSolid` (single output channel, no CSS sidecar —
 * Lit's `static styles = css\`...\`` keeps styles inside the class body).
 *
 * Mirrors emitSolid.ts module-for-module — P2 replaces the stub body with
 * the orchestration loop documented in PATTERNS.md §"packages/targets/lit/src/emitLit.ts".
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import type { BlockMap } from '../../../core/src/ast/types.js';
import type { SourceMap } from 'magic-string';

export interface EmitLitOptions {
  filename?: string;
  source?: string;
  modifierRegistry?: ModifierRegistry;
  /**
   * Phase 06.1 Plan 01 (DX-04): block byte offsets from splitBlocks() —
   * required by buildShell() for accurate source maps. When omitted,
   * derived from `opts.source` via splitBlocks() if available.
   */
  blockOffsets?: BlockMap;
}

export interface EmitLitResult {
  code: string;
  /**
   * magic-string SourceMap pointing emitted .ts positions back to .rozie source.
   * Null in the P1 stub (P2 wires real composition via sourcemap/compose.ts).
   */
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

/**
 * P1 stub: always returns the same minimal-valid TS class. P2 replaces this
 * with the real orchestration:
 *
 *   1. resolve registry + blockOffsets via splitBlocks
 *   2. construct LitImportCollector + RuntimeLitImportCollector
 *   3. call emitScript / emitTemplate / emitListeners / emitSlotDecl / emitStyle
 *   4. buildShell to assemble decorator + class body + customElements.define
 *   5. composeSourceMap to merge child + shell maps
 *   6. aggregate diagnostics
 *
 * The placeholder class name (`STUB`) is intentionally not derived from
 * `ir.name` — P1 only validates the public surface, not per-example output.
 * Per-example fixtures lock in P2.
 */
export function emitLit(_ir: IRComponent, _opts: EmitLitOptions = {}): EmitLitResult {
  return {
    code: 'export default class STUB {}\n',
    map: null,
    diagnostics: [],
  };
}
