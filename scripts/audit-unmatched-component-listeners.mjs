#!/usr/bin/env node
// scripts/audit-unmatched-component-listeners.mjs — quick task 260812-i67.
//
// THE GATE: the two new event-name diagnostics (ROZ997
// EMIT_NAME_CANONICAL_COLLISION, ROZ998 UNMATCHED_COMPONENT_LISTENER) must
// fire ZERO times across the existing corpus — every `.rozie` under
// packages/ui/ and examples/, compiled once per target for all six targets.
// A hit is either (a) a genuinely native / Rozie-synthetic event name missing
// from the nativeDomEvents allowlist (fix the allowlist, with a source note),
// (b) a REAL authoring mistake in the corpus (a finding — report it, never
// silently patch corpus source), or (c) a bug in the check itself. The script
// exits non-zero when any ROZ997/ROZ998 is found.
//
// Diagnostics of any OTHER code are summarized as a count only and never fail
// this script — pre-existing corpus diagnostics are out of scope; this gate is
// about the two new codes.
//
// Run from the repo root AFTER a core build (`pnpm turbo run build --filter
// @rozie/core`): the script consumes packages/core/dist, not src.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = await import(
  new URL('../packages/core/dist/index.mjs', import.meta.url).href
);
const { compile } = core;

const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];
const GATED_CODES = new Set(['ROZ997', 'ROZ998']);

/** Recursively collect .rozie files, skipping node_modules and dist. */
function collectRozie(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectRozie(full, out);
    else if (entry.endsWith('.rozie')) out.push(full);
  }
  return out;
}

const files = [
  ...collectRozie(path.join(ROOT, 'packages/ui'), []),
  ...collectRozie(path.join(ROOT, 'examples'), []),
].sort();

let compiles = 0;
let crashes = 0;
const otherCodeCounts = new Map(); // code -> count
const gatedHits = []; // { file, target, code, message }

for (const target of TARGETS) {
  // One IRCache per target amortizes producer parse+lower across the corpus
  // (compile() accepts a pre-built cache — the Phase 07.2 D-01 surface).
  const cache = new core.IRCache({
    modifierRegistry: core.createDefaultRegistry(),
  });
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    let result;
    try {
      result = compile(source, {
        target,
        filename: file,
        resolverRoot: ROOT,
        irCache: cache,
      });
      compiles++;
    } catch (err) {
      crashes++;
      console.error(`COMPILE CRASH (${target}) ${path.relative(ROOT, file)}: ${err?.message ?? err}`);
      continue;
    }
    for (const d of result.diagnostics) {
      if (GATED_CODES.has(d.code)) {
        gatedHits.push({
          file: path.relative(ROOT, file),
          target,
          code: d.code,
          message: d.message,
        });
      } else {
        otherCodeCounts.set(d.code, (otherCodeCounts.get(d.code) ?? 0) + 1);
      }
    }
  }
}

// Report gated hits grouped by file.
if (gatedHits.length > 0) {
  const byFile = new Map();
  for (const hit of gatedHits) {
    const bucket = byFile.get(hit.file) ?? [];
    bucket.push(hit);
    byFile.set(hit.file, bucket);
  }
  console.error('\n=== ROZ997/ROZ998 HITS (each must be classified, never allowlisted by reflex) ===');
  for (const [file, hits] of byFile) {
    console.error(`\n${file}:`);
    for (const h of hits) {
      console.error(`  [${h.target}] ${h.code}: ${h.message}`);
    }
  }
}

// Other-code summary (informational only — never fails this gate).
if (otherCodeCounts.size > 0) {
  const summary = [...otherCodeCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, n]) => `${code}×${n}`)
    .join(' ');
  console.log(`other-code diagnostics (out of scope, count only): ${summary}`);
}

const roz997 = gatedHits.filter((h) => h.code === 'ROZ997').length;
const roz998 = gatedHits.filter((h) => h.code === 'ROZ998').length;
console.log(
  `AUDIT SUMMARY: ${files.length} files scanned, ${compiles} compiles (${TARGETS.length} targets), ` +
    `${crashes} crashes, ROZ997 hits: ${roz997}, ROZ998 hits: ${roz998}`,
);

if (gatedHits.length > 0) process.exit(1);
