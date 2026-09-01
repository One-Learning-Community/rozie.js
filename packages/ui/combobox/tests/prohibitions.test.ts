/**
 * prohibitions.test.ts — the machine-enforced gate for the three SPEC
 * prohibitions locked in 86-SPEC.md's "Prohibitions (must-NOT)" table:
 *
 *   1. No typed query or selected value may reach browser storage, a cookie,
 *      or a network endpoint.
 *   2. No typed query or selected value may be logged via a developer-console
 *      call site in shipped output.
 *   3. The `aria-multiselectable` listbox claim may never ship as a bare
 *      literal — it must be a conditional bound to the `multiple` prop, paired
 *      with the toggle, chip-removal, and per-option selected-state code paths
 *      that back the claim.
 *
 * Reads the SIX emitted combobox leaves, the SIX emitted popover leaves (popover
 * source changed this phase too), and each leaf's copied `internal/` module
 * (`groupOptions.ts` / `middleware.ts`) — the full shipped surface, not just the
 * top-level component file.
 *
 * Structure: two small pure checking functions (`findForbiddenViolations`,
 * `checkMultiselectableClaim`) plus the assertions that drive them. Each
 * function takes a source string and returns the violations it finds — never a
 * boolean pass/fail baked into the function itself — so a negative-path fixture
 * can prove the gate actually fires rather than only ever reporting green.
 *
 * The forbidden-identifier list lives ONLY in the FORBIDDEN_IDENTIFIERS array
 * below (per this task's own instruction: naming the rule again in a comment or
 * docs page would ship the very thing the rule forbids into every leaf's
 * emitted output, via this test file's own presence in a scanned tree).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMBOBOX_ROOT = resolve(HERE, '..');
const POPOVER_ROOT = resolve(COMBOBOX_ROOT, '..', 'popover');

const TARGETS = [
  { name: 'react', ext: 'tsx' },
  { name: 'vue', ext: 'vue' },
  { name: 'svelte', ext: 'svelte' },
  { name: 'angular', ext: 'ts' },
  { name: 'solid', ext: 'tsx' },
  { name: 'lit', ext: 'ts' },
] as const;

interface LeafSource {
  id: string;
  path: string;
  source: string;
}

function readLeaf(id: string, path: string): LeafSource {
  return { id, path, source: readFileSync(path, 'utf8') };
}

// The six emitted combobox component sources — the twelve-source acceptance
// criterion's combobox half.
const comboboxLeaves: LeafSource[] = TARGETS.map(({ name, ext }) =>
  readLeaf(`combobox-${name}`, resolve(COMBOBOX_ROOT, 'packages', name, 'src', `Combobox.${ext}`)),
);

// The six emitted popover component sources — popover source changed this
// phase (D-01..D-12), so its leaves are in scope too — the twelve-source
// acceptance criterion's popover half.
const popoverLeaves: LeafSource[] = TARGETS.map(({ name, ext }) =>
  readLeaf(`popover-${name}`, resolve(POPOVER_ROOT, 'packages', name, 'src', `Popover.${ext}`)),
);

// Each leaf's copied internal module — codegen vendors a runtime-import
// helper verbatim into every target (`groupOptions.ts` for combobox,
// `middleware.ts` for popover), so the shipped surface is bigger than the
// single top-level component file. The prohibition descriptor calls these
// out explicitly ("plus their copied internals").
const comboboxInternals: LeafSource[] = TARGETS.map(({ name }) =>
  readLeaf(`combobox-${name}-internal`, resolve(COMBOBOX_ROOT, 'packages', name, 'src', 'internal', 'groupOptions.ts')),
);
const popoverInternals: LeafSource[] = TARGETS.map(({ name }) =>
  readLeaf(`popover-${name}-internal`, resolve(POPOVER_ROOT, 'packages', name, 'src', 'internal', 'middleware.ts')),
);

const twelveLeafSources: LeafSource[] = [...comboboxLeaves, ...popoverLeaves];
const allScannedSources: LeafSource[] = [...twelveLeafSources, ...comboboxInternals, ...popoverInternals];

// ── Prohibitions 1 & 2: persistence / cookies / telemetry / console logging ──
//
// This array is the ONLY place in the repository this list is enumerated
// (deliberately — see the file header). Covers browser storage, cookie
// access, and network-egress primitives (prohibition 1) plus developer-console
// call sites (prohibition 2) in one pass, since both are "a value the user
// typed or selected must never leave this component" violations of the same
// shape.
const FORBIDDEN_IDENTIFIERS = [
  'localStorage',
  'sessionStorage',
  'document.cookie',
  'indexedDB',
  'navigator.sendBeacon',
  'XMLHttpRequest',
  'console.',
] as const;

interface ForbiddenViolation {
  type: 'forbidden-identifier';
  identifier: string;
}

/**
 * Pure checking function for prohibitions 1 & 2. Takes a source string,
 * returns every forbidden identifier found in it (empty array = clean).
 */
