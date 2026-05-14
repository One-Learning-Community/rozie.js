// Phase 07.1 Plan 03 Task 3 — .d.ts-identity regression guard.
//
// Plan 07.1-02 fixed the type-identity defect: target packages used to inline a
// PRIVATE copy of core's `ModifierRegistry` into their built `dist/index.d.mts`
// (a local `declare class ModifierRegistry { ... }`), so a third-party author's
// `import { ModifierRegistry } from '@rozie/core'` was a DIFFERENT nominal type
// than the one each emitter's options object accepted (TS2345 at the boundary).
//
// The fix redirected every emitter's `ModifierRegistry` import to the
// `@rozie/core` specifier, so the built `.d.mts` now carries
// `import { ModifierRegistry } from "@rozie/core"` and NO local class redeclaration.
//
// This test is the PERMANENT regression guard: if a future refactor reintroduces
// a relative `core/src/...` import of `ModifierRegistry`, tsdown will once again
// inline a `declare class ModifierRegistry` into the target `.d.mts` and this
// test fails.
//
// Defect signature precisely (RESEARCH "the defect, made concrete"):
//   a target `dist/index.d.mts` containing a standalone
//   `declare class ModifierRegistry` — core's `ModifierRegistry` redeclared
//   locally instead of imported.
//
// NOTE on the `//#region` heuristic: tsdown names a bundled region after the
// SOURCE FILE of the first symbol it pulls from that file. `ModifierPipelineEntry`
// (a public `type`, legitimately re-exported) lives in core's
// `ModifierRegistry.d.ts`, so a `//#region ../../core/src/modifiers/ModifierRegistry.d.ts`
// line is present in the CORRECT builds too — it is NOT the defect. The
// load-bearing assertion is the ABSENCE of `declare class ModifierRegistry`
// plus the PRESENCE of the `@rozie/core` import.
//
// This test depends on a prior build — run `pnpm turbo run build` (or
// `pnpm turbo run build --filter './packages/targets/*'`) first. The phase gate
// (Plan 02 Task 4) and `/gsd-verify-work` both rebuild before running tests.
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// tests/plugins/swipe/src/__tests__ -> repo root is 5 levels up.
const REPO_ROOT = resolve(__dirname, '../../../../..');

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

function dtsPathFor(target: string): string {
  return resolve(REPO_ROOT, 'packages/targets', target, 'dist/index.d.mts');
}

describe('Plan 07.1-03 — .d.ts-identity regression guard (T-07.1-10)', () => {
  it.each(TARGETS)(
    '@rozie/target-%s dist/index.d.mts does not inline a private ModifierRegistry class',
    (target) => {
      const dtsPath = dtsPathFor(target);

      // T-07.1-11: FAIL loudly with an explicit build instruction when the
      // artifact is absent — never silently pass on a missing build.
      if (!existsSync(dtsPath)) {
        throw new Error(
          `Missing built declaration file: ${dtsPath}\n` +
            `Run \`pnpm turbo run build --filter './packages/targets/*'\` ` +
            `(or \`pnpm turbo run build\`) before running the .d.ts-identity test.`,
        );
      }

      const content = readFileSync(dtsPath, 'utf8');

      // The defect: core's ModifierRegistry redeclared locally as a private
      // `declare class` copy instead of imported from @rozie/core.
      expect(
        content,
        `@rozie/target-${target} dist/index.d.mts inlines a private ` +
          `\`declare class ModifierRegistry\` — the type-identity defect Plan ` +
          `07.1-02 fixed has regressed. An emitter is relative-importing ` +
          `core/src/modifiers/ModifierRegistry instead of the @rozie/core specifier.`,
      ).not.toMatch(/declare\s+class\s+ModifierRegistry\b/);

      // Positive contract: core's ModifierRegistry must be REFERENCED via an
      // import from the @rozie/core specifier (single nominal identity).
      expect(
        content,
        `@rozie/target-${target} dist/index.d.mts does not import ` +
          `ModifierRegistry from "@rozie/core" — the emitter's registry type ` +
          `is no longer pinned to core's public nominal identity.`,
      ).toMatch(/import\s+(?:type\s+)?\{[^}]*\bModifierRegistry\b[^}]*\}\s+from\s+["']@rozie\/core["']/);
    },
  );

  it('covers all 6 target packages', () => {
    expect(TARGETS).toHaveLength(6);
    expect([...TARGETS].sort()).toEqual(
      ['angular', 'lit', 'react', 'solid', 'svelte', 'vue'],
    );
  });
});
