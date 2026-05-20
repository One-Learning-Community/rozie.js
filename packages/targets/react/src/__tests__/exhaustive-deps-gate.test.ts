/**
 * Plan 04-06 Task 3 — REACT-T-05 / D-62 hard gate.
 *
 * Companion to fixturesLintCheck.test.ts (Plan 04-04) which runs the actual
 * eslint pass. This file enforces TWO additional invariants the project relies
 * on:
 *
 *   1. Only TARGETED, justified `eslint-disable` directives in emitted output
 *      (D-62, relaxed 260519 linechart-watch-recreate Round 4). The compiler
 *      MUST NOT paper over exhaustive-deps failures with a blanket disable —
 *      but a rule-specific, line-scoped `// eslint-disable-line
 *      react-hooks/exhaustive-deps` on an intentional mount-once / getter-
 *      scoped $watch useEffect IS permitted: React provides no other way to
 *      express an intentional `[]`, and the directive is exactly what a
 *      careful React dev hand-writes. Blanket file/block disables and disables
 *      for any OTHER rule remain forbidden.
 *
 *   2. ALL 5 reference fixtures (Counter/SearchInput/Dropdown/TodoList/Modal)
 *      have a corresponding .tsx.snap on disk. If a future plan removes one
 *      of the reference examples, this test fails — preventing silent gaps in
 *      the SC2 coverage matrix.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../../fixtures');

const REQUIRED_FIXTURES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
] as const;

// The ONLY eslint directive the emitter is permitted to produce (D-62 relaxed):
// a line-scoped disable naming exactly `react-hooks/exhaustive-deps`.
const ALLOWED_DIRECTIVE = /\/\/ eslint-disable-line react-hooks\/exhaustive-deps$/;

describe('Phase 4 SC2 / REACT-T-05 / D-62 — exhaustive-deps fixture gate', () => {
  it.each(REQUIRED_FIXTURES)('%s.tsx.snap exists (SC2 coverage gate)', (name) => {
    const path = resolve(FIXTURES, `${name}.tsx.snap`);
    expect(
      existsSync(path),
      `Missing fixture ${name}.tsx.snap — Phase 4 SC2 requires all 5 reference examples to have an emitted .tsx fixture`,
    ).toBe(true);
  });

  it.each(REQUIRED_FIXTURES)('%s.tsx.snap carries ONLY targeted exhaustive-deps disables (D-62 relaxed)', (name) => {
    const path = resolve(FIXTURES, `${name}.tsx.snap`);
    const src = readFileSync(path, 'utf8');
    // Every line that mentions `eslint-disable` MUST be the exact targeted
    // `eslint-disable-line react-hooks/exhaustive-deps` form. A blanket
    // `/* eslint-disable */`, a whole-file disable, or a disable for any
    // other rule fails the gate.
    for (const line of src.split('\n')) {
      if (!line.includes('eslint-disable')) continue;
      expect(
        ALLOWED_DIRECTIVE.test(line.trimEnd()),
        `${name}.tsx.snap has a non-targeted eslint-disable — D-62 (relaxed) permits ONLY ` +
          `\`// eslint-disable-line react-hooks/exhaustive-deps\`. Offending line: ${line.trim()}`,
      ).toBe(true);
    }
  });
});
