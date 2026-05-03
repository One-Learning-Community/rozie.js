// Phase 4 success criterion 2: every emitted .tsx fixture passes
// react-hooks/exhaustive-deps with --max-warnings 0.
//
// REACT-T-05 + D-62 anchor. The compiler-emitted .tsx files in
// packages/targets/react/fixtures/ are the canonical reference for what
// shape emitReact produces. If exhaustive-deps fails on any of them, the
// emitter is generating code that React's official lint rule considers
// incorrect — a hard FAIL for the project's stated DX guarantee.
//
// We delegate the actual lint to the workspace `lint:fixtures` script
// (packages/targets/react/package.json) by running it via `pnpm exec`.
// This test exists primarily so the exhaustive-deps gate is observable
// alongside the other 7 e2e tests in the Playwright report.
//
// Note: this test is HEAVY (spawns ESLint as a subprocess). Skip it when
// running in --update-snapshots mode or when --grep filters exclude it.
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// repo root is 5 levels up from tests/e2e/
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');

test('All compiler-emitted .tsx fixtures pass react-hooks/exhaustive-deps with --max-warnings 0 (Phase 4 SC2 / REACT-T-05 / D-62)', async () => {
  let exitCode = 0;
  let output = '';
  try {
    output = execSync(
      'pnpm --filter @rozie/target-react run lint:fixtures 2>&1',
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' },
    );
  } catch (err: unknown) {
    const error = err as { status?: number; stdout?: Buffer; stderr?: Buffer };
    exitCode = error.status ?? 1;
    output = (error.stdout?.toString() ?? '') + (error.stderr?.toString() ?? '');
  }
  expect(exitCode, `lint:fixtures exited non-zero — output:\n${output}`).toBe(0);
});
