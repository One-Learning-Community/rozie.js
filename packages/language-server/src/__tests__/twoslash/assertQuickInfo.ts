/**
 * Phase 85 Plan 06 (D5) — resolves a `markers.ts` hit into a real quick-info
 * answer.
 *
 * Reuses the PRODUCTION `generateVirtualTs` (`../../volar/virtualCode.js`)
 * and `rozieLanguagePlugin` (`../../volar/languagePlugin.js`) — no forked
 * copy — plus Volar's OWN `@volar/language-core` `SourceMap`/`CodeMapping`
 * machinery for offset translation, and a real `ts.LanguageService` for the
 * answer itself. A harness with its own offset math, or its own generator,
 * could pass while the server is actually wrong; that is the one thing this
 * instrument exists to prevent. Modeled directly on the proven
 * `virtualCode.prove.test.ts` harness, generalized from that file's
 * hardcoded two-fixture set to an arbitrary file map (needed both for this
 * module's own small test fixtures and for the 80-probe corpus in
 * `probes.test.ts`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { type CodeMapping, createLanguage, FileMap, type IScriptSnapshot, SourceMap } from '@volar/language-core';
import { createLanguageServiceHost, resolveFileLanguageId } from '@volar/typescript';
import ts from 'typescript';
import { rozieLanguagePlugin } from '../../volar/languagePlugin.js';
import { generateVirtualTs } from '../../volar/virtualCode.js';
import { findMarkers, type MarkerHit } from './markers.js';

function snap(text: string): IScriptSnapshot {
  return {
    getText: (s: number, e: number) => text.slice(s, e),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}

export interface TwoslashHarness {
  languageService: ts.LanguageService;
  /** `.rozie` source offset -> quick-info display string, or `'(unmapped)'`/`'(none)'`. */
  quickInfoAt(filePath: string, sourceOffset: number): string;
  /**
   * The FIRST source offset inside `[start, end)` that is covered by a real
   * (non-generated-only) mapping chunk, or `undefined` if the range has no
   * mapped content at all — e.g. a line of plain static markup, which
   * `generateVirtualTs` never emits a `mapped()` chunk for.
   */
  firstMappedOffsetInRange(filePath: string, range: [number, number]): number | undefined;
}

/**
 * Build ONE shared language service + source maps across every file in
 * `files` (absolute-ish path -> `.rozie` source text). Loading every file
 * together — not one language service per file — mirrors how the real
 * server sees a project: multiple `.rozie` files sharing one TS Program.
 */
export function createTwoslashHarness(files: Map<string, string>): TwoslashHarness {
  const rawMappings = new Map<string, CodeMapping[]>();
  const maps = new Map<string, SourceMap>();
  for (const [file, text] of files) {
    const { mappings } = generateVirtualTs(text, file);
    rawMappings.set(file, mappings);
    maps.set(file, new SourceMap(mappings));
  }

  const language = createLanguage(
    [rozieLanguagePlugin, { getLanguageId: resolveFileLanguageId }],
    new FileMap(ts.sys.useCaseSensitiveFileNames),
    (fileName: string) => {
      // MUST fall through to the real filesystem — TypeScript loads its own
      // lib.*.d.ts through this same path (REQ-V16 landmine, ported from
      // virtualCode.prove.test.ts's identical guard).
      const text = files.get(fileName) ?? (existsSync(fileName) ? readFileSync(fileName, 'utf8') : undefined);
      if (text !== undefined) language.scripts.set(fileName, snap(text));
      else language.scripts.delete(fileName);
    },
  );

  const { languageServiceHost } = createLanguageServiceHost(ts, ts.sys, language, (fn: string) => fn, {
    getCurrentDirectory: () => process.cwd(),
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
  const languageService = ts.createLanguageService(languageServiceHost);

  // Touch every file once so virtual code + the language's own maps exist.
  for (const f of files.keys()) languageService.getSemanticDiagnostics(f);

  function toGen(file: string, off: number): number | undefined {
    const map = maps.get(file);
    if (!map) return undefined;
    for (const [g] of map.toGeneratedLocation(off)) return g;
    return undefined;
  }

  function firstMappedOffsetInRange(file: string, range: [number, number]): number | undefined {
    const [start, end] = range;
    const mappings = rawMappings.get(file);
    if (!mappings) return undefined;
    const text = files.get(file);
    let best: number | undefined;
    for (const m of mappings) {
      for (let i = 0; i < m.sourceOffsets.length; i++) {
        const so = m.sourceOffsets[i] as number;
        const len = (m.lengths[i] as number | undefined) ?? 0;
        if (so + len <= start || so >= end) continue; // no intersection with the target line
        let candidate = Math.max(so, start);
        // The FIRST mapped offset can land on leading whitespace inside a
        // `{{ expr }}` interpolation's own mapped chunk (the natural
        // `{{ $props.x }}` authoring convention, space included verbatim in
        // the mapping) — a quick-info query there answers nothing useful.
        // Advance past whitespace, but never past this SAME mapped chunk's
        // own extent or past the target line's own range.
        if (text) {
          const chunkEnd = Math.min(so + len, end);
          while (candidate < chunkEnd && /\s/.test(text[candidate] ?? '')) candidate++;
        }
        if (best === undefined || candidate < best) best = candidate;
      }
    }
    return best;
  }

  function quickInfoAt(file: string, sourceOffset: number): string {
    const g = toGen(file, sourceOffset);
    if (g === undefined) return '(unmapped)';
    const qi = languageService.getQuickInfoAtPosition(file, g);
    return qi ? ts.displayPartsToString(qi.displayParts) : '(none)';
  }

  return { languageService, quickInfoAt, firstMappedOffsetInRange };
}

export interface ResolvedMarker extends MarkerHit {
  file: string;
  /** The source offset actually queried. Absent on error or when unmapped. */
  assertedOffset?: number;
  /** A valid target line existed, but no offset on it maps into generated code (T-85-23: never a silent skip). */
  unmapped?: boolean;
  answer: string;
}

/** Find every marker in one file's source and resolve each against a live harness. Never throws. */
export function resolveMarkersForFile(harness: TwoslashHarness, file: string, source: string): ResolvedMarker[] {
  return findMarkers(source).map((hit): ResolvedMarker => {
    if (hit.error || !hit.targetLineRange) {
      return { ...hit, file, answer: '(error)' };
    }
    const offset = harness.firstMappedOffsetInRange(file, hit.targetLineRange);
    if (offset === undefined) {
      return { ...hit, file, unmapped: true, answer: '(unmapped)' };
    }
    return { ...hit, file, assertedOffset: offset, answer: harness.quickInfoAt(file, offset) };
  });
}
