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

/**
 * Phase 56 (script-partial-cross-target-comment-placement-parity) — Shape-3
 * after-`let` / import-FLOAT literal byte-identity gate. The REAL Shape-3 divergence:
 * an extracted decl whose LEADING comment is shared (in the partial source) with the
 * partial's OWN module import floats to module-top in the decomposed form because the
 * inliner copies the import's trailingComments onto the HOISTED import node.
 *
 *   • examples/PartialInlineHostH.rozie — declares a host `let editTransitionH`
 *     reassigned inside `$onMount` (react useRef hoist + body.filter removal), then
 *     imports `{ editorBindingsH }` from ./partialLogicH.rzts DIRECTLY below it. The
 *     partial carries its OWN `clampH` import with a leading comment between it and
 *     `editorBindingsH`.
 *   • examples/InlineEquivHostH.rozie — the SAME logic written inline, with `clampH`
 *     at module-top and the leading comment authored directly above `editorBindingsH`
 *     (far below the import), so the comment attaches ONLY to the decl's leadingComments.
 *
 * Inline, the comment lives only on `editorBindingsH`'s leadingComments. In the
 * decomposed form @babel/parser shares it across import.trailing + decl.leading; the
 * inliner's hoistSpecifier (pre-fix) copies it onto the hoisted `clampH` import, so it
 * FLOATS to module-top — RED on all six targets (svelte/vue double, react/angular/lit
 * drop, solid dedups) until the inliner stops the floating and keeps the comment on the
 * spliced decl's leadingComments. Reuses `normalizeName` VERBATIM.
 */
const PARTIAL_HOST_H = 'PartialInlineHostH';
const INLINE_HOST_H = 'InlineEquivHostH';

describe('Phase 56 — Shape-3 after-let import-float literal byte-identity (core inliner)', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('after-let import-float partial-inlined host === inline-equivalent host (literal, leading comment stays with the decl)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_H, target), PARTIAL_HOST_H);
      const inline = normalizeName(loadFixture(INLINE_HOST_H, target), INLINE_HOST_H);
      expect(partial).toBe(inline);
    });
  });
});

/**
 * Phase 56 (script-partial-cross-target-comment-placement-parity) — MULTI-BOUNDARY
 * DataTable-shaped permanent guard (R7). The FINAL arbiter for A4 and the GATE before
 * the 16-partial DataTable decomposition (Waves 6-10).
 *
 * The per-gap fixtures above (HostC/D/E/F/G/H/I) each isolate ONE drift shape. This
 * fixture STACKS all four real DataTable shapes in ONE host with THREE partials the way
 * DataTable actually stacks them, so the svelte/vue mirror's TWO trigger branches fire
 * at STACKED ADJACENT seams around the same spliced node:
 *
 *   • examples/PartialInlineHostMulti.rozie — imports `{ editorBindingsM }`
 *     (./partialLogicMultiA — flat A4 centerpiece), `{ columnChromeM }`
 *     (./partialLogicMultiB — gap-0 columnChrome + import-float), and `{ outerM }`
 *     (./partialLogicMultiC — nested/heterogeneous HostD shape, freshly hoists clampD +
 *     consumes a nested partialInnerD). `editorBindingsM` is the spliced SUCCESSOR at the
 *     after-side host-`let`-trailing seam (Plan 03 branch, below a `let` react useRef-hoists
 *     via $onMount reassign + body.filter) AND the spliced PREDECESSOR at the trailing seam
 *     into the inline host const `hostTailM` (Plan 02 branch). `columnChromeM` sits ZERO
 *     blanks below the host const `tickM` with a leading comment shared with its own hoisted
 *     import (gap-0 + Shape-3 float). This also closes the deferred comment-bearing gap-0
 *     columnChrome demonstration (deferred-items.md).
 *   • examples/InlineEquivHostMulti.rozie — the SAME surviving logic + comments + blank
 *     layout written inline (the byte-identity oracle).
 *
 * Reuses `normalizeName` VERBATIM (only the three content-INDEPENDENT identity tokens are
 * canonicalized), so any stacked-seam drift still surfaces as a byte diff and fails. All
 * four comment fixes (Plans 01-04) have landed, so this is a permanent GREEN-×6 guard (NOT
 * red→green): it proves the four fixes COMPOSE at real-world stacked boundaries before any
 * DataTable extraction begins. Solid is load-bearing for the heterogeneous-block math;
 * svelte/vue are load-bearing for the two-branch mirror at adjacent seams.
 */
const PARTIAL_HOST_MULTI = 'PartialInlineHostMulti';
const INLINE_HOST_MULTI = 'InlineEquivHostMulti';

describe('Phase 56 — multi-boundary literal byte-identity (DataTable-shaped permanent guard)', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('multi-boundary partial-inlined host === inline-equivalent host (literal, all four stacked shapes)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_MULTI, target), PARTIAL_HOST_MULTI);
      const inline = normalizeName(loadFixture(INLINE_HOST_MULTI, target), INLINE_HOST_MULTI);
      expect(partial).toBe(inline);
    });
  });
});

