/**
 * Phase 85 Task 2 — the pinned prove harness.
 *
 * Ported from the proven spike
 * (`.claude/skills/spike-findings-rozie/sources/018-volar-virtual-ts-rozie/prove.mjs`),
 * but reusing the PRODUCTION `generateVirtualTs` (`../../volar/virtualCode.js`)
 * and `rozieLanguagePlugin` (`../../volar/languagePlugin.js`) — no forked
 * copy, or this harness drifts from what the server actually does.
 *
 * Two landmines fail SILENTLY without a standing guard:
 *   - REQ-V6 — a missing `export {};` puts every `.rozie` file's `$props` /
 *     `$data` / `__RozieProps` in the GLOBAL scope. Reproduces only with
 *     >=2 files loaded into the same language service — invisible in any
 *     single-file test, which is why BOTH fixtures load here together.
 *   - REQ-V7 — `createLanguageServiceHost` (the correct path) vs. the
 *     tsserver-plugin path (`decorateLanguageServiceHost` +
 *     `createProxyLanguageService`), which only *overrides*
 *     `getScriptKind` when the host already defines one and so drops
 *     `.rozie` from the Program with no error at all.
 *
 * Position mapping is done EXPLICITLY via `@volar/language-core`'s
 * `SourceMap`, built from the SAME `mappings` a direct `generateVirtualTs`
 * call produces (the same pure function `rozieLanguagePlugin` calls
 * internally) — keeping both halves independently checkable: that
 * TypeScript really answers about the generated code, and that the offsets
 * really round-trip to the `.rozie` source.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLanguage, FileMap, type IScriptSnapshot, SourceMap } from '@volar/language-core';
import { createLanguageServiceHost, resolveFileLanguageId } from '@volar/typescript';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import { rozieLanguagePlugin } from '../../volar/languagePlugin.js';
import { generateVirtualTs } from '../../volar/virtualCode.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(HERE, '..', 'fixtures');
const FIXTURES = ['Probe.rozie', 'ProbeBad.rozie'];

/**
 * TS diagnostic codes for the "this file is missing `export {};`, so it is
 * NOT a module, so every top-level declaration — ambient sigils AND the
 * author's own `<script>` code — collides with every other non-module
 * `.rozie` file's top-level declarations" failure family (REQ-V6):
 *   2300 — Duplicate identifier
 *   2393 — Duplicate function implementation
 *   2451 — Cannot redeclare block-scoped variable
 *   6200 — Definitions of the following identifiers conflict with those in another file
 * Assertion (4) excludes this family (it is not a per-file type-quality
 * signal); assertion (8) is the dedicated guard that fails when this family
 * appears at all — the two are complementary by construction so the module
 * marker's presence/absence steers exactly one of them.
 */
const MODULE_COLLISION_CODES = new Set([2300, 2393, 2451, 6200]);

