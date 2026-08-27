/**
 * Phase 85 — the flat array of ROZ Volar service plugins.
 *
 * Wave 1 (85-01) shipped diagnostics. Wave 2 (85-02) appends hover,
 * document symbols (Task 1), definition + references + completion
 * (Task 2), and rename (Task 3) — each behind the same
 * `rozie-source`-only guard `rozieDiagnostics.ts` established.
 */
import type { LanguageServicePlugin } from '@volar/language-service';
import { createRozieDiagnosticsPlugin } from './rozieDiagnostics.js';
import { createRozieHoverPlugin } from './rozieHover.js';
import { createRozieSymbolsPlugin } from './rozieSymbols.js';

export function createRozieServicePlugins(): LanguageServicePlugin[] {
  return [createRozieDiagnosticsPlugin(), createRozieHoverPlugin(), createRozieSymbolsPlugin()];
}
