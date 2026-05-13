/**
 * emitPropsInterface — Lit target (Plan 06.4-02 Task 1).
 *
 * Lit does not need a separate TS interface — prop types are declarator-attached
 * via the `@property({ type: ... })` decorator + TS type on the class field.
 * This module's v1 returns an empty string; the d.ts emission path (Phase 6)
 * may grow this to synthesize `interface RozieCounterProps { ... }` for cross-
 * target type consumers.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';

export function emitPropsInterface(_ir: IRComponent): string {
  return '';
}