function snap(text: string): IScriptSnapshot {
  return {
    getText: (s: number, e: number) => text.slice(s, e),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}

describe('virtualCode.prove — pinned assertions against a real ts.LanguageService', () => {
  const files = new Map<string, string>();
  for (const f of FIXTURES) files.set(path.join(FIXTURES_DIR, f), readFileSync(path.join(FIXTURES_DIR, f), 'utf8'));

  const F = (f: string): string => path.join(FIXTURES_DIR, f);
  const src = (f: string): string => {
    const text = files.get(F(f));
    if (text === undefined) throw new Error(`fixture not loaded: ${f}`);
    return text;
  };

  // Maps built from a DIRECT `generateVirtualTs` call — the same pure,
  // production function `rozieLanguagePlugin.createVirtualCode` calls
  // internally when the language service below actually runs. Kept
  // independent so offset round-tripping is checkable without relying on
  // Volar's own internal map registry.
  const maps = new Map<string, SourceMap>();
  for (const f of FIXTURES) {
    const { mappings } = generateVirtualTs(src(f), f);
    maps.set(F(f), new SourceMap(mappings));
  }

  /** .rozie offset -> virtual-TS offset */
  function toGen(f: string, off: number): number | undefined {
    const map = maps.get(F(f));
    if (!map) return undefined;
    for (const [g] of map.toGeneratedLocation(off)) return g;
    return undefined;
  }
  /** virtual-TS offset -> .rozie offset */
  function toSrc(f: string, off: number): number | undefined {
    const map = maps.get(F(f));
    if (!map) return undefined;
    for (const [s] of map.toSourceLocation(off)) return s;
    return undefined;
  }

  /** offset of the Nth occurrence of `needle` in the fixture's .rozie source */
  function at(f: string, needle: string, n = 1): number {
    let i = -1;
    for (let k = 0; k < n; k++) i = src(f).indexOf(needle, i + 1);
    if (i < 0) throw new Error(`fixture missing: "${needle}" (#${n}) in ${f}`);
    return i;
  }

  function lineOf(f: string, off: number): number {
    return src(f).slice(0, off).split('\n').length;
  }

  // The production language, built with the REAL rozieLanguagePlugin — this
  // is what actually drives `ts.createLanguageService` below, exercised
  // through the same `createLanguage`/`createLanguageServiceHost` shape the
  // server uses.
  const language = createLanguage(
    [rozieLanguagePlugin, { getLanguageId: resolveFileLanguageId }],
    new FileMap(ts.sys.useCaseSensitiveFileNames),
    (fileName: string) => {
      // MUST fall through to the real filesystem — TypeScript reads its own
      // lib.*.d.ts through this same path. In-memory fixtures ONLY yields a
      // Program with no lib at all ("Cannot find name 'Record'").
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
      allowNonTsExtensions: true, // required by Volar's host for the .rozie extension
      types: [], // no explicit `lib`: default for ES2022 target includes DOM
    }),
    getScriptFileNames: () => [...files.keys()],
    getProjectVersion: () => '1',
  });
  const ls = ts.createLanguageService(languageServiceHost);

  function quickInfo(f: string, rozieOffset: number): string {
    const g = toGen(f, rozieOffset);
    if (g === undefined) return '(unmapped)';
    const qi = ls.getQuickInfoAtPosition(F(f), g);
    return qi ? ts.displayPartsToString(qi.displayParts) : '(none)';
  }

  beforeAll(() => {
    // touch both files so virtual code + the language's own maps exist.
    for (const f of FIXTURES) ls.getSemanticDiagnostics(F(f));
  });

  it('(1) types flow from <props> into <template>: {{ $props.label }} hovers as string', () => {
    const info = quickInfo('Probe.rozie', at('Probe.rozie', '$props.label', 2) + 7);
    expect(info, info).toMatch(/label\??:\s*string/);
  });

  it('(2) types flow from <props> into an attribute binding: :disabled="$props.disabled" hovers as boolean', () => {
    const info = quickInfo('Probe.rozie', at('Probe.rozie', '$props.disabled') + 7);
    expect(info, info).toMatch(/disabled\??:\s*boolean/);
  });

  it('(3) types flow from <data> into <script>: $data.clicks is inferred as number', () => {
    const info = quickInfo('Probe.rozie', at('Probe.rozie', '$data.clicks') + 6);
    expect(info, info).toMatch(/clicks:\s*number/);
  });

  it('(4) a clean fixture yields zero semantic diagnostics', () => {
    // MODULE_COLLISION_CODES are CROSS-FILE global-scope collisions, not a
    // per-file type-quality signal — assertion (8) is the dedicated REQ-V6
    // guard for that failure family, so it is excluded here to keep the two
    // assertions independently diagnosable.
    const d = ls.getSemanticDiagnostics(F('Probe.rozie')).filter((x) => !MODULE_COLLISION_CODES.has(x.code));
    const detail = d.map((x) => ts.flattenDiagnosticMessageText(x.messageText, ' ')).join(' | ');
    expect(d, detail).toHaveLength(0);
  });

  describe('(5) & (6) real type errors, caught AND reverse-mapped to .rozie ranges', () => {
    interface MappedDiag {
      msg: string;
      srcOffset: number | undefined;
      text: string;
      line: number;
    }

    let mapped: MappedDiag[];

    beforeAll(() => {
      const diags = ls.getSemanticDiagnostics(F('ProbeBad.rozie'));
      mapped = diags.map((d) => {
        const s = toSrc('ProbeBad.rozie', d.start ?? 0);
        return {
          msg: ts.flattenDiagnosticMessageText(d.messageText, ' '),
          srcOffset: s,
          text: s === undefined ? '(unmapped)' : src('ProbeBad.rozie').slice(s, s + (d.length ?? 0)),
          line: s === undefined ? -1 : lineOf('ProbeBad.rozie', s),
        };
      });
    });

    it('a deliberately-broken fixture yields a diagnostic for the unknown prop, reverse-mapped onto `bogus`', () => {
      const bogus = mapped.find((m) => m.msg.includes('bogus'));
      expect(bogus, JSON.stringify(mapped)).toBeTruthy();
      expect(bogus?.text, JSON.stringify(bogus)).toBe('bogus');
    });

    it('a type error INSIDE {{ }} is caught, reverse-mapped onto `toFixed`', () => {
      const tf = mapped.find((m) => m.msg.includes('toFixed'));
      expect(tf, JSON.stringify(mapped)).toBeTruthy();
      expect(tf?.text, JSON.stringify(tf)).toBe('toFixed');
    });
  });

  it('(7) completion after `$props.` offers exactly the declared props and nothing else', () => {
    const g = toGen('Probe.rozie', at('Probe.rozie', '$props.label', 2) + 7);
    expect(g).toBeDefined();
    const names = (ls.getCompletionsAtPosition(F('Probe.rozie'), g as number, {})?.entries ?? [])
      .map((e) => e.name)
      .sort();
    expect(names).toEqual(['count', 'disabled', 'label']);
  });

  it('(8) REQ-V6 guard: with BOTH fixtures loaded, neither reports a redeclaration error for a generated identifier', () => {
    const offenders: string[] = [];
    for (const f of FIXTURES) {
      for (const d of ls.getSemanticDiagnostics(F(f))) {
        if (MODULE_COLLISION_CODES.has(d.code)) {
          offenders.push(`${f}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
        }
      }
    }
    expect(
      offenders,
      `Redeclaration errors found — this means the generated virtual code is missing its ` +
        `module marker (the trailing "export {};" in virtualCode.ts, REQ-V6), so ` +
        `$props/$data/__RozieProps from one .rozie file collided with another's in the ` +
        `global scope. Offenders: ${JSON.stringify(offenders)}`,
    ).toHaveLength(0);
  });

  it('(9) REQ-V7 guard: the host is built through createLanguageServiceHost, and the Program contains both .rozie files', () => {
    const program = ls.getProgram();
    expect(program, 'ts.LanguageService produced no Program at all').toBeTruthy();
    for (const f of FIXTURES) {
      expect(
        program?.getSourceFile(F(f)),
        `${f} is missing from the ts.Program — this is exactly the tsserver-plugin-path ` +
          `landmine (REQ-V7): decorateLanguageServiceHost + createProxyLanguageService only ` +
          `overrides getScriptKind when the host already defines one, silently dropping ` +
          `.rozie from the Program. This harness must use createLanguageServiceHost instead.`,
      ).toBeTruthy();
    }
  });

  it('(10) filesystem-fallback guard: the sync callback reaches real disk, so the Program has a lib', () => {
    const unresolvedBuiltins: string[] = [];
    for (const f of FIXTURES) {
      for (const d of ls.getSemanticDiagnostics(F(f))) {
        const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
        if (/Cannot find name '(Record|Promise|Array|HTMLElement)'/.test(msg)) unresolvedBuiltins.push(msg);
      }
    }
    expect(
      unresolvedBuiltins,
      'A built-in type name failed to resolve — this means the `sync` callback did not fall ' +
        'through to the real filesystem, so TypeScript could not load lib.*.d.ts and the ' +
        'Program has no lib at all.',
    ).toHaveLength(0);
  });
});
