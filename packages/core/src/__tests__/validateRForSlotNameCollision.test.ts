/**
 * ROZ980 — r-for loop variable shadows a slot rendered inside the loop.
 * End-to-end through compile() (which shares lowerToIR with @rozie/unplugin), so
 * the diagnostic is proven to fire regardless of entrypoint. Warning-only.
 */
import { describe, expect, it } from 'vitest';
import { compile } from '../index.js';

const wrap = (template: string) =>
  `<rozie name="T"><data>{ items: [] }</data><template>${template}</template></rozie>`;

describe('ROZ980 — r-for loop var shadows a slot name', () => {
  it('warns when the loop ITEM alias equals a <slot> rendered inside the loop', () => {
    const src = wrap(
      `<ul><li r-for="toast in $data.items" :key="toast.id"><slot name="toast" :toast="toast">x</slot></li></ul>`,
    );
    const { diagnostics } = compile(src, { target: 'svelte', filename: 'T.rozie' });
    const hits = diagnostics.filter((d) => d.code === 'ROZ980');
    expect(hits).toHaveLength(1);
    expect(hits[0].severity).toBe('warning');
    // Dual code-frame: related[] points at the shadowed slot.
    expect(hits[0].related?.length).toBe(1);
  });

  it('fires on the same shared lower path for every target (svelte + non-svelte)', () => {
    const src = wrap(
      `<ul><li r-for="toast in $data.items" :key="toast.id"><slot name="toast" :toast="toast">x</slot></li></ul>`,
    );
    for (const target of ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const) {
      const { diagnostics } = compile(src, { target, filename: 'T.rozie' });
      expect(diagnostics.filter((d) => d.code === 'ROZ980')).toHaveLength(1);
    }
  });

  it('does NOT warn when the loop var differs from the slot name', () => {
    const src = wrap(
      `<ul><li r-for="t in $data.items" :key="t.id"><slot name="toast" :toast="t">x</slot></li></ul>`,
    );
    const { diagnostics } = compile(src, { target: 'svelte', filename: 'T.rozie' });
    expect(diagnostics.filter((d) => d.code === 'ROZ980')).toHaveLength(0);
  });

  it('does NOT warn when a same-named slot is rendered OUTSIDE the loop (disjoint scope)', () => {
    const src = wrap(
      `<div><slot name="item">x</slot><ul><li r-for="item in $data.items" :key="item.id">{{ item.id }}</li></ul></div>`,
    );
    const { diagnostics } = compile(src, { target: 'svelte', filename: 'T.rozie' });
    expect(diagnostics.filter((d) => d.code === 'ROZ980')).toHaveLength(0);
  });
});
