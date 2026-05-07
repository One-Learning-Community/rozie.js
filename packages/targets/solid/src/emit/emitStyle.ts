/**
 * emitStyle — Solid target (P1 stub).
 *
 * Pitfall 3 (Phase 06.3 RESEARCH.md): Solid has no CSS Modules pipeline
 * analogous to Vite's React CSS Modules. P1 emits NO style output.
 * P2 will emit an inline `<style>` block following the Svelte/Angular scoping
 * pattern once the Solid consumer demo infrastructure is in place.
 *
 * @experimental — shape may change before v1.0
 */
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitStyleResult {
  /** P1: always empty string — no CSS sidecar for Solid (Pitfall 3). */
  css: string;
  diagnostics: Diagnostic[];
}

export function emitStyle(
  _styles: unknown,
  _source?: string,
): EmitStyleResult {
  // P1: no style emission. P2 will emit inline <style>.
  return { css: '', diagnostics: [] };
}
