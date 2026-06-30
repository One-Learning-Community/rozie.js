/**
 * CLASS-1 WITNESS — nullable prop → attribute typed `string | null` (TS2322).
 *
 * Phase 65 (Bundle C / Item 2), SC-1. RED-FIRST: this test asserts the Class-1
 * signature is GONE (count === 0) on react + solid + lit. It was authored and
 * OBSERVED RED (failing) on all three targets over the committed combobox leaf
 * BEFORE any emitter edit — a fixture that passes pre-fix proves nothing
 * (memory feedback_snapshot_tests_cement_bugs). The exact pre-fix error text
 * observed is recorded below as the red-first anchor.
 *
 * Class-1 root cause: a `<props>` value declared `default: null`
 * (`ariaLabel: { type: String, default: null }`) bound RAW to an `:aria-*`/DOM
 * attribute. The prop type widens to `string | null` (React/Solid prop
 * interface, Phase 16 R1) or the Lit `@property` field initializes `null` into a
 * `string`-typed field — both type/slot mismatches the wrapped sibling
 * (`aria-controls={rozieAttr(listId())}`, `→ string | undefined`) does NOT hit.
 *
 * ── RED-FIRST ANCHOR (observed 2026-06-29, strict flags on, pre-fix) ──────────
 * React  src/Combobox.tsx(578,8): error TS2322 … aria-label={props.ariaLabel}
 *   Types of property '"aria-label"' are incompatible.
 *     Type 'string | null' is not assignable to type 'string | undefined'.
 * Solid  src/Combobox.tsx(790,8): error TS2322 … aria-label={local.ariaLabel}
 *   Types of property '"aria-label"' are incompatible.
 *     Type 'string | null' is not assignable to type 'string | undefined'.
 * Lit    src/Combobox.ts(136,46): error TS2322
 *     Type 'null' is not assignable to type 'string'.   (@property ariaLabel: string = null)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect } from 'vitest';
import { typecheckLeaf, type LeafSpec } from './strict-conformance.harness.js';

/** The combobox canary leaf has exactly one Class-1 prop: `ariaLabel: { default: null }`. */
const CANARIES: LeafSpec[] = [
  { name: 'combobox', target: 'react', leaf: 'packages/ui/combobox/packages/react' },
  { name: 'combobox', target: 'solid', leaf: 'packages/ui/combobox/packages/solid' },
  { name: 'combobox', target: 'lit', leaf: 'packages/ui/combobox/packages/lit' },
];

/**
 * Count Class-1 occurrences in raw tsc output.
 *  - React/Solid: a nullable-prop read typed `string | null` into the
 *    `string | undefined` attribute slot.
 *  - Lit: a `null` init assigned into a `string`-typed `@property` field.
 * Both are the EXACT Class-1 signature — narrow enough to exclude Class-2
 * (`… is not assignable to type 'null' / 'never[]'`) and Class-3/4 noise.
 */
function class1Count(target: LeafSpec['target'], raw: string): number {
  if (target === 'lit') {
    return (raw.match(/error TS2322: Type 'null' is not assignable to type 'string'/g) ?? [])
      .length;
  }
  return (
    raw.match(/Type 'string \| null' is not assignable to type 'string \| undefined'/g) ?? []
  ).length;
}

describe('CLASS-1 — nullable prop → attribute is not typed `string | null` (SC-1)', () => {
  for (const spec of CANARIES) {
    it(`${spec.name}/${spec.target}: no Class-1 nullable-prop-attr TS2322`, () => {
      const { raw } = typecheckLeaf(spec);
      const count = class1Count(spec.target, raw);
      expect(
        count,
        `[${spec.name}/${spec.target}] expected Class-1 nullable-prop-attr TS2322 count === 0 ` +
          `(GREEN). Got ${count}. RED pre-fix is expected; GREEN required after the ` +
          `nullable-prop attr-read carve-out (React/Solid rozieAttr) / Lit @property ` +
          `field-type widen lands.\n--- tsc output (Class-1 lines) ---\n` +
          raw
            .split('\n')
            .filter((l) => /aria-label|TS2322|string \| null|not assignable to type 'string'/.test(l))
            .join('\n'),
      ).toBe(0);
    });
  }
});
