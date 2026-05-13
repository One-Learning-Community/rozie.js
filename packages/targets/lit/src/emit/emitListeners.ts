/**
 * emitListeners.ts — P1 stub for `<listeners>`-block emission.
 *
 * P2 emits per-listener wiring in `firstUpdated()` with cleanup pushed to the
 * private `_disconnectCleanups` array drained in `disconnectedCallback()`
 * (D-LIT-09 + D-19 carry-forward).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitListenersResult {
  /** Code to inject into `firstUpdated()` body. */
  firstUpdatedBody: string;
  /** Script-body injection lines for wrap helpers. */
  scriptInjections: string[];
  diagnostics: Diagnostic[];
}

export function emitListeners(_ir: IRComponent): EmitListenersResult {
  return { firstUpdatedBody: '', scriptInjections: [], diagnostics: [] };
}
