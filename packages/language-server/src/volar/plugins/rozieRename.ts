/**
 * Phase 85 Plan 02 Task 3 — the ROZ rename service plugin (prepare-rename +
 * rename-edits), delegating to `computePrepareRename`/`computeRename`
 * (`../../features.ts`) unmodified behind the `rozie-source`-only guard.
 *
 * `volar-service-typescript`'s OWN semantic rename happens to coincide with
 * this plugin's answer for a `$props.X` member (both resolve to the SAME
 * generated `__RozieProps` interface member, mapped back to the SAME source
 * range) — but that coincidence does not cover `$data.X` (an inferred,
 * unnamed object-literal type in the generated code, not a renameable
 * declaration), `$refs.X` (a `ref="..."` attribute VALUE, never emitted into
 * the virtual TS at all), or component tags/slot fills. This plugin is what
 * makes rename work for the whole Rozie sigil surface, not just the slice
 * that happens to alias a TS declaration.
 */
import type { LanguageServicePlugin } from '@volar/language-service';
import { URI } from 'vscode-uri';
import { computePrepareRename, computeRename } from '../../features.js';
import { toSourceDocument } from '../featureContext.js';

const ROZIE_SOURCE_EMBEDDED_ID = 'rozie-source';

export function createRozieRenamePlugin(): LanguageServicePlugin {
  return {
    name: 'rozie-rename',
    capabilities: {
      renameProvider: { prepareProvider: true },
    },
    create(context) {
      return {
        provideRenameRange(document, position) {
          const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
          if (!decoded || decoded[1] !== ROZIE_SOURCE_EMBEDDED_ID) return undefined;
          const sourceDoc = toSourceDocument(context, document);
          return computePrepareRename(sourceDoc, position) ?? undefined;
        },
        provideRenameEdits(document, position, newName) {
          const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
          if (!decoded || decoded[1] !== ROZIE_SOURCE_EMBEDDED_ID) return undefined;
          const sourceDoc = toSourceDocument(context, document);
          return computeRename(sourceDoc, position, newName) ?? undefined;
        },
      };
    },
  };
}
