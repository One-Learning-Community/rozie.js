/**
 * dark-palette-drift.test.ts — the FlowCanvas dark-palette structural-drift gate
 * (Phase 83 / D-20 / D-21 / D-22).
 *
 * THE FAILURE MODE THIS FILE GUARDS: FlowCanvas's dark palette is hand-maintained
 * in THREE places (the SFC `<style>` OS-dark block, `themes/base.css`'s
 * `.dark`/`[data-theme="dark"]` block, and `themes/base.css`'s own OS-dark block),
 * and the OS-dark GUARD SELECTOR is hand-maintained in TWO of those three (the SFC
 * copy and the `base.css` copy). That structure has already produced two real,
 * user-visible bugs: ISSUE-3 (this phase's headline finding — the SFC copy shipped
 * with NO light-opt-out guard at all, silently, because the naive guard shape
 * compiles to dead code with zero compiler diagnostics) and A4 (a token present in
 * the SFC copy but missing from both `base.css` copies). Two independent bugs from
 * one structural cause: hand-maintained triplication with nothing catching drift.
 *
 * This plan (83-01) lands only the GUARD half of the contract (D-22) — that the
 * OS-dark ancestor-guard selector survives compilation intact on every target.
 * Plan 02 extends this SAME file with the PALETTE half (D-20's union-of-keys
 * predicate across the three dark blocks).
 *
 * This file runs under the package's own vitest config (`vitest.config.ts`)
 * alongside `surface.test.ts` and `sidecars.test.ts` — `environment: 'node'`,
 * `include: ['tests/**\/*.test.ts']`.
 *
 * EVERY assertion in this file reads EMITTED output. `pnpm --filter @rozie-ui/rete
 * build` MUST precede `pnpm --filter @rozie-ui/rete test`, or the leaf reads below
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
 * The literal OS-dark light-opt-out guard selector (Branch 1 of the two-branch
 * selector list — the five light-DOM targets). Byte-identical between
 * `themes/base.css` and the SFC's `:root {}` escape-hatch copy — one wording,
 * two files.
 */
const GUARD = ':root:not(.light):not([data-theme="light"]) .rozie-flow-canvas';

/**
 * Branch 2 of the selector list — the Lit-only branch that keeps Lit's
 * zero-import OS-dark default alive inside its shadow root, where Branch 1's
 * `:root` ancestor guard can never be observed from outside the shadow boundary.
 * `.rozie-flow-canvas:not(html *)` was chosen over `:host .rozie-flow-canvas`
 * because Angular's own `wrapBareNgDeep` emits a BARE `::ng-deep` (not `:host
 * ::ng-deep`) for `:root {}` engine rules specifically so engine-rendered DOM
 * outside the host still gets pierced — a `:host`-anchored branch would swim
 * against that existing assumption, and its interaction with Angular's own
 * `:host`-rewriting is unverified. `:not(html *)` carries no `:host` token, so it
 * sidesteps the risk entirely.
 */
const LIT_BRANCH = '.rozie-flow-canvas:not(html *)';

/**
 * The five light-DOM emitted leaves that must carry the guard verbatim, using the
 * ACTUAL paths Task 2 recorded — in particular React's entry is
 * `FlowCanvas.global.css`, NOT `FlowCanvas.css`: the `:root {}` escape-hatch move
 * relocates the OS-dark block from the scoped sidecar to the unscoped global one.
 */
const LIGHT_DOM_LEAVES: ReadonlyArray<readonly [string, string]> = [
  ['react', 'packages/react/src/FlowCanvas.global.css'],
  ['vue', 'packages/vue/src/FlowCanvas.vue'],
  ['svelte', 'packages/svelte/src/FlowCanvas.svelte'],
  ['angular', 'packages/angular/src/FlowCanvas.ts'],
  ['solid', 'packages/solid/src/FlowCanvas.tsx'],
];

const LIT_LEAF = 'packages/lit/src/FlowCanvas.ts';

