/**
 * slot-prop-fallthrough.test.ts — Quick 261008-mmu Task 1.
 *
 * A component's OWN slot props must never be part of the attribute
 * pass-through spread onto the root element. Reported by oinbox dogfooding
 * `@rozie-ui/toast-solid`: the root carried
 * `toastslot="({toast:e,dismiss:n})=>…"` — Solid's spread `setAttribute`s an
 * unknown key, which stringifies a render function.
 *
 * compile()×6 on the REAL Toaster.rozie (reads the BUILT core, so this is red
 * for Solid + React until the emitter fix lands):
 *   - Solid: the `splitProps` key list contains `toastSlot` and `slots`.
 *   - React: the `attrs` rest destructure contains `renderToast` and `slots`.
 *   - Vue / Svelte / Angular / Lit are structurally immune; one light pin per
 *     target documents WHY, so a future emit change that removes the immunity
 *     fails here instead of leaking silently.
 *
 * Pure GLUE over the @rozie/core public API.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'Toaster.rozie');
const source = readFileSync(SRC, 'utf8');

type Target = 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'lit';
const TARGETS: Target[] = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

const out = {} as Record<Target, string>;
for (const target of TARGETS) {
  const r = compile(source, { target, filename: 'Toaster.rozie' });
  out[target] = r.code ?? '';
}

describe('Toaster.rozie slot props stay out of the root DOM spread (compile ×6)', () => {
  for (const target of TARGETS) {
    it(`${target}: compiles with zero error diagnostics`, () => {
      const r = compile(source, { target, filename: 'Toaster.rozie' });
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(out[target].length).toBeGreaterThan(0);
    });
  }

  it("solid: the splitProps key list contains 'toastSlot' and 'slots'", () => {
    const line = out.solid.split('\n').find((l) => l.includes('splitProps('));
    expect(line).toBeDefined();
    const m = /splitProps\([^,]+,\s*\[([^\]]*)\]\)/.exec(line!);
    expect(m).not.toBeNull();
    const keys = m![1]!.split(',').map((k) => k.trim().replace(/^'|'$/g, ''));
    expect(keys).toContain('toastSlot');
    expect(keys).toContain('slots');
  });

  it('react: the attrs rest destructure skips renderToast and slots', () => {
    const m = /const\s*\{([^}]*?)\s*,?\s*\.\.\.rest\s*\}\s*=/.exec(out.react);
    expect(m).not.toBeNull();
    const names = m![1]!.split(',').map((k) => k.trim());
    expect(names).toContain('renderToast');
    expect(names).toContain('slots');
  });

  it('svelte: immune — the toast snippet and snippets are pulled out of $props() before the rest binding', () => {
    const m = /let\s*\{([^}]*?)\.\.\.__rozieAttrs\s*\}\s*(?::\s*Props\s*)?=\s*\$props\(\)/.exec(out.svelte);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/\btoast\s*:\s*__toastProp\b/);
    expect(m![1]).toMatch(/\bsnippets\b/);
  });

  it('lit: immune — the toast receiver is declared attribute:false (host attributes only reach $attrs)', () => {
    expect(out.lit).toMatch(/@property\(\{\s*attribute:\s*false\s*\}\)\s*toast\?:/);
  });

  it('angular: immune — the slot resolves through ContentChild, not a rest bucket', () => {
    expect(out.angular).toMatch(/@ContentChild\('toast',\s*\{\s*read:\s*TemplateRef\s*\}\)/);
  });

  it('vue: immune — the slot renders through a native named <slot> (slots are not in $attrs)', () => {
    expect(out.vue).toContain('<slot name="toast"');
  });
});