/**
 * Phase 56-R8 (script-partial-cross-target-comment-placement-parity) — GAP-1
 * TRAILING-SEAM literal byte-identity gate. The drift the 56-06 DataTable
 * decomposition surfaced: when a spliced (extracted) partial decl is succeeded in the
 * HOST source by `[blank line][host leading-comment][host decl]`, the separating BLANK
 * LINE is DROPPED on vue/svelte/solid (react/angular/lit byte-identical).
 *
 *   • examples/PartialInlineHostJ.rozie — a host body decl `headJ`, then imports
 *     `{ setColumnFilterJ }` (a MULTI-LINE block arrow const) from ./partialLogicJ.rzts,
 *     succeeded by a BLANK line, a leading comment, and the host `let refreshRowModelJ`
 *     (reassigned in `$onMount` → react useRef + body.filter removal).
 *   • examples/InlineEquivHostJ.rozie — the SAME logic + comment + blank written inline.
 *
 * Because the spliced decl is MULTI-LINE, after the inliner shifts the spliced run
 * host-contiguous the host comment's ORIGINAL (un-shifted) line falls BEHIND the spliced
 * run's emit end, so @babel/generator computes a non-positive line delta and emits NO
 * blank — the intended source blank collapses on vue/svelte/solid. This is gap-direction-
 * asymmetric: the gap-0 trailing seam (HostE) already renders zero blanks correctly, but
 * the gap-1 variant (one intended blank) collapses to zero. Plan 56-05's multi-boundary
 * guard only exercised the gap-0 trailing seam. RED on vue/svelte/solid before the
 * after-side host-gap reproduction lands in normalizeSplicedEmitLines; GREEN ×6 after.
 * react/angular/lit are byte-identical throughout. Reuses `normalizeName` VERBATIM.
 */
const PARTIAL_HOST_J = 'PartialInlineHostJ';
const INLINE_HOST_J = 'InlineEquivHostJ';

describe('Phase 56-R8 — gap-1 trailing-seam literal byte-identity (after-side host gap)', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('gap-1 trailing-seam partial-inlined host === inline-equivalent host (literal, after-side blank preserved)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_J, target), PARTIAL_HOST_J);
      const inline = normalizeName(loadFixture(INLINE_HOST_J, target), INLINE_HOST_J);
      expect(partial).toBe(inline);
    });
  });
});

/**
 * Phase 56-R9 — GAP-0 LEADING-seam literal byte-identity (before-side host gap).
 *
 * The LEADING sibling of the R8 gap-1 trailing seam, surfaced by the 56-07 DataTable
 * Wave-2 `columnChrome` extraction: when a spliced (extracted) partial run sits DIRECTLY
 * below a host arrow-const (`const tick = () => rowModelVer`) with ZERO blank lines and
 * the run's FIRST emitted token is a pure run-LEADING comment, a spurious BLANK line is
 * INJECTED between the host decl and the comment on vue/svelte/solid (react/angular/lit
 * byte-identical — they reconstruct/strip the comment so the blank is invisible).
 *
 *   • examples/PartialInlineHostK.rozie — a host arrow-const `const tickK`, then DIRECTLY
 *     BELOW it (zero blanks) imports `{ ariaSortK, sortIndicatorK }` from the sibling
 *     ./partialLogicK.rzts (BARE const-arrow decls + terminal `export { … }`, the real
 *     columnChrome shape; the first surviving decl carries a pure run-leading comment and
 *     the partial hoists NO import — the arrow bodies close over the host `tickK`).
 *   • examples/InlineEquivHostK.rozie — the SAME logic + comment written inline (oracle).
 *
 * Because the partial has NO same-file predecessor, core's measureOriginalGap falls back
 * to 2, anchoring the spliced run's leading comment ONE line too low → the injected blank.
 * The fix uses the HOST-side beforeGap (gap-0 → 1) when a spliced block immediately follows
 * a host statement and the partial-local fallback overestimated, anchoring the run
 * host-contiguous. RED on vue/svelte/solid before the fix; GREEN ×6 after. Reuses
 * `normalizeName` VERBATIM.
 */
const PARTIAL_HOST_K = 'PartialInlineHostK';
const INLINE_HOST_K = 'InlineEquivHostK';

describe('Phase 56-R9 — gap-0 leading-seam literal byte-identity (before-side host gap)', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('gap-0 leading-seam partial-inlined host === inline-equivalent host (literal, no injected blank)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_K, target), PARTIAL_HOST_K);
      const inline = normalizeName(loadFixture(INLINE_HOST_K, target), INLINE_HOST_K);
      expect(partial).toBe(inline);
    });
  });
});

