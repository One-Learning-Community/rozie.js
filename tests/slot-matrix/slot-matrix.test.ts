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
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

/**
 * Phase 07.2 — multi-file fixture support.
 *
 * A fixture directory may declare ONE consumer (`input.rozie`) plus optional
 * SIBLING producer files (`producer.rozie`, `wrapper.rozie`, …). When sibling
 * `.rozie` files are present, the runner switches the compile() call to pass:
 *   - filename: absolute path to the consumer's input.rozie (so the resolver
 *     can resolve `./producer.rozie` relative to the fixture dir)
 *   - resolverRoot: absolute path to the fixture directory
 *
 * The IR cache + producer resolver from Plan 07.2-01 then resolves the
 * sibling producer at lowering time so threadParamTypes can flow producer
 * SlotDecl.paramTypes onto the consumer's SlotFillerDecl.paramTypes.
 *
 * Plan 07.2-05 — 3-file fixture support (consumer + wrapper + inner).
 * When the fixture contains a `wrapper.rozie` sibling, the runner ALSO
 * compiles wrapper.rozie per target and snapshots its output against
 * `expected.wrapper.<ext>`. This is the verification surface for slot
 * re-projection (R6) — the wrapper's `<slot>` inside a `<template #...>`
 * fill body emits the per-target re-projection shape (Svelte
 * `{@render parent?.(ctx)}`, React `props.renderX?.(ctx)`, etc.).
 *
 * Wave-1 only covers vue/react/svelte for the consumer-* fixtures. Cells for
 * which the corresponding `expected.<ext>` file is absent are intentionally
 * skipped — Plan 07.2-03 fills the solid/lit/angular tail and creates those
 * expected.* files. Skip is invisible-by-construction: it's a presence test
 * on the snapshot file rather than a per-fixture target deny-list, so the
 * matrix remains DRY as new fixtures are added.
 */
function siblingRozieFiles(slotClass: string): string[] {
  return readdirSync(join(FIXTURES_DIR, slotClass))
    .filter((f) => f.endsWith('.rozie') && f !== 'input.rozie')
    .sort();
}

describe('QA-02 — 6-class slot acceptance matrix', () => {
  describe.each(FIXTURE_DIRS)('%s', (slotClass) => {
    const consumerPath = join(FIXTURES_DIR, slotClass, 'input.rozie');
    const source = readFileSync(consumerPath, 'utf8');
    const siblings = siblingRozieFiles(slotClass);
    const isMultiFile = siblings.length > 0;
    const resolverRoot = join(FIXTURES_DIR, slotClass);

    describe.each(TARGETS)('%s target', (target) => {
      it('compiles error-free and matches the expected slot snapshot', async () => {
        const expectedPath = join(
          FIXTURES_DIR,
          slotClass,
          `expected${primaryExt(target)}`,
        );

        // Multi-file fixtures (consumer + sibling producer) intentionally
        // ship only the Wave-1 (vue/react/svelte) `expected.*` baselines in
        // this plan. Cells whose expected.* file is missing are skipped —
        // Plan 07.2-03 fills the solid/lit/angular tail.
        if (isMultiFile && !existsSync(expectedPath)) {
          // eslint-disable-next-line no-console
          console.log(
            `[slot-matrix] skipping ${slotClass} × ${target} — expected snapshot absent ` +
              `(Plan 07.2-03 will seed solid/lit/angular).`,
          );
          return;
        }

        const result = compile(source, {
          target,
          // Multi-file fixtures need an ABSOLUTE filename so the producer
          // resolver can resolve `./producer.rozie` siblings via the IR
          // cache (Plan 07.2-01). Single-file fixtures keep the relative
          // label they shipped with so source-map paths stay stable.
          filename: isMultiFile ? consumerPath : `${slotClass}.rozie`,
          ...(isMultiFile ? { resolverRoot } : {}),
          types: true,
          sourceMap: false,
        });

        // (a) the established no-throw gate — zero error-severity diagnostics.
        const errors = result.diagnostics.filter(
          (d) => d.severity === 'error',
        );
        expect(errors).toEqual([]);

        // Phase 07.2 Plan 06 — R8 silent-fallback acceptance: when a consumer
        // omits fills, the producer's defaultContent (or empty) renders with
        // ZERO diagnostics — not even warnings. This guard is dedicated to the
        // `consumer-silent-fallback` fixture so that any future regression
        // emitting a ROZ-coded warning on an unfilled slot trips the gate.
        if (slotClass === 'consumer-silent-fallback') {
          expect(result.diagnostics).toEqual([]);
        }

        // (b) the emitted code matches the per-target frozen snapshot. For the
        // scoped-params × react and scoped-params × lit cells the snapshot
        // captures the DOCUMENTED render-prop / data-rozie-params compromise
        // output (D-05) — that is expected-correct.
        await expect(result.code).toMatchFileSnapshot(expectedPath);
      });

      // Phase 07.2 Plan 05 — re-projection (R6) verification surface. When
      // wrapper.rozie is present in the fixture (3-file: inner + wrapper +
      // consumer), also compile the wrapper and snapshot against
      // `expected.wrapper.<ext>`. The wrapper's `<slot>` inside a fill body
      // emits per-target re-projection — this is the cell that proves the
      // sticky-downward `context: 'fill-body'` flag from Plan 07.2-01 routes
      // through the per-target emit correctly.
      it('wrapper.rozie compiles error-free and matches re-projection snapshot', async () => {
        const wrapperPath = join(FIXTURES_DIR, slotClass, 'wrapper.rozie');
        if (!existsSync(wrapperPath)) return; // not a 3-file fixture

        const wrapperExpectedPath = join(
          FIXTURES_DIR,
          slotClass,
          `expected.wrapper${primaryExt(target)}`,
        );
        if (!existsSync(wrapperExpectedPath)) {
          // eslint-disable-next-line no-console
          console.log(
            `[slot-matrix] skipping ${slotClass} wrapper × ${target} — expected snapshot absent.`,
          );
          return;
        }

        const wrapperSource = readFileSync(wrapperPath, 'utf8');
        const wrapperResult = compile(wrapperSource, {
          target,
          filename: wrapperPath,
          resolverRoot,
          types: true,
          sourceMap: false,
        });

        const wrapperErrors = wrapperResult.diagnostics.filter(
          (d) => d.severity === 'error',
        );
        expect(wrapperErrors).toEqual([]);

        await expect(wrapperResult.code).toMatchFileSnapshot(wrapperExpectedPath);
      });
    });
  });
});
