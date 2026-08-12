/**
 * EVENT-NAME CONTRACT CONFORMANCE — quick task 260811-sdd.
 *
 * Two independent bugs of the SAME class shipped within a day of each other:
 *   - Lit dispatched camelCase against a kebab listener (quick 260811-nre,
 *     commit 82918527) — `rewriteScript.ts`'s plain `$emit()` lowering kept
 *     the raw camelCase source name, while the consumer's `@region-in`
 *     listener stayed hyphenated. `addEventListener` is case-sensitive, so
 *     the listener never fired.
 *   - Angular bound a literal kebab listener against a camelCase `output()`
 *     field (quick 260811-r2m, commit 9d651e12) — `emitTemplateEvent.ts`
 *     lowered a consumer's `@kebab-name` listener on a composed CHILD
 *     COMPONENT to the literal `(kebab-name)=`, but the child's Angular
 *     class declares a camelCase `output()` field. Angular event-binding
 *     names must match the output name exactly.
 *
 * Both were silent: no build error, no diagnostic, just a listener that
 * never fires. Each was caught late and fixed with a per-target fixture that
 * can drift independently of the other five. This suite pins the CLASS, not
 * the two instances: "author camelCase in $emit, bind kebab in templates,
 * works on every target" becomes a structural, single-fixture invariant that
 * no target — nor a regression, nor a future seventh target — can
 * reintroduce the asymmetry against.
 *
 * ── RED-VERIFICATION (mutation check, observed …) ────────────────────────
 * TODO(Task 2): both emitter fixes are already landed, so this suite is born
 * green — which proves nothing on its own (a fixture that passes pre-fix
 * cements the bug; memory feedback_snapshot_tests_cement_bugs). Task 2 fills
 * this block by mutating each fix in turn, observing the resulting RED
 * verbatim, and restoring.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_TARGETS,
  canonicalize,
  childTagFor,
  compilePair,
  extractChildPublicNames,
  extractParentBoundNames,
  stem,
  type ChildNameEntry,
  type Target,
} from './event-contract.harness.js';

const CHILD_A = 'EventChild.rozie';
const PARENT_A = 'EventParent.rozie';
const CHILD_B = 'AliasEmitChild.rozie';
const PARENT_B = 'AliasEmitParent.rozie';

/** Authored `$emit` names in EventChild.rozie — multi-word + single-word control. */
const AUTHORED_A = ['itemActivated', 'ready'] as const;
/** Authored `$emit` name in AliasEmitChild.rozie — the separator-authored residual. */
const AUTHORED_B = 'edge-click';

function findEntry(entries: ChildNameEntry[], authoredName: string): ChildNameEntry {
  const s = stem(authoredName);
  const found = entries.find((e) => stem(e.name) === s);
  if (!found) {
    throw new Error(
      `no child entry matches authored name "${authoredName}" (stem "${s}") among: ${JSON.stringify(entries)}`,
    );
  }
  return found;
}

function findBound(bound: string[], authoredName: string): string {
  const s = stem(authoredName);
  const found = bound.find((n) => stem(n) === s);
  if (!found) {
    throw new Error(
      `no parent-bound name matches authored name "${authoredName}" (stem "${s}") among: ${JSON.stringify(bound)}`,
    );
  }
  return found;
}

describe('compile smoke', () => {
  it('fixture A (camelCase-authored emit) compiles to all six targets without a compiler-error diagnostic', () => {
    for (const target of ALL_TARGETS) {
      expect(() => compilePair(CHILD_A, PARENT_A, target)).not.toThrow();
    }
  });

  it('fixture B (separator-authored emit) compiles to all six targets without a compiler-error diagnostic', () => {
    for (const target of ALL_TARGETS) {
      expect(() => compilePair(CHILD_B, PARENT_B, target)).not.toThrow();
    }
  });
});

