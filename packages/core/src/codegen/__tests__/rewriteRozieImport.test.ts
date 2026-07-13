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
    // 'solid' is now a valid target (Phase 06.3-01). Use a genuinely unknown
    // value to exercise the defensive throw path.
    expect(() =>
      rewriteRozieImport('./Foo.rozie', 'qwerty' as unknown as 'vue'),
    ).toThrow(/unknown target/);
  });

  it('Test 9 (solid omit-ext): strips .rozie, no extension appended (mirrors react/angular)', () => {
    expect(rewriteRozieImport('./Counter.rozie', 'solid')).toBe('./Counter');
  });

  // Phase 75 (D-08/D-09) — a PUBLISHED cross-package specifier derives the
  // per-target package name instead of a plain extension swap.
  it('Test 10 (published specifier, react): derives the -react package, no subpath', () => {
    expect(rewriteRozieImport('@rozie-ui/combobox/Combobox.rozie', 'react')).toBe(
      '@rozie-ui/combobox-react',
    );
  });

  it('Test 11 (published specifier, vue): derives the -vue package (no .vue extension appended)', () => {
    expect(rewriteRozieImport('@rozie-ui/combobox/Combobox.rozie', 'vue')).toBe(
      '@rozie-ui/combobox-vue',
    );
  });

  it('Test 12 (published specifier, all 6 targets): derives one package per target', () => {
    const targets = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
    for (const target of targets) {
      expect(rewriteRozieImport('@rozie-ui/combobox/Combobox.rozie', target)).toBe(
        `@rozie-ui/combobox-${target}`,
      );
    }
  });

  it('Test 13 (tsconfig-alias specifier stays local, extension-swap): @/ prefix is NOT published', () => {
    expect(rewriteRozieImport('@/components/Modal.rozie', 'react')).toBe(
      '@/components/Modal',
    );
  });
});
