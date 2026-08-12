/**
 * canonicalEventKeyAgreement.test.ts — quick task 260812-i67 (ROZ997/ROZ998).
 *
 * Pins core's `canonicalEventKey` byte-identical to this target's
 * `sanitizeEventName` over an adversarial name table.
 *
 * WHAT BREAKS IF THIS GOES RED: the two functions are the SAME collapse
 * implemented twice on opposite sides of the targets-depend-on-core dependency
 * boundary (core cannot import from packages/targets/* — that would be a
 * cycle). Core's ROZ998 check (threadParamTypes) declares a consumer listener
 * "canonically matched → silent" via `canonicalEventKey` equality, while
 * Angular's `resolveEventBindingName` actually RESOLVES that listener via
 * `sanitizeEventName` equality. If the two ever diverge, ROZ998 either goes
 * silent on a listener Angular fails to resolve (a silently-dead binding — the
 * exact consumer-vs-declaration drift class quick task 260811-trz closed) or
 * warns on a listener Angular resolves fine (false positive). This table is
 * the enforcement mechanism for that contract — fix the diverging function,
 * never delete a failing row.
 */
import { describe, expect, it } from 'vitest';
import { canonicalEventKey } from '../../../../core/src/diagnostics/canonicalEventKey.js';
import { sanitizeEventName } from '../rewrite/sanitizeEventName.js';

/**
 * At least twenty names: every spelling shape the corpus actually ships
 * (single word, kebab two-word, kebab three-word, camelCase) plus the
 * adversarial edges (snake, mixed separators, leading digit, all-separator,
 * empty string, whitespace, dollar, digits, case variants).
 */
const AGREEMENT_TABLE: readonly string[] = [
  // corpus-shipped shapes
  'close', // single word (byte-identical passthrough)
  'search',
  'toggle',
  'sort-change', // kebab two-word
  'row-select',
  'upload-progress',
  'restriction-failed',
  'keynav-page', // Rozie-synthetic runtime family, kebab
  'file-upload-complete', // kebab three-word
  'cell-edit-commit',
  'sortChange', // camelCase (passthrough)
  'rangeComplete',
  'update:modelValue', // colon-carrying (r-model companion shape)
  // adversarial edges
  'sort_change', // snake — identifier-legal, passthrough (NO camelize)
  'sort_-change', // mixed separators — camelizes
  'sort change', // whitespace separator — camelizes
  '2fa-enabled', // leading digit
  '2fa', // leading digit, no separator
  '---', // only separators — stable placeholder
  '___', // only separators that ARE identifier-legal — passthrough
  '', // empty string — stable placeholder
  '$special', // dollar identifier — passthrough
  'SortChange', // PascalCase — passthrough (case preserved)
  'SORT-CHANGE', // upper kebab — camelize preserves the run's case
  'a', // single char
  'a-b-c-d-e', // many segments
];

describe('canonicalEventKey (core) === sanitizeEventName (angular) agreement', () => {
  it('the table has at least twenty names', () => {
    expect(AGREEMENT_TABLE.length).toBeGreaterThanOrEqual(20);
  });

  for (const name of AGREEMENT_TABLE) {
    it(`agrees on ${JSON.stringify(name)}`, () => {
      expect(canonicalEventKey(name)).toBe(sanitizeEventName(name));
    });
  }
});
