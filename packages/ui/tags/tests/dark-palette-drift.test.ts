/**
 * dark-palette-drift.test.ts — the Tags dark-palette structural-drift gate
 * (260927-a2w), adapted directly from `@rozie-ui/rete`'s
 * `packages/ui/rete/tests/dark-palette-drift.test.ts` (Phase 83 / D-20 / D-21 / D-22).
 *
 * THE FAILURE MODE THIS FILE GUARDS: Tags's dark palette is hand-maintained in
 * THREE places (the SFC `<style>` OS-dark block, `themes/base.css`'s
 * `.dark`/`[data-theme="dark"]` block, and `themes/base.css`'s own OS-dark
 * block), and the OS-dark GUARD SELECTOR is hand-maintained in TWO of those
 * three (the SFC copy and the `base.css` copy). The rete precedent already
 * produced two real, user-visible bugs from exactly this structure: a naive
 * guard shape that compiles to dead code with zero compiler diagnostics, and a
 * token present in one copy but missing from another. This file guards BOTH
 * halves of that contract for Tags's smaller 8-token color surface: guard
 * survival (this describe block) and palette union-of-keys parity (the second
 * describe block below).
 *
 * This file runs under the package's own vitest config (`vitest.config.ts`)
 * alongside `surface.test.ts` — `environment: 'node'`, `include: ['tests/**\/*.test.ts']`.
 *
 * EVERY assertion in this file reads EMITTED output. `pnpm --filter @rozie-ui/tags
 * build` MUST precede `pnpm --filter @rozie-ui/tags test`, or the leaf reads below
 * are stale and this file gives a FALSE GREEN.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const readSrc = (relPath: string) => readFileSync(resolve(ROOT, relPath), 'utf8');

/**
 * The literal OS-dark light-opt-out guard selector. Byte-identical to the one
 * `@rozie-ui/rete`'s FlowCanvas already shipped — one wording, reused across
 * the whole `@rozie-ui` family. Named for the DOCUMENT ROOT, under
 * `:where()`, and nothing else, so the palette sits at zero specificity and
 * loses to any ancestor override.
 */
const GUARD = ':where(:root:not(.light):not([data-theme="light"]))';

/**
 * The five light-DOM emitted leaves that must carry the guard verbatim. React's
 * entry is `Tags.global.css`, NOT `Tags.css`: the `:root {}` escape-hatch
 * block relocates the OS-dark block from the scoped sidecar to the unscoped
 * global one (confirmed against the real `pnpm --filter @rozie-ui/tags build`
 * output, matching the rete/TipTap precedent's React split).
 */
const LIGHT_DOM_LEAVES: ReadonlyArray<readonly [string, string]> = [
  ['react', 'packages/react/src/Tags.global.css'],
  ['vue', 'packages/vue/src/Tags.vue'],
  ['svelte', 'packages/svelte/src/Tags.svelte'],
  ['angular', 'packages/angular/src/Tags.ts'],
  ['solid', 'packages/solid/src/Tags.tsx'],
];

const LIT_LEAF = 'packages/lit/src/Tags.ts';

/**
 * Strip CSS `/* ... *\/` comments before either the brace-counter or the token
 * regex ever sees the text. Neither `extractBlock`'s brace-counter nor
 * `extractTokens`'s regex has any notion of "inside a comment": an unbalanced
 * `{`/`}` inside a future comment would mis-locate a block's closing brace, and
 * a token-shaped string in prose would be regex-matched as a real declaration.
 * Comments are removed outright (not blanked to equal length) — every caller
 * here re-derives its own start/end offsets FROM the stripped text via
 * `indexOf`/brace-counting, so nothing downstream depends on offsets into the
 * original, unstripped source.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Brace-counts from the FIRST `{` after `marker` to the point where nesting
 * returns to zero, and returns that slice (marker through matching close-brace,
 * inclusive). Brace counting rather than a line-range slice is deliberate: it
 * survives future line-number drift.
 *
 * `fromLastOccurrence` exists because `themes/base.css`'s own header comment
 * describes the OS-dark feature in prose using the exact literal string
 * `@media (prefers-color-scheme: dark)` — a first-occurrence `indexOf` on that
 * marker would anchor on the COMMENT text, not the real rule. The actual
 * OS-dark rule is base.css's LAST occurrence of that string.
 */
function extractBlock(
  text: string,
  marker: string,
  opts: { fromLastOccurrence?: boolean } = {},
): string {
  const stripped = stripComments(text);
  const start = opts.fromLastOccurrence ? stripped.lastIndexOf(marker) : stripped.indexOf(marker);
  if (start === -1) {
    throw new Error(`dark-palette-drift: marker not found: ${JSON.stringify(marker)}`);
  }
  const braceStart = stripped.indexOf('{', start);
  if (braceStart === -1) {
    throw new Error(`dark-palette-drift: no opening brace found after marker: ${JSON.stringify(marker)}`);
  }
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++;
    else if (stripped[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) {
    throw new Error(`dark-palette-drift: unbalanced braces after marker: ${JSON.stringify(marker)}`);
  }
  return stripped.slice(start, end + 1);
}

/**
 * Every dark-palette declaration in `block`, public name -> trimmed value. The palette is
 * declared on the PRIVATE `--rtg-*` names (so a public `--rozie-tags-*` token set on an
 * ancestor wins over it); each is keyed here by its public name.
 */
function extractTokens(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of stripComments(block).matchAll(/--(?:rozie-tags|rtg)-([a-z-]+)\s*:\s*([^;]+);/g)) {
    out.set(`--rozie-tags-${m[1]}`, m[2].trim());
  }
  return out;
}

