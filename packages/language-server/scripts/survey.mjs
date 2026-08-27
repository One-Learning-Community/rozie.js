// Phase 85 Task 3 — corpus survey instrument.
//
// Ported from the proven spike
// (.claude/skills/spike-findings-rozie/sources/018-volar-virtual-ts-rozie/survey.mjs).
// Runs the PRODUCTION `generateVirtualTs` (imported from the built dist, the
// same function `volar/languagePlugin.ts` uses) over every real `.rozie` file
// in the corpus and reports how many produce diagnostics — i.e. how many
// FALSE errors a Rozie author would see in their editor on day one. False
// errors are worse than no feature.
//
// REQ-V12 — report failure CLASSES, never a headline clean-rate as the
// finding. The first spike survey read 22.2% clean and looked like a
// failure; grouped by class it was a to-do list, and the same corpus reached
// 51.2% within the hour. The class table is the primary output; the
// percentage is one line beneath it.
//
// RECORDED BASELINE (Phase 85 Task 1, this survey's own first run against
// the corpus below): 51.2% clean / 699 diagnostics / 0 generator failures
// across 387 files. Every later task in this phase that claims a
// correctness improvement must move these numbers and say by how much and
// in which class — see the plan SUMMARY for the exact table.
//
// REQ-V10 — `createTypeScriptProject` reads the CONSUMER's own tsconfig and
// never imposes `strict`, so this survey's default run does not impose it
// either: the numbers above must reflect what a real consumer actually
// sees, not an artificially stricter shape. `ROZIE_SURVEY_STRICT=1` is the
// escape hatch that keeps the stricter comparison available on demand (it
// measured a 7.3x diagnostic inflation on the same corpus — worth being
// able to reproduce, never the default).

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLanguage, FileMap } from '@volar/language-core';
import { createLanguageServiceHost, resolveFileLanguageId } from '@volar/typescript';
import ts from 'typescript';
// Imported from the BUILT dist — `pnpm --filter @rozie/language-server
// build` (or the `survey` script below, which builds first) — so this is
// exactly the function the shipped server runs, not a forked copy.
import { generateVirtualTs } from '../dist/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const LIMIT = Number(process.env.LIMIT ?? 1000);
const USE_STRICT = process.env.ROZIE_SURVEY_STRICT === '1';

// Matches the corpus the recorded baseline (51.2% / 699 / 0, 387 files) was
// measured against: real shipped `.rozie` sources (probes + component
// library), not test fixtures, docs mockups, or scratch examples elsewhere
// in the tree.
const all = execSync(
  `find "${REPO}/examples" "${REPO}/packages/ui" -name '*.rozie' -not -path '*/node_modules/*' -not -path '*/dist/*' 2>/dev/null | sort | head -${LIMIT}`,
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean);

console.log(`Surveying ${all.length} real .rozie files (mode: ${USE_STRICT ? 'strict' : 'default (consumer-shaped, no strict)'})\n`);

const files = new Map();
for (const f of all) {
  try {
    files.set(f, fs.readFileSync(f, 'utf8'));
  } catch {
    // unreadable file — skip, does not count as a generator failure.
  }
}

const snap = (t) => ({
  getText: (s, e) => t.slice(s, e),
  getLength: () => t.length,
  getChangeRange: () => undefined,
});
const maps = new Map();
const genFail = [];

const plugin = {
  getLanguageId: (id) => (id.endsWith('.rozie') ? 'rozie' : undefined),
  createVirtualCode(id, lid, s) {
    if (lid !== 'rozie') return undefined;
    let code = '';
    let mappings = [];
    try {
      ({ code, mappings } = generateVirtualTs(s.getText(0, s.getLength()), path.basename(id)));
    } catch (e) {
      genFail.push([id, e.message]);
      code = 'export {};\n';
      mappings = [{ sourceOffsets: [], generatedOffsets: [], lengths: [], data: {} }];
    }
    maps.set(id, mappings);
    return { id: 'root', languageId: 'typescript', snapshot: snap(code), mappings, embeddedCodes: [] };
  },
  typescript: {
    extraFileExtensions: [{ extension: 'rozie', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }],
    getServiceScript: (root) => ({ code: root, extension: '.ts', scriptKind: ts.ScriptKind.TS }),
  },
};

const language = createLanguage([plugin, { getLanguageId: resolveFileLanguageId }], new FileMap(true), (fn) => {
  const t = files.get(fn) ?? (fs.existsSync(fn) ? fs.readFileSync(fn, 'utf8') : undefined);
  if (t !== undefined) language.scripts.set(fn, snap(t));
  else language.scripts.delete(fn);
});

const { languageServiceHost } = createLanguageServiceHost(ts, ts.sys, language, (fn) => fn, {
  getCurrentDirectory: () => REPO,
  getCompilationSettings: () => ({
    target: ts.ScriptTarget.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    // REQ-V10 — default run mirrors createTypeScriptProject's consumer-tsconfig
    // behavior (no imposed strict). ROZIE_SURVEY_STRICT=1 is the deliberate
    // escape hatch for the on-demand strict comparison.
    strict: USE_STRICT,
    noImplicitAny: USE_STRICT,
    noEmit: true,
    skipLibCheck: true,
    allowNonTsExtensions: true,
    types: [],
  }),
  getScriptFileNames: () => [...files.keys()],
  getProjectVersion: () => '1',
});
const ls = ts.createLanguageService(languageServiceHost);

const t0 = Date.now();
const byCode = new Map();
let clean = 0;
let dirty = 0;
let totalDiags = 0;
const worst = [];

for (const f of files.keys()) {
  let diags = [];
  try {
    diags = ls.getSemanticDiagnostics(f);
  } catch (e) {
    genFail.push([f, `LS threw: ${e.message}`]);
    continue;
  }
  if (!diags.length) {
    clean++;
    continue;
  }
  dirty++;
  totalDiags += diags.length;
  worst.push([diags.length, f]);
  for (const d of diags) {
    const key = `TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, ' ').slice(0, 70)}`;
    byCode.set(key, (byCode.get(key) ?? 0) + 1);
  }
}
const ms = Date.now() - t0;

console.log(`clean:        ${clean}/${files.size}  (${((clean / files.size) * 100).toFixed(1)}%)`);
console.log(`with diags:   ${dirty}   (${totalDiags} diagnostics total)`);
console.log(`generator threw on: ${genFail.length}`);
console.log(`elapsed:      ${ms}ms  (${(ms / files.size).toFixed(1)}ms/file, cold, incl. TS program build)\n`);

if (genFail.length) {
  console.log('--- generator failures ---');
  for (const [f, m] of genFail.slice(0, 10)) console.log(`  ${path.relative(REPO, f)}: ${m}`);
  console.log();
}

console.log('--- most common diagnostics (the false-error classes to fix) ---');
for (const [k, n] of [...byCode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(n).padStart(4)}x  ${k}`);
}

console.log('\n--- noisiest files ---');
for (const [n, f] of worst.sort((a, b) => b[0] - a[0]).slice(0, 8)) {
  console.log(`  ${String(n).padStart(4)} diags  ${path.relative(REPO, f)}`);
}
