/**
 * Plan 04-04 Task 2 — REACT-T-05 anchor.
 *
 * Programmatic ESLint API run against every emitted fixture .tsx.snap. The
 * D-62 floor (relaxed 260519 linechart-watch-recreate Round 4): the ONLY
 * compiler-emitted `eslint-disable` permitted is a TARGETED, line-scoped
 * `// eslint-disable-line react-hooks/exhaustive-deps` — blanket file/block
 * disables and disables for any other rule are still forbidden. AND
 * `react-hooks/exhaustive-deps: error` passes with `--max-warnings 0`
 * (including zero unused-directive warnings).
 *
 * Lint failures here fail the build — they signal that `Listener.deps` (or
 * `LifecycleHook.setupDeps`) doesn't match what the closure actually reads,
 * or that a targeted disable was emitted on a non-violating effect.
 */
import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../../fixtures');
const ESLINT_CONFIG = resolve(__dirname, '../../eslint.config.js');

// The ONLY eslint directive the emitter is permitted to produce (D-62 relaxed):
// a line-scoped disable naming exactly `react-hooks/exhaustive-deps`.
const ALLOWED_DIRECTIVE = /\/\/ eslint-disable-line react-hooks\/exhaustive-deps$/;

describe('Fixture exhaustive-deps lint (REACT-T-05 / D-62)', () => {
  const snapFiles = readdirSync(FIXTURES).filter((f) => f.endsWith('.tsx.snap'));

  it.each(snapFiles)('%s: only targeted exhaustive-deps disables (D-62 relaxed)', (snapName) => {
    const src = readFileSync(resolve(FIXTURES, snapName), 'utf8');
    // Every line mentioning `eslint-disable` MUST be the exact targeted
    // `eslint-disable-line react-hooks/exhaustive-deps` form.
    for (const line of src.split('\n')) {
      if (!line.includes('eslint-disable')) continue;
      expect(
        ALLOWED_DIRECTIVE.test(line.trimEnd()),
        `${snapName} has a non-targeted eslint-disable — D-62 (relaxed) permits ONLY ` +
          `\`// eslint-disable-line react-hooks/exhaustive-deps\`. Offending line: ${line.trim()}`,
      ).toBe(true);
    }
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
    // Strict gate: zero errors AND zero warnings. eslint v9 surfaces an
    // unused `eslint-disable` directive as a (rule-less) warning, so this
    // also guards the conditional-emission logic — a directive emitted on a
    // non-violating effect would re-fail here.
    const problems = results.flatMap((r) => r.messages);
    if (problems.length > 0) {
      const msg = problems
        .map(
          (e) =>
            `[${e.severity === 2 ? 'ERROR' : 'WARN'}] [${e.ruleId ?? '<no-rule>'}] ` +
            `${snapName}:${e.line}:${e.column} — ${e.message}`,
        )
        .join('\n');
      throw new Error('Lint problems in fixture:\n' + msg);
    }
    expect(problems).toHaveLength(0);
  });
});
