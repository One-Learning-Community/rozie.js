// Spike 018 — the proof.
//
// Wire the .rozie virtual-TS generator into Volar and a REAL TypeScript
// LanguageService, then ask TypeScript questions in .rozie coordinates and
// assert the answers. If this passes, `.rozie` has genuine type intelligence
// for the first time — a capability class Rozie has never had in any editor.
//
// Position mapping is done EXPLICITLY here via Volar's SourceMap, which is what
// @volar/language-service (VS Code) and the IntelliJ LSP layer do for us in the
// real deployment. Doing it by hand keeps both halves independently checkable:
//   (1) TypeScript really answers about the generated code, and
//   (2) the offsets really round-trip to the .rozie source.

import { createLanguage, FileMap, SourceMap } from '@volar/language-core';
import { createLanguageServiceHost, resolveFileLanguageId } from '@volar/typescript';
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVirtualTs } from './rozie-virtual-code.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = ['Probe.rozie', 'ProbeBad.rozie'];

const files = new Map();
for (const f of FIXTURES) files.set(path.join(HERE, f), fs.readFileSync(path.join(HERE, f), 'utf8'));

const snap = (t) => ({ getText: (s, e) => t.slice(s, e), getLength: () => t.length, getChangeRange: () => undefined });

// ---------------------------------------------------------- the Rozie LanguagePlugin
const maps = new Map();   // .rozie path -> SourceMap

const rozieLanguagePlugin = {
  getLanguageId: (id) => (id.endsWith('.rozie') ? 'rozie' : undefined),
  createVirtualCode(id, languageId, snapshot) {
    if (languageId !== 'rozie') return undefined;
    const { code, mappings } = generateVirtualTs(snapshot.getText(0, snapshot.getLength()), path.basename(id));
    maps.set(id, new SourceMap(mappings));
    return { id: 'root', languageId: 'typescript', snapshot: snap(code), mappings, embeddedCodes: [] };
  },
  typescript: {
    extraFileExtensions: [{ extension: 'rozie', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }],
    getServiceScript: (root) => ({ code: root, extension: '.ts', scriptKind: ts.ScriptKind.TS }),
  },
};

const language = createLanguage(
  [rozieLanguagePlugin, { getLanguageId: resolveFileLanguageId }],
  new FileMap(ts.sys.useCaseSensitiveFileNames),
  (fileName) => {
    // MUST fall through to the real filesystem — TypeScript reads lib.*.d.ts
    // through this same path. Returning only the in-memory fixtures yields a
    // Program with no lib at all ("Cannot find name 'Record'").
    const text = files.get(fileName)
      ?? (fs.existsSync(fileName) ? fs.readFileSync(fileName, 'utf8') : undefined);
    if (text !== undefined) language.scripts.set(fileName, snap(text));
    else language.scripts.delete(fileName);
  },
);

const { languageServiceHost } = createLanguageServiceHost(ts, ts.sys, language, (fn) => fn, {
  getCurrentDirectory: () => HERE,
  getCompilationSettings: () => ({
    target: ts.ScriptTarget.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true, noEmit: true, skipLibCheck: true,
    allowNonTsExtensions: true,   // required by Volar's host for the .rozie extension
    types: [],   // no explicit `lib`: default for ES2022 target includes DOM
  }),
  getScriptFileNames: () => [...files.keys()],
  getProjectVersion: () => '1',
});
const ls = ts.createLanguageService(languageServiceHost);

// ------------------------------------------------------------------------- helpers
const F = (f) => path.join(HERE, f);
const src = (f) => files.get(F(f));
const lineOf = (f, off) => src(f).slice(0, off).split('\n').length;

/** offset of the Nth occurrence of `needle` in the .rozie source */
const at = (f, needle, n = 1) => {
  let i = -1;
  for (let k = 0; k < n; k++) i = src(f).indexOf(needle, i + 1);
  if (i < 0) throw new Error(`fixture missing: "${needle}" (#${n}) in ${f}`);
  return i;
};
/** .rozie offset -> virtual-TS offset */
const toGen = (f, off) => { for (const [g] of maps.get(F(f)).toGeneratedLocation(off)) return g; return undefined; };
/** virtual-TS offset -> .rozie offset */
const toSrc = (f, off) => { for (const [s] of maps.get(F(f)).toSourceLocation(off)) return s; return undefined; };

