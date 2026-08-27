/**
 * Phase 85 Plan 03 Task 3 — REQ-V13's actual payoff, exercised against a
 * real `ts.LanguageService`.
 *
 * Two things this suite proves:
 *
 *   1. `missingSigilDeclarations()` (`../../volar/sigils.js`) is asserted
 *      EMPTY — the hard assertion that converts "the server's ambient sigil
 *      preamble is a hand-forked copy of the compiler's list" into "the
 *      server CANNOT fall out of sync with the compiler's list" (REQ-V8 +
 *      REQ-V9 together, closed by Plan 85-03).
 *   2. A `.rozie` fixture whose template ends mid-interpolation — the caret
 *      sitting immediately after a freshly-typed `{{`, nothing typed yet —
 *      still generates a virtual module that TYPE-CHECKS (no syntax errors
 *      from an incomplete `void ();`), and a completion request at that
 *      exact caret resolves the ambient sigils in scope (`$props` among
 *      them). This is the entire payoff of REQ-V13: the editor can answer a
 *      completion question at the caret position that exists on EVERY
 *      keystroke between typing `{{` and typing the expression.
 *
 * Modeled directly on `virtualCode.prove.test.ts`'s harness (same
 * `createLanguage` / `createLanguageServiceHost` shape, same
 * production `generateVirtualTs` / `rozieLanguagePlugin` — no forked copy).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLanguage, FileMap, type IScriptSnapshot, SourceMap } from '@volar/language-core';
import { createLanguageServiceHost, resolveFileLanguageId } from '@volar/typescript';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { rozieLanguagePlugin } from '../../volar/languagePlugin.js';
import { generateVirtualTs } from '../../volar/virtualCode.js';
import { missingSigilDeclarations } from '../../volar/sigils.js';

describe('missingSigilDeclarations — REQ-V8 + REQ-V9 hard assertion', () => {
  it('is empty: every RESERVED_SIGILS member has an ambient TypeScript declaration', () => {
    const missing = missingSigilDeclarations();
    expect(
      [...missing],
      'A reserved sigil is missing its ambient declaration in volar/sigils.ts — this means ' +
        "the generated virtual module can't type-check that sigil at all.",
    ).toEqual([]);
  });
});

describe('REQ-V13 — completion at a caret right after a freshly-typed {{', () => {
  const FIXTURE_NAME = 'MidInterp.rozie';
  // The template's ONLY interpolation ends right after the opener — nothing
  // typed yet. This is exactly the AST shape parseTemplate.ts's recovery
  // branch produces on every keystroke between typing `{{` and typing an
  // expression.
  const SOURCE = `<rozie name="MidInterp">
<props>{ label: String }</props>
<template>
<div>{{ </div>
</template>
</rozie>
`;

  function snap(text: string): IScriptSnapshot {
    return {
      getText: (s: number, e: number) => text.slice(s, e),
      getLength: () => text.length,
      getChangeRange: () => undefined,
    };
  }

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const FIXTURES_DIR = path.join(HERE, '..', 'fixtures');
  const F = path.join(FIXTURES_DIR, FIXTURE_NAME);
  const files = new Map<string, string>([[F, SOURCE]]);

  // A direct generateVirtualTs call proves the recovery marker exists in the
  // AST/mapping BEFORE any TS machinery is involved.
  const { mappings } = generateVirtualTs(SOURCE, FIXTURE_NAME);
  const map = new SourceMap(mappings);

  it('the parser recovery node exists and maps the caret right after `{{`', () => {
    // Offset of the space immediately after `{{` in `<div>{{ </div>`.
    const openerOffset = SOURCE.indexOf('{{') + 2;
    const gen = [...map.toGeneratedLocation(openerOffset)];
    expect(
      gen.length,
      'no CodeMapping entry at the caret right after the opener — the zero-length ' +
        'recovery marker (virtualCode.ts) is missing.',
    ).toBeGreaterThan(0);
  });

  const language = createLanguage(
    [rozieLanguagePlugin, { getLanguageId: resolveFileLanguageId }],
    new FileMap(ts.sys.useCaseSensitiveFileNames),
    (fileName: string) => {
      // MUST fall through to the real filesystem for lib.*.d.ts (same
      // requirement as virtualCode.prove.test.ts).
      const text = files.get(fileName) ?? (existsSync(fileName) ? readFileSync(fileName, 'utf8') : undefined);
      if (text !== undefined) language.scripts.set(fileName, snap(text));
      else language.scripts.delete(fileName);
    },
  );

  const { languageServiceHost } = createLanguageServiceHost(ts, ts.sys, language, (fn: string) => fn, {
    getCurrentDirectory: () => FIXTURES_DIR,
    getCompilationSettings: () => ({
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      allowNonTsExtensions: true,
      types: [],
    }),
    getScriptFileNames: () => [...files.keys()],
    getProjectVersion: () => '1',
  });
  const ls = ts.createLanguageService(languageServiceHost);

  it('the fixture still generates a virtual module with ZERO syntax errors', () => {
    const syntactic = ls.getSyntacticDiagnostics(F);
    const detail = syntactic.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join(' | ');
    expect(
      syntactic,
      `An unterminated {{ produced a syntactically broken virtual module: ${detail}`,
    ).toHaveLength(0);
  });

  it('a completion request at the caret right after the opener resolves the ambient sigils in scope, including $props', () => {
    const openerOffset = SOURCE.indexOf('{{') + 2;
    let genOffset: number | undefined;
    for (const [g] of map.toGeneratedLocation(openerOffset)) {
      genOffset = g;
      break;
    }
    expect(genOffset, 'no generated position for the caret right after the opener').toBeDefined();

    const completions = ls.getCompletionsAtPosition(F, genOffset as number, {});
    const names = (completions?.entries ?? []).map((e) => e.name);
    expect(
      names,
      `expected $props among the in-scope completions at the recovered caret; got ${JSON.stringify(names)}`,
    ).toContain('$props');
  });
});
