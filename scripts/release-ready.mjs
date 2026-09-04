#!/usr/bin/env node
// @ts-check
//
// release-ready.mjs — thin COMPOSER for `pnpm release:ready`, the fast,
// registry-free release gate. Quick task 260904-6ix.
//
// WHY A SEPARATE COMPOSER, NOT A `&&` CHAIN IN package.json: a `&&` chain
// short-circuits — a release-precheck failure would hide a
// check-readme-jsx-props failure, and the whole point of this command is a
// single readable verdict, not a first-failure-wins race. This script runs
// BOTH gates unconditionally, always, regardless of the first result, then
// prints one summary.
//
// All check LOGIC stays in scripts/release-precheck.mjs (and
// scripts/check-readme-jsx-props.mjs) — this file only sequences the fast
// gates and prints a per-gate PASS/FAIL summary, the OK/WARN/FAIL category
// histogram RELEASING.md §3/§7 already teach people to read, an explicit
// note that the registry-dependent checks (a) version-vs-npm and (f)
// published-tarball drift were NOT run (they live behind `--gate` /
// `--tarball`, run locally pre-dispatch — see RELEASING.md §4), and a final
// RELEASE READY: PASS / RELEASE READY: FAIL verdict.
//
// Zero new deps. ESM. Node 20+. import.meta.url-anchored root — the repo's
// check-*.mjs convention.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runGate(label, args) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`GATE: ${label} — node ${args.join(' ')}`);
  console.log('='.repeat(70));
  const r = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  const out = r.stdout || '';
  const err = r.stderr || '';
  if (out) process.stdout.write(out);
  if (err) process.stderr.write(err);
  return { label, status: r.status, stdout: out, stderr: err, pass: r.status === 0 };
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rozie-release-ready-'));
  const summaryFile = path.join(tmp, 'release-precheck-summary.json');
  let gates;
  try {
    gates = [
      runGate('release-precheck (--skip-npm)', [
        path.join(REPO_ROOT, 'scripts', 'release-precheck.mjs'),
        '--skip-npm',
        '--json-summary',
        summaryFile,
      ]),
      runGate('check-readme-jsx-props', [path.join(REPO_ROOT, 'scripts', 'check-readme-jsx-props.mjs')]),
    ];

    let precheckSummary = null;
    try {
      precheckSummary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
    } catch {
      /* release-precheck crashed before writing the summary — the gate's own
         PASS/FAIL line below still reflects reality via its exit code. */
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('RELEASE READY — summary');
    console.log('='.repeat(70));

    for (const g of gates) {
      console.log(`  [${g.pass ? 'PASS' : 'FAIL'}] ${g.label}`);
    }

    // Surface the no-major preflight and changeset private-package guard
    // lines explicitly — repo-wide gates, not rows in release-precheck's
    // per-package table, so they would otherwise be buried in the
    // scrollback above.
    const precheckOut = gates[0].stdout.split('\n');
    const changesetLine = precheckOut.find((l) => l.includes('changeset private-package guard:'));
    const noMajorLine = precheckOut.find((l) => l.includes('no-major preflight:'));
    if (changesetLine) console.log(`    -> ${changesetLine.trim()}`);
    if (noMajorLine) console.log(`    -> ${noMajorLine.trim()}`);

    if (precheckSummary) {
      const h = precheckSummary.verdictHistogram || {};
      console.log(
        `  per-package verdicts (${precheckSummary.scopeCount} publishable package(s)): ` +
          `OK=${h.OK || 0} WARN=${h.WARN || 0} FAIL=${h.FAIL || 0}`,
      );
    }

    console.log('');
    console.log(
      '  NOT run: (a) version-vs-npm, (f) published-tarball drift — registry-dependent,',
    );
    console.log('  run LOCALLY pre-dispatch via `pnpm release:precheck --gate` (RELEASING.md §4).');

    const anyFail = gates.some((g) => !g.pass);
    console.log('');
    if (anyFail) {
      console.log('RELEASE READY: FAIL');
      process.exit(1);
    }
    console.log('RELEASE READY: PASS');
    process.exit(0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
