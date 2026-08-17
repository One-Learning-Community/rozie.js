/**
 * lit-ts consumer-types — R6/AC-10 family type surface (Phase 79 Plan 12
 * Task 3).
 *
 * Type-only assertions over the compiled `DynamicSlots.ts` fixture's
 * `rozieSlots?:` record property. Loaded by `tsc --noEmit -p
 * tsconfig.strict.json` (NOT vitest) — every line must typecheck. This file
 * is DELIBERATELY SEPARATE from `lit-ts.test.ts` (the pre-existing Vitest +
 * TS-Compiler-API harness, which verifies PARSE-level concerns — decorator
 * syntax, import resolution — across a fixed `FIXTURE_NAMES` list, and
 * explicitly does not verify per-slot BODY type precision, per its own
 * header comment). `strict: false` is inherited from `tsconfig.strict.json`
 * (Lit's floor per that file's own header comment) — irrelevant here: object-
 * literal excess-property checks and property-existence checks are NOT
 * gated by the `strict` flag, so the negative `@ts-expect-error` case below
 * still fires.
 *
 * Coverage (AC-10):
 *   1. Positive — destructuring `{ row, value }` from a `cell-status` entry
 *      typechecks, with real (non-`any`-erased) locals.
 *   2. Negative — a misspelled param inside the SAME destructure signature
 *      fails typecheck.
 *   3. Zero-param family — the `row-*` family's callable asserts a
 *      zero-argument shape.
 *   4. Coexistence — a `cell-total` entry (the static, non-family slot)
 *      typechecks against ITS OWN one-param shape, not the family's.
 */
import type DynamicSlots from './fixtures/DynamicSlots';

declare const instance: DynamicSlots;

// ---- 1. Positive — family destructure carries real param types ---------
instance.rozieSlots = {
  'cell-status': ({ row, value }) => {
    const r: unknown = row;
    const v: unknown = value;
    void r;
    void v;
    return null;
  },
};

// ---- 2. Negative — misspelled param destructure fails typecheck --------
instance.rozieSlots = {
  // @ts-expect-error — 'rowx' does not exist on the cell- family's scope shape
  'cell-status': ({ rowx, value }) => {
    void rowx;
    void value;
    return null;
  },
};

// ---- 3. Zero-param family — asserts the callable's zero-argument shape -
instance.rozieSlots = {
  'row-anything': () => null,
};

// ---- 4. Coexistence — the static cell-total entry types against ITS OWN
//         one-param shape, not the overlapping cell- family's two-param one.
instance.rozieSlots = {
  'cell-total': ({ value }) => {
    void value;
    return null;
  },
};

void [instance];
