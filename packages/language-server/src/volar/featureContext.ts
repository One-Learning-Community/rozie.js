/**
 * Phase 85 Plan 02 Task 1 — the cross-file read hook for Volar-hosted ROZ
 * providers.
 *
 * `FeatureContext.readDoc` (`../features.ts`) is what lets a consumer
 * `.rozie` file resolve a sibling PRODUCER `.rozie` file's props/slots
 * surface (component-tag attribute completion, slot-fill navigation). Under
 * the retired hand-rolled server this was backed by `TextDocuments` (open
 * buffers) + `readFileSync` (disk fallback) — see `server.ts`'s git history.
 * Under Volar, the open-buffer half is `context.language.scripts` — Volar's
 * own live script store, which already reflects unsaved editor buffers, so
 * reading through it (rather than re-reading disk) means an unsaved
 * sibling's props still resolve correctly. Disk stays the fallback for a
 * sibling that is not currently open in the editor.
 *
 * Never throws — a resolution miss returns null, and the analyzers already
 * treat a null read as "cross-file features degrade to silence" (T-85-05's
 * own disposition: `resolveComponentUri` is the only path in, unchanged).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { LanguageServiceContext } from '@volar/language-service';
import { URI } from 'vscode-uri';
import type { FeatureContext } from '../features.js';

export function createFeatureContext(context: LanguageServiceContext): FeatureContext {
  return {
    readDoc(uri: string): string | null {
      try {
        const script = context.language.scripts.get(URI.parse(uri));
        if (script) return script.snapshot.getText(0, script.snapshot.getLength());
      } catch {
        // fall through to the disk read below.
      }
      try {
        return readFileSync(fileURLToPath(uri), 'utf8');
      } catch {
        return null;
      }
    },
  };
}
