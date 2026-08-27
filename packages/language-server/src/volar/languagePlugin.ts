/**
 * Phase 85 Task 1 — the Volar `LanguagePlugin` for `.rozie`.
 *
 * `createVirtualCode` returns TWO codes for every `.rozie` file:
 *
 *   1. `root` (`languageId: 'typescript'`) — the generated virtual TS from
 *      `generateVirtualTs`. This is what `volar-service-typescript` sees, and
 *      is the ONLY code that ever enters the TS `Program`
 *      (`getServiceScript` returns exactly this one).
 *   2. `rozie-source` (`languageId: 'rozie'`) — an IDENTITY-mapped copy of
 *      the raw, unmodified `.rozie` text. This is the load-bearing part of
 *      the tracer (RESEARCH.md assumption A2): Volar always dispatches a
 *      service plugin against a generated embedded document and
 *      auto-reverse-maps whatever range the plugin returns through THAT
 *      document's own mapping. The ROZ diagnostics plugin
 *      (`plugins/rozieDiagnostics.ts`) binds ONLY to `rozie-source`, so its
 *      host-coordinate `@rozie/core` output survives that transform
 *      unmodified instead of being silently reverse-mapped through the
 *      TypeScript mapping it was never expressed in.
 *
 * `getLanguageId` normalizes `scriptId` because it arrives as a `URI` object
 * under IntelliJ's native platform LSP client and (in some code paths) as a
 * plain string under VS Code (REQ-V16) — `fsPath`, then `path`, then
 * `String()`, first hit wins.
 */
import type { LanguagePlugin, VirtualCode } from '@volar/language-core';
import type { URI } from 'vscode-uri';
import * as ts from 'typescript';
import { generateVirtualTs } from './virtualCode.js';

const ROZIE_EXTENSION = '.rozie';

/** `fsPath`, then `path`, then `String()` — first hit wins (REQ-V16). */
export function idToPath(scriptId: URI | string): string {
  if (typeof scriptId === 'string') return scriptId;
  return scriptId.fsPath || scriptId.path || String(scriptId);
}

function toSnapshot(text: string) {
  return {
    getText: (start: number, end: number) => text.slice(start, end),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}

export const rozieLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId(scriptId) {
    return idToPath(scriptId).endsWith(ROZIE_EXTENSION) ? 'rozie' : undefined;
  },

  createVirtualCode(scriptId, languageId, snapshot): VirtualCode | undefined {
    if (languageId !== 'rozie') return undefined;

    const rawText = snapshot.getText(0, snapshot.getLength());
    const { code, mappings } = generateVirtualTs(rawText, idToPath(scriptId).split('/').pop() ?? 'Probe.rozie');

    const rozieSourceEmbedded: VirtualCode = {
      id: 'rozie-source',
      languageId: 'rozie',
      snapshot: toSnapshot(rawText),
      mappings: [
        {
          sourceOffsets: [0],
          generatedOffsets: [0],
          lengths: [rawText.length],
          data: {
            completion: true,
            navigation: true,
            semantic: true,
            structure: true,
            verification: true,
            format: false,
          },
        },
      ],
    };

    return {
      id: 'root',
      languageId: 'typescript',
      snapshot: toSnapshot(code),
      mappings,
      embeddedCodes: [rozieSourceEmbedded],
    };
  },

  typescript: {
    extraFileExtensions: [
      { extension: 'rozie', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred },
    ],
    getServiceScript(root) {
      return { code: root, extension: '.ts', scriptKind: ts.ScriptKind.TS };
    },
  },
};
