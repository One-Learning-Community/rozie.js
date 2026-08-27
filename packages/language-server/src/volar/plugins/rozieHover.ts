/**
 * Phase 85 Plan 02 Task 1 — the ROZ hover service plugin.
 *
 * Follows the `rozie-source`-only guard `rozieDiagnostics.ts` (Plan 85-01)
 * established: decline every embedded document except the identity-mapped
 * one this plugin's providers understand, so `computeHover`'s host-coordinate
 * output survives Volar's automatic range transform unmodified.
 *
 * Volar's hover dispatch is a UNION across every answering plugin
 * (`provideHover.js`), joined with a `---` markdown separator — so this
 * plugin's Rozie-semantic signature and `volar-service-typescript`'s own
 * TypeScript-type hover coexist on the same caret rather than suppressing
 * each other. No `isAdditionalCompletion`-style flag is needed here; that
 * primary/additional model is specific to completion (see
 * `rozieCompletion.ts`).
 */
import type { LanguageServicePlugin } from '@volar/language-service';
import { URI } from 'vscode-uri';
import { computeHover } from '../../features.js';

const ROZIE_SOURCE_EMBEDDED_ID = 'rozie-source';

export function createRozieHoverPlugin(): LanguageServicePlugin {
  return {
    name: 'rozie-hover',
    capabilities: { hoverProvider: true },
    create(context) {
      return {
        provideHover(document, position) {
          const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
          if (!decoded || decoded[1] !== ROZIE_SOURCE_EMBEDDED_ID) return undefined;
          return computeHover(document, position) ?? undefined;
        },
      };
    },
  };
}
