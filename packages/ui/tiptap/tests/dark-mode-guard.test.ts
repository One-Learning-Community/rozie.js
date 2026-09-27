/**
 * dark-mode-guard.test.ts — the TipTap dark-palette structural-drift gate
 * (260927-a2v).
 *
 * Modeled on `@rozie-ui/rete`'s `dark-palette-drift.test.ts`, trimmed to ONE
 * source-of-truth copy since TipTap has no `themes/base.css` triplication — the
 * SFC's `:root {}` escape hatch is the ONLY place the dark palette lives.
 *
 * THE FAILURE MODE THIS FILE GUARDS: FlowCanvas's own dark palette shipped once
 * with NO light-opt-out guard at all, silently, because the naive `@media`
 * nesting shape compiles to dead code with zero compiler diagnostics — an
 * unindented (column-0) `@media` line means the guard was flattened back to a
 * bare top-level rule, and `scopeCss()` then scopes past the leading `:root`
 * pseudo and inserts the scope attribute BEFORE it, requiring the literal
 * `<html>` element to carry it. This file pins the working shape so the same
 * regression class cannot recur silently in TipTap.
 *
 * EVERY assertion in this file reads EMITTED output. `pnpm --filter
 * @rozie-ui/tiptap build` MUST precede `pnpm --filter @rozie-ui/tiptap test`, or
 * the leaf reads below are stale and this file gives a FALSE GREEN.
 *
 * Files are read with `readFileSync(..., 'utf8')`, never a plain shell `grep`:
 * `TipTap.rozie` and every emitted leaf are flagged `data`/non-ASCII by
 * `file(1)` because of an em-dash in header comments, which silently breaks an
 * unflagged `grep` without `-a`. Node's `readFileSync('utf8')` has no such
 * problem.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const readSrc = (relPath: string) => readFileSync(resolve(ROOT, relPath), 'utf8');

/**
 * The literal OS-dark light-opt-out guard selector, byte-identical to
 * @rozie-ui/rete's FlowCanvas.rozie copy (the only existing @rozie-ui dark-mode
 * convention this plan reuses verbatim, per D-01).
 */
const GUARD = ':where(:root:not(.light):not([data-theme="light"]))';

/**
 * The five light-DOM emitted leaves that must carry the guard verbatim. React's
 * entry is `TipTap.global.css`, NOT `TipTap.css`: the `:root {}` escape-hatch
 * form emits the OS-dark block UNSCOPED into the global sidecar, not the scoped
 * per-instance one.
 */
const LIGHT_DOM_LEAVES: ReadonlyArray<readonly [string, string]> = [
  ['react', 'packages/react/src/TipTap.global.css'],
  ['vue', 'packages/vue/src/TipTap.vue'],
  ['svelte', 'packages/svelte/src/TipTap.svelte'],
  ['angular', 'packages/angular/src/TipTap.ts'],
  ['solid', 'packages/solid/src/TipTap.tsx'],
];

const LIT_LEAF = 'packages/lit/src/TipTap.ts';

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Brace-counts from the FIRST `{` after `marker` to the point where nesting
 * returns to zero, and returns that slice (marker through matching close-brace,
 * inclusive). Brace counting rather than a line-range slice survives line-number
 * drift from unrelated edits elsewhere in the file.
 */
function extractBlock(text: string, marker: string): string {
  const stripped = stripComments(text);
  const start = stripped.indexOf(marker);
  if (start === -1) {
    throw new Error(`dark-mode-guard: marker not found: ${JSON.stringify(marker)}`);
  }
  const braceStart = stripped.indexOf('{', start);
  if (braceStart === -1) {
    throw new Error(`dark-mode-guard: no opening brace found after marker: ${JSON.stringify(marker)}`);
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
    throw new Error(`dark-mode-guard: unbalanced braces after marker: ${JSON.stringify(marker)}`);
  }
  return stripped.slice(start, end + 1);
}

describe('dark-mode-guard — OS-dark guard selector (260927-a2v)', () => {
  const sfcSrc = readSrc('src/TipTap.rozie');

  it('the SFC OS-dark block is wrapped in the :root engine-DOM escape hatch', () => {
    expect(
      sfcSrc.includes(GUARD),
      'the SFC source no longer contains the guard selector at all',
    ).toBe(true);

    // Distinguishing signal between the working escape-hatch shape and the naive
    // bare top-level rule that compiles to dead code: the escape-hatch shape
    // nests `@media (prefers-color-scheme: dark)` INSIDE the outer `:root {}`
    // wrapper, so the at-rule line is INDENTED.
    const mediaLine = sfcSrc
      .split('\n')
      .find((line) => line.includes('@media (prefers-color-scheme: dark)'));
    expect(mediaLine, 'no @media (prefers-color-scheme: dark) line found').toBeDefined();
    expect(
      /^\s+@media \(prefers-color-scheme: dark\)/.test(mediaLine ?? ''),
      'the @media line is NOT indented — the guard was flattened back to a bare ' +
        'top-level rule, which compiles to silently dead CSS on every light-DOM target',
    ).toBe(true);
  });

  it('no dark declaration uses a public --rozie-tiptap-* name', () => {
    // Declared on the public names, the palette would shadow a value an app sets
    // on any element below the root; it lives on `--rtt-*` instead.
    const block = extractBlock(sfcSrc, '@media (prefers-color-scheme: dark)');
    expect(block.match(/^\s*--rozie-tiptap-[a-z-]+\s*:/gm) ?? []).toEqual([]);
  });

  it('the dark block is nested inside :root {}, not any .rozie-tiptap* selector', () => {
    const stripped = stripComments(sfcSrc);
    const markerIndex = stripped.indexOf('@media (prefers-color-scheme: dark)');
    expect(markerIndex).toBeGreaterThan(-1);
    // Walk backward from the marker to the nearest preceding top-level
    // selector/at-rule opening brace's owning text, and confirm it is the bare
    // `:root {` wrapper — not a `.rozie-tiptap` rule (which would mean the block
    // regressed to being scoped to the component instance instead of the
    // document root).
    const preceding = stripped.slice(0, markerIndex);
    const lastRootOpen = preceding.lastIndexOf(':root {');
    const lastRozieTiptapOpen = preceding.lastIndexOf('.rozie-tiptap');
    expect(
      lastRootOpen,
      'no preceding ":root {" wrapper found before the @media block',
    ).toBeGreaterThan(-1);
    expect(
      lastRootOpen > lastRozieTiptapOpen,
      'the @media block is nested inside a .rozie-tiptap rule, not the :root {} escape hatch',
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
    const src = readSrc('packages/angular/src/TipTap.ts');
    expect(src.includes(`::ng-deep ${GUARD}`)).toBe(true);
  });

  it('the lit leaf injects the guard at document level, not inside static styles', () => {
    // The `static styles` copy lives inside the shadow root, where `:root` never
    // matches; the copy that works is the `injectGlobalStyles(...)` call, which
    // declares the palette on the document root, whence it inherits into the
    // shadow tree.
    const src = readSrc(LIT_LEAF);
    const injectIndex = src.indexOf('injectGlobalStyles(');
    expect(injectIndex, 'injectGlobalStyles( call not found in the Lit leaf').toBeGreaterThan(-1);
    const global = src.slice(injectIndex);
    expect(global.includes(GUARD)).toBe(true);
  });
});
