/**
 * Fallback splitter — lang= attribute capture suite (WR-06 resolution).
 *
 * The fallback splitter (`splitBlocks.fallback.ts`) is INACTIVE BY DEFAULT
 * (D-04 / D-05). It is an emergency @vue/compiler-sfc-backed drop-in for the
 * primary htmlparser2-backed `splitBlocks`. Both paths are contractually
 * required to produce byte-equivalent output, and from Phase 9 onwards the
 * contract surface includes `BlockEntry.lang`.
 *
 * ── Structural note on test inputs ──────────────────────────────────────────
 * Real `.rozie` files use a `<rozie name="…">…</rozie>` root wrapper, but
 * Vue's SFC parser treats an outer `<rozie>` element as a single opaque
 * customBlock — the inner `<script>`, `<template>`, and `<style>` are NOT
 * visible to `@vue/compiler-sfc` at all. For that reason, the fallback in
 * practice only correctly populates `result.script` etc. when called with
 * a source where Vue can see the inner blocks as top-level SFC elements.
 *
 * To exercise the `lang=` capture code in `sfcBlockToEntry` without fighting
 * this structural limitation, these tests place the `<rozie name="…">` as a
 * sibling element *before* the `<script>` block (`<rozie name="T"></rozie>`
 * then `<script lang="…">…</script>`).  With that layout:
 *   - Vue recognises `<script>` as a first-class SFC block (populates
 *     `descriptor.script` with the correct `.lang` property).
 *   - The fallback's rozie-envelope regex matches `<rozie name="T">` and
 *     sets `result.rozie` correctly.
 *   - The `sfcBlockToEntry` helper runs its `block.lang` path, which is the
 *     exact code we need to cover for WR-06.
 *
 * WR-06 edge cases under test:
 *  1. normal `lang="ts"` valued attribute
 *  2. boolean `<script lang>` (no value, no `=`)
 *  3. empty `<script lang="">` (valued but empty) — the pre-fix divergence case
 *  4. plain `<script>` (no attribute)
 *
 * ── Pre-fix divergence (lang="") ────────────────────────────────────────────
 * The original fallback read `block.attrs?.lang`. Vue normalises `lang=""`
 * to `attrs.lang = true` (boolean), so `typeof langAttr === 'string'` failed
 * and the `lang` key was silently dropped. The primary splitter, by contrast,
 * fires `onattribdata` with an empty-string slice, building
 * `savedLangChunks = ['']` whose `.length > 0` sets `blockLang = ''` —
 * meaning the key IS present with value `''`.
 *
 * The fix reads `block.lang` (Vue's resolved property) instead:
 *   - `lang="ts"`   → `block.lang = "ts"`, `block.attrs.lang = "ts"` (both agree)
 *   - `<script lang>` → `block.lang = undefined`, `block.attrs.lang = true`
 *     (fallback correctly drops key; matches primary which also drops it)
 *   - `lang=""`     → `block.lang = ""`, `block.attrs.lang = true`
 *     (fallback now emits `lang: ""`; matches primary — this was the divergence)
 *   - no `lang`     → `block.lang = undefined` → key absent (both agree)
 */
import { describe, expect, it } from 'vitest';
import { splitBlocksFallback } from '../src/splitter/splitBlocks.fallback.js';

/**
 * Build a test source where `<rozie name="T"></rozie>` precedes the SFC block.
 * This lets Vue see the block as a first-class SFC element while still
 * giving the fallback's rozie-regex something to match.
 */
function withRozie(blockHtml: string): string {
  return `<rozie name="T"></rozie>${blockHtml}`;
}

