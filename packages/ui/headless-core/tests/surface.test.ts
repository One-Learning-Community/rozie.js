/**
 * surface.test.ts — Phase 64 P0 cross-package `.rzts` boundary gate as a vitest
 * test (so it runs under `turbo run test`, not just the standalone
 * scripts/compile-headless-core-check.mjs).
 *
 * Re-asserts the SAME boundary proof the .mjs gate checks: a CROSS-PACKAGE
 * bare-specifier `.rzts` partial (`@rozie-ui/headless-core/smoke.rzts`) resolves
 * + inlines (via inlineScriptPartials()) + compiles with ZERO error diagnostics
 * on all 6 targets, the partial decl is spliced into the host body, and the
 * partial DISSOLVES (no surviving runtime import).
 *
 * There is NO component IR here (the partial exports a pure function, not a
 * component) — so unlike the per-family surface gates we assert only the
 * compile×6 zero-error + splice + dissolve contract, not a props/emits/slots
 * surface. Pure GLUE over the @rozie/core public API — no compiler change.
 */
import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
// Synthetic host path INSIDE the package so the package's own `exports` map
// self-resolves the bare specifier (enhanced-resolve self-reference).
const FILENAME = resolve(ROOT, 'scripts', '__smoke-host.rozie');

const BARE_SPECIFIER = '@rozie-ui/headless-core/smoke.rzts';

const source = `<rozie name="HeadlessCoreSmokeHost">
<script lang="ts">
import { headlessCoreSmoke } from '${BARE_SPECIFIER}'
const probe = headlessCoreSmoke(41)
</script>
<template>
  <div data-testid="headless-core-smoke">{{ probe }}</div>
</template>
</rozie>
`;

// Match the import STATEMENT form only — Vue preserves the partial's leading
// comment banner (which mentions the specifier in prose); the import form is the
// true dissolve signal.
const SURVIVING_IMPORT = /from\s*['"]@rozie-ui\/headless-core/;

const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;

describe('headless-core cross-package .rzts boundary (P0)', () => {
  it.each(TARGETS)(
    'compile(%s) resolves + inlines + dissolves the bare-specifier partial with zero errors',
    (target) => {
      const r = compile(source, { target, filename: FILENAME, resolverRoot: ROOT });
      const errs = r.diagnostics.filter((d) => d.severity === 'error');
      expect(errs).toEqual([]);
      expect(r.code.length).toBeGreaterThan(0);
      // The partial decl spliced into host scope.
      expect(r.code).toContain('headlessCoreSmoke');
      expect(r.code).toContain('n + 1');
      // The partial dissolved — no surviving runtime import to headless-core.
      expect(SURVIVING_IMPORT.test(r.code)).toBe(false);
    },
  );
});
