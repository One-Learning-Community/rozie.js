/**
 * Plan 04-06 Task 3 — REACT-T-05 / D-62 hard gate.
 *
 * Companion to fixturesLintCheck.test.ts (Plan 04-04) which runs the actual
 * eslint pass. This file enforces TWO additional invariants the project relies
 * on:
 *
 *   1. NO `eslint-disable` comment in ANY emitted .tsx fixture (D-62 absolute
 *      rule). The compiler MUST NOT paper over exhaustive-deps failures.
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

describe('Phase 4 SC2 / REACT-T-05 / D-62 — exhaustive-deps fixture gate', () => {
  it.each(REQUIRED_FIXTURES)('%s.tsx.snap exists (SC2 coverage gate)', (name) => {
    const path = resolve(FIXTURES, `${name}.tsx.snap`);
    expect(
      existsSync(path),
      `Missing fixture ${name}.tsx.snap — Phase 4 SC2 requires all 5 reference examples to have an emitted .tsx fixture`,
    ).toBe(true);
  });

  it.each(REQUIRED_FIXTURES)('%s.tsx.snap contains NO eslint-disable comments (D-62 absolute rule)', (name) => {
    const path = resolve(FIXTURES, `${name}.tsx.snap`);
    const src = readFileSync(path, 'utf8');
    expect(
      src,
      `${name}.tsx.snap contains an eslint-disable comment — D-62 forbids this. The emitter MUST produce code that passes exhaustive-deps cleanly.`,
    ).not.toMatch(/eslint-disable/);
  });
});
