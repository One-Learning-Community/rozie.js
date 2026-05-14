/**
 * Phase 7 Plan 03 — 6-class slot acceptance matrix (QA-02 / ROADMAP SC#3).
 *
 * Compiles each of the 6 minimal single-class slot fixtures to every target and
 * asserts:
 *   (a) `compile()` emits zero `severity: 'error'` diagnostics for the cell
 *       (the established no-throw gate — solid-lint.test.ts L55, parity.test.ts
 *       L138), and
 *   (b) the emitted code matches the per-target `expected.<ext>` snapshot via
 *       `toMatchFileSnapshot`.
 *
 * The 6 slot classes each exercise a different SlotDecl field (D-18, locked
 * Phase 2):
 *   default-slot              → default-slot encoding (empty-string sentinel)
 *   named-slots               → SlotDecl.name
 *   scoped-params             → SlotDecl.params
 *   default-content-fallback  → SlotDecl.defaultContent
 *   presence-check            → SlotDecl.presence ('conditional')
 *   nested-slots              → SlotDecl.nestedSlots
 *
 * DOCUMENTED COMPROMISES (D-05 / RESEARCH Pitfall 6): the `scoped-params` ×
 * `react` and `scoped-params` × `lit` snapshots ASSERT the documented
 * render-prop / `data-rozie-params` output — those are expected-correct, not
 * failures. The suite passes WITH those compromises present.
 *
 * Angular column: 07-ANGULAR-SPIKE.md `Decision: ANGULAR IN` — all 6 targets
 * stay (6 fixtures × 6 targets = 36 cells).
 *
 * Snapshot discipline (RESEARCH Anti-Patterns / threat T-07-10): the
 * `expected.*` snapshots were seeded once with `-u`, hand-reviewed to confirm
 * they capture the documented slot behavior, then committed. The suite is then
 * re-run WITHOUT `-u` against the frozen snapshots. A blanket `-u` after the
 * seed step is forbidden — a blessed snapshot only changes through a conscious,
 * reviewed update.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, 'fixtures');

// Angular IN per 07-ANGULAR-SPIKE.md `Decision: ANGULAR IN`.
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

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

describe('QA-02 — 6-class slot acceptance matrix', () => {
  describe.each(FIXTURE_DIRS)('%s', (slotClass) => {
    const source = readFileSync(
      join(FIXTURES_DIR, slotClass, 'input.rozie'),
      'utf8',
    );

    describe.each(TARGETS)('%s target', (target) => {
      it('compiles error-free and matches the expected slot snapshot', async () => {
        const result = compile(source, {
          target,
          filename: `${slotClass}.rozie`,
          types: true,
          sourceMap: false,
        });

        // (a) the established no-throw gate — zero error-severity diagnostics.
        const errors = result.diagnostics.filter(
          (d) => d.severity === 'error',
        );
        expect(errors).toEqual([]);

        // (b) the emitted code matches the per-target frozen snapshot. For the
        // scoped-params × react and scoped-params × lit cells the snapshot
        // captures the DOCUMENTED render-prop / data-rozie-params compromise
        // output (D-05) — that is expected-correct.
        await expect(result.code).toMatchFileSnapshot(
          join(FIXTURES_DIR, slotClass, `expected${primaryExt(target)}`),
        );
      });
    });
  });
});
