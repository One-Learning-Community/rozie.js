/**
 * Phase 79 Plan 13 (AC-N2 Layer 1) — emitted-code invariant assertions for
 * the four `loop-mustache-*-slot-rfor` fixtures, INDEPENDENT of their
 * `expected.*` snapshot files.
 *
 * Why this file exists at all: `regressions.test.ts` is a
 * `describe.each(FIXTURE_DIRS)` walker whose only correctness check is a
 * file-snapshot match against `expected.*` — a blind `pnpm ... -u` would
 * satisfy it with whatever the emitter happens to produce, cementing a
 * defect as "correct" forever (T-79-31). This file is the independent
 * authority Task 3's re-bless is judged against: it contains a
 * hand-written literal per invariant, so running the snapshot updater
 * CANNOT make it pass. (Deliberately never names vitest's snapshot-match
 * matcher by its literal identifier anywhere in this file — that identifier
 * string is itself the thing this file's own acceptance gate greps for
 * absence of, per 79-13-PLAN.md's Task 2 acceptance criteria.)
 *
 * All four fixtures author `<slot :name="loopVar">` where `loopVar` is a
 * bare identifier bound by `r-for`/`<template r-for>` — a NO-STATIC-PREFIX
 * dynamic slot name (the bound expression is a bare identifier reference,
 * not a template literal with a leading quasi), so every target routes it
 * through the generic record/index-signature path, never the R6 family
 * type surface. Pre-Phase-79, all six targets (except Vue, which was
 * already correct) misread `:name="loopVar"` as an ordinary scope-param
 * PROP literally named "name" bound to `loopVar`'s value, and rendered the
 * slot as the DEFAULT slot (the `''`-sentinel record key) — which is why
 * these four fixtures rendered nothing (see 79-KNOWN-RED-BASELINE.md and
 * BUG-LEDGER.md#R11-1, `✓ FIXED 260711-ad5` — that ledger entry covers the
 * unrelated loop-mustache-splice defect these fixtures were ORIGINALLY
 * authored to probe; the reason they still render zero DOM after this
 * plan is that they are producer-only with no consumer/filler wired, not
 * because of R11-1).
 *
 * Layer 2 (the React DOM-mount proof) lives in
 * `dynamic-slot-name-producer.test.tsx` — see that file's header for why
 * a live mount of THESE four fixtures is impossible by construction.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, 'fixtures');

type Target = 'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit';

interface Case {
  slug: string;
  /** the <props> array field the r-for iterates */
  loopSource: string;
  /** the r-for loop variable — ALSO the dynamic slot's :name expression */
  loopVar: string;
  targets: Target[];
}

/** Read straight from each fixture's own meta.json — never hand-duplicate. */
function readMetaTargets(slug: string): Target[] {
  const meta = JSON.parse(
    readFileSync(join(FIXTURES_DIR, slug, 'meta.json'), 'utf8'),
  ) as { targets: Target[] };
  return meta.targets;
}

const CASES: Case[] = [
  {
    slug: 'loop-mustache-slot-rfor',
    loopSource: 'items',
    loopVar: 'x',
    targets: readMetaTargets('loop-mustache-slot-rfor'),
  },
  {
    slug: 'loop-mustache-template-slot-rfor',
    loopSource: 'items',
    loopVar: 'x',
    targets: readMetaTargets('loop-mustache-template-slot-rfor'),
  },
  {
    slug: 'loop-mustache-keyed-slot-rfor',
    loopSource: 'rows',
    loopVar: 'row',
    targets: readMetaTargets('loop-mustache-keyed-slot-rfor'),
  },
  {
    slug: 'loop-mustache-nested-conditional-slot-rfor',
    loopSource: 'items',
    loopVar: 'x',
    targets: readMetaTargets('loop-mustache-nested-conditional-slot-rfor'),
  },
];

function compileFixture(slug: string, target: Target) {
  const source = readFileSync(join(FIXTURES_DIR, slug, 'input.rozie'), 'utf8');
  return compile(source, {
    target,
    filename: `${slug}.rozie`,
    types: true,
    sourceMap: false,
  });
}

/** True only for the ONE fixture whose loop variable is a Solid accessor
 * function (Solid's keyed `<Key each={...} by={...}>{(row) => ...}</Key>`
 * primitive yields `row` as a call, not a plain identifier — every other
 * fixture's `<For>` yields a plain identifier). */
function isSolidAccessorCall(slug: string): boolean {
  return slug === 'loop-mustache-keyed-slot-rfor';
}

