/**
 * live-regions-emit.test.ts — Quick 261008-mmu Task 2.
 *
 * compile()×6 on the REAL Toaster.rozie, no DOM. Every target must emit the
 * standing live regions as STATIC markup — a wrapper, a polite `role="status"`
 * region and an assertive `role="alert"` region, each with an explicit
 * `aria-atomic="false"` — and NO target may emit a computed `aria-live`
 * binding (the old per-row `:aria-live="liveFor(t.type)"` in any of its
 * per-target forms: JSX brace, Lit template hole, Angular attribute binding,
 * Vue/Svelte bound attribute).
 *
 * The behaviour itself is proven on the mounted Vue leaf in
 * behavior/live-regions.behavior.test.ts (and on all six in VR).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(HERE, '..', 'src', 'Toaster.rozie'), 'utf8');

type Target = 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'lit';
const TARGETS: Target[] = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

const COMPUTED_ARIA_LIVE =
  /\[attr\.aria-live\]|\[aria-live\]|:aria-live=|aria-live=\{|aria-live=\$\{|aria-live="\$\{|aria-live='\$\{/;

/** The opening tag (up to the closing `>`) of the first element carrying `role="<role>"`. */
function openingTagWithRole(code: string, role: string): string | null {
  const m = new RegExp(`<div[^>]*\\brole="${role}"[^>]*>`).exec(code);
  return m === null ? null : m[0];
}

describe('Toaster.rozie standing live regions (compile ×6)', () => {
  for (const target of TARGETS) {
    describe(target, () => {
      const r = compile(source, { target, filename: 'Toaster.rozie' });
      const code = r.code ?? '';

      it('compiles with zero error diagnostics', () => {
        expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(code.length).toBeGreaterThan(0);
      });

      it('emits the wrapper and a static polite status region', () => {
        expect(code).toContain('rozie-toaster-live');
        const tag = openingTagWithRole(code, 'status');
        expect(tag, 'no <div role="status"> region').not.toBeNull();
        expect(tag).toContain('aria-live="polite"');
        expect(tag).toContain('aria-atomic="false"');
      });

      it('emits a static assertive alert region', () => {
        const tag = openingTagWithRole(code, 'alert');
        expect(tag, 'no <div role="alert"> region').not.toBeNull();
        expect(tag).toContain('aria-live="assertive"');
        expect(tag).toContain('aria-atomic="false"');
      });

      it('emits NO computed aria-live binding', () => {
        expect(code).not.toMatch(COMPUTED_ARIA_LIVE);
      });
    });
  }
});