describe('splitBlocksFallback — lang= attribute capture (WR-06)', () => {
  // -----------------------------------------------------------------------
  // 1. Normal case: lang="ts"
  // -----------------------------------------------------------------------
  it('captures lang="ts" on a <script> block', () => {
    const source = withRozie('<script lang="ts">const x: number = 1;</script>');
    const result = splitBlocksFallback(source, 'Typed.rozie');
    // Rozie envelope recovered by the regex.
    expect(result.rozie?.name).toBe('T');
    expect(result.script).toBeDefined();
    // Key must be present and correct.
    expect(result.script?.lang).toBe('ts');
    expect(Object.hasOwn(result.script as object, 'lang')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 2. Boolean attribute: <script lang>  (no '=' and no value)
  //
  // Primary:  onattribdata never fires → savedLangChunks = [] →
  //           blockLang = null → key ABSENT.
  // Fallback: block.lang === undefined → key ABSENT.
  // Both agree: key ABSENT.
  // -----------------------------------------------------------------------
  it('leaves lang absent for a boolean <script lang> (no value)', () => {
    const source = withRozie('<script lang>const x = 1;</script>');
    const result = splitBlocksFallback(source, 'BoolLang.rozie');
    expect(result.rozie?.name).toBe('T');
    expect(result.script).toBeDefined();
    // Key must be ABSENT — same as primary splitter.
    expect(result.script?.lang).toBeUndefined();
    expect(Object.hasOwn(result.script as object, 'lang')).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 3. Empty value: lang=""  ← pre-fix divergence
  //
  // Pre-fix fallback: Vue sets attrs.lang = true (boolean) for lang="",
  //   so `typeof langAttr === 'string'` was false → key ABSENT.
  // Primary splitter: onattribdata fires with empty slice, savedLangChunks = [''],
  //   .length > 0 true → blockLang = '' → key PRESENT with value ''.
  //
  // Post-fix: uses block.lang (= '') instead of block.attrs.lang (= true) →
  //   resolvedLang = '' → key PRESENT with value '' → matches primary.
  // -----------------------------------------------------------------------
  it('captures lang="" (empty-string value) as lang: "" — byte-equivalent with primary (WR-06 fix)', () => {
    const source = withRozie('<script lang="">const x = 1;</script>');
    const result = splitBlocksFallback(source, 'EmptyLang.rozie');
    expect(result.rozie?.name).toBe('T');
    expect(result.script).toBeDefined();
    // Key must be PRESENT with value '' — same as primary splitter.
    expect(Object.hasOwn(result.script as object, 'lang')).toBe(true);
    expect(result.script?.lang).toBe('');
  });

  // -----------------------------------------------------------------------
  // 4. No lang attribute
  //
  // Primary:  no onattribname for 'lang' → savedLangChunks = [] →
  //           blockLang = null → key ABSENT.
  // Fallback: block.lang = undefined → key ABSENT.
  // Both agree: key ABSENT.
  // -----------------------------------------------------------------------
  it('leaves lang absent for a plain <script> (no attribute)', () => {
    const source = withRozie('<script>const x = 1;</script>');
    const result = splitBlocksFallback(source, 'Bare.rozie');
    expect(result.rozie?.name).toBe('T');
    expect(result.script).toBeDefined();
    // Key must be ABSENT — same as primary splitter.
    expect(result.script?.lang).toBeUndefined();
    expect(Object.hasOwn(result.script as object, 'lang')).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 5. Style block: lang capture is generic (not script-only)
  // -----------------------------------------------------------------------
  it('captures lang="scss" on a <style> block', () => {
    const source = withRozie('<style lang="scss">.a { color: red; }</style>');
    const result = splitBlocksFallback(source, 'Styled.rozie');
    expect(result.rozie?.name).toBe('T');
    expect(result.style).toBeDefined();
    expect(result.style?.lang).toBe('scss');
    expect(Object.hasOwn(result.style as object, 'lang')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 6. sfcBlockToEntry lang pass-through — verify the helper correctly
  // threads block.lang into the returned BlockEntry for all four cases
  // without relying on primary/fallback equivalence (which is not testable
  // end-to-end because the fallback's Vue-based parser cannot see blocks
  // that are nested inside a <rozie> wrapper — see file-header note).
  // -----------------------------------------------------------------------
  it('script block carries lang key on the returned BlockEntry', () => {
    // Valued lang: key must be present.
    const valued = withRozie('<script lang="ts">const x: number = 1;</script>');
    const r1 = splitBlocksFallback(valued, 'v.rozie');
    expect(r1.script).toBeDefined();
    expect(r1.script?.lang).toBe('ts');

    // Empty lang: key must be present with value ''.
    const empty = withRozie('<script lang="">const x = 1;</script>');
    const r2 = splitBlocksFallback(empty, 'e.rozie');
    expect(r2.script).toBeDefined();
    expect(r2.script?.lang).toBe('');

    // Boolean lang / no lang: key must be absent.
    for (const src of [
      withRozie('<script lang>const x = 1;</script>'),
      withRozie('<script>const x = 1;</script>'),
    ]) {
      const r = splitBlocksFallback(src, 'b.rozie');
      expect(r.script).toBeDefined();
      expect(Object.hasOwn(r.script as object, 'lang')).toBe(false);
    }
  });
});
