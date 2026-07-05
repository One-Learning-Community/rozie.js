/**
 * scroll-origin.test.ts — regression guard for the render-all-pages scroll-spy
 * fight (the `@rozie-ui/pdf-vue@0.2.0` → 0.2.1 defect).
 *
 * THE BUG: in continuous mode the IntersectionObserver scroll spy wrote
 * $data.current AND relied on a synchronous `suppressScroll` boolean to stop the
 * $data.current $watch from scroll-snapping the page back. But that $watch runs on
 * a LATER flush (Vue flush:'pre'; the deferred-effect equivalent on every other
 * target), by which point the flag is already reset — so every spy-driven page
 * change called scrollToPage and snap-scrolled under the user's own scroll.
 *
 * THE FIX (origin-distinguishing, timing-independent, all 6 targets): the observer
 * ONLY writes $data.current (which echoes $model.page + `pagechange`); the
 * continuous-mode scroll-into-view is triggered EXCLUSIVELY at the navigation
 * origins — goToPage() and the `page`-prop $watch — never from the reactive
 * $data.current effect. There is no suppress flag.
 *
 * This test encodes that contract as a behavioral INVARIANT (per the
 * "add toggled-state assertions, don't just re-emit" convention), not a snapshot:
 *   - the $data.current $watch callback must NOT call scrollToPage (the exact bug);
 *   - the two navigation origins (goToPage + the `page` $watch) MUST call it (so
 *     the fix can't degenerate into "never scroll");
 *   - no `suppressScroll`-style cross-flush flag survives in the source OR in any
 *     of the 6 compiled leaves.
 *
 * Source-level assertions are single-syntax and robust; codegen is deterministic,
 * so a correct source is a correct emit for all six. The compiled-output check is
 * a plain substring (no brittle proximity parsing) that additionally proves no
 * target reintroduced the flag primitive.
 *
 * Pure GLUE over the @rozie/core public API — no compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'PdfViewer.rozie');
const FILENAME = 'PdfViewer.rozie';
const source = readFileSync(SRC, 'utf8');

/**
 * Slice a `<script>`-block region out of the .rozie source: from the first line
 * matching `startRe` up to (but not including) the first subsequent line matching
 * `endRe`. Used to isolate a single $watch/function body so the assertion is
 * scoped to it, not the whole file.
 */
function region(startRe: RegExp, endRe: RegExp): string {
  const start = source.search(startRe);
  expect(start, `region start ${startRe} not found`).toBeGreaterThanOrEqual(0);
  const after = source.slice(start + 1);
  const rel = after.search(endRe);
  expect(rel, `region end ${endRe} not found after ${startRe}`).toBeGreaterThanOrEqual(0);
  return source.slice(start, start + 1 + rel);
}

describe('PdfViewer render-all-pages scroll origin (0.2.1 regression guard)', () => {
  it('the $data.current $watch does NOT scroll (observer-driven changes must not snap the view)', () => {
    // from the internal-state $watch on $data.current up to the next $watch.
    const currentWatch = region(/\$watch\(\(\)\s*=>\s*\$data\.current/, /\$watch\(/);
    // sanity: we isolated the right block (it echoes the model + emits pagechange).
    expect(currentWatch).toContain('$model.page');
    expect(currentWatch).toContain('pagechange');
    // THE INVARIANT: no scroll from the reactive current effect.
    expect(currentWatch).not.toContain('scrollToPage');
  });

  it('goToPage scrolls the target into view in continuous mode (navigation origin)', () => {
    const goToPage = region(/function goToPage\(/, /function nextPage\(/);
    expect(goToPage).toContain('scrollToPage');
    expect(goToPage).toContain('renderAllPages');
  });

  it('a consumer :page write scrolls in continuous mode (navigation origin)', () => {
    const pageWatch = region(/\$watch\(\(\)\s*=>\s*\$props\.page/, /\$watch\(/);
    expect(pageWatch).toContain('scrollToPage');
    expect(pageWatch).toContain('renderAllPages');
  });

  it('no cross-flush suppress flag survives in the source', () => {
    expect(source).not.toMatch(/suppressScroll/);
  });

  const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
  it.each(TARGETS)('compiled %s output carries no suppress-flag primitive', (target) => {
    const { code } = compile(source, { target, filename: FILENAME });
    expect(code).not.toMatch(/suppressScroll/);
  });
});
