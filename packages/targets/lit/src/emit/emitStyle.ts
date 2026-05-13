/**
 * emitStyle.ts — P1 stub for `<style>` block emission.
 *
 * P2 splits the IR `styles` payload into:
 *   - `static styles = css\`...\`` — shadow-DOM-scoped (no scope-attribute
 *     rewriting needed — Lit's shadow root handles encapsulation natively).
 *   - `injectGlobalStyles('rozie-<name>-global', '...')` IIFE for `:root { }`
 *     rules per D-LIT-15.
 *
 * @experimental — shape may change before v1.0
 */
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitStyleResult {
  /** Body of `static styles = css\`...\`;` — empty when no <style> block. */
  staticStylesBody: string;
  /** Body of the optional `injectGlobalStyles(id, body)` IIFE for :root rules. */
  globalStylesBody: string;
  diagnostics: Diagnostic[];
}

export function emitStyle(): EmitStyleResult {
  return { staticStylesBody: '', globalStylesBody: '', diagnostics: [] };
}