const quickInfo = (f, rozieOffset) => {
  const g = toGen(f, rozieOffset);
  if (g === undefined) return '(unmapped)';
  const qi = ls.getQuickInfoAtPosition(F(f), g);
  return qi ? ts.displayPartsToString(qi.displayParts) : '(none)';
};

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n        ${detail}` : ''}`); };

// touch both files so virtual code + maps exist
for (const f of FIXTURES) ls.getSemanticDiagnostics(F(f));

console.log('\n=== 1. Types flow from <props>/<data> into <template> and <script> ===');
{
  const info = quickInfo('Probe.rozie', at('Probe.rozie', '$props.label', 2) + 7);
  check('{{ $props.label }} hovers as string', /label\??:\s*string/.test(info), info);
}
{
  const info = quickInfo('Probe.rozie', at('Probe.rozie', '$props.disabled') + 7);
  check(':disabled="$props.disabled" hovers as boolean', /disabled\??:\s*boolean/.test(info), info);
}
{
  const info = quickInfo('Probe.rozie', at('Probe.rozie', '$data.clicks') + 6);
  check('<script> $data.clicks inferred as number from <data>', /clicks:\s*number/.test(info), info);
}

console.log('\n=== 2. A clean .rozie file reports NO false errors ===');
{
  const d = ls.getSemanticDiagnostics(F('Probe.rozie'));
  check('Probe.rozie is clean', d.length === 0,
    d.map(x => ts.flattenDiagnosticMessageText(x.messageText, ' ')).join(' | '));
}

console.log('\n=== 3. Real type errors caught AND mapped back to .rozie ranges ===');
{
  const diags = ls.getSemanticDiagnostics(F('ProbeBad.rozie')).map(d => {
    const s = toSrc('ProbeBad.rozie', d.start);
    return {
      msg: ts.flattenDiagnosticMessageText(d.messageText, ' '),
      srcOffset: s,
      text: s === undefined ? '(unmapped)' : src('ProbeBad.rozie').slice(s, s + d.length),
      line: s === undefined ? -1 : lineOf('ProbeBad.rozie', s),
    };
  });
  for (const m of diags) console.log(`        L${m.line} @${m.srcOffset} "${m.text}" — ${m.msg}`);

  const bogus = diags.find(m => m.msg.includes('bogus'));
  check('unknown prop $props.bogus is an error', !!bogus);
  check('  ...mapped onto `bogus` in the .rozie source', bogus?.text === 'bogus',
    `got "${bogus?.text}" at L${bogus?.line}`);

  const tf = diags.find(m => m.msg.includes('toFixed'));
  check('type error INSIDE {{ }} is caught', !!tf);
  check('  ...mapped onto `toFixed` in the .rozie source', tf?.text === 'toFixed',
    `got "${tf?.text}" at L${tf?.line}`);
}

console.log('\n=== 4. Go-to-definition crosses blocks: $props.label -> <props> key ===');
{
  const g = toGen('Probe.rozie', at('Probe.rozie', '$props.label', 2) + 7);
  const d = (ls.getDefinitionAtPosition(F('Probe.rozie'), g) ?? [])[0];
  const s = d ? toSrc('Probe.rozie', d.textSpan.start) : undefined;
  const txt = s === undefined ? '(none)' : src('Probe.rozie').slice(s, s + d.textSpan.length);
  const line = s === undefined ? -1 : lineOf('Probe.rozie', s);
  check('definition lands on the `label` key inside <props>', txt === 'label' && line <= 8,
    `got "${txt}" at L${line} — <props> spans L2..L7`);
}

console.log('\n=== 5. Completion after `$props.` offers exactly the declared props ===');
{
  const g = toGen('Probe.rozie', at('Probe.rozie', '$props.label', 2) + 7);
  const names = (ls.getCompletionsAtPosition(F('Probe.rozie'), g, {})?.entries ?? []).map(e => e.name).sort();
  check('completion lists count, disabled, label',
    ['count', 'disabled', 'label'].every(n => names.includes(n)), `got: ${names.join(', ') || '(none)'}`);
  check('  ...and nothing else (no leaked internals)',
    names.join(',') === 'count,disabled,label', `got: ${names.join(', ')}`);
}

console.log(`\n${'='.repeat(62)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(62)}\n`);
process.exit(fail === 0 ? 0 : 1);
