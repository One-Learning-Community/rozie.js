#!/usr/bin/env node
/**
 * lint-fixtures.mjs — Phase 4 fix for the `lint:fixtures` package script.
 *
 * The original script
 *   `eslint fixtures/*.tsx --no-eslintrc --config eslint.config.js \
 *      --rule 'react-hooks/exhaustive-deps: error' --max-warnings 0`
 * had two ESLint v9 incompatibilities:
 *
 *   1. The glob `fixtures/*.tsx` matches zero files. The actual emitter
 *      output lives at `fixtures/*.tsx.snap` — the `.snap` extension lets
 *      vitest's `toMatchFileSnapshot` write/diff in place without colliding
 *      with TypeScript's own `*.tsx` resolution.
 *   2. ESLint v9's flat-config has no rc-cascade, so the `--no-eslintrc`
 *      flag was removed. Passing it now exits non-zero with
 *      "Invalid option '--no-eslintrc'".
 *
 * The exhaustive-deps gate (D-62, REACT-T-05) is the marquee correctness
 * guarantee for the React target — the script must keep working from CI and
 * from the Phase 4 Playwright e2e (`exhaustive-deps.spec.ts`).
 *
 * Approach: invoke the ESLint JS API directly with the eslint.config.js
 * flat-config (which already includes the fixtures/(double-star)/*.tsx.snap
 * glob in its files list). Mirrors src/__tests__/fixturesLintCheck.test.ts
 * so we have one canonical lint pathway shared between test and CLI.
 *
 * Exit codes:
 *   0 — every fixture passes (zero errors, zero warnings)
 *   1 — one or more fixtures has an error or warning
 *   2 — internal failure (no fixtures found, ESLint API threw)
 */
import { ESLint } from 'eslint';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');
const FIXTURES = resolve(PKG_ROOT, 'fixtures');
const ESLINT_CONFIG = resolve(PKG_ROOT, 'eslint.config.js');

async function main() {
  const fixtureNames = readdirSync(FIXTURES).filter((f) => f.endsWith('.tsx.snap'));
  if (fixtureNames.length === 0) {
    process.stderr.write(
      `[lint:fixtures] No fixtures found at ${FIXTURES}/*.tsx.snap — nothing to lint.\n`,
    );
    process.exit(2);
  }

  const eslint = new ESLint({
    overrideConfigFile: ESLINT_CONFIG,
    cwd: PKG_ROOT,
  });

  let totalErrors = 0;
  let totalWarnings = 0;
  const errorMessages = [];

  for (const name of fixtureNames) {
    const src = readFileSync(resolve(FIXTURES, name), 'utf8');
    // ESLint's flat-config matches by file path; the `.snap` extension is
    // not a recognised parser source, so present a synthetic `.tsx` path.
    // The eslint.config.js `files` glob includes both `*.tsx` and
    // `*.tsx.snap` so either form picks up the React/TS rules.
    const syntheticPath = resolve(FIXTURES, name.replace(/\.snap$/, '.lint.tsx'));
    const results = await eslint.lintText(src, { filePath: syntheticPath });

    for (const r of results) {
      for (const m of r.messages) {
        const where = `${name}:${m.line}:${m.column}`;
        const tag = m.severity === 2 ? 'ERROR' : 'WARN ';
        const line = `[${tag}] [${m.ruleId ?? '<no-rule>'}] ${where} — ${m.message}`;
        errorMessages.push(line);
        if (m.severity === 2) totalErrors += 1;
        else totalWarnings += 1;
      }
    }
  }

  if (errorMessages.length > 0) {
    process.stderr.write(errorMessages.join('\n') + '\n');
    process.stderr.write(
      `\n[lint:fixtures] Fixtures linted: ${fixtureNames.length}. Errors: ${totalErrors}. Warnings: ${totalWarnings}.\n`,
    );
    // --max-warnings 0 equivalent: any warning fails the gate.
    process.exit(1);
  }

  process.stdout.write(
    `[lint:fixtures] ${fixtureNames.length} fixtures passed react-hooks/exhaustive-deps cleanly.\n`,
  );
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`[lint:fixtures] internal failure: ${err?.stack ?? err}\n`);
  process.exit(2);
});
