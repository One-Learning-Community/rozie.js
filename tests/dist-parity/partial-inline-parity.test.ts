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
 * The two components differ ONLY by their COMPONENT IDENTITY, which manifests
 * in the emitted output in three deterministic, content-INDEPENDENT forms:
 *
 *   1. the PascalCase identifier token (`PartialInlineHost` / `InlineEquivHost`);
 *   2. the kebab-case element selector / custom-element tag
 *      (`rozie-partial-inline-host` / `rozie-inline-equiv-host` — lit/angular);
 *   3. the 8-hex scoped-CSS hash `data-rozie-s-<hash>`, which is
 *      `fnv1a32Hex(basename::componentName)` (computeScopeHash) — a digest of
 *      the component's name + filename, NOT of any script/template content.
 *
 * We canonicalize ALL THREE identity manifestations to shared placeholders and
 * assert EVERY OTHER BYTE matches, per target. This is NOT loosening the
 * matcher: all three tokens are pure functions of the component's NAME/FILENAME,
 * so a real difference in the inlined SCRIPT or TEMPLATE still surfaces as a byte
 * diff and fails the assertion. (The Wave-0 belief that omitting a <style> block
 * removes the scope attribute was incorrect — the `data-rozie-s-<hash>` attribute
 * is emitted on every element regardless of whether a <style> block exists, so
 * the hash must be normalized, not avoided.)
 *
 * Un-skipped in Plan 05 once the inline pass (Plans 02–04) blesses the fixtures.
 * Authored at Wave 0 so the runnable assertion of the feature's north star
 * existed before any implementation (Nyquist).
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
const KEBAB_PLACEHOLDER = '__rozie-host__';
const SCOPE_PLACEHOLDER = '__SCOPE__';

/** PascalCase → kebab-case, matching the emitter's element-name derivation. */
function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

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
 * Canonicalize the three component-IDENTITY manifestations (PascalCase token,
 * `rozie-<kebab>` selector, `data-rozie-s-<hash>` scope hash) so the two
 * fixtures can be compared byte-for-byte. Every OTHER byte must already match —
 * the script/template content is untouched by this normalization, so a real
 * inline-pass divergence still fails the assertion.
 *
 * The bare kebab class (`partial-inline-host`) is a LITERAL template class
 * identical in both fixtures and is deliberately NOT normalized — only the
 * `rozie-`-prefixed element selector/custom-element form is canonicalized.
 */
function normalizeName(code: string, name: string): string {
  return code
    .split(name)
    .join(PLACEHOLDER)
    .split(`rozie-${kebabCase(name)}`)
    .join(`rozie-${KEBAB_PLACEHOLDER}`)
    .replace(/data-rozie-s-[0-9a-f]{8}/g, `data-rozie-s-${SCOPE_PLACEHOLDER}`);
}

describe('Phase 54 — inline-vs-partial byte-identity', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('partial-inlined host === inline-equivalent host (component identity normalized)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST, target), PARTIAL_HOST);
      const inline = normalizeName(loadFixture(INLINE_HOST, target), INLINE_HOST);
      expect(partial).toBe(inline);
    });
  });
});

/**
 * Phase 55 (script-partial-literal-byte-identity) — LITERAL byte-identity gate.
 *
 * The Phase 54 oracle above uses COMMENT-FREE helpers, so it stays 6/6 green with
 * or without the emit-line decoupling and CANNOT catch the comment/blank-line
 * drift this phase exists to close (Research Pitfall 3). This describe pins the
 * comment-bearing pair:
 *
 *   • examples/PartialInlineHostC.rozie — imports `{ usedName }` from the sibling
 *     ./partialLogicC.rzts (the compiler inlines it pre-lowering); the partial
 *     carries leading / between-statement / trailing comments on its surviving
 *     declarations.
 *   • examples/InlineEquivHostC.rozie — the SAME logic + comments written inline.
 *
 * We reuse `normalizeName` VERBATIM — it canonicalizes only the three
 * content-INDEPENDENT identity tokens (PascalCase name, `rozie-<kebab>` selector,
 * `data-rozie-s-<hash>`), so any comment/blank-line drift in the spliced script
 * still surfaces as a byte diff and fails. normalizeName is NOT loosened.
 *
 * SKIPPED in Plan 01: un-skip in Plan 02 after normalizeSplicedEmitLines lands —
 * this is the literal byte-identity gate (comments/blank lines INCLUDED) that
 * fails today. The HostC fixtures are not yet blessed (Plan 02 blesses them after
 * the seam), so loadFixture would also miss until then.
 */
const PARTIAL_HOST_C = 'PartialInlineHostC';
const INLINE_HOST_C = 'InlineEquivHostC';

describe('Phase 55 — comment-bearing inline-vs-partial literal byte-identity', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('comment-bearing partial-inlined host === inline-equivalent host (literal, comments/blank lines included)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_C, target), PARTIAL_HOST_C);
      const inline = normalizeName(loadFixture(INLINE_HOST_C, target), INLINE_HOST_C);
      expect(partial).toBe(inline);
    });
  });
});

/**
 * Phase 55 quick-task (WR-01) — HETEROGENEOUS-BLOCK literal byte-identity gate.
 *
 * The Phase 54/55 pairs above each splice a FLAT partial whose imports are either
 * already in the host (zero fresh hoists) or trivially contiguous with its decls,
 * so neither catches the WR-01 over-shift: a single SplicedEmitBlock that groups a
 * FRESH file-top hoist together with decls from TWO different source files (a
 * partial-of-partial) under ONE constant offset. On whole-program targets (Solid),
 * whose blank-line math reads `loc` deltas across the entire program, that
 * over-shifts the first spliced decl and corrupts the nested↔parent boundary —
 * inserting a spurious blank line the inline oracle does not have.
 *
 *   • examples/PartialInlineHostD.rozie — imports `{ outer }` from
 *     ./partialOuterD.rzts, which freshly hoists `{ clampD }` from a plain .js
 *     module AND imports `{ inner }` from ./partialInnerD.rzts (nested).
 *   • examples/InlineEquivHostD.rozie   — the SAME logic + fresh hoist + nested
 *     helper written inline (the byte-identity oracle).
 *
 * Reuses `normalizeName` VERBATIM (only the three content-INDEPENDENT identity
 * tokens are canonicalized), so the spurious blank line still surfaces as a byte
 * diff and fails. Solid is the load-bearing cell; all six are asserted.
 */
const PARTIAL_HOST_D = 'PartialInlineHostD';
const INLINE_HOST_D = 'InlineEquivHostD';

describe('WR-01 — heterogeneous-block (fresh hoist + nested partial) literal byte-identity', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('heterogeneous-block partial-inlined host === inline-equivalent host (literal, Solid included)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_D, target), PARTIAL_HOST_D);
      const inline = normalizeName(loadFixture(INLINE_HOST_D, target), INLINE_HOST_D);
      expect(partial).toBe(inline);
    });
  });
});
