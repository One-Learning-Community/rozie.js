/**
 * Plan 04-04 Task 2 — REACT-T-05 anchor.
 *
 * Programmatic ESLint API run against every emitted fixture .tsx.snap. The
 * D-62 floor: NO compiler-emitted `eslint-disable` comments anywhere, AND
 * `react-hooks/exhaustive-deps: error` passes with `--max-warnings 0`.
 *
 * Lint failures here fail the build — they signal that `Listener.deps` (or
 * `LifecycleHook.setupDeps`) doesn't match what the closure actually reads.
 */
import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../../fixtures');
const ESLINT_CONFIG = resolve(__dirname, '../../eslint.config.js');

describe('Fixture exhaustive-deps lint (REACT-T-05 / D-62)', () => {
  const snapFiles = readdirSync(FIXTURES).filter((f) => f.endsWith('.tsx.snap'));

  it.each(snapFiles)('%s: no eslint-disable comments (D-62)', (snapName) => {
    const src = readFileSync(resolve(FIXTURES, snapName), 'utf8');
    expect(src).not.toMatch(/eslint-disable/);
  });

  it.each(snapFiles)('%s: passes react-hooks/exhaustive-deps lint', async (snapName) => {
    const eslint = new ESLint({
      overrideConfigFile: ESLINT_CONFIG,
      cwd: resolve(__dirname, '../..'),
    });
    const src = readFileSync(resolve(FIXTURES, snapName), 'utf8');
    // Tell ESLint the file pretends to be a .tsx so the flat-config glob
    // matches. The real on-disk file is named *.tsx.snap so we provide a
    // synthetic filePath that matches the eslint.config.js glob.
    const results = await eslint.lintText(src, {
      filePath: resolve(FIXTURES, snapName.replace(/\.snap$/, '.lint.tsx')),
    });
    const errs = results.flatMap((r) => r.messages.filter((m) => m.severity === 2));
    if (errs.length > 0) {
      const msg = errs
        .map((e) => `[${e.ruleId}] ${snapName}:${e.line}:${e.column} — ${e.message}`)
        .join('\n');
      throw new Error('Lint errors in fixture:\n' + msg);
    }
    expect(errs).toHaveLength(0);
  });
});
