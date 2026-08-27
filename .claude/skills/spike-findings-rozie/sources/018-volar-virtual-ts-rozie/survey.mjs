// Spike 018 — depth pass.
//
// The 11-assertion proof uses a fixture I wrote. That is a happy path. This runs
// the same pipeline over EVERY real .rozie in the repo and reports how many
// produce diagnostics — i.e. how many FALSE errors a Rozie author would see in
// their editor on day one. False errors are worse than no feature.

import { createLanguage, FileMap, SourceMap } from '@volar/language-core';
import { createLanguageServiceHost, resolveFileLanguageId } from '@volar/typescript';
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { generateVirtualTs } from './rozie-virtual-code.mjs';

const REPO = '/Users/serpentblade/work/olc/rozie';
const LIMIT = Number(process.env.LIMIT ?? 400);

const all = execSync(
  `find "${REPO}/examples" "${REPO}/packages/ui" -name '*.rozie' -not -path '*/node_modules/*' -not -path '*/dist/*' 2>/dev/null | head -${LIMIT}`,
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean);

console.log(`Surveying ${all.length} real .rozie files\n`);

const files = new Map();
for (const f of all) { try { files.set(f, fs.readFileSync(f, 'utf8')); } catch {} }

const snap = (t) => ({ getText: (s, e) => t.slice(s, e), getLength: () => t.length, getChangeRange: () => undefined });
const maps = new Map();
const genFail = [];

const plugin = {
  getLanguageId: (id) => (id.endsWith('.rozie') ? 'rozie' : undefined),
  createVirtualCode(id, lid, s) {
    if (lid !== 'rozie') return undefined;
    let code = '', mappings = [];
    try {
      ({ code, mappings } = generateVirtualTs(s.getText(0, s.getLength()), path.basename(id)));
    } catch (e) {
      genFail.push([id, e.message]);
      code = 'export {};\n';
      mappings = [{ sourceOffsets: [], generatedOffsets: [], lengths: [], data: {} }];
    }
    maps.set(id, new SourceMap(mappings));
    return { id: 'root', languageId: 'typescript', snapshot: snap(code), mappings, embeddedCodes: [] };
  },
  typescript: {
    extraFileExtensions: [{ extension: 'rozie', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }],
    getServiceScript: (root) => ({ code: root, extension: '.ts', scriptKind: ts.ScriptKind.TS }),
  },
};

const language = createLanguage([plugin, { getLanguageId: resolveFileLanguageId }], new FileMap(true), (fn) => {
  const t = files.get(fn) ?? (fs.existsSync(fn) ? fs.readFileSync(fn, 'utf8') : undefined);
  if (t !== undefined) language.scripts.set(fn, snap(t)); else language.scripts.delete(fn);
});

const { languageServiceHost } = createLanguageServiceHost(ts, ts.sys, language, (fn) => fn, {
  getCurrentDirectory: () => REPO,
  getCompilationSettings: () => ({
    target: ts.ScriptTarget.ES2022, moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: process.env.LOOSE !== '1', noImplicitAny: process.env.LOOSE !== '1',
    noEmit: true, skipLibCheck: true, allowNonTsExtensions: true, types: [],
  }),
  getScriptFileNames: () => [...files.keys()],
  getProjectVersion: () => '1',
});
const ls = ts.createLanguageService(languageServiceHost);

const t0 = Date.now();
const byCode = new Map();
let clean = 0, dirty = 0, totalDiags = 0;
const worst = [];

for (const f of files.keys()) {
  let diags = [];
  try { diags = ls.getSemanticDiagnostics(f); } catch (e) { genFail.push([f, 'LS threw: ' + e.message]); continue; }
  if (!diags.length) { clean++; continue; }
  dirty++; totalDiags += diags.length;
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