describe('fixture A — camelCase-authored emit (the shipped contract)', () => {
  for (const target of ALL_TARGETS) {
    it(`${target}: itemActivated + ready agree, are provenance-clean, and are internally linked`, () => {
      const { childCode, parentCode } = compilePair(CHILD_A, PARENT_A, target);
      const childTag = childTagFor('EventChild', target);
      const childEntries = extractChildPublicNames(childCode, target);
      const parentBound = extractParentBoundNames(parentCode, childTag, target);

      // A silently DROPPED event must fail here, not vacuously pass an
      // empty-set comparison below.
      expect(
        childEntries.length,
        `[${target}] expected exactly 2 child-declared event names, got: ${JSON.stringify(childEntries)}`,
      ).toBe(2);
      expect(
        parentBound.length,
        `[${target}] expected exactly 2 parent-bound listener names, got: ${JSON.stringify(parentBound)}`,
      ).toBe(2);

      for (const authoredName of AUTHORED_A) {
        const childEntry = findEntry(childEntries, authoredName);
        const boundName = findBound(parentBound, authoredName);

        // (a) AGREEMENT — the contract itself.
        expect(
          canonicalize(childEntry.name, target),
          `[${target}] ${authoredName}: childPublic "${childEntry.name}" vs parentBound ` +
            `"${boundName}" must canonicalize equal`,
        ).toBe(canonicalize(boundName, target));

        // (b) PROVENANCE — neither side may drift off the authored name.
        expect(
          stem(childEntry.name),
          `[${target}] ${authoredName}: child public name "${childEntry.name}" does not stem ` +
            `back to the authored name`,
        ).toBe(stem(authoredName));
        expect(
          stem(boundName),
          `[${target}] ${authoredName}: parent bound name "${boundName}" does not stem back ` +
            `to the authored name`,
        ).toBe(stem(authoredName));

        // (c) INTERNAL LINKAGE — the child's dispatch site references its
        // own declared name (angular this.<fieldId>.emit() uses the field
        // id, which for fixture A equals the public name since there is no
        // alias here; vue emit('<declared>'); react/solid/svelte the
        // declared prop identifier; lit the dispatch string is the public
        // name).
        expect(
          childEntry.dispatchLinkage,
          `[${target}] ${authoredName}: no dispatch-site reference found for declared name ` +
            `"${childEntry.name}" — declared but never actually dispatched`,
        ).toBe(childEntry.name);
      }
    });
  }
});

describe('fixture B — separator-authored emit (the aliased-output residual)', () => {
  const GREEN_TARGETS: Target[] = ['react', 'solid', 'vue', 'svelte', 'lit'];

  for (const target of GREEN_TARGETS) {
    it(`${target}: edge-click agrees under this target's own event mechanism`, () => {
      const { childCode, parentCode } = compilePair(CHILD_B, PARENT_B, target);
      const childTag = childTagFor('AliasEmitChild', target);
      const childEntry = findEntry(extractChildPublicNames(childCode, target), AUTHORED_B);
      const boundName = findBound(extractParentBoundNames(parentCode, childTag, target), AUTHORED_B);

      expect(
        canonicalize(childEntry.name, target),
        `[${target}] edge-click: childPublic "${childEntry.name}" vs parentBound "${boundName}" ` +
          `must canonicalize equal`,
      ).toBe(canonicalize(boundName, target));
    });
  }

  // ANGULAR RESIDUAL — an executable it.fails WITNESS, not a prose exclusion
  // (composed-ref-witness.test.ts idiom). AliasEmitChild.rozie authors
  // `$emit('edge-click', ...)` directly. Angular declares
  // `edgeClick = output<unknown>({ alias: 'edge-click' })` — Angular
  // resolves template bindings against the ALIAS when present, so the
  // child's PUBLIC binding name is the raw hyphenated `edge-click`, not the
  // camelCase field id `edgeClick`. quick 260811-r2m's consumer-side
  // camelization fix lowers the parent's `@edge-click=` listener to
  // `(edgeClick)=` (matching the FIELD ID, which is correct for the
  // NON-aliased fixture-A case) — which now MISSES the aliased output.
  // See .planning/todos/pending/angular-aliased-kebab-emit-output-unbindable.md
  // for the full analysis, including the empirical search proving this is
  // a LIVE shape (command-palette's `@action-select`), not hypothetical.
  //
  // This `it.fails` asserts the DESIRED end state (agreement) — it fails
  // for real today, and inverts to green the moment a declaration-side fix
  // lands, at which point vitest reports "expected to fail but passed",
  // forcing whoever lands that fix to convert this to a plain `it`.
  it.fails(
    'angular: edge-click (aliased output) currently DISAGREES — public name is the alias "edge-click", bound name is the field id "edgeClick" — see angular-aliased-kebab-emit-output-unbindable.md',
    () => {
      const { childCode, parentCode } = compilePair(CHILD_B, PARENT_B, 'angular');
      const childTag = childTagFor('AliasEmitChild', 'angular');
      const childEntry = findEntry(extractChildPublicNames(childCode, 'angular'), AUTHORED_B);
      const boundName = findBound(
        extractParentBoundNames(parentCode, childTag, 'angular'),
        AUTHORED_B,
      );

      // Observed values: childEntry.name === 'edge-click' (the alias),
      // boundName === 'edgeClick' (the field id the consumer-side fix
      // lowers to). canonicalize() is identity for angular, so these must
      // be pinned to disagree today.
      expect(
        canonicalize(childEntry.name, 'angular'),
        `[angular] edge-click residual: childPublic "${childEntry.name}" (alias) vs parentBound ` +
          `"${boundName}" (field id) — pinned per ` +
          `.planning/todos/pending/angular-aliased-kebab-emit-output-unbindable.md`,
      ).toBe(canonicalize(boundName, 'angular'));
    },
  );
});

