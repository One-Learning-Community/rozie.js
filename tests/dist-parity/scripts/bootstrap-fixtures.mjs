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
// Phase 07.2 Plan 06 — EXAMPLES extended 8 → 9 with ModalConsumer (the
// consumer-side dogfood that exercises Modal's named + scoped slots).
// Multi-rozie examples (those referencing sibling .rozie producers via
// <components>) get an absolute filename + resolverRoot below so the IR
// cache + ProducerResolver can locate the sibling producers at compile time.
// Phase 07.3 Plan 09 — EXAMPLES extended 9 → 10 with WrapperModal so the
// consumer-side `r-model:open="$props.open"` forwarding pattern is byte-
// locked across all 4 entrypoints (compile/cli/babel/unplugin).
const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
  'ModalConsumer',
  'WrapperModal',
];

const EXAMPLES_NEEDING_RESOLVER_ROOT = new Set(['ModalConsumer', 'WrapperModal']);
// Phase 06.4 P3 (D-LIT-22): TARGETS extended with 'lit' — additive only.
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

/** D-93 fixture extension table. */
function primaryExt(target) {
  if (target === 'angular') return '.angular.ts';
  if (target === 'react') return '.tsx';
  if (target === 'solid') return '.solid.tsx';
  if (target === 'lit') return '.lit.ts';
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
    // Phase 07.2 Plan 06 — multi-rozie examples need absolute filename +
    // resolverRoot so the IR cache + ProducerResolver locate sibling
    // .rozie producers (verified empirically that absolute-filename for
    // single-file examples is byte-equal to the relative form).
    const needsResolver = EXAMPLES_NEEDING_RESOLVER_ROOT.has(name);
    const result = compile(source, {
      target,
      filename: needsResolver ? sourcePath : `${name}.rozie`,
      ...(needsResolver ? { resolverRoot: resolve(ROOT, 'examples') } : {}),
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
