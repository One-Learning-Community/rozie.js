/**
 * Phase 85 Task 1 — the flat array of ROZ Volar service plugins.
 *
 * Wave 1 (this plan) ships exactly one: diagnostics. Plan 85-02 appends
 * hover, definition, completion, references, rename and document-symbols
 * here once each is ported behind the same `rozie-source`-only guard.
 */
import type { LanguageServicePlugin } from '@volar/language-service';
import { createRozieDiagnosticsPlugin } from './rozieDiagnostics.js';

export function createRozieServicePlugins(): LanguageServicePlugin[] {
  return [createRozieDiagnosticsPlugin()];
}
