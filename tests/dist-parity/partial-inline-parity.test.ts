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

/**
 * Phase 56 (script-partial-cross-target-comment-placement-parity) — GAP-0 (R2)
 * `originalGap` host-seam GREEN-×6 regression guard.
 *
 * The Phase 54/55 pairs above each place their first spliced declaration ONE blank
 * line below the import region (or trivially contiguous). This describe pins the
 * GAP-0 host-seam shape that exercises the D-02 `originalGap` measurement path: a
 * spliced run whose first declaration sits ZERO blank lines below the HOST body const
 * it is spliced beneath. `measureOriginalGap` reads the partial-local zero-blank
 * delta (`usedFirstF` sits zero blanks below its own hoisted `clamp` import) which —
 * by the extraction rule — equals the host `tickF` → spliced-run delta, so the
 * spliced run flows ZERO blank lines below `tickF` instead of the legacy hardcoded
 * one-blank `+2`.
 *
 *   • examples/PartialInlineHostF.rozie — declares a host const `tickF`, then imports
 *     `{ usedFirstF, usedSecondF }` from the sibling ./partialLogicF.rzts, whose first
 *     surviving decl `usedFirstF` sits ZERO blank lines below the hoisted `clamp`
 *     import (the gap-0 source adjacency).
 *   • examples/InlineEquivHostF.rozie — the SAME logic written inline with the
 *     identical zero-blank adjacency (the byte-identity oracle).
 *
 * This is a GREEN-×6 guard (NOT red→green): the fixtures are COMMENT-FREE on the
 * surviving decls because gap-0's COMMENT byte manifestation is entangled with the
 * per-target comment-placement bugs that plans 56-02/03/04 own. The comment-bearing
 * gap-0 red→green demonstration is DEFERRED to a later comment-fix plan (after
 * 56-02/03/04). This guard isolates the blank-line arithmetic alone — if the
 * `originalGap` measurement regresses (e.g. reverts to the hardcoded gap), the
 * zero-blank seam would drift and this gate would turn red. Reuses `normalizeName`
 * VERBATIM (only the three content-INDEPENDENT identity tokens are canonicalized).
 */
const PARTIAL_HOST_F = 'PartialInlineHostF';
const INLINE_HOST_F = 'InlineEquivHostF';

describe('Phase 56 — gap-0 host-seam literal byte-identity (originalGap guard)', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('gap-0 partial-inlined host === inline-equivalent host (literal, zero-blank host-seam preserved)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_F, target), PARTIAL_HOST_F);
      const inline = normalizeName(loadFixture(INLINE_HOST_F, target), INLINE_HOST_F);
      expect(partial).toBe(inline);
    });
  });
});

/**
 * Phase 56 (script-partial-cross-target-comment-placement-parity) — TRAILING-SEAM
 * (R1) literal byte-identity gate. THE keystone gap: svelte/vue DROP a comment at a
 * partial's TRAILING seam when the next INLINE (non-extracted) declaration carries a
 * leading comment.
 *
 * `mirrorSpliceBoundaryComments` (svelte/vue, per-statement generation) only
 * re-mirrors a boundary comment when the CURRENT statement is the spliced one
 * (`cur.extra.__roziePartialOrigin`). At a TRAILING seam the mirror-image holds:
 * `prev` is the last spliced decl of the partial and `cur` is the INLINE host
 * successor carrying the leading comment — so the existing trigger never fires. In
 * the inline oracle that comment is shared (prev.trailing + cur.leading, one @babel
 * object) and per-statement generation prints it TWICE; in the decomposed form it
 * lives only on cur.leading and prints ONCE → one copy dropped → byte diff. This
 * disqualifies nearly every real boundary (confirmed at DataTable P0→P1, P1→P2, P7,
 * P10, P13).
 *
 *   • examples/PartialInlineHostE.rozie — imports `{ usedNameE }` from the sibling
 *     ./partialLogicE.rzts, then declares an INLINE host const `hostTailE` with a
 *     leading comment immediately after the import (the trailing seam).
 *   • examples/InlineEquivHostE.rozie — the SAME logic + comment written inline,
 *     with the comment sitting directly between `usedNameE` and `hostTailE`.
 *
 * Reuses `normalizeName` VERBATIM (only the three content-INDEPENDENT identity
 * tokens are canonicalized), so a dropped comment still surfaces as a byte diff and
 * fails. Before the Plan 02 fix svelte/vue are RED here (comment dropped) while
 * react/solid/angular/lit are byte-identical (whole-block/program dedup); after the
 * trailing-seam trigger broadening all six are byte-identical.
 */
