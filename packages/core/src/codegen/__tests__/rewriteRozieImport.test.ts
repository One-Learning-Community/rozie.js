/**
 * rewriteRozieImport.test.ts — Phase 06.2 P2 Task 0.
 *
 * Unit tests for the shared rewriteRozieImport helper. Covers all 4 targets
 * + path-traversal preservation + defensive non-`.rozie` passthrough +
 * unknown-target throwing per CONTEXT.md D-118.
 */
import { describe, it, expect } from 'vitest';
import { rewriteRozieImport } from '../rewriteRozieImport.js';

describe('rewriteRozieImport — D-118 shared helper', () => {
  it('Test 1 (vue ext): appends .vue', () => {
    expect(rewriteRozieImport('./Modal.rozie', 'vue')).toBe('./Modal.vue');
  });

  it('Test 2 (react omit-ext): strips .rozie, no extension appended', () => {
    expect(rewriteRozieImport('./Modal.rozie', 'react')).toBe('./Modal');
  });

  it('Test 3 (svelte ext): appends .svelte', () => {
    expect(rewriteRozieImport('./Modal.rozie', 'svelte')).toBe('./Modal.svelte');
  });

  it('Test 4 (angular omit-ext): strips .rozie, no extension appended', () => {
    expect(rewriteRozieImport('./Modal.rozie', 'angular')).toBe('./Modal');
  });

  it('Test 5 (deep relative path): preserves .. directory traversal', () => {
    expect(rewriteRozieImport('../shared/Card.rozie', 'vue')).toBe('../shared/Card.vue');
  });

  it('Test 6 (with directory): preserves nested dirs', () => {
    expect(rewriteRozieImport('./components/CardHeader.rozie', 'svelte')).toBe(
      './components/CardHeader.svelte',
    );
  });

  it('Test 7 (idempotent: non-`.rozie` passthrough): leaves non-rozie paths untouched', () => {
    expect(rewriteRozieImport('./styles.css', 'vue')).toBe('./styles.css');
  });

  it('Test 8 (unknown target throws): surfaces typo bugs early', () => {
    expect(() =>
      rewriteRozieImport('./Foo.rozie', 'solid' as unknown as 'vue'),
    ).toThrow(/unknown target/);
  });
});