function findForbiddenViolations(source: string): ForbiddenViolation[] {
  const violations: ForbiddenViolation[] = [];
  for (const identifier of FORBIDDEN_IDENTIFIERS) {
    if (source.includes(identifier)) {
      violations.push({ type: 'forbidden-identifier', identifier });
    }
  }
  return violations;
}

// ── Prohibition 3: the multiselectable listbox claim must be real ──

interface AttrOccurrence {
  value: string;
}

/**
 * Finds every occurrence of `attrName` in `source` and extracts its bound
 * value (quoted string, `{...}` expression, or `${...}` template-literal
 * expression — the shapes emitted across the six targets), using brace-depth
 * matching so a nested `(...)`/ternary inside the value does not truncate it.
 */
function findAttrValues(source: string, attrName: string): AttrOccurrence[] {
  const occurrences: AttrOccurrence[] = [];
  let searchFrom = 0;
  for (;;) {
    const nameIdx = source.indexOf(attrName, searchFrom);
    if (nameIdx === -1) break;
    const eqIdx = source.indexOf('=', nameIdx);
    if (eqIdx === -1) break;
    let i = eqIdx + 1;
    while (i < source.length && /\s/.test(source[i])) i++;
    let value = '';
    if (source[i] === '$' && source[i + 1] === '{') {
      let depth = 0;
      let j = i + 1;
      for (; j < source.length; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}') {
          depth--;
          if (depth === 0) { j++; break; }
        }
      }
      value = source.slice(i, j);
    } else if (source[i] === '{') {
      let depth = 0;
      let j = i;
      for (; j < source.length; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}') {
          depth--;
          if (depth === 0) { j++; break; }
        }
      }
      value = source.slice(i, j);
    } else if (source[i] === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"') j++;
      value = source.slice(i, j + 1);
    }
    occurrences.push({ value });
    searchFrom = eqIdx + 1;
  }
  return occurrences;
}

