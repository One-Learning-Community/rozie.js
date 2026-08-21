// Quick 260821-j38 — drift guards for the VS Code / TextMate IDE surface.
//
// WHY THIS FILE EXISTS
//
// Two IDE-surface artifacts are hand-maintained or build-frozen, and both
// silently drifted away from `@rozie/core` between 2026-06-21 and 2026-08-21:
//
//   1. `tools/textmate/server/server-standalone.cjs` is a COMMITTED build
//      artifact that inlines `@rozie/core`. The language-server *source* has no
//      drift of its own — `packages/language-server/src/diagnostics.ts` imports
//      `compile` from `@rozie/core` and hardcodes zero ROZ codes. But the
//      shipped bundle is a snapshot, so every diagnostic added to core after
//      the last `pnpm bundle:server` is invisible in the editor. At the time
//      this guard was written, 38 real codes were missing (ROZ090..ROZ096,
//      ROZ142..ROZ148, ROZ207..ROZ210, ROZ724, ROZ750, ROZ981..ROZ998, …).
//
//   2. The grammar's directive and sigil alternations are hand-written regexes
//      in `tools/textmate/syntaxes/*.json`. Nothing checked them against core.
//      At the time this guard was written the directive alternation knew 14 of
//      18 directives — `r-keynav`, `r-keynav-item`, `r-keynav-active-class` and
//      `r-portal` were all unhighlighted despite being used across 15 of our
//      own `.rozie` sources, with `r-keynav` carrying its own docs guide page.
//      The `.rzts` / `.rzjs` sigil INJECTION grammars were missing `$slotted`,
//      which the `.rozie` grammar already knew.
//
// Both guards are one-directional supersets. The IDE surface may legitimately
// know MORE than core (retired codes kept for message continuity, directives
// documented before they land). It must never know LESS.
//
// Rebuild the bundle with `pnpm --filter @rozie/tools-textmate bundle:server`
// (or `node tools/textmate/scripts/bundle-server.mjs`) when guard 1 fails.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

const CORE_CODES = join(REPO_ROOT, 'packages/core/src/diagnostics/codes.ts');
const BUNDLED_SERVER = join(
  REPO_ROOT,
  'tools/textmate/server/server-standalone.cjs',
);
const SYNTAXES = join(REPO_ROOT, 'tools/textmate/syntaxes');
const ROZIE_GRAMMAR = join(SYNTAXES, 'rozie.tmLanguage.json');
const TS_INJECTION = join(SYNTAXES, 'rozie-ts-sigils.injection.json');
const JS_INJECTION = join(SYNTAXES, 'rozie-js-sigils.injection.json');
const IDEA_GLOBALS = join(
  REPO_ROOT,
  'tools/intellij-plugin/src/main/resources/rozie-globals.d.ts',
);

const read = (p: string) => readFileSync(p, 'utf8');

/**
 * Core's REAL diagnostic codes — the `KEY: 'ROZnnn'` object entries in
 * `codes.ts`. Deliberately excludes bare `ROZnnn` mentions in comments, which
 * are range sentinels ("ROZ090..ROZ099 remain free") rather than live codes.
 */
function coreDiagnosticCodes(): Set<string> {
  const src = read(CORE_CODES);
  const codes = new Set<string>();
  for (const m of src.matchAll(/^\s*[A-Z0-9_]+:\s*'(ROZ\d{3})'/gm)) {
    codes.add(m[1]);
  }
  return codes;
}

/** Every ROZ code the shipped standalone server bundle can actually emit. */
function bundledServerCodes(): Set<string> {
  const src = read(BUNDLED_SERVER);
  return new Set([...src.matchAll(/ROZ\d{3}/g)].map((m) => m[0]));
}

/**
 * Directives core knows about, derived from quoted `'r-…'` string literals in
 * core's source. There is no central directive constant to import — the parser
 * dispatches on `rawName.startsWith('r-')` and the lowerers switch on names —
 * so a source scan is the only available source of truth.
 */
function coreDirectives(): Set<string> {
  const out = new Set<string>();
  const roots = ['packages/core/src'];
  const files = walk(roots.map((r) => join(REPO_ROOT, r)));
  for (const f of files) {
    if (f.includes('__tests__')) continue;
    for (const m of read(f).matchAll(/['"`](r-[a-z][a-z-]*)['"`]/g)) {
      out.add(m[1]);
    }
  }
  return out;
}

function walk(dirs: string[]): string[] {
  const { readdirSync, statSync } = require('node:fs');
  const found: string[] = [];
  const stack = [...dirs];
  while (stack.length > 0) {
    const d = stack.pop() as string;
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== 'node_modules') stack.push(full);
      } else if (full.endsWith('.ts')) {
        found.push(full);
      }
    }
  }
  return found;
}

/** The `$sigil` alternation baked into a grammar file, e.g. `\$(props|data|…)`. */
function grammarSigils(file: string): Set<string> {
  const txt = read(file);
  const out = new Set<string>();
  for (const m of txt.matchAll(/\\\\\$\(([a-zA-Z|]+)\)/g)) {
    for (const s of m[1].split('|')) out.add(`$${s}`);
  }
  return out;
}

/** The `r-(…)` directive alternation baked into the `.rozie` grammar. */
function grammarDirectives(file: string): Set<string> {
  const txt = read(file);
  const out = new Set<string>();
  for (const m of txt.matchAll(/r-\(\?:([a-zA-Z|-]+)\)/g)) {
    for (const d of m[1].split('|')) out.add(`r-${d}`);
  }
  return out;
}

/** Sigils the IntelliJ plugin declares as ambient globals — the shared list. */
function ideaSigils(): Set<string> {
  const src = read(IDEA_GLOBALS);
  const out = new Set<string>();
  for (const m of src.matchAll(/declare\s+(?:const|function)\s+(\$[a-zA-Z]+)/g)) {
    out.add(m[1]);
  }
  return out;
}

const missing = (required: Set<string>, present: Set<string>) =>
  [...required].filter((x) => !present.has(x)).sort();

describe('IDE surface parity — bundled language server vs @rozie/core', () => {
  it('extracts a plausible set of real codes from core', () => {
    // Sanity-check the extractor itself, so a regex slip can never make the
    // real assertion below pass vacuously.
    const core = coreDiagnosticCodes();
    expect(core.size).toBeGreaterThan(150);
    expect(core.has('ROZ001')).toBe(true);
  });

  it('ships every diagnostic code core can emit', () => {
    const core = coreDiagnosticCodes();
    const bundled = bundledServerCodes();
    expect(bundled.size).toBeGreaterThan(100);
    expect(missing(core, bundled)).toEqual([]);
  });
});

describe('IDE surface parity — TextMate grammar vs @rozie/core', () => {
  it('highlights every directive core recognises', () => {
    const core = coreDirectives();
    const grammar = grammarDirectives(ROZIE_GRAMMAR);
    expect(core.size).toBeGreaterThan(10);
    expect(grammar.size).toBeGreaterThan(10);
    expect(missing(core, grammar)).toEqual([]);
  });

  it.each([
    ['.rozie', ROZIE_GRAMMAR],
    ['.rzts injection', TS_INJECTION],
    ['.rzjs injection', JS_INJECTION],
  ])('paints every shared sigil in %s', (_label, file) => {
    const required = ideaSigils();
    expect(required.size).toBeGreaterThan(15);
    expect(missing(required, grammarSigils(file))).toEqual([]);
  });
});