describe('lit runtime — the extracted names interoperate through a real DOM EventTarget', () => {
  // Lit is the only target whose consumer registration is a genuine
  // case-sensitive `addEventListener` on a DOM node, so its failure mode is
  // invisible to intuition and only a real dispatch proves delivery. The
  // other five resolve names at compile time into prop keys or framework
  // bindings where string extraction is exact and a runtime leg would
  // require booting the whole framework for no additional evidence.
  it('dispatching the EXTRACTED child name against the EXTRACTED parent-bound name delivers detail.id via a real CustomEvent', () => {
    const { childCode, parentCode } = compilePair(CHILD_A, PARENT_A, 'lit');
    const childTag = childTagFor('EventChild', 'lit');
    const childEntry = findEntry(extractChildPublicNames(childCode, 'lit'), 'itemActivated');
    const boundName = findBound(extractParentBoundNames(parentCode, childTag, 'lit'), 'itemActivated');

    // Sanity: this is Lit — dispatch name IS the public name, and it should
    // be the hyphenated form (the bug this whole suite pins).
    expect(childEntry.name).toBe('item-activated');
    expect(boundName).toBe('item-activated');

    const parentEl = document.createElement('div');
    const childEl = document.createElement('span');
    parentEl.appendChild(childEl);

    let firedCount = 0;
    let receivedId: unknown;
    parentEl.addEventListener(boundName, (ev) => {
      firedCount += 1;
      receivedId = (ev as CustomEvent).detail?.id;
    });

    childEl.dispatchEvent(
      new CustomEvent(childEntry.dispatchLinkage, {
        bubbles: true,
        composed: true,
        detail: { id: 7 },
      }),
    );

    expect(firedCount, 'listener bound to the extracted parentBound name did not fire').toBe(1);
    expect(receivedId, '$event detail.id did not thread through the dispatch').toBe(7);

    // NEGATIVE CONTROL — the 260811-nre failure mode reproduced as an
    // executable statement: dispatching the RAW camelCase authored name
    // against the same kebab listener must NOT fire the handler.
    childEl.dispatchEvent(
      new CustomEvent('itemActivated', {
        bubbles: true,
        composed: true,
        detail: { id: 99 },
      }),
    );

    expect(
      firedCount,
      'raw camelCase dispatch fired the kebab-registered listener — this is exactly the ' +
        '260811-nre bug shape and must NOT happen',
    ).toBe(1);
  });
});