/** Is `value` nothing but the bare literal `true` (quoted or braced), with no reference to any prop at all? */
function isBareLiteralTrue(value: string): boolean {
  const inner = value.trim().replace(/^\$?[{"]/, '').replace(/[}"]$/, '').trim();
  return inner === 'true';
}

/** Does `value` read as a conditional expression that actually branches on the `multiple` prop? */
function isConditionalBoundToMultiple(value: string): boolean {
  return /\bmultiple\b/i.test(value) && value.includes('?');
}

interface MultiselectableViolation {
  type: 'multiselectable-literal' | 'multiselectable-not-bound';
  value: string;
}

/**
 * Pure checking function for prohibition 3's attribute half. Takes a
 * combobox leaf source, returns every `aria-multiselectable` occurrence that
 * is NOT a conditional bound to `multiple` (a bare literal, or bound to
 * something else entirely).
 */
function checkMultiselectableClaim(source: string): MultiselectableViolation[] {
  const violations: MultiselectableViolation[] = [];
  for (const occ of findAttrValues(source, 'aria-multiselectable')) {
    if (isBareLiteralTrue(occ.value)) {
      violations.push({ type: 'multiselectable-literal', value: occ.value });
    } else if (!isConditionalBoundToMultiple(occ.value)) {
      violations.push({ type: 'multiselectable-not-bound', value: occ.value });
    }
  }
  return violations;
}

// The three runtime code paths that must back the multiselectable claim:
// toggle-off (re-selecting an already-selected option), chip-removal (the
// dedicated remove control), and the per-option selected-state binding that
// drives `aria-selected` / the selected CSS class. All three are real,
// shared identifiers present in every leaf's emitted source (verified below
// against the actual six leaves before this test was written).
interface BehaviorPresence {
  hasTogglePath: boolean;
  hasChipRemovalPath: boolean;
  hasSelectedStateBinding: boolean;
}

function checkBehaviorPathsPresent(source: string): BehaviorPresence {
  return {
    hasTogglePath: source.includes('selectOption'),
    hasChipRemovalPath: source.includes('removeChipValue'),
    hasSelectedStateBinding: source.includes('isRowSelected'),
  };
}

describe('Combobox/Popover prohibition gate (SPEC 86-SPEC.md)', () => {
  describe('Prohibitions 1 & 2: no browser-storage/cookie/network-egress identifiers, no developer-console logging', () => {
    it.each(allScannedSources.map((leaf) => [leaf.id, leaf] as const))(
      '%s carries none of the forbidden identifiers',
      (_id, leaf) => {
        expect(findForbiddenViolations(leaf.source)).toEqual([]);
      },
    );
  });

  describe('Prohibition 3: aria-multiselectable is a real conditional, never a literal', () => {
    it.each(comboboxLeaves.map((leaf) => [leaf.id, leaf] as const))(
      '%s emits aria-multiselectable only as a conditional bound to `multiple`',
      (_id, leaf) => {
        const violations = checkMultiselectableClaim(leaf.source);
        expect(violations).toEqual([]);
        // The attribute must actually appear at least once — an empty
        // findAttrValues() result would make the assertion above vacuously
        // pass without ever proving anything (the same class of vacuous-gate
        // risk the negative-path fixture below exists to rule out).
        expect(findAttrValues(leaf.source, 'aria-multiselectable').length).toBeGreaterThan(0);
      },
    );

    it.each(comboboxLeaves.map((leaf) => [leaf.id, leaf] as const))(
      '%s carries the toggle, chip-removal, and per-option selected-state code paths',
      (_id, leaf) => {
        const presence = checkBehaviorPathsPresent(leaf.source);
        expect(presence).toEqual({
          hasTogglePath: true,
          hasChipRemovalPath: true,
          hasSelectedStateBinding: true,
        });
      },
    );
  });

  describe('Negative-path proof: the checking functions are not vacuous', () => {
    it('findForbiddenViolations reports a violation for a synthetic forbidden identifier', () => {
      const synthetic = `
        function leak(query) {
          if (query) {
            console.log('debug: user typed', query);
          }
        }
      `;
      const violations = findForbiddenViolations(synthetic);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations).toContainEqual({ type: 'forbidden-identifier', identifier: 'console.' });
    });

    it('findForbiddenViolations reports a violation for each distinct forbidden identifier class', () => {
      const synthetic = `
        localStorage.setItem('q', query);
        sessionStorage.setItem('q', query);
        document.cookie = 'q=' + query;
        indexedDB.open('rozie');
        navigator.sendBeacon('/telemetry', query);
        new XMLHttpRequest().open('POST', '/telemetry');
        console.warn(query);
      `;
      const violations = findForbiddenViolations(synthetic);
      expect(violations.length).toBe(FORBIDDEN_IDENTIFIERS.length);
    });

    it('findForbiddenViolations reports nothing for a clean synthetic source', () => {
      const clean = `function selectOption(opt) { return opt.value; }`;
      expect(findForbiddenViolations(clean)).toEqual([]);
    });

    it('checkMultiselectableClaim reports a violation for a bare literal `aria-multiselectable="true"`', () => {
      const synthetic = `<ul role="listbox" aria-multiselectable="true"></ul>`;
      const violations = checkMultiselectableClaim(synthetic);
      expect(violations).toContainEqual({ type: 'multiselectable-literal', value: '"true"' });
    });

    it('checkMultiselectableClaim reports a violation for a value bound to something other than `multiple`', () => {
      const synthetic = `<ul role="listbox" aria-multiselectable={disabled ? 'true' : null}></ul>`;
      const violations = checkMultiselectableClaim(synthetic);
      expect(violations).toContainEqual({
        type: 'multiselectable-not-bound',
        value: "{disabled ? 'true' : null}",
      });
    });

    it('checkMultiselectableClaim reports nothing for a genuine conditional bound to `multiple`', () => {
      const synthetic = `<ul role="listbox" aria-multiselectable={multiple ? 'true' : null}></ul>`;
      expect(checkMultiselectableClaim(synthetic)).toEqual([]);
    });
  });
});
