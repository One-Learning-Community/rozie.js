/**
 * Phase 85 Plan 02 Task 1 — the ROZ document-symbols service plugin.
 *
 * Same `rozie-source`-only guard as `rozieDiagnostics.ts`/`rozieHover.ts`:
 * `computeDocumentSymbols` (`../../outline.ts`) is the EXISTING, unmodified
 * analyzer — `document` handed to `provideDocumentSymbols` is byte-identical
 * to the raw `.rozie` file once confirmed to be the `rozie-source` embedded
 * code, so it runs completely unchanged.
 */
import type { LanguageServicePlugin } from '@volar/language-service';
import { URI } from 'vscode-uri';
import { computeDocumentSymbols } from '../../outline.js';

const ROZIE_SOURCE_EMBEDDED_ID = 'rozie-source';

export function createRozieSymbolsPlugin(): LanguageServicePlugin {
  return {
    name: 'rozie-symbols',
    capabilities: { documentSymbolProvider: true },
    create(context) {
      return {
        provideDocumentSymbols(document) {
          const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
          if (!decoded || decoded[1] !== ROZIE_SOURCE_EMBEDDED_ID) return undefined;
          return computeDocumentSymbols(document);
        },
      };
    },
  };
}