/**
 * Phase 56-R10 — BLANK-SEPARATED LEADING-seam literal byte-identity (before-side host gap,
 * comment NOT doubled).
 *
 * The blank-separated sibling of the R9 gap-0 leading seam, surfaced by the 56-08 DataTable
 * Wave-8 `exposeStateVerbs` (imperative-handle) extraction: when a spliced (extracted)
 * partial run's FIRST emitted token is a multi-line run-LEADING comment block, and in the
 * host source that comment is SEPARATED from the preceding statement (a sigil-lowered
 * `$provide(...)`) by ONE blank line (beforeGap = 2), the vue/svelte
 * `mirrorSpliceBoundaryComments` LEADING-seam branch re-creates the prev-trailing copy
 * UNCONDITIONALLY and DOUBLES the comment block at the splice seam.
 *
 *   • examples/PartialInlineHostL.rozie — a host arrow-const `const headL`, a sigil-lowered
 *     `$provide(...)` (with its own leading comment, the registry-API shape), then ONE blank
 *     line, then imports `{ verbL, verb2L }` (BARE const-arrow decls whose first surviving
 *     decl carries a multi-line run-LEADING comment block; the partial hoists NO import — the
 *     arrow bodies close over the host `headL`) from the sibling ./partialLogicL.rzts.
 *   • examples/InlineEquivHostL.rozie — the SAME logic + comment + blank written inline.
 *
 * Inline, the blank above the comment breaks @babel's prev-trailing attachment, so the
 * comment attaches to verbL's leadingComments ONLY → SINGLE-emit on svelte/vue. This is the
 * INVERSE of R9's gap-0 seam (beforeGap = 1, no blank → the comment IS shared on both
 * neighbours → SHOULD double). RED on exactly vue/svelte before the fix (the comment block is
 * doubled); GREEN ×6 after. react/angular/solid/lit reconstruct/strip/whole-program-dedup the
 * comment so they single-emit and stay byte-identical throughout. The R10 fix stamps
 * `cur.extra.__rozieBeforeGap` in core when a spliced leading-comment run sits >= 1 blank below
 * a host statement, and the vue/svelte mirror suppresses the LEADING-seam doubling for that
 * seam. Reuses `normalizeName` VERBATIM.
 */
const PARTIAL_HOST_L = 'PartialInlineHostL';
const INLINE_HOST_L = 'InlineEquivHostL';

describe('Phase 56-R10 — blank-separated leading-seam literal byte-identity (comment not doubled)', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('blank-separated leading-seam partial-inlined host === inline-equivalent host (literal, comment single-emit)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_L, target), PARTIAL_HOST_L);
      const inline = normalizeName(loadFixture(INLINE_HOST_L, target), INLINE_HOST_L);
      expect(partial).toBe(inline);
    });
  });
});

/**
 * Phase 56-R11 — AFTER-SIDE INTER-COMMENT-BLOCK literal byte-identity (second blank
 * between two consecutive host comment-blocks downstream of a spliced run).
 *
 * The after-side sibling of the R8 gap-1 trailing seam, surfaced by the 56-09 DataTable
 * Wave-9 decomposition (the P9 `gridKeydownHandlers` / P12 `fillDrag` after-sides): when a
 * spliced (extracted) partial decl is succeeded in the HOST source by
 * `[blank][host comment block A][blank][host comment block B][host decl]` — TWO consecutive
 * host comment-blocks separated by a blank line — the FIRST blank (spliced tail → block A)
 * is preserved by the R8 after-side fix, but the SECOND blank (between block A and block B)
 * is DROPPED on vue/svelte ONLY.
 *
 *   • examples/PartialInlineHostM.rozie — a host body decl `headM`, then imports
 *     `{ gridKeydownHandlersM }` (a MULTI-LINE block arrow const) from ./partialLogicM.rzts,
 *     succeeded by a BLANK line, comment block A, a BLANK line, comment block B, and the host
 *     `let refreshRowModelM` (reassigned in `$onMount` → react useRef + body.filter removal).
 *   • examples/InlineEquivHostM.rozie — the SAME logic + both comment blocks + both blanks inline.
 *
 * The vue/svelte after-side trailing-seam mirror clones the host successor's leading comments
 * onto the spliced predecessor's trailing comments but FLATTENS every cloned comment onto ONE
 * anchor line (`prev.end + afterGap`), collapsing the inter-comment-block blank. react/angular/
 * solid/lit preserve both blanks (solid reads the core loc deltas via whole-program generation;
 * react reconstructs the body; angular/lit strip comments) → byte-identical throughout. RED on
 * exactly vue/svelte before the fix; GREEN ×6 after. The R11 fix preserves the cloned comments'
 * relative line deltas (anchoring the first at `prev.end + afterGap`, the rest offset by their
 * original source deltas) instead of flattening them. Reuses `normalizeName` VERBATIM.
 */
const PARTIAL_HOST_M = 'PartialInlineHostM';
const INLINE_HOST_M = 'InlineEquivHostM';

describe('Phase 56-R11 — after-side inter-comment-block literal byte-identity (second blank preserved)', () => {
  describe.each(TARGETS)('%s target', (target) => {
    it('after-side inter-comment-block partial-inlined host === inline-equivalent host (literal, inter-comment blank preserved)', () => {
      const partial = normalizeName(loadFixture(PARTIAL_HOST_M, target), PARTIAL_HOST_M);
      const inline = normalizeName(loadFixture(INLINE_HOST_M, target), INLINE_HOST_M);
      expect(partial).toBe(inline);
    });
  });
});