// The three hand-maintained dark blocks, extracted once and shared by both
// describe blocks below (guard-selector survival + palette union-of-keys).
const sfcSrc = readSrc('src/Tags.rozie');
const baseCssSrc = readSrc('src/themes/base.css');

const sfcDarkBlock = extractBlock(sfcSrc, '@media (prefers-color-scheme: dark)');
const baseDarkClassBlock = extractBlock(baseCssSrc, ':where(.dark, [data-theme="dark"]) {');
const baseOsDarkBlock = extractBlock(baseCssSrc, '@media (prefers-color-scheme: dark)', {
  fromLastOccurrence: true,
});

describe('dark-palette-drift — OS-dark guard selector', () => {
  it('base.css OS-dark block still carries the guard selector', () => {
    // Green today — this is a regression guard for the REFERENCE copy, not the
    // thing this plan fixes. If this ever goes red, base.css's own guard (the
    // one `themes/base.css`'s header comment documents) broke.
    const src = readSrc('src/themes/base.css');
    expect(src.includes(GUARD)).toBe(true);
  });

  it('the SFC OS-dark block is wrapped in the :root escape hatch', () => {
    const src = readSrc('src/Tags.rozie');
    expect(
      src.includes(GUARD),
      'the SFC source no longer contains the guard selector at all',
    ).toBe(true);

    // Distinguishing signal between the working escape-hatch shape and the naive
    // bare top-level rule that compiles to dead code: the escape-hatch shape
    // nests `@media (prefers-color-scheme: dark)` INSIDE the outer `:root {}`
    // wrapper, so the at-rule line is INDENTED. An unindented (column-0) at-rule
    // line means the guard was re-flattened to top level — `scopeCss()` then
    // scopes past the leading `:root` pseudo and silently inserts the scope
    // attribute BEFORE it, requiring the literal `<html>` element to carry it.
    // That makes the dark-mode override permanently inert on every light-DOM
    // target, with ZERO compiler diagnostic either way.
    const mediaLine = src
      .split('\n')
      .find((line) => line.includes('@media (prefers-color-scheme: dark)'));
    expect(mediaLine, 'no @media (prefers-color-scheme: dark) line found').toBeDefined();
    expect(
      /^\s+@media \(prefers-color-scheme: dark\)/.test(mediaLine ?? ''),
      'the @media line is NOT indented — the guard was flattened back to a bare ' +
        'top-level rule, which compiles to silently dead CSS on every light-DOM target',
    ).toBe(true);
  });

  it.each(LIGHT_DOM_LEAVES)(
    '%s emitted leaf carries the OS-dark guard selector verbatim',
    (_target, relPath) => {
      const src = readSrc(relPath);
      // Substring presence, NEVER a start-anchored or line-anchored match:
      // Angular's emitter auto-prepends `::ng-deep ` to every selector in an
      // escape-hatch rule, so an anchored assertion would fail there for a
      // non-reason (the guard is still fully intact, just prefixed).
      expect(
        src.includes(GUARD),
        `${relPath} does not contain the guard selector as a substring`,
      ).toBe(true);
    },
  );

  it('the angular leaf carries the ::ng-deep-prefixed form', () => {
    const src = readSrc('packages/angular/src/Tags.ts');
    // Pins Angular's shadow-piercing prefix explicitly, so a future emitter
    // change that drops `::ng-deep` (and therefore silently un-pierces the
    // guard rule under Angular's emulated ViewEncapsulation) is noticed here
    // rather than absorbed by the looser substring check above.
    expect(src.includes(`::ng-deep ${GUARD}`)).toBe(true);
  });

  it('the lit leaf injects the guard at document level', () => {
    // The `static styles` copy lives inside the shadow root, where `:root` never
    // matches; the copy that works is the trailing `injectGlobalStyles(...)` call,
    // which declares the palette on the document root, whence it inherits into the
    // shadow tree (and into a Tags nested in another component's shadow root).
    const src = readSrc(LIT_LEAF);
    const global = src.slice(src.indexOf('injectGlobalStyles('));
    expect(global.includes(GUARD)).toBe(true);
  });

  it('no dark copy declares a public token', () => {
    // Declared on the public `--rozie-tags-*` names, the palette would shadow a
    // value an app sets on any element below the root; it lives on `--rtg-*`.
    // Scoped to the three DARK blocks only (not the whole file): base.css's
    // LIGHT `:where(:root)` block legitimately declares a few public tokens
    // directly (`--rozie-tags-font: inherit`, `--rozie-tags-color: inherit`,
    // `--rozie-tags-chip-color: inherit`) by pre-existing, documented design
    // (the header comment's "lines that say `inherit` stay plain declarations"
    // rule) — those are unrelated to dark-mode and must not fail this guard.
    for (const [name, block] of [
      ['SFC OS-dark block (Tags.rozie)', sfcDarkBlock],
      ['base.css .dark/[data-theme="dark"] block', baseDarkClassBlock],
      ['base.css OS-dark block', baseOsDarkBlock],
    ] as const) {
      expect(
        block.match(/^\s*--rozie-tags-[a-z-]+\s*:/gm) ?? [],
        `${name} declares a public --rozie-tags-* token`,
      ).toEqual([]);
    }
  });

  it('no dark copy declares the palette on the .rozie-tags element', () => {
    // The regression this file also guards: a palette declared ON
    // `.rozie-tags` shadows every ancestor override (see GUARD above).
    const offenders: string[] = [];
    for (const [name, text] of [
      ['src/Tags.rozie', readSrc('src/Tags.rozie')],
      ['src/themes/base.css', readSrc('src/themes/base.css')],
    ] as const) {
      const stripped = stripComments(text);
      for (const m of stripped.matchAll(/([^{};]*)\{[^{}]*--(?:rozie-tags|rtg)-[a-z-]+\s*:/g)) {
        if (m[1].includes('.rozie-tags')) offenders.push(`${name}: ${m[1].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // Deliberately no assertion on Solid's `__rozieInjectStyle('Tags-<hash>', …)`
  // style-id string anywhere in this file: that hash is derived per compile and
  // would break on any unrelated recompile. Match on CSS content only (the
  // it.each loop above already covers Solid via GUARD substring presence).
});

/**
 * The palette union-of-keys drift predicate, scaled to Tags's 8-token color
 * surface (rete's equivalent predicate covers ~33 tokens and asserts
 * `> 30` as an extractor-sanity floor; Tags's surface is small enough that an
 * EXACT count is more precise here than a threshold). Reuses `extractTokens`
 * and the `sfcDarkBlock` / `baseDarkClassBlock` / `baseOsDarkBlock` slices
 * defined once at module scope above (shared with the guard-selector describe
 * block).
 */
describe('dark-palette-drift — palette union-of-keys', () => {
  const sfcDark = extractTokens(sfcDarkBlock);
  const baseDarkClass = extractTokens(baseDarkClassBlock);
  const baseOsDark = extractTokens(baseOsDarkBlock);

  const BLOCKS: ReadonlyArray<readonly [string, Map<string, string>]> = [
    ['SFC OS-dark block (Tags.rozie)', sfcDark],
    ['base.css .dark/[data-theme="dark"] block', baseDarkClass],
    ['base.css OS-dark block', baseOsDark],
  ];

  // Tags's 8 new tokens are ALL color-bearing by design (see the PLAN's
  // exclusion list for the geometry/opacity tokens that never get a dark
  // entry), so — unlike rete's mixed 15-light-only-of-33 surface — the union
  // here is expected to be EXACTLY 8, not merely non-empty.
  const union = Array.from(
    new Set([...sfcDark.keys(), ...baseDarkClass.keys(), ...baseOsDark.keys()]),
  ).sort();

  it('the computed dark-key union is exactly the 8-token color surface', () => {
    // A broken extractor that returns an empty (or partial) slice would make
    // some predicates below pass vacuously. Assert against the exact expected
    // set (not just a count) so a wrong-but-same-length union is also caught.
    expect(union).toEqual(
      [
        '--rozie-tags-accent',
        '--rozie-tags-bg',
        '--rozie-tags-border-color',
        '--rozie-tags-chip-bg',
        '--rozie-tags-disabled-bg',
        '--rozie-tags-focus-ring-color',
        '--rozie-tags-placeholder-color',
        '--rozie-tags-remove-hover-bg',
      ].sort(),
    );
  });

  it.each(BLOCKS)('%s declares the full union of dark keys', (name, tokens) => {
    const missing = union.filter((key) => !tokens.has(key));
    expect(missing, `${name} is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it.each(BLOCKS)(
    '%s declares identical values to the reference block (SFC) for every shared union key',
    (name, tokens) => {
      // The SFC block is the reference copy: it is the zero-import default — the
      // exact CSS a consumer gets with no import of base.css at all — so it is
      // the copy every other hand-maintained copy must agree with. (Comparing
      // the SFC block against itself here is intentional and trivially passes;
      // it keeps the it.each loop uniform across all three named blocks.)
      const mismatches: string[] = [];
      for (const key of union) {
        const refValue = sfcDark.get(key);
        const value = tokens.get(key);
        if (refValue !== undefined && value !== undefined && value !== refValue) {
          mismatches.push(`${key}: ${JSON.stringify(value)} !== reference ${JSON.stringify(refValue)}`);
        }
      }
      expect(
        mismatches,
        `${name} has value mismatches vs the SFC reference:\n${mismatches.join('\n')}`,
      ).toEqual([]);
    },
  );
});
