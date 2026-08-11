/**
 * generated-entries.test.ts — closes the ten deferred COVERAGE-GAPs' first
 * prerequisite (G-01, G-09) at the codegen-artifact level, quick-task
 * 260811-9qe.
 *
 * Prior to this suite `src/variants/*.rozie` were written to disk by
 * codegen.mjs's `main()` but had NO test asserting they stay byte-identical
 * to their source of truth, and the `/auto` entry's registration semantics —
 * "one `registerables` spread covers the whole shipped variant set" — had
 * never been executed against the real `chart.js` engine. Four groups:
 *
 *   (a) Variant-source drift. Every `src/variants/<Name>.rozie` on disk must
 *       equal `makeVariantSource(source, variant)` exactly — the SAME
 *       transform the six leaves compile from (`scripts/codegen.mjs`
 *       `main()`), so a runtime pass on the materialized file is a runtime
 *       pass on what ships.
 *   (b) No orphans. `src/variants/*.rozie` file count === `VARIANTS.length`,
 *       so removing a chart type from the list can't leave a stale
 *       mountable source behind.
 *   (c) `/auto` registration semantics, executed against the real `chart.js`
 *       devDependency. Vitest isolates module registries per test FILE, and
 *       no other test in this file imports chart.js beforehand, so a genuine
 *       before/after registration state is observable in one file. This
 *       proves the claim the generated `/auto` entries actually make.
 *   (d) Six-entry pin. Every leaf's generated `src/auto.ts` carries the
 *       registerables-spread registration + the barrel re-export (and the
 *       default re-export on the five non-angular leaves), ties (c)'s
 *       verified semantics to the artifacts that actually ship.
 *
 * LIMITATION (stated honestly): the true end-to-end path — importing
 * `@rozie-ui/chartjs-<fw>/auto` in a browser with that framework's runtime —
 * is NOT executed here; it needs six framework runtimes plus built dists.
 * What IS executed: the registration semantics against the real engine
 * (group c) plus a structural pin of all six generated entries (group d).
 *
 * Pure GLUE over @rozie/core + the family's own codegen.mjs — no
 * compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VARIANTS, TARGETS, makeVariantSource } from '../scripts/codegen.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = resolve(ROOT, 'src', 'Chart.rozie');
const VARIANTS_DIR = resolve(ROOT, 'src', 'variants');
const source = readFileSync(SRC, 'utf8');

describe('generated variant sources (src/variants/*.rozie)', () => {
  it.each(VARIANTS.map((v) => v.name))(
    '%s.rozie on disk is byte-identical to makeVariantSource(source, variant) — the variant sources are GENERATED; re-run the family build (pnpm --filter @rozie-ui/chartjs build) rather than editing them',
    (name) => {
      const variant = VARIANTS.find((v) => v.name === name);
      const expected = makeVariantSource(source, variant);
      const actual = readFileSync(resolve(VARIANTS_DIR, `${name}.rozie`), 'utf8');
      expect(actual).toBe(expected);
    },
  );

  it('src/variants/ contains exactly VARIANTS.length .rozie files (no orphans)', () => {
    const files = readdirSync(VARIANTS_DIR).filter((f) => f.endsWith('.rozie'));
    expect(files.length).toBe(VARIANTS.length);
  });
});

describe('/auto registration semantics (real chart.js)', () => {
  // Order matters: the pre-registration assertion MUST run first in this
  // file — vitest isolates the module registry per test file, and nothing
  // else here imports chart.js before this test does, so `Chart.registry` is
  // genuinely empty at this point.
  it('BEFORE registration: a variant controller lookup throws for every shipped type', async () => {
    const { Chart } = await import('chart.js');
    for (const v of VARIANTS) {
      expect(
        () => Chart.registry.getController(v.type),
        `expected "${v.type}" to be unregistered before the /auto registration statement runs`,
      ).toThrow();
    }
  });

  it('AFTER registration: every VARIANTS[].type resolves to a controller', async () => {
    // Apply the EXACT statement the generated `/auto` entries carry
    // (see codegen.mjs main(): `ChartJS.register(...registerables)`).
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    for (const v of VARIANTS) {
      const controller = Chart.registry.getController(v.type);
      expect(controller, `expected "${v.type}" to resolve after registerables registration`).toBeDefined();
      expect(controller.id).toBe(v.type);
    }
  });
});

describe('six-entry pin (generated packages/<dir>/src/auto.ts)', () => {
  const REG_STATEMENT = 'ChartJS.register(...registerables)';
  const BARREL_STAR = "export * from './index';";
  const DEFAULT_REEXPORT = "export { default } from './index';";

  it.each(Object.entries(TARGETS))('%s: auto.ts registers the kitchen sink + re-exports the barrel', (target, cfg) => {
    const autoPath = resolve(ROOT, 'packages', cfg.dir, 'src', 'auto.ts');
    const contents = readFileSync(autoPath, 'utf8');

    expect(contents, `${target} auto.ts missing the registerables-spread registration`).toContain(REG_STATEMENT);
    expect(contents, `${target} auto.ts missing the barrel star re-export`).toContain(BARREL_STAR);

    if (cfg.exportStyle === 'named') {
      // Angular: named class export, no default to re-export.
      expect(contents, 'angular auto.ts should NOT carry a default re-export').not.toContain(DEFAULT_REEXPORT);
    } else {
      expect(contents, `${target} auto.ts missing the default re-export`).toContain(DEFAULT_REEXPORT);
    }
  });
});
