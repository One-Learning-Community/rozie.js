#!/usr/bin/env node
/**
 * Bootstrap canonical fixtures for tests/dist-parity (Plan 06-06 / D-93).
 *
 * Run once when fixtures need refresh after a compiler change:
 *   pnpm --filter dist-parity bootstrap
 *
 * The committed fixture bytes ARE the contract. The parity test compares
 * each entrypoint's output (compile() / CLI / babel-plugin / unplugin) to
 * these exact bytes; any drift is a v1 trust-erosion violation.
 *
 * Trailing-newline normalization (D-93): bytes end with a single LF. If
 * compile()`.code` already ends with LF, write as-is; otherwise append one.
 * NO other normalization (no whitespace stripping, no map ignoring).
 *
 * React-only sidecars (.d.ts / .module.css / .global.css) are written when
 * compile() returns non-empty values for those fields.
 */
import { compile } from '@rozie/core';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const FIXTURES_DIR = resolve(HERE, '../fixtures');

// Phase 06.2 P3 (D-126): EXAMPLES extended 5 → 8 (TreeNode, Card, CardHeader
// added). Modal regenerates per the D-119 retrofit (additive — <components>{
// Counter } block + <Counter /> embed in body content area). Non-Modal
// existing fixtures (Counter / SearchInput / Dropdown / TodoList) MUST stay
// byte-identical — the parity gate enforces that contract automatically.
const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
];
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid'];

/** D-93 fixture extension table. */
function primaryExt(target) {
  if (target === 'angular') return '.angular.ts';
  if (target === 'react') return '.tsx';
  if (target === 'solid') return '.solid.tsx';
  return `.${target}`;
}

function fixturePath(name, target, suffix) {
  const ext = suffix ?? primaryExt(target);
  return resolve(FIXTURES_DIR, `${name}${ext}`);
}

/** D-93: trailing-newline normalize at write-time only. No other processing. */
function normalize(s) {
  return s.endsWith('\n') ? s : `${s}\n`;
}

// Reset fixtures dir so stale outputs cannot linger across compiler changes.
if (existsSync(FIXTURES_DIR)) {
  for (const f of readdirSync(FIXTURES_DIR)) {
    rmSync(resolve(FIXTURES_DIR, f), { recursive: true, force: true });
  }
} else {
  mkdirSync(FIXTURES_DIR, { recursive: true });
}

let written = 0;
for (const name of EXAMPLES) {
  const sourcePath = resolve(ROOT, `examples/${name}.rozie`);
  const source = readFileSync(sourcePath, 'utf8');

  for (const target of TARGETS) {
    // Per Plan 06-06 §<action> Step C: types: true (D-90), sourceMap: false
    // (D-91 / T-06-06-03 — no absolute paths leak into committed bytes).
    const result = compile(source, {
      target,
      filename: `${name}.rozie`,
      types: true,
      sourceMap: false,
    });
    const errs = result.diagnostics.filter((d) => d.severity === 'error');
    if (errs.length > 0) {
      const detail = errs.map((d) => `[${d.code}] ${d.message}`).join('; ');
      throw new Error(`bootstrap-fixtures: compile failed for ${name}/${target}: ${detail}`);
    }

    writeFileSync(fixturePath(name, target), normalize(result.code), 'utf8');
    written++;

    if (target === 'react') {
      if (result.types && result.types.length > 0) {
        writeFileSync(fixturePath(name, target, '.d.ts'), normalize(result.types), 'utf8');
        written++;
      }
      if (result.css && result.css.length > 0) {
        writeFileSync(fixturePath(name, target, '.module.css'), normalize(result.css), 'utf8');
        written++;
      }
      if (result.globalCss && result.globalCss.length > 0) {
        writeFileSync(fixturePath(name, target, '.global.css'), normalize(result.globalCss), 'utf8');
        written++;
      }
    }
    process.stdout.write(`✓ ${name}.${target}\n`);
  }
}

process.stdout.write(`Bootstrap complete: ${written} fixture files written.\n`);
