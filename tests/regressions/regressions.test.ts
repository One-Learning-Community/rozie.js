/**
 * Phase 7 Plan 05 — `tests/regressions/` fixture-driven regression suite (QA-01).
 *
 * The permanent v1 trust floor: one fixture per closed compiler bug from
 * Phases 1-7. Each fixture is a minimal `.rozie` reproduction that, before its
 * fix, mis-compiled or crashed; the committed `expected.<ext>` snapshot is the
 * known-correct POST-FIX emitter output.
 *
 * Fixture layout (RESEARCH Pattern 4 — per-bug subdirectory):
 *   fixtures/<slug>/
 *     input.rozie     — the minimal reproduction
 *     meta.json       — { id, source, sourceKind, phase, desc, targets, discoveredBy }
 *     expected.<ext>  — per-target frozen snapshot (one per meta.targets entry)
 *
 * The walker reads each fixture dir, compiles `input.rozie` once per
 * `meta.targets` entry, and asserts:
 *   (a) zero `severity: 'error'` diagnostics (the established no-throw gate —
 *       solid-lint.test.ts L55, parity.test.ts L138), and
 *   (b) `toMatchFileSnapshot` against the per-target `expected.<ext>` snapshot.
 *
 * Snapshot discipline (same hazard as slot-matrix / threat T-07-10): the
 * `expected.*` snapshots were seeded once with `-u`, hand-reviewed to confirm
 * they capture the CORRECT post-fix emitter output (not the historical buggy
 * output), then committed. The suite is then re-run WITHOUT `-u` against the
 * frozen snapshots. A blanket `-u` is forbidden — a fixture whose snapshot
 * captures buggy output is worse than no fixture.
 *
 * D-08: every Phase 7 bug-fix loop fix lands a fixture here in the SAME commit
 * as the fix (sourceKind: "phase-7-loop").
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, 'fixtures');

type Target = 'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit';

interface FixtureMeta {
  id: string;
  source: string;
  sourceKind: 'commit' | 'uat-doc' | 'deviation-log' | 'phase-7-loop';
  phase: string;
  desc: string;
  targets: Target[];
  discoveredBy: string;
}

/** Per-target snapshot extension — matches tests/dist-parity primaryExt(). */
function primaryExt(target: Target): string {
  if (target === 'angular') return '.angular.ts';
  if (target === 'react') return '.tsx';
  if (target === 'solid') return '.solid.tsx';
  if (target === 'lit') return '.lit.ts';
  return `.${target}`;
}

const FIXTURE_DIRS = readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

describe('QA-01 — historical + Phase-7-loop regression fixtures', () => {
  describe.each(FIXTURE_DIRS)('%s', (slug) => {
    const meta = JSON.parse(
      readFileSync(join(FIXTURES_DIR, slug, 'meta.json'), 'utf8'),
    ) as FixtureMeta;
    const source = readFileSync(
      join(FIXTURES_DIR, slug, 'input.rozie'),
      'utf8',
    );

    describe.each(meta.targets)('%s target', (target) => {
      it(`${meta.id} — ${meta.desc}`, async () => {
        const result = compile(source, {
          target,
          filename: `${slug}.rozie`,
          types: true,
          sourceMap: false,
        });

        // (a) the established no-throw gate — zero error-severity diagnostics.
        const errors = result.diagnostics.filter(
          (d) => d.severity === 'error',
        );
        expect(errors).toEqual([]);

        // (b) the emitted code matches the per-target frozen snapshot — the
        // known-correct POST-FIX output for this historical bug.
        await expect(result.code).toMatchFileSnapshot(
          join(FIXTURES_DIR, slug, `expected${primaryExt(target)}`),
        );
      });
    });
  });
});