const PARTIAL_HOST_E = 'PartialInlineHostE';
const INLINE_HOST_E = 'InlineEquivHostE';

describe('Phase 56 — trailing-seam literal byte-identity (svelte/vue mirror)', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('trailing-seam partial-inlined host === inline-equivalent host (literal, commented inline successor preserved)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_E, target), PARTIAL_HOST_E);
      const inline = normalizeName(loadFixture(INLINE_HOST_E, target), INLINE_HOST_E);
      expect(partial).toBe(inline);
    });
  });
});

/**
 * Phase 56 (script-partial-cross-target-comment-placement-parity) — SHARED
 * MODULE-`let` (R3) BEFORE-side literal byte-identity gate. A sandwiched host `let`
 * that STAYS in the host has its authored leading comment shared with the EXTRACTED
 * neighbor `const` spliced directly above it.
 *
 *   • examples/PartialInlineHostG.rozie — imports `{ afterDeclG, midDeclG }` from
 *     ./partialLogicG.rzts and `{ beforeDeclG }` from ./partialLogicG2.rzts, with the
 *     host `let`s rangeTransitionG / fillDragUpG sandwiched BELOW each spliced run and
 *     carrying a leading comment (the before-side seam: prev is spliced, cur is the
 *     commented host `let` — the Plan 02 prev-spliced trailing-seam mirror restores the
 *     doubling on svelte/vue).
 *   • examples/InlineEquivHostG.rozie — the SAME logic + comments written inline.
 *
 * GREEN-×6 GUARD (not red→green): research assumption A3 (a solid/react "spurious
 * SECOND copy" of the shared comment at the sandwiched-let seam) was empirically
 * FALSIFIED — solid/react never double a shared comment here (whole-program dedup +
 * arrow→function conversion structurally collapse any duplicate), and the svelte/vue
 * before-side seam was already closed by Plan 02. This pins the before-side seam as
 * byte-neutral ×6. The REAL isolated drop (after-side host-`let`-trailing comment on
 * svelte/vue) is guarded by HostI below. Reuses `normalizeName` VERBATIM.
 */
const PARTIAL_HOST_G = 'PartialInlineHostG';
const INLINE_HOST_G = 'InlineEquivHostG';

describe('Phase 56 — shared module-let before-side literal byte-identity', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('shared-let before-side partial-inlined host === inline-equivalent host (literal, sandwiched-let comment preserved)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_G, target), PARTIAL_HOST_G);
      const inline = normalizeName(loadFixture(INLINE_HOST_G, target), INLINE_HOST_G);
      expect(partial).toBe(inline);
    });
  });
});

/**
 * Phase 56 (script-partial-cross-target-comment-placement-parity) — shape-5
 * AFTER-side host-`let`-trailing comment literal byte-identity gate. The REAL
 * isolated bug the Plan 03 investigation surfaced (R3's after-side variant): an
 * extracted `const` is spliced DIRECTLY below a host `let` whose authored comment
 * TRAILS it (after-side) and leads the spliced decl.
 *
 *   • examples/PartialInlineHostI.rozie — declares the host `let` rangeTransitionI,
 *     then an authored comment trailing it, then imports `{ afterDeclI }` from
 *     ./partialLogicI.rzts (the spliced decl that lands directly below the comment).
 *   • examples/InlineEquivHostI.rozie — the SAME logic + comment written inline.
 *
 * Inline, that comment is one @babel object shared as rangeTransitionI.trailing +
 * afterDeclI.leading; svelte/vue per-statement generation prints it TWICE. After
 * extraction the splice severs the shared object — the comment survives only on the
 * host `let`'s trailingComments (cur's leadingComments is empty), so svelte/vue print
 * it ONCE → byte diff (RED on svelte/vue) before the after-side mirror extension;
 * GREEN ×6 after. react/solid/angular/lit are byte-identical throughout (whole-block/
 * program dedup; angular/lit strip the comment in both forms). Reuses `normalizeName`
 * VERBATIM.
 */
const PARTIAL_HOST_I = 'PartialInlineHostI';
const INLINE_HOST_I = 'InlineEquivHostI';

describe('Phase 56 — shared module-let after-side literal byte-identity (svelte/vue mirror)', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('shared-let after-side partial-inlined host === inline-equivalent host (literal, host-let-trailing comment preserved)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_I, target), PARTIAL_HOST_I);
      const inline = normalizeName(loadFixture(INLINE_HOST_I, target), INLINE_HOST_I);
      expect(partial).toBe(inline);
    });
  });
});