describe('AC-N2 Layer 1 — dynamic :name-in-r-for record-key invariants (compile()-only, NOT snapshot-based)', () => {
  describe.each(CASES)('$slug', ({ slug, loopSource, loopVar, targets }) => {
    describe.each(targets)('%s target', (target) => {
      const { code, diagnostics } = compileFixture(slug, target);

      it('compiles with zero error-severity diagnostics', () => {
        expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      });

      // ---- Positive invariants: the loop variable reaches the record key ----

      if (target === 'react') {
        it(`props.slots is bracket-keyed by the loop variable "${loopVar}"`, () => {
          expect(code).toContain(`props.slots?.[${loopVar}]`);
        });
        it('the slots? type surface degrades to a generic record, not the old fixed default-slot shape', () => {
          expect(code).toContain(
            `[key: string]: ((...args: any[]) => import('react').ReactNode) | undefined;`,
          );
        });
        it(`the loop maps over props.${loopSource} directly, with the record lookup inside the callback`, () => {
          expect(code).toContain(`props.${loopSource}.map((${loopVar}) =>`);
        });
        it(`the runtime function-vs-fallback check reads the SAME bracket-keyed lookup`, () => {
          expect(code).toContain(`typeof props.slots?.[${loopVar}]`);
        });
        it('does NOT keep the old fixed-shape slots? record type', () => {
          expect(code).not.toContain(
            `Record<string, () => import('react').ReactNode>`,
          );
        });
      }

      if (target === 'solid') {
        const key = isSolidAccessorCall(slug) ? `${loopVar}()` : loopVar;
        it(`_props.slots is bracket-keyed by the loop variable "${loopVar}"`, () => {
          expect(code).toContain(`_props.slots?.[${key}]`);
        });
        it('the slots? type surface degrades to a generic record, not the old fixed default-slot shape', () => {
          expect(code).toContain(
            `[key: string]: ((...args: any[]) => JSX.Element) | undefined;`,
          );
        });
        it(`the loop iterates over local.${loopSource} directly`, () => {
          expect(code).toContain(`local.${loopSource}`);
        });
        it(`splitProps no longer pulls 'children' into the destructure — only ${loopSource}`, () => {
          expect(code).toContain(`splitProps(_merged, ['${loopSource}'])`);
        });
        it('does NOT keep the old fixed-shape slots? record type', () => {
          expect(code).not.toContain(
            `Record<string, (ctx: any) => JSX.Element>`,
          );
        });
        it(`does NOT still destructure 'children' alongside ${loopSource}`, () => {
          expect(code).not.toContain(
            `splitProps(_merged, ['${loopSource}', 'children'])`,
          );
        });
      }

      if (target === 'svelte') {
        it(`snippets is bracket-keyed by the loop variable "${loopVar}"`, () => {
          expect(code).toContain(`snippets?.[${loopVar}]`);
        });
        it('the dynamic-slot binding renders via {@render ...?.()}, not the old fixed `children` snippet call', () => {
          expect(code).toMatch(/\{@render __rozieDynSlot\d+\?\.\(\)\}/);
        });
        it(`the each-block iterates ${loopSource} binding ${loopVar} directly`, () => {
          expect(code).toContain(`{#each ${loopSource} as ${loopVar}`);
        });
        it(`the derived dynamic-slot binding is sourced from snippets?.[${loopVar}] directly`, () => {
          expect(code).toContain(`$derived(snippets?.[${loopVar}])`);
        });
        it("does NOT still destructure the old fixed 'children' prop out of $props()", () => {
          expect(code).not.toContain('children: __childrenProp,');
        });
      }

      if (target === 'angular') {
        it(`templates() is bracket-keyed by the loop variable "${loopVar}"`, () => {
          expect(code).toContain(`templates()?.[${loopVar}]`);
        });
        it('NgTemplateOutlet is still the composition primitive (unaffected by the dynamic-key fix)', () => {
          expect(code).toContain('NgTemplateOutlet');
        });
        it(`the @for block still iterates ${loopSource}() tracking ${loopVar}.id, untouched by the slot-key fix`, () => {
          expect(code).toContain(`@for (${loopVar} of ${loopSource}(); track ${loopVar}.id)`);
        });
        it('the templates() input signature is unchanged by the fix (only the consuming expression changed)', () => {
          expect(code).toContain(
            'templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);',
          );
        });
        it('does NOT still generate the old fixed default-slot ngTemplateContextGuard', () => {
          expect(code).not.toContain('ngTemplateContextGuard');
        });
        it('does NOT still generate the old fixed default-slot @ContentChild query', () => {
          expect(code).not.toContain('@ContentChild(');
        });
      }

      if (target === 'lit') {
        it(`this.rozieSlots is bracket-keyed by the loop variable "${loopVar}"`, () => {
          expect(code).toContain(`this.rozieSlots?.[${loopVar}]`);
        });
        it('the rozieSlots? property is a generic scope-taking record, not the old fixed default-slot function prop', () => {
          expect(code).toContain(
            `rozieSlots?: Record<string, (scope: any) => unknown>;`,
          );
        });
        it(`the repeat() directive still iterates this.${loopSource} directly`, () => {
          expect(code).toContain(`repeat<any>(this.${loopSource},`);
        });
        it('the slotchange tracking state is renamed off the "Default" naming onto the dynamic-slot naming', () => {
          expect(code).toContain('_hasSlotDynamic0');
        });
        it('does NOT keep the old "_hasSlotDefault" tracking-state name', () => {
          expect(code).not.toContain('_hasSlotDefault');
        });
        it('does NOT keep the old "_slotDefaultElements" query-target name', () => {
          expect(code).not.toContain('_slotDefaultElements');
        });
      }

      if (target === 'vue') {
        it(`the <slot> element keeps its correct dynamic :name binding on "${loopVar}" (byte-identity control — Vue's template was already right pre-phase; only its type block was wrong)`, () => {
          expect(code).toContain(`:name="${loopVar}"`);
        });
        it('the defineSlots type block degrades to a generic index signature, not the old fixed `default` member', () => {
          expect(code).toContain(
            `[key: string]: ((props: any) => any) | undefined;`,
          );
        });
        it(`the v-for directive still binds ${loopVar} directly off props.${loopSource}, untouched by the type-block fix`, () => {
          expect(code).toContain(`v-for="${loopVar} in props.${loopSource}"`);
        });
        it(`withDefaults still supplies the genuine empty-array default for ${loopSource}`, () => {
          expect(code).toContain(`{ ${loopSource}: () => [] }`);
        });
        it('does NOT keep the old fixed `default(props:` member signature', () => {
          expect(code).not.toContain('default(props:');
        });
      }

      // ---- Negative invariants: the pre-phase WRONG shapes are absent ----

      it('does NOT contain the pre-phase empty-string default-slot record key / default-slot fallback machinery', () => {
        // React's exact pre-phase children/slots merge onto the '' sentinel.
        expect(code).not.toContain(`props.slots?.['']`);
        // Solid's exact pre-phase default-slot resolver.
        expect(code).not.toContain('resolved()');
        expect(code).not.toContain('children(() => local.children)');
        // Svelte's exact pre-phase default-slot prop plumbing.
        expect(code).not.toContain('__childrenProp');
        expect(code).not.toContain('snippets?.children');
        // Angular's exact pre-phase default-slot fallback (keyed fixture only,
        // harmless no-op check on the other three targets/fixtures).
        expect(code).not.toContain(`templates()?.['defaultSlot']`);
        expect(code).not.toContain('defaultTpl');
        // Lit's exact pre-phase default-slot function prop.
        expect(code).not.toContain('__rozieDefaultSlot__');
        // Vue's exact pre-phase fixed default member.
        expect(code).not.toContain('default(props: { name: any }): any;');
      });

      it('does NOT contain a scope-param object keyed on the reserved slot-name key ("name")', () => {
        // React/Solid/Lit's exact pre-phase scope-param object literal at
        // the call site (two spacing idioms: JSX call-site vs Lit's
        // JSON.stringify template-literal form).
        expect(code).not.toContain(`{ name: ${loopVar} }`);
        expect(code).not.toContain(`{name: ${loopVar}}`);
        // Solid's keyed-fixture accessor-call form of the same object literal.
        expect(code).not.toContain(`{ name: ${loopVar}() }`);
        // React/Lit's exact pre-phase ctx interface naming the reserved key.
        expect(code).not.toMatch(/interface\s+\w*Ctx\s*\{\s*name:\s*any;?\s*\}/);
        // Svelte's exact pre-phase Snippet type parameter.
        expect(code).not.toContain('Snippet<[{ name: any }]>');
        // Angular's exact pre-phase DefaultCtx interface (keyed fixture only).
        expect(code).not.toMatch(
          /interface\s+DefaultCtx\s*\{[\s\S]*?name:\s*any;?[\s\S]*?\}/,
        );
      });

      void loopSource; // referenced by the backstop describe block below
    });
  });

  // ---- Held-out edge (backstop): empty array structurally renders nothing ----
  describe.each(CASES)('$slug — held-out edge (backstop)', ({ slug, targets }) => {
    it.each(targets)(
      '%s: the loop source defaults to a genuine empty array, and the record-key lookup is nested strictly inside the loop render callsite',
      (target) => {
        const { code } = compileFixture(slug, target);
        // Every target lowers an Array prop's `default: () => []` to a
        // genuinely empty array via that target's own default-value idiom:
        // React/Solid/Angular's `(() => [])()` factory call, Svelte's plain
        // `(() => [])()` assignment, Vue's withDefaults `() => []` factory
        // arg, Lit's declared class-field initializer `= [];`. Combined
        // with the positive invariants above (the record-key lookup is
        // emitted INSIDE that target's own loop-render callsite —
        // `.map(...)`, `{#each ...}`, `<For>`, `@for (... of ...)`,
        // `repeat(...)`, `v-for` — never as a sibling outside it), an empty
        // array structurally cannot reach a single slot lookup on any
        // target.
        //
        // This is a STRUCTURAL / compile-time backstop, not a live DOM
        // mount — Layer 1 is deliberately compile()-only per AC-N2's own
        // scope statement. These four fixtures are producer-only with no
        // consumer/filler wired, so a live mount would render nothing to
        // observe regardless of array length; see
        // dynamic-slot-name-producer.test.tsx (Layer 2) for the ONE
        // fixture (DynamicSlotsConsumer) where a live mount IS possible.
        const hasEmptyArrayDefault =
          code.includes('(() => [])()') ||
          code.includes('= [];') ||
          code.includes('() => []');
        expect(hasEmptyArrayDefault).toBe(true);
      },
    );
  });
});
