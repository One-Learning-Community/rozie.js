/**
 * Phase 54 (rozie-script-partials-rzts-rzjs) — inline-vs-partial byte-identity.
 *
 * The north-star invariant of the script-partial feature: the SAME reactive
 * logic written INLINE in a host's <script> vs. extracted into a `.rzts` script
 * partial and imported must produce BYTE-IDENTICAL emitted output on all six
 * targets. This test pins that invariant against the committed fixture pair:
 *
 *   • examples/PartialInlineHost.rozie — imports `{ usedName }` from the sibling
 *     ./partialLogic.rzts (the compiler inlines it pre-lowering).
 *   • examples/InlineEquivHost.rozie  — the SAME logic written inline (oracle).
 *
 * The two components differ ONLY by their component identifier token
 * (`PartialInlineHost` vs `InlineEquivHost`). We normalize that single token to
 * a shared placeholder and assert EVERY OTHER BYTE matches, per target.
 *
 * SKIPPED until Plan 05: the inline pass does not exist yet, so the bootstrap
 * cannot bless PartialInlineHost's fixtures (its `.rzts` import would fail to
 * compile). Plan 05 lands the pass, runs `pnpm --filter dist-parity bootstrap`,
 * and removes the `.skip` here. Authored now (Wave 0) so the runnable assertion
 * of the feature's north star exists before any implementation (Nyquist).
 *
 * Both fixtures deliberately omit a <style> block: the scoped-CSS hash is
 * component-name + filename derived (computeScopeHash), which would inject a
 * name-divergent `[data-rozie-s-<hash>]` attribute the component-name-only
 * normalization could not reconcile. This fixture proves SCRIPT inline parity.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(HERE, 'fixtures');

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const PARTIAL_HOST = 'PartialInlineHost';
const INLINE_HOST = 'InlineEquivHost';
const PLACEHOLDER = '__RozieHost__';

function primaryExt(target: Target): string {
  if (target === 'angular') return '.angular.ts';
  if (target === 'react') return '.tsx';
  if (target === 'solid') return '.solid.tsx';
  if (target === 'lit') return '.lit.ts';
  return `.${target}`;
}

function loadFixture(name: string, target: Target): string {
  return readFileSync(join(FIXTURES_DIR, `${name}${primaryExt(target)}`), 'utf8');
}

/**
 * Normalize ONLY the component identifier token so the two fixtures can be
 * compared byte-for-byte. Every other byte must already match — this is a
 * global replace of the component name, NOT a fuzzy diff.
 */
function normalizeName(code: string, name: string): string {
  return code.split(name).join(PLACEHOLDER);
}

describe.skip('Phase 54 — inline-vs-partial byte-identity (un-skip in Plan 05 after bless)', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('partial-inlined host === inline-equivalent host (component name normalized)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST, target), PARTIAL_HOST);
      const inline = normalizeName(loadFixture(INLINE_HOST, target), INLINE_HOST);
      expect(partial).toBe(inline);
    });
  });
});