describe('dark-palette-drift — OS-dark guard selector (D-22)', () => {
  it('base.css OS-dark block still carries the guard selector', () => {
    // Green today — this is a regression guard for the REFERENCE copy, not the
    // thing this phase fixes. If this ever goes red, base.css's own guard (the
    // one `themes/base.css`'s header comment documents) broke.
    const src = readSrc('src/themes/base.css');
    expect(src.includes(GUARD)).toBe(true);
  });

  it('the SFC OS-dark block is wrapped in the :root engine-DOM escape hatch', () => {
    const src = readSrc('src/FlowCanvas.rozie');
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

  it('the angular leaf carries the ng-deep-prefixed form', () => {
    const src = readSrc('packages/angular/src/FlowCanvas.ts');
    // Pins Angular's shadow-piercing prefix explicitly, so a future emitter
    // change that drops `::ng-deep` (and therefore silently un-pierces the
    // guard rule under Angular's emulated ViewEncapsulation) is noticed here
    // rather than absorbed by the looser substring check above.
    expect(src.includes(`::ng-deep ${GUARD}`)).toBe(true);
  });

  it('the lit leaf records the documented shadow-root gap', () => {
    // Lit's `static styles` copy lives inside a shadow root, where the ancestor
    // guard (`:root:not(.light)...`) can never match from outside the shadow
    // boundary — D-01's accepted, documented gap: Lit stays unguarded and keeps
    // its zero-import OS-dark default regardless of a `.light` /
    // `[data-theme="light"]` opt-out at the document root. This assertion exists
    // so that gap stays a recorded contract rather than an accident.
    const src = readSrc(LIT_LEAF);
    // Branch 1 (the light-DOM guard) is present verbatim too — the selector list
    // is shared source, emitted into BOTH `static styles` (shadow-scoped) and the
    // trailing `injectGlobalStyles(...)` document-level call — but it is INERT
    // inside the shadow root, which is exactly what makes Branch 2 necessary.
    expect(src.includes(GUARD)).toBe(true);
    // Branch 2 — the selector that keeps Lit's OS-dark default alive — must also
    // be present verbatim.
    expect(src.includes(LIT_BRANCH)).toBe(true);
  });

  // Deliberately no assertion on Solid's `__rozieInjectStyle('FlowCanvas-<hash>',
  // …)` style-id string anywhere in this file: that hash is derived per compile
  // and would break on any unrelated recompile. Match on CSS content only (the
  // it.each loop above already covers Solid via GUARD substring presence).
});

/**
 * D-20/D-21 — the palette union-of-keys drift predicate (Plan 83-02).
 *
 * Brace-counts from the FIRST `{` after `marker` to the point where nesting
 * returns to zero, and returns that slice (marker through matching close-brace,
 * inclusive). Brace counting rather than a line-range slice is deliberate: it
 * survives future line-number drift, and it already survived Plan 01's
 * re-nesting of the SFC block inside the `:root { @media {...} } }` escape
 * hatch. Throws a NAMED error if the marker is absent, so a renamed block fails
 * loudly instead of silently comparing against an empty slice.
 *
 * `fromLastOccurrence` exists because `themes/base.css`'s own header comment
 * (lines 7 and 109) describes the OS-dark feature in prose using the exact
 * literal string `@media (prefers-color-scheme: dark)` — a first-occurrence
 * `indexOf` on that marker would anchor on the COMMENT text, not the real rule.
 * The actual OS-dark rule is base.css's LAST occurrence of that string.
 */
/**
 * Strip CSS `/* ... *\/` comments before either the brace-counter or the token
 * regex ever sees the text (WR-02). Neither `extractBlock`'s brace-counter nor
 * `extractTokens`'s regex has any notion of "inside a comment": an unbalanced
 * `{`/`}` inside a future comment would mis-locate a block's closing brace, and
 * a token-shaped string in prose (e.g. `/* was --rozie-flow-old-shadow: rgba(0,0,0,.6);
 * before D-23 *\/`) would be regex-matched as a real declaration. Comments are
 * removed outright (not blanked to equal length) — every caller here re-derives
 * its own start/end offsets FROM the stripped text via `indexOf`/brace-counting,
 * so nothing downstream depends on offsets into the original, unstripped source.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

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

/** Every `--rozie-flow-*` declaration in `block`, name -> trimmed value. */
function extractTokens(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of stripComments(block).matchAll(/(--rozie-flow-[a-z-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

describe('dark-palette-drift — palette union-of-keys (D-20)', () => {
  const sfcSrc = readSrc('src/FlowCanvas.rozie');
  const baseCssSrc = readSrc('src/themes/base.css');

  const sfcDarkBlock = extractBlock(sfcSrc, '@media (prefers-color-scheme: dark)');
  const baseDarkClassBlock = extractBlock(baseCssSrc, '.dark .rozie-flow-canvas,');
  const baseOsDarkBlock = extractBlock(baseCssSrc, '@media (prefers-color-scheme: dark)', {
    fromLastOccurrence: true,
  });

  const sfcDark = extractTokens(sfcDarkBlock);
  const baseDarkClass = extractTokens(baseDarkClassBlock);
  const baseOsDark = extractTokens(baseOsDarkBlock);

  const BLOCKS: ReadonlyArray<readonly [string, Map<string, string>]> = [
    ['SFC OS-dark block (FlowCanvas.rozie)', sfcDark],
    ['base.css .dark/[data-theme="dark"] block', baseDarkClass],
    ['base.css OS-dark block', baseOsDark],
  ];

  // D-20's predicate compares the three DARK blocks to EACH OTHER only — it never
  // compares dark against light. 13 of this phase's 15 new tokens are light-only
  // by design (sizes, font family, focus-ring width, body padding, socket border
  // width, chrome insets) and are never declared in ANY dark block. A
  // light-vs-dark key comparison would therefore fail immediately on this
  // phase's own additions and would need a hand-maintained allowlist to stay
  // green — exactly the kind of upkeep the last two bugs (ISSUE-3's missing
  // guard, A4's missing token) suggest nobody keeps current. Light-only tokens
  // are structurally excluded here for free: since they are absent from all
  // three dark sets, they never enter the union computed below.
  const union = Array.from(
    new Set([...sfcDark.keys(), ...baseDarkClass.keys(), ...baseOsDark.keys()]),
  ).sort();

  it('the computed dark-key union is non-empty and larger than 30 keys (extractor sanity)', () => {
    // A broken extractor that returns an empty (or near-empty) slice would make
    // every predicate below pass vacuously against three (near-)empty sets. This
    // is deliberately NOT an exact count assertion — D-19's own rationale notes
    // the absolute counts (33/33/34) are each off by one, and baking a wrong
    // literal into the suite is exactly what this test must not do. Assert
    // against the computed union, not a hardcoded number.
    expect(union.length).toBeGreaterThan(30);
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
